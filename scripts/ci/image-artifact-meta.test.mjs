import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import test from 'node:test';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

function writeMeta(dir, meta) {
  writeFileSync(join(dir, 'arsnova-eu-production.meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
}

function runLoad(dir, sha) {
  return spawnSync('bash', [join(repoRoot, 'scripts/ci/load-production-image.sh'), dir, sha], {
    encoding: 'utf8',
  });
}

const validImageId =
  'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

test('load-production-image rejects missing archive', () => {
  const dir = mkdtempSync(join(tmpdir(), 'arsnova-image-meta-'));
  writeMeta(dir, {
    githubSha: 'abc123',
    localTag: 'arsnova-eu:production',
    imageId: validImageId,
    archiveFile: 'arsnova-eu-production.tar.gz',
    archiveSha256: '0'.repeat(64),
  });

  const result = runLoad(dir, 'abc123');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Archiv fehlt/);
});

test('load-production-image rejects archive sha mismatch', () => {
  const dir = mkdtempSync(join(tmpdir(), 'arsnova-image-meta-'));
  writeFileSync(join(dir, 'arsnova-eu-production.tar.gz'), 'not-a-real-image');
  writeMeta(dir, {
    githubSha: 'abc123',
    localTag: 'arsnova-eu:production',
    imageId: validImageId,
    archiveFile: 'arsnova-eu-production.tar.gz',
    archiveSha256: 'f'.repeat(64),
  });

  const result = runLoad(dir, 'abc123');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Archiv-SHA-256 stimmt nicht/);
});

test('load-production-image rejects unexpected github sha', () => {
  const dir = mkdtempSync(join(tmpdir(), 'arsnova-image-meta-'));
  writeMeta(dir, {
    githubSha: 'expected-sha',
    localTag: 'arsnova-eu:production',
    imageId: validImageId,
    archiveFile: 'arsnova-eu-production.tar.gz',
    archiveSha256: '0'.repeat(64),
  });

  const result = runLoad(dir, 'other-sha');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /githubSha stimmt nicht/);
});

test('archive sha256 helper length is 64 hex chars', () => {
  const digest = createHash('sha256').update('arsnova-ci-image-fixture').digest('hex');
  assert.equal(digest.length, 64);
  assert.match(digest, /^[0-9a-f]{64}$/);
});
