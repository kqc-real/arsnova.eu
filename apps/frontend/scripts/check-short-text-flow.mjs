#!/usr/bin/env node
/**
 * Smoke test for deterministic SHORT_TEXT typo scoring with partial credit.
 *
 * Run:
 *   BASE_URL=http://localhost:4200/de TRPC_URL=http://localhost:3000/trpc npm run smoke:short-text -w @arsnova/frontend
 */
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { chromium, webkit } from 'playwright';

function normalizeLoopbackUrl(url) {
  return url.replace('://localhost', '://127.0.0.1');
}

const BASE_URL = (process.env.BASE_URL || 'http://localhost:4200/de').replace(/\/+$/, '');
const PROBE_URL = normalizeLoopbackUrl(BASE_URL);
const TRPC_URL = normalizeLoopbackUrl(process.env.TRPC_URL || 'http://localhost:3000/trpc');
const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 430, height: 932 };
const HOST_TOKEN_STORAGE_PREFIX = 'arsnova-host-token:';
const JOIN_BUTTON_RE = /join now|jetzt beitreten/i;
const START_QUESTION_RE = /start first question|erste frage starten/i;
const REVEAL_RESULTS_RE = /show results|ergebnis zeigen/i;
const SUBMIT_ANSWER_RE = /submit|absenden/i;
const PARTIAL_RESULT_RE = /(teilweise gewertet|partially scored)\s*\((\d{1,3})\s*%\)/i;
const SHORT_TEXT_PROMPT =
  'Which teaching method lets learners vote, discuss briefly, and vote again?';
const MODEL_ANSWER = 'Peer Instruction';
const PARTIAL_ANSWER = 'Peer Instrcution';
const PARTICIPANT_NAME = 'SmokeTester';

const QUIZ_PAYLOAD = {
  name: `Short Text Smoke ${Date.now()}`,
  description: undefined,
  motifImageUrl: null,
  showLeaderboard: true,
  allowCustomNicknames: true,
  defaultTimer: null,
  timerScaleByDifficulty: false,
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
  readingPhaseEnabled: false,
  preset: 'PLAYFUL',
  questions: [
    {
      text: SHORT_TEXT_PROMPT,
      type: 'SHORT_TEXT',
      timer: null,
      difficulty: 'HARD',
      order: 0,
      answers: [
        { text: MODEL_ANSWER, isCorrect: true },
        { text: 'Peer-Instruction', isCorrect: true },
        { text: 'Mazur method', isCorrect: true },
      ],
      shortTextMaxLength: 32,
      shortTextCaseSensitive: false,
      shortTextEvaluationMode: 'auto',
      shortTextToleranceLevel: 'medium',
      shortTextAllowPartialCredit: true,
      shortTextTrimWhitespace: true,
      shortTextNormalizeWhitespace: true,
    },
  ],
};

function logStep(ok, label, detail = '') {
  const prefix = ok ? 'OK ' : 'FEHLER ';
  const suffix = detail ? ` - ${detail}` : '';
  console.log(`${prefix}${label}${suffix}`);
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

async function waitForServer(url, maxAttempts = 30) {
  for (let index = 0; index < maxAttempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      // App not ready yet.
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

async function waitForPathSuffix(page, suffix, timeout = 30_000) {
  await page.waitForFunction(
    (expectedSuffix) => globalThis.location.pathname.endsWith(expectedSuffix),
    suffix,
    { timeout },
  );
}

async function waitForText(page, matcher, timeout = 15_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    const text = await visibleText(page).catch(() => '');
    const matches = typeof matcher === 'string' ? text.includes(matcher) : matcher.test(text);
    if (matches) return text;
    await page.waitForTimeout(250);
  }
  return null;
}

async function dismissDialogIfPresent(page) {
  const dialog = page.getByRole('dialog').first();
  if (!(await dialog.isVisible().catch(() => false))) {
    return;
  }

  const closeButton = dialog.getByRole('button', { name: /close|schlie/i }).first();
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
    await page.waitForTimeout(300);
  }
}

async function clickButton(page, name, timeout = 15_000) {
  const button = page.getByRole('button', { name }).first();
  await button.waitFor({ state: 'visible', timeout });
  await button.click();
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
        return { ok: true, mode: 'text' };
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
          return { ok: true, mode: 'select', value: text };
        }
      }
      await page.keyboard.press('Escape').catch(() => undefined);
    }

    await page.waitForTimeout(250);
  }

  return { ok: false, mode: 'none' };
}

