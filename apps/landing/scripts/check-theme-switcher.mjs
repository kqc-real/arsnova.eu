#!/usr/bin/env node
/**
 * Browser checks for landing theme switcher (Issue #199).
 * Expects a static server serving apps/landing/dist (BASE_URL).
 */
import { chromium } from 'playwright';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:4321').replace(/\/+$/, '');
const STORAGE_KEY = 'arsnova-info-color-scheme-v1';

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

async function assertThemeSwitcher(page, buttonId, label) {
  const button = page.locator(`#${buttonId}`);
  await button.waitFor({ state: 'visible' });

  const hasPopup = await button.getAttribute('aria-haspopup');
  if (hasPopup != null) {
    throw new Error(`${label}: aria-haspopup must be absent, got ${JSON.stringify(hasPopup)}`);
  }

  const box = await button.boundingBox();
  if (!box || box.width < 44 || box.height < 44) {
    throw new Error(`${label}: touch target below 44×44 (got ${box?.width}×${box?.height})`);
  }

  const root = button.locator('xpath=ancestor::*[@data-theme-switcher][1]');
  const menu = root.locator('[data-theme-menu]');

  await button.click();
  if ((await button.getAttribute('aria-expanded')) !== 'true') {
    throw new Error(`${label}: menu did not open`);
  }
  if (await menu.evaluate((el) => el.classList.contains('hidden'))) {
    throw new Error(`${label}: menu still hidden after open`);
  }

  const darkOption = menu.locator('[data-theme-option="dark"]');
  await darkOption.click();
  if ((await button.getAttribute('aria-expanded')) !== 'false') {
    throw new Error(`${label}: selecting option did not close menu`);
  }
  if ((await page.evaluate(() => document.activeElement?.id)) !== buttonId) {
    throw new Error(`${label}: focus not restored to trigger after selection`);
  }

  const stored = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  if (stored !== 'dark') {
    throw new Error(`${label}: expected localStorage ${STORAGE_KEY}=dark, got ${stored}`);
  }
  const htmlClass = await page.evaluate(() => document.documentElement.className);
  if (!htmlClass.includes('dark')) {
    throw new Error(`${label}: html.dark not applied after choosing dark`);
  }

  await page.reload({ waitUntil: 'domcontentloaded' });
  const afterReload = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  if (afterReload !== 'dark') {
    throw new Error(`${label}: preference not persisted across reload`);
  }
  const classAfterReload = await page.evaluate(() => document.documentElement.className);
  if (!classAfterReload.includes('dark')) {
    throw new Error(`${label}: dark class missing after reload`);
  }

  await button.click();
  await page.keyboard.press('Escape');
  if ((await button.getAttribute('aria-expanded')) !== 'false') {
    throw new Error(`${label}: Escape did not close menu`);
  }
  if ((await page.evaluate(() => document.activeElement?.id)) !== buttonId) {
    throw new Error(`${label}: Escape did not restore focus to trigger`);
  }

  // Mutual exclusion with language switcher when both visible
  const langButton = page.locator('#lang-desktop-button, #lang-mobile-button').first();
  if (await langButton.isVisible()) {
    await button.click();
    await langButton.click();
    if ((await button.getAttribute('aria-expanded')) !== 'false') {
      throw new Error(`${label}: language menu did not close theme menu`);
    }
  }

  // System preference reactivity
  await page.evaluate((key) => {
    localStorage.setItem(key, 'system');
    document.documentElement.setAttribute('data-landing-color-scheme', 'system');
    window.__arsnovaLandingTheme.apply('system');
  }, STORAGE_KEY);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.evaluate(() => window.__arsnovaLandingTheme.apply('system'));
  let scheme = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
  if (!scheme.includes('light')) {
    throw new Error(`${label}: system+light OS did not resolve to light color-scheme (${scheme})`);
  }
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(() => window.__arsnovaLandingTheme.apply('system'));
  scheme = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
  if (!scheme.includes('dark')) {
    throw new Error(`${label}: system+dark OS did not resolve to dark color-scheme (${scheme})`);
  }

  // Fallback without stored value
  await page.evaluate((key) => {
    localStorage.removeItem(key);
    document.documentElement.removeAttribute('data-landing-color-scheme');
    window.__arsnovaLandingTheme.apply('system');
  }, STORAGE_KEY);
  const fallbackAttr = await page.evaluate(() => {
    window.__arsnovaLandingTheme.set('system');
    return document.documentElement.getAttribute('data-landing-color-scheme');
  });
  if (fallbackAttr !== 'system') {
    throw new Error(`${label}: fallback without stored value failed`);
  }
}

async function assertNoJsPrefersColorScheme(browser) {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    colorScheme: 'dark',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  try {
    await page.goto(`${BASE_URL}/de/`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    // Dark background should not be near-white when prefers-color-scheme: dark and JS off
    const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) throw new Error(`no-js: could not parse body background ${bg}`);
    const [, r, g, b] = match.map(Number);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    if (luminance > 0.5) {
      throw new Error(`no-js: expected dark background under prefers-color-scheme:dark, got ${bg}`);
    }
  } finally {
    await context.close();
  }
}

async function assertReducedMotion(browser) {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    colorScheme: 'dark',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  try {
    await page.goto(`${BASE_URL}/de/`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    const duration = await page.evaluate(() => {
      const el = document.querySelector('.landing-hero-spotlight');
      if (!el) return 'missing';
      return getComputedStyle(el).animationDuration;
    });
    if (duration === 'missing') throw new Error('reduced-motion: hero spotlight missing');
    const seconds = parseFloat(duration);
    if (!Number.isFinite(seconds) || seconds > 0.05) {
      throw new Error(`reduced-motion: expected near-zero animation, got ${duration}`);
    }
  } finally {
    await context.close();
  }
}

async function assertOverflow(browser) {
  for (const width of [320, 768]) {
    const context = await browser.newContext({
      viewport: { width, height: Math.round(width * 1.8) },
      deviceScaleFactor: width === 320 ? 2 : 1,
    });
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}/de/`, { waitUntil: 'networkidle', timeout: 20_000 });
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          clientWidth: doc.clientWidth,
          scrollWidth: doc.scrollWidth,
        };
      });
      if (overflow.scrollWidth > overflow.clientWidth + 1) {
        throw new Error(
          `horizontal overflow at ${width}px: scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth}`,
        );
      }
    } finally {
      await context.close();
    }
  }
}

async function runViewport(browser, viewport, buttonId, label) {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    colorScheme: 'light',
    viewport,
  });
  const page = await context.newPage();
  try {
    await page.goto(`${BASE_URL}/de/`, {
      waitUntil: 'domcontentloaded',
      timeout: 20_000,
    });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
    await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await assertThemeSwitcher(page, buttonId, label);
  } finally {
    await context.close();
  }
}

async function main() {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  try {
    await runViewport(browser, { width: 1280, height: 900 }, 'theme-desktop-button', 'desktop');
    await runViewport(browser, { width: 390, height: 844 }, 'theme-mobile-button', 'mobile');
    await assertNoJsPrefersColorScheme(browser);
    await assertReducedMotion(browser);
    await assertOverflow(browser);
  } finally {
    await browser.close();
  }
  console.log('Theme switcher checks passed (desktop + mobile + no-js + motion + overflow).');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
