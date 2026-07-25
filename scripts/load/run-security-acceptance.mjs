#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeJsonAtomic } from './lib/reporting.mjs';
import {
  ISOLATED_APPROVAL,
  PRODUCTION_APPROVAL,
  assertAbuseRunAuthorized,
} from './security-abuse-parallel.mjs';
import { buildHealthCheckUrl } from './lib/wait-for-backend.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_CONFIG = resolve(ROOT, 'scripts/load/security-acceptance.config.json');
const REQUIRED_COVERAGE = new Set([
  'same-nat-500',
  'enumeration',
  'websocket-burst',
  'reconnect-wave',
  'vote-burst',
  'pdf-vs-vote',
  'metrics',
  'recovery',
  'parallel-abuse',
]);
const REQUIRED_SLOS = new Set([
  'join',
  'vote',
  'websocket',
  'reconnect',
  'pdf-vs-vote',
  'live-error-rate',
]);
const MAX_APPROVAL_WINDOW_MS = 4 * 60 * 60 * 1_000;
const HEALTH_FAILURE_WINDOW_MS = 30_000;
const HEALTH_INTERVAL_MS = 5_000;

const RUNNERS = {
  'artillery-live-500': {
    script: 'scripts/load/run-artillery-500.mjs',
    expectedScenario: 'artillery-500-live-session',
    timeoutMs: 15 * 60_000,
  },
  'artillery-reconnect-500': {
    script: 'scripts/load/run-artillery-reconnect-500.mjs',
    expectedScenario: 'artillery-500-reconnect-wave',
    timeoutMs: 15 * 60_000,
  },
  'vote-burst-500': {
    script: 'scripts/load/vote-timer-fairness-600.mjs',
    expectedScenario: 'vote-timer-fairness-600',
    timeoutMs: 15 * 60_000,
  },
  'pdf-vs-vote-500': {
    script: 'scripts/load/pdf-vs-live-voting-500.mjs',
    expectedScenario: 'pdf-vs-live-voting-500',
    timeoutMs: 30 * 60_000,
  },
  'security-abuse': {
    script: 'scripts/load/security-abuse-parallel.mjs',
    expectedScenario: 'security-abuse-parallel',
    timeoutMs: 30 * 60_000,
    env: { ABUSE_VALID_JOINS: '50', ABUSE_CODE_GUESSES: '25', ABUSE_CREATE_ATTEMPTS: '15' },
  },
  'soak-recovery': {
    script: 'scripts/load/soak-live-session.mjs',
    expectedScenario: 'soak-live-session',
    timeoutMs: 10 * 60_000,
    env: { SOAK_DURATION_MINUTES: '5', SOAK_REQUIRE_EXTERNAL_PROBES: '1' },
  },
};

function requireObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} muss ein JSON-Objekt sein.`);
  }
  return value;
}

function assertExactSet(actual, required, label) {
  const actualSet = new Set(actual);
  const missing = [...required].filter((value) => !actualSet.has(value));
  const unknown = [...actualSet].filter((value) => !required.has(value));
  if (missing.length > 0 || unknown.length > 0) {
    throw new Error(
      `${label} unvollständig (fehlend: ${missing.join(', ') || '-'}; unbekannt: ${unknown.join(', ') || '-'}).`,
    );
  }
}

function requireFiniteNumber(object, key, label, { minimum = 0, maximum = Infinity } = {}) {
  const value = object[key];
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label}.${key} muss zwischen ${minimum} und ${maximum} liegen.`);
  }
  return value;
}

