import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

const legacy = ['a', 'b'].map((c) => `sha256:${c.repeat(64)}`);
const candidate = ['c', 'd'].map((c) => `sha256:${c.repeat(64)}`);
const dockerStub = `#!/usr/bin/env node
const fs = require('node:fs');
const env = process.env;
const args = process.argv.slice(2);
const state = JSON.parse(fs.readFileSync(env.TEST_STATE, 'utf8'));
const service = args.at(-1);
const persist = () => fs.writeFileSync(env.TEST_STATE, JSON.stringify(state));
if (args[0] === 'image') console.log(service);
else if (args[0] === 'inspect') {
  if (args.some((arg) => arg.includes('com.docker.compose.project'))) console.log('arsnova-test');
  else if (args.includes('--type')) {
    if (!state.pins[service]) process.exit(1);
    console.log(state.pins[service] + ' arsnova-test created');
  } else console.log(state[service] || state.pins[service]);
} else if (args[0] === 'create') {
  if (!args.includes('org.arsnova.text-sidecar-pin=arsnova-test')) process.exit(2);
  state.pins[args[args.indexOf('--name') + 1]] = service;
  persist();
} else if (args[0] === 'ps') {
  console.log(Object.keys(state.pins).join(String.fromCharCode(10)));
} else if (args[0] === 'rm') {
  if (!state.pins[service]) process.exit(2);
  delete state.pins[service];
  persist();
} else if (args[0] === 'exec') {
  if (!args.includes('--health-only') && state['wordcloud-encoder'] === ${JSON.stringify(legacy[1])}) process.exit(1);
} else if (args[0] === 'compose' && args.includes('ps')) {
  if (service !== 'app-c') console.log(service);
} else if (args[0] === 'compose' && args.includes('up')) {
  if (!args.includes('--no-deps') || !args.includes('--pull') || !args.includes('--wait')) process.exit(2);
  if (env.FAIL_RESTORE === '1' && env.SPACY_IMAGE === ${JSON.stringify(legacy[0])}) process.exit(1);
  state.spacy = env.SPACY_IMAGE;
  state['wordcloud-encoder'] = env.WORD_CLOUD_ENCODER_IMAGE;
  state.rollouts++;
  persist();
} else process.exit(2);
`;

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'text-sidecar-rollout-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const path of [
    'scripts/prod-text-sidecars.sh',
    'scripts/prod-compose.sh',
    'scripts/deploy/lib-operation-lock.sh',
    'deploy/text-analysis-readiness.mjs',
  ]) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    copyFileSync(new URL(`../../${path}`, import.meta.url), join(root, path));
  }
  writeFileSync(join(root, '.env.production'), '');
  writeFileSync(join(root, 'docker'), dockerStub, { mode: 0o700 });
  const runtime = join(root, 'docker-state.json');
  writeFileSync(
    runtime,
    JSON.stringify({ spacy: legacy[0], 'wordcloud-encoder': legacy[1], rollouts: 0, pins: {} }),
  );
  const state = () => readFileSync(join(root, '.deploy-state/text-sidecars.env'), 'utf8');
  const images = () => JSON.parse(readFileSync(runtime, 'utf8'));
  const run = (args, env = {}) =>
    spawnSync('bash', [join(root, 'scripts/prod-text-sidecars.sh'), ...args], {
      encoding: 'utf8',
      cwd: root,
      env: {
        PATH: `${root}:${process.env.PATH}`,
        ARSNOVA_IMAGE: 'app-fixture',
        TEST_STATE: runtime,
        ...env,
      },
    });
  return { run, state, images };
}

test('Sidecar-Rollout speichert verifizierte Digests und bewahrt das Rollback bei Wiederholung', (t) => {
  const { run, state, images } = fixture(t);
  const rollout = run(['apply', ...candidate]);
  assert.equal(rollout.status, 0, rollout.stderr);
  assert.match(state(), new RegExp(`^SPACY_IMAGE=${candidate[0]}$`, 'm'));
  assert.match(state(), new RegExp(`^PREVIOUS_ENCODER_IMAGE=${legacy[1]}$`, 'm'));
  assert.deepEqual(Object.values(images().pins).sort(), [...legacy, ...candidate]);
  const repeated = run(['apply', ...candidate]);
  assert.equal(repeated.status, 0, repeated.stderr);
  assert.equal(images().rollouts, 1);
  const rollback = run(['--rollback']);
  assert.equal(rollback.status, 0, rollback.stderr);
  assert.equal(images().spacy, legacy[0]);
  assert.equal(images()['wordcloud-encoder'], legacy[1]);
  assert.match(state(), /^PREVIOUS_SPACY_IMAGE=$/m);
  assert.deepEqual(Object.values(images().pins).sort(), legacy);
});

test('Fehlgeschlagene Locale-Readiness stellt das alte Paar wieder her', (t) => {
  const { run, state, images } = fixture(t);
  const rejected = run(['apply', candidate[0], legacy[1]]);
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /Vorheriges Sidecar-Paar wiederhergestellt/);
  assert.equal(images().spacy, legacy[0]);
  assert.match(state(), /^TEXT_SIDECARS_PENDING=false$/m);
});

test('Recover setzt ein nach fehlgeschlagenem Restore markiertes Paar zurück', (t) => {
  const { run, state, images } = fixture(t);
  const rejected = run(['apply', candidate[0], legacy[1]], { FAIL_RESTORE: '1' });
  assert.equal(rejected.status, 1);
  assert.match(state(), /^TEXT_SIDECARS_PENDING=true$/m);
  assert.equal(images().spacy, candidate[0]);
  assert.match(run(['apply', ...candidate]).stderr, /erfordert zuerst --recover/);
  const recover = run(['--recover']);
  assert.equal(recover.status, 0, recover.stderr);
  assert.equal(images().spacy, legacy[0]);
  assert.match(state(), /^TEXT_SIDECARS_PENDING=false$/m);
});

test('Mutable Tags werden vor dem Containerwechsel abgelehnt', (t) => {
  const { run, images } = fixture(t);
  const rejected = run(['apply', 'arsnova-spacy:latest', candidate[1]]);
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /Unveränderliche Image-Referenz erforderlich/);
  assert.equal(images().rollouts, 0);
});
