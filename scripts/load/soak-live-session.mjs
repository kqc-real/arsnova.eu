#!/usr/bin/env node
/**
 * Sicherer Live-Session-Soak-Test.
 *
 * Standard: 5 Minuten, 20 Teilnehmende, wiederholte session-gebundene
 * Blitzlicht-Runden. Längere Läufe explizit aktivieren:
 *   SOAK_DURATION_MINUTES=30 node scripts/load/soak-live-session.mjs
 *   SOAK_DURATION_MINUTES=60 REPORT_FILE=artifacts/soak-60.json node scripts/load/soak-live-session.mjs
 *
 * Konfiguration prüfen, ohne Netzwerkzugriff:
 *   SOAK_VALIDATE_ONLY=1 node scripts/load/soak-live-session.mjs
 */
import { setTimeout as sleep } from 'node:timers/promises';
import { waitForBackend } from './lib/wait-for-backend.mjs';
import { createHttpTrpc, createPublicWsTrpc } from './lib/trpc-runtime.mjs';
import { createRuntimeMetrics } from './lib/runtime-metrics.mjs';
import { writeLoadReport } from './lib/reporting.mjs';

function numberFromEnv(name, defaultValue, { integer = false, min = 0 } = {}) {
  const raw = process.env[name];
  const value = raw === undefined || raw === '' ? defaultValue : Number(raw);
  if (!Number.isFinite(value) || value < min || (integer && !Number.isInteger(value))) {
    throw new Error(`${name} muss eine ${integer ? 'ganze ' : ''}Zahl >= ${min} sein.`);
  }
  return value;
}

function booleanFromEnv(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  if (['1', 'true', 'yes'].includes(raw.toLowerCase())) return true;
  if (['0', 'false', 'no'].includes(raw.toLowerCase())) return false;
  throw new Error(`${name} muss 1/0, true/false oder yes/no sein.`);
}

const config = Object.freeze({
  trpcUrl: String(process.env.TRPC_URL || 'http://127.0.0.1:3000/trpc').trim(),
  wsUrl: String(process.env.WS_URL || 'ws://127.0.0.1:3001').trim(),
  durationMinutes: numberFromEnv('SOAK_DURATION_MINUTES', 5, { min: 0.01 }),
  participants: numberFromEnv('SOAK_PARTICIPANTS', 20, { integer: true, min: 1 }),
  joinWaveSize: numberFromEnv('SOAK_JOIN_WAVE_SIZE', 5, { integer: true, min: 1 }),
  joinWaveDelayMs: numberFromEnv('SOAK_JOIN_WAVE_DELAY_MS', 250, { integer: true, min: 0 }),
  voteConcurrency: numberFromEnv('SOAK_VOTE_CONCURRENCY', 10, { integer: true, min: 1 }),
  cyclePauseMs: numberFromEnv('SOAK_CYCLE_PAUSE_MS', 2_000, { integer: true, min: 1_000 }),
  maxCycles: numberFromEnv('SOAK_MAX_CYCLES', Number.MAX_SAFE_INTEGER, {
    integer: true,
    min: 1,
  }),
  reconnectEveryCycles: numberFromEnv('SOAK_RECONNECT_EVERY_CYCLES', 0, {
    integer: true,
    min: 0,
  }),
  reconnectClients: numberFromEnv('SOAK_RECONNECT_CLIENTS', 5, { integer: true, min: 1 }),
  reconnectTimeoutMs: numberFromEnv('SOAK_RECONNECT_TIMEOUT_MS', 5_000, {
    integer: true,
    min: 500,
  }),
  metricsIntervalMs: numberFromEnv('SOAK_METRICS_INTERVAL_MS', 10_000, {
    integer: true,
    min: 1_000,
  }),
  backendPid:
    process.env.SOAK_BACKEND_PID === undefined
      ? null
      : numberFromEnv('SOAK_BACKEND_PID', null, { integer: true, min: 1 }),
  redisUrl: String(process.env.SOAK_REDIS_URL || '').trim() || null,
  databaseUrl: String(process.env.SOAK_DATABASE_URL || '').trim() || null,
  reportFile: String(process.env.REPORT_FILE || 'artifacts/soak-live-session.json').trim(),
  httpP95LimitMs: numberFromEnv('SOAK_HTTP_P95_LIMIT_MS', 2_000, { min: 1 }),
  eventLoopP99LimitMs: numberFromEnv('SOAK_EVENT_LOOP_P99_LIMIT_MS', 200, { min: 1 }),
  memoryGrowthLimitMb: numberFromEnv('SOAK_MEMORY_GROWTH_LIMIT_MB', 256, { min: 0 }),
  validateOnly: booleanFromEnv('SOAK_VALIDATE_ONLY'),
});

