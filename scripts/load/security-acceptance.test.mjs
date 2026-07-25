import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { access, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  buildAcceptancePlan,
  createAcceptanceRunContext,
  assertExecutionNotCancelled,
  installTerminationSignalHandlers,
  monitorTargetHealth,
  parseArguments,
  productionTarget,
  preparePhaseArtifacts,
  runArtifactDirectory,
  runPhase,
  sanitizeChildEnvironment,
  terminateActiveChildren,
  validateAcceptanceConfig,
  validateAcceptanceManifest,
  validateEvidenceEnvelope,
  validateHarnessCheckout,
  validateRunnerArtifacts,
  validateScenarioReport,
  validateSoakProbeEnvironment,
  validateTargetEvidence,
} from './run-security-acceptance.mjs';
import {
  summarizeDurations,
  violatesExclusiveRate,
  violatesExclusiveUpperBound,
} from './lib/percentiles.mjs';
import { parseReconnectLimitMs } from './lib/reconnect-threshold.mjs';
import { isRequiredProbeHealthy } from './lib/runtime-metrics.mjs';
import {
  ISOLATED_APPROVAL,
  PRODUCTION_APPROVAL,
  assertAbuseRunAuthorized,
  isProductionHost,
  validateCreateBudgetProfile,
  validateEnumerationBoundary,
} from './security-abuse-parallel.mjs';

const execFileAsync = promisify(execFile);
const root = resolve(import.meta.dirname, '../..');
const configPath = resolve(import.meta.dirname, 'security-acceptance.config.json');
const config = JSON.parse(await readFile(configPath, 'utf8'));

test('validiert vollständige SLO- und §6.5-Coverage', () => {
  assert.equal(validateAcceptanceConfig(config), config);
  const plan = buildAcceptancePlan(config, resolve(root, 'artifacts/test-security-acceptance'));
  assert.deepEqual(
    plan.find((phase) => phase.id === 'pdf-vote-with-abuse').runners.map((runner) => runner.id),
    ['pdf-vs-vote-500', 'security-abuse'],
  );
  assert.equal(plan.find((phase) => phase.id === 'pdf-vote-with-abuse').parallel, true);
  assert.ok(
    plan.findIndex((phase) => phase.id === 'recovery') <
      plan.findIndex((phase) => phase.id === 'pdf-vote-with-abuse'),
  );
});

test('lehnt fehlende Coverage, manipulierte SLOs und unbekannte Runner ab', () => {
  const missingCoverage = structuredClone(config);
  missingCoverage.coverage.pop();
  assert.throws(() => validateAcceptanceConfig(missingCoverage), /Coverage unvollständig/);

  const unknownRunner = structuredClone(config);
  unknownRunner.phases[0].runners = ['shell-injection'];
  assert.throws(() => validateAcceptanceConfig(unknownRunner), /Runner-\/Coverage-Matrix/);

  const substitutedRunner = structuredClone(config);
  substitutedRunner.phases.at(-1).runners[1] = 'soak-recovery';
  assert.throws(() => validateAcceptanceConfig(substitutedRunner), /Runner-\/Coverage-Matrix/);

  const missingThreshold = structuredClone(config);
  delete missingThreshold.slos.find((slo) => slo.id === 'vote').p99Ms;
  assert.throws(() => validateAcceptanceConfig(missingThreshold), /vote\.p99Ms/);

  const duplicateSlo = structuredClone(config);
  duplicateSlo.slos[1] = structuredClone(duplicateSlo.slos[0]);
  assert.throws(() => validateAcceptanceConfig(duplicateSlo), /Produkt-SLOs unvollständig/);

  const insufficientGlobalCreateBudget = structuredClone(config);
  insufficientGlobalCreateBudget.target.sessionCreateGlobalPerHour = 100;
  assert.throws(
    () => validateAcceptanceConfig(insufficientGlobalCreateBudget),
    /2400 globale Creates/,
  );
});

test('erzwingt genau einen expliziten CLI-Modus', () => {
  assert.equal(parseArguments(['--validate']).mode, '--validate');
  assert.throws(() => parseArguments([]), /Genau einer/);
  assert.throws(() => parseArguments(['--plan', '--execute']), /Genau einer/);
});

