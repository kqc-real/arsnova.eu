// Prüft den Generator für Niklas' LaTeX-Handout (handout-latex-1a.mjs): Zahlen aus der Auswertung
// und den Rohdaten derselben Reihe, gültige und eindeutige Makronamen, druckfertige Abbildung in Arial.
/* global process -- Node-Test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { makroName } from './handout-latex.mjs';
import { ladeDaten1A } from './daten-1a.mjs';
import { vergleichsMatrixSvg } from './grafik-1a.mjs';
import {
  abbildungen1A,
  druckSvg,
  erzeuge,
  ladeKontext1A,
  ladeRohdaten1A,
  makros1A,
  nearestRank,
  svgAufInhaltsbreite,
  zahlenTex1A,
} from './handout-latex-1a.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const d = ladeDaten1A(ROOT);
const roh = ladeRohdaten1A(ROOT);
const m = makros1A(d, roh, ladeKontext1A());

test('nearestRank: sortiert[ceil(q·n) − 1] wie im Versuchsvertrag', () => {
  assert.equal(nearestRank([5, 1, 4, 2, 3], 0.95), 5);
  assert.equal(nearestRank([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.5), 5);
  assert.throws(() => nearestRank([], 0.95), /leere Stichprobe/);
});

test('Rohdaten: nachgerechnete Lauf-p95 stimmen mit auswertung.json überein', () => {
  assert.equal(roh.laeufe.length, roh.auswertung.runs.length);
  for (const { variante, block, lauf } of roh.laeufe) {
    const r = roh.auswertung.runs.find((x) => x.variant === variante && x.block === block);
    for (const aktion of ['join', 'vote', 'qaSubmit', 'blitzlicht']) {
      const p95 = nearestRank(lauf.live.actions[aktion].latency.durationSamplesMs, 0.95);
      assert.equal(p95, r.live[aktion].p95Ms, `${variante}/${block}/${aktion}`);
    }
  }
});

test('Makros: Kernzahlen der Reihe vom 15.11.2026 (Abgleich mit 1A/1A-auswertung.md)', () => {
  assert.equal(m.liveGeplant, '40.000');
  assert.equal(m.liveFehl, '0');
  assert.equal(m.vergleiche, '80');
  assert.equal(m.vergleicheFehl, '11');
  assert.equal(m.kontrolleFehl, '4');
  assert.equal(m.spacyFehl, '7');
  assert.equal(m.spacyN, '60');
  assert.equal(m.absolutFehl, '3');
  assert.equal(m.hEinsBasisMs, '18,97');
  assert.equal(m.hEinsKandidatMs, '22,95');
  assert.equal(m.vVierWeitergeleitet, '0');
  assert.equal(m.vVierTimeout, '495');
  assert.equal(m.vVierGegendruck, '250');
  assert.equal(m.vDreiTimeout, '3');
  assert.equal(m.oomZuwachs, '0');
  assert.equal(m.schwelleRelProzent, '10');
  assert.equal(m.schwelleAbsMs, '50');
  assert.equal(m.commitApp, 'a19ca70f');
});

test('Makros: Vorab-Festlegung liegt vor der gewerteten Reihe', () => {
  const tag = (s) => s.split('.').reverse().join('-');
  assert.ok(tag(m.datumVertrag) < tag(m.datumNachtrag));
  assert.ok(tag(m.datumNachtrag) < tag(m.datumLauf));
  assert.ok(Number(m.tageVorher) > 0);
});

test('Makros: explorative Werte (V3/Block 5 als zusammenhängendes Ereignis)', () => {
  assert.equal(m.expTimeoutBloecke, '5', 'Timeouts der V3-Analyse nur in Block 5');
  assert.ok(Number(m.expBFuenfLangsam) > 10 * Number(m.expAndereMax));
});

test('Makros: nur Text, Makronamen gültig und eindeutig, keine Platzhalter', () => {
  const namen = Object.keys(m).map(makroName);
  assert.equal(new Set(namen).size, namen.length);
  for (const [k, v] of Object.entries(m)) {
    assert.equal(typeof v, 'string', k);
    assert.ok(v.length > 0, k);
    assert.doesNotMatch(v, /NaN|undefined|Infinity/, k);
  }
});

test('zahlenTex1A nennt Generator, Stand und Quelle', () => {
  const tex = zahlenTex1A({ liveGeplant: '40.000' }, { commit: 'abcd1234', datum: '2026-11-16' });
  assert.match(tex, /^% Automatisch erzeugt .*bau\/handout-latex-1a\.mjs/);
  assert.match(tex, /Stand abcd1234, 2026-11-16/);
  assert.match(tex, /\\newcommand\{\\zLiveGeplant\}\{40\.000\}/);
});

test('druckSvg: keine Aufbaustufen, keine Folientexte, kein weißer Hintergrund', () => {
  const svg = druckSvg(vergleichsMatrixSvg(d));
  assert.doesNotMatch(svg, /data-ab=|data-bis=|aufbau-|transition-delay/);
  assert.doesNotMatch(svg, /gepaarte Vergleiche: jede Aktion/);
  assert.doesNotMatch(svg, /<rect width="\d+" height="\d+" fill="#ffffff"\/>/);
});

test('svgAufInhaltsbreite: verbreitert die viewBox nur bei Überstand', () => {
  const innen = '<svg viewBox="0 0 100 50"><rect x="10" y="0" width="20" height="5"/></svg>';
  assert.deepEqual(svgAufInhaltsbreite(innen), { svg: innen, faktor: 1 });
  const aussen = '<svg viewBox="0 0 100 50"><rect x="90" y="0" width="30" height="5"/></svg>';
  const r = svgAufInhaltsbreite(aussen);
  assert.match(r.svg, /viewBox="0 0 122 50"/);
  assert.equal(r.faktor, 1.22);
});

test('Abbildung: Schrift bei 17 cm Druckbreite mindestens 8 pt', () => {
  const svg = abbildungen1A(d)['abb-vergleiche.pdf'];
  const breite = Number(svg.match(/viewBox="0 0 (\d+(?:\.\d+)?)/)[1]);
  const groessen = [...svg.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)].map((x) => Number(x[1]));
  assert.ok(groessen.length > 0);
  const pt = ((Math.min(...groessen) * 170) / breite / 25.4) * 72;
  assert.ok(pt >= 8, `kleinste Schrift ${pt.toFixed(2)} pt`);
});

test('erzeuge: zahlen.tex und Abbildung nur mit eingebettetem TrueType-Arial', async () => {
  const ziel = mkdtempSync(join(tmpdir(), 'hl1a-'));
  try {
    await erzeuge(ziel);
    assert.deepEqual(readdirSync(ziel).sort(), ['abb-vergleiche.pdf', 'zahlen.tex']);
    const tex = readFileSync(join(ziel, 'zahlen.tex'), 'utf8');
    assert.match(tex, /\\newcommand\{\\zVergleicheFehl\}\{11\}/);
    const fonts = execFileSync('pdffonts', [join(ziel, 'abb-vergleiche.pdf')], {
      encoding: 'utf8',
    });
    assert.doesNotMatch(fonts, /Type 3|Inter|Plex|DejaVu/);
    assert.match(fonts, /ArialMT/);
  } finally {
    rmSync(ziel, { recursive: true, force: true });
  }
});

// Niklas' PaperLab-Projekt (übersprungen, wenn es auf diesem Rechner fehlt): keine Zahl von Hand im Text.
const PROJEKT = join(
  process.env.HOME ?? '',
  'Documents/Code/PaperLab/scientific-papers/presentation/presentation-semester-7-cloud-computing-1a-1b_niklas',
);
const projektDa = (() => {
  try {
    readdirSync(join(PROJEKT, 'sections'));
    return true;
  } catch {
    return false;
  }
})();

test(
  'Handout: jede Messzahl im Text kommt aus zahlen.tex (nur Kennungen sind Literale)',
  { skip: !projektDa && 'PaperLab-Projekt fehlt' },
  () => {
    const quellen = ['sections', 'figures'].flatMap((o) =>
      readdirSync(join(PROJEKT, o))
        .filter((f) => f.endsWith('.tex'))
        .map((f) => readFileSync(join(PROJEKT, o, f), 'utf8')),
    );
    const rest = quellen
      .join('\n')
      .replace(/^%.*$/gm, '')
      .replace(/\\(?:paren|text)cite\[[^\]]*\]\{[^}]*\}/g, '')
      .replace(/\\texttt\{[^}]*\}/g, '')
      .replace(/\\(?:label|cref|Cref|input|includegraphics)(?:\[[^\]]*\])?\{[^}]*\}/g, '')
      .replace(/\\z[A-Za-z]+/g, '')
      // Kennungen: Varianten, Hypothesen, Prinzipien, Aufträge, ADR, Release, Modell, Perzentilname, Schritte
      .replace(
        /\b[VHPFLS]\d\b|\bp95\b|8\.9b|\b\d[ABC]\b|ADR-\d+|WSL2|cgroup v2|Release[~ ]1\.3|Opus~5\.5|GPT-\d\.\d Sol|95\.~Perzentil|Schritte \d--\d|\d und~?\s*\d/g,
        '',
      );
    const zahlen = [...rest.matchAll(/.{0,25}\d+(?:[.,]\d+)*.{0,5}/g)].map((x) => x[0]);
    assert.deepEqual(zahlen, [], `Zahlen von Hand: ${zahlen.join(' | ')}`);
  },
);

test('1B 3–4: Makros für Abschnitt 6 aus denselben Daten wie M1–M4 (Protokollwerte)', async () => {
  const { makros1B34 } = await import('./handout-latex-1a.mjs');
  const { ladeDaten1B34 } = await import('./daten-1b34.mjs');
  const e = makros1B34(ladeDaten1B34(ROOT));
  assert.equal(e.ebSFEinsMs, '48');
  assert.equal(e.ebSFZweiS, '134,7');
  assert.equal(e.ebSLDreiS, '300,1');
  assert.equal(e.ebLNormalS, '3,5');
  assert.equal(e.ebLNormalN, '30');
  assert.equal(e.ebLUebernommen, '30');
  assert.equal(e.ebLFEinsMs, '37,5');
  assert.equal(e.ebLFZweiS, '30,0');
  assert.equal(e.ebFristLabelS, '30');
  assert.equal(e.ebFaktor, '2.800');
  assert.equal(e.ebLiveFehl, '0');
  assert.equal(e.ebMaxProzent, '128');
  assert.equal(e.ebBreakerOffenMs, '44');
  assert.equal(e.ebBreakerFristS, '90');
  assert.equal(e.ebTransportMs, '8,7');
  assert.equal(e.ebTransportProzent, '0,25');
  assert.equal(e.ebSEinsBeitrittProzent, '23');
  assert.equal(e.ebSEinsQuizProzent, '21');
  // gültige Makronamen, keine Kollision mit 1A
  for (const k of Object.keys(e)) assert.match(makroName(k), /^z[A-Za-z]+$/, k);
  assert.ok(Object.keys(e).every((k) => !(k in m)));
});
