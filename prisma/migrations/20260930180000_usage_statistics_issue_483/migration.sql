-- Issue #483: purge-sichere Nutzungsaggregate (UTC-Tage + Session-Marker ohne FK)

ALTER TABLE "PlatformStatistic"
  ADD COLUMN IF NOT EXISTS "usageStatisticsTrackingStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "usageStatisticsProjectedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "DailyUsageStatistic" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "sessionsUsed" INTEGER NOT NULL DEFAULT 0,
  "sessionParticipations" INTEGER NOT NULL DEFAULT 0,
  "quizAnswers" INTEGER NOT NULL DEFAULT 0,
  "qaQuestionsAccepted" INTEGER NOT NULL DEFAULT 0,
  "qaRatingActions" INTEGER NOT NULL DEFAULT 0,
  "sessionsQuizOnly" INTEGER NOT NULL DEFAULT 0,
  "sessionsQaOnly" INTEGER NOT NULL DEFAULT 0,
  "sessionsCombined" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyUsageStatistic_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DailyUsageStatistic_date_key" ON "DailyUsageStatistic"("date");

CREATE TABLE IF NOT EXISTS "SessionUsageProjection" (
  "sessionId" TEXT NOT NULL,
  "firstUsedAt" TIMESTAMP(3),
  "firstUsedUtcDate" DATE,
  "firstParticipationAt" TIMESTAMP(3),
  "participationCount" INTEGER NOT NULL DEFAULT 0,
  "hasQuizInteraction" BOOLEAN NOT NULL DEFAULT false,
  "hasQaInteraction" BOOLEAN NOT NULL DEFAULT false,
  "functionClass" VARCHAR(16),
  "projectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SessionUsageProjection_pkey" PRIMARY KEY ("sessionId")
);

CREATE INDEX IF NOT EXISTS "SessionUsageProjection_firstUsedUtcDate_idx"
  ON "SessionUsageProjection"("firstUsedUtcDate");

CREATE INDEX IF NOT EXISTS "SessionUsageProjection_functionClass_firstUsedUtcDate_idx"
  ON "SessionUsageProjection"("functionClass", "firstUsedUtcDate");
