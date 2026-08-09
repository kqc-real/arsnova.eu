#!/usr/bin/env node
/**
 * Playwright E2E smoke for ORDERING / MATCHING / CATEGORIZATION
 * in host + vote views (Stories 1.2g / 1.2h / 1.2j), inklusive
 * Confidence und Host-Nachbesprechungsplan nach Session-Ende.
 *
 * Nutzt die Demo-Fragen aus `quiz-demo-showcase.de.json`
 * (6 Sortierschritte, 6 Matching-Paare, 9 Kategorisierungen).
 *
 * Run:
 *   BASE_URL=http://localhost:4200/de TRPC_URL=http://localhost:3000/trpc \
 *     npm run smoke:structured-question-types -w @arsnova/frontend
 */
import { mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { chromium, webkit } from 'playwright';
import { assertNoBlockingA11y } from './axe-a11y.mjs';

function normalizeLoopbackUrl(url) {
  return url.replace('://localhost', '://127.0.0.1');
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEMO_QUIZ_JSON = join(__dirname, '../src/assets/demo/quiz-demo-showcase.de.json');
const STRUCTURED_TYPES = new Set(['ORDERING', 'MATCHING', 'CATEGORIZATION']);

const BASE_URL = (process.env.BASE_URL || 'http://localhost:4200/de').replace(/\/+$/, '');
const PROBE_URL = normalizeLoopbackUrl(BASE_URL);
const TRPC_URL = normalizeLoopbackUrl(process.env.TRPC_URL || 'http://localhost:3000/trpc');
const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 430, height: 932 };
const HOST_TOKEN_STORAGE_PREFIX = 'arsnova-host-token:';
const JOIN_BUTTON_RE = /join now|jetzt beitreten/i;
const START_QUESTION_RE = /start first question|erste frage starten|nächste frage|next question/i;
const REVEAL_RESULTS_RE = /show results|ergebnis zeigen/i;
const DISCUSSION_PHASE_RE = /diskussionsphase|discussion phase/i;
const SECOND_ROUND_RE = /zweite abstimmung|second (vote|round)/i;
const SUBMIT_ANSWER_RE = /submit|absenden/i;
const PARTICIPANT_NAME = 'StrukturTester';
const API_PARTICIPANT_PREFIX = 'StrukturShadow';
const SHADOW_PARTICIPANT_COUNT = 4; // UI + 4 Shadows = 5 ≥ CONFIDENCE_SUMMARY_MIN_RESPONSES
const A11Y_SCAN_ENABLED = process.env.A11Y_SCAN !== '0';
const ARTIFACT_DIR =
  process.env.SMOKE_ARTIFACT_DIR || join(tmpdir(), 'arsnova-structured-question-types-e2e');
const HIGH_CONFIDENCE = 5;
const EXPECTED_DEBRIEF_PRIORITY = 3;
const END_SESSION_RE = /session beenden|end session/i;
const CONFIRM_END_SESSION_RE = /trotzdem verlassen|leave anyway|leave session/i;

/** Sichtbarer Prompt-Ausschnitt (Markdown-Syntax erscheint nicht im gerenderten Text). */
const ORDERING_PROMPT = '6 Phasen der Proteinbiosynthese';
const MATCHING_PROMPT = 'historischen Daten der Weimarer Republik';
const CATEGORIZATION_PROMPT = '9 Werke, Zitate und Motive';

async function loadStructuredDemoQuizPayload() {
  const raw = JSON.parse(await readFile(DEMO_QUIZ_JSON, 'utf8'));
  const quiz = raw.quiz;
  const structured = quiz.questions.filter((question) => STRUCTURED_TYPES.has(question.type));
  if (structured.length !== 3) {
    throw new Error(
      `Erwartet 3 Demo-Fragen (ORDERING/MATCHING/CATEGORIZATION), gefunden: ${structured.length}`,
    );
  }

  const byType = Object.fromEntries(structured.map((question) => [question.type, question]));
  for (const type of STRUCTURED_TYPES) {
    if (!byType[type]) {
      throw new Error(`Demo-Quiz fehlt Fragetyp ${type}.`);
    }
  }

  const ordering = byType.ORDERING;
  const matching = byType.MATCHING;
  const categorization = byType.CATEGORIZATION;

  if ((ordering.orderingItems || []).length !== 6) {
    throw new Error(
      `Demo ORDERING erwartet 6 Schritte, gefunden: ${(ordering.orderingItems || []).length}`,
    );
  }
  if ((matching.matchingPairs || []).length !== 6) {
    throw new Error(
      `Demo MATCHING erwartet 6 Zuordnungen, gefunden: ${(matching.matchingPairs || []).length}`,
    );
  }
  if ((categorization.categorizationItems || []).length < 6) {
    throw new Error(
      `Demo CATEGORIZATION erwartet ≥6 Zuordnungen, gefunden: ${(categorization.categorizationItems || []).length}`,
    );
  }

  const questions = [ordering, matching, categorization].map((question, index) => {
    const sanitized = { ...question, order: index };
    if (sanitized.numericTolerancePercent === null) {
      delete sanitized.numericTolerancePercent;
    }
    return sanitized;
  });

  return {
    name: `Strukturierte Fragetypen Smoke ${Date.now()}`,
    description: quiz.description,
    motifImageUrl: quiz.motifImageUrl ?? null,
    showLeaderboard: true,
    allowCustomNicknames: true,
    defaultTimer: null,
    timerScaleByDifficulty: false,
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
    readingPhaseEnabled: false,
    preset: 'PLAYFUL',
    questions,
  };
}

function logStep(ok, label, detail = '') {
  const prefix = ok ? 'OK ' : 'FEHLER ';
  const suffix = detail ? ` - ${detail}` : '';
  console.log(`${prefix}${label}${suffix}`);
}

async function scanA11y(page, label) {
  if (A11Y_SCAN_ENABLED) {
    await assertNoBlockingA11y(page, `structured-${label}`);
  }
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

  return false;
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

  hardFailures.push('Host session did not open with live participant UI.');
  logStep(false, 'Host session started', code);
}

async function joinParticipantSession(participant, code, hardFailures) {
  await participant.goto(`${BASE_URL}/join/${code}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });

  const identity = await chooseJoinIdentity(participant, PARTICIPANT_NAME);
  if (!identity.ok) {
    hardFailures.push('Participant join form exposed neither nickname field nor select.');
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
  await participant.waitForTimeout(800);
  logStep(true, 'Participant joins the session', participant.url());
}

async function startOrAdvanceQuestion(host, prompt, hardFailures, label) {
  await dismissDialogIfPresent(host);
  const startButtons = host.getByRole('button', { name: START_QUESTION_RE });
  if (
    await startButtons
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    await startButtons.first().click();
  }

  const hostQuestionVisible = await waitForText(host, prompt, 15_000);
  if (!hostQuestionVisible) {
    hardFailures.push(`Host did not show ${label} question: ${prompt}`);
    logStep(false, `Host shows ${label}`);
    return false;
  }
  logStep(true, `Host shows ${label}`);
  return true;
}

async function selectHighConfidence(participant, hardFailures, label) {
  const confidence = participant.getByRole('radio', {
    name: new RegExp(`Selbsteinschätzung ${HIGH_CONFIDENCE}|confidence ${HIGH_CONFIDENCE}`, 'i'),
  });
  const visible = await confidence
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  if (!visible) {
    hardFailures.push(`Confidence control missing for ${label}.`);
    logStep(false, `Participant confidence for ${label}`);
    return false;
  }
  await confidence.first().click();
  logStep(true, `Participant confidence for ${label}`, String(HIGH_CONFIDENCE));
  return true;
}

async function submitCurrentAnswer(participant, hardFailures, label) {
  if (!(await selectHighConfidence(participant, hardFailures, label))) return false;
  await clickButton(participant, SUBMIT_ANSWER_RE);
  const confirmation = await waitForText(
    participant,
    /antwort gesendet|answer submitted|eingereicht/i,
    12_000,
  );
  if (!confirmation) {
    hardFailures.push(`Participant submit confirmation missing for ${label}.`);
    logStep(false, `Participant submits ${label}`);
    return false;
  }
  logStep(true, `Participant submits ${label}`);
  return true;
}

function wrongMatchingSelections(pairs) {
  return pairs.map((pair, index) => ({
    leftId: pair.leftId,
    rightId: pairs[(index + 1) % pairs.length].rightId,
  }));
}

function wrongCategorizationSelections(question) {
  const fallback =
    question.categories.find((category) => category.id !== 'cat_aufklaerung') ??
    question.categories[0];
  return question.categorizationItems.map((item) => {
    const wrong =
      question.categories.find((category) => category.id !== item.correctCategoryId) ?? fallback;
    return { itemId: item.id, categoryId: wrong.id };
  });
}

async function submitWrongShadowVote(
  publicTrpc,
  shadow,
  code,
  questionMeta,
  hardFailures,
  label,
  round = 1,
) {
  const question = await publicTrpc.session.getCurrentQuestionForStudent.query({ code });
  if (!question?.id || question.type !== questionMeta.type) {
    hardFailures.push(`Shadow vote: unexpected ACTIVE question for ${label}.`);
    logStep(false, `Shadow vote for ${label}`);
    return false;
  }

  const payload = {
    sessionId: shadow.id,
    participantId: shadow.participantId,
    questionId: question.id,
    confidenceValue: HIGH_CONFIDENCE,
    round,
  };

  if (questionMeta.type === 'ORDERING') {
    payload.orderingSequence = [...questionMeta.orderingItems.map((item) => item.id)].reverse();
  } else if (questionMeta.type === 'MATCHING') {
    payload.matchingSelections = wrongMatchingSelections(questionMeta.matchingPairs);
  } else if (questionMeta.type === 'CATEGORIZATION') {
    payload.categorizationSelections = wrongCategorizationSelections(questionMeta);
  }

  await publicTrpc.vote.submit.mutate(payload);
  logStep(true, `Shadow vote for ${label}`);
  return true;
}

async function submitWrongShadowVotes(
  publicTrpc,
  shadows,
  code,
  questionMeta,
  hardFailures,
  label,
  round = 1,
) {
  for (let index = 0; index < shadows.length; index += 1) {
    const ok = await submitWrongShadowVote(
      publicTrpc,
      shadows[index],
      code,
      questionMeta,
      hardFailures,
      `${label}#${index + 1}`,
      round,
    );
    if (!ok) return false;
  }
  return true;
}

