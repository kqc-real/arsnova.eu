#!/usr/bin/env node
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { chromium, webkit } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4200/de';
const TRPC_URL = process.env.TRPC_URL || 'http://localhost:3000/trpc';
const HOST_TOKEN_STORAGE_PREFIX = 'arsnova-host-token:';
const DESKTOP = { width: 1440, height: 1100 };
const CONTEXT_VIEWPORT = { width: 1440, height: 2400 };
const QA_PRESENTER_SELECTOR = '.session-present__word-cloud-card';
const QUIZ_PRESENTER_SELECTOR = '.session-present__word-cloud-stage';
const QA_SCREENSHOT =
  '/Users/kqc/arsnova.eu/docs/screenshots/QA-Word-Cloud-Stopwoerter.png';
const QA_PRESENTER_CONTEXT_SCREENSHOT =
  '/Users/kqc/arsnova.eu/docs/screenshots/QA-Word-Cloud-Presenter-Kontext.png';
const QA_HOST_CONTEXT_SCREENSHOT =
  '/Users/kqc/arsnova.eu/docs/screenshots/QA-Word-Cloud-Host-Kontext.png';
const QUIZ_SCREENSHOT =
  '/Users/kqc/arsnova.eu/docs/screenshots/Quiz-Freitext-Word-Cloud-Stopwoerter.png';
const QUIZ_PRESENTER_CONTEXT_SCREENSHOT =
  '/Users/kqc/arsnova.eu/docs/screenshots/Quiz-Freitext-Word-Cloud-Presenter-Kontext.png';
const QUIZ_HOST_CONTEXT_SCREENSHOT =
  '/Users/kqc/arsnova.eu/docs/screenshots/Quiz-Freitext-Word-Cloud-Host-Kontext.png';

const QA_PROMPTS = [
  {
    nickname: 'Ada',
    text: 'Wie wenden wir lineare Regression in einem echten Praxisprojekt an?',
    upvotes: ['Grace', 'Alan', 'Linus', 'Barbara'],
  },
  {
    nickname: 'Grace',
    text: 'Welche Formel brauchen wir für Varianz und Standardabweichung im Datensatz?',
    upvotes: ['Ada', 'Alan', 'Margaret'],
  },
  {
    nickname: 'Alan',
    text: 'Was ist der Unterschied zwischen Median, Mittelwert und Ausreißern?',
    upvotes: ['Ada', 'Grace', 'Donald'],
  },
  {
    nickname: 'Linus',
    text: 'Wie interpretieren wir den p-Wert bei diesem Beispiel aus der Vorlesung?',
    upvotes: ['Ada', 'Grace'],
  },
  {
    nickname: 'Margaret',
    text: 'Wann nutzen wir Kreuzvalidierung für Prognosen im Projekt?',
    upvotes: ['Ada', 'Barbara'],
  },
  {
    nickname: 'Barbara',
    text: 'Welche Visualisierung hilft bei Korrelation, Trend und Unsicherheit?',
    upvotes: ['Ada', 'Grace', 'Margaret'],
  },
];

const QA_PARTICIPANTS = [
  'Ada',
  'Grace',
  'Alan',
  'Linus',
  'Margaret',
  'Barbara',
  'Donald',
  'Edsger',
];

const QUIZ_PAYLOAD = {
  name: `Docs Freitext Word Cloud ${Date.now()}`,
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
  readingPhaseEnabled: false,
  preset: 'PLAYFUL',
  questions: [
    {
      text: 'Welche Erkenntnis nehmt ihr heute aus der Statistik-Einheit mit?',
      type: 'FREETEXT',
      timer: null,
      difficulty: 'EASY',
      order: 0,
      ratingMin: undefined,
      ratingMax: undefined,
      ratingLabelMin: undefined,
      ratingLabelMax: undefined,
      answers: [],
    },
  ],
};

const QUIZ_RESPONSES = [
  { nickname: 'Curie', freeText: 'Die Visualisierung macht Regression und Trend im Datensatz verständlich.' },
  { nickname: 'Einstein', freeText: 'Praxisbezug hilft, Korrelation, Ausreißer und Interpretation einzuordnen.' },
  { nickname: 'Planck', freeText: 'Regression, Median und Varianz bleiben für die Klausur wichtig.' },
  { nickname: 'Bohr', freeText: 'Die Formel zur Standardabweichung ist mit Beispiel deutlich klarer geworden.' },
  { nickname: 'Franklin', freeText: 'Visualisierung und Datensatz erklären Unsicherheit besser als reine Theorie.' },
  { nickname: 'Meitner', freeText: 'Praxisprojekt, Prognose und Kreuzvalidierung passen jetzt gut zusammen.' },
  { nickname: 'Sagan', freeText: 'Interpretation von p-Wert, Trend und Korrelation ist jetzt greifbar.' },
  { nickname: 'Lovelace', freeText: 'Wie wir Modelle validieren und visualisieren, bleibt besonders haengen.' },
  { nickname: 'Feynman', freeText: 'Ausreißer, Median und Visualisierung helfen beim Verstaendnis des Datensatzes.' },
  { nickname: 'Hawking', freeText: 'Welche Prognose sinnvoll ist, haengt stark von Datensatz und Validierung ab.' },
];

