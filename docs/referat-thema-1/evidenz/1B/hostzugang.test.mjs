// Prüft die Erneuerung des Host-Tokens im Treiber (hostzugang.mjs).
// Anlass: Lauf 2026-11-13, Auftrag 6 von 10 scheiterte nach 14 min mit UNAUTHORIZED,
// weil Host-Tokens nach 15 min ablaufen (DEFAULT_HOST_SESSION_TTL_SECONDS in hostAuth.ts).
// Aufruf: node --test docs/referat-thema-1/evidenz/1B/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hostZugang } from './hostzugang.mjs';

function uhr() {
  let t = 0;
  return { jetztMs: () => t, vor: (ms) => (t += ms) };
}

test('liefert den Start-Token, solange er jünger als maxAlterMs ist', async () => {
  const u = uhr();
  let erneuert = 0;
  const token = hostZugang({
    start: 'A',
    erneuern: async () => `N${++erneuert}`,
    jetztMs: u.jetztMs,
    maxAlterMs: 600_000,
  });
  assert.equal(await token(), 'A');
  u.vor(599_999);
  assert.equal(await token(), 'A');
  assert.equal(erneuert, 0);
});

test('erneuert nach maxAlterMs und danach erst wieder nach maxAlterMs', async () => {
  const u = uhr();
  let erneuert = 0;
  const token = hostZugang({
    start: 'A',
    erneuern: async () => `N${++erneuert}`,
    jetztMs: u.jetztMs,
    maxAlterMs: 600_000,
  });
  u.vor(600_000);
  assert.equal(await token(), 'N1');
  u.vor(300_000);
  assert.equal(await token(), 'N1');
  u.vor(300_000);
  assert.equal(await token(), 'N2');
  assert.equal(erneuert, 2);
});

test('ein Fehler beim Erneuern geht an den Aufrufer, der alte Token bleibt nicht stehen', async () => {
  const u = uhr();
  const token = hostZugang({
    start: 'A',
    erneuern: async () => {
      throw new Error('UNAUTHORIZED');
    },
    jetztMs: u.jetztMs,
    maxAlterMs: 1000,
  });
  u.vor(1000);
  await assert.rejects(token(), /UNAUTHORIZED/);
});

// Clip (2026-11-15): Der Treiber schreibt den Host-Zugang für die Browser-Aufnahme in eine
// Datei nur für den Besitzer; sie bleibt im Laborordner, nie im Repo.
test('zugangSchreiben legt die Datei mit Modus 0600 und nur den drei Feldern an', async () => {
  const { mkdtempSync, statSync, readFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { zugangSchreiben } = await import('./hostzugang.mjs');
  const pfad = join(mkdtempSync(join(tmpdir(), 'zugang-')), 'zugang.json');
  zugangSchreiben(pfad, { code: 'ABC123', hostToken: 't', hostBrowserCapability: 'c', x: 1 });
  assert.equal(statSync(pfad).mode & 0o777, 0o600);
  assert.deepEqual(JSON.parse(readFileSync(pfad, 'utf8')), {
    code: 'ABC123',
    hostToken: 't',
    hostBrowserCapability: 'c',
  });
  assert.throws(
    () => zugangSchreiben(pfad, { code: 'X', hostToken: 't', hostBrowserCapability: 'c' }),
    /EEXIST/,
  );
});
