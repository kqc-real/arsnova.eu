-- Story 8.9b: persistierte Q&A-NLP-Hilfssignale (Host-only). Default DISABLED,
-- damit bestehende Fragen ohne Kaskade unverändert bleiben.

CREATE TYPE "QaNlpStatus" AS ENUM ('PENDING', 'CLASSIFIED', 'UNCERTAIN', 'DISABLED', 'FAILED');

CREATE TYPE "QaNlpCategory" AS ENUM ('CONTENT', 'ORGANIZATION', 'TECHNICAL');

ALTER TABLE "QaQuestion"
ADD COLUMN "nlpStatus" "QaNlpStatus" NOT NULL DEFAULT 'DISABLED',
ADD COLUMN "nlpCategory" "QaNlpCategory",
ADD COLUMN "nlpConfidence" DOUBLE PRECISION,
ADD COLUMN "nlpModelVersion" TEXT,
ADD COLUMN "nlpAnalyzedAt" TIMESTAMP(3);

CREATE INDEX "QaQuestion_sessionId_nlpStatus_idx" ON "QaQuestion"("sessionId", "nlpStatus");
