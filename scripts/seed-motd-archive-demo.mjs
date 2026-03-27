#!/usr/bin/env node
/**
 * Legt 6 beendete MOTDs mit visibleInArchive an (Demo: Archiv-Scroll, Sortierung).
 * Feste IDs — bei erneutem Aufruf werden diese Zeilen ersetzt.
 *
 *   DATABASE_URL=… node scripts/seed-motd-archive-demo.mjs
 *   npm run seed:motd-archive-demo
 */
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const DEFAULT_DATABASE_URL =
  'postgresql://arsnova_user:secretpassword@localhost:5432/arsnova_v3_dev?schema=public';

/** Sortierung im UI: endsAt desc — neuestes Ende oben */
const DEMO_IDS = [
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb001',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb003',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb004',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb005',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb006',
];

function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(23, 59, 0, 0);
  return d;
}

function daysAgoRange(endDaysAgo, spanDays) {
  const ends = daysAgo(endDaysAgo);
  const starts = new Date(ends.getTime() - spanDays * 24 * 60 * 60 * 1000);
  starts.setUTCHours(0, 0, 0, 0);
  return { startsAt: starts, endsAt: ends };
}

const demos = [
  {
    id: DEMO_IDS[0],
    priority: 2,
    de: '## Wartung abgeschlossen\n\nDie geplanten Arbeiten an der Infrastruktur sind **beendet**. Danke für deine Geduld.\n\n- Alle Dienste wieder verfügbar\n- Bei Auffälligkeiten: Support',
    en: '## Maintenance complete\n\nPlanned infrastructure work has **finished**. Thanks for your patience.',
  },
  {
    id: DEMO_IDS[1],
    priority: 0,
    de: '## Neues: Schnellere Sessions\n\nWir haben die Verbindungszeit beim Beitreten verbessert. Probiere es bei der nächsten Veranstaltung aus.',
    en: '## New: Faster sessions\n\nWe improved join latency. Try it at your next event.',
  },
  {
    id: DEMO_IDS[2],
    priority: 1,
    de: '## Hinweis Datenschutz\n\nKurz erinnert: Quiz-Inhalte verlassen deinen Browser nicht ohne deine Aktion. Details in den **Hilfe**-Texten.',
    en: '## Privacy note\n\nQuiz content does not leave your browser without your action. See **Help** for details.',
  },
  {
    id: DEMO_IDS[3],
    priority: 0,
    de: '## Community-Umfrage\n\nWir planen neue Fragetypen. Feedback ist willkommen — bald folgt ein kurzer Fragebogen.',
    en: '## Community survey\n\nWe are planning new question types — a short questionnaire will follow.',
  },
  {
    id: DEMO_IDS[4],
    priority: 0,
    de: '## Längerer Archiv-Testtext\n\nDieser Eintrag ist absichtlich etwas länger, damit du **Scrollen** und Zeilenumbruch im Archiv prüfen kannst.\n\n### Abschnitt\n\n- Punkt eins mit etwas Text\n- Punkt zwei\n- Punkt drei\n\nNoch ein Absatz mit Erklärung, wie sich mehrere Meldungen untereinander verhalten und ob die Karten genug Abstand haben.\n\n> Kurzes Zitat als Stilmittel.\n\nViel Spaß beim Durchscrollen der Liste — oben sollte die **zuletzt beendete** Meldung stehen (`endsAt` absteigend).',
    en: '## Longer archive sample\n\nThis entry is intentionally longer so you can test **scrolling** and line breaks in the archive.\n\n### Section\n\n- First bullet with some text\n- Second\n- Third\n\nAnother paragraph to see spacing between cards.',
  },
  {
    id: DEMO_IDS[5],
    priority: 0,
    de: '## Alte Kurzmeldung\n\nKleiner Hinweis aus früherer Woche (sortiert unten in der Liste).',
    en: '## Old short note\n\nA small hint from an earlier week (should appear near the bottom).',
  },
];

async function main() {
  const connectionString = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    for (const id of DEMO_IDS) {
      await client.query(`DELETE FROM "MotdLocale" WHERE "motdId" = $1`, [id]);
      await client.query(`DELETE FROM "Motd" WHERE id = $1`, [id]);
    }

    const now = new Date();
    /** endsAt: 3, 10, 18, 28, 40, 55 Tage her — klar getrennte Daten für Sortierung */
    const endOffsets = [3, 10, 18, 28, 40, 55];

    for (let i = 0; i < demos.length; i++) {
      const row = demos[i];
      const { startsAt, endsAt } = daysAgoRange(endOffsets[i], 5 + i);

      await client.query(
        `INSERT INTO "Motd" (
          "id", "status", "priority", "startsAt", "endsAt",
          "visibleInArchive", "contentVersion", "templateId",
          "createdAt", "updatedAt"
        ) VALUES ($1, 'ARCHIVED', $2, $3, $4, true, 1, NULL, $5, $5)`,
        [row.id, row.priority, startsAt, endsAt, now],
      );

      const fr = i % 2 === 0 ? row.de : row.en;
      const locales = [
        ['de', row.de],
        ['en', row.en],
        ['fr', fr],
        ['es', row.en],
        ['it', row.en],
      ];

      for (const [locale, md] of locales) {
        await client.query(
          `INSERT INTO "MotdLocale" ("id", "motdId", "locale", "markdown") VALUES ($1, $2, $3, $4)`,
          [randomUUID(), row.id, locale, md],
        );
      }
    }

    console.log(
      `6 Archiv-Demo-MOTDs angelegt (ids bbb…001–006), endsAt: ${endOffsets.map((d) => `${d}d ago`).join(', ')} — neuestes Ende oben.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
