#!/usr/bin/env node
/**
 * Legt eine aktive PUBLISHED-MOTD mit Bannerbild an (Markdown: /assets/images/AI-REVOLUTION.png).
 * Feste ID — bei erneutem Aufruf wird der Eintrag ersetzt.
 *
 * Voraussetzung: Datei apps/frontend/src/assets/images/AI-REVOLUTION.png (wird mit dem Frontend gebaut).
 *
 *   npm run seed:motd-ai-revolution
 */
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const DEFAULT_DATABASE_URL =
  'postgresql://arsnova_user:secretpassword@localhost:5432/arsnova_v3_dev?schema=public';

const MOTD_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const STARTS = new Date('2026-03-01T00:00:00.000Z');
const ENDS = new Date('2099-12-31T12:00:00.000Z');

const markdownDe = `# KI-Revolution

Die Entwicklung von arsnova.eu im Wandel der Zeit — ein Bild sagt mehr als tausend Tokens.

![](/assets/images/AI-REVOLUTION.png)`;

const markdownEn = `# The AI revolution

How arsnova.eu is evolving — one image speaks more than a thousand tokens.

![](/assets/images/AI-REVOLUTION.png)`;

const markdownFr = `# Révolution de l’IA

L’évolution d’arsnova.eu — une image vaut mille tokens.

![](/assets/images/AI-REVOLUTION.png)`;

const markdownEs = `# Revolución de la IA

La evolución de arsnova.eu: una imagen vale más que mil tokens.

![](/assets/images/AI-REVOLUTION.png)`;

const markdownIt = `# Rivoluzione dell’IA

L’evoluzione di arsnova.eu — un’immagine vale più di mille token.

![](/assets/images/AI-REVOLUTION.png)`;

async function main() {
  const connectionString = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    await client.query(`DELETE FROM "MotdLocale" WHERE "motdId" = $1`, [MOTD_ID]);
    await client.query(`DELETE FROM "Motd" WHERE id = $1`, [MOTD_ID]);

    const now = new Date();

    await client.query(
      `INSERT INTO "Motd" (
        "id", "status", "priority", "startsAt", "endsAt",
        "visibleInArchive", "contentVersion", "templateId",
        "createdAt", "updatedAt"
      ) VALUES ($1, 'PUBLISHED', $2, $3, $4, true, 1, NULL, $5, $5)`,
      [MOTD_ID, 5, STARTS, ENDS, now],
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
        [randomUUID(), MOTD_ID, locale, md],
      );
    }

    console.log(
      `MOTD KI-Revolution angelegt (id=${MOTD_ID}, priority=5), ${STARTS.toISOString()} … ${ENDS.toISOString()} UTC.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
