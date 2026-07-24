#!/usr/bin/env node
import { access, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { chromium, webkit } from 'playwright';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:4200';
const TRPC_URL = process.env.TRPC_URL || 'http://localhost:3000/trpc';
const HOST_TOKEN_STORAGE_PREFIX = 'arsnova-host-token:';
const LOCAL_BROWSER_CANDIDATES = [
  '/opt/homebrew/bin/chromium',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const DESKTOP_VIEWPORT = { width: 1440, height: 1100 };
const OUT_PRESENTER = '/private/tmp/word-cloud-dialog-presenter-dark-playful.png';
const OUT_HOST = '/private/tmp/word-cloud-dialog-host-dark-playful.png';

const QUIZ_PAYLOAD = {
  name: `Word Cloud Review ${Date.now()}`,
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
  { nickname: 'Lovelace', freeText: 'Wie wir Modelle validieren und visualisieren, bleibt besonders hängen.' },
  { nickname: 'Feynman', freeText: 'Ausreißer, Median und Visualisierung helfen beim Verständnis des Datensatzes.' },
  { nickname: 'Hawking', freeText: 'Welche Prognose sinnvoll ist, hängt stark von Datensatz und Validierung ab.' },
  { nickname: 'Noether', freeText: 'Regression und Visualisierung machen Datensatz und Trend konkret nachvollziehbar.' },
  { nickname: 'Turing', freeText: 'Korrelation, Validierung und Prognose brauchen immer eine saubere Interpretation.' },
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

async function launchBrowser() {
  for (const executablePath of LOCAL_BROWSER_CANDIDATES) {
    try {
      await access(executablePath);
      return await chromium.launch({ executablePath, headless: true });
    } catch {
      // try next local browser
    }
  }

  try {
    return await chromium.launch({ headless: true });
  } catch {
    return await webkit.launch({ headless: true });
  }
}

async function ensureOutput(path) {
  await mkdir(dirname(path), { recursive: true });
}

async function createQuizSession() {
  const publicTrpc = createTrpcClient();
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
    const join = await publicTrpc.session.join.mutate({
      code,
      nickname: response.nickname,
      anonymousClientId: globalThis.crypto.randomUUID(),
    });
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

async function waitForWordCloud(card) {
  await card.waitFor({ state: 'visible', timeout: 30_000 });
  await card.locator('.word-cloud__word').first().waitFor({ state: 'visible', timeout: 30_000 });
  await card.locator('.word-cloud__visual--cloud').waitFor({ state: 'visible', timeout: 30_000 });
  await card.locator('.word-cloud__word--positioned').first().waitFor({ state: 'visible', timeout: 30_000 });
}

async function captureDialog(page, targetPath) {
  await ensureOutput(targetPath);
  const dialog = page.locator('.word-cloud-dialog');
  await dialog.waitFor({ state: 'visible', timeout: 30_000 });
  await dialog.locator('.word-cloud__visual--cloud').waitFor({ state: 'visible', timeout: 30_000 });
  await dialog.locator('.word-cloud__word--positioned').first().waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: targetPath });
}

async function capturePresenter(page, code, targetPath) {
  await page.goto(`${FRONTEND_URL}/session/${code}/present`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  const stage = page.locator('.session-present__word-cloud-stage').first();
  await waitForWordCloud(stage);
  await stage.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1400);
  await stage.screenshot({ path: targetPath });
}

async function captureHost(page, code, targetPath) {
  await page.goto(`${FRONTEND_URL}/session/${code}/host`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  const details = page.locator('.session-host__extra').filter({ hasText: 'Word Cloud' }).first();
  await details.waitFor({ state: 'visible', timeout: 30_000 });

  if (!(await details.evaluate((node) => node.hasAttribute('open')))) {
    await details.locator(':scope > summary').click();
  }

  const card = details.locator('.word-cloud-card');
  await waitForWordCloud(card);
  await card.scrollIntoViewIfNeeded();
  await card.locator('.word-cloud__action--maximize').click();
  await captureDialog(page, targetPath);
}

async function main() {
  const { code, hostToken } = await createQuizSession();
  const browser = await launchBrowser();

  try {
    const desktopContext = await browser.newContext({ viewport: DESKTOP_VIEWPORT });
    await desktopContext.addInitScript(
      ({ sessionCode, sessionHostToken, prefix }) => {
        globalThis.sessionStorage.setItem(`${prefix}${sessionCode}`, sessionHostToken);
        globalThis.localStorage.setItem('home-theme', 'dark');
        globalThis.localStorage.setItem('home-preset', 'spielerisch');
        const root = globalThis.document.documentElement;
        root.classList.add('dark', 'preset-playful');
        root.classList.remove('light');
      },
      {
        sessionCode: code,
        sessionHostToken: hostToken,
        prefix: HOST_TOKEN_STORAGE_PREFIX,
      },
    );

    const presenterPage = await desktopContext.newPage();
    await capturePresenter(presenterPage, code, OUT_PRESENTER);

    const hostPage = await desktopContext.newPage();
    await captureHost(hostPage, code, OUT_HOST);
    await desktopContext.close();
  } finally {
    await browser.close();
  }

  console.log(
    JSON.stringify(
      {
        code,
        presenter: OUT_PRESENTER,
        host: OUT_HOST,
      },
      null,
      2,
    ),
  );
}

await main();
