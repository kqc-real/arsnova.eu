#!/usr/bin/env node
import { ESLint } from 'eslint';
import { appendFileSync } from 'node:fs';
import { relative, sep } from 'node:path';
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
  const report = new Map(
    inventory.profiles.map((profile) => [profile.name, { files: 0, errors: 0, warnings: 0 }]),
  );
  for (const result of results) {
    const file = relative(process.cwd(), result.filePath).split(sep).join('/');
    const row = rows.find((entry) => entry.file === file);
    if (!row) throw new Error(`Lint result without inventory entry: ${result.filePath}`);
    const entry = report.get(row.profile);
    entry.files += 1;
    entry.errors += result.errorCount;
    entry.warnings += result.warningCount;
  }

  const lines = [
    '## Script lint inventory (report-only)',
    '',
    ...inventory.profiles.map((profile) =>
      formatProfileReport(profile.name, report.get(profile.name)),
    ),
    '',
    'Bekannte Bestandsbefunde sind in Slice 3A reportend. Neue oder nicht zugeordnete Skriptpfade bleiben fehlerhaft.',
    'Lokal: `npm run lint:scripts`',
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
  writeSummary(lines);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
