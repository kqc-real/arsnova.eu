#!/usr/bin/env node
/**
 * Browser checks for landing language switchers, deep links, sticky-header
 * jump targets, header layout at the lg breakpoint, and a keyboard smoke path
 * (Issue #192 / #198).
 * Expects a static server serving apps/landing/dist (BASE_URL).
 */
import { chromium } from 'playwright';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:4321').replace(/\/+$/, '');

const LOCALES = ['de', 'en', 'fr', 'it', 'es'];

/** All canonical in-page jump targets (Issue #198). */
const CANONICAL_ANCHORS = [
  'workflow',
  'features',
  'numeric-estimate',
  'confidence',
  'qa-wall',
  'accessibility',
  'trust',
  'comparison',
  'faq',
  'start',
];

/** Legacy German hash aliases → canonical anchors. */
const LEGACY_ALIASES = {
  ablauf: 'workflow',
  schaetzfrage: 'numeric-estimate',
  selbsteinschaetzung: 'confidence',
  fragenwand: 'qa-wall',
  barrierefreiheit: 'accessibility',
  vertrauen: 'trust',
  vergleich: 'comparison',
};

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

  for (const [alias, canonical] of Object.entries(LEGACY_ALIASES)) {
    await page.evaluate((hashValue) => {
      window.location.hash = hashValue;
    }, `#${alias}`);
    await page.waitForFunction((expected) => {
      const link = document.querySelector('[data-language-switcher] a[data-locale-link="en"]');
      return link?.getAttribute('href')?.includes(`#${expected}`) ?? false;
    }, canonical);
    const afterAlias = await enLink.getAttribute('href');
    if (!afterAlias?.includes(`#${canonical}`)) {
      throw new Error(
        `${label}: hashchange alias #${alias} not canonicalized to #${canonical} (${afterAlias})`,
      );
    }
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

/**
 * Measure jump-target geometry after a normal hash navigation.
 * Does not call scrollIntoView — that would hide a broken initial hash jump.
 */
async function measureJumpGeometry(page, anchor) {
  await page.waitForFunction((id) => {
    return Boolean(document.getElementById(id) && document.getElementById('main-header'));
  }, anchor);

  // Wait until the browser finished scrolling and layout settled.
  await page.waitForFunction((id) => {
    const target = document.getElementById(id);
    if (!target) return false;
    const top = target.getBoundingClientRect().top;
    const key = '__arsnovaJumpGeom';
    const state = window[key] || { id: '', top: Number.NaN, stable: 0 };
    if (state.id !== id || Math.abs(state.top - top) > 0.5) {
      window[key] = { id, top, stable: 0 };
      return false;
    }
    state.stable += 1;
    window[key] = state;
    return state.stable >= 2;
  }, anchor);

  return page.evaluate((id) => {
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
      // Geometry only — scroll-margin is diagnostic, never a pass criterion.
      ok: top >= headerBottom - 1,
      top,
      headerBottom,
      scrollMarginTop,
      reason: undefined,
    };
  }, anchor);
}

async function assertJumpTargetVisible(page, locale, anchor) {
  await page.goto(`${BASE_URL}/${locale}/#${anchor}`, {
    waitUntil: 'domcontentloaded',
    timeout: 20_000,
  });
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

  const result = await measureJumpGeometry(page, anchor);
  if (!result.ok) {
    throw new Error(
      `/${locale}/#${anchor} obscured by sticky header ` +
        `(top=${result.top}, headerBottom=${result.headerBottom}, ` +
        `scroll-margin-top=${result.scrollMarginTop}` +
        `${result.reason ? `, reason=${result.reason}` : ''})`,
    );
  }
}

