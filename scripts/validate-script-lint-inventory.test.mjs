import assert from 'node:assert/strict';
import test from 'node:test';
import { ESLint } from 'eslint';
import {
  classifyFile,
  globMatches,
  isDocumentedException,
  validateInventory,
} from './validate-script-lint-inventory.mjs';

const inventory = {
  extensions: ['.js', '.mjs', '.cjs', '.ts', '.mts'],
  scope: ['scripts/**', 'apps/**/scripts/**'],
  exceptions: [{ glob: 'scripts/generated/**', reason: 'generated fixture output' }],
  profiles: [
    { name: 'k6', include: ['scripts/load/k6-*.js'], exclude: [] },
    { name: 'node', include: ['scripts/**'], exclude: ['scripts/load/k6-*.js'] },
    { name: 'playwright-node', include: ['apps/frontend/scripts/**'], exclude: [] },
  ],
};

test('classifies k6 and Node scripts without overlapping globals', () => {
  assert.deepEqual(classifyFile('scripts/load/k6-health.js', inventory), ['k6']);
  assert.deepEqual(classifyFile('scripts/load/run-k6.mjs', inventory), ['node']);
});

test('recognizes a new script path without silently assigning a profile', () => {
  const result = validateInventory(inventory, ['apps/unknown/scripts/new-check.mjs']);
  assert.equal(result.rows.length, 0);
  assert.deepEqual(result.errors, [
    'apps/unknown/scripts/new-check.mjs: script path is in scope but has no profile',
  ]);
  assert.equal(globMatches('apps/unknown/scripts/new-check.mjs', 'apps/**/scripts/**'), true);
});

test('does not require a runtime profile for a documented generated exception', () => {
  assert.equal(isDocumentedException('scripts/generated/report.mjs', inventory), true);
  assert.deepEqual(validateInventory(inventory, ['scripts/generated/report.mjs']), {
    errors: [],
    rows: [],
  });
});

test('runtime profiles expose only their declared globals', async () => {
  const eslint = new ESLint({ ignore: false });
  const nodeResult = await eslint.lintText('process.stdout.write("ok"); window.alert("no");', {
    filePath: 'scripts/check-runtime.mjs',
  });
  assert.deepEqual(
    nodeResult[0].messages
      .filter((message) => message.ruleId === 'no-undef')
      .map((message) => message.message),
    ["'window' is not defined."],
  );

  const playwrightResult = await eslint.lintText(
    'process.stdout.write("ok"); window.alert("no");',
    {
      filePath: 'apps/frontend/scripts/check-runtime.mjs',
    },
  );
  assert.deepEqual(
    playwrightResult[0].messages
      .filter((message) => message.ruleId === 'no-undef')
      .map((message) => message.message),
    ["'window' is not defined."],
  );

  const githubResult = await eslint.lintText('process.stdout.write("ok"); window.alert("no");', {
    filePath: '.github/scripts/check-runtime.mjs',
  });
  assert.deepEqual(
    githubResult[0].messages
      .filter((message) => message.ruleId === 'no-undef')
      .map((message) => message.message),
    ["'window' is not defined."],
  );

  const k6Result = await eslint.lintText('__ENV.TARGET; process.stdout.write("no");', {
    filePath: 'scripts/load/k6-runtime.js',
  });
  assert.deepEqual(
    k6Result[0].messages
      .filter((message) => message.ruleId === 'no-undef')
      .map((message) => message.message),
    ["'process' is not defined."],
  );
});
