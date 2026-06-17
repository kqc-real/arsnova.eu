-- Story 1.2d: Numerische Schätzfrage (NUMERIC_ESTIMATE)
-- Adds NUMERIC_ESTIMATE to QuestionType enum, numeric config fields to Question,
-- and numericValue to Vote.

-- 1. Extend QuestionType enum
ALTER TYPE "QuestionType" ADD VALUE IF NOT EXISTS 'NUMERIC_ESTIMATE';

-- 2. Add numeric config columns to Question table
ALTER TABLE "Question"
  ADD COLUMN "numericReferenceValue"   DOUBLE PRECISION,
  ADD COLUMN "numericTolerancePercent" DOUBLE PRECISION,
  ADD COLUMN "numericIntervalLeft"     DOUBLE PRECISION,
  ADD COLUMN "numericIntervalRight"    DOUBLE PRECISION,
  ADD COLUMN "numericInputType"        TEXT,
  ADD COLUMN "numericDecimalPlaces"    INTEGER,
  ADD COLUMN "numericMin"              DOUBLE PRECISION,
  ADD COLUMN "numericMax"              DOUBLE PRECISION,
  ADD COLUMN "numericTwoRounds"        BOOLEAN NOT NULL DEFAULT false;

-- 3. Add numericValue to Vote table
ALTER TABLE "Vote"
  ADD COLUMN "numericValue" DOUBLE PRECISION;
