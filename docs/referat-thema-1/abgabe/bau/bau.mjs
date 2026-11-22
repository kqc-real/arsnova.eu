#!/usr/bin/env node
// Bauskript für Jonas' Abgabe: gemeinsames Deck, Folien-PDF, Sprechnotizen, Manifest.
//
//   node bau.mjs [--niklas1 <pdf>] [--niklas2 <pdf>] [--niklas1-stand <text>]
//                [--niklas2-stand <text>] [--ausgabe <ordner>]
//
// Niklas' Teile kommen standardmäßig nativ aus abgabe/bau/ (1A aus seiner Messreihe, 1B 3–4 als
// Gerüst). --niklas1/--niklas2 betten stattdessen die Seiten eines PDFs ein (Rückfallweg).
//
// Das Handout entsteht seit 2026-11-15 in PaperLab (Typ referat, IU-Format nach RL und ZL); Zahlen und
// Abbildungen dafür liefert handout-latex.mjs. Name und Matrikelnummer stehen nur dort (author.ini).
/* global console, document */
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import { parseArgs } from 'node:util';

import { baueDeck } from './deck.mjs';
import { DIAGRAMME, FESTWERTE, NACHWEIS, folien, ladeFolienDaten } from './folien.mjs';
import { niklasSeiten } from './niklas-seiten.mjs';
import { mitNotizen } from './notizen.mjs';
import { baueHeftHtml, baueReferentHtml, heftEintraege, ladeHeft } from './sprechheft.mjs';
import { eingabenNiklas, niklasTeile } from './teile.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HIER, '../..'); // docs/referat-thema-1
const REPO = resolve(ROOT, '../..');
const requireRepo = createRequire(resolve(REPO, 'package.json'));

const STANDARD_AUSGABE = join(HIER, '..');

/** Ergebnis-JSONs, Antwort-Ausschnitt und Belege, aus denen folien.mjs/zahlen.mjs lesen (relativ zu ROOT). */
const DATEN = [
  'evidenz/1B/messung/2026-11-13-lauf.json',
  'evidenz/1B/messung/2026-11-13-lauf-kalt.json',
  'evidenz/1B/messung/2026-11-13-lauf-kalt-2.json',
  'evidenz/1B/messung/2026-11-13-lauf-kalt-3.json',
  'evidenz/1B/messung/2026-11-13-lauf-kalt-4.json',
  'evidenz/1B/messung/2026-11-13-lauf-kalt-5.json',
  'evidenz/1B/messung/2026-11-13-kontrolle-c0.json',
  'evidenz/1B/messung/2026-11-13-lauf-b0.json',
  'evidenz/1B/messung/2026-11-15-abgelehnte-antwort.json',
  'evidenz/1B/messung/2026-11-13-aufbau-von-null.txt',
  'evidenz/1C/messung/2026-11-09-labor-nachlauf.json.gz',
  // Hinweistext des extraktiven Fallbacks für den Nachbau auf J13 (App-Code, nur gelesen)
  '../../apps/backend/src/lib/qaSummaryExtractive.ts',
  '../../apps/frontend/src/app/features/session/session-host/moderation-compass-dialog.component.html',
];

const sha256 = (daten) => createHash('sha256').update(daten).digest('hex');
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const naechsteRelativ = (pfad) => relative(REPO, pfad).split(sep).join('/');

class BauFehler extends Error {}

/** Bedienfehler: wird oben gemeldet (Exit 2); finally-Blöcke laufen vorher durch. */
function fehler(text) {
  throw new BauFehler(text);
}

function pruefePdf(pfad, flag) {
  if (!existsSync(pfad) || !statSync(pfad).isFile()) fehler(`${flag}: ${pfad} nicht gefunden.`);
  if (readFileSync(pfad).subarray(0, 5).toString('latin1') !== '%PDF-') {
    fehler(`${flag}: ${pfad} ist kein PDF.`);
  }
}

/** Lädt eine Repo-Abhängigkeit mit klarer Fehlermeldung statt rohem Stacktrace. */
function ladeAbhaengigkeit(name) {
  try {
    return requireRepo(name);
  } catch (e) {
    fehler(
      `Abhängigkeit „${name}“ nicht ladbar (${e.code ?? e.message}). ` +
        'Im Repo „npm ci“ ausführen, für Playwright außerdem „npx playwright install chromium“.',
    );
  }
}

