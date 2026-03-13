-- Add configurable team names to Quiz for Story 7.1b.
-- Safe for production: column may already exist in dev after prisma db push.
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "teamNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