function validateSlos(slos) {
  const byId = Object.fromEntries(slos.map((slo) => [slo.id, requireObject(slo, `SLO ${slo.id}`)]));
  for (const id of ['join', 'vote']) {
    const slo = byId[id];
    const p95 = requireFiniteNumber(slo, 'p95Ms', id, { minimum: 1 });
    const p99 = requireFiniteNumber(slo, 'p99Ms', id, { minimum: p95 });
    requireFiniteNumber(slo, 'errorRateExclusiveMax', id, { minimum: 0, maximum: 0.1 });
    if (p99 < p95) throw new Error(`${id}.p99Ms darf nicht kleiner als p95Ms sein.`);
  }
  const websocket = byId.websocket;
  requireFiniteNumber(websocket, 'connectionRatioMin', 'websocket', { minimum: 0.9, maximum: 1 });
  const statusP95 = requireFiniteNumber(websocket, 'statusP95Ms', 'websocket', { minimum: 1 });
  requireFiniteNumber(websocket, 'statusP99Ms', 'websocket', { minimum: statusP95 });
  const reconnect = byId.reconnect;
  requireFiniteNumber(reconnect, 'withinMs', 'reconnect', { minimum: 1, maximum: 60_000 });
  requireFiniteNumber(reconnect, 'ratioMin', 'reconnect', { minimum: 0.9, maximum: 1 });
  const pdf = byId['pdf-vs-vote'];
  const pdfP95 = requireFiniteNumber(pdf, 'p95Ms', 'pdf-vs-vote', { minimum: 1 });
  requireFiniteNumber(pdf, 'p99Ms', 'pdf-vs-vote', { minimum: pdfP95 });
  requireFiniteNumber(pdf, 'errorRateExclusiveMax', 'pdf-vs-vote', {
    minimum: 0,
    maximum: 0.1,
  });
  requireFiniteNumber(pdf, 'pdfConcurrencyCap', 'pdf-vs-vote', { minimum: 1, maximum: 2 });
  const liveErrorRate = requireFiniteNumber(
    byId['live-error-rate'],
    'errorRateExclusiveMax',
    'live-error-rate',
    {
      minimum: 0,
      maximum: 0.1,
    },
  );
  if (
    byId.join.errorRateExclusiveMax !== liveErrorRate ||
    byId.vote.errorRateExclusiveMax !== liveErrorRate
  ) {
    throw new Error('Join-, Vote- und Live-Fehlerquote müssen identisch konfiguriert sein.');
  }
  return byId;
}

function runnerEnvironment(id, slos) {
  const common = RUNNERS[id].env ?? {};
  switch (id) {
    case 'artillery-live-500':
      return {
        ...common,
        PARTICIPANTS: '500',
        ARTILLERY_MIN_JOIN_RATIO: String(1 - slos.join.errorRateExclusiveMax),
        ARTILLERY_MIN_VOTE_RATIO: String(1 - slos.vote.errorRateExclusiveMax),
        ARTILLERY_MIN_WS_RATIO: String(slos.websocket.connectionRatioMin),
        ARTILLERY_JOIN_P95_LIMIT_MS: String(slos.join.p95Ms),
        ARTILLERY_JOIN_P99_LIMIT_MS: String(slos.join.p99Ms),
        ARTILLERY_STATUS_P95_LIMIT_MS: String(slos.websocket.statusP95Ms),
        ARTILLERY_STATUS_P99_LIMIT_MS: String(slos.websocket.statusP99Ms),
      };
    case 'artillery-reconnect-500':
      return {
        ...common,
        PARTICIPANTS: '500',
        ARTILLERY_MIN_JOIN_RATIO: String(1 - slos.join.errorRateExclusiveMax),
        ARTILLERY_MIN_RECONNECT_RATIO: String(slos.reconnect.ratioMin),
        ARTILLERY_MIN_WS_RATIO: String(slos.websocket.connectionRatioMin),
        ARTILLERY_RECONNECT_MS_MAX: String(slos.reconnect.withinMs),
      };
    case 'vote-burst-500':
      return {
        ...common,
        PARTICIPANTS: '500',
        VOTE_P95_LIMIT_MS: String(slos.vote.p95Ms),
        VOTE_P99_LIMIT_MS: String(slos.vote.p99Ms),
      };
    case 'pdf-vs-vote-500':
      return {
        ...common,
        PARTICIPANTS: '500',
        EXPECTED_PDF_CAP: String(slos['pdf-vs-vote'].pdfConcurrencyCap),
        VOTE_P95_LIMIT_MS: String(slos['pdf-vs-vote'].p95Ms),
        VOTE_P99_LIMIT_MS: String(slos['pdf-vs-vote'].p99Ms),
        VOTE_ERROR_RATE_LIMIT: String(slos['pdf-vs-vote'].errorRateExclusiveMax),
      };
    default:
      return { ...common };
  }
}