/**
 * Redebudget je Person = Abbruchgrenze. Seit 2026-11-16 (Entscheidung der Autoren, ersetzt die Absprache vom
 * selben Tag mit 10:30 min) plant jede Person 15 min Redezeit samt ihrem Anteil an den Rahmenfolien; die
 * Fragen kommen hinzu.
 */
const ABBRUCH_S = 15 * 60;
const BUDGET_S = ABBRUCH_S;

/**
 * Sprungplan für einen Abbruch nach 15:00 min: Die Zielfolien (Jonas J13 und J15, Niklas N10, 1B 3–4,
 * G9 und GD) müssen gesprochen sein. Gezählt wird nur die eigene Redezeit ab der ersten eigenen Folie
 * (Stoppuhr beim ersten Satz, angehalten, solange die andere Person spricht); spätester Sprung = 15:00 minus
 * die Zeit der Zielfolien.
 * @param {object[]} haupt eigene Hauptfolien in Vortragsreihenfolge
 * @param {string[]} ziele Kennungen, die gesprochen sein müssen (in Reihenfolge)
 * @param {string} [pause] Hinweis, wenn die eigene Redezeit unterbrochen ist
 */
function sprungplan(haupt, ziele, pause) {
  const zielFolien = haupt.filter((f) => ziele.includes(f.id));
  if (zielFolien.length !== ziele.length) throw new Error(`Sprungplan: ${ziele.join(', ')} fehlen`);
  const zielS = zielFolien.reduce((s, f) => s + f.zeitS, 0);
  const erstes = ziele[0];
  const start = haupt
    .slice(
      0,
      haupt.findIndex((f) => f.id === erstes),
    )
    .reduce((s, f) => s + f.zeitS, 0);
  const spaetestens = ABBRUCH_S - zielS;
  const gesamt = haupt.reduce((s, f) => s + f.zeitS, 0);
  const kurz = haupt.filter((f) => f.kurzfassung).reduce((s, f) => s + f.zeitS, 0);
  const zielText =
    ziele.length === 2 ? `${ziele[0]} und ${ziele[1]}` : `${ziele[0]} bis ${ziele.at(-1)}`;
  const puffer = spaetestens - start;
  const zeilen = [
    '## Sprungplan',
    '',
    `Geplant: ${mmss(gesamt)} min (Grenze ${mmss(ABBRUCH_S)} min), ab der ersten Folie (${haupt[0].id}) gezählt. ` +
      `${erstes} beginnt im Plan bei ${mmss(start)} min; ${zielText} brauchen zusammen ${mmss(zielS)} min. ` +
      (puffer > 0
        ? `Bis ${mmss(spaetestens)} min bleiben ${mmss(puffer)} min Puffer. `
        : 'Der Plan hat keinen Puffer. ') +
      `Wer bei ${mmss(spaetestens)} min noch vor ${erstes} steht, blättert mit Pfeil rechts ohne Kommentar bis ${erstes} ` +
      `und spricht ab dort weiter. Bei Zeitdruck von Anfang an nur die Folien mit der Marke „Kurzfassung“ ` +
      `(${mmss(kurz)} min); sie enthält ${zielText}.` +
      (pause ? ` ${pause}` : ''),
  ];
  if (gesamt > BUDGET_S) {
    zeilen.push(
      '',
      `**Zeitbudget:** Die Langfassung dauert ${mmss(gesamt)} min und liegt über dem Budget von etwa ${mmss(BUDGET_S)} min. ` +
        `Bis gekürzt ist, gilt die Kurzfassung (${mmss(kurz)} min) als Vortragsplan.`,
    );
  }
  return [...zeilen, ''];
}

/** Stichpunkte (zum freien Vortrag) als Liste; fehlen sie, bleibt nur der Fließtext. */
function stichpunkteBlock(f) {
  if (!f.stichpunkte?.length) return [];
  return ['**Stichpunkte**', '', ...f.stichpunkte.map((p) => `- ${p}`), '', '**Fließtext**', ''];
}

