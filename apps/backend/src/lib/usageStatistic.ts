/**
 * Purge-sichere Nutzungsaggregate (Issue #483).
 * Schreibpfade sind atomar/idempotent (FOR UPDATE) und scheitern den Live-Pfad nicht.
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '../db';
import { logger } from './logger';

/** Gleicher Plattform-Singleton wie `platformStatistic` (ohne Mock-Kopplung in Router-Tests). */
const PLATFORM_STATISTIC_ID = 'default';

function getUtcDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatUtcDate(date: Date): string {
  return getUtcDayStart(date).toISOString().slice(0, 10);
}

export type UsagePeriodKind = 'LAST_30_DAYS' | 'CURRENT_SEMESTER' | 'CUSTOM';
export type UsageSizeClassId = 'XS' | 'S' | 'M' | 'L' | 'XL';
export type UsageFunctionClass = 'JOIN_ONLY' | 'QUIZ_ONLY' | 'QA_ONLY' | 'COMBINED';

export const USAGE_SIZE_CLASSES: ReadonlyArray<{
  id: UsageSizeClassId;
  min: number;
  max: number | null;
  /** Locale-neutrale Ranges (Ziffern + en-dash). */
  label: string;
}> = [
  { id: 'XS', min: 1, max: 10, label: '1–10' },
  { id: 'S', min: 11, max: 30, label: '11–30' },
  { id: 'M', min: 31, max: 100, label: '31–100' },
  { id: 'L', min: 101, max: 300, label: '101–300' },
  { id: 'XL', min: 301, max: null, label: '301+' },
];

/** Cap für Größenverteilung; bei Überschreitung Zufallsstichprobe (nicht die kleinsten N). */
const SIZE_SAMPLE_CAP = 5_000;
export const USAGE_CUSTOM_PERIOD_MAX_DAYS = 366;

/** PlatformStatistic.projectedAt höchstens einmal pro Intervall anfassen (kein Hot-Row pro Event). */
const PROJECTED_AT_TOUCH_MS = 60_000;
let lastProjectedAtTouchMs = 0;
let trackingStartEnsured = false;

type DailyBump = {
  sessionsUsed?: number;
  sessionParticipations?: number;
  quizAnswers?: number;
  qaQuestionsAccepted?: number;
  qaRatingActions?: number;
  sessionsJoinOnly?: number;
  sessionsQuizOnly?: number;
  sessionsQaOnly?: number;
  sessionsCombined?: number;
};

type ProjectionRow = {
  functionClass: string | null;
  firstUsedUtcDate: Date | null;
  hasQuizInteraction: boolean;
  hasQaInteraction: boolean;
  participationCount: number;
};

function utcDayParam(date: Date): Date {
  return getUtcDayStart(date);
}

/**
 * Tracking-Start einmalig setzen; projectedAt gedrosselt (nicht bei jedem Join/Vote/Q&A).
 */
async function touchUsageTracking(now: Date): Promise<void> {
  const nowMs = now.getTime();
  const touchProjected = nowMs - lastProjectedAtTouchMs >= PROJECTED_AT_TOUCH_MS;
  if (!touchProjected && trackingStartEnsured) return;

  try {
    if (touchProjected) {
      await prisma.$executeRaw`
        INSERT INTO "PlatformStatistic" (
          "id",
          "usageStatisticsTrackingStartedAt",
          "usageStatisticsProjectedAt",
          "updatedAt"
        )
        VALUES (${PLATFORM_STATISTIC_ID}, ${now}, ${now}, ${now})
        ON CONFLICT ("id") DO UPDATE
        SET
          "usageStatisticsTrackingStartedAt" = COALESCE(
            "PlatformStatistic"."usageStatisticsTrackingStartedAt",
            EXCLUDED."usageStatisticsTrackingStartedAt"
          ),
          "usageStatisticsProjectedAt" = EXCLUDED."usageStatisticsProjectedAt"
      `;
      lastProjectedAtTouchMs = nowMs;
    } else {
      await prisma.$executeRaw`
        INSERT INTO "PlatformStatistic" (
          "id",
          "usageStatisticsTrackingStartedAt",
          "usageStatisticsProjectedAt",
          "updatedAt"
        )
        VALUES (${PLATFORM_STATISTIC_ID}, ${now}, ${now}, ${now})
        ON CONFLICT ("id") DO UPDATE
        SET
          "usageStatisticsTrackingStartedAt" = COALESCE(
            "PlatformStatistic"."usageStatisticsTrackingStartedAt",
            EXCLUDED."usageStatisticsTrackingStartedAt"
          )
      `;
    }
    trackingStartEnsured = true;
  } catch (error) {
    logger.warn('usageStatistic.touchUsageTracking: Update übersprungen', error);
  }
}

