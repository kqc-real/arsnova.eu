#!/usr/bin/env node
/**
 * Smoke test for the unified live session flow:
 * quiz + Q&A + quick feedback under one session code.
 *
 * Run:
 *   BASE_URL=http://localhost:4200/de TRPC_URL=http://localhost:3000/trpc npm run smoke:unified-session -w @arsnova/frontend
 */
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { chromium, webkit } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4200/de';
const TRPC_URL = process.env.TRPC_URL || 'http://localhost:3000/trpc';
const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 430, height: 932 };
const HOST_TOKEN_STORAGE_PREFIX = 'arsnova-host-token:';
const PARTICIPANT_JOIN_BUTTON = /join now|jetzt beitreten|mitmachen/i;
const SMOKE_QUESTIONS = {
  quizPrompt: 'Which unified flow is under test?',
  quizCorrectAnswer: 'Quiz, Q&A and quick feedback',
  quizDistractor: 'Only the quiz tab',
  participantFirst: 'Will chapter 4 be part of the exam?',
  participantSecond: 'Can you explain the example one more time?',
};
const QUIZ_PAYLOAD = {
  name: `Unified Flow ${Date.now()}`,
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
      text: SMOKE_QUESTIONS.quizPrompt,
      type: 'SINGLE_CHOICE',
      timer: null,
      difficulty: 'EASY',
      order: 0,
      ratingMin: undefined,
      ratingMax: undefined,
      ratingLabelMin: undefined,
      ratingLabelMax: undefined,
      answers: [
        { text: SMOKE_QUESTIONS.quizCorrectAnswer, isCorrect: true },
        { text: SMOKE_QUESTIONS.quizDistractor, isCorrect: false },
      ],
    },
  ],
};

function logStep(ok, label, detail = '') {
  const prefix = ok ? 'OK ' : 'FEHLER ';
  const suffix = detail ? ` - ${detail}` : '';
  console.log(`${prefix}${label}${suffix}`);
}

function logWarn(label, detail = '') {
  const suffix = detail ? ` - ${detail}` : '';
  console.log(`WARN ${label}${suffix}`);
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

async function waitForVisible(locator, timeout = 15_000) {
  await locator.first().waitFor({ state: 'visible', timeout });
}

async function clickViaDom(locator) {
  await waitForVisible(locator);
  await locator.first().evaluate((element) => {
    if (element instanceof HTMLElement) {
      element.click();
    }
  });
}

async function chooseJoinIdentity(page, fallbackName) {
  const textFields = page.locator('input[type="text"], input:not([type]), input[matinput], textarea');
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
  }

  return { ok: false, mode: 'none' };
}

async function clickJoinAction(page) {
  const directJoinButton = page.getByRole('button', { name: PARTICIPANT_JOIN_BUTTON });
  if (await directJoinButton.isVisible().catch(() => false)) {
    await directJoinButton.click();
    return true;
  }

  const fallbackButtons = page.locator('button[type="submit"], button');
  const count = await fallbackButtons.count();
  for (let index = 0; index < count; index += 1) {
    const button = fallbackButtons.nth(index);
    if (await button.isVisible().catch(() => false)) {
      await button.click();
      return true;
    }
  }

  return false;
}

