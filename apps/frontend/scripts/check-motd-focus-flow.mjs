#!/usr/bin/env node
/**
 * Browser-E2E für den MOTD-Fokusrücksprung auf der Desktop-Startseite.
 * WebKit deckt die Safari-nahe Pointer-/Tab-Reihenfolge ab; zwei Szenarien
 * bilden zusätzlich fehlendes window.TouchEvent und fehlenden Button-Fokus nach.
 *
 * Run: BASE_URL=http://localhost:4200 PLAYWRIGHT_BROWSER=webkit node scripts/check-motd-focus-flow.mjs
 */
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:4200').replace(/\/+$/, '');
const BROWSER_NAME = process.env.PLAYWRIGHT_BROWSER || 'chromium';
const ARTIFACT_DIR = process.env.SMOKE_ARTIFACT_DIR || 'tmp/motd-focus';
const HOME_URL = `${BASE_URL}/de/`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForServer(url, maxAttempts = 60) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Der produktionsnahe Serve ist noch nicht bereit.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`App nicht erreichbar: ${url}`);
}

async function openHomeWithMotd(page, { focusCodeInput = false } = {}) {
  // Die MOTD wird per Idle-Callback geöffnet. Die kurze API-Verzögerung macht
  // den Regressionstest reproduzierbar: Das Codefeld ist vor dem Overlay aktiv.
  await page.route(/motd\.getCurrent/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.continue();
  });
  await page.goto(HOME_URL, { waitUntil: 'domcontentloaded', timeout: 15_000 });

  if (focusCodeInput) {
    const codeInput = page.locator('.home-code-segments__input');
    await codeInput.waitFor({ state: 'visible', timeout: 5_000 });
    await codeInput.focus();
    assert(
      await codeInput.evaluate((element) => element === document.activeElement),
      'Vor Öffnen der MOTD konnte das Codefeld nicht fokussiert werden.',
    );
  }

  const motd = page.locator('.home-motd-sheet');
  await motd.waitFor({ state: 'visible', timeout: 10_000 });
  return motd;
}

async function waitForPrimaryAction(page) {
  await page.waitForFunction(
    () => document.querySelector('.home-hero-code-enter') === document.activeElement,
    undefined,
    { timeout: 3_000 },
  );
}

async function primaryFocusState(page) {
  return page.locator('.home-hero-code-enter').evaluate((element) => {
    const indicator = element.querySelector('.mat-focus-indicator');
    const indicatorStyle = indicator ? getComputedStyle(indicator, '::before') : null;
    const style = getComputedStyle(element);
    return {
      active: element === document.activeElement,
      keyboard: element.classList.contains('cdk-keyboard-focused'),
      mouse: element.classList.contains('cdk-mouse-focused'),
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
      indicatorDisplay: indicatorStyle?.display ?? null,
    };
  });
}

async function assertNextTabContinuesHeroFlow(page) {
  const nextAction = page.locator('.home-hero-host-row > a').first();
  await page.keyboard.press('Tab');
  if (await nextAction.evaluate((element) => element === document.activeElement)) return;

  // Safari überspringt bei deaktivierter vollständiger Tab-Navigation Links
  // mit Tab. ⌥ Tab schaltet für diesen Tastendruck auf alle Bedienelemente.
  // Andere Playwright-WebKit-Ports verwenden bereits Tab und kehren oben zurück.
  const codeInputActive = await page
    .locator('.home-code-segments__input')
    .evaluate((element) => element === document.activeElement);
  assert(
    BROWSER_NAME === 'webkit' && codeInputActive,
    'Tab nach dem MOTD-Rücksprung folgt weder der vollständigen noch der Safari-reduzierten Tab-Reihe.',
  );
  await page.locator('.home-hero-code-enter').focus();
  await page.keyboard.press('Alt+Tab');
  assert(
    await nextAction.evaluate((element) => element === document.activeElement),
    '⌥ Tab nach dem MOTD-Rücksprung setzt den Safari-Hero-Flow nicht bei „Quiz erstellen“ fort.',
  );
}

async function assertKeyboardReturn(page) {
  await waitForPrimaryAction(page);
  const state = await primaryFocusState(page);
  assert(
    state.active && state.keyboard && state.outlineStyle !== 'none' && state.outlineWidth >= 3,
    `Tastatur-Rücksprung hat keinen sichtbaren Fokusrahmen: ${JSON.stringify(state)}`,
  );
  await assertNextTabContinuesHeroFlow(page);
}

