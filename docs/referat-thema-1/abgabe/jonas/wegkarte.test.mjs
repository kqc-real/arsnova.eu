// Prüft die Wegkarten oben links (wegkarte.mjs): ein Satz Maße und eine Linienfarbe für beide Wege, feste
// Druckmarken und beständige Läufer aus derselben Zeichenfunktion, Beschriftung mit Etikett, keine
// Systembild-Miniatur mehr.
// Aufruf: node --test docs/referat-thema-1/abgabe/jonas/wegkarte.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as grafik from './grafik.mjs';
import {
  KARTE,
  MARKEN,
  STOERUNG_ZEICHEN,
  WEG_1A,
  WEG_AUFTRAG,
  karteSvg,
  laeuferZustand,
  marke,
  markeText,
  markeVon,
  wegLaeufer,
  wegMarke,
} from './wegkarte.mjs';

const kreise = (svg) => [...svg.matchAll(/<circle data-station="([a-z]+)"[^>]*r="([\d.]+)"/g)];

test('beide Wege: gleiche Maße, Linienstärke, Linienfarbe und Stationsradien, Höhe wie Jonas’ Karte', () => {
  for (const weg of [WEG_AUFTRAG, WEG_1A]) {
    const svg = karteSvg(weg);
    assert.match(svg, new RegExp(`width="${KARTE.breite}" height="${KARTE.hoehe}"`), weg.id);
    // eine Linie in Blau (Auftragsweg und 1A gleich), keine graue Linie mehr
    const linien = [...svg.matchAll(/<path d="[^"]*" fill="none" stroke="([^"]+)"/g)].map(
      (m) => m[1],
    );
    assert.deepEqual(linien, ['var(--blau)'], weg.id);
    assert.doesNotMatch(svg, /var\(--linie\)|var\(--gedaempft\)/, weg.id);
    for (const [, w] of svg.matchAll(/stroke-width="([\d.]+)"/g))
      assert.equal(Number(w), KARTE.linie, weg.id);
    for (const [, name, r] of kreise(svg))
      assert.equal(
        Number(r),
        weg.stationen[name].kern ? KARTE.kern : KARTE.ring,
        `${weg.id} ${name}`,
      );
    // Stationen nur auf den beiden Ebenen, innerhalb der Karte
    for (const [name, s] of Object.entries(weg.stationen)) {
      assert.ok(s.x >= KARTE.ring && s.x <= KARTE.breite - KARTE.ring, `${weg.id} ${name} x`);
      assert.ok(s.y >= KARTE.oben - 0.01 && s.y <= KARTE.unten + 0.01, `${weg.id} ${name} y`);
    }
  }
  // genau eine gefüllte Hauptstation je Weg
  assert.deepEqual(
    [WEG_AUFTRAG, WEG_1A].map((w) => Object.keys(w.stationen).filter((n) => w.stationen[n].kern)),
    [['inferenz'], ['spacy']],
  );
});

test('Auftragsweg: Stationen von Klick bis Gate, oben app-host, Netz und Inferenz in der Senke', () => {
  const S = WEG_AUFTRAG.stationen;
  assert.deepEqual(Object.keys(S), [
    'klick',
    'kontext',
    'netz',
    'inferenz',
    'nachpruefung',
    'gate',
  ]);
  for (const n of ['klick', 'kontext', 'nachpruefung', 'gate']) assert.equal(S[n].y, KARTE.oben, n);
  assert.equal(S.inferenz.y, KARTE.unten);
  assert.ok(S.netz.y > KARTE.oben && S.netz.y < KARTE.unten);
  const anteile = Object.values(S).map((s) => s.anteil);
  assert.deepEqual(
    [...anteile].sort((a, b) => a - b),
    anteile,
    'Anteile steigen entlang des Wegs',
  );
  // die gestörte Strecke liegt zwischen Kontext und Nachprüfung
  const xs = [...WEG_AUFTRAG.abschnitte.zweiterHost.matchAll(/[\d.]+/g)]
    .map(Number)
    .filter((_, i) => i % 2 === 0);
  assert.ok(Math.min(...xs) > S.kontext.x && Math.max(...xs) < S.nachpruefung.x);
});

test('Weg 1A: eine Linie wie der Auftragsweg, Stationen in Vortragsreihenfolge, Farbe 1A', () => {
  const S = WEG_1A.stationen;
  assert.deepEqual(Object.keys(S), ['app', 'live', 'spacy', 'ersatz', 'wortwolke']);
  for (const n of ['app', 'live', 'ersatz', 'wortwolke']) assert.equal(S[n].y, KARTE.oben, n);
  assert.equal(S.spacy.y, KARTE.unten);
  const anteile = Object.values(S).map((s) => s.anteil);
  assert.deepEqual(
    [...anteile].sort((a, b) => a - b),
    anteile,
    'Anteile steigen entlang des Wegs',
  );
  // Stationsfarbe nach Auftrag: 1A Blau wie das Etikett; Auftragsweg Petrol (1C), Bernstein (1B), Gate rot
  for (const s of Object.values(S)) assert.equal(s.farbe, 'var(--blau)');
  for (const [n, s] of Object.entries(WEG_AUFTRAG.stationen))
    assert.equal(
      s.farbe,
      n === 'gate' ? 'var(--rot)' : s.auftrag === '1B' ? 'var(--bernstein)' : 'var(--petrol)',
      n,
    );
  // Live-Pfad oben ab der App, Analyse als Senke zu spaCy
  assert.ok(WEG_1A.abschnitte.live.startsWith(`M${S.app.x} ${KARTE.oben}`));
  assert.ok(WEG_1A.abschnitte.analyse.includes(`${KARTE.unten}`));
});

test('Druckmarken und Läufer zeichnen dieselbe Karte; Läufer hat alle Säume und Zeichen bereit', () => {
  const ohneHervorhebung = (h) =>
    h
      .match(/<svg class="weg-mini-karte"[\s\S]*?<\/svg>/)[0]
      .replace(/<g data-abschnitt[\s\S]*?<\/g>/g, '')
      .replace(/<path data-wirkung[^>]*\/>/g, '');
  for (const [weg, namen] of [
    ['auftrag', Object.keys(MARKEN).filter((n) => MARKEN[n].weg === 'auftrag')],
    ['1a', Object.keys(MARKEN).filter((n) => MARKEN[n].weg === '1a')],
  ]) {
    const l = wegLaeufer(weg, namen);
    for (const n of namen) assert.equal(ohneHervorhebung(wegMarke(n)), ohneHervorhebung(l), n);
    const saeume = new Set(namen.flatMap((n) => laeuferZustand(n).saeume));
    assert.equal((l.match(/class="weg-saum"/g) ?? []).length, saeume.size, weg);
    assert.equal((l.match(/class="weg-punkt"/g) ?? []).length, 1, `${weg}: ein Punkt, der fährt`);
    assert.match(l, /style="offset-path:path\('M/, weg);
  }
  const m1 = wegMarke('1b-stoerung');
  assert.match(m1, /<g data-abschnitt="zweiterHost"><path [^>]*stroke="var\(--bernstein\)"/);
  // J1: ganzer Weg ohne Hervorhebung und ohne Punkt
  assert.doesNotMatch(wegMarke('auftrag'), /data-abschnitt|weg-punkt/);
  assert.throws(() => wegLaeufer('1a', ['auftrag']));
});

test('Wegmarken: Hervorhebung nur am Ort der Folie, Beschriftung mit Etikett', () => {
  for (const [name, m] of Object.entries(MARKEN)) {
    const h = wegMarke(name);
    assert.match(h, /<p class="weg-beschriftung" aria-hidden="true">/, name);
    for (const t of m.teil)
      assert.match(h, new RegExp(`class="etikett etikett-${t.toLowerCase()}">${t}<`), name);
    assert.match(
      h,
      new RegExp(`aria-label="Ort auf dem Weg: ${markeText(name).replace(/[()]/g, '\\$&')}`),
      name,
    );
    assert.equal((h.match(/class="weg-punkt"/g) ?? []).length, m.station ? 1 : 0, name);
    assert.equal((h.match(/<g data-abschnitt=/g) ?? []).length, m.abschnitte?.length ?? 0, name);
    assert.equal((h.match(/data-wirkung/g) ?? []).length, m.wirkung ? 1 : 0, name);
    assert.doesNotMatch(markeText(name), /·/, name);
    if (m.weg === '1a') assert.doesNotMatch(h, /bernstein|petrol|--rot/, name);
  }
  // Punkt sitzt genau auf der Station
  const s = WEG_1A.stationen.ersatz;
  assert.match(wegMarke('1a-ersatz'), new RegExp(`left:${s.x}px;top:${s.y}px`));
  assert.throws(() => wegMarke('x'));
  assert.throws(() => marke('station:x'));
  // Stationsfolien: eigene Station, Zusatz nur an derselben Station, eigener großer Weg trägt die Marke
  assert.equal(markeVon({ station: 'klick' }), 'station:klick');
  assert.equal(markeVon({ station: 'netz', marke: 'auftrag-netz' }), 'auftrag-netz');
  assert.equal(markeVon({ station: 'klick', marke: 'auftrag' }, { eigenerWeg: true }), 'auftrag');
  assert.throws(() => markeVon({ id: 'X', station: 'klick', marke: 'auftrag-netz' }));
  assert.deepEqual(marke('station:gate'), {
    weg: 'auftrag',
    teil: ['1C'],
    station: 'gate',
    text: 'Gate',
  });
});

test('Läuferzustand: Anteil der Station, Säume, Zeichensätze je Stufe', () => {
  assert.equal(laeuferZustand('station:inferenz').anteil, WEG_AUFTRAG.stationen.inferenz.anteil);
  assert.equal(laeuferZustand('auftrag').anteil, null);
  assert.deepEqual(laeuferZustand('1a-regel').saeume, [
    'live|var(--blau)',
    'analyse|var(--blau)|gestrichelt',
  ]);
  assert.deepEqual(
    laeuferZustand('1b-stoerung').stufen.map((s) => s.satz),
    ['', 'stopp,belegt', 'drop,langsam', 'spaet'],
  );
  // M2 (Breaker gegen Queue): erst die Stopp-Bahn, dann die Bahn „zu spät“
  assert.deepEqual(
    laeuferZustand('1b-breaker').stufen.map((s) => s.satz),
    ['stopp', 'spaet'],
  );
  assert.deepEqual(laeuferZustand('auftrag-stopp').stufen, [{ ab: 0, bis: null, satz: 'stopp' }]);
  assert.equal(laeuferZustand('1a-wirkung').wirkung, true);
});

test('M1: Störungszeichen je Stufe auf der Karte, Beschriftung nur der Ort; M3 alle fünf Zeichen', () => {
  const m1 = wegMarke('1b-stoerung');
  const stufen = [...m1.matchAll(/<span class="weg-stufe" data-ab="(\d)"/g)].map((m) =>
    Number(m[1]),
  );
  assert.deepEqual(stufen, [0, 1, 2, 3]);
  // Zeichen stehen auf der Karte (weg-zeichen-ort), die Beschriftung nennt nur den Ort; ihre Bedeutung
  // steht im aria-label
  for (const [z, { text }] of Object.entries(STOERUNG_ZEICHEN)) {
    assert.match(m1, new RegExp(`data-zeichen="${z}"`), z);
    assert.ok(
      MARKEN['1b-stoerung'].stufen.some((st) => st.zeichen.includes(z)),
      z,
    );
    assert.match(m1.match(/aria-label="([^"]*)"/)[1], new RegExp(text), z);
  }
  const ort = m1.match(/<span class="weg-zeichen-ort"[\s\S]*?<p class="weg-beschriftung"/)[0];
  assert.equal((ort.match(/data-zeichen=/g) ?? []).length, 5);
  assert.match(
    m1,
    /<p class="weg-beschriftung" aria-hidden="true"><span class="weg-name">Zweiter Host<\/span><span class="etikett etikett-1b">1B<\/span><\/p>/,
  );
  // nur die letzte Stufe bleibt offen (Druck zeigt das Endbild)
  assert.equal((m1.match(/data-bis=/g) ?? []).length, 3);
  const m3 = wegMarke('1b-alle');
  assert.equal((m3.match(/data-zeichen=/g) ?? []).length, 5);
  assert.match(m3, /<span class="weg-name">Zweiter Host<\/span>/);
  assert.match(
    m3,
    /aria-label="Ort auf dem Weg: Zweiter Host \(1B\); Störungen: Stopp, Slot belegt, DROP, Netz langsam, zu spät"/,
  );
});

test('M4: S1 zeigt die Strecke über den zweiten Host gestrichelt, Beschriftung „Ein Host (S1)“', () => {
  const m4 = wegMarke('1b-s1');
  assert.match(
    m4,
    /<span class="weg-name">Ein Host \(S1\)<\/span><span class="etikett etikett-1b">1B</,
  );
  assert.equal((m4.match(/<g data-abschnitt="zweiterHost">/g) ?? []).length, 1);
  assert.match(m4, /<g data-abschnitt="zweiterHost"><path [^>]*stroke-dasharray/);
  assert.equal((m4.match(/data-zeichen=/g) ?? []).length, 0);
});

test('keine Systembild-Miniatur mehr', () => {
  for (const alt of ['systemMini', 'SYSTEM_ORTE', 'MINI_HOEHE'])
    assert.equal(grafik[alt], undefined, alt);
});