/**
 * Sprechnotizen: je Folie Kennung, Titel, Sekunden, kumulierte Zeit, Kurzfassung-Marke, Stichpunkte
 * (falls vorhanden) und Fließtext. Ohne Optionen die Fassung für Jonas (mit Sprungplan zu J13/J15).
 * @param {object[]} alle Folien in Vortragsreihenfolge, Reserve beliebig dazwischen
 * @param {{ person?: string, quelle?: string, sprungziele?: string[],
 *   pause?: { nach: string, text: string } }} [o] pause: eigene Redezeit unterbrochen nach Folie `nach`
 */
export function baueSprechnotizen(
  alle,
  { person = 'Jonas', quelle = '`folien.mjs`', sprungziele = ['J13', 'J15'], pause } = {},
) {
  const ohneTags = (s) =>
    s
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  const haupt = alle.filter((f) => f.teil !== 'reserve');
  const reserve = alle.filter((f) => f.teil === 'reserve');
  const gesamt = haupt.reduce((s, f) => s + f.zeitS, 0);
  const kurz = haupt.filter((f) => f.kurzfassung).reduce((s, f) => s + f.zeitS, 0);
  const zeilen = [
    `# Sprechnotizen ${person}`,
    '',
    `Gesamt ${mmss(gesamt)} min, Kurzfassung ${mmss(kurz)} min (Folien mit der Marke „Kurzfassung“). ` +
      `Erzeugt aus ${quelle} (\`notiz\` = Fließtext, \`stichpunkte\`, \`zeitS\`, \`kurzfassung\`); nicht von Hand ändern. ` +
      'Vorgetragen wird aus den Stichpunkten; der Fließtext ist die ausformulierte Fassung zum Üben.',
    '',
    ...(sprungziele?.length ? sprungplan(haupt, sprungziele, pause?.text) : []),
  ];
  let kumuliert = 0;
  let kumuliertKurz = 0;
  for (const f of haupt) {
    kumuliert += f.zeitS;
    if (f.kurzfassung) kumuliertKurz += f.zeitS;
    zeilen.push(
      `## ${f.id} ${ohneTags(f.titel)} (${f.zeitS} s, kumuliert ${mmss(kumuliert)}` +
        `${f.kurzfassung ? `, **Kurzfassung** ${mmss(kumuliertKurz)}` : ''})`,
      '',
      ...stichpunkteBlock(f),
      f.notiz.trim(),
      '',
      `_Quelle:_ ${f.quelle ?? ''}`,
      '',
      ...(pause?.nach === f.id ? [`_Übergabe:_ ${pause.text}`, ''] : []),
    );
  }
  zeilen.push('# Reserve', '', 'Nur auf Nachfrage (Taste `r`), keine Zeit im Vortrag.', '');
  for (const f of reserve) {
    zeilen.push(
      `## ${f.id} ${ohneTags(f.titel)}`,
      '',
      ...stichpunkteBlock(f),
      f.notiz.trim(),
      '',
      `_Quelle:_ ${f.quelle}`,
      '',
    );
  }
  return zeilen.join('\n');
}

/** Niklas' Zielfolien für den Sprungplan: N10 (Entscheidung 1A), 1B 3–4, G9 (Fazit) und GD (Fragen). */
export function sprungzieleNiklas(alle, niklas) {
  const teil2 = (niklas.teil2 ?? []).filter(
    (f) => typeof f === 'object' && f.teil !== 'reserve' && !f.anhang,
  );
  return [
    'N10',
    ...teil2.map((f) => f.id),
    ...alle.filter((f) => ['G9', 'GD'].includes(f.id)).map((f) => f.id),
  ];
}

/**
 * Unterbrechung in Niklas' Redezeit: Nach seiner letzten 1A-Folie spricht Jonas J1–J15 (ohne J16).
 * @returns {{ nach: string, text: string }}
 */
export function pauseNiklas(alle, niklas) {
  const teil1 = (niklas.teil1 ?? []).filter(
    (f) => typeof f === 'object' && f.teil !== 'reserve' && !f.anhang,
  );
  const jonas = alle.filter((f) => f.teil === 'jonas' && !f.anhang);
  const s = jonas.reduce((x, f) => x + f.zeitS, 0);
  const nach = teil1.at(-1)?.id ?? 'N10';
  return {
    nach,
    text:
      `Nach ${nach} spricht Jonas (${jonas[0].id}–${jonas.at(-1).id}, etwa ${mmss(s)} min); ` +
      'die Uhr für den Sprungplan läuft nur während der eigenen Folien.',
  };
}