export function validateAcceptanceConfig(config) {
  requireObject(config, 'config');
  if (config.schemaVersion !== 1 || config.id !== 'security-hardening-section-6.5') {
    throw new Error('Unbekannte §6.5-Konfigurationsversion.');
  }
  requireObject(config.target, 'target');
  if (
    config.target.nodeMajor !== 24 ||
    config.target.deployment !== 'production-image' ||
    config.target.ingress !== 'nginx' ||
    config.target.dataClass !== 'isolated-ephemeral' ||
    config.target.loadGeneratorNetwork !== 'single-source-nat'
  ) {
    throw new Error(
      'Zielprofil muss Node 24, Produktionsimage, Nginx und isolierte Daten festschreiben.',
    );
  }
  assertExactSet(config.target.dependencies, new Set(['postgresql', 'redis']), 'Dependencies');
  assertExactSet(config.coverage, REQUIRED_COVERAGE, '§6.5-Coverage');
  if (!Array.isArray(config.slos) || config.slos.length !== REQUIRED_SLOS.size) {
    throw new Error('Produkt-SLOs müssen jeden Eintrag genau einmal enthalten.');
  }
  assertExactSet(
    config.slos.map((slo) => slo.id),
    REQUIRED_SLOS,
    'Produkt-SLOs',
  );
  validateSlos(config.slos);
  if (!Array.isArray(config.phases) || config.phases.length === 0) {
    throw new Error('Mindestens eine Abnahmephase ist erforderlich.');
  }
  const covered = [];
  for (const phase of config.phases) {
    requireObject(phase, `phase ${phase?.id ?? '?'}`);
    if (!Array.isArray(phase.runners) || phase.runners.length === 0) {
      throw new Error(`Phase ${phase.id} hat keine Runner.`);
    }
    for (const runner of phase.runners) {
      if (!Object.hasOwn(RUNNERS, runner)) throw new Error(`Unbekannter Runner: ${runner}`);
    }
    if (phase.id === 'pdf-vote-with-abuse' && (!phase.parallel || phase.runners.length !== 2)) {
      throw new Error('PDF-vs.-Voting und Abuse müssen als gemeinsame Parallelphase laufen.');
    }
    covered.push(...phase.covers);
  }
  assertExactSet(covered, REQUIRED_COVERAGE, 'Phasen-Coverage');
  const recoveryIndex = config.phases.findIndex((phase) => phase.id === 'recovery');
  const abuseIndex = config.phases.findIndex((phase) => phase.id === 'pdf-vote-with-abuse');
  if (recoveryIndex < 0 || abuseIndex < 0 || recoveryIndex >= abuseIndex) {
    throw new Error('Recovery muss vor dem Session-Create-Abuse laufen.');
  }
  if (!Array.isArray(config.abortCriteria) || config.abortCriteria.length < 5) {
    throw new Error('Abort-Kriterien sind unvollständig.');
  }
  return config;
}

export function buildAcceptancePlan(config, artifactDirectory) {
  validateAcceptanceConfig(config);
  const slos = validateSlos(config.slos);
  return config.phases.map((phase) => ({
    id: phase.id,
    parallel: phase.parallel,
    covers: phase.covers,
    runners: phase.runners.map((id) => ({
      id,
      command: [process.execPath, RUNNERS[id].script],
      expectedScenario: RUNNERS[id].expectedScenario,
      reportFile: resolve(artifactDirectory, `${id}.json`),
      junitFile: resolve(artifactDirectory, `${id}.junit.xml`),
      timeoutMs: RUNNERS[id].timeoutMs,
      env: runnerEnvironment(id, slos),
    })),
  }));
}

function productionTarget(trpcUrl) {
  if (!trpcUrl) return false;
  const hostname = new URL(trpcUrl).hostname.toLowerCase();
  return hostname === 'arsnova.eu' || hostname.endsWith('.arsnova.eu');
}

