// Prüft den Generator für das LaTeX-Handout (handout-latex.mjs): eine Quelle je Zahl,
// gültige Makronamen, maskierter Text, keine Deck-Schriften in den Abbildungen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ladeFolienDaten } from './folien.mjs';
import {
  handoutMakros,
  makroName,
  svgArial,
  svgMindestschrift,
  texEsc,
  zahlenTex,
} from './handout-latex.mjs';
import { handoutWerte } from './handout.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('makroName: nur Buchstaben, Ziffern als Wort', () => {
  assert.equal(makroName('netz'), 'zNetz');
  assert.equal(makroName('infer1C'), 'zInferEinsC');
  assert.equal(makroName('c0'), 'zCNull');
  assert.throws(() => makroName('a-b'), /Makronamen/);
});

test('texEsc maskiert TeX-Sonderzeichen', () => {
  assert.equal(texEsc('50 % & #1 a_b {x} ~ ^'), '50 \\% \\& \\#1 a\\_b \\{x\\} \\~{} \\^{}');
});

test('handoutMakros enthält jede Zahl des HTML-Handouts unverändert', () => {
  const daten = ladeFolienDaten(ROOT);
  const m = handoutMakros(daten);
  const w = handoutWerte(daten);
  for (const [k, v] of Object.entries(w.z)) assert.equal(m[k], v, k);
  assert.equal(m.auNr, w.au.nr);
  assert.match(m.netz, /^\d+,\d{2}$/);
  // 1C-Kennzahlen und 1B-Zählungen direkt aus dem Datenmodul
  assert.equal(m.cEinsOomAuftrag, '19');
  assert.equal(m.cEinsGateAntworten, '0 von 28');
  assert.equal(m.cEinsBytesJeToken, '3,15');
  assert.equal(m.bEinsVerworfen, '10');
  assert.equal(m.bEinsNKaltLaeufe, '5');
  const namen = Object.keys(m).map(makroName);
  assert.equal(new Set(namen).size, namen.length, 'Makronamen eindeutig');
});

test('zahlenTex nennt die Herkunft und definiert jedes Makro genau einmal', () => {
  const tex = zahlenTex(
    { netz: '0,43', ersteAussage: 'a_b' },
    { commit: 'abcd1234', datum: '2026-11-15' },
  );
  assert.match(tex, /^% Automatisch erzeugt .*handout-latex\.mjs/);
  assert.match(tex, /Stand abcd1234, 2026-11-15/);
  assert.match(tex, /\\newcommand\{\\zNetz\}\{0,43\}/);
  assert.match(tex, /\\newcommand\{\\zErsteAussage\}\{a\\_b\}/);
});

test('svgArial ersetzt jede Schriftfamilie durch Arial', () => {
  const s = svgArial(
    `<text font-family="'Inter', sans-serif">a</text><text style="font-family:'IBM Plex Mono';x:1">b</text>`,
  );
  assert.doesNotMatch(s, /Inter|Plex/);
  assert.equal((s.match(/Arial/g) || []).length, 2);
});

test('svgMindestschrift hebt kleine Schriftgrade an und lässt große stehen', () => {
  // 17 cm Druckbreite bei viewBox 1380: 24 Einheiten ≈ 8,4 pt (Schrift ≥ 8 pt, PaperLab figures/README).
  const s = svgMindestschrift(
    '<text font-size="22">a</text><text style="font-size: 18px">b</text><text font-size="30">c</text>',
    24,
  );
  assert.match(s, /font-size="24">a/);
  assert.match(s, /font-size: 24px">b/);
  assert.match(s, /font-size="30">c/);
});

test('erzeuge: Abbildungen nur mit eingebetteten TrueType-Schriften (Arial), keine Type-3-Schrift', async () => {
  const { mkdtempSync, readdirSync, rmSync } = await import('node:fs');
  const { execFileSync } = await import('node:child_process');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { erzeuge } = await import('./handout-latex.mjs');
  const ziel = mkdtempSync(join(tmpdir(), 'hl-'));
  try {
    await erzeuge(ziel);
    assert.deepEqual(readdirSync(ziel).sort(), ['abb-weg.pdf', 'abb-zeit.pdf', 'zahlen.tex']);
    for (const f of ['abb-weg.pdf', 'abb-zeit.pdf']) {
      const fonts = execFileSync('pdffonts', [join(ziel, f)], { encoding: 'utf8' });
      assert.doesNotMatch(fonts, /Type 3/, f);
      assert.match(fonts, /ArialMT/, f);
      assert.doesNotMatch(fonts, /Inter|Plex|DejaVu/, f);
    }
  } finally {
    rmSync(ziel, { recursive: true, force: true });
  }
});
