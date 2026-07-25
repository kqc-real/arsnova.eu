import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import {
  buildAcceptancePlan,
  monitorTargetHealth,
  parseArguments,
  runPhase,
  sanitizeChildEnvironment,
  validateAcceptanceConfig,
  validateScenarioReport,
  validateSoakProbeEnvironment,
  validateTargetEvidence,
} from './run-security-acceptance.mjs';
import { summarizeDurations } from './lib/percentiles.mjs';
import {
  ISOLATED_APPROVAL,
  PRODUCTION_APPROVAL,
  assertAbuseRunAuthorized,
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
  assert.throws(() => validateAcceptanceConfig(unknownRunner), /Unbekannter Runner/);

  const missingThreshold = structuredClone(config);
  delete missingThreshold.slos.find((slo) => slo.id === 'vote').p99Ms;
  assert.throws(() => validateAcceptanceConfig(missingThreshold), /vote\.p99Ms/);

  const duplicateSlo = structuredClone(config);
  duplicateSlo.slos[1] = structuredClone(duplicateSlo.slos[0]);
  assert.throws(() => validateAcceptanceConfig(duplicateSlo), /Produkt-SLOs unvollständig/);
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
  };
  assert.equal(
    validateTargetEvidence(
      evidence,
      {
        LOAD_ACCEPTANCE_EXPECTED_COMMIT: gitCommit,
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
        { ...evidence, expiresAt: '2026-07-25T16:30:00Z' },
        {
          LOAD_ACCEPTANCE_EXPECTED_COMMIT: gitCommit,
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
          TRPC_URL: evidence.trpcUrl,
          WS_URL: evidence.wsUrl,
          TRPC_URLS: 'https://arsnova.eu/trpc',
        },
        now,
      ),
    /Alternative Zielvariablen/,
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
  assert.throws(() => validateSoakProbeEnvironment({}), /SOAK_BACKEND_PID/);
  assert.doesNotThrow(() =>
    validateSoakProbeEnvironment({
      SOAK_BACKEND_PID: '123',
      SOAK_REDIS_URL: 'redis://127.0.0.1:6379',
      SOAK_DATABASE_URL: 'postgresql://user:secret@127.0.0.1/db',
    }),
  );
});

test('berechnet p99 für verbindliche Vote- und Live-Latenzen', () => {
  const summary = summarizeDurations(Array.from({ length: 100 }, (_, index) => index + 1));
  assert.deepEqual(summary, { p50Ms: 50, p95Ms: 95, p99Ms: 99, maxMs: 100 });
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
      fetchFn: async () => ({ ok: false }),
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
