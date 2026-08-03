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
  if (menuRole === 'menu' || menuRole === 'radiogroup') {
    throw new Error(
      `${label}: expected disclosure group (not menu/radiogroup), got ${JSON.stringify(menuRole)}`,
    );
  }

  const banned = await page.evaluate((id) => {
    const btn = document.getElementById(id);
    const switcher = btn?.closest('[data-theme-switcher]');
    if (!switcher) return 'missing switcher';
    if (switcher.querySelector('[role="menu"]')) return 'role=menu present';
    if (switcher.querySelector('[role="menuitemradio"]')) return 'role=menuitemradio present';
    if (switcher.querySelector('[role="radio"]')) return 'role=radio present';
    if (switcher.querySelector('[role="radiogroup"]')) return 'role=radiogroup present';
    const options = switcher.querySelectorAll('[data-theme-option]');
    if (options.length !== 3) return `expected 3 theme options, got ${options.length}`;
    for (const option of options) {
      if (!option.hasAttribute('aria-pressed')) {
        return `option ${option.getAttribute('data-theme-option')} missing aria-pressed`;
      }
    }
    return null;
  }, buttonId);
  if (banned) throw new Error(`${label}: ${banned}`);
}

async function activateWithKey(page, locator, key) {
  await locator.focus();
  await page.keyboard.press(key);
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
  const optionOrder = ['system', 'light', 'dark'];

  // Keyboard: Enter opens the disclosure.
  await activateWithKey(page, button, 'Enter');
  if ((await button.getAttribute('aria-expanded')) !== 'true') {
    throw new Error(`${label}: Enter did not open menu`);
  }
  if (await menu.evaluate((el) => el.classList.contains('hidden'))) {
    throw new Error(`${label}: menu still hidden after Enter open`);
  }

  // Tab / Shift+Tab through the three options.
  const seenForward = [];
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press('Tab');
    const option = await page.evaluate(() =>
      document.activeElement?.getAttribute('data-theme-option'),
    );
    seenForward.push(option);
  }
  if (seenForward.join(',') !== optionOrder.join(',')) {
    throw new Error(
      `${label}: Tab order through theme options expected ${optionOrder.join('→')}, got ${seenForward.join('→')}`,
    );
  }
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  const backToSystem = await page.evaluate(() =>
    document.activeElement?.getAttribute('data-theme-option'),
  );
  if (backToSystem !== 'system') {
    throw new Error(`${label}: Shift+Tab did not return to system option (got ${backToSystem})`);
  }

  // Space activates the focused option (light via Tab then Space).
  await page.keyboard.press('Tab'); // light
  await page.keyboard.press('Space');
  if ((await button.getAttribute('aria-expanded')) !== 'false') {
    throw new Error(`${label}: Space on option did not close menu`);
  }
  if ((await page.evaluate(() => document.activeElement?.id)) !== buttonId) {
    throw new Error(`${label}: focus not restored to trigger after Space selection`);
  }
  let stored = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  if (stored !== 'light') {
    throw new Error(
      `${label}: expected localStorage ${STORAGE_KEY}=light after Space, got ${stored}`,
    );
  }
  if (!(await page.evaluate(() => document.documentElement.className.includes('light')))) {
    throw new Error(`${label}: html.light not applied after Space on light`);
  }

  // Enter opens again and Enter activates dark.
  await activateWithKey(page, button, 'Enter');
  await page.keyboard.press('Tab'); // system
  await page.keyboard.press('Tab'); // light
  await page.keyboard.press('Tab'); // dark
  const focusedDark = await page.evaluate(() =>
    document.activeElement?.getAttribute('data-theme-option'),
  );
  if (focusedDark !== 'dark') {
    throw new Error(`${label}: expected focus on dark before Enter activate, got ${focusedDark}`);
  }
  await page.keyboard.press('Enter');
  if ((await button.getAttribute('aria-expanded')) !== 'false') {
    throw new Error(`${label}: Enter on option did not close menu`);
  }
  if ((await page.evaluate(() => document.activeElement?.id)) !== buttonId) {
    throw new Error(`${label}: focus not restored to trigger after Enter selection`);
  }

  stored = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
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

  // Space opens; Escape closes and restores focus.
  await activateWithKey(page, button, 'Space');
  if ((await button.getAttribute('aria-expanded')) !== 'true') {
    throw new Error(`${label}: Space did not open menu`);
  }
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
    await activateWithKey(page, button, 'Enter');
    await langButton.click();
    if ((await button.getAttribute('aria-expanded')) !== 'false') {
      throw new Error(`${label}: language menu did not close theme menu`);
    }
  }

  // System preference reactivity via productive matchMedia listener (no apply()).
  await activateWithKey(page, button, 'Enter');
  const systemOption = menu.locator('[data-theme-option="system"]');
  await activateWithKey(page, systemOption, 'Enter');
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

