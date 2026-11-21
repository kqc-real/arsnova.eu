import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  berechneNachweisumfang,
  dauer,
  FENSTER,
  vorarbeit,
  kopfzahlen,
  REFERAT,
  tabellenwerte,
} from './nachweisumfang.mjs';

const werte = berechneNachweisumfang();

/** Erste Spalte → zweite Spalte aller Tabellenzeilen der Markdown-Datei. */
function tabellen(markdown) {
  const zeilen = {};
  for (const zeile of markdown.split('\n')) {
    if (!zeile.startsWith('|') || /^\|\s*-/.test(zeile)) continue;
    const [, name, wert] = zeile.split('|').map((z) => z.trim());
    zeilen[name] = wert;
  }
  return zeilen;
}

test('nachweisumfang.md stimmt mit der Neuberechnung auf dem Checkout überein', () => {
  const md = tabellen(readFileSync(join(REFERAT, 'nachweisumfang.md'), 'utf8'));
  for (const [name, erwartet] of Object.entries(tabellenwerte(werte))) {
    assert.equal(
      md[name],
      erwartet,
      `Zeile „${name}“ in nachweisumfang.md veraltet; Werte mit nachweisumfang.mjs neu berechnen`,
    );
  }
});

test('Teilsummen der Laborzeit ergeben die gewertete Laborzeit', () => {
  const { gewertetSek, je } = werte.laborzeit;
  assert.ok(Math.abs(je['1A'] + je['1B'] + je['1B 3–4'] + je['1C'] - gewertetSek) < 1e-6);
  // 1B 3–4: 18 gewertete Läufe (Summary 5, Label 9 mit Teilläufen, Breaker 2, S1 2), keine dev-Läufe
  assert.equal(werte.laborzeit.reihen1B3u4.laeufe, 18);
  // Zählweise wie Niklas' PR #26: Lauf-ID (UTC) bzw. Treiberstart bis umgebung.erfasstAm, zusammen ca. 12 h 40 min
  assert.equal(dauer(werte.laborzeit.je['1B 3–4']), '12 h 39 min'); // PR rundet je Reihe: ca. 12 h 40 min
  assert.equal(werte.laborzeit.laeufe1A, werte.laborzeit.vollstaendig1A);
});

test('Zeitraum der gewerteten Läufe: erster Start bis letztes Ende (Berliner Datum)', () => {
  assert.deepEqual(werte.laborzeit.zeitraum, { von: '2026-11-05', bis: '2026-11-16' });
  assert.equal(kopfzahlen(werte).zeitraum, '5.–16.11.2026');
});

test('Kopfzahlen deutsch formatiert', () => {
  const k = kopfzahlen(werte);
  assert.match(k.laborzeitStunden, /^\d+,\d h$/);
  assert.match(k.laborzeit, /^\d+ h \d+ min$/);
  assert.equal(werte.adrs.gesamt, werte.adrs['1B'] + werte.adrs['1C']);
  assert.ok(werte.tests.gesamt >= werte.tests.ohneAbgabe);
});

test('dauer rundet auf Minuten und lässt 0 h weg', () => {
  assert.equal(dauer(3297), '55 min');
  assert.equal(dauer(27715.6), '7 h 42 min');
  assert.equal(dauer(3599.9), '1 h 0 min');
});

test('1B 3–4: liegen .json und .json.gz nebeneinander, zählt der Lauf einmal (.json hat Vorrang)', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { dateien1B3u4 } = await import('./nachweisumfang.mjs');
  const wurzel = mkdtempSync(join(tmpdir(), 'nachweis-1b-'));
  try {
    const dir = join(wurzel, 'evidenz/1B/messung');
    mkdirSync(dir, { recursive: true });
    for (const n of [
      '2026-11-16-lauf-l3-label.json',
      '2026-11-16-lauf-l3-label.json.gz',
      '2026-11-16-lauf-f1-summary.json.gz',
      '2026-11-16-lauf-dev-f1-summary.json',
      '2026-11-16-lauf-normal-label-02.json.gz',
    ])
      writeFileSync(join(dir, n), '');
    assert.deepEqual(dateien1B3u4(wurzel), [
      '2026-11-16-lauf-f1-summary.json.gz',
      '2026-11-16-lauf-l3-label.json',
      '2026-11-16-lauf-normal-label-02.json.gz',
    ]);
  } finally {
    rmSync(wurzel, { recursive: true, force: true });
  }
});

test('Vorarbeit 1B 1–2: VM-Laufzeit aus dem Systemjournal (CSV), ohne die gewerteten Läufe', () => {
  const v = vorarbeit();
  assert.equal(v.vm.starts, 29);
  assert.equal(v.vm.startsWindows, 11);
  assert.equal(dauer(v.vm.alleSek), '24 h 14 min');
  assert.equal(dauer(v.vm.laborSek), '14 h 40 min');
  assert.equal(dauer(v.vm.windowsSek), '9 h 34 min');
  // gewertete Läufe 1B 1–2 liegen vollständig in VM-Laufzeit und werden abgezogen
  assert.ok(Math.abs(v.vm.gewertetDarinSek - werte.laborzeit.je['1B']) < 1);
  assert.ok(Math.abs(v.je['1B'] - (v.vm.alleSek - v.vm.gewertetDarinSek)) < 1e-6);
});

test('Vorarbeit aus Protokollen: jeder Beleg steht wörtlich in seiner Datei', () => {
  for (const f of FENSTER) {
    const text = readFileSync(join(REFERAT, f.datei), 'utf8');
    for (const b of f.belege ?? []) assert.ok(text.includes(b), `${f.datei}: „${b}“ fehlt`);
  }
});

test('Vorarbeit je Auftrag', () => {
  const { je } = vorarbeit();
  // Vorlauf der gewerteten Reihe plus die in ab1619e7 gelöschten Läufe (Git-Historie), je Lauf gezählt
  const a1 = vorarbeit().fenster.filter((f) => f.auftrag === '1A');
  assert.deepEqual(
    a1.map((f) => f.laeufe),
    [5, 25, 5, 7, 5, 1],
  );
  assert.ok(je['1A'] > 3 * 3600 && je['1A'] < 4 * 3600, dauer(je['1A']));
  assert.equal(dauer(je['1B 3–4']), '1 h 19 min');
  assert.equal(dauer(je['1B']), '23 h 19 min'); // VM-Laufzeit ohne die 55 min gewerteter Läufe // Aufbau Windows, Entwicklungsläufe, Kalibrierung, Abbau
  assert.equal(dauer(je['1C']), '1 h 11 min'); // Kalibrierung PC, U1, Messungen Teil 2/3, Probe- und Trockenläufe
});
