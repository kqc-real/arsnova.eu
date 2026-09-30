/**
 * Befüllt die Dev-DB mit Testdaten für Betrieb & Nutzung (Issue #483).
 *
 * Deckt: DailyUsageStatistic, SessionUsageProjection, PlatformStatistic,
 * DailyStatistic (Join-Tagesrekorde mit Lücken), QaSessionStatisticProjection,
 * sowie einige nutzbare Live-/FINISHED+Q&A-Sessions für den Betriebsbereich.
 *
 * Aufruf:
 *   npm run seed:betrieb-nutzung -w @arsnova/backend
 *   npm run seed:betrieb-nutzung -w @arsnova/backend -- --replace
 *
 * Voraussetzung: DATABASE_URL, Migration Issue #483 angewandt.
 */
import { randomUUID } from 'node:crypto';
import { format } from 'node:util';
import { prisma } from '../src/db';
import { PLATFORM_STATISTIC_ID, formatUtcDate, getUtcDayStart } from '../src/lib/platformStatistic';
import { USAGE_SIZE_CLASSES } from '../src/lib/usageStatistic';

const SEED_TAG = 'bn483';
const LIVE_CODES = {
  quizLive: 'BN483Q',
  qaLive: 'BN483A',
  finishedQa: 'BN483F',
} as const;

function log(...values: unknown[]): void {
  process.stdout.write(`${format(...values)}\n`);
}

function parseArgs(argv: string[]): { replace: boolean } {
  return { replace: argv.includes('--replace') };
}

function addUtcDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + days);
  return getUtcDayStart(next);
}

function hashUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickSize(seed: string): number {
  const roll = hashUnit(seed) % 100;
  if (roll < 28) return 3 + (hashUnit(`${seed}:xs`) % 8); // XS 1–10
  if (roll < 55) return 12 + (hashUnit(`${seed}:s`) % 19); // S 11–30
  if (roll < 78) return 35 + (hashUnit(`${seed}:m`) % 66); // M 31–100
  if (roll < 93) return 110 + (hashUnit(`${seed}:l`) % 180); // L 101–300
  return 320 + (hashUnit(`${seed}:xl`) % 280); // XL 301+
}

function classForCount(count: number): string {
  for (const cls of USAGE_SIZE_CLASSES) {
    if (count >= cls.min && (cls.max === null || count <= cls.max)) return cls.id;
  }
  return 'XS';
}

type DailyRow = {
  date: Date;
  sessionsUsed: number;
  sessionParticipations: number;
  quizAnswers: number;
  qaQuestionsAccepted: number;
  qaRatingActions: number;
  sessionsQuizOnly: number;
  sessionsQaOnly: number;
  sessionsCombined: number;
};

type ProjectionRow = {
  sessionId: string;
  firstUsedAt: Date;
  firstUsedUtcDate: Date;
  firstParticipationAt: Date;
  participationCount: number;
  hasQuizInteraction: boolean;
  hasQaInteraction: boolean;
  functionClass: 'QUIZ_ONLY' | 'QA_ONLY' | 'COMBINED' | null;
};

function buildDailySeries(trackingStart: Date, today: Date): DailyRow[] {
  const rows: DailyRow[] = [];
  for (let cursor = new Date(trackingStart); cursor.getTime() <= today.getTime();) {
    const key = formatUtcDate(cursor);
    const h = hashUnit(key);
    const weekday = cursor.getUTCDay(); // 0 So … 6 Sa
    const weekendFactor = weekday === 0 || weekday === 6 ? 0.35 : 1;
    const wave = 0.75 + ((h % 50) / 100) * weekendFactor;

    const sessionsQuizOnly = Math.max(0, Math.round((2 + (h % 5)) * wave));
    const sessionsQaOnly = Math.max(0, Math.round((1 + (h % 3)) * wave));
    const sessionsCombined = Math.max(0, Math.round((1 + (h % 4)) * wave));
    const sessionsUsed = sessionsQuizOnly + sessionsQaOnly + sessionsCombined;

    // Manche Tage bewusst dünn (aber nicht erfunden als 0-Lücke): niedrige Werte ok.
    const sessionParticipations = sessionsUsed * (8 + (h % 22));
    const quizAnswers = Math.round(sessionParticipations * (0.55 + (h % 30) / 100));
    const qaQuestionsAccepted = Math.round(sessionsUsed * (1.2 + (h % 8) / 10));
    const qaRatingActions = Math.round(qaQuestionsAccepted * (0.4 + (h % 20) / 100));

    rows.push({
      date: getUtcDayStart(cursor),
      sessionsUsed,
      sessionParticipations,
      quizAnswers,
      qaQuestionsAccepted,
      qaRatingActions,
      sessionsQuizOnly,
      sessionsQaOnly,
      sessionsCombined,
    });
    cursor = addUtcDays(cursor, 1);
  }
  return rows;
}

