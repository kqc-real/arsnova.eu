#!/usr/bin/env node
/**
 * Screenshot matrix for Issue #199 (light/dark × 320/768/1440).
 * Writes under apps/landing/test-artifacts/theme-screenshots/.
 *
 * Longest non-DE locale is chosen programmatically from nav + theme + language
 * label lengths (see printed metrics and README).
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:4321').replace(/\/+$/, '');
const outDir = join(dirname(fileURLToPath(import.meta.url)), '../test-artifacts/theme-screenshots');
const i18nDir = join(dirname(fileURLToPath(import.meta.url)), '../src/i18n');
const viewports = [
  { name: '320', width: 320, height: 720 },
  { name: '768', width: 768, height: 1024 },
  { name: '1440', width: 1440, height: 900 },
];

function pick(src, re) {
  const m = src.match(re);
  return m ? m[1] : '';
}

function pickLocales() {
  const codes = ['de', 'en', 'fr', 'es', 'it'];
  const lengths = [];
  for (const code of codes) {
    const src = readFileSync(join(i18nDir, `${code}.ts`), 'utf8');
    const navParts = [
      pick(src, /workflow:\s*'([^']+)'/),
      pick(src, /features:\s*'([^']+)'/),
      pick(src, /accessibility:\s*'([^']+)'/),
      pick(src, /trust:\s*'([^']+)'/),
      pick(src, /comparison:\s*'([^']+)'/),
      pick(src, /faq:\s*'([^']+)'/),
      pick(src, /tryNow:\s*'([^']+)'/),
    ];
    const themeParts = [
      pick(src, /themeSwitcher:\s*\{[\s\S]*?label:\s*'([^']+)'/),
      pick(src, /system:\s*'([^']+)'/),
      pick(src, /chooseAppearance:\s*'([^']+)'/),
    ];
    const langParts = [
      pick(src, /languageSwitcher:\s*\{[\s\S]*?label:\s*'([^']+)'/),
      pick(src, /currentLanguage:\s*'([^']+)'/),
      pick(src, /chooseLanguage:\s*'([^']+)'/),
    ];
    const combined = [...navParts, ...themeParts, ...langParts].join('');
    lengths.push({
      code,
      length: combined.length,
      nav: navParts.join('').length,
      theme: themeParts.join('').length,
    });
  }
  lengths.sort((a, b) => b.length - a.length);
  console.log('Locale label-length metrics (nav + theme + language strings):');
  for (const row of lengths) {
    console.log(`  ${row.code}: total=${row.length} (nav=${row.nav}, theme=${row.theme})`);
  }
  const longestNonDe = lengths.find((row) => row.code !== 'de') ?? lengths[0];
  console.log(
    `Selecting longest non-DE locale for matrix: ${longestNonDe.code} (total=${longestNonDe.length}).`,
  );
  return ['de', longestNonDe.code];
}

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
  const locales = pickLocales();
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
            await page
              .locator('#nav-toggle')
              .click()
              .catch(() => undefined);
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

    // Nachher-Referenz: Hero der aktuellen Magenta/Violett-Matrix.
    const afterContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: 'light',
      reducedMotion: 'reduce',
    });
    const afterPage = await afterContext.newPage();
    await afterPage.addInitScript(() => {
      localStorage.setItem('arsnova-info-color-scheme-v1', 'light');
    });
    await afterPage.goto(`${BASE_URL}/de/`, { waitUntil: 'networkidle', timeout: 30_000 });
    await shot(afterPage, 'after-de-light-1440-hero');
    await afterContext.close();
  } finally {
    await browser.close();
  }
  console.log('Screenshot matrix written to', outDir);
  console.log(
    'Note: Vorher-Referenz = Sky-Blue Landing on main before #199; Nachher = this matrix (+ after-*-hero).',
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
