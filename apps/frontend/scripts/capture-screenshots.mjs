#!/usr/bin/env node
/**
 * Erzeugt PWA-Manifest-Screenshots: Startseite plus Innenansichten einer
 * Betriebsversammlung mit 120 Teilnehmenden, echten Fragen an Vorstand und
 * Betriebsrat sowie vielen Stimmen — 8 Wide in 1920×1080 und 5 Narrow in
 * 440×956 (iPhone 16 Pro).
 *
 * Voraussetzung: Frontend unter SCREENSHOT_URL und tRPC unter TRPC_URL.
 * - Dev:  npm run dev:de  →  Defaults http://localhost:4200/ und http://localhost:4200/trpc
 * - Prod: npm run start:prod  →  SCREENSHOT_URL=http://localhost:3000 TRPC_URL=http://localhost:3000/trpc
 *
 * Nur Startseite (ohne Backend):  HOME_ONLY=1 npm run screenshots
 *
 * Run: npm run screenshots  (aus apps/frontend) oder  node apps/frontend/scripts/capture-screenshots.mjs
 */
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import { copyFileSync, existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { chromium, webkit } from 'playwright';
import { fileURLToPath } from 'url';
import {
  EMPLOYEE_NAMES,
  PARTICIPANT_COUNT,
  QA_QUESTIONS,
  employeeName,
  freetextResponse,
  homeOfficeChoiceIndex,
  moodVote,
} from './lib/betriebsversammlung-screenshot-corpus.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'src', 'assets', 'icons');
const distBrowser = join(__dirname, '..', 'dist', 'browser');
const DEMO_QUIZ_JSON = join(__dirname, '../src/assets/demo/quiz-demo-betriebsversammlung.de.json');
const DEMO_QUIZ_HISTORY_SCOPE_ID = 'de600000-0000-4000-a000-000000000001';
const HOST_TOKEN_STORAGE_PREFIX = 'arsnova-host-token:';
const JOIN_CONCURRENCY = 8;
const WRITE_CONCURRENCY = 12;

const BASE_URL = (process.env.SCREENSHOT_URL || 'http://localhost:4200/').replace(/\/+$/, '') + '/';
const HOME_ONLY = ['1', 'true', 'yes'].includes(
  String(process.env.HOME_ONLY || '')
    .trim()
    .toLowerCase(),
);
const origin = new URL(BASE_URL).origin;
const appBase = `${origin}${new URL(BASE_URL).pathname.replace(/\/+$/, '')}`;
const TRPC_URL = (process.env.TRPC_URL || `${origin}/trpc`).replace(/\/+$/, '');

const WIDE = { width: 1920, height: 1080 };
const NARROW = { width: 440, height: 956 };

const SCREENSHOT_CHROME_CSS = `
  .top-toolbar__motd-btn { display: none !important; }
  .home-motd-layer { display: none !important; }
  .app-footer, footer.app-footer { display: none !important; }
  .cdk-overlay-container .mat-mdc-snack-bar-container { display: none !important; }
  .vote-live-banner { display: none !important; }
  .vote-countdown-floating, .vote-timer-a11y, .vote-score-preview { display: none !important; }
`;
const SCREENSHOT_LIVE_CHROME_CSS = `
  ${SCREENSHOT_CHROME_CSS}
  .top-toolbar { display: none !important; }
`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function throwIfRejected(settled, label) {
  const failed = settled.filter((result) => result.status === 'rejected');
  if (failed.length > 0) {
    const message = failed[0].reason?.message ?? String(failed[0].reason);
    throw new Error(`${failed.length}/${settled.length} ${label} fehlgeschlagen: ${message}`);
  }
}

function createTrpcClient(hostToken, participantCapability) {
  const headers = {
    ...(hostToken ? { 'x-host-token': hostToken } : {}),
    ...(participantCapability ? { 'x-participant-capability': participantCapability } : {}),
  };
  return createTRPCProxyClient({
    links: [
      httpLink({
        url: TRPC_URL,
        headers: Object.keys(headers).length > 0 ? () => headers : undefined,
      }),
    ],
  });
}

async function waitForUrl(url, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // noch nicht bereit
    }
    await sleep(500);
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

async function loadDemoQuizUploadPayload() {
  const raw = JSON.parse(await readFile(DEMO_QUIZ_JSON, 'utf8'));
  const quiz = raw.quiz;
  return {
    historyScopeId: DEMO_QUIZ_HISTORY_SCOPE_ID,
    name: quiz.name,
    description: quiz.description,
    motifImageUrl: quiz.motifImageUrl ?? null,
    showLeaderboard: quiz.showLeaderboard,
    allowCustomNicknames: quiz.allowCustomNicknames,
    defaultTimer: null,
    timerScaleByDifficulty: false,
    enableSoundEffects: false,
    enableRewardEffects: false,
    enableMotivationMessages: false,
    enableEmojiReactions: false,
    anonymousMode: quiz.anonymousMode,
    teamMode: quiz.teamMode,
    teamCount: quiz.teamCount ?? null,
    teamAssignment: quiz.teamAssignment ?? 'AUTO',
    teamNames: quiz.teamNames ?? [],
    backgroundMusic: null,
    nicknameTheme: quiz.nicknameTheme,
    bonusTokenCount: quiz.bonusTokenCount ?? null,
    readingPhaseEnabled: false,
    preset: 'PLAYFUL',
    questions: quiz.questions.map((question) => {
      const sanitized = { ...question };
      if (sanitized.numericTolerancePercent === null) {
        delete sanitized.numericTolerancePercent;
      }
      return sanitized;
    }),
  };
}

async function openQuestion(hostTrpc, publicTrpc, code) {
  const opened = await hostTrpc.session.nextQuestion.mutate({ code });
  if (opened.status === 'QUESTION_OPEN') {
    await hostTrpc.session.revealAnswers.mutate({ code });
  }
  const question = await publicTrpc.session.getCurrentQuestionForStudent.query({ code });
  if (!question?.id) {
    throw new Error('Aktuelle Demo-Frage konnte nicht geladen werden.');
  }
  return question;
}

async function skipUntilType(hostTrpc, publicTrpc, code, type) {
  for (let i = 0; i < 16; i++) {
    const current = await publicTrpc.session.getCurrentQuestionForStudent
      .query({ code })
      .catch(() => null);
    if (current?.type === type) return current;
    if (current?.id) {
      await hostTrpc.session.revealResults.mutate({ code }).catch(() => {});
    }
    const next = await openQuestion(hostTrpc, publicTrpc, code);
    if (next.type === type) return next;
  }
  throw new Error(`Demo-Frage vom Typ ${type} wurde nicht erreicht.`);
}

async function joinParticipants(publicTrpc, code, count) {
  if (count > EMPLOYEE_NAMES.length) {
    throw new Error(`Corpus hat nur ${EMPLOYEE_NAMES.length} Namen, angefordert: ${count}.`);
  }
  return mapLimit(
    Array.from({ length: count }, (_, index) => index),
    JOIN_CONCURRENCY,
    async (index) => {
      const joined = await publicTrpc.session.join.mutate({
        code,
        nickname: employeeName(index),
        anonymousClientId: globalThis.crypto.randomUUID(),
        joinIdempotencyKey: globalThis.crypto.randomUUID(),
      });
      if (!joined.rejoinToken) {
        throw new Error(`Join ${employeeName(index)} lieferte keine Capability.`);
      }
      return {
        ...joined,
        trpc: createTrpcClient(undefined, joined.rejoinToken),
      };
    },
  );
}

async function submitVotes(participants, question) {
  const settled = await mapLimit(participants, WRITE_CONCURRENCY, async (participant, index) => {
    const base = {
      sessionId: participant.id,
      participantId: participant.participantId,
      questionId: question.id,
      round: 1,
      responseTimeMs: 4_000 + (index % 40) * 180,
      ...(question.confidenceEnabled === true ? { confidenceValue: 3 + (index % 3) } : {}),
    };
    if (question.type === 'FREETEXT') {
      return participant.trpc.vote.submit.mutate({
        ...base,
        freeText: freetextResponse(index),
      });
    }
    if (!question.answers?.length) {
      throw new Error(`Frage ${question.type} hat keine Antwortoptionen.`);
    }
    const byLabel = (part) => question.answers.find((answer) => answer.text.includes(part));
    const ranked = [
      byLabel('Drei feste'),
      byLabel('Vollständig flexibel'),
      byLabel('Zwei feste'),
      byLabel('Präsenzpflicht'),
    ].filter(Boolean);
    const choice = homeOfficeChoiceIndex(index, ranked.length || question.answers.length);
    const selected = ranked[choice] ?? question.answers[choice] ?? question.answers[0];
    return participant.trpc.vote.submit.mutate({
      ...base,
      answerIds: [selected.id],
    });
  });
  throwIfRejected(
    settled.map((value) => ({ status: 'fulfilled', value })),
    'Stimmen',
  );
}

async function submitQaForum(participants) {
  const created = await mapLimit(QA_QUESTIONS, WRITE_CONCURRENCY, async (text, index) => {
    const author = participants[index % participants.length];
    const result = await author.trpc.qa.submit.mutate({
      sessionId: author.id,
      participantId: author.participantId,
      text,
      idempotencyKey: globalThis.crypto.randomUUID(),
    });
    return { question: result.question, authorParticipantId: author.participantId };
  });
  const ballots = [];
  for (const [questionIndex, entry] of created.entries()) {
    const support = 18 + (questionIndex % 37);
    const dissent = questionIndex % 7 === 0 ? 6 : questionIndex % 5 === 0 ? 3 : 0;
    for (let offset = 1; offset <= support + dissent; offset += 1) {
      const voter = participants[(questionIndex + offset) % participants.length];
      if (voter.participantId === entry.authorParticipantId) continue;
      ballots.push({
        voter,
        questionId: entry.question.id,
        direction: offset <= support ? 'UP' : 'DOWN',
      });
    }
  }
  await mapLimit(ballots, WRITE_CONCURRENCY, async (ballot) =>
    ballot.voter.trpc.qa.vote.mutate({
      questionId: ballot.questionId,
      participantId: ballot.voter.participantId,
      direction: ballot.direction,
    }),
  );
  return created.map((entry) => entry.question);
}

async function listAllHostQaQuestions(hostTrpc, sessionId) {
  const questions = [];
  let cursor;
  do {
    const page = await hostTrpc.qa.list.query({
      sessionId,
      moderatorView: true,
      sort: 'TIME',
      pageSize: 100,
      ...(cursor ? { cursor } : {}),
    });
    questions.push(...(page.questions ?? []));
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return questions;
}

async function releaseAllQaQuestions(hostTrpc, code, sessionId) {
  const questions = await listAllHostQaQuestions(hostTrpc, sessionId);
  const pending = questions.filter((question) => question.status === 'PENDING');
  if (pending.length > 0) {
    await mapLimit(pending, WRITE_CONCURRENCY, (question) =>
      hostTrpc.qa.moderate.mutate({
        sessionCode: code,
        questionId: question.id,
        action: 'APPROVE',
      }),
    );
  }
  const visible =
    questions.filter((question) => question.status === 'ACTIVE' || question.status === 'PINNED')
      .length + pending.length;
  console.log(
    `Q&A-Freigabe: ${questions.length} im Bestand, ${pending.length} ausstehend freigegeben, ${visible} sichtbar`,
  );
  if (visible === 0) {
    throw new Error('Keine sichtbaren Q&A-Fragen nach der Freigabe.');
  }
  return visible;
}

function sanitizeCloudEntries(entries) {
  return (entries ?? [])
    .filter(
      (entry) =>
        entry?.key && entry?.label && Array.isArray(entry.members) && entry.members.length > 0,
    )
    .map((entry) => ({
      key: entry.key,
      label: entry.label,
      count: entry.count,
      basisLabel: entry.basisLabel ?? null,
      members: entry.members.slice(0, 1).map((member) => ({
        sourceId: member.sourceId,
        text: String(member.text).slice(0, 128),
        weight: member.weight,
      })),
      variants: entry.variants?.length ? entry.variants : [entry.label],
      confidence: entry.confidence ?? null,
    }));
}

function selectSmoothedUnigrams(entries) {
  return sanitizeCloudEntries(entries)
    .filter((entry) => !entry.key.includes(' ') && !/\s/u.test(entry.label))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'de'))
    .slice(0, 80);
}