function buildProjections(daily: DailyRow[]): ProjectionRow[] {
  const projections: ProjectionRow[] = [];
  for (const day of daily) {
    const dateKey = formatUtcDate(day.date);
    let idx = 0;
    const push = (
      functionClass: ProjectionRow['functionClass'],
      count: number,
      hasQuiz: boolean,
      hasQa: boolean,
    ) => {
      for (let i = 0; i < count; i++) {
        const seed = `${dateKey}:${functionClass ?? 'NONE'}:${i}`;
        const participationCount = pickSize(seed);
        const hour = 8 + (hashUnit(seed) % 12);
        const firstUsedAt = new Date(day.date);
        firstUsedAt.setUTCHours(hour, hashUnit(`${seed}:m`) % 60, 0, 0);
        projections.push({
          sessionId: `${SEED_TAG}-${dateKey.replace(/-/g, '')}-${String(idx++).padStart(3, '0')}-${hashUnit(seed).toString(16).slice(0, 8)}`,
          firstUsedAt,
          firstUsedUtcDate: day.date,
          firstParticipationAt: firstUsedAt,
          participationCount,
          hasQuizInteraction: hasQuiz,
          hasQaInteraction: hasQa,
          functionClass,
        });
      }
    };
    push('QUIZ_ONLY', day.sessionsQuizOnly, true, false);
    push('QA_ONLY', day.sessionsQaOnly, false, true);
    push('COMBINED', day.sessionsCombined, true, true);
  }
  return projections;
}

function buildJoinHighscores(today: Date): Array<{ date: Date; max: number }> {
  const rows: Array<{ date: Date; max: number }> = [];
  for (let offset = 99; offset >= 0; offset--) {
    const date = addUtcDays(today, -offset);
    const key = formatUtcDate(date);
    const h = hashUnit(`join:${key}`);
    // ~18 % Lückentage ohne Messung (nicht als 0 speichern).
    if (h % 100 < 18) continue;
    const max = 12 + (h % 390);
    rows.push({ date, max });
  }
  return rows;
}

async function clearPreviousSeed(): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM "SessionUsageProjection"
    WHERE "sessionId" LIKE ${`${SEED_TAG}-%`}
  `;
  // Tagesaggregate vollständig neu setzen (Dev-Seed).
  await prisma.dailyUsageStatistic.deleteMany({});
  await prisma.dailyStatistic.deleteMany({});
  await prisma.qaSessionStatisticProjection.deleteMany({
    where: { sessionId: { startsWith: `${SEED_TAG}-` } },
  });

  const codes = Object.values(LIVE_CODES);
  await prisma.session.deleteMany({ where: { code: { in: [...codes] } } });
}

async function upsertPlatform(trackingStartedAt: Date, projectedAt: Date): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO "PlatformStatistic" (
      "id",
      "maxParticipantsSingleSession",
      "completedSessionsTotal",
      "qaQuestionsTotal",
      "maxQaQuestionsSingleSession",
      "maxQaQuestionsStatisticUpdatedAt",
      "qaStatisticsTrackingStartedAt",
      "qaStatisticsProjectedAt",
      "usageStatisticsTrackingStartedAt",
      "usageStatisticsProjectedAt",
      "updatedAt"
    )
    VALUES (
      ${PLATFORM_STATISTIC_ID},
      412,
      1284,
      8750::bigint,
      186,
      ${projectedAt},
      ${trackingStartedAt},
      ${projectedAt},
      ${trackingStartedAt},
      ${projectedAt},
      ${projectedAt}
    )
    ON CONFLICT ("id") DO UPDATE SET
      "maxParticipantsSingleSession" = GREATEST(
        "PlatformStatistic"."maxParticipantsSingleSession",
        EXCLUDED."maxParticipantsSingleSession"
      ),
      "completedSessionsTotal" = GREATEST(
        "PlatformStatistic"."completedSessionsTotal",
        EXCLUDED."completedSessionsTotal"
      ),
      "qaQuestionsTotal" = GREATEST(
        "PlatformStatistic"."qaQuestionsTotal",
        EXCLUDED."qaQuestionsTotal"
      ),
      "maxQaQuestionsSingleSession" = GREATEST(
        "PlatformStatistic"."maxQaQuestionsSingleSession",
        EXCLUDED."maxQaQuestionsSingleSession"
      ),
      "maxQaQuestionsStatisticUpdatedAt" = EXCLUDED."maxQaQuestionsStatisticUpdatedAt",
      "qaStatisticsTrackingStartedAt" = COALESCE(
        "PlatformStatistic"."qaStatisticsTrackingStartedAt",
        EXCLUDED."qaStatisticsTrackingStartedAt"
      ),
      "qaStatisticsProjectedAt" = EXCLUDED."qaStatisticsProjectedAt",
      "usageStatisticsTrackingStartedAt" = COALESCE(
        "PlatformStatistic"."usageStatisticsTrackingStartedAt",
        EXCLUDED."usageStatisticsTrackingStartedAt"
      ),
      "usageStatisticsProjectedAt" = EXCLUDED."usageStatisticsProjectedAt",
      "updatedAt" = EXCLUDED."updatedAt"
  `;
}