test('prüft Commit, Laufzeit und isoliertes Zielhostprofil', () => {
  const now = Date.parse('2026-07-25T17:00:00Z');
  const gitCommit = 'a'.repeat(40);
  const evidence = {
    schemaVersion: 1,
    operator: 'Release Engineering',
    approvedAt: '2026-07-25T16:00:00Z',
    expiresAt: '2026-07-25T20:00:00Z',
    gitCommit,
    nodeVersion: '24.18.0',
    image: `arsnova-eu@sha256:${'a'.repeat(64)}`,
    trpcUrl: 'https://isolated-load.example.org/trpc',
    wsUrl: 'wss://isolated-load.example.org',
    ingress: 'nginx',
    postgresql: true,
    redis: true,
    disposableData: true,
    singleSourceNat: true,
    sessionCreatePerHour: 480,
    sessionCreateGlobalPerHour: 2400,
    sessionCodeClientFailuresPerWindow: 20,
  };
  assert.equal(
    validateTargetEvidence(
      evidence,
      {
        LOAD_ACCEPTANCE_EXPECTED_COMMIT: gitCommit,
        LOAD_ACCEPTANCE_EXPECTED_SESSION_CREATE_PER_HOUR: '480',
        TRPC_URL: evidence.trpcUrl,
        WS_URL: evidence.wsUrl,
      },
      now,
    ),
    evidence,
  );
  assert.throws(
    () =>
      validateTargetEvidence(
        { ...evidence, sessionCreateGlobalPerHour: 100 },
        {
          LOAD_ACCEPTANCE_EXPECTED_COMMIT: gitCommit,
          LOAD_ACCEPTANCE_EXPECTED_SESSION_CREATE_PER_HOUR: '480',
          TRPC_URL: evidence.trpcUrl,
          WS_URL: evidence.wsUrl,
        },
        now,
      ),
    /Produktionsprofil/,
  );
  assert.throws(
    () =>
      validateTargetEvidence(
        { ...evidence, expiresAt: '2026-07-25T16:30:00Z' },
        {
          LOAD_ACCEPTANCE_EXPECTED_COMMIT: gitCommit,
          LOAD_ACCEPTANCE_EXPECTED_SESSION_CREATE_PER_HOUR: '480',
          TRPC_URL: evidence.trpcUrl,
          WS_URL: evidence.wsUrl,
        },
        now,
      ),
    /abgelaufen/,
  );
  assert.throws(
    () =>
      validateTargetEvidence(
        { ...evidence, image: 'arsnova-eu:latest' },
        {
          LOAD_ACCEPTANCE_EXPECTED_COMMIT: gitCommit,
          LOAD_ACCEPTANCE_EXPECTED_SESSION_CREATE_PER_HOUR: '480',
          TRPC_URL: evidence.trpcUrl,
          WS_URL: evidence.wsUrl,
        },
        now,
      ),
    /Digest/,
  );
  assert.throws(
    () =>
      validateTargetEvidence(
        {
          ...evidence,
          approvedAt: '2026-07-25T10:00:00Z',
          expiresAt: '2026-07-25T20:00:00Z',
        },
        {
          LOAD_ACCEPTANCE_EXPECTED_COMMIT: gitCommit,
          LOAD_ACCEPTANCE_EXPECTED_SESSION_CREATE_PER_HOUR: '480',
          TRPC_URL: evidence.trpcUrl,
          WS_URL: evidence.wsUrl,
        },
        now,
      ),
    /vier Stunden/,
  );
  assert.throws(
    () =>
      validateTargetEvidence(
        evidence,
        {
          LOAD_ACCEPTANCE_EXPECTED_COMMIT: gitCommit,
          LOAD_ACCEPTANCE_EXPECTED_SESSION_CREATE_PER_HOUR: '480',
          TRPC_URL: evidence.trpcUrl,
          WS_URL: evidence.wsUrl,
        },
        now,
        3 * 60 * 60 * 1_000 + 1,
      ),
    /abgelaufen/,
  );
  assert.throws(
    () =>
      validateTargetEvidence(
        evidence,
        {
          LOAD_ACCEPTANCE_EXPECTED_COMMIT: gitCommit,
          LOAD_ACCEPTANCE_EXPECTED_SESSION_CREATE_PER_HOUR: '480',
          TRPC_URL: evidence.trpcUrl,
          WS_URL: 'wss://arsnova.eu',
        },
        now,
      ),
    /stimmen nicht/,
  );
  assert.throws(
    () =>
      validateTargetEvidence(
        evidence,
        {
          LOAD_ACCEPTANCE_EXPECTED_COMMIT: gitCommit,
          LOAD_ACCEPTANCE_EXPECTED_SESSION_CREATE_PER_HOUR: '480',
          TRPC_URL: evidence.trpcUrl,
          WS_URL: evidence.wsUrl,
          TRPC_URLS: 'https://arsnova.eu/trpc',
        },
        now,
      ),
    /Alternative Zielvariablen/,
  );
  assert.throws(
    () =>
      validateTargetEvidence(
        { ...evidence, wsUrl: 'wss://other-isolated.example.org' },
        {
          LOAD_ACCEPTANCE_EXPECTED_COMMIT: gitCommit,
          LOAD_ACCEPTANCE_EXPECTED_SESSION_CREATE_PER_HOUR: '480',
          TRPC_URL: evidence.trpcUrl,
          WS_URL: 'wss://other-isolated.example.org',
        },
        now,
      ),
    /denselben Nginx-Zielhost/,
  );
  assert.throws(
    () =>
      validateTargetEvidence(
        { ...evidence, trpcUrl: `${evidence.trpcUrl}?token=secret` },
        {
          LOAD_ACCEPTANCE_EXPECTED_COMMIT: gitCommit,
          LOAD_ACCEPTANCE_EXPECTED_SESSION_CREATE_PER_HOUR: '480',
          TRPC_URL: `${evidence.trpcUrl}?token=secret`,
          WS_URL: evidence.wsUrl,
        },
        now,
      ),
    /Ungültiges Ziel/,
  );
  assert.throws(
    () =>
      validateTargetEvidence(
        { ...evidence, wsUrl: 'wss://isolated-load.example.org:3001' },
        {
          LOAD_ACCEPTANCE_EXPECTED_COMMIT: gitCommit,
          LOAD_ACCEPTANCE_EXPECTED_SESSION_CREATE_PER_HOUR: '480',
          TRPC_URL: evidence.trpcUrl,
          WS_URL: 'wss://isolated-load.example.org:3001',
        },
        now,
      ),
    /denselben Nginx-Zielhost/,
  );
  assert.equal(productionTarget('https://arsnova.eu./trpc'), true);
  assert.equal(productionTarget('https://stage.arsnova.eu./trpc'), true);
});

