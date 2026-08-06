#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const INVENTORY_PATH = new URL('./script-lint-inventory.json', import.meta.url);

function escapeRegex(character) {
  return /[|\\{}()[\]^$+?.]/.test(character) ? `\\${character}` : character;
}

export function globMatches(path, glob) {
  let pattern = '^';
  for (let index = 0; index < glob.length; index += 1) {
    const character = glob[index];
    if (character === '*') {
      if (glob[index + 1] === '*') {
        index += 1;
        if (glob[index + 1] === '/') {
          index += 1;
          pattern += '(?:.*/)?';
        } else {
          pattern += '.*';
        }
      } else {
        pattern += '[^/]*';
      }
    } else {
      pattern += escapeRegex(character);
    }
  }
  return new RegExp(`${pattern}$`).test(path);
}

export function classifyFile(path, inventory) {
  const matchingProfiles = inventory.profiles.filter(
    (profile) =>
      profile.include.some((glob) => globMatches(path, glob)) &&
      !profile.exclude.some((glob) => globMatches(path, glob)),
  );
  return matchingProfiles.map((profile) => profile.name);
}

export function isRelevantScript(path, inventory) {
  return inventory.extensions.some((extension) => path.endsWith(extension));
}

export function isDocumentedException(path, inventory) {
  return inventory.exceptions.some((exception) => globMatches(path, exception.glob));
}

export function listTrackedFiles() {
  return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean);
}

export function validateInventory(inventory, files) {
  const relevantFiles = files.filter((path) => isRelevantScript(path, inventory));
  const errors = [];
  const rows = [];
  const scopedFiles = relevantFiles.filter(
    (path) =>
      inventory.scope.some((glob) => globMatches(path, glob)) &&
      !isDocumentedException(path, inventory),
  );
  for (const path of scopedFiles) {
    const profiles = classifyFile(path, inventory);
    if (profiles.length === 0) {
      errors.push(`${path}: script path is in scope but has no profile`);
      continue;
    }
    if (profiles.length !== 1) {
      errors.push(`${path}: expected exactly one profile, found ${profiles.join(', ')}`);
      continue;
    }
    rows.push({ file: path, profile: profiles[0] });
  }

  return { errors, rows };
}

export function loadInventory() {
  return JSON.parse(readFileSync(INVENTORY_PATH, 'utf8'));
}

function main() {
  const { errors, rows } = validateInventory(loadInventory(), listTrackedFiles());
  if (errors.length > 0) {
    process.stderr.write(`Script lint inventory failed:\n${errors.join('\n')}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `Script lint inventory: ${rows.length} tracked files assigned exactly once.\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