export function validateTargetEvidence(evidence, env, now = Date.now()) {
  requireObject(evidence, 'targetEvidence');
  if (evidence.schemaVersion !== 1) {
    throw new Error('Unbekannte Zielhost-Evidenzversion.');
  }
  const requiredStrings = [
    'operator',
    'approvedAt',
    'expiresAt',
    'gitCommit',
    'nodeVersion',
    'image',
    'trpcUrl',
    'wsUrl',
  ];
  for (const key of requiredStrings) {
    if (typeof evidence[key] !== 'string' || evidence[key].trim() === '') {
      throw new Error(`targetEvidence.${key} fehlt.`);
    }
  }
  if (
    !evidence.nodeVersion.startsWith('24.') ||
    evidence.ingress !== 'nginx' ||
    evidence.postgresql !== true ||
    evidence.redis !== true ||
    evidence.disposableData !== true ||
    evidence.singleSourceNat !== true
  ) {
    throw new Error('Zielhost-Evidenz erfüllt das verbindliche Produktionsprofil nicht.');
  }
  if (!/^[\w./:-]+@sha256:[a-f0-9]{64}$/.test(evidence.image)) {
    throw new Error('targetEvidence.image muss einen unveränderlichen sha256-Digest enthalten.');
  }
  if (!/^[a-f0-9]{40}$/.test(evidence.gitCommit)) {
    throw new Error('targetEvidence.gitCommit muss ein vollständiger 40-stelliger Commit sein.');
  }
  if (env.LOAD_ACCEPTANCE_EXPECTED_COMMIT !== evidence.gitCommit) {
    throw new Error(
      'LOAD_ACCEPTANCE_EXPECTED_COMMIT stimmt nicht mit der Zielhost-Evidenz überein.',
    );
  }
  if (
    String(env.TRPC_URL || '').replace(/\/$/, '') !== evidence.trpcUrl.replace(/\/$/, '') ||
    String(env.WS_URL || '').replace(/\/$/, '') !== evidence.wsUrl.replace(/\/$/, '')
  ) {
    throw new Error('TRPC_URL/WS_URL stimmen nicht mit der Zielhost-Evidenz überein.');
  }
  new URL(evidence.trpcUrl);
  new URL(evidence.wsUrl);
  if (!/^https?:$/.test(new URL(evidence.trpcUrl).protocol)) {
    throw new Error('targetEvidence.trpcUrl muss HTTP(S) verwenden.');
  }
  if (!/^wss?:$/.test(new URL(evidence.wsUrl).protocol)) {
    throw new Error('targetEvidence.wsUrl muss WS(S) verwenden.');
  }
  if (String(env.TRPC_URLS || '').trim() || String(env.ARTILLERY_HTTP_TARGET || '').trim()) {
    throw new Error('Alternative Zielvariablen TRPC_URLS/ARTILLERY_HTTP_TARGET sind unzulässig.');
  }
  const approvedAt = Date.parse(evidence.approvedAt);
  const expiresAt = Date.parse(evidence.expiresAt);
  if (
    !Number.isFinite(approvedAt) ||
    !Number.isFinite(expiresAt) ||
    approvedAt > now ||
    expiresAt <= now ||
    expiresAt - approvedAt > MAX_APPROVAL_WINDOW_MS
  ) {
    throw new Error('Zielhost-Freigabe ist ungültig, abgelaufen oder länger als vier Stunden.');
  }
  return evidence;
}

export function assertAcceptanceExecutionAuthorized(env, trpcUrl, evidence) {
  if (Number(process.versions.node.split('.')[0]) !== 24) {
    throw new Error('Die formale Abnahme muss mit Node 24 orchestriert werden.');
  }
  assertAbuseRunAuthorized(env, trpcUrl);
  validateTargetEvidence(evidence, env);
  const effectiveTargets = [trpcUrl, String(env.WS_URL || '')];
  if (
    effectiveTargets.some((target) => productionTarget(target)) &&
    env.LOAD_ACCEPTANCE_PRODUCTION_APPROVED !== PRODUCTION_APPROVAL
  ) {
    throw new Error('Produktionslast ist ohne separate schriftliche Userfreigabe gesperrt.');
  }
}

async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

export function validateScenarioReport(report, expectedScenario) {
  requireObject(report, expectedScenario);
  if (report.schemaVersion !== 1 || report.scenario !== expectedScenario) {
    throw new Error(`Ungültiger Report für ${expectedScenario}.`);
  }
  if (!Array.isArray(report.assertions) || report.assertions.length === 0) {
    throw new Error(`Report ${expectedScenario} enthält keine Assertions.`);
  }
  const failed = report.assertions.filter((assertion) => assertion?.passed !== true);
  if (failed.length > 0)
    throw new Error(`Report ${expectedScenario} enthält fehlgeschlagene Assertions.`);
  return report;
}

export function sanitizeChildEnvironment(env) {
  return {
    ...env,
    TRPC_URLS: '',
    ARTILLERY_HTTP_TARGET: '',
    BASE_URL: '',
  };
}