test('kanonisiert Produktions-FQDN auch im direkten Abuse-Runner', () => {
  assert.equal(isProductionHost('https://arsnova.eu./trpc'), true);
  assert.equal(isProductionHost('https://stage.arsnova.eu./trpc'), true);
  assert.throws(
    () =>
      assertAbuseRunAuthorized(
        { LOAD_ACCEPTANCE_APPROVED: ISOLATED_APPROVAL },
        'https://arsnova.eu./trpc',
      ),
    /Produktionslast/,
  );
});

test('schließt das globale Create-Budget als 429-Ursache aus', () => {
  assert.doesNotThrow(() => validateCreateBudgetProfile(480, 2400, 481));
  assert.throws(() => validateCreateBudgetProfile(480, 100, 481), /globale Session-Create-Budget/i);
  assert.throws(() => validateCreateBudgetProfile(480, 960, 481), /globale Session-Create-Budget/i);
});

test('prüft die Enumeration exakt am bestätigten Client-Limit', () => {
  assert.doesNotThrow(() =>
    validateEnumerationBoundary(
      [...Array(20).fill('notFound'), ...Array(5).fill('tooManyRequests')],
      20,
    ),
  );
  assert.throws(
    () => validateEnumerationBoundary(Array(25).fill('tooManyRequests'), 20),
    /Enumeration-Grenze/,
  );
  assert.throws(
    () =>
      validateEnumerationBoundary(
        [...Array(21).fill('notFound'), ...Array(4).fill('tooManyRequests')],
        20,
      ),
    /Enumeration-Grenze/,
  );
});