async function projectQaWordCloudBestWords(hostTrpc, code, visibleQuestionCount) {
  const lemma = await hostTrpc.wordCloud.analyzeQa.mutate({
    sessionCode: code,
    mode: 'LEXICAL',
    locale: 'de',
    metric: 'BEST',
    normalization: 'LEMMA',
    filter: 'ALL_ELIGIBLE',
    maxNgramLength: 1,
    maxEntries: 80,
  });
  const smoothingActive = lemma.normalizationApplied === 'LEMMA' && lemma.fallbackUsed !== true;
  const analysisEntries = selectSmoothedUnigrams(lemma.entries);
  if (analysisEntries.length === 0) {
    throw new Error('Q&A-Wortwolke lieferte keine Wörter für den Screenshot.');
  }
  const eligible = Math.max(visibleQuestionCount, lemma.entries?.length ?? 0);
  await hostTrpc.session.setPreferredLiveChannel.mutate({ code, channel: 'qa' });
  await hostTrpc.session.setQaWordCloudProjection.mutate({
    code,
    projection: {
      mode: 'LEXICAL',
      metric: 'BEST',
      locale: 'de',
      analysisEntries,
      analyzedQuestionCount: eligible,
      eligibleQuestionCount: eligible,
      modelVersion:
        lemma.modelVersion && String(lemma.modelVersion).length > 0 ? lemma.modelVersion : null,
      smoothingActive,
    },
  });
  await hostTrpc.session.setPresenterSurface.mutate({ code, surface: 'qaWordCloud' });
  console.log(
    `Q&A-Wortwolke: ${analysisEntries.length} Wörter aus ${eligible} sichtbaren Fragen, Best, ${
      smoothingActive ? 'Glättung an' : 'ohne Sidecar-Glättung'
    }`,
  );
}

