#!/usr/bin/env node
/**
 * Screenshot matrix for Issue #199 (light/dark × 320/768/1440).
 * Writes under apps/landing/test-artifacts/theme-screenshots/.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:4321').replace(/\/+$/, '');
const outDir = join(dirname(fileURLToPath(import.meta.url)), '../test-artifacts/theme-screenshots');
const viewports = [
  { name: '320', width: 320, height: 720 },
  { name: '768', width: 768, height: 1024 },
  { name: '1440', width: 1440, height: 900 },
];
const locales = ['de', 'es']; // DE + typically longest Romance layout

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${BASE_URL}/de/`);
      if (response.ok) return;
    } catch {
      // still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Landing unter ${BASE_URL} nicht erreichbar.`);
}

async function shot(page, name) {
  const path = join(outDir, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  console.log('wrote', path);
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const locale of locales) {
      for (const mode of ['light', 'dark']) {
        for (const vp of viewports) {
          const context = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            colorScheme: mode,
            reducedMotion: 'reduce',
          });
          const page = await context.newPage();
          await page.addInitScript((m) => {
            localStorage.setItem('arsnova-info-color-scheme-v1', m);
          }, mode);
          await page.goto(`${BASE_URL}/${locale}/`, { waitUntil: 'networkidle', timeout: 30_000 });
          await page.evaluate((m) => {
            document.documentElement.classList.remove('light', 'dark');
            document.documentElement.classList.add(m);
            document.documentElement.style.colorScheme = m;
          }, mode);

          await shot(page, `${locale}-${mode}-${vp.name}-hero`);

          if (vp.name === '1440' && locale === 'de') {
            await page.locator('#features').scrollIntoViewIfNeeded();
            await shot(page, `${locale}-${mode}-${vp.name}-features`);
            await page.locator('#trust').scrollIntoViewIfNeeded();
            await shot(page, `${locale}-${mode}-${vp.name}-trust`);
            await page.locator('#faq').scrollIntoViewIfNeeded();
            await shot(page, `${locale}-${mode}-${vp.name}-faq`);
            await page.locator('footer').scrollIntoViewIfNeeded();
            await shot(page, `${locale}-${mode}-${vp.name}-footer`);

            await page.evaluate(() => window.scrollTo(0, 0));
            await page.locator('#theme-desktop-button').click();
            await shot(page, `${locale}-${mode}-${vp.name}-theme-open`);
            await page.keyboard.press('Escape');
          }

          if (vp.name === '320' && locale === 'de') {
            await page.locator('#nav-toggle').click();
            await shot(page, `${locale}-${mode}-${vp.name}-mobile-nav`);
            await page.keyboard.press('Escape').catch(() => undefined);
            await page.locator('#nav-toggle').click().catch(() => undefined);
            // Ensure nav closed before theme menu screenshot (mutual exclusion).
            await page.evaluate(() => {
              const menu = document.getElementById('nav-menu');
              const toggle = document.getElementById('nav-toggle');
              if (menu) menu.classList.add('hidden');
              if (toggle) {
                toggle.setAttribute('aria-expanded', 'false');
              }
            });
            await page.locator('#theme-mobile-button').click();
            await shot(page, `${locale}-${mode}-${vp.name}-theme-open`);
          }

          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  console.log('Screenshot matrix written to', outDir);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