async function clickChannelTab(page, index) {
  const labels = page.locator('.session-channel-tabs .session-channel-tabs__label');
  await waitForVisible(labels.nth(index));
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
  await page.waitForTimeout(700);
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

async function promoteQuestion(hostPage, questionText) {
  const questionCard = hostPage.locator('.session-qa-card', { hasText: questionText }).first();
  await waitForVisible(questionCard);

  const approveButton = questionCard.locator('.session-qa-card__action-btn--approve').first();
  if (await approveButton.isVisible().catch(() => false)) {
    await clickViaDom(approveButton);
    await hostPage.waitForTimeout(1_000);
  }

  const refreshedCard = hostPage.locator('.session-qa-card', { hasText: questionText }).first();
  const pinButton = refreshedCard.locator('.session-qa-card__action-btn--pin').first();
  if (await pinButton.isVisible().catch(() => false)) {
    await clickViaDom(pinButton);
    await hostPage.waitForTimeout(1_200);
    return true;
  }

  const unpinButton = refreshedCard.locator('.session-qa-card__action-btn--unpin').first();
  return unpinButton.isVisible().catch(() => false);
}

async function approveQuestion(hostPage, questionText) {
  const questionCard = hostPage.locator('.session-qa-card', { hasText: questionText }).first();
  await waitForVisible(questionCard);

  const approveButton = questionCard.locator('.session-qa-card__action-btn--approve').first();
  if (await approveButton.isVisible().catch(() => false)) {
    await clickViaDom(approveButton);
    await hostPage.waitForTimeout(1_000);
  }

  const refreshedCard = hostPage.locator('.session-qa-card', { hasText: questionText }).first();
  const pendingBadge = refreshedCard.locator('.session-qa-card__status--pending').first();
  return pendingBadge.isHidden().catch(() => true);
}

async function waitForHostFeedbackVote(hostPage, timeout = 8_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    const counts = await hostPage.locator('.feedback-host__bar-count').allTextContents().catch(() => []);
    if (counts.some((value) => /^1\s*\(/.test(value.trim()))) {
      return true;
    }
    await hostPage.waitForTimeout(250);
  }
  return false;
}

async function createUnifiedSession(trpc) {
  const { quizId } = await trpc.quiz.upload.mutate(QUIZ_PAYLOAD);
  return trpc.session.create.mutate({
    quizId,
    type: 'QUIZ',
    qaEnabled: true,
    quickFeedbackEnabled: true,
  });
}

async function openHostSession(host, code, hardFailures) {
  await host.goto(`${BASE_URL}/session/${code}/host`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await waitForPathSuffix(host, `/session/${code}/host`);
  await waitForChannelTabs(host);
  logStep(true, 'Host session started', code);

  const hostChannelCount = await host.locator('.session-channel-tabs .session-channel-tabs__label').count();
  if (hostChannelCount >= 3) {
    logStep(true, 'Host sees all channel tabs', String(hostChannelCount));
    return;
  }

  hardFailures.push('Host tabs for quiz, Q&A and quick feedback are missing.');
  logStep(false, 'Host sees all channel tabs', String(hostChannelCount));
}

async function verifyHostQaTab(host, hardFailures) {
  await clickChannelTab(host, 1);
  const hostQaArea = host.locator('.session-qa-list, .session-qa-empty, .session-qa-summary').first();
  if (await hostQaArea.isVisible().catch(() => false)) {
    logStep(true, 'Host can open Q&A tab');
    return;
  }

  hardFailures.push('Host Q&A tab does not show the moderation area.');
  logStep(false, 'Host can open Q&A tab');
}

async function joinParticipantSession(participant, code, warnings, hardFailures) {
  await participant.goto(`${BASE_URL}/join/${code}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await participant.waitForTimeout(1_500);

  const identity = await chooseJoinIdentity(participant, 'SmokeTester');
  if (identity.ok) {
    const detail = identity.mode === 'select' ? identity.value ?? 'select' : 'text';
    logStep(true, 'Join identity selected', detail);
  } else {
    warnings.push('Join form exposed neither a visible text field nor a usable identity selection.');
    logWarn('Join identity not prepared');
  }

  const joined = await clickJoinAction(participant);
  if (joined) {
    await waitForPathSuffix(participant, `/session/${code}/vote`);
    await waitForChannelTabs(participant);
    logStep(true, 'Participant joins the session', participant.url());
  } else {
    hardFailures.push('Participant could not trigger the join action.');
    logStep(false, 'Participant joins the session');
  }

  const participantChannelCount = await participant
    .locator('.session-channel-tabs .session-channel-tabs__label')
    .count();
  if (participantChannelCount >= 3) {
    logStep(true, 'Participant sees all channel tabs', String(participantChannelCount));
    return;
  }

  hardFailures.push('Participant tabs for quiz, Q&A and quick feedback are missing.');
  logStep(false, 'Participant sees all channel tabs', String(participantChannelCount));
}

async function submitParticipantQuestions(participant, hardFailures) {
  await clickChannelTab(participant, 1);
  await waitForVisible(participant.locator('#qa-draft'));
  await participant.locator('#qa-draft').fill(SMOKE_QUESTIONS.participantFirst);
  await participant.locator('.session-qa-form__submit').click();
  await participant.waitForTimeout(700);
  await participant.locator('#qa-draft').fill(SMOKE_QUESTIONS.participantSecond);
  await participant.locator('.session-qa-form__submit').click();
  await participant.waitForTimeout(1_200);

  const participantQaText = await visibleText(participant);
  if (
    participantQaText.includes(SMOKE_QUESTIONS.participantFirst) &&
    participantQaText.includes(SMOKE_QUESTIONS.participantSecond)
  ) {
    logStep(true, 'Participant sees submitted questions');
    return;
  }

  hardFailures.push('Participant does not see the submitted questions in the Q&A list.');
  logStep(false, 'Participant sees submitted questions');
}

async function verifyHostQuestions(host, hardFailures) {
  await clickChannelTab(host, 1);
  await host.waitForTimeout(1_500);
  const hostQaText = await visibleText(host);
  if (
    hostQaText.includes(SMOKE_QUESTIONS.participantFirst) &&
    hostQaText.includes(SMOKE_QUESTIONS.participantSecond)
  ) {
    logStep(true, 'Host sees submitted questions');
  } else {
    hardFailures.push('Host does not see the submitted questions in the moderation list.');
    logStep(false, 'Host sees submitted questions');
  }

  const highlighted = await promoteQuestion(host, SMOKE_QUESTIONS.participantFirst);
  if (highlighted) {
    logStep(true, 'Host highlights a question');
  } else {
    hardFailures.push('Host could not approve and highlight a question.');
    logStep(false, 'Host highlights a question');
  }

  const approvedForQueue = await approveQuestion(host, SMOKE_QUESTIONS.participantSecond);
  if (approvedForQueue) {
    logStep(true, 'Host approves queued question');
    return;
  }

  hardFailures.push('Host could not approve the queued Q&A question.');
  logStep(false, 'Host approves queued question');
}

async function verifyPresenterView(presenter, code, hardFailures) {
  await presenter.goto(`${BASE_URL}/session/${code}/present`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await waitForPathSuffix(presenter, `/session/${code}/present`);
  await presenter.waitForTimeout(2_000);

  const pinnedQuestionVisible = await presenter
    .locator('.session-present__qa-card', { hasText: SMOKE_QUESTIONS.participantFirst })
    .first()
    .isVisible()
    .catch(() => false);
  if (pinnedQuestionVisible) {
    logStep(true, 'Presenter shows highlighted question');
  } else {
    hardFailures.push('Presenter does not show the highlighted Q&A question.');
    logStep(false, 'Presenter shows highlighted question');
  }

  const queueQuestionVisible = await presenter
    .locator('.session-present__qa-list-card', { hasText: SMOKE_QUESTIONS.participantSecond })
    .first()
    .isVisible()
    .catch(() => false);
  if (queueQuestionVisible) {
    logStep(true, 'Presenter shows Q&A queue');
    return;
  }

  hardFailures.push('Presenter does not show the active Q&A queue.');
  logStep(false, 'Presenter shows Q&A queue');
}

async function runQuickFeedbackFlow(host, participant, warnings, hardFailures) {
  await clickChannelTab(host, 2);
  const hostFeedbackTemplate = host.locator('.feedback-host__template-action').first();
  if (await hostFeedbackTemplate.isVisible().catch(() => false)) {
    await clickViaDom(hostFeedbackTemplate);
    await host.waitForTimeout(1_200);
  }

  const hostFeedbackReady = await host.locator('.feedback-host__results').first().isVisible().catch(() => false);
  if (hostFeedbackReady) {
    logStep(true, 'Host starts quick feedback round');
  } else {
    hardFailures.push('Host could not start the quick feedback round.');
    logStep(false, 'Host starts quick feedback round');
  }

  await clickChannelTab(participant, 2);
  const feedbackOptions = participant.locator('.feedback-vote__mood-btn, .feedback-vote__abcd-btn');
  if ((await feedbackOptions.count()) > 0) {
    logStep(true, 'Participant sees active quick feedback round');
    await feedbackOptions.first().click();
    await participant.waitForTimeout(1_000);
  } else {
    hardFailures.push('Participant does not see the started quick feedback round.');
    logStep(false, 'Participant sees active quick feedback round');
  }

  const feedbackSubmitted = await participant
    .locator('.feedback-vote__status-icon--success')
    .first()
    .isVisible()
    .catch(() => false);
  if (feedbackSubmitted) {
    logStep(true, 'Participant can submit quick feedback');
  } else {
    hardFailures.push('Participant did not receive a quick feedback confirmation.');
    logStep(false, 'Participant can submit quick feedback');
  }

  const hostSawVote = await waitForHostFeedbackVote(host);
  if (hostSawVote) {
    logStep(true, 'Host sees quick feedback result');
    return;
  }

  warnings.push('Host result stayed at zero votes during the smoke test after one participant vote.');
  logWarn('Host does not see quick feedback result immediately');
}

async function main() {
  console.log(`Warte auf ${BASE_URL}...`);
  const ready = await waitForServer(BASE_URL);
  if (!ready) {
    console.error(`App nicht erreichbar unter ${BASE_URL}.`);
    process.exit(1);
  }

  const trpc = createBrowserTrpcClient();
  const { code, hostToken } = await createUnifiedSession(trpc);

  const browser = await launchBrowser();
  const hardFailures = [];
  const warnings = [];

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
    const participant = await participantContext.newPage();
    const presenter = await presenterContext.newPage();

    await openHostSession(host, code, hardFailures);
    await verifyHostQaTab(host, hardFailures);
    await joinParticipantSession(participant, code, warnings, hardFailures);
    await submitParticipantQuestions(participant, hardFailures);
    await verifyHostQuestions(host, hardFailures);
    await verifyPresenterView(presenter, code, hardFailures);
    await runQuickFeedbackFlow(host, participant, warnings, hardFailures);

    console.log(`\nSession-Code: ${code}`);
    if (warnings.length > 0) {
      console.log('\nWarnungen:');
      for (const warning of warnings) {
        console.log(`- ${warning}`);
      }
    }

    await presenterContext.close();
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

  console.log('\nUnified-Session-Smoke-Test bestanden.');
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(1);
}