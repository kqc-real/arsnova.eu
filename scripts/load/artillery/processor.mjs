import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createHttpTrpcSingle,
  createPublicWsTrpc,
  productionRetryDelayMs,
} from '../lib/trpc-runtime.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_STATE_FILE = resolve(__dirname, '.runtime-state.json');
const DEFAULT_RESULTS_READY_FILE = resolve(__dirname, '.results-ready.flag');
const EMPTY_RUNTIME_STATE = Object.freeze({
  joins: 0,
  joinErrors: 0,
  votes: 0,
  voteErrors: 0,
  qaSubmits: 0,
  blitzVotes: 0,
  wsConnections: 0,
  wsStatusEvents: 0,
  wsErrors: 0,
  reconnects: 0,
  reconnectErrors: 0,
  reconnectResultsSeen: 0,
  reconnectResultsMissing: 0,
  reconnectMsSum: 0,
  reconnectMsMax: 0,
  reconnectsWithinWindow: 0,
  joinDurationMs: [],
  wsConnectDurationMs: [],
  statusFanoutDurationMs: [],
  questionReads: 0,
  questionReadErrors: 0,
  infoPolls: 0,
});

let sessionContext = null;
let participantCounter = 0;
/** In-memory counters avoid lost updates under concurrent VU state flushes. */
let runtimeState = { ...EMPTY_RUNTIME_STATE };
let runtimeStateLoaded = false;
let runtimeFlushTimer = null;

function stateFilePath() {
  return process.env.ARTILLERY_STATE_FILE || DEFAULT_STATE_FILE;
}

function loadSessionContext() {
  if (sessionContext) return sessionContext;
  const sessionFile = process.env.ARTILLERY_SESSION_FILE;
  if (!sessionFile) {
    throw new Error('ARTILLERY_SESSION_FILE ist nicht gesetzt.');
  }
  sessionContext = JSON.parse(readFileSync(sessionFile, 'utf8'));
  return sessionContext;
}

function ensureRuntimeState() {
  if (runtimeStateLoaded) return runtimeState;
  runtimeStateLoaded = true;
  try {
    const fromDisk = JSON.parse(readFileSync(stateFilePath(), 'utf8'));
    runtimeState = {
      ...EMPTY_RUNTIME_STATE,
      ...fromDisk,
      joinDurationMs: Array.isArray(fromDisk.joinDurationMs) ? [...fromDisk.joinDurationMs] : [],
      wsConnectDurationMs: Array.isArray(fromDisk.wsConnectDurationMs)
        ? [...fromDisk.wsConnectDurationMs]
        : [],
      statusFanoutDurationMs: Array.isArray(fromDisk.statusFanoutDurationMs)
        ? [...fromDisk.statusFanoutDurationMs]
        : [],
    };
  } catch {
    runtimeState = {
      ...EMPTY_RUNTIME_STATE,
      joinDurationMs: [],
      wsConnectDurationMs: [],
      statusFanoutDurationMs: [],
    };
  }
  return runtimeState;
}

function flushRuntimeState() {
  const current = ensureRuntimeState();
  const next = { ...current, updatedAt: new Date().toISOString() };
  mkdirSync(dirname(stateFilePath()), { recursive: true });
  writeFileSync(stateFilePath(), JSON.stringify(next, null, 2));
  return next;
}

function scheduleRuntimeFlush() {
  if (runtimeFlushTimer) return;
  runtimeFlushTimer = setTimeout(() => {
    runtimeFlushTimer = null;
    flushRuntimeState();
  }, 50);
  runtimeFlushTimer.unref?.();
}

function writeRuntimeState(patch) {
  const current = ensureRuntimeState();
  runtimeState = { ...current, ...patch };
  scheduleRuntimeFlush();
  return runtimeState;
}

function bumpRuntimeState(field, delta = 1) {
  const current = ensureRuntimeState();
  current[field] = (current[field] ?? 0) + delta;
  scheduleRuntimeFlush();
}

