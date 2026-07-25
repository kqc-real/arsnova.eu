import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import {
  buildAcceptancePlan,
  parseArguments,
  validateAcceptanceConfig,
  validateScenarioReport,
  validateTargetEvidence,
} from './run-security-acceptance.mjs';
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
});

test('lehnt fehlende Coverage und unbekannte Runner ab', () => {
  const missingCoverage = structuredClone(config);
  missingCoverage.coverage.pop();
  assert.throws(() => validateAcceptanceConfig(missingCoverage), /Coverage unvollständig/);

  const unknownRunner = structuredClone(config);
  unknownRunner.phases[0].runners = ['shell-injection'];
  assert.throws(() => validateAcceptanceConfig(unknownRunner), /Unbekannter Runner/);
});

test('erzwingt genau einen expliziten CLI-Modus', () => {
  assert.equal(parseArguments(['--validate']).mode, '--validate');
  assert.throws(() => parseArguments([]), /Genau einer/);
  assert.throws(() => parseArguments(['--plan', '--execute']), /Genau einer/);
});

test('prüft Commit, Laufzeit und isoliertes Zielhostprofil', () => {
  const now = Date.parse('2026-07-25T17:00:00Z');
  const evidence = {
    schemaVersion: 1,
    operator: 'Release Engineering',
    approvedAt: '2026-07-25T16:00:00Z',
    expiresAt: '2026-07-25T20:00:00Z',
    gitCommit: 'abc123',
    nodeVersion: '24.18.0',
    image: 'arsnova-eu@sha256:test',
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
        LOAD_ACCEPTANCE_EXPECTED_COMMIT: 'abc123',
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
          LOAD_ACCEPTANCE_EXPECTED_COMMIT: 'abc123',
          TRPC_URL: evidence.trpcUrl,
          WS_URL: evidence.wsUrl,
        },
        now,
      ),
    /abgelaufen/,
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
