#!/usr/bin/env node
/**
 * WebSocket-Fan-out-Smoke fuer die in der Anwendung genutzten Q&A- und
 * Blitzlicht-Subscriptions: 30 Teilnehmer-Clients plus ein Host-Client.
 *
 * Run:
 *   node scripts/load/channel-ws-fanout-classroom-30.mjs
 *   PARTICIPANTS=30 TRPC_URL=http://127.0.0.1:3000/trpc \
 *     WS_URL=ws://127.0.0.1:3001 node scripts/load/channel-ws-fanout-classroom-30.mjs
 */
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { waitForBackend } from './lib/wait-for-backend.mjs';
import { createHostWsTrpc, createHttpTrpc, createPublicWsTrpc } from './lib/trpc-runtime.mjs';
import { writeScenarioReport } from './lib/reporting.mjs';

function positiveInteger(name, fallback) {
  const raw = process.env[name];
  const value = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} muss eine positive ganze Zahl sein (erhalten: ${raw}).`);
  }
  return value;
}

const TRPC_URL = String(process.env.TRPC_URL || 'http://127.0.0.1:3000/trpc').trim();
const WS_URL = String(process.env.WS_URL || 'ws://127.0.0.1:3001').trim();
const PARTICIPANTS = positiveInteger('PARTICIPANTS', 30);
const QA_FANOUT_LIMIT_MS = positiveInteger('QA_FANOUT_LIMIT_MS', 3_000);
const BLITZ_FANOUT_LIMIT_MS = positiveInteger('BLITZ_FANOUT_LIMIT_MS', 2_000);
const REPORT_FILE = resolve(
  String(
    process.env.REPORT_FILE ||
      `${tmpdir()}/arsnova-channel-ws-fanout-classroom-30-${Date.now()}.json`,
  ).trim(),
);
const SUBSCRIPTION_READY_LIMIT_MS = 5_000;
const POLL_INTERVAL_MS = 25;
const TEMPO_VALUES = ['SPEED_UP', 'FOLLOWING', 'SLOW_DOWN', 'LOST'];

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function percentile(values, percentileValue) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[index] ?? null;
}

function timingSummary(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  return {
    samples: finite.length,
    p50Ms: roundOrNull(percentile(finite, 50)),
    p95Ms: roundOrNull(percentile(finite, 95)),
    maxMs: finite.length > 0 ? Math.round(Math.max(...finite)) : null,
  };
}

function roundOrNull(value) {
  return Number.isFinite(value) ? Math.round(value) : null;
}

async function waitFor(predicate, timeoutMs) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() <= deadline) {
    if (predicate()) return true;
    await sleep(POLL_INTERVAL_MS);
  }
  return predicate();
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

function expectedTempoDistribution() {
  const distribution = Object.fromEntries(TEMPO_VALUES.map((value) => [value, 0]));
  for (let index = 0; index < PARTICIPANTS; index += 1) {
    distribution[TEMPO_VALUES[index % TEMPO_VALUES.length]] += 1;
  }
  return distribution;
}

function distributionMatches(actual, expected) {
  return TEMPO_VALUES.every((value) => (actual?.[value] ?? 0) === expected[value]);
}

function questionSetMatches(payload, expectedIds) {
  if (!Array.isArray(payload) || payload.length !== expectedIds.size) return false;
  const actualIds = new Set(payload.map((question) => question?.id));
  return actualIds.size === expectedIds.size && [...expectedIds].every((id) => actualIds.has(id));
}

function blitzResultMatches(payload, expectedDistribution) {
  return (
    payload?.type === 'TEMPO' &&
    payload?.locked === false &&
    payload?.totalVotes === PARTICIPANTS &&
    distributionMatches(payload?.distribution, expectedDistribution)
  );
}

function createState(label) {
  return {
    label,
    started: false,
    errors: [],
    messages: 0,
    latest: null,
    finalAt: null,
    subscription: null,
  };
}

function errorMessage(error) {
  return error?.message ?? String(error);
}

function subscribe(state, procedure, input, isFinal) {
  state.subscription = procedure.subscribe(input, {
    onStarted() {
      state.started = true;
    },
    onData(data) {
      state.messages += 1;
      state.latest = data;
      if (state.finalAt === null && isFinal(data)) {
        state.finalAt = performance.now();
      }
    },
    onError(error) {
      state.errors.push(errorMessage(error));
    },
  });
}

function unsubscribe(state) {
  state.subscription?.unsubscribe();
  state.subscription = null;
}

function addFailure(failures, condition, message) {
  if (!condition) failures.push(message);
}

async function createSession(publicTrpc) {
  return publicTrpc.session.create.mutate({
    type: 'Q_AND_A',
    title: `Kanal-WS-Fan-out ${Date.now()}`,
    moderationMode: false,
    qaEnabled: true,
    qaModerationMode: false,
    quickFeedbackEnabled: true,
    allowCustomNicknames: true,
    nicknameTheme: 'HIGH_SCHOOL',
    anonymousMode: false,
    teamMode: false,
  });
}

async function run() {
  await waitForBackend(TRPC_URL);

  const publicTrpc = createHttpTrpc(TRPC_URL);
  const session = await createSession(publicTrpc);
  const hostTrpc = createHttpTrpc(TRPC_URL, session.hostToken);
  const participants = await mapLimit(
    Array.from({ length: PARTICIPANTS }, (_, index) => index),
    Math.min(PARTICIPANTS, 15),
    (index) =>
      publicTrpc.session.join.mutate({
        code: session.code,
        nickname: `Fanout TN ${String(index + 1).padStart(2, '0')}`,
      }),
  );
  const qaStart = await hostTrpc.session.startQa.mutate({ code: session.code });

  const participantSockets = participants.map((participant, index) => {
    const socket = createPublicWsTrpc(WS_URL);
    return { ...socket, participant, index };
  });
  const hostSocket = createHostWsTrpc(WS_URL, session.hostToken);
  const allSockets = [...participantSockets.map(({ wsClient }) => wsClient), hostSocket.wsClient];

  try {
    console.log(
      `Session ${session.code}: ${PARTICIPANTS} Teilnehmer verbunden, starte Q&A-Fan-out.`,
    );

    const qaStates = participantSockets.map(({ index }) => createState(`TN ${index + 1}`));
    const qaHostState = createState('Host');
    for (let index = 0; index < participantSockets.length; index += 1) {
      const socket = participantSockets[index];
      subscribe(
        qaStates[index],
        socket.trpc.qa.onQuestionsUpdated,
        {
          sessionId: session.sessionId,
          participantId: socket.participant.participantId,
        },
        (payload) => Array.isArray(payload) && payload.length === PARTICIPANTS,
      );
    }
    subscribe(
      qaHostState,
      hostSocket.trpc.qa.onQuestionsUpdated,
      { sessionId: session.sessionId, moderatorView: true, sort: 'TOP' },
      (payload) => Array.isArray(payload) && payload.length === PARTICIPANTS,
    );

    const allQaStates = [...qaStates, qaHostState];
    const qaSubscriptionsReady = await waitFor(
      () => allQaStates.every((state) => state.started || state.errors.length > 0),
      SUBSCRIPTION_READY_LIMIT_MS,
    );

    const qaWriteStartedAt = performance.now();
    const qaWriteResults = await Promise.allSettled(
      participants.map((participant, index) =>
        publicTrpc.qa.submit.mutate({
          sessionId: session.sessionId,
          participantId: participant.participantId,
          text: `Fan-out-Frage ${index + 1}: Wie funktioniert der Live-Kanal?`,
        }),
      ),
    );
    const qaWritesCompletedAt = performance.now();
    const submittedQuestions = qaWriteResults
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value);
    const expectedQuestionIds = new Set(submittedQuestions.map((question) => question.id));

    await waitFor(
      () => allQaStates.every((state) => questionSetMatches(state.latest, expectedQuestionIds)),
      QA_FANOUT_LIMIT_MS,
    );

    const qaParticipantLatencies = qaStates
      .map((state) =>
        state.finalAt === null ? null : Math.max(0, state.finalAt - qaWritesCompletedAt),
      )
      .filter((value) => value !== null);
    const qaHostLatency =
      qaHostState.finalAt === null ? null : Math.max(0, qaHostState.finalAt - qaWritesCompletedAt);
    const qaErrors = allQaStates.flatMap((state) =>
      state.errors.map((message) => `${state.label}: ${message}`),
    );
    const qaFinalRecipients = qaStates.filter((state) =>
      questionSetMatches(state.latest, expectedQuestionIds),
    ).length;
    const qaHostFinal = questionSetMatches(qaHostState.latest, expectedQuestionIds);

    for (const state of allQaStates) unsubscribe(state);

    console.log(
      `Q&A: ${submittedQuestions.length}/${PARTICIPANTS} Writes, Endzustand bei ${qaFinalRecipients}/${PARTICIPANTS} TN, p95 ${timingSummary(qaParticipantLatencies).p95Ms ?? '-'} ms.`,
    );
    console.log('Starte Blitzlicht-Fan-out auf denselben Teilnehmer-Verbindungen.');

    const round = await hostTrpc.quickFeedback.create.mutate({
      sessionCode: session.code,
      type: 'TEMPO',
    });
    const expectedDistribution = expectedTempoDistribution();
    const blitzStates = participantSockets.map(({ index }) => createState(`TN ${index + 1}`));
    const blitzHostState = createState('Host');

    for (let index = 0; index < participantSockets.length; index += 1) {
      subscribe(
        blitzStates[index],
        participantSockets[index].trpc.quickFeedback.onResults,
        { sessionCode: session.code },
        (payload) => blitzResultMatches(payload, expectedDistribution),
      );
    }
    subscribe(
      blitzHostState,
      hostSocket.trpc.quickFeedback.onHostResults,
      { sessionCode: session.code },
      (payload) => blitzResultMatches(payload, expectedDistribution),
    );

    const allBlitzStates = [...blitzStates, blitzHostState];
    const blitzSubscriptionsReady = await waitFor(
      () => allBlitzStates.every((state) => state.started || state.errors.length > 0),
      SUBSCRIPTION_READY_LIMIT_MS,
    );

    const blitzWriteStartedAt = performance.now();
    const blitzWriteResults = await Promise.allSettled(
      participants.map((participant, index) =>
        publicTrpc.quickFeedback.vote.mutate({
          sessionCode: session.code,
          voterId: participant.participantId,
          value: TEMPO_VALUES[index % TEMPO_VALUES.length],
        }),
      ),
    );
    const blitzWritesCompletedAt = performance.now();

    await waitFor(
      () => allBlitzStates.every((state) => blitzResultMatches(state.latest, expectedDistribution)),
      BLITZ_FANOUT_LIMIT_MS,
    );

    const blitzParticipantLatencies = blitzStates
      .map((state) =>
        state.finalAt === null ? null : Math.max(0, state.finalAt - blitzWritesCompletedAt),
      )
      .filter((value) => value !== null);
    const blitzHostLatency =
      blitzHostState.finalAt === null
        ? null
        : Math.max(0, blitzHostState.finalAt - blitzWritesCompletedAt);
    const blitzErrors = allBlitzStates.flatMap((state) =>
      state.errors.map((message) => `${state.label}: ${message}`),
    );
    const blitzFinalRecipients = blitzStates.filter((state) =>
      blitzResultMatches(state.latest, expectedDistribution),
    ).length;
    const blitzHostFinal = blitzResultMatches(blitzHostState.latest, expectedDistribution);
    const hostSnapshot = await hostTrpc.quickFeedback.hostResults.query({
      sessionCode: session.code,
    });

    for (const state of allBlitzStates) unsubscribe(state);

    const qaTiming = timingSummary(qaParticipantLatencies);
    const blitzTiming = timingSummary(blitzParticipantLatencies);
    const failures = [];
    const qaRejected = qaWriteResults.filter((result) => result.status === 'rejected');
    const blitzRejected = blitzWriteResults.filter((result) => result.status === 'rejected');

    addFailure(
      failures,
      participants.length === PARTICIPANTS,
      'Teilnehmer-Join ist unvollständig.',
    );
    addFailure(
      failures,
      qaStart.status === 'ACTIVE',
      `Q&A-Status ist ${qaStart.status}, nicht ACTIVE.`,
    );
    addFailure(
      failures,
      qaSubscriptionsReady && allQaStates.every((state) => state.started),
      'Nicht alle Q&A-Subscriptions wurden gestartet.',
    );
    addFailure(failures, qaErrors.length === 0, `${qaErrors.length} Q&A-Subscription-Fehler.`);
    addFailure(
      failures,
      qaRejected.length === 0,
      `${qaRejected.length} Q&A-Writes fehlgeschlagen.`,
    );
    addFailure(
      failures,
      expectedQuestionIds.size === PARTICIPANTS,
      `Nur ${expectedQuestionIds.size}/${PARTICIPANTS} eindeutige Fragen erzeugt.`,
    );
    addFailure(
      failures,
      submittedQuestions.every((question) => question.status === 'ACTIVE'),
      'Nicht alle erzeugten Fragen sind ACTIVE.',
    );
    addFailure(
      failures,
      qaFinalRecipients === PARTICIPANTS && qaHostFinal,
      `Q&A-Endzustand nur bei ${qaFinalRecipients}/${PARTICIPANTS} TN; Host=${qaHostFinal}.`,
    );
    addFailure(
      failures,
      qaTiming.maxMs !== null && qaTiming.maxMs <= QA_FANOUT_LIMIT_MS,
      `Q&A-Fan-out max ${qaTiming.maxMs ?? 'fehlt'} ms > Limit ${QA_FANOUT_LIMIT_MS} ms.`,
    );
    addFailure(
      failures,
      qaHostLatency !== null && qaHostLatency <= QA_FANOUT_LIMIT_MS,
      `Q&A-Host-Latenz ${roundOrNull(qaHostLatency) ?? 'fehlt'} ms > Limit ${QA_FANOUT_LIMIT_MS} ms.`,
    );

    addFailure(
      failures,
      round.sessionCode === session.code,
      `Blitzlicht wurde für unerwarteten Code ${round.sessionCode} erstellt.`,
    );
    addFailure(
      failures,
      blitzSubscriptionsReady && allBlitzStates.every((state) => state.started),
      'Nicht alle Blitzlicht-Subscriptions wurden gestartet.',
    );
    addFailure(
      failures,
      blitzErrors.length === 0,
      `${blitzErrors.length} Blitzlicht-Subscription-Fehler.`,
    );
    addFailure(
      failures,
      blitzRejected.length === 0,
      `${blitzRejected.length} Blitzlicht-Writes fehlgeschlagen.`,
    );
    addFailure(
      failures,
      blitzFinalRecipients === PARTICIPANTS && blitzHostFinal,
      `Blitzlicht-Endzustand nur bei ${blitzFinalRecipients}/${PARTICIPANTS} TN; Host=${blitzHostFinal}.`,
    );
    addFailure(
      failures,
      blitzTiming.maxMs !== null && blitzTiming.maxMs <= BLITZ_FANOUT_LIMIT_MS,
      `Blitzlicht-Fan-out max ${blitzTiming.maxMs ?? 'fehlt'} ms > Limit ${BLITZ_FANOUT_LIMIT_MS} ms.`,
    );
    addFailure(
      failures,
      blitzHostLatency !== null && blitzHostLatency <= BLITZ_FANOUT_LIMIT_MS,
      `Blitzlicht-Host-Latenz ${roundOrNull(blitzHostLatency) ?? 'fehlt'} ms > Limit ${BLITZ_FANOUT_LIMIT_MS} ms.`,
    );
    addFailure(
      failures,
      blitzResultMatches(hostSnapshot, expectedDistribution),
      'Der abschließende Blitzlicht-Host-Snapshot stimmt nicht.',
    );

    const report = {
      schemaVersion: 1,
      scenario: 'channel-ws-fanout-classroom-30',
      ok: failures.length === 0,
      generatedAt: new Date().toISOString(),
      config: {
        participants: PARTICIPANTS,
        trpcUrl: TRPC_URL,
        wsUrl: WS_URL,
        qaFanoutLimitMs: QA_FANOUT_LIMIT_MS,
        blitzFanoutLimitMs: BLITZ_FANOUT_LIMIT_MS,
      },
      session: {
        code: session.code,
        sessionId: session.sessionId,
        joinedParticipants: participants.length,
      },
      qa: {
        subscription: 'qa.onQuestionsUpdated',
        participantSubscriptionsStarted: qaStates.filter((state) => state.started).length,
        hostSubscriptionStarted: qaHostState.started,
        subscriptionErrors: qaErrors,
        expectedQuestions: PARTICIPANTS,
        acceptedWrites: submittedQuestions.length,
        rejectedWrites: qaRejected.map((result) => errorMessage(result.reason)),
        writeWindowMs: Math.round(qaWritesCompletedAt - qaWriteStartedAt),
        participantFinalRecipients: qaFinalRecipients,
        hostFinal: qaHostFinal,
        participantFanout: qaTiming,
        hostFanoutMs: roundOrNull(qaHostLatency),
        participantMessageCounts: {
          min: Math.min(...qaStates.map((state) => state.messages)),
          max: Math.max(...qaStates.map((state) => state.messages)),
        },
      },
      blitzlicht: {
        participantSubscription: 'quickFeedback.onResults',
        hostSubscription: 'quickFeedback.onHostResults',
        participantSubscriptionsStarted: blitzStates.filter((state) => state.started).length,
        hostSubscriptionStarted: blitzHostState.started,
        subscriptionErrors: blitzErrors,
        expectedVotes: PARTICIPANTS,
        acceptedWrites: blitzWriteResults.length - blitzRejected.length,
        rejectedWrites: blitzRejected.map((result) => errorMessage(result.reason)),
        writeWindowMs: Math.round(blitzWritesCompletedAt - blitzWriteStartedAt),
        expectedDistribution,
        snapshotDistribution: hostSnapshot.distribution,
        participantFinalRecipients: blitzFinalRecipients,
        hostFinal: blitzHostFinal,
        participantFanout: blitzTiming,
        hostFanoutMs: roundOrNull(blitzHostLatency),
        participantMessageCounts: {
          min: Math.min(...blitzStates.map((state) => state.messages)),
          max: Math.max(...blitzStates.map((state) => state.messages)),
        },
      },
      failures,
    };

    console.log(
      `Blitzlicht: ${report.blitzlicht.acceptedWrites}/${PARTICIPANTS} Votes, Endzustand bei ${blitzFinalRecipients}/${PARTICIPANTS} TN, p95 ${blitzTiming.p95Ms ?? '-'} ms.`,
    );
    return { report, failures };
  } finally {
    for (const wsClient of allSockets) wsClient.close();
  }
}

let report;
try {
  const result = await run();
  report = result.report;
  await writeScenarioReport({
    filePath: REPORT_FILE,
    scenario: report.scenario,
    environment: report.config,
    metrics: {
      session: report.session,
      qa: report.qa,
      blitzlicht: report.blitzlicht,
    },
    failures: report.failures,
  });
  console.log(`Report atomar geschrieben: ${REPORT_FILE}`);
  if (result.failures.length > 0) {
    console.error('FEHLER:');
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('OK — Q&A- und Blitzlicht-WS-Fan-out bestanden.');
  }
} catch (error) {
  report = {
    schemaVersion: 1,
    scenario: 'channel-ws-fanout-classroom-30',
    ok: false,
    generatedAt: new Date().toISOString(),
    config: {
      participants: PARTICIPANTS,
      trpcUrl: TRPC_URL,
      wsUrl: WS_URL,
      qaFanoutLimitMs: QA_FANOUT_LIMIT_MS,
      blitzFanoutLimitMs: BLITZ_FANOUT_LIMIT_MS,
    },
    fatalError: errorMessage(error),
    failures: [errorMessage(error)],
  };
  try {
    await writeScenarioReport({
      filePath: REPORT_FILE,
      scenario: report.scenario,
      environment: report.config,
      metrics: { fatalError: report.fatalError },
      failures: report.failures,
    });
    console.error(`Fehlerreport atomar geschrieben: ${REPORT_FILE}`);
  } catch (reportError) {
    console.error(`Report konnte nicht geschrieben werden: ${errorMessage(reportError)}`);
  }
  console.error(`FATAL: ${errorMessage(error)}`);
  process.exitCode = 1;
}
