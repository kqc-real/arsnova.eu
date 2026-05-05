-- Add monotonic completed sessions counter
ALTER TABLE "PlatformStatistic"
ADD COLUMN "completedSessionsTotal" INTEGER NOT NULL DEFAULT 0;

-- Ensure singleton row exists and seed both counters from current data.
INSERT INTO "PlatformStatistic" (
  "id",
  "maxParticipantsSingleSession",
  "completedSessionsTotal",
  "updatedAt"
)
VALUES (
  'default',
  COALESCE(
    (SELECT MAX("c") FROM (SELECT COUNT(*)::int AS "c" FROM "Participant" GROUP BY "sessionId") AS "t"),
    0
  ),
  COALESCE(
    (SELECT COUNT(*)::int FROM "Session" WHERE "status" = 'FINISHED'),
    0
  ),
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE
SET
  "maxParticipantsSingleSession" = GREATEST(
    "PlatformStatistic"."maxParticipantsSingleSession",
    EXCLUDED."maxParticipantsSingleSession"
  ),
  "completedSessionsTotal" = GREATEST(
    "PlatformStatistic"."completedSessionsTotal",
    EXCLUDED."completedSessionsTotal"
  ),
  "updatedAt" = "PlatformStatistic"."updatedAt";
