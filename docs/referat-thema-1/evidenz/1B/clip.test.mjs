// Prüft den Schnittplan des Lehrenden-Clips (clip.mjs): Klick und Ergebnis in Echtzeit,
// die Wartezeit dazwischen gerafft, nichts weggeschnitten.
// Aufruf: node --test docs/referat-thema-1/evidenz/1B/clip.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schnittplan, ffmpegFilter } from './clip.mjs';

test('rafft nur die Wartezeit und behält Anfang und Ende in Echtzeit', () => {
  const p = schnittplan({ klickMs: 5_000, ergebnisMs: 157_000, gesamtMs: 162_000, raffungS: 4 });
  assert.deepEqual(
    p.segmente.map((s) => [s.vonS, s.bisS]),
    [
      [0, 7],
      [7, 156],
      [156, 162],
    ],
  );
  assert.equal(p.segmente[0].faktor, 1);
  assert.equal(p.segmente[2].faktor, 1);
  assert.equal(p.segmente[1].faktor, 149 / 4);
  assert.equal(p.dauerS, 7 + 4 + 6);
  assert.equal(p.gerafftS, 149);
});

test('kurze Wartezeit bleibt ungeschnitten in Echtzeit', () => {
  const p = schnittplan({ klickMs: 5_000, ergebnisMs: 12_000, gesamtMs: 16_000, raffungS: 4 });
  assert.deepEqual(p.segmente, [{ vonS: 0, bisS: 16, faktor: 1 }]);
  assert.equal(p.gerafftS, 0);
});

test('lehnt Zeiten in falscher Reihenfolge ab', () => {
  assert.throws(
    () => schnittplan({ klickMs: 9_000, ergebnisMs: 5_000, gesamtMs: 16_000, raffungS: 4 }),
    /Reihenfolge/,
  );
});

test('ffmpegFilter trimmt jedes Segment und hängt alle aneinander', () => {
  const p = schnittplan({ klickMs: 5_000, ergebnisMs: 157_000, gesamtMs: 162_000, raffungS: 4 });
  const f = ffmpegFilter(p);
  assert.match(f, /\[0:v\]trim=start=0:end=7,setpts=\(PTS-STARTPTS\)\/1\[s0\]/);
  assert.match(f, /trim=start=7:end=156,setpts=\(PTS-STARTPTS\)\/37\.25\[s1\]/);
  assert.match(f, /\[s0\]\[s1\]\[s2\]concat=n=3:v=1:a=0\[v\]$/);
});

test('startMs schneidet das Laden vor der Lehrenden-Ansicht ab, ab dem Klick fehlt nichts', () => {
  const p = schnittplan({
    startMs: 6_000,
    klickMs: 12_000,
    ergebnisMs: 160_000,
    gesamtMs: 170_000,
    raffungS: 4,
  });
  assert.equal(p.segmente[0].vonS, 6);
  assert.equal(p.segmente[0].bisS, 14);
  assert.equal(p.dauerS, 8 + 4 + 11);
  assert.throws(
    () =>
      schnittplan({
        startMs: 13_000,
        klickMs: 12_000,
        ergebnisMs: 20_000,
        gesamtMs: 30_000,
        raffungS: 4,
      }),
    /Reihenfolge/,
  );
});