test('bindet den ausführenden Harness an einen sauberen Commit', () => {
  const commit = 'a'.repeat(40);
  assert.equal(
    validateHarnessCheckout(commit, (args) => (args[0] === 'rev-parse' ? commit : '')),
    commit,
  );
  assert.throws(
    () => validateHarnessCheckout(commit, (args) => (args[0] === 'rev-parse' ? commit : ' M x')),
    /sauber/,
  );
});

test('sperrt direkte Abuse- und Produktionsläufe ohne zweistufige Freigabe', () => {
  assert.throws(() => assertAbuseRunAuthorized({}, 'http://127.0.0.1:3000/trpc'), /Freigabe/);
  assert.doesNotThrow(() =>
    assertAbuseRunAuthorized(
      { LOAD_ACCEPTANCE_APPROVED: ISOLATED_APPROVAL },
      'https://staging.example.org/trpc',
    ),
  );
  assert.throws(
    () =>
      assertAbuseRunAuthorized(
        { LOAD_ACCEPTANCE_APPROVED: ISOLATED_APPROVAL },
        'https://arsnova.eu/trpc',
      ),
    /Produktionslast/,
  );
  assert.doesNotThrow(() =>
    assertAbuseRunAuthorized(
      {
        LOAD_ACCEPTANCE_APPROVED: ISOLATED_APPROVAL,
        LOAD_ACCEPTANCE_PRODUCTION_APPROVED: PRODUCTION_APPROVAL,
      },
      'https://arsnova.eu/trpc',
    ),
  );
});

test('akzeptiert nur grüne standardisierte Szenarioreports', () => {
  const report = {
    schemaVersion: 1,
    scenario: 'security-abuse-parallel',
    assertions: [{ name: 'scenario', passed: true }],
  };
  assert.equal(validateScenarioReport(report, report.scenario), report);
  assert.throws(
    () =>
      validateScenarioReport(
        { ...report, assertions: [{ name: 'scenario', passed: false }] },
        report.scenario,
      ),
    /fehlgeschlagene Assertions/,
  );
});

test('bindet alle Child-Ziele und verlangt messbare Recovery-Probes', () => {
  const sanitized = sanitizeChildEnvironment({
    TRPC_URL: 'https://isolated.example/trpc',
    WS_URL: 'wss://isolated.example',
    TRPC_URLS: 'https://arsnova.eu/trpc',
    ARTILLERY_HTTP_TARGET: 'https://arsnova.eu',
  });
  assert.equal(sanitized.TRPC_URLS, '');
  assert.equal(sanitized.ARTILLERY_HTTP_TARGET, '');
  assert.equal(sanitized.LOAD_ACCEPTANCE_VALIDATE_ONLY, '');
  assert.equal(sanitized.SOAK_VALIDATE_ONLY, '');
  assert.throws(() => validateSoakProbeEnvironment({}), /SOAK_BACKEND_PID/);
  assert.doesNotThrow(() =>
    validateSoakProbeEnvironment(
      {
        SOAK_BACKEND_PID: '123',
        SOAK_BACKEND_EXPECTED_COMMAND: 'node dist/index.js',
        SOAK_REDIS_URL: 'redis://127.0.0.1:6379',
        SOAK_DATABASE_URL: 'postgresql://user:secret@127.0.0.1/db',
      },
      () => 'node dist/index.js',
    ),
  );
  assert.throws(
    () =>
      validateSoakProbeEnvironment(
        {
          SOAK_BACKEND_PID: '123',
          SOAK_BACKEND_EXPECTED_COMMAND: 'node dist/index.js',
          SOAK_REDIS_URL: 'redis://127.0.0.1:6379',
          SOAK_DATABASE_URL: 'postgresql://user:secret@127.0.0.1/db',
        },
        () => 'sleep 999',
      ),
    /gehört nicht/,
  );
});

test('berechnet p99 für verbindliche Vote- und Live-Latenzen', () => {
  const summary = summarizeDurations(Array.from({ length: 100 }, (_, index) => index + 1));
  assert.deepEqual(summary, { p50Ms: 50, p95Ms: 95, p99Ms: 99, maxMs: 100 });
  assert.equal(violatesExclusiveUpperBound(1_999, 2_000), false);
  assert.equal(violatesExclusiveUpperBound(2_000, 2_000), true);
  assert.equal(violatesExclusiveRate(2, 500, 0.005), false);
  assert.equal(violatesExclusiveRate(3, 500, 0.005), true);
});