/** Test-Hook: Drossel-Zustand zurücksetzen. */
export function resetUsageTrackingThrottleForTests(): void {
  lastProjectedAtTouchMs = 0;
  trackingStartEnsured = false;
}

async function bumpDailyUsage(day: Date, bump: DailyBump): Promise<void> {
  const sessionsUsed = bump.sessionsUsed ?? 0;
  const sessionParticipations = bump.sessionParticipations ?? 0;
  const quizAnswers = bump.quizAnswers ?? 0;
  const qaQuestionsAccepted = bump.qaQuestionsAccepted ?? 0;
  const qaRatingActions = bump.qaRatingActions ?? 0;
  const sessionsJoinOnly = bump.sessionsJoinOnly ?? 0;
  const sessionsQuizOnly = bump.sessionsQuizOnly ?? 0;
  const sessionsQaOnly = bump.sessionsQaOnly ?? 0;
  const sessionsCombined = bump.sessionsCombined ?? 0;
  if (
    sessionsUsed === 0 &&
    sessionParticipations === 0 &&
    quizAnswers === 0 &&
    qaQuestionsAccepted === 0 &&
    qaRatingActions === 0 &&
    sessionsJoinOnly === 0 &&
    sessionsQuizOnly === 0 &&
    sessionsQaOnly === 0 &&
    sessionsCombined === 0
  ) {
    return;
  }

  await prisma.$executeRaw`
    INSERT INTO "DailyUsageStatistic" (
      "id", "date", "sessionsUsed", "sessionParticipations", "quizAnswers",
      "qaQuestionsAccepted", "qaRatingActions", "sessionsJoinOnly", "sessionsQuizOnly",
      "sessionsQaOnly", "sessionsCombined", "updatedAt"
    )
    VALUES (
      ${randomUUID()}, ${day}, ${sessionsUsed}, ${sessionParticipations}, ${quizAnswers},
      ${qaQuestionsAccepted}, ${qaRatingActions}, ${sessionsJoinOnly}, ${sessionsQuizOnly},
      ${sessionsQaOnly}, ${sessionsCombined}, NOW()
    )
    ON CONFLICT ("date") DO UPDATE
    SET
      "sessionsUsed" = "DailyUsageStatistic"."sessionsUsed" + EXCLUDED."sessionsUsed",
      "sessionParticipations" =
        "DailyUsageStatistic"."sessionParticipations" + EXCLUDED."sessionParticipations",
      "quizAnswers" = "DailyUsageStatistic"."quizAnswers" + EXCLUDED."quizAnswers",
      "qaQuestionsAccepted" =
        "DailyUsageStatistic"."qaQuestionsAccepted" + EXCLUDED."qaQuestionsAccepted",
      "qaRatingActions" = "DailyUsageStatistic"."qaRatingActions" + EXCLUDED."qaRatingActions",
      "sessionsJoinOnly" =
        GREATEST(0, "DailyUsageStatistic"."sessionsJoinOnly" + EXCLUDED."sessionsJoinOnly"),
      "sessionsQuizOnly" =
        GREATEST(0, "DailyUsageStatistic"."sessionsQuizOnly" + EXCLUDED."sessionsQuizOnly"),
      "sessionsQaOnly" =
        GREATEST(0, "DailyUsageStatistic"."sessionsQaOnly" + EXCLUDED."sessionsQaOnly"),
      "sessionsCombined" =
        GREATEST(0, "DailyUsageStatistic"."sessionsCombined" + EXCLUDED."sessionsCombined"),
      "updatedAt" = NOW()
  `;
}