function recordRuntimeDuration(field, durationMs) {
  const current = ensureRuntimeState();
  const values = Array.isArray(current[field]) ? current[field] : [];
  values.push(Math.max(0, Math.round(durationMs)));
  current[field] = values.slice(-2_000);
  scheduleRuntimeFlush();
}

function readRuntimeState() {
  return { ...ensureRuntimeState() };
}

process.once('beforeExit', () => {
  if (runtimeFlushTimer) {
    clearTimeout(runtimeFlushTimer);
    runtimeFlushTimer = null;
  }
  if (runtimeStateLoaded) {
    flushRuntimeState();
  }
});

function recordResultsFanout(userContext, events) {
  if (userContext.vars._resultsFanoutRecorded) return;
  const timestampFile = process.env.ARTILLERY_REVEAL_TIMESTAMP_FILE;
  if (!timestampFile) return;
  try {
    const revealStartedAt = Number(readFileSync(timestampFile, 'utf8').trim());
    if (!Number.isFinite(revealStartedAt) || revealStartedAt <= 0) return;
    const durationMs = Math.max(0, Date.now() - revealStartedAt);
    userContext.vars._resultsFanoutRecorded = true;
    recordRuntimeDuration('statusFanoutDurationMs', durationMs);
    events.emit('histogram', 'custom.status_fanout_ms', durationMs);
  } catch {
    // Reveal wurde noch nicht gestartet.
  }
}

function nextParticipantIndex() {
  participantCounter += 1;
  return participantCounter;
}

function tempoValueForIndex(index) {
  const values = ['SPEED_UP', 'FOLLOWING', 'SLOW_DOWN', 'LOST'];
  return values[index % values.length];
}

export async function joinSession(userContext, events) {
  const startedAt = performance.now();
  try {
    const ctx = loadSessionContext();
    const trpc = createHttpTrpcSingle(ctx.trpcUrl);
    const index = nextParticipantIndex();
    const nickname = `art-${String(index).padStart(3, '0')}`.slice(0, 30);
    const joined = await trpc.session.join.mutate({
      code: ctx.code,
      nickname,
      anonymousClientId: globalThis.crypto.randomUUID(),
    });
    userContext.vars.sessionId = joined.id;
    userContext.vars.participantId = joined.participantId;
    userContext.vars.participantIndex = index;
    userContext.vars.nickname = nickname;
    bumpRuntimeState('joins');
    const durationMs = performance.now() - startedAt;
    recordRuntimeDuration('joinDurationMs', durationMs);
    events.emit('histogram', 'custom.join_duration_ms', durationMs);
    events.emit('counter', 'custom.joins_ok', 1);
  } catch (error) {
    bumpRuntimeState('joinErrors');
    events.emit('counter', 'custom.joins_failed', 1);
    throw error;
  }
}

