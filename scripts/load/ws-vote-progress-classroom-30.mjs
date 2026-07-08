#!/usr/bin/env node
/**
 * WebSocket-E2E-Smoke: 30 TN voten per HTTP, Host empfaengt Vote-Progress und Status per WS.
 *
 * Ablauf:
 * 1. Host erstellt Quiz-Session mit einer SINGLE_CHOICE-Frage
 * 2. Host subscribed auf onHostVoteProgressChanged und onStatusChanged (WebSocket)
 * 3. 30 Teilnehmende joinen und stimmen parallel ab
 * 4. Host gibt Ergebnisse frei (revealResults)
 * 5. Assert: WS-Progress erreicht 30 Votes, Status wechselt auf RESULTS
 *
 * Run:
 *   npm run load:smoke:ws-vote-progress-classroom-30
 *   TRPC_URL=http://127.0.0.1:3000/trpc WS_URL=ws://127.0.0.1:3001 node scripts/load/ws-vote-progress-classroom-30.mjs
 */
import { waitForBackend } from './lib/wait-for-backend.mjs';

let trpcClientModule;
try {
  trpcClientModule = await import('@trpc/client');
} catch {
  trpcClientModule = await import('../../apps/frontend/node_modules/@trpc/client/dist/index.mjs');
}

let wsModule;
try {
  wsModule = await import('ws');
} catch {
  wsModule = await import('../../apps/frontend/node_modules/ws/wrapper.mjs');
}

const { createTRPCProxyClient, createWSClient, httpBatchLink, wsLink } = trpcClientModule;
const WebSocketPonyfill = globalThis.WebSocket ?? wsModule.WebSocket ?? wsModule.default;
if (!globalThis.WebSocket && WebSocketPonyfill) {
  globalThis.WebSocket = WebSocketPonyfill;
}

const TRPC_URL = String(process.env.TRPC_URL || 'http://127.0.0.1:3000/trpc').trim();
const WS_URL = String(process.env.WS_URL || 'ws://127.0.0.1:3001').trim();
const PARTICIPANTS = Math.max(1, Number(process.env.PARTICIPANTS || 30));
const JOIN_CONCURRENCY = Math.max(1, Number(process.env.JOIN_CONCURRENCY || 15));
const PROGRESS_P95_LIMIT_MS = Math.max(500, Number(process.env.PROGRESS_P95_LIMIT_MS || 2_000));
const STATUS_AFTER_REVEAL_LIMIT_MS = Math.max(500, Number(process.env.STATUS_AFTER_REVEAL_LIMIT_MS || 3_000));
const WS_READY_MS = Math.max(100, Number(process.env.WS_READY_MS || 750));

function createHttpClient(hostToken) {
  return createTRPCProxyClient({
    links: [
      httpBatchLink({
        url: TRPC_URL,
        headers: hostToken ? () => ({ 'x-host-token': hostToken }) : undefined,
      }),
    ],
  });
}

function createHostWsClient(hostToken) {
  const wsClient = createWSClient({
    url: WS_URL,
    connectionParams: () => ({ 'x-host-token': hostToken }),
    lazy: { enabled: false, closeMs: 0 },
    retryDelayMs: () => 1_000,
  });
  const trpc = createTRPCProxyClient({
    links: [wsLink({ client: wsClient })],
  });
  return { trpc, wsClient };
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

async function waitForCondition(label, timeoutMs, predicate) {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return performance.now() - startedAt;
    }
    await sleep(50);
  }
  throw new Error(`${label} nicht innerhalb von ${timeoutMs} ms erreicht.`);
}

async function createClassroomSession(publicTrpc) {
  const { quizId } = await publicTrpc.quiz.upload.mutate({
    name: `WS Vote Progress Classroom ${Date.now()}`,
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
    nicknameTheme: 'KINDERGARTEN',
    bonusTokenCount: 1,
    readingPhaseEnabled: false,
    preset: 'SERIOUS',
    questions: [
      {
        text: 'Welche Farbe hat der Himmel bei klarem Wetter?',
        type: 'SINGLE_CHOICE',
        timer: null,
        difficulty: 'EASY',
        order: 0,
        answers: [
          { text: 'Blau', isCorrect: true, order: 0 },
          { text: 'Gruen', isCorrect: false, order: 1 },
          { text: 'Rot', isCorrect: false, order: 2 },
        ],
      },
    ],
  });

  const { code, hostToken } = await publicTrpc.session.create.mutate({
    quizId,
    type: 'QUIZ',
    qaEnabled: false,
    quickFeedbackEnabled: false,
  });
  const hostTrpc = createHttpClient(hostToken);
  const opened = await hostTrpc.session.nextQuestion.mutate({ code });
  if (opened.status === 'QUESTION_OPEN') {
    await hostTrpc.session.revealAnswers.mutate({ code });
  }
  const question = await publicTrpc.session.getCurrentQuestionForStudent.query({ code });
  if (!question?.id || !question.answers?.length) {
    throw new Error('Aktuelle Frage konnte nicht geladen werden.');
  }
  return {
    code,
    hostToken,
    hostTrpc,
    questionId: question.id,
    answerId: question.answers[0].id,
  };
}

