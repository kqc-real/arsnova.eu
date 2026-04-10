#!/usr/bin/env node
/**
 * Erzeugt docs/screenshots/Peer-Instruction-Host-Hinweis.png aus der statischen Vorschau
 * docs/ui/peer-instruction-hint-flow-preview.html (Host-Hinweis + Steuerung).
 *
 * Voraussetzung: playwright installiert (Workspace frontend).
 * Aufruf: node apps/frontend/scripts/capture-peer-instruction-hint-doc-screenshot.mjs
 */
import { chromium, webkit } from 'playwright';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Von apps/frontend/scripts/ drei Ebenen zum Repo-Root */
const repoRoot = join(__dirname, '..', '..', '..');
const previewHtml = join(repoRoot, 'docs/ui/peer-instruction-hint-flow-preview.html');
const outPng = join(repoRoot, 'docs/screenshots/Peer-Instruction-Host-Hinweis.png');

async function main() {
  const fileUrl = pathToFileURL(previewHtml).href;
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch {
    browser = await webkit.launch({ headless: true });
  }
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
  });
  await page.goto(fileUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('.ui-section', { state: 'visible' });
  const box = await page.locator('.ui-section').boundingBox();
  if (!box) {
    await browser.close();
    throw new Error('.ui-section nicht sichtbar');
  }
  const pad = 16;
  await page.screenshot({
    path: outPng,
    clip: {
      x: Math.max(0, box.x - pad),
      y: Math.max(0, box.y - pad),
      width: box.width + pad * 2,
      height: box.height + pad * 2,
    },
  });
  await browser.close();
  console.log('Geschrieben:', outPng);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