async function clickJoinAction(page, timeout = 15_000) {
  const startedAt = Date.now();
  const submitButton = page.locator('.join-card__submit').first();
  while (Date.now() - startedAt < timeout) {
    const visible = await submitButton.isVisible().catch(() => false);
    const enabled = visible && (await submitButton.isEnabled().catch(() => false));
    if (enabled) {
      await submitButton.click();
      return true;
    }
    await page.waitForTimeout(250);
  }

  const directJoinButton = page.getByRole('button', { name: JOIN_BUTTON_RE });
  if (
    (await directJoinButton.isVisible().catch(() => false)) &&
    (await directJoinButton.isEnabled().catch(() => false))
  ) {
    await directJoinButton.click();
    return true;
  }

  const fallbackButtons = page.locator('button[type="submit"], button');
  const count = await fallbackButtons.count();
  for (let index = 0; index < count; index += 1) {
    const button = fallbackButtons.nth(index);
    if (
      (await button.isVisible().catch(() => false)) &&
      (await button.isEnabled().catch(() => false))
    ) {
      await button.click();
      return true;
    }
  }

  return false;
}

async function createShortTextSession(trpc) {
  const { quizId } = await trpc.quiz.upload.mutate(QUIZ_PAYLOAD);
  return trpc.session.create.mutate({
    quizId,
    type: 'QUIZ',
  });
}