async function assertHeaderNoOverflow(page, locale) {
  await page.goto(`${BASE_URL}/${locale}/`, {
    waitUntil: 'domcontentloaded',
    timeout: 20_000,
  });
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

  const result = await page.evaluate(() => {
    const header = document.getElementById('main-header');
    if (!header) return { ok: false, reason: 'missing #main-header' };

    const desktopRow = [...header.querySelectorAll('div')].find((el) => {
      const className = el.getAttribute('class') || '';
      return className.includes('lg:flex') && className.includes('items-center');
    });
    if (!desktopRow) return { ok: false, reason: 'missing desktop nav row' };

    const display = getComputedStyle(desktopRow).display;
    if (display === 'none') {
      return { ok: false, reason: `desktop nav not visible (display=${display})` };
    }

    const headerRect = header.getBoundingClientRect();
    const rowRect = desktopRow.getBoundingClientRect();
    const controls = [...desktopRow.querySelectorAll('a, button')];
    if (controls.length < 6) {
      return { ok: false, reason: `expected desktop nav controls, got ${controls.length}` };
    }

    // Section links share one line; the language button may be taller (44px target).
    const sectionLinks = controls.filter(
      (el) => el.tagName === 'A' && (el.getAttribute('href') || '').includes('#'),
    );
    const tops = sectionLinks.map((el) => el.getBoundingClientRect().top);
    if (tops.length >= 2 && Math.max(...tops) - Math.min(...tops) > 8) {
      return {
        ok: false,
        reason: 'desktop nav wrapped to multiple lines',
        spread: Math.max(...tops) - Math.min(...tops),
      };
    }
    // A wrapped flex row grows well beyond a single compact toolbar line.
    if (rowRect.height > 72) {
      return {
        ok: false,
        reason: 'desktop nav row taller than one line',
        rowHeight: rowRect.height,
      };
    }

    for (const el of controls) {
      const rect = el.getBoundingClientRect();
      if (rect.right > headerRect.right + 1 || rect.left < headerRect.left - 1) {
        return {
          ok: false,
          reason: `control overflows header horizontally: ${el.textContent?.trim() || el.id}`,
          left: rect.left,
          right: rect.right,
          headerLeft: headerRect.left,
          headerRight: headerRect.right,
        };
      }
      if (rect.top < headerRect.top - 1 || rect.bottom > headerRect.bottom + 1) {
        return {
          ok: false,
          reason: `control overflows header vertically: ${el.textContent?.trim() || el.id}`,
        };
      }
      if (el.scrollWidth > el.clientWidth + 1) {
        return {
          ok: false,
          reason: `control text clipped: ${el.textContent?.trim() || el.id}`,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
        };
      }
    }

    if (rowRect.right > headerRect.right + 1) {
      return {
        ok: false,
        reason: 'desktop nav row wider than header',
        rowRight: rowRect.right,
        headerRight: headerRect.right,
      };
    }

    return { ok: true, headerHeight: headerRect.height, controlCount: controls.length };
  });

  if (!result.ok) {
    throw new Error(`/${locale}/ lg header layout failed: ${JSON.stringify(result)}`);
  }
}

async function assertKeyboardSmoke(page, viewportLabel) {
  await page.goto(`${BASE_URL}/de/`, {
    waitUntil: 'domcontentloaded',
    timeout: 20_000,
  });
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

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
    const activeHref = await page.evaluate(
      () => document.activeElement?.getAttribute('href') || '',
    );
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

  if (
    viewportLabel === 'mobile' &&
    (await page.locator('#nav-toggle').getAttribute('aria-expanded')) !== 'true'
  ) {
    await page.locator('#nav-toggle').click();
  }
  const cta = nav.getByRole('link', { name: 'Jetzt ausprobieren' });
  await cta.focus();
  const ctaHref = await page.evaluate(() => document.activeElement?.getAttribute('href') || '');
  if (!ctaHref.includes('#start')) {
    throw new Error(`${viewportLabel}: CTA #start not keyboard-focusable`);
  }
}

async function runMobileChecks(browser) {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  try {
    await page.goto(`${BASE_URL}/de/#qa-wall`, {
      waitUntil: 'domcontentloaded',
      timeout: 20_000,
    });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
    await assertSwitcher(page, 'lang-mobile-button', 'mobile', '#qa-wall');

    for (const anchor of CANONICAL_ANCHORS) {
      await assertJumpTargetVisible(page, 'de', anchor);
    }
    for (const alias of Object.keys(LEGACY_ALIASES)) {
      await assertJumpTargetVisible(page, 'de', alias);
    }

    await assertKeyboardSmoke(page, 'mobile');
  } finally {
    await context.close();
  }
}

async function runLgChecks(browser) {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    // Critical width: Tailwind `lg` breakpoint where desktop nav replaces the hamburger.
    viewport: { width: 1024, height: 900 },
  });
  const page = await context.newPage();
  try {
    await page.goto(`${BASE_URL}/de/#qa-wall`, {
      waitUntil: 'domcontentloaded',
      timeout: 20_000,
    });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
    await assertSwitcher(page, 'lang-desktop-button', 'lg-1024', '#qa-wall');

    for (const locale of LOCALES) {
      await assertHeaderNoOverflow(page, locale);
      for (const anchor of CANONICAL_ANCHORS) {
        await assertJumpTargetVisible(page, locale, anchor);
      }
    }

    await assertKeyboardSmoke(page, 'desktop');
  } finally {
    await context.close();
  }
}

async function main() {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  try {
    await runMobileChecks(browser);
    await runLgChecks(browser);
  } finally {
    await browser.close();
  }
  console.log(
    'Language switcher / deep-link / sticky-header / lg-header / keyboard checks passed.',
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
