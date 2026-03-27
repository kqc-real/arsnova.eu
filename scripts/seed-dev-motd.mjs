#!/usr/bin/env node
/**
 * Legt die dauerhafte Willkommens-MOTD an (feste ID, lang gültig bis Ende 2099).
 * Idempotent: DELETE + INSERT ersetzt Inhalt und Locales bei wiederholtem Aufruf.
 *
 * Priorität -100 (unter Admin-Standard 0), damit echte / Feature-MOTDs mit getCurrent zuerst kommen.
 *
 * Inhalt synchron mit prisma/migrations/20260327170000_motd_welcome_message/migration.sql
 * und prisma/migrations/20260328103000_motd_welcome_copy_optimize/migration.sql halten.
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
const CONTENT_VERSION = 3;

const markdownDe = `# Willkommen bei arsnova.eu

Schön, dass du da bist! arsnova.eu ist zurück – im neuen Design, mit starken Features und der Zuverlässigkeit, die du von einem erstklassigen Audience-Response-System erwartest.

Wir vereinen das Beste aus frag.jetzt und arsnova.click: Eine moderne, datenschutzkonforme Alternative zu Kahoot oder Mentimeter für interaktive Sessions, Quizze und mehr – barrierearm, mehrsprachig und Made in Germany.

Viel Spaß beim Entdecken – bereit für deine nächste Session?`;

const markdownEn = `# Welcome to arsnova.eu

Great to have you here! arsnova.eu is back – with a fresh look, powerful features, and the reliability you expect from a top-tier audience response system.

We've merged frag.jetzt and arsnova.click into a seamless, privacy-first alternative to Kahoot or Mentimeter. It's your modern platform for interactive sessions and quizzes – fully accessible, multilingual, and secure by design.

Enjoy exploring – and here's to your next session!`;

const markdownFr = `# Bienvenue sur arsnova.eu

Ravi de vous accueillir ! arsnova.eu fait peau neuve : un design moderne, des fonctionnalités inédites et la fiabilité d'un système d'interaction d'excellence.

Le meilleur de frag.jetzt et arsnova.click réuni : une alternative sérieuse à Kahoot ou Mentimeter pour vos sessions interactives et quiz – accessible, multilingue et strictement respectueuse de la protection des données (RGPD).

Bonne découverte – prêt pour votre prochaine session ?`;

const markdownEs = `# Bienvenido a arsnova.eu

¡Qué bueno tenerte por aquí! arsnova.eu ha vuelto con un diseño renovado, funciones avanzadas y la fiabilidad de un sistema de participación de audiencia de primer nivel.

Lo mejor de frag.jetzt y arsnova.click en una sola plataforma: la alternativa a Kahoot o Mentimeter que prioriza la privacidad. Crea sesiones interactivas y cuestionarios de forma accesible, multilingüe y segura.

¡Diviértete descubriendo las novedades y disfruta de tu próxima sesión!`;

const markdownIt = `# Benvenuti su arsnova.eu

È un piacere averti qui! arsnova.eu è tornato: con una veste grafica rinnovata, nuove potenti funzioni e l'affidabilità di un sistema di Audience Response professionale.

Abbiamo unito il meglio di frag.jetzt e arsnova.click in un'unica piattaforma moderna. L'alternativa a Kahoot o Mentimeter focalizzata sulla privacy: per sessioni interattive e quiz – inclusiva, multilingue e sicura.

Buon divertimento nell'esplorare le novità – pronti per la tua prossima sessione?`;

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
