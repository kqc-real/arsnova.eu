#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import {
  classifyFile,
  globMatches,
  isDocumentedException,
  isRelevantScript,
  loadInventory,
  validateInventory,
} from './validate-script-lint-inventory.mjs';

const NULL_SHA = /^0{40}$/;

function readGit(args, options = {}) {
  return execFileSync('git', args, { encoding: 'utf8', ...options }).trim();
}

export function parseChangedEntries(output) {
  const tokens = output.split('\0');
  if (tokens.at(-1) === '') tokens.pop();
  const entries = [];
  for (let index = 0; index < tokens.length;) {
    const status = tokens[index++];
    const kind = status?.[0];
    if (!kind) throw new Error('git diff returned an empty status entry');
    if (kind === 'R' || kind === 'C') {
      const oldPath = tokens[index++];
      const path = tokens[index++];
      if (!oldPath || !path) throw new Error(`incomplete ${status} entry from git diff`);
      entries.push({ kind, status, oldPath, path });
      continue;
    }
    const path = tokens[index++];
    if (!path) throw new Error(`incomplete ${status} entry from git diff`);
    entries.push({ kind, status, path });
  }
  return entries;
}

function isScoped(path, inventory) {
  return inventory.scope.some((glob) => globMatches(path, glob));
}

export function selectChangedScripts(entries, inventory) {
  const errors = [];
  const files = new Set();
  for (const entry of entries) {
    if (entry.kind === 'D') continue;
    const path = entry.path;
    if (
      entry.kind === 'R' &&
      isRelevantScript(entry.oldPath, inventory) &&
      isScoped(entry.oldPath, inventory) &&
      !isDocumentedException(entry.oldPath, inventory) &&
      isRelevantScript(path, inventory) &&
      (!isScoped(path, inventory) || isDocumentedException(path, inventory))
    ) {
      errors.push(`${entry.oldPath} -> ${path}: renamed script left the inventoried scope`);
      continue;
    }
    if (
      !isRelevantScript(path, inventory) ||
      !isScoped(path, inventory) ||
      isDocumentedException(path, inventory)
    ) {
      continue;
    }
    const profiles = classifyFile(path, inventory);
    if (profiles.length !== 1) {
      errors.push(
        `${path}: expected exactly one runtime profile, found ${profiles.join(', ') || 'none'}`,
      );
      continue;
    }
    files.add(path);
  }
  return { errors, files: [...files].sort() };
}

export function lintFailures(results) {
  return results.filter((result) => result.errorCount > 0 || result.warningCount > 0);
}

export function assertLintCoverage(files, results) {
  const expected = new Set(files);
  const seen = new Set();
  for (const result of results) {
    const file = relative(process.cwd(), result.filePath).split(sep).join('/');
    if (!expected.has(file)) throw new Error(`Unexpected changed-script lint result: ${file}`);
    if (seen.has(file)) throw new Error(`Duplicate changed-script lint result: ${file}`);
    seen.add(file);
  }
  const missing = files.filter((file) => !seen.has(file));
  if (missing.length > 0) {
    throw new Error(`Missing changed-script lint result:\n${missing.join('\n')}`);
  }
}

export function resolveRange({ base, head, currentHead, emptyTree }) {
  const resolvedHead = head?.trim() || currentHead;
  const candidateBase = base?.trim() || `${resolvedHead}^`;
  return {
    base: NULL_SHA.test(candidateBase) ? emptyTree : candidateBase,
    head: resolvedHead,
  };
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--base' || argument === '--head') {
      const value = argv[++index];
      if (!value) throw new Error(`${argument} requires a git revision`);
      options[argument.slice(2)] = value;
      continue;
    }
    throw new Error(`unknown argument: ${argument}`);
  }
  return options;
}

async function main() {
  const inventory = loadInventory();
  const args = parseArguments(process.argv.slice(2));
  const currentHead = readGit(['rev-parse', 'HEAD']);
  const emptyTree = readGit(['hash-object', '-t', 'tree', '--stdin'], { input: '' });
  const range = resolveRange({
    base: args.base ?? process.env.SCRIPT_LINT_BASE_SHA,
    head: args.head ?? process.env.SCRIPT_LINT_HEAD_SHA,
    currentHead,
    emptyTree,
  });
  const resolvedHead = readGit(['rev-parse', `${range.head}^{commit}`]);
  if (resolvedHead !== currentHead) {
    throw new Error(
      `head ${range.head} is not checked out (${currentHead}); checkout the head first`,
    );
  }
  if (range.base !== emptyTree) readGit(['rev-parse', `${range.base}^{commit}`]);

  const trackedFiles = readGit(['ls-tree', '-r', '--name-only', range.head])
    .split('\n')
    .filter(Boolean);
  const inventoryResult = validateInventory(inventory, trackedFiles);
  const changed = parseChangedEntries(
    execFileSync(
      'git',
      ['diff', '--name-status', '-z', '--find-renames', range.base, range.head, '--'],
      { encoding: 'utf8' },
    ),
  );
  const selection = selectChangedScripts(changed, inventory);
  const errors = [...inventoryResult.errors, ...selection.errors];
  if (errors.length > 0) {
    process.stderr.write(`Changed-script inventory failed:\n${errors.join('\n')}\n`);
    process.stderr.write(
      `Reproduce: npm run lint:scripts:changed -- --base ${range.base} --head ${range.head}\n`,
    );
    process.exitCode = 1;
    return;
  }
  if (selection.files.length === 0) {
    process.stdout.write('No new or changed inventoried scripts found.\n');
    return;
  }

  const eslint = new ESLint({ ignore: false });
  const results = await eslint.lintFiles(selection.files);
  assertLintCoverage(selection.files, results);
  const failures = lintFailures(results);
  if (failures.length > 0) {
    const formatter = await eslint.loadFormatter('stylish');
    process.stderr.write(await formatter.format(failures));
    process.stderr.write(`Changed scripts must have zero errors and zero warnings:\n`);
    process.stderr.write(`${selection.files.map((file) => ` - ${file}`).join('\n')}\n`);
    process.stderr.write(
      `Reproduce: npm run lint:scripts:changed -- --base ${range.base} --head ${range.head}\n`,
    );
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `Changed-script lint passed for ${selection.files.length} file(s):\n${selection.files
      .map((file) => ` - ${file}`)
      .join('\n')}\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error}\n`);
    process.exitCode = 1;
  });
}