async function joinParticipants(publicTrpc, code) {
  const nicknames = Array.from({ length: PARTICIPANTS }, (_, index) => `TN ${index + 1}`);
  return mapLimit(nicknames, JOIN_CONCURRENCY, async (nickname) =>
    publicTrpc.session.join.mutate({ code, nickname }),
  );
}

async function voteSpike(publicTrpc, joined, questionId, answerId) {
  const responseTimes = [];
  const startedAt = performance.now();
  const results = await Promise.allSettled(
    joined.map(async (participant, index) => {
      const requestStartedAt = performance.now();
      await publicTrpc.vote.submit.mutate({
        sessionId: participant.id,
        participantId: participant.participantId,
        questionId,
        answerIds: [answerId],
        round: 1,
        responseTimeMs: 300 + (index % 40),
      });
      responseTimes.push(performance.now() - requestStartedAt);
    }),
  );
  return {
    durationMs: performance.now() - startedAt,
    failed: results.filter((result) => result.status === 'rejected'),
    p50Ms: percentile(responseTimes, 50),
    p95Ms: percentile(responseTimes, 95),
    maxMs: Math.max(0, ...responseTimes),
  };
}

async function run() {
  await waitForBackend(TRPC_URL);
  const publicTrpc = createHttpClient();
  const { code, hostToken, hostTrpc, questionId, answerId } =
    await createClassroomSession(publicTrpc);
  const { trpc: hostWsTrpc, wsClient } = createHostWsClient(hostToken);

  let progressMaxTotalVotes = 0;
  let progressMessages = 0;
  let statusMessages = 0;
  let lastStatus = null;
  let subscriptionErrors = 0;
  let progressCompleteAt = null;
  let resultsStatusAt = null;

  const progressSub = hostWsTrpc.session.onHostVoteProgressChanged.subscribe(
    { code },
    {
      onData(data) {
        progressMessages += 1;
        const totalVotes = data?.totalVotes ?? 0;
        progressMaxTotalVotes = Math.max(progressMaxTotalVotes, totalVotes);
        if (totalVotes >= PARTICIPANTS && progressCompleteAt === null) {
          progressCompleteAt = performance.now();
        }
      },
      onError(error) {
        subscriptionErrors += 1;
        console.error('vote-progress subscription error:', error?.message ?? error);
      },
    },
  );

  const statusSub = hostWsTrpc.session.onStatusChanged.subscribe(
    { code },
    {
      onData(data) {
        statusMessages += 1;
        lastStatus = data?.status ?? null;
        if (data?.status === 'RESULTS' && resultsStatusAt === null) {
          resultsStatusAt = performance.now();
        }
      },
      onError(error) {
        subscriptionErrors += 1;
        console.error('status subscription error:', error?.message ?? error);
      },
    },
  );

  await sleep(WS_READY_MS);
  const joined = await joinParticipants(publicTrpc, code);
  const voteStartedAt = performance.now();
  const spike = await voteSpike(publicTrpc, joined, questionId, answerId);
  const voteEndedAt = performance.now();

  let progressLatencyMs = null;
  try {
    progressLatencyMs = await waitForCondition(
      `Vote-Progress (${PARTICIPANTS} Votes)`,
      PROGRESS_P95_LIMIT_MS,
      () => progressMaxTotalVotes >= PARTICIPANTS,
    );
  } catch (error) {
  }

  const progressSnapshot = await hostTrpc.session.getHostVoteProgress.query({ code });

  const revealStartedAt = performance.now();
  const revealResult = await hostTrpc.session.revealResults.mutate({ code });

  let statusLatencyMs = null;
  try {
    statusLatencyMs = await waitForCondition(
      'Status RESULTS',
      STATUS_AFTER_REVEAL_LIMIT_MS,
      () => lastStatus === 'RESULTS',
    );
  } catch (error) {
  }

  progressSub.unsubscribe();
  statusSub.unsubscribe();
  wsClient.close();

  const statusSnapshot = await publicTrpc.session.getInfo.query({ code });

  const summary = {
    scenario: 'ws-vote-progress-classroom-30',
    code,
    participants: PARTICIPANTS,
    voteSpike: {
      durationMs: Math.round(spike.durationMs),
      p50Ms: Math.round(spike.p50Ms),
      p95Ms: Math.round(spike.p95Ms),
      maxMs: Math.round(spike.maxMs),
      failed: spike.failed.length,
    },
    websocket: {
      subscriptionErrors,
      progressMessages,
      progressMaxTotalVotes,
      progressLatencyMs:
        progressLatencyMs !== null
          ? Math.round(progressLatencyMs)
          : progressCompleteAt !== null
            ? Math.round(progressCompleteAt - voteEndedAt)
            : null,
      statusMessages,
      lastStatus,
      statusLatencyMs:
        statusLatencyMs !== null
          ? Math.round(statusLatencyMs)
          : resultsStatusAt !== null
            ? Math.round(resultsStatusAt - revealStartedAt)
            : null,
    },
    http: {
      revealStatus: revealResult.status,
      progressSnapshotTotalVotes: progressSnapshot?.totalVotes ?? null,
      statusSnapshot: statusSnapshot?.status ?? null,
    },
    timings: {
      voteWindowMs: Math.round(voteEndedAt - voteStartedAt),
      revealToSnapshotMs: Math.round(performance.now() - revealStartedAt),
    },
  };

  console.log(JSON.stringify(summary, null, 2));

  const failures = [];
  if (joined.length !== PARTICIPANTS) {
    failures.push(`Join: ${joined.length}/${PARTICIPANTS}`);
  }
  if (spike.failed.length > 0) {
    failures.push(`${spike.failed.length} Vote-Requests sind fehlgeschlagen.`);
  }
  if (subscriptionErrors > 0) {
    failures.push(`${subscriptionErrors} Subscription-Fehler.`);
  }
  if (progressMaxTotalVotes !== PARTICIPANTS) {
    failures.push(`WS Vote-Progress erreichte nur ${progressMaxTotalVotes}/${PARTICIPANTS}.`);
  }
  if ((progressSnapshot?.totalVotes ?? 0) !== PARTICIPANTS) {
    failures.push(`Progress-Snapshot meldet ${progressSnapshot?.totalVotes ?? 0}/${PARTICIPANTS}.`);
  }
  if (revealResult.status !== 'RESULTS') {
    failures.push(`revealResults lieferte Status ${revealResult.status}, erwartet RESULTS.`);
  }
  if (lastStatus !== 'RESULTS') {
    failures.push(`WS-Status blieb bei ${lastStatus ?? 'null'}, erwartet RESULTS.`);
  }
  if ((statusSnapshot?.status ?? null) !== 'RESULTS') {
    failures.push(`Status-Snapshot ist ${statusSnapshot?.status ?? 'null'}, erwartet RESULTS.`);
  }
  const effectiveProgressLatency =
    progressLatencyMs ??
    (progressCompleteAt !== null ? progressCompleteAt - voteEndedAt : null);
  if (effectiveProgressLatency === null || effectiveProgressLatency > PROGRESS_P95_LIMIT_MS) {
    failures.push(
      `Vote-Progress-Latenz ${effectiveProgressLatency === null ? 'fehlt' : Math.round(effectiveProgressLatency)} ms, Limit ${PROGRESS_P95_LIMIT_MS} ms.`,
    );
  }
  const effectiveStatusLatency =
    statusLatencyMs ?? (resultsStatusAt !== null ? resultsStatusAt - revealStartedAt : null);
  if (effectiveStatusLatency === null || effectiveStatusLatency > STATUS_AFTER_REVEAL_LIMIT_MS) {
    failures.push(
      `Status-RESULTS-Latenz ${effectiveStatusLatency === null ? 'fehlt' : Math.round(effectiveStatusLatency)} ms, Limit ${STATUS_AFTER_REVEAL_LIMIT_MS} ms.`,
    );
  }

  if (failures.length > 0) {
    console.error('\nFEHLER');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('\nOK WebSocket-Vote-Progress-Unterrichtsszenario (30 TN) bestanden.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
