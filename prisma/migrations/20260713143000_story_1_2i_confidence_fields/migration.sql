-- Story 1.2i: Optionaler Sicherheitsgrad pro Frage und Vote
ALTER TABLE "Question"
ADD COLUMN "confidenceEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "confidenceLabelLow" TEXT,
ADD COLUMN "confidenceLabelHigh" TEXT;

ALTER TABLE "Vote"
ADD COLUMN "confidenceValue" INTEGER;
