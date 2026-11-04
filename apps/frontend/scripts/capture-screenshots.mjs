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
  .vote-countdown-floating, .vote-timer-a11y, .vote-timer-a11y__scoring, .vote-score-preview { display: none !important; }
  .session-host__exit-anchor { display: none !important; }
  .session-vote__qa-deadline { display: none !important; }
  *:focus,
  *:focus-visible,
  *:focus-within,
  .app-content-focus-target:focus,
  .app-content-focus-target:focus-visible,
  .app-content-focus-target:focus-within {
    outline: none !important;
    outline-offset: 0 !important;
    box-shadow: none !important;
  }
  .participant-task-status[data-screenshot-blank='true'] {
    display: none !important;
  }
`;
const SCREENSHOT_HOST_RESULTS_CSS = `
  .session-host__interim-leaderboard,
  .session-host__quiz-tools { display: none !important; }
`;
const SCREENSHOT_CLOUD_CSS = `
  .word-cloud__meta,
  .word-cloud__analysis-toolbar,
  .word-cloud__reading-hint,
  .word-cloud__eyebrow { display: none !important; }
  .word-cloud__word--positioned { transition: none !important; }
`;
const SCREENSHOT_PRESENT_CSS = `
  app-session-projection-quiz { zoom: 0.86; }
  .projection-pages__indicator { display: none !important; }
`;
const SCREENSHOT_FEEDBACK_CSS = `
  .session-present--feedback .session-present__feedback-card { zoom: 1.45; }
`;
const SCREENSHOT_NARROW_QUIZ_CSS = `
  .vote-player-badge { display: none !important; }
`;
const SCREENSHOT_LEADERBOARD_CSS = `
  .session-projection-quiz__leaderboard-page { zoom: 1.28; }
  .projection-pages__indicator,
  .session-present__board-page { display: none !important; }
`;
const SCREENSHOT_LIVE_CHROME_CSS = `
  ${SCREENSHOT_CHROME_CSS}
  .top-toolbar { display: none !important; }
  .session-present__fullscreen-gate { display: none !important; }
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
    historyScopeId: crypto.randomUUID(),
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
  const submitOne = async (participant, index) => {
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
  };

  if (question.type !== 'FREETEXT') {
    const leadIndexes = participants
      .map((_, index) => index)
      .filter((index) => homeOfficeChoiceIndex(index, 4) === 0)
      .slice(0, 5);
    for (const [order, index] of leadIndexes.entries()) {
      if (order > 0) await sleep(4_000);
      await submitOne(participants[index], index);
    }
    const lead = new Set(leadIndexes);
    const rest = participants
      .map((participant, index) => ({ participant, index }))
      .filter((job) => !lead.has(job.index));
    const settled = await mapLimit(rest, WRITE_CONCURRENCY, (job) =>
      submitOne(job.participant, job.index),
    );
    throwIfRejected(
      settled.map((value) => ({ status: 'fulfilled', value })),
      'Stimmen',
    );
    return;
  }

  const settled = await mapLimit(participants, WRITE_CONCURRENCY, (participant, index) =>
    submitOne(participant, index),
  );
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

async function pinBestQaQuestion(hostTrpc, code, sessionId) {
  const questions = await listAllHostQaQuestions(hostTrpc, sessionId);
  const visible = questions.filter(
    (question) => question.status === 'ACTIVE' || question.status === 'PINNED',
  );
  const best = visible.sort(
    (left, right) =>
      (right.upvoteCount ?? 0) - (left.upvoteCount ?? 0) ||
      String(left.text).localeCompare(String(right.text), 'de'),
  )[0];
  if (!best || best.status === 'PINNED') return best ?? null;
  await hostTrpc.qa.moderate.mutate({
    sessionCode: code,
    questionId: best.id,
    action: 'PIN',
  });
  console.log(`Q&A angepinnt: ${best.upvoteCount ?? 0} Stimmen`);
  return best;
}

async function showPresenterLeaderboard(hostTrpc, code) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const current = await hostTrpc.session.setPresenterSurface.mutate({
      code,
      surface: 'default',
    });
    const page = current.presenterPage;
    if (page?.context && page.count >= 2) {
      if (page.index < page.count - 1) {
        await hostTrpc.session.setPresenterSurface.mutate({
          code,
          page: { context: page.context, index: page.count - 1, count: page.count },
        });
      }
      return true;
    }
    await sleep(500);
  }
  return false;
}

