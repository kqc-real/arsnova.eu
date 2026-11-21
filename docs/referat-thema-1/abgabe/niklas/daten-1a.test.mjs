// Prüft, dass der Folienentwurf 1A seine Zahlen genau so aus Niklas' auswertung.json liest wie dessen
// eigener Renderer (scripts/load/render-resource-isolation-pdfs.mjs) und die Befunde dort.
// Aufruf: node --test docs/referat-thema-1/abgabe/niklas/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ladeDaten1A } from './daten-1a.mjs';

const ROOT = resolve(fileURLToPath(import.meta.url), '../../..');
const d = ladeDaten1A(ROOT);

test('Live-Aktionen: alle geplanten erfolgreich, höchster Quiz-p95 unter dem 1000-ms-Ziel', () => {
  assert.equal(d.live.geplant, 40_000);
  assert.equal(d.live.erfolgreich, 40_000);
  assert.ok(d.live.quizMaxMs > 167 && d.live.quizMaxMs < 168);
});

test('Vergleiche: 80 insgesamt, H1 1/20, H2 6/40, Kontrolle V1 gegen V0 4/20, absolut 3', () => {
  assert.equal(d.vergleiche.length, 80);
  const fehl = (v) => d.vergleiche.filter((x) => x.variante === v && !x.bestanden).length;
  assert.equal(fehl('V1'), 4);
  assert.equal(fehl('V2'), 1);
  assert.equal(fehl('V3') + fehl('V4'), 6);
  assert.equal(d.h1.fehl, 1);
  assert.equal(d.h2.fehl, 6);
  assert.deepEqual(
    d.vergleiche
      .filter((x) => !x.absolutBestanden)
      .map((x) => `${x.variante}/${x.block}/${x.aktion}`),
    ['V3/5/join', 'V3/5/vote', 'V3/5/qaSubmit'],
  );
});

test('kleine Verletzungen außerhalb von V3 Block 5 bleiben unter 16 ms', () => {
  const klein = d.vergleiche.filter((x) => !x.bestanden && !(x.variante === 'V3' && x.block === 5));
  assert.equal(klein.length, 7);
  assert.ok(Math.max(...klein.map((x) => x.deltaMs)) < 16);
  assert.ok(d.v3Block5MaxDeltaMs > 214 && d.v3Block5MaxDeltaMs < 215);
});

test('Ressourcen und Analyse wie in Niklas’ Renderer', () => {
  assert.equal(d.v3.erfolg, 741);
  assert.equal(d.v3.ersatz, 6);
  assert.equal(d.v3.offen, 3);
  assert.equal(d.v4.weitergeleitet, 0);
  assert.equal(d.v4.ersatz, 745);
  assert.equal(d.v2.erfolg, 750);
  assert.ok(d.v2.ramMiB[1] < 0.8 * 1024);
  assert.ok(d.v2.drosselProzent[1] < 5);
  assert.ok(d.v3.drosselProzent[0] > 85);
  assert.equal(d.drosselung.V2.length, 5);
  assert.equal(d.speicher.V2.length, 5);
});

test('Herkunft: Baseline-Commit und Hash der Auswertung', () => {
  assert.equal(d.herkunft.commit, 'a19ca70f');
  assert.match(d.herkunft.auswertungSha, /^[0-9a-f]{16}$/);
  assert.equal(d.herkunft.cpus, 16);
});

// ---------------------------------------------------------------- Nachrechnung aus Rohdaten

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  AKTIONEN,
  KETTE_1A,
  REIHE_1A,
  VERTRAG_1A,
  ladeDaten1A as laden,
  rang,
} from './daten-1a.mjs';

const roh = (v, b) =>
  JSON.parse(readFileSync(join(ROOT, REIHE_1A, v, `block-0${b}`, 'lauf.json'), 'utf8'));

test('Nachrechnung: alle 100 Lauf-p95 (Nearest Rank) aus den Rohstichproben = Auswertung', () => {
  let n = 0;
  for (const l of d.laufP95) {
    const r = roh(l.variante, l.block);
    for (const [k] of AKTIONEN) {
      assert.equal(rang(r.live.actions[k].latency.durationSamplesMs, 0.95), l.p95[k]);
      n++;
    }
  }
  assert.equal(n, 100);
});