async function assertPointerReturn(page) {
  await waitForPrimaryAction(page);
  const state = await primaryFocusState(page);
  assert(
    state.active && state.mouse && !state.keyboard && state.indicatorDisplay === 'none',
    `Pointer-Rücksprung zeigt den falschen Fokuszustand: ${JSON.stringify(state)}`,
  );
  await assertNextTabContinuesHeroFlow(page);
}

async function runScenario(
  browser,
  name,
  { missingTouchEvent = false, suppressMotdButtonFocus = false } = {},
) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  if (missingTouchEvent) {
    await page.addInitScript(() => {
      // Desktop-Safari stellt TouchEvent nicht in jeder Umgebung bereit.
      Object.defineProperty(window, 'TouchEvent', { value: undefined, configurable: true });
    });
  }
  if (suppressMotdButtonFocus) {
    await page.addInitScript(() => {
      // Safari fokussiert Buttons bei einem Mausklick standardmäßig nicht. Das
      // No-op hält zugleich den vorherigen Fokus für den CDK-Trap-Restore aktiv.
      const nativeFocus = HTMLElement.prototype.focus;
      HTMLElement.prototype.focus = function patchedFocus(...args) {
        if (this.closest?.('.home-motd-sheet') && this.matches('button')) return;
        nativeFocus.apply(this, args);
      };
    });
  }

  try {
    if (name === 'keyboard-close') {
      const motd = await openHomeWithMotd(page);
      const close = motd.getByRole('button', { name: 'Meldung schließen' });
      await close.waitFor({ state: 'visible' });
      await close.focus();
      await close.press('Enter');
      await motd.waitFor({ state: 'hidden', timeout: 5_000 });
      await assertKeyboardReturn(page);
    } else if (name === 'keyboard-ack') {
      const motd = await openHomeWithMotd(page);
      const ack = motd.getByRole('button', { name: 'Alles klar!' });
      await ack.focus();
      await ack.press('Enter');
      await motd.waitFor({ state: 'hidden', timeout: 5_000 });
      await assertKeyboardReturn(page);
    } else if (name === 'pointer-close-after-code-focus') {
      const motd = await openHomeWithMotd(page, { focusCodeInput: true });
      await motd.getByRole('button', { name: 'Meldung schließen' }).click();
      await motd.waitFor({ state: 'hidden', timeout: 5_000 });
      await assertPointerReturn(page);
    } else if (name === 'pointer-ack') {
      const motd = await openHomeWithMotd(page);
      const close = motd.getByRole('button', { name: 'Meldung schließen' });
      await page.waitForFunction(
        () =>
          document.querySelector('.home-motd-sheet button[aria-label="Meldung schließen"]') ===
          document.activeElement,
        undefined,
        { timeout: 2_000 },
      );
      assert(
        await close.evaluate((element) => element === document.activeElement),
        'Vor dem ACK-Mausklick liegt der Fokus nicht auf dem Schließen-Button.',
      );
      await motd.getByRole('button', { name: 'Alles klar!' }).click();
      await motd.waitFor({ state: 'hidden', timeout: 5_000 });
      await assertPointerReturn(page);
    } else {
      throw new Error(`Unbekanntes MOTD-Fokusszenario: ${name}`);
    }
    assert(pageErrors.length === 0, `Browserfehler: ${pageErrors.join(' | ')}`);
    console.log(`  ${name} … OK`);
  } catch (error) {
    await page
      .screenshot({ path: join(ARTIFACT_DIR, `${BROWSER_NAME}-${name}.png`), fullPage: true })
      .catch(() => undefined);
    throw new Error(`${name}: ${error.message}`, { cause: error });
  } finally {
    await context.close();
  }
}

async function main() {
  if (!['chromium', 'webkit'].includes(BROWSER_NAME)) {
    throw new Error(
      `PLAYWRIGHT_BROWSER muss "chromium" oder "webkit" sein (erhalten: ${BROWSER_NAME}).`,
    );
  }
  const browserType = BROWSER_NAME === 'webkit' ? webkit : chromium;

  await mkdir(ARTIFACT_DIR, { recursive: true });
  await waitForServer(HOME_URL);
  console.log(`MOTD-Fokusfluss mit ${BROWSER_NAME}: ${HOME_URL}`);
  const browser = await browserType.launch({ headless: true });

  try {
    await runScenario(browser, 'keyboard-close');
    await runScenario(browser, 'keyboard-ack');
    await runScenario(browser, 'pointer-close-after-code-focus', {
      missingTouchEvent: true,
      suppressMotdButtonFocus: true,
    });
    await runScenario(browser, 'pointer-ack', { missingTouchEvent: true });
  } finally {
    await browser.close();
  }

  console.log(`✓ MOTD-Fokusfluss mit ${BROWSER_NAME} bestanden.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
