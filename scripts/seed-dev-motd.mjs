#!/usr/bin/env node
/**
 * Legt die dauerhafte Willkommens-MOTD an (feste ID, lang gültig bis Ende 2099).
 * Idempotent: DELETE + INSERT ersetzt Inhalt und Locales bei wiederholtem Aufruf.
 *
 * Priorität -100 (unter Admin-Standard 0), damit echte / Feature-MOTDs mit getCurrent zuerst kommen.
 *
 * Text-Updates für bestehende DBs: prisma/migrations/20260524120000_motd_welcome_copy_v5/migration.sql
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
const CONTENT_VERSION = 5;

const markdownDe = `# In 30 Sekunden live.

Quiz erstellen, QR-Code teilen, loslegen: Abstimmung, Peer Instruction, Q&A, Team-Modus und Bonus-Code – ohne Account, ohne Tracking, Open Source und DSGVO-orientiert. Weniger Plattform-Overhead als Particify, weniger Vendor-Lock-in als Mentimeter, lehrnäher als Kahoot, schlanker als Slido.

**Jetzt ausprobieren**`;

const markdownEn = `# Live in 30 seconds.

Create a quiz, share the QR code, start teaching: polling, Peer Instruction, Q&A, team mode and bonus codes — no account, no tracking, open source and privacy-first. Less platform overhead than Particify, less vendor lock-in than Mentimeter, more teaching-focused than Kahoot, leaner than Slido.

**Try it now**`;

const markdownFr = `# En direct en 30 secondes.

Créez un quiz, partagez le QR code, lancez la séance : vote, Peer Instruction, Q&R, mode équipes et codes bonus — sans compte, sans pistage, open source et pensé pour la confidentialité. Moins lourd que Particify, moins verrouillé que Mentimeter, plus pédagogique que Kahoot, plus direct que Slido.

**Essayer maintenant**`;

const markdownEs = `# En vivo en 30 segundos.

Crea un quiz, comparte el código QR y empieza: votaciones, Peer Instruction, preguntas y respuestas, modo equipos y códigos bonus — sin cuenta, sin rastreo, open source y con privacidad desde el diseño. Menos carga que Particify, menos dependencia que Mentimeter, más orientado a la docencia que Kahoot, más ágil que Slido.

**Pruébalo ahora**`;

const markdownIt = `# Live in 30 secondi.

Crea un quiz, condividi il QR code e parti: sondaggi, Peer Instruction, Q&A, modalità team e codici bonus — senza account, senza tracking, open source e privacy-first. Meno struttura di Particify, meno lock-in di Mentimeter, più didattico di Kahoot, più snello di Slido.

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
