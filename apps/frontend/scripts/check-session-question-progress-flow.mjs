#!/usr/bin/env node
/**
 * Playwright smoke for the authoritative session-question progress flow.
 *
 * Verifies with a real host and participant browser that a quiz can start at a
 * later question, an answered question can be skipped, both clients advance to
 * the same next question, and only the conducted question reaches results and
 * the final debrief report.
 *
 * Run:
 *   BASE_URL=http://localhost:4200/de TRPC_URL=http://localhost:3000/trpc \
 *     npm run smoke:session-question-progress -w @arsnova/frontend
 */
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import {
  buildSessionResultsReportHtml,
  getSessionResultsReportLabelsDe,
} from '@arsnova/session-export-report';
import { chromium, webkit } from 'playwright';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:4200/de').replace(/\/+$/, '');
const TRPC_URL = process.env.TRPC_URL || 'http://localhost:3000/trpc';
const ARTIFACT_DIR =
  process.env.SMOKE_ARTIFACT_DIR || join(tmpdir(), 'arsnova-session-question-progress-e2e');
const HOST_TOKEN_STORAGE_PREFIX = 'arsnova-host-token:';
const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 430, height: 932 };
const START_QUESTION_RE = /erste frage starten|start first question/i;
const RELEASE_ANSWERS_RE = /antwortoptionen freigeben|release answer options/i;
const REVEAL_RESULTS_RE = /ergebnis(?: trotzdem)? zeigen|show results/i;
const END_SESSION_RE = /session beenden|end session/i;
const CONFIRM_END_RE = /trotzdem verlassen|leave anyway/i;
const JOIN_RE = /jetzt beitreten|join now|mitmachen/i;
const SKIPPED_ANNOUNCEMENT = 'Die Frage wurde ausgelassen. Die nächste Frage startet.';
const QUESTIONS = {
  neverOpened: 'Smoke-Verlauf: Diese Frage darf nie geöffnet werden',
  skipped: 'Smoke-Verlauf: Diese beantwortete Frage wird ausgelassen',
  conducted: 'Smoke-Verlauf: Nur diese Frage gehört in die Nachbesprechung',
};

const QUIZ_PAYLOAD = {
  name: `Session Question Progress Smoke ${Date.now()}`,
  description: undefined,
  motifImageUrl: null,
  showLeaderboard: true,
  allowCustomNicknames: true,
  defaultTimer: null,
  enableSoundEffects: false,
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
  readingPhaseEnabled: true,
  preset: 'PLAYFUL',
  questions: Object.values(QUESTIONS).map((text, order) => ({
    text,
    type: 'SINGLE_CHOICE',
    timer: null,
    difficulty: 'EASY',
    order,
    ratingMin: undefined,
    ratingMax: undefined,
    ratingLabelMin: undefined,
    ratingLabelMax: undefined,
    answers: [
      { text: `Korrekte Antwort ${order + 1}`, isCorrect: true },
      { text: `Ablenker ${order + 1}`, isCorrect: false },
    ],
  })),
};

function logStep(label, detail = '') {
  console.log(`OK ${label}${detail ? ` - ${detail}` : ''}`);
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function createTrpcClient(hostToken) {
  return createTRPCProxyClient({
    links: [
      httpBatchLink({
        url: TRPC_URL,
        ...(hostToken
          ? {
              headers: () => ({ 'x-host-token': hostToken }),
            }
          : {}),
      }),
    ],
  });
}

async function waitForServer(url, maxAttempts = 40) {
  for (let index = 0; index < maxAttempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      // Service is still starting.
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

async function waitForPathSuffix(page, suffix, timeout = 30_000) {
  await page.waitForFunction(
    (expectedSuffix) => globalThis.location.pathname.endsWith(expectedSuffix),
    suffix,
    { timeout },
  );
}

async function waitForText(page, text, timeout = 20_000) {
  await page.waitForFunction(
    (expected) => (document.body.textContent || '').includes(expected),
    text,
    { timeout },
  );
}

async function clickButton(page, name, timeout = 20_000) {
  const button = page.getByRole('button', { name }).first();
  await button.waitFor({ state: 'visible', timeout });
  await button.click();
  return button;
}

async function closeHostJoinOverlay(host) {
  const closeButton = host.locator('.session-host__join-viewport-overlay__close').first();
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }
}

async function chooseJoinIdentity(page, fallbackName, timeout = 15_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    const textFields = page.locator(
      'input[type="text"], input:not([type]), input[matinput], textarea',
    );
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
      const options = page.getByRole('option');
      for (let index = 0; index < (await options.count()); index += 1) {
        const option = options.nth(index);
        const text = ((await option.innerText().catch(() => '')) || '').trim();
        const disabled = await option.getAttribute('aria-disabled').catch(() => null);
        if (text && !text.includes('Bitte') && disabled !== 'true') {
          await option.click();
          return true;
        }
      }
      await page.keyboard.press('Escape').catch(() => undefined);
    }
    await page.waitForTimeout(250);
  }
  return false;
}

