#!/usr/bin/env node
/**
 * Prüft Reflow, Fokus-Sichtbarkeit und Mindestzielgrößen bei 320 CSS-Pixel.
 * 320 CSS-Pixel entsprechen der WCAG-Reflow-Prüfung eines 1280-Pixel-
 * Viewports bei 400 % Zoom.
 * Erwartet: App läuft unter BASE_URL (z. B. PORT=4173 node scripts/serve-localized-with-api.mjs).
 *
 * Run: BASE_URL=http://localhost:4173 node scripts/check-viewport-320.mjs
 */
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:4173').replace(/\/+$/, '');
const VIEWPORT_WIDTH = 320;
const VIEWPORT_HEIGHT = 568;
const MIN_TARGET_SIZE = 24;
const ARTIFACT_DIR =
  process.env.A11Y_ARTIFACT_DIR || process.env.SMOKE_ARTIFACT_DIR || 'tmp/a11y-layout';

async function waitForServer(url, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // Server nicht bereit
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function dismissOptionalOverlay(page) {
  const closeButton = page
    .locator('.home-motd-sheet button[aria-label], [role="dialog"] button[aria-label]')
    .first();
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
    await page.waitForTimeout(200);
  }
}

async function inspectTargetSizes(page) {
  return page.evaluate((minimum) => {
    const selectors = [
      'button',
      '[role="button"]',
      'input:not([type="hidden"])',
      'select',
      'textarea',
      'a[href]',
    ];
    return Array.from(document.querySelectorAll(selectors.join(',')))
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          style.clip !== 'auto' ||
          style.clipPath !== 'none' ||
          rect.width === 0 ||
          rect.height === 0 ||
          rect.bottom <= 0 ||
          rect.right <= 0 ||
          rect.left >= window.innerWidth
        ) {
          return false;
        }
        // Inline links inside running text use the WCAG spacing exception.
        return !(element instanceof HTMLAnchorElement && style.display === 'inline');
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          element,
          width: Math.round(rect.width * 10) / 10,
          height: Math.round(rect.height * 10) / 10,
        };
      })
      .filter(({ width, height }) => width < minimum || height < minimum)
      .map(({ element, width, height }) => ({
        target:
          element.getAttribute('aria-label') ||
          element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 50) ||
          element.tagName.toLowerCase(),
        width,
        height,
      }));
  }, MIN_TARGET_SIZE);
}

async function inspectKeyboardFocus(page) {
  const issues = [];
  const maxTabs = 40;
  await page
    .locator('body')
    .click({ position: { x: 1, y: 1 } })
    .catch(() => undefined);
  let firstFocusKey = null;
  for (let index = 0; index < maxTabs; index += 1) {
    await page.keyboard.press('Tab');
    const result = await page.evaluate(() => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || active === document.body) {
        return { key: null, issue: null };
      }
      const key =
        active.getAttribute('id') ||
        active.getAttribute('aria-label') ||
        active.outerHTML.slice(0, 120);
      const rect = active.getBoundingClientRect();
      const inViewport =
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < window.innerHeight &&
        rect.left < window.innerWidth;
      if (!inViewport) {
        return {
          key,
          issue:
            active.getAttribute('aria-label') ||
            active.textContent?.trim().slice(0, 50) ||
            active.tagName,
        };
      }

      const centerX = rect.left + Math.min(rect.width, 24) / 2;
      const centerY = rect.top + Math.min(rect.height, 24) / 2;
      const topEl = document.elementFromPoint(centerX, centerY);
      const interactiveSurface = active.closest(
        'mat-form-field, .mat-mdc-form-field, mat-button-toggle, .mat-mdc-button-base',
      );
      const sameInteractiveSurface =
        interactiveSurface instanceof Element &&
        topEl instanceof Element &&
        interactiveSurface.contains(topEl);
      const obscured =
        topEl instanceof Element &&
        topEl !== active &&
        !active.contains(topEl) &&
        !topEl.contains(active) &&
        !sameInteractiveSurface &&
        getComputedStyle(topEl).pointerEvents !== 'none';
      if (obscured) {
        const label =
          active.getAttribute('aria-label') ||
          active.textContent?.trim().slice(0, 50) ||
          active.tagName;
        return { key, issue: `Fokus verdeckt: ${label}` };
      }
      return { key, issue: null };
    });
    if (result.issue) issues.push(result.issue);
    if (result.key) {
      if (firstFocusKey == null) {
        firstFocusKey = result.key;
      } else if (result.key === firstFocusKey && index > 0) {
        break;
      }
    }
  }
  return issues;
}