async function openHostSession(host, code, hardFailures) {
  await host.goto(`${BASE_URL}/session/${code}/host`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await waitForPathSuffix(host, `/session/${code}/host`);
  await dismissDialogIfPresent(host);

  const hostJoinUiReady = await host
    .locator('.session-host__live-participants-count')
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  if (hostJoinUiReady) {
    logStep(true, 'Host session started', code);
    return;
  }

  hardFailures.push('Host session did not open with the start-question control.');
  logStep(false, 'Host session started', code);
}

async function joinParticipantSession(participant, code, hardFailures) {
  await participant.goto(`${BASE_URL}/join/${code}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });

  const identity = await chooseJoinIdentity(participant, PARTICIPANT_NAME);
  if (!identity.ok) {
    hardFailures.push(
      'Participant join form exposed neither a nickname field nor a usable select.',
    );
    logStep(false, 'Participant identity prepared');
    return;
  }
  logStep(
    true,
    'Participant identity prepared',
    identity.mode === 'select' ? identity.value : PARTICIPANT_NAME,
  );

  const joined = await clickJoinAction(participant);
  if (!joined) {
    hardFailures.push('Participant could not trigger the join action.');
    logStep(false, 'Participant joins the session');
    return;
  }

  await waitForPathSuffix(participant, `/session/${code}/vote`);
  await waitForText(participant, /bist dabei|mach dich bereit|get ready|you are in/i, 10_000);
  await participant.waitForTimeout(1_000);
  logStep(true, 'Participant joins the session', participant.url());
}

async function startQuestion(host, participant, hardFailures) {
  await dismissDialogIfPresent(host);
  await clickButton(host, START_QUESTION_RE);

  const hostQuestionVisible = await waitForText(host, SHORT_TEXT_PROMPT, 10_000);
  if (!hostQuestionVisible) {
    hardFailures.push('Host did not switch from the lobby into the SHORT_TEXT question view.');
    logStep(false, 'Host starts the SHORT_TEXT question');
    return;
  }
  logStep(true, 'Host starts the SHORT_TEXT question');

  const answerBox = participant.getByRole('textbox').first();
  const questionVisible = await answerBox
    .waitFor({ state: 'visible', timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  if (!questionVisible) {
    hardFailures.push('Participant never received the SHORT_TEXT question.');
    logStep(false, 'Participant receives the SHORT_TEXT question');
    return;
  }

  if (await answerBox.isVisible().catch(() => false)) {
    logStep(true, 'Participant receives the SHORT_TEXT question');
    return;
  }

  hardFailures.push('Participant question view has no visible SHORT_TEXT input.');
  logStep(false, 'Participant receives the SHORT_TEXT question');
}

async function submitPartialAnswer(participant, hardFailures) {
  const answerBox = participant.getByRole('textbox').first();
  await answerBox.fill(PARTIAL_ANSWER);
  await clickButton(participant, SUBMIT_ANSWER_RE);

  const confirmation = await waitForText(participant, /antwort gesendet|answer submitted/i, 10_000);
  if (confirmation) {
    logStep(true, 'Participant submits transposed SHORT_TEXT answer', PARTIAL_ANSWER);
    return;
  }

  hardFailures.push('Participant did not receive a submit confirmation for the SHORT_TEXT answer.');
  logStep(false, 'Participant submits transposed SHORT_TEXT answer');
}

async function revealResults(host, participant, hardFailures) {
  const hostReady = await waitForText(host, /1 von 1|1 of 1|100\s*%/i, 15_000);
  if (!hostReady) {
    hardFailures.push('Host never observed the participant vote for the SHORT_TEXT question.');
    logStep(false, 'Host receives submitted SHORT_TEXT vote');
    return;
  }
  logStep(true, 'Host receives submitted SHORT_TEXT vote');

  await clickButton(host, REVEAL_RESULTS_RE);

  const participantResult = await waitForText(participant, PARTIAL_RESULT_RE, 15_000);
  if (!participantResult) {
    hardFailures.push('Participant result view never showed a partial-credit SHORT_TEXT label.');
    logStep(false, 'Participant sees partial-credit result');
    return;
  }

  const match = participantResult.match(PARTIAL_RESULT_RE);
  const points = match ? Number(match[2]) : NaN;
  const participantShowsPartial = Number.isFinite(points) && points > 0 && points < 100;
  if (!participantShowsPartial) {
    hardFailures.push('Participant result did not report partial credit between 1% and 99%.');
    logStep(false, 'Participant sees partial-credit result', String(points));
  } else if (!participantResult.includes(PARTIAL_ANSWER)) {
    hardFailures.push('Participant result no longer shows the submitted SHORT_TEXT answer.');
    logStep(false, 'Participant sees submitted answer in result');
  } else {
    logStep(true, 'Participant sees partial-credit result', `${points} %`);
    logStep(true, 'Participant sees submitted answer in result', PARTIAL_ANSWER);
  }

  const hostResults = await waitForText(host, /results|ergebnisse|100\s*%/, 15_000);
  const hostShowsMatchedBucket =
    hostResults !== null && /Peer Instruction[\s\S]*100\s*%[\s\S]*\(1\)/i.test(hostResults);
  if (hostShowsMatchedBucket) {
    logStep(true, 'Host aggregates vote under canonical SHORT_TEXT answer', MODEL_ANSWER);
    return;
  }

  hardFailures.push(
    'Host results did not aggregate the fuzzy SHORT_TEXT vote under the canonical answer bucket.',
  );
  logStep(false, 'Host aggregates vote under canonical SHORT_TEXT answer');
}

async function main() {
  console.log(`Starte Smoke gegen ${BASE_URL}...`);
  const ready = await waitForServer(PROBE_URL);
  if (!ready) {
    console.log(`WARN Preflight konnte ${PROBE_URL} nicht per fetch() bestaetigen.`);
    console.log('WARN Playwright prueft die Erreichbarkeit direkt beim Navigieren.');
  }

  const trpc = createBrowserTrpcClient();
  const { code, hostToken } = await createShortTextSession(trpc);

  const browser = await launchBrowser();
  const hardFailures = [];

  try {
    const hostContext = await browser.newContext({ viewport: DESKTOP });
    await hostContext.addInitScript(
      ({ sessionCode, token, prefix }) => {
        globalThis.sessionStorage.setItem(`${prefix}${sessionCode}`, token);
      },
      { sessionCode: code, token: hostToken, prefix: HOST_TOKEN_STORAGE_PREFIX },
    );

    const participantContext = await browser.newContext({ viewport: MOBILE });

    const host = await hostContext.newPage();
    const participant = await participantContext.newPage();

    await openHostSession(host, code, hardFailures);
    await joinParticipantSession(participant, code, hardFailures);

    if (hardFailures.length === 0) {
      await startQuestion(host, participant, hardFailures);
    }
    if (hardFailures.length === 0) {
      await submitPartialAnswer(participant, hardFailures);
    }
    if (hardFailures.length === 0) {
      await revealResults(host, participant, hardFailures);
    }

    await participantContext.close();
    await hostContext.close();
  } finally {
    await browser.close();
  }

  if (hardFailures.length > 0) {
    console.error('\nFehlgeschlagene Pruefschritte:');
    for (const failure of hardFailures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('\nSHORT_TEXT-Smoke-Test bestanden.');
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
}