async function revealAndAssertHostResults(host, participant, hardFailures, hostMatchers, label) {
  const hostReady = await waitForText(host, /5 von 5|5 of 5|100\s*%/i, 20_000);
  if (!hostReady) {
    hardFailures.push(`Host never observed all participant votes for ${label}.`);
    logStep(false, `Host receives ${label} vote`);
    return false;
  }
  logStep(true, `Host receives ${label} vote`);

  await clickButton(host, REVEAL_RESULTS_RE);

  for (const matcher of hostMatchers) {
    const found = await waitForText(host, matcher, 12_000);
    if (!found) {
      hardFailures.push(`Host RESULTS missing expected content for ${label}: ${matcher}`);
      logStep(false, `Host RESULTS for ${label}`, String(matcher));
      return false;
    }
  }
  logStep(true, `Host RESULTS for ${label}`);

  await participant.waitForTimeout(500);
  await scanA11y(host, `host-results-${label}`);
  await scanA11y(participant, `vote-results-${label}`);
  return true;
}

async function runOrderingFlow(
  host,
  participant,
  publicTrpc,
  shadows,
  code,
  hardFailures,
  quizPayload,
) {
  const questionMeta = quizPayload.questions[0];
  if (!(await startOrAdvanceQuestion(host, ORDERING_PROMPT, hardFailures, 'ORDERING'))) {
    return;
  }

  const waiting = await waitForText(host, /Warte auf Sortierungen|waiting for/i, 8_000);
  if (!waiting) {
    hardFailures.push('Host ACTIVE ordering waiting copy missing.');
    logStep(false, 'Host ACTIVE ordering waiting copy');
  } else {
    logStep(true, 'Host ACTIVE ordering waiting copy');
  }

  const list = participant.locator('.vote-ordering__list');
  const ready = await list
    .waitFor({ state: 'visible', timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  if (!ready) {
    hardFailures.push('Participant never received ORDERING UI.');
    logStep(false, 'Participant ORDERING UI');
    return;
  }
  const itemCount = await participant.locator('.vote-ordering__item').count();
  if (itemCount !== questionMeta.orderingItems.length) {
    hardFailures.push(
      `ORDERING expected ${questionMeta.orderingItems.length} items, got ${itemCount}.`,
    );
    logStep(false, 'Participant ORDERING item count');
    return;
  }
  logStep(true, 'Participant ORDERING UI', `${itemCount} Schritte`);

  const hint = await waitForText(participant, /richtige Reihenfolge|correct order/i, 5_000);
  if (!hint) {
    hardFailures.push('ORDERING hint missing on vote view.');
    logStep(false, 'Participant ORDERING hint');
  } else {
    logStep(true, 'Participant ORDERING hint');
  }

  const downButtons = participant.locator(
    '.vote-ordering__item >> nth=0 >> button[aria-label*="unten" i], .vote-ordering__item >> nth=0 >> button[aria-label*="down" i]',
  );
  if (
    await downButtons
      .first()
      .isEnabled()
      .catch(() => false)
  ) {
    await downButtons.first().click();
    logStep(true, 'Participant moves ORDERING item');
  } else {
    const anyMove = participant.locator('.vote-ordering__move').first();
    if (!(await anyMove.isVisible().catch(() => false))) {
      hardFailures.push('ORDERING move controls missing.');
      logStep(false, 'Participant moves ORDERING item');
      return;
    }
    logStep(true, 'Participant ORDERING move controls present');
  }

  if (
    !(await submitWrongShadowVotes(
      publicTrpc,
      shadows,
      code,
      questionMeta,
      hardFailures,
      'ORDERING',
    ))
  ) {
    return;
  }

  await scanA11y(participant, 'vote-active-ordering');
  if (!(await submitCurrentAnswer(participant, hardFailures, 'ORDERING'))) return;

  const firstRoundComplete = await waitForText(host, /5 von 5|5 of 5|100\s*%/i, 20_000);
  if (!firstRoundComplete) {
    hardFailures.push('Host never observed all ORDERING votes in round 1.');
    logStep(false, 'Host receives ORDERING round 1 votes');
    return;
  }
  logStep(true, 'Host receives ORDERING round 1 votes');

  await clickButton(host, DISCUSSION_PHASE_RE);
  const discussionVisible = await waitForText(
    participant,
    /runde 2|zweite runde|zweite abstimmung|second (vote|round)/i,
    12_000,
  );
  if (!discussionVisible) {
    const participantText = (await visibleText(participant).catch(() => '')).slice(0, 600);
    await participant
      .screenshot({
        path: join(ARTIFACT_DIR, 'vote-ordering-discussion-failure.png'),
        fullPage: true,
      })
      .catch(() => undefined);
    hardFailures.push(
      `Participant never entered the ORDERING discussion phase. Visible text: ${participantText}`,
    );
    logStep(false, 'Participant ORDERING discussion phase');
    return;
  }
  logStep(true, 'Participant ORDERING discussion phase');

  await clickButton(host, SECOND_ROUND_RE);
  const roundTwoVisible = await waitForText(
    participant,
    /nur runde 2 zählt|only round 2 counts/i,
    12_000,
  );
  if (!roundTwoVisible) {
    hardFailures.push('Participant never received the ORDERING round 2 vote UI.');
    logStep(false, 'Participant ORDERING round 2');
    return;
  }
  logStep(true, 'Participant ORDERING round 2');

  const roundTwoFirstItem = participant.locator('.vote-ordering__item').first();
  const roundTwoMoveDown = roundTwoFirstItem.locator('button').nth(2);
  await roundTwoMoveDown.click();
  logStep(true, 'Participant changes ORDERING sequence in round 2');

  // Production protects each participant identity against accidental double submits.
  await participant.waitForTimeout(1100);

  if (
    !(await submitWrongShadowVotes(
      publicTrpc,
      shadows,
      code,
      questionMeta,
      hardFailures,
      'ORDERING Runde 2',
      2,
    ))
  ) {
    return;
  }
  if (!(await submitCurrentAnswer(participant, hardFailures, 'ORDERING Runde 2'))) return;

  await revealAndAssertHostResults(
    host,
    participant,
    hardFailures,
    [
      /Soll-Reihenfolge|correct sequence/i,
      /RNA-Polymerase|Entwindung/,
      /0 von 5 vollständig korrekt|0 of 5/i,
    ],
    'ORDERING',
  );

  const submittedOrderBeforeReload = await participant
    .locator('.vote-ordering--result .vote-ordering__text')
    .allTextContents();
  await participant.evaluate(() => {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith('arsnova-vote-response-')) {
        localStorage.removeItem(key);
      }
    }
  });
  await participant.reload({ waitUntil: 'domcontentloaded' });
  await dismissDialogIfPresent(participant);

  const submitted = await waitForText(
    participant,
    /Deine eingereichte Reihenfolge|submitted sequence/i,
    8_000,
  );
  if (!submitted) {
    hardFailures.push('Participant ORDERING result title missing.');
    logStep(false, 'Participant ORDERING result view');
  } else {
    logStep(true, 'Participant ORDERING result view');
  }
  const submittedOrderAfterReload = await participant
    .locator('.vote-ordering--result .vote-ordering__text')
    .allTextContents();
  if (
    submittedOrderBeforeReload.length === 0 ||
    JSON.stringify(submittedOrderAfterReload) !== JSON.stringify(submittedOrderBeforeReload)
  ) {
    hardFailures.push(
      `ORDERING result reload did not restore the persisted participant sequence: ${JSON.stringify({ submittedOrderBeforeReload, submittedOrderAfterReload })}`,
    );
    logStep(false, 'Participant ORDERING result survives reload without local draft');
  } else {
    logStep(true, 'Participant ORDERING result survives reload without local draft');
  }
}

