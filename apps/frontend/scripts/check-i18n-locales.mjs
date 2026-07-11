#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const localeDir = path.resolve(scriptDir, '../src/locale');
const sourceFile = 'messages.xlf';
const translatedFiles = [
  'messages.en.xlf',
  'messages.fr.xlf',
  'messages.es.xlf',
  'messages.it.xlf',
];

const unitRegex = /<trans-unit\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/trans-unit>/g;
const sourceRegex = /<source>([\s\S]*?)<\/source>/;
const targetRegex = /<target(?:\s[^>]*)?>([\s\S]*?)<\/target>/;
const placeholderRegex = /<x\b[^>]*\bid="([^"]+)"[^>]*\/?>/g;
const inlinePlaceholderRegex = /\{\$([^}]+)\}/g;

function parseUnits(file) {
  const content = fs.readFileSync(path.join(localeDir, file), 'utf8');
  const units = new Map();
  const duplicates = [];

  for (const match of content.matchAll(unitRegex)) {
    const id = match[1];
    if (units.has(id)) {
      duplicates.push(id);
      continue;
    }
    units.set(id, {
      source: match[2].match(sourceRegex)?.[1] ?? '',
      target: match[2].match(targetRegex)?.[1] ?? '',
    });
  }

  return { units, duplicates };
}

function placeholderIds(value) {
  const tagPlaceholders = [...value.matchAll(placeholderRegex)]
    .map((match) => match[1])
    .filter((id) => !/^(?:START|CLOSE)_(?:BLOCK|TAG)_?/.test(id));
  const inlinePlaceholders = [...value.matchAll(inlinePlaceholderRegex)].map((match) => match[1]);
  return [...tagPlaceholders, ...inlinePlaceholders].sort();
}

function sameValues(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function validateLocale(file, sourceUnits) {
  const { units, duplicates } = parseUnits(file);
  const errors = duplicates.map((id) => `${file}: doppelte trans-unit-ID ${id}`);

  for (const [id, sourceUnit] of sourceUnits) {
    const translatedUnit = units.get(id);
    if (!translatedUnit) {
      errors.push(`${file}: fehlende trans-unit-ID ${id}`);
      continue;
    }
    if (!translatedUnit.target.trim()) {
      errors.push(`${file}: leeres target für ${id}`);
    }

    const sourcePlaceholders = placeholderIds(sourceUnit.source);
    const targetPlaceholders = placeholderIds(translatedUnit.target);
    if (!sameValues(sourcePlaceholders, targetPlaceholders)) {
      errors.push(
        `${file}: Platzhalterabweichung für ${id} (source=${sourcePlaceholders.join(',') || '-'}, target=${targetPlaceholders.join(',') || '-'})`,
      );
    }
  }

  for (const id of units.keys()) {
    if (!sourceUnits.has(id)) {
      errors.push(`${file}: verwaiste trans-unit-ID ${id}`);
    }
  }

  return { errors, unitCount: units.size };
}

const { units: sourceUnits, duplicates: sourceDuplicates } = parseUnits(sourceFile);
const failures = sourceDuplicates.map((id) => `${sourceFile}: doppelte trans-unit-ID ${id}`);

for (const file of translatedFiles) {
  const result = validateLocale(file, sourceUnits);
  failures.push(...result.errors);
  console.log(`${file}: ${result.unitCount}/${sourceUnits.size} Einheiten geprüft`);
}

if (failures.length > 0) {
  console.error('\ni18n-Konsistenzprüfung fehlgeschlagen:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`i18n-Konsistenzprüfung bestanden (${sourceUnits.size} Quell-Einheiten).`);
}
