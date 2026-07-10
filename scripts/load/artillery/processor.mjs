import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHttpTrpcSingle, createPublicWsTrpc } from '../lib/trpc-runtime.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_STATE_FILE = resolve(__dirname, '.runtime-state.json');
const DEFAULT_RESULTS_READY_FILE = resolve(__dirname, '.results-ready.flag');

let sessionContext = null;
let participantCounter = 0;

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

function readRuntimeState() {
  try {
    return JSON.parse(readFileSync(stateFilePath(), 'utf8'));
  } catch {
    return {
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
      questionReads: 0,
      questionReadErrors: 0,
      infoPolls: 0,
    };
  }
}

function writeRuntimeState(patch) {
  const current = readRuntimeState();
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  mkdirSync(dirname(stateFilePath()), { recursive: true });
  writeFileSync(stateFilePath(), JSON.stringify(next, null, 2));
  return next;
}

function bumpRuntimeState(field, delta = 1) {
  const current = readRuntimeState();
  writeRuntimeState({ [field]: (current[field] ?? 0) + delta });
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
  try {
    const ctx = loadSessionContext();
    const trpc = createHttpTrpcSingle(ctx.trpcUrl);
    const index = nextParticipantIndex();
    const nickname = `art-${String(index).padStart(3, '0')}`.slice(0, 30);
    const joined = await trpc.session.join.mutate({ code: ctx.code, nickname });
    userContext.vars.sessionId = joined.id;
    userContext.vars.participantId = joined.participantId;
    userContext.vars.participantIndex = index;
    userContext.vars.nickname = nickname;
    bumpRuntimeState('joins');
    events.emit('counter', 'custom.joins_ok', 1);
  } catch (error) {
    bumpRuntimeState('joinErrors');
    events.emit('counter', 'custom.joins_failed', 1);
    throw error;
  }
}

export async function connectParticipantStatusWs(userContext, events) {
  try {
    const ctx = loadSessionContext();
    const { trpc, wsClient } = createPublicWsTrpc(ctx.wsUrl);
    const subscription = trpc.session.onStatusChanged.subscribe(
      { code: ctx.code },
      {
        onData() {
          bumpRuntimeState('wsStatusEvents');
        },
        onError() {
          bumpRuntimeState('wsErrors');
        },
      },
    );
    userContext.vars._statusSub = subscription;
    userContext.vars._statusWsClient = wsClient;
    bumpRuntimeState('wsConnections');
    events.emit('counter', 'custom.ws_connected', 1);
    await new Promise((resolve) => setTimeout(resolve, 400));
  } catch (error) {
    bumpRuntimeState('wsErrors');
    events.emit('counter', 'custom.ws_failed', 1);
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

export async function waitForResultsPhase() {
  const readyFile = process.env.ARTILLERY_RESULTS_READY_FILE || DEFAULT_RESULTS_READY_FILE;
  const deadline = Date.now() + Number(process.env.ARTILLERY_RESULTS_WAIT_MS || 20_000);
  while (Date.now() < deadline) {
    try {
      if (readFileSync(readyFile, 'utf8').trim() === '1') {
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
  events.emit('counter', 'custom.ws_disconnected', 1);
}

export async function reconnectParticipantStatusWs(userContext, events) {
  disconnectParticipantStatusWs(userContext, events);

  const ctx = loadSessionContext();
  const startedAt = performance.now();
  userContext.vars._reconnectReady = false;
  userContext.vars._reconnectResultsSeen = false;

  const { trpc, wsClient } = createPublicWsTrpc(ctx.wsUrl);
  const subscription = trpc.session.onStatusChanged.subscribe(
    { code: ctx.code },
    {
      onStarted() {
        if (userContext.vars._reconnectReady) return;
        userContext.vars._reconnectReady = true;
        const ms = Math.round(performance.now() - startedAt);
        userContext.vars._reconnectMs = ms;
        bumpRuntimeState('reconnects');
        const current = readRuntimeState();
        writeRuntimeState({
          reconnectMsMax: Math.max(current.reconnectMsMax ?? 0, ms),
          reconnectMsSum: (current.reconnectMsSum ?? 0) + ms,
        });
        events.emit('counter', 'custom.reconnect_ok', 1);
      },
      onData(data) {
        bumpRuntimeState('wsStatusEvents');
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
  bumpRuntimeState('wsConnections');
  events.emit('counter', 'custom.ws_reconnected', 1);

  const timeoutMs = Number(process.env.ARTILLERY_RECONNECT_LIMIT_MS || 3_000);
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
