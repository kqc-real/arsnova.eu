#!/usr/bin/env node
/**
 * Erzeugt Screenshots der aktuellen Startseite für die PWA-Manifest.
 *
 * Voraussetzung: Die App wird unter der angegebenen URL ausgeliefert (nicht nur eine Verzeichnisliste).
 * - Dev:  ng serve (EN: development-en)  →  SCREENSHOT_URL nicht nötig (Default: http://localhost:4200/en/)
 * - Prod: npm run start:prod  →  SCREENSHOT_URL=http://localhost:3000 npm run screenshots
 * - Oder: Nach Build index.csr.html nach index.html kopieren, dann  npx serve dist/browser -p 4210 -s
 *        und  SCREENSHOT_URL=http://localhost:4210 npm run screenshots
 *
 * Run: npm run screenshots  (aus apps/frontend) oder  node apps/frontend/scripts/capture-screenshots.mjs
 */
import { chromium, webkit } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'src', 'assets', 'icons');
const distBrowser = join(__dirname, '..', 'dist', 'browser');
const BASE_URL = process.env.SCREENSHOT_URL || 'http://localhost:4200/en/';

async function waitForServer(url, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // Server nicht bereit
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  // Bei Production-Build: index.html für / erzeugen, damit "npx serve dist/browser" die App ausliefert (nicht Verzeichnisliste)
  const csrPath = join(distBrowser, 'index.csr.html');
  const indexPath = join(distBrowser, 'index.html');
  if (existsSync(csrPath) && !existsSync(indexPath)) {
    copyFileSync(csrPath, indexPath);
    console.log('dist/browser/index.html aus index.csr.html erzeugt (für Static-Serve).');
  }

  console.log(`Warte auf ${BASE_URL}…`);
  const ready = await waitForServer(BASE_URL);
  if (!ready) {
    console.error(
      'App nicht erreichbar. Starte z. B.: npm run dev:frontend (DE, Root) oder npm run dev:frontend:en (/en/), oder npm run start:prod (dann SCREENSHOT_URL=http://localhost:3000).',
    );
    process.exit(1);
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch {
    browser = await webkit.launch({ headless: true });
  }
  const context = await browser.newContext({
    viewport: null,
    userAgent: 'Mozilla/5.0 (compatible; ScreenshotBot/1.0)',
  });

  const page = await context.newPage();

  // Warten bis die echte Home-Ansicht da ist (nicht nur LCP-Shell / Verzeichnisliste)
  const waitForHome = async () => {
    await page.waitForSelector('app-home', { state: 'attached', timeout: 25_000 });
    await page.waitForSelector('.top-toolbar', { state: 'visible', timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(800);
  };

  // Dark Mode + Spielerisch-Preset für Screenshots (nach Load setzen)
  const applyScreenshotTheme = () =>
    page.evaluate(() => {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark', 'preset-playful');
    });

  // Desktop: 1280x720
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const isDirListing = await page.evaluate(() =>
    document.title?.includes('Index of') || document.body?.innerText?.includes('Index of') || false
  );
  if (isDirListing) {
    await browser.close();
    console.error(
      'Die URL liefert eine Verzeichnisliste statt der App. ' +
        'Nutze den Backend-Server (npm run start:prod, dann SCREENSHOT_URL=http://localhost:3000) ' +
        'oder nach Build index.csr.html nach dist/browser/index.html kopieren und serve neu starten.'
    );
    process.exit(1);
  }
  await waitForHome();
  await page.waitForTimeout(600); // Lazy-Chunks / Icons nachladen
  await applyScreenshotTheme();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: join(iconsDir, 'screenshot-wide.png'),
    fullPage: false,
  });
  console.log('Generated screenshot-wide.png (1280x720, dark, spielerisch)');

  // Mobile: 390x844
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await waitForHome();
  await page.waitForTimeout(600);
  await applyScreenshotTheme();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: join(iconsDir, 'screenshot-narrow.png'),
    fullPage: false,
  });
  console.log('Generated screenshot-narrow.png (390x844, dark, spielerisch)');

  await browser.close();
  console.log('Fertig.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