const POSTER_CLOUD_STOPWORDS = new Set([
  'und',
  'für',
  'der',
  'die',
  'das',
  'im',
  'am',
  'nach',
  'mit',
  'statt',
  'von',
  'auf',
  'an',
  'zu',
  'zur',
  'zum',
  'eine',
  'ein',
  'bei',
  'aus',
  'vor',
  'dem',
  'den',
  'des',
  'oder',
  'als',
  'auch',
  'nur',
  'weniger',
  'echte',
  'klare',
  'bessere',
  'gute',
  'warme',
  'kürzere',
  'fairer',
  'bezahlte',
  'verlässliche',
  'transparente',
  'höhenverstellbare',
  'nachvollziehbare',
  'mehr',
  'alle',
  'wahl',
  'mail',
  'bahn',
  'begrenzen',
  'behalten',
  'befristete',
  'ernst',
  'einbinden',
  'feste',
]);

function posterCloudEntries(responses) {
  const counts = new Map();
  for (const response of responses) {
    for (const raw of String(response).split(/[\s-]+/u)) {
      const word = raw.replace(/[^\p{L}]/gu, '');
      if ([...word].length < 4 || [...word].length > 16) continue;
      const key = word.toLocaleLowerCase('de');
      if (POSTER_CLOUD_STOPWORDS.has(key)) continue;
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { label: word, count: 1 });
      }
    }
  }
  return [...counts.values()]
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'de'))
    .slice(0, 40)
    .map((entry) => ({
      key: entry.label.toLocaleLowerCase('de'),
      label: entry.label,
      count: entry.count,
      labelOrigin: 'extractive',
    }));
}

async function waitForPosterCloud(page) {
  await page.locator('.word-cloud__word--positioned').first().waitFor({
    state: 'visible',
    timeout: 30_000,
  });
  await page.waitForFunction(
    () => {
      const stage = document.querySelector('.word-cloud__visual');
      const words = [...document.querySelectorAll('.word-cloud__word--positioned')];
      if (!stage || words.length < 16) return false;
      if (stage.classList.contains('word-cloud__visual--pending')) return false;
      const labels = words.map((word) => (word.textContent ?? '').trim());
      return labels.includes('Homeoffice') && labels.every((label) => !label.includes(' '));
    },
    { timeout: 30_000 },
  );
}

async function composePosterCloud(page) {
  await page.evaluate(() => {
    const stage = document.querySelector('.session-present--word-cloud .word-cloud__visual');
    if (!(stage instanceof HTMLElement)) return;
    const frame = stage.closest('.word-cloud__visual-frame');
    const top = stage.getBoundingClientRect().top;
    const height = Math.max(640, Math.round(window.innerHeight - top - 36));
    for (const element of [stage, frame]) {
      if (!(element instanceof HTMLElement)) continue;
      element.style.setProperty('height', `${height}px`, 'important');
      element.style.setProperty('min-height', `${height}px`, 'important');
    }
    const stageBox = stage.getBoundingClientRect();
    const nodes = [...stage.querySelectorAll('.word-cloud__word--positioned')];
    const items = nodes.flatMap((node) => {
      if (!(node instanceof HTMLElement)) return [];
      const rect = node.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) return [];
      return [
        {
          node,
          x: rect.left - stageBox.left + rect.width / 2,
          y: rect.top - stageBox.top + rect.height / 2,
          w: rect.width,
          h: rect.height,
          fontSize: Number.parseFloat(node.style.fontSize) || rect.height,
        },
      ];
    });
    if (items.length < 8) return;
    const gap = 28;
    for (let iteration = 0; iteration < 160; iteration += 1) {
      let moved = false;
      for (let i = 0; i < items.length; i += 1) {
        for (let j = i + 1; j < items.length; j += 1) {
          const left = items[i];
          const right = items[j];
          const overlapX = (left.w + right.w) / 2 + gap - Math.abs(left.x - right.x);
          const overlapY = (left.h + right.h) / 2 + gap - Math.abs(left.y - right.y);
          if (overlapX <= 0 || overlapY <= 0) continue;
          if (overlapX < overlapY) {
            const direction = left.x <= right.x ? -1 : 1;
            const push = overlapX / 2;
            left.x += direction * push;
            right.x -= direction * push;
          } else {
            const direction = left.y <= right.y ? -1 : 1;
            const push = overlapY / 2;
            left.y += direction * push;
            right.y -= direction * push;
          }
          moved = true;
        }
      }
      if (!moved) break;
    }
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const item of items) {
      minX = Math.min(minX, item.x - item.w / 2);
      maxX = Math.max(maxX, item.x + item.w / 2);
      minY = Math.min(minY, item.y - item.h / 2);
      maxY = Math.max(maxY, item.y + item.h / 2);
    }
    const packedWidth = Math.max(1, maxX - minX);
    const packedHeight = Math.max(1, maxY - minY);
    const marginX = stageBox.width * 0.035;
    const marginY = stageBox.height * 0.04;
    const fitX = (stageBox.width - marginX * 2) / packedWidth;
    const fitY = (stageBox.height - marginY * 2) / packedHeight;
    const scale = Math.min(fitX, fitY) * 0.92;
    const spreadX = Math.min(1.5, fitX / scale);
    const spreadY = Math.min(1.15, fitY / scale);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    for (const item of items) {
      const x = stageBox.width / 2 + (item.x - centerX) * scale * spreadX;
      const y = stageBox.height / 2 + (item.y - centerY) * scale * spreadY;
      item.node.style.setProperty('left', `${x}px`, 'important');
      item.node.style.setProperty('top', `${y}px`, 'important');
      item.node.style.setProperty(
        'font-size',
        `${Math.max(18, item.fontSize * scale)}px`,
        'important',
      );
      item.node.style.setProperty('transition', 'none', 'important');
      item.node.style.setProperty('z-index', String(Math.round(item.fontSize)), 'important');
    }
  });
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

