#!/usr/bin/env node
/**
 * Erzeugt den Nachbesprechungsplan-PDF für die drei Demo-Fragen
 * ORDERING / MATCHING / CATEGORIZATION mit realistischer, gestreuter Abstimmung.
 *
 * Run (Backend muss laufen):
 *   TRPC_URL=http://127.0.0.1:3000/trpc \
 *     node apps/frontend/scripts/generate-structured-debrief-pdf.mjs
 *
 * Optional:
 *   PARTICIPANTS=20 OUTPUT=e2e/test-output/nachbesprechungsplan-strukturiert.pdf
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { chromium } from 'playwright';
import {
  buildSessionResultsReportHtml,
  inlineExportImagesInHtml,
  buildSessionResultsPlaywrightPdfOptions,
  buildQuestionContinuationStamps,
  stampQuestionContinuationsOnPdf,
  getSessionResultsReportLabelsDe,
} from '@arsnova/session-export-report';
import { kindergartenNickname } from '../../../scripts/load/lib/kindergarten-nicknames.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const DEMO_QUIZ_JSON = join(__dirname, '../src/assets/demo/quiz-demo-showcase.de.json');
const FRONTEND_ASSET_ROOT = join(REPO_ROOT, 'apps/frontend/src/assets');
const STRUCTURED_TYPES = ['ORDERING', 'MATCHING', 'CATEGORIZATION'];

const TRPC = String(process.env.TRPC_URL || 'http://127.0.0.1:3000/trpc').replace(/\/+$/, '');
const ASSET_BASE_URL = String(
  process.env.SESSION_EXPORT_ASSET_BASE_URL ||
    process.env.PUBLIC_FRONTEND_URL ||
    'http://127.0.0.1:4200',
).replace(/\/$/, '');
const PARTICIPANT_COUNT = Math.max(8, Number(process.env.PARTICIPANTS || 20));
const VOTE_COOLDOWN_MS = Math.max(1_100, Number(process.env.VOTE_COOLDOWN_MS || 1_100));
const OUT = resolve(
  process.env.OUTPUT || join(REPO_ROOT, 'e2e/test-output/nachbesprechungsplan-strukturiert.pdf'),
);
const sleep = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));

function createPublicTrpc() {
  return createTRPCProxyClient({ links: [httpBatchLink({ url: TRPC })] });
}

function createHostTrpc(hostToken) {
  return createTRPCProxyClient({
    links: [
      httpBatchLink({
        url: TRPC,
        headers: () => ({ 'x-host-token': hostToken }),
      }),
    ],
  });
}

async function readDemoLocalAsset(relativePath) {
  try {
    return new Uint8Array(await readFile(join(FRONTEND_ASSET_ROOT, relativePath)));
  } catch {
    return null;
  }
}

async function loadStructuredQuizPayload() {
  const raw = JSON.parse(await readFile(DEMO_QUIZ_JSON, 'utf8'));
  const quiz = raw.quiz;
  const byType = Object.fromEntries(
    quiz.questions
      .filter((question) => STRUCTURED_TYPES.includes(question.type))
      .map((question) => [question.type, question]),
  );
  for (const type of STRUCTURED_TYPES) {
    if (!byType[type]) throw new Error(`Demo-Quiz fehlt ${type}`);
  }

  const questions = STRUCTURED_TYPES.map((type, index) => {
    const sanitized = { ...byType[type], order: index };
    if (sanitized.numericTolerancePercent === null) {
      delete sanitized.numericTolerancePercent;
    }
    return sanitized;
  });

  return {
    name: 'Nachbesprechungsplan Strukturiert',
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
    nicknameTheme: 'KINDERGARTEN',
    bonusTokenCount: 1,
    readingPhaseEnabled: false,
    preset: 'PLAYFUL',
    questions,
  };
}

function clampConfidence(value) {
  return Math.max(1, Math.min(5, Math.round(value)));
}

function correctOrdering(items) {
  return items.map((item) => item.id);
}

function swapAdjacent(sequence, index) {
  const next = [...sequence];
  if (index < 0 || index >= next.length - 1) return next;
  [next[index], next[index + 1]] = [next[index + 1], next[index]];
  return next;
}

function rotateSequence(sequence, shift) {
  const n = sequence.length;
  const offset = ((shift % n) + n) % n;
  return [...sequence.slice(offset), ...sequence.slice(0, offset)];
}

function correctMatching(pairs) {
  return pairs.map((pair) => ({ left: pair.left, right: pair.right }));
}

function shiftMatching(pairs, shift) {
  return pairs.map((pair, index) => ({
    left: pair.left,
    right: pairs[(index + shift) % pairs.length].right,
  }));
}

function swapTwoMatchingPairs(pairs, a, b) {
  return pairs.map((pair, index) => {
    if (index === a) return { left: pair.left, right: pairs[b].right };
    if (index === b) return { left: pair.left, right: pairs[a].right };
    return { left: pair.left, right: pair.right };
  });
}

function correctCategorization(question) {
  return question.categorizationItems.map((item) => ({
    text: item.text,
    categoryId: item.correctCategoryId,
  }));
}

function remapCategories(question, remap) {
  return question.categorizationItems.map((item) => ({
    text: item.text,
    categoryId: remap[item.correctCategoryId] ?? item.correctCategoryId,
  }));
}

function misclassifySome(question, count, seed) {
  const categories = question.categories;
  return question.categorizationItems.map((item, index) => {
    if (index >= count) {
      return { text: item.text, categoryId: item.correctCategoryId };
    }
    const wrong =
      categories[(seed + index) % categories.length].id === item.correctCategoryId
        ? categories[(seed + index + 1) % categories.length].id
        : categories[(seed + index) % categories.length].id;
    return { text: item.text, categoryId: wrong };
  });
}

/**
 * Gestaffelte Profile über Teilnehmerindex:
 * - teils vollständig korrekt
 * - typische Teilfehler (Nachbarvertauschung / 1–2 Fehlpaare)
 * - verbreitete Fehlkonzepte (Rotation / Epoche verwechselt)
 * - vereinzelt stark daneben
 * Confidence korreliert grob mit Qualität, aber mit Ausreißern (selbstsicher falsch).
 */