test('übergibt strengere Reconnect-SLOs ohne verstecktes 30s-Clamping', () => {
  assert.equal(parseReconnectLimitMs('10000'), 10_000);
  assert.equal(parseReconnectLimitMs('1'), 1);
  const strictConfig = structuredClone(config);
  strictConfig.slos.find((slo) => slo.id === 'reconnect').withinMs = 10_000;
  const strictPlan = buildAcceptancePlan(strictConfig, '/tmp/strict-reconnect');
  assert.equal(
    strictPlan.find((phase) => phase.id === 'reconnect-500').runners[0].env
      .ARTILLERY_RECONNECT_MS_MAX,
    '10000',
  );
  assert.equal(strictConfig.slos.find((slo) => slo.id === 'reconnect').withinMs, 10_000);
  const pdfRunner = strictPlan
    .find((phase) => phase.id === 'pdf-vote-with-abuse')
    .runners.find((runner) => runner.id === 'pdf-vs-vote-500');
  assert.equal(pdfRunner.env.JOIN_CONCURRENCY, '75');
  assert.equal(pdfRunner.env.VOTE_CONCURRENCY, '75');
  const abuseRunner = strictPlan
    .find((phase) => phase.id === 'pdf-vote-with-abuse')
    .runners.find((runner) => runner.id === 'security-abuse');
  assert.equal(abuseRunner.env.ABUSE_CREATE_ATTEMPTS, '481');
});

test('verlangt fehlerfreie Redis- und PostgreSQL-Probereihen', () => {
  assert.equal(isRequiredProbeHealthy({ available: true, successfulSamples: 1, errors: 0 }), true);
  assert.equal(isRequiredProbeHealthy({ available: true, successfulSamples: 1, errors: 9 }), false);
  assert.equal(
    isRequiredProbeHealthy({ available: false, successfulSamples: 0, errors: 10 }),
    false,
  );
});

test('bindet Report und JUnit kryptographisch an Run, Commit, Ziel und Phase', async () => {
  const directory = await mkdtemp(join(tmpdir(), 's65-evidence-'));
  const runner = {
    id: 'runner',
    expectedScenario: 'scenario',
    reportFile: join(directory, 'runner.json'),
    junitFile: join(directory, 'runner.junit.xml'),
    envelopeFile: join(directory, 'runner.evidence.json'),
  };
  const evidence = {
    gitCommit: 'a'.repeat(40),
  };
  const runContext = createAcceptanceRunContext(
    evidence,
    'https://isolated.example/trpc/',
    'wss://isolated.example/',
    {
      runId: '123e4567-e89b-42d3-a456-426614174000',
      startedAt: '2026-07-25T17:00:00Z',
    },
  );
  const phaseStartedAt = new Date(Date.now() - 100);
  await writeFile(
    runner.reportFile,
    JSON.stringify({
      schemaVersion: 1,
      scenario: runner.expectedScenario,
      timestamp: new Date().toISOString(),
      gitCommit: runContext.gitCommit,
      assertions: [{ name: 'scenario', passed: true }],
    }),
  );
  await writeFile(runner.junitFile, '<testsuite/>');
  const phaseEndedAt = new Date();
  const { envelope } = await validateRunnerArtifacts(
    runner,
    runContext,
    'phase',
    phaseStartedAt,
    phaseEndedAt,
  );
  assert.equal(validateEvidenceEnvelope(envelope, runner, runContext, 'phase'), envelope);
  assert.throws(
    () =>
      validateEvidenceEnvelope({ ...envelope, runId: randomUUID() }, runner, runContext, 'phase'),
    /runId/,
  );
  assert.throws(
    () =>
      validateEvidenceEnvelope(
        { ...envelope, gitCommit: 'b'.repeat(40) },
        runner,
        runContext,
        'phase',
      ),
    /gitCommit/,
  );
  assert.throws(
    () =>
      validateEvidenceEnvelope(
        { ...envelope, target: { ...envelope.target, trpcUrl: 'https://other/trpc' } },
        runner,
        runContext,
        'phase',
      ),
    /target/,
  );
  assert.throws(
    () => validateEvidenceEnvelope({ ...envelope, phaseId: 'other' }, runner, runContext, 'phase'),
    /phaseId/,
  );
  const manifest = {
    schemaVersion: 1,
    kind: 'security-load-acceptance',
    status: 'RUN_COMPLETE_AWAITING_SLO_REVIEW',
    runId: runContext.runId,
    gitCommit: runContext.gitCommit,
    harnessCommit: runContext.harnessCommit,
    target: runContext.target,
  };
  assert.equal(validateAcceptanceManifest(manifest, runContext).runId, runContext.runId);
  assert.throws(
    () => validateAcceptanceManifest({ ...manifest, runId: randomUUID() }, runContext),
    /nicht an den aktuellen Run/,
  );
  await writeFile(
    runner.reportFile,
    JSON.stringify({
      schemaVersion: 1,
      scenario: runner.expectedScenario,
      timestamp: new Date().toISOString(),
      gitCommit: 'b'.repeat(40),
      assertions: [{ name: 'scenario', passed: true }],
    }),
  );
  await assert.rejects(
    validateRunnerArtifacts(runner, runContext, 'phase', phaseStartedAt, new Date()),
    /Report-Commit/,
  );
});

