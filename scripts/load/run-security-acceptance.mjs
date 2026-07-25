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

const RUNNERS = {
  'artillery-live-500': {
    script: 'scripts/load/run-artillery-500.mjs',
    expectedScenario: 'artillery-500-live-session',
    env: {
      PARTICIPANTS: '500',
      ARTILLERY_MIN_JOIN_RATIO: '0.995',
      ARTILLERY_MIN_VOTE_RATIO: '0.995',
      ARTILLERY_MIN_WS_RATIO: '0.99',
    },
  },
  'artillery-reconnect-500': {
    script: 'scripts/load/run-artillery-reconnect-500.mjs',
    expectedScenario: 'artillery-500-reconnect-wave',
    env: {
      PARTICIPANTS: '500',
      ARTILLERY_MIN_JOIN_RATIO: '0.995',
      ARTILLERY_MIN_RECONNECT_RATIO: '0.95',
      ARTILLERY_MIN_WS_RATIO: '0.99',
      ARTILLERY_RECONNECT_MS_MAX: '30000',
    },
  },
  'vote-burst-500': {
    script: 'scripts/load/vote-timer-fairness-600.mjs',
    expectedScenario: 'vote-timer-fairness-600',
    env: { PARTICIPANTS: '500', VOTE_P95_LIMIT_MS: '1000' },
  },
  'pdf-vs-vote-500': {
    script: 'scripts/load/pdf-vs-live-voting-500.mjs',
    expectedScenario: 'pdf-vs-live-voting-500',
    env: {
      PARTICIPANTS: '500',
      EXPECTED_PDF_CAP: '1',
      VOTE_P95_LIMIT_MS: '1500',
      VOTE_P99_LIMIT_MS: '3000',
      VOTE_ERROR_RATE_LIMIT: '0.01',
    },
  },
  'security-abuse': {
    script: 'scripts/load/security-abuse-parallel.mjs',
    expectedScenario: 'security-abuse-parallel',
    env: { ABUSE_VALID_JOINS: '50', ABUSE_CODE_GUESSES: '25', ABUSE_CREATE_ATTEMPTS: '15' },
  },
  'soak-recovery': {
    script: 'scripts/load/soak-live-session.mjs',
    expectedScenario: 'soak-live-session',
    env: { SOAK_DURATION_MINUTES: '5' },
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
  assertExactSet(
    config.slos.map((slo) => slo.id),
    REQUIRED_SLOS,
    'Produkt-SLOs',
  );
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
  if (!Array.isArray(config.abortCriteria) || config.abortCriteria.length < 5) {
    throw new Error('Abort-Kriterien sind unvollständig.');
  }
  return config;
}

export function buildAcceptancePlan(config, artifactDirectory) {
  validateAcceptanceConfig(config);
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
      env: RUNNERS[id].env,
    })),
  }));
}

function productionTarget(trpcUrl) {
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
  const approvedAt = Date.parse(evidence.approvedAt);
  const expiresAt = Date.parse(evidence.expiresAt);
  if (
    !Number.isFinite(approvedAt) ||
    !Number.isFinite(expiresAt) ||
    approvedAt > now ||
    expiresAt <= now
  ) {
    throw new Error('Zielhost-Freigabe ist ungültig oder abgelaufen.');
  }
  return evidence;
}

export function assertAcceptanceExecutionAuthorized(env, trpcUrl, evidence) {
  if (Number(process.versions.node.split('.')[0]) !== 24) {
    throw new Error('Die formale Abnahme muss mit Node 24 orchestriert werden.');
  }
  assertAbuseRunAuthorized(env, trpcUrl);
  validateTargetEvidence(evidence, env);
  if (
    productionTarget(trpcUrl) &&
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

function runChild(runner, commonEnv) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(runner.command[0], runner.command.slice(1), {
      cwd: ROOT,
      env: {
        ...process.env,
        ...commonEnv,
        ...runner.env,
        REPORT_FILE: runner.reportFile,
        JUNIT_FILE: runner.junitFile,
      },
      stdio: 'inherit',
    });
    child.once('error', rejectPromise);
    child.once('exit', (code, signal) => {
      if (code === 0) resolvePromise();
      else
        rejectPromise(
          new Error(`${runner.id} abgebrochen (code=${code}, signal=${signal ?? '-'}).`),
        );
    });
  });
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
    if (phase.parallel) {
      await Promise.all(phase.runners.map((runner) => runChild(runner, commonEnv)));
    } else {
      await runChild(phase.runners[0], commonEnv);
    }
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
