#!/usr/bin/env node
/**
 * Unterrichts-Szenario: Demo-Quiz mit 30 Teilnehmenden, 9 Fragen, alle abstimmen.
 *
 * Ablauf (entspricht Live-Start des Praxis-Showcase):
 * 1. Host laedt Demo-Quiz hoch und erstellt Session
 * 2. 30 Teilnehmende joinen (Team-Modus, Kindergarten-Nicknames)
 * 3. Host oeffnet nacheinander alle 9 Fragen; TN voten jeweils
 * 4. Frage 8 (Franz. Revolution): zwei Runden (Peer Instruction mit Lernzuwachs)
 * 5. Session endet mit FINISHED
 *
 * Die Vote-Verteilungen sind didaktisch ausbalanciert (Varianz, Distraktoren,
 * Fehlkonzept-Hinweise, Peer-Instruction-Lerngewinn) — analog zum
 * Confidence-Summary-Demo-Flow, nicht als gleichmäßige Round-Robin-Auswahl.
 *
 * Run:
 *   npm run load:smoke:demo-classroom-30
 *   PARTICIPANTS=30 TRPC_URL=http://127.0.0.1:3000/trpc node scripts/load/demo-quiz-classroom-30.mjs
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { waitForBackend } from './lib/wait-for-backend.mjs';
import { writeScenarioReport } from './lib/reporting.mjs';
import { kindergartenNickname } from './lib/kindergarten-nicknames.mjs';

let trpcClientModule;
try {
  trpcClientModule = await import('@trpc/client');
} catch {
  trpcClientModule = await import('../../apps/frontend/node_modules/@trpc/client/dist/index.mjs');
}

const { createTRPCProxyClient, httpLink } = trpcClientModule;

const __dirname = dirname(fileURLToPath(import.meta.url));
const SUPPORTED_DEMO_LOCALES = new Set(['de', 'en', 'fr', 'es', 'it']);
const QUIZ_CONTENT_LOCALE = String(
  process.env.QUIZ_CONTENT_LOCALE || process.env.DEMO_QUIZ_LOCALE || 'de',
)
  .trim()
  .slice(0, 2)
  .toLowerCase();
if (!SUPPORTED_DEMO_LOCALES.has(QUIZ_CONTENT_LOCALE)) {
  throw new Error(
    `Unsupported QUIZ_CONTENT_LOCALE=${QUIZ_CONTENT_LOCALE}. Expected one of: ${[...SUPPORTED_DEMO_LOCALES].join(', ')}`,
  );
}
const DEMO_QUIZ_JSON = join(
  __dirname,
  `../../apps/frontend/src/assets/demo/quiz-demo-showcase.${QUIZ_CONTENT_LOCALE}.json`,
);
/** Pro Locale eigene History-Scope-ID (gültige UUID v4, nur Hex), damit Reseed nicht kollidiert. */
const DEMO_QUIZ_HISTORY_SCOPE_BY_LOCALE = {
  de: 'de500000-0000-4000-a000-000000000001',
  en: 'e1500000-0000-4000-a000-000000000001',
  fr: 'f4500000-0000-4000-a000-000000000001',
  es: 'e5500000-0000-4000-a000-000000000001',
  it: '17500000-0000-4000-a000-000000000001',
};
const DEMO_QUIZ_HISTORY_SCOPE_ID = DEMO_QUIZ_HISTORY_SCOPE_BY_LOCALE[QUIZ_CONTENT_LOCALE];

/** MC-Option „Vorwissen …“ — Needles je Showcase-Locale. */
const PRIOR_KNOWLEDGE_NEEDLES_BY_LOCALE = {
  de: ['vorwissen'],
  en: ['prior knowledge'],
  fr: ['connaissances préalables', 'connaissances prealables'],
  es: ['conocimientos previos'],
  it: ['conoscenze pregresse'],
};

const TRPC_URL = String(process.env.TRPC_URL || 'http://127.0.0.1:3000/trpc').trim();
const SESSION_CODE = String(process.env.SESSION_CODE || '')
  .trim()
  .toUpperCase();
