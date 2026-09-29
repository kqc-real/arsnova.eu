-- Bestehende Schwärzungen ohne Zeitstempel: bestmöglicher Datum aus updatedAt.
UPDATE "QaQuestion"
SET "passagesRedactedAt" = "updatedAt"
WHERE "passagesRedacted" = true
  AND "passagesRedactedAt" IS NULL;
