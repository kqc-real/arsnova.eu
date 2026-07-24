#!/usr/bin/env node
/**
 * k6-Starter für arsnova.eu: nutzt lokales `k6`, sonst Docker (`grafana/k6`).
 *
 *   node scripts/load/run-k6.mjs scripts/load/k6-trpc-health-50vu.js
 *   npm run load:k6:health
 *
 * Umgebungsvariablen (an k6 durchgereicht): BASE_URL, SESSION_CODE, MODE, VUS,
 * DURATION/DURATION_SECONDS, Thresholds, PARTICIPANT_IDS, QUESTION_ID,
 * SESSION_ID, ANSWER_ID
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const K6_ENV_KEYS = [
  'BASE_URL',
  'SESSION_CODE',
  'MODE',
  'VUS',
  'DURATION',
  'DURATION_SECONDS',
  'ERROR_RATE_LIMIT',
  'P95_LIMIT_MS',
  'P99_LIMIT_MS',
  'CHECK_RATE_LIMIT',
  'PARTICIPANT_IDS',
  'QUESTION_ID',
  'SESSION_ID',
  'ANSWER_ID',
];

const scriptArg = process.argv[2];
if (!scriptArg) {
  console.error('Usage: node scripts/load/run-k6.mjs <k6-script.js>');
  console.error('Beispiel: npm run load:k6:health');
  process.exit(1);
}

const scriptPath = resolve(process.cwd(), scriptArg);

function commandExists(command, args = ['version']) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  return result.status === 0;
}

function collectK6Env(defaultBaseUrl) {
  /** @type {Record<string, string>} */
  const env = { BASE_URL: process.env.BASE_URL?.replace(/\/$/, '') || defaultBaseUrl };
  for (const key of K6_ENV_KEYS) {
    if (key === 'BASE_URL') continue;
    const value = process.env[key];
    if (value !== undefined && value !== '') {
      env[key] = value;
    }
  }
  return env;
}

function runLocalK6() {
  const env = collectK6Env('http://127.0.0.1:3000');
  console.log(`k6 (lokal): ${scriptArg}`);
  console.log(`  BASE_URL=${env.BASE_URL}`);
  const result = spawnSync('k6', ['run', scriptPath], {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  process.exit(result.status ?? 1);
}

function dockerNeedsHostGateway() {
  return process.platform === 'darwin' || process.platform === 'win32';
}

function runDockerK6() {
  const useHostGateway = dockerNeedsHostGateway();
  const defaultBase = useHostGateway ? 'http://host.docker.internal:3000' : 'http://127.0.0.1:3000';
  const env = collectK6Env(defaultBase);

  /** @type {string[]} */
  const args = ['run', '--rm', '-i'];
  if (!useHostGateway) {
    args.push('--network', 'host');
  }
  for (const [key, value] of Object.entries(env)) {
    args.push('-e', `${key}=${value}`);
  }
  args.push('grafana/k6', 'run', '-');

  console.log(`k6 (Docker): ${scriptArg}`);
  console.log(`  BASE_URL=${env.BASE_URL}`);
  if (useHostGateway) {
    console.log('  Hinweis: macOS/Windows nutzt host.docker.internal (kein --network host).');
  }

  let scriptSource;
  try {
    scriptSource = readFileSync(scriptPath);
  } catch (error) {
    console.error(`Skript nicht lesbar: ${scriptPath}`);
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const result = spawnSync('docker', args, {
    stdio: ['pipe', 'inherit', 'inherit'],
    input: scriptSource,
  });
  process.exit(result.status ?? 1);
}

if (commandExists('k6')) {
  runLocalK6();
} else if (commandExists('docker', ['info'])) {
  runDockerK6();
} else {
  console.error('Weder k6 noch Docker gefunden.');
  console.error('');
  console.error(
    'Option A (empfohlen): Docker starten — npm run load:k6:health nutzt grafana/k6 automatisch.',
  );
  console.error(
    'Option B: k6 lokal installieren — brew install k6 (macOS) bzw. https://k6.io/docs/get-started/installation/',
  );
  console.error('Doku: docs/praktikum/HANDOUT-LAST-UND-PERFORMANCE-TESTS.md');
  process.exit(1);
}
