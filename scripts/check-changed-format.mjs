#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const supportedExtension = /\.(?:ts|js|mjs|cjs|json|html|css|scss|md)$/;
const baseSha = process.env.FORMAT_BASE_SHA?.trim() || 'HEAD^';
const headSha = process.env.FORMAT_HEAD_SHA?.trim() || 'HEAD';

const diff = spawnSync('git', ['diff', '--name-only', '--diff-filter=ACMR', baseSha, headSha], {
  encoding: 'utf8',
});

if (diff.status !== 0) {
  process.stderr.write(diff.stderr);
  process.exit(diff.status ?? 1);
}

const files = diff.stdout
  .split('\n')
  .map((file) => file.trim())
  .filter((file) => file && supportedExtension.test(file));

if (files.length === 0) {
  console.log('Keine geänderten Prettier-Dateien gefunden.');
  process.exit(0);
}

console.log(`Prüfe Formatierung von ${files.length} geänderten Dateien.`);
const prettier = spawnSync('npx', ['prettier', '--check', ...files], {
  stdio: 'inherit',
});
process.exit(prettier.status ?? 1);
