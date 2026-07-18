#!/usr/bin/env node
/**
 * E2E: Demo-Quiz mit 30 Teilnehmenden (Pseudonym-Set Kindergarten) und reproduzierbar
 * zufälligen Confidence-Abstimmungen gegen die laufende Dev-Umgebung.
 *
 * Run:
 *   npm run e2e:confidence-summary-demo -w @arsnova/frontend
 *
 * Optional:
 *   BASE_URL=http://localhost:4200 PARTICIPANTS=30 CONFIDENCE_SEED=20260713 \
 *   PRIORITY_QUESTION_COUNT=4 \
 *   E2E_ARTIFACT_DIR=/tmp/arsnova-confidence-e2e \
 *   npm run e2e:confidence-summary-demo -w @arsnova/frontend
 *
 * Bestehende Session (Host-Token aus Browser-LocalStorage oder Backend minten):
 *   SESSION_CODE=XFNHXE HOST_TOKEN=... BASE_URL=http://localhost:4200 PARTICIPANTS=30 \
 *   npm run e2e:confidence-summary-demo -w @arsnova/frontend
 */
import { mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { chromium, webkit } from 'playwright';
import { kindergartenNickname } from '../../../scripts/load/lib/kindergarten-nicknames.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEMO_QUIZ_JSON = join(__dirname, '../src/assets/demo/quiz-demo-showcase.de.json');
const DEMO_QUIZ_HISTORY_SCOPE_ID = 'de500000-0000-4000-a000-000000000001';
const BASE_URL = String(process.env.BASE_URL || 'http://localhost:4200').replace(/\/+$/, '');
const TRPC_URL = String(process.env.TRPC_URL || `${BASE_URL}/trpc`);
const SESSION_CODE = String(process.env.SESSION_CODE || '')
  .trim()
  .toUpperCase();
const HOST_TOKEN = String(process.env.HOST_TOKEN || '').trim();
const PARTICIPANT_COUNT = Math.max(5, Number(process.env.PARTICIPANTS || 30));
const CONFIDENCE_SEED = Number(process.env.CONFIDENCE_SEED || 20260713) >>> 0;
const CONFIGURED_PRIORITY_QUESTION_COUNT = process.env.PRIORITY_QUESTION_COUNT
  ? Number(process.env.PRIORITY_QUESTION_COUNT)
  : null;
if (
  CONFIGURED_PRIORITY_QUESTION_COUNT !== null &&
  (!Number.isInteger(CONFIGURED_PRIORITY_QUESTION_COUNT) || CONFIGURED_PRIORITY_QUESTION_COUNT < 1)
) {
  throw new Error('PRIORITY_QUESTION_COUNT muss eine positive ganze Zahl sein.');
}
const VOTE_COOLDOWN_MS = Math.max(1_000, Number(process.env.VOTE_COOLDOWN_MS || 1_100));
const SKIP_HOST_UI = ['1', 'true', 'yes'].includes(
  String(process.env.SKIP_HOST_UI || '')
    .trim()
    .toLowerCase(),
);
const ARTIFACT_DIR =
  process.env.E2E_ARTIFACT_DIR || join(tmpdir(), 'arsnova-confidence-summary-demo-e2e');
const HOST_SCREENSHOT = join(ARTIFACT_DIR, 'host-confidence-summary.png');
const HOST_TOKEN_STORAGE_PREFIX = 'arsnova-host-token:';

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

function createSeededRandom(seed) {
  let state = seed || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const random = createSeededRandom(CONFIDENCE_SEED);
const generatedConfidenceDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
const priorityQuestionOrders = new Set();
const generatedFeedback = {
  overallDistribution: {},
  overallSum: 0,
  questionQualityDistribution: {},
  questionQualitySum: 0,
  wouldRepeatYes: 0,
  wouldRepeatNo: 0,
};

function randomConfidenceValue(min = 1, max = 5) {
  const value = min + Math.floor(random() * (max - min + 1));
  generatedConfidenceDistribution[String(value)] += 1;
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForUrl(url, attempts = 40) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Dev-Server startet eventuell noch.
    }
    await sleep(500);
  }
  throw new Error(`Dev-Umgebung ist nicht erreichbar: ${url}`);
}

