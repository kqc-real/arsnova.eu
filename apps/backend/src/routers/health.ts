/**
 * Health & Server-Status (Story 0.1, 0.2, 0.4) / Betrieb & Nutzung (Issue #483).
 * check | stats | footerBundle (Check+Stats parallel, ein Client-Request) | ping: Subscription Heartbeat
 */
import { diagnosticProcedure, publicProcedure, resolveClientIp, router } from '../trpc';
import {
  HealthCheckResponseSchema,
  HealthFooterBundleSchema,
  HealthPingEventSchema,
  HealthSecurityStatsDTOSchema,
  PublicUsageStatsSchema,
  ServerStatsDTOSchema,
  UsagePeriodInputSchema,
  isQaChannelJoinable,
} from '@arsnova/shared-types';
import { pingRedis, getRedis } from '../redis';
import { prisma } from '../db';
import { logger } from '../lib/logger';
import { resolveAppVersion } from '../lib/appVersion';
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
import { DEFINED_CORE_PROCEDURES, readSloSignals, type SloSignals } from '../lib/sloTelemetry';
import { readAbuseSignals } from '../lib/abuseTelemetry';
import {
  SESSION_CODE_PROTECTION_LIMITS,
  readSessionCodeGlobalSoftCapUtilization,
} from '../lib/sessionCodeProtection';
import { getWebSocketTelemetrySnapshot } from '../lib/websocketTelemetry';
import { readCspReportSignals } from '../lib/cspReportIngest';
import { RATE_LIMIT_ENV, checkHealthUsageRate } from '../lib/rateLimit';
import { readQaTelemetry } from '../lib/qaTelemetry';
import { snapshotQaApiDiagnostics } from '../lib/qaApiDiagnostics';
import { getQaNlpMetrics } from '../lib/qaNlpQueue';
import { getQaSummaryQueueMetrics } from '../lib/qaSummaryQueue';
import { snapshotWordCloudNlpTelemetry } from '../lib/wordCloudNlpTelemetry';
import { buildUsageReport } from '../lib/usageStatistic';
import type {
  FooterStatusDTO,
  HealthSecurityStatsDTO,
  PublicDependenciesStatus,
  PublicLiveConnections,
  PublicTrafficQuality,
  PublicUsageStats,
  ServerStatsDTO,
} from '@arsnova/shared-types';
import { TRPCError } from '@trpc/server';

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
let cachedFooterStatus: { value: FooterStatusDTO; expiresAt: number } | null = null;
const usageReportCache = new Map<string, { value: PublicUsageStats; expiresAt: number }>();
const usageReportInFlight = new Map<string, Promise<PublicUsageStats>>();
const USAGE_REPORT_CACHE_TTL_MS = 30_000;
const USAGE_REPORT_CACHE_MAX_ENTRIES = 64;

function usageCacheKey(input: { kind: string; from?: string; to?: string }): string {
  return `${input.kind}:${input.from ?? ''}:${input.to ?? ''}`;
}

function pruneUsageReportCache(now: number): void {
  for (const [key, entry] of usageReportCache) {
    if (entry.expiresAt <= now) usageReportCache.delete(key);
  }
  while (usageReportCache.size > USAGE_REPORT_CACHE_MAX_ENTRIES) {
    const oldest = usageReportCache.keys().next().value;
    if (oldest === undefined) break;
    usageReportCache.delete(oldest);
  }
}

function emptyPublicUsageStats(
  kind: 'LAST_30_DAYS' | 'CURRENT_SEMESTER' | 'CUSTOM',
): PublicUsageStats {
  return PublicUsageStatsSchema.parse({
    timezone: 'UTC',
    periodKind: kind,
    periodFrom: new Date().toISOString().slice(0, 10),
    periodTo: new Date().toISOString().slice(0, 10),
    trackingStartedAt: null,
    lastAggregatedAt: null,
    historyComplete: false,
    sessionsUsed: null,
    sessionParticipations: null,
    quizAnswers: null,
    qaQuestionsAccepted: null,
    qaRatingActions: null,
    sessionsByFunction: null,
    dailySeries: [],
    monthlySeries: [],
    sizeDistribution: null,
    qaQuestionsTotalLifetime: 0,
    completedSessionsLifetime: 0,
  });
}

