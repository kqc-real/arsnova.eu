import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const script = join(repoRoot, 'scripts/ci/resolve-pushed-image-ref.sh');

function runResolve(imageName, tag, logContents) {
  const dir = mkdtempSync(join(tmpdir(), 'arsnova-push-log-'));
  const logPath = join(dir, 'push.log');
  writeFileSync(logPath, logContents);
  return spawnSync('bash', [script, imageName, tag, logPath], { encoding: 'utf8' });
}

test('resolve-pushed-image-ref reads digest from docker push log', () => {
  const digest = `sha256:${'ab'.repeat(32)}`;
  const result = runResolve(
    'ghcr.io/kqc-real/arsnova.eu',
    'ghcr.io/kqc-real/arsnova.eu:deadbeef',
    [
      'The push refers to repository [ghcr.io/kqc-real/arsnova.eu]',
      'abc: Layer already exists',
      `deadbeef: digest: ${digest} size: 1234`,
      '',
    ].join('\n'),
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), `ghcr.io/kqc-real/arsnova.eu@${digest}`);
});

test('resolve-pushed-image-ref rejects push log without digest', () => {
  const result = runResolve(
    'ghcr.io/kqc-real/arsnova.eu',
    'ghcr.io/kqc-real/arsnova.eu:missing',
    'The push refers to repository [ghcr.io/kqc-real/arsnova.eu]\n',
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Konnte keinen Registry-Digest/);
});
