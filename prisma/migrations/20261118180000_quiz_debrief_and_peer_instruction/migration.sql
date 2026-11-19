-- Vorhandene Live-Kopien behalten ihren bisherigen Funktionsumfang.
ALTER TABLE "Quiz"
  ADD COLUMN "enableLearningDebrief" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "enablePeerInstruction" BOOLEAN NOT NULL DEFAULT true;
