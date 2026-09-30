#!/usr/bin/env node
/**
 * Host-Component-Specs in Batches fahren, damit der Vitest-Worker lokal
 * (typisch 16 GB RAM) nicht am Heap-Limit stirbt.
 *
 * Vitest wrappt `-t` intern (Prefix/Suffix), daher keine führenden `^`-Anker
 * und keine geklammerten Alternativen. Blatt-Titel mit `$` reichen.
 * Kein riesiges Pattern: adaptive Batches + bei Fehler halbieren.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hostSpec = 'src/app/features/session/session-host/session-host.component.spec.ts';
const INITIAL_BATCH = 20;

function run(args, label, env = process.env) {
  console.log(`\n› ${label}`);
  const result = spawnSync('npx', ['vitest', 'run', ...args], {
    cwd: root,
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });
  return result.status ?? 1;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hostEnv() {
  return {
    ...process.env,
    NODE_OPTIONS: [process.env.NODE_OPTIONS, '--max-old-space-size=8192', '--expose-gc']
      .filter(Boolean)
      .join(' '),
  };
}

function runHostTitles(titles, label) {
  if (titles.length === 0) {
    return 0;
  }

  // Vitest wrappt den Filter — nur Endanker am Blatt-Titel, kein `^`, keine (...)-Gruppen.
  const pattern = titles.map((title) => `${escapeRegex(title)}$`).join('|');
  const status = run(
    [hostSpec, '-t', pattern, '--maxWorkers', '1'],
    `${label} (${titles.length})`,
    hostEnv(),
  );
  if (status === 0) {
    return 0;
  }

  if (titles.length === 1) {
    return status;
  }

  const mid = Math.ceil(titles.length / 2);
  console.warn(`⚠ ${label} fehlgeschlagen – teile in ${mid}+${titles.length - mid}`);
  const left = runHostTitles(titles.slice(0, mid), `${label}.a`);
  if (left !== 0) {
    return left;
  }
  return runHostTitles(titles.slice(mid), `${label}.b`);
}

const list = spawnSync('npx', ['vitest', 'list', hostSpec], {
  cwd: root,
  encoding: 'utf8',
  env: process.env,
  shell: process.platform === 'win32',
});
if (list.status !== 0) {
  console.error(list.stderr || list.stdout);
  process.exit(list.status ?? 1);
}

const titles = list.stdout
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.includes(hostSpec))
  .map((line) => {
    const parts = line.split(' > ');
    return parts[parts.length - 1] ?? '';
  })
  .filter(Boolean);

if (titles.length === 0) {
  console.error('Keine Host-Specs gefunden.');
  process.exit(1);
}

console.log(`Host-Specs: ${titles.length} Fälle, Start-Batch ${INITIAL_BATCH}`);

if (
  run(['--exclude', `**/${path.basename(hostSpec)}`], 'Frontend ohne Host-Component-Spec') !== 0
) {
  process.exit(1);
}

for (let offset = 0, batch = 1; offset < titles.length; offset += INITIAL_BATCH, batch += 1) {
  const chunk = titles.slice(offset, offset + INITIAL_BATCH);
  const status = runHostTitles(chunk, `Host-Batch ${batch}`);
  if (status !== 0) {
    process.exit(status);
  }
}

console.log('\nFrontend-Tests (inkl. Host-Batches) bestanden.');