export function validateSoakProbeEnvironment(env) {
  for (const name of ['SOAK_BACKEND_PID', 'SOAK_REDIS_URL', 'SOAK_DATABASE_URL']) {
    if (typeof env[name] !== 'string' || env[name].trim() === '') {
      throw new Error(`${name} ist für die formale Recovery-Abnahme erforderlich.`);
    }
  }
  if (!/^[1-9]\d*$/.test(env.SOAK_BACKEND_PID)) {
    throw new Error('SOAK_BACKEND_PID muss eine positive Ganzzahl sein.');
  }
  new URL(env.SOAK_REDIS_URL);
  new URL(env.SOAK_DATABASE_URL);
}

function signalProcessTree(child, signal) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  try {
    if (process.platform !== 'win32') process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      // Prozess ist zwischen Statusprüfung und Signal bereits beendet.
    }
  }
}

function startChild(runner, commonEnv) {
  const child = spawn(runner.command[0], runner.command.slice(1), {
    cwd: ROOT,
    detached: process.platform !== 'win32',
    env: sanitizeChildEnvironment({
      ...process.env,
      ...commonEnv,
      ...runner.env,
      REPORT_FILE: runner.reportFile,
      JUNIT_FILE: runner.junitFile,
    }),
    stdio: 'inherit',
  });
  let timeout;
  let settled = false;
  let resolveCompletion;
  let rejectCompletion;
  const completion = new Promise((resolvePromise, rejectPromise) => {
    resolveCompletion = resolvePromise;
    rejectCompletion = rejectPromise;
  });
  const finish = (error) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    if (error) rejectCompletion(error);
    else resolveCompletion();
  };
  child.once('error', (error) => finish(error));
  child.once('exit', (code, signal) => {
    if (code === 0) finish();
    else finish(new Error(`${runner.id} abgebrochen (code=${code}, signal=${signal ?? '-'}).`));
  });
  timeout = setTimeout(() => {
    signalProcessTree(child, 'SIGTERM');
    finish(new Error(`${runner.id} überschritt das Hard-Timeout von ${runner.timeoutMs} ms.`));
  }, runner.timeoutMs);

  return {
    completion,
    async terminate() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      signalProcessTree(child, 'SIGTERM');
      await Promise.race([
        new Promise((resolvePromise) => child.once('exit', resolvePromise)),
        new Promise((resolvePromise) =>
          setTimeout(() => {
            signalProcessTree(child, 'SIGKILL');
            resolvePromise();
          }, 2_000),
        ),
      ]);
    },
  };
}

export function monitorTargetHealth(
  trpcUrl,
  {
    failureWindowMs = HEALTH_FAILURE_WINDOW_MS,
    intervalMs = HEALTH_INTERVAL_MS,
    fetchFn = fetch,
  } = {},
) {
  let stopped = false;
  let sleepTimer;
  let wakeSleep;
  const stop = () => {
    stopped = true;
    clearTimeout(sleepTimer);
    wakeSleep?.();
  };
  const sleep = () =>
    new Promise((resolvePromise) => {
      wakeSleep = resolvePromise;
      sleepTimer = setTimeout(resolvePromise, intervalMs);
    });
  const promise = (async () => {
    let failureStartedAt = null;
    const healthUrl = buildHealthCheckUrl(trpcUrl);
    while (!stopped) {
      let healthy = false;
      const checkStartedAt = Date.now();
      try {
        const response = await fetchFn(healthUrl, { signal: AbortSignal.timeout(5_000) });
        healthy = response.ok === true;
      } catch {
        healthy = false;
      }
      if (stopped) return;
      if (healthy) {
        failureStartedAt = null;
      } else {
        failureStartedAt ??= checkStartedAt;
        if (Date.now() - failureStartedAt >= failureWindowMs) {
          throw new Error(`Backend-Health seit mindestens ${failureWindowMs} ms nicht erreichbar.`);
        }
      }
      if (!stopped) await sleep();
    }
  })();
  return { promise, stop };
}

export async function runPhase(phase, commonEnv, { monitor } = {}) {
  const handles = phase.runners.map((runner) => startChild(runner, commonEnv));
  try {
    const completions = Promise.all(handles.map((handle) => handle.completion));
    if (monitor) await Promise.race([completions, monitor.promise]);
    else await completions;
  } catch (error) {
    await Promise.allSettled(handles.map((handle) => handle.terminate()));
    throw error;
  } finally {
    monitor?.stop();
  }
}

