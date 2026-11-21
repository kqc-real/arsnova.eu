// Lokaler Abgabeschritt: setzt die Matrikelnummern der Gruppe in den Platz auf der Titelfolie (GT) und
// erzeugt daraus das Vortragsdeck und die Folien-PDFs der Abgabe. Die Nummern stehen nur in
// abgabe-lokal.json, die Ergebnisse nur in abgabe-lokal/ (beides per .gitignore ausgeschlossen); das Repo
// und ausgabe/ bleiben ohne Matrikelnummer (Prüfungsdokument 3: Name und Matrikelnummer je Einreichung;
// Regel des Referats: keine Matrikelnummer im Repo).
//
// CLI: node abgabe-lokal.mjs   (vorher bau.mjs; abgabe-lokal.json nach abgabe-lokal.beispiel.json anlegen)
// Ausgaben in abgabe-lokal/: jonas-deck.html (zum Vortragen), jonas-folien.pdf, niklas-folien.pdf,
// gemeinsames-deck.pdf.
/* global console, process -- Node-Skript */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { drucke } from './bau.mjs';
import { MATRIKEL_VERMERK } from './folien.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/** Prüft die Gruppe aus abgabe-lokal.json: je Person Name und eine Matrikelnummer aus Ziffern. */
export function pruefeGruppe(gruppe) {
  if (!Array.isArray(gruppe) || gruppe.length === 0) throw new Error('gruppe fehlt oder ist leer');
  for (const p of gruppe) {
    if (!p.name || !/^\d+$/.test(String(p.matrikel ?? ''))) {
      throw new Error(`Matrikelnummer fehlt oder ist ungültig für ${p.name ?? '?'}`);
    }
  }
  return gruppe;
}

const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Setzt je Person „Matrikelnummer n“ in den Platz data-matrikel="<Name>" der Titelfolie. Bricht ab, wenn
 * ein Name keinen Platz hat oder nach dem Füllen noch ein Platz mit dem Vermerk übrig ist.
 * @param {string} html gebautes Deck (ausgabe/jonas-deck.html)
 * @param {{ name: string, matrikel: string }[]} gruppe
 */
export function fuelleMatrikel(html, gruppe) {
  let aus = html;
  for (const p of pruefeGruppe(gruppe)) {
    const platz = new RegExp(
      `(<p\\b[^>]*\\bdata-matrikel="${reEsc(p.name)}")([^>]*)>\\s*${reEsc(MATRIKEL_VERMERK)}\\s*</p>`,
      'g',
    );
    let treffer = 0;
    aus = aus.replace(platz, (_, kopf, rest) => {
      treffer += 1;
      return `${kopf}${rest} data-gefuellt>Matrikelnummer ${p.matrikel}</p>`;
    });
    if (treffer !== 1) {
      throw new Error(`Platz für die Matrikelnummer von ${p.name}: ${treffer} statt 1 gefunden`);
    }
  }
  if (aus.includes(MATRIKEL_VERMERK)) {
    throw new Error('Titelfolie: ein Platz für eine Matrikelnummer blieb leer');
  }
  return aus;
}

/** Seiten (1-basiert), deren Text noch einen Entwurfsmarker oder Platzhalter trägt. */
export async function entwurfsSeiten(pdfBytes) {
  const { PDFParse } = require('pdf-parse');
  const p = new PDFParse({ data: new Uint8Array(pdfBytes) });
  try {
    const { pages } = await p.getText();
    return pages
      .filter((s) => /Entwurf|\[Niklas\]|\[Satz|\[Titel\]/.test(s.text))
      .map((s) => s.num);
  } finally {
    await p.destroy?.();
  }
}

/** Text einer PDF-Seite (1-basiert), für die Kontrolle der eingesetzten Nummern. */
async function seitenText(pdfBytes, nr) {
  const { PDFParse } = require('pdf-parse');
  const p = new PDFParse({ data: new Uint8Array(pdfBytes) });
  try {
    return (await p.getText()).pages.find((s) => s.num === nr)?.text ?? '';
  } finally {
    await p.destroy?.();
  }
}

function istIgnoriert(pfad) {
  try {
    execFileSync('git', ['check-ignore', '-q', pfad], { cwd: HIER });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const eingabe = join(HIER, 'abgabe-lokal.json');
  const ziel = join(HIER, 'abgabe-lokal');
  if (!existsSync(eingabe)) {
    throw new Error('abgabe-lokal.json fehlt (Vorlage: abgabe-lokal.beispiel.json)');
  }
  for (const p of [eingabe, join(ziel, 'x.pdf'), join(ziel, 'x.html')]) {
    if (!istIgnoriert(p)) throw new Error(`${p} ist nicht von Git ignoriert, Abbruch`);
  }
  const { gruppe } = JSON.parse(readFileSync(eingabe, 'utf8'));
  const quelle = join(HIER, 'ausgabe', 'jonas-deck.html');
  if (!existsSync(quelle)) throw new Error(`${quelle} fehlt, erst bau.mjs ausführen`);
  mkdirSync(ziel, { recursive: true });
  const deck = join(ziel, 'jonas-deck.html');
  writeFileSync(deck, fuelleMatrikel(readFileSync(quelle, 'utf8'), gruppe));
  console.log(`erzeugt: ${deck}`);

  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    for (const [name, druck] of [
      ['gemeinsames-deck.pdf', ''],
      ['jonas-folien.pdf', '?druck=jonas'],
      ['niklas-folien.pdf', '?druck=niklas'],
    ]) {
      const pdf = join(ziel, name);
      await drucke(browser, `${pathToFileURL(deck).href}${druck}`, pdf);
      const bytes = readFileSync(pdf);
      const entwurf = await entwurfsSeiten(bytes);
      if (entwurf.length) {
        throw new Error(
          `${name}: Entwurfsmarker auf Seite ${entwurf.join(', ')}, so nicht abgeben`,
        );
      }
      // Seite 1 jedes PDFs ist die Titelfolie mit allen Namen und Nummern.
      const titel = (await seitenText(bytes, 1)).replace(/\s+/g, ' ');
      for (const p of gruppe) {
        if (!titel.includes(`Matrikelnummer ${p.matrikel}`)) {
          throw new Error(`${name}: Matrikelnummer von ${p.name} fehlt auf Seite 1`);
        }
      }
      console.log(`erzeugt: ${pdf}`);
    }
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await main();
}
