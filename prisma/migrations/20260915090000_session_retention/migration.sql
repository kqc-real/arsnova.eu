-- Epic #405 / #409: 14-day host post-processing, legal hold and purpose-separated retention.

ALTER TABLE "Session"
  ADD COLUMN IF NOT EXISTS "legalHoldUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "legalHoldReason" TEXT,
  ADD COLUMN IF NOT EXISTS "legalHoldSetAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Session_legalHoldUntil_idx"
  ON "Session"("legalHoldUntil");

-- Bonus codes and session feedback have their own 90-day purpose-based retention.
-- Deleting the session core removes the direct references, but keeps the minimized snapshots.
ALTER TABLE "BonusToken"
  DROP CONSTRAINT IF EXISTS "BonusToken_sessionId_fkey",
  DROP CONSTRAINT IF EXISTS "BonusToken_participantId_fkey",
  ALTER COLUMN "sessionId" DROP NOT NULL,
  ALTER COLUMN "participantId" DROP NOT NULL;

ALTER TABLE "BonusToken"
  ADD CONSTRAINT "BonusToken_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "Session"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "BonusToken_participantId_fkey"
    FOREIGN KEY ("participantId") REFERENCES "Participant"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SessionFeedback"
  DROP CONSTRAINT IF EXISTS "SessionFeedback_sessionId_fkey",
  DROP CONSTRAINT IF EXISTS "SessionFeedback_participantId_fkey",
  ALTER COLUMN "sessionId" DROP NOT NULL,
  ALTER COLUMN "participantId" DROP NOT NULL;

ALTER TABLE "SessionFeedback"
  ADD CONSTRAINT "SessionFeedback_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "Session"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "SessionFeedback_participantId_fkey"
    FOREIGN KEY ("participantId") REFERENCES "Participant"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Audit records may outlive the session for their separately documented security purpose.
-- Raw session identifiers are nullable so cleanup can pseudonymize the link at core purge.
ALTER TABLE "AdminAuditLog"
  ADD COLUMN IF NOT EXISTS "sessionReferenceHash" CHAR(64),
  ALTER COLUMN "sessionId" DROP NOT NULL,
  ALTER COLUMN "sessionCode" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "AdminAuditLog_sessionReferenceHash_createdAt_idx"
  ON "AdminAuditLog"("sessionReferenceHash", "createdAt");

-- Existing audit entries whose session was already deleted must not retain a join code.
UPDATE "AdminAuditLog" AS audit
SET
  "sessionId" = NULL,
  "sessionCode" = NULL
WHERE audit."sessionId" <> 'ALL'
  AND NOT EXISTS (
    SELECT 1
    FROM "Session" AS session
    WHERE session."id" = audit."sessionId"
  );
