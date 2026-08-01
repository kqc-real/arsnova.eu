#!/usr/bin/env node
/**
 * Browser checks for landing language switchers (desktop + mobile).
 * Expects a static server serving apps/landing/dist (BASE_URL).
 */
import { chromium } from 'playwright';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:4321').replace(/\/+$/, '');

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

async function assertSwitcher(page, buttonId, label) {
  const button = page.locator(`#${buttonId}`);
  await button.waitFor({ state: 'visible' });

  const hasPopup = await button.getAttribute('aria-haspopup');
  if (hasPopup != null) {
    throw new Error(`${label}: aria-haspopup must be absent, got ${JSON.stringify(hasPopup)}`);
  }

  const root = button.locator('xpath=ancestor::*[@data-language-switcher][1]');
  const menu = root.locator('[data-lang-menu]');
  const enLink = menu.locator('a[data-locale-link="en"]');

  const hrefWithHash = await enLink.getAttribute('href');
  if (!hrefWithHash || !hrefWithHash.includes('/en/') || !hrefWithHash.includes('#qa-wall')) {
    throw new Error(`${label}: expected /en/#qa-wall in href before activation, got ${hrefWithHash}`);
  }

  await button.click();
  if ((await button.getAttribute('aria-expanded')) !== 'true') {
    throw new Error(`${label}: menu did not open`);
  }
  if (await menu.evaluate((el) => el.classList.contains('hidden'))) {
    throw new Error(`${label}: menu still hidden after open`);
  }

  await page.keyboard.press('Escape');
  if ((await button.getAttribute('aria-expanded')) !== 'false') {
    throw new Error(`${label}: Escape did not close menu`);
  }
  if ((await page.evaluate(() => document.activeElement?.id)) !== buttonId) {
    throw new Error(`${label}: Escape did not restore focus to trigger`);
  }

  await button.click();
  await page.locator('main').click({ position: { x: 8, y: 8 } });
  if ((await button.getAttribute('aria-expanded')) !== 'false') {
    throw new Error(`${label}: outside click did not close menu`);
  }

  await page.evaluate(() => {
    window.location.hash = '#fragenwand';
  });
  await page.waitForFunction(() => {
    const link = document.querySelector('[data-language-switcher] a[data-locale-link="en"]');
    return link?.getAttribute('href')?.includes('#qa-wall') ?? false;
  });
  const afterAlias = await enLink.getAttribute('href');
  if (!afterAlias?.includes('#qa-wall')) {
    throw new Error(`${label}: hashchange alias fragenwand not canonicalized to #qa-wall (${afterAlias})`);
  }
}

async function runViewport(browser, viewport, buttonId, label) {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport,
  });
  const page = await context.newPage();
  try {
    await page.goto(`${BASE_URL}/de/#qa-wall`, {
      waitUntil: 'domcontentloaded',
      timeout: 20_000,
    });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
    await assertSwitcher(page, buttonId, label);
  } finally {
    await context.close();
  }
}

async function main() {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  try {
    await runViewport(browser, { width: 1280, height: 900 }, 'lang-desktop-button', 'desktop');
    await runViewport(browser, { width: 390, height: 844 }, 'lang-mobile-button', 'mobile');
  } finally {
    await browser.close();
  }
  console.log('Language switcher checks passed (desktop + mobile).');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