async function inspectHomeKeyboardNavigation(page) {
  const issues = [];
  await page.evaluate(() => {
    document.body.setAttribute('tabindex', '-1');
    document.body.focus();
    document.body.removeAttribute('tabindex');
  });
  await page.keyboard.press('Tab');
  if (
    !(await page
      .locator('.app-skip-link')
      .evaluate((element) => element === document.activeElement))
  ) {
    issues.push('Skip-Link ist nicht der erste Tabstopp');
  } else {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(50);
    if (
      !(await page
        .locator('#main-content')
        .evaluate((element) => element === document.activeElement))
    ) {
      issues.push('Skip-Link verschiebt den Fokus nicht auf den Hauptinhalt');
    }
  }

  const menuButton = page.locator('.top-toolbar__menu-btn');
  await menuButton.focus();
  await page.keyboard.press('Enter');
  await page.locator('#top-toolbar-mobile').waitFor({ state: 'visible' });
  const focusInsideMenu = await page
    .waitForFunction(
      () => document.querySelector('#top-toolbar-mobile')?.contains(document.activeElement),
      undefined,
      { timeout: 1_000 },
    )
    .then(() => true)
    .catch(() => false);
  if (!focusInsideMenu) {
    issues.push('Mobile Einstellungen übernehmen den Fokus beim Öffnen nicht');
  }

  await page.keyboard.press('Escape');
  await page
    .waitForFunction(
      () =>
        document.querySelector('.top-toolbar__menu-btn')?.getAttribute('aria-expanded') === 'false',
      undefined,
      { timeout: 1_000 },
    )
    .catch(() => undefined);
  if ((await menuButton.getAttribute('aria-expanded')) !== 'false') {
    issues.push('Mobile Einstellungen schließen nicht mit Escape');
  }
  if (!(await menuButton.evaluate((element) => element === document.activeElement))) {
    issues.push('Fokus kehrt nach Escape nicht zum Menüauslöser zurück');
  }

  const codeAction = page.getByRole('button', { name: 'Code eingeben' });
  await codeAction.click();
  if (
    !(await page
      .locator('.home-code-segments__input')
      .evaluate((element) => element === document.activeElement))
  ) {
    issues.push('„Code eingeben“ fokussiert die Session-Code-Eingabe nicht');
  }
  return issues;
}

async function inspectMobileJoinEntry(page) {
  return page
    .locator('.home-code-segments__input')
    .evaluate((element) =>
      element === document.activeElement
        ? ['Dedizierter Join-Pfad fokussiert auf Mobile ungefragt die Code-Eingabe']
        : [],
    );
}

