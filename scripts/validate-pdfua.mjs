#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const VERAPDF_IMAGE =
  process.env.VERAPDF_IMAGE ||
  'verapdf/cli:v1.30.2@sha256:d5ee329657cf9bc4b2400392dd54c7d0a0ce9980ff6fa2da5590eebeec007cdb';
const PDF_DIR = resolve(process.env.PDFUA_INPUT_DIR || 'apps/frontend/src/assets/demo');
const ARTIFACT_DIR = resolve(process.env.PDFUA_ARTIFACT_DIR || 'tmp/pdfua-validation');
const LOCALES = (process.env.PDFUA_LOCALES || 'de,en,fr,es,it')
  .split(',')
  .map((locale) => locale.trim().toLowerCase())
  .filter(Boolean);

const pdfFiles = LOCALES.map((locale) => `demo-session-results-30.${locale}-pdfua.pdf`);
const missing = pdfFiles.filter((file) => !existsSync(resolve(PDF_DIR, file)));

if (missing.length > 0) {
  console.error(`Fehlende PDF/UA-Demo-Dateien: ${missing.join(', ')}`);
  process.exit(1);
}

await mkdir(ARTIFACT_DIR, { recursive: true });

const dockerArgs = ['run', '--rm'];
if (process.arch === 'arm64') {
  dockerArgs.push('--platform', 'linux/amd64');
}
dockerArgs.push(
  '-v',
  `${PDF_DIR}:/data:ro`,
  VERAPDF_IMAGE,
  '-f',
  'ua1',
  '--format',
  'text',
  '--verbose',
  '--loglevel',
  '0',
  '--maxfailuresdisplayed',
  '20',
  ...pdfFiles.map((file) => `/data/${basename(file)}`),
);

const result = spawnSync('docker', dockerArgs, {
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
});
const report = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();

await writeFile(resolve(ARTIFACT_DIR, 'verapdf-ua1.txt'), `${report}\n`, 'utf8');

if (report) {
  console.log(report);
}
if (result.error) {
  console.error(`veraPDF konnte nicht gestartet werden: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  console.error(
    `PDF/UA-1-Gate fehlgeschlagen (veraPDF Exit-Code ${result.status ?? 'unbekannt'}).`,
  );
  process.exit(result.status ?? 1);
}

const passCount = report.split(/\r?\n/).filter((line) => line.startsWith('PASS ')).length;
if (passCount !== pdfFiles.length) {
  console.error(
    `Unerwarteter veraPDF-Bericht: ${passCount} von ${pdfFiles.length} Dateien als PASS erkannt.`,
  );
  process.exit(1);
}

console.log(`PDF/UA-1-Gate bestanden (${passCount} Locale-Dateien, ${VERAPDF_IMAGE}).`);
