#!/usr/bin/env node
/**
 * Dauerlast: vollständige Demo-Quiz-Classrooms mit Monitoring-Zeitreihe.
 *
 * Standardlauf:
 *   ADMIN_DIAGNOSTIC_SECRET=... npm run load:duration:demo-classroom
 */
import { runDemoQuizClassroom } from './demo-quiz-classroom-30.mjs';
import { evaluateDemoDurationRun } from './lib/demo-duration-evaluation.mjs';
import {
  classroomRunOptions,
  resolveReportPaths,
  waitForCooldown,
} from './lib/demo-duration-runner.mjs';
import { writeLoadReport } from './lib/reporting.mjs';
import { createRuntimeMetrics } from './lib/runtime-metrics.mjs';
import { createHttpTrpc } from './lib/trpc-runtime.mjs';
import { waitForBackend } from './lib/wait-for-backend.mjs';

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

const reportFile = String(
  process.env.REPORT_FILE || 'artifacts/demo-quiz-duration-monitoring.json',
).trim();
const reportPaths = resolveReportPaths(reportFile, process.env.JUNIT_FILE);
const config = Object.freeze({
  trpcUrl: String(process.env.TRPC_URL || 'http://127.0.0.1:3000/trpc').trim(),
  durationMinutes: numberFromEnv('DEMO_DURATION_MINUTES', 10, { min: 0.1 }),
  participants: numberFromEnv('PARTICIPANTS', 30, { integer: true, min: 1 }),
  metricsIntervalMs: numberFromEnv('DEMO_MONITOR_INTERVAL_MS', 5_000, {
    integer: true,
    min: 1_000,
  }),
  initialRoundBudgetMs: numberFromEnv('DEMO_ROUND_MIN_BUDGET_MS', 20_000, {
    integer: true,
    min: 1_000,
  }),
  roundSafetyFactor: numberFromEnv('DEMO_ROUND_SAFETY_FACTOR', 1.25, { min: 1 }),
  httpP95LimitMs: numberFromEnv('DEMO_HTTP_P95_LIMIT_MS', 2_000, { min: 1 }),
  memoryGrowthLimitMb: numberFromEnv('DEMO_MEMORY_GROWTH_LIMIT_MB', 256, { min: 0 }),
  backendPid:
    process.env.DEMO_BACKEND_PID || process.env.SOAK_BACKEND_PID
      ? numberFromEnv(
          process.env.DEMO_BACKEND_PID ? 'DEMO_BACKEND_PID' : 'SOAK_BACKEND_PID',
          null,
          { integer: true, min: 1 },
        )
      : null,
  redisUrl:
    String(
      process.env.DEMO_REDIS_URL || process.env.SOAK_REDIS_URL || process.env.REDIS_URL || '',
    ).trim() || null,
  databaseUrl:
    String(
      process.env.DEMO_DATABASE_URL ||
        process.env.SOAK_DATABASE_URL ||
        process.env.DATABASE_URL ||
        '',
    ).trim() || null,
  requireRss: booleanFromEnv('DEMO_REQUIRE_RSS'),
  ...reportPaths,
});

const diagnosticSecret = String(process.env.ADMIN_DIAGNOSTIC_SECRET || '');
if (diagnosticSecret.length < 32) {
  throw new Error('ADMIN_DIAGNOSTIC_SECRET fehlt oder ist kürzer als 32 Zeichen.');
}
const target = new URL(config.trpcUrl);
if (!['127.0.0.1', 'localhost', '::1'].includes(target.hostname)) {
  throw new Error('Dieser Dauerlasttest ist ausschließlich für ein lokales Backend freigegeben.');
}

function publicConfig() {
  return {
    trpcUrl: config.trpcUrl,
    durationMinutes: config.durationMinutes,
    participants: config.participants,
    metricsIntervalMs: config.metricsIntervalMs,
    initialRoundBudgetMs: config.initialRoundBudgetMs,
    roundSafetyFactor: config.roundSafetyFactor,
    httpP95LimitMs: config.httpP95LimitMs,
    memoryGrowthLimitMb: config.memoryGrowthLimitMb,
    requireRss: config.requireRss,
    backendPidConfigured: config.backendPid !== null,
    redisProbeConfigured: config.redisUrl !== null,
    postgresProbeConfigured: config.databaseUrl !== null,
  };
}