const htmlEsc = (t) =>
  String(t).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );

/**
 * Sprechkarten zum Ausdrucken (A4, eine Person): je Folie Kennung, Sekunden, Startzeit, Kurzfassung-Marke,
 * Titel und nur die Stichpunkte (Leitfaden F26: vorgetragen wird aus Stichworten). „[Weiter]“ und
 * „[Taste …]“ fett. Der Fließtext steht in den Sprechnotizen (Markdown).
 * @param {object[]} alle Folien der Person, Reserve beliebig dazwischen
 * @param {{ person: string, schriften: string, pause?: { nach: string, text: string } }} o
 *   schriften: @font-face-Regeln (eingebettet); pause: Übergabe an die andere Person nach Folie `nach`
 */
export function baueSprechkarten(alle, { person, schriften, pause }) {
  const ohneTags = (t) =>
    t
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  const haupt = alle.filter((f) => f.teil !== 'reserve' && f.zeitS > 0);
  const reserve = alle.filter((f) => f.teil === 'reserve');
  const gesamt = haupt.reduce((x, f) => x + f.zeitS, 0);
  const kurz = haupt.filter((f) => f.kurzfassung).reduce((x, f) => x + f.zeitS, 0);
  const punkt = (p) =>
    `<li>${htmlEsc(p).replace(/^\[(Weiter|Taste[^\]]*)\]/, (m) => `<b class="weiter">${m}</b>`)}</li>`;
  let start = 0;
  const karte = (f, mitZeit) => {
    const kopf = mitZeit
      ? `<span class="id">${f.id}</span> <span class="zeit">${f.zeitS} s · ab ${mmss(start)}${f.kurzfassung ? ' · <b>K</b>' : ''}</span>`
      : `<span class="id">${f.id}</span>`;
    if (mitZeit) start += f.zeitS;
    const punkte = f.stichpunkte?.length
      ? `<ul>${f.stichpunkte.map(punkt).join('')}</ul>`
      : `<p class="ohne">${htmlEsc(ohneTags(f.notiz))}</p>`;
    const uebergabe =
      mitZeit && pause?.nach === f.id ? `<p class="pause">${htmlEsc(pause.text)}</p>` : '';
    return `<section class="karte"><h2>${kopf}</h2><h3>${htmlEsc(ohneTags(f.titel))}</h3>${punkte}</section>${uebergabe}`;
  };
  return (
    '<!doctype html><html lang="de"><head><meta charset="utf-8">' +
    `<title>Sprechkarten ${htmlEsc(person)}</title><style>${schriften}` +
    '@page{size:A4;margin:14mm 14mm 16mm}' +
    "body{margin:0;font-family:'Inter',Arial,sans-serif;font-size:10.5pt;line-height:1.35;color:#16202c}" +
    'h1{font-size:15pt;margin:0 0 2mm;color:#0b5ea8}.kopf{margin:0 0 5mm;color:#3d4757}' +
    '.spalten{columns:2;column-gap:8mm}' +
    '.karte{break-inside:avoid;border-left:1.2mm solid #c9d2de;padding:0 0 0 3mm;margin:0 0 4.5mm}' +
    "h2{margin:0;font-size:9pt;font-weight:600;font-family:'IBM Plex Mono',monospace;color:#566173}" +
    'h2 .id{color:#0b5ea8}h3{margin:0.5mm 0 1mm;font-size:10.5pt;font-weight:700}' +
    'ul{margin:0;padding-left:4.5mm}li{margin:0 0 0.8mm}.weiter{color:#0b5ea8}' +
    '.ohne{margin:0;color:#3d4757}h1.reserve{margin-top:6mm;break-before:column}' +
    '.pause{break-inside:avoid;margin:0 0 4.5mm;padding:1.5mm 3mm;border:0.4mm dashed #c9d2de;color:#3d4757;font-style:italic}' +
    '</style></head><body>' +
    `<h1>Sprechkarten ${htmlEsc(person)}</h1>` +
    `<p class="kopf">Gesamt ${mmss(gesamt)} min · Kurzfassung (K) ${mmss(kurz)} min · „ab“ = Startzeit in der Langfassung · Fließtext und Sprungplan: Sprechnotizen</p>` +
    `<div class="spalten">${haupt.map((f) => karte(f, true)).join('')}` +
    (reserve.length
      ? `<h1 class="reserve">Reserve (Taste r)</h1>${reserve.map((f) => karte(f, false)).join('')}`
      : '') +
    '</div></body></html>'
  );
}