async function captureViewport(
  page,
  filename,
  { hideAppToolbar = false, extraCss = '', beforeShot = null } = {},
) {
  await applyScreenshotTheme(page);
  await hideEnvironmentChrome(page, { hideAppToolbar });
  if (extraCss) {
    await page.addStyleTag({ content: extraCss });
  }
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelector('main.app-main')?.scrollTo(0, 0);
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body) active.blur();
    for (const status of document.querySelectorAll('.participant-task-status')) {
      const blank = !(status.textContent ?? '').trim();
      status.toggleAttribute('data-screenshot-blank', blank);
    }
  });
  await page.waitForTimeout(400);
  if (beforeShot) await beforeShot();
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
  const clickLabel = () =>
    labels.nth(index).evaluate((element) => {
      const clickable = element.closest('button, [role="radio"], [role="button"]');
      if (clickable instanceof HTMLElement) {
        clickable.click();
        return;
      }
      if (element instanceof HTMLElement) {
        element.click();
      }
    });
  try {
    await clickLabel();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('Execution context was destroyed')) {
      throw error;
    }
    await labels.nth(index).waitFor({ state: 'visible', timeout: 15_000 });
    await clickLabel();
  }
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
  console.log(`Q&A sichtbar: ${visibleQuestionCount}`);
  await pinBestQaQuestion(hostTrpc, code, sessionId);
  await clickChannelTab(hostPage, 1);
  await presentPage.reload({ waitUntil: 'domcontentloaded' });
  await presentPage
    .locator('.session-present__qa-card .session-present__qa-text')
    .first()
    .waitFor({ state: 'visible', timeout: 20_000 });
  await presentPage
    .locator('.session-present__qa-list-item')
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 })
    .catch(() => {});
  await presentPage.waitForTimeout(800);
  await captureViewport(presentPage, 'screenshot-wide-qa.png', { hideAppToolbar: true });

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
    { hideAppToolbar: true, extraCss: SCREENSHOT_FEEDBACK_CSS },
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
  const liveFreetext = await hostTrpc.session.getLiveFreetext.query({ code });
  const posterEntries = posterCloudEntries(liveFreetext.responses ?? []);
  if (posterEntries.length < 16 || !liveFreetext.questionId) {
    throw new Error(
      `Freitext-Wortwolke hat ${posterEntries.length} Begriffe (Frage ${liveFreetext.questionId ?? 'ohne Id'}).`,
    );
  }
  console.log(
    `Freitext-Wortwolke: ${posterEntries.length} Begriffe, häufigster „${posterEntries[0]?.label}“ (${posterEntries[0]?.count})`,
  );
  // Die offene Host-Ansicht schreibt ihre eigene Phrasenwolke nach. Erst pausieren,
  // dann Fläche setzen: ein Kanalwechsel würde die Projektion sonst wieder löschen.
  const hostUrl = hostPage.url();
  await hostPage.goto('about:blank');
  await sleep(800);
  await hostTrpc.session.setPreferredLiveChannel.mutate({ code, channel: 'quiz' });
  await hostTrpc.session.setPresenterSurface.mutate({ code, surface: 'freetextWordCloud' });
  const posterProjection = {
    mode: 'LEXICAL',
    locale: 'de',
    questionId: liveFreetext.questionId,
    smoothingActive: false,
    entries: posterEntries,
  };
  await hostTrpc.session.setFreetextWordCloudProjection.mutate({
    code,
    projection: posterProjection,
  });
  await sleep(500);
  await hostTrpc.session.setFreetextWordCloudProjection.mutate({
    code,
    projection: posterProjection,
  });
  const storedProjection = await hostTrpc.session.getFreetextWordCloudProjection.query({ code });
  const storedLabels = storedProjection.projection?.entries.map((entry) => entry.label) ?? [];
  if (storedLabels.length < 16 || storedLabels.some((label) => label.includes(' '))) {
    throw new Error(
      `Freitext-Projektion nicht übernommen (${storedLabels.slice(0, 8).join(', ') || 'leer'}).`,
    );
  }
  await presentPage.addInitScript(() => {
    const style = document.createElement('style');
    style.textContent = `
      .session-present--word-cloud .word-cloud__visual-frame,
      .session-present--word-cloud .word-cloud__visual {
        min-height: 820px !important;
        height: 820px !important;
      }
    `;
    document.documentElement.append(style);
  });
  await presentPage.reload({ waitUntil: 'domcontentloaded' });
  await waitForPosterCloud(presentPage);
  await captureViewport(presentPage, 'screenshot-wide-cloud.png', {
    hideAppToolbar: true,
    extraCss: SCREENSHOT_CLOUD_CSS,
    beforeShot: () => composePosterCloud(presentPage),
  });
  await hostTrpc.session.setPresenterSurface.mutate({ code, surface: 'default' });
  await hostPage.goto(hostUrl, { waitUntil: 'domcontentloaded' });

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
  await captureViewport(voteQuizPage, 'screenshot-narrow-quiz.png', {
    extraCss: SCREENSHOT_NARROW_QUIZ_CSS,
  });
  await voteQuizPage.close();

  await submitVotes(participants, quizQuestion);
  await hostTrpc.session.revealResults.mutate({ code });

  await hostPage.reload({ waitUntil: 'domcontentloaded' });
  await waitForChannelTabs(hostPage);
  await hostPage
    .locator('.session-host__results-card')
    .waitFor({ state: 'visible', timeout: 20_000 });
  await hostPage.waitForTimeout(800);
  await captureViewport(hostPage, 'screenshot-wide-quiz.png', {
    hideAppToolbar: true,
    extraCss: SCREENSHOT_HOST_RESULTS_CSS,
  });

  await presentPage.reload({ waitUntil: 'domcontentloaded' });
  await presentPage
    .locator('.session-present__question, .projection-pages__page .session-projection-quiz')
    .first()
    .waitFor({ state: 'visible', timeout: 20_000 })
    .catch(() => {});
  await presentPage.waitForTimeout(800);
  await captureViewport(presentPage, 'screenshot-wide-present.png', {
    hideAppToolbar: true,
    extraCss: SCREENSHOT_PRESENT_CSS,
  });

  const leaderboardReady = await showPresenterLeaderboard(hostTrpc, code);
  if (!leaderboardReady) {
    throw new Error('Beamer-Rangliste wurde nicht als eigene Seite gemeldet.');
  }
  await presentPage
    .locator('[data-testid="presenter-results-leaderboard"]')
    .waitFor({ state: 'visible', timeout: 20_000 });
  await presentPage.waitForTimeout(600);
  await captureViewport(presentPage, 'screenshot-wide-leaderboard.png', {
    hideAppToolbar: true,
    extraCss: SCREENSHOT_LEADERBOARD_CSS,
  });

  await hostTrpc.session.end.mutate({ code }).catch(() => {});
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
