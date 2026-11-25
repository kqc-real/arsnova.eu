// Zahlen und Abbildungen für das LaTeX-Handout in PaperLab (Typ referat).
// Eine Quelle je Zahl: dieselben Werte wie Deck und Folien (handoutWerte über ladeFolienDaten).
// Ausgabe in <zielordner>: zahlen.tex (\newcommand je Wert), abb-weg.pdf, abb-zeit.pdf.
// Abbildungen in Arial wie der Text (Schriftregel RL S. 2); Farbe nur in Abbildungen.
//
// CLI: node handout-latex.mjs <zielordner>   (braucht rsvg-convert und pdffonts)
/* global console, process -- Node-Skript */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ladeFolienDaten } from './folien.mjs';
import { wegSvg, zeitzerlegungSvg } from './grafik.mjs';
import { handoutWerte } from './handout.mjs';
import { fmt } from './zahlen.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HIER, '../..');
const ZIFFERN = [
  'Null',
  'Eins',
  'Zwei',
  'Drei',
  'Vier',
  'Fuenf',
  'Sechs',
  'Sieben',
  'Acht',
  'Neun',
];

/** Makroname aus einem Schlüssel: nur Buchstaben (TeX), Ziffern als Wort. */
export function makroName(schluessel) {
  const s = String(schluessel).replace(/\d/g, (d) => ZIFFERN[Number(d)]);
  if (!/^[A-Za-z]+$/.test(s)) throw new Error(`Schlüssel ${schluessel} ergibt keinen Makronamen`);
  return `z${s[0].toUpperCase()}${s.slice(1)}`;
}

/** Text für TeX maskieren. */
export function texEsc(text) {
  return String(text).replace(/[\\{}$&#%_^~]/g, (c) =>
    c === '\\' ? '\\textbackslash{}' : c === '^' ? '\\^{}' : c === '~' ? '\\~{}' : `\\${c}`,
  );
}

/** Alle Werte des Handouts als flaches Objekt Schlüssel → Text. */
export function handoutMakros(daten) {
  const w = handoutWerte(daten);
  const werte = { ...w.z };
  for (const [k, v] of Object.entries(w.fw)) werte[`fest${k[0].toUpperCase()}${k.slice(1)}`] = v;
  const gross = (k) => `${k[0].toUpperCase()}${k.slice(1)}`;
  for (const [k, v] of Object.entries(daten.c1)) {
    const wert = v?.wert ?? v;
    // Nachkommastellen wie im Datenmodul (dort schon gerundet), deutsches Komma.
    werte[`cEins${gross(k)}`] = String(wert).replace('.', ',');
  }
  for (const k of ['verworfen', 'nKaltLaeufe', 'nB0']) werte[`bEins${gross(k)}`] = fmt(daten.b1[k]);
  Object.assign(werte, {
    anzahl: w.n,
    nWarm: w.nWarm,
    auNr: w.au.nr,
    gateBeob: w.gateBeob,
    vorGate: w.c.fullContextVorGate.wert,
    rechner: w.P50,
    commitHaupt: w.haupt,
    commitNachtrag: w.nachtrag,
    commitNachlauf: w.nachlauf,
    commitTeilZwei: w.teil2,
    commitAntwort: daten.antwortCommit,
    ersteAussage: w.ersteAussage,
  });
  return werte;
}

/** zahlen.tex: Kopf mit Herkunft, dann je Wert ein \newcommand. */
export function zahlenTex(makros, { commit, datum }) {
  const zeilen = Object.entries(makros)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `\\newcommand{\\${makroName(k)}}{${texEsc(v)}}`);
  return (
    `% Automatisch erzeugt von docs/referat-thema-1/abgabe/bau/handout-latex.mjs (arsnova.eu, Fork).\n` +
    `% Stand ${commit}, ${datum}. Nicht von Hand ändern; neu erzeugen.\n` +
    `${zeilen.join('\n')}\n`
  );
}

/** SVG mit Arial statt der Deck-Schriften (Inter, IBM Plex Mono). */
export function svgArial(svg) {
  return svg
    .replace(/font-family="[^"]*"/g, 'font-family="Arial"')
    .replace(/font-family:[^;"]*/g, 'font-family:Arial');
}

/** Schriftgrade unter `min` (SVG-Einheiten) auf `min` anheben; Attribut- und Stilschreibweise. */
export function svgMindestschrift(svg, min) {
  const hoch = (wert) => String(Math.max(Number(wert), min));
  return svg
    .replace(/font-size="(\d+(?:\.\d+)?)"/g, (_, w) => `font-size="${hoch(w)}"`)
    .replace(/font-size:\s*(\d+(?:\.\d+)?)px/g, (_, w) => `font-size: ${hoch(w)}px`);
}

// Druckbreite 170 mm bei viewBox-Breite 1380: 24 Einheiten ≈ 8,4 pt (PaperLab: Schrift ≥ 8 pt).
const MINDESTSCHRIFT = 24;

// SVG → PDF mit rsvg-convert (cairo): bettet Arial als TrueType ein. Chromium schrieb Teile als
// Type-3-Schrift, die PaperLab ablehnt (Schriftregel RL S. 2: alle Schriften eingebettet, eine Familie).
function svgZuPdf(svg, pfad, { breiteMm }) {
  const tmp = mkdtempSync(join(tmpdir(), 'handout-svg-'));
  try {
    const quelle = join(tmp, 'abb.svg');
    writeFileSync(quelle, svg);
    const breitePt = Math.round((breiteMm / 25.4) * 72);
    execFileSync('rsvg-convert', ['-f', 'pdf', '-w', String(breitePt), '-o', pfad, quelle]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  const fonts = execFileSync('pdffonts', [pfad], { encoding: 'utf8' });
  if (/Type 3|Inter|Plex|DejaVu|Liberation/.test(fonts)) {
    throw new Error(`${pfad}: unzulässige Schrift\n${fonts}`);
  }
}

export async function erzeuge(ziel) {
  const daten = ladeFolienDaten(ROOT);
  mkdirSync(ziel, { recursive: true });
  const commit = execFileSync('git', ['rev-parse', '--short=8', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  const datum = new Date().toISOString().slice(0, 10);
  writeFileSync(join(ziel, 'zahlen.tex'), zahlenTex(handoutMakros(daten), { commit, datum }));
  const { b1, c1, auftrag } = daten;
  svgZuPdf(
    svgMindestschrift(svgArial(wegSvg({ aktiv: null, b1, c1, auftrag })), MINDESTSCHRIFT),
    join(ziel, 'abb-weg.pdf'),
    {
      breiteMm: 170,
    },
  );
  svgZuPdf(
    svgMindestschrift(svgArial(zeitzerlegungSvg(b1)), MINDESTSCHRIFT),
    join(ziel, 'abb-zeit.pdf'),
    { breiteMm: 170 },
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ziel = process.argv[2];
  if (!ziel) throw new Error('Aufruf: node handout-latex.mjs <zielordner>');
  await erzeuge(resolve(ziel));
  console.log(`erzeugt: ${ziel}`);
}