export function classBump(
  prev: string | null | undefined,
  next: string | null | undefined,
): DailyBump {
  if (!next || prev === next) return {};
  const dec = (cls: string | null | undefined): DailyBump => {
    if (cls === 'JOIN_ONLY') return { sessionsJoinOnly: -1 };
    if (cls === 'QUIZ_ONLY') return { sessionsQuizOnly: -1 };
    if (cls === 'QA_ONLY') return { sessionsQaOnly: -1 };
    if (cls === 'COMBINED') return { sessionsCombined: -1 };
    return {};
  };
  const inc = (cls: string): DailyBump => {
    if (cls === 'JOIN_ONLY') return { sessionsJoinOnly: 1 };
    if (cls === 'QUIZ_ONLY') return { sessionsQuizOnly: 1 };
    if (cls === 'QA_ONLY') return { sessionsQaOnly: 1 };
    if (cls === 'COMBINED') return { sessionsCombined: 1 };
    return {};
  };
  return { ...dec(prev), ...inc(next) };
}

type MutationMode = 'participation' | 'quiz' | 'qaQuestion' | 'qaRating';

type MutationResult = {
  inserted: boolean;
  prevClass: string | null;
  nextClass: string | null;
  firstUsedUtcDate: Date | null;
};

function nextFunctionClass(
  mode: MutationMode,
  prev: ProjectionRow | null,
): UsageFunctionClass | null {
  if (mode === 'participation') {
    if (!prev) return 'JOIN_ONLY';
    return (prev.functionClass as UsageFunctionClass | null) ?? 'JOIN_ONLY';
  }
  const hasQuiz = mode === 'quiz' || prev?.hasQuizInteraction === true;
  const hasQa = mode === 'qaQuestion' || mode === 'qaRating' || prev?.hasQaInteraction === true;
  if (hasQuiz && hasQa) return 'COMBINED';
  if (hasQuiz) return 'QUIZ_ONLY';
  if (hasQa) return 'QA_ONLY';
  return prev?.functionClass as UsageFunctionClass | null;
}

/**
 * Atomare Projektionsmutation: FOR UPDATE serialisiert parallele Events derselben Session.
 */