function buildStructuredVote(participant, question, metadata, participantIndex, total) {
  const base = {
    sessionId: participant.id,
    participantId: participant.participantId,
    questionId: question.id,
    responseTimeMs: 1_400 + participantIndex * 41 + (participantIndex % 5) * 120,
  };
  const band = participantIndex / total;

  if (metadata.type === 'ORDERING') {
    const correct = correctOrdering(metadata.orderingItems);
    let orderingSequence;
    let confidenceValue;
    if (band < 0.35) {
      orderingSequence = correct;
      confidenceValue = clampConfidence(4 + (participantIndex % 2));
    } else if (band < 0.55) {
      orderingSequence = swapAdjacent(correct, 1 + (participantIndex % 3));
      confidenceValue = clampConfidence(3 + (participantIndex % 2));
    } else if (band < 0.7) {
      orderingSequence = swapAdjacent(swapAdjacent(correct, 0), 3);
      confidenceValue = clampConfidence(2 + (participantIndex % 2));
    } else if (band < 0.85) {
      // Häufiges Fehlkonzept: ganze Kette um eine Position verschoben, oft sicher
      orderingSequence = rotateSequence(correct, 1);
      confidenceValue = clampConfidence(4 + (participantIndex % 2));
    } else {
      orderingSequence = [...correct].reverse();
      confidenceValue = clampConfidence(1 + (participantIndex % 2));
    }
    return { ...base, orderingSequence, confidenceValue };
  }

  if (metadata.type === 'MATCHING') {
    const pairs = metadata.matchingPairs;
    let matchingSelections;
    let confidenceValue;
    if (band < 0.3) {
      matchingSelections = correctMatching(pairs);
      confidenceValue = clampConfidence(4 + (participantIndex % 2));
    } else if (band < 0.5) {
      matchingSelections = swapTwoMatchingPairs(pairs, participantIndex % 5, (participantIndex + 2) % 6);
      confidenceValue = clampConfidence(3 + (participantIndex % 2));
    } else if (band < 0.65) {
      matchingSelections = swapTwoMatchingPairs(
        swapTwoMatchingPairs(pairs, 0, 1),
        3,
        4,
      );
      confidenceValue = clampConfidence(2 + (participantIndex % 3));
    } else if (band < 0.85) {
      // Typisches Muster: alle Daten um ein Ereignis verschoben
      matchingSelections = shiftMatching(pairs, 1);
      confidenceValue = clampConfidence(4 + (participantIndex % 2));
    } else {
      matchingSelections = shiftMatching(pairs, 2);
      confidenceValue = clampConfidence(1 + (participantIndex % 3));
    }
    return { ...base, matchingSelections, confidenceValue };
  }

  if (metadata.type === 'CATEGORIZATION') {
    const auf = 'cat_aufklaerung';
    const sturm = 'cat_sturm';
    const romantik = 'cat_romantik';
    let categorizationSelections;
    let confidenceValue;
    if (band < 0.3) {
      categorizationSelections = correctCategorization(metadata);
      confidenceValue = clampConfidence(4 + (participantIndex % 2));
    } else if (band < 0.5) {
      categorizationSelections = misclassifySome(metadata, 2, participantIndex);
      confidenceValue = clampConfidence(3 + (participantIndex % 2));
    } else if (band < 0.7) {
      // Verwechslung Aufklärung ↔ Sturm und Drang (häufig im Unterricht)
      categorizationSelections = remapCategories(metadata, {
        [auf]: sturm,
        [sturm]: auf,
        [romantik]: romantik,
      });
      confidenceValue = clampConfidence(4 + (participantIndex % 2));
    } else if (band < 0.85) {
      categorizationSelections = misclassifySome(metadata, 5, participantIndex + 3);
      confidenceValue = clampConfidence(2 + (participantIndex % 2));
    } else {
      categorizationSelections = remapCategories(metadata, {
        [auf]: romantik,
        [sturm]: romantik,
        [romantik]: sturm,
      });
      confidenceValue = clampConfidence(1 + (participantIndex % 2));
    }
    return { ...base, categorizationSelections, confidenceValue };
  }

  throw new Error(`Unsupported type ${metadata.type}`);
}

