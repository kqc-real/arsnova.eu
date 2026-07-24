/**
 * Health & Server-Status (Story 0.1, 0.2, 0.4).
 * check | stats | footerBundle (Check+Stats parallel, ein Client-Request) | ping: Subscription Heartbeat
 */
import { adminProcedure, publicProcedure, router } from '../trpc';
import {
  HealthCheckResponseSchema,
  HealthFooterBundleSchema,
  HealthPingEventSchema,
  HealthSecurityStatsDTOSchema,
  ServerStatsDTOSchema,
} from '@arsnova/shared-types';
import { pingRedis, getRedis } from '../redis';
import { prisma } from '../db';
import { logger } from '../lib/logger';
import {
  formatUtcDate,
  getUtcDayStart,
  updateCompletedSessionsTotal,
} from '../lib/platformStatistic';
import {
  countActiveParticipantsForSessions,
  getActiveParticipantCountsForSessions,
} from '../lib/presence';
import { readLoadSignals } from '../lib/loadSignal';
import { pdfConcurrencyLimiter } from '../lib/pdfConcurrencyLimiter';
import { readPdfSignals } from '../lib/pdfTelemetry';
import { readSloSignals, type SloSignals } from '../lib/sloTelemetry';
import { readAbuseSignals } from '../lib/abuseTelemetry';
import { getWebSocketTelemetrySnapshot } from '../lib/websocketTelemetry';
import type {
  FooterStatusDTO,
  HealthSecurityStatsDTO,
  ServerStatsDTO,
} from '@arsnova/shared-types';

const ACTIVE_SESSION_MIN_PARTICIPANTS = 5;
const DAILY_HIGHSCORE_DAYS = 100;
const SERVER_STATS_CACHE_TTL_MS = 30_000;
const SERVER_STATUS_SCORE_THRESHOLDS = {
  busy: 60,
  overloaded: 170,
} as const;

const PARTICIPANT_HARD_LIMITS = {
  busy: 65,
  overloaded: 220,
} as const;

type LoadStatusInputs = {
  activeSessions: number;
  totalParticipants: number;
  activeBlitzRounds: number;
  votesLastMinute: number;
  sessionTransitionsLastMinute: number;
  activeCountdownSessions: number;
};

let cachedServerStats: { value: ServerStatsDTO; expiresAt: number } | null = null;
let serverStatsInFlight: Promise<ServerStatsDTO> | null = null;

function addUtcDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function buildDailyHighscores(
  rows: Array<{ date: Date; maxParticipantsSingleSession: number; updatedAt: Date | null }>,
  today: Date = new Date(),
) {
  const rangeEnd = getUtcDayStart(today);
  const rangeStart = addUtcDays(rangeEnd, -(DAILY_HIGHSCORE_DAYS - 1));
  const entriesByDate = new Map(
    rows.map((row) => [
      formatUtcDate(row.date),
      {
        count: Math.max(0, row.maxParticipantsSingleSession),
        updatedAt: row.updatedAt?.toISOString() ?? null,
      },
    ]),
  );

  return Array.from({ length: DAILY_HIGHSCORE_DAYS }, (_, index) => {
    const currentDate = addUtcDays(rangeStart, index);
    const dateKey = formatUtcDate(currentDate);
    const entry = entriesByDate.get(dateKey);
    return {
      date: dateKey,
      count: entry?.count ?? 0,
      updatedAt: entry?.updatedAt ?? null,
    };
  });
}

function calculateDailyHighscoresStatistics(entries: Array<{ count: number }>): {
  median: number;
  standardDeviation: number;
  max: number;
} {
  const counts = entries.map((e) => e.count).sort((a, b) => a - b);
  const n = counts.length;

  if (n === 0) {
    return { median: 0, standardDeviation: 0, max: 0 };
  }

  // Median berechnen
  const median = n % 2 === 0 ? (counts[n / 2 - 1] + counts[n / 2]) / 2 : counts[Math.floor(n / 2)];

  // Mittelwert für Standardabweichung
  const mean = counts.reduce((sum, count) => sum + count, 0) / n;

  // Standardabweichung berechnen
  const variance = counts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / n;
  const standardDeviation = Math.sqrt(variance);

  // Maximum berechnen
  const max = counts[n - 1];

  return { median: Math.round(median), standardDeviation, max };
}

function calculateDailyHighscoreWindowMax(entries: Array<{ count: number }>): number {
  return entries.reduce((currentMax, entry) => Math.max(currentMax, entry.count), 0);
}

function buildDailyHighscoreStatisticsEntries(
  rows: Array<{ date: Date; maxParticipantsSingleSession: number }>,
): Array<{ count: number }> {
  return rows
    .map((row) => ({
      count: Math.max(0, row.maxParticipantsSingleSession),
    }))
    .filter((entry) => entry.count > 0);
}

