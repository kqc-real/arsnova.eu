-- Zeitpunkt der letzten Host-Passagen-Schwärzung (#485).
ALTER TABLE "QaQuestion"
  ADD COLUMN IF NOT EXISTS "passagesRedactedAt" TIMESTAMP(3);