async function selectMatOption(page, formFieldLocator, optionText) {
  await formFieldLocator.click();
  const needle = String(optionText || '').trim();
  const option = page
    .getByRole('option', {
      name: new RegExp(
        needle.slice(0, Math.min(48, needle.length)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i',
      ),
    })
    .first();
  await option.waitFor({ state: 'visible', timeout: 8_000 });
  await option.click();
  await page.waitForTimeout(200);
}

async function runMatchingFlow(
  host,
  participant,
  publicTrpc,
  shadows,
  code,
  hardFailures,
  quizPayload,
) {
  const questionMeta = quizPayload.questions[1];
  const pairs = questionMeta.matchingPairs;
  const pairCount = pairs.length;
  if (!(await startOrAdvanceQuestion(host, MATCHING_PROMPT, hardFailures, 'MATCHING'))) {
    return;
  }

  const waiting = await waitForText(host, /Warte auf Zuordnungen|waiting for/i, 8_000);
  if (!waiting) {
    hardFailures.push('Host ACTIVE matching waiting copy missing.');
    logStep(false, 'Host ACTIVE matching waiting copy');
  } else {
    logStep(true, 'Host ACTIVE matching waiting copy');
  }

  const list = participant.locator('.vote-matching__list');
  const ready = await list
    .waitFor({ state: 'visible', timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  if (!ready) {
    hardFailures.push('Participant never received MATCHING UI.');
    logStep(false, 'Participant MATCHING UI');
    return;
  }
  logStep(true, 'Participant MATCHING UI', `${pairCount} Zuordnungen`);

  const progressBefore = await waitForText(
    participant,
    new RegExp(`0 von ${pairCount} zugeordnet|0 of ${pairCount}`, 'i'),
    5_000,
  );
  if (!progressBefore) {
    hardFailures.push(`MATCHING progress label missing initially (0/${pairCount}).`);
    logStep(false, 'Participant MATCHING progress');
  } else {
    logStep(true, 'Participant MATCHING progress start');
  }

  const wrongPairs = wrongMatchingSelections(pairs);
  const rightLabels = Object.fromEntries(pairs.map((pair) => [pair.rightId, pair.right]));
  const fields = participant.locator(
    '.vote-matching__list app-item-selection-row .item-selection-row__field',
  );
  for (let index = 0; index < wrongPairs.length; index += 1) {
    await selectMatOption(participant, fields.nth(index), rightLabels[wrongPairs[index].rightId]);
  }

  const progressDone = await waitForText(
    participant,
    new RegExp(`${pairCount} von ${pairCount} zugeordnet|${pairCount} of ${pairCount}`, 'i'),
    5_000,
  );
  if (!progressDone) {
    hardFailures.push(`MATCHING progress did not reach ${pairCount}/${pairCount}.`);
    logStep(false, 'Participant MATCHING progress complete');
  } else {
    logStep(true, 'Participant MATCHING progress complete');
  }

  const doneCount = await participant
    .locator('.vote-matching__list .item-selection-row--done')
    .count();
  if (doneCount !== pairCount) {
    hardFailures.push(`Expected ${pairCount} done matching pairs, got ${doneCount}.`);
    logStep(false, 'Participant MATCHING done state');
  } else {
    logStep(true, 'Participant MATCHING done state');
  }

  if (
    !(await submitWrongShadowVotes(
      publicTrpc,
      shadows,
      code,
      questionMeta,
      hardFailures,
      'MATCHING',
    ))
  ) {
    return;
  }

  await scanA11y(participant, 'vote-active-matching');
  if (!(await submitCurrentAnswer(participant, hardFailures, 'MATCHING'))) return;

  await revealAndAssertHostResults(
    host,
    participant,
    hardFailures,
    [
      /Korrekte Paare|correct pairs/i,
      /Trefferquote|hit rate/i,
      /9\. November 1918/,
      /30\. Januar 1933/,
    ],
    'MATCHING',
  );
}

async function runCategorizationFlow(
  host,
  participant,
  publicTrpc,
  shadows,
  code,
  hardFailures,
  quizPayload,
) {
  const questionMeta = quizPayload.questions[2];
  const itemCount = questionMeta.categorizationItems.length;
  if (
    !(await startOrAdvanceQuestion(host, CATEGORIZATION_PROMPT, hardFailures, 'CATEGORIZATION'))
  ) {
    return;
  }

  const waiting = await waitForText(host, /Warte auf Kategorisierungen|waiting for/i, 8_000);
  if (!waiting) {
    hardFailures.push('Host ACTIVE categorization waiting copy missing.');
    logStep(false, 'Host ACTIVE categorization waiting copy');
  } else {
    logStep(true, 'Host ACTIVE categorization waiting copy');
  }

  const list = participant.locator('.vote-categorization__list');
  const ready = await list
    .waitFor({ state: 'visible', timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  if (!ready) {
    hardFailures.push('Participant never received CATEGORIZATION UI.');
    logStep(false, 'Participant CATEGORIZATION UI');
    return;
  }
  logStep(true, 'Participant CATEGORIZATION UI', `${itemCount} Zuordnungen`);

  const wrongSelections = wrongCategorizationSelections(questionMeta);
  const categories = Object.fromEntries(
    questionMeta.categories.map((category) => [category.id, category.name]),
  );
  const fields = participant.locator(
    '.vote-categorization__list app-item-selection-row .item-selection-row__field',
  );
  for (let index = 0; index < wrongSelections.length; index += 1) {
    await selectMatOption(
      participant,
      fields.nth(index),
      categories[wrongSelections[index].categoryId],
    );
  }

  const progressDone = await waitForText(
    participant,
    new RegExp(`${itemCount} von ${itemCount} eingeordnet|${itemCount} of ${itemCount}`, 'i'),
    5_000,
  );
  if (!progressDone) {
    hardFailures.push(`CATEGORIZATION progress did not reach ${itemCount}/${itemCount}.`);
    logStep(false, 'Participant CATEGORIZATION progress complete');
  } else {
    logStep(true, 'Participant CATEGORIZATION progress complete');
  }

  if (
    !(await submitWrongShadowVotes(
      publicTrpc,
      shadows,
      code,
      questionMeta,
      hardFailures,
      'CATEGORIZATION',
    ))
  ) {
    return;
  }

  await scanA11y(participant, 'vote-active-categorization');
  if (!(await submitCurrentAnswer(participant, hardFailures, 'CATEGORIZATION'))) return;

  await revealAndAssertHostResults(
    host,
    participant,
    hardFailures,
    [/Soll-Kategorien|categories/i, /Aufklärung/, /Nathan der Weise/, /Sandmann/],
    'CATEGORIZATION',
  );

  const submitted = await waitForText(
    participant,
    /Deine Kategorisierungen|your categorizations/i,
    8_000,
  );
  if (!submitted) {
    hardFailures.push('Participant CATEGORIZATION result title missing.');
    logStep(false, 'Participant CATEGORIZATION result view');
  } else {
    logStep(true, 'Participant CATEGORIZATION result view');
  }
}

async function finishSessionAndAssertDebriefPlan(host, hostTrpc, code, hardFailures) {
  await dismissDialogIfPresent(host);
  await clickButton(host, END_SESSION_RE);
  const confirm = host.getByRole('button', { name: CONFIRM_END_SESSION_RE }).first();
  await confirm.waitFor({ state: 'visible', timeout: 10_000 });
  await confirm.click();

  const finishedUi = await waitForText(
    host,
    /Lernstand und Selbsteinschätzung[\s\S]*Session beendet/i,
    25_000,
  );
  if (!finishedUi) {
    // Fallback: force FINISHED via API and reload host view.
    await hostTrpc.session.end.mutate({ code }).catch(() => undefined);
    await host.reload({ waitUntil: 'domcontentloaded' });
    const retry = await waitForText(
      host,
      /Lernstand und Selbsteinschätzung[\s\S]*Session beendet/i,
      20_000,
    );
    if (!retry) {
      hardFailures.push('Host FINISHED view with confidence summary missing.');
      logStep(false, 'Host Nachbesprechungsplan UI');
      return;
    }
  }
  logStep(true, 'Host FINISHED confidence summary');

  const recommended = await waitForText(
    host,
    new RegExp(`Nachbesprechung empfohlen:\\s*${EXPECTED_DEBRIEF_PRIORITY}`, 'i'),
    12_000,
  );
  const priorityHeading = await waitForText(host, /Priorität für die Nachbesprechung/i, 8_000);
  if (!recommended || !priorityHeading) {
    hardFailures.push(
      `Host did not recommend ${EXPECTED_DEBRIEF_PRIORITY} questions for Nachbesprechung.`,
    );
    logStep(false, 'Host Nachbesprechungs-Priorität');
  } else {
    logStep(true, 'Host Nachbesprechungs-Priorität', String(EXPECTED_DEBRIEF_PRIORITY));
  }

  const planButton = host.locator('button.session-host__export-pdf-btn').first();
  const planVisible = await planButton
    .waitFor({ state: 'visible', timeout: 8_000 })
    .then(() => true)
    .catch(() => false);
  if (!planVisible) {
    hardFailures.push('Host export button "Nachbesprechungsplan ansehen" missing.');
    logStep(false, 'Host Nachbesprechungsplan-Button');
  } else {
    const label = ((await planButton.innerText().catch(() => '')) || '').replace(/\s+/g, ' ');
    const aria = (await planButton.getAttribute('aria-label')) || '';
    if (!/Nachbesprechungsplan ansehen|debriefing plan/i.test(`${label} ${aria}`)) {
      hardFailures.push(`Nachbesprechungsplan button label unexpected: "${label}" / "${aria}"`);
      logStep(false, 'Host Nachbesprechungsplan-Button');
    } else if (!`${label} ${aria}`.includes(String(EXPECTED_DEBRIEF_PRIORITY))) {
      hardFailures.push(
        `Nachbesprechungsplan button missing priority count: "${label}" / "${aria}"`,
      );
      logStep(false, 'Host Nachbesprechungsplan-Button');
    } else {
      logStep(true, 'Host Nachbesprechungsplan-Button', aria || label);
    }
  }

  const exportData = await hostTrpc.session.getExportData.query({ code });
  const summary = exportData.confidenceSummary;
  if (!summary) {
    hardFailures.push('Export confidenceSummary missing after FINISHED.');
    logStep(false, 'Export Nachbesprechungsplan-Daten');
    return;
  }
  if (summary.priorityQuestionCount !== EXPECTED_DEBRIEF_PRIORITY) {
    hardFailures.push(
      `confidenceSummary.priorityQuestionCount=${summary.priorityQuestionCount}, erwartet ${EXPECTED_DEBRIEF_PRIORITY}.`,
    );
    logStep(false, 'Export Nachbesprechungsplan-Daten');
    return;
  }
  if (summary.includedQuestionCount !== 3) {
    hardFailures.push(
      `confidenceSummary.includedQuestionCount=${summary.includedQuestionCount}, erwartet 3.`,
    );
    logStep(false, 'Export Nachbesprechungsplan-Daten');
    return;
  }
  logStep(true, 'Export Nachbesprechungsplan-Daten', `${summary.priorityQuestionCount}/3`);

  await host.screenshot({
    path: join(ARTIFACT_DIR, 'host-nachbesprechungsplan.png'),
    fullPage: true,
  });
  await scanA11y(host, 'host-finished-debrief');
}

async function main() {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  console.log(`Starte Structured-Question-Types-Smoke gegen ${BASE_URL}...`);
  console.log(`Artefakte: ${ARTIFACT_DIR}`);

  const ready = await waitForServer(PROBE_URL);
  if (!ready) {
    console.log(`WARN Preflight konnte ${PROBE_URL} nicht per fetch() bestaetigen.`);
  }

  const publicTrpc = createPublicTrpc();
  const quizPayload = await loadStructuredDemoQuizPayload();
  logStep(
    true,
    'Demo-Fragen geladen',
    `ORDERING ${quizPayload.questions[0].orderingItems.length} · MATCHING ${quizPayload.questions[1].matchingPairs.length} · CATEGORIZATION ${quizPayload.questions[2].categorizationItems.length}`,
  );
  const { quizId } = await publicTrpc.quiz.upload.mutate(quizPayload);
  const { code, hostToken } = await publicTrpc.session.create.mutate({
    quizId,
    type: 'QUIZ',
  });
  const hostTrpc = createHostTrpc(hostToken);
  const shadows = [];
  for (let index = 0; index < SHADOW_PARTICIPANT_COUNT; index += 1) {
    shadows.push(
      await publicTrpc.session.join.mutate({
        code,
        nickname: `${API_PARTICIPANT_PREFIX}${index + 1}`,
        anonymousClientId: globalThis.crypto.randomUUID(),
      }),
    );
  }

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
      await runOrderingFlow(
        host,
        participant,
        publicTrpc,
        shadows,
        code,
        hardFailures,
        quizPayload,
      );
      await host.screenshot({
        path: join(ARTIFACT_DIR, 'host-ordering-results.png'),
        fullPage: true,
      });
      await participant.screenshot({
        path: join(ARTIFACT_DIR, 'vote-ordering-results.png'),
        fullPage: true,
      });
    }

    if (hardFailures.length === 0) {
      await runMatchingFlow(
        host,
        participant,
        publicTrpc,
        shadows,
        code,
        hardFailures,
        quizPayload,
      );
      await host.screenshot({
        path: join(ARTIFACT_DIR, 'host-matching-results.png'),
        fullPage: true,
      });
      await participant.screenshot({
        path: join(ARTIFACT_DIR, 'vote-matching-results.png'),
        fullPage: true,
      });
    }

    if (hardFailures.length === 0) {
      await runCategorizationFlow(
        host,
        participant,
        publicTrpc,
        shadows,
        code,
        hardFailures,
        quizPayload,
      );
      await host.screenshot({
        path: join(ARTIFACT_DIR, 'host-categorization-results.png'),
        fullPage: true,
      });
      await participant.screenshot({
        path: join(ARTIFACT_DIR, 'vote-categorization-results.png'),
        fullPage: true,
      });
    }

    if (hardFailures.length === 0) {
      await finishSessionAndAssertDebriefPlan(host, hostTrpc, code, hardFailures);
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

  console.log('\nStructured-Question-Types-Smoke bestanden (inkl. Nachbesprechungsplan).');
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
}
