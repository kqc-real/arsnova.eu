#!/usr/bin/env node
/**
 * Presenter-Screenshots für alle Fragen des Praxis-Showcase-Demo-Quiz
 * in Lobby, Lesephase, Abstimmung, Diskussion (2. Runde) und Ergebnissen.
 *
 * Voraussetzung: Frontend http://localhost:4200 und Backend http://127.0.0.1:3000.
 *
 *   node apps/frontend/scripts/capture-presenter-demo-quiz-screenshots.mjs
 */
import { access, mkdir, readFile, readdir } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../../..');
const DEMO_JSON = join(__dirname, '../src/assets/demo/quiz-demo-showcase.de.json');
const DEMO_ASSETS_DIR = join(__dirname, '../src/assets/demo');
const OUT_DIR = join(REPO_ROOT, 'artifacts/presenter-demo-quiz');
const BASE_URL = (process.env.SCREENSHOT_URL || 'http://localhost:4200').replace(/\/+$/, '');
const TRPC_URL = (process.env.TRPC_URL || 'http://127.0.0.1:3000/trpc').replace(/\/+$/, '');
const PARTICIPANT_COUNT = Math.max(4, Number(process.env.PARTICIPANTS || 8));
const VIEWPORT = { width: 1920, height: 1080 };
const HOST_TOKEN_STORAGE_PREFIX = 'arsnova-host-token:';
const HISTORY_SCOPE_ID = 'de500000-0000-4000-a000-000000000001';
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createClient(hostToken) {
  return createTRPCProxyClient({
    links: [
      httpLink({
        url: TRPC_URL,
        headers: hostToken ? () => ({ 'x-host-token': hostToken }) : undefined,
      }),
    ],
  });
}

async function waitForUrl(url, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.status < 500) return true;
    } catch {
      // retry
    }
    await sleep(500);
  }
  return false;
}

/** Dev-Server ohne History-Fallback: SPA-Routen als index.html ausliefern. */
async function enableSpaDocumentFallback(context) {
  const origin = new URL(BASE_URL).origin;
  await context.route('**/*', async (route) => {
    const request = route.request();
    if (request.resourceType() !== 'document') {
      await route.continue();
      return;
    }
    const url = new URL(request.url());
    if (url.origin !== origin) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    if (response.status() !== 404) {
      await route.fulfill({ response });
      return;
    }
    const index = await context.request.get(`${BASE_URL}/`);
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: await index.text(),
    });
  });
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function extractMarkdownImages(text) {
  return [...String(text || '').matchAll(/!\[[^\]]*]\(([^)]+)\)/g)].map((match) => match[1].trim());
}

async function inventoryDemoImages(quiz) {
  const urls = new Set();
  if (quiz.motifImageUrl) urls.add(quiz.motifImageUrl);
  for (const src of extractMarkdownImages(quiz.description)) urls.add(src);
  for (const question of quiz.questions) {
    for (const src of extractMarkdownImages(question.text)) urls.add(src);
  }
  const report = [];
  for (const src of [...urls].filter(Boolean)) {
    if (src.startsWith('/assets/demo/')) {
      const fileName = decodeURIComponent(src.replace('/assets/demo/', ''));
      const filePath = join(DEMO_ASSETS_DIR, fileName);
      try {
        await access(filePath, fsConstants.R_OK);
        report.push({ src, ok: true, kind: 'local', fileName });
      } catch {
        report.push({ src, ok: false, kind: 'local', fileName, error: 'Datei fehlt' });
      }
      continue;
    }
    try {
      const res = await fetch(src, { method: 'HEAD' });
      report.push({ src, ok: res.ok, kind: 'remote', status: res.status });
    } catch (error) {
      report.push({ src, ok: false, kind: 'remote', error: error.message });
    }
  }
  return report;
}

async function loadUploadPayload() {
  const raw = JSON.parse(await readFile(DEMO_JSON, 'utf8'));
  const quiz = raw.quiz;
  return {
    quiz,
    payload: {
      historyScopeId: HISTORY_SCOPE_ID,
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
      readingPhaseEnabled: true,
      preset: 'PLAYFUL',
      questions: quiz.questions.map((question) => {
        const sanitized = { ...question };
        if (sanitized.numericTolerancePercent === null) {
          delete sanitized.numericTolerancePercent;
        }
        return sanitized;
      }),
    },
  };
}