async function mutateProjection(
  sessionId: string,
  now: Date,
  mode: MutationMode,
): Promise<MutationResult> {
  const day = utcDayParam(now);
  return prisma.$transaction(async (tx) => {
    const prevRows = await tx.$queryRaw<ProjectionRow[]>`
      SELECT
        "functionClass",
        "firstUsedUtcDate",
        "hasQuizInteraction",
        "hasQaInteraction",
        "participationCount"
      FROM "SessionUsageProjection"
      WHERE "sessionId" = ${sessionId}
      FOR UPDATE
    `;
    const prev = prevRows[0] ?? null;
    const nextClass = nextFunctionClass(mode, prev);

    if (mode === 'participation') {
      await tx.$executeRaw`
        INSERT INTO "SessionUsageProjection" (
          "sessionId", "firstUsedAt", "firstUsedUtcDate", "firstParticipationAt",
          "participationCount", "functionClass", "projectedAt"
        )
        VALUES (${sessionId}, ${now}, ${day}, ${now}, 1, ${nextClass}, ${now})
        ON CONFLICT ("sessionId") DO UPDATE
        SET
          "participationCount" = "SessionUsageProjection"."participationCount" + 1,
          "firstUsedAt" = COALESCE("SessionUsageProjection"."firstUsedAt", EXCLUDED."firstUsedAt"),
          "firstUsedUtcDate" = COALESCE(
            "SessionUsageProjection"."firstUsedUtcDate",
            EXCLUDED."firstUsedUtcDate"
          ),
          "firstParticipationAt" = COALESCE(
            "SessionUsageProjection"."firstParticipationAt",
            EXCLUDED."firstParticipationAt"
          ),
          "functionClass" = COALESCE(
            "SessionUsageProjection"."functionClass",
            EXCLUDED."functionClass"
          ),
          "projectedAt" = EXCLUDED."projectedAt"
      `;
    } else if (mode === 'quiz') {
      await tx.$executeRaw`
        INSERT INTO "SessionUsageProjection" (
          "sessionId", "firstUsedAt", "firstUsedUtcDate",
          "hasQuizInteraction", "functionClass", "projectedAt"
        )
        VALUES (${sessionId}, ${now}, ${day}, TRUE, ${nextClass}, ${now})
        ON CONFLICT ("sessionId") DO UPDATE
        SET
          "hasQuizInteraction" = TRUE,
          "functionClass" = CASE
            WHEN "SessionUsageProjection"."hasQaInteraction"
              OR "SessionUsageProjection"."functionClass" = 'QA_ONLY'
              THEN 'COMBINED'
            ELSE 'QUIZ_ONLY'
          END,
          "firstUsedAt" = COALESCE("SessionUsageProjection"."firstUsedAt", EXCLUDED."firstUsedAt"),
          "firstUsedUtcDate" = COALESCE(
            "SessionUsageProjection"."firstUsedUtcDate",
            EXCLUDED."firstUsedUtcDate"
          ),
          "projectedAt" = EXCLUDED."projectedAt"
      `;
    } else {
      await tx.$executeRaw`
        INSERT INTO "SessionUsageProjection" (
          "sessionId", "firstUsedAt", "firstUsedUtcDate",
          "hasQaInteraction", "functionClass", "projectedAt"
        )
        VALUES (${sessionId}, ${now}, ${day}, TRUE, ${nextClass}, ${now})
        ON CONFLICT ("sessionId") DO UPDATE
        SET
          "hasQaInteraction" = TRUE,
          "functionClass" = CASE
            WHEN "SessionUsageProjection"."hasQuizInteraction"
              OR "SessionUsageProjection"."functionClass" = 'QUIZ_ONLY'
              THEN 'COMBINED'
            ELSE 'QA_ONLY'
          END,
          "firstUsedAt" = COALESCE("SessionUsageProjection"."firstUsedAt", EXCLUDED."firstUsedAt"),
          "firstUsedUtcDate" = COALESCE(
            "SessionUsageProjection"."firstUsedUtcDate",
            EXCLUDED."firstUsedUtcDate"
          ),
          "projectedAt" = EXCLUDED."projectedAt"
      `;
    }

    const nextRows = await tx.$queryRaw<ProjectionRow[]>`
      SELECT
        "functionClass",
        "firstUsedUtcDate",
        "hasQuizInteraction",
        "hasQaInteraction",
        "participationCount"
      FROM "SessionUsageProjection"
      WHERE "sessionId" = ${sessionId}
    `;
    const next = nextRows[0]!;
    return {
      inserted: prev === null,
      prevClass: prev?.functionClass ?? null,
      nextClass: next.functionClass,
      firstUsedUtcDate: next.firstUsedUtcDate,
    };
  });
}

/** Erstmalige Session-Teilnahme (kein Rejoin). */
export async function recordUsageSessionParticipation(
  sessionId: string,
  now: Date = new Date(),
): Promise<void> {
  if (!sessionId) return;
  const eventDay = utcDayParam(now);
  try {
    const result = await mutateProjection(sessionId, now, 'participation');
    const bump: DailyBump = { sessionParticipations: 1 };
    if (result.inserted) bump.sessionsUsed = 1;
    await bumpDailyUsage(eventDay, bump);
    const cohortDay = result.firstUsedUtcDate ? utcDayParam(result.firstUsedUtcDate) : eventDay;
    await bumpDailyUsage(cohortDay, classBump(result.prevClass, result.nextClass));
    await touchUsageTracking(now);
  } catch (error) {
    logger.warn('usageStatistic.recordParticipation: Update übersprungen', error);
  }
}

/** Effektive Quizabstimmung (Runde 1; Runde 2 ersetzt, zählt nicht erneut). */
export async function recordUsageQuizAnswer(
  sessionId: string,
  now: Date = new Date(),
): Promise<void> {
  if (!sessionId) return;
  const eventDay = utcDayParam(now);
  try {
    const result = await mutateProjection(sessionId, now, 'quiz');
    const eventBump: DailyBump = { quizAnswers: 1 };
    if (result.inserted) eventBump.sessionsUsed = 1;
    await bumpDailyUsage(eventDay, eventBump);
    const cohortDay = result.firstUsedUtcDate ? utcDayParam(result.firstUsedUtcDate) : eventDay;
    await bumpDailyUsage(cohortDay, classBump(result.prevClass, result.nextClass));
    await touchUsageTracking(now);
  } catch (error) {
    logger.warn('usageStatistic.recordQuizAnswer: Update übersprungen', error);
  }
}

