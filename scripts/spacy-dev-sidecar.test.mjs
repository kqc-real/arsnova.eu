import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const script = join(root, 'scripts/spacy-dev-sidecar.sh');

function run(args) {
  return spawnSync('bash', [script, ...args], { encoding: 'utf8' });
}

test('spacy-dev-sidecar.sh ist syntaktisch gültiges Bash', () => {
  const result = spawnSync('bash', ['-n', script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('--help nennt Socket, venv, Modelle und npm run dev', () => {
  const result = run(['--help']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\/tmp\/arsnova-nlp\.sock/);
  assert.match(result.stdout, /docker\/spacy\/\.venv/);
  assert.match(result.stdout, /de\/en\/fr\/es/);
  assert.match(result.stdout, /npm run dev/);
  assert.match(result.stdout, /NLP_ENABLED=true/);
  assert.match(result.stdout, /Kein TCP-Port/);
});

test('prueft spaCy-Modelle de/en/fr/es und startet server.py im Vordergrund', () => {
  const source = readFileSync(script, 'utf8');
  assert.match(source, /de_core_news_sm/);
  assert.match(source, /en_core_web_sm/);
  assert.match(source, /fr_core_news_sm/);
  assert.match(source, /es_core_news_sm/);
  assert.match(source, /docker\/spacy\/server\.py/);
  assert.match(source, /exec env NLP_SOCKET_PATH=/);
  assert.doesNotMatch(source, /nohup/);
});

test('npm run dev startet den Host-Sidecar und schaltet NLP für das Backend ein', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(
    pkg.scripts['dev:backend:nlp'],
    'NLP_ENABLED=true NLP_SOCKET_PATH=/tmp/arsnova-nlp.sock NLP_TIMEOUT_MS=15000 npm run dev -w @arsnova/backend',
  );
  assert.equal(pkg.scripts['spacy:dev'], 'bash scripts/spacy-dev-sidecar.sh');
  for (const name of ['dev', 'dev:de', 'dev:en', 'dev:qa-summary']) {
    assert.match(pkg.scripts[name], /dev:backend:nlp/, name);
    assert.match(pkg.scripts[name], /spacy:dev/, name);
  }
  assert.doesNotMatch(pkg.scripts['dev:backend'], /spacy:dev/);
});
