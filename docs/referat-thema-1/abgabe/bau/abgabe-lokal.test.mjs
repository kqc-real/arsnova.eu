// Prüft den lokalen Abgabeschritt mit erfundenen Nummern: Matrikelnummern nur in ignorierten Dateien,
// eingesetzt in den Platz der Titelfolie (GT), im Repo-Deck nur der neutrale Vermerk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { entwurfsSeiten, fuelleMatrikel, pruefeGruppe } from './abgabe-lokal.mjs';
import { baueDeck } from './deck.mjs';
import { MATRIKEL_VERMERK, folien, ladeFolienDaten } from './folien.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { PDFDocument } = require('pdf-lib');

// Erfundene Nummern; die echten stehen nur in der ignorierten abgabe-lokal.json.
const GRUPPE = [
  { name: 'Niklas Schneider', matrikel: '00000001' },
  { name: 'Jonas Weirauch', matrikel: '00000002' },
];
const DECK = baueDeck(folien(ladeFolienDaten(resolve(HIER, '../..'))), {
  niklas: { teil1: [], teil2: [] },
  eingebettet: true,
});

test('pruefeGruppe verlangt Name und Ziffern je Person', () => {
  assert.equal(pruefeGruppe(GRUPPE), GRUPPE);
  assert.throws(() => pruefeGruppe([{ name: 'A' }]), /Matrikelnummer/);
  assert.throws(() => pruefeGruppe([{ name: 'A', matrikel: '12a' }]), /Matrikelnummer/);
  assert.throws(() => pruefeGruppe([]), /gruppe/);
});

test('Repo-Deck: Titelfolie mit Platz je Person, nur der neutrale Vermerk, keine Ziffern', () => {
  const plaetze = [...DECK.matchAll(/<p\b[^>]*data-matrikel="([^"]+)"[^>]*>([^<]*)<\/p>/g)];
  assert.deepEqual(
    plaetze.map((m) => m[1]),
    GRUPPE.map((p) => p.name),
  );
  for (const m of plaetze) assert.equal(m[2].trim(), MATRIKEL_VERMERK);
  assert.doesNotMatch(DECK, /Matrikelnummer \d/);
});

test('fuelleMatrikel setzt jede Nummer genau einmal in die Titelfolie', () => {
  const aus = fuelleMatrikel(DECK, GRUPPE);
  for (const p of GRUPPE) {
    assert.equal(aus.split(`Matrikelnummer ${p.matrikel}`).length - 1, 1, p.name);
  }
  assert.ok(!aus.includes(MATRIKEL_VERMERK), 'kein Platz bleibt leer');
  const gt = aus.match(/<section[^>]*data-id="GT"[\s\S]*?<\/section>/)[0];
  assert.match(gt, /data-gefuellt>Matrikelnummer 00000001</);
  // Formatiertes Deck (Prettier bricht Elemente um): der Platz wird trotzdem gefunden.
  const umbrochen = DECK.replace(
    /(data-matrikel="Jonas Weirauch">)([^<]*)</,
    (_, a, b) => `${a}\n        ${b}\n      <`,
  );
  assert.match(fuelleMatrikel(umbrochen, GRUPPE), /Matrikelnummer 00000002/);
});

test('fuelleMatrikel bricht ab, wenn ein Name keinen Platz hat oder ein Platz leer bliebe', () => {
  assert.throws(
    () => fuelleMatrikel(DECK, [...GRUPPE, { name: 'Erika Muster', matrikel: '00000003' }]),
    /Erika Muster: 0 statt 1/,
  );
  assert.throws(() => fuelleMatrikel(DECK, GRUPPE.slice(0, 1)), /blieb leer/);
});

test('entwurfsSeiten findet Entwurfsmarker und Platzhalter', async () => {
  const { StandardFonts } = require('pdf-lib');
  const doc = await PDFDocument.create();
  const f = await doc.embedFont(StandardFonts.Helvetica);
  for (const t of [
    'Fertige Folie',
    'Entwurf, mit Niklas abzustimmen',
    'Gemeinsam: [Satz zur Leitfrage]',
  ]) {
    doc.addPage([1600, 900]).drawText(t, { x: 50, y: 450, size: 30, font: f });
  }
  assert.deepEqual(await entwurfsSeiten(await doc.save()), [2, 3]);
});

test('Eingabedatei und Ausgabeordner (PDFs und Deck) sind von Git ignoriert', () => {
  for (const pfad of [
    'abgabe-lokal.json',
    'abgabe-lokal/folien.pdf',
    'abgabe-lokal/folien-gesamt.html',
  ]) {
    // check-ignore endet mit 0, wenn der Pfad ignoriert ist; sonst wirft execFileSync.
    execFileSync('git', ['check-ignore', '-q', join(HIER, pfad)], { cwd: HIER });
  }
});