async function submitMoodVotes(participants, code) {
  const settled = await mapLimit(participants, WRITE_CONCURRENCY, async (participant, index) =>
    participant.trpc.quickFeedback.vote.mutate({
      sessionCode: code,
      voterId: participant.participantId,
      value: moodVote(index),
    }),
  );
  throwIfRejected(
    settled.map((value) => ({ status: 'fulfilled', value })),
    'Blitzlicht-Stimmen',
  );
}

async function preparePage(page) {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('arsnova-motd-suppress-overlay-once', '1');
      localStorage.setItem('home-theme', 'dark');
      localStorage.setItem('home-preset', 'spielerisch');
    } catch {
      // private mode / quota
    }
  });
}

async function applyScreenshotTheme(page) {
  await page.evaluate(() => {
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark', 'preset-playful');
  });
}

async function hideEnvironmentChrome(page, { hideAppToolbar = false } = {}) {
  await page.addStyleTag({
    content: hideAppToolbar ? SCREENSHOT_LIVE_CHROME_CSS : SCREENSHOT_CHROME_CSS,
  });
}

async function dismissMotdIfPresent(page) {
  const layer = page.locator('.home-motd-layer');
  if ((await layer.count()) === 0) return;
  const closeBtn = page.locator('.home-motd-sheet button[aria-label]').first();
  if (await closeBtn.count()) {
    await closeBtn.click({ timeout: 3_000 }).catch(() => {});
  }
  await layer.waitFor({ state: 'detached', timeout: 5_000 }).catch(() => {});
}