function getLoadStatus({
  activeSessions,
  totalParticipants,
  activeBlitzRounds,
  votesLastMinute,
  sessionTransitionsLastMinute,
  activeCountdownSessions,
}: LoadStatusInputs): 'healthy' | 'busy' | 'overloaded' {
  if (totalParticipants >= PARTICIPANT_HARD_LIMITS.overloaded) return 'overloaded';
  if (totalParticipants >= PARTICIPANT_HARD_LIMITS.busy) return 'busy';

  const loadScore =
    activeSessions * 1 +
    totalParticipants * 0.45 +
    activeBlitzRounds * 3 +
    activeCountdownSessions * 2 +
    votesLastMinute * 0.12 +
    sessionTransitionsLastMinute * 1.5;

  if (loadScore >= SERVER_STATUS_SCORE_THRESHOLDS.overloaded) return 'overloaded';
  if (loadScore >= SERVER_STATUS_SCORE_THRESHOLDS.busy) return 'busy';
  return 'healthy';
}

function mapLoadStatusToServiceStatus(
  loadStatus: 'healthy' | 'busy' | 'overloaded',
): 'stable' | 'limited' | 'critical' {
  switch (loadStatus) {
    case 'healthy':
      return 'stable';
    case 'busy':
      return 'limited';
    case 'overloaded':
      return 'critical';
  }
}

function getServiceStatus(
  loadStatus: 'healthy' | 'busy' | 'overloaded',
  sloSignals: SloSignals,
): 'stable' | 'limited' | 'critical' {
  // Für sehr kleine Samples bleibt der Status auf dem Lastindikator, um Ausreißer zu vermeiden.
  if (sloSignals.totalRequestsLastMinute < 20) {
    return mapLoadStatusToServiceStatus(loadStatus);
  }

  if (
    sloSignals.errorRatePercentLastMinute <= 0.5 &&
    sloSignals.p95LatencyMsLastMinute <= 1000 &&
    sloSignals.p99LatencyMsLastMinute <= 2000
  ) {
    return 'stable';
  }

  if (
    sloSignals.errorRatePercentLastMinute <= 1.0 &&
    sloSignals.p95LatencyMsLastMinute <= 1500 &&
    sloSignals.p99LatencyMsLastMinute <= 3000
  ) {
    return 'limited';
  }

  return 'critical';
}

/**
 * Zählt aktive Quick-Feedback-Runden ohne blockierendes Redis KEYS.
 * Nutzt cursor-basiertes SCAN. Nur Primär-Payload-Keys `qf:<code>` zählen — nicht
 * `qf:voters:…`, `qf:choices:…`, `qf:choices:r1:…` oder `qf:host:…` (sonst mehrfache Zählung pro Runde).
 */
async function countActiveBlitzRounds(): Promise<number> {
  const redis = getRedis();
  let cursor = '0';
  const primaryCodes = new Set<string>();

  do {
    const result = await redis.scan(cursor, 'MATCH', 'qf:*', 'COUNT', 200);
    cursor = result[0];
    const keys = result[1];
    for (const key of keys) {
      const segments = key.split(':');
      if (segments.length === 2 && segments[0] === 'qf' && segments[1].length > 0) {
        primaryCodes.add(key);
      }
    }
  } while (cursor !== '0');

  return primaryCodes.size;
}