if (!config.trpcUrl || !config.reportFile) {
  throw new Error('TRPC_URL und REPORT_FILE dürfen nicht leer sein.');
}
if (config.reconnectEveryCycles > 0 && !config.wsUrl) {
  throw new Error('WS_URL wird für SOAK_RECONNECT_EVERY_CYCLES > 0 benötigt.');
}

function publicConfig() {
  return {
    ...config,
    redisUrl: config.redisUrl ? '[konfiguriert]' : null,
    databaseUrl: config.databaseUrl ? '[konfiguriert]' : null,
  };
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

function tempoValue(index, cycle) {
  return ['SPEED_UP', 'FOLLOWING', 'SLOW_DOWN', 'LOST'][(index + cycle) % 4];
}

function expectedDistribution(participantCount, cycle) {
  const result = { SPEED_UP: 0, FOLLOWING: 0, SLOW_DOWN: 0, LOST: 0 };
  for (let index = 0; index < participantCount; index += 1) {
    result[tempoValue(index, cycle)] += 1;
  }
  return result;
}

async function joinInWaves(publicTrpc, code, metrics) {
  const participants = [];
  for (let start = 0; start < config.participants; start += config.joinWaveSize) {
    const indexes = Array.from(
      { length: Math.min(config.joinWaveSize, config.participants - start) },
      (_, offset) => start + offset,
    );
    const wave = await Promise.all(
      indexes.map((index) =>
        metrics.measure('session.join', () =>
          publicTrpc.session.join.mutate({
            code,
            nickname: `Soak ${String(index + 1).padStart(3, '0')}`,
          }),
        ),
      ),
    );
    participants.push(...wave);
    if (participants.length < config.participants && config.joinWaveDelayMs > 0) {
      await sleep(config.joinWaveDelayMs);
    }
  }
  return participants;
}

async function simulateReconnectWave(code) {
  const clients = [];
  try {
    const starts = Array.from({ length: config.reconnectClients }, () => {
      const { trpc, wsClient } = createPublicWsTrpc(config.wsUrl);
      let subscription;
      const started = new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error(`WebSocket-Reconnect nach ${config.reconnectTimeoutMs} ms`)),
          config.reconnectTimeoutMs,
        );
        subscription = trpc.session.onStatusChanged.subscribe(
          { code },
          {
            onStarted() {
              clearTimeout(timeout);
              resolve();
            },
            onError(error) {
              clearTimeout(timeout);
              reject(error);
            },
          },
        );
      });
      clients.push({
        close() {
          subscription?.unsubscribe();
          wsClient.close();
        },
      });
      return started;
    });
    await Promise.all(starts);
  } finally {
    for (const client of clients) client.close();
  }
}