async function waitForHome(page) {
  await page.waitForSelector('app-home', { state: 'attached', timeout: 25_000 });
  await page.waitForSelector('.top-toolbar', { state: 'visible', timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(800);
}

async function captureViewport(page, filename, { hideAppToolbar = false } = {}) {
  await applyScreenshotTheme(page);
  await hideEnvironmentChrome(page, { hideAppToolbar });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.screenshot({
    path: join(iconsDir, filename),
    fullPage: false,
  });
  console.log(`Generated ${filename}`);
}

async function captureHome(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  const isDirListing = await page.evaluate(
    () =>
      document.title?.includes('Index of') ||
      document.body?.innerText?.includes('Index of') ||
      false,
  );
  if (isDirListing) {
    throw new Error(
      'Die URL liefert eine Verzeichnisliste statt der App. ' +
        'Nutze den Backend-Server (npm run start:prod, dann SCREENSHOT_URL=http://localhost:3000) ' +
        'oder nach Build index.csr.html nach dist/browser/index.html kopieren und serve neu starten.',
    );
  }
  await waitForHome(page);
  await page.waitForTimeout(600);
  await dismissMotdIfPresent(page);
  await captureViewport(
    page,
    page.viewportSize()?.width === WIDE.width ? 'screenshot-wide.png' : 'screenshot-narrow.png',
  );
}

async function gotoSession(page, path, { hostToken, code, participant } = {}) {
  if (hostToken && code) {
    await page.addInitScript(
      ({ prefix, sessionCode, token }) => {
        sessionStorage.setItem(`${prefix}${sessionCode}`, token);
      },
      { prefix: HOST_TOKEN_STORAGE_PREFIX, sessionCode: code, token: hostToken },
    );
  }
  if (participant?.rejoinToken && participant.participantId && code) {
    await page.addInitScript(
      ({ sessionCode, participantId, capability }) => {
        localStorage.setItem(`arsnova-participant-${sessionCode}`, participantId);
        localStorage.setItem(`arsnova-participant-capability-${sessionCode}`, capability);
      },
      {
        sessionCode: code,
        participantId: participant.participantId,
        capability: participant.rejoinToken,
      },
    );
  }
  await page.goto(`${appBase}${path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
}

async function clickChannelTab(page, index) {
  const labels = page.locator('.session-channel-tabs .session-channel-tabs__label');
  await labels.nth(index).waitFor({ state: 'visible', timeout: 15_000 });
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

async function waitForChannelTabs(page, expected = 3) {
  await page.waitForFunction(
    (minimum) =>
      document.querySelectorAll('.session-channel-tabs .session-channel-tabs__label').length >=
      minimum,
    expected,
    { timeout: 15_000 },
  );
}

async function openPreparedPage(browser, viewport) {
  const page = await browser.newPage();
  await page.setViewportSize(viewport);
  await preparePage(page);
  return page;
}

async function captureLiveViews(browser, publicTrpc) {
  const payload = await loadDemoQuizUploadPayload();
  const uploadResult = await publicTrpc.quiz.upload.mutate(payload);
  const sessionResult = await publicTrpc.session.create.mutate({
    quizId: uploadResult.quizId,
    type: 'QUIZ',
    title: 'Betriebsversammlung Herbst 2026',
    qaTitle: 'Fragen an Vorstand und Betriebsrat',
    qaEnabled: true,
    allowCustomNicknames: true,
    nicknameTheme: 'HIGH_SCHOOL',
    qaModerationMode: false,
    moderationMode: false,
    quickFeedbackEnabled: true,
  });
  const code = String(sessionResult.code).toUpperCase();
  const sessionId = sessionResult.sessionId;
  const hostToken = sessionResult.hostToken;
  const hostTrpc = createTrpcClient(hostToken);
  console.log(`Demo-Session ${code}`);

  const participants = await joinParticipants(publicTrpc, code, PARTICIPANT_COUNT);
  const camera = participants[0];
  console.log(`${participants.length} Teilnehmende in der Versammlung`);

  const hostPage = await openPreparedPage(browser, WIDE);
  await gotoSession(hostPage, `/session/${code}/host`, { hostToken, code });
  await waitForChannelTabs(hostPage, 2);

  const presentPage = await openPreparedPage(browser, WIDE);
  await gotoSession(presentPage, `/session/${code}/present`, { hostToken, code });
  await presentPage
    .locator(
      '.session-present__lobby-audience, .session-present__lobby-nick, .session-present__lobby-code',
    )
    .first()
    .waitFor({ state: 'visible', timeout: 20_000 });
  await presentPage
    .locator('.session-present__lobby-audience, .session-present__lobby-team-members')
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 })
    .catch(() => {});
  await presentPage.waitForTimeout(1600);
  await captureViewport(presentPage, 'screenshot-wide-lobby.png', { hideAppToolbar: true });

  const qaPreview = await hostTrpc.session.previewQaConfiguration.query({
    code,
    mode: 'INITIAL',
    selection: { kind: 'UNTIL_SESSION_END' },
  });
  await hostTrpc.session.configureQaChannel.mutate({
    code,
    mode: qaPreview.mode,
    selection: { kind: 'UNTIL_SESSION_END' },
    expectedLifecycleRevision: qaPreview.expectedLifecycleRevision,
    previewServerNow: qaPreview.serverNow,
    confirmedQaClosesAt: qaPreview.newQaClosesAt,
    confirmedExpiresAt: qaPreview.newExpiresAt,
    confirmSessionExtension: qaPreview.requiresSessionExtension,
    qaTitle: 'Fragen an Vorstand und Betriebsrat',
    moderationMode: false,
  });
  await hostTrpc.session.startQa.mutate({ code });
  await waitForChannelTabs(hostPage, 3);
  await submitQaForum(participants);
  const visibleQuestionCount = await releaseAllQaQuestions(hostTrpc, code, sessionId);
  await clickChannelTab(hostPage, 1);
  await presentPage
    .locator(
      '.session-present__qa-stage, .session-present__qa-card, .session-present__qa-list-card',
    )
    .first()
    .waitFor({ state: 'visible', timeout: 20_000 })
    .catch(async () => {
      await hostPage.locator('.session-qa-list, .session-qa-card').first().waitFor({
        state: 'visible',
        timeout: 10_000,
      });
    });
  const qaPresentVisible = await presentPage
    .locator(
      '.session-present__qa-stage, .session-present__qa-card, .session-present__qa-list-card',
    )
    .first()
    .isVisible()
    .catch(() => false);
  await (qaPresentVisible ? presentPage : hostPage).waitForTimeout(800);
  await captureViewport(qaPresentVisible ? presentPage : hostPage, 'screenshot-wide-qa.png', {
    hideAppToolbar: true,
  });

  await projectQaWordCloudBestWords(hostTrpc, code, visibleQuestionCount);
  await presentPage.reload({ waitUntil: 'domcontentloaded' });
  await presentPage
    .locator('.session-present__word-cloud-card .word-cloud__word, .word-cloud__word')
    .first()
    .waitFor({ state: 'visible', timeout: 30_000 });
  await presentPage
    .getByText('Beste Fragen', { exact: false })
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 })
    .catch(() => {});
  await presentPage.waitForTimeout(2000);
  await captureViewport(presentPage, 'screenshot-wide-cloud.png', { hideAppToolbar: true });
  await hostTrpc.session.setPresenterSurface.mutate({ code, surface: 'default' });

  const voteQaPage = await openPreparedPage(browser, NARROW);
  await gotoSession(voteQaPage, `/session/${code}/vote`, { code, participant: camera });
  await waitForChannelTabs(voteQaPage);
  await clickChannelTab(voteQaPage, 1);
  await voteQaPage.locator('#qa-draft').waitFor({ state: 'visible', timeout: 20_000 });
  await voteQaPage.waitForTimeout(500);
  await captureViewport(voteQaPage, 'screenshot-narrow-qa.png');
  await voteQaPage.close();

  await hostTrpc.quickFeedback.create.mutate({ type: 'MOOD', sessionCode: code });
  await submitMoodVotes(participants, code);
  await clickChannelTab(hostPage, 2);
  await presentPage
    .locator('.session-present__feedback-card')
    .waitFor({ state: 'visible', timeout: 20_000 })
    .catch(async () => {
      await hostPage
        .locator('.feedback-host__results, .feedback-host__bar-count')
        .first()
        .waitFor({ state: 'visible', timeout: 10_000 });
    });
  const feedbackPresentVisible = await presentPage
    .locator('.session-present__feedback-card')
    .isVisible()
    .catch(() => false);
  await (feedbackPresentVisible ? presentPage : hostPage).waitForTimeout(800);
  await captureViewport(
    feedbackPresentVisible ? presentPage : hostPage,
    'screenshot-wide-feedback.png',
    { hideAppToolbar: true },
  );

  const voteFeedbackPage = await openPreparedPage(browser, NARROW);
  await gotoSession(voteFeedbackPage, `/session/${code}/vote`, { code, participant: camera });
  await waitForChannelTabs(voteFeedbackPage);
  await clickChannelTab(voteFeedbackPage, 2);
  await voteFeedbackPage
    .locator('.feedback-vote__mood-btn, .feedback-vote__abcd-btn, .feedback-vote__star-btn')
    .first()
    .waitFor({ state: 'visible', timeout: 20_000 });
  await voteFeedbackPage.waitForTimeout(500);
  await captureViewport(voteFeedbackPage, 'screenshot-narrow-feedback.png');
  await voteFeedbackPage.close();

  await clickChannelTab(hostPage, 0);

  const freetext = await skipUntilType(hostTrpc, publicTrpc, code, 'FREETEXT');
  const voteCloudPage = await openPreparedPage(browser, NARROW);
  await gotoSession(voteCloudPage, `/session/${code}/vote`, { code, participant: camera });
  await waitForChannelTabs(voteCloudPage);
  await clickChannelTab(voteCloudPage, 0);
  await voteCloudPage
    .locator('#vote-freetext-input, .vote-freetext__input')
    .first()
    .waitFor({ state: 'visible', timeout: 20_000 });
  await voteCloudPage.waitForTimeout(500);
  await captureViewport(voteCloudPage, 'screenshot-narrow-cloud.png');
  await voteCloudPage.close();

  await submitVotes(participants, freetext);
  await hostTrpc.session.revealResults.mutate({ code });

  const quizQuestion = await skipUntilType(hostTrpc, publicTrpc, code, 'SINGLE_CHOICE');
  const voteQuizPage = await openPreparedPage(browser, NARROW);
  await gotoSession(voteQuizPage, `/session/${code}/vote`, { code, participant: camera });
  await waitForChannelTabs(voteQuizPage);
  await clickChannelTab(voteQuizPage, 0);
  await voteQuizPage
    .locator('.vote-answers, .vote-answer')
    .first()
    .waitFor({ state: 'visible', timeout: 30_000 });
  await voteQuizPage.getByText('Homeoffice-Modell', { exact: false }).waitFor({
    state: 'visible',
    timeout: 15_000,
  });
  await voteQuizPage.waitForTimeout(600);
  await captureViewport(voteQuizPage, 'screenshot-narrow-quiz.png');
  await voteQuizPage.close();

  await submitVotes(participants, quizQuestion);
  await hostTrpc.session.revealResults.mutate({ code });

  await hostPage.reload({ waitUntil: 'domcontentloaded' });
  await waitForChannelTabs(hostPage);
  await hostPage
    .locator('.session-host__results-card')
    .waitFor({ state: 'visible', timeout: 20_000 });
  await hostPage
    .locator('.session-host__interim-leaderboard')
    .first()
    .waitFor({ state: 'visible', timeout: 8_000 })
    .catch(() => {});
  await hostPage.waitForTimeout(800);
  await captureViewport(hostPage, 'screenshot-wide-quiz.png', { hideAppToolbar: true });
  const hostBoard = hostPage
    .locator(
      '.session-host__interim-leaderboard, .session-host__leaderboard-card, .session-host__leaderboard-winner',
    )
    .first();
  if (await hostBoard.isVisible().catch(() => false)) {
    await hostBoard.scrollIntoViewIfNeeded().catch(() => {});
    await hostPage.waitForTimeout(400);
    await captureViewport(hostPage, 'screenshot-wide-leaderboard.png', { hideAppToolbar: true });
  }

  await presentPage.reload({ waitUntil: 'domcontentloaded' });
  await presentPage
    .locator('.session-present__question, .session-projection-quiz')
    .first()
    .waitFor({ state: 'visible', timeout: 20_000 })
    .catch(() => {});
  await presentPage.waitForTimeout(800);
  await captureViewport(presentPage, 'screenshot-wide-present.png', { hideAppToolbar: true });

  await hostPage.close();
  await presentPage.close();
}

async function main() {
  const csrPath = join(distBrowser, 'index.csr.html');
  const indexPath = join(distBrowser, 'index.html');
  if (existsSync(csrPath) && !existsSync(indexPath)) {
    copyFileSync(csrPath, indexPath);
    console.log('dist/browser/index.html aus index.csr.html erzeugt (für Static-Serve).');
  }

  console.log(`Warte auf ${BASE_URL}…`);
  if (!(await waitForUrl(BASE_URL))) {
    throw new Error(
      'App nicht erreichbar. Starte z. B.: npm run dev:de oder npm run start:prod (dann SCREENSHOT_URL=http://localhost:3000).',
    );
  }

  const browser = await launchBrowser();
  try {
    const homePage = await browser.newPage();
    await homePage.setViewportSize(WIDE);
    await preparePage(homePage);
    await captureHome(homePage);

    await homePage.setViewportSize(NARROW);
    await captureHome(homePage);
    await homePage.close();

    if (HOME_ONLY) {
      console.log('HOME_ONLY=1 — Demo-Quiz-Innenansichten übersprungen.');
      return;
    }

    console.log(`Warte auf tRPC ${TRPC_URL}…`);
    if (!(await waitForUrl(`${TRPC_URL}/health.check`))) {
      throw new Error(
        `Backend unter ${TRPC_URL} ist nicht erreichbar. Innenansichten brauchen eine laufende API (npm run dev:de). Oder HOME_ONLY=1.`,
      );
    }

    const publicTrpc = createTrpcClient();
    await captureLiveViews(browser, publicTrpc);
  } finally {
    await browser.close();
  }

  console.log('Fertig.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
