#!/usr/bin/env node
import { ESLint } from 'eslint';
import { appendFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  listTrackedFiles,
  loadInventory,
  validateInventory,
} from './validate-script-lint-inventory.mjs';

function formatProfileReport(profile, result) {
  return `- ${profile}: ${result.files} Datei(en), ${result.errors} Fehler, ${result.warnings} Warnungen`;
}

function writeSummary(lines) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) appendFileSync(summaryPath, `${lines.join('\n')}\n`);
}

export function createProfileReport(inventory, rows, results) {
  const rowsByFile = new Map(rows.map((row) => [row.file, row]));
  const seenFiles = new Set();
  const report = new Map(
    inventory.profiles.map((profile) => [profile.name, { files: 0, errors: 0, warnings: 0 }]),
  );
  for (const result of results) {
    const file = relative(process.cwd(), result.filePath).split(sep).join('/');
    const row = rowsByFile.get(file);
    if (!row) throw new Error(`Lint result without inventory entry: ${result.filePath}`);
    if (seenFiles.has(file)) throw new Error(`Duplicate lint result for inventory entry: ${file}`);
    seenFiles.add(file);
    const entry = report.get(row.profile);
    if (!entry) throw new Error(`${file}: unknown runtime profile ${row.profile}`);
    entry.files += 1;
    entry.errors += result.errorCount;
    entry.warnings += result.warningCount;
  }
  const missingFiles = rows.filter((row) => !seenFiles.has(row.file)).map((row) => row.file);
  if (missingFiles.length > 0) {
    throw new Error(`Missing lint result for inventory entries:\n${missingFiles.join('\n')}`);
  }
  return report;
}

export function assertCleanReport(report) {
  const violations = [...report.entries()].filter(
    ([, result]) => result.errors > 0 || result.warnings > 0,
  );
  if (violations.length === 0) return;
  throw new Error(
    [
      'Full script lint failed:',
      ...violations.map(([profile, result]) => formatProfileReport(profile, result)),
      'Lokal reproduzieren: npm run lint:scripts',
    ].join('\n'),
  );
}

async function main() {
  const inventory = loadInventory();
  const { errors: inventoryErrors, rows } = validateInventory(inventory, listTrackedFiles());
  if (inventoryErrors.length > 0) {
    process.stderr.write(`Script lint inventory failed:\n${inventoryErrors.join('\n')}\n`);
    process.exitCode = 1;
    return;
  }

  const eslint = new ESLint({ ignore: false });
  const results = await eslint.lintFiles(rows.map(({ file }) => file));
  const report = createProfileReport(inventory, rows, results);

  const lines = [
    '## Script lint gate',
    '',
    ...inventory.profiles.map((profile) =>
      formatProfileReport(profile.name, report.get(profile.name)),
    ),
    '',
    'Alle inventarisierten Skripte müssen ohne ESLint-Fehler und ohne Warnungen bestehen.',
    'Lokal: `npm run lint:scripts`',
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
  writeSummary(lines);
  assertCleanReport(report);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error}\n`);
    process.exitCode = 1;
  });
}
