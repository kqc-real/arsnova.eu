#!/usr/bin/env node
/**
 * Smoke test for the unified live session flow:
 * quiz + Q&A + quick feedback under one session code.
 * Host leave with open Q&A returns home without ending the forum.
 *
 * Run:
 *   BASE_URL=http://localhost:4200/de TRPC_URL=http://localhost:3000/trpc npm run smoke:unified-session -w @arsnova/frontend
 */
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { chromium, webkit } from 'playwright';
import { assertNoBlockingA11y } from './axe-a11y.mjs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4200/de';
const TRPC_URL = process.env.TRPC_URL || 'http://localhost:3000/trpc';
const DESKTOP = { width: 1440, height: 1000 };
const PRESENTER_HDMI = { width: 1280, height: 720 };
const MOBILE = { width: 430, height: 932 };
const HOST_TOKEN_STORAGE_PREFIX = 'arsnova-host-token:';
const PARTICIPANT_JOIN_BUTTON = /join now|jetzt beitreten|mitmachen/i;
const A11Y_SCAN_ENABLED = process.env.A11Y_SCAN !== '0';
const CAPTURE_SCREENSHOTS = process.env.UNIFIED_SESSION_SCREENSHOTS === '1';
const SCREENSHOT_DIR = resolve(
  process.env.UNIFIED_SESSION_SCREENSHOT_DIR ||
    resolve(import.meta.dirname, '../../../tmp/presenter-channels-hdmi'),
);
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

async function scanA11y(page, label) {
  if (A11Y_SCAN_ENABLED) {
    await assertNoBlockingA11y(page, `unified-${label}`);
  }
}

async function capturePresenterScreenshot(page, name) {
  if (!CAPTURE_SCREENSHOTS) {
    return;
  }
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  const path = resolve(SCREENSHOT_DIR, `presenter-${name}-1280x720.png`);
  await page.screenshot({ path });
  console.log(`Screenshot ${path}`);
}