async function main() {
  console.log(`Warte auf ${BASE_URL}/de/…`);
  const ready = await waitForServer(`${BASE_URL}/de/`);
  if (!ready) {
    console.error(
      'App nicht erreichbar. Starte zuerst: PORT=4173 node scripts/serve-localized-with-api.mjs',
    );
    process.exit(1);
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch {
    browser = await webkit.launch({ headless: true });
  }
  const context = await browser.newContext({
    viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    hasTouch: true,
    isMobile: true,
  });

  const paths = [
    '/de/',
    '/en/',
    '/fr/',
    '/es/',
    '/it/',
    '/de/join',
    '/de/quiz',
    '/de/quiz/new',
    '/de/help',
    '/fr/help',
    '/es/help',
    '/it/help',
    '/de/legal/privacy',
    '/de/admin',
  ];
  let failed = 0;
  let checkedStates = 0;
  await mkdir(ARTIFACT_DIR, { recursive: true });

  async function checkPage(page, label, options = {}) {
    const result = await page.evaluate((w) => {
      const doc = document.documentElement;
      const body = document.body;
      const scrollWidth = Math.max(
        body.scrollWidth,
        body.offsetWidth,
        doc.scrollWidth,
        doc.offsetWidth,
        doc.clientWidth,
      );
      const clientWidth = doc.clientWidth;
      const ok = scrollWidth <= w && clientWidth === w;
      return { ok, scrollWidth, clientWidth };
    }, VIEWPORT_WIDTH);

    const undersizedTargets = await inspectTargetSizes(page);
    const hiddenFocus = options.skipFocus ? [] : await inspectKeyboardFocus(page);
    const keyboardNavigation = options.keyboardNavigation ?? [];

    checkedStates += 1;
    if (
      result.ok &&
      undersizedTargets.length === 0 &&
      hiddenFocus.length === 0 &&
      keyboardNavigation.length === 0
    ) {
      console.log(`  ${label} … OK (Reflow, ${MIN_TARGET_SIZE}px-Ziele, sichtbarer Tastaturfokus)`);
      return;
    }

    console.error(
      `  ${label} … FEHLER: scrollWidth=${result.scrollWidth}, kleine Ziele=${JSON.stringify(
        undersizedTargets,
      )}, verdeckter Fokus=${JSON.stringify(hiddenFocus)}, Tastaturnavigation=${JSON.stringify(
        keyboardNavigation,
      )}`,
    );
    await page.screenshot({
      path: join(ARTIFACT_DIR, `${label.replace(/[^a-z0-9]+/gi, '-') || 'root'}.png`),
      fullPage: true,
    });
    failed += 1;
  }

  for (const path of paths) {
    const page = await context.newPage();
    const url = `${BASE_URL}${path}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    await dismissOptionalOverlay(page);

    const initialJoinFocus = path === '/de/join' ? await inspectMobileJoinEntry(page) : [];
    const keyboardNavigation =
      path === '/de/' ? await inspectHomeKeyboardNavigation(page) : initialJoinFocus;
    await checkPage(page, path, { keyboardNavigation });
    await page.close();
  }

  const offlinePage = await context.newPage();
  await offlinePage.goto(`${BASE_URL}/de/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await dismissOptionalOverlay(offlinePage);
  await context.setOffline(true);
  await offlinePage.evaluate(() => window.dispatchEvent(new Event('offline')));
  await offlinePage.locator('.app-offline-banner[role="alert"]').waitFor({ state: 'visible' });
  await checkPage(offlinePage, '/de/ (offline-banner)');
  await context.setOffline(false);
  await offlinePage.close();

  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const desktopJoinPage = await desktopContext.newPage();
  await desktopJoinPage.goto(`${BASE_URL}/de/join`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  const desktopJoinFocused = await desktopJoinPage
    .waitForFunction(
      () => document.querySelector('.home-code-segments__input') === document.activeElement,
      undefined,
      { timeout: 1_000 },
    )
    .then(() => true)
    .catch(() => false);
  if (!desktopJoinFocused) {
    console.error('  /de/join (Desktop) … FEHLER: Code-Eingabe erhält keinen Fokus');
    failed++;
  } else {
    console.log('  /de/join (Desktop) … OK (expliziter Join-Fokus)');
  }
  await desktopContext.close();

  await browser.close();

  if (failed > 0) {
    console.error(`\n${failed} Seite(n) mit Reflow-, Fokus- oder Zielgrößenfehlern.`);
    process.exit(1);
  }
  console.log(
    `\n✓ Reflow bei ${VIEWPORT_WIDTH}px, Fokus-Sichtbarkeit und ${MIN_TARGET_SIZE}px-Ziele bestanden (${checkedStates} Zustände + Desktop-Join).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
