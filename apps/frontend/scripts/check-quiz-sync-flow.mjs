#!/usr/bin/env node
/**
 * Smoke-Test fuer die geteilte Quiz-Bibliothek (Yjs/IndexedDB/WebSocket).
 * Verifiziert insbesondere, dass ein importierendes Geraet keinen alten lokalen Stand
 * in einen fremden Shared-Raum zurueckschreibt und dass spaetere Aenderungen live ankommen.
 *
 * Voraussetzungen:
 * - Backend laeuft (`npm run dev -w @arsnova/backend`) mit HTTP 3000, tRPC-WS 3001, Yjs-WS 3002
 * - Lokalisierter Frontend-Build wurde erzeugt (`npm run build:localize -w @arsnova/frontend`)
 * - Lokalisierter Proxy laeuft (`npm run serve:localize:api -w @arsnova/frontend`)
 *
 * Run:
 *   BASE_URL=http://localhost:4200 npm run smoke:quiz-sync -w @arsnova/frontend
 *
 * Optional:
 *   LOCALE=de|en|fr|it|es   (Default: en)
 */
import { chromium, webkit } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4200';
const LOCALE = (process.env.LOCALE || 'en').trim().toLowerCase();
const APP_URL = `${BASE_URL.replace(/\/+$/, '')}/${LOCALE}`;
const DESKTOP = { width: 1440, height: 1000 };
const SAVE_LABEL_RE = /^(save|speichern)$/i;

async function waitForServer(url, maxAttempts = 30) {
  for (let index = 0; index < maxAttempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      // App noch nicht bereit.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch {
    return webkit.launch({ headless: true });
  }
}

async function visibleText(page) {
  return page.locator('body').innerText();
}

function logStep(ok, label, detail = '') {
  const prefix = ok ? 'OK ' : 'FEHLER ';
  const suffix = detail ? ` — ${detail}` : '';
  console.log(`${prefix}${label}${suffix}`);
}

async function dismissMotdIfPresent(page) {
  const actionButtons = page.locator('.home-motd-sheet__actions button');
  const count = await actionButtons.count().catch(() => 0);
  if (count === 0) return;
  await actionButtons.first().click();
  await page.waitForTimeout(400);
}

