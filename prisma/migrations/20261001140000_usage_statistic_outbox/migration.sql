-- Issue #483 Review: dauerhafte Usage-Events (Outbox) für Join/Vote/Q&A

CREATE TABLE IF NOT EXISTS "UsageStatisticOutbox" (
  "id" TEXT NOT NULL,
  "kind" VARCHAR(32) NOT NULL,
  "sessionId" TEXT NOT NULL,
  "idempotencyKey" VARCHAR(160) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" VARCHAR(500),
  CONSTRAINT "UsageStatisticOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UsageStatisticOutbox_idempotencyKey_key"
  ON "UsageStatisticOutbox"("idempotencyKey");

CREATE INDEX IF NOT EXISTS "UsageStatisticOutbox_processedAt_createdAt_idx"
  ON "UsageStatisticOutbox"("processedAt", "createdAt");