async function executePlan(config, plan, artifactDirectory, evidence) {
  const reports = {};
  const phaseSignal = resolve(artifactDirectory, '.pdf-vote-with-abuse.ready');
  await mkdir(artifactDirectory, { recursive: true });
  await rm(phaseSignal, { force: true });
  for (const phase of plan) {
    const commonEnv = {
      LOAD_ACCEPTANCE_APPROVED: ISOLATED_APPROVAL,
      LOAD_ACCEPTANCE_PHASE_SIGNAL: phaseSignal,
    };
    const executablePhase = phase.parallel ? phase : { ...phase, runners: [phase.runners[0]] };
    await runPhase(executablePhase, commonEnv, {
      monitor: monitorTargetHealth(evidence.trpcUrl),
    });
    for (const runner of phase.runners) {
      reports[runner.id] = validateScenarioReport(
        await loadJson(runner.reportFile),
        runner.expectedScenario,
      );
    }
  }
  await rm(phaseSignal, { force: true });
  const manifest = {
    schemaVersion: 1,
    kind: 'security-load-acceptance',
    status: 'RUN_COMPLETE_AWAITING_SLO_REVIEW',
    generatedAt: new Date().toISOString(),
    configId: config.id,
    target: {
      gitCommit: evidence.gitCommit,
      nodeVersion: evidence.nodeVersion,
      image: evidence.image,
      trpcUrl: evidence.trpcUrl,
      wsUrl: evidence.wsUrl,
      ingress: evidence.ingress,
      postgresql: evidence.postgresql,
      redis: evidence.redis,
      disposableData: evidence.disposableData,
      singleSourceNat: evidence.singleSourceNat,
    },
    operator: evidence.operator,
    coverage: config.coverage,
    slos: config.slos,
    reports: Object.fromEntries(
      Object.entries(reports).map(([id, report]) => [
        id,
        {
          file: plan.flatMap((phase) => phase.runners).find((runner) => runner.id === id)
            .reportFile,
          timestamp: report.timestamp,
        },
      ]),
    ),
    releaseDecision: null,
  };
  await writeJsonAtomic(resolve(artifactDirectory, 'acceptance-manifest.json'), manifest);
  return manifest;
}

export function parseArguments(argv) {
  const modes = argv.filter((argument) => ['--validate', '--plan', '--execute'].includes(argument));
  if (modes.length !== 1)
    throw new Error('Genau einer der Modi --validate, --plan, --execute ist erforderlich.');
  const valueAfter = (flag) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  return {
    mode: modes[0],
    configPath: resolve(valueAfter('--config') || DEFAULT_CONFIG),
    artifactDirectory: resolve(valueAfter('--artifacts') || 'artifacts/security-acceptance'),
    evidencePath: valueAfter('--target-evidence')
      ? resolve(valueAfter('--target-evidence'))
      : undefined,
  };
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const config = validateAcceptanceConfig(await loadJson(args.configPath));
  const plan = buildAcceptancePlan(config, args.artifactDirectory);
  if (args.mode === '--validate') {
    console.log('§6.5-Konfiguration gültig; keine Requests gesendet.');
    return;
  }
  if (args.mode === '--plan') {
    console.log(JSON.stringify({ target: config.target, slos: config.slos, plan }, null, 2));
    return;
  }
  if (!args.evidencePath) throw new Error('--target-evidence ist für --execute erforderlich.');
  const evidence = await loadJson(args.evidencePath);
  const trpcUrl = String(process.env.TRPC_URL || '').trim();
  const wsUrl = String(process.env.WS_URL || '').trim();
  if (!trpcUrl || !wsUrl) throw new Error('TRPC_URL und WS_URL sind für --execute erforderlich.');
  if (String(process.env.ADMIN_DIAGNOSTIC_SECRET || '').trim().length < 32) {
    throw new Error('Ein separates starkes ADMIN_DIAGNOSTIC_SECRET ist erforderlich.');
  }
  validateSoakProbeEnvironment(process.env);
  assertAcceptanceExecutionAuthorized(process.env, trpcUrl, evidence);
  console.log(
    JSON.stringify(await executePlan(config, plan, args.artifactDirectory, evidence), null, 2),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
