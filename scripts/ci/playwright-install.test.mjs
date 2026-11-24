import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const script = join(repoRoot, 'scripts/ci/playwright-install.sh');

function runInstall(args, env = {}, scriptPath = script) {
  return spawnSync('bash', [scriptPath, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_ACTIONS: 'false',
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

test('playwright-install uses the Ubuntu archive for Azure and EC2 mirrors in CI', () => {
  const stub = makeTimeoutStub(1);
  const aptDir = join(stub.dir, 'apt');
  const sourcesDir = join(aptDir, 'sources.list.d');
  const sourcesFile = join(sourcesDir, 'ubuntu.sources');
  const mirrorFile = join(aptDir, 'apt-mirrors.txt');
  const scriptPath = join(stub.dir, 'playwright-install.sh');
  mkdirSync(sourcesDir, { recursive: true });
  writeFileSync(
    sourcesFile,
    'URIs: http://us-east-2.ec2.archive.ubuntu.com/ubuntu/ http://security.ubuntu.com/ubuntu/\n',
  );
  writeFileSync(mirrorFile, 'https://azure.archive.ubuntu.com/ubuntu/\n');
  writeFileSync(scriptPath, readFileSync(script, 'utf8').replaceAll('/etc/apt', aptDir));

  // Exercise the actual sed expression against fixtures without running privileged commands.
  const sudoPath = join(stub.dir, 'sudo');
  writeFileSync(
    sudoPath,
    [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      '[[ "$1" == sed && "$2" == -E && "$3" == -i ]]',
      'pattern="$4"',
      'shift 4',
      'for file; do',
      '  [[ "$file" == "$PLAYWRIGHT_TEST_APT_ROOT/"* ]]',
      '  sed -E "$pattern" "$file" > "$file.tmp"',
      '  mv "$file.tmp" "$file"',
      'done',
      '',
    ].join('\n'),
  );
  chmodSync(sudoPath, 0o755);

  const result = runInstall(
    ['webkit'],
    {
      GITHUB_ACTIONS: 'true',
      PATH: stub.dir + ':' + process.env.PATH,
      PLAYWRIGHT_TEST_APT_ROOT: aptDir,
      PLAYWRIGHT_CLI: stub.cliPath,
      PLAYWRIGHT_TIMEOUT_BIN: stub.timeoutPath,
    },
    scriptPath,
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    readFileSync(sourcesFile, 'utf8'),
    'URIs: http://archive.ubuntu.com/ubuntu/ http://security.ubuntu.com/ubuntu/\n',
  );
  assert.equal(readFileSync(mirrorFile, 'utf8'), 'https://archive.ubuntu.com/ubuntu/\n');
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

test('lokales playwright:install nutzt die Projekt-CLI und läuft in setup:dev', () => {
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
  // node_modules/.bin/playwright zeigt auf @playwright/test aus artillery (ältere Version).
  assert.equal(
    pkg.scripts['playwright:install'],
    'node node_modules/playwright/cli.js install chromium',
  );
  assert.match(pkg.scripts['setup:dev'], /&& npm run playwright:install$/);
  // Systembibliotheken brauchen sudo/apt-get und gehören daher nicht in setup:dev.
  assert.equal(
    pkg.scripts['playwright:install-deps'],
    'node node_modules/playwright/cli.js install-deps chromium',
  );
  assert.doesNotMatch(pkg.scripts['setup:dev'], /install-deps/);
});
