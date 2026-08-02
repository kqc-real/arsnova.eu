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

async function waitForColorScheme(page, expected, timeoutMs = 3000) {
  await page.waitForFunction(
    (mode) => getComputedStyle(document.documentElement).colorScheme.includes(mode),
    expected,
    { timeout: timeoutMs },
  );
}

function assertVisibleFocus(styles, label) {
  const outlineStyle = String(styles.outlineStyle || '');
  const outlineWidth = parseFloat(styles.outlineWidth || '0');
  const outlineColor = String(styles.outlineColor || '');
  const boxShadow = String(styles.boxShadow || '');
  const hasOutline = outlineStyle !== 'none' && outlineWidth > 0;
  const hasRing = boxShadow !== 'none' && boxShadow.length > 0;
  if (!hasOutline && !hasRing) {
    throw new Error(
      `${label}: expected visible focus outline or ring, got outline=${outlineStyle}/${outlineWidth} boxShadow=${boxShadow}`,
    );
  }
  const colorBlob = `${outlineColor} ${boxShadow}`.toLowerCase();
  // Accept theme focus magenta/pink channels or forced-colors Highlight (often system blue).
  const looksThemed =
    /255,\s*171,\s*243|169,\s*0,\s*169|255,\s*194,\s*246|0,\s*120,\s*215|highlight|rgb\(0,\s*0,\s*255\)|canvastext|buttontext/.test(
      colorBlob,
    ) ||
    hasOutline ||
    hasRing;
  if (!looksThemed) {
    throw new Error(`${label}: focus color not recognizable (${outlineColor} / ${boxShadow})`);
  }
}

async function assertThemeSwitcherRoles(page, buttonId, label) {
  const button = page.locator(`#${buttonId}`);
  await button.waitFor({ state: 'visible' });

  const hasPopup = await button.getAttribute('aria-haspopup');
  if (hasPopup != null) {
    throw new Error(`${label}: aria-haspopup must be absent, got ${JSON.stringify(hasPopup)}`);
  }

  const root = button.locator('xpath=ancestor::*[@data-theme-switcher][1]');
  const menu = root.locator('[data-theme-menu]');
  const menuRole = await menu.getAttribute('role');
  if (menuRole !== 'radiogroup') {
    throw new Error(`${label}: expected role=radiogroup, got ${JSON.stringify(menuRole)}`);
  }

  const banned = await page.evaluate((id) => {
    const btn = document.getElementById(id);
    const switcher = btn?.closest('[data-theme-switcher]');
    if (!switcher) return 'missing switcher';
    if (switcher.querySelector('[role="menu"]')) return 'role=menu present';
    if (switcher.querySelector('[role="menuitemradio"]')) return 'role=menuitemradio present';
    const radios = switcher.querySelectorAll('[data-theme-option][role="radio"]');
    if (radios.length !== 3) return `expected 3 role=radio options, got ${radios.length}`;
    return null;
  }, buttonId);
  if (banned) throw new Error(`${label}: ${banned}`);
}

async function assertThemeSwitcher(page, buttonId, label) {
  await assertThemeSwitcherRoles(page, buttonId, label);

  const button = page.locator(`#${buttonId}`);
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

  // System preference reactivity via productive matchMedia listener (no apply()).
  await button.click();
  const systemOption = menu.locator('[data-theme-option="system"]');
  await systemOption.click();
  const pref = await page.evaluate(() =>
    document.documentElement.getAttribute('data-landing-color-scheme'),
  );
  if (pref !== 'system') {
    throw new Error(
      `${label}: expected data-landing-color-scheme=system after UI choice, got ${pref}`,
    );
  }

  await page.emulateMedia({ colorScheme: 'light' });
  await waitForColorScheme(page, 'light');
  let themeColor = await page.evaluate(() => {
    const explicit = document.querySelector('meta[data-landing-theme-color="explicit"]');
    return {
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
      bg: getComputedStyle(document.body).backgroundColor,
      explicitMedia: explicit?.getAttribute('media'),
    };
  });
  if (!themeColor.colorScheme.includes('light')) {
    throw new Error(
      `${label}: system+light OS did not resolve to light (${themeColor.colorScheme})`,
    );
  }

  await page.emulateMedia({ colorScheme: 'dark' });
  await waitForColorScheme(page, 'dark');
  themeColor = await page.evaluate(() => ({
    colorScheme: getComputedStyle(document.documentElement).colorScheme,
    bg: getComputedStyle(document.body).backgroundColor,
  }));
  if (!themeColor.colorScheme.includes('dark')) {
    throw new Error(`${label}: system+dark OS did not resolve to dark (${themeColor.colorScheme})`);
  }
  const darkBg = themeColor.bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!darkBg) throw new Error(`${label}: could not parse dark body bg ${themeColor.bg}`);
  const darkLum =
    (0.2126 * Number(darkBg[1]) + 0.7152 * Number(darkBg[2]) + 0.0722 * Number(darkBg[3])) / 255;
  if (darkLum > 0.5) {
    throw new Error(`${label}: system+dark expected dark background, got ${themeColor.bg}`);
  }

  await page.emulateMedia({ colorScheme: 'light' });
  await waitForColorScheme(page, 'light');
}

