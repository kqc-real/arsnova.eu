#!/usr/bin/env node
/**
 * WebSocket-Reconnect-Welle: 30 TN verbinden, trennen, reconnecten und Status-Fan-out.
 *
 * Ablauf:
 * 1. Host erstellt Quiz-Session (eine Frage, ACTIVE)
 * 2. 30 Teilnehmende joinen per HTTP
 * 3. Jeder TN subscribed auf session.onStatusChanged (eigener WS-Client)
 * 4. Disconnect-Welle: alle WS-Verbindungen schliessen
 * 5. Reconnect-Welle: parallele Neuverbindung + Resubscribe
 * 6. Host gibt Ergebnisse frei (revealResults → RESULTS)
 * 7. Assert: Reconnect p95 und Status-Fan-out nach Reconnect innerhalb Limits
 *
 * Run:
 *   npm run load:smoke:ws-reconnect-wave-classroom-30
 *   TRPC_URL=http://127.0.0.1:3000/trpc WS_URL=ws://127.0.0.1:3001 node scripts/load/ws-reconnect-wave-classroom-30.mjs
 */
import { waitForBackend } from './lib/wait-for-backend.mjs';
import { createHttpTrpc, createPublicWsTrpc } from './lib/trpc-runtime.mjs';
import { writeScenarioReport } from './lib/reporting.mjs';

const TRPC_URL = String(process.env.TRPC_URL || 'http://127.0.0.1:3000/trpc').trim();
const WS_URL = String(process.env.WS_URL || 'ws://127.0.0.1:3001').trim();
const PARTICIPANTS = Math.max(1, Number(process.env.PARTICIPANTS || 30));
const JOIN_CONCURRENCY = Math.max(1, Number(process.env.JOIN_CONCURRENCY || 15));
const WS_CONCURRENCY = Math.max(1, Number(process.env.WS_CONCURRENCY || 15));
const WS_READY_MS = Math.max(100, Number(process.env.WS_READY_MS || 750));
const DISCONNECT_HOLD_MS = Math.max(0, Number(process.env.DISCONNECT_HOLD_MS || 250));
const INITIAL_CONNECT_LIMIT_MS = Math.max(
  500,
  Number(process.env.INITIAL_CONNECT_LIMIT_MS || 5_000),
);
const RECONNECT_P95_LIMIT_MS = Math.max(500, Number(process.env.RECONNECT_P95_LIMIT_MS || 3_000));
const RECONNECT_P95_MIN_STARTED = Math.ceil(PARTICIPANTS * 0.95);
const ALL_RECONNECT_LIMIT_MS = Math.max(
  RECONNECT_P95_LIMIT_MS,
  Number(process.env.ALL_RECONNECT_LIMIT_MS || 10_000),
);
const STATUS_AFTER_RECONNECT_LIMIT_MS = Math.max(
  500,
  Number(process.env.STATUS_AFTER_RECONNECT_LIMIT_MS || 3_000),
);

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
    name: `WS Reconnect Classroom ${Date.now()}`,
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
        text: 'Reconnect-Smoke: Welche Zahl ist gerade?',
        type: 'SINGLE_CHOICE',
        timer: null,
        difficulty: 'EASY',
        order: 0,
        answers: [
          { text: 'Eins', isCorrect: true, order: 0 },
          { text: 'Zwei', isCorrect: false, order: 1 },
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
  const hostTrpc = createHttpTrpc(TRPC_URL, hostToken);
  const opened = await hostTrpc.session.nextQuestion.mutate({ code });
  if (opened.status === 'QUESTION_OPEN') {
    await hostTrpc.session.revealAnswers.mutate({ code });
  }
  return { code, hostToken, hostTrpc };
}

function connectParticipant(code, phase) {
  const state = {
    phase,
    subscription: null,
    wsClient: null,
    started: false,
    connectMs: null,
    statusAfterEventMs: null,
    lastStatus: null,
    errors: 0,
    messages: 0,
    phaseStartedAt: performance.now(),
  };

  const { trpc, wsClient } = createPublicWsTrpc(WS_URL);
  state.wsClient = wsClient;
  state.subscription = trpc.session.onStatusChanged.subscribe(
    { code },
    {
      onStarted() {
        if (!state.started) {
          state.started = true;
          state.connectMs = performance.now() - state.phaseStartedAt;
        }
      },
      onData(data) {
        state.messages += 1;
        state.lastStatus = data?.status ?? null;
        if (state.statusAfterEventMs === null && state.lastStatus === 'RESULTS') {
          state.statusAfterEventMs = performance.now() - state.phaseStartedAt;
        }
      },
      onError() {
        state.errors += 1;
      },
    },
  );

  return state;
}

function disconnectParticipant(state) {
  state.subscription?.unsubscribe();
  state.wsClient?.close();
  state.subscription = null;
  state.wsClient = null;
  state.started = false;
}