function createBrowserTrpcClient(hostToken) {
  return createTRPCProxyClient({
    links: [
      httpBatchLink({
        url: TRPC_URL,
        headers: hostToken ? () => ({ 'x-host-token': hostToken }) : undefined,
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

  const directJoinButton = page.getByRole('button', { name: PARTICIPANT_JOIN_BUTTON });
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

async function tryJoinUntilVoteRoute(page, code, attempts = 5) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const joined = await clickJoinAction(page);
    if (!joined) {
      await page.waitForTimeout(500);
      continue;
    }

    try {
      await waitForPathSuffix(page, `/session/${code}/vote`, 7_000);
      return true;
    } catch {
      if (attempt < attempts) {
        await page.waitForTimeout(800);
      }
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
    (count) =>
      document.querySelectorAll('.session-channel-tabs .session-channel-tabs__label').length ===
      count,
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
    const counts = await hostPage
      .locator('.feedback-host__bar-count')
      .allTextContents()
      .catch(() => []);
    if (counts.some((value) => /^1\s*\(/.test(value.trim()))) {
      return true;
    }
    await hostPage.waitForTimeout(250);
  }
  return false;
}

async function waitForParticipantFeedbackOptions(participantPage, timeout = 10_000) {
  const options = participantPage.locator(
    '.feedback-vote__mood-btn, .feedback-vote__abcd-btn, .feedback-vote__star-btn',
  );
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    const count = await options.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const option = options.nth(index);
      if (await option.isVisible().catch(() => false)) {
        return option;
      }
    }
    await participantPage.waitForTimeout(250);
  }
  return null;
}

async function createUnifiedSession(trpc) {
  const { quizId } = await trpc.quiz.upload.mutate(QUIZ_PAYLOAD);
  const created = await trpc.session.create.mutate({
    quizId,
    type: 'QUIZ',
    qaEnabled: false,
    quickFeedbackEnabled: false,
  });
  return created;
}

async function dismissJoinOverlay(host) {
  const close = host.locator('.session-host__join-viewport-overlay__close').first();
  if (await close.isVisible().catch(() => false)) {
    await close.click();
    await close.waitFor({ state: 'hidden' });
  }
}

async function waitForNavigationFocus(host, tabIndex = null) {
  await host
    .waitForFunction((index) => {
      const active = document.activeElement;
      const target =
        index === null
          ? document.querySelector('[data-testid="add-channel-trigger"]')
          : document.querySelectorAll('.session-channel-tabs mat-button-toggle')[index];
      if (!(active instanceof HTMLElement) || !target?.contains(active)) return false;
      const rect = active.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return rect.width > 0 && rect.height > 0 && (hit === active || active.contains(hit));
    }, tabIndex)
    .catch(async (error) => {
      const state = await host.evaluate(() => {
        const active = document.activeElement;
        const trigger = document.querySelector('[data-testid="add-channel-trigger"]');
        const rect = trigger?.getBoundingClientRect();
        return {
          focusedElement: active?.outerHTML.slice(0, 500),
          triggerRect: rect?.toJSON(),
          triggerHit: rect
            ? document
                .elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
                ?.outerHTML.slice(0, 500)
            : null,
        };
      });
      throw new Error(`${error.message}\nNavigation focus: ${JSON.stringify(state)}`);
    });
}

async function verifyNavigationReflow(host, label) {
  for (const width of [320, 600, 840, DESKTOP.width]) {
    await host.setViewportSize({ width, height: DESKTOP.height });
    const fits = await host.locator('.session-host__channel-nav').evaluate((nav) => {
      const rect = nav.getBoundingClientRect();
      return (
        rect.left >= -1 &&
        rect.right <= window.innerWidth + 1 &&
        nav.scrollWidth <= nav.clientWidth + 1
      );
    });
    assert(fits, `${label}: host navigation overflows at ${width}px.`);
  }
  logStep(true, `${label}: navigation reflows at 320/600/840/1440px`);
}

async function openAddChannelMenu(host) {
  await dismissJoinOverlay(host);
  const trigger = host.getByTestId('add-channel-trigger');
  await trigger.focus();
  await trigger.press('Enter');
  await host.getByRole('menu').waitFor({ state: 'visible' });
}

async function openHostSession(host, code) {
  await host.goto(`${BASE_URL}/session/${code}/host`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await waitForPathSuffix(host, `/session/${code}/host`);
  await waitForVisible(host.getByTestId('add-channel-trigger'));
  await waitForVisible(host.getByTestId('lobby-start-session'));
  await dismissJoinOverlay(host);
  assert.equal(await host.locator('.session-channel-tabs').count(), 0);
  logStep(true, 'Host session started', code);
  logStep(true, 'One enabled quiz channel has no tab bar');
}

async function addHostChannels(host, code, hostTrpc) {
  await verifyNavigationReflow(host, 'One enabled channel');
  await openAddChannelMenu(host);
  assert.equal(await host.getByRole('menuitem').count(), 2);
  assert.equal(await host.getByTestId('add-channel-quiz').count(), 0);
  await scanA11y(host, 'add-format-menu');
  await host.getByTestId('add-channel-qa').press('Enter');
  const qaDialog = host.locator('app-qa-channel-configuration-dialog');
  await waitForVisible(qaDialog);
  await qaDialog.getByRole('button', { name: /abbrechen|cancel/i }).click();
  await qaDialog.waitFor({ state: 'hidden' });
  await waitForNavigationFocus(host);
  assert.equal(await host.locator('.session-channel-tabs').count(), 0);
  const afterCancel = await hostTrpc.session.getInfo.query({ code });
  assert.equal(afterCancel.channels.qa.enabled, false);
  assert.equal(afterCancel.preferredChannel, 'quiz');
  assert(await host.getByTestId('lobby-start-session').isVisible());
  logStep(true, 'Q&A setup cancellation preserves quiz, server state and trigger focus');

  await openAddChannelMenu(host);
  await host.getByTestId('add-channel-qa').press('Enter');
  await waitForVisible(qaDialog);
  await qaDialog.locator('input[maxlength="200"]').fill('Unified Session Smoke');
  const moderationSwitch = qaDialog.getByRole('switch').first();
  if ((await moderationSwitch.getAttribute('aria-checked')) === 'true') {
    await moderationSwitch.press('Space');
  }
  await host.waitForFunction(
    () =>
      document
        .querySelector('app-qa-channel-configuration-dialog [role="switch"]')
        ?.getAttribute('aria-checked') === 'false',
  );
  await qaDialog.locator('.qa-config__actions button').last().click();
  await qaDialog.waitFor({ state: 'hidden', timeout: 20_000 });
  await waitForChannelTabs(host, 2);
  await waitForNavigationFocus(host, 1);
  const afterQa = await hostTrpc.session.getInfo.query({ code });
  assert.equal(afterQa.channels.qa.enabled, true);
  assert.equal(afterQa.channels.quickFeedback.enabled, false);
  assert.equal(afterQa.preferredChannel, 'qa');
  logStep(true, 'Confirmed Q&A activation adds one tab and focuses it');
  await verifyNavigationReflow(host, 'Two enabled channels');

  const feedbackRoute = /\/trpc\/[^?]*session\.enableQuickFeedbackChannel/;
  await host.route(feedbackRoute, (route) => route.abort('failed'), { times: 1 });
  await openAddChannelMenu(host);
  assert.equal(await host.getByRole('menuitem').count(), 1);
  await host.getByTestId('add-channel-quickFeedback').press('Enter');
  await waitForVisible(host.locator('#host-steering-callout'));
  await waitForNavigationFocus(host);
  await waitForChannelTabs(host, 2);
  const afterFailure = await hostTrpc.session.getInfo.query({ code });
  assert.equal(afterFailure.channels.quickFeedback.enabled, false);
  assert.equal(afterFailure.preferredChannel, 'qa');
  assert.equal(
    await host
      .locator('.session-channel-tabs mat-button-toggle button')
      .nth(1)
      .getAttribute('aria-checked'),
    'true',
  );
  logStep(true, 'Failed format activation preserves Q&A and restores trigger focus');

  await host.getByTestId('host-steering-retry').click();
  await waitForChannelTabs(host, 3);
  await waitForNavigationFocus(host, 2);
  assert.equal(await host.getByTestId('add-channel-trigger').count(), 0);
  const afterRetry = await hostTrpc.session.getInfo.query({ code });
  assert.equal(afterRetry.channels.quickFeedback.enabled, true);
  assert.equal(afterRetry.preferredChannel, 'quickFeedback');
  logStep(true, 'Retry activates quick feedback under the same code and focuses its tab');
  await verifyNavigationReflow(host, 'Three enabled channels');

  await host.reload({ waitUntil: 'domcontentloaded' });
  await waitForChannelTabs(host, 3);
  await dismissJoinOverlay(host);
  assert.equal(await host.getByTestId('add-channel-trigger').count(), 0);
  await waitForVisible(host.locator('app-feedback-host'));
  logStep(true, 'Reload restores confirmed channels and preferred quick feedback');
}

async function verifyHostQaTab(host, hardFailures) {
  await clickChannelTab(host, 1);
  const hostQaArea = host.getByTestId('qa-tools-toggle');
  try {
    await waitForVisible(hostQaArea);
    logStep(true, 'Host can open Q&A tab');
  } catch {
    hardFailures.push('Host Q&A tab does not show the moderation area.');
    logStep(false, 'Host can open Q&A tab');
  }
}

async function joinParticipantSession(participant, code, warnings, hardFailures) {
  await participant.goto(`${BASE_URL}/join/${code}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  const identity = await chooseJoinIdentity(participant, 'SmokeTester');
  const identityPrepared = identity.ok;
  if (identityPrepared) {
    const detail = identity.mode === 'select' ? (identity.value ?? 'select') : 'text';
    logStep(true, 'Join identity selected', detail);
  }

  if (!identityPrepared) {
    warnings.push(
      'Join form exposed neither a visible text field nor a usable identity selection.',
    );
    logWarn('Join identity not prepared');
  }

  const joined = await tryJoinUntilVoteRoute(participant, code);
  if (joined) {
    await waitForChannelTabs(participant);
    logStep(true, 'Participant joins the session', participant.url());
  } else {
    hardFailures.push('Participant did not reach the vote route after repeated join attempts.');
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

async function submitParticipantQuestions(participant, hardFailures, hostTrpc, code) {
  await clickChannelTab(participant, 1);
  await waitForVisible(participant.locator('#qa-draft'));
  const tools = participant.locator('.session-qa-tools');
  assert.equal(await tools.getAttribute('open'), null, 'Q&A tools start collapsed');
  await participant.locator('#qa-draft').fill(SMOKE_QUESTIONS.participantFirst);
  await hostTrpc.session.setPreferredLiveChannel.mutate({ code, channel: 'quiz' });
  await participant.waitForTimeout(600);
  assert.equal(
    await participant.locator('#qa-draft').inputValue(),
    SMOKE_QUESTIONS.participantFirst,
  );
  assert.equal(
    await participant.locator('#qa-draft').evaluate((el) => document.activeElement === el),
    true,
    'Host preference preserves the editor focus',
  );
  await participant.locator('.session-qa-form__submit').click();
  await participant.locator('#qa-draft').waitFor({ state: 'hidden' });
  await participant.waitForFunction(() => {
    const target = document.querySelector('[data-testid="participant-task-status"]');
    if (!target || document.activeElement !== target) return false;
    const rect = target.getBoundingClientRect();
    return document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === target;
  });
  await clickChannelTab(participant, 1);
  await participant.locator('#qa-draft').fill(SMOKE_QUESTIONS.participantSecond);
  await participant.locator('.session-qa-form__submit').click();
  await participant.waitForTimeout(1_200);

  await hostTrpc.session.setPreferredLiveChannel.mutate({ code, channel: 'qa' });
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

async function verifyPresenterView(host, presenter, code, hardFailures) {
  await clickChannelTab(host, 1);
  await presenter.goto(`${BASE_URL}/session/${code}/present`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await waitForPathSuffix(presenter, `/session/${code}/present`);

  // Q&A-Bühne navigiert frageweise (presenterPage.index), nicht über Layout-Seiten —
  // daher kein `.projection-pages__page`-Wrapper wie beim Quiz.
  const pinnedQuestion = presenter
    .locator('.session-present__qa-card', {
      hasText: SMOKE_QUESTIONS.participantFirst,
    })
    .first();
  const pinnedQuestionVisible = await waitForVisible(pinnedQuestion, 20_000)
    .then(() => true)
    .catch(() => false);
  if (pinnedQuestionVisible) {
    logStep(true, 'Presenter shows highlighted question');
  } else {
    hardFailures.push('Presenter does not show the highlighted Q&A question.');
    logStep(false, 'Presenter shows highlighted question');
  }

  const queueQuestion = presenter
    .locator('.session-present__qa-list-card', {
      hasText: SMOKE_QUESTIONS.participantSecond,
    })
    .first();
  const queueQuestionVisible = await waitForVisible(queueQuestion, 20_000)
    .then(() => true)
    .catch(() => false);
  if (queueQuestionVisible) {
    logStep(true, 'Presenter shows Q&A queue');
  } else {
    hardFailures.push('Presenter does not show the active Q&A queue.');
    logStep(false, 'Presenter shows Q&A queue');
  }

  const qaFitsViewport = await presenter.evaluate(() => {
    const root = document.querySelector('.session-present');
    const stage = document.querySelector('.session-present__qa-stage');
    if (!(root instanceof HTMLElement) || !(stage instanceof HTMLElement)) {
      return false;
    }
    const rect = stage.getBoundingClientRect();
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      root.scrollHeight <= root.clientHeight + 1 &&
      rect.top >= -1 &&
      rect.left >= -1 &&
      rect.right <= window.innerWidth + 1 &&
      rect.bottom <= window.innerHeight + 1
    );
  });
  if (qaFitsViewport) {
    logStep(true, 'Presenter Q&A questions fit HDMI viewport');
  } else {
    hardFailures.push('Presenter Q&A stage scrolls or clips in the HDMI viewport.');
    logStep(false, 'Presenter Q&A questions fit HDMI viewport');
  }

  await dismissJoinOverlay(host);
  const qaTools = host.getByTestId('qa-tools-toggle');
  if ((await qaTools.getAttribute('aria-expanded')) !== 'true') await qaTools.click();
  const openWordCloud = host
    .locator('.session-host__extra-summary--button', { hasText: /wortwolke|word cloud/i })
    .first();
  await waitForVisible(openWordCloud);
  await clickViaDom(openWordCloud);
  const exclusiveWordCloudVisible = await presenter
    .locator('.session-present__word-cloud-card')
    .waitFor({ state: 'visible', timeout: 10_000 })
    .then(async () => {
      const questionSurfaceVisible = await presenter
        .locator('.session-present__qa-card, .session-present__qa-list-card')
        .first()
        .isVisible()
        .catch(() => false);
      return !questionSurfaceVisible;
    })
    .catch(() => false);
  if (exclusiveWordCloudVisible) {
    logStep(true, 'Presenter switches exclusively to Q&A word cloud');
    await capturePresenterScreenshot(presenter, 'qa');
  } else {
    hardFailures.push('Presenter does not switch exclusively to the Q&A word cloud.');
    logStep(false, 'Presenter switches exclusively to Q&A word cloud');
  }

  const closeWordCloud = host.locator('.qa-word-cloud-dialog__close').first();
  if (await closeWordCloud.isVisible().catch(() => false)) {
    await clickViaDom(closeWordCloud);
  }
  const wordCloudHidden = await presenter
    .locator('.session-present__word-cloud-card')
    .waitFor({ state: 'hidden', timeout: 8_000 })
    .then(() => true)
    .catch(() => false);
  if (!wordCloudHidden) {
    await host.keyboard.press('Escape');
  }
  const questionsRestored = await presenter
    .locator('.session-present__qa-card, .session-present__qa-list-card')
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  if (questionsRestored) {
    logStep(true, 'Presenter restores Q&A questions after closing word cloud');
  } else {
    hardFailures.push('Presenter does not restore Q&A questions after closing the word cloud.');
    logStep(false, 'Presenter restores Q&A questions after closing word cloud');
  }
}

async function runQuickFeedbackFlow(host, participant, warnings, hardFailures) {
  await clickChannelTab(host, 2);
  const hostFeedbackTemplate = host.locator('.feedback-host__template-action').first();
  if (await hostFeedbackTemplate.isVisible().catch(() => false)) {
    await clickViaDom(hostFeedbackTemplate);
    await host.waitForTimeout(1_200);
  }

  const hostFeedbackReady = await host
    .locator('.feedback-host__results')
    .first()
    .isVisible()
    .catch(() => false);
  if (hostFeedbackReady) {
    logStep(true, 'Host starts quick feedback round');
  } else {
    hardFailures.push('Host could not start the quick feedback round.');
    logStep(false, 'Host starts quick feedback round');
  }

  await clickChannelTab(participant, 2);
  const feedbackOption = await waitForParticipantFeedbackOptions(participant);
  if (feedbackOption) {
    logStep(true, 'Participant sees active quick feedback round');
    await feedbackOption.click();
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

  warnings.push(
    'Host result stayed at zero votes during the smoke test after one participant vote.',
  );
  logWarn('Host does not see quick feedback result immediately');
}

async function verifyPresenterQuickFeedback(presenter, hardFailures) {
  const feedbackCard = presenter.locator('.session-present__feedback-card').first();
  const feedbackVisible = await feedbackCard
    .waitFor({ state: 'visible', timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  const qaStillVisible = await presenter
    .locator(
      '.session-present__qa-card, .session-present__qa-list-card, .session-present__word-cloud-card',
    )
    .first()
    .isVisible()
    .catch(() => false);
  const feedbackFitsViewport = feedbackVisible
    ? await feedbackCard.evaluate((card) => {
        const root = document.querySelector('.session-present');
        if (!(root instanceof HTMLElement)) {
          return false;
        }
        const rect = card.getBoundingClientRect();
        return (
          root.scrollHeight <= root.clientHeight + 1 &&
          rect.top >= -1 &&
          rect.left >= -1 &&
          rect.right <= window.innerWidth + 1 &&
          rect.bottom <= window.innerHeight + 1
        );
      })
    : false;

  if (feedbackVisible && !qaStillVisible && feedbackFitsViewport) {
    logStep(true, 'Presenter switches exclusively to HDMI-sized quick feedback');
    await capturePresenterScreenshot(presenter, 'blitzlicht');
    return;
  }

  hardFailures.push(
    'Presenter does not switch exclusively to a visible HDMI-sized quick feedback stage.',
  );
  logStep(false, 'Presenter switches exclusively to HDMI-sized quick feedback');
}

async function verifyPresenterQuizChannel(host, presenter, hardFailures) {
  await clickChannelTab(host, 0);
  const startButton = host
    .getByRole('button', { name: /erste frage starten|start first question/i })
    .first();
  if (await startButton.isVisible().catch(() => false)) {
    await clickViaDom(startButton);
  }

  const quizVisible = await presenter
    .locator('.projection-pages__page')
    .getByText(SMOKE_QUESTIONS.quizPrompt, { exact: true })
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  const secondaryChannelVisible = await presenter
    .locator(
      '.session-present__qa-stage, .session-present__feedback-card, .session-present__word-cloud-card',
    )
    .first()
    .isVisible()
    .catch(() => false);

  if (quizVisible && !secondaryChannelVisible) {
    logStep(true, 'Presenter switches exclusively back to quiz');
    await capturePresenterScreenshot(presenter, 'quiz');
    return;
  }

  hardFailures.push('Presenter does not switch exclusively back to the quiz channel.');
  logStep(false, 'Presenter switches exclusively back to quiz');
}

const HOST_LEAVE_HOME_RE =
  /zur startseite|back to home|retour à l['’]accueil|volver al inicio|torna alla home/i;
const HOST_END_SESSION_RE = /session beenden|end session/i;

async function endSessionAndScan(host, participant, hardFailures) {
  const joinPopoverClose = host.locator('.session-host__join-viewport-overlay__close').first();
  if (await joinPopoverClose.isVisible().catch(() => false)) {
    await joinPopoverClose.click();
  }

  const moreActions = host.getByTestId('host-more-actions');
  const usesQuizMenu = await moreActions.isVisible().catch(() => false);
  if (usesQuizMenu) {
    await moreActions.click();
    await host.getByRole('menu').waitFor({ state: 'visible' });
  }
  const actionRole = usesQuizMenu ? 'menuitem' : 'button';
  const leaveHomeButton = host.getByRole(actionRole, { name: HOST_LEAVE_HOME_RE }).first();
  if (await leaveHomeButton.isVisible().catch(() => false)) {
    await leaveHomeButton.click();
    const homePathRe = /^\/(?:de|en|fr|it|es)\/?$/;
    const hostHome = await host
      .waitForFunction(
        (homePathSource) => new RegExp(homePathSource).test(window.location.pathname),
        homePathRe.source,
        { timeout: 20_000 },
      )
      .then(() => true)
      .catch(() => false);
    if (!hostHome) {
      hardFailures.push('Host did not return home after leaving an open Q&A session.');
      return;
    }
    const stillOnVote = /\/session\/[^/]+\/vote/.test(new URL(participant.url()).pathname);
    const endGateVisible = await participant
      .locator('#vote-session-end-anchor')
      .first()
      .isVisible()
      .catch(() => false);
    if (!stillOnVote || endGateVisible) {
      hardFailures.push(
        'Participant left or saw the session-end gate after the host returned home with Q&A still open.',
      );
      return;
    }
    await clickChannelTab(participant, 1);
    const participantStayed = await participant
      .getByText(SMOKE_QUESTIONS.participantFirst, { exact: true })
      .first()
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    if (!participantStayed) {
      hardFailures.push('Participant no longer sees Q&A questions after the host returned home.');
      return;
    }
    await scanA11y(participant, 'participant-qa-after-host-leave');
    logStep(true, 'Host returns home while the participant stays in the open Q&A forum');
    return;
  }

  const endButton = host.getByRole(actionRole, { name: HOST_END_SESSION_RE }).first();
  if (!(await endButton.isVisible().catch(() => false))) {
    hardFailures.push('Host session leave or end action is not visible.');
    return;
  }

  await endButton.click();
  const confirmation = host
    .locator('mat-dialog-container')
    .getByRole('button', { name: /gesamte session beenden|end (?:the )?session/i })
    .first();
  await confirmation.waitFor({ state: 'visible', timeout: 30_000 });
  await host.waitForTimeout(500);
  await scanA11y(host, 'end-confirmation');
  await confirmation.click();

  const homePathRe = /^\/(?:de|en|fr|it|es)\/?$/;

  await participant.waitForFunction(
    (homePathSource) => {
      const homePath = new RegExp(homePathSource);
      return (
        Boolean(document.querySelector('#vote-session-end-anchor, #finished-heading')) ||
        homePath.test(window.location.pathname)
      );
    },
    homePathRe.source,
    { timeout: 30_000 },
  );

  // Nach Session-Ende erfolgt oft ein schneller Redirect nach Home. Axe darf
  // nicht mitten in der Navigation laufen: die Blitzlicht-Chips existieren
  // dann schon als leere Shell ohne Text/aria-label (button-name).
  // Nur #vote-session-end-anchor zählt als settled Gate — #finished-heading
  // erscheint schon im transienten FINISHED-Zustand, bevor runSessionEndRedirect
  // entscheidet (Home vs. End-Gate); sonst gewinnt gateVisible zu früh.
  const homeNamed = participant
    .waitForFunction(
      (homePathSource) => {
        const homePath = new RegExp(homePathSource);
        if (!homePath.test(window.location.pathname)) return false;
        const chip = document.querySelector('#host-quick-feedback .home-feedback-chip');
        if (!(chip instanceof HTMLElement)) return false;
        const label = (chip.getAttribute('aria-label') || '').trim();
        const text = (chip.innerText || '').trim();
        return label.length > 0 || text.length > 0;
      },
      homePathRe.source,
      { timeout: 20_000 },
    )
    .then(() => 'home');
  const gateVisible = participant
    .locator('#vote-session-end-anchor')
    .first()
    .waitFor({ state: 'visible', timeout: 20_000 })
    .then(() => 'gate');
  const settled = await Promise.race([homeNamed, gateVisible]).catch(() => null);

  let returnedHome = settled === 'home' || homePathRe.test(new URL(participant.url()).pathname);
  if (returnedHome) {
    const ready = await participant
      .waitForFunction(
        () => {
          const chip = document.querySelector('#host-quick-feedback .home-feedback-chip');
          if (!(chip instanceof HTMLElement)) return false;
          const label = (chip.getAttribute('aria-label') || '').trim();
          const text = (chip.innerText || '').trim();
          return label.length > 0 || text.length > 0;
        },
        undefined,
        { timeout: 15_000 },
      )
      .then(() => true)
      .catch(() => false);
    if (!ready) {
      hardFailures.push(
        'Home after session end did not expose a named Blitzlicht chip before axe.',
      );
      return;
    }
  } else if (settled !== 'gate') {
    // Redirect kann zwischen Gate und Home liegen: noch einmal auf Home warten.
    const redirectedHome = await participant
      .waitForFunction(
        (homePathSource) => {
          const homePath = new RegExp(homePathSource);
          if (!homePath.test(window.location.pathname)) return false;
          const chip = document.querySelector('#host-quick-feedback .home-feedback-chip');
          if (!(chip instanceof HTMLElement)) return false;
          const label = (chip.getAttribute('aria-label') || '').trim();
          const text = (chip.innerText || '').trim();
          return label.length > 0 || text.length > 0;
        },
        homePathRe.source,
        { timeout: 10_000 },
      )
      .then(() => true)
      .catch(() => false);
    if (redirectedHome) {
      returnedHome = true;
    }
  }

  await scanA11y(
    participant,
    returnedHome ? 'participant-session-ended-home' : 'participant-session-ended',
  );
  logStep(
    true,
    returnedHome
      ? 'Participant returns to the localized home after session end and passes axe'
      : 'Participant session-end state passes axe',
  );
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
    // Keep the deliberate failed activation observable by Playwright's route handler.
    const hostContext = await browser.newContext({ viewport: DESKTOP, serviceWorkers: 'block' });
    await hostContext.addInitScript(
      ({ sessionCode, token, prefix }) => {
        globalThis.sessionStorage.setItem(`${prefix}${sessionCode}`, token);
      },
      { sessionCode: code, token: hostToken, prefix: HOST_TOKEN_STORAGE_PREFIX },
    );

    const presenterContext = await browser.newContext({ viewport: PRESENTER_HDMI });
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

    await openHostSession(host, code);
    await scanA11y(host, 'host-lobby');
    await addHostChannels(host, code, createBrowserTrpcClient(hostToken));
    await verifyHostQaTab(host, hardFailures);
    await scanA11y(host, 'host-qa-empty');
    await joinParticipantSession(participant, code, warnings, hardFailures);
    await scanA11y(participant, 'participant-lobby');
    await submitParticipantQuestions(
      participant,
      hardFailures,
      createBrowserTrpcClient(hostToken),
      code,
    );
    await scanA11y(participant, 'participant-qa');
    await verifyHostQuestions(host, hardFailures);
    await scanA11y(host, 'host-qa-moderation');
    await verifyPresenterView(host, presenter, code, hardFailures);
    await scanA11y(presenter, 'presenter-qa');
    await runQuickFeedbackFlow(host, participant, warnings, hardFailures);
    await verifyPresenterQuickFeedback(presenter, hardFailures);
    await scanA11y(host, 'host-feedback');
    await scanA11y(participant, 'participant-feedback');
    await verifyPresenterQuizChannel(host, presenter, hardFailures);
    await endSessionAndScan(host, participant, hardFailures);

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
