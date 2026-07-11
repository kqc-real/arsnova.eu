-- Reconcile fields that previously reached long-lived databases through
-- `prisma db push`, but were missing from the versioned migration chain.
-- `IF NOT EXISTS` keeps the migration safe for those existing installations.
ALTER TABLE "Session"
ADD COLUMN IF NOT EXISTS "onboardingAllowCustomNicknames" BOOLEAN,
ADD COLUMN IF NOT EXISTS "onboardingAnonymousMode" BOOLEAN,
ADD COLUMN IF NOT EXISTS "onboardingNicknameTheme" "NicknameTheme",
ADD COLUMN IF NOT EXISTS "onboardingProfileConfigured" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "onboardingTeamAssignment" "TeamAssignment",
ADD COLUMN IF NOT EXISTS "onboardingTeamCount" INTEGER,
ADD COLUMN IF NOT EXISTS "onboardingTeamMode" BOOLEAN,
ADD COLUMN IF NOT EXISTS "onboardingTeamNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "qaOpen" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "quickFeedbackOpen" BOOLEAN DEFAULT false;

UPDATE "Session"
SET "onboardingProfileConfigured" = false
WHERE "onboardingProfileConfigured" IS NULL;

UPDATE "Session"
SET "qaOpen" = false
WHERE "qaOpen" IS NULL;

UPDATE "Session"
SET "quickFeedbackOpen" = false
WHERE "quickFeedbackOpen" IS NULL;

ALTER TABLE "Session"
ALTER COLUMN "onboardingProfileConfigured" SET DEFAULT false,
ALTER COLUMN "onboardingProfileConfigured" SET NOT NULL,
ALTER COLUMN "onboardingTeamNames" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "qaOpen" SET DEFAULT false,
ALTER COLUMN "qaOpen" SET NOT NULL,
ALTER COLUMN "quickFeedbackOpen" SET DEFAULT false,
ALTER COLUMN "quickFeedbackOpen" SET NOT NULL;
