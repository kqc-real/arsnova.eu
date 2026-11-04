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

export const WORKSPACE_DEPENDENTS = {
  'libs/shared-types': ['libs/session-export-report', 'apps/backend', 'apps/frontend'],
  'libs/session-export-report': ['apps/backend', 'apps/frontend'],
};

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

export function dependentWorkspaces(files) {
  const dependents = new Set();
  for (const file of files) {
    for (const [libraryRoot, workspaceRoots] of Object.entries(WORKSPACE_DEPENDENTS)) {
      if (file === libraryRoot || file.startsWith(`${libraryRoot}/`)) {
        for (const workspaceRoot of workspaceRoots) dependents.add(workspaceRoot);
      }
    }
  }
  return dependents;
}

export function planRelatedRuns(files, exists = existsSync) {
  const expanded = expandWithCompanions(files, exists);
  const fullWorkspaces = dependentWorkspaces(expanded);
  const runs = [];

  for (const workspace of WORKSPACES) {
    if (fullWorkspaces.has(workspace.root)) {
      runs.push({
        kind: 'vitest-full',
        id: workspace.id,
        cwd: workspace.root,
        files: [],
      });
      continue;
    }
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

export function workingTreeHasUnstagedContent(statusPorcelain) {
  return statusPorcelain.split('\n').some((line) => {
    if (!line) return false;
    if (line.startsWith('??') || line.startsWith('!!')) return true;
    const worktree = line[1];
    return Boolean(worktree && worktree !== ' ');
  });
}

/** `stash --keep-index` cannot hide untracked/ignored files, so `??`/`!!` do not isolate. */
export function workingTreeNeedsKeepIndexIsolation(statusPorcelain) {
  return statusPorcelain.split('\n').some((line) => {
    if (!line || line.startsWith('??') || line.startsWith('!!')) return false;
    const worktree = line[1];
    return Boolean(worktree && worktree !== ' ');
  });
}

export function readStashTip(git) {
  const tip = String(git(['stash', 'list', '-n', '1', '--format=%H']) ?? '').trim();
  return tip || null;
}

export function createKeepIndexStash(git, message = 'related-tests-keep-index') {
  const before = readStashTip(git);
  git(['stash', 'push', '--keep-index', '--message', message]);
  const after = readStashTip(git);
  if (!after || after === before) return null;
  return after;
}

export function restoreCreatedStash(git, createdTip) {
  if (!createdTip) return;
  const current = readStashTip(git);
  if (current !== createdTip) return;
  // `stash pop` after `--keep-index` reports "Already up to date" and drops
  // unstaged edits. Restore the stash worktree, then drop only that stash.
  git(['restore', '--source', createdTip, '--worktree', '.']);
  git(['stash', 'drop', '--quiet']);
}

export function withKeepIndexIsolation(run, git = defaultGit) {
  const status = git(['status', '--porcelain', '-u']);
  if (!workingTreeNeedsKeepIndexIsolation(status)) {
    return run();
  }
  const createdTip = createKeepIndexStash(git);
  try {
    return run();
  } finally {
    restoreCreatedStash(git, createdTip);
  }
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
  if (run.kind === 'vitest-full') {
    return spawn('npx', ['vitest', 'run'], run.cwd);
  }
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

export function shouldIsolateRelatedTests(argv = [], options = {}) {
  if (options.isolate === false) return false;
  if (argv.includes('--no-isolate')) return false;
  if ((options.files ?? parseFilesFromArgv(argv)) != null) return false;
  return true;
}

export function main(argv = process.argv.slice(2), options = {}) {
  const log = options.log ?? ((message) => process.stdout.write(`${message}\n`));
  const explicitFiles = options.files ?? parseFilesFromArgv(argv);
  const executePlannedRuns = () => {
    const files = explicitFiles ?? readStagedFiles(options.git);
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
      const detail = run.files.length > 0 ? `: ${run.files.join(' ')}` : '';
      log(`Related tests (${run.id})${detail}`);
      const status = (options.execute ?? executeRun)(run);
      if (status !== 0) failed = true;
    }
    return failed ? 1 : 0;
  };

  if (!shouldIsolateRelatedTests(argv, options)) {
    return executePlannedRuns();
  }
  return withKeepIndexIsolation(executePlannedRuns, options.git);
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  process.exit(main());
}
