#!/usr/bin/env node
/**
 * Smoke-Test fuer Host-/Presenter-Authentifizierung in lokalisierten Session-Routen.
 *
 * Verifiziert:
 * - Host-Route mit gespeichertem Host-Token unter lokalisiertem Pfad
 * - Presenter-Route unter lokalisiertem Pfad ohne Host-Auth-Fehler
 * - Host-Seite aktualisiert die Teilnehmerzahl nach Join live
 *
 * Run:
 *   BASE_URL=http://localhost:4201/de TRPC_URL=http://localhost:3000/trpc node scripts/check-host-present-auth-flow.mjs
 */
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { chromium, webkit } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4201/de';
const TRPC_URL = process.env.TRPC_URL || 'http://localhost:3000/trpc';
const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 430, height: 932 };
const HOST_TOKEN_STORAGE_PREFIX = 'arsnova-host-token:';
const PARTICIPANT_JOIN_BUTTON = /Jetzt beitreten/i;
const QUIZ_PAYLOAD = {
  name: `Host Present Auth ${Date.now()}`,
  description: undefined,
  motifImageUrl: null,
  showLeaderboard: true,
  allowCustomNicknames: true,
  defaultTimer: null,
  enableSoundEffects: true,
  enableRewardEffects: true,
  enableMotivationMessages: true,
  enableEmojiReactions: true,
  anonymousMode: false,
  teamMode: false,
  teamCount: null,
  teamAssignment: 'AUTO',
  teamNames: [],
  backgroundMusic: null,
  nicknameTheme: 'NOBEL_LAUREATES',
  bonusTokenCount: 3,
  readingPhaseEnabled: true,
  preset: 'PLAYFUL',
  questions: [
    {
      text: 'Welche Route wird geprueft?',
      type: 'SINGLE_CHOICE',
      timer: null,
      difficulty: 'EASY',
      order: 0,
      ratingMin: undefined,
      ratingMax: undefined,
      ratingLabelMin: undefined,
      ratingLabelMax: undefined,
      answers: [
        { text: 'Host und Present', isCorrect: true },
        { text: 'Nur Join', isCorrect: false },
      ],
    },
  ],
};

function logStep(ok, label, detail = '') {
  const prefix = ok ? 'OK ' : 'FEHLER ';
  const suffix = detail ? ` — ${detail}` : '';
  console.log(`${prefix}${label}${suffix}`);
}

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

async function chooseJoinIdentity(page, fallbackName) {
  const textFields = page.locator('input[type="text"], input:not([type]), input[matinput], textarea');
  const count = await textFields.count();
  for (let index = 0; index < count; index += 1) {
    const field = textFields.nth(index);
    if (await field.isVisible().catch(() => false)) {
      await field.fill(fallbackName);
      return true;
    }
  }

  const combobox = page.getByRole('combobox').first();
  if (await combobox.isVisible().catch(() => false)) {
    await combobox.click();
    await page.waitForTimeout(300);
    const options = page.getByRole('option');
    const optionCount = await options.count();
    for (let index = 0; index < optionCount; index += 1) {
      const option = options.nth(index);
      const text = ((await option.innerText().catch(() => '')) || '').trim();
      const disabled = await option.getAttribute('aria-disabled').catch(() => null);
      if (text && !text.includes('Bitte') && disabled !== 'true') {
        await option.click();
        await page.waitForTimeout(300);
        return true;
      }
    }
  }

  return false;
}

async function waitForPathSuffix(page, suffix, timeout = 30_000) {
  await page.waitForFunction(
    (expectedSuffix) => globalThis.location.pathname.endsWith(expectedSuffix),
    suffix,
    { timeout },
  );
}

async function waitForParticipantCount(page, expected, timeout = 15_000) {
  const startedAt = Date.now();
  const locator = page.locator('.session-host__live-participants-count').first();
  while (Date.now() - startedAt < timeout) {
    const value = (await locator.textContent().catch(() => '')).trim();
    if (value === String(expected)) {
      return true;
    }
    await page.waitForTimeout(250);
  }
  return false;
}

function createBrowserTrpcClient() {
  return createTRPCProxyClient({
    links: [
      httpBatchLink({
        url: TRPC_URL,
      }),
    ],
  });
}