async function waitForTrpc(client, attempts = 40) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      await client.health.check.query();
      return;
    } catch {
      // Backend oder Proxy startet eventuell noch.
    }
    await sleep(500);
  }
  throw new Error(`tRPC ist nicht erreichbar: ${TRPC_URL}`);
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function loadDemoQuizUploadPayload() {
  const raw = JSON.parse(await readFile(DEMO_QUIZ_JSON, 'utf8'));
  const quiz = raw.quiz;
  return {
    historyScopeId: DEMO_QUIZ_HISTORY_SCOPE_ID,
    // Kein Millisekunden-Timestamp im Namen (erscheint sonst in PDF-Kopfzeile).
    name: `${quiz.name} · Didaktik-Demo`,
    description: quiz.description,
    motifImageUrl: quiz.motifImageUrl ?? null,
    showLeaderboard: quiz.showLeaderboard,
    allowCustomNicknames: quiz.allowCustomNicknames,
    defaultTimer: quiz.defaultTimer ?? null,
    timerScaleByDifficulty: quiz.timerScaleByDifficulty ?? true,
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
    nicknameTheme: 'KINDERGARTEN',
    bonusTokenCount: quiz.bonusTokenCount ?? null,
    readingPhaseEnabled: quiz.readingPhaseEnabled ?? true,
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

/** Korrektheit kommt aus dem Upload-Payload; die Student-API liefert keine isCorrect-Flags. */
function normalizeAnswerText(value) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function answerIdsByCorrectness(question, metadata) {
  const metaAnswers = Array.isArray(metadata.answers) ? metadata.answers : [];
  const byText = new Map(
    metaAnswers.map((answer) => [normalizeAnswerText(answer.text), answer.isCorrect === true]),
  );
  const correct = [];
  const wrong = [];
  for (const answer of question.answers) {
    const key = normalizeAnswerText(answer.text);
    // Kein Index-Fallback: Antwortreihenfolge ist für TN geshuffelt.
    if (byText.get(key) === true) {
      correct.push(answer.id);
    } else {
      wrong.push(answer.id);
    }
  }
  return { correct, wrong };
}

function findAnswerIdByText(question, needles) {
  const normalizedNeedles = needles.map((needle) => normalizeAnswerText(needle));
  const match = question.answers.find((answer) => {
    const text = normalizeAnswerText(answer.text);
    return normalizedNeedles.some((needle) => text.includes(needle) || needle.includes(text));
  });
  return match?.id ?? null;
}

function buildVoteInput(participant, question, metadata, round, participantIndex) {
  const base = {
    sessionId: participant.id,
    participantId: participant.participantId,
    questionId: question.id,
    round,
    // Gestaffelte Antwortzeiten → sichtbare Bonus-Rang-Unterschiede bei gleichem Score
    responseTimeMs: 1_200 + participantIndex * 37 + round * 180 + (participantIndex % 7) * 90,
  };
  const requiresDebrief = priorityQuestionOrders.has(metadata.order);
  const n = PARTICIPANT_COUNT;
  let vote;

  switch (question.type) {
    case 'SURVEY':
      vote = {
        ...base,
        answerIds: [question.answers[participantIndex % question.answers.length].id],
      };
      break;
    case 'SINGLE_CHOICE': {
      const { correct, wrong } = answerIdsByCorrectness(question, metadata);
      const correctId = correct[0] ?? question.answers[0].id;
      const wrongId = wrong[0] ?? question.answers[question.answers.length - 1].id;
      const otherWrongId = wrong[1] ?? wrongId;
      let answerId = correctId;
      if (requiresDebrief) {
        // Fehlkonzept Würfel: Mehrheit „22“ (nicht 26), aber mit natürlicher Varianz (~80 %)
        const distractor22 =
          findAnswerIdByText(question, ['22']) ?? wrong[wrong.length - 1] ?? wrongId;
        const bucket = participantIndex % 10;
        if (bucket < 8) {
          answerId = distractor22;
        } else if (bucket === 8) {
          answerId = otherWrongId;
        } else {
          answerId = correctId;
        }
      } else if (metadata.order === 2) {
        // ~40 % falsch bei niedriger Sicherheit → „Grundlage erneut erklären“
        answerId = participantIndex % 5 < 2 ? wrongId : correctId;
      } else if (metadata.order === 5) {
        // Code-Sprache ohne Confidence: ~26 % richtig → empirisches Reteach
        answerId = participantIndex % 4 === 0 ? correctId : otherWrongId;
      } else {
        answerId = participantIndex % 3 === 0 ? wrongId : correctId;
      }
      vote = { ...base, answerIds: [answerId] };
      break;
    }
    case 'MULTIPLE_CHOICE': {
      const { correct, wrong } = answerIdsByCorrectness(question, metadata);
      const falseOnly = wrong.length > 0 ? wrong : [question.answers[0].id];
      const vorwissenId = findAnswerIdByText(question, ['vorwissen']);
      const omitVorwissen =
        vorwissenId && correct.includes(vorwissenId)
          ? correct.filter((id) => id !== vorwissenId)
          : correct.slice(1);
      let answerIds;
      if (requiresDebrief) {
        // Selbstsicher falsch mit Varianz: nicht alle denselben Fehlerpfad
        const bucket = participantIndex % 10;
        if (bucket < 6) {
          answerIds = omitVorwissen.length > 0 ? omitVorwissen : falseOnly;
        } else if (bucket < 8) {
          answerIds = falseOnly;
        } else if (bucket === 8 && correct.length > 0) {
          // Teilweise richtig (eine korrekte Option)
          answerIds = [correct[0]];
        } else {
          answerIds = correct.length > 0 ? correct : falseOnly;
        }
      } else {
        answerIds = correct.length > 0 ? correct : [question.answers[0].id];
      }
      vote = { ...base, answerIds: [...new Set(answerIds)] };
      break;
    }
    case 'NUMERIC_ESTIMATE':
      if (metadata.numericTwoRounds === true) {
        // Peer Instruction: Runde 1 oft außerhalb des Bands (1700–1900), Runde 2 klarer Lernzuwachs
        // Außerhalb 1700–1900, aber innerhalb numericMin/Max (1500–2000)
        const outsideBand = [1500, 1600, 1648, 1655, 1918, 1950, 1999, 2000];
        if (round === 1) {
          vote = {
            ...base,
            numericValue:
              participantIndex < Math.round(n * 0.3)
                ? 1789
                : outsideBand[participantIndex % outsideBand.length],
          };
        } else {
          vote = {
            ...base,
            numericValue:
              participantIndex < Math.round(n * 0.82)
                ? 1789
                : outsideBand[participantIndex % outsideBand.length],
          };
        }
      } else if (metadata.order === 1) {
        // π: Mehrheit exakt richtig, aber unsicher → absichern; wenige Ausreißer
        vote = {
          ...base,
          numericValue: participantIndex % 10 === 0 ? 3.5 : 3.14,
        };
      } else {
        vote = {
          ...base,
          numericValue: Number(metadata.numericReferenceValue ?? 0),
        };
      }
      break;
    case 'SHORT_TEXT':
      vote = {
        ...base,
        // ~34 % richtig → erneut erklären (ohne Fehlkonzept-Signal)
        freeText: participantIndex % 3 === 0 ? 'Peer Instruction' : 'Think Pair Share',
      };
      break;
    case 'RATING':
      vote = { ...base, ratingValue: 3 + (participantIndex % 3) };
      break;
    default:
      throw new Error(`Nicht unterstützter Demo-Fragentyp: ${question.type}`);
  }

  if (question.confidenceEnabled) {
    if (requiresDebrief) {
      // Meist hohe Sicherheit beim Fehlkonzept, vereinzelt unsicher/richtig
      const bucket = participantIndex % 10;
      vote.confidenceValue =
        bucket < 8 ? randomConfidenceValue(4, 5) : randomConfidenceValue(1, 3);
    } else if (metadata.numericTwoRounds === true) {
      const inBandShare = Math.round(n * (round === 1 ? 0.3 : 0.82));
      const inBand = participantIndex < inBandShare;
      if (round === 1) {
        vote.confidenceValue = randomConfidenceValue(1, 3);
      } else if (inBand) {
        // Nach Diskussion sicherer bei korrekter Schätzung
        vote.confidenceValue = randomConfidenceValue(3, 5);
      } else {
        // Verbleibende Fehler unsicher — kein zusätzliches Fehlkonzept-Signal
        vote.confidenceValue = randomConfidenceValue(1, 2);
      }
    } else if (metadata.order === 1) {
      // Richtig, aber unsicher
      vote.confidenceValue = randomConfidenceValue(1, 2);
    } else {
      vote.confidenceValue = randomConfidenceValue(1, 3);
    }
  }
  return vote;
}

async function submitVotes(publicTrpc, participants, question, metadata, round) {
  const settled = await Promise.allSettled(
    participants.map((participant, index) =>
      publicTrpc.vote.submit.mutate(buildVoteInput(participant, question, metadata, round, index)),
    ),
  );
  const failures = settled.filter((result) => result.status === 'rejected');
  if (failures.length > 0) {
    const messages = failures
      .slice(0, 3)
      .map((result) => result.reason?.message ?? String(result.reason))
      .join(' | ');
    throw new Error(
      `Frage ${question.order + 1}, Runde ${round}: ${failures.length}/${participants.length} Votes fehlgeschlagen. ${messages}`,
    );
  }
}

function buildSessionFeedbackInput(participant, participantIndex, code) {
  // Leicht entkoppelte Verteilungen (nicht byte-identisch)
  const overallPool = [3, 3, 4, 4, 4, 5, 5, 5, 5, 2];
  const qualityPool = [4, 4, 4, 5, 5, 5, 3, 3, 5, 4];
  const overallRating = overallPool[participantIndex % overallPool.length];
  const questionQualityRating = qualityPool[participantIndex % qualityPool.length];
  const wouldRepeat = participantIndex % 5 !== 0;

  generatedFeedback.overallDistribution[String(overallRating)] =
    (generatedFeedback.overallDistribution[String(overallRating)] ?? 0) + 1;
  generatedFeedback.overallSum += overallRating;
  generatedFeedback.questionQualityDistribution[String(questionQualityRating)] =
    (generatedFeedback.questionQualityDistribution[String(questionQualityRating)] ?? 0) + 1;
  generatedFeedback.questionQualitySum += questionQualityRating;
  if (wouldRepeat) {
    generatedFeedback.wouldRepeatYes += 1;
  } else {
    generatedFeedback.wouldRepeatNo += 1;
  }

  return {
    code,
    participantId: participant.participantId,
    overallRating,
    questionQualityRating,
    wouldRepeat,
  };
}

async function submitSessionFeedback(publicTrpc, participants, code) {
  const settled = await Promise.allSettled(
    participants.map((participant, index) =>
      publicTrpc.session.submitSessionFeedback.mutate(
        buildSessionFeedbackInput(participant, index, code),
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
      `${failures.length}/${participants.length} Abschluss-Feedbacks fehlgeschlagen. ${messages}`,
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
    throw new Error('Aktuelle Demo-Frage konnte nicht geladen werden.');
  }
  return question;
}

function distributionTotal(distribution) {
  return Object.values(distribution).reduce((sum, count) => sum + count, 0);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: erwartet ${expected}, erhalten ${actual}.`);
  }
}

function validateSummary(summary, expectedQuestions, expectedPriorityQuestions) {
  if (!summary) {
    throw new Error('Keine Session-weite Confidence-Zusammenfassung vorhanden.');
  }
  const expectedResponses = expectedQuestions * PARTICIPANT_COUNT;
  assertEqual(summary.includedQuestionCount, expectedQuestions, 'Ausgewertete Confidence-Fragen');
  assertEqual(summary.suppressedQuestionCount, 0, 'Unterdrückte Confidence-Fragen');
  assertEqual(
    summary.priorityQuestionCount,
    expectedPriorityQuestions,
    'Fragen zur Nachbesprechung',
  );
  assertEqual(summary.responseCount, expectedResponses, 'Confidence-Antworten im Summary');
  assertEqual(distributionTotal(summary.distribution), expectedResponses, 'Confidence-Verteilung');
  assertEqual(summary.questions.length, expectedQuestions, 'Priorisierte Fragen');
  if (Object.values(summary.distribution).some((count) => count === 0)) {
    throw new Error(
      `Zufallsverteilung deckt nicht alle fünf Confidence-Stufen ab: ${JSON.stringify(summary.distribution)}`,
    );
  }
}

function validateFeedbackSummary(summary) {
  if (!summary) {
    throw new Error('Kein aggregiertes Abschluss-Feedback vorhanden.');
  }
  assertEqual(summary.totalResponses, PARTICIPANT_COUNT, 'Abschluss-Feedbacks');
  assertEqual(
    summary.overallAverage,
    Math.round((generatedFeedback.overallSum / PARTICIPANT_COUNT) * 100) / 100,
    'Durchschnittliche Gesamtbewertung',
  );
  assertEqual(
    summary.questionQualityAverage,
    Math.round((generatedFeedback.questionQualitySum / PARTICIPANT_COUNT) * 100) / 100,
    'Durchschnittliche Fragenqualität',
  );
  assertEqual(summary.wouldRepeatYes, generatedFeedback.wouldRepeatYes, 'Erneute Teilnahme: ja');
  assertEqual(summary.wouldRepeatNo, generatedFeedback.wouldRepeatNo, 'Erneute Teilnahme: nein');

  for (const rating of ['1', '2', '3', '4', '5']) {
    assertEqual(
      summary.overallDistribution[rating] ?? 0,
      generatedFeedback.overallDistribution[rating] ?? 0,
      `Gesamtbewertung ${rating}`,
    );
    assertEqual(
      summary.questionQualityDistribution?.[rating] ?? 0,
      generatedFeedback.questionQualityDistribution[rating] ?? 0,
      `Fragenqualität ${rating}`,
    );
  }
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch {
    return webkit.launch({ headless: true });
  }
}

async function waitForBodyText(page, matcher, timeout = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    const text = await page
      .locator('body')
      .innerText()
      .catch(() => '');
    if (matcher.test(text)) return text;
    await page.waitForTimeout(250);
  }
  throw new Error(`Erwarteter Host-Text nicht sichtbar: ${matcher}`);
}

async function verifyHostUiAndCsv(code, hostToken, expectedResponses, expectedPriorityQuestions) {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(
      ({ sessionCode, token, prefix }) => {
        globalThis.sessionStorage.setItem(`${prefix}${sessionCode}`, token);
      },
      { sessionCode: code, token: hostToken, prefix: HOST_TOKEN_STORAGE_PREFIX },
    );
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/session/${code}/host`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    const bodyText = await waitForBodyText(
      page,
      /Lernstand und Selbsteinschätzung[\s\S]*Fehlkonzept-Risiko/,
    );
    if (!bodyText.includes('Session beendet')) {
      throw new Error('Host-UI zeigt den FINISHED-Abschluss nicht an.');
    }
    if (!bodyText.includes(`Antworten mit Selbsteinschätzung: ${expectedResponses}`)) {
      throw new Error(
        `Host-UI zeigt nicht ${expectedResponses} Antworten mit Selbsteinschätzung an.`,
      );
    }
    if (!bodyText.includes('Priorität für die Nachbesprechung')) {
      throw new Error('Host-UI zeigt keine priorisierten Fragen an.');
    }
    if (!bodyText.includes(`Nachbesprechung empfohlen: ${expectedPriorityQuestions}`)) {
      throw new Error(
        `Host-UI zeigt nicht ${expectedPriorityQuestions} Fragen zur Nachbesprechung an.`,
      );
    }
    await waitForBodyText(
      page,
      new RegExp(`Feedback der Teilnehmenden[\\s\\S]*${PARTICIPANT_COUNT} Bewertungen`),
    );
    const feedbackCard = page.locator('.session-host__feedback-card');
    await feedbackCard.waitFor({ state: 'visible', timeout: 10_000 });
    const feedbackText = await feedbackCard.innerText();
    for (const expected of [
      'Gesamtbewertung',
      `${PARTICIPANT_COUNT} Bewertungen`,
      'Qualität der Fragen',
    ]) {
      if (!feedbackText.includes(expected)) {
        throw new Error(`Host-UI zeigt "${expected}" im Abschluss-Feedback nicht an.`);
      }
    }
    const repeatBadges = feedbackCard.locator('.session-host__feedback-repeat-badges');
    const repeatText = await repeatBadges.innerText();
    if (
      !repeatText.includes(String(generatedFeedback.wouldRepeatYes)) ||
      !repeatText.includes(String(generatedFeedback.wouldRepeatNo))
    ) {
      throw new Error('Host-UI zeigt die Verteilung zur erneuten Teilnahme nicht korrekt an.');
    }
    const renderedQuestion = page
      .locator('.session-host__finished-confidence-question-markdown')
      .filter({ hasText: 'Welche dieser Einsätze eignen sich gut' })
      .first();
    await renderedQuestion.locator('h3').waitFor({ state: 'visible', timeout: 10_000 });
    const renderedQuestionText = await renderedQuestion.innerText();
    if (
      !renderedQuestionText.includes(
        'Unterrichtsidee: Nutze das, um Multiple Choice mit mehreren richtigen Antworten zu zeigen.',
      )
    ) {
      throw new Error(
        'Der vollständige Markdown-Fragentext wird in der Auswertung nicht gerendert.',
      );
    }
    if (renderedQuestionText.includes('###') || renderedQuestionText.includes('**')) {
      throw new Error('Markdown-Steuerzeichen sind in der gerenderten Auswertung sichtbar.');
    }
    const metricRects = await page
      .locator('.session-host__finished-confidence-question-metric')
      .evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return { left: rect.left, width: rect.width };
        }),
      );
    for (const columnIndex of [0, 1]) {
      const column = metricRects.filter((_, index) => index % 2 === columnIndex);
      const leftEdges = column.map((rect) => rect.left);
      const widths = column.map((rect) => rect.width);
      if (
        Math.max(...leftEdges) - Math.min(...leftEdges) > 1 ||
        Math.max(...widths) - Math.min(...widths) > 1
      ) {
        throw new Error(`Kennzahlenspalte ${columnIndex + 1} hat keine durchgehende Fluchtlinie.`);
      }
    }
    await page.screenshot({ path: HOST_SCREENSHOT, fullPage: true });

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    await page.getByRole('button', { name: 'Weitere Exportoptionen' }).click();
    await page.getByRole('menuitem', { name: /Für Excel exportieren/i }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    if (!downloadPath) {
      throw new Error('CSV-Download hat keinen lesbaren temporären Pfad.');
    }
    const csv = await readFile(downloadPath, 'utf8');
    for (const expected of [
      'Selbsteinschätzung n',
      'Fehlkonzept-Risiko',
      'Häufigste selbstsicher falsche Antwort',
      'Lernstand und Selbsteinschätzung',
      'Gültige Antworten;Ausgewertete Fragen',
    ]) {
      if (!csv.includes(expected)) {
        throw new Error(`CSV enthält "${expected}" nicht.`);
      }
    }
    await context.close();
  } finally {
    await browser.close();
  }
}

async function run() {
  if (!SKIP_HOST_UI) {
    await waitForUrl(BASE_URL);
  }

  const uploadPayload = await loadDemoQuizUploadPayload();
  const expectedConfidenceQuestions = uploadPayload.questions.filter(
    (question) => question.confidenceEnabled,
  ).length;
  const expectedPriorityQuestions = Math.max(
    1,
    Math.min(
      expectedConfidenceQuestions,
      Math.floor(
        CONFIGURED_PRIORITY_QUESTION_COUNT ?? 1 + (CONFIDENCE_SEED % expectedConfidenceQuestions),
      ),
    ),
  );
  // 3 = MC Live-Checks (Auslassung), 4 = Würfel (Distraktor) — nicht die PI-Frage (7)
  const preferredPriorityOrder = [3, 4];
  for (const question of preferredPriorityOrder.slice(0, expectedPriorityQuestions)) {
    priorityQuestionOrders.add(question);
  }
  const publicTrpc = createTrpcClient();
  await waitForTrpc(publicTrpc);
  let code;
  let hostToken;
  let quizId;
  if (SESSION_CODE) {
    if (!/^[A-Z0-9]{6}$/.test(SESSION_CODE)) {
      throw new Error('SESSION_CODE muss genau 6 alphanumerische Zeichen haben.');
    }
    if (!HOST_TOKEN) {
      throw new Error('Für SESSION_CODE ist HOST_TOKEN erforderlich.');
    }
    code = SESSION_CODE;
    hostToken = HOST_TOKEN;
    const sessionInfo = await publicTrpc.session.getInfo.query({ code });
    if (sessionInfo.status === 'FINISHED') {
      throw new Error(`Session ${code} ist bereits abgeschlossen (FINISHED).`);
    }
    quizId = null;
  } else {
    ({ quizId } = await publicTrpc.quiz.upload.mutate(uploadPayload));
    ({ code, hostToken } = await publicTrpc.session.create.mutate({
      quizId,
      type: 'QUIZ',
      qaEnabled: false,
      quickFeedbackEnabled: false,
    }));
  }
  const hostTrpc = createTrpcClient(hostToken);

  const participants = await mapLimit(
    Array.from({ length: PARTICIPANT_COUNT }, (_, index) => index),
    15,
    (_, index) =>
      publicTrpc.session.join.mutate({
        code,
        nickname: kindergartenNickname(index),
      }),
  );

  for (const metadata of uploadPayload.questions) {
    const question = await openQuestion(hostTrpc, publicTrpc, code);
    await submitVotes(publicTrpc, participants, question, metadata, 1);
    if (metadata.numericTwoRounds === true) {
      await hostTrpc.session.startDiscussion.mutate({ code });
      await hostTrpc.session.startSecondRound.mutate({ code });
      await sleep(VOTE_COOLDOWN_MS);
      const roundTwoQuestion = await publicTrpc.session.getCurrentQuestionForStudent.query({
        code,
      });
      await submitVotes(publicTrpc, participants, roundTwoQuestion, metadata, 2);
    }
    await hostTrpc.session.revealResults.mutate({ code });
    await sleep(VOTE_COOLDOWN_MS);
  }

  const finished = await hostTrpc.session.nextQuestion.mutate({ code });
  assertEqual(finished.status, 'FINISHED', 'Session-Status');

  await submitSessionFeedback(publicTrpc, participants, code);
  const feedbackSummary = await publicTrpc.session.getSessionFeedbackSummary.query({ code });
  validateFeedbackSummary(feedbackSummary);

  const exportData = await hostTrpc.session.getExportData.query({ code });
  validateSummary(
    exportData.confidenceSummary,
    expectedConfidenceQuestions,
    expectedPriorityQuestions,
  );

  const history =
    quizId === null
      ? null
      : await publicTrpc.session.getLastSessionAnalysisForQuiz.query({
          quizId,
          accessProof: DEMO_QUIZ_HISTORY_SCOPE_ID,
        });
  if (quizId !== null) {
    if (!history) {
      throw new Error('Letzte Auswertung ist über die Quiz-Historie nicht abrufbar.');
    }
    assertEqual(history.participantCount, PARTICIPANT_COUNT, 'Teilnehmende in der Historie');
    validateSummary(
      history.confidenceSummary,
      expectedConfidenceQuestions,
      expectedPriorityQuestions,
    );
    validateFeedbackSummary(history.feedbackSummary);
  }

  const expectedResponses = expectedConfidenceQuestions * PARTICIPANT_COUNT;
  let hostUiStatus = SKIP_HOST_UI ? 'skipped' : 'ok';
  if (!SKIP_HOST_UI) {
    try {
      await verifyHostUiAndCsv(code, hostToken, expectedResponses, expectedPriorityQuestions);
    } catch (error) {
      hostUiStatus = `warn: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`Host-UI/CSV-Prüfung fehlgeschlagen (Session ${code} bleibt gültig):`, error);
    }
  }

  console.log(
    JSON.stringify(
      {
        status: hostUiStatus === 'ok' || hostUiStatus === 'skipped' ? 'OK' : 'OK_WITH_HOST_UI_WARN',
        baseUrl: BASE_URL,
        sessionCode: code,
        hostToken,
        participants: PARTICIPANT_COUNT,
        demoQuestions: uploadPayload.questions.length,
        confidenceQuestions: expectedConfidenceQuestions,
        expectedPriorityQuestions,
        priorityQuestionOrders: [...priorityQuestionOrders],
        effectiveConfidenceResponses: expectedResponses,
        confidenceSeed: CONFIDENCE_SEED,
        generatedConfidenceDistribution,
        feedbackSummary,
        summaryDistribution: exportData.confidenceSummary.distribution,
        priorityQuestionCount: exportData.confidenceSummary.priorityQuestionCount,
        screenshot: SKIP_HOST_UI ? null : HOST_SCREENSHOT,
        hostUiStatus,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