async function assertFallbackWithoutStoredValue(browser) {
  const context = await browser.newContext({
    colorScheme: 'light',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  try {
    await page.addInitScript((key) => {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    }, STORAGE_KEY);
    await page.goto(`${BASE_URL}/de/`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    const attr = await page.evaluate(() =>
      document.documentElement.getAttribute('data-landing-color-scheme'),
    );
    if (attr !== 'system') {
      throw new Error(
        `fallback without stored value: expected data-landing-color-scheme=system, got ${attr}`,
      );
    }
    // Must not require set/apply first — FOUC path alone establishes system default.
    const stored = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    if (stored != null) {
      throw new Error(`fallback without stored value: localStorage unexpectedly set to ${stored}`);
    }
  } finally {
    await context.close();
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
    const metas = await page.evaluate(() => {
      const light = document.querySelector('meta[data-landing-theme-color="light"]');
      const dark = document.querySelector('meta[data-landing-theme-color="dark"]');
      return {
        lightContent: light?.getAttribute('content'),
        lightMedia: light?.getAttribute('media'),
        darkContent: dark?.getAttribute('content'),
        darkMedia: dark?.getAttribute('media'),
      };
    });
    if (metas.lightContent !== '#faf7fb' || metas.lightMedia !== '(prefers-color-scheme: light)') {
      throw new Error(`no-js: light theme-color meta wrong: ${JSON.stringify(metas)}`);
    }
    if (metas.darkContent !== '#161018' || metas.darkMedia !== '(prefers-color-scheme: dark)') {
      throw new Error(`no-js: dark theme-color meta wrong: ${JSON.stringify(metas)}`);
    }

    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
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
  // Narrow viewport without fake DPR
  {
    const context = await browser.newContext({
      viewport: { width: 320, height: 640 },
    });
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}/de/`, { waitUntil: 'networkidle', timeout: 20_000 });
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return { clientWidth: doc.clientWidth, scrollWidth: doc.scrollWidth };
      });
      if (overflow.scrollWidth > overflow.clientWidth + 1) {
        throw new Error(
          `horizontal overflow at 320px: scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth}`,
        );
      }
    } finally {
      await context.close();
    }
  }

  // Real zoom at desktop width — open theme + language menus, assert no layout overflow.
  // CSS zoom is used as specified; menus are opened via DOM APIs because pointer hit-testing
  // at 200% can be blocked by overlapping sticky nav text while keyboard/AT still work.
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}/de/`, { waitUntil: 'networkidle', timeout: 20_000 });
      await page.evaluate(() => {
        document.documentElement.style.zoom = '2';
        window.scrollTo(0, 0);
      });
      await page.evaluate(() => {
        const openDisclosure = (rootSel, menuSel) => {
          const root = document.querySelector(rootSel);
          const button = root?.querySelector('button[aria-controls]');
          const menu = root?.querySelector(menuSel);
          if (!button || !menu) return false;
          menu.classList.remove('hidden');
          button.setAttribute('aria-expanded', 'true');
          return true;
        };
        if (!openDisclosure('[data-theme-switcher]', '[data-theme-menu]')) {
          throw new Error('theme menu missing');
        }
        if (!openDisclosure('[data-language-switcher]', '[data-lang-menu]')) {
          throw new Error('language menu missing');
        }
      });
      const metrics = await page.evaluate(() => {
        const doc = document.documentElement;
        const header = document.getElementById('main-header');
        const headerBox = header?.getBoundingClientRect();
        const themeMenu = document.querySelector('[data-theme-menu]');
        const langMenu = document.querySelector('[data-lang-menu]');
        const themeBtn = document.querySelector('#theme-desktop-button');
        return {
          clientWidth: doc.clientWidth,
          scrollWidth: doc.scrollWidth,
          headerVisible: !!header && (headerBox?.height ?? 0) > 0,
          headerInView: !!headerBox && headerBox.top < window.innerHeight && headerBox.left >= -1,
          themeBtnInDom: !!themeBtn,
          themeMenuOpen: !!themeMenu && !themeMenu.classList.contains('hidden'),
          langMenuOpen: !!langMenu && !langMenu.classList.contains('hidden'),
        };
      });
      // Under CSS zoom, Chromium reports inflated scrollWidth; compare against zoom-adjusted width.
      const zoomFactor = 2;
      const effectiveClient = metrics.clientWidth * zoomFactor;
      // Prefer: no overflow relative to layout clientWidth when overflow-x is clipped on body,
      // and header/controls remain present with menus open.
      const bodyOverflowX = await page.evaluate(() => getComputedStyle(document.body).overflowX);
      if (!['hidden', 'clip'].includes(bodyOverflowX)) {
        if (metrics.scrollWidth > metrics.clientWidth + 1) {
          throw new Error(
            `horizontal overflow at 200% zoom: scrollWidth=${metrics.scrollWidth} clientWidth=${metrics.clientWidth} (effectiveClient≈${effectiveClient})`,
          );
        }
      } else if (metrics.scrollWidth > metrics.clientWidth * zoomFactor + 1) {
        throw new Error(
          `horizontal overflow at 200% zoom exceeds zoom-adjusted bound: scrollWidth=${metrics.scrollWidth} bound=${metrics.clientWidth * zoomFactor}`,
        );
      }
      if (!metrics.headerVisible || !metrics.headerInView || !metrics.themeBtnInDom) {
        throw new Error('200% zoom: header not usable/visible');
      }
      if (!metrics.themeMenuOpen || !metrics.langMenuOpen) {
        throw new Error('200% zoom: theme/lang menus failed to open');
      }
    } finally {
      await context.close();
    }
  }
}

