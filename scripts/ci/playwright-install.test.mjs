import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const script = join(repoRoot, 'scripts/ci/playwright-install.sh');

function runInstall(args, env = {}) {
  return spawnSync('bash', [script, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PLAYWRIGHT_INSTALL_RETRY_SLEEP_SEC: '0',
      ...env,
    },
  });
}

function makeTimeoutStub(succeedOnAttempt) {
  const dir = mkdtempSync(join(tmpdir(), 'arsnova-pw-install-'));
  const cliPath = join(dir, 'cli.js');
  const timeoutPath = join(dir, 'timeout');
  const countPath = join(dir, 'count');
  const argsPath = join(dir, 'timeout.args');
  writeFileSync(cliPath, 'console.log("stub-cli " + process.argv.slice(2).join(" "));\n');
  writeFileSync(countPath, '0\n');
  writeFileSync(argsPath, '');
  writeFileSync(
    timeoutPath,
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> ${JSON.stringify(argsPath)}
count_file=${JSON.stringify(countPath)}
succeed_on=${String(succeedOnAttempt)}
count="$(cat "$count_file")"
count=$((count + 1))
printf '%s\\n' "$count" > "$count_file"
if [ "$count" -ge "$succeed_on" ]; then
  exit 0
fi
exit 124
`,
  );
  chmodSync(timeoutPath, 0o755);
  return { dir, cliPath, timeoutPath, countPath, argsPath };
}

test('playwright-install rejects missing browser argument', () => {
  const result = runInstall([]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage:/);
});

test('playwright-install rejects unknown browser', () => {
  const result = runInstall(['chrome']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage:/);
});

test('playwright-install rejects missing Playwright CLI', () => {
  const result = runInstall(['webkit'], {
    PLAYWRIGHT_CLI: join(tmpdir(), 'missing-playwright-cli.js'),
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Playwright CLI nicht gefunden/);
});

test('playwright-install downloads the browser without --with-deps then installs OS deps', () => {
  const stub = makeTimeoutStub(1);
  const result = runInstall(['webkit'], {
    PLAYWRIGHT_CLI: stub.cliPath,
    PLAYWRIGHT_TIMEOUT_BIN: stub.timeoutPath,
    PLAYWRIGHT_INSTALL_ATTEMPTS: '3',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Versuch 1\/3/);
  assert.match(result.stdout, /nur Browser-Binary/);
  assert.match(result.stdout, /OS-Deps/);
  assert.match(result.stdout, /erfolgreich/);
  assert.doesNotMatch(result.stdout, /Versuch 2\//);
  const timeoutArgs = readFileSync(stub.argsPath, 'utf8');
  assert.match(timeoutArgs, /install webkit/);
  assert.doesNotMatch(timeoutArgs, /--with-deps/);
  assert.match(result.stdout, /stub-cli install-deps webkit/);
});

test('playwright-install retries after a timed-out browser download', () => {
  const stub = makeTimeoutStub(2);
  const result = runInstall(['chromium'], {
    PLAYWRIGHT_CLI: stub.cliPath,
    PLAYWRIGHT_TIMEOUT_BIN: stub.timeoutPath,
    PLAYWRIGHT_INSTALL_ATTEMPTS: '3',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Versuch 1 fehlgeschlagen \(Exit 124\)/);
  assert.match(result.stdout, /Versuch 2\/3/);
  assert.match(result.stdout, /erfolgreich/);
  assert.match(result.stdout, /stub-cli install-deps chromium/);
});

test('playwright-install fails after the configured number of attempts', () => {
  const stub = makeTimeoutStub(99);
  const result = runInstall(['webkit'], {
    PLAYWRIGHT_CLI: stub.cliPath,
    PLAYWRIGHT_TIMEOUT_BIN: stub.timeoutPath,
    PLAYWRIGHT_INSTALL_ATTEMPTS: '2',
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Versuch 1 fehlgeschlagen/);
  assert.match(result.stdout, /Versuch 2 fehlgeschlagen/);
  assert.match(result.stderr, /nach 2 Versuchen fehlgeschlagen/);
  assert.doesNotMatch(result.stdout, /install-deps/);
});

test('playwright-install uses a seven-minute per-attempt timeout by default', () => {
  const stub = makeTimeoutStub(1);
  const result = runInstall(['chromium'], {
    PLAYWRIGHT_CLI: stub.cliPath,
    PLAYWRIGHT_TIMEOUT_BIN: stub.timeoutPath,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Timeout 420s/);
});
