#!/usr/bin/env node
/**
 * Contrast checks for landing semantic theme tokens (Issue #199).
 * Evaluates CSS variables and real DOM computed styles in light and dark.
 */
import { chromium } from 'playwright';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:4321').replace(/\/+$/, '');
const MIN_TEXT = 4.5;
const MIN_UI = 3;

function parseColor(input, { underlay } = {}) {
  const raw = String(input).trim();
  const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3)
      h = h
        .split('')
        .map((c) => c + c)
        .join('');
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  const rgba = raw.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/i);
  if (!rgba) throw new Error(`Unsupported color: ${input}`);
  const r = Number(rgba[1]);
  const g = Number(rgba[2]);
  const b = Number(rgba[3]);
  const a = rgba[4] == null ? 1 : Number(rgba[4]);
  if (a >= 1 - 1e-6) return { r, g, b };
  const base = underlay ? parseColor(underlay) : { r: 255, g: 255, b: 255 };
  return {
    r: Math.round(r * a + base.r * (1 - a)),
    g: Math.round(g * a + base.g * (1 - a)),
    b: Math.round(b * a + base.b * (1 - a)),
  };
}

function srgbChannel(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance({ r, g, b }) {
  return 0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b);
}

function contrastRatio(fg, bg, { underlay } = {}) {
  const l1 = relativeLuminance(parseColor(fg));
  const l2 = relativeLuminance(parseColor(bg, { underlay }));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
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

async function settleTheme(page, mode) {
  await page.evaluate((m) => {
    if (window.__arsnovaLandingTheme) {
      window.__arsnovaLandingTheme.set(m);
    } else {
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      if (m === 'light' || m === 'dark') root.classList.add(m);
      root.style.colorScheme = m;
      root.setAttribute('data-landing-color-scheme', m);
    }
  }, mode);
  // Wait until presentation tokens resolve (color transitions can outlast double-rAF).
  const expectedBodyBg = mode === 'dark' ? 'rgb(22, 16, 24)' : 'rgb(250, 247, 251)';
  const expectedCtaBg = mode === 'dark' ? 'rgb(255, 171, 243)' : 'rgb(169, 0, 169)';
  await page.waitForFunction(
    ({ bodyBg, ctaBg }) => {
      const body = getComputedStyle(document.body).backgroundColor;
      const cta = document.querySelector('#main-header a.bg-landing-primary');
      if (!cta) return body === bodyBg;
      return body === bodyBg && getComputedStyle(cta).backgroundColor === ctaBg;
    },
    { bodyBg: expectedBodyBg, ctaBg: expectedCtaBg },
    { timeout: 5000 },
  );
}

async function readTokens(page, mode) {
  await settleTheme(page, mode);
  return page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    const keys = [
      '--landing-background',
      '--landing-surface',
      '--landing-surface-container',
      '--landing-surface-container-high',
      '--landing-on-surface',
      '--landing-on-surface-muted',
      '--landing-on-surface-body',
      '--landing-primary',
      '--landing-on-primary',
      '--landing-primary-container',
      '--landing-on-primary-container',
      '--landing-tertiary',
      '--landing-outline',
      '--landing-outline-variant',
      '--landing-focus',
      '--landing-error',
      '--landing-on-error',
    ];
    const out = {};
    for (const key of keys) out[key] = styles.getPropertyValue(key).trim();
    return out;
  });
}

function checkPairs(mode, tokens) {
  const errors = [];
  const pairs = [
    [
      'on-surface / background',
      tokens['--landing-on-surface'],
      tokens['--landing-background'],
      MIN_TEXT,
    ],
    [
      'on-surface-body / background',
      tokens['--landing-on-surface-body'],
      tokens['--landing-background'],
      MIN_TEXT,
    ],
    [
      'on-surface-muted / background',
      tokens['--landing-on-surface-muted'],
      tokens['--landing-background'],
      MIN_TEXT,
    ],
    ['on-surface / surface', tokens['--landing-on-surface'], tokens['--landing-surface'], MIN_TEXT],
    [
      'on-surface-muted / surface-container',
      tokens['--landing-on-surface-muted'],
      tokens['--landing-surface-container'],
      MIN_TEXT,
    ],
    [
      'primary (link) / background',
      tokens['--landing-primary'],
      tokens['--landing-background'],
      MIN_TEXT,
    ],
    ['on-primary / primary', tokens['--landing-on-primary'], tokens['--landing-primary'], MIN_TEXT],
    [
      'on-primary-container / primary-container',
      tokens['--landing-on-primary-container'],
      tokens['--landing-primary-container'],
      MIN_TEXT,
    ],
    ['on-error / error', tokens['--landing-on-error'], tokens['--landing-error'], MIN_TEXT],
    ['focus / background', tokens['--landing-focus'], tokens['--landing-background'], MIN_UI],
    ['outline / background', tokens['--landing-outline'], tokens['--landing-background'], MIN_UI],
    [
      'outline-variant / background',
      tokens['--landing-outline-variant'],
      tokens['--landing-background'],
      MIN_UI,
    ],
  ];

  for (const [name, fg, bg, min] of pairs) {
    const ratio = contrastRatio(fg, bg);
    if (ratio + 1e-6 < min) {
      errors.push(`${mode}: ${name} = ${ratio.toFixed(2)}:1 (need ≥ ${min}:1) [${fg} on ${bg}]`);
    } else {
      console.log(`  ✓ ${mode}: ${name} = ${ratio.toFixed(2)}:1`);
    }
  }
  return errors;
}

