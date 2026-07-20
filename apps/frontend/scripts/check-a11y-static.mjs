#!/usr/bin/env node
import { chromium } from 'playwright';
import { assertNoBlockingA11y } from './axe-a11y.mjs';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:4173').replace(/\/+$/, '');
const APP = process.env.A11Y_APP || 'frontend';
const DEFAULT_ROUTES =
  APP === 'landing'
    ? ['/', '/impressum/', '/datenschutz/']
    : [
        '/de/',
        '/en/',
        '/de/quiz',
        '/de/quiz/new',
        '/de/help',
        '/en/help',
        '/de/legal/imprint',
        '/de/legal/privacy',
        '/de/legal/accessibility',
      ];
const ROUTES = (process.env.A11Y_ROUTES || DEFAULT_ROUTES.join(','))
  .split(',')
  .map((route) => route.trim())
  .filter(Boolean);
const READY_SELECTOR = APP === 'landing' ? 'main' : 'app-root main';

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${BASE_URL}${ROUTES[0]}`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`App unter ${BASE_URL} nicht erreichbar.`);
}

async function dismissOptionalOverlay(page) {
  const closeButton = page
    .locator(
      '.home-motd-sheet button[aria-label], .preset-toast button[aria-label], [role="dialog"] button[aria-label]',
    )
    .first();
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
    await page.waitForTimeout(200);
  }
}

async function scanRoute(context, route) {
  const page = await context.newPage();
  await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
  await dismissOptionalOverlay(page);
  await assertNoBlockingA11y(page, `${APP}-${route}`, { readySelector: READY_SELECTOR });
  return page;
}

async function scanQuizEdit(context) {
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/de/quiz/new`, {
    waitUntil: 'domcontentloaded',
    timeout: 20_000,
  });
  await page.locator('input[aria-label="Quiz-Name"]').fill('A11y-Testquiz');
  await page.locator('button[type="submit"][form="quiz-create-form"]').click();
  await page.waitForURL(/\/de\/quiz\/[^/]+(?:\?.*)?$/, { timeout: 15_000 });
  await assertNoBlockingA11y(page, 'frontend-de-quiz-edit', {
    readySelector: 'app-root main',
  });
  await page.close();
}

async function scanOfflineState(context) {
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/de/`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await dismissOptionalOverlay(page);
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.locator('.app-offline-banner[role="alert"]').waitFor({ state: 'visible' });
  await assertNoBlockingA11y(page, 'frontend-de-offline', {
    readySelector: 'app-root main',
  });
  await context.setOffline(false);
  await page.close();
}

async function scanJoinLoadingAndError(context) {
  const loadingPage = await context.newPage();
  await loadingPage.route('**/trpc/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    await route.abort();
  });
  await loadingPage.goto(`${BASE_URL}/de/join/ZZZZZZ`, {
    waitUntil: 'domcontentloaded',
    timeout: 20_000,
  });
  await loadingPage.locator('.join-card__text').first().waitFor({ state: 'visible' });
  await assertNoBlockingA11y(loadingPage, 'frontend-de-join-loading', {
    readySelector: 'app-root main',
  });
  await loadingPage.close();

  const errorPage = await context.newPage();
  await errorPage.route('**/trpc/**', (route) => route.abort());
  await errorPage.goto(`${BASE_URL}/de/join/ZZZZZZ`, {
    waitUntil: 'domcontentloaded',
    timeout: 20_000,
  });
  await errorPage.locator('.join-card--error').waitFor({ state: 'visible', timeout: 15_000 });
  await assertNoBlockingA11y(errorPage, 'frontend-de-join-error', {
    readySelector: 'app-root main',
  });
  await errorPage.close();
}

async function main() {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: 1280, height: 900 },
  });

  try {
    for (const route of ROUTES) {
      const page = await scanRoute(context, route);
      await page.close();
    }
    if (APP === 'frontend') {
      await scanQuizEdit(context);
      await scanOfflineState(context);
      await scanJoinLoadingAndError(context);
    }
  } finally {
    await context.close();
    await browser.close();
  }

  const stateCount = ROUTES.length + (APP === 'frontend' ? 4 : 0);
  console.log(`\naxe-A11y-Gate bestanden (${stateCount} Zustände, App: ${APP}).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