/** Angenommene Q&A-Frage (Ereignistag) + Funktionsklasse. */
export async function recordUsageQaQuestionAccepted(
  sessionId: string,
  now: Date = new Date(),
): Promise<void> {
  if (!sessionId) return;
  const eventDay = utcDayParam(now);
  try {
    const result = await mutateProjection(sessionId, now, 'qaQuestion');
    const eventBump: DailyBump = { qaQuestionsAccepted: 1 };
    if (result.inserted) eventBump.sessionsUsed = 1;
    await bumpDailyUsage(eventDay, eventBump);
    const cohortDay = result.firstUsedUtcDate ? utcDayParam(result.firstUsedUtcDate) : eventDay;
    await bumpDailyUsage(cohortDay, classBump(result.prevClass, result.nextClass));
    await touchUsageTracking(now);
  } catch (error) {
    logger.warn('usageStatistic.recordQaQuestionAccepted: Update übersprungen', error);
  }
}

/** Q&A-Bewertungsaktion; markiert Q&A-Nutzung ohne Fragenzähler. */
export async function recordUsageQaRatingAction(
  sessionId: string,
  now: Date = new Date(),
): Promise<void> {
  if (!sessionId) return;
  const eventDay = utcDayParam(now);
  try {
    const result = await mutateProjection(sessionId, now, 'qaRating');
    const eventBump: DailyBump = { qaRatingActions: 1 };
    if (result.inserted) eventBump.sessionsUsed = 1;
    await bumpDailyUsage(eventDay, eventBump);
    const cohortDay = result.firstUsedUtcDate ? utcDayParam(result.firstUsedUtcDate) : eventDay;
    await bumpDailyUsage(cohortDay, classBump(result.prevClass, result.nextClass));
    await touchUsageTracking(now);
  } catch (error) {
    logger.warn('usageStatistic.recordQaRatingAction: Update übersprungen', error);
  }
}

export function resolveUsagePeriod(
  kind: UsagePeriodKind,
  now: Date = new Date(),
  custom?: { from: string; to: string },
): { from: Date; to: Date; kind: UsagePeriodKind } {
  const today = getUtcDayStart(now);
  if (kind === 'LAST_30_DAYS') {
    const from = new Date(today);
    from.setUTCDate(from.getUTCDate() - 29);
    return { kind, from, to: today };
  }
  if (kind === 'CURRENT_SEMESTER') {
    const y = today.getUTCFullYear();
    const m = today.getUTCMonth();
    if (m >= 9) return { kind, from: new Date(Date.UTC(y, 9, 1)), to: today };
    if (m <= 2) return { kind, from: new Date(Date.UTC(y - 1, 9, 1)), to: today };
    return { kind, from: new Date(Date.UTC(y, 3, 1)), to: today };
  }
  if (!custom?.from || !custom?.to) throw new Error('CUSTOM period requires from/to');
  const from = getUtcDayStart(new Date(`${custom.from}T00:00:00.000Z`));
  const to = getUtcDayStart(new Date(`${custom.to}T00:00:00.000Z`));
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    throw new Error('Invalid custom period');
  }
  const daySpan = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
  if (daySpan > USAGE_CUSTOM_PERIOD_MAX_DAYS) {
    throw new Error(`Custom period exceeds ${USAGE_CUSTOM_PERIOD_MAX_DAYS} days`);
  }
  return { kind, from, to };
}

export function sizeClassForCount(count: number): UsageSizeClassId {
  for (const cls of USAGE_SIZE_CLASSES) {
    if (count >= cls.min && (cls.max === null || count <= cls.max)) return cls.id;
  }
  return 'XS';
}

function percentileNearest(sorted: number[], p: number): number {
  // Lineare Interpolation (R-7); Name historisch, Rundung auf ganze Teilnehmerzahlen.
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const pos = (sorted.length - 1) * p;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sorted[lower]!;
  const weight = pos - lower;
  return Math.round(sorted[lower]! * (1 - weight) + sorted[upper]! * weight);
}

