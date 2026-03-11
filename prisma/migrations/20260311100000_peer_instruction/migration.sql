-- Story 2.7: Peer Instruction – Diskussionsphase und zweite Abstimmungsrunde.

-- 1. Neuer SessionStatus-Wert DISCUSSION
ALTER TYPE "SessionStatus" ADD VALUE IF NOT EXISTS 'DISCUSSION' AFTER 'RESULTS';

-- 2. Session: aktuelle Runde (1 oder 2)
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "currentRound" INTEGER NOT NULL DEFAULT 1;

-- 3. Vote: Runde pro Abstimmung
ALTER TABLE "Vote" ADD COLUMN IF NOT EXISTS "round" INTEGER NOT NULL DEFAULT 1;

-- 4. Unique-Constraint aktualisieren: eine Stimme pro Frage PRO RUNDE
ALTER TABLE "Vote" DROP CONSTRAINT IF EXISTS "Vote_sessionId_participantId_questionId_key";
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_sessionId_participantId_questionId_round_key"
  UNIQUE ("sessionId", "participantId", "questionId", "round");