function buildVote(participant, question, metadata, round, index) {
  const base = {
    sessionId: participant.id,
    participantId: participant.participantId,
    questionId: question.id,
    round,
    responseTimeMs: 800 + index * 50,
    ...(question.confidenceEnabled ? { confidenceValue: 2 + (index % 4) } : {}),
  };
  switch (question.type) {
    case 'SURVEY':
    case 'SINGLE_CHOICE':
      return {
        ...base,
        answerIds: [question.answers[index % question.answers.length].id],
      };
    case 'MULTIPLE_CHOICE':
      return {
        ...base,
        answerIds: question.answers.slice(0, Math.min(2, question.answers.length)).map((a) => a.id),
      };
    case 'FREETEXT':
      return { ...base, freeText: FREETEXT_RESPONSES[index % FREETEXT_RESPONSES.length] };
    case 'SHORT_TEXT':
      return {
        ...base,
        freeText: index % 3 === 0 ? 'Peer Instruction' : 'Think Pair Share',
      };
    case 'RATING':
      return { ...base, ratingValue: 3 + (index % 3) };
    case 'NUMERIC_ESTIMATE':
      return {
        ...base,
        numericValue: metadata.numericTwoRounds
          ? round === 1
            ? index % 2 === 0
              ? 1789
              : 1918
            : 1789
          : index % 4 === 0
            ? 3.5
            : 3.14,
      };
    case 'ORDERING': {
      const ids = (metadata.orderingItems ?? []).map((item) => item.id);
      const sequence = index % 3 === 0 ? ids : [...ids.slice(1), ids[0]];
      return { ...base, orderingSequence: sequence };
    }
    case 'MATCHING': {
      const pairs = metadata.matchingPairs ?? [];
      return {
        ...base,
        matchingSelections: pairs.map((pair, pairIndex) => ({
          leftId: pair.leftId,
          rightId: pairs[(pairIndex + (index % 2)) % pairs.length].rightId,
        })),
      };
    }
    case 'CATEGORIZATION': {
      const items = metadata.categorizationItems ?? [];
      const categories = metadata.categories ?? [];
      return {
        ...base,
        categorizationSelections: items.map((item, itemIndex) => ({
          itemId: item.id,
          categoryId:
            index % 3 === 0
              ? item.correctCategoryId
              : categories[(itemIndex + index) % categories.length].id,
        })),
      };
    }
    default:
      throw new Error(`Kein Vote-Builder für ${question.type}`);
  }
}

async function waitForPresenterStage(page) {
  await page.waitForSelector(
    '[data-testid="presenter-quiz-stage"], .session-present__lobby, app-word-cloud',
    { timeout: 15_000 },
  );
  await page.waitForTimeout(800);
  await page.evaluate(async () => {
    const images = [...document.images];
    await Promise.all(
      images.map(
        (image) =>
          image.complete ||
          new Promise((resolve) => {
            image.addEventListener('load', resolve, { once: true });
            image.addEventListener('error', resolve, { once: true });
            setTimeout(resolve, 5000);
          }),
      ),
    );
  });
}

async function capture(page, name) {
  await waitForPresenterStage(page);
  const filePath = join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`  screenshot ${name}.png`);
  return filePath;
}

