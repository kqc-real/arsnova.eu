/**
 * ensure-schema.js – Stellt sicher, dass alle DB-Spalten/Enums existieren.
 * Wird im Docker-Entrypoint vor dem App-Start ausgeführt.
 * Nutzt `pg` direkt, damit das Script unabhängig vom Prisma-Client-Setup läuft.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DEFAULT_DATABASE_URL =
  'postgresql://arsnova_user:secretpassword@localhost:5432/arsnova_v3_dev?schema=public';

function shouldSeedMotdMakingOfRuntime(nodeEnv) {
  return nodeEnv !== 'production';
}

function getMotdMakingOfSeedFiles() {
  return [
    'prisma/migrations/20260329140000_motd_making_of_ai/migration.sql',
    'prisma/migrations/20260331100000_motd_making_of_align_start/migration.sql',
    'prisma/migrations/20260331150000_motd_making_of_greeting_line/migration.sql',
    'prisma/migrations/20260331160000_motd_making_of_herstellungskosten/migration.sql',
    'prisma/migrations/20260331170000_motd_making_of_openhub_active/migration.sql',
    'prisma/migrations/20260401120000_motd_making_of_banner_image/migration.sql',
  ];
}

function createClient() {
  const connectionString = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
  return new Client({ connectionString });
}

/** Node kann bei connect() AggregateError liefern — dann ist err.message leer. */
function formatErr(err) {
  if (!err) return 'Unbekannter Fehler';
  if (typeof err.message === 'string' && err.message.trim()) return err.message;
  if (Array.isArray(err.errors) && err.errors.length) {
    return err.errors.map((e) => (e && e.message) || String(e)).join('; ');
  }
  if (err.cause && err.cause.message) return err.cause.message;
  return String(err);
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
  // Baseline (migration.sql) legt ggf. schon CREATE UNIQUE INDEX …_round_key an — gleicher Name wie
  // Constraint; nur pg_constraint prüfen reicht dann nicht (ERROR: relation … already exists).
  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = 'Vote_sessionId_participantId_questionId_round_key'
     ) AND NOT EXISTS (
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

  // Question: per-Frage-Override für die Lesephase
  `ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "skipReadingPhase" BOOLEAN NOT NULL DEFAULT false`,

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

/**
 * Making-of-MOTD (Epic 10): SQL wie in prisma/migrations — idempotent (ON CONFLICT).
 * Ohne `prisma migrate` fehlte die zweite Meldung bei reinem `npm run dev` + ensure-schema.
 * In Produktion NICHT erneut ausführen: `prisma migrate deploy` übernimmt das bereits,
 * und spätere Runtime-Ausführung würde redaktionelle Änderungen an festen MOTD-IDs überschreiben.
 */
function seedMotdMakingOfSql() {
  if (!shouldSeedMotdMakingOfRuntime(process.env.NODE_ENV)) {
    console.log('>>> MOTD Making-of: übersprungen (Produktion nutzt prisma migrate deploy).');
    return;
  }

  const root = path.join(__dirname, '..');
  const files = getMotdMakingOfSeedFiles();
  let applied = 0;
  for (const rel of files) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) {
      console.warn(`>>> MOTD Making-of: Datei fehlt (${rel}).`);
      continue;
    }
    try {
      execSync(`npx prisma db execute --file "${abs}"`, {
        cwd: root,
        stdio: 'pipe',
        encoding: 'utf8',
        env: process.env,
      });
      applied++;
    } catch (e) {
      const out =
        (e.stderr && e.stderr.toString()) ||
        (e.stdout && e.stdout.toString()) ||
        e.message ||
        String(e);
      if (/relation .+ does not exist/i.test(out)) {
        console.warn(
          '>>> MOTD Making-of: übersprungen (MOTD-Tabellen fehlen — `npx prisma migrate deploy` oder `db push`).',
        );
        return;
      }
      console.warn('>>> MOTD Making-of optional:', out.trim().slice(0, 500));
      return;
    }
  }
  if (applied === files.length) {
    console.log('>>> MOTD Making-of: SQL angewendet (Archiv + Overlay-Kette).');
  }
}

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

  if (failed === 0) {
    seedMotdMakingOfSql();
  }

  if (failed > 0) {
    process.exit(1);
  }
}

module.exports = {
  DEFAULT_DATABASE_URL,
  shouldSeedMotdMakingOfRuntime,
  getMotdMakingOfSeedFiles,
  seedMotdMakingOfSql,
};

if (require.main === module) {
  main().catch((err) => {
    const detail = formatErr(err);
    console.error('>>> ensure-schema fehlgeschlagen:', detail);
    const code = err && err.code;
    const text = `${detail} ${code || ''}`;
    if (
      code === 'ECONNREFUSED' ||
      /ECONNREFUSED|connect ECONNREFUSED/i.test(text) ||
      /Connection refused/i.test(text)
    ) {
      console.error(
        '>>> Hinweis: PostgreSQL nicht erreichbar (Port 5432). Dev-DB: npm run docker:up:dev',
      );
      console.error(
        '>>> Wenn docker compose „docker.sock“ / „daemon“ meldet: Docker Desktop (oder Colima) starten — ohne laufenden Docker-Daemon gibt es keine Postgres-Container.',
      );
    }
    process.exit(1);
  });
}
