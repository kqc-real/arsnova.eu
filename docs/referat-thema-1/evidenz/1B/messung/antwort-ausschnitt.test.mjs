import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ausschnitt } from './antwort-ausschnitt.mjs';

const hex = (s) => Buffer.from(s, 'utf8').toString('hex');

function antwortZeile(frame, statements, kopf = '') {
  const content = JSON.stringify({
    schemaVersion: 2,
    taskType: 'qa_summary',
    output: {
      status: 'uncertain',
      statements: statements.map((text) => ({ text, sourceIds: ['q:1'] })),
    },
  });
  const body = JSON.stringify({
    choices: [{ finish_reason: 'stop', message: { content } }],
    usage: { kanarienvogelAntwort: 'KANARIE-ANTWORT' },
  });
  return `${frame}\t${kopf}\t\t${hex(body)}`;
}

const tsv = [
  `1\tPOST\tAuthorization: Bearer abc\t${hex('{"model":"x","messages":[{"content":"KANARIE-ANFRAGE"}]}')}`,
  antwortZeile(2, ['Pending moderation status indicates unresolved questions.', 'Second one.']),
  antwortZeile(4, ['Klausur: Termin steht fest.', 'Skript: Kapitel fehlt.'], 'Bearer abc'),
].join('\n');

test('ausschnitt liefert nur Modellausgabe und Torergebnis, ohne Kopfzeilen oder Token', async () => {
  const r = await ausschnitt(tsv, { auftrag: 1, maxZeichen: 40 });
  const text = JSON.stringify({ ...r, quelleSha256: undefined });
  for (const verboten of ['Bearer', 'abc', 'Authorization', 'KANARIE', 'usage', 'messages']) {
    assert.equal(text.includes(verboten), false, `${verboten} im Ausschnitt`);
  }
  assert.deepEqual(
    Object.keys(r).sort(),
    [
      'aussagen',
      'auftrag',
      'ausgabe',
      'finishReason',
      'grund',
      'locale',
      'mitTrenner',
      'quelleSha256',
      'status',
      'torAkzeptiert',
    ].sort(),
  );
  assert.equal(r.auftrag, 1);
  assert.equal(r.torAkzeptiert, false);
  assert.equal(r.aussagen, 2);
  assert.equal(r.mitTrenner, 0);
  assert.ok(r.ausgabe.length <= 40);
  assert.ok(r.ausgabe.startsWith('Pending moderation'));
  assert.match(r.grund, /Stichwort: Text/);
  assert.equal(r.quelleSha256, createHash('sha256').update(tsv).digest('hex'));
});

test('ausschnitt meldet ein akzeptiertes Ergebnis ehrlich und lehnt fehlende Aufträge ab', async () => {
  const r = await ausschnitt(tsv, { auftrag: 2, maxZeichen: 200 });
  assert.equal(r.torAkzeptiert, true);
  assert.equal(r.grund, null);
  await assert.rejects(() => ausschnitt(tsv, { auftrag: 3, maxZeichen: 200 }), /Auftrag 3/);
});
