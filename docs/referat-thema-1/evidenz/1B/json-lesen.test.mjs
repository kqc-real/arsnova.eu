import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { liesJson } from './json-lesen.mjs';

const DATEN = { a: 1, b: ['x', 'ä'] };

function mitOrdner(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'json-lesen-'));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('liesJson liest eine .json-Datei', () => {
  mitOrdner((dir) => {
    writeFileSync(join(dir, 'x.json'), JSON.stringify(DATEN));
    assert.deepEqual(liesJson(join(dir, 'x.json')), DATEN);
  });
});

test('liesJson liest eine .json.gz-Datei', () => {
  mitOrdner((dir) => {
    writeFileSync(join(dir, 'x.json.gz'), gzipSync(JSON.stringify(DATEN)));
    assert.deepEqual(liesJson(join(dir, 'x.json.gz')), DATEN);
  });
});

test('liesJson fällt bei fehlender .json auf .json.gz zurück', () => {
  mitOrdner((dir) => {
    writeFileSync(join(dir, 'x.json.gz'), gzipSync(JSON.stringify(DATEN)));
    assert.deepEqual(liesJson(join(dir, 'x.json')), DATEN);
  });
});

test('liesJson bevorzugt eine vorhandene .json', () => {
  mitOrdner((dir) => {
    writeFileSync(join(dir, 'x.json'), JSON.stringify({ q: 'plain' }));
    writeFileSync(join(dir, 'x.json.gz'), gzipSync(JSON.stringify(DATEN)));
    assert.deepEqual(liesJson(join(dir, 'x.json')), { q: 'plain' });
  });
});

test('liesJson wirft, wenn weder .json noch .json.gz existiert', () => {
  mitOrdner((dir) => {
    assert.throws(() => liesJson(join(dir, 'fehlt.json')), /ENOENT/);
  });
});