async function submitVotes(publicTrpc, participants, question, metadata) {
  const settled = await Promise.allSettled(
    participants.map((participant, index) =>
      publicTrpc.vote.submit.mutate(
        buildStructuredVote(participant, question, metadata, index, participants.length),
      ),
    ),
  );
  const failures = settled.filter((result) => result.status === 'rejected');
  if (failures.length > 0) {
    const messages = failures
      .slice(0, 3)
      .map((result) => result.reason?.message ?? String(result.reason))
      .join(' | ');
    throw new Error(
      `${metadata.type}: ${failures.length}/${participants.length} Votes fehlgeschlagen. ${messages}`,
    );
  }
}

async function openQuestion(hostTrpc, publicTrpc, code) {
  const opened = await hostTrpc.session.nextQuestion.mutate({ code });
  if (opened.status === 'QUESTION_OPEN') {
    await hostTrpc.session.revealAnswers.mutate({ code });
  }
  const question = await publicTrpc.session.getCurrentQuestionForStudent.query({ code });
  if (!question?.id) {
    throw new Error('Aktuelle Frage konnte nicht geladen werden.');
  }
  return question;
}

async function renderPdf(exportData) {
  const labels = getSessionResultsReportLabelsDe();
  let html = buildSessionResultsReportHtml(exportData, labels, {
    localeId: 'de',
    generatedAt: new Date().toISOString(),
    assetBaseUrl: ASSET_BASE_URL,
    pageNumbersViaCss: false,
    pdfUaSafeVisuals: false,
    quizContentLocale: 'de',
    includeTeachingNotes: true,
  });
  html = await inlineExportImagesInHtml(html, {
    readLocalAsset: readDemoLocalAsset,
    fetchExternal: true,
  });

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    const raw = await page.pdf(
      buildSessionResultsPlaywrightPdfOptions(
        labels,
        {
          quizName: exportData.quizName,
          sessionCode: exportData.sessionCode,
        },
        'visual',
      ),
    );
    const stamped = await stampQuestionContinuationsOnPdf(
      new Uint8Array(raw),
      buildQuestionContinuationStamps(exportData, labels),
      {
        documentTitle: `${labels.documentTitle} — ${exportData.quizName}`,
        localeId: 'de',
        claimPdfUa: false,
      },
    );
    return Buffer.from(stamped);
  } finally {
    await browser.close();
  }
}

