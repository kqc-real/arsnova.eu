import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ladeReihendefinition } from './resource-isolation-series.mjs';

const quelle = 'docs/referat-thema-1/specs/2026-11-14-1a-messreihe-main-a19ca70f.json';

test('bindet die neue Baseline, Quellenhashes, Fixture und das PDF-Prozesslimit', async () => {
  const reihe = await ladeReihendefinition(quelle);
  assert.equal(reihe.baselineCommit, 'a19ca70ff37dcb5510a77ab2745c06b70ccc3565');
  assert.equal(reihe.pdfWorkerPidsLimit, 256);
  assert.equal(reihe.requiresResolvedCompose, true);
  assert.match(reihe.definitionSha256, /^[a-f0-9]{64}$/);
});

test('verweigert unklare Baselines, veränderte Quellen und abgeschaltete Compose-Nachweise', async (t) => {
  const ordner = await mkdtemp(join(tmpdir(), 'a1-definition-'));
  t.after(() => rm(ordner, { recursive: true, force: true }));
  const original = JSON.parse(await readFile(quelle, 'utf8'));
  const file = join(ordner, 'definition.json');
  for (const aenderung of [
    { baselineCommit: 'main' },
    { contractSha256: 'a'.repeat(64) },
    { addendumSha256: 'b'.repeat(64) },
    { addendumFile: '../../.env' },
    { fixtureSha256: 'c'.repeat(64) },
    { orderSeed: 0 },
    { pdfWorkerPidsLimit: 0 },
    { requiresResolvedCompose: false },
  ]) {
    await writeFile(file, JSON.stringify({ ...original, ...aenderung }));
    await assert.rejects(() => ladeReihendefinition(file));
  }
});