/** Async-Generator für Heartbeat-Subscription (exportiert für Unit-Tests). */
export async function* heartbeatGenerator(
  intervalMs: number = 5000,
): AsyncGenerator<{ heartbeat: string }> {
  while (true) {
    yield HealthPingEventSchema.parse({ heartbeat: new Date().toISOString() });
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

async function fetchHealthCheck() {
  const redisOk = await pingRedis();
  return {
    status: 'ok' as const,
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    redis: redisOk ? ('ok' as const) : ('unavailable' as const),
  };
}

/** Server-Statistik für Startseite (Story 0.4). Bei nicht erreichbarer DB: Fallback (0 Werte), keine Prisma-Fehler. */
async function computeServerStats(): Promise<ServerStatsDTO> {
  const activeSessionWhere = {
    status: { not: 'FINISHED' as const },
  };
  const dailyHighscoreRangeEnd = getUtcDayStart(new Date());

  let activeBlitzRounds = 0;
  try {
    activeBlitzRounds = await countActiveBlitzRounds();
  } catch (err) {
    logger.warn(
      'health.stats: activeBlitzRounds konnte nicht aus Redis gelesen werden, setze 0.',
      err,
    );
  }

  try {
    const platformStatisticPromise = (async () => {
      try {
        const rows = await prisma.$queryRaw<
          Array<{
            maxParticipantsSingleSession: number | null;
            completedSessionsTotal: number | null;
            updatedAt: Date | null;
          }>
        >`
          SELECT "maxParticipantsSingleSession", "completedSessionsTotal", "updatedAt"
          FROM "PlatformStatistic"
          WHERE "id" = 'default'
          LIMIT 1
        `;
        const row = rows[0] ?? null;
        return {
          maxParticipantsSingleSession: row?.maxParticipantsSingleSession ?? 0,
          completedSessionsTotal: row?.completedSessionsTotal ?? null,
          updatedAtIso: row?.updatedAt?.toISOString() ?? null,
        };
      } catch {
        try {
          // DB-Drift-Fallback: ältere Schemas ohne completedSessionsTotal weiterhin unterstützen.
          const rows = await prisma.$queryRaw<
            Array<{
              maxParticipantsSingleSession: number | null;
              updatedAt: Date | null;
            }>
          >`
            SELECT "maxParticipantsSingleSession", "updatedAt"
            FROM "PlatformStatistic"
            WHERE "id" = 'default'
            LIMIT 1
          `;
          const row = rows[0] ?? null;
          return {
            maxParticipantsSingleSession: row?.maxParticipantsSingleSession ?? 0,
            completedSessionsTotal: null,
            updatedAtIso: row?.updatedAt?.toISOString() ?? null,
          };
        } catch {
          // Test-/Mock-Fallback ohne Raw-SQL.
          const row = await prisma.platformStatistic.findUnique({
            where: { id: 'default' },
            select: {
              maxParticipantsSingleSession: true,
              completedSessionsTotal: true,
              updatedAt: true,
            },
          });
          return {
            maxParticipantsSingleSession: row?.maxParticipantsSingleSession ?? 0,
            completedSessionsTotal: row?.completedSessionsTotal ?? null,
            updatedAtIso: row?.updatedAt?.toISOString() ?? null,
          };
        }
      }
    })();
    const dailyHighscoreRowsPromise = prisma.dailyStatistic
      .findMany({
        orderBy: { date: 'asc' },
        select: {
          date: true,
          maxParticipantsSingleSession: true,
          updatedAt: true,
        },
      })
      .catch((err) => {
        logger.warn(
          'health.stats: dailyHighscores konnten nicht aus PostgreSQL gelesen werden, setze leere Historie.',
          err,
        );
        return [];
      });

    const [
      openSessions,
      activeSessionIds,
      completedSessionsNow,
      platformRow,
      dailyHighscoreRows,
      loadSignals,
      sloSignals,
    ] = await Promise.all([
      prisma.session.count({ where: activeSessionWhere }),
      prisma.session.findMany({
        where: activeSessionWhere,
        select: { id: true },
      }),
      // Momentan in DB vorhandene FINISHED-Sessions (kann durch Purge sinken).
      prisma.session.count({ where: { status: 'FINISHED' } }),
      platformStatisticPromise,
      dailyHighscoreRowsPromise,
      readLoadSignals(),
      readSloSignals(),
    ]);
    const openSessionIds = activeSessionIds.map((session) => session.id);
    const [participantCounts, totalParticipants] = await Promise.all([
      getActiveParticipantCountsForSessions(openSessionIds),
      countActiveParticipantsForSessions(openSessionIds),
    ]);
    const activeSessions = [...participantCounts.values()].filter(
      (count) => count >= ACTIVE_SESSION_MIN_PARTICIPANTS,
    ).length;
    const persistedCompletedSessionsTotal = platformRow.completedSessionsTotal;
    const completedSessionsTotal =
      typeof persistedCompletedSessionsTotal === 'number'
        ? Math.max(completedSessionsNow, persistedCompletedSessionsTotal)
        : completedSessionsNow;
    if (
      typeof persistedCompletedSessionsTotal === 'number' &&
      completedSessionsNow > persistedCompletedSessionsTotal
    ) {
      void updateCompletedSessionsTotal(completedSessionsNow);
    }
    const loadStatus = getLoadStatus({
      activeSessions,
      totalParticipants,
      activeBlitzRounds,
      votesLastMinute: loadSignals.votesLastMinute,
      sessionTransitionsLastMinute: loadSignals.sessionTransitionsLastMinute,
      activeCountdownSessions: loadSignals.activeCountdownSessions,
    });
    const dailyHighscores = buildDailyHighscores(dailyHighscoreRows, dailyHighscoreRangeEnd);
    const dailyHighscoreStatisticsEntries =
      buildDailyHighscoreStatisticsEntries(dailyHighscoreRows);
    const dailyHighscoresStatistics = calculateDailyHighscoresStatistics(
      dailyHighscoreStatisticsEntries,
    );
    return {
      openSessions,
      activeSessions,
      totalParticipants,
      votesLastMinute: loadSignals.votesLastMinute,
      sessionTransitionsLastMinute: loadSignals.sessionTransitionsLastMinute,
      activeCountdownSessions: loadSignals.activeCountdownSessions,
      completedSessions: completedSessionsTotal,
      activeBlitzRounds,
      maxParticipantsSingleSession: platformRow.maxParticipantsSingleSession,
      dailyHighscores,
      dailyHighscoresStatistics: {
        ...dailyHighscoresStatistics,
        max: calculateDailyHighscoreWindowMax(dailyHighscores),
      },
      maxParticipantsStatisticUpdatedAt: platformRow.updatedAtIso,
      serviceStatus: getServiceStatus(loadStatus, sloSignals),
      loadStatus,
    };
  } catch {
    const emptyHighscores = buildDailyHighscores([]);
    return {
      openSessions: 0,
      activeSessions: 0,
      totalParticipants: 0,
      votesLastMinute: 0,
      sessionTransitionsLastMinute: 0,
      activeCountdownSessions: 0,
      completedSessions: 0,
      activeBlitzRounds: 0,
      maxParticipantsSingleSession: 0,
      dailyHighscores: emptyHighscores,
      dailyHighscoresStatistics: calculateDailyHighscoresStatistics(emptyHighscores),
      maxParticipantsStatisticUpdatedAt: null,
      serviceStatus: 'stable' as const,
      loadStatus: 'healthy' as const,
    };
  }
}

async function fetchSecurityStats(): Promise<HealthSecurityStatsDTO> {
  const [pdfSignals, abuseSignals] = await Promise.all([readPdfSignals(), readAbuseSignals()]);
  const pdfSnapshot = pdfConcurrencyLimiter.snapshot();
  const webSocketSnapshot = getWebSocketTelemetrySnapshot();
  return {
    pdfActiveJobs: pdfSnapshot.activeJobs,
    pdfMaxConcurrentJobs: pdfSnapshot.maxConcurrentJobs,
    pdfCompletedLastMinute: pdfSignals.completedLastMinute,
    pdfFailedLastMinute: pdfSignals.failedLastMinute,
    pdfRejectedLastMinute: pdfSignals.rejectedLastMinute,
    sessionCreatesLastMinute: abuseSignals.sessionCreatesLastMinute,
    rateLimit429LastMinute: abuseSignals.rateLimit429LastMinute,
    rateLimit429ByCategoryLastMinute: abuseSignals.rateLimit429ByCategoryLastMinute,
    trpcWebSocketConnectionsActive: webSocketSnapshot.trpcConnectionsActive,
  };
}

async function fetchServerStats(options?: { forceFresh?: boolean }): Promise<ServerStatsDTO> {
  const forceFresh = options?.forceFresh === true;
  const now = Date.now();

  if (!forceFresh && cachedServerStats && cachedServerStats.expiresAt > now) {
    return cachedServerStats.value;
  }

  if (!forceFresh && serverStatsInFlight) {
    return serverStatsInFlight;
  }

  const request = computeServerStats().then((stats) => {
    cachedServerStats = {
      value: stats,
      expiresAt: Date.now() + SERVER_STATS_CACHE_TTL_MS,
    };
    return stats;
  });

  serverStatsInFlight = request;
  try {
    return await request;
  } finally {
    if (serverStatsInFlight === request) {
      serverStatsInFlight = null;
    }
  }
}

async function fetchFooterStatus(): Promise<FooterStatusDTO> {
  const stats = await fetchServerStats();
  return {
    serviceStatus: stats.serviceStatus,
    loadStatus: stats.loadStatus,
  };
}

export function resetHealthStatsCacheForTests(): void {
  cachedServerStats = null;
  serverStatsInFlight = null;
}

export const healthRouter = router({
  check: publicProcedure.output(HealthCheckResponseSchema).query(() => fetchHealthCheck()),

  stats: publicProcedure.output(ServerStatsDTOSchema).query(() => fetchServerStats()),

  securityStats: adminProcedure
    .output(HealthSecurityStatsDTOSchema)
    .query(() => fetchSecurityStats()),

  /**
   * App-Footer: ein Client-Request statt check→stats nacheinander (kürzere kritische Netzwerk-Kette / LCP).
   * Server führt Check und Stats parallel aus.
   */
  footerBundle: publicProcedure.output(HealthFooterBundleSchema).query(async () => {
    const [check, stats] = await Promise.all([fetchHealthCheck(), fetchFooterStatus()]);
    return { check, stats };
  }),

  /** Subscription: Heartbeat alle 5s (Story 0.2 – Test für WebSocket). */
  ping: publicProcedure.subscription(() => heartbeatGenerator(5000)),
});