function summarizeVotes(exportData) {
  return (exportData.questions || []).map((question) => {
    const fullCorrect = question.structuredFullCorrectCount ?? question.fullCorrectCount;
    const n = question.responseCount ?? question.participantCount;
    const incorrectHigh = question.confidenceSummary?.crossTab?.incorrectHigh
      ?? question.result?.crossTab?.incorrectHigh
      ?? null;
    return {
      type: question.type,
      responses: n,
      fullCorrect,
      incorrectHigh,
    };
  });
}

async function main() {
  const publicTrpc = createPublicTrpc();
  await publicTrpc.health.check.query();

  const quizPayload = await loadStructuredQuizPayload();
  console.log(
    `Demo-Fragen: ORDERING ${quizPayload.questions[0].orderingItems.length} · ` +
      `MATCHING ${quizPayload.questions[1].matchingPairs.length} · ` +
      `CATEGORIZATION ${quizPayload.questions[2].categorizationItems.length}`,
  );
  console.log(`Teilnehmende: ${PARTICIPANT_COUNT}`);

  const { quizId } = await publicTrpc.quiz.upload.mutate(quizPayload);
  const { code, hostToken } = await publicTrpc.session.create.mutate({
    quizId,
    type: 'QUIZ',
    qaEnabled: false,
    quickFeedbackEnabled: false,
  });
  const hostTrpc = createHostTrpc(hostToken);

  const participants = [];
  for (let index = 0; index < PARTICIPANT_COUNT; index += 1) {
    participants.push(
      await publicTrpc.session.join.mutate({
        code,
        nickname: kindergartenNickname(index),
        anonymousClientId: globalThis.crypto.randomUUID(),
      }),
    );
  }

  for (let questionIndex = 0; questionIndex < quizPayload.questions.length; questionIndex += 1) {
    const metadata = quizPayload.questions[questionIndex];
    const question = await openQuestion(hostTrpc, publicTrpc, code);
    if (question.type !== metadata.type) {
      throw new Error(`Erwartet ${metadata.type}, aktiv ist ${question.type}`);
    }
    if (questionIndex > 0) {
      // Rate-Limit: 1 Vote/s pro Teilnehmer über Fragen hinweg
      await sleep(VOTE_COOLDOWN_MS);
    }
    await submitVotes(publicTrpc, participants, question, metadata);
    await hostTrpc.session.revealResults.mutate({ code });
    console.log(`OK ${metadata.type} ausgewertet`);
  }

  const finished = await hostTrpc.session.nextQuestion.mutate({ code });
  if (finished.status !== 'FINISHED') {
    await hostTrpc.session.end.mutate({ code });
  }

  const exportData = await hostTrpc.session.getExportData.query({ code });
  console.log('Verteilung:', JSON.stringify(summarizeVotes(exportData), null, 2));

  const pdf = await renderPdf(exportData);
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, pdf);
  console.log(JSON.stringify({ code, bytes: pdf.length, output: OUT }));
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
}