async function seedLiveSessions(now: Date): Promise<void> {
  const expiresAt = addUtcDays(now, 7);
  expiresAt.setUTCHours(23, 59, 59, 0);
  const qaClosesAt = addUtcDays(now, 5);
  qaClosesAt.setUTCHours(18, 0, 0, 0);

  await prisma.session.create({
    data: {
      code: LIVE_CODES.quizLive,
      type: 'QUIZ',
      status: 'ACTIVE',
      title: 'BN483 Demo Quiz Live',
      qaEnabled: false,
      expiresAt,
      firstParticipantJoinedAt: now,
      nextParticipantNumber: 24,
      hostSupportId: 'BN483-QZ-LIVE',
    },
  });

  await prisma.session.create({
    data: {
      code: LIVE_CODES.qaLive,
      type: 'Q_AND_A',
      status: 'ACTIVE',
      title: 'BN483 Demo Q&A Live',
      qaEnabled: true,
      qaOpen: true,
      qaTitle: 'Offene Fragerunde',
      qaClosesAt,
      expiresAt,
      qaQuestionCount: 17,
      qaQuestionPeakCount: 17,
      qaQuestionsAcceptedTotal: 17n,
      firstParticipantJoinedAt: now,
      nextParticipantNumber: 41,
      hostSupportId: 'BN483-QA-LIVE',
    },
  });

  await prisma.session.create({
    data: {
      code: LIVE_CODES.finishedQa,
      type: 'QUIZ',
      status: 'FINISHED',
      title: 'BN483 Demo Finished + offenes Q&A',
      qaEnabled: true,
      qaOpen: true,
      qaTitle: 'Nachfragen nach dem Quiz',
      qaClosesAt,
      expiresAt,
      endedAt: now,
      quizStarted: true,
      qaQuestionCount: 9,
      qaQuestionPeakCount: 12,
      qaQuestionsAcceptedTotal: 12n,
      firstParticipantJoinedAt: addUtcDays(now, -1),
      nextParticipantNumber: 88,
      hostSupportId: 'BN483-FIN-QA',
    },
  });
}