export async function connectParticipantStatusWs(userContext, events) {
  const startedAt = performance.now();
  try {
    const ctx = loadSessionContext();
    const { trpc, wsClient } = createPublicWsTrpc(ctx.wsUrl, {
      sessionCode: ctx.code,
      participantId: userContext.vars.participantId,
    });
    let connectionSettled = false;
    let resolveStarted;
    let rejectStarted;
    const started = new Promise((resolve, reject) => {
      resolveStarted = resolve;
      rejectStarted = reject;
    });
    const subscription = trpc.session.onStatusChanged.subscribe(
      { code: ctx.code },
      {
        onStarted() {
          if (connectionSettled) return;
          connectionSettled = true;
          const durationMs = performance.now() - startedAt;
          bumpRuntimeState('wsConnections');
          recordRuntimeDuration('wsConnectDurationMs', durationMs);
          events.emit('histogram', 'custom.ws_connect_ms', durationMs);
          events.emit('counter', 'custom.ws_connected', 1);
          resolveStarted();
        },
        onData(data) {
          bumpRuntimeState('wsStatusEvents');
          if (data?.status === 'RESULTS') recordResultsFanout(userContext, events);
        },
        onError(error) {
          bumpRuntimeState('wsErrors');
          events.emit('counter', 'custom.ws_failed', 1);
          if (!connectionSettled) {
            connectionSettled = true;
            rejectStarted(error instanceof Error ? error : new Error(String(error)));
          }
        },
      },
    );
    userContext.vars._statusSub = subscription;
    userContext.vars._statusWsClient = wsClient;
    const timeoutMs = Number(process.env.ARTILLERY_WS_CONNECT_TIMEOUT_MS || 10_000);
    let timeout;
    try {
      await Promise.race([
        started,
        new Promise((_, reject) => {
          timeout = setTimeout(() => {
            if (!connectionSettled) {
              connectionSettled = true;
              bumpRuntimeState('wsErrors');
              events.emit('counter', 'custom.ws_failed', 1);
            }
            reject(new Error('WebSocket onStarted Timeout.'));
          }, timeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    if (!userContext.vars._statusSub) {
      bumpRuntimeState('wsErrors');
      events.emit('counter', 'custom.ws_failed', 1);
    }
    userContext.vars._statusSub?.unsubscribe?.();
    userContext.vars._statusWsClient?.close?.();
    throw error;
  }
}

export async function pollSessionInfo(_userContext, events) {
  try {
    const ctx = loadSessionContext();
    const trpc = createHttpTrpcSingle(ctx.trpcUrl);
    await trpc.session.getInfo.query({ code: ctx.code });
    bumpRuntimeState('infoPolls');
    events.emit('counter', 'custom.info_polls_ok', 1);
  } catch (error) {
    events.emit('counter', 'custom.info_polls_failed', 1);
    throw error;
  }
}

export async function fetchCurrentQuestion(userContext, events) {
  try {
    const ctx = loadSessionContext();
    const trpc = createHttpTrpcSingle(ctx.trpcUrl);
    const question = await trpc.session.getCurrentQuestionForStudent.query({
      code: ctx.code,
      participantId: userContext.vars.participantId,
    });
    if (!question?.id) {
      throw new Error('Aktuelle Frage fehlt.');
    }
    bumpRuntimeState('questionReads');
    events.emit('counter', 'custom.question_reads_ok', 1);
  } catch (error) {
    bumpRuntimeState('questionReadErrors');
    events.emit('counter', 'custom.question_reads_failed', 1);
    throw error;
  }
}

export async function submitVote(userContext, events) {
  try {
    const ctx = loadSessionContext();
    const trpc = createHttpTrpcSingle(ctx.trpcUrl);
    await trpc.vote.submit.mutate({
      sessionId: userContext.vars.sessionId,
      participantId: userContext.vars.participantId,
      questionId: ctx.questionId,
      answerIds: [ctx.answerId],
      round: 1,
      responseTimeMs: 300 + (userContext.vars.participantIndex % 40) * 10,
    });
    bumpRuntimeState('votes');
    events.emit('counter', 'custom.votes_ok', 1);
  } catch (error) {
    const message = error?.message ?? String(error);
    if (message.includes('nicht mehr aktiv') || message.includes('not active')) {
      bumpRuntimeState('voteSkippedInactive');
      events.emit('counter', 'custom.votes_skipped_inactive', 1);
      return;
    }
    bumpRuntimeState('voteErrors');
    events.emit('counter', 'custom.votes_failed', 1);
    throw error;
  }
}

export async function maybeSubmitQa(userContext, events) {
  const index = Number(userContext.vars.participantIndex ?? 0);
  if (index % 5 !== 0) {
    return;
  }
  try {
    const ctx = loadSessionContext();
    const trpc = createHttpTrpcSingle(ctx.trpcUrl);
    await trpc.qa.submit.mutate({
      sessionId: ctx.sessionId,
      participantId: userContext.vars.participantId,
      text: `Artillery Q&A Frage von ${userContext.vars.nickname}`,
    });
    bumpRuntimeState('qaSubmits');
    events.emit('counter', 'custom.qa_submits_ok', 1);
  } catch (error) {
    events.emit('counter', 'custom.qa_submits_failed', 1);
    throw error;
  }
}

export async function submitBlitzlicht(userContext, events) {
  try {
    const ctx = loadSessionContext();
    const trpc = createHttpTrpcSingle(ctx.trpcUrl);
    const value = tempoValueForIndex(Number(userContext.vars.participantIndex ?? 0));
    await trpc.quickFeedback.vote.mutate({
      sessionCode: ctx.code,
      voterId: userContext.vars.participantId,
      value,
    });
    bumpRuntimeState('blitzVotes');
    events.emit('counter', 'custom.blitz_votes_ok', 1);
  } catch (error) {
    events.emit('counter', 'custom.blitz_votes_failed', 1);
    throw error;
  }
}

function resultsPhaseTimeoutMs() {
  const resultsWaitMs = Number(process.env.ARTILLERY_RESULTS_WAIT_MS || 25_000);
  const rampSeconds = Number(process.env.ARTILLERY_RAMP_SECONDS || 90);
  const explicit = Number(process.env.ARTILLERY_RESULTS_PHASE_TIMEOUT_MS || 0);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  // Early VUs finish voting long before the join ramp ends; host reveal waits for
  // stable joins after the ramp, so the wait must cover ramp + reveal window.
  return Math.max(resultsWaitMs, rampSeconds * 1_000 + resultsWaitMs);
}

export async function waitForResultsPhase(userContext) {
  const readyFile = process.env.ARTILLERY_RESULTS_READY_FILE || DEFAULT_RESULTS_READY_FILE;
  const deadline = Date.now() + resultsPhaseTimeoutMs();
  while (Date.now() < deadline) {
    if (userContext?.vars?._resultsFanoutRecorded) {
      return;
    }
    try {
      if (readFileSync(readyFile, 'utf8').trim() === '1') {
        // Ready-Flag kann den WS-Fan-out um wenige ms schlagen — kurz nachwarten.
        const fanoutDeadline = Date.now() + 5_000;
        while (Date.now() < fanoutDeadline) {
          if (userContext?.vars?._resultsFanoutRecorded) return;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        return;
      }
    } catch {
      // Ergebnisphase noch nicht freigegeben.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

export async function waitForReconnectResultsPhase(userContext, events) {
  const readyFile = process.env.ARTILLERY_RESULTS_READY_FILE || DEFAULT_RESULTS_READY_FILE;
  const timeoutMs = Number(process.env.ARTILLERY_RESULTS_WAIT_MS || 120_000);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (readFileSync(readyFile, 'utf8').trim() === '1') {
        events.emit('counter', 'custom.reconnect_results_phase_ready', 1);
        return;
      }
    } catch {
      // Host-Reveal noch nicht freigegeben.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  events.emit('counter', 'custom.reconnect_results_phase_timeout', 1);
  throw new Error('Host-Reveal (RESULTS) nicht innerhalb des Wartefensters freigegeben.');
}

export async function fetchResultsQuestion(userContext, events) {
  try {
    const ctx = loadSessionContext();
    const trpc = createHttpTrpcSingle(ctx.trpcUrl);
    const question = await trpc.session.getCurrentQuestionForStudent.query({
      code: ctx.code,
      participantId: userContext.vars.participantId,
    });
    if (!question) {
      throw new Error('Ergebnisfrage fehlt.');
    }
    events.emit('counter', 'custom.results_reads_ok', 1);
  } catch (error) {
    events.emit('counter', 'custom.results_reads_failed', 1);
    throw error;
  }
}

export async function disconnectParticipantStatusWs(userContext, events) {
  userContext.vars._statusSub?.unsubscribe?.();
  userContext.vars._statusWsClient?.close?.();
  userContext.vars._statusSub = null;
  userContext.vars._statusWsClient = null;
  if (runtimeFlushTimer) {
    clearTimeout(runtimeFlushTimer);
    runtimeFlushTimer = null;
  }
  flushRuntimeState();
  events.emit('counter', 'custom.ws_disconnected', 1);
}

export async function waitForReconnectJitter(userContext, events) {
  const delayMs = productionRetryDelayMs(0);
  userContext.vars._reconnectStartedAt = performance.now();
  userContext.vars._reconnectJitterMs = delayMs;
  events.emit('histogram', 'custom.reconnect_jitter_ms', delayMs);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

export async function reconnectParticipantStatusWs(userContext, events) {
  disconnectParticipantStatusWs(userContext, events);

  const ctx = loadSessionContext();
  const startedAt = userContext.vars._reconnectStartedAt ?? performance.now();
  userContext.vars._reconnectReady = false;
  userContext.vars._reconnectResultsSeen = false;

  const { trpc, wsClient } = createPublicWsTrpc(ctx.wsUrl, {
    sessionCode: ctx.code,
    participantId: userContext.vars.participantId,
  });
  const subscription = trpc.session.onStatusChanged.subscribe(
    { code: ctx.code },
    {
      onStarted() {
        if (userContext.vars._reconnectReady) return;
        userContext.vars._reconnectReady = true;
        const ms = Math.round(performance.now() - startedAt);
        userContext.vars._reconnectMs = ms;
        bumpRuntimeState('reconnects');
        bumpRuntimeState('wsConnections');
        const current = readRuntimeState();
        writeRuntimeState({
          reconnectMsMax: Math.max(current.reconnectMsMax ?? 0, ms),
          reconnectMsSum: (current.reconnectMsSum ?? 0) + ms,
          reconnectsWithinWindow:
            (current.reconnectsWithinWindow ?? 0) +
            (ms <= Number(process.env.ARTILLERY_RECONNECT_LIMIT_MS || 30_000) ? 1 : 0),
        });
        events.emit('counter', 'custom.reconnect_ok', 1);
      },
      onData(data) {
        bumpRuntimeState('wsStatusEvents');
        if (data?.status === 'RESULTS') recordResultsFanout(userContext, events);
        if (data?.status === 'RESULTS' && !userContext.vars._reconnectResultsSeen) {
          userContext.vars._reconnectResultsSeen = true;
          bumpRuntimeState('reconnectResultsSeen');
          events.emit('counter', 'custom.reconnect_results_ok', 1);
        }
      },
      onError() {
        bumpRuntimeState('wsErrors');
        bumpRuntimeState('reconnectErrors');
        events.emit('counter', 'custom.reconnect_failed', 1);
      },
    },
  );
  userContext.vars._statusSub = subscription;
  userContext.vars._statusWsClient = wsClient;
  events.emit('counter', 'custom.ws_reconnected', 1);

  const timeoutMs = Number(process.env.ARTILLERY_RECONNECT_LIMIT_MS || 30_000);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (userContext.vars._reconnectReady) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  bumpRuntimeState('reconnectErrors');
  events.emit('counter', 'custom.reconnect_timeout', 1);
  throw new Error('Reconnect onStarted nicht innerhalb des Limits erreicht.');
}

export async function assertReconnectResultsSeen(userContext, events) {
  const timeoutMs = Number(process.env.ARTILLERY_STATUS_AFTER_RECONNECT_LIMIT_MS || 3_000);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (userContext.vars._reconnectResultsSeen) {
      events.emit('counter', 'custom.reconnect_assert_ok', 1);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  bumpRuntimeState('reconnectResultsMissing');
  events.emit('counter', 'custom.reconnect_results_missing', 1);
  throw new Error('RESULTS nach Reconnect nicht empfangen.');
}
