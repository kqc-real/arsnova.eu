#!/usr/bin/env node
/**
 * Browser checks for landing language switchers, deep links, sticky-header
 * jump targets, and a keyboard smoke path (Issue #192 / #198).
 * Expects a static server serving apps/landing/dist (BASE_URL).
 */
import { chromium } from 'playwright';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:4321').replace(/\/+$/, '');

const DEEP_LINKS = [
  'features',
  'numeric-estimate',
  'confidence',
  'qa-wall',
  'comparison',
  'workflow',
];

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

async function assertSwitcher(page, buttonId, label, hash = '#qa-wall') {
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
  if (!hrefWithHash || !hrefWithHash.includes('/en/') || !hrefWithHash.includes(hash)) {
    throw new Error(
      `${label}: expected /en/${hash} in href before activation, got ${hrefWithHash}`,
    );
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
    throw new Error(
      `${label}: hashchange alias fragenwand not canonicalized to #qa-wall (${afterAlias})`,
    );
  }

  // Spotlight deep links must survive language switching even when not in main nav.
  for (const spotlight of ['numeric-estimate', 'confidence', 'qa-wall']) {
    await page.evaluate((id) => {
      window.location.hash = `#${id}`;
    }, spotlight);
    await page.waitForFunction((id) => {
      const link = document.querySelector('[data-language-switcher] a[data-locale-link="en"]');
      return link?.getAttribute('href')?.includes(`#${id}`) ?? false;
    }, spotlight);
  }
}

async function assertJumpTargetVisible(page, anchor) {
  await page.goto(`${BASE_URL}/de/#${anchor}`, {
    waitUntil: 'domcontentloaded',
    timeout: 20_000,
  });
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
  // Force scroll to hash after layout (some static servers restore hash late).
  await page.evaluate((id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView();
  }, anchor);

  const result = await page.evaluate((id) => {
    const header = document.getElementById('main-header');
    const target = document.getElementById(id);
    if (!header || !target) {
      return { ok: false, reason: `missing header or #${id}` };
    }
    const headerBottom = header.getBoundingClientRect().bottom;
    const top = target.getBoundingClientRect().top;
    const style = getComputedStyle(target);
    const scrollMarginTop = Number.parseFloat(style.scrollMarginTop || '0');
    return {
      ok: top >= headerBottom - 1 || scrollMarginTop >= 80,
      top,
      headerBottom,
      scrollMarginTop,
    };
  }, anchor);

  if (!result.ok) {
    throw new Error(
      `#${anchor} obscured by sticky header (top=${result.top}, headerBottom=${result.headerBottom}, scroll-margin-top=${result.scrollMarginTop})`,
    );
  }
}

async function assertKeyboardSmoke(page, viewportLabel) {
  await page.goto(`${BASE_URL}/de/`, {
    waitUntil: 'domcontentloaded',
    timeout: 20_000,
  });
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

  // Skip link appears on focus.
  await page.keyboard.press('Tab');
  const skipFocused = await page.evaluate(() => {
    const el = document.activeElement;
    return el?.getAttribute('href') === '#main-content';
  });
  if (!skipFocused) {
    throw new Error(`${viewportLabel}: first Tab should focus skip link`);
  }

  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });

  if (viewportLabel === 'mobile') {
    const toggle = page.locator('#nav-toggle');
    await toggle.focus();
    await page.keyboard.press('Enter');
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
      throw new Error('mobile: Enter on menu toggle did not open menu');
    }
    const firstNav = page.locator('#nav-menu a').first();
    await firstNav.focus();
    const href = await firstNav.getAttribute('href');
    if (!href?.includes('#workflow')) {
      throw new Error(`mobile: first menu link should target #workflow, got ${href}`);
    }
  } else {
    const featuresLink = nav.getByRole('link', { name: 'Funktionen' });
    await featuresLink.focus();
    const activeHref = await page.evaluate(() => document.activeElement?.getAttribute('href') || '');
    if (!activeHref.includes('#features')) {
      throw new Error(`desktop: could not focus Features nav link, active=${activeHref}`);
    }
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => location.hash === '#features');
  }

  const langButtonId = viewportLabel === 'mobile' ? 'lang-mobile-button' : 'lang-desktop-button';
  const langButton = page.locator(`#${langButtonId}`);
  await langButton.focus();
  await page.keyboard.press('Enter');
  if ((await langButton.getAttribute('aria-expanded')) !== 'true') {
    throw new Error(`${viewportLabel}: Enter did not open language switcher`);
  }
  await page.keyboard.press('Escape');
  if ((await langButton.getAttribute('aria-expanded')) !== 'false') {
    throw new Error(`${viewportLabel}: Escape did not close language switcher`);
  }

  if (viewportLabel === 'mobile' && (await page.locator('#nav-toggle').getAttribute('aria-expanded')) !== 'true') {
    await page.locator('#nav-toggle').click();
  }
  const cta = nav.getByRole('link', { name: 'Jetzt ausprobieren' });
  await cta.focus();
  const ctaHref = await page.evaluate(() => document.activeElement?.getAttribute('href') || '');
  if (!ctaHref.includes('#start')) {
    throw new Error(`${viewportLabel}: CTA #start not keyboard-focusable`);
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
    await assertSwitcher(page, buttonId, label, '#qa-wall');

    for (const anchor of DEEP_LINKS) {
      await assertJumpTargetVisible(page, anchor);
    }

    await assertKeyboardSmoke(page, label);
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
  console.log('Language switcher / deep-link / keyboard checks passed (desktop + mobile).');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
