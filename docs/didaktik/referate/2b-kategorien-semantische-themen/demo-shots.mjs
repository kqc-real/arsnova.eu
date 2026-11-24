#!/usr/bin/env node
// Referat 2B – Demo-Check im laufenden arsnova.eu: Q&A-Session anlegen, Fragen einspeisen,
// Host-Ansicht öffnen und Kompass sowie Wortwolke im Modus »Themen« als Screenshots ablegen.
// Nur für eine lokale Dev-Instanz (Frontend :4200, Backend :3000).
// Aufruf aus dem Repo-Root: node docs/didaktik/referate/2b-kategorien-semantische-themen/demo-shots.mjs <out-dir> [domain] [count]
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const [OUT = 'demo-shots', DOMAIN = 'statistics', COUNT = '60'] = process.argv.slice(2);
const BASE = 'http://localhost:4200/de';
const TRPC = 'http://127.0.0.1:3000/trpc';
mkdirSync(OUT, { recursive: true });

const r = await fetch(`${TRPC}/session.create`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    type: 'Q_AND_A',
    title: 'Referat 2B Demo',
    moderationMode: false,
    qaModerationMode: false,
  }),
});
const s = (await r.json()).result.data;
console.log('Session', s.code);

execFileSync(
  process.execPath,
  [
    'node_modules/tsx/dist/cli.mjs',
    'docs/didaktik/referate/2b-kategorien-semantische-themen/demo-feed-questions.mts',
    '--code',
    s.code,
    '--domain',
    DOMAIN,
    '--count',
    COUNT,
    '--participants',
    '8',
    '--delay',
    '30',
  ],
  { stdio: 'ignore' },
);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: 'de-DE',
});
await context.addInitScript(
  ({ code, hostToken, cap }) => {
    sessionStorage.setItem(`arsnova-host-token:${code}`, hostToken);
    if (cap) localStorage.setItem(`arsnova-host-browser-capability-${code}`, cap);
  },
  { code: s.code, hostToken: s.hostToken, cap: s.hostBrowserCapability },
);
const page = await context.newPage();
await page.goto(`${BASE}/session/${s.code}/host`, { waitUntil: 'domcontentloaded' });

const done = page.locator('[data-testid="host-recovery-card-done"]');
if (
  await done.waitFor({ state: 'visible', timeout: 8000 }).then(
    () => true,
    () => false,
  )
) {
  await page.locator('app-host-recovery-card-dialog').getByRole('checkbox').check();
  await done.click();
}
await page.waitForTimeout(2000);
const toLobby = page.getByRole('button', { name: 'Zur Lobby' });
if (await toLobby.isVisible().catch(() => false)) await toLobby.click();
await page.waitForTimeout(2000);
await page.screenshot({ path: join(OUT, '1-host.png') });

const start = page.getByRole('button', { name: 'Fragerunde starten' });
if (await start.isVisible().catch(() => false)) {
  await start.click();
  await page.waitForTimeout(2500);
}
await page.screenshot({ path: join(OUT, '1b-fragerunde.png') });
const compass = page.locator('button:has(app-moderation-compass-icon)');
if (
  await compass.waitFor({ state: 'visible', timeout: 10000 }).then(
    () => true,
    () => false,
  )
) {
  await compass.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, '2-kompass.png') });
  const src = page.getByRole('button', { name: /Fragen zum Ablauf/ }).first();
  if (await src.isVisible().catch(() => false)) {
    await src.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(OUT, '2b-sprung-ablauf.png'), fullPage: true });
    const back = page.getByRole('button', { name: /Zurück zum Kompass/ }).first();
    if (await back.isVisible().catch(() => false)) {
      await back.click();
      await page.waitForTimeout(1200);
    }
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
} else {
  console.log('Kompass-Button nicht sichtbar');
}

const tools = page.locator('[data-testid="qa-tools-toggle"]');
if (await tools.isVisible().catch(() => false)) {
  await tools.click();
  await page.waitForTimeout(800);
}
const cloud = page.locator('[data-testid="qa-word-cloud"]');
if (
  await cloud.waitFor({ state: 'visible', timeout: 5000 }).then(
    () => true,
    () => false,
  )
) {
  await cloud.click();
  await page.waitForTimeout(1500);
  const themeToggle = page.locator('mat-button-toggle[value="SEMANTIC"] button');
  if (await themeToggle.count()) {
    await themeToggle.click();
    await page.waitForTimeout(8000);
  }
  await page.screenshot({ path: join(OUT, '3-wortwolke-thema.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  if (await compass.isVisible()) {
    await compass.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(OUT, '4-kompass-mit-themen.png') });
  }
} else {
  console.log('Wortwolken-Button nicht gefunden');
}
console.log('Host-URL', `${BASE}/session/${s.code}/host`);
await browser.close();
