#!/usr/bin/env node
/**
 * Artillery-500er: Unified Live-Session (Quiz + Q&A + Blitzlicht) mit HTTP + WebSocket.
 *
 * Ebenen:
 * - HTTP/tRPC: join, getInfo, getCurrentQuestion, vote, qa.submit, quickFeedback.vote
 * - WebSocket: session.onStatusChanged (Teilnehmer), Host onHostVoteProgressChanged + onStatusChanged
 * - Host: revealResults nach Vote-Schwelle
 *
 * Run:
 *   npm run load:artillery:500
 *   TRPC_URL=http://127.0.0.1:3000/trpc WS_URL=ws://127.0.0.1:3001 PARTICIPANTS=500 npm run load:artillery:500
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeScenarioReport } from './lib/reporting.mjs';
import { waitForBackend } from './lib/wait-for-backend.mjs';
import { createHttpTrpc } from './lib/trpc-runtime.mjs';
import { createArtillery500Session } from './artillery/setup-session.mjs';
import { startHostMonitor } from './artillery/host-monitor.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARTILLERY_DIR = resolve(__dirname, 'artillery');

const TRPC_URL = String(process.env.TRPC_URL || 'http://127.0.0.1:3000/trpc').trim();
const WS_URL = String(process.env.WS_URL || 'ws://127.0.0.1:3001').trim();
const HTTP_TARGET = String(
  process.env.ARTILLERY_HTTP_TARGET || TRPC_URL.replace(/\/trpc\/?$/, ''),
).trim();
const PARTICIPANTS = Math.max(1, Number(process.env.PARTICIPANTS || 500));
const RAMP_SECONDS = Math.max(30, Number(process.env.ARTILLERY_RAMP_SECONDS || 90));
const ARRIVAL_RATE = Math.max(
  1,
  Number(process.env.ARTILLERY_ARRIVAL_RATE || Math.ceil(PARTICIPANTS / RAMP_SECONDS)),
);
const MIN_JOIN_RATIO = Number(process.env.ARTILLERY_MIN_JOIN_RATIO || 0.95);
const MIN_VOTE_RATIO = Number(process.env.ARTILLERY_MIN_VOTE_RATIO || 0.9);
const MIN_WS_RATIO = Number(process.env.ARTILLERY_MIN_WS_RATIO || 0.9);
const VOTE_REVEAL_THRESHOLD = Math.max(
  1,
  Number(process.env.ARTILLERY_VOTE_REVEAL_THRESHOLD || Math.floor(PARTICIPANTS * MIN_VOTE_RATIO)),
);
const JOIN_STABLE_TICKS = Math.max(2, Number(process.env.ARTILLERY_JOIN_STABLE_TICKS || 6));
const RESULTS_WAIT_MS = Math.max(5_000, Number(process.env.ARTILLERY_RESULTS_WAIT_MS || 25_000));

const SESSION_FILE = resolve(ARTILLERY_DIR, '.session.json');
const STATE_FILE = resolve(ARTILLERY_DIR, '.runtime-state.json');
const RESULTS_READY_FILE = resolve(ARTILLERY_DIR, '.results-ready.flag');
const ARTILLERY_REPORT_FILE = resolve(ARTILLERY_DIR, 'reports', `500-live-${Date.now()}.json`);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function runArtillery() {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      ARTILLERY_SESSION_FILE: SESSION_FILE,
      ARTILLERY_STATE_FILE: STATE_FILE,
      ARTILLERY_HTTP_TARGET: HTTP_TARGET,
      ARTILLERY_RAMP_SECONDS: String(RAMP_SECONDS),
      ARTILLERY_ARRIVAL_RATE: String(ARRIVAL_RATE),
      ARTILLERY_MAX_VUS: String(PARTICIPANTS),
      ARTILLERY_RESULTS_WAIT_MS: String(RESULTS_WAIT_MS),
      ARTILLERY_RESULTS_READY_FILE: RESULTS_READY_FILE,
    };

    mkdirSync(dirname(ARTILLERY_REPORT_FILE), { recursive: true });
    const child = spawn(
      'npx',
      ['artillery', 'run', '--output', ARTILLERY_REPORT_FILE, '500-live-session.yml'],
      {
        cwd: ARTILLERY_DIR,
        env,
        stdio: 'inherit',
        shell: process.platform === 'win32',
      },
    );
    child.on('error', reject);
    child.on('exit', (code) => {
      resolve(code ?? 0);
    });
  });
}

async function waitForRevealMoment(hostMonitor, timeoutMs) {
  const startedAt = Date.now();
  let lastJoins = 0;
  let stableJoinTicks = 0;

  while (Date.now() - startedAt < timeoutMs) {
    const runtime = readState();
    const joins = runtime.joins ?? 0;
    const votes = runtime.votes ?? 0;
    const hostVotes = hostMonitor.state.progressMaxTotalVotes;

    if (joins === lastJoins) {
      stableJoinTicks += 1;
    } else {
      stableJoinTicks = 0;
      lastJoins = joins;
    }

    const joinsReady = joins >= PARTICIPANTS * MIN_JOIN_RATIO;
    const votesReady = Math.max(votes, hostVotes) >= VOTE_REVEAL_THRESHOLD;
    const joinStable = stableJoinTicks >= JOIN_STABLE_TICKS;

    if (joinsReady && votesReady && joinStable) {
      return {
        joins,
        votes,
        hostVotes,
        waitedMs: Date.now() - startedAt,
        joinStable,
      };
    }
    await sleep(500);
  }

  const runtime = readState();
  return {
    joins: runtime.joins ?? 0,
    votes: runtime.votes ?? 0,
    hostVotes: hostMonitor.state.progressMaxTotalVotes,
    waitedMs: Date.now() - startedAt,
    timedOut: true,
  };
}

async function main() {
  await waitForBackend(TRPC_URL);
  rmSync(STATE_FILE, { force: true });
  rmSync(RESULTS_READY_FILE, { force: true });
  writeFileSync(RESULTS_READY_FILE, '0');

  const session = await createArtillery500Session(TRPC_URL);
  const sessionPayload = {
    trpcUrl: TRPC_URL,
    wsUrl: WS_URL,
    httpTarget: HTTP_TARGET,
    code: session.code,
    hostToken: session.hostToken,
    sessionId: session.sessionId,
    questionId: session.questionId,
    answerId: session.answerId,
    participants: PARTICIPANTS,
    createdAt: new Date().toISOString(),
  };
  writeFileSync(SESSION_FILE, JSON.stringify(sessionPayload, null, 2));

  const hostMonitor = startHostMonitor({
    trpcUrl: TRPC_URL,
    wsUrl: WS_URL,
    code: session.code,
    hostToken: session.hostToken,
  });
  await sleep(750);

  const revealWatcher = (async () => {
    const threshold = await waitForRevealMoment(
      hostMonitor,
      RAMP_SECONDS * 1000 + RESULTS_WAIT_MS + 60_000,
    );
    if (!threshold.timedOut || threshold.votes > 0 || threshold.hostVotes > 0) {
      await hostMonitor.revealResultsOnce();
      writeFileSync(RESULTS_READY_FILE, '1');
    }
    return threshold;
  })();

  let artilleryExitCode = 0;
  try {
    artilleryExitCode = await runArtillery();
  } catch (error) {
    artilleryExitCode = 1;
    console.error(error);
  }

  const threshold = await revealWatcher;
  if (!hostMonitor.state.revealed && (readState().votes ?? 0) > 0) {
    await hostMonitor.revealResultsOnce();
    writeFileSync(RESULTS_READY_FILE, '1');
  }

  await sleep(2_000);
  const runtime = readState();
  const publicHttp = createHttpTrpc(TRPC_URL);
  const statusSnapshot = await publicHttp.session.getInfo.query({ code: session.code });

  hostMonitor.stop();

  const summary = {
    scenario: 'artillery-500-live-session',
    participantsTarget: PARTICIPANTS,
    sessionCode: session.code,
    layers: {
      http: {
        joins: runtime.joins ?? 0,
        joinErrors: runtime.joinErrors ?? 0,
        votes: runtime.votes ?? 0,
        voteErrors: runtime.voteErrors ?? 0,
        qaSubmits: runtime.qaSubmits ?? 0,
        blitzVotes: runtime.blitzVotes ?? 0,
        infoPolls: runtime.infoPolls ?? 0,
        questionReads: runtime.questionReads ?? 0,
      },
      websocket: {
        connections: runtime.wsConnections ?? 0,
        statusEvents: runtime.wsStatusEvents ?? 0,
        errors: runtime.wsErrors ?? 0,
        hostSubscriptionErrors: hostMonitor.state.subscriptionErrors,
        hostProgressMessages: hostMonitor.state.progressMessages,
        hostProgressMaxVotes: hostMonitor.state.progressMaxTotalVotes,
        hostStatusMessages: hostMonitor.state.statusMessages,
        hostLastStatus: hostMonitor.state.lastStatus,
        hostResultsSeen: hostMonitor.state.resultsSeenAt !== null,
      },
    },
    reveal: threshold,
    snapshots: {
      progressTotalVotes: hostMonitor.state.progressMaxTotalVotes,
      sessionStatus: statusSnapshot?.status ?? null,
    },
    artilleryReportFile: ARTILLERY_REPORT_FILE,
    artilleryExitCode,
  };

  console.log(JSON.stringify(summary, null, 2));

  const failures = [];
  if ((runtime.joins ?? 0) < PARTICIPANTS * MIN_JOIN_RATIO) {
    failures.push(`Joins: ${runtime.joins ?? 0}/${PARTICIPANTS}`);
  }
  const effectiveVotes = Math.max(runtime.votes ?? 0, hostMonitor.state.progressMaxTotalVotes);
  if (effectiveVotes < PARTICIPANTS * MIN_VOTE_RATIO) {
    failures.push(`Votes: ${effectiveVotes}/${PARTICIPANTS}`);
  }
  if ((runtime.wsConnections ?? 0) < PARTICIPANTS * MIN_WS_RATIO) {
    failures.push(`WS-Verbindungen: ${runtime.wsConnections ?? 0}/${PARTICIPANTS}`);
  }
  if (hostMonitor.state.progressMaxTotalVotes < PARTICIPANTS * MIN_VOTE_RATIO) {
    failures.push(`Host-WS-Progress: ${hostMonitor.state.progressMaxTotalVotes}/${PARTICIPANTS}`);
  }
  if (statusSnapshot?.status !== 'RESULTS' && hostMonitor.state.lastStatus !== 'RESULTS') {
    failures.push(
      `Session-Status nicht RESULTS (${statusSnapshot?.status ?? hostMonitor.state.lastStatus})`,
    );
  }
  if (hostMonitor.state.subscriptionErrors > 0) {
    failures.push(`Host-Subscription-Fehler: ${hostMonitor.state.subscriptionErrors}`);
  }
  if (artilleryExitCode !== 0) {
    failures.push(`Artillery Exit-Code: ${artilleryExitCode}`);
  }

  await writeScenarioReport({
    scenario: summary.scenario,
    environment: {
      participants: PARTICIPANTS,
      rampSeconds: RAMP_SECONDS,
      arrivalRate: ARRIVAL_RATE,
      minJoinRatio: MIN_JOIN_RATIO,
      minVoteRatio: MIN_VOTE_RATIO,
      minWsRatio: MIN_WS_RATIO,
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

  console.log('\nOK Artillery-500-Live-Session bestanden.');
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(error);
  await writeScenarioReport({
    scenario: 'artillery-500-live-session',
    environment: { participants: PARTICIPANTS, rampSeconds: RAMP_SECONDS },
    metrics: { runtimeError: message },
    failures: [message],
  }).catch((reportError) => console.error('Fehlerreport fehlgeschlagen:', reportError));
  process.exitCode = 1;
}