/**
 * Folien, die Niklas spricht, in Vortragsreihenfolge: GT und G0 (Titel, Fahrplan), 1A, 1B 3–4, G9 und GD
 * (Fazit, Dank), dann seine Reserve; ohne Literatur.
 */
export function folienNiklas(alle, niklas) {
  const eigene = [...(niklas.teil1 ?? []), ...(niklas.teil2 ?? [])].filter(
    (f) => typeof f === 'object' && !f.anhang,
  );
  const rahmen = alle.filter((f) => f.sprecher === 'niklas');
  const vorn = rahmen.filter((f) => ['GT', 'G0', 'GK'].includes(f.id));
  const hinten = rahmen.filter((f) => !vorn.includes(f));
  return [
    ...vorn,
    ...eigene.filter((f) => f.teil !== 'reserve'),
    ...hinten,
    ...eigene.filter((f) => f.teil === 'reserve'),
  ];
}

/** Folien, die Jonas spricht: alles aus folien() außer den Rahmenfolien, die Niklas spricht. */
export const folienJonas = (alle) => alle.filter((f) => f.sprecher !== 'niklas');

export async function drucke(browser, url, pdfPfad) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  try {
    await page.goto(url); // frisch geladen, damit J10 beim Druck im Endzustand startet
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: 'print' });
    // deck.js setzt J10 beim Wechsel in den Druckmodus auf die letzte Zoomstufe; das change-Ereignis
    // kommt asynchron, daher auf den Endzustand warten statt auf eine feste Zeit.
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('.folie[data-zoom-stufen]')].every(
          (s) => s.dataset.zoomFertig === String(JSON.parse(s.dataset.zoomStufen).length - 1),
        ),
      undefined,
      { timeout: 10_000 },
    );
    await page.pdf({ path: pdfPfad, preferCSSPageSize: true, printBackground: true });
  } finally {
    await page.close();
  }
}

async function pdfInfo(pfad) {
  const { PDFParse } = ladeAbhaengigkeit('pdf-parse');
  const p = new PDFParse({ data: new Uint8Array(readFileSync(pfad)) });
  try {
    const seiten = (await p.getInfo()).total;
    const text = (await p.getText()).text;
    return { seiten, text };
  } finally {
    await p.destroy();
  }
}

function alleDateien(ordner) {
  return readdirSync(ordner, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name))
    .sort();
}

