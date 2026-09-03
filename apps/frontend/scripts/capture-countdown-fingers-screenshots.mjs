#!/usr/bin/env node
/**
 * Light/Dark-Screenshots der Vote-Counting-Fingers (transparent, unten links).
 *
 *   node apps/frontend/scripts/capture-countdown-fingers-screenshots.mjs
 */
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../../..');
const ASSETS = join(__dirname, '../src/assets/countdown-fingers');
const OUT_DIR = join(REPO_ROOT, 'artifacts/countdown-fingers');
const VIEWPORT = { width: 390, height: 844 };

function pageHtml(mode, fingerSrc) {
  const isDark = mode === 'dark';
  return `<!doctype html>
<html class="${isDark ? 'dark' : 'light'} preset-playful" lang="de" style="color-scheme: ${isDark ? 'dark' : 'light'}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root {
      color-scheme: light dark;
      --mat-sys-primary: #9c27b0;
      --mat-sys-on-surface: #1c1b1f;
      --mat-sys-surface: #fef7ff;
      --mat-sys-inverse-surface: #322f35;
      --mat-sys-surface-container-low: #f7f2fa;
      --mat-sys-outline-variant: #cac4d0;
      --vote-page-max-width: 36rem;
      --vote-page-inline-padding: 1rem;
    }
    html.light { color-scheme: light; }
    html.dark {
      color-scheme: dark;
      --mat-sys-primary: #e0b0ff;
      --mat-sys-on-surface: #e6e1e5;
      --mat-sys-surface: #141218;
      --mat-sys-surface-container-low: #1d1b20;
      --mat-sys-outline-variant: #49454f;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: system-ui, sans-serif;
      color: var(--mat-sys-on-surface);
      background: ${
        isDark
          ? 'linear-gradient(145deg, #1a1220 0%, #2a1838 40%, #1d1b20 100%)'
          : 'linear-gradient(145deg, #fef7ff 0%, #f3e5f5 40%, #f7f2fa 100%)'
      };
    }
    .vote-page {
      max-width: min(100%, var(--vote-page-max-width));
      margin-inline: auto;
      padding: 1rem;
      padding-bottom: 7rem;
    }
    .hint {
      margin: 0 0 1rem;
      text-align: center;
      opacity: 0.75;
      font-size: 0.9rem;
    }
    .options { display: grid; gap: 0.9rem; }
    .option {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      min-height: 4.5rem;
      padding: 1rem 1.1rem;
      border: 2px solid color-mix(in srgb, var(--mat-sys-outline-variant) 80%, transparent);
      border-radius: 1.25rem;
      background: color-mix(in srgb, var(--mat-sys-surface) 92%, transparent);
    }
    .badge {
      width: 2.4rem; height: 2.4rem; border-radius: 50%;
      display: grid; place-items: center; color: white; font-weight: 700;
    }
    .badge-a { background: #1e88e5; }
    .badge-b { background: #fb8c00; }
    .floating {
      position: fixed;
      top: 5.5rem;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 0.5rem;
      z-index: 110;
    }
    .timer {
      width: 2.4rem; height: 2.4rem; border-radius: 50%;
      display: grid; place-items: center;
      background: #c62828; color: white; font-weight: 700;
    }
    .score {
      display: flex; align-items: center; gap: 0.4rem;
      padding: 0.35rem 0.65rem;
      border-radius: 999px;
      background: color-mix(in srgb, var(--mat-sys-primary) 18%, var(--mat-sys-surface));
      font-size: 0.78rem;
    }
    /* Mirror countdown-fingers-host--viewport + --small */
    .countdown-fingers-host--viewport {
      display: block;
      position: fixed;
      bottom: 0;
      left: calc(
        (100vw - min(100vw, var(--vote-page-max-width, 36rem))) / 2 +
          max(var(--vote-page-inline-padding, 1rem), env(safe-area-inset-left, 0px))
      );
      z-index: 100;
      pointer-events: none;
    }
    .countdown-fingers {
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      width: fit-content;
      max-width: max-content;
      background: transparent;
      pointer-events: none;
      user-select: none;
    }
    .countdown-fingers--small {
      padding: 0.35rem;
      border-radius: 8px;
      background: light-dark(var(--mat-sys-primary), transparent);
    }
    .countdown-fingers--small .countdown-fingers__img {
      display: block;
      width: 48px;
      height: auto;
      object-fit: contain;
    }
    .footer {
      position: fixed; left: 0; right: 0; bottom: 0;
      height: 4.25rem;
      display: grid; grid-template-columns: repeat(3, 1fr);
      background: color-mix(in srgb, var(--mat-sys-surface) 94%, transparent);
      border-top: 1px solid var(--mat-sys-outline-variant);
      font-size: 0.65rem; text-align: center; align-items: center;
      opacity: 0.85;
    }
  </style>
</head>
<body>
  <main class="vote-page">
    <p class="hint">Das Bild ist nur zur Ansicht. Wähle deine Antwort unten aus.</p>
    <div class="options">
      <div class="option"><span class="badge badge-a">A</span><strong>KI-generiertes Bild</strong></div>
      <div class="option"><span class="badge badge-b">B</span><strong>Echtes Foto</strong></div>
    </div>
  </main>
  <div class="floating">
    <span class="timer">4</span>
    <div class="score"><strong>Richtige Antwort jetzt 133 Punkte</strong></div>
  </div>
  <div class="countdown-fingers-host--viewport" aria-hidden="true">
    <div class="countdown-fingers countdown-fingers--small">
      <img class="countdown-fingers__img" src="${fingerSrc}" alt="" />
    </div>
  </div>
  <footer class="footer">
    <div>Was arsnova.eu kann</div>
    <div>So funktioniert's</div>
    <div>Mehr</div>
  </footer>
</body>
</html>`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  // file:// assets are blocked in headless Chromium; embed as data URL.
  const png = await readFile(join(ASSETS, 'countdown_poster_clean_4.png'));
  const fingerSrc = `data:image/png;base64,${png.toString('base64')}`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const outputs = [];

  for (const mode of ['light', 'dark']) {
    await page.setContent(pageHtml(mode, fingerSrc), { waitUntil: 'load' });
    await page.waitForFunction(() => {
      const img = document.querySelector('.countdown-fingers__img');
      return img && img.complete && img.naturalWidth > 0;
    });
    const out = join(OUT_DIR, `countdown-fingers-vote-${mode}.png`);
    await page.screenshot({ path: out, fullPage: false });
    outputs.push(out);
    console.log('wrote', out);
  }

  await browser.close();
  console.log('done', outputs.length, 'screenshots in', OUT_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