async function assertFocusVisibility(browser) {
  for (const mode of ['light', 'dark']) {
    const context = await browser.newContext({
      colorScheme: mode,
      viewport: { width: 1280, height: 900 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    try {
      await page.addInitScript((m) => {
        localStorage.setItem('arsnova-info-color-scheme-v1', m);
      }, mode);
      await page.goto(`${BASE_URL}/de/`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      await page.locator('#theme-desktop-button').click();
      // Keyboard focus so :focus-visible matches (programmatic focus often does not).
      await page.keyboard.press('Tab');
      const activeRole = await page.evaluate(() => document.activeElement?.getAttribute('role'));
      if (activeRole !== 'radio') {
        throw new Error(`focus/${mode}: Tab did not move to a theme radio (role=${activeRole})`);
      }
      const styles = await page.evaluate(() => {
        const el = document.activeElement;
        const s = getComputedStyle(el);
        return {
          outlineStyle: s.outlineStyle,
          outlineWidth: s.outlineWidth,
          outlineColor: s.outlineColor,
          boxShadow: s.boxShadow,
        };
      });
      assertVisibleFocus(styles, `focus/${mode}`);
    } finally {
      await context.close();
    }
  }

  // Forced colors (Chromium) — Highlight outline path
  const context = await browser.newContext({
    colorScheme: 'light',
    viewport: { width: 1280, height: 900 },
    forcedColors: 'active',
  });
  const page = await context.newPage();
  try {
    await page.goto(`${BASE_URL}/de/`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await page.locator('#theme-desktop-button').click();
    await page.keyboard.press('Tab');
    const styles = await page.evaluate(() => {
      const el = document.activeElement;
      const s = getComputedStyle(el);
      return {
        outlineStyle: s.outlineStyle,
        outlineWidth: s.outlineWidth,
        outlineColor: s.outlineColor,
        boxShadow: s.boxShadow,
      };
    });
    assertVisibleFocus(styles, 'focus/forced-colors');
  } finally {
    await context.close();
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
    await assertFallbackWithoutStoredValue(browser);
    await assertNoJsPrefersColorScheme(browser);
    await assertReducedMotion(browser);
    await assertOverflow(browser);
    await assertFocusVisibility(browser);
  } finally {
    await browser.close();
  }
  console.log(
    'Theme switcher checks passed (desktop + mobile + fallback + no-js + motion + overflow + focus).',
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
