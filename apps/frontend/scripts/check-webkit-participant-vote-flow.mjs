#!/usr/bin/env node
/**
 * Playwright WebKit-E2E aus Teilnehmendensicht (Safari-Engine, Smartphone-Viewport).
 *
 * Deckt den In-App-Kontext SESSION_VOTE + PHONE + SAFARI ab: UI-Join, freie
 * Vote-Kanäle, Countdown und Abstimmung. Playwright WebKit ist nicht iOS-Safari.
 *
 * Run:
 *   BASE_URL=http://localhost:4200/de TRPC_URL=http://localhost:3000/trpc \
 *     SMOKE_ARTIFACT_DIR=tmp/webkit-participant-vote-e2e \
 *     npm run smoke:webkit-participant-vote -w @arsnova/frontend
 */
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { webkit } from 'playwright';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:4200/de').replace(/\/+$/, '');
const TRPC_URL = (process.env.TRPC_URL || 'http://localhost:3000/trpc').replace(/\/+$/, '');
const ARTIFACT_DIR = process.env.SMOKE_ARTIFACT_DIR || 'tmp/webkit-participant-vote-e2e';
const HOST_TOKEN_STORAGE_PREFIX = 'arsnova-host-token:';
const DESKTOP = { width: 1280, height: 900 };
const IPHONE = { width: 390, height: 844 };
const IPHONE_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const QUESTION_TEXT = 'WebKit-Teilnahme: Was ist 2+2?';

const QUIZ_PAYLOAD = {
  name: `WebKit Participant Vote ${Date.now()}`,
  description: undefined,
  motifImageUrl: null,
  showLeaderboard: true,
  allowCustomNicknames: true,
  defaultTimer: 20,
  enableSoundEffects: true,
  enableRewardEffects: false,
  enableMotivationMessages: false,
  enableEmojiReactions: false,
  anonymousMode: false,
  teamMode: false,
  teamCount: null,
  teamAssignment: 'AUTO',
  teamNames: [],
  backgroundMusic: null,
  nicknameTheme: 'NOBEL_LAUREATES',
  bonusTokenCount: 1,
  readingPhaseEnabled: false,
  preset: 'SERIOUS',
  questions: [
    {
      text: QUESTION_TEXT,
      type: 'SINGLE_CHOICE',
      timer: 20,
      difficulty: 'EASY',
      order: 0,
      ratingMin: undefined,
      ratingMax: undefined,
      ratingLabelMin: undefined,
      ratingLabelMax: undefined,
      answers: [
        { text: '4', isCorrect: true },
        { text: '5', isCorrect: false },
      ],
    },
  ],
};

function logStep(label, detail = '') {
  console.log(`OK ${label}${detail ? ` — ${detail}` : ''}`);
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function createPublicTrpc() {
  return createTRPCProxyClient({
    links: [httpBatchLink({ url: TRPC_URL })],
  });
}

function createHostTrpc(hostToken) {
  return createTRPCProxyClient({
    links: [
      httpBatchLink({
        url: TRPC_URL,
        headers: () => ({ 'x-host-token': hostToken }),
      }),
    ],
  });
}

async function waitForServer(url, maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 404) return true;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function shot(page, name) {
  const path = join(ARTIFACT_DIR, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  console.log(`SHOT ${path}`);
  return path;
}

async function injectHostToken(page, code, hostToken) {
  await page.addInitScript(
    ({ sessionCode, token, prefix }) => {
      globalThis.sessionStorage.setItem(`${prefix}${sessionCode}`, token);
    },
    { sessionCode: code, token: hostToken, prefix: HOST_TOKEN_STORAGE_PREFIX },
  );
}

async function closeHostJoinOverlay(page) {
  const overlay = page.locator('.session-host__join-viewport-overlay').first();
  const closeButton = page.locator('.session-host__join-viewport-overlay__close').first();
  await overlay.waitFor({ state: 'visible', timeout: 12_000 }).catch(() => undefined);
  if (!(await overlay.isVisible().catch(() => false))) return;
  await overlay
    .locator('img.app-qr-image')
    .first()
    .waitFor({ state: 'visible', timeout: 8_000 })
    .catch(() => undefined);
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click({ timeout: 4_000 }).catch(() => undefined);
  } else {
    await page.keyboard.press('Escape').catch(() => undefined);
  }
  await overlay.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => undefined);
}

async function waitForPathSuffix(page, suffix, timeout = 30_000) {
  await page.waitForFunction(
    (expectedSuffix) => globalThis.location.pathname.endsWith(expectedSuffix),
    suffix,
    { timeout },
  );
}

async function waitForChannelTabs(page, expected = 3, timeout = 15_000) {
  await page.waitForFunction(
    (minimum) =>
      document.querySelectorAll('.session-channel-tabs .session-channel-tabs__label').length >=
      minimum,
    expected,
    { timeout },
  );
}