function createTrpcClient(hostToken) {
  return createTRPCProxyClient({
    links: [
      httpBatchLink({
        url: TRPC_URL,
        headers: hostToken ? () => ({ 'x-host-token': hostToken }) : undefined,
      }),
    ],
  });
}

async function waitForServer(url, maxAttempts = 40) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return true;
      }
    } catch {
      // keep waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch {
    return await webkit.launch({ headless: true });
  }
}

async function ensureOutput(filePath) {
  await mkdir(dirname(filePath), { recursive: true });
}

async function captureWordCloudCard(page, url, selector, targetPath, index = 0) {
  await ensureOutput(targetPath);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  const card = page.locator(selector).nth(index);
  await card.waitFor({ state: 'visible', timeout: 30_000 });
  await card.locator('.word-cloud__word').first().waitFor({ state: 'visible', timeout: 30_000 });
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await card.screenshot({ path: targetPath });
}

async function capturePresenterContext(page, url, selector, targetPath, index = 0) {
  await ensureOutput(targetPath);
  await page.setViewportSize(CONTEXT_VIEWPORT);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  const card = page.locator(selector).nth(index).locator('.word-cloud-card').first();
  await card.waitFor({ state: 'visible', timeout: 30_000 });
  await card.evaluate((node) => node.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await page.waitForTimeout(1200);
  await card.screenshot({ path: targetPath });
}

async function captureHostContext(page, url, selector, targetPath, summaryText) {
  await ensureOutput(targetPath);
  await page.setViewportSize(CONTEXT_VIEWPORT);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

  const details = page.locator(selector).filter({ hasText: summaryText }).first();
  await details.waitFor({ state: 'visible', timeout: 30_000 });

  const isOpen = await details.evaluate((node) => node.hasAttribute('open'));
  if (!isOpen) {
    await details.locator(':scope > summary').click();
  }

  const summary = details.locator(':scope > summary');
  const card = details.locator('.word-cloud-card');
  await card.waitFor({ state: 'visible', timeout: 30_000 });
  await card.evaluate((node) => node.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await page.waitForTimeout(1200);

  const summaryBox = await summary.boundingBox();
  const cardBox = await card.boundingBox();
  if (!summaryBox || !cardBox) {
    throw new Error(`Konnte Bounding Box fuer Host-Kontext nicht bestimmen: ${targetPath}`);
  }

  const padding = 16;
  const clip = {
    x: Math.max(0, Math.min(summaryBox.x, cardBox.x) - padding),
    y: Math.max(0, Math.min(summaryBox.y, cardBox.y) - padding),
    width:
      Math.max(summaryBox.x + summaryBox.width, cardBox.x + cardBox.width) -
      Math.min(summaryBox.x, cardBox.x) +
      padding * 2,
    height:
      Math.max(summaryBox.y + summaryBox.height, cardBox.y + cardBox.height) -
      Math.min(summaryBox.y, cardBox.y) +
      padding * 2,
  };

  await page.screenshot({ path: targetPath, clip });
}

async function createQaSession(publicTrpc) {
  const { code, hostToken } = await publicTrpc.session.create.mutate({
    type: 'Q_AND_A',
    title: 'Statistik Q&A',
    qaTitle: 'Fragen zu Regression, Datensatz und Interpretation',
    qaModerationMode: false,
    quickFeedbackEnabled: false,
  });

  const hostTrpc = createTrpcClient(hostToken);
  await hostTrpc.session.startQa.mutate({ code });

  const participants = new Map();
  for (const nickname of QA_PARTICIPANTS) {
    const joined = await publicTrpc.session.join.mutate({ code, nickname });
    participants.set(nickname, joined);
  }

  const questions = [];
  for (const prompt of QA_PROMPTS) {
    const join = participants.get(prompt.nickname);
    const question = await publicTrpc.qa.submit.mutate({
      sessionId: join.id,
      participantId: join.participantId,
      text: prompt.text,
    });
    questions.push({ ...prompt, id: question.id });
  }

  for (const question of questions) {
    for (const voterName of question.upvotes) {
      const join = participants.get(voterName);
      await publicTrpc.qa.upvote.mutate({
        questionId: question.id,
        participantId: join.participantId,
      });
    }
  }

  return { code, hostToken };
}

async function createQuizSession(publicTrpc) {
  const { quizId } = await publicTrpc.quiz.upload.mutate(QUIZ_PAYLOAD);
  const { code, hostToken } = await publicTrpc.session.create.mutate({
    quizId,
    type: 'QUIZ',
    qaEnabled: false,
    quickFeedbackEnabled: false,
  });

  const hostTrpc = createTrpcClient(hostToken);
  await hostTrpc.session.nextQuestion.mutate({ code });

  const question = await publicTrpc.session.getCurrentQuestionForStudent.query({ code });
  if (!question || !('id' in question)) {
    throw new Error('Aktuelle Freitextfrage konnte nicht geladen werden.');
  }

  for (const response of QUIZ_RESPONSES) {
    const join = await publicTrpc.session.join.mutate({ code, nickname: response.nickname });
    await publicTrpc.vote.submit.mutate({
      sessionId: join.id,
      participantId: join.participantId,
      questionId: question.id,
      freeText: response.freeText,
      round: 1,
    });
  }

  return { code, hostToken };
}

async function main() {
  const frontendOrigin = new URL(BASE_URL).origin;
  const ready = await waitForServer(frontendOrigin);
  if (!ready) {
    console.warn(`Warnung: Frontend-Vorabcheck fehlgeschlagen (${frontendOrigin}), versuche dennoch Screenshots.`);
  }

  const publicTrpc = createTrpcClient();
  const qaSession = await createQaSession(publicTrpc);
  const quizSession = await createQuizSession(publicTrpc);

  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ viewport: DESKTOP });
    await context.addInitScript(
      ({ qaCode, qaToken, quizCode, quizToken, prefix }) => {
        globalThis.sessionStorage.setItem(`${prefix}${qaCode}`, qaToken);
        globalThis.sessionStorage.setItem(`${prefix}${quizCode}`, quizToken);
      },
      {
        qaCode: qaSession.code,
        qaToken: qaSession.hostToken,
        quizCode: quizSession.code,
        quizToken: quizSession.hostToken,
        prefix: HOST_TOKEN_STORAGE_PREFIX,
      },
    );

    const qaPage = await context.newPage();
    await captureWordCloudCard(
      qaPage,
      `${BASE_URL}/session/${qaSession.code}/present`,
      QA_PRESENTER_SELECTOR,
      QA_SCREENSHOT,
      0,
    );
    await capturePresenterContext(
      qaPage,
      `${BASE_URL}/session/${qaSession.code}/present`,
      QA_PRESENTER_SELECTOR,
      QA_PRESENTER_CONTEXT_SCREENSHOT,
      0,
    );

    const qaHostPage = await context.newPage();
    await captureHostContext(
      qaHostPage,
      `${BASE_URL}/session/${qaSession.code}/host`,
      '.session-host__extra',
      QA_HOST_CONTEXT_SCREENSHOT,
      'Q&A-Word-Cloud',
    );

    const quizPage = await context.newPage();
    await captureWordCloudCard(
      quizPage,
      `${BASE_URL}/session/${quizSession.code}/present`,
      QUIZ_PRESENTER_SELECTOR,
      QUIZ_SCREENSHOT,
      0,
    );
    await capturePresenterContext(
      quizPage,
      `${BASE_URL}/session/${quizSession.code}/present`,
      QUIZ_PRESENTER_SELECTOR,
      QUIZ_PRESENTER_CONTEXT_SCREENSHOT,
      0,
    );

    const quizHostPage = await context.newPage();
    await captureHostContext(
      quizHostPage,
      `${BASE_URL}/session/${quizSession.code}/host`,
      '.session-host__extra',
      QUIZ_HOST_CONTEXT_SCREENSHOT,
      'Word Cloud',
    );
  } finally {
    await browser.close();
  }

  console.log(
    JSON.stringify(
      {
        qa: QA_SCREENSHOT,
        qaPresenterContext: QA_PRESENTER_CONTEXT_SCREENSHOT,
        qaHostContext: QA_HOST_CONTEXT_SCREENSHOT,
        quizFreetext: QUIZ_SCREENSHOT,
        quizPresenterContext: QUIZ_PRESENTER_CONTEXT_SCREENSHOT,
        quizHostContext: QUIZ_HOST_CONTEXT_SCREENSHOT,
      },
      null,
      2,
    ),
  );
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
