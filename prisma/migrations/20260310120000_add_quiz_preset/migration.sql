-- Add preset column to Quiz (PLAYFUL/SERIOUS – visuelles Theme für Clients).
-- Safe for production: column was missing when schema had preset; dev may already have it via db push.
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "preset" TEXT NOT NULL DEFAULT 'PLAYFUL';
