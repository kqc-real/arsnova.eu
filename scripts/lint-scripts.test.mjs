import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { assertCleanReport, createProfileReport } from './lint-scripts.mjs';

const inventory = {
  profiles: [{ name: 'node' }, { name: 'playwright-node' }],
};
const rows = [
  { file: 'scripts/clean.mjs', profile: 'node' },
  { file: 'apps/frontend/scripts/browser.mjs', profile: 'playwright-node' },
];

function result(file, { errors = 0, warnings = 0 } = {}) {
  return {
    filePath: resolve(file),
    errorCount: errors,
    warningCount: warnings,
  };
}

test('full gate accepts a completely clean inventory', () => {
  const report = createProfileReport(inventory, rows, [result(rows[0].file), result(rows[1].file)]);
  assert.doesNotThrow(() => assertCleanReport(report));
});

test('full gate mutations cannot hide an error or a warning', () => {
  const errorReport = createProfileReport(inventory, rows, [
    result(rows[0].file, { errors: 1 }),
    result(rows[1].file),
  ]);
  const warningReport = createProfileReport(inventory, rows, [
    result(rows[0].file),
    result(rows[1].file, { warnings: 1 }),
  ]);

  assert.throws(() => assertCleanReport(errorReport), /node.*1 Fehler, 0 Warnungen/s);
  assert.throws(() => assertCleanReport(warningReport), /playwright-node.*0 Fehler, 1 Warnungen/s);
});

test('full gate rejects lint output that is not backed by the inventory', () => {
  assert.throws(
    () => createProfileReport(inventory, rows, [result('scripts/untracked.mjs')]),
    /Lint result without inventory entry/,
  );
});

test('full gate rejects incomplete or duplicated lint evidence', () => {
  assert.throws(
    () => createProfileReport(inventory, rows, [result(rows[0].file)]),
    /Missing lint result.*apps\/frontend\/scripts\/browser\.mjs/s,
  );
  assert.throws(
    () =>
      createProfileReport(inventory, rows, [
        result(rows[0].file),
        result(rows[0].file),
        result(rows[1].file),
      ]),
    /Duplicate lint result.*scripts\/clean\.mjs/s,
  );
});
