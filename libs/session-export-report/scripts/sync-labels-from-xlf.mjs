#!/usr/bin/env node
/**
 * Füllt FR/ES/IT-Label-Overrides aus Angular-XLF (sessionReport.*).
 * Bestehende Overrides bleiben erhalten, sofern sie schon vom DE-Text abweichen.
 *
 * Usage: node libs/session-export-report/scripts/sync-labels-from-xlf.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSessionResultsReportLabelsDe } from '../dist/labels-de.js';
import {
  FR_LABEL_OVERRIDES,
  ES_LABEL_OVERRIDES,
  IT_LABEL_OVERRIDES,
} from '../dist/labels-i18n.generated.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const outPath = path.join(__dirname, '../src/labels-i18n.generated.ts');

const unitRe = /<trans-unit\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/trans-unit>/g;
const sourceRe = /<source>([\s\S]*?)<\/source>/;
const targetRe = /<target>([\s\S]*?)<\/target>/;

function decode(text) {
  return text
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}

function loadXlf(locale) {
  const filePath = path.join(repoRoot, `apps/frontend/src/locale/messages.${locale}.xlf`);
  const content = fs.readFileSync(filePath, 'utf8');
  const map = new Map();
  for (const m of content.matchAll(unitRe)) {
    const id = m[1];
    if (!id.startsWith('sessionReport.')) continue;
    const key = id.slice('sessionReport.'.length);
    const target = m[2].match(targetRe)?.[1];
    if (target != null) map.set(key, decode(target));
  }
  return map;
}

function mergeOverrides(current, xlf, de) {
  const next = { ...current };
  let added = 0;
  for (const key of Object.keys(de)) {
    const existing = next[key];
    if (existing != null && existing !== de[key]) continue;
    const fromXlf = xlf.get(key);
    if (fromXlf && fromXlf !== de[key]) {
      next[key] = fromXlf;
      added += 1;
    }
  }
  return { next, added };
}

function emitObject(name, obj, de) {
  const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
  const lines = [`export const ${name}: Partial<SessionResultsReportLabels> = {`];
  for (const key of keys) {
    // Cognates that still equal DE can stay out of the override file.
    if (obj[key] === de[key]) continue;
    lines.push(`  ${key}: ${JSON.stringify(obj[key])},`);
  }
  lines.push('};', '');
  return lines.join('\n');
}

function main() {
  const de = getSessionResultsReportLabelsDe();
  const locales = [
    ['FR_LABEL_OVERRIDES', 'fr', FR_LABEL_OVERRIDES],
    ['ES_LABEL_OVERRIDES', 'es', ES_LABEL_OVERRIDES],
    ['IT_LABEL_OVERRIDES', 'it', IT_LABEL_OVERRIDES],
  ];

  const parts = [
    `import type { SessionResultsReportLabels } from './labels-de';`,
    '',
    '/**',
    ' * Generated/merged from Angular XLF (sessionReport.*) plus curated overrides.',
    ' * Re-run: node libs/session-export-report/scripts/sync-labels-from-xlf.mjs',
    ' * (requires built dist/: npm run build -w @arsnova/session-export-report)',
    ' */',
    '',
  ];

  for (const [exportName, locale, current] of locales) {
    const { next, added } = mergeOverrides(current, loadXlf(locale), de);
    const stillSame = Object.keys(de).filter((k) => (next[k] ?? de[k]) === de[k]);
    console.log(
      `${locale}: +${added} from XLF, stillSameAsDe=${stillSame.length}` +
        (stillSame.length ? ` (${stillSame.join(', ')})` : ''),
    );
    parts.push(emitObject(exportName, next, de));
  }

  fs.writeFileSync(outPath, parts.join('\n'), 'utf8');
  console.log(`Wrote ${path.relative(repoRoot, outPath)}`);
}

main();
