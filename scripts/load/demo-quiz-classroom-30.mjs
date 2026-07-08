#!/usr/bin/env node
/**
 * Unterrichts-Szenario: Demo-Quiz mit 30 Teilnehmenden, 9 Fragen, alle abstimmen.
 *
 * Ablauf (entspricht Live-Start des Praxis-Showcase):
 * 1. Host laedt Demo-Quiz hoch und erstellt Session
 * 2. 30 Teilnehmende joinen (Team-Modus, Kindergarten-Nicknames)
 * 3. Host oeffnet nacheinander alle 9 Fragen; TN voten jeweils
 * 4. Frage 8 (Franz. Revolution): zwei Runden (Peer Instruction)
 * 5. Session endet mit FINISHED
 *
 * Run:
 *   npm run load:smoke:demo-classroom-30
 *   PARTICIPANTS=30 TRPC_URL=http://127.0.0.1:3000/trpc node scripts/load/demo-quiz-classroom-30.mjs
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { waitForBackend } from './lib/wait-for-backend.mjs';

let trpcClientModule;
try {
  trpcClientModule = await import('@trpc/client');
} catch {
  trpcClientModule = await import('../../apps/frontend/node_modules/@trpc/client/dist/index.mjs');
}

const { createTRPCProxyClient, httpLink } = trpcClientModule;

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEMO_QUIZ_JSON = join(
  __dirname,
  '../../apps/frontend/src/assets/demo/quiz-demo-showcase.de.json',
);
const DEMO_QUIZ_HISTORY_SCOPE_ID = 'de500000-0000-4000-a000-000000000001';

const TRPC_URL = String(process.env.TRPC_URL || 'http://127.0.0.1:3000/trpc').trim();
const PARTICIPANTS = Math.max(1, Number(process.env.PARTICIPANTS || 30));
const JOIN_CONCURRENCY = Math.max(1, Number(process.env.JOIN_CONCURRENCY || 15));
const EXPECTED_QUESTIONS = Math.max(1, Number(process.env.EXPECTED_QUESTIONS || 9));
/** Backend: max. 1 Vote/s pro Teilnehmer (checkVoteRate). */
const VOTE_COOLDOWN_MS = Math.max(1_000, Number(process.env.VOTE_COOLDOWN_MS || 1_100));

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

function buildVoteInput(participant, question, round, participantIndex) {
  const base = {
    sessionId: participant.id,
    participantId: participant.participantId,
    questionId: question.id,
    round,
  };

  switch (question.type) {
    case 'SURVEY':
    case 'SINGLE_CHOICE':
      if (!question.answers?.length) {
        throw new Error(`Frage ${question.order} (${question.type}) hat keine Antwortoptionen.`);
      }
      return { ...base, answerIds: [question.answers[participantIndex % question.answers.length].id] };
    case 'MULTIPLE_CHOICE': {
      if (!question.answers?.length) {
        throw new Error(`Frage ${question.order} (MULTIPLE_CHOICE) hat keine Antwortoptionen.`);
      }
      const answerIds =
        question.answers.length > 1
          ? question.answers.slice(0, -1).map((answer) => answer.id)
          : [question.answers[0].id];
      return { ...base, answerIds };
    }
    case 'NUMERIC_ESTIMATE':
      return {
        ...base,
        numericValue: question.order === 1 ? 3.14 : 1789 + (participantIndex % 5) - 2,
      };
    case 'SHORT_TEXT':
      return { ...base, freeText: 'Peer Instruction' };
    case 'RATING':
      return { ...base, ratingValue: 3 + (participantIndex % 3) };
    default:
      throw new Error(`Unbekannter Fragentyp: ${question.type}`);
  }
}

async function submitVotes(publicTrpc, participants, question, round) {
  const durations = [];
  const startedAt = performance.now();
  const results = await Promise.allSettled(
    participants.map(async (participant, index) => {
      const requestStartedAt = performance.now();
      try {
        return await publicTrpc.vote.submit.mutate(
          buildVoteInput(participant, question, round, index),
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

async function runQuestion({
  questionNumber,
  hostTrpc,
  publicTrpc,
  code,
  participants,
  meta,
}) {
  const open = await openQuestionForVoting(hostTrpc, code);
  const question = await publicTrpc.session.getCurrentQuestionForStudent.query({ code });
  if (!question?.id) {
    throw new Error(`Frage ${questionNumber} konnte nicht geladen werden.`);
  }

  const voteRounds = [];
  voteRounds.push(await submitVotes(publicTrpc, participants, question, 1));

  if (meta.numericTwoRounds === true) {
    await hostTrpc.session.startDiscussion.mutate({ code });
    await hostTrpc.session.startSecondRound.mutate({ code });
    await sleep(VOTE_COOLDOWN_MS);
    const questionRound2 = await publicTrpc.session.getCurrentQuestionForStudent.query({ code });
    if (!questionRound2?.id) {
      throw new Error(`Frage ${questionNumber} Runde 2 konnte nicht geladen werden.`);
    }
    voteRounds.push(await submitVotes(publicTrpc, participants, questionRound2, 2));
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
  }));
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
  const { quizId } = await publicTrpc.quiz.upload.mutate(uploadPayload);
  const { code, hostToken } = await publicTrpc.session.create.mutate({
    quizId,
    type: 'QUIZ',
    qaEnabled: false,
    quickFeedbackEnabled: false,
  });
  const hostTrpc = createHttpClient(hostToken);

  const indexes = Array.from({ length: PARTICIPANTS }, (_, index) => index);
  const participants = await mapLimit(indexes, JOIN_CONCURRENCY, async (index) =>
    publicTrpc.session.join.mutate({
      code,
      nickname: `Klasse ${String(index + 1).padStart(2, '0')}`,
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
  for (const question of questions) {
    for (const round of question.voteRounds) {
      if (round.accepted !== PARTICIPANTS) {
        failures.push(
          `Frage ${question.questionNumber} Runde ${round.round}: ${round.accepted}/${PARTICIPANTS} Votes.`,
        );
      }
    }
  }

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
