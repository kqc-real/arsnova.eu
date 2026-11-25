import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hatTrenner, modellAntworten, pruefeAntworten } from './qualitaetstor.mjs';

const hex = (s) => Buffer.from(s, 'utf8').toString('hex');

function antwortZeile(frame, statements, finish = 'stop') {
  const content = JSON.stringify({
    schemaVersion: 2,
    taskType: 'qa_summary',
    output: {
      status: 'uncertain',
      statements: statements.map((text) => ({ text, sourceIds: ['q:1'] })),
    },
  });
  const body = JSON.stringify({ choices: [{ finish_reason: finish, message: { content } }] });
  return `${frame}\t\t\t${hex(body)}`;
}

test('modellAntworten liest nur Chat-Antworten, in Mitschnitt-Reihenfolge', () => {
  const tsv = [
    `1\tPOST\t2\t${hex('{"model":"x","messages":[]}')}`,
    `2\t\t\t${hex('[{"id":0}]')}`,
    antwortZeile(3, ['Erste Aussage ohne Kopf.', 'Zweite Aussage ohne Kopf.'], 'stop'),
    antwortZeile(5, ['Thema: Erste Aussage mit Kopf.'], 'length'),
  ].join('\n');
  const a = modellAntworten(tsv);
  assert.equal(a.length, 2);
  assert.deepEqual(
    a.map((x) => [x.frame, x.finishReason, x.output.statements.length]),
    [
      [3, 'stop', 2],
      [5, 'length', 1],
    ],
  );
});

test('hatTrenner: Doppelpunkt oder Strich mit Leerzeichen in den ersten 48 Zeichen', () => {
  assert.equal(hatTrenner('Thema: Text.'), true);
  assert.equal(hatTrenner('Thema – Text.'), true);
  assert.equal(hatTrenner('Pending moderation status indicates unresolved questions.'), false);
  assert.equal(hatTrenner(`${'x'.repeat(49)}: Text.`), false);
});

test('pruefeAntworten wendet das echte Qualitätstor der App an', async () => {
  const tsv = [
    antwortZeile(1, ['Ohne Kopf eins hier.', 'Ohne Kopf zwei hier.']),
    antwortZeile(2, [
      'Klausur: Termin und Raum stehen noch nicht fest.',
      'Skript: Kapitel drei fehlt im Lernraum.',
    ]),
  ].join('\n');
  const r = await pruefeAntworten(tsv, 'de');
  assert.deepEqual(
    r.auftraege.map((x) => [x.nr, x.aussagen, x.mitTrenner, x.tor]),
    [
      [1, 2, 0, 'abgelehnt'],
      [2, 2, 2, 'akzeptiert'],
    ],
  );
  assert.equal(r.abgelehnt, 1);
});
