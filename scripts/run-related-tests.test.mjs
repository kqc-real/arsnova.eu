import assert from 'node:assert/strict';
import test from 'node:test';
import {
  companionCandidates,
  expandWithCompanions,
  isTestablePath,
  main,
  planRelatedRuns,
} from './run-related-tests.mjs';

test('treats source, template and script files as testable', () => {
  assert.equal(isTestablePath('apps/backend/src/lib/rateLimit.ts'), true);
  assert.equal(isTestablePath('apps/frontend/src/app/home.component.html'), true);
  assert.equal(isTestablePath('scripts/run-related-tests.mjs'), true);
  assert.equal(isTestablePath('docs/TESTING.md'), false);
});

test('adds sibling specs for sources but not for existing tests', () => {
  assert.deepEqual(companionCandidates('apps/frontend/src/app/home.component.html'), [
    'apps/frontend/src/app/home.component.spec.ts',
    'apps/frontend/src/app/home.component.test.ts',
    'apps/frontend/src/app/home.component.spec.mjs',
    'apps/frontend/src/app/home.component.test.mjs',
  ]);
  assert.deepEqual(companionCandidates('scripts/run-related-tests.test.mjs'), []);
});

test('plans vitest runs per workspace and node tests for scripts', () => {
  const exists = (path) =>
    path === 'apps/frontend/src/app/home.component.spec.ts' ||
    path === 'scripts/run-related-tests.test.mjs' ||
    path === 'apps/backend/src/lib/rateLimit.ts';

  const runs = planRelatedRuns(
    [
      'docs/TESTING.md',
      'apps/frontend/src/app/home.component.html',
      'apps/backend/src/lib/rateLimit.ts',
      'scripts/run-related-tests.mjs',
    ],
    exists,
  );

  assert.deepEqual(
    runs.map((run) => ({ kind: run.kind, id: run.id, files: run.files })),
    [
      {
        kind: 'vitest',
        id: 'backend',
        files: ['src/lib/rateLimit.ts'],
      },
      {
        kind: 'vitest',
        id: 'frontend',
        files: ['src/app/home.component.html', 'src/app/home.component.spec.ts'],
      },
      {
        kind: 'node-test',
        id: 'scripts',
        files: ['scripts/run-related-tests.test.mjs'],
      },
    ],
  );
});

test('expands only companions that exist', () => {
  assert.deepEqual(
    expandWithCompanions(['apps/backend/src/lib/missing.ts'], () => false),
    ['apps/backend/src/lib/missing.ts'],
  );
});

test('skips docs-only staged sets without running commands', () => {
  const executed = [];
  const status = main(['--files', 'docs/TESTING.md', 'README.md'], {
    execute: (run) => {
      executed.push(run);
      return 0;
    },
    log() {},
  });
  assert.equal(status, 0);
  assert.deepEqual(executed, []);
});

test('fails when any planned run fails', () => {
  const status = main(['--files', 'apps/backend/src/lib/rateLimit.ts'], {
    exists: () => false,
    execute: () => 2,
    log() {},
  });
  assert.equal(status, 1);
});