async function main() {
  console.log(`Warte auf ${BASE_URL}…`);
  const ready = await waitForServer(BASE_URL);
  if (!ready) {
    console.error(`App nicht erreichbar unter ${BASE_URL}.`);
    process.exit(1);
  }

  const trpc = createBrowserTrpcClient();
  const { quizId } = await trpc.quiz.upload.mutate(QUIZ_PAYLOAD);
  const { code, hostToken } = await trpc.session.create.mutate({
    quizId,
    type: 'QUIZ',
    qaEnabled: true,
    quickFeedbackEnabled: true,
  });

  const browser = await launchBrowser();
  const failures = [];

  try {
    const hostContext = await browser.newContext({ viewport: DESKTOP });
    await hostContext.addInitScript(
      ({ sessionCode, token, prefix }) => {
        globalThis.sessionStorage.setItem(`${prefix}${sessionCode}`, token);
      },
      { sessionCode: code, token: hostToken, prefix: HOST_TOKEN_STORAGE_PREFIX },
    );
    const presenterContext = await browser.newContext({ viewport: DESKTOP });
    await presenterContext.addInitScript(
      ({ sessionCode, token, prefix }) => {
        globalThis.sessionStorage.setItem(`${prefix}${sessionCode}`, token);
      },
      { sessionCode: code, token: hostToken, prefix: HOST_TOKEN_STORAGE_PREFIX },
    );
    const participantContext = await browser.newContext({ viewport: MOBILE });

    const host = await hostContext.newPage();
    const presenter = await presenterContext.newPage();
    const participant = await participantContext.newPage();

    await host.goto(`${BASE_URL}/session/${code}/host`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPathSuffix(host, `/session/${code}/host`);
    await host.waitForTimeout(2_000);
    const hostJoinUiReady = await host
      .locator('.session-host__live-participants-count')
      .first()
      .isVisible()
      .catch(() => false);
    logStep(hostJoinUiReady, 'Host-Route laedt mit lokalisiertem Pfad', code);
    if (!hostJoinUiReady) {
      failures.push('Host-Ansicht auf lokalisiertem Pfad zeigt die Live-Join-Oberflaeche nicht.');
    }

    await presenter.goto(`${BASE_URL}/session/${code}/present`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPathSuffix(presenter, `/session/${code}/present`);
    await presenter.waitForTimeout(2_000);
    const presenterText = await visibleText(presenter);
    const presenterOk = !presenterText.includes('Live-Freitextdaten konnten nicht geladen werden.');
    logStep(presenterOk, 'Presenter-Route laedt ohne Host-Auth-Fehler');
    if (!presenterOk) {
      failures.push('Presenter-Ansicht meldet weiterhin fehlgeschlagene Live-Freitextdaten.');
    }

    const initialCount = (await host.locator('.session-host__live-participants-count').first().textContent())
      ?.trim();
    logStep(initialCount === '0', 'Host startet mit 0 Teilnehmenden', initialCount ?? 'unbekannt');
    if (initialCount !== '0') {
      failures.push(`Host startet unerwartet nicht bei 0 Teilnehmenden, sondern bei ${initialCount ?? 'unbekannt'}.`);
    }

    await participant.goto(`${BASE_URL}/join/${code}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await participant.waitForTimeout(1_500);
    const joinReady = await chooseJoinIdentity(participant, 'SmokeTester');
    if (joinReady) {
      await participant.getByRole('button', { name: PARTICIPANT_JOIN_BUTTON }).click();
      await waitForPathSuffix(participant, `/session/${code}/vote`);
      logStep(true, 'Teilnehmer tritt der Session bei');
    } else {
      failures.push('Join-Ansicht bot keine nutzbare Identitaetsauswahl.');
    }

    const updatedCount = await waitForParticipantCount(host, 1);
    logStep(updatedCount, 'Host sieht den Join live');
    if (!updatedCount) {
      failures.push('Host-Ansicht hat die Teilnehmerzahl nach Join nicht live auf 1 aktualisiert.');
    }

    await participantContext.close();
    await presenterContext.close();
    await hostContext.close();
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

  console.log(`\n✓ Host-/Presenter-Auth-Smoke-Test bestanden (${code}).`);
}

await main().catch((error) => {
  console.error(error);
  process.exit(1);
});