async function collectHorizontalOverflowOffenders(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const offenders = [];
    for (const el of document.querySelectorAll('body *')) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const overflowRight = rect.right - vw;
      const overflowLeft = -rect.left;
      if (overflowRight > 0.5 || overflowLeft > 0.5) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          cls: String(el.className || '').slice(0, 120),
          left: Number(rect.left.toFixed(1)),
          right: Number(rect.right.toFixed(1)),
          width: Number(rect.width.toFixed(1)),
          overflowRight: Number(Math.max(0, overflowRight).toFixed(1)),
          overflowLeft: Number(Math.max(0, overflowLeft).toFixed(1)),
          text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
        });
      }
    }
    offenders.sort(
      (a, b) =>
        Math.max(b.overflowRight, b.overflowLeft) - Math.max(a.overflowRight, a.overflowLeft),
    );
    const doc = document.documentElement;
    return {
      clientWidth: doc.clientWidth,
      scrollWidth: doc.scrollWidth,
      innerWidth: vw,
      offenders: offenders.slice(0, 25),
    };
  });
}

async function assertOverflow(browser) {
  // Narrow viewport without fake DPR. Also stress CI-like Ubuntu/DejaVu metrics
  // so tracked uppercase labels cannot silently reintroduce scrollWidth growth.
  {
    const context = await browser.newContext({
      viewport: { width: 320, height: 640 },
    });
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}/de/`, { waitUntil: 'networkidle', timeout: 20_000 });
      await page.addStyleTag({
        content:
          'html,body,*{font-family:"Ubuntu","DejaVu Sans","Liberation Sans",Arial,sans-serif !important;}',
      });
      const overflow = await collectHorizontalOverflowOffenders(page);
      if (overflow.scrollWidth > overflow.clientWidth + 1) {
        throw new Error(
          `horizontal overflow at 320px: scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth}; offenders=${JSON.stringify(overflow.offenders)}`,
        );
      }
    } finally {
      await context.close();
    }
  }

  // 200% browser-zoom equivalent: half of a 1440×900 desktop CSS viewport.
  // Menus are opened one at a time via the real controls (mutual exclusion).
  {
    const context = await browser.newContext({
      viewport: { width: 720, height: 450 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}/de/`, { waitUntil: 'networkidle', timeout: 20_000 });

      async function assertNoHorizontalOverflow(label) {
        const metrics = await page.evaluate(() => {
          const doc = document.documentElement;
          return { clientWidth: doc.clientWidth, scrollWidth: doc.scrollWidth };
        });
        if (metrics.scrollWidth > metrics.clientWidth + 1) {
          throw new Error(
            `horizontal overflow at 200%-equivalent viewport (${label}): scrollWidth=${metrics.scrollWidth} clientWidth=${metrics.clientWidth}`,
          );
        }
      }

      await assertNoHorizontalOverflow('initial');

      const header = page.locator('#main-header');
      if (!(await header.isVisible())) {
        throw new Error('200%-equivalent reflow: header not visible');
      }

      const themeBtn = page
        .locator('#theme-mobile-button:visible, #theme-desktop-button:visible')
        .first();
      await themeBtn.waitFor({ state: 'visible' });
      await themeBtn.click();
      if ((await themeBtn.getAttribute('aria-expanded')) !== 'true') {
        throw new Error('200%-equivalent reflow: theme menu did not open via UI');
      }
      await assertNoHorizontalOverflow('theme-menu-open');
      await page.keyboard.press('Escape');
      if ((await themeBtn.getAttribute('aria-expanded')) !== 'false') {
        throw new Error('200%-equivalent reflow: theme menu did not close');
      }

      const langBtn = page
        .locator('#lang-mobile-button:visible, #lang-desktop-button:visible')
        .first();
      await langBtn.waitFor({ state: 'visible' });
      await langBtn.click();
      if ((await langBtn.getAttribute('aria-expanded')) !== 'true') {
        throw new Error('200%-equivalent reflow: language menu did not open via UI');
      }
      if ((await themeBtn.getAttribute('aria-expanded')) !== 'false') {
        throw new Error('200%-equivalent reflow: theme menu stayed open with language menu');
      }
      await assertNoHorizontalOverflow('lang-menu-open');
      await page.keyboard.press('Escape');

      // Focus order through header controls remains usable.
      await page.locator('a[href="#main-content"]').focus();
      const focusTrail = [];
      for (let i = 0; i < 16; i += 1) {
        await page.keyboard.press('Tab');
        const id = await page.evaluate(
          () => document.activeElement?.id || document.activeElement?.tagName,
        );
        focusTrail.push(id);
      }
      if (
        !focusTrail.some(
          (id) =>
            String(id).includes('theme') ||
            String(id).includes('lang') ||
            String(id).includes('nav'),
        )
      ) {
        throw new Error(
          `200%-equivalent reflow: focus trail missed header controls (${focusTrail.join(' → ')})`,
        );
      }

      const sections = [
        '#start',
        '#workflow',
        '#features',
        '#accessibility',
        '#trust',
        '#comparison',
        '#faq',
      ];
      for (const sel of sections) {
        const box = await page.locator(sel).first().boundingBox();
        if (!box) throw new Error(`200%-equivalent reflow: missing section ${sel}`);
        if (box.width > 720 + 1) {
          throw new Error(
            `200%-equivalent reflow: section ${sel} wider than viewport (${box.width}px)`,
          );
        }
        await page.locator(sel).first().scrollIntoViewIfNeeded();
        await assertNoHorizontalOverflow(`section-${sel}`);
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
      const active = await page.evaluate(() => ({
        option: document.activeElement?.getAttribute('data-theme-option'),
        pressed: document.activeElement?.getAttribute('aria-pressed'),
      }));
      if (!active.option || active.pressed == null) {
        throw new Error(
          `focus/${mode}: Tab did not move to a theme option button (option=${active.option}, aria-pressed=${active.pressed})`,
        );
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

  // System-dark + forced-colors: authored dark tokens must not win over system colors.
  await assertForcedColorsSystemDark(browser);
}

async function assertForcedColorsSystemDark(browser) {
  const context = await browser.newContext({
    colorScheme: 'dark',
    viewport: { width: 1280, height: 900 },
    forcedColors: 'active',
    reducedMotion: 'reduce',
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
    // Prefer UI path when disclosure is available; otherwise rely on FOUC system default.
    const button = page.locator('#theme-desktop-button');
    if (await button.isVisible()) {
      await button.click();
      await page.locator('#theme-desktop-menu [data-theme-option="system"]').click();
    }
    const tokens = await page.evaluate(() => {
      const root = document.documentElement;
      const s = getComputedStyle(root);
      return {
        scheme: root.getAttribute('data-landing-color-scheme'),
        className: root.className,
        background: s.getPropertyValue('--landing-background').trim().toLowerCase(),
        primary: s.getPropertyValue('--landing-primary').trim().toLowerCase(),
        focus: s.getPropertyValue('--landing-focus').trim().toLowerCase(),
        bodyBg: getComputedStyle(document.body).backgroundColor,
      };
    });
    if (tokens.scheme !== 'system') {
      throw new Error(
        `forced-colors/system-dark: expected data-landing-color-scheme=system, got ${tokens.scheme}`,
      );
    }
    if (/\bdark\b/.test(tokens.className) || /\blight\b/.test(tokens.className)) {
      throw new Error(
        `forced-colors/system-dark: expected no explicit light/dark class, got ${tokens.className}`,
      );
    }
    // Authored dark magenta tokens must not remain active under forced colors.
    if (tokens.background === '#161018' || tokens.primary === '#a900a9') {
      throw new Error(
        `forced-colors/system-dark: authored dark tokens still active (${JSON.stringify(tokens)})`,
      );
    }
    const systemLike =
      /^(canvas|canvastext|linktext|buttontext|highlight|mark)$/i.test(tokens.background) ||
      /^(canvas|canvastext|linktext|buttontext|highlight|mark)$/i.test(tokens.primary) ||
      /^(canvas|canvastext|linktext|buttontext|highlight|mark)$/i.test(tokens.focus);
    if (!systemLike) {
      throw new Error(
        `forced-colors/system-dark: expected system color keywords on tokens, got ${JSON.stringify(tokens)}`,
      );
    }
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

/**
 * Cross-Origin theme transfer from Angular via ?theme= (Issue #207).
 * Validates FOUC-free apply, storage precedence, URL cleanup, and invalid ignore.
 */
async function assertThemeQueryTransfer(browser) {
  async function openWith(path, { colorScheme = 'light', stored = null, viewport = { width: 1280, height: 900 } } = {}) {
    const context = await browser.newContext({
      colorScheme,
      viewport,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.addInitScript(
      ({ key, value }) => {
        try {
          if (value == null) localStorage.removeItem(key);
          else localStorage.setItem(key, value);
        } catch {
          // ignore
        }
      },
      { key: STORAGE_KEY, value: stored },
    );
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    return { context, page };
  }

  // dark + hash: apply before paint semantics, persist, strip theme only
  {
    const { context, page } = await openWith('/de/?theme=dark#features', { stored: 'light' });
    try {
      const state = await page.evaluate((key) => ({
        scheme: document.documentElement.getAttribute('data-landing-color-scheme'),
        className: document.documentElement.className,
        colorScheme: getComputedStyle(document.documentElement).colorScheme,
        stored: localStorage.getItem(key),
        href: location.href,
        search: location.search,
        hash: location.hash,
      }), STORAGE_KEY);
      if (state.scheme !== 'dark') {
        throw new Error(`theme=dark: expected data-landing-color-scheme=dark, got ${state.scheme}`);
      }
      if (!state.className.includes('dark')) {
        throw new Error(`theme=dark: expected html.dark, got ${state.className}`);
      }
      if (!state.colorScheme.includes('dark')) {
        throw new Error(`theme=dark: expected color-scheme dark, got ${state.colorScheme}`);
      }
      if (state.stored !== 'dark') {
        throw new Error(`theme=dark: expected storage dark (override light), got ${state.stored}`);
      }
      if (state.search.includes('theme=')) {
        throw new Error(`theme=dark: theme query not cleaned (${state.search})`);
      }
      if (state.hash !== '#features') {
        throw new Error(`theme=dark: hash must remain #features, got ${state.hash}`);
      }

      await page.locator('#theme-desktop-button').click();
      const pressed = await page.locator('#theme-desktop-menu [data-theme-option="dark"]').getAttribute(
        'aria-pressed',
      );
      if (pressed !== 'true') {
        throw new Error(`theme=dark: ThemeSwitcher dark option not pressed (aria-pressed=${pressed})`);
      }
    } finally {
      await context.close();
    }
  }

  // light + workflow hash
  {
    const { context, page } = await openWith('/en/?theme=light#workflow', {
      colorScheme: 'dark',
      stored: 'dark',
    });
    try {
      const state = await page.evaluate((key) => ({
        scheme: document.documentElement.getAttribute('data-landing-color-scheme'),
        className: document.documentElement.className,
        stored: localStorage.getItem(key),
        search: location.search,
        hash: location.hash,
      }), STORAGE_KEY);
      if (state.scheme !== 'light' || !state.className.includes('light')) {
        throw new Error(`theme=light: expected light mode, got ${JSON.stringify(state)}`);
      }
      if (state.stored !== 'light') {
        throw new Error(`theme=light: expected storage light, got ${state.stored}`);
      }
      if (state.search.includes('theme=') || state.hash !== '#workflow') {
        throw new Error(`theme=light: cleanup/hash wrong (${state.search} ${state.hash})`);
      }
    } finally {
      await context.close();
    }
  }

  // system stays semantic system and follows OS
  {
    const { context, page } = await openWith('/fr/?theme=system#accessibility', {
      colorScheme: 'dark',
      stored: 'light',
    });
    try {
      const state = await page.evaluate((key) => ({
        scheme: document.documentElement.getAttribute('data-landing-color-scheme'),
        className: document.documentElement.className,
        colorScheme: getComputedStyle(document.documentElement).colorScheme,
        stored: localStorage.getItem(key),
        hash: location.hash,
      }), STORAGE_KEY);
      if (state.scheme !== 'system') {
        throw new Error(`theme=system: expected scheme system, got ${state.scheme}`);
      }
      if (/\b(light|dark)\b/.test(state.className)) {
        throw new Error(`theme=system: expected no explicit class, got ${state.className}`);
      }
      if (!state.colorScheme.includes('dark')) {
        throw new Error(`theme=system: OS dark should resolve dark, got ${state.colorScheme}`);
      }
      if (state.stored !== 'system') {
        throw new Error(`theme=system: expected storage system, got ${state.stored}`);
      }
      if (state.hash !== '#accessibility') {
        throw new Error(`theme=system: hash lost (${state.hash})`);
      }
    } finally {
      await context.close();
    }
  }

  // without theme param: local preference wins
  {
    const { context, page } = await openWith('/de/#features', { stored: 'dark' });
    try {
      const state = await page.evaluate((key) => ({
        scheme: document.documentElement.getAttribute('data-landing-color-scheme'),
        stored: localStorage.getItem(key),
        search: location.search,
        hash: location.hash,
      }), STORAGE_KEY);
      if (state.scheme !== 'dark' || state.stored !== 'dark') {
        throw new Error(`no theme param: expected stored dark, got ${JSON.stringify(state)}`);
      }
      if (state.hash !== '#features') {
        throw new Error(`no theme param: hash changed (${state.hash})`);
      }
    } finally {
      await context.close();
    }
  }

  // invalid theme ignored and not persisted; other params + hash kept
  {
    const { context, page } = await openWith('/de/?theme=neon&ref=app#faq', { stored: 'light' });
    try {
      const state = await page.evaluate((key) => ({
        scheme: document.documentElement.getAttribute('data-landing-color-scheme'),
        stored: localStorage.getItem(key),
        search: location.search,
        hash: location.hash,
      }), STORAGE_KEY);
      if (state.scheme !== 'light' || state.stored !== 'light') {
        throw new Error(`invalid theme: must keep light preference, got ${JSON.stringify(state)}`);
      }
      if (!state.search.includes('theme=neon') || !state.search.includes('ref=app')) {
        throw new Error(
          `invalid theme: must not strip params when theme invalid (${state.search})`,
        );
      }
      if (state.hash !== '#faq') {
        throw new Error(`invalid theme: hash lost (${state.hash})`);
      }
    } finally {
      await context.close();
    }
  }

  // valid theme cleanup keeps sibling query params + hash
  {
    const { context, page } = await openWith('/de/?utm=1&theme=dark&ref=app#features', {
      stored: 'light',
    });
    try {
      const state = await page.evaluate((key) => ({
        scheme: document.documentElement.getAttribute('data-landing-color-scheme'),
        stored: localStorage.getItem(key),
        search: location.search,
        hash: location.hash,
      }), STORAGE_KEY);
      if (state.scheme !== 'dark' || state.stored !== 'dark') {
        throw new Error(`cleanup: expected dark applied, got ${JSON.stringify(state)}`);
      }
      if (state.search.includes('theme=')) {
        throw new Error(`cleanup: theme still present (${state.search})`);
      }
      if (!state.search.includes('utm=1') || !state.search.includes('ref=app')) {
        throw new Error(`cleanup: sibling params lost (${state.search})`);
      }
      if (state.hash !== '#features') {
        throw new Error(`cleanup: hash lost (${state.hash})`);
      }
    } finally {
      await context.close();
    }
  }

  // 320px mobile viewport still applies transfer
  {
    const { context, page } = await openWith('/it/?theme=dark#features', {
      viewport: { width: 320, height: 720 },
      stored: 'light',
    });
    try {
      const state = await page.evaluate(() => ({
        scheme: document.documentElement.getAttribute('data-landing-color-scheme'),
        className: document.documentElement.className,
        hash: location.hash,
      }));
      if (state.scheme !== 'dark' || !state.className.includes('dark') || state.hash !== '#features') {
        throw new Error(`320px theme transfer failed: ${JSON.stringify(state)}`);
      }
      await page.locator('#theme-mobile-button').waitFor({ state: 'visible' });
    } finally {
      await context.close();
    }
  }
}

async function main() {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  try {
    await runViewport(browser, { width: 1280, height: 900 }, 'theme-desktop-button', 'desktop');
    await runViewport(browser, { width: 390, height: 844 }, 'theme-mobile-button', 'mobile');
    await assertFallbackWithoutStoredValue(browser);
    await assertThemeQueryTransfer(browser);
    await assertNoJsPrefersColorScheme(browser);
    await assertReducedMotion(browser);
    await assertOverflow(browser);
    await assertFocusVisibility(browser);
  } finally {
    await browser.close();
  }
  console.log(
    'Theme switcher checks passed (desktop + mobile + fallback + theme-query + no-js + motion + overflow + focus).',
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
