import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateiDaten, timingsAusTshark, ersterPostBody } from './timings.mjs';

const hex = (s) => Buffer.from(s, 'utf8').toString('hex');
const antwort = (t) => JSON.stringify({ choices: [{ message: { content: 'x' } }], timings: t });
const T1 = {
  prompt_n: 900,
  prompt_ms: 50000.5,
  predicted_n: 300,
  predicted_ms: 90000.25,
  cache_n: 0,
};
const T2 = { prompt_ms: 40000, predicted_ms: 80000, cache_n: 12 };

// Zeilen: frame.number, http.request.method, http.response_in, http.file_data
const zeilen = (rows) => rows.map((r) => r.join('\t')).join('\n') + '\n';

test('dateiDaten liest Text und Hex', () => {
  assert.equal(dateiDaten('{"a":1}'), '{"a":1}');
  assert.equal(dateiDaten(hex('{"a":1}')), '{"a":1}');
  assert.equal(dateiDaten(''), '');
});

test('timings je POST in POST-Reihenfolge, GET ignoriert', () => {
  const text = zeilen([
    ['10', 'GET', '11', ''],
    ['11', '', '', '[{"id":0}]'],
    ['20', 'POST', '30', hex('{"messages":[]}')],
    ['30', '', '', hex(antwort(T1))],
    ['40', 'POST', '45', '{"messages":[]}'],
    ['45', '', '', antwort(T2)],
  ]);
  assert.deepEqual(timingsAusTshark(text), [
    { prompt_ms: 50000.5, predicted_ms: 90000.25, cache_n: 0 },
    { prompt_ms: 40000, predicted_ms: 80000, cache_n: 12 },
  ]);
});

test('POST ohne Antwort oder ohne timings ergibt null', () => {
  const text = zeilen([
    ['20', 'POST', '', '{}'],
    ['40', 'POST', '41', '{}'],
    ['41', '', '', '{"error":{"code":500}}'],
  ]);
  assert.deepEqual(timingsAusTshark(text), [null, null]);
});

test('Reihenfolge nach Frame-Nummer, nicht nach Zeilenfolge', () => {
  const text = zeilen([
    ['40', 'POST', '45', '{}'],
    ['45', '', '', antwort(T2)],
    ['20', 'POST', '30', '{}'],
    ['30', '', '', antwort(T1)],
  ]);
  assert.equal(timingsAusTshark(text)[0].prompt_ms, 50000.5);
});

test('ersterPostBody liefert den Body des ersten POST', () => {
  const text = zeilen([
    ['40', 'POST', '45', hex('{"n":2}')],
    ['20', 'POST', '30', hex('{"n":1}')],
  ]);
  assert.equal(ersterPostBody(text), '{"n":1}');
  assert.throws(() => ersterPostBody(zeilen([['1', 'GET', '', '']])), /kein POST/);
});
