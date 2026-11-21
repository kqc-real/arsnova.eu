// Prüft das Literaturverzeichnis der Folien (literatur.mjs) gegen den Zitierleitfaden (ZL) und gegen das
// Handout in PaperLab: dieselben Einträge, dieselben Jahresbuchstaben.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { LITERATUR, kurzbeleg } from './literatur.mjs';

const BIB = `${process.env.HOME}/Documents/Code/PaperLab/scientific-papers/presentation/presentation-semester-7-cloud-computing-1b-1c_jonas/main.bib`;
// Seit 2026-11-18 ein gemeinsames Verzeichnis: jeder Eintrag steht in mindestens einem der beiden Handouts.
const BIB_NIKLAS = `${process.env.HOME}/Documents/Code/PaperLab/scientific-papers/presentation/presentation-semester-7-cloud-computing-1a-1b_niklas/main.bib`;

test('kurzbeleg: Autor, Jahr und Stelle in Klammern (ZL S. 3)', () => {
  assert.equal(kurzbeleg('kwon2023', 'Kap. 3'), '(Kwon et al., 2023, Kap. 3)');
  assert.equal(kurzbeleg('dean2013', 'S. 74'), '(Dean & Barroso, 2013, S. 74)');
  assert.equal(kurzbeleg('weirauch2026c', 'ADR 1C-024'), '(Weirauch, 2026, ADR 1C-024)');
  assert.throws(() => kurzbeleg('fehlt2020'), /fehlt2020/);
});

test('quellenzeile: mehrere Werke alphabetisch, gleiche Autorschaft chronologisch, Semikolon (ZL S. 14)', async () => {
  const { quellenzeile } = await import('./literatur.mjs');
  assert.equal(
    quellenzeile([
      ['weirauch2026c', 'ADR 1C-024'],
      ['arsnova2026pruefung', 'Kap. 4.3'],
      ['arsnova2026adr0035', 'Kap. 2.1'],
      ['dean2013'],
    ]),
    'Quelle: arsnova.eu-Projektteam, 2026a, Kap. 2.1; arsnova.eu-Projektteam, 2026b, Kap. 4.3; Dean & Barroso, 2013; Weirauch, 2026, ADR 1C-024',
  );
  assert.throws(() => quellenzeile([['fehlt2020']]), /fehlt2020/);
});

test('Kurzbelege sortieren: Erstautor, dann Einzelautor vor zwei Autoren vor „et al.“, dann Jahr (APA 7, 9.44)', async () => {
  const { sortiereKurz } = await import('./literatur.mjs');
  assert.deepEqual(
    sortiereKurz(['Kwon et al., 2019', 'Kwon, 2020', 'Kwon & Li, 2018', 'Dean & Barroso, 2013']),
    ['Dean & Barroso, 2013', 'Kwon, 2020', 'Kwon & Li, 2018', 'Kwon et al., 2019'],
  );
  assert.deepEqual(
    sortiereKurz([
      'arsnova.eu-Projektteam, 2026b',
      'arsnova.eu-Projektteam, 2026a',
      'Weirauch, 2026',
    ]),
    ['arsnova.eu-Projektteam, 2026a', 'arsnova.eu-Projektteam, 2026b', 'Weirauch, 2026'],
  );
});

test('Stellen nach ZL: „Kap.“ für Nummern, „Abschnitt Titel“ für Titel, kein „Abschn.“ in Fußzeilen', async () => {
  const { folien, ladeFolienDaten } = await import('./folien.mjs');
  const { niklasTeile } = await import('../niklas/teile.mjs');
  const { dirname, resolve } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const { teil1, teil2 } = niklasTeile(root);
  for (const f of [...folien(ladeFolienDaten(root)), ...teil1, ...teil2])
    if (f.fuss?.startsWith('Quelle: ')) assert.doesNotMatch(f.fuss, /Abschn\.|„/, f.id);
});

test('Einträge nach ZL: kein „o. J.“, kein Abrufdatum, DOI mit https, alphabetisch', () => {
  const voll = LITERATUR.map((e) => e.voll);
  for (const v of voll) {
    assert.doesNotMatch(v, /o\. J\.|abgerufen|Zugriff am/);
    assert.doesNotMatch(v, /[^/]doi\.org/);
  }
  const sortiert = [...voll].sort((a, b) => a.localeCompare(b, 'de'));
  assert.deepEqual(voll, sortiert);
});

test(
  'dieselben Schlüssel wie in den Handouts (PaperLab main.bib beider Personen), gleiche Jahresbuchstaben',
  { skip: !existsSync(BIB) },
  () => {
    const bib = readFileSync(BIB, 'utf8');
    const beide = bib + (existsSync(BIB_NIKLAS) ? readFileSync(BIB_NIKLAS, 'utf8') : '');
    for (const e of LITERATUR)
      assert.match(beide, new RegExp(`@\\w+\\{${e.schluessel},`), e.schluessel);
    // Eigene Arbeit: ein Eintrag ohne Jahresbuchstaben, Fundstelle im Kurzbeleg (wie im Handout).
    assert.equal(kurzbeleg('weirauch2026c'), '(Weirauch, 2026)');
    assert.ok(
      !/weirauch2026[abd]\b/.test(bib.replace(/^%.*$/gm, '')),
      'Handout hat nur weirauch2026c',
    );
    assert.ok(!LITERATUR.some((e) => /^weirauch2026[abd]$/.test(e.schluessel)));
    assert.equal(kurzbeleg('arsnova2026pruefung'), '(arsnova.eu-Projektteam, 2026b)');
    // Projektdokumente als Permalink auf denselben Stand wie im Handout
    for (const k of ['arsnova2026adr0035', 'arsnova2026pruefung']) {
      const url = LITERATUR.find((e) => e.schluessel === k).voll.match(/https:\S+/)[0];
      assert.ok(bib.includes(url), `${k}: URL wie im Handout`);
    }
  },
);