async function run() {
  await waitForBackend(TRPC_URL);
  const publicTrpc = createHttpTrpc(TRPC_URL);
  const { code, hostTrpc } = await createClassroomSession(publicTrpc);

  const nicknames = Array.from({ length: PARTICIPANTS }, (_, index) => `Reconnect ${index + 1}`);
  const joinResults = await mapLimit(nicknames, JOIN_CONCURRENCY, async (nickname) =>
    publicTrpc.session.join.mutate({ code, nickname }),
  );
  if (joinResults.length !== PARTICIPANTS) {
    throw new Error(`Join unvollständig: ${joinResults.length}/${PARTICIPANTS}`);
  }

  /** @type {ReturnType<typeof connectParticipant>[]} */
  let clients = Array.from({ length: PARTICIPANTS }, () => connectParticipant(code, 'initial'));

  await sleep(WS_READY_MS);
  await waitForCondition('Initiale WS-Verbindungen', INITIAL_CONNECT_LIMIT_MS, () =>
    clients.every((client) => client.started),
  );

  for (const client of clients) {
    disconnectParticipant(client);
  }
  await sleep(DISCONNECT_HOLD_MS);

  const reconnectWaveStartedAt = performance.now();
  clients = await mapLimit(
    Array.from({ length: PARTICIPANTS }, (_, index) => index),
    WS_CONCURRENCY,
    async () => {
      const client = connectParticipant(code, 'reconnect');
      client.phaseStartedAt = reconnectWaveStartedAt;
      return client;
    },
  );

  await waitForCondition(
    'Reconnect-Welle (p95 onStarted)',
    RECONNECT_P95_LIMIT_MS,
    () => clients.filter((client) => client.started).length >= RECONNECT_P95_MIN_STARTED,
  );

  try {
    await waitForCondition('Reconnect-Welle (alle onStarted)', ALL_RECONNECT_LIMIT_MS, () =>
      clients.every((client) => client.started),
    );
  } catch {
    // Auswertung unten — p95 wird separat geprueft.
  }

  const reconnectConnectMs = clients
    .map((client) => client.connectMs)
    .filter((value) => typeof value === 'number');
  const reconnectP50Ms = Math.round(percentile(reconnectConnectMs, 50));
  const reconnectP95Ms = Math.round(percentile(reconnectConnectMs, 95));
  const reconnectMaxMs = Math.round(Math.max(0, ...reconnectConnectMs));

  const revealStartedAt = performance.now();
  const revealResult = await hostTrpc.session.revealResults.mutate({ code });

  let statusFanoutLatencyMs = null;
  try {
    statusFanoutLatencyMs = await waitForCondition(
      'Status RESULTS nach Reconnect',
      STATUS_AFTER_RECONNECT_LIMIT_MS,
      () => clients.every((client) => client.lastStatus === 'RESULTS'),
    );
  } catch {
    // Auswertung unten
  }

  const participantsWithResults = clients.filter(
    (client) => client.lastStatus === 'RESULTS',
  ).length;
  const reconnectStarted = clients.filter((client) => client.started).length;
  const subscriptionErrors = clients.reduce((sum, client) => sum + client.errors, 0);
  const statusSnapshot = await publicTrpc.session.getInfo.query({ code });

  for (const client of clients) {
    disconnectParticipant(client);
  }

  const summary = {
    scenario: 'ws-reconnect-wave-classroom-30',
    code,
    participants: PARTICIPANTS,
    reconnect: {
      disconnectHoldMs: DISCONNECT_HOLD_MS,
      connectP50Ms: reconnectP50Ms,
      connectP95Ms: reconnectP95Ms,
      connectMaxMs: reconnectMaxMs,
      started: reconnectStarted,
      subscriptionErrors,
    },
    statusFanout: {
      revealStatus: revealResult.status,
      participantsWithResults,
      statusFanoutLatencyMs:
        statusFanoutLatencyMs !== null ? Math.round(statusFanoutLatencyMs) : null,
      statusSnapshot: statusSnapshot?.status ?? null,
      messageCounts: {
        min: Math.min(...clients.map((client) => client.messages)),
        max: Math.max(...clients.map((client) => client.messages)),
      },
    },
  };

  console.log(JSON.stringify(summary, null, 2));

  const failures = [];
  if (reconnectConnectMs.length !== PARTICIPANTS) {
    failures.push(`Reconnect onStarted nur ${reconnectConnectMs.length}/${PARTICIPANTS}.`);
  }
  if (reconnectP95Ms > RECONNECT_P95_LIMIT_MS) {
    failures.push(`Reconnect p95 ${reconnectP95Ms} ms > Limit ${RECONNECT_P95_LIMIT_MS} ms.`);
  }
  if (subscriptionErrors > 0) {
    failures.push(`${subscriptionErrors} Subscription-Fehler nach Reconnect.`);
  }
  if (revealResult.status !== 'RESULTS') {
    failures.push(`revealResults lieferte ${revealResult.status}, erwartet RESULTS.`);
  }
  if (participantsWithResults !== PARTICIPANTS) {
    failures.push(
      `Status RESULTS nur bei ${participantsWithResults}/${PARTICIPANTS} Teilnehmenden.`,
    );
  }
  if ((statusSnapshot?.status ?? null) !== 'RESULTS') {
    failures.push(`Status-Snapshot ist ${statusSnapshot?.status ?? 'null'}, erwartet RESULTS.`);
  }
  if (statusFanoutLatencyMs === null || statusFanoutLatencyMs > STATUS_AFTER_RECONNECT_LIMIT_MS) {
    failures.push(
      `Status-Fan-out nach Reconnect ${statusFanoutLatencyMs === null ? 'fehlt' : Math.round(statusFanoutLatencyMs)} ms, Limit ${STATUS_AFTER_RECONNECT_LIMIT_MS} ms.`,
    );
  }

  await writeScenarioReport({
    scenario: summary.scenario,
    environment: {
      participants: PARTICIPANTS,
      reconnectP95LimitMs: RECONNECT_P95_LIMIT_MS,
      statusAfterReconnectLimitMs: STATUS_AFTER_RECONNECT_LIMIT_MS,
    },
    metrics: summary,
    failures,
  });

  if (failures.length > 0) {
    console.error('\nFEHLER');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('\nOK — Reconnect-Welle bestanden.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
