#!/usr/bin/env node
/**
 * Erzeugt PWA-Manifest-Screenshots: Startseite plus Innenansichten aus dem
 * Praxis-Showcase-Demo-Quiz (Host-Beamer, Teilnehmenden-Abstimmung, Wortwolke).
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
import { kindergartenNickname } from '../../../scripts/load/lib/kindergarten-nicknames.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'src', 'assets', 'icons');
const distBrowser = join(__dirname, '..', 'dist', 'browser');
const DEMO_QUIZ_JSON = join(__dirname, '../src/assets/demo/quiz-demo-showcase.de.json');
const DEMO_QUIZ_HISTORY_SCOPE_ID = 'de500000-0000-4000-a000-000000000001';
const HOST_TOKEN_STORAGE_PREFIX = 'arsnova-host-token:';
const PARTICIPANT_COUNT = 12;
const FREETEXT_RESPONSES = [
  'Praxis',
  'Beispiele',
  'Austausch',
  'Visualisierung',
  'Feedback',
  'Übung',
  'Klarheit',
  'Wiederholen',
];

const BASE_URL = (process.env.SCREENSHOT_URL || 'http://localhost:4200/').replace(/\/+$/, '') + '/';
const HOME_ONLY = ['1', 'true', 'yes'].includes(
  String(process.env.HOME_ONLY || '')
    .trim()
    .toLowerCase(),
);
const origin = new URL(BASE_URL).origin;
const appBase = `${origin}${new URL(BASE_URL).pathname.replace(/\/+$/, '')}`;
const TRPC_URL = (process.env.TRPC_URL || `${origin}/trpc`).replace(/\/+$/, '');

const WIDE = { width: 1280, height: 720 };
const NARROW = { width: 390, height: 844 };

const SCREENSHOT_CHROME_CSS = `
  .top-toolbar__motd-btn { display: none !important; }
  .home-motd-layer { display: none !important; }
  .app-footer, footer.app-footer { display: none !important; }
`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createTrpcClient(hostToken) {
  return createTRPCProxyClient({
    links: [
      httpLink({
        url: TRPC_URL,
        headers: hostToken ? () => ({ 'x-host-token': hostToken }) : undefined,
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
  const participants = [];
  for (let i = 0; i < count; i++) {
    const joined = await publicTrpc.session.join.mutate({
      code,
      nickname: kindergartenNickname(i, 'de'),
      anonymousClientId: globalThis.crypto.randomUUID(),
    });
    participants.push(joined);
  }
  return participants;
}

async function submitVotes(publicTrpc, participants, question) {
  const settled = await Promise.allSettled(
    participants.map((participant, index) => {
      const base = {
        sessionId: participant.id,
        participantId: participant.participantId,
        questionId: question.id,
        round: 1,
        responseTimeMs: 900 + index * 40,
        ...(question.confidenceEnabled === true ? { confidenceValue: 3 + (index % 3) } : {}),
      };
      if (question.type === 'FREETEXT') {
        return publicTrpc.vote.submit.mutate({
          ...base,
          freeText: FREETEXT_RESPONSES[index % FREETEXT_RESPONSES.length],
        });
      }
      if (!question.answers?.length) {
        throw new Error(`Frage ${question.type} hat keine Antwortoptionen.`);
      }
      const answer = question.answers[index % question.answers.length];
      return publicTrpc.vote.submit.mutate({
        ...base,
        answerIds: [answer.id],
      });
    }),
  );
  const failed = settled.filter((result) => result.status === 'rejected');
  if (failed.length > 0) {
    const message = failed[0].reason?.message ?? String(failed[0].reason);
    throw new Error(`${failed.length}/${participants.length} Stimmen fehlgeschlagen: ${message}`);
  }
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

async function hideEnvironmentChrome(page) {
  await page.addStyleTag({ content: SCREENSHOT_CHROME_CSS });
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

async function captureViewport(page, filename) {
  await applyScreenshotTheme(page);
  await hideEnvironmentChrome(page);
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

async function gotoSession(page, path, { hostToken, code } = {}) {
  if (hostToken && code) {
    await page.addInitScript(
      ({ prefix, sessionCode, token }) => {
        sessionStorage.setItem(`${prefix}${sessionCode}`, token);
      },
      { prefix: HOST_TOKEN_STORAGE_PREFIX, sessionCode: code, token: hostToken },
    );
  }
  await page.goto(`${appBase}${path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
}

async function captureLiveViews(browser, publicTrpc) {
  const payload = await loadDemoQuizUploadPayload();
  const uploadResult = await publicTrpc.quiz.upload.mutate(payload);
  const sessionResult = await publicTrpc.session.create.mutate({ quizId: uploadResult.quizId });
  const code = String(sessionResult.code).toUpperCase();
  const hostToken = sessionResult.hostToken;
  const hostTrpc = createTrpcClient(hostToken);
  console.log(`Demo-Session ${code}`);

  const participants = await joinParticipants(publicTrpc, code, PARTICIPANT_COUNT);

  const freetext = await skipUntilType(hostTrpc, publicTrpc, code, 'FREETEXT');
  const voteCloudPage = await browser.newPage();
  await voteCloudPage.setViewportSize(NARROW);
  await preparePage(voteCloudPage);
  await gotoSession(voteCloudPage, `/session/${code}/vote`);
  await voteCloudPage
    .locator('#vote-freetext-input')
    .waitFor({ state: 'visible', timeout: 20_000 });
  await voteCloudPage.waitForTimeout(500);
  await captureViewport(voteCloudPage, 'screenshot-narrow-cloud.png');
  await voteCloudPage.close();

  await submitVotes(publicTrpc, participants, freetext);
  await hostTrpc.session.revealResults.mutate({ code });

  const presentPage = await browser.newPage();
  await presentPage.setViewportSize(WIDE);
  await preparePage(presentPage);
  await gotoSession(presentPage, `/session/${code}/present`, { hostToken, code });
  await presentPage
    .locator('.word-cloud__word')
    .first()
    .waitFor({ state: 'visible', timeout: 30_000 });
  await presentPage.waitForTimeout(1200);
  await captureViewport(presentPage, 'screenshot-wide-cloud.png');
  await presentPage.close();

  const quizQuestion = await skipUntilType(hostTrpc, publicTrpc, code, 'SINGLE_CHOICE');
  const voteQuizPage = await browser.newPage();
  await voteQuizPage.setViewportSize(NARROW);
  await preparePage(voteQuizPage);
  await gotoSession(voteQuizPage, `/session/${code}/vote`);
  await voteQuizPage.locator('.vote-answers').waitFor({ state: 'visible', timeout: 20_000 });
  await voteQuizPage
    .locator('img[src*="Bettgestell"], img[src*="Dachspitze"]')
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 })
    .catch(() => {});
  await voteQuizPage.waitForTimeout(600);
  await captureViewport(voteQuizPage, 'screenshot-narrow-quiz.png');
  await voteQuizPage.close();

  await submitVotes(publicTrpc, participants, quizQuestion);
  await hostTrpc.session.revealResults.mutate({ code });

  const hostPage = await browser.newPage();
  await hostPage.setViewportSize(WIDE);
  await preparePage(hostPage);
  await gotoSession(hostPage, `/session/${code}/host`, { hostToken, code });
  await hostPage
    .locator('.session-host__results-card')
    .waitFor({ state: 'visible', timeout: 20_000 });
  await hostPage
    .locator('.session-host__question-card img, .markdown-body img')
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 })
    .catch(() => {});
  const questionCard = hostPage.locator('.session-host__question-card').first();
  if (await questionCard.count()) {
    await questionCard.scrollIntoViewIfNeeded().catch(() => {});
  }
  await hostPage.waitForTimeout(800);
  await captureViewport(hostPage, 'screenshot-wide-quiz.png');
  await hostPage.close();
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
