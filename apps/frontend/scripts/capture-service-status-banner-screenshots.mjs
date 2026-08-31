#!/usr/bin/env node
/**
 * Screenshots: Service-Status-Banner (gelb/rot) auf Smartphone und Tablet.
 *
 * Voraussetzung: ng serve unter SCREENSHOT_URL (Default http://localhost:4200/).
 * Preset: PRESET=spielerisch|serious (Default: spielerisch).
 * Theme:  THEME=light|dark (Default: light).
 *
 * Run: node apps/frontend/scripts/capture-service-status-banner-screenshots.mjs
 *      PRESET=serious THEME=dark node apps/frontend/scripts/capture-service-status-banner-screenshots.mjs
 */
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../../../docs/screenshots');
const BASE_URL = (process.env.SCREENSHOT_URL || 'http://localhost:4200/').replace(/\/+$/, '') + '/';

const PRESET_RAW = String(process.env.PRESET || 'spielerisch')
  .trim()
  .toLowerCase();
const PRESET = PRESET_RAW === 'serious' || PRESET_RAW === 'serioes' ? 'serious' : 'spielerisch';
const PRESET_SUFFIX = PRESET === 'spielerisch' ? 'playful' : 'serious';

const THEME_RAW = String(process.env.THEME || 'light')
  .trim()
  .toLowerCase();
const THEME = THEME_RAW === 'dark' ? 'dark' : 'light';
const THEME_SUFFIX = THEME === 'dark' ? '-dark' : '';

const VIEWPORTS = [
  { name: 'smartphone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
];

const LEVELS = [
  { name: 'yellow', arg: 'yellow', expectClass: 'app-service-status-banner--busy' },
  { name: 'red', arg: 'red', expectClass: 'app-service-status-banner--critical' },
];

async function waitForUrl(url, maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`URL not ready: ${url}`);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  await waitForUrl(BASE_URL);

  const browser = await chromium.launch({ headless: true });
  const paths = [];

  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 2,
        colorScheme: THEME,
      });
      const page = await context.newPage();
      await page.addInitScript(
        ({ preset, theme }) => {
          try {
            sessionStorage.setItem('arsnova-motd-suppress-overlay-once', '1');
            localStorage.setItem('home-preset', preset);
            localStorage.setItem('home-theme', theme);
          } catch {
            /* private mode */
          }
        },
        { preset: PRESET, theme: THEME },
      );
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      await page.waitForFunction(
        () =>
          !!document.querySelector('app-root') &&
          typeof window.__triggerServiceStatusBanner === 'function',
        null,
        { timeout: 30_000 },
      );
      await page.evaluate(
        ({ preset, theme }) => {
          document.documentElement.classList.toggle('preset-playful', preset === 'spielerisch');
          document.documentElement.classList.remove('dark', 'light');
          document.documentElement.classList.add(theme);
        },
        { preset: PRESET, theme: THEME },
      );
      const motdClose = page.locator('.home-motd-sheet button[aria-label]').first();
      if (await motdClose.count()) {
        await motdClose.click({ timeout: 3_000 }).catch(() => {});
        await page
          .locator('.home-motd-layer')
          .waitFor({ state: 'detached', timeout: 5_000 })
          .catch(() => {});
      }

      for (const level of LEVELS) {
        await page.evaluate((lvl) => {
          window.__triggerServiceStatusBanner(lvl);
        }, level.arg);
        await page.waitForSelector(`.app-service-status-banner.${level.expectClass}`, {
          state: 'visible',
          timeout: 10_000,
        });
        await page.evaluate(() => window.scrollTo(0, 0));
        await new Promise((r) => setTimeout(r, 250));

        const fileName = `service-status-banner-${level.name}-${viewport.name}-${PRESET_SUFFIX}${THEME_SUFFIX}.png`;
        const filePath = join(OUT_DIR, fileName);
        await page.screenshot({ path: filePath, fullPage: false });
        paths.push(filePath);
        console.log(`wrote ${fileName}`);
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }

  console.log(`Done (preset=${PRESET}, theme=${THEME}):`);
  for (const p of paths) console.log(`  ${p}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