async function run() {
  await waitForBackend(config.trpcUrl, { attempts: 30 });
  const publicTrpc = createHttpTrpc(config.trpcUrl);
  const diagnosticTrpc = createHttpTrpc(config.trpcUrl, undefined, undefined, diagnosticSecret);
  const runtimeMetrics = createRuntimeMetrics({
    intervalMs: config.metricsIntervalMs,
    backendPid: config.backendPid,
    redisUrl: config.redisUrl,
    databaseUrl: config.databaseUrl,
    healthCheck: () => publicTrpc.health.check.query(),
    healthStats: () => publicTrpc.health.stats.query(),
    securityStats: () => diagnosticTrpc.health.securityStats.query(),
  });
  const startedAt = new Date();
  const deadline = startedAt.getTime() + config.durationMinutes * 60_000;
  const rounds = [];
  const roundErrors = [];
  let estimatedRoundMs = config.initialRoundBudgetMs;
  let stopSignal = null;
  const cooldownAbortController = new AbortController();
  const onSigint = () => {
    stopSignal ??= 'SIGINT';
    cooldownAbortController.abort();
  };
  const onSigterm = () => {
    stopSignal ??= 'SIGTERM';
    cooldownAbortController.abort();
  };
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);

  await runtimeMetrics.start();
  try {
    while (!stopSignal) {
      const remainingMs = deadline - Date.now();
      if (remainingMs < estimatedRoundMs) break;
      const roundNumber = rounds.length + 1;
      const roundStarted = Date.now();
      console.log(
        `Demo-Runde ${roundNumber} startet (${Math.ceil(remainingMs / 1_000)} s Restbudget).`,
      );
      try {
        const result = await runDemoQuizClassroom(classroomRunOptions(config, runtimeMetrics));
        const durationMs = Date.now() - roundStarted;
        rounds.push({
          round: roundNumber,
          ...result,
          durationMs,
        });
        estimatedRoundMs = Math.max(
          config.initialRoundBudgetMs,
          Math.ceil(
            Math.max(...rounds.map((round) => round.durationMs)) * config.roundSafetyFactor,
          ),
        );
        console.log(
          `Demo-Runde ${roundNumber} ${result.failures.length === 0 ? 'grün' : 'fehlgeschlagen'} (${durationMs} ms).`,
        );
        if (result.failures.length > 0) {
          roundErrors.push(...result.failures.map((message) => `Runde ${roundNumber}: ${message}`));
          break;
        }
      } catch (error) {
        roundErrors.push(
          `Runde ${roundNumber}: ${error instanceof Error ? error.message : String(error)}`,
        );
        break;
      }
    }

    if (!stopSignal) {
      const cooldownMs = Math.max(0, deadline - Date.now());
      if (cooldownMs > 0) {
        console.log(`Cooldown bis Messende (${Math.ceil(cooldownMs / 1_000)} s).`);
        await waitForCooldown(cooldownMs, cooldownAbortController.signal);
      }
    }
    if (stopSignal) {
      roundErrors.push(`Lauf durch ${stopSignal} abgebrochen.`);
    }
    await runtimeMetrics.sample('POST');
  } finally {
    await runtimeMetrics.stop();
    process.removeListener('SIGINT', onSigint);
    process.removeListener('SIGTERM', onSigterm);
  }

  const endedAt = new Date();
  const runtime = runtimeMetrics.report();
  const evaluation = evaluateDemoDurationRun({
    runtime,
    rounds,
    roundErrors,
    participants: config.participants,
    httpP95LimitMs: config.httpP95LimitMs,
    memoryGrowthLimitMb: config.memoryGrowthLimitMb,
    requireRss: config.requireRss,
    backendPidConfigured: config.backendPid !== null,
    redisConfigured: config.redisUrl !== null,
    postgresConfigured: config.databaseUrl !== null,
  });
  const report = await writeLoadReport(
    config.reportFile,
    {
      scenario: 'demo-quiz-duration-monitoring',
      timestamp: startedAt,
      environment: publicConfig(),
      metrics: {
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs: endedAt.getTime() - startedAt.getTime(),
        estimatedRoundMs,
        rounds,
        roundErrors,
        runtime,
        summary: evaluation.summary,
      },
      assertions: evaluation.assertions,
    },
    { junitPath: config.junitFile },
  );

  console.log(
    `${evaluation.passed ? 'BESTANDEN' : 'FEHLGESCHLAGEN'}: ${rounds.length} vollständige Demo-Runden, ${evaluation.summary.acceptedVotes} Votes.`,
  );
  console.log(`JSON: ${config.reportFile}`);
  console.log(`JUnit: ${config.junitFile}`);
  if (!evaluation.passed) {
    for (const failed of report.assertions.filter((entry) => !entry.passed)) {
      console.error(`- ${failed.name}: ${failed.message ?? JSON.stringify(failed.actual)}`);
    }
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
