#!/usr/bin/env node
/**
 * Last-Smoke fuer den Host-Eventpfad nach Vote-Spitzen.
 *
 * Erstellt eine numerische Schaetzfrage, oeffnet Host-Subscriptions fuer
 * Current-Question und Vote-Progress, laesst viele Teilnehmende parallel
 * abstimmen und prueft, dass Votes nicht den vollstaendigen Host-Fragenkanal
 * fluten.
 *
 * Run:
 *   node scripts/load/host-vote-progress-200.mjs
 *   PARTICIPANTS=200 TRPC_URL=http://127.0.0.1:3000/trpc WS_URL=ws://127.0.0.1:3001 node scripts/load/host-vote-progress-200.mjs
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
const PARTICIPANTS = Math.max(1, Number(process.env.PARTICIPANTS || 200));
const PROGRESS_MESSAGE_LIMIT = Math.max(4, Number(process.env.PROGRESS_MESSAGE_LIMIT || 20));
const CURRENT_QUESTION_MESSAGE_LIMIT = Math.max(
  1,
  Number(process.env.CURRENT_QUESTION_MESSAGE_LIMIT || 2),
);

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

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

async function createNumericEstimateSession(publicTrpc) {
  const { quizId } = await publicTrpc.quiz.upload.mutate({
    name: `Load Smoke Vote Progress ${Date.now()}`,
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
      {
        text: 'In welchem Jahr begann die Franzoesische Revolution?',
        type: 'NUMERIC_ESTIMATE',
        timer: null,
        difficulty: 'MEDIUM',
        order: 0,
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
  await hostTrpc.session.nextQuestion.mutate({ code });
  const question = await publicTrpc.session.getCurrentQuestionForStudent.query({ code });
  if (!question?.id) {
    throw new Error('Aktuelle Frage konnte nicht geladen werden.');
  }
  return { code, hostToken, hostTrpc, questionId: question.id };
}

async function joinParticipants(publicTrpc, code) {
  const joined = [];
  for (let index = 0; index < PARTICIPANTS; index += 1) {
    joined.push(
      await publicTrpc.session.join.mutate({
        code,
        nickname: `Load ${String(index + 1).padStart(3, '0')}`,
      }),
    );
  }
  return joined;
}

async function voteSpike(publicTrpc, joined, questionId) {
  const responseTimes = [];
  const startedAt = performance.now();
  const results = await Promise.allSettled(
    joined.map(async (participant, index) => {
      const requestStartedAt = performance.now();
      await publicTrpc.vote.submit.mutate({
        sessionId: participant.id,
        participantId: participant.participantId,
        questionId,
        numericValue: 1700 + (index % 201),
        round: 1,
        responseTimeMs: 400 + (index % 50),
      });
      responseTimes.push(performance.now() - requestStartedAt);
    }),
  );
  const failed = results.filter((result) => result.status === 'rejected');
  return {
    durationMs: performance.now() - startedAt,
    failed,
    p50Ms: percentile(responseTimes, 50),
    p95Ms: percentile(responseTimes, 95),
    maxMs: Math.max(0, ...responseTimes),
  };
}

async function run() {
  await waitForBackend(TRPC_URL, { attempts: 30 });
  const publicTrpc = createHttpClient();
  const { code, hostToken, hostTrpc, questionId } =
    await createNumericEstimateSession(publicTrpc);
  const { trpc: hostWsTrpc, wsClient } = createHostWsClient(hostToken);

  let currentQuestionMessages = 0;
  let currentQuestionVoteBearingMessages = 0;
  let progressMessages = 0;
  let progressMaxTotalVotes = 0;
  let subscriptionErrors = 0;

  const currentQuestionSub = hostWsTrpc.session.onCurrentQuestionForHostChanged.subscribe(
    { code },
    {
      onData(data) {
        currentQuestionMessages += 1;
        if ((data?.totalVotes ?? 0) > 0) {
          currentQuestionVoteBearingMessages += 1;
        }
      },
      onError(error) {
        subscriptionErrors += 1;
        console.error('current-question subscription error:', error?.message ?? error);
      },
    },
  );

  const progressSub = hostWsTrpc.session.onHostVoteProgressChanged.subscribe(
    { code },
    {
      onData(data) {
        progressMessages += 1;
        progressMaxTotalVotes = Math.max(progressMaxTotalVotes, data?.totalVotes ?? 0);
      },
      onError(error) {
        subscriptionErrors += 1;
        console.error('vote-progress subscription error:', error?.message ?? error);
      },
    },
  );

  await new Promise((resolve) => setTimeout(resolve, 750));
  const joined = await joinParticipants(publicTrpc, code);
  const spike = await voteSpike(publicTrpc, joined, questionId);
  await new Promise((resolve) => setTimeout(resolve, 2_000));

  currentQuestionSub.unsubscribe();
  progressSub.unsubscribe();
  wsClient.close();

  const progressSnapshot = await hostTrpc.session.getHostVoteProgress.query({ code });
  const currentQuestionSnapshot = await hostTrpc.session.getCurrentQuestionForHost.query({ code });

  const summary = {
    code,
    participants: PARTICIPANTS,
    voteSpikeDurationMs: Math.round(spike.durationMs),
    voteSubmitP50Ms: Math.round(spike.p50Ms),
    voteSubmitP95Ms: Math.round(spike.p95Ms),
    voteSubmitMaxMs: Math.round(spike.maxMs),
    failedVotes: spike.failed.length,
    subscriptionErrors,
    currentQuestionMessages,
    currentQuestionVoteBearingMessages,
    progressMessages,
    progressMaxTotalVotes,
    progressSnapshotTotalVotes: progressSnapshot?.totalVotes ?? null,
    currentQuestionSnapshotTotalVotes: currentQuestionSnapshot?.totalVotes ?? null,
  };

  console.log(JSON.stringify(summary, null, 2));

  const failures = [];
  if (spike.failed.length > 0) {
    failures.push(`${spike.failed.length} Vote-Requests sind fehlgeschlagen.`);
  }
  if (subscriptionErrors > 0) {
    failures.push(`${subscriptionErrors} Subscription-Fehler.`);
  }
  if ((progressSnapshot?.totalVotes ?? 0) !== PARTICIPANTS) {
    failures.push(`Progress-Snapshot meldet nicht ${PARTICIPANTS} Votes.`);
  }
  if ((currentQuestionSnapshot?.totalVotes ?? 0) !== PARTICIPANTS) {
    failures.push(`Current-Question-Snapshot meldet nicht ${PARTICIPANTS} Votes.`);
  }
  if (currentQuestionVoteBearingMessages > 0) {
    failures.push(
      `Current-Question-Subscription hat ${currentQuestionVoteBearingMessages} Vote-Updates geliefert.`,
    );
  }
  if (currentQuestionMessages > CURRENT_QUESTION_MESSAGE_LIMIT) {
    failures.push(
      `Current-Question-Subscription lieferte ${currentQuestionMessages} Messages, Limit ${CURRENT_QUESTION_MESSAGE_LIMIT}.`,
    );
  }
  if (progressMessages > PROGRESS_MESSAGE_LIMIT) {
    failures.push(
      `Vote-Progress-Subscription lieferte ${progressMessages} Messages, Limit ${PROGRESS_MESSAGE_LIMIT}.`,
    );
  }
  if (progressMaxTotalVotes !== PARTICIPANTS) {
    failures.push(`Vote-Progress-Subscription erreichte nur ${progressMaxTotalVotes} Votes.`);
  }

  if (failures.length > 0) {
    console.error('\nFEHLER');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('\nOK Host-Vote-Progress-Last-Smoke bestanden.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
