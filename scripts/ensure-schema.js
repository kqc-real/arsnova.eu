/**
 * ensure-schema.js – Stellt sicher, dass alle DB-Spalten/Enums existieren.
 * Wird im Docker-Entrypoint vor dem App-Start ausgeführt.
 * Nutzt PrismaClient direkt (keine CLI nötig, kein prisma.config.ts-Parsing).
 */
const { PrismaClient } = require('@prisma/client');

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

  // Quiz: readingPhaseEnabled
  `ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "readingPhaseEnabled" BOOLEAN NOT NULL DEFAULT true`,

  // Quiz: bonusTokenCount
  `ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "bonusTokenCount" INTEGER`,

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
];

async function main() {
  const prisma = new PrismaClient();
  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const sql of statements) {
    try {
      await prisma.$executeRawUnsafe(sql);
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

  await prisma.$disconnect();
  console.log(`>>> ensure-schema: ${ok} OK, ${skipped} übersprungen, ${failed} Fehler`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('>>> ensure-schema fehlgeschlagen:', err.message);
  process.exit(1);
});
