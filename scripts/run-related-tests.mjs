#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export const WORKSPACES = [
  { id: 'shared-types', root: 'libs/shared-types' },
  { id: 'session-export-report', root: 'libs/session-export-report' },
  { id: 'backend', root: 'apps/backend' },
  { id: 'frontend', root: 'apps/frontend' },
];

const TESTABLE = /\.(?:[cm]?[jt]sx?|html|scss)$/;
const TEST_FILE = /\.(?:spec|test)\.[cm]?[jt]sx?$/;

export function isTestablePath(path) {
  return TESTABLE.test(path);
}

export function isTestFile(path) {
  return TEST_FILE.test(path);
}

export function readStagedFiles(git = defaultGit) {
  const output = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']);
  return output.split('\0').filter(Boolean);
}

export function companionCandidates(filePath) {
  if (isTestFile(filePath)) return [];
  const base = filePath.replace(/\.[^.]+$/, '');
  return [`${base}.spec.ts`, `${base}.test.ts`, `${base}.spec.mjs`, `${base}.test.mjs`];
}

export function expandWithCompanions(files, exists = existsSync) {
  const expanded = new Set();
  for (const file of files) {
    if (!isTestablePath(file)) continue;
    expanded.add(file);
    for (const companion of companionCandidates(file)) {
      if (exists(companion)) expanded.add(companion);
    }
  }
  return [...expanded].sort();
}

function workspaceRelative(filePath, workspaceRoot) {
  if (filePath === workspaceRoot) return '.';
  return filePath.slice(workspaceRoot.length + 1);
}

export function planRelatedRuns(files, exists = existsSync) {
  const expanded = expandWithCompanions(files, exists);
  const runs = [];

  for (const workspace of WORKSPACES) {
    const workspaceFiles = expanded.filter(
      (file) => file === workspace.root || file.startsWith(`${workspace.root}/`),
    );
    if (workspaceFiles.length === 0) continue;
    runs.push({
      kind: 'vitest',
      id: workspace.id,
      cwd: workspace.root,
      files: [...new Set(workspaceFiles.map((file) => workspaceRelative(file, workspace.root)))],
    });
  }

  const scriptTests = new Set();
  for (const file of expanded) {
    if (!file.startsWith('scripts/')) continue;
    if (isTestFile(file)) {
      scriptTests.add(file);
      continue;
    }
    const companion = file.replace(/\.(mjs|cjs|js)$/, '.test.$1');
    if (exists(companion)) scriptTests.add(companion);
  }
  if (scriptTests.size > 0) {
    runs.push({
      kind: 'node-test',
      id: 'scripts',
      cwd: '.',
      files: [...scriptTests].sort(),
    });
  }

  return runs;
}

function defaultGit(args) {
  const run = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (run.status !== 0) {
    throw new Error(run.stderr || run.stdout || 'git failed');
  }
  return run.stdout;
}

function runCommand(command, args, cwd) {
  const run = spawnSync(command, args, {
    cwd: cwd === '.' ? repoRoot : join(repoRoot, cwd),
    encoding: 'utf8',
    stdio: 'inherit',
  });
  return run.status ?? 1;
}

export function executeRun(run, spawn = runCommand) {
  if (run.kind === 'vitest') {
    return spawn('npx', ['vitest', 'related', '--run', '--passWithNoTests', ...run.files], run.cwd);
  }
  return spawn(process.execPath, ['--test', ...run.files], run.cwd);
}

function parseFilesFromArgv(argv) {
  const marker = argv.indexOf('--files');
  if (marker === -1) return null;
  return argv.slice(marker + 1).filter((value) => value && !value.startsWith('--'));
}

export function main(argv = process.argv.slice(2), options = {}) {
  const log = options.log ?? ((message) => process.stdout.write(`${message}\n`));
  const files = options.files ?? parseFilesFromArgv(argv) ?? readStagedFiles(options.git);
  const testable = files.filter((file) => isTestablePath(file));
  if (testable.length === 0) {
    log('No staged testable files — skipping related tests.');
    return 0;
  }

  const runs = planRelatedRuns(testable, options.exists ?? existsSync);
  if (runs.length === 0) {
    log('No related test targets — skipping.');
    return 0;
  }

  let failed = false;
  for (const run of runs) {
    log(`Related tests (${run.id}): ${run.files.join(' ')}`);
    const status = (options.execute ?? executeRun)(run);
    if (status !== 0) failed = true;
  }
  return failed ? 1 : 0;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  process.exit(main());
}
