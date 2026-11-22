import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { niklasSeiten } from './niklas-seiten.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const requireRepo = createRequire(resolve(HIER, '../../../../package.json'));

/** Erzeugt ein einseitiges 16:9-PDF (Chromium, Playwright aus den Repo-Abhängigkeiten). */
async function erzeugeTestPdf(pfad) {
  const { chromium } = requireRepo('playwright');
  const browser = await chromium.launch();
  try {
    const seite = await browser.newPage();
    await seite.setContent('<body style="margin:0"><h1>Test</h1></body>');
    await seite.pdf({ path: pfad, width: '1280px', height: '720px', printBackground: true });
  } finally {
    await browser.close();
  }
}

/** Breite und Höhe aus dem PNG-IHDR (Bytes 16–23, big endian). */
function pngGroesse(pfad) {
  const kopf = readFileSync(pfad);
  return { breite: kopf.readUInt32BE(16), hoehe: kopf.readUInt32BE(20) };
}

test('einseitiges PDF ergibt eine 1600 px breite PNG', async () => {
  const ordner = mkdtempSync(join(tmpdir(), 'niklas-seiten-'));
  try {
    const pdf = join(ordner, 'test.pdf');
    await erzeugeTestPdf(pdf);
    const aus = join(ordner, 'aus');
    const seiten = await niklasSeiten(pdf, aus);
    assert.equal(seiten.length, 1);
    assert.match(seiten[0], /\.png$/);
    const { breite, hoehe } = pngGroesse(seiten[0]);
    assert.equal(breite, 1600);
    assert.equal(hoehe, 900);
  } finally {
    rmSync(ordner, { recursive: true, force: true });
  }
});

test('fehlendes PDF liefert [] ohne Ausnahme', async () => {
  const ordner = mkdtempSync(join(tmpdir(), 'niklas-seiten-'));
  try {
    assert.deepEqual(
      await niklasSeiten(join(ordner, 'gibt-es-nicht.pdf'), join(ordner, 'aus')),
      [],
    );
  } finally {
    rmSync(ordner, { recursive: true, force: true });
  }
});
