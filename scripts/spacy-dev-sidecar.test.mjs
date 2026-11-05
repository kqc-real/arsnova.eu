import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
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
  assert.match(source, /Lemmatisierung \(spaCy\)/);
  assert.match(source, /Grundform zurückgeführt/);
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
    'NLP_ENABLED=true NLP_SOCKET_PATH=/tmp/arsnova-nlp.sock NLP_TIMEOUT_MS=15000 WORD_CLOUD_SEMANTIC_ENABLED=true WORD_CLOUD_ENCODER_URL=http://127.0.0.1:8790/embed WORD_CLOUD_ENCODER_TIMEOUT_MS=120000 npm run dev -w @arsnova/backend',
  );
  assert.equal(pkg.scripts['spacy:dev'], 'bash scripts/spacy-dev-sidecar.sh');
  const starter = readFileSync(join(root, 'scripts/dev-stack.mjs'), 'utf8');
  assert.match(starter, /npm run dev:backend:nlp/);
  assert.match(starter, /npm run spacy:dev/);
  assert.doesNotMatch(pkg.scripts['dev:backend'], /spacy:dev/);
});

// Python-Auswahl ohne Netzwerk: Skriptkopie in einem Temp-Root (kein venv) und
// Python-Stubs auf einem minimalen PATH.
function runWithPythonStubs(stubs) {
  const tmp = mkdtempSync(join(tmpdir(), 'spacy-sidecar-'));
  const bin = join(tmp, 'bin');
  mkdirSync(join(tmp, 'scripts'), { recursive: true });
  mkdirSync(bin);
  copyFileSync(script, join(tmp, 'scripts/spacy-dev-sidecar.sh'));
  const which = (name) =>
    spawnSync('bash', ['-c', `command -v ${name}`], { encoding: 'utf8' }).stdout.trim();
  symlinkSync(which('dirname'), join(bin, 'dirname'));
  const log = join(tmp, 'calls.log');
  for (const [name, body] of Object.entries(stubs)) {
    writeFileSync(join(bin, name), `#!/bin/sh\necho "${name} $*" >> "$STUB_LOG"\n${body}\n`);
    chmodSync(join(bin, name), 0o755);
  }
  const result = spawnSync(which('bash'), [join(tmp, 'scripts/spacy-dev-sidecar.sh')], {
    encoding: 'utf8',
    env: { PATH: bin, STUB_LOG: log, NLP_SOCKET_PATH: join(tmp, 'nlp.sock') },
  });
  const calls = existsSync(log) ? readFileSync(log, 'utf8') : '';
  rmSync(tmp, { recursive: true, force: true });
  return { result, calls, tmp };
}

const python314 = 'case "$1" in --version) echo "Python 3.14.8"; exit 0;; esac\nexit 1';
const skipIfSharedVenv = existsSync('/tmp/arsnova-spacy-venv/bin/python')
  ? 'gemeinsames /tmp/arsnova-spacy-venv vorhanden'
  : false;

test(
  'nur Python 3.14: bricht vor dem venv mit unterstütztem Bereich ab',
  { skip: skipIfSharedVenv },
  () => {
    const { result, calls } = runWithPythonStubs({ python3: python314 });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Python 3\.10–3\.13 mit venv-Modul erforderlich/);
    assert.match(result.stderr, /gefunden: Python 3\.14\.8/);
    assert.doesNotMatch(calls, /-m venv/);
  },
);

test(
  'Python 3.14 als python3 und python3.13 vorhanden: venv wird mit python3.13 angelegt',
  { skip: skipIfSharedVenv },
  () => {
    const { result, calls, tmp } = runWithPythonStubs({
      python3: python314,
      // Versionsprüfung besteht; venv-Anlage schlägt im Stub absichtlich fehl.
      'python3.13': 'case "$1" in -c) exit 0;; esac\nexit 1',
    });
    assert.notEqual(result.status, 0);
    assert.match(calls, new RegExp(`python3\\.13 -m venv --clear ${tmp}/docker/spacy/\\.venv`));
    assert.doesNotMatch(calls, /^python3 -m venv/m);
  },
);

test('--help nennt den unterstützten Python-Bereich', () => {
  const result = run(['--help']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Python 3\.10–3\.13/);
});

test(
  'python3.13 ohne venv-Modul: nächster passender Interpreter wird versucht',
  { skip: skipIfSharedVenv },
  () => {
    const { result, calls, tmp } = runWithPythonStubs({
      python3: python314,
      // Versionsprüfung besteht, venv-Anlage scheitert (z. B. python3.13-venv fehlt).
      'python3.13': 'case "$1" in -c) exit 0;; esac\nexit 1',
      // Versionsprüfung und venv-Anlage bestehen; danach fehlt das venv-python im Stub.
      'python3.12': 'exit 0',
    });
    assert.notEqual(result.status, 0);
    const venvCalls = calls.split('\n').filter((line) => line.includes(' -m venv '));
    assert.deepEqual(venvCalls, [
      `python3.13 -m venv --clear ${tmp}/docker/spacy/.venv`,
      `python3.12 -m venv --clear ${tmp}/docker/spacy/.venv`,
    ]);
    assert.match(result.stdout, /venv mit python3\.13 fehlgeschlagen/);
  },
);