test('verwirft alte, fehlende und nicht run-spezifische Artefakte fail-closed', async () => {
  const directory = await mkdtemp(join(tmpdir(), 's65-stale-'));
  const runner = {
    id: 'runner',
    expectedScenario: 'scenario',
    reportFile: join(directory, 'runner.json'),
    junitFile: join(directory, 'runner.junit.xml'),
    envelopeFile: join(directory, 'runner.evidence.json'),
  };
  const runContext = createAcceptanceRunContext(
    { gitCommit: 'a'.repeat(40) },
    'https://isolated.example/trpc',
    'wss://isolated.example',
  );
  const manifestFile = join(directory, 'acceptance-manifest.json');
  await assert.rejects(
    validateRunnerArtifacts(runner, runContext, 'phase', new Date(), new Date()),
  );
  await assert.rejects(access(manifestFile));

  await writeFile(
    runner.reportFile,
    JSON.stringify({
      schemaVersion: 1,
      scenario: 'scenario',
      timestamp: '2020-01-01T00:00:00.000Z',
      gitCommit: runContext.gitCommit,
      assertions: [{ name: 'old-green', passed: true }],
    }),
  );
  await writeFile(runner.junitFile, '<testsuite/>');
  await assert.rejects(
    validateRunnerArtifacts(runner, runContext, 'phase', new Date(Date.now() - 100), new Date()),
    /keinen frischen Report/,
  );
  await preparePhaseArtifacts({ id: 'phase', runners: [runner] }, join(directory, '.signal'));
  await assert.rejects(access(runner.reportFile));
  await assert.rejects(access(runner.junitFile));
  await assert.rejects(access(runner.envelopeFile));
  assert.throws(() => runArtifactDirectory(directory, '../escape'), /Run-ID/);
});

test('trennt parallele und aufeinanderfolgende Runs durch sichere Pfade', () => {
  const evidence = { gitCommit: 'a'.repeat(40) };
  const first = createAcceptanceRunContext(
    evidence,
    'https://isolated.example/trpc',
    'wss://isolated.example',
  );
  const second = createAcceptanceRunContext(
    evidence,
    'https://isolated.example/trpc',
    'wss://isolated.example',
  );
  assert.notEqual(first.runId, second.runId);
  const directory = runArtifactDirectory('/tmp/s65-runs', first.runId);
  const plan = buildAcceptancePlan(config, directory);
  const secondDirectory = runArtifactDirectory('/tmp/s65-runs', second.runId);
  const secondPlan = buildAcceptancePlan(config, secondDirectory);
  const files = plan.flatMap((phase) =>
    phase.runners.flatMap((runner) => [runner.reportFile, runner.junitFile, runner.envelopeFile]),
  );
  assert.equal(new Set(files).size, files.length);
  assert.ok(files.every((file) => file.startsWith(directory)));
  const firstScratch = plan.find((phase) => phase.id === 'live-500').runners[0].env
    .ARTILLERY_SCRATCH_DIR;
  const secondScratch = secondPlan.find((phase) => phase.id === 'live-500').runners[0].env
    .ARTILLERY_SCRATCH_DIR;
  assert.notEqual(firstScratch, secondScratch);
  assert.ok(firstScratch.startsWith(directory));
});

