#!/usr/bin/env node
/**
 * #470 Slice 5: genuine Home → host journeys. Session creation is performed
 * exclusively by UI actions; tRPC reads assert the resulting server state.
 * The only API join supplies a participant to verify identity across formats.
 * Run sequentially against a localized build and local PostgreSQL/Redis:
 * BASE_URL=http://localhost:4200/de TRPC_URL=http://localhost:3000/trpc \
 * SMOKE_ARTIFACT_DIR=/tmp/host-home-entry npm run smoke:host-home-entry -w @arsnova/frontend
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { chromium } from 'playwright';
import { assertNoBlockingA11y } from './axe-a11y.mjs';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:4200/de')
  .replace(/\/+$/, '')
  .replace(/\/(de|en|fr|es|it)$/, '');
const TRPC_URL = process.env.TRPC_URL || 'http://localhost:3000/trpc';
const ARTIFACT_DIR = process.env.SMOKE_ARTIFACT_DIR || join('tmp', 'host-home-entry', randomUUID());
const PREFERENCE = 'arsnova-host-scenario:v1';
const SESSION_PREFIX = 'arsnova-host-scenario-session:v1:';
const CHIPS = ['TEMPO', 'MOOD', 'YESNO', 'STARS'];
const CASES = [
  { locale: 'de', width: 320, preset: 'spielerisch', theme: 'light' },
  { locale: 'de', width: 1440, preset: 'serious', theme: 'dark' },
  { locale: 'en', width: 320, preset: 'serious', theme: 'light' },
  { locale: 'fr', width: 1440, preset: 'spielerisch', theme: 'dark' },
  { locale: 'es', width: 600, preset: 'serious', theme: 'dark' },
  { locale: 'it', width: 840, preset: 'spielerisch', theme: 'light' },
];
const outcomes = [];

function client(hostToken) {
  return createTRPCProxyClient({
    links: [
      httpBatchLink({ url: TRPC_URL, headers: hostToken ? { 'x-host-token': hostToken } : {} }),
    ],
  });
}

async function eventually(read, predicate, label) {
  const deadline = Date.now() + 20_000;
  do {
    const value = await read();
    if (predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 200));
  } while (Date.now() < deadline);
  throw new Error(`Timed out: ${label}`);
}

async function expectFocus(page, selector) {
  await page.waitForFunction((target) => {
    const element = document.querySelector(target);
    if (document.activeElement !== element || !element?.getClientRects().length) return false;
    const r = element.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return (
      r.top >= 0 &&
      r.bottom <= innerHeight &&
      r.left >= 0 &&
      r.right <= innerWidth &&
      (hit === element || element.contains(hit))
    );
  }, selector);
}

async function expectCardBelowToolbar(page, selector) {
  await page.waitForFunction((target) => {
    const toolbar = document.querySelector('app-top-toolbar .top-toolbar');
    const card = document.querySelector(target);
    if (!(toolbar instanceof HTMLElement) || !(card instanceof HTMLElement)) return false;
    return card.getBoundingClientRect().top >= toolbar.getBoundingClientRect().bottom + 8;
  }, selector);
}

async function expectQuizActionRowsDoNotOverlap(page) {
  const cards = page.locator('mat-card.quiz-list-item');
  for (let index = 0; index < (await cards.count()); index += 1) {
    const card = cards.nth(index);
    const secondary = await card.locator('.quiz-list-item__actions-secondary').boundingBox();
    const primary = await card.locator('.quiz-list-item__actions-primary').boundingBox();
    assert.ok(secondary && primary, `quiz card ${index + 1}: action rows are measurable`);
    assert.ok(
      secondary.y + secondary.height <= primary.y + 0.5,
      `quiz card ${index + 1}: primary actions do not overlap secondary links`,
    );
  }
}

async function dismissJoin(page) {
  const close = page.locator('.session-host__join-viewport-overlay__close');
  if (
    await close.waitFor({ state: 'visible', timeout: 3000 }).then(
      () => true,
      () => false,
    )
  ) {
    await page.locator('.session-host__join-menu-qr').waitFor();
    await close.click();
    await close.waitFor({ state: 'hidden' });
  }
}

async function snapshot(page, label, axe = false) {
  await page.evaluate(() => document.fonts.ready);
  assert.equal(
    await page.evaluate(
      () =>
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 2,
    ),
    true,
    `${label}: horizontal overflow`,
  );
  if (axe) await assertNoBlockingA11y(page, label, { artifactDir: ARTIFACT_DIR });
  await page.screenshot({ path: join(ARTIFACT_DIR, `${label}.png`), fullPage: true });
}

async function createContext(browser, sample) {
  return browser.newContext({
    viewport: { width: sample.width, height: 1000 },
    locale: sample.locale,
    colorScheme: sample.theme,
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });
}

async function withHome(page, sample, label, run) {
  const context = page.context();
  const sessions = new Map();
  const requests = [];
  const feedbackStarts = [];
  page.setDefaultTimeout(20_000);
  await context.addInitScript(
    ({ sample }) => {
      if (sessionStorage.getItem('host-home-entry-seeded')) return;
      localStorage.setItem('home-theme', sample.theme);
      localStorage.setItem('home-preset', sample.preset);
      sessionStorage.setItem('host-home-entry-seeded', '1');
    },
    { sample },
  );
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/trpc/')) {
      const names = new URL(request.url()).pathname.split('/trpc/')[1].split(',');
      requests.push(...names);
      names.forEach((name, index) => {
        if (name === 'quickFeedback.create') {
          const body = request.postDataJSON();
          feedbackStarts.push(body[index]?.json ?? body[index] ?? body.json ?? body);
        }
      });
    }
  });
  try {
    await page.goto(`${BASE_URL}/${sample.locale}/`, { waitUntil: 'domcontentloaded' });
    const motdClose = page.locator('.home-motd-sheet__head button[aria-label]');
    if (
      await motdClose.waitFor({ state: 'visible', timeout: 3000 }).then(
        () => true,
        () => false,
      )
    ) {
      await motdClose.click();
      await page.locator('.home-motd-sheet').waitFor({ state: 'hidden' });
    }
    await page.locator('.home-scenario').waitFor();
    assert.equal(
      await page.locator('.home-host-stack > .home-card').filter({ visible: true }).count(),
      0,
    );
    assert.equal(await page.locator('.home-feedback-chip').filter({ visible: true }).count(), 0);
    assert.equal(await page.locator('.home-scenario__option[aria-pressed="true"]').count(), 0);
    await run({ requests, sessions });
    for (const start of feedbackStarts) {
      assert(sessions.has(start.sessionCode), 'Feedback must belong to the UI-created session');
    }
    outcomes.push({
      label,
      ...sample,
      sessionCreates: requests.filter((name) => name === 'session.create').length,
    });
    console.log(`OK ${label}`);
  } catch (error) {
    // Recovery cards contain secrets: never capture dialogs on failure.
    if (!(await page.locator('mat-dialog-container').count())) {
      await page
        .screenshot({ path: join(ARTIFACT_DIR, `${label}-failure.png`), fullPage: true })
        .catch(() => {});
    }
    throw error;
  } finally {
    for (const [code, hostApi] of sessions) {
      await hostApi.session.end.mutate({ code }).catch(() => {});
    }
    await context.close();
  }
}

async function currentSession(page, sessions) {
  await page.waitForURL(/\/session\/[A-Z0-9]{6}\/host/);
  const code = new URL(page.url()).pathname.match(/\/session\/([A-Z0-9]{6})\/host/)[1];
  const token = await page.evaluate(
    (code) => sessionStorage.getItem(`arsnova-host-token:${code}`),
    code,
  );
  assert(token, 'UI creation must persist the host capability');
  const hostApi = client(token);
  sessions.set(code, hostApi);
  return { code, hostApi };
}

async function assertScenario(page, code, scenario) {
  const entry = await page.evaluate(
    (key) => sessionStorage.getItem(key),
    `${SESSION_PREFIX}${code}`,
  );
  assert.equal(entry === null ? null : JSON.parse(entry).scenario, scenario);
}

async function quickStarts(browser) {
  for (const sample of CASES) {
    const name = `${sample.locale}-${sample.preset}-${sample.width}`;
    // Every chip is clicked in every locale/preset sample, with isolated storage.
    for (const [index, type] of CHIPS.entries()) {
      const context = await createContext(browser, sample);
      const page = await context.newPage();
      await withHome(page, sample, `${name}-${type}`, async ({ requests, sessions }) => {
        if (index === 0) {
          await snapshot(page, `${name}-home`, true);
          await page.locator('.home-scenario').scrollIntoViewIfNeeded();
          await snapshot(page, `${name}-home-task`);
        }
        await page.locator('#home-host-tab-feedback').click();
        if (index === 0) {
          await page.locator('.home-feedback-chip').last().scrollIntoViewIfNeeded();
          await snapshot(page, `${name}-home-cards`);
        }
        await page.locator('.home-feedback-chip').nth(index).click();
        const { code, hostApi } = await currentSession(page, sessions);
        await page.getByTestId('feedback-primary-round-control').waitFor();
        await dismissJoin(page);
        assert.equal(
          await page.locator('mat-dialog-container').count(),
          0,
          'Direct chip adds no dialog',
        );
        assert.equal(requests.filter((name) => name === 'session.create').length, 1);
        const info = await hostApi.session.getInfo.query({ code });
        assert.equal(info.channels.quickFeedback.enabled, true);
        assert.equal(info.channels.quickFeedback.open, true);
        assert.equal(info.channels.qa.enabled, false);
        assert.equal(info.preferredChannel, 'quickFeedback');
        const result = await hostApi.quickFeedback.hostResults.query({ sessionCode: code });
        assert.equal(result.type, type);
        assert.equal(await page.locator('.session-channel-tabs').count(), 0);
        await assertScenario(page, code, 'QUICK');
        assert.equal(await page.evaluate((key) => localStorage.getItem(key), PREFERENCE), null);
        if (index === 0) await snapshot(page, `${name}-feedback`, true);
      });
    }
  }
}

async function chooseEvent(page) {
  const eventChoice = page.locator('.home-scenario__option').nth(1);
  if (page.viewportSize().width === 320) {
    const classroomChoice = page.locator('.home-scenario__option').first();
    const quickChoice = page.locator('.home-scenario__option').nth(2);

    // iPad-Mini-Breite: Die Zielkarte muss vollständig unter der fixierten Appbar beginnen.
    await page.setViewportSize({ width: 1024, height: 768 });
    await classroomChoice.click();
    await expectCardBelowToolbar(page, '#home-host-quiz');
    await page.setViewportSize({ width: 320, height: 1000 });
    await eventChoice.scrollIntoViewIfNeeded();

    await eventChoice.focus();
    await eventChoice.press('Enter');
    await expectFocus(page, '#home-host-tab-qa');
    await expectCardBelowToolbar(page, '#home-host-qa');
    await page.keyboard.press('Tab');
    await expectFocus(page, '[data-testid="home-live-qa-create"]');

    await quickChoice.focus();
    await quickChoice.press('Space');
    await expectFocus(page, '#home-host-tab-feedback');
    await expectCardBelowToolbar(page, '#host-quick-feedback');
    await page.keyboard.press('Tab');
    await expectFocus(page, '#host-quick-feedback .home-feedback-chip');

    await eventChoice.focus();
    await eventChoice.press('Enter');
    await expectFocus(page, '#home-host-tab-qa');
    await expectCardBelowToolbar(page, '#home-host-qa');
  } else {
    await eventChoice.click();
    await expectCardBelowToolbar(page, '#home-host-qa');
  }
  await page.getByTestId('home-event-both').waitFor();
  if (page.viewportSize().width >= 1200) {
    await page.evaluate(() => document.fonts.ready);
    const geometry = () =>
      page
        .locator('.home-hero-band, .home-scenario, .home-host-stack > .home-card')
        .evaluateAll((elements) =>
          elements.map((element) => {
            const r = element.getBoundingClientRect();
            return [r.x + scrollX, r.y + scrollY, r.width, r.height];
          }),
        );
    const before = await geometry();
    const toggles = page.locator('.top-toolbar__center .top-toolbar__toggles--preset button');
    await toggles.first().click();
    await page.waitForFunction(() => document.documentElement.classList.contains('preset-playful'));
    await page.evaluate(() => document.fonts.ready);
    assert.equal(
      await page.locator('.home-scenario__option').nth(1).getAttribute('aria-pressed'),
      'true',
    );
    const after = await geometry();
    assert.equal(after.length, before.length);
    after.forEach((rect, i) =>
      rect.forEach((value, j) =>
        assert(
          Math.abs(value - before[i][j]) <= 2,
          `Preset changes Home geometry: ${JSON.stringify({ before, after })}`,
        ),
      ),
    );
    await toggles.last().click();
  }
  assert.equal(
    await page.locator('mat-dialog-container').count(),
    0,
    'Task selection adds no dialog',
  );
  await page.getByTestId('home-event-both').click();
  await page.locator('app-session-participation-profile-dialog').waitFor();
}

async function acceptProfile(page) {
  const profile = page.locator('app-session-participation-profile-dialog');
  await profile.locator('mat-radio-button[value="CUSTOM_NICKNAME"]').click();
  await profile.locator('mat-dialog-actions button').last().click();
  await page.getByTestId('host-recovery-card-done').waitFor();
}

async function acceptQa(page) {
  const dialog = page.locator('app-host-recovery-card-dialog');
  assert.match(await dialog.locator('.dialog-title-header__step').innerText(), /2/);
  assert.equal(await page.locator('app-qa-channel-configuration-dialog').count(), 0);
  await page.getByRole('checkbox').check();
  await page.getByTestId('host-recovery-card-done').click();
  await page.getByTestId('qa-tools-toggle').waitFor();
  await dismissJoin(page);
}

async function dismissHomeMotd(page) {
  const close = page.locator('.home-motd-sheet__head button[aria-label]');
  if (
    await close.waitFor({ state: 'visible', timeout: 3000 }).then(
      () => true,
      () => false,
    )
  ) {
    await close.click();
    await page.locator('.home-motd-sheet').waitFor({ state: 'hidden' });
  }
}

async function createOpenQaSession(browser, sample, sessions) {
  const context = await createContext(browser, sample);
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  try {
    await page.goto(`${BASE_URL}/${sample.locale}/`, { waitUntil: 'domcontentloaded' });
    await dismissHomeMotd(page);
    await page.getByTestId('home-live-qa-create').click();
    await acceptProfile(page);
    const created = await currentSession(page, sessions);
    await acceptQa(page);
    const browserCapability = await page.evaluate(
      (code) => localStorage.getItem(`arsnova-host-browser-capability-${code}`),
      created.code,
    );
    assert(browserCapability, `Missing browser capability for ${created.code}`);
    return { code: created.code, browserCapability };
  } finally {
    await context.close();
  }
}

async function openHostSessionRemoval(page, code) {
  const trigger = page.getByTestId('home-host-session-menu-trigger');
  await trigger.click();
  await page
    .locator(`[data-testid="home-host-session-menu-remove"][data-session-code="${code}"]`)
    .click();
  const dialog = page.locator('app-confirm-leave-dialog');
  await dialog.waitFor();
  await page.locator('.cdk-overlay-container [role="menu"]').waitFor({ state: 'hidden' });
  return dialog;
}

async function qaSessionMenu(browser) {
  const sample = CASES[1];
  const sessions = new Map();
  const credentials = [];
  let context;
  try {
    for (let index = 0; index < 4; index += 1) {
      credentials.push(await createOpenQaSession(browser, sample, sessions));
    }

    context = await createContext(browser, sample);
    await context.addInitScript(
      ({ sample, credentials }) => {
        localStorage.setItem('home-theme', sample.theme);
        localStorage.setItem('home-preset', sample.preset);
        for (const credential of credentials) {
          localStorage.setItem(
            `arsnova-host-browser-capability-${credential.code}`,
            credential.browserCapability,
          );
        }
        localStorage.setItem('arsnova-last-hosted-session', credentials.at(-1).code);
      },
      { sample, credentials },
    );
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    await page.goto(`${BASE_URL}/de/`, { waitUntil: 'domcontentloaded' });
    await dismissHomeMotd(page);

    const trigger = page.getByTestId('home-host-session-menu-trigger');
    await trigger.waitFor();
    assert.match(await trigger.innerText(), /\(4\)/);

    // Cancel keeps all entries and returns to the now-closed menu trigger.
    let dialog = await openHostSessionRemoval(page, credentials[0].code);
    await dialog.getByRole('button', { name: 'Abbrechen' }).click();
    await dialog.waitFor({ state: 'hidden' });
    await expectFocus(page, '[data-testid="home-host-session-menu-trigger"]');
    assert.match(await trigger.innerText(), /\(4\)/);

    // A failed global end also restores the four-item menu and its trigger.
    await page.route(/\/trpc\/[^?]*session\.end/, (route) => route.abort('failed'), {
      times: 1,
    });
    dialog = await openHostSessionRemoval(page, credentials[1].code);
    await dialog.getByRole('button', { name: 'Session löschen' }).click();
    await dialog.waitFor({ state: 'hidden' });
    await expectFocus(page, '[data-testid="home-host-session-menu-trigger"]');
    assert.match(await trigger.innerText(), /\(4\)/);

    // A successful end keeps the pull-down while three open sessions remain.
    dialog = await openHostSessionRemoval(page, credentials[2].code);
    await dialog.getByRole('button', { name: 'Session löschen' }).click();
    await eventually(
      () => trigger.innerText(),
      (label) => /\(3\)/.test(label),
      'four host-session CTAs collapse to three',
    );
    await expectFocus(page, '[data-testid="home-host-session-menu-trigger"]');

    // At 3 → 2 the menu disappears; focus follows the first visible remove action.
    dialog = await openHostSessionRemoval(page, credentials[3].code);
    await dialog.getByRole('button', { name: 'Nur Schnellzugang entfernen' }).click();
    await trigger.waitFor({ state: 'detached' });
    assert.equal(await page.getByTestId('home-host-recovery').count(), 2);
    await expectFocus(page, '[data-testid="home-host-session-remove"]');
    outcomes.push({
      label: 'qa-session-menu-lifecycle',
      ...sample,
      sessionCreates: credentials.length,
    });
    console.log('OK qa-session-menu-lifecycle');
  } finally {
    await context?.close();
    for (const [code, hostApi] of sessions) {
      await hostApi.session.end.mutate({ code }).catch(() => {});
    }
  }
}

async function eventStarts(browser) {
  for (const failure of [false, true]) {
    const sample = CASES[failure ? 1 : 0];
    const label = failure ? 'event-partial-retry' : 'event-both';
    const context = await createContext(browser, sample);
    const page = await context.newPage();
    await withHome(page, sample, label, async ({ requests, sessions }) => {
      await chooseEvent(page);
      await acceptProfile(page);
      const { code, hostApi } = await currentSession(page, sessions);
      if (failure) {
        await page.route(
          /\/trpc\/[^?]*session\.enableQuickFeedbackChannel/,
          (route) => route.abort('failed'),
          { times: 1 },
        );
      }
      await acceptQa(page);
      if (failure) {
        await page.getByTestId('host-steering-retry').waitFor();
        assert.match(await page.locator('#host-steering-callout').innerText(), /Q&A ist geöffnet/);
        const partial = await hostApi.session.getInfo.query({ code });
        assert.equal(partial.channels.qa.open, true);
        assert.equal(partial.channels.quickFeedback.enabled, false);
        assert.equal(await page.locator('.session-channel-tabs').count(), 0);
        await snapshot(page, label);
        await page.getByTestId('host-steering-retry').click();
      }
      await eventually(
        () => hostApi.session.getInfo.query({ code }),
        (info) => info.channels.quickFeedback.enabled && info.preferredChannel === 'qa',
        'Beides completes',
      );
      await page.waitForFunction(
        () => document.querySelectorAll('.session-channel-tabs mat-button-toggle').length === 2,
      );
      assert.equal(requests.filter((name) => name === 'session.create').length, 1);
      assert.equal(requests.filter((name) => name === 'session.configureQaChannel').length, 0);
      await assertScenario(page, code, 'EVENT');
      const participant = await client().session.join.mutate({
        code,
        nickname: 'HomeEntryTester',
        anonymousClientId: crypto.randomUUID(),
        joinIdempotencyKey: crypto.randomUUID(),
      });
      await page.locator('.session-channel-tabs mat-button-toggle').last().click();
      await page.getByTestId('feedback-empty-tempo').click();
      await page.getByTestId('feedback-round-settings-trigger').waitFor();
      await page.locator('.session-channel-tabs mat-button-toggle').first().click();
      assert.equal((await hostApi.session.getInfo.query({ code })).participantCount, 1);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByTestId('qa-tools-toggle').waitFor();
      await dismissJoin(page);
      await assertScenario(page, code, 'EVENT');
      assert.equal(await page.locator('mat-dialog-container').count(), 0);
      assert.equal(requests.filter((name) => name === 'session.configureQaChannel').length, 0);
      const participantApi = createTRPCProxyClient({
        links: [
          httpBatchLink({
            url: TRPC_URL,
            headers: { 'x-participant-capability': participant.rejoinToken },
          }),
        ],
      });
      await participantApi.qa.submit.mutate({
        sessionId: participant.id,
        participantId: participant.participantId,
        text: 'Identität nach Formatwechsel',
        idempotencyKey: crypto.randomUUID(),
      });
      // A new tab receives shared localStorage capabilities but no per-session task.
      const neutral = await context.newPage();
      await neutral.goto(`${BASE_URL}/de/session/${code}/host`, { waitUntil: 'domcontentloaded' });
      await neutral.getByTestId('qa-tools-toggle').waitFor();
      await dismissJoin(neutral);
      await assertScenario(neutral, code, null);
      assert.equal(await neutral.locator('mat-dialog-container').count(), 0);
      assert.equal((await hostApi.session.getInfo.query({ code })).preferredChannel, 'qa');
      await neutral.close();
      await page.goto(`${BASE_URL}/de/`, { waitUntil: 'domcontentloaded' });
      await page.locator('#home-host-tab-qa').click();
      await page.locator(`[data-testid="home-host-recovery"][data-session-code="${code}"]`).click();
      await page.getByTestId('qa-tools-toggle').waitFor();
      await dismissJoin(page);
      await assertScenario(page, code, 'EVENT');
      assert.equal(await page.locator('mat-dialog-container').count(), 0);
      assert.equal(requests.filter((name) => name === 'session.create').length, 1);
      assert.equal(requests.filter((name) => name === 'session.configureQaChannel').length, 0);
      await snapshot(page, `${label}-complete`, true);
    });
  }
  for (const step of [1, 2]) {
    const context = await createContext(browser, CASES[1]);
    const page = await context.newPage();
    await withHome(page, CASES[1], `event-cancel-step-${step}`, async ({ requests, sessions }) => {
      await chooseEvent(page);
      if (step === 2) {
        await acceptProfile(page);
        const { code, hostApi } = await currentSession(page, sessions);
        await page.getByTestId('host-recovery-card-cancel').click();
        await page.getByTestId('host-recovery-card-done').waitFor({ state: 'hidden' });
        await dismissJoin(page);
        await expectFocus(page, '[aria-controls="session-host-join-info"]');
        const info = await hostApi.session.getInfo.query({ code });
        assert.equal(info.channels.quickFeedback.enabled, false);
        assert.equal(info.hostEnded, false);
        assert.equal(info.status, 'LOBBY');
        assert.equal(await page.locator('.session-channel-tabs').count(), 0);
        assert.equal(await page.getByTestId('host-steering-retry').count(), 0);
      } else {
        await page
          .locator('app-session-participation-profile-dialog mat-dialog-actions button')
          .first()
          .click();
        await expectFocus(page, '[data-testid="home-event-both"]');
      }
      assert.equal(requests.filter((name) => name === 'session.create').length, step - 1);
      assert.equal(
        requests.filter((name) => name === 'session.enableQuickFeedbackChannel').length,
        0,
      );
      assert.equal(await page.locator('mat-dialog-container').count(), 0);
    });
  }
}

async function classroom(browser) {
  const context = await createContext(browser, CASES[1]);
  const page = await context.newPage();
  await withHome(
    page,
    CASES[1],
    'classroom-selection-and-last-quiz',
    async ({ requests, sessions }) => {
      await page.locator('.home-scenario__option').first().click();
      await page.locator('.home-card--create a.home-library-button').click();
      const payload = {
        exportVersion: 30,
        exportedAt: new Date().toISOString(),
        quiz: {
          name: `Home Entry Classroom ${Date.now()}`,
          motifImageUrl: null,
          showLeaderboard: false,
          allowCustomNicknames: true,
          defaultTimer: null,
          enableSoundEffects: false,
          enableRewardEffects: false,
          enableMotivationMessages: false,
          enableEmojiReactions: false,
          anonymousMode: false,
          teamMode: false,
          backgroundMusic: null,
          nicknameTheme: 'NOBEL_LAUREATES',
          readingPhaseEnabled: true,
          preset: 'SERIOUS',
          questions: [0, 1].map((order) => ({
            text: `Frage ${order + 1}`,
            type: 'SINGLE_CHOICE',
            difficulty: 'EASY',
            order,
            timer: null,
            answers: [
              { text: 'Richtig', isCorrect: true },
              { text: 'Falsch', isCorrect: false },
            ],
          })),
        },
      };
      await page.locator('input[type="file"]').setInputFiles({
        name: 'host-entry.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(payload)),
      });
      const card = page.locator('mat-card.quiz-list-item', { hasText: payload.quiz.name });
      await card.waitFor();
      await expectQuizActionRowsDoNotOverlap(page);
      await card.locator('.quiz-list-item__actions-primary button').first().click();
      const first = await currentSession(page, sessions);
      await page.getByTestId('lobby-start-session').waitFor();
      await dismissJoin(page);
      await assertScenario(page, first.code, 'CLASSROOM');
      assert.equal(await page.locator('mat-dialog-container').count(), 0);
      await page.goto(`${BASE_URL}/de/`, { waitUntil: 'domcontentloaded' });
      await page.locator('#home-host-tab-quiz').click();
      await page.getByTestId('home-live-last-quiz').click();
      const resumed = await currentSession(page, sessions);
      assert.equal(resumed.code, first.code, 'Last own quiz resumes the existing lobby');
      await page.getByTestId('lobby-start-session').waitFor();
      await dismissJoin(page);
      await snapshot(page, 'classroom-home-lobby');
      await client().session.join.mutate({
        code: first.code,
        nickname: 'ClassroomTester',
        anonymousClientId: crypto.randomUUID(),
        joinIdempotencyKey: crypto.randomUUID(),
      });
      await page.getByTestId('lobby-start-session').click();
      for (let question = 0; question < 2; question += 1) {
        await eventually(
          () => first.hostApi.session.getInfo.query({ code: first.code }),
          (s) => s.status === 'QUESTION_OPEN',
          'reading phase',
        );
        await page.locator('.session-host__exit-anchor-button--primary').click();
        await eventually(
          () => first.hostApi.session.getInfo.query({ code: first.code }),
          (s) => s.status === 'ACTIVE',
          'voting phase',
        );
        await page
          .locator('.session-host__exit-anchor-button--reveal-options')
          .waitFor({ state: 'hidden' });
        if (question === 0) await snapshot(page, 'classroom-home-active');
        await page.locator('.session-host__exit-anchor-button--primary').click();
        await eventually(
          () => first.hostApi.session.getInfo.query({ code: first.code }),
          (s) => s.status === 'RESULTS',
          'results',
        );
        await page.locator('.session-host__exit-anchor-button--primary').click();
      }
      await page.locator('#session-finished-heading').waitFor();
      await eventually(
        () => first.hostApi.session.getInfo.query({ code: first.code }),
        (s) => s.status === 'FINISHED',
        'overall result',
      );
      assert.equal(requests.filter((name) => name === 'session.create').length, 1);
      await snapshot(page, 'classroom-home-finished', true);
      // Deliberately delay and reject the actual menu-export request. Pending must
      // preserve Material's focus return without allowing another export/menu.
      let releaseExport;
      let exportRequests = 0;
      const exportGate = new Promise((resolve) => {
        releaseExport = resolve;
      });
      await page.route(
        /\/trpc\/[^?]*session\.getExportData/,
        async (route) => {
          exportRequests += 1;
          await exportGate;
          await route.abort('failed');
        },
        { times: 1 },
      );
      const exportTrigger = page.locator('.session-host__export-more-btn');
      await exportTrigger.focus();
      await exportTrigger.press('Enter');
      await page.getByRole('menuitem', { name: /Barrierefrei/ }).click();
      await eventually(
        () => exportTrigger.getAttribute('aria-busy'),
        (busy) => busy === 'true',
        'export pending',
      );
      await expectFocus(page, '.session-host__export-more-btn');
      await exportTrigger.press('Enter');
      assert.equal(await page.getByRole('menu').count(), 0);
      assert.equal(exportRequests, 1);
      releaseExport();
      await page.getByTestId('host-steering-retry').waitFor();
      await expectFocus(page, '#host-steering-callout');
      await page.route(
        /\/trpc\/[^?]*session\.getExportData/,
        async (route) => {
          exportRequests += 1;
          await route.abort('failed');
        },
        { times: 1 },
      );
      await page.keyboard.press('Tab');
      await expectFocus(page, '[data-testid="host-steering-retry"]');
      await page.keyboard.press('Enter');
      await eventually(
        () => exportRequests,
        (count) => count === 2,
        'export retry',
      );
      await page.getByTestId('host-steering-retry').waitFor();
      await expectFocus(page, '#host-steering-callout');
      await snapshot(page, 'classroom-export-error');
    },
  );
}

await mkdir(ARTIFACT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const group = process.env.HOME_SMOKE_GROUP;
  assert(
    !group || ['quick', 'event', 'classroom', 'menu'].includes(group),
    'Unknown HOME_SMOKE_GROUP',
  );
  if (!group || group === 'quick') await quickStarts(browser);
  if (!group || group === 'event') await eventStarts(browser);
  if (!group || group === 'classroom') await classroom(browser);
  if (!group || group === 'menu') await qaSessionMenu(browser);
  await writeFile(join(ARTIFACT_DIR, 'summary.json'), JSON.stringify(outcomes, null, 2));
  console.log(`PASS: ${outcomes.length} genuine Home journeys; no API-created start sessions.`);
} finally {
  await browser.close();
}
