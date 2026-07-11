#!/usr/bin/env node
/**
 * Artillery-500er: Reconnect-Welle (Quiz-only) mit HTTP-Join + WS Disconnect/Reconnect.
 *
 * Ebenen:
 * - HTTP/tRPC: join
 * - WebSocket: session.onStatusChanged (connect → disconnect → reconnect → RESULTS)
 * - Host: revealResults nach Reconnect-Schwelle
 *
 * Run:
 *   npm run load:artillery:reconnect:500
 *   TRPC_URL=http://127.0.0.1:3000/trpc WS_URL=ws://127.0.0.1:3001 PARTICIPANTS=500 npm run load:artillery:reconnect:500
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeScenarioReport } from './lib/reporting.mjs';
import { waitForBackend } from './lib/wait-for-backend.mjs';
import { createHttpTrpc } from './lib/trpc-runtime.mjs';
import { createArtilleryReconnectSession } from './artillery/setup-session.mjs';
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
const MIN_RECONNECT_RATIO = Number(process.env.ARTILLERY_MIN_RECONNECT_RATIO || 0.9);
const MIN_WS_RATIO = Number(process.env.ARTILLERY_MIN_WS_RATIO || 0.9);
const MIN_RESULTS_AFTER_RECONNECT_RATIO = Number(
  process.env.ARTILLERY_MIN_RESULTS_AFTER_RECONNECT_RATIO || 0.9,
);
const RECONNECT_MS_MAX = Math.max(500, Number(process.env.ARTILLERY_RECONNECT_MS_MAX || 3_000));
const JOIN_STABLE_TICKS = Math.max(2, Number(process.env.ARTILLERY_JOIN_STABLE_TICKS || 6));
const RECONNECT_STABLE_TICKS = Math.max(
  2,
  Number(process.env.ARTILLERY_RECONNECT_STABLE_TICKS || 4),
);
const REVEAL_WATCH_BUFFER_MS = Math.max(
  30_000,
  Number(process.env.ARTILLERY_REVEAL_WATCH_BUFFER_MS || 60_000),
);
const STABILITY_BUFFER_MS = (JOIN_STABLE_TICKS + RECONNECT_STABLE_TICKS) * 500;
const DEFAULT_RESULTS_WAIT_MS = RAMP_SECONDS * 1000 + STABILITY_BUFFER_MS + REVEAL_WATCH_BUFFER_MS;
const RESULTS_WAIT_MS = Math.max(
  5_000,
  Number(process.env.ARTILLERY_RESULTS_WAIT_MS || DEFAULT_RESULTS_WAIT_MS),
);
const STATUS_AFTER_RECONNECT_LIMIT_MS = Math.max(
  3_000,
  Number(process.env.ARTILLERY_STATUS_AFTER_RECONNECT_LIMIT_MS || 5_000),
);

const SESSION_FILE = resolve(ARTILLERY_DIR, '.session.json');
const STATE_FILE = resolve(ARTILLERY_DIR, '.runtime-state.json');
const RESULTS_READY_FILE = resolve(ARTILLERY_DIR, '.results-ready.flag');
const ARTILLERY_REPORT_FILE = resolve(ARTILLERY_DIR, 'reports', `500-reconnect-${Date.now()}.json`);

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
      ARTILLERY_RECONNECT_LIMIT_MS: String(RECONNECT_MS_MAX),
      ARTILLERY_STATUS_AFTER_RECONNECT_LIMIT_MS: String(STATUS_AFTER_RECONNECT_LIMIT_MS),
    };

    mkdirSync(dirname(ARTILLERY_REPORT_FILE), { recursive: true });
    const child = spawn(
      'npx',
      ['artillery', 'run', '--output', ARTILLERY_REPORT_FILE, '500-reconnect-wave.yml'],
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

async function waitForReconnectRevealMoment(hostMonitor, timeoutMs) {
  const startedAt = Date.now();
  let lastJoins = 0;
  let lastReconnects = 0;
  let stableJoinTicks = 0;
  let stableReconnectTicks = 0;

  while (Date.now() - startedAt < timeoutMs) {
    const runtime = readState();
    const joins = runtime.joins ?? 0;
    const reconnects = runtime.reconnects ?? 0;

    if (joins === lastJoins) {
      stableJoinTicks += 1;
    } else {
      stableJoinTicks = 0;
      lastJoins = joins;
    }

    if (reconnects === lastReconnects) {
      stableReconnectTicks += 1;
    } else {
      stableReconnectTicks = 0;
      lastReconnects = reconnects;
    }

    const joinsReady = joins >= PARTICIPANTS * MIN_JOIN_RATIO;
    const reconnectsReady = reconnects >= PARTICIPANTS * MIN_RECONNECT_RATIO;
    const joinStable = stableJoinTicks >= JOIN_STABLE_TICKS;
    const reconnectStable = stableReconnectTicks >= RECONNECT_STABLE_TICKS;

    if (joinsReady && reconnectsReady && joinStable && reconnectStable) {
      return {
        joins,
        reconnects,
        waitedMs: Date.now() - startedAt,
        joinStable,
        reconnectStable,
      };
    }
    await sleep(500);
  }

  const runtime = readState();
  return {
    joins: runtime.joins ?? 0,
    reconnects: runtime.reconnects ?? 0,
    waitedMs: Date.now() - startedAt,
    timedOut: true,
  };
}

async function main() {
  await waitForBackend(TRPC_URL);
  rmSync(STATE_FILE, { force: true });
  rmSync(RESULTS_READY_FILE, { force: true });
  writeFileSync(RESULTS_READY_FILE, '0');

  const session = await createArtilleryReconnectSession(TRPC_URL);
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
    const threshold = await waitForReconnectRevealMoment(
      hostMonitor,
      RAMP_SECONDS * 1000 + RESULTS_WAIT_MS + 60_000,
    );
    if (!threshold.timedOut || threshold.reconnects > 0) {
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
  if (!hostMonitor.state.revealed && (readState().reconnects ?? 0) > 0) {
    await hostMonitor.revealResultsOnce();
    writeFileSync(RESULTS_READY_FILE, '1');
  }

  await sleep(2_000);
  const runtime = readState();
  const publicHttp = createHttpTrpc(TRPC_URL);
  const statusSnapshot = await publicHttp.session.getInfo.query({ code: session.code });

  hostMonitor.stop();

  const reconnects = runtime.reconnects ?? 0;
  const reconnectAvgMs =
    reconnects > 0 ? Math.round((runtime.reconnectMsSum ?? 0) / reconnects) : null;

  const summary = {
    scenario: 'artillery-500-reconnect-wave',
    participantsTarget: PARTICIPANTS,
    sessionCode: session.code,
    layers: {
      http: {
        joins: runtime.joins ?? 0,
        joinErrors: runtime.joinErrors ?? 0,
      },
      websocket: {
        connections: runtime.wsConnections ?? 0,
        statusEvents: runtime.wsStatusEvents ?? 0,
        errors: runtime.wsErrors ?? 0,
        reconnects,
        reconnectErrors: runtime.reconnectErrors ?? 0,
        reconnectResultsSeen: runtime.reconnectResultsSeen ?? 0,
        reconnectResultsMissing: runtime.reconnectResultsMissing ?? 0,
        reconnectMsMax: runtime.reconnectMsMax ?? 0,
        reconnectMsAvg: reconnectAvgMs,
        hostSubscriptionErrors: hostMonitor.state.subscriptionErrors,
        hostStatusMessages: hostMonitor.state.statusMessages,
        hostLastStatus: hostMonitor.state.lastStatus,
        hostResultsSeen: hostMonitor.state.resultsSeenAt !== null,
      },
    },
    reveal: threshold,
    snapshots: {
      sessionStatus: statusSnapshot?.status ?? null,
    },
    limits: {
      reconnectMsMax: RECONNECT_MS_MAX,
      resultsWaitMs: RESULTS_WAIT_MS,
      statusAfterReconnectLimitMs: STATUS_AFTER_RECONNECT_LIMIT_MS,
    },
    artilleryReportFile: ARTILLERY_REPORT_FILE,
    artilleryExitCode,
  };

  console.log(JSON.stringify(summary, null, 2));

  const failures = [];
  if ((runtime.joins ?? 0) < PARTICIPANTS * MIN_JOIN_RATIO) {
    failures.push(`Joins: ${runtime.joins ?? 0}/${PARTICIPANTS}`);
  }
  if (reconnects < PARTICIPANTS * MIN_RECONNECT_RATIO) {
    failures.push(`Reconnects: ${reconnects}/${PARTICIPANTS}`);
  }
  if ((runtime.reconnectResultsSeen ?? 0) < PARTICIPANTS * MIN_RESULTS_AFTER_RECONNECT_RATIO) {
    failures.push(`RESULTS nach Reconnect: ${runtime.reconnectResultsSeen ?? 0}/${PARTICIPANTS}`);
  }
  if ((runtime.wsConnections ?? 0) < PARTICIPANTS * MIN_WS_RATIO) {
    failures.push(`WS-Verbindungen: ${runtime.wsConnections ?? 0}/${PARTICIPANTS}`);
  }
  if ((runtime.reconnectMsMax ?? 0) > RECONNECT_MS_MAX) {
    failures.push(`Reconnect-Latenz max: ${runtime.reconnectMsMax ?? 0}ms > ${RECONNECT_MS_MAX}ms`);
  }
  if (statusSnapshot?.status !== 'RESULTS' && hostMonitor.state.lastStatus !== 'RESULTS') {
    failures.push(
      `Session-Status nicht RESULTS (${statusSnapshot?.status ?? hostMonitor.state.lastStatus})`,
    );
  }
  if ((runtime.reconnectResultsMissing ?? 0) > 0) {
    failures.push(`Reconnect-Assert-Fehler: ${runtime.reconnectResultsMissing}`);
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
      minReconnectRatio: MIN_RECONNECT_RATIO,
      minWsRatio: MIN_WS_RATIO,
      minResultsAfterReconnectRatio: MIN_RESULTS_AFTER_RECONNECT_RATIO,
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

  console.log('\nOK Artillery-500-Reconnect-Welle bestanden.');
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(error);
  await writeScenarioReport({
    scenario: 'artillery-500-reconnect-wave',
    environment: { participants: PARTICIPANTS, rampSeconds: RAMP_SECONDS },
    metrics: { runtimeError: message },
    failures: [message],
  }).catch((reportError) => console.error('Fehlerreport fehlgeschlagen:', reportError));
  process.exitCode = 1;
}
