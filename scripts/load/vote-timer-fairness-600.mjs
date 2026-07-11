#!/usr/bin/env node
/**
 * Last-Smoke fuer Timer-Fairness im Vote-Pfad.
 *
 * Prueft mit vielen Teilnehmenden:
 * 1. ACTIVE: Votes vor Timerende werden akzeptiert.
 * 2. RESULTS innerhalb Karenz: Votes werden noch akzeptiert, wenn der Host erst
 *    nach Timerende Ergebnisse freigibt und Requests innerhalb der Backend-Karenz ankommen.
 * 3. RESULTS ausserhalb Karenz: Votes werden abgewiesen.
 *
 * Run:
 *   node scripts/load/vote-timer-fairness-600.mjs
 *   PARTICIPANTS=600 TIMER_SECONDS=8 TRPC_URL=http://127.0.0.1:3000/trpc node scripts/load/vote-timer-fairness-600.mjs
 */
import { waitForBackend } from './lib/wait-for-backend.mjs';
import { writeScenarioReport } from './lib/reporting.mjs';

let trpcClientModule;
try {
  trpcClientModule = await import('@trpc/client');
} catch {
  trpcClientModule = await import('../../apps/frontend/node_modules/@trpc/client/dist/index.mjs');
}

const { createTRPCProxyClient, httpLink } = trpcClientModule;

const TRPC_URL = String(process.env.TRPC_URL || 'http://127.0.0.1:3000/trpc').trim();
const PARTICIPANTS = Math.max(1, Number(process.env.PARTICIPANTS || 600));
const TIMER_SECONDS = Math.max(2, Number(process.env.TIMER_SECONDS || 8));
const JOIN_CONCURRENCY = Math.max(1, Number(process.env.JOIN_CONCURRENCY || 60));
const VOTE_P95_LIMIT_MS = Math.max(100, Number(process.env.VOTE_P95_LIMIT_MS || 1_000));
const GRACE_MS = Math.max(0, Number(process.env.GRACE_MS || 2_000));
const WITHIN_GRACE_REVEAL_OFFSET_MS = Math.max(
  0,
  Number(process.env.WITHIN_GRACE_REVEAL_OFFSET_MS || 100),
);
const OUTSIDE_GRACE_REVEAL_OFFSET_MS = Math.max(
  GRACE_MS + 1,
  Number(process.env.OUTSIDE_GRACE_REVEAL_OFFSET_MS || GRACE_MS + 300),
);
const SETTLE_AFTER_VOTES_MS = Math.max(0, Number(process.env.SETTLE_AFTER_VOTES_MS || 500));

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