async function fetchUsageReport(input: {
  kind: 'LAST_30_DAYS' | 'CURRENT_SEMESTER' | 'CUSTOM';
  from?: string;
  to?: string;
}): Promise<PublicUsageStats> {
  const key = usageCacheKey(input);
  const now = Date.now();
  pruneUsageReportCache(now);
  const cached = usageReportCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;

  const existing = usageReportInFlight.get(key);
  if (existing) return existing;

  const loadPromise = (async (): Promise<PublicUsageStats> => {
    try {
      const report = await buildUsageReport(input);
      const value = PublicUsageStatsSchema.parse(report);
      usageReportCache.set(key, { value, expiresAt: Date.now() + USAGE_REPORT_CACHE_TTL_MS });
      pruneUsageReportCache(Date.now());
      return value;
    } catch (error) {
      if (input.kind === 'CUSTOM') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Ungültiger Nutzungszeitraum.',
          cause: error,
        });
      }
      logger.warn('health.usage: Bericht konnte nicht geladen werden', error);
      return emptyPublicUsageStats(input.kind);
    } finally {
      usageReportInFlight.delete(key);
    }
  })();

  usageReportInFlight.set(key, loadPromise);
  return loadPromise;
}

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
    // Nur positive Messwerte: fehlende Zeilen und 0 nicht als „Null-Rekord“ plotten.
    const measured = entry && entry.count > 0;
    return {
      date: dateKey,
      count: measured ? entry.count : null,
      updatedAt: measured ? entry.updatedAt : null,
    };
  });
}

/** Lineare Perzentil-Interpolation (Typ R-7), analog zu Nutzungs-Größenklassen. */
function percentileLinear(sortedAscending: number[], p: number): number {
  if (sortedAscending.length === 0) return 0;
  if (sortedAscending.length === 1) return sortedAscending[0]!;
  const pos = (sortedAscending.length - 1) * p;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sortedAscending[lower]!;
  const weight = pos - lower;
  return sortedAscending[lower]! * (1 - weight) + sortedAscending[upper]! * weight;
}

