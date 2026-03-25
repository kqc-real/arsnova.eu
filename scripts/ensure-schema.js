/**
 * ensure-schema.js – Stellt sicher, dass alle DB-Spalten/Enums existieren.
 * Wird im Docker-Entrypoint vor dem App-Start ausgeführt.
 * Nutzt `pg` direkt, damit das Script unabhängig vom Prisma-Client-Setup läuft.
 */
const { Client } = require('pg');

const DEFAULT_DATABASE_URL =
  'postgresql://arsnova_user:secretpassword@localhost:5432/arsnova_v3_dev?schema=public';

function createClient() {
  const connectionString = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
  return new Client({ connectionString });
}

const statements = [
  // Story 2.7: Peer Instruction
  `ALTER TYPE "SessionStatus" ADD VALUE IF NOT EXISTS 'DISCUSSION' AFTER 'RESULTS'`,
  `ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "currentRound" INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE "Vote" ADD COLUMN IF NOT EXISTS "round" INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "preset" TEXT NOT NULL DEFAULT 'PLAYFUL'`,

  // Unique-Constraint: eine Stimme pro Frage PRO RUNDE
  // Alten Constraint sicher entfernen, dann neuen anlegen
  `ALTER TABLE "Vote" DROP CONSTRAINT IF EXISTS "Vote_sessionId_participantId_questionId_key"`,
  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'Vote_sessionId_participantId_questionId_round_key'
     ) THEN
       ALTER TABLE "Vote" ADD CONSTRAINT "Vote_sessionId_participantId_questionId_round_key"
         UNIQUE ("sessionId", "participantId", "questionId", "round");
     END IF;
   END $$`,

  // Story 2.6: Lesephase
  `ALTER TYPE "SessionStatus" ADD VALUE IF NOT EXISTS 'QUESTION_OPEN' AFTER 'LOBBY'`,

  // Story 8.1: Session-Typ, Q&A
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SessionType') THEN
       CREATE TYPE "SessionType" AS ENUM ('QUIZ', 'Q_AND_A');
     END IF;
   END $$`,
  `ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "type" "SessionType" NOT NULL DEFAULT 'QUIZ'`,
  `ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "title" TEXT`,
  `ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "moderationMode" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "qaEnabled" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "qaTitle" TEXT`,
  `ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "qaModerationMode" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "quickFeedbackEnabled" BOOLEAN NOT NULL DEFAULT false`,

  // Quiz: readingPhaseEnabled
  `ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "readingPhaseEnabled" BOOLEAN NOT NULL DEFAULT true`,

  // Quiz: bonusTokenCount
  `ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "bonusTokenCount" INTEGER`,

  // Quiz: optionales Motivbild (HTTPS-URL), synchron zu Prisma-Migration 20260324120000
  `ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "motifImageUrl" TEXT`,

  // Story 4.6: BonusToken-Tabelle
  `CREATE TABLE IF NOT EXISTS "BonusToken" (
     "id" TEXT NOT NULL,
     "token" TEXT NOT NULL,
     "sessionId" TEXT NOT NULL,
     "participantId" TEXT NOT NULL,
     "nickname" TEXT NOT NULL,
     "quizName" TEXT NOT NULL,
     "totalScore" INTEGER NOT NULL,
     "rank" INTEGER NOT NULL,
     "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "BonusToken_pkey" PRIMARY KEY ("id")
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "BonusToken_token_key" ON "BonusToken"("token")`,
  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'BonusToken_sessionId_fkey'
     ) THEN
       ALTER TABLE "BonusToken" ADD CONSTRAINT "BonusToken_sessionId_fkey"
         FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'BonusToken_participantId_fkey'
     ) THEN
       ALTER TABLE "BonusToken" ADD CONSTRAINT "BonusToken_participantId_fkey"
         FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END $$`,

  // Story 4.8: SessionFeedback-Tabelle
  `CREATE TABLE IF NOT EXISTS "SessionFeedback" (
     "id" TEXT NOT NULL,
     "sessionId" TEXT NOT NULL,
     "participantId" TEXT NOT NULL,
     "overallRating" INTEGER NOT NULL,
     "questionQualityRating" INTEGER,
     "wouldRepeat" BOOLEAN,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "SessionFeedback_pkey" PRIMARY KEY ("id")
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "SessionFeedback_sessionId_participantId_key"
     ON "SessionFeedback"("sessionId", "participantId")`,
  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'SessionFeedback_sessionId_fkey'
     ) THEN
       ALTER TABLE "SessionFeedback" ADD CONSTRAINT "SessionFeedback_sessionId_fkey"
         FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'SessionFeedback_participantId_fkey'
     ) THEN
       ALTER TABLE "SessionFeedback" ADD CONSTRAINT "SessionFeedback_participantId_fkey"
         FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END $$`,

  // Epic 9: AdminAuditLog
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AdminAuditAction') THEN
       CREATE TYPE "AdminAuditAction" AS ENUM ('SESSION_DELETE', 'EXPORT_FOR_AUTHORITIES');
     END IF;
   END $$`,
  `CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
     "id" TEXT NOT NULL,
     "action" "AdminAuditAction" NOT NULL,
     "sessionId" TEXT NOT NULL,
     "sessionCode" TEXT NOT NULL,
     "adminIdentifier" TEXT,
     "reason" TEXT,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
   )`,

  // Epic 9: Session Legal Hold (Retention-Override)
  `ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "legalHoldUntil" TIMESTAMP(3)`,
  `ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "legalHoldReason" TEXT`,
  `ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "legalHoldSetAt" TIMESTAMP(3)`,
];

async function main() {
  const client = createClient();
  await client.connect();
  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const sql of statements) {
    try {
      await client.query(sql);
      ok++;
    } catch (err) {
      const msg = err.message || String(err);
      if (msg.includes('already exists') || msg.includes('duplicate')) {
        skipped++;
      } else {
        failed++;
        console.error(`>>> SQL-Fehler: ${msg.slice(0, 200)}`);
      }
    }
  }

  await client.end();
  console.log(`>>> ensure-schema: ${ok} OK, ${skipped} übersprungen, ${failed} Fehler`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('>>> ensure-schema fehlgeschlagen:', err.message);
  process.exit(1);
});
