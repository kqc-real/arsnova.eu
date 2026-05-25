#!/usr/bin/env node
/**
 * Legt die dauerhafte Willkommens-MOTD an (feste ID, lang gültig bis Ende 2099).
 * Idempotent: DELETE + INSERT ersetzt Inhalt und Locales bei wiederholtem Aufruf.
 *
 * Priorität -100 (unter Admin-Standard 0), damit echte / Feature-MOTDs mit getCurrent zuerst kommen.
 *
 * Text-Updates für bestehende DBs: prisma/migrations/20260525100000_motd_welcome_copy_v7/migration.sql
 * Making-of-MOTD (6 Monate, nach Willkommen): 20260329140000_motd_making_of_ai (id …bbbbbbbb…).
 *
 * Nutzung: DATABASE_URL gesetzt oder Default localhost (wie ensure-schema.js).
 *   node scripts/seed-dev-motd.mjs
 */
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const DEFAULT_DATABASE_URL =
  'postgresql://arsnova_user:secretpassword@localhost:5432/arsnova_v3_dev?schema=public';

const DEV_MOTD_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

/** Start sichtbar ab Go-Live-Datum; endsAt mittags UTC, damit MEZ nicht 01.01.2100 anzeigt */
const STARTS = new Date('2026-03-24T00:00:00.000Z');
const ENDS = new Date('2099-12-31T12:00:00.000Z');
const CONTENT_VERSION = 7;

const markdownDe = `# Ein Klick. Du bist live.

Live-Feedback für den schnellen Einstieg – oder nutze Quiz, Abstimmung, Q&A, Peer Instruction, Team-Modus und Bonus-Code. Mentimeter-Feeling ohne Vendor-Lock-in. Kahoot-Energie mit didaktischem Anspruch. Slido-Q&A plus echte Live-Interaktion. Ohne Account, ohne Tracking, Open Source und kostenlos.

**Jetzt ausprobieren**`;

const markdownEn = `# One click. You’re live.

Start instant pulse feedback — or run quizzes, polls, Q&A, Peer Instruction, team mode, and bonus codes. Mentimeter-style interaction without vendor lock-in. Kahoot energy with real teaching value. Slido-style Q&A plus full live engagement. No account, no tracking, open source, and free to use.

**Try it now**`;

const markdownFr = `# Un clic. Tu es en direct.

Lance un feedback instantané — ou utilise quiz, votes, Q&R, Peer Instruction, mode équipes et codes bonus. L’interaction façon Mentimeter sans verrouillage propriétaire. L’énergie de Kahoot avec une vraie valeur pédagogique. Les Q&R façon Slido, plus une interaction live complète. Sans compte, sans pistage, open source et gratuit.

**Essaie maintenant**`;

const markdownEs = `# Un clic. Estás en vivo.

Lanza feedback instantáneo — o usa quizzes, votaciones, preguntas y respuestas, Peer Instruction, modo equipos y códigos bonus. Interacción al estilo Mentimeter sin dependencia de proveedor. Energía tipo Kahoot con verdadero valor didáctico. Preguntas y respuestas al estilo Slido, más interacción en vivo completa. Sin cuenta, sin rastreo, open source y gratis.

**Pruébalo ahora**`;

const markdownIt = `# Un clic. Sei live.

Avvia subito un feedback istantaneo — oppure usa quiz, sondaggi, Q&A, Peer Instruction, modalità team e codici bonus. Interazione in stile Mentimeter senza vendor lock-in. Energia da Kahoot con vero valore didattico. Q&A in stile Slido, più interazione live completa. Senza account, senza tracking, open source e gratuito.

**Provalo ora**`;

async function main() {
  const connectionString = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    await client.query('DELETE FROM "Motd" WHERE id = $1', [DEV_MOTD_ID]);

    const now = new Date();

    await client.query(
      `INSERT INTO "Motd" (
        "id", "status", "priority", "startsAt", "endsAt",
        "visibleInArchive", "contentVersion", "templateId",
        "createdAt", "updatedAt"
      ) VALUES ($1, 'PUBLISHED', -100, $2, $3, true, $4, NULL, $5, $5)`,
      [DEV_MOTD_ID, STARTS, ENDS, CONTENT_VERSION, now],
    );

    const locales = [
      ['de', markdownDe],
      ['en', markdownEn],
      ['fr', markdownFr],
      ['es', markdownEs],
      ['it', markdownIt],
    ];

    for (const [locale, md] of locales) {
      await client.query(
        `INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown") VALUES ($1, $2, $3, $4)`,
        [randomUUID(), DEV_MOTD_ID, locale, md],
      );
    }

    console.log(
      `Willkommens-MOTD angelegt (id=${DEV_MOTD_ID}), gültig ${STARTS.toISOString()} … ${ENDS.toISOString()} UTC (contentVersion=${CONTENT_VERSION}).`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