async function joinParticipant(participant, code) {
  await participant.goto(`${BASE_URL}/join/${code}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  ensure(
    await chooseJoinIdentity(participant, 'VerlaufTester'),
    'Teilnehmendenidentität konnte nicht gewählt werden.',
  );

  const joinButton = participant.locator('.join-card__submit').first();
  if (await joinButton.isVisible().catch(() => false)) {
    await joinButton.click();
  } else {
    await clickButton(participant, JOIN_RE);
  }
  await waitForPathSuffix(participant, `/session/${code}/vote`);
  logStep('Teilnehmer tritt der Session bei');
}

async function assertCurrentQuestion(page, selector, expected, excluded = []) {
  const question = page.locator(selector).first();
  await question.waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForFunction(
    ({ currentSelector, text }) =>
      (document.querySelector(currentSelector)?.textContent || '').includes(text),
    { currentSelector: selector, text: expected },
    { timeout: 20_000 },
  );
  const currentText = (await question.textContent()) || '';
  ensure(currentText.includes(expected), `Aktuelle Frage fehlt: ${expected}`);
  for (const forbidden of excluded) {
    ensure(!currentText.includes(forbidden), `Unerwartete frühere Frage sichtbar: ${forbidden}`);
  }
}

async function submitFirstAnswer(participant) {
  const answer = participant.locator('.vote-answer').first();
  await answer.waitFor({ state: 'visible', timeout: 20_000 });
  await answer.click();
  const submit = participant.locator('#vote-submit').first();
  await submit.waitFor({ state: 'visible', timeout: 10_000 });
  await submit.click();
  await participant.waitForFunction(
    () =>
      !document.querySelector('#vote-submit') ||
      document.querySelector('#vote-submit')?.hasAttribute('disabled'),
    undefined,
    { timeout: 15_000 },
  );
}

async function waitForHostVote(host) {
  await host.waitForFunction(
    () => {
      const allVoted = document.querySelector('.session-host__all-voted');
      const progress = document.querySelector('.session-host__vote-progress-meta');
      return Boolean(allVoted) || /1\D+1/.test(progress?.textContent || '');
    },
    undefined,
    { timeout: 20_000 },
  );
}

async function retryExport(hostTrpc, code, timeout = 20_000) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeout) {
    try {
      return await hostTrpc.session.getExportData.query({ code });
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  throw lastError || new Error('Nachbesprechungsdaten wurden nicht verfügbar.');
}

async function main() {
  ensure(await waitForServer(BASE_URL), `Frontend unter ${BASE_URL} ist nicht erreichbar.`);
  ensure(
    await waitForServer(`${TRPC_URL}/health.check`),
    `Backend unter ${TRPC_URL} ist nicht erreichbar.`,
  );

  const publicTrpc = createTrpcClient();
  const { quizId } = await publicTrpc.quiz.upload.mutate(QUIZ_PAYLOAD);
  const { code, hostToken } = await publicTrpc.session.create.mutate({
    quizId,
    type: 'QUIZ',
    startQuestionIndex: 1,
  });
  const hostTrpc = createTrpcClient(hostToken);
  logStep('Session startet mit späterem Startpunkt', `Code ${code}, Startindex 1`);

  await mkdir(ARTIFACT_DIR, { recursive: true });
  const browser = await launchBrowser();
  let host;

  try {
    const hostContext = await browser.newContext({ viewport: DESKTOP });
    await hostContext.addInitScript(
      ({ sessionCode, token, prefix }) => {
        globalThis.sessionStorage.setItem(`${prefix}${sessionCode}`, token);
      },
      { sessionCode: code, token: hostToken, prefix: HOST_TOKEN_STORAGE_PREFIX },
    );
    const participantContext = await browser.newContext({ viewport: MOBILE });
    host = await hostContext.newPage();
    const participant = await participantContext.newPage();

    await host.goto(`${BASE_URL}/session/${code}/host`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await waitForPathSuffix(host, `/session/${code}/host`);
    await host.locator('.session-host__live-participants-count').first().waitFor({
      state: 'visible',
      timeout: 20_000,
    });
    await closeHostJoinOverlay(host);
    await joinParticipant(participant, code);

    await closeHostJoinOverlay(host);
    await clickButton(host, START_QUESTION_RE);
    await assertCurrentQuestion(host, '.session-host__question-title-inner', QUESTIONS.skipped, [
      QUESTIONS.neverOpened,
    ]);
    await assertCurrentQuestion(participant, '.vote-question__text', QUESTIONS.skipped, [
      QUESTIONS.neverOpened,
    ]);
    logStep('Beide Clients öffnen Frage 2; Frage 1 bleibt ungeöffnet');

    await clickButton(host, RELEASE_ANSWERS_RE);
    await submitFirstAnswer(participant);
    await waitForHostVote(host);
    logStep('Teilnehmer stimmt auf Frage 2 ab und Host sieht die Stimme');

    const skipButton = host.locator('button[aria-label="Aktuelle Frage auslassen"]').first();
    await skipButton.waitFor({ state: 'visible', timeout: 10_000 });
    ensure(
      (await skipButton.getAttribute('class'))?.includes('mat-tonal-button'),
      'Die sichtbare Skip-Aktion ist nicht als zurückhaltender Tonal-Button gerendert.',
    );
    await skipButton.click();
    const dialog = host.locator('.cdk-overlay-container').first();
    await waitForText(
      host,
      'Diese Frage wird aus der laufenden Session und der Nachbesprechung ausgeschlossen.',
    );
    const dialogText = (await dialog.textContent()) || '';
    ensure(
      dialogText.includes('Bereits abgegebene Antworten werden nicht ausgewertet.'),
      'Der Skip-Dialog weist bei vorhandener Stimme nicht auf deren Ausschluss hin.',
    );
    await dialog.getByRole('button', { name: 'Frage auslassen', exact: true }).click();

    await participant.waitForFunction(
      (message) =>
        (document.querySelector('[data-testid="question-skipped-announcement"]')?.textContent || '')
          .trim()
          .includes(message),
      SKIPPED_ANNOUNCEMENT,
      { timeout: 20_000 },
    );
    await assertCurrentQuestion(host, '.session-host__question-title-inner', QUESTIONS.conducted, [
      QUESTIONS.neverOpened,
      QUESTIONS.skipped,
    ]);
    await assertCurrentQuestion(participant, '.vote-question__text', QUESTIONS.conducted, [
      QUESTIONS.neverOpened,
      QUESTIONS.skipped,
    ]);
    logStep('Skip wechselt beide Clients konsistent zu Frage 3 und wird live angekündigt');

    await clickButton(host, RELEASE_ANSWERS_RE);
    await submitFirstAnswer(participant);
    await waitForHostVote(host);
    await clickButton(host, REVEAL_RESULTS_RE);
    await participant.locator('#vote-result-anchor').first().waitFor({
      state: 'attached',
      timeout: 20_000,
    });
    await assertCurrentQuestion(participant, '.vote-question__text', QUESTIONS.conducted, [
      QUESTIONS.neverOpened,
      QUESTIONS.skipped,
    ]);
    await assertCurrentQuestion(host, '.session-host__question-title-inner', QUESTIONS.conducted, [
      QUESTIONS.neverOpened,
      QUESTIONS.skipped,
    ]);
    logStep('Live-Ergebnis enthält nur die durchgeführte Frage 3');

    await clickButton(host, END_SESSION_RE);
    const endDialog = host.locator('.cdk-overlay-container').first();
    await endDialog.getByRole('button', { name: CONFIRM_END_RE }).click();
    await host.locator('#session-finished-heading').first().waitFor({
      state: 'visible',
      timeout: 25_000,
    });

    const exportData = await retryExport(hostTrpc, code);
    ensure(exportData.questionProgressAvailable, 'Export meldet keinen autoritativen Verlauf.');
    ensure(exportData.totalQuestionCount === 3, 'Export meldet nicht drei Vorlagenfragen.');
    ensure(exportData.conductedQuestionCount === 1, 'Export meldet nicht genau eine Durchführung.');
    ensure(
      exportData.skippedQuestionCount === 1,
      'Export meldet nicht genau eine ausgelassene Frage.',
    );
    ensure(exportData.questions.length === 1, 'Export enthält mehr als die durchgeführte Frage.');
    ensure(
      exportData.questions[0]?.questionTextFull.includes(QUESTIONS.conducted),
      'Export enthält die durchgeführte Frage 3 nicht.',
    );

    const reportHtml = buildSessionResultsReportHtml(
      exportData,
      getSessionResultsReportLabelsDe(),
      { localeId: 'de' },
    );
    ensure(reportHtml.includes(QUESTIONS.conducted), 'Nachbesprechung fehlt die Frage 3.');
    ensure(
      !reportHtml.includes(QUESTIONS.skipped),
      'Nachbesprechung enthält die ausgelassene Frage 2.',
    );
    ensure(
      !reportHtml.includes(QUESTIONS.neverOpened),
      'Nachbesprechung enthält die nie geöffnete Frage 1.',
    );
    ensure(
      reportHtml.includes('1 von 3 Fragen durchgeführt · 1 ausgelassen'),
      'Nachbesprechung meldet den Sessionumfang nicht korrekt.',
    );
    ensure(reportHtml.includes('Frage 3 von 3'), 'Nachbesprechung verliert die Originalnummer 3.');
    logStep('Abschließende Nachbesprechung enthält nur Frage 3 mit Originalnummer und Umfang');

    await host.screenshot({
      path: join(ARTIFACT_DIR, 'session-question-progress-finished.png'),
      fullPage: true,
    });
    await participantContext.close();
    await hostContext.close();
  } catch (error) {
    if (host && !host.isClosed()) {
      await host
        .screenshot({
          path: join(ARTIFACT_DIR, 'session-question-progress-failure.png'),
          fullPage: true,
        })
        .catch(() => undefined);
    }
    throw error;
  } finally {
    await browser.close();
  }

  console.log('\nSession-Question-Progress-Smoke bestanden.');
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
