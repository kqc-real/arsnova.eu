import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildLintStagedCommands, RELATED_TESTS_COMMAND } from '../lint-staged.config.mjs';
import {
  companionCandidates,
  expandWithCompanions,
  isTestablePath,
  main,
  planRelatedRuns,
  shouldIsolateRelatedTests,
  withKeepIndexIsolation,
  workingTreeHasUnstagedContent,
  workingTreeNeedsKeepIndexIsolation,
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

test('plans full dependent workspace runs when a shared library changes', () => {
  const runs = planRelatedRuns(['libs/shared-types/src/schemas.ts'], () => false);
  assert.deepEqual(
    runs.map((run) => ({ kind: run.kind, id: run.id })),
    [
      { kind: 'vitest', id: 'shared-types' },
      { kind: 'vitest-full', id: 'session-export-report' },
      { kind: 'vitest-full', id: 'backend' },
      { kind: 'vitest-full', id: 'frontend' },
    ],
  );
});

test('detects unstaged or untracked porcelain rows', () => {
  assert.equal(workingTreeHasUnstagedContent('M  staged-only.ts\n'), false);
  assert.equal(workingTreeHasUnstagedContent('MM both.ts\n'), true);
  assert.equal(workingTreeHasUnstagedContent(' M unstaged.ts\n'), true);
  assert.equal(workingTreeHasUnstagedContent('?? new-file.ts\n'), true);
});

test('keep-index isolation ignores untracked files', () => {
  assert.equal(workingTreeNeedsKeepIndexIsolation('M  staged-only.ts\n'), false);
  assert.equal(workingTreeNeedsKeepIndexIsolation('MM both.ts\n'), true);
  assert.equal(workingTreeNeedsKeepIndexIsolation(' M unstaged.ts\n'), true);
  assert.equal(workingTreeNeedsKeepIndexIsolation('?? new-file.ts\n'), false);
});

test('lint-staged runs related tests after the writing tasks', () => {
  const commands = buildLintStagedCommands([
    'apps/backend/src/lib/rateLimit.ts',
    'apps/frontend/src/app/home.component.html',
    'docs/TESTING.md',
  ]);
  assert.ok(commands[0].startsWith('eslint --no-warn-ignored --fix -- '));
  assert.ok(commands[1].startsWith('prettier --write -- '));
  assert.equal(commands.at(-1), RELATED_TESTS_COMMAND);
  assert.equal(commands.indexOf(RELATED_TESTS_COMMAND), commands.length - 1);
});

test('pre-commit serializes lint-staged so overlapping globs cannot race', () => {
  const hook = readFileSync(
    fileURLToPath(new URL('../.husky/pre-commit', import.meta.url)),
    'utf8',
  );
  assert.match(hook, /lint-staged --concurrent false/);
});

test('explicit --no-isolate skips keep-index stash even with unstaged tracked files', () => {
  assert.equal(shouldIsolateRelatedTests(['--no-isolate']), false);
  const calls = [];
  const status = main(['--no-isolate'], {
    git: (args) => {
      calls.push(args);
      if (args[0] === 'diff') return 'apps/backend/src/lib/rateLimit.ts\0';
      if (args[0] === 'status') return ' M apps/backend/src/lib/rateLimit.ts\n';
      return '';
    },
    exists: () => false,
    execute: () => 0,
    log() {},
  });
  assert.equal(status, 0);
  assert.equal(
    calls.some((args) => args[0] === 'stash'),
    false,
  );
});

test('keep-index isolation does not pop an existing stash when only untracked files exist', () => {
  const dir = mkdtempSync(join(tmpdir(), 'related-keep-index-untracked-'));
  const git = (args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  try {
    git(['init', '-b', 'main']);
    git(['config', 'user.email', 'related-tests@example.test']);
    git(['config', 'user.name', 'Related Tests']);
    writeFileSync(join(dir, 'tracked.mjs'), 'export const value = 1;\n');
    git(['add', 'tracked.mjs']);
    git(['commit', '-m', 'init']);
    writeFileSync(join(dir, 'tracked.mjs'), 'export const value = 9;\n');
    git(['stash', 'push', '--message', 'user-wip']);
    writeFileSync(join(dir, 'scratch.tmp'), 'untracked\n');

    const stashBefore = git(['rev-parse', '--verify', 'refs/stash']).trim();
    withKeepIndexIsolation(() => 0, git);
    const stashAfter = git(['rev-parse', '--verify', 'refs/stash']).trim();

    assert.equal(stashAfter, stashBefore);
    assert.match(git(['stash', 'list']), /user-wip/);
    assert.match(readFileSync(join(dir, 'scratch.tmp'), 'utf8'), /untracked/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('keep-index isolation reads staged content instead of an unstaged fix', () => {
  const dir = mkdtempSync(join(tmpdir(), 'related-keep-index-'));
  const git = (args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  try {
    git(['init', '-b', 'main']);
    git(['config', 'user.email', 'related-tests@example.test']);
    git(['config', 'user.name', 'Related Tests']);
    writeFileSync(join(dir, 'value.mjs'), 'export const value = 1;\n');
    git(['add', 'value.mjs']);
    git(['commit', '-m', 'init']);
    writeFileSync(join(dir, 'value.mjs'), 'export const value = 2;\n');
    git(['add', 'value.mjs']);
    writeFileSync(join(dir, 'value.mjs'), 'export const value = 1;\n');

    let isolated = '';
    withKeepIndexIsolation(() => {
      isolated = readFileSync(join(dir, 'value.mjs'), 'utf8');
      return 0;
    }, git);

    assert.match(isolated, /value = 2/);
    assert.match(readFileSync(join(dir, 'value.mjs'), 'utf8'), /value = 1/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('keep-index isolation pops only the stash it created', () => {
  const dir = mkdtempSync(join(tmpdir(), 'related-keep-index-own-stash-'));
  const git = (args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  try {
    git(['init', '-b', 'main']);
    git(['config', 'user.email', 'related-tests@example.test']);
    git(['config', 'user.name', 'Related Tests']);
    writeFileSync(join(dir, 'value.mjs'), 'export const value = 1;\n');
    git(['add', 'value.mjs']);
    git(['commit', '-m', 'init']);
    writeFileSync(join(dir, 'value.mjs'), 'export const value = 9;\n');
    git(['stash', 'push', '--message', 'user-wip']);
    writeFileSync(join(dir, 'value.mjs'), 'export const value = 2;\n');
    git(['add', 'value.mjs']);
    writeFileSync(join(dir, 'value.mjs'), 'export const value = 1;\n');

    const userStash = git(['rev-parse', '--verify', 'refs/stash']).trim();
    let isolated = '';
    withKeepIndexIsolation(() => {
      isolated = readFileSync(join(dir, 'value.mjs'), 'utf8');
      return 0;
    }, git);

    assert.match(isolated, /value = 2/);
    assert.match(readFileSync(join(dir, 'value.mjs'), 'utf8'), /value = 1/);
    assert.equal(git(['rev-parse', '--verify', 'refs/stash']).trim(), userStash);
    assert.match(git(['stash', 'list']), /user-wip/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