async function waitUntil(targetMs) {
  const remaining = targetMs - Date.now();
  if (remaining > 0) {
    await sleep(remaining);
  }
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

function buildQuestion(order, label) {
  return {
    text: `${label}: In welchem Jahr begann die Franzoesische Revolution?`,
    type: 'NUMERIC_ESTIMATE',
    timer: TIMER_SECONDS,
    difficulty: 'MEDIUM',
    order,
    answers: [],
    numericToleranceMode: 'ABSOLUTE_INTERVAL',
    numericReferenceValue: 1789,
    numericIntervalLeft: 1700,
    numericIntervalRight: 1900,
    numericInputType: 'INTEGER',
    numericDecimalPlaces: 0,
    numericMin: 1500,
    numericMax: 2000,
    numericTwoRounds: false,
  };
}

async function createSession(publicTrpc) {
  const { quizId } = await publicTrpc.quiz.upload.mutate({
    name: `Load Smoke Timer Fairness ${Date.now()}`,
    description: undefined,
    motifImageUrl: null,
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
    nicknameTheme: 'NOBEL_LAUREATES',
    bonusTokenCount: 1,
    readingPhaseEnabled: false,
    preset: 'SERIOUS',
    questions: [
      buildQuestion(0, 'ACTIVE'),
      buildQuestion(1, 'RESULTS innerhalb Karenz'),
      buildQuestion(2, 'RESULTS ausserhalb Karenz'),
    ],
  });

  const { code, hostToken } = await publicTrpc.session.create.mutate({
    quizId,
    type: 'QUIZ',
    qaEnabled: false,
    quickFeedbackEnabled: false,
  });

  return { code, hostToken };
}

async function joinParticipants(publicTrpc, code) {
  const indexes = Array.from({ length: PARTICIPANTS }, (_, index) => index);
  return mapLimit(indexes, JOIN_CONCURRENCY, async (index) =>
    publicTrpc.session.join.mutate({
      code,
      nickname: `Load ${String(index + 1).padStart(4, '0')}`,
    }),
  );
}

async function startNextQuestion(hostTrpc, publicTrpc, code) {
  const status = await hostTrpc.session.nextQuestion.mutate({ code });
  const question = await publicTrpc.session.getCurrentQuestionForStudent.query({ code });
  if (!status.activeAt || !question?.id) {
    throw new Error(`Frage wurde nicht aktiv gestartet: ${JSON.stringify(status)}`);
  }
  return {
    activeAtMs: new Date(status.activeAt).getTime(),
    timerMs: (status.timer ?? TIMER_SECONDS) * 1_000,
    questionId: question.id,
  };
}

async function submitVotes(publicTrpc, participants, questionId) {
  const durations = [];
  const startedAt = performance.now();
  const results = await Promise.allSettled(
    participants.map(async (participant, index) => {
      const requestStartedAt = performance.now();
      try {
        return await publicTrpc.vote.submit.mutate({
          sessionId: participant.id,
          participantId: participant.participantId,
          questionId,
          numericValue: 1789 + (index % 3) - 1,
          round: 1,
        });
      } finally {
        durations.push(performance.now() - requestStartedAt);
      }
    }),
  );
  const accepted = results.filter((result) => result.status === 'fulfilled').length;
  const rejected = results.length - accepted;
  return {
    accepted,
    rejected,
    totalDurationMs: Math.round(performance.now() - startedAt),
    ...summarizeDurations(durations),
    errors: summarizeErrors(results),
  };
}

async function measureProgress(hostTrpc, code) {
  const startedAt = performance.now();
  const progress = await hostTrpc.session.getHostVoteProgress.query({ code });
  return {
    totalVotes: progress?.totalVotes ?? null,
    queryMs: Math.round(performance.now() - startedAt),
  };
}

async function measureHostQuestion(hostTrpc, code) {
  const startedAt = performance.now();
  const question = await hostTrpc.session.getCurrentQuestionForHost.query({ code });
  return {
    totalVotes: question?.totalVotes ?? null,
    queryMs: Math.round(performance.now() - startedAt),
  };
}

async function runScenario({ name, hostTrpc, publicTrpc, code, participants, mode }) {
  const question = await startNextQuestion(hostTrpc, publicTrpc, code);
  const deadlineMs = question.activeAtMs + question.timerMs;

  if (mode === 'within-grace') {
    await waitUntil(deadlineMs + WITHIN_GRACE_REVEAL_OFFSET_MS);
    await hostTrpc.session.revealResults.mutate({ code });
  } else if (mode === 'outside-grace') {
    await waitUntil(deadlineMs + OUTSIDE_GRACE_REVEAL_OFFSET_MS);
    await hostTrpc.session.revealResults.mutate({ code });
  }

  const voteWindowStartedIso = new Date().toISOString();
  const votes = await submitVotes(publicTrpc, participants, question.questionId);
  await sleep(SETTLE_AFTER_VOTES_MS);
  const snapshot =
    mode === 'active'
      ? await measureProgress(hostTrpc, code)
      : await measureHostQuestion(hostTrpc, code);

  if (mode === 'active') {
    await hostTrpc.session.revealResults.mutate({ code });
  }

  return {
    name,
    mode,
    deadlineIso: new Date(deadlineMs).toISOString(),
    voteWindowStartedIso,
    votes,
    snapshot,
  };
}

async function run() {
  await waitForBackend(TRPC_URL);
  const publicTrpc = createHttpClient();
  const { code, hostToken } = await createSession(publicTrpc);
  const hostTrpc = createHttpClient(hostToken);
  const participants = await joinParticipants(publicTrpc, code);

  const scenarios = [];
  scenarios.push(
    await runScenario({
      name: 'ACTIVE vor Timerende',
      mode: 'active',
      hostTrpc,
      publicTrpc,
      code,
      participants,
    }),
  );
  scenarios.push(
    await runScenario({
      name: 'RESULTS innerhalb Backend-Karenz',
      mode: 'within-grace',
      hostTrpc,
      publicTrpc,
      code,
      participants,
    }),
  );
  scenarios.push(
    await runScenario({
      name: 'RESULTS ausserhalb Backend-Karenz',
      mode: 'outside-grace',
      hostTrpc,
      publicTrpc,
      code,
      participants,
    }),
  );

  const summary = {
    code,
    participants: PARTICIPANTS,
    timerSeconds: TIMER_SECONDS,
    graceMs: GRACE_MS,
    withinGraceRevealOffsetMs: WITHIN_GRACE_REVEAL_OFFSET_MS,
    outsideGraceRevealOffsetMs: OUTSIDE_GRACE_REVEAL_OFFSET_MS,
    scenarios,
  };

  console.log(JSON.stringify(summary, null, 2));

  const failures = [];
  const active = scenarios.find((scenario) => scenario.mode === 'active');
  const withinGrace = scenarios.find((scenario) => scenario.mode === 'within-grace');
  const outsideGrace = scenarios.find((scenario) => scenario.mode === 'outside-grace');

  if (active?.votes.accepted !== PARTICIPANTS) {
    failures.push(`ACTIVE akzeptierte ${active?.votes.accepted ?? 0}/${PARTICIPANTS} Votes.`);
  }
  if ((active?.votes.p95Ms ?? Number.POSITIVE_INFINITY) > VOTE_P95_LIMIT_MS) {
    failures.push(
      `ACTIVE Vote-p95 ${active?.votes.p95Ms ?? 'fehlt'} ms > ${VOTE_P95_LIMIT_MS} ms.`,
    );
  }
  if (active?.snapshot.totalVotes !== PARTICIPANTS) {
    failures.push(`ACTIVE-Progress meldete ${active?.snapshot.totalVotes ?? 'null'} Votes.`);
  }
  if (withinGrace?.votes.accepted !== PARTICIPANTS) {
    failures.push(`Karenz akzeptierte ${withinGrace?.votes.accepted ?? 0}/${PARTICIPANTS} Votes.`);
  }
  if ((withinGrace?.votes.p95Ms ?? Number.POSITIVE_INFINITY) > VOTE_P95_LIMIT_MS) {
    failures.push(
      `Karenz Vote-p95 ${withinGrace?.votes.p95Ms ?? 'fehlt'} ms > ${VOTE_P95_LIMIT_MS} ms.`,
    );
  }
  if (withinGrace?.snapshot.totalVotes !== PARTICIPANTS) {
    failures.push(
      `Karenz-Host-Snapshot meldete ${withinGrace?.snapshot.totalVotes ?? 'null'} Votes.`,
    );
  }
  if (outsideGrace?.votes.rejected !== PARTICIPANTS) {
    failures.push(
      `Ausserhalb Karenz wurden ${outsideGrace?.votes.accepted ?? 0}/${PARTICIPANTS} Votes akzeptiert.`,
    );
  }
  if (outsideGrace?.snapshot.totalVotes !== 0) {
    failures.push(
      `Ausserhalb-Karenz-Host-Snapshot meldete ${outsideGrace?.snapshot.totalVotes ?? 'null'} Votes.`,
    );
  }

  await writeScenarioReport({
    scenario: 'vote-timer-fairness-600',
    environment: {
      participants: PARTICIPANTS,
      timerSeconds: TIMER_SECONDS,
      graceMs: GRACE_MS,
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

  console.log('\nOK Vote-Timer-Fairness-Last-Smoke bestanden.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