const HOST_TOKEN_ENV = String(process.env.HOST_TOKEN || '').trim();
const PARTICIPANTS = Math.max(1, Number(process.env.PARTICIPANTS || 30));
const JOIN_CONCURRENCY = Math.max(1, Number(process.env.JOIN_CONCURRENCY || 15));
const EXPECTED_QUESTIONS = Math.max(1, Number(process.env.EXPECTED_QUESTIONS || 9));
const VOTE_P95_LIMIT_MS = Math.max(100, Number(process.env.VOTE_P95_LIMIT_MS || 1_000));
/** Backend: max. 1 Vote/s pro Teilnehmer (checkVoteRate). */
const VOTE_COOLDOWN_MS = Math.max(1_000, Number(process.env.VOTE_COOLDOWN_MS || 1_100));
const CONFIDENCE_SEED = Number(process.env.CONFIDENCE_SEED || 20260713) >>> 0;
/** Fragen mit Fehlkonzept-Hinweis für den Nachbesprechungsplan (MC + Würfel). */
const PRIORITY_QUESTION_ORDERS = new Set([3, 4]);

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

function randomConfidenceValue(min = 1, max = 5) {
  return min + Math.floor(random() * (max - min + 1));
}

function createHttpClient(hostToken) {
  return createTRPCProxyClient({
    links: [
      httpLink({
        url: TRPC_URL,
        headers: hostToken ? () => ({ 'x-host-token': hostToken }) : undefined,
      }),
    ],
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

function summarizeDurations(values) {
  return {
    p50Ms: Math.round(percentile(values, 50)),
    p95Ms: Math.round(percentile(values, 95)),
    maxMs: Math.round(Math.max(0, ...values)),
  };
}

function summarizeErrors(results) {
  const errors = new Map();
  for (const result of results) {
    if (result.status !== 'rejected') continue;
    const message = result.reason?.message ?? String(result.reason ?? 'unknown');
    errors.set(message, (errors.get(message) ?? 0) + 1);
  }
  return Object.fromEntries([...errors.entries()].sort((a, b) => b[1] - a[1]));
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
  const questions = quiz.questions.map((question) => {
    const sanitized = { ...question };
    if (sanitized.numericTolerancePercent === null) {
      delete sanitized.numericTolerancePercent;
    }
    return sanitized;
  });
  return {
    historyScopeId: DEMO_QUIZ_HISTORY_SCOPE_ID,
    name: quiz.name,
    description: quiz.description,
    motifImageUrl: quiz.motifImageUrl ?? null,
    showLeaderboard: quiz.showLeaderboard,
    allowCustomNicknames: quiz.allowCustomNicknames,
    defaultTimer: quiz.defaultTimer ?? null,
    timerScaleByDifficulty: quiz.timerScaleByDifficulty ?? true,
    enableSoundEffects: quiz.enableSoundEffects,
    enableRewardEffects: quiz.enableRewardEffects,
    enableMotivationMessages: quiz.enableMotivationMessages,
    enableEmojiReactions: quiz.enableEmojiReactions,
    anonymousMode: quiz.anonymousMode,
    teamMode: quiz.teamMode,
    teamCount: quiz.teamCount ?? null,
    teamAssignment: quiz.teamAssignment ?? 'AUTO',
    teamNames: quiz.teamNames ?? [],
    backgroundMusic: quiz.backgroundMusic ?? null,
    nicknameTheme: quiz.nicknameTheme,
    bonusTokenCount: quiz.bonusTokenCount ?? null,
    readingPhaseEnabled: quiz.readingPhaseEnabled ?? true,
    preset: 'PLAYFUL',
    questions,
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
  for (const answer of question.answers ?? []) {
    const key = normalizeAnswerText(answer.text);
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
  const match = (question.answers ?? []).find((answer) => {
    const text = normalizeAnswerText(answer.text);
    return normalizedNeedles.some((needle) => text.includes(needle) || needle.includes(text));
  });
  return match?.id ?? null;
}

/**
 * Didaktisch ausbalancierte Demo-Votes:
 * - Varianz statt Round-Robin
 * - Fehlkonzept-Hinweise bei Prioritätsfragen (hohe Sicherheit × falsch)
 * - Peer Instruction mit messbarem Lernzuwachs (Runde 1 → 2)
 */
function buildVoteInput(participant, question, metadata, round, participantIndex) {
  const base = {
    sessionId: participant.id,
    participantId: participant.participantId,
    questionId: question.id,
    round,
    responseTimeMs: 1_200 + participantIndex * 37 + round * 180 + (participantIndex % 7) * 90,
  };
  const requiresDebrief = PRIORITY_QUESTION_ORDERS.has(metadata.order);
  const n = PARTICIPANTS;
  let vote;

  switch (question.type) {
    case 'SURVEY':
      if (!question.answers?.length) {
        throw new Error(`Frage ${metadata.order} (SURVEY) hat keine Antwortoptionen.`);
      }
      vote = {
        ...base,
        // Stimmungsbild mit leichter Schiefe, nicht gleichverteilt
        answerIds: [
          question.answers[
            participantIndex % 10 < 4
              ? 0
              : participantIndex % 10 < 7
                ? 1
                : participantIndex % 10 < 9
                  ? 2
                  : Math.min(3, question.answers.length - 1)
          ].id,
        ],
      };
      break;
    case 'SINGLE_CHOICE': {
      if (!question.answers?.length) {
        throw new Error(`Frage ${metadata.order} (SINGLE_CHOICE) hat keine Antwortoptionen.`);
      }
      const { correct, wrong } = answerIdsByCorrectness(question, metadata);
      const correctId = correct[0] ?? question.answers[0].id;
      const wrongId = wrong[0] ?? question.answers[question.answers.length - 1].id;
      const otherWrongId = wrong[1] ?? wrongId;
      let answerId = correctId;
      if (requiresDebrief) {
        // Fehlkonzept Würfel: Mehrheit „22“ (nicht 26), mit natürlicher Varianz (~80 %)
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
        // Code-Sprache: ~25 % richtig → empirisch schwierig
        answerId = participantIndex % 4 === 0 ? correctId : otherWrongId;
      } else {
        answerId = participantIndex % 3 === 0 ? wrongId : correctId;
      }
      vote = { ...base, answerIds: [answerId] };
      break;
    }
    case 'MULTIPLE_CHOICE': {
      if (!question.answers?.length) {
        throw new Error(`Frage ${metadata.order} (MULTIPLE_CHOICE) hat keine Antwortoptionen.`);
      }
      const { correct, wrong } = answerIdsByCorrectness(question, metadata);
      const falseOnly = wrong.length > 0 ? wrong : [question.answers[0].id];
      const vorwissenId = findAnswerIdByText(
        question,
        PRIOR_KNOWLEDGE_NEEDLES_BY_LOCALE[QUIZ_CONTENT_LOCALE] ?? ['vorwissen'],
      );
      const omitVorwissen =
        vorwissenId && correct.includes(vorwissenId)
          ? correct.filter((id) => id !== vorwissenId)
          : correct.slice(1);
      let answerIds;
      if (requiresDebrief) {
        const bucket = participantIndex % 10;
        if (bucket < 6) {
          answerIds = omitVorwissen.length > 0 ? omitVorwissen : falseOnly;
        } else if (bucket < 8) {
          answerIds = falseOnly;
        } else if (bucket === 8 && correct.length > 0) {
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
        // Peer Instruction: Runde 1 oft außerhalb, Runde 2 klarer Lernzuwachs
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
        // π: Mehrheit exakt richtig, wenige Ausreißer
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
      vote = {
        ...base,
        // Leicht positive Schiefe
        ratingValue: participantIndex % 10 < 5 ? 5 : participantIndex % 10 < 8 ? 4 : 3,
      };
      break;
    default:
      throw new Error(`Unbekannter Fragentyp: ${question.type}`);
  }

  if (question.confidenceEnabled) {
    if (requiresDebrief) {
      const bucket = participantIndex % 10;
      vote.confidenceValue = bucket < 8 ? randomConfidenceValue(4, 5) : randomConfidenceValue(1, 3);
    } else if (metadata.numericTwoRounds === true) {
      const inBandShare = Math.round(n * (round === 1 ? 0.3 : 0.82));
      const inBand = participantIndex < inBandShare;
      if (round === 1) {
        vote.confidenceValue = randomConfidenceValue(1, 3);
      } else if (inBand) {
        vote.confidenceValue = randomConfidenceValue(3, 5);
      } else {
        vote.confidenceValue = randomConfidenceValue(1, 2);
      }
    } else if (metadata.order === 1) {
      vote.confidenceValue = randomConfidenceValue(1, 2);
    } else {
      vote.confidenceValue = randomConfidenceValue(1, 3);
    }
  }

  return vote;
}

async function submitVotes(publicTrpc, participants, question, metadata, round) {
  const durations = [];
  const startedAt = performance.now();
  const results = await Promise.allSettled(
    participants.map(async (participant, index) => {
      const requestStartedAt = performance.now();
      try {
        return await publicTrpc.vote.submit.mutate(
          buildVoteInput(participant, question, metadata, round, index),
        );
      } finally {
        durations.push(performance.now() - requestStartedAt);
      }
    }),
  );
  return {
    round,
    accepted: results.filter((result) => result.status === 'fulfilled').length,
    rejected: results.filter((result) => result.status === 'rejected').length,
    totalDurationMs: Math.round(performance.now() - startedAt),
    ...summarizeDurations(durations),
    errors: summarizeErrors(results),
  };
}

async function openQuestionForVoting(hostTrpc, code, statusBefore) {
  const status = await hostTrpc.session.nextQuestion.mutate({ code });
  if (status.status === 'QUESTION_OPEN') {
    await hostTrpc.session.revealAnswers.mutate({ code });
  }
  return { openedAs: status.status, statusAfterOpen: status.status };
}

async function runQuestion({ questionNumber, hostTrpc, publicTrpc, code, participants, meta }) {
  const open = await openQuestionForVoting(hostTrpc, code);
  const question = await publicTrpc.session.getCurrentQuestionForStudent.query({ code });
  if (!question?.id) {
    throw new Error(`Frage ${questionNumber} konnte nicht geladen werden.`);
  }

  const voteRounds = [];
  voteRounds.push(await submitVotes(publicTrpc, participants, question, meta, 1));

  if (meta.numericTwoRounds === true) {
    await hostTrpc.session.startDiscussion.mutate({ code });
    await hostTrpc.session.startSecondRound.mutate({ code });
    await sleep(VOTE_COOLDOWN_MS);
    const questionRound2 = await publicTrpc.session.getCurrentQuestionForStudent.query({ code });
    if (!questionRound2?.id) {
      throw new Error(`Frage ${questionNumber} Runde 2 konnte nicht geladen werden.`);
    }
    voteRounds.push(await submitVotes(publicTrpc, participants, questionRound2, meta, 2));
  }

  const resultsStatus = await hostTrpc.session.revealResults.mutate({ code });
  await sleep(VOTE_COOLDOWN_MS);

  return {
    questionNumber,
    order: meta.order,
    type: meta.type,
    title: meta.title,
    openedAs: open.openedAs,
    resultsStatus: resultsStatus.status,
    voteRounds,
    expectedVotesPerRound: PARTICIPANTS,
  };
}

function questionMetaFromUpload(questions) {
  return questions.map((question, index) => ({
    questionNumber: index + 1,
    order: question.order ?? index,
    type: question.type,
    title: String(question.text ?? '')
      .replace(/[#>*_`]/g, '')
      .split('\n')[0]
      .trim()
      .slice(0, 80),
    numericTwoRounds: question.numericTwoRounds === true,
    skipReadingPhase: question.skipReadingPhase === true,
    numericReferenceValue: question.numericReferenceValue ?? null,
    answers: Array.isArray(question.answers) ? question.answers : [],
  }));
}

function buildSessionFeedbackInput(participant, participantIndex, code) {
  // Leicht entkoppelte, realistische Verteilungen (nicht byte-identisch)
  const overallPool = [3, 3, 4, 4, 4, 5, 5, 5, 5, 2];
  const qualityPool = [4, 4, 4, 5, 5, 5, 3, 3, 5, 4];
  return {
    code,
    participantId: participant.participantId,
    overallRating: overallPool[participantIndex % overallPool.length],
    questionQualityRating: qualityPool[participantIndex % qualityPool.length],
    wouldRepeat: participantIndex % 5 !== 0,
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
  const accepted = settled.filter((result) => result.status === 'fulfilled').length;
  const rejected = settled.filter((result) => result.status === 'rejected').length;
  if (accepted === 0) {
    const message =
      settled.find((result) => result.status === 'rejected')?.reason?.message ?? 'unknown';
    throw new Error(`Session-Feedback: 0/${participants.length} akzeptiert (${message}).`);
  }
  return { accepted, rejected };
}

async function mintHostToken(sessionCode) {
  if (HOST_TOKEN_ENV) {
    return HOST_TOKEN_ENV;
  }

  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);
  const backendDir = join(__dirname, '../../apps/backend');
  const script = `
    import { createHostSessionToken } from './src/lib/hostAuth.ts';
    createHostSessionToken(${JSON.stringify(sessionCode)})
      .then((token) => {
        console.log(token);
        process.exit(0);
      })
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  `;
  const { stdout } = await execFileAsync('npx', ['tsx', '-e', script], {
    cwd: backendDir,
    encoding: 'utf8',
  });
  const token = stdout.trim();
  if (!token) {
    throw new Error(`Host-Token für Session ${sessionCode} konnte nicht erzeugt werden.`);
  }
  return token;
}

async function run() {
  await waitForBackend(TRPC_URL);
  const uploadPayload = await loadDemoQuizUploadPayload();
  const questionMetas = questionMetaFromUpload(uploadPayload.questions);

  if (questionMetas.length !== EXPECTED_QUESTIONS) {
    throw new Error(
      `Demo-Quiz hat ${questionMetas.length} Fragen, erwartet wurden ${EXPECTED_QUESTIONS}.`,
    );
  }

  const publicTrpc = createHttpClient();
  let code;
  let hostToken;
  let quizId;

  if (SESSION_CODE) {
    const info = await publicTrpc.session.getInfo.query({ code: SESSION_CODE });
    if (!info?.id) {
      throw new Error(`Session ${SESSION_CODE} nicht gefunden.`);
    }
    code = SESSION_CODE;
    quizId = info.id;
    hostToken = await mintHostToken(code);
    console.log(`Nutze bestehende Session ${code} (${info.quizName ?? 'Quiz'}).`);
  } else {
    const uploadResult = await publicTrpc.quiz.upload.mutate(uploadPayload);
    quizId = uploadResult.quizId;
    const created = await publicTrpc.session.create.mutate({
      quizId,
      type: 'QUIZ',
      qaEnabled: false,
      quickFeedbackEnabled: false,
    });
    code = created.code;
    hostToken = created.hostToken;
  }

  const hostTrpc = createHttpClient(hostToken);

  const indexes = Array.from({ length: PARTICIPANTS }, (_, index) => index);
  const participants = await mapLimit(indexes, JOIN_CONCURRENCY, async (index) =>
    publicTrpc.session.join.mutate({
      code,
      nickname: kindergartenNickname(index, QUIZ_CONTENT_LOCALE),
    }),
  );

  const questions = [];
  for (const meta of questionMetas) {
    questions.push(
      await runQuestion({
        questionNumber: meta.questionNumber,
        hostTrpc,
        publicTrpc,
        code,
        participants,
        meta,
      }),
    );
  }

  const finished = await hostTrpc.session.nextQuestion.mutate({ code });
  const feedback =
    finished.status === 'FINISHED'
      ? await submitSessionFeedback(publicTrpc, participants, code)
      : { accepted: 0, rejected: PARTICIPANTS };
  const totalVotesAccepted = questions.reduce(
    (sum, question) =>
      sum + question.voteRounds.reduce((roundSum, round) => roundSum + round.accepted, 0),
    0,
  );
  const expectedVotes = questionMetas.reduce(
    (sum, meta) => sum + PARTICIPANTS * (meta.numericTwoRounds ? 2 : 1),
    0,
  );

  const summary = {
    scenario: 'demo-quiz-classroom',
    code,
    quizId,
    participants: PARTICIPANTS,
    questions: questionMetas.length,
    expectedVotes,
    totalVotesAccepted,
    feedbackAccepted: feedback.accepted,
    finishedStatus: finished.status,
    questionResults: questions,
  };

  console.log(JSON.stringify(summary, null, 2));

  const failures = [];
  if (participants.length !== PARTICIPANTS) {
    failures.push(`Join: ${participants.length}/${PARTICIPANTS} Teilnehmende.`);
  }
  if (totalVotesAccepted !== expectedVotes) {
    failures.push(`Votes: ${totalVotesAccepted}/${expectedVotes} akzeptiert.`);
  }
  if (finished.status !== 'FINISHED') {
    failures.push(`Session endete mit Status ${finished.status}, erwartet FINISHED.`);
  }
  if (feedback.accepted !== PARTICIPANTS) {
    failures.push(`Session-Feedback: ${feedback.accepted}/${PARTICIPANTS} akzeptiert.`);
  }
  for (const question of questions) {
    for (const round of question.voteRounds) {
      if (round.accepted !== PARTICIPANTS) {
        failures.push(
          `Frage ${question.questionNumber} Runde ${round.round}: ${round.accepted}/${PARTICIPANTS} Votes.`,
        );
      }
      if (round.p95Ms > VOTE_P95_LIMIT_MS) {
        failures.push(
          `Frage ${question.questionNumber} Runde ${round.round}: Vote-p95 ${round.p95Ms} ms > ${VOTE_P95_LIMIT_MS} ms.`,
        );
      }
    }
  }

  await writeScenarioReport({
    scenario: 'demo-quiz-classroom-30',
    environment: {
      participants: PARTICIPANTS,
      expectedQuestions: EXPECTED_QUESTIONS,
      voteP95LimitMs: VOTE_P95_LIMIT_MS,
    },
    metrics: summary,
    failures,
  });

  if (failures.length > 0) {
    console.error('\nFEHLER');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('\nOK Demo-Quiz-Unterrichtsszenario (30 TN, 9 Fragen) bestanden.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