async function clickChannelTab(page, index) {
  const labels = page.locator('.session-channel-tabs .session-channel-tabs__label');
  await labels.nth(index).waitFor({ state: 'visible', timeout: 10_000 });
  await labels.nth(index).evaluate((element) => {
    const clickable = element.closest('button, [role="radio"], [role="button"]');
    if (clickable instanceof HTMLElement) {
      clickable.click();
      return;
    }
    if (element instanceof HTMLElement) {
      element.click();
    }
  });
}

async function joinParticipant(page, code) {
  await page.goto(`${BASE_URL}/join/${code}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  const nickname = page.locator('input[matinput], input[type="text"]').first();
  await nickname.waitFor({ state: 'visible', timeout: 15_000 });
  await nickname.fill('SafariPhone');
  await page.locator('.join-card__submit').click();
  await waitForPathSuffix(page, `/session/${code}/vote`);
}

async function main() {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  console.log(`Artefakte: ${ARTIFACT_DIR}`);

  ensure(await waitForServer(BASE_URL), `Frontend nicht erreichbar: ${BASE_URL}`);
  ensure(
    await waitForServer(`${TRPC_URL.replace(/\/trpc$/, '')}/health`).catch(() =>
      waitForServer(TRPC_URL),
    ),
    `Backend nicht erreichbar: ${TRPC_URL}`,
  );

  const publicTrpc = createPublicTrpc();
  const { quizId } = await publicTrpc.quiz.upload.mutate(QUIZ_PAYLOAD);
  const created = await publicTrpc.session.create.mutate({
    quizId,
    type: 'QUIZ',
    qaEnabled: true,
    quickFeedbackEnabled: true,
  });
  const code = String(created.code).toUpperCase();
  const hostToken = created.hostToken;
  ensure(code.length >= 4, 'session.create ohne Code');
  ensure(typeof hostToken === 'string' && hostToken.length > 10, 'session.create ohne hostToken');
  const hostTrpc = createHostTrpc(hostToken);
  logStep('Session', code);

  const browser = await webkit.launch({ headless: true });
  const pageErrors = [];

  try {
    const hostContext = await browser.newContext({ viewport: DESKTOP });
    const hostPage = await hostContext.newPage();
    await injectHostToken(hostPage, code, hostToken);
    await hostPage.goto(`${BASE_URL}/session/${code}/host`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await hostPage.locator('.session-host').waitFor({ state: 'visible', timeout: 20_000 });
    await closeHostJoinOverlay(hostPage);
    logStep('Host', 'Session geöffnet');

    const voteContext = await browser.newContext({
      viewport: IPHONE,
      isMobile: true,
      hasTouch: true,
      userAgent: IPHONE_SAFARI_UA,
    });
    const votePage = await voteContext.newPage();
    votePage.on('pageerror', (error) => pageErrors.push(error.message));

    try {
      await joinParticipant(votePage, code);
      await waitForChannelTabs(votePage, 3);
      await shot(votePage, '01-join-lobby-tabs');
      logStep('Join', 'Vote-Route mit drei Kanälen');

      await clickChannelTab(votePage, 1);
      await votePage
        .locator('.session-channel-card--qa')
        .waitFor({ state: 'visible', timeout: 10_000 });
      await shot(votePage, '02-qa-channel');
      logStep('Kanal', 'Q&A ohne Quiz-Sperre');

      await clickChannelTab(votePage, 0);
      await votePage
        .locator('.session-channel-card--qa')
        .waitFor({ state: 'hidden', timeout: 10_000 });
      logStep('Kanal', 'zurück zum Quiz');

      await hostTrpc.session.nextQuestion.mutate({ code });
      await votePage.getByText(QUESTION_TEXT).waitFor({ state: 'visible', timeout: 20_000 });
      await votePage.locator('#vote-option-0').waitFor({ state: 'visible', timeout: 20_000 });
      await votePage.locator('.vote-countdown').waitFor({ state: 'visible', timeout: 10_000 });
      await shot(votePage, '03-active-countdown');
      logStep('ACTIVE', 'Frage und Countdown sichtbar');

      const voteResponse = votePage.waitForResponse(
        (response) =>
          response.request().method() === 'POST' && response.url().includes('/vote.submit'),
        { timeout: 20_000 },
      );
      await votePage.locator('#vote-option-0').click();
      await votePage.locator('#vote-submit').click();
      const response = await voteResponse;
      ensure(response.ok(), `Vote-Submit mit HTTP ${response.status()} abgewiesen`);
      await shot(votePage, '04-vote-submitted');
      logStep('Vote', 'Antwort übermittelt');

      ensure(pageErrors.length === 0, `Browserfehler: ${pageErrors.join(' | ')}`);
    } catch (error) {
      await shot(votePage, '99-failed').catch(() => undefined);
      throw error;
    } finally {
      await voteContext.close();
      await hostContext.close();
    }
  } finally {
    await browser.close().catch(() => undefined);
  }

  console.log('\nWebKit-Teilnahme-E2E bestanden.');
  console.log(`Screenshots: ${ARTIFACT_DIR}`);
}

await main().catch((error) => {
  console.error(error);
  process.exit(1);
});