export type UsageReport = {
  timezone: 'UTC';
  periodKind: UsagePeriodKind;
  periodFrom: string;
  periodTo: string;
  trackingStartedAt: string | null;
  lastAggregatedAt: string | null;
  historyComplete: boolean;
  sessionsUsed: number | null;
  sessionParticipations: number | null;
  quizAnswers: number | null;
  qaQuestionsAccepted: number | null;
  qaRatingActions: number | null;
  sessionsByFunction: {
    joinOnly: number;
    quizOnly: number;
    qaOnly: number;
    combined: number;
  } | null;
  dailySeries: Array<{
    date: string;
    sessionsUsed: number | null;
    sessionParticipations: number | null;
    quizAnswers: number | null;
    qaQuestionsAccepted: number | null;
  }>;
  monthlySeries: Array<{
    yearMonth: string;
    sessionsUsed: number | null;
    sessionParticipations: number | null;
    quizAnswers: number | null;
    qaQuestionsAccepted: number | null;
  }>;
  sizeDistribution: {
    sampleSize: number;
    median: number | null;
    quartile1: number | null;
    quartile3: number | null;
    classes: Array<{ id: UsageSizeClassId; label: string; count: number }>;
  } | null;
  qaQuestionsTotalLifetime: number;
  completedSessionsLifetime: number;
};

function buildMonthlySeries(dailySeries: UsageReport['dailySeries']): UsageReport['monthlySeries'] {
  const months = new Map<
    string,
    {
      sessionsUsed: number | null;
      sessionParticipations: number | null;
      quizAnswers: number | null;
      qaQuestionsAccepted: number | null;
      seen: boolean;
    }
  >();
  for (const day of dailySeries) {
    const yearMonth = day.date.slice(0, 7);
    const acc = months.get(yearMonth) ?? {
      sessionsUsed: null,
      sessionParticipations: null,
      quizAnswers: null,
      qaQuestionsAccepted: null,
      seen: false,
    };
    const add = (
      key: 'sessionsUsed' | 'sessionParticipations' | 'quizAnswers' | 'qaQuestionsAccepted',
      value: number | null,
    ) => {
      if (value === null) return;
      acc[key] = (acc[key] ?? 0) + value;
    };
    add('sessionsUsed', day.sessionsUsed);
    add('sessionParticipations', day.sessionParticipations);
    add('quizAnswers', day.quizAnswers);
    add('qaQuestionsAccepted', day.qaQuestionsAccepted);
    acc.seen = true;
    months.set(yearMonth, acc);
  }
  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([yearMonth, acc]) => ({
      yearMonth,
      sessionsUsed: acc.seen ? acc.sessionsUsed : null,
      sessionParticipations: acc.seen ? acc.sessionParticipations : null,
      quizAnswers: acc.seen ? acc.quizAnswers : null,
      qaQuestionsAccepted: acc.seen ? acc.qaQuestionsAccepted : null,
    }));
}

