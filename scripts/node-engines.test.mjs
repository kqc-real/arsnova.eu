import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import semver from 'semver';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
const npmrc = readFileSync(join(root, '.npmrc'), 'utf8');

// Niedrigste unterstützte Version je Major, z. B. 22.22.3 und 24.15.0.
const minimumVersions = pkg.engines.node
  .split('||')
  .map((range) => semver.minVersion(range.trim()).version);

test('.npmrc erzwingt engines (engine-strict)', () => {
  assert.match(npmrc, /^engine-strict=true$/m);
});

test('package-lock.json übernimmt die Root-engines aus package.json', () => {
  assert.equal(lock.packages[''].engines.node, pkg.engines.node);
});

test('alle nicht optionalen Pakete sind auf der niedrigsten unterstützten Node-Version installierbar', () => {
  const incompatible = [];
  for (const [path, entry] of Object.entries(lock.packages)) {
    const range = entry.engines?.node;
    if (!path || !range || entry.optional) {
      continue;
    }
    for (const version of minimumVersions) {
      if (!semver.satisfies(version, range)) {
        incompatible.push(`${path} verlangt node ${range}, nicht erfüllt von ${version}`);
      }
    }
  }
  assert.deepEqual(incompatible, []);
});