async function submitVotes(publicTrpc, participants, question, metadata, round) {
  const results = await Promise.allSettled(
    participants.map((participant, index) =>
      publicTrpc.vote.submit.mutate(buildVote(participant, question, metadata, round, index)),
    ),
  );
  const rejected = results.filter((result) => result.status === 'rejected');
  if (rejected.length) {
    console.warn(
      `  ${rejected.length}/${participants.length} Votes fehlgeschlagen: ${
        rejected[0].reason?.message ?? rejected[0].reason
      }`,
    );
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const ready = (await waitForUrl(`${BASE_URL}/`)) || (await waitForUrl(`${BASE_URL}/de/`));
  if (!ready) {
    throw new Error(`Frontend nicht erreichbar unter ${BASE_URL}. Bitte npm run dev starten.`);
  }

  const { quiz, payload } = await loadUploadPayload();
  const imageReport = await inventoryDemoImages(quiz);
  console.log('Bildinventar:');
  for (const entry of imageReport) {
    const extra = entry.error || (entry.status != null ? `HTTP ${entry.status}` : '');
    console.log(`  ${entry.ok ? 'OK   ' : 'FEHLT'} ${entry.src}${extra ? ` (${extra})` : ''}`);
  }
  const missingLocal = imageReport.filter((entry) => entry.kind === 'local' && !entry.ok);
  if (missingLocal.length) {
    throw new Error(
      `Lokale Demo-Bilder fehlen: ${missingLocal.map((entry) => entry.fileName).join(', ')}`,
    );
  }

  const publicTrpc = createClient();
  const uploaded = await publicTrpc.quiz.upload.mutate(payload);
  const created = await publicTrpc.session.create.mutate({
    quizId: uploaded.quizId,
    type: 'QUIZ',
    qaEnabled: false,
    quickFeedbackEnabled: false,
  });
  const code = String(created.code).toUpperCase();
  const hostToken = created.hostToken;
  const hostTrpc = createClient(hostToken);
  console.log(`Session ${code}`);

  const participants = [];
  for (let i = 0; i < PARTICIPANT_COUNT; i += 1) {
    participants.push(
      await publicTrpc.session.join.mutate({
        code,
        nickname: `TN_${i + 1}`,
        anonymousClientId: globalThis.crypto.randomUUID(),
      }),
    );
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  await enableSpaDocumentFallback(context);
  await context.addInitScript(
    ({ storageKey, token }) => {
      sessionStorage.setItem(storageKey, token);
      localStorage.setItem('home-theme', 'dark');
      localStorage.setItem('home-preset', 'serious');
      const hideConnectionChrome = () => {
        document.querySelectorAll('.connection-banner, .app-offline-banner').forEach((el) => {
          if (el instanceof HTMLElement) el.style.display = 'none';
        });
      };
      const observer = new MutationObserver(hideConnectionChrome);
      observer.observe(document.documentElement, { childList: true, subtree: true });
      hideConnectionChrome();
    },
    { storageKey: `${HOST_TOKEN_STORAGE_PREFIX}${code}`, token: hostToken },
  );
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/de/session/${code}/present`, { waitUntil: 'networkidle' });
  await capture(page, '00-lobby');

  for (let index = 0; index < payload.questions.length; index += 1) {
    const metadata = payload.questions[index];
    const opened = await hostTrpc.session.nextQuestion.mutate({ code });
    const number = String(index + 1).padStart(2, '0');
    const label = `${number}-${String(metadata.type).toLowerCase().replaceAll('_', '-')}-${slug(
      metadata.text.split('\n')[0],
    )}`;
    console.log(
      `Frage ${index + 1}/${payload.questions.length}: ${metadata.type} (${opened.status})`,
    );

    if (opened.status === 'QUESTION_OPEN') {
      await page.reload({ waitUntil: 'networkidle' });
      await capture(page, `${label}-reading`);
      await hostTrpc.session.revealAnswers.mutate({ code });
    }

    await page.reload({ waitUntil: 'networkidle' });
    await capture(page, `${label}-voting`);

    const question = await publicTrpc.session.getCurrentQuestionForStudent.query({ code });
    await submitVotes(publicTrpc, participants, question, metadata, 1);

    if (metadata.numericTwoRounds === true) {
      await hostTrpc.session.startDiscussion.mutate({ code });
      await page.reload({ waitUntil: 'networkidle' });
      await capture(page, `${label}-discussion`);
      await hostTrpc.session.startSecondRound.mutate({ code });
      await page.reload({ waitUntil: 'networkidle' });
      await capture(page, `${label}-voting-round2`);
      const round2 = await publicTrpc.session.getCurrentQuestionForStudent.query({ code });
      await submitVotes(publicTrpc, participants, round2, metadata, 2);
    }

    await hostTrpc.session.revealResults.mutate({ code });
    await page.reload({ waitUntil: 'networkidle' });
    await capture(page, `${label}-results`);
  }

  await browser.close();
  const files = (await readdir(OUT_DIR)).filter((name) => name.endsWith('.png')).sort();
  console.log(`\n${files.length} Screenshots in ${OUT_DIR}`);
  console.log(JSON.stringify({ code, files, images: imageReport }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
