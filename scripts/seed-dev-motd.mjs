#!/usr/bin/env node
/**
 * Legt die dauerhafte Willkommens-MOTD an (feste ID, lang gültig bis Ende 2099).
 * Idempotent: DELETE + INSERT ersetzt Inhalt und Locales bei wiederholtem Aufruf.
 *
 * Priorität -100 (unter Admin-Standard 0), damit echte / Feature-MOTDs mit getCurrent zuerst kommen.
 *
 * Text-Updates für bestehende DBs: prisma/migrations/20260329120000_motd_welcome_copy_v4/migration.sql
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
const CONTENT_VERSION = 4;

const markdownDe = `# Willkommen bei arsnova.eu

Schön, dass du da bist! arsnova.eu ist zurück – im neuen Design, mit smarten Features und der gewohnten Zuverlässigkeit eines erstklassigen Audience-Response-Systems.

Der Name ist Programm: ARS steht für Audience Response System, nova für das Neue. Als Pioniere seit 2012 vereinen wir das Beste aus frag.jetzt und arsnova.click. Ob Grundschule, Uni, Event oder Business: Wir sind die moderne, DSGVO-konforme Antwort auf Kahoot oder Mentimeter – barrierearm, mehrsprachig und Made in Europe – arsnova.eu.

Viel Spaß beim Entdecken – bereit für deine nächste Session?`;

const markdownEn = `# Welcome to arsnova.eu

Great to have you here! arsnova.eu is back – featuring a fresh look, powerful features, and the reliability you expect from a top-tier Audience Response System.

The name says it all: ARS for Audience Response System, nova for the new. As pioneers since 2012, we've merged frag.jetzt and arsnova.click to define the "new art" of interaction. From primary schools and universities to corporate events and business: we are your privacy-first alternative to Kahoot or Mentimeter – fully accessible, multilingual, and Made in Europe – arsnova.eu.

Enjoy exploring – and here's to your next session!`;

const markdownFr = `# Bienvenue sur arsnova.eu

Ravi de vous accueillir ! arsnova.eu fait peau neuve : un design moderne, des fonctionnalités inédites et la fiabilité d'un système d'interaction d'excellence.

Notre nom est notre mission : ARS pour Audience Response System, nova pour le renouveau. Pionniers depuis 2012, nous créons « l'art nouveau » de l'interaction numérique. De l'école primaire à l'université, des événements au monde de l'entreprise : découvrez l'alternative souveraine à Kahoot ou Mentimeter – accessible, multilingue et Made in Europe – arsnova.eu.

Bonne découverte – prêt pour votre prochaine session ?`;

const markdownEs = `# Bienvenido a arsnova.eu

¡Qué bueno tenerte por aquí! arsnova.eu ha vuelto con un diseño renovado, funciones avanzadas y la fiabilidad de un sistema de participación de primer nivel.

Nuestro nombre lo explica todo: ARS (Audience Response System) y nova (nuevo). Pioneros desde 2012, lideramos el "nuevo arte" de la interacción digital. Desde la escuela primaria hasta la universidad, eventos o empresas: somos la alternativa moderna a Kahoot o Mentimeter que prioriza la privacidad – accesible, multilingüe y Made in Europe – arsnova.eu.

¡Diviértete descubriendo las novedades y disfruta de tu próxima sesión!`;

const markdownIt = `# Benvenuti su arsnova.eu

È un piacere averti qui! arsnova.eu è tornato: con una veste grafica rinnovata, nuove potenti funzioni e l'affidabilità di un sistema professionale.

Il nome dice tutto: ARS per Audience Response System, nova per il nuovo. Pionieri dal 2012, innoviamo l'interazione unendo il meglio di frag.jetzt e arsnova.click. Dalla scuola primaria all'università, dagli eventi al business: l'alternativa moderna a Kahoot o Mentimeter che protegge i tuoi dati – inclusiva, multilingue e Made in Europe – arsnova.eu.

Buon divertimento – pronti per la tua prossima sessione?`;

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