test('Nachrechnung: alle 80 Vergleiche nach der Regel (≤ 1,10 × Basis und ≤ +50 ms) = Auswertung', () => {
  for (const c of d.vergleiche) {
    const rel = c.kandidatMs <= c.basisMs * (1 + d.schwellen.relativ);
    const abs = c.kandidatMs - c.basisMs <= d.schwellen.absolutMs;
    assert.equal(rel, c.relativBestanden);
    assert.equal(abs, c.absolutBestanden);
    assert.equal(rel && abs, c.bestanden);
  }
  assert.equal(d.vergleiche.filter((x) => !x.bestanden).length, 11);
});

test('gleiche Daten in jedem Lauf, Vertragshash in allen Manifesten', () => {
  assert.deepEqual(d.gleicheDaten, {
    fixture: true,
    korpusUnveraendert: true,
    vertragInAllenLaeufen: true,
  });
});

test('Vorab-Festlegung: Schwellen stehen schon im Vertrag v1, Daten aus Git, Läufe danach', () => {
  const v1 = execFileSync(
    'git',
    ['show', `${KETTE_1A[0].commit}:docs/referat-thema-1/${VERTRAG_1A}`],
    {
      cwd: ROOT,
      encoding: 'utf8',
    },
  );
  assert.match(
    v1,
    /candidateP95 <= baselineP95 \* 1\.10` \*\*and\*\* `candidateP95 - baselineP95 <= 50 ms`/,
  );
  assert.match(v1, /p95 `<= 1000 ms`/);
  assert.equal(d.vorab.kette[0].datum.slice(0, 10), '2026-11-07');
  assert.ok(d.vorab.kette.every((k) => Date.parse(k.datum) < Date.parse(d.vorab.ersterLauf)));
  assert.equal(d.vorab.tageVorher, 7); // 7 Tage 20 Stunden: „eine Woche vorher“
});

test('Konfiguration aus den Laufmanifesten: Limits, Timeout, Proxy, Gegendruck', () => {
  assert.deepEqual(d.konfig.spacy.V2, { cpu: 1, speicherGiB: 1, pids: 64 });
  assert.equal(d.konfig.spacy.V3.cpu, 0.25);
  assert.equal(d.konfig.timeoutMs, 5000);
  assert.equal(d.v4.verzoegerungMs, 6000);
  assert.equal(d.konfig.maxInFlight, 2);
  assert.equal(d.v4.ersatzTimeout + d.v4.ersatzGegendruck, d.v4.ersatz);
  const app = d.konfig.dienste.find((s) => s.alias === 'app');
  assert.equal(app.cpu, null, 'App ohne Limit');
  // Jeder Lauf einer Variante hat dieselbe spaCy-Konfiguration
  for (const v of ['V2', 'V3', 'V4']) {
    for (let b = 1; b <= 5; b++) {
      assert.equal(roh(v, b).manifest.services.spacy.cpuLimit, d.konfig.spacy[v].cpu, `${v}/${b}`);
    }
  }
});

test('explorativ V3/Block 5: ein Fenster von etwa 10 s, die einzigen Timeouts, DB-Spitze', () => {
  const e = d.explorativ;
  assert.equal(e.laufNr, 25, 'letzter Lauf der Reihe');
  assert.equal(e.langsam.join, 50);
  assert.equal(e.langsamAndereMax, 1);
  assert.equal(e.fensterS, 10);
  assert.equal(e.timeouts, d.v3.timeouts, 'alle Timeouts von V3 in diesem Lauf');
  assert.ok(e.timeoutStartS.every((s) => s >= e.fenster[0] && s <= e.fenster[1]));
  assert.ok(e.pgMax.max > e.pgAndere[1]);
  assert.ok(e.wsP95 > e.wsP95Andere[1]);
  assert.ok(e.lastMax < 2, 'Hostlast gering');
});

test('Laborreserve und gepoolte p95 (nachträglich)', () => {
  assert.ok(d.labor.containerCpuProzent[1] < 50);
  assert.ok(d.labor.minFreiGiB > 11.6);
  assert.equal(d.labor.swapUnberuehrt, true);
  assert.equal(d.explorativ.gepoolt.V1.join.n, 2500);
  assert.ok(
    Math.abs(d.explorativ.gepoolt.V2.qaSubmit.p95 - d.explorativ.gepoolt.V1.qaSubmit.p95) < 0.2,
  );
  assert.deepEqual(laden(ROOT).explorativ.gepoolt, d.explorativ.gepoolt, 'deterministisch');
});
