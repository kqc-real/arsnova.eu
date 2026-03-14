-- Epic 9: Legal Hold für Session-Retention (Default 30 Tage im Admin-Flow)
ALTER TABLE "Session"
ADD COLUMN IF NOT EXISTS "legalHoldUntil" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "legalHoldReason" TEXT,
ADD COLUMN IF NOT EXISTS "legalHoldSetAt" TIMESTAMP(3);
