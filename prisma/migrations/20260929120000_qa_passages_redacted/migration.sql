-- Host-Schwärzung von Q&A-Passagen (#485): dauerhaftes Label ohne Originalwortlaut.
ALTER TABLE "QaQuestion"
  ADD COLUMN IF NOT EXISTS "passagesRedacted" BOOLEAN NOT NULL DEFAULT false;
