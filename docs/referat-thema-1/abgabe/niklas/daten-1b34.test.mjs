// Gegenprobe der 1B-Daten (Schritte 3–4) gegen Niklas' Protokolle unter evidenz/1B/*.md: Jede Zahl, die
// Folien und Handout zeigen, muss der Zahl im Protokoll entsprechen (gerundet wie dort).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ladeDaten1B34 } from './daten-1b34.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const d = ladeDaten1B34(ROOT);
const p95 = (l) =>
  ['join', 'vote', 'qaSubmit', 'blitzlicht'].map((a) => Math.round(l.live[a].p95Ms * 100) / 100);

test('Label: Teilreihen gepoolt, p95 wie in den Gesamtauswertungen', () => {
  const normal = d.finde('normal', 'label');
  assert.equal(normal.n, 30);
  assert.equal(normal.teile, 3);
  assert.deepEqual(p95(normal), [38.64, 32.22, 15.79, 18.34]); // normal-label-03.md:96–99
  assert.equal(normal.zeitArt, 'client');
  assert.equal(normal.zeitMedianMs, 3512); // normal-label-03.md:90
  assert.equal(normal.uebernommen, 30);
  assert.equal(normal.liveFehler, 0);
  const l1 = d.finde('l1', 'label');
  assert.equal(l1.n, 20);
  assert.deepEqual(p95(l1), [40.62, 31.64, 16.83, 22.07]); // l1-label-02.md:80–83
  assert.deepEqual(p95(d.finde('f1', 'label')), [32.9, 32.14, 15.71, 16.96]); // f1-label.md:90–93
  assert.equal(d.finde('f2', 'label').zeitMedianMs, 30040); // f2-label.md:54
  assert.equal(d.finde('l2', 'label').zeitMedianMs, 5086); // l2-label.md:56
  assert.equal(d.finde('l3', 'label').zeitMedianMs, 30044); // l3-label.md:48
  assert.equal(d.finde('f1', 'label').zeitMedianMs, 37.5); // f1-label.md:56
  assert.equal(d.finde('f1', 'label').timeoutMs, 30000); // wirksamer Label-Timeout
});

test('Summary: Job-Zeit wie bisher, Frist 300 s', () => {
  const f1 = d.finde('f1');
  assert.equal(f1.zeitArt, 'job');
  assert.equal(f1.zeitMedianMs, 48);
  assert.equal(f1.timeoutMs, 300000);
  assert.equal(d.finde('f2').zeitMedianMs, 134732);
  assert.deepEqual(p95(d.finde('busy')), [38.75, 32.76, 15.3, 13.72]); // busy-summary.md:83–86
});

test('Störreihen: keine Breaker-, S1- oder Entwicklungsdateien darunter', () => {
  for (const l of d.laeufe) {
    assert.match(l.variante, /^(normal|f1|f2|l1|l2|l3|busy)$/, l.datei);
    assert.doesNotMatch(l.dateien.join(' '), /breaker|s1|dev-/);
  }
  assert.equal(d.laeufe.length, 11);
});

test('Breaker gegen Queue: drei RST, dann circuit_open; vier Timeouts, jeder mit Netzversuch', () => {
  const { f1, l3 } = d.breaker;
  assert.deepEqual(
    f1.jobs.map((j) => [j.jobMs, j.grund, j.verbindungen]),
    [
      [53, 'unavailable', 1],
      [47, 'unavailable', 1],
      [44, 'unavailable', 1],
      [44, 'circuit_open', 0],
    ],
  );
  assert.deepEqual(
    l3.jobs.map((j) => j.grund),
    ['timeout', 'timeout', 'timeout', 'timeout'],
  );
  assert.ok(l3.jobs.every((j) => j.verbindungen === 1 && j.jobMs > 90000 && j.jobMs < 90100));
  assert.equal(l3.timeoutMs, 90000);
  assert.equal(f1.commit, '7c64dd6a');
});

test('S1: Live-p95 und Referenz wie in den S1-Protokollen', () => {
  const { label, summary } = d.s1;
  assert.deepEqual(p95(label).slice(0, 2), [47.6, 38.92]); // s1-label.md:85–86
  assert.deepEqual(p95(summary), [23.93, 20.15, 18.56, 11.97]); // s1-summary.md:85–88
  assert.equal(label.liveFehler + summary.liveFehler, 0);
  assert.equal(label.n, 3);
  assert.equal(summary.commit, '4b135fe8');
  assert.equal(label.uebernommen, 3);
  assert.deepEqual(summary.gruende, { invalid_response: 3 });
});

test('Transport: Label-Normalreihe wie in der Transportauswertung', () => {
  const t = d.transport.label;
  assert.equal(t.n, 30);
  assert.equal(Math.round(t.transportMedianMs * 1000) / 1000, 8.714);
  assert.equal(Math.round(t.anteilMedianProzent * 1000) / 1000, 0.247);
  assert.equal(Math.round(t.anteilMaxProzent * 1000) / 1000, 0.639);
});
