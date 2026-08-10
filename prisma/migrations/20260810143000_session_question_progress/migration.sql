-- Autoritativer, sessionspezifischer Fragenverlauf.
-- Bestehende Zeilen bleiben NULL und verwenden damit bewusst den Legacy-Kompatibilitätspfad.
ALTER TABLE "Session"
ADD COLUMN "questionProgress" JSONB,
ADD COLUMN "questionProgressComplete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lastSkippedQuestionId" TEXT,
ADD COLUMN "lastQuestionSkippedAt" TIMESTAMP(3);