async function readDomPair(page, selector, { focus = false } = {}) {
  return page.evaluate(
    ({ sel, doFocus }) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      if (doFocus && typeof el.focus === 'function') el.focus();
      const styles = getComputedStyle(el);
      let bg = styles.backgroundColor;
      let node = el;
      // Walk up for transparent backgrounds
      while (
        node &&
        (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') &&
        node !== document.documentElement
      ) {
        node = node.parentElement;
        if (!node) break;
        bg = getComputedStyle(node).backgroundColor;
      }
      return {
        color: styles.color,
        backgroundColor: bg,
        outlineColor: styles.outlineColor,
        outlineStyle: styles.outlineStyle,
        outlineWidth: styles.outlineWidth,
      };
    },
    { sel: selector, doFocus: focus },
  );
}

async function checkDomPairs(page, mode) {
  const errors = [];
  const checks = [
    {
      name: 'primary CTA',
      selector:
        'a.landing-btn-primary, a[href*="#start"].rounded-landing-button.bg-landing-primary',
      min: MIN_TEXT,
    },
    {
      name: 'muted footer link',
      selector: 'footer a',
      min: MIN_TEXT,
    },
    {
      name: 'FAQ summary',
      selector: '#faq summary',
      min: MIN_TEXT,
    },
    {
      name: 'landing-link',
      selector: 'a.landing-link',
      min: MIN_TEXT,
    },
  ];

  // Prefer header CTA if present
  const ctaSel = (await page.locator('#main-header a.bg-landing-primary').count())
    ? '#main-header a.bg-landing-primary'
    : 'a.bg-landing-primary';
  checks[0].selector = ctaSel;

  for (const check of checks) {
    const count = await page.locator(check.selector).count();
    if (!count) {
      errors.push(`${mode}: DOM pair missing selector ${check.selector} (${check.name})`);
      continue;
    }
    const pair = await readDomPair(page, check.selector);
    if (!pair) {
      errors.push(`${mode}: could not read ${check.name}`);
      continue;
    }
    const ratio = contrastRatio(pair.color, pair.backgroundColor);
    if (ratio + 1e-6 < check.min) {
      errors.push(
        `${mode}: DOM ${check.name} = ${ratio.toFixed(2)}:1 (need ≥ ${check.min}:1) [${pair.color} on ${pair.backgroundColor}]`,
      );
    } else {
      console.log(`  ✓ ${mode}: DOM ${check.name} = ${ratio.toFixed(2)}:1`);
    }
  }

  // Focused theme option — UI contrast of focus outline against page bg (≥ 3:1)
  await page.locator('#theme-desktop-button').click();
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || !el.hasAttribute('data-theme-option') || !el.hasAttribute('aria-pressed')) {
      return null;
    }
    const s = getComputedStyle(el);
    return {
      outlineColor: s.outlineColor,
      outlineStyle: s.outlineStyle,
      outlineWidth: s.outlineWidth,
      color: s.color,
      backgroundColor: s.backgroundColor,
      pageBg: getComputedStyle(document.body).backgroundColor,
    };
  });
  if (!focused) {
    errors.push(`${mode}: focused theme option not reachable via Tab`);
    await page.keyboard.press('Escape').catch(() => undefined);
    return errors;
  }
  if (focused.outlineStyle === 'none' || parseFloat(focused.outlineWidth) <= 0) {
    errors.push(`${mode}: focused theme option has no visible outline`);
  } else {
    const ratio = contrastRatio(focused.outlineColor, focused.pageBg);
    if (ratio + 1e-6 < MIN_UI) {
      errors.push(
        `${mode}: focused theme option outline = ${ratio.toFixed(2)}:1 (need ≥ ${MIN_UI}:1)`,
      );
    } else {
      console.log(`  ✓ ${mode}: DOM focused theme option outline = ${ratio.toFixed(2)}:1`);
    }
  }
  await page.keyboard.press('Escape').catch(() => undefined);

  const statusTones = [
    { name: 'rose', text: '.text-landing-status-rose', bg: '.bg-landing-status-rose-bg' },
    { name: 'amber', text: '.text-landing-status-amber', bg: '.bg-landing-status-amber-bg' },
    { name: 'emerald', text: '.text-landing-status-emerald', bg: '.bg-landing-status-emerald-bg' },
    { name: 'violet', text: '.text-landing-status-violet', bg: '.bg-landing-status-violet-bg' },
  ];
  for (const tone of statusTones) {
    const count = await page.locator(tone.text).count();
    if (!count) {
      errors.push(`${mode}: DOM status ${tone.name} missing (${tone.text})`);
      continue;
    }
    const pair = await page.evaluate(
      ({ textSel, bgSel }) => {
        const el = document.querySelector(textSel);
        if (!el) return null;
        const s = getComputedStyle(el);
        let bg = s.backgroundColor;
        const nearest = el.closest(bgSel);
        if (nearest) {
          bg = getComputedStyle(nearest).backgroundColor;
        } else {
          let node = el;
          while (
            node &&
            (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') &&
            node !== document.documentElement
          ) {
            node = node.parentElement;
            if (!node) break;
            bg = getComputedStyle(node).backgroundColor;
          }
        }
        return { color: s.color, backgroundColor: bg };
      },
      { textSel: tone.text, bgSel: tone.bg },
    );
    if (!pair) {
      errors.push(`${mode}: DOM status ${tone.name} not readable`);
      continue;
    }
    const pageBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const ratio = contrastRatio(pair.color, pair.backgroundColor, { underlay: pageBg });
    if (ratio + 1e-6 < MIN_TEXT) {
      errors.push(
        `${mode}: DOM status ${tone.name} = ${ratio.toFixed(2)}:1 (need ≥ ${MIN_TEXT}:1) [${pair.color} on ${pair.backgroundColor} over ${pageBg}]`,
      );
    } else {
      console.log(`  ✓ ${mode}: DOM status ${tone.name} = ${ratio.toFixed(2)}:1`);
    }
  }

  return errors;
}

