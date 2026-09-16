import { prisma } from '../db';
import { logger } from './logger';
import { PLATFORM_STATISTIC_ID } from './platformStatistic';

export const QA_PLATFORM_PROJECTION_INTERVAL_MS = 15_000;

let projectionTimer: ReturnType<typeof setInterval> | null = null;
let projectionInFlight: Promise<void> | null = null;

/**
 * Zieht ausschließlich kleine, persistente Session-Aggregate nach. Der
 * Fragenbestand selbst wird weder hier noch in health.stats gescannt.
 */
export async function projectQaPlatformStatistics(): Promise<void> {
  if (projectionInFlight) {
    return projectionInFlight;
  }

  projectionInFlight = (async () => {
    await prisma.$transaction(async (tx) => {
      const acquired = await tx.$queryRaw<Array<{ acquired: boolean }>>`
        SELECT pg_try_advisory_xact_lock(
          hashtext('arsnova:qa-platform-projection')
        ) AS acquired
      `;
      if (acquired[0]?.acquired !== true) {
        return;
      }

      await tx.$executeRaw`
          INSERT INTO "QaSessionStatisticProjection" (
            "sessionId",
            "questionsAcceptedTotal",
            "questionPeakCount",
            "questionPeakReachedAt",
            "projectedAt"
          )
          SELECT
            "id",
            "qaQuestionsAcceptedTotal",
            "qaQuestionPeakCount",
            "qaQuestionPeakReachedAt",
            timezone('UTC', clock_timestamp())
          FROM "Session"
          ON CONFLICT ("sessionId") DO UPDATE
          SET
            "questionsAcceptedTotal" = GREATEST(
              "QaSessionStatisticProjection"."questionsAcceptedTotal",
              EXCLUDED."questionsAcceptedTotal"
            ),
            "questionPeakReachedAt" = CASE
              WHEN EXCLUDED."questionPeakCount"
                > "QaSessionStatisticProjection"."questionPeakCount"
                THEN EXCLUDED."questionPeakReachedAt"
              ELSE "QaSessionStatisticProjection"."questionPeakReachedAt"
            END,
            "questionPeakCount" = GREATEST(
              "QaSessionStatisticProjection"."questionPeakCount",
              EXCLUDED."questionPeakCount"
            ),
            "projectedAt" = EXCLUDED."projectedAt"
        `;

      await tx.$executeRaw`
          WITH aggregate AS (
            SELECT
              COALESCE(SUM("questionsAcceptedTotal"), 0)::BIGINT AS questions_total,
              COALESCE(MAX("questionPeakCount"), 0)::INTEGER AS maximum
            FROM "QaSessionStatisticProjection"
          ),
          maximum_source AS (
            SELECT "questionPeakReachedAt"
            FROM "QaSessionStatisticProjection", aggregate
            WHERE "questionPeakCount" = aggregate.maximum
            ORDER BY "questionPeakReachedAt" ASC NULLS LAST, "sessionId" ASC
            LIMIT 1
          )
          INSERT INTO "PlatformStatistic" (
            "id",
            "qaQuestionsTotal",
            "maxQaQuestionsSingleSession",
            "maxQaQuestionsStatisticUpdatedAt",
            "qaStatisticsTrackingStartedAt",
            "qaStatisticsProjectedAt",
            "updatedAt"
          )
          SELECT
            ${PLATFORM_STATISTIC_ID},
            aggregate.questions_total,
            aggregate.maximum,
            maximum_source."questionPeakReachedAt",
            timezone('UTC', clock_timestamp()),
            timezone('UTC', clock_timestamp()),
            timezone('UTC', clock_timestamp())
          FROM aggregate
          LEFT JOIN maximum_source ON TRUE
          ON CONFLICT ("id") DO UPDATE
          SET
            "qaQuestionsTotal" = GREATEST(
              "PlatformStatistic"."qaQuestionsTotal",
              EXCLUDED."qaQuestionsTotal"
            ),
            "maxQaQuestionsStatisticUpdatedAt" = CASE
              WHEN EXCLUDED."maxQaQuestionsSingleSession"
                > "PlatformStatistic"."maxQaQuestionsSingleSession"
                THEN EXCLUDED."maxQaQuestionsStatisticUpdatedAt"
              ELSE "PlatformStatistic"."maxQaQuestionsStatisticUpdatedAt"
            END,
            "maxQaQuestionsSingleSession" = GREATEST(
              "PlatformStatistic"."maxQaQuestionsSingleSession",
              EXCLUDED."maxQaQuestionsSingleSession"
            ),
            "qaStatisticsTrackingStartedAt" = COALESCE(
              "PlatformStatistic"."qaStatisticsTrackingStartedAt",
              EXCLUDED."qaStatisticsTrackingStartedAt"
            ),
            "qaStatisticsProjectedAt" = EXCLUDED."qaStatisticsProjectedAt",
            "updatedAt" = "PlatformStatistic"."updatedAt"
        `;
    });
  })().finally(() => {
    projectionInFlight = null;
  });

  return projectionInFlight;
}

export function startQaPlatformProjectionScheduler(): void {
  if (projectionTimer) return;
  void projectQaPlatformStatistics().catch((error: unknown) => {
    logger.warn('Q&A-Plattformprojektion beim Start fehlgeschlagen', error);
  });
  projectionTimer = setInterval(() => {
    void projectQaPlatformStatistics().catch((error: unknown) => {
      logger.warn('Q&A-Plattformprojektion fehlgeschlagen', error);
    });
  }, QA_PLATFORM_PROJECTION_INTERVAL_MS);
  projectionTimer.unref?.();
}

export function stopQaPlatformProjectionScheduler(): void {
  if (projectionTimer) {
    clearInterval(projectionTimer);
    projectionTimer = null;
  }
}