async function createQuiz(page, quizName) {
  await page.goto(`${APP_URL}/quiz/new`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.locator('input[formcontrolname="name"]').first().fill(quizName);
  await page.locator('button[type="submit"]').click();
  await page.waitForFunction(() => /\/quiz\/[^/]+$/.test(location.pathname), null, {
    timeout: 30_000,
  });
  await page.waitForTimeout(1_200);
  return page.url();
}

async function openSyncPage(page) {
  await page.goto(`${APP_URL}/quiz`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(1_200);
  await page.locator('a.quiz-list__sync-cta').click();
  await page.waitForFunction(() => /\/quiz\/sync\//.test(location.pathname), null, {
    timeout: 30_000,
  });
  await page.waitForTimeout(1_200);
  const url = page.url();
  const roomId = url.match(/\/quiz\/sync\/([^/?#]+)/)?.[1] ?? null;
  if (!roomId) {
    throw new Error(`Sync-ID konnte aus der URL nicht gelesen werden: ${url}`);
  }
  return { url, roomId };
}

async function importSharedLibrary(page, syncUrl) {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(1_000);
  await dismissMotdIfPresent(page);
  await page.locator('button.home-card__tertiary-link').click();
  await page.waitForTimeout(400);
  await page.locator('.home-sync-entry__input').fill(syncUrl);
  await page.locator('button.home-sync-entry__submit').click();
  await page.waitForFunction(() => location.pathname.endsWith('/quiz'), null, { timeout: 30_000 });
  await page.waitForTimeout(2_500);
}

async function renameQuiz(page, editUrl, nextName) {
  await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(1_000);
  const nameInput = page.locator('input[formcontrolname="name"]').first();
  const saveButton = page.locator('button.quiz-edit__bottom-actions-save');
  await nameInput.fill(nextName);
  await nameInput.blur();
  await saveButton.waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForFunction(
    () => {
      const button = document.querySelector('button.quiz-edit__bottom-actions-save');
      return button instanceof HTMLButtonElement && !button.disabled;
    },
    null,
    { timeout: 30_000 },
  );
  await saveButton.click();
  await page.waitForTimeout(1_500);
}

async function waitForText(page, text, timeout = 15_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    if ((await visibleText(page)).includes(text)) {
      return true;
    }
    await page.waitForTimeout(250);
  }
  return false;
}

async function main() {
  console.log(`Warte auf ${APP_URL}…`);
  const ready = await waitForServer(APP_URL);
  if (!ready) {
    console.error(`App nicht erreichbar unter ${APP_URL}.`);
    process.exit(1);
  }

  const browser = await launchBrowser();
  const failures = [];
  const suffix = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000)}`;
  const sourceQuizName = `Sync Source ${suffix}`;
  const sourceQuizRenamed = `${sourceQuizName} Updated`;
  const localOnlyQuizName = `Local Only ${suffix}`;

  try {
    const contextA = await browser.newContext({ viewport: DESKTOP });
    const contextB = await browser.newContext({ viewport: DESKTOP });
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    const editUrlA = await createQuiz(pageA, sourceQuizName);
    logStep(true, 'Geraet A erstellt Shared-Quiz', sourceQuizName);

    await createQuiz(pageB, localOnlyQuizName);
    logStep(true, 'Geraet B erstellt lokales Quiz vor Import', localOnlyQuizName);

    const { url: syncUrl, roomId } = await openSyncPage(pageA);
    logStep(true, 'Geraet A oeffnet Sync-Seite', roomId);

    await importSharedLibrary(pageB, syncUrl);
    const importedTextB = await visibleText(pageB);
    const importOk = importedTextB.includes(sourceQuizName);
    logStep(importOk, 'Geraet B importiert Shared-Bibliothek', roomId);
    if (!importOk) {
      failures.push('Geraet B zeigt das geteilte Quiz nach dem Import nicht an.');
    }

    const localQuizGoneOnB = !importedTextB.includes(localOnlyQuizName);
    logStep(localQuizGoneOnB, 'Lokaler Stand von Geraet B bleibt aus Shared-Raum draussen');
    if (!localQuizGoneOnB) {
      failures.push('Das lokale Quiz von Geraet B blieb nach dem Import sichtbar und wurde nicht aus dem Shared-Raum verdraengt.');
    }

    await pageA.goto(`${APP_URL}/quiz`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await pageA.waitForTimeout(2_000);
    const sharedTextA = await visibleText(pageA);
    const localQuizLeakedToA = sharedTextA.includes(localOnlyQuizName);
    logStep(!localQuizLeakedToA, 'Geraet A sieht keinen Rueckfluss des lokalen Quiz von Geraet B');
    if (localQuizLeakedToA) {
      failures.push('Das lokale Quiz von Geraet B wurde in den Shared-Raum zurueckgeschrieben und erschien auf Geraet A.');
    }

    await renameQuiz(pageA, editUrlA, sourceQuizRenamed);
    logStep(true, 'Geraet A benennt Shared-Quiz um', sourceQuizRenamed);

    const renameSynced = await waitForText(pageB, sourceQuizRenamed, 15_000);
    logStep(renameSynced, 'Umbenennung kommt live auf Geraet B an');
    if (!renameSynced) {
      failures.push('Die Umbenennung des Shared-Quiz kam auf Geraet B nicht live an.');
    }

    const finalTextA = await visibleText(pageA);
    if (!finalTextA.includes(sourceQuizRenamed)) {
      failures.push('Geraet A zeigt den umbenannten Quiznamen nach dem Speichern nicht mehr an.');
    }

    await contextB.close();
    await contextA.close();
  } finally {
    await browser.close();
  }

  if (failures.length > 0) {
    console.error('\nFehlgeschlagene Pruefschritte:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('\n✓ Quiz-Sync-Smoke-Test bestanden.');
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