async function runCycle({ cycle, code, publicTrpc, hostTrpc, participants, metrics }) {
  const sessionInfo = await metrics.measure('session.getInfo', () =>
    publicTrpc.session.getInfo.query({ code }),
  );
  if (sessionInfo?.status === 'FINISHED') {
    throw new Error(`Zyklus ${cycle}: Session ist unerwartet beendet.`);
  }

  await metrics.measure('quickFeedback.create', () =>
    hostTrpc.quickFeedback.create.mutate({ type: 'TEMPO', sessionCode: code }),
  );

  const votes = await mapLimit(participants, config.voteConcurrency, async (participant, index) => {
    try {
      await metrics.measure('quickFeedback.vote', () =>
        publicTrpc.quickFeedback.vote.mutate({
          sessionCode: code,
          voterId: participant.participantId,
          value: tempoValue(index, cycle),
        }),
      );
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  const voteErrors = votes.filter((vote) => !vote.ok);
  if (voteErrors.length > 0) {
    throw new Error(
      `Zyklus ${cycle}: ${voteErrors.length}/${participants.length} Votes fehlgeschlagen: ${voteErrors[0].error}`,
    );
  }

  const results = await metrics.measure('quickFeedback.hostResults', () =>
    hostTrpc.quickFeedback.hostResults.query({ sessionCode: code }),
  );
  const expected = expectedDistribution(participants.length, cycle);
  const distributionMatches = Object.entries(expected).every(
    ([value, count]) => results?.distribution?.[value] === count,
  );
  if (results?.totalVotes !== participants.length || !distributionMatches) {
    throw new Error(
      `Zyklus ${cycle}: Ergebnis inkonsistent (${results?.totalVotes ?? 'null'}/${participants.length} Votes).`,
    );
  }

  await metrics.measure('quickFeedback.end', () =>
    hostTrpc.quickFeedback.end.mutate({ sessionCode: code }),
  );

  if (config.reconnectEveryCycles > 0 && cycle % config.reconnectEveryCycles === 0) {
    await metrics.measure('websocket.reconnectWave', () => simulateReconnectWave(code));
  }

  return {
    cycle,
    status: sessionInfo.status,
    votes: results.totalVotes,
    distribution: results.distribution,
  };
}

function evaluateGates(metricsReport, functionalErrors) {
  const gates = [];
  gates.push({
    name: 'functional-errors',
    measurable: true,
    limit: 0,
    observed: functionalErrors.length,
    passed: functionalErrors.length === 0,
  });

  const httpMeasurable = metricsReport.targetHttp.successfulSamples > 0;
  gates.push({
    name: 'target-http-p95-ms',
    measurable: httpMeasurable,
    limit: config.httpP95LimitMs,
    observed: metricsReport.targetHttp.p95Ms,
    passed: !httpMeasurable || metricsReport.targetHttp.p95Ms <= config.httpP95LimitMs,
  });

  const eventLoopMeasurable = metricsReport.eventLoop.available;
  gates.push({
    name: 'load-generator-event-loop-p99-ms',
    measurable: eventLoopMeasurable,
    limit: config.eventLoopP99LimitMs,
    observed: metricsReport.eventLoop.p99Ms,
    passed: !eventLoopMeasurable || metricsReport.eventLoop.p99Ms <= config.eventLoopP99LimitMs,
  });

  const memoryGrowth = metricsReport.backendProcess.rssGrowthBytes;
  const memoryMeasurable =
    metricsReport.backendProcess.available === true &&
    metricsReport.backendProcess.samples.filter((sample) => sample.ok).length >= 2 &&
    typeof memoryGrowth === 'number';
  gates.push({
    name: 'backend-rss-growth-mb',
    measurable: memoryMeasurable,
    limit: config.memoryGrowthLimitMb,
    observed: memoryMeasurable ? Math.round((memoryGrowth / 1024 / 1024) * 100) / 100 : null,
    passed: !memoryMeasurable || memoryGrowth <= config.memoryGrowthLimitMb * 1024 * 1024,
  });
  return gates;
}

async function run() {
  if (config.validateOnly) {
    console.log(JSON.stringify({ valid: true, config: publicConfig() }, null, 2));
    return;
  }

  const publicTrpc = createHttpTrpc(config.trpcUrl);
  const metrics = createRuntimeMetrics({
    intervalMs: config.metricsIntervalMs,
    backendPid: config.backendPid,
    redisUrl: config.redisUrl,
    databaseUrl: config.databaseUrl,
    healthStats: () => publicTrpc.health.stats.query(),
  });

  const startedAt = new Date();
  const deadline = Date.now() + config.durationMinutes * 60_000;
  const functionalErrors = [];
  const cycles = [];
  const cleanup = { quickFeedbackEnded: null, sessionEnded: null, errors: [] };
  let code = null;
  let hostTrpc = null;
  let feedbackActive = false;
  let stopSignal = null;
  const onSigint = () => {
    stopSignal ??= 'SIGINT';
  };
  const onSigterm = () => {
    stopSignal ??= 'SIGTERM';
  };
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);

  await metrics.start();
  try {
    await waitForBackend(config.trpcUrl, { attempts: 30 });
    if (stopSignal) throw new Error(`Lauf durch ${stopSignal} abgebrochen.`);
    const created = await metrics.measure('session.create', () =>
      publicTrpc.session.create.mutate({
        type: 'QUIZ',
        quickFeedbackEnabled: true,
        qaEnabled: false,
        title: `Soak Live Session ${Date.now()}`,
        allowCustomNicknames: true,
        nicknameTheme: 'HIGH_SCHOOL',
        anonymousMode: false,
        teamMode: false,
      }),
    );
    code = created.code;
    hostTrpc = createHttpTrpc(config.trpcUrl, created.hostToken);
    const participants = await joinInWaves(publicTrpc, code, metrics);

    for (
      let cycle = 1;
      cycle <= config.maxCycles && Date.now() < deadline && !stopSignal;
      cycle += 1
    ) {
      feedbackActive = true;
      try {
        cycles.push(await runCycle({ cycle, code, publicTrpc, hostTrpc, participants, metrics }));
        feedbackActive = false;
      } catch (error) {
        functionalErrors.push(error instanceof Error ? error.message : String(error));
        break;
      }
      const remainingMs = deadline - Date.now();
      if (remainingMs > 0 && cycle < config.maxCycles) {
        await sleep(Math.min(config.cyclePauseMs, remainingMs));
      }
    }
    if (stopSignal) throw new Error(`Lauf durch ${stopSignal} abgebrochen.`);
  } catch (error) {
    functionalErrors.push(error instanceof Error ? error.message : String(error));
  } finally {
    if (feedbackActive && hostTrpc && code) {
      try {
        await hostTrpc.quickFeedback.end.mutate({ sessionCode: code });
        cleanup.quickFeedbackEnded = true;
      } catch (error) {
        cleanup.quickFeedbackEnded = false;
        cleanup.errors.push(`quickFeedback.end: ${error instanceof Error ? error.message : error}`);
      }
    }
    if (hostTrpc && code) {
      try {
        await hostTrpc.session.end.mutate({ code });
        cleanup.sessionEnded = true;
      } catch (error) {
        cleanup.sessionEnded = false;
        cleanup.errors.push(`session.end: ${error instanceof Error ? error.message : error}`);
      }
    }
    await metrics.stop();
    process.removeListener('SIGINT', onSigint);
    process.removeListener('SIGTERM', onSigterm);
  }

  functionalErrors.push(...cleanup.errors.map((error) => `Cleanup: ${error}`));
  const metricsReport = metrics.report();
  const gates = evaluateGates(metricsReport, functionalErrors);
  const report = {
    schemaVersion: 1,
    scenario: 'soak-live-session',
    startedAt: startedAt.toISOString(),
    endedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    config: publicConfig(),
    session: { code, completedCycles: cycles.length },
    cycles,
    functionalErrors,
    cleanup,
    metrics: metricsReport,
    gates,
    passed: gates.every((gate) => gate.passed),
  };
  await writeLoadReport(
    config.reportFile,
    {
      scenario: report.scenario,
      environment: report.config,
      metrics: {
        durationMs: report.durationMs,
        session: report.session,
        cycles: report.cycles,
        runtime: report.metrics,
        cleanup: report.cleanup,
      },
      assertions: report.gates.map((gate) => ({
        name: gate.name,
        passed: gate.passed,
        actual: gate.observed,
        expected: gate.limit,
        measurable: gate.measurable,
      })),
    },
    { junitPath: process.env.JUNIT_FILE || undefined },
  );
  console.log(
    `Soak ${report.passed ? 'BESTANDEN' : 'FEHLGESCHLAGEN'}: ${cycles.length} Zyklen, Report ${config.reportFile}`,
  );
  if (!report.passed) process.exitCode = 1;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