async function main(): Promise<void> {
  const { replace } = parseArgs(process.argv.slice(2));
  const now = new Date();
  const today = getUtcDayStart(now);
  // Erfassung beginnt vor 30 Tagen, aber nach Semesterstart → Semester zeigt Lücken vor Tracking.
  const trackingStartedAt = addUtcDays(today, -44);
  trackingStartedAt.setUTCHours(6, 15, 0, 0);
  const projectedAt = now;

  const existingDaily = await prisma.dailyUsageStatistic.count();
  if (existingDaily > 0 && !replace) {
    log('');
    log(`DailyUsageStatistic enthält bereits ${existingDaily} Zeilen.`);
    log('Mit --replace überschreiben (Dev-Seed). Abbruch ohne Änderung.');
    log('');
    process.exit(0);
  }

  log('Seed Betrieb & Nutzung (Issue #483) …');
  if (replace || existingDaily > 0) {
    log('  Entferne vorherigen Seed / Tagesaggregate …');
    await clearPreviousSeed();
  }

  const daily = buildDailySeries(getUtcDayStart(trackingStartedAt), today);
  const projections = buildProjections(daily);
  const joinHighscores = buildJoinHighscores(today);

  log(`  PlatformStatistic upsert (Tracking ab ${formatUtcDate(trackingStartedAt)}) …`);
  await upsertPlatform(trackingStartedAt, projectedAt);

  log(`  DailyUsageStatistic: ${daily.length} UTC-Tage …`);
  for (const row of daily) {
    await prisma.dailyUsageStatistic.create({
      data: {
        id: randomUUID(),
        date: row.date,
        sessionsUsed: row.sessionsUsed,
        sessionParticipations: row.sessionParticipations,
        quizAnswers: row.quizAnswers,
        qaQuestionsAccepted: row.qaQuestionsAccepted,
        qaRatingActions: row.qaRatingActions,
        sessionsQuizOnly: row.sessionsQuizOnly,
        sessionsQaOnly: row.sessionsQaOnly,
        sessionsCombined: row.sessionsCombined,
        sessionsJoinOnly: 0,
        updatedAt: projectedAt,
      },
    });
  }

  log(`  SessionUsageProjection: ${projections.length} Sessions (XS–XL, Funktionen) …`);
  const classCounts = { XS: 0, S: 0, M: 0, L: 0, XL: 0 };
  for (const row of projections) {
    classCounts[classForCount(row.participationCount) as keyof typeof classCounts] += 1;
    await prisma.sessionUsageProjection.create({
      data: {
        sessionId: row.sessionId,
        firstUsedAt: row.firstUsedAt,
        firstUsedUtcDate: row.firstUsedUtcDate,
        firstParticipationAt: row.firstParticipationAt,
        participationCount: row.participationCount,
        hasQuizInteraction: row.hasQuizInteraction,
        hasQaInteraction: row.hasQaInteraction,
        functionClass: row.functionClass,
        projectedAt,
      },
    });
  }

  log(`  DailyStatistic (Join-Rekorde): ${joinHighscores.length} gemessene Tage, Rest Lücken …`);
  for (const row of joinHighscores) {
    await prisma.dailyStatistic.create({
      data: {
        id: randomUUID(),
        date: row.date,
        maxParticipantsSingleSession: row.max,
        updatedAt: projectedAt,
      },
    });
  }

  // Q&A-Projektion für Lifetime-Kennzahlen (purge-sicher, ohne FK).
  const qaProjectionSamples = projections.filter((p) => p.hasQaInteraction).slice(0, 40);
  log(`  QaSessionStatisticProjection: ${qaProjectionSamples.length} Marker …`);
  for (const row of qaProjectionSamples) {
    const accepted = BigInt(2 + (hashUnit(row.sessionId) % 40));
    const peak = Number(accepted) + (hashUnit(`${row.sessionId}:peak`) % 8);
    await prisma.qaSessionStatisticProjection.create({
      data: {
        sessionId: row.sessionId,
        questionsAcceptedTotal: accepted,
        questionPeakCount: peak,
        questionPeakReachedAt: row.firstUsedAt,
        projectedAt,
      },
    });
  }

  log('  Live-Sessions für Betriebsbereich (Quiz / Q&A / FINISHED+Q&A) …');
  await seedLiveSessions(now);

  const totals = daily.reduce(
    (acc, row) => {
      acc.sessionsUsed += row.sessionsUsed;
      acc.participations += row.sessionParticipations;
      acc.quizAnswers += row.quizAnswers;
      acc.qaAccepted += row.qaQuestionsAccepted;
      acc.qaRatings += row.qaRatingActions;
      return acc;
    },
    { sessionsUsed: 0, participations: 0, quizAnswers: 0, qaAccepted: 0, qaRatings: 0 },
  );

  log('');
  log('Fertig. Überblick:');
  log(`  Tracking seit:     ${trackingStartedAt.toISOString()}`);
  log(`  Tagesaggregate:    ${daily.length} (Summe Sessions ${totals.sessionsUsed})`);
  log(`  Teilnahmen:        ${totals.participations}`);
  log(`  Quizantworten:     ${totals.quizAnswers}`);
  log(`  Q&A-Fragen:        ${totals.qaAccepted}`);
  log(`  Q&A-Bewertungen:   ${totals.qaRatings}`);
  log(
    `  Größenklassen:     XS=${classCounts.XS} S=${classCounts.S} M=${classCounts.M} L=${classCounts.L} XL=${classCounts.XL}`,
  );
  log(`  Join-Tagesrekorde: ${joinHighscores.length} / 100 (Rest null/Lücke)`);
  log(
    `  Live-Codes:        ${LIVE_CODES.quizLive}, ${LIVE_CODES.qaLive}, ${LIVE_CODES.finishedQa}`,
  );
  log('');
  log('Im UI: Footer → Mehr → Betrieb & Nutzung (Tabs Betrieb / Nutzung, Zeitraumwahl).');
  log('');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