function calculateDailyHighscoresStatistics(entries: Array<{ count: number | null }>): {
  sampleSize: number;
  median: number | null;
  iqr: number | null;
  max: number | null;
} {
  const counts = entries
    .map((e) => e.count)
    .filter((count): count is number => count !== null && count > 0)
    .sort((a, b) => a - b);
  const sampleSize = counts.length;

  if (sampleSize === 0) {
    return { sampleSize: 0, median: null, iqr: null, max: null };
  }

  const median = Math.round(percentileLinear(counts, 0.5));
  const max = counts[sampleSize - 1]!;

  // IQR braucht mindestens zwei Beobachtungen; bei n=1 ist Streuung undefiniert.
  if (sampleSize < 2) {
    return { sampleSize, median, iqr: null, max };
  }

  const q1 = percentileLinear(counts, 0.25);
  const q3 = percentileLinear(counts, 0.75);
  const iqr = Math.round(q3 - q1);

  return { sampleSize, median, iqr, max };
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
): 'stable' | 'limited' | 'critical' | 'unknown' {
  if (!sloSignals.available) {
    return 'unknown';
  }

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

const CORE_ACTION_MIN_SAMPLES = 20;

function toCoreActionQuality(diag: {
  samples: number;
  technicalErrors: number;
  p95Ms: number | null;
  p99Ms: number | null;
}): {
  samples: number;
  errorRatePercent: number | null;
  p95Ms: number | null;
  p99Ms: number | null;
  coverage: 'AVAILABLE' | 'INSUFFICIENT_SAMPLE' | 'UNAVAILABLE';
} {
  if (diag.samples <= 0) {
    return {
      samples: 0,
      errorRatePercent: null,
      p95Ms: null,
      p99Ms: null,
      coverage: 'UNAVAILABLE',
    };
  }
  const errorRatePercent = (diag.technicalErrors / diag.samples) * 100;
  if (diag.samples < CORE_ACTION_MIN_SAMPLES) {
    return {
      samples: diag.samples,
      errorRatePercent,
      p95Ms: diag.p95Ms,
      p99Ms: diag.p99Ms,
      coverage: 'INSUFFICIENT_SAMPLE',
    };
  }
  return {
    samples: diag.samples,
    errorRatePercent,
    p95Ms: diag.p95Ms,
    p99Ms: diag.p99Ms,
    coverage: 'AVAILABLE',
  };
}

function buildCoreActionsQuality() {
  const snap = snapshotQaApiDiagnostics();
  return {
    join: toCoreActionQuality(snap.JOIN_REJOIN),
    vote: toCoreActionQuality(snap.VOTE),
    qaRead: toCoreActionQuality(snap.QA_PAGE),
    qaSubmit: toCoreActionQuality(snap.QA_SUBMIT),
    qaRate: toCoreActionQuality(snap.QA_RATING),
  };
}

function emptyCoreActionsQuality() {
  const empty = toCoreActionQuality({ samples: 0, technicalErrors: 0, p95Ms: null, p99Ms: null });
  return {
    join: empty,
    vote: empty,
    qaRead: empty,
    qaSubmit: empty,
    qaRate: empty,
  };
}

function buildTrafficQuality(
  sloSignals: SloSignals,
  measurementAvailable: boolean,
): PublicTrafficQuality {
  if (!measurementAvailable || !sloSignals.available) {
    return {
      measurementState: 'UNAVAILABLE',
      windowSeconds: 60,
      bucketSeconds: 10,
      observedWindowSeconds: null,
      windowComplete: null,
      avgRps: null,
      peakRps: null,
      sampleSize: null,
      errorRatePercent: null,
      errorClasses: null,
      p95LatencyMs: null,
      p99LatencyMs: null,
      latencyIncludesFailedRequests: true,
      insufficientLatencySample: true,
      monitoredProcedures: sloSignals.monitoredProcedures,
      definedProcedures: sloSignals.definedProcedures,
      groups: null,
      lastSuccessfulReadAt: null,
    };
  }

  const insufficient = sloSignals.insufficientLatencySample;
  return {
    measurementState: sloSignals.measurementState,
    windowSeconds: 60,
    bucketSeconds: 10,
    observedWindowSeconds: sloSignals.observedWindowSeconds,
    windowComplete: sloSignals.windowComplete,
    avgRps: sloSignals.avgRps,
    peakRps: sloSignals.peakRps,
    sampleSize: sloSignals.totalRequestsLastMinute,
    errorRatePercent: sloSignals.errorRatePercentLastMinute,
    errorClasses: sloSignals.errorClasses,
    p95LatencyMs: insufficient ? null : sloSignals.p95LatencyMsLastMinute,
    p99LatencyMs: insufficient ? null : sloSignals.p99LatencyMsLastMinute,
    latencyIncludesFailedRequests: true,
    insufficientLatencySample: insufficient,
    monitoredProcedures: sloSignals.monitoredProcedures,
    definedProcedures: sloSignals.definedProcedures,
    groups: sloSignals.groups.map((group) => ({
      id: group.id,
      requestsLastMinute: group.requestsLastMinute,
    })),
    lastSuccessfulReadAt: sloSignals.lastSuccessfulReadAt,
  };
}

function buildLiveConnections(measurementAvailable: boolean): PublicLiveConnections {
  if (!measurementAvailable) {
    return {
      measurementState: 'UNAVAILABLE',
      trpcOpen: null,
      yjsOpen: null,
      trpcOpenedLastMinute: null,
      trpcClosedLastMinute: null,
      yjsOpenedLastMinute: null,
      yjsClosedLastMinute: null,
      rejectsLastMinute: null,
      rateLimitedMessagesLastMinute: null,
      reconnectsLastMinute: null,
      messagesPerSecond: null,
      lastSuccessfulReadAt: null,
      deliveryNotMeasured: true,
    };
  }

  const snapshot = getWebSocketTelemetrySnapshot();
  const rejectsLastMinute =
    snapshot.trpcRejectedUpgradesLastMinute +
    snapshot.trpcPayloadRejectedLastMinute +
    snapshot.trpcSessionCapRejectedLastMinute +
    snapshot.trpcParticipantCapRejectedLastMinute +
    snapshot.yjsRejectedUpgradesLastMinute +
    snapshot.yjsPayloadRejectedLastMinute +
    snapshot.yjsProtocolErrorsLastMinute +
    snapshot.yjsDocumentRejectedLastMinute +
    snapshot.yjsAwarenessRejectedLastMinute +
    snapshot.yjsOutboundRejectedLastMinute;
  const rateLimitedMessagesLastMinute =
    snapshot.trpcRateLimitedMessagesLastMinute + snapshot.yjsRateLimitedMessagesLastMinute;

  return {
    measurementState: 'AVAILABLE',
    trpcOpen: snapshot.trpcConnectionsActive,
    yjsOpen: snapshot.yjsConnectionsActive,
    trpcOpenedLastMinute: snapshot.trpcOpenedLastMinute,
    trpcClosedLastMinute: snapshot.trpcClosedLastMinute,
    yjsOpenedLastMinute: snapshot.yjsOpenedLastMinute,
    yjsClosedLastMinute: snapshot.yjsClosedLastMinute,
    rejectsLastMinute,
    rateLimitedMessagesLastMinute,
    reconnectsLastMinute: null,
    messagesPerSecond: null,
    lastSuccessfulReadAt: new Date().toISOString(),
    deliveryNotMeasured: true,
  };
}

function unavailableTrafficQuality(): PublicTrafficQuality {
  return buildTrafficQuality(
    {
      totalRequestsLastMinute: 0,
      errorRatePercentLastMinute: 0,
      p95LatencyMsLastMinute: 0,
      p99LatencyMsLastMinute: 0,
      available: false,
      measurementState: 'UNAVAILABLE',
      windowSeconds: 60,
      bucketSeconds: 10,
      observedWindowSeconds: 0,
      windowComplete: false,
      avgRps: null,
      peakRps: null,
      errorClasses: { server: 0, rateLimit: 0, client: 0 },
      latencyIncludesFailedRequests: true,
      insufficientLatencySample: true,
      monitoredProcedures: DEFINED_CORE_PROCEDURES.length,
      definedProcedures: DEFINED_CORE_PROCEDURES.length,
      groups: [],
      lastSuccessfulReadAt: null,
    },
    false,
  );
}

/** Sessions, die aktuell noch nutzbar sind (Beitritt oder offenes Q&A inkl. nach FINISHED). */
function usableSessionWhere(now: Date) {
  return {
    hostEnded: false,
    expiresAt: { gt: now },
    OR: [
      { status: { not: 'FINISHED' as const } },
      {
        status: 'FINISHED' as const,
        qaOpen: true,
        OR: [{ type: 'Q_AND_A' as const }, { qaEnabled: true }],
        qaClosesAt: { gt: now },
      },
    ],
  };
}

/** Q&A-Kanäle, die aktuell für Teilnehmende nutzbar sind (inkl. nach Quiz-FINISHED). */
function usableQaSessionWhere(now: Date) {
  return {
    hostEnded: false,
    expiresAt: { gt: now },
    qaOpen: true,
    qaClosesAt: { gt: now },
    OR: [{ type: 'Q_AND_A' as const }, { qaEnabled: true }],
  };
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
    version: resolveAppVersion(),
    redis: redisOk ? ('ok' as const) : ('unavailable' as const),
  };
}