async function main() {
  const { values: o } = parseArgs({
    options: {
      niklas1: { type: 'string' },
      niklas2: { type: 'string' },
      'niklas1-stand': { type: 'string' },
      'niklas2-stand': { type: 'string' },
      ausgabe: { type: 'string' },
      privat: { type: 'string' },
    },
  });
  const ausgabe = resolve(o.ausgabe ?? STANDARD_AUSGABE);
  // Vortragsunterlagen (Deck mit Referentenansicht, Notizen, Karten, Hefte) gehören nicht zur Abgabe:
  // standardmäßig in den von Git ignorierten Ordner privat/ausgabe, bei --ausgabe daneben unter privat/.
  const privatAusgabe = resolve(
    o.privat ?? (o.ausgabe ? join(ausgabe, 'privat') : join(ROOT, 'privat', 'ausgabe')),
  );
  const { chromium } = ladeAbhaengigkeit('playwright');
  ladeAbhaengigkeit('pdf-parse');
  const { format, resolveConfig } = ladeAbhaengigkeit('prettier');
  const formatierung = (await resolveConfig(join(REPO, 'package.json'))) ?? {};

  // Niklas' Teile: standardmäßig nativ (abgabe/bau/); ein angegebenes PDF ersetzt den Teil
  // (Rückfallweg). Ausdrücklich angegebene PDFs müssen existieren und eingebettet werden können.
  const niklasQuellen = { teil1: null, teil2: null };
  if (o.niklas1) pruefePdf(o.niklas1, '--niklas1');
  if (o.niklas2) pruefePdf(o.niklas2, '--niklas2');
  if (o.niklas1) niklasQuellen.teil1 = { pfad: o.niklas1, stand: o['niklas1-stand'] };
  if (o.niklas2) niklasQuellen.teil2 = { pfad: o.niklas2, stand: o['niklas2-stand'] };

  // Clip für J13 mit Angaben (medien/clip.json: Datum, Profil, Zeiten) und Standbild für das PDF.
  const clip = join(HIER, 'medien/clip.webm');
  const clipJson = join(HIER, 'medien/clip.json');
  const standbild = join(HIER, 'medien/clip-standbild.png');
  const mitClip = existsSync(clip);
  const festeEingaben = [
    ...DATEN.map((p) => join(ROOT, p)),
    // Abb. 1 und 2 aus 1C/1C-diagrams.md (R15, R16)
    ...Object.values(DIAGRAMME).map(([p]) => join(ROOT, p)),
    // Kopfzahlen des Nachweisumfangs (GD)
    join(ROOT, NACHWEIS),
    ...[...new Set(Object.values(FESTWERTE).map((f) => f.quelle))]
      .map((p) => join(ROOT, p))
      .filter((p) => existsSync(p)),
    ...readdirSync(HIER)
      .filter((n) => /\.(mjs|js|css|html)$/.test(n) && !n.endsWith('.test.mjs'))
      .map((n) => join(HIER, n)),
    ...alleDateien(join(HIER, 'schriften')),
    ...(mitClip ? [clip, clipJson, standbild] : []),
    ...eingabenNiklas(ROOT),
  ];
  const fehlend = festeEingaben.filter((p) => !existsSync(p));
  if (fehlend.length) {
    fehler(`Eingaben fehlen: ${fehlend.map((p) => naechsteRelativ(p)).join(', ')}`);
  }

  const arbeit = mkdtempSync(join(tmpdir(), 'jonas-bau-'));
  try {
    const daten = ladeFolienDaten(ROOT);
    const alle = folien(daten);
    const niklas = niklasTeile(ROOT);
    for (const [teil, flag, ziel] of [
      ['teil1', '--niklas1', 'n1'],
      ['teil2', '--niklas2', 'n2'],
    ]) {
      if (!niklasQuellen[teil]) continue;
      niklas[teil] = await niklasSeiten(niklasQuellen[teil].pfad, join(arbeit, ziel));
      if (niklas[teil].length === 0) {
        fehler(`${flag}: Seiten von ${niklasQuellen[teil].pfad} nicht einbettbar (pdftoppm?).`);
      }
    }
    // Sprechheft je Person und Referentenansicht (alle Folien) aus denselben Foliendaten
    const heft = ladeHeft(ROOT);
    const heftJonas = heftEintraege(folienJonas(alle), heft);
    const anhangNiklas = [...(niklas.teil1 ?? []), ...(niklas.teil2 ?? [])].filter(
      (f) => typeof f === 'object' && f.anhang,
    );
    const listeNiklas = folienNiklas(alle, niklas);
    const ersteReserve = listeNiklas.findIndex((f) => f.teil === 'reserve');
    listeNiklas.splice(ersteReserve < 0 ? listeNiklas.length : ersteReserve, 0, ...anhangNiklas);
    const heftNiklas = heftEintraege(listeNiklas, heft);
    const deckOptionen = {
      niklas,
      ...(mitClip ? { clip, clipInfo: JSON.parse(readFileSync(clipJson, 'utf8')), standbild } : {}),
      eingebettet: true,
    };
    // Öffentliches Deck ohne Sprechheft; das Vortragsdeck (privat) trägt die Referentenansicht (Taste n).
    const rohHtml = baueDeck(alle, deckOptionen);
    // Gemeinsames Heft und Referentenansicht in Vortragsreihenfolge des Decks, Zeit über den ganzen Vortrag
    const folieNachId = new Map([...listeNiklas, ...folienJonas(alle)].map((f) => [f.id, f]));
    const reihenfolge = [
      ...new Set(
        [...rohHtml.matchAll(/<section[^>]*class="folie[^"]*"[^>]*data-id="([^"]+)"/g)].map(
          (m) => m[1],
        ),
      ),
    ];
    const ohneFolie = reihenfolge.filter((id) => !folieNachId.has(id));
    if (ohneFolie.length)
      throw new Error(`Gemeinsames Sprechheft: Folien ohne Daten: ${ohneFolie.join(', ')}`);
    const heftGesamt = heftEintraege(
      reihenfolge.filter((id) => folieNachId.has(id)).map((id) => folieNachId.get(id)),
      heft,
    );
    const rohVortrag = baueDeck(alle, {
      ...deckOptionen,
      referent: baueReferentHtml(heftGesamt),
    });
    // Wie der Pre-commit-Hook formatieren, bevor gehasht wird, damit das Manifest stimmen bleibt.
    const html = await format(rohHtml, { ...formatierung, parser: 'html' });
    // Ab hier wird geschrieben: ein altes Manifest darf nie zu neuen Ausgaben stehen.
    mkdirSync(ausgabe, { recursive: true });
    rmSync(join(ausgabe, 'manifest.json'), { force: true });
    const deckPfad = join(ausgabe, 'folien-gesamt.html');
    writeFileSync(deckPfad, html);
    // Ohne privat/notizen.mjs entstehen nur die Abgabedateien.
    if (mitNotizen) {
      mkdirSync(privatAusgabe, { recursive: true });
      writeFileSync(join(privatAusgabe, 'folien-gesamt-mit-notizen.html'), rohVortrag);
    }

    const browser = await chromium.launch();
    try {
      await drucke(browser, pathToFileURL(deckPfad).href, join(ausgabe, 'folien-gesamt.pdf'));
      await drucke(
        browser,
        `${pathToFileURL(deckPfad).href}?druck=jonas`,
        join(ausgabe, 'folien-jonas.pdf'),
      );
      await drucke(
        browser,
        `${pathToFileURL(deckPfad).href}?druck=niklas`,
        join(ausgabe, 'folien-niklas.pdf'),
      );
    } finally {
      await browser.close();
    }

    if (mitNotizen) {
      // Sprechkarten (nur Stichpunkte) je Person zum Ausdrucken, Schriften wie im Deck eingebettet.
      const schriften = (
        readFileSync(join(HIER, 'stil.css'), 'utf8').match(/@font-face\s*\{[^}]*\}/g) ?? []
      )
        .join('')
        .replace(
          /url\('(schriften\/[^']+\.woff2)'\)/g,
          (_, pfad) =>
            `url('data:font/woff2;base64,${readFileSync(join(HIER, pfad)).toString('base64')}')`,
        );
      const kartenBrowser = await chromium.launch();
      try {
        for (const [datei, person, liste, pause] of [
          ['notizen-karten-jonas.pdf', 'Jonas', folienJonas(alle)],
          [
            'notizen-karten-niklas.pdf',
            'Niklas',
            folienNiklas(alle, niklas),
            pauseNiklas(alle, niklas),
          ],
        ]) {
          const seite = await kartenBrowser.newPage();
          try {
            await seite.setContent(baueSprechkarten(liste, { person, schriften, pause }));
            await seite.evaluate(() => document.fonts.ready);
            await seite.pdf({ path: join(privatAusgabe, datei), preferCSSPageSize: true });
          } finally {
            await seite.close();
          }
        }
      } finally {
        await kartenBrowser.close();
      }

      writeFileSync(
        join(privatAusgabe, 'notizen-jonas.md'),
        await format(baueSprechnotizen(folienJonas(alle)), { ...formatierung, parser: 'markdown' }),
      );
      writeFileSync(
        join(privatAusgabe, 'notizen-niklas.md'),
        await format(
          baueSprechnotizen(folienNiklas(alle, niklas), {
            person: 'Niklas',
            quelle:
              '`abgabe/bau/folien-1a.mjs`, `folien-1b34.mjs` und GT, G0, G9, GD in `folien.mjs`',
            sprungziele: sprungzieleNiklas(alle, niklas),
            pause: pauseNiklas(alle, niklas),
          }),
          { ...formatierung, parser: 'markdown' },
        ),
      );

      // Kein Datum im Heft: der Stand steht im Manifest (Eingaben mit SHA-256), der Bau bleibt reproduzierbar
      const stand = 'siehe manifest.json';
      for (const [datei, person, eintraege, zeitBezug] of [
        ['notizen-heft-jonas.html', 'Jonas', heftJonas, 'eigener Teil'],
        ['notizen-heft-niklas.html', 'Niklas', heftNiklas, 'eigener Teil'],
        ['notizen-heft-gesamt.html', 'Jonas und Niklas', heftGesamt, 'gesamt'],
      ]) {
        writeFileSync(
          join(privatAusgabe, datei),
          await format(baueHeftHtml(eintraege, { person, stand, zeitBezug }), {
            ...formatierung,
            parser: 'html',
          }),
        );
      }
    }

    // Manifest: Eingaben (Daten, Vorlagen, Module, Schriften, Niklas-PDFs) und Ausgaben mit SHA-256.
    const eingaben = [
      ...festeEingaben,
      ...Object.values(niklasQuellen)
        .filter(Boolean)
        .map((q) => q.pfad),
    ];
    const eingabeEintrag = (p) => {
      const inRepo = resolve(p).startsWith(REPO + sep);
      return {
        pfad: inRepo ? naechsteRelativ(p) : `extern/${p.split(sep).pop()}`,
        sha256: sha256(readFileSync(p)),
      };
    };
    const ausgaben = [];
    for (const datei of [
      'folien-gesamt.html',
      'folien-gesamt.pdf',
      'folien-jonas.pdf',
      'folien-niklas.pdf',
    ]) {
      const p = join(ausgabe, datei);
      const daten_ = readFileSync(p);
      const e = { datei, bytes: daten_.length, sha256: sha256(daten_) };
      if (datei.endsWith('.pdf')) {
        const info = await pdfInfo(p);
        e.seiten = info.seiten;
      }
      ausgaben.push(e);
    }
    const nikEintrag = (q) =>
      q
        ? {
            quelle: `Datei ${q.pfad.split(sep).pop()}`,
            stand: q.stand ?? 'nicht angegeben',
            sha256: sha256(readFileSync(q.pfad)),
          }
        : {
            quelle: 'nativ: abgabe/bau/ (folien-1a.mjs, folien-1b34.mjs)',
            stand: null,
            sha256: null,
          };
    const manifest = {
      schemaVersion: 1,
      bauskript: 'docs/referat-thema-1/abgabe/bau/bau.mjs',
      niklas: { teil1: nikEintrag(niklasQuellen.teil1), teil2: nikEintrag(niklasQuellen.teil2) },
      folien: {
        gemeinsamesDeck: ausgaben.find((a) => a.datei === 'folien-gesamt.pdf').seiten,
        jonasUndReserve: ausgaben.find((a) => a.datei === 'folien-jonas.pdf').seiten,
        niklasUndReserve: ausgaben.find((a) => a.datei === 'folien-niklas.pdf').seiten,
      },
      eingaben: eingaben.map(eingabeEintrag),
      ausgaben,
    };
    writeFileSync(
      join(ausgabe, 'manifest.json'),
      await format(JSON.stringify(manifest), { ...formatierung, parser: 'json' }),
    );

    for (const a of ausgaben) {
      console.log(
        `${a.datei}: ${(a.bytes / 1024).toFixed(0)} KiB${a.seiten ? `, ${a.seiten} Seiten` : ''}`,
      );
    }
    console.log(`Ausgabe: ${ausgabe}; Handout: PaperLab (./paperlab check|final)`);
    console.log(
      mitNotizen
        ? `Vortragsunterlagen (lokal): ${privatAusgabe} (folien-gesamt-mit-notizen.html mit Taste n, Sprechhefte, Notizen, Karten)`
        : 'Vortragsunterlagen: übersprungen, privat/notizen.mjs fehlt',
    );
  } finally {
    rmSync(arbeit, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (e) {
    if (!(e instanceof BauFehler)) throw e;
    console.error(`bau.mjs: ${e.message}`);
    process.exit(2);
  }
}