function parseAlpha(color) {
  const m = String(color)
    .trim()
    .match(/^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (!m) return null;
  return m[1] == null ? 1 : Number(m[1]);
}

async function checkAlphaOpacities(page, mode) {
  const errors = [];
  const samples = await page.evaluate(() => {
    const header = document.querySelector('#main-header');
    const estimateBorder = document.querySelector(
      '#numeric-estimate a.border-landing-primary\\/40, #numeric-estimate [class*="border-landing-primary"]',
    );
    const estimateFill = document.querySelector('#numeric-estimate .bg-landing-primary\\/15');
    return {
      headerBg: header ? getComputedStyle(header).backgroundColor : null,
      estimateBorder: estimateBorder ? getComputedStyle(estimateBorder).borderTopColor : null,
      estimateFill: estimateFill ? getComputedStyle(estimateFill).backgroundColor : null,
    };
  });

  const headerAlpha = samples.headerBg ? parseAlpha(samples.headerBg) : null;
  if (headerAlpha == null) {
    errors.push(`${mode}: header background not readable (${samples.headerBg})`);
  } else if (Math.abs(headerAlpha - 0.95) > 0.03) {
    errors.push(
      `${mode}: header bg-landing-bg/95 alpha=${headerAlpha} (expected ~0.95) [${samples.headerBg}]`,
    );
  } else {
    console.log(`  ✓ ${mode}: header bg alpha ≈ ${headerAlpha.toFixed(2)}`);
  }

  const borderAlpha = samples.estimateBorder ? parseAlpha(samples.estimateBorder) : null;
  if (borderAlpha == null) {
    errors.push(`${mode}: EstimateSpotlight border not readable (${samples.estimateBorder})`);
  } else if (Math.abs(borderAlpha - 0.4) > 0.05) {
    errors.push(
      `${mode}: EstimateSpotlight border-landing-primary/40 alpha=${borderAlpha} (expected ~0.4) [${samples.estimateBorder}]`,
    );
  } else {
    console.log(`  ✓ ${mode}: EstimateSpotlight border alpha ≈ ${borderAlpha.toFixed(2)}`);
  }

  const fillAlpha = samples.estimateFill ? parseAlpha(samples.estimateFill) : null;
  if (fillAlpha == null) {
    errors.push(`${mode}: EstimateSpotlight fill not readable (${samples.estimateFill})`);
  } else if (Math.abs(fillAlpha - 0.15) > 0.05) {
    errors.push(
      `${mode}: EstimateSpotlight bg-landing-primary/15 alpha=${fillAlpha} (expected ~0.15) [${samples.estimateFill}]`,
    );
  } else {
    console.log(`  ✓ ${mode}: EstimateSpotlight fill alpha ≈ ${fillAlpha.toFixed(2)}`);
  }

  return errors;
}

async function main() {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  const errors = [];
  try {
    await page.goto(`${BASE_URL}/de/`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    for (const mode of ['light', 'dark']) {
      console.log(`Checking ${mode} contrast…`);
      const tokens = await readTokens(page, mode);
      errors.push(...checkPairs(mode, tokens));
      errors.push(...(await checkDomPairs(page, mode)));
      errors.push(...(await checkAlphaOpacities(page, mode)));
    }
  } finally {
    await context.close();
    await browser.close();
  }

  if (errors.length) {
    console.error('\nContrast checks failed:\n- ' + errors.join('\n- '));
    process.exit(1);
  }
  console.log('Landing theme contrast checks passed (light + dark, tokens + DOM).');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
