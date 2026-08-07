import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ESLint } from 'eslint';
import {
  assertLintCoverage,
  lintFailures,
  parseChangedEntries,
  resolveRange,
  selectChangedScripts,
} from './lint-changed-scripts.mjs';

const inventory = {
  extensions: ['.js', '.mjs', '.cjs', '.ts', '.mts'],
  scope: ['scripts/**', 'apps/**/scripts/**', '.github/scripts/**'],
  exceptions: [],
  profiles: [
    { name: 'k6', include: ['scripts/load/k6-*.js'], exclude: [] },
    {
      name: 'playwright-node',
      include: ['apps/frontend/scripts/**'],
      exclude: [],
    },
    {
      name: 'node',
      include: ['scripts/**'],
      exclude: ['scripts/load/k6-*.js'],
    },
  ],
};

test('parses modifications, deletions and rename records without losing paths', () => {
  assert.deepEqual(
    parseChangedEntries(
      'M\0scripts/a.mjs\0D\0scripts/deleted.mjs\0R100\0scripts/old.mjs\0scripts/new.mjs\0',
    ),
    [
      { kind: 'M', status: 'M', path: 'scripts/a.mjs' },
      { kind: 'D', status: 'D', path: 'scripts/deleted.mjs' },
      {
        kind: 'R',
        status: 'R100',
        oldPath: 'scripts/old.mjs',
        path: 'scripts/new.mjs',
      },
    ],
  );
});

test('selects changed scripts, ignores deletions and rejects an unprofiled new path', () => {
  const result = selectChangedScripts(
    [
      { kind: 'M', status: 'M', path: 'scripts/ok.mjs' },
      { kind: 'D', status: 'D', path: 'scripts/deleted.mjs' },
      { kind: 'A', status: 'A', path: 'apps/unknown/scripts/new.mjs' },
    ],
    inventory,
  );
  assert.deepEqual(result.files, ['scripts/ok.mjs']);
  assert.deepEqual(result.errors, [
    'apps/unknown/scripts/new.mjs: expected exactly one runtime profile, found none',
  ]);
});

test('rejects a rename from an inventoried script into an unchecked path', () => {
  assert.deepEqual(
    selectChangedScripts(
      [
        {
          kind: 'R',
          status: 'R100',
          oldPath: 'scripts/checked.mjs',
          path: 'tools/unchecked.mjs',
        },
      ],
      inventory,
    ),
    {
      files: [],
      errors: [
        'scripts/checked.mjs -> tools/unchecked.mjs: renamed script left the inventoried scope',
      ],
    },
  );
});

test('rejects a rename from an inventoried script into a documented exception', () => {
  const inventoryWithException = {
    ...inventory,
    exceptions: [{ glob: 'scripts/load/artillery/reports/**', reason: 'generated output' }],
  };
  assert.deepEqual(
    selectChangedScripts(
      [
        {
          kind: 'R',
          status: 'R100',
          oldPath: 'scripts/checked.mjs',
          path: 'scripts/load/artillery/reports/unchecked.mjs',
        },
      ],
      inventoryWithException,
    ),
    {
      files: [],
      errors: [
        'scripts/checked.mjs -> scripts/load/artillery/reports/unchecked.mjs: renamed script left the inventoried scope',
      ],
    },
  );
});

test('uses the empty tree for a null push SHA and explicit PR ranges unchanged', () => {
  assert.deepEqual(
    resolveRange({
      base: '0'.repeat(40),
      head: 'b'.repeat(40),
      currentHead: 'c'.repeat(40),
      emptyTree: 'empty',
    }),
    { base: 'empty', head: 'b'.repeat(40) },
  );
  assert.deepEqual(
    resolveRange({
      base: 'a'.repeat(40),
      head: 'b'.repeat(40),
      currentHead: 'c'.repeat(40),
      emptyTree: 'empty',
    }),
    { base: 'a'.repeat(40), head: 'b'.repeat(40) },
  );
});

test('changed scripts fail on either an ESLint error or warning', async () => {
  const eslint = new ESLint({ ignore: false });
  const [errorResult] = await eslint.lintText('window.alert("no");', {
    filePath: 'scripts/changed.mts',
  });
  const [warningResult] = await eslint.lintText('console.log("warn");', {
    filePath: 'scripts/changed.mts',
  });
  assert.equal(errorResult.errorCount > 0, true);
  assert.equal(warningResult.warningCount > 0, true);
  assert.deepEqual(lintFailures([errorResult, warningResult]), [errorResult, warningResult]);
});

test('changed gate rejects incomplete or duplicated lint evidence', () => {
  const files = ['scripts/a.mjs', 'scripts/b.mjs'];
  const result = (file) => ({ filePath: new URL(`../${file}`, import.meta.url).pathname });
  assert.throws(
    () => assertLintCoverage(files, [result(files[0])]),
    /Missing changed-script lint result.*scripts\/b\.mjs/s,
  );
  assert.throws(
    () => assertLintCoverage(files, [result(files[0]), result(files[0]), result(files[1])]),
    /Duplicate changed-script lint result.*scripts\/a\.mjs/s,
  );
});

test('CI lints the pull-request merge tree with complete history', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const lintJob = workflow.match(/\n {2}lint:\n(?<job>[\s\S]*?)\n {2}# ─── Security Audit/)?.groups
    ?.job;
  assert.ok(lintJob, 'lint job must remain present in ci.yml');
  assert.match(lintJob, /uses: actions\/checkout@[a-f0-9]+\n\s+with:\n\s+fetch-depth: 0/);
  assert.doesNotMatch(lintJob, /\n\s+ref:/);
  assert.match(lintJob, /SCRIPT_LINT_HEAD_SHA: \$\{\{ github\.sha \}\}/);
});