/** Server-Statistik für Betrieb & Nutzung (Issue #483). Bei Messausfall: unknown, nie stillschweigend grün. */
async function computeServerStats(): Promise<ServerStatsDTO> {
  const statsGeneratedAt = new Date();
  const usableWhere = usableSessionWhere(statsGeneratedAt);
  const usableQaWhere = usableQaSessionWhere(statsGeneratedAt);
  const dailyHighscoreRangeEnd = getUtcDayStart(new Date());

  let activeBlitzRounds = 0;
  let blitzRoundsAvailable = true;
  try {
    activeBlitzRounds = await countActiveBlitzRounds();
  } catch (err) {
    blitzRoundsAvailable = false;
    logger.warn(
      'health.stats: activeBlitzRounds konnte nicht aus Redis gelesen werden, setze 0 und markiere Messlücke.',
      err,
    );
  }

  const redisOk = await pingRedis().catch(() => false);

  try {
    const platformStatisticPromise = (async () => {
      try {
        const rows = await prisma.$queryRaw<
          Array<{
            maxParticipantsSingleSession: number | null;
            completedSessionsTotal: number | null;
            updatedAt: Date | null;
            qaQuestionsTotal: bigint | number | null;
            maxQaQuestionsSingleSession: number | null;
            maxQaQuestionsStatisticUpdatedAt: Date | null;
            qaStatisticsTrackingStartedAt: Date | null;
            qaStatisticsProjectedAt: Date | null;
          }>
        >`
          SELECT
            "maxParticipantsSingleSession",
            "completedSessionsTotal",
            "updatedAt",
            "qaQuestionsTotal",
            "maxQaQuestionsSingleSession",
            "maxQaQuestionsStatisticUpdatedAt",
            "qaStatisticsTrackingStartedAt",
            "qaStatisticsProjectedAt"
          FROM "PlatformStatistic"
          WHERE "id" = 'default'
          LIMIT 1
        `;
        const row = rows[0] ?? null;
        return {
          maxParticipantsSingleSession: row?.maxParticipantsSingleSession ?? 0,
          completedSessionsTotal: row?.completedSessionsTotal ?? null,
          updatedAtIso: row?.updatedAt?.toISOString() ?? null,
          qaQuestionsTotal: Number(row?.qaQuestionsTotal ?? 0),
          maxQaQuestionsSingleSession: row?.maxQaQuestionsSingleSession ?? 0,
          maxQaQuestionsStatisticUpdatedAt:
            row?.maxQaQuestionsStatisticUpdatedAt?.toISOString() ?? null,
          qaStatisticsTrackingStartedAt: row?.qaStatisticsTrackingStartedAt?.toISOString() ?? null,
          qaStatisticsProjectedAt: row?.qaStatisticsProjectedAt?.toISOString() ?? null,
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
            qaQuestionsTotal: 0,
            maxQaQuestionsSingleSession: 0,
            maxQaQuestionsStatisticUpdatedAt: null,
            qaStatisticsTrackingStartedAt: null,
            qaStatisticsProjectedAt: null,
          };
        } catch {
          // Test-/Mock-Fallback ohne Raw-SQL.
          const row = await prisma.platformStatistic.findUnique({
            where: { id: 'default' },
            select: {
              maxParticipantsSingleSession: true,
              completedSessionsTotal: true,
              updatedAt: true,
              qaQuestionsTotal: true,
              maxQaQuestionsSingleSession: true,
              maxQaQuestionsStatisticUpdatedAt: true,
              qaStatisticsTrackingStartedAt: true,
              qaStatisticsProjectedAt: true,
            },
          });
          return {
            maxParticipantsSingleSession: row?.maxParticipantsSingleSession ?? 0,
            completedSessionsTotal: row?.completedSessionsTotal ?? null,
            updatedAtIso: row?.updatedAt?.toISOString() ?? null,
            qaQuestionsTotal: Number(row?.qaQuestionsTotal ?? 0),
            maxQaQuestionsSingleSession: row?.maxQaQuestionsSingleSession ?? 0,
            maxQaQuestionsStatisticUpdatedAt:
              row?.maxQaQuestionsStatisticUpdatedAt?.toISOString() ?? null,
            qaStatisticsTrackingStartedAt:
              row?.qaStatisticsTrackingStartedAt?.toISOString() ?? null,
            qaStatisticsProjectedAt: row?.qaStatisticsProjectedAt?.toISOString() ?? null,
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
      usableSessionRows,
      completedSessionsNow,
      platformRow,
      dailyHighscoreRows,
      loadSignals,
      sloSignals,
      activeQaSessionRows,
      qaTelemetry,
      databaseProbe,
    ] = await Promise.all([
      prisma.session.count({ where: usableWhere }),
      prisma.session.findMany({
        where: usableWhere,
        select: {
          id: true,
          type: true,
          status: true,
          qaEnabled: true,
          qaOpen: true,
          qaClosesAt: true,
        },
      }),
      // Momentan in DB vorhandene FINISHED-Sessions (kann durch Purge sinken).
      prisma.session.count({ where: { status: 'FINISHED' } }),
      platformStatisticPromise,
      dailyHighscoreRowsPromise,
      readLoadSignals(),
      readSloSignals(),
      prisma.session.findMany({
        where: usableQaWhere,
        select: {
          id: true,
          type: true,
          qaEnabled: true,
          qaOpen: true,
          qaClosesAt: true,
        },
      }),
      readQaTelemetry(statsGeneratedAt.getTime()),
      prisma
        .$queryRawUnsafe('SELECT 1')
        .then(() => 'ok' as const)
        .catch(() => 'unavailable' as const),
    ]);

    const joinableQaRows = activeQaSessionRows.filter((session) =>
      isQaChannelJoinable(session, statsGeneratedAt),
    );
    const openSessionIds = usableSessionRows.map((session) => session.id);
    const quizLiveSessionIds = new Set(
      usableSessionRows.filter((session) => session.status !== 'FINISHED').map((s) => s.id),
    );
    const [participantCounts, totalParticipants] = await Promise.all([
      getActiveParticipantCountsForSessions(openSessionIds),
      countActiveParticipantsForSessions(openSessionIds),
    ]);
    // Aktive Sessions = laufende (nicht FINISHED) nutzbare Sessions mit Presence — nicht Q&A nach Quizende.
    const activeSessions = [...participantCounts.entries()].filter(
      ([sessionId, count]) =>
        quizLiveSessionIds.has(sessionId) && count >= ACTIVE_SESSION_MIN_PARTICIPANTS,
    ).length;
    const activeQaSessions =
      qaTelemetry.presenceStatus === 'AVAILABLE'
        ? joinableQaRows.filter(
            (session) =>
              (participantCounts.get(session.id) ?? 0) >= ACTIVE_SESSION_MIN_PARTICIPANTS,
          ).length
        : null;
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
    // Median, IQR und Max nur über positive Messwerte im 100-Tage-Fenster (Lücken/0 ausgeschlossen).
    const dailyHighscoresStatistics = calculateDailyHighscoresStatistics(dailyHighscores);
    const measurementAvailable = sloSignals.available && redisOk && databaseProbe === 'ok';
    const serviceStatus = measurementAvailable
      ? getServiceStatus(loadStatus, sloSignals)
      : ('unknown' as const);
    const dependencies: PublicDependenciesStatus = {
      api: 'ok',
      database: databaseProbe === 'ok' ? 'ok' : 'unavailable',
      redis: redisOk ? 'ok' : 'unavailable',
      live: redisOk && blitzRoundsAvailable ? 'ok' : redisOk ? 'degraded' : 'unavailable',
    };
    const coreActionsQuality = buildCoreActionsQuality();
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
      dailyHighscoresStatistics,
      maxParticipantsStatisticUpdatedAt: platformRow.updatedAtIso,
      serviceStatus,
      loadStatus,
      dependencies,
      coreActionsQuality,
      trafficQuality: buildTrafficQuality(sloSignals, measurementAvailable),
      liveConnections: buildLiveConnections(measurementAvailable),
      sloSampleSizeLastMinute: sloSignals.available ? sloSignals.totalRequestsLastMinute : null,
      measurementAvailable,
      activeQaSessions,
      qaQuestionsLastMinute: qaTelemetry.questionsLastMinute,
      qaRatingsLastMinute: qaTelemetry.ratingsLastMinute,
      qaQuestionsTotal: platformRow.qaQuestionsTotal,
      maxQaQuestionsSingleSession: platformRow.maxQaQuestionsSingleSession,
      qaStatisticsTrackingStartedAt: platformRow.qaStatisticsTrackingStartedAt,
      qaStatisticsProjectedAt: platformRow.qaStatisticsProjectedAt,
      maxQaQuestionsStatisticUpdatedAt: platformRow.maxQaQuestionsStatisticUpdatedAt,
      usage: await fetchUsageReport({ kind: 'LAST_30_DAYS' }),
      statsGeneratedAt: statsGeneratedAt.toISOString(),
      qaMinuteMetricsStatus: qaTelemetry.minuteStatus,
      qaPresenceMetricsStatus: qaTelemetry.presenceStatus,
    };
  } catch {
    const emptyHighscores = buildDailyHighscores([]);
    const unavailableDependencies: PublicDependenciesStatus = {
      api: 'unknown',
      database: 'unknown',
      redis: redisOk ? 'ok' : 'unavailable',
      live: 'unknown',
    };
    return {
      openSessions: 0,
      activeSessions: 0,
      totalParticipants: 0,
      votesLastMinute: 0,
      sessionTransitionsLastMinute: 0,
      activeCountdownSessions: 0,
      completedSessions: 0,
      activeBlitzRounds,
      maxParticipantsSingleSession: 0,
      dailyHighscores: emptyHighscores,
      dailyHighscoresStatistics: calculateDailyHighscoresStatistics(emptyHighscores),
      maxParticipantsStatisticUpdatedAt: null,
      serviceStatus: 'unknown' as const,
      loadStatus: 'busy' as const,
      dependencies: unavailableDependencies,
      coreActionsQuality: emptyCoreActionsQuality(),
      trafficQuality: unavailableTrafficQuality(),
      liveConnections: buildLiveConnections(false),
      sloSampleSizeLastMinute: null,
      measurementAvailable: false,
      activeQaSessions: null,
      qaQuestionsLastMinute: null,
      qaRatingsLastMinute: null,
      qaQuestionsTotal: 0,
      maxQaQuestionsSingleSession: 0,
      qaStatisticsTrackingStartedAt: null,
      qaStatisticsProjectedAt: null,
      maxQaQuestionsStatisticUpdatedAt: null,
      usage: {
        timezone: 'UTC',
        periodKind: 'LAST_30_DAYS',
        periodFrom: statsGeneratedAt.toISOString().slice(0, 10),
        periodTo: statsGeneratedAt.toISOString().slice(0, 10),
        trackingStartedAt: null,
        lastAggregatedAt: null,
        historyComplete: false,
        sessionsUsed: null,
        sessionParticipations: null,
        quizAnswers: null,
        qaQuestionsAccepted: null,
        qaRatingActions: null,
        sessionsByFunction: null,
        dailySeries: [],
        monthlySeries: [],
        sizeDistribution: null,
        qaQuestionsTotalLifetime: 0,
        completedSessionsLifetime: 0,
      },
      statsGeneratedAt: statsGeneratedAt.toISOString(),
      qaMinuteMetricsStatus: 'UNAVAILABLE' as const,
      qaPresenceMetricsStatus: 'UNAVAILABLE' as const,
    };
  }
}

export async function fetchSecurityStats(): Promise<HealthSecurityStatsDTO> {
  const [
    databaseStatus,
    pdfSignals,
    abuseSignals,
    cspReportSignals,
    sessionCodeGlobalSoftCapUtilizationPercent,
  ] = await Promise.all([
    prisma
      .$queryRawUnsafe('SELECT 1')
      .then(() => 'ok' as const)
      .catch(() => 'unavailable' as const),
    readPdfSignals(),
    readAbuseSignals(),
    readCspReportSignals(),
    readSessionCodeGlobalSoftCapUtilization(),
  ]);
  const pdfSnapshot = pdfConcurrencyLimiter.snapshot();
  const webSocketSnapshot = getWebSocketTelemetrySnapshot();
  const qaNlp = getQaNlpMetrics();
  const qaSummary = getQaSummaryQueueMetrics();
  const qaWordCloud = snapshotWordCloudNlpTelemetry();
  return {
    databaseStatus,
    sessionCreatePerHour: RATE_LIMIT_ENV.sessionCreatePerHour,
    sessionCreateGlobalPerHour: RATE_LIMIT_ENV.sessionCreateGlobalPerHour,
    sessionCodeClientFailuresPerWindow: SESSION_CODE_PROTECTION_LIMITS.clientFailuresPerWindow,
    pdfActiveJobs: pdfSnapshot.activeJobs,
    pdfMaxConcurrentJobs: pdfSnapshot.maxConcurrentJobs,
    pdfCompletedLastMinute: pdfSignals.completedLastMinute,
    pdfFailedLastMinute: pdfSignals.failedLastMinute,
    pdfRejectedLastMinute: pdfSignals.rejectedLastMinute,
    sessionCreatesLastMinute: abuseSignals.sessionCreatesLastMinute,
    adminLoginFailuresLastMinute: abuseSignals.adminLoginFailuresLastMinute,
    cspReportsReceivedLastMinute: cspReportSignals.receivedLastMinute,
    cspReportsDroppedLastMinute: cspReportSignals.droppedLastMinute,
    cspReportsRateLimitedLastMinute: cspReportSignals.rateLimitedLastMinute,
    cspReportsEvalLastMinute: cspReportSignals.evalLastMinute,
    cspReportsScriptHttpsLastMinute: cspReportSignals.scriptHttpsLastMinute,
    rateLimit429LastMinute: abuseSignals.rateLimit429LastMinute,
    rateLimit429ByCategoryLastMinute: abuseSignals.rateLimit429ByCategoryLastMinute,
    rateLimit429AlertLastMinute:
      abuseSignals.rateLimit429LastMinute -
      abuseSignals.rateLimit429ByCategoryLastMinute.sessionCodeReconnect,
    sessionCodeFailuresLastMinute: abuseSignals.sessionCodeFailuresLastMinute,
    sessionCodeFailuresBySourceLastMinute: abuseSignals.sessionCodeFailuresBySourceLastMinute,
    sessionCodeEntryFailuresLastMinute:
      abuseSignals.sessionCodeFailuresBySourceLastMinute.join +
      abuseSignals.sessionCodeFailuresBySourceLastMinute.lookup,
    sessionCodeSoftCapDelaysLastMinute: abuseSignals.sessionCodeSoftCapDelaysLastMinute,
    sessionCodeSoftCapDelaysBySourceLastMinute:
      abuseSignals.sessionCodeSoftCapDelaysBySourceLastMinute,
    sessionCodeEntrySoftCapDelaysLastMinute:
      abuseSignals.sessionCodeSoftCapDelaysBySourceLastMinute.join +
      abuseSignals.sessionCodeSoftCapDelaysBySourceLastMinute.lookup,
    sessionCodeGlobalSoftCapUtilizationPercent,
    trpcWebSocketConnectionsActive: webSocketSnapshot.trpcConnectionsActive,
    trpcWebSocketConnectionLimit: webSocketSnapshot.trpcConnectionLimit,
    trpcWebSocketBoundConnectionsActive: webSocketSnapshot.trpcBoundConnectionsActive,
    trpcWebSocketSessionConnectionLimit: webSocketSnapshot.trpcSessionConnectionLimit,
    trpcWebSocketParticipantConnectionLimit: webSocketSnapshot.trpcParticipantConnectionLimit,
    trpcWebSocketSessionCapRejectedLastMinute: webSocketSnapshot.trpcSessionCapRejectedLastMinute,
    trpcWebSocketParticipantCapRejectedLastMinute:
      webSocketSnapshot.trpcParticipantCapRejectedLastMinute,
    trpcWebSocketRejectedUpgradesLastMinute: webSocketSnapshot.trpcRejectedUpgradesLastMinute,
    trpcWebSocketPayloadRejectedLastMinute: webSocketSnapshot.trpcPayloadRejectedLastMinute,
    trpcWebSocketRateLimitedMessagesLastMinute: webSocketSnapshot.trpcRateLimitedMessagesLastMinute,
    yjsWebSocketConnectionsActive: webSocketSnapshot.yjsConnectionsActive,
    yjsWebSocketRoomsActive: webSocketSnapshot.yjsRoomsActive,
    yjsWebSocketConnectionLimit: webSocketSnapshot.yjsConnectionLimit,
    yjsWebSocketPerRoomConnectionLimit: webSocketSnapshot.yjsPerRoomConnectionLimit,
    yjsWebSocketRejectedUpgradesLastMinute: webSocketSnapshot.yjsRejectedUpgradesLastMinute,
    yjsWebSocketRejectedUpgradesByReasonLastMinute:
      webSocketSnapshot.yjsRejectedUpgradesByReasonLastMinute,
    yjsWebSocketPayloadRejectedLastMinute: webSocketSnapshot.yjsPayloadRejectedLastMinute,
    yjsWebSocketRateLimitedMessagesLastMinute: webSocketSnapshot.yjsRateLimitedMessagesLastMinute,
    yjsWebSocketProtocolErrorsLastMinute: webSocketSnapshot.yjsProtocolErrorsLastMinute,
    yjsWebSocketDocumentRejectedLastMinute: webSocketSnapshot.yjsDocumentRejectedLastMinute,
    yjsWebSocketAwarenessRejectedLastMinute: webSocketSnapshot.yjsAwarenessRejectedLastMinute,
    yjsWebSocketOutboundRejectedLastMinute: webSocketSnapshot.yjsOutboundRejectedLastMinute,
    qaApi: snapshotQaApiDiagnostics(),
    qaNlp: {
      queueLength: qaNlp.queueLength,
      running: qaNlp.running,
      completed: qaNlp.completed,
      failed: qaNlp.failed,
      fallback: qaNlp.fallback,
      lastLatencyMs: qaNlp.lastLatencyMs,
    },
    qaSummary,
    qaWordCloud,
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
  const now = Date.now();
  if (cachedFooterStatus && cachedFooterStatus.expiresAt > now) {
    return cachedFooterStatus.value;
  }
  try {
    const statsNow = new Date(now);
    const [sessions, loadSignals, sloSignals, activeBlitzRounds, redisOk, databaseProbe] =
      await Promise.all([
        prisma.session.findMany({
          where: usableSessionWhere(statsNow),
          select: { id: true, status: true },
        }),
        readLoadSignals(now),
        readSloSignals(now),
        countActiveBlitzRounds().catch(() => null),
        pingRedis().catch(() => false),
        prisma
          .$queryRawUnsafe('SELECT 1')
          .then(() => 'ok' as const)
          .catch(() => 'unavailable' as const),
      ]);
    const quizLiveSessionIds = new Set(
      sessions.filter((session) => session.status !== 'FINISHED').map((session) => session.id),
    );
    const participantCounts = await getActiveParticipantCountsForSessions(
      sessions.map((session) => session.id),
      now,
    );
    const totalParticipants = [...participantCounts.values()].reduce(
      (sum, count) => sum + Math.max(0, count),
      0,
    );
    const activeSessions = [...participantCounts.entries()].filter(
      ([sessionId, count]) =>
        quizLiveSessionIds.has(sessionId) && count >= ACTIVE_SESSION_MIN_PARTICIPANTS,
    ).length;
    const loadStatus = getLoadStatus({
      activeSessions,
      totalParticipants,
      activeBlitzRounds: activeBlitzRounds ?? 0,
      votesLastMinute: loadSignals.votesLastMinute,
      sessionTransitionsLastMinute: loadSignals.sessionTransitionsLastMinute,
      activeCountdownSessions: loadSignals.activeCountdownSessions,
    });
    const measurementAvailable = sloSignals.available && redisOk === true && databaseProbe === 'ok';
    const value = {
      serviceStatus: measurementAvailable
        ? getServiceStatus(loadStatus, sloSignals)
        : ('unknown' as const),
      loadStatus,
      measurementAvailable,
    };
    cachedFooterStatus = { value, expiresAt: now + SERVER_STATS_CACHE_TTL_MS };
    return value;
  } catch {
    return { serviceStatus: 'unknown', loadStatus: 'busy', measurementAvailable: false };
  }
}

export function resetHealthStatsCacheForTests(): void {
  cachedServerStats = null;
  serverStatsInFlight = null;
  cachedFooterStatus = null;
  usageReportCache.clear();
  usageReportInFlight.clear();
}

export const healthRouter = router({
  check: publicProcedure.output(HealthCheckResponseSchema).query(() => fetchHealthCheck()),

  stats: publicProcedure.output(ServerStatsDTOSchema).query(() => fetchServerStats()),

  /**
   * Getrennter Nutzungsbericht (Issue #483): eigener Cache, In-Flight-Coalesce und Rate-Limit;
   * blockiert die Betriebsmessung nicht.
   */
  usage: publicProcedure
    .input(UsagePeriodInputSchema.optional())
    .output(PublicUsageStatsSchema)
    .query(async ({ ctx, input }) => {
      const limit = await checkHealthUsageRate(resolveClientIp(ctx.req).ip);
      if (!limit.allowed) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Zu viele Anfragen an den Nutzungsbericht. Bitte später erneut versuchen.',
          cause: { retryAfterSeconds: limit.retryAfterSeconds },
        });
      }
      return fetchUsageReport({
        kind: input?.kind ?? 'LAST_30_DAYS',
        from: input?.from,
        to: input?.to,
      });
    }),

  securityStats: diagnosticProcedure
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