test('beendet parallele Geschwister nach dem ersten Fehler', async () => {
  const startedAt = Date.now();
  await assert.rejects(
    runPhase(
      {
        id: 'test-parallel',
        parallel: true,
        runners: [
          {
            id: 'sleeper',
            command: [process.execPath, '-e', 'setInterval(() => {}, 1000)'],
            timeoutMs: 10_000,
            env: {},
          },
          {
            id: 'failure',
            command: [process.execPath, '-e', 'setTimeout(() => process.exit(2), 30)'],
            timeoutMs: 10_000,
            env: {},
          },
        ],
      },
      {},
      { monitor: null },
    ),
    /failure abgebrochen/,
  );
  assert.ok(Date.now() - startedAt < 2_000);
});

test('beendet aktive Prozessgruppen bei Operator-Abbruch', async () => {
  const processRef = new EventEmitter();
  processRef.exitCode = undefined;
  const removeSignalHandlers = installTerminationSignalHandlers(processRef);
  const phasePromise = runPhase(
    {
      id: 'test-interrupt',
      parallel: false,
      runners: [
        {
          id: 'sleeper',
          command: [process.execPath, '-e', 'setInterval(() => {}, 1000)'],
          timeoutMs: 10_000,
          env: {},
        },
      ],
    },
    {},
    { monitor: null },
  );
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  processRef.emit('SIGTERM', 'SIGTERM');
  await assert.rejects(phasePromise, /sleeper abgebrochen/);
  assert.equal(processRef.exitCode, 143);
  assert.throws(() => assertExecutionNotCancelled(), /SIGTERM/);
  removeSignalHandlers();
  await terminateActiveChildren();
});

test('entfernt Artillery-Scratch mit Host-Token auf Erfolg und Fehler', async () => {
  for (const exitCode of [0, 2]) {
    const directory = await mkdtemp(join(tmpdir(), 'arsnova-scratch-cleanup-'));
    const scratch = join(directory, 'scratch');
    await writeFile(scratch, 'host-token');
    const phasePromise = runPhase(
      {
        id: `scratch-${exitCode}`,
        parallel: false,
        runners: [
          {
            id: `runner-${exitCode}`,
            command: [process.execPath, '-e', `process.exit(${exitCode})`],
            timeoutMs: 10_000,
            env: { ARTILLERY_SCRATCH_DIR: scratch },
          },
        ],
      },
      {},
      { monitor: null },
    );
    if (exitCode === 0) await phasePromise;
    else await assert.rejects(phasePromise, /abgebrochen/);
    await assert.rejects(access(scratch));
  }
});

test('erzwingt ein Hard-Timeout pro Child-Prozess', async () => {
  await assert.rejects(
    runPhase(
      {
        id: 'test-timeout',
        parallel: false,
        runners: [
          {
            id: 'sleeper',
            command: [process.execPath, '-e', 'setInterval(() => {}, 1000)'],
            timeoutMs: 30,
            env: {},
          },
        ],
      },
      {},
      { monitor: null },
    ),
    /Hard-Timeout/,
  );
});

test('bricht nach anhaltendem Health-Ausfall ab', async () => {
  await assert.rejects(
    monitorTargetHealth('https://isolated.example/trpc', {
      failureWindowMs: 30,
      intervalMs: 5,
      fetchFn: async () => ({
        ok: true,
        json: async () => ({ result: { data: { json: { status: 'ok', redis: 'unavailable' } } } }),
      }),
    }).promise,
    /30 ms/,
  );
});

test('führt Validate-Modi netzwerkfrei aus', async () => {
  const acceptance = await execFileAsync(
    process.execPath,
    ['scripts/load/run-security-acceptance.mjs', '--validate'],
    { cwd: root },
  );
  assert.match(acceptance.stdout, /keine Requests gesendet/);

  const abuse = await execFileAsync(
    process.execPath,
    ['scripts/load/security-abuse-parallel.mjs'],
    {
      cwd: root,
      env: {
        ...process.env,
        LOAD_ACCEPTANCE_VALIDATE_ONLY: '1',
        LOAD_ACCEPTANCE_PHASE_SIGNAL: resolve(root, 'artifacts/not-created.signal'),
      },
    },
  );
  assert.match(abuse.stdout, /keine Requests gesendet/);
});