export async function buildUsageReport(input: {
  kind: UsagePeriodKind;
  from?: string;
  to?: string;
  now?: Date;
}): Promise<UsageReport> {
  const now = input.now ?? new Date();
  const period = resolveUsagePeriod(
    input.kind,
    now,
    input.kind === 'CUSTOM' ? { from: input.from!, to: input.to! } : undefined,
  );

  const [platformRows, dailyRows, sizeRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        usageStatisticsTrackingStartedAt: Date | null;
        usageStatisticsProjectedAt: Date | null;
        qaStatisticsTrackingStartedAt: Date | null;
        qaQuestionsTotal: bigint | number | null;
        completedSessionsTotal: number | null;
      }>
    >`
      SELECT
        "usageStatisticsTrackingStartedAt",
        "usageStatisticsProjectedAt",
        "qaStatisticsTrackingStartedAt",
        "qaQuestionsTotal",
        "completedSessionsTotal"
      FROM "PlatformStatistic"
      WHERE "id" = ${PLATFORM_STATISTIC_ID}
      LIMIT 1
    `.catch(() => []),
    prisma.dailyUsageStatistic
      .findMany({
        where: { date: { gte: period.from, lte: period.to } },
        orderBy: { date: 'asc' },
        select: {
          date: true,
          sessionsUsed: true,
          sessionParticipations: true,
          quizAnswers: true,
          qaQuestionsAccepted: true,
          qaRatingActions: true,
          sessionsJoinOnly: true,
          sessionsQuizOnly: true,
          sessionsQaOnly: true,
          sessionsCombined: true,
        },
      })
      .catch(() => []),
    prisma.$queryRaw<Array<{ participationCount: number }>>`
      SELECT "participationCount"
      FROM "SessionUsageProjection"
      WHERE "firstUsedUtcDate" >= ${period.from}
        AND "firstUsedUtcDate" <= ${period.to}
        AND "participationCount" > 0
      ORDER BY random()
      LIMIT ${SIZE_SAMPLE_CAP}
    `.catch(() => []),
  ]);

  const platform = platformRows[0] ?? null;
  const trackingStartedAt = platform?.usageStatisticsTrackingStartedAt?.toISOString() ?? null;
  const lastAggregatedAt = platform?.usageStatisticsProjectedAt?.toISOString() ?? null;
  const historyComplete = trackingStartedAt !== null;
  const trackingDay = trackingStartedAt ? trackingStartedAt.slice(0, 10) : null;

  const byDate = new Map(dailyRows.map((row) => [formatUtcDate(row.date), row]));
  const dailySeries: UsageReport['dailySeries'] = [];
  const cursor = new Date(period.from);
  while (cursor.getTime() <= period.to.getTime()) {
    const key = formatUtcDate(cursor);
    const row = byDate.get(key);
    const beforeTracking = trackingDay !== null && key < trackingDay;
    const unknown = !historyComplete || beforeTracking;
    dailySeries.push({
      date: key,
      sessionsUsed: row ? row.sessionsUsed : unknown ? null : 0,
      sessionParticipations: row ? row.sessionParticipations : unknown ? null : 0,
      quizAnswers: row ? row.quizAnswers : unknown ? null : 0,
      qaQuestionsAccepted: row ? row.qaQuestionsAccepted : unknown ? null : 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const hasAnyDaily = dailyRows.length > 0;
  const sum = (field: keyof (typeof dailyRows)[number]): number | null => {
    if (!historyComplete && !hasAnyDaily) return null;
    return dailyRows.reduce((acc, row) => acc + Number(row[field] ?? 0), 0);
  };

  const sessionsUsed = sum('sessionsUsed');
  const sessionsByFunction =
    sessionsUsed === null
      ? null
      : {
          joinOnly: dailyRows.reduce((a, r) => a + (r.sessionsJoinOnly ?? 0), 0),
          quizOnly: dailyRows.reduce((a, r) => a + r.sessionsQuizOnly, 0),
          qaOnly: dailyRows.reduce((a, r) => a + r.sessionsQaOnly, 0),
          combined: dailyRows.reduce((a, r) => a + r.sessionsCombined, 0),
        };

  const sizes = sizeRows
    .map((r) => Math.max(0, Number(r.participationCount) || 0))
    .filter((count) => count > 0)
    .sort((a, b) => a - b);
  const classCounts = Object.fromEntries(USAGE_SIZE_CLASSES.map((c) => [c.id, 0])) as Record<
    UsageSizeClassId,
    number
  >;
  for (const count of sizes) classCounts[sizeClassForCount(count)] += 1;

  const sizeDistribution =
    !historyComplete && sizes.length === 0
      ? null
      : {
          sampleSize: sizes.length,
          median: sizes.length ? percentileNearest(sizes, 0.5) : null,
          quartile1: sizes.length ? percentileNearest(sizes, 0.25) : null,
          quartile3: sizes.length ? percentileNearest(sizes, 0.75) : null,
          classes: USAGE_SIZE_CLASSES.map((cls) => ({
            id: cls.id,
            label: cls.label,
            count: classCounts[cls.id],
          })),
        };

  return {
    timezone: 'UTC',
    periodKind: period.kind,
    periodFrom: formatUtcDate(period.from),
    periodTo: formatUtcDate(period.to),
    trackingStartedAt,
    lastAggregatedAt,
    historyComplete,
    sessionsUsed,
    sessionParticipations: sum('sessionParticipations'),
    quizAnswers: sum('quizAnswers'),
    qaQuestionsAccepted: sum('qaQuestionsAccepted'),
    qaRatingActions: sum('qaRatingActions'),
    sessionsByFunction,
    dailySeries,
    monthlySeries: buildMonthlySeries(dailySeries),
    sizeDistribution,
    qaQuestionsTotalLifetime: Number(platform?.qaQuestionsTotal ?? 0),
    completedSessionsLifetime: Number(platform?.completedSessionsTotal ?? 0),
  };
}
