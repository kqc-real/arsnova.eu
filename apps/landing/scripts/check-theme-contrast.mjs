#!/usr/bin/env node
/**
 * Contrast checks for landing semantic theme tokens (Issue #199).
 * Evaluates computed CSS variables in light and dark via Playwright.
 */
import { chromium } from 'playwright';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:4321').replace(/\/+$/, '');
const MIN_TEXT = 4.5;
const MIN_UI = 3;

function parseColor(input) {
  const raw = String(input).trim();
  const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  const rgb = raw.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!rgb) throw new Error(`Unsupported color: ${input}`);
  return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
}

function srgbChannel(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance({ r, g, b }) {
  return 0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b);
}

function contrastRatio(fg, bg) {
  const l1 = relativeLuminance(parseColor(fg));
  const l2 = relativeLuminance(parseColor(bg));
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

async function readTokens(page, mode) {
  await page.evaluate((m) => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    if (m === 'light' || m === 'dark') root.classList.add(m);
    root.style.colorScheme = m;
  }, mode);
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
    ['on-surface / background', tokens['--landing-on-surface'], tokens['--landing-background'], MIN_TEXT],
    ['on-surface-body / background', tokens['--landing-on-surface-body'], tokens['--landing-background'], MIN_TEXT],
    ['on-surface-muted / background', tokens['--landing-on-surface-muted'], tokens['--landing-background'], MIN_TEXT],
    ['on-surface / surface', tokens['--landing-on-surface'], tokens['--landing-surface'], MIN_TEXT],
    ['on-surface-muted / surface-container', tokens['--landing-on-surface-muted'], tokens['--landing-surface-container'], MIN_TEXT],
    ['primary (link) / background', tokens['--landing-primary'], tokens['--landing-background'], MIN_TEXT],
    ['on-primary / primary', tokens['--landing-on-primary'], tokens['--landing-primary'], MIN_TEXT],
    ['on-primary-container / primary-container', tokens['--landing-on-primary-container'], tokens['--landing-primary-container'], MIN_TEXT],
    ['on-error / error', tokens['--landing-on-error'], tokens['--landing-error'], MIN_TEXT],
    ['focus / background', tokens['--landing-focus'], tokens['--landing-background'], MIN_UI],
    ['outline / background', tokens['--landing-outline'], tokens['--landing-background'], MIN_UI],
    ['outline-variant / background', tokens['--landing-outline-variant'], tokens['--landing-background'], MIN_UI],
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

async function main() {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  try {
    await page.goto(`${BASE_URL}/de/`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    for (const mode of ['light', 'dark']) {
      console.log(`Checking ${mode} contrast…`);
      const tokens = await readTokens(page, mode);
      errors.push(...checkPairs(mode, tokens));
    }
  } finally {
    await context.close();
    await browser.close();
  }

  if (errors.length) {
    console.error('\nContrast checks failed:\n- ' + errors.join('\n- '));
    process.exit(1);
  }
  console.log('Landing theme contrast checks passed (light + dark).');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
