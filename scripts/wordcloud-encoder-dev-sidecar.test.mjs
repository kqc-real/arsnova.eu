import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const script = join(root, 'scripts/wordcloud-encoder-dev-sidecar.sh');

test('wordcloud-encoder-dev-sidecar.sh ist syntaktisch gueltiges Bash', () => {
  const result = spawnSync('bash', ['-n', script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('--help dokumentiert Loopback, Image-Cache und Dev-Lebenszyklus', () => {
  const result = spawnSync('bash', [script, '--help'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /http:\/\/127\.0\.0\.1:8790\/embed/);
  assert.match(result.stdout, /arsnova-wordcloud-encoder:e5-small/);
  assert.match(result.stdout, /Docker-Build-Cache/);
  assert.match(result.stdout, /Ctrl\+C/);
  assert.match(result.stdout, /npm run dev/);
});

test('Dev-Starter baut das echte Image und startet es gehaertet im Vordergrund', () => {
  const source = readFileSync(script, 'utf8');
  assert.match(source, /docker build --quiet -t "\$IMAGE"/);
  assert.match(source, /exec docker run --rm/);
  assert.match(source, /--read-only/);
  assert.match(source, /--cap-drop ALL/);
  assert.match(source, /--security-opt no-new-privileges:true/);
  assert.match(source, /WORD_CLOUD_ENCODER_HTTP_BIND=0\.0\.0\.0:/);
  assert.match(source, /-p 127\.0\.0\.1:/);
  assert.doesNotMatch(source, /WORD_CLOUD_ENCODER_ALLOW_STUB/);
});

test('npm run dev startet Encoder und aktiviert denselben Loopback-Pfad im Backend', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['encoder:dev'], 'bash scripts/wordcloud-encoder-dev-sidecar.sh');
  assert.equal(
    pkg.scripts['encoder:dev:test'],
    'node --test scripts/wordcloud-encoder-dev-sidecar.test.mjs',
  );
  assert.match(pkg.scripts['dev:backend:nlp'], /WORD_CLOUD_SEMANTIC_ENABLED=true/);
  assert.match(
    pkg.scripts['dev:backend:nlp'],
    /WORD_CLOUD_ENCODER_URL=http:\/\/127\.0\.0\.1:8790\/embed/,
  );
  assert.match(pkg.scripts['dev:backend:nlp'], /WORD_CLOUD_ENCODER_TIMEOUT_MS=120000/);
  const starter = readFileSync(join(root, 'scripts/dev-stack.mjs'), 'utf8');
  assert.match(starter, /npm run encoder:dev/);
  assert.match(starter, /npm run dev:backend:nlp/);
  assert.doesNotMatch(pkg.scripts['dev:backend'], /encoder:dev/);
});

test('npm run dev:ai startet alle lokalen KI-Komponenten und aktiviert ihre Backendpfade', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const backend = pkg.scripts['dev:backend:ai'];
  const stack = pkg.scripts['dev:ai'];

  for (const flag of [
    'NLP_ENABLED=true',
    'QA_NLP_ENABLED=true',
    'QA_SUMMARY_ENABLED=true',
    'WORD_CLOUD_SEMANTIC_ENABLED=true',
    'OPEN_WEIGHT_LLM_ENABLED=true',
  ]) {
    assert.match(backend, new RegExp(flag));
  }
  assert.match(backend, /QA_SUMMARY_INFERENCE_URL=http:\/\/127\.0\.0\.1:8787\/summary/);
  assert.match(backend, /QA_SUMMARY_TIMEOUT_MS=240000/);
  assert.match(backend, /OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS=240000/);
  assert.match(backend, /WORD_CLOUD_ENCODER_URL=http:\/\/127\.0\.0\.1:8790\/embed/);
  assert.match(stack, /scripts\/dev-stack\.mjs --profile=ai/);
  const starter = readFileSync(join(root, 'scripts/dev-stack.mjs'), 'utf8');
  assert.match(starter, /--require-open-weight-llm/);
  assert.match(starter, /killOthersOnFail: true/);
  assert.match(starter, /npm run dev:backend:ai/);
  assert.match(starter, /npm run qa-summary:dev:extractive/);
  assert.match(starter, /npm run spacy:dev/);
  assert.match(starter, /npm run encoder:dev/);
  assert.equal(
    pkg.scripts['qa-summary:dev:extractive'],
    'QA_SUMMARY_DEV_MODE=extractive npm run qa-summary:dev',
  );
});
