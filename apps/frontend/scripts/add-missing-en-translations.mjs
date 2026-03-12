#!/usr/bin/env node
/**
 * Fügt fehlende trans-units aus messages.xlf in messages.en.xlf ein (mit englischem target).
 * Nur für IDs, die in en fehlen; Target-Text aus ID→EN Map.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localeDir = path.join(__dirname, '../src/locale');
const xlfPath = path.join(localeDir, 'messages.xlf');
const enPath = path.join(localeDir, 'messages.en.xlf');

const TARGET_BY_ID = {
  '3293413491190500382': '"\"" was duplicated.',
  '4762683087008225986': 'Duplicate failed.',
  '1590286753172731809': '"\"" is currently live and cannot be deleted.',
  '3191214074647652455': 'Really delete "\""? This cannot be undone.',
  '4443887030685792442': '"\"" was deleted.',
  '4357290152640831712': 'Delete failed.',
  '6566123000837537104': '"\"" was exported.',
  '1016176997972069088': 'Export failed.',
  '523492152856026511': '"\"" was imported.',
  '990033847964014823': 'Import failed.',
  '4312378971475601737': 'Prompt copied to clipboard.',
  '1470494159022701029': 'Copy failed – please copy manually.',
  '1234862766189211955': 'Add the AI JSON first.',
  '3967078712690677551': 'AI "\"" was imported.',
  '4513949433042265518': 'AI import failed.',
  '4816916877207589304': 'Session <x id="PH"/> started.',
  '8680320837061900030': 'Live start failed.',
  '4077659868462369036': 'Too many sessions – please try again later.',
  '7000635549914845512': 'Before/after comparison Peer Instruction',
  '4102765943850996306': 'More actions',
  '6361582957693255944': 'Export freetext session as CSV',
  '4017389878545296254': 'Waiting for live freetext data …',
  '7037370522292851726': 'Session CSV exported.',
  '2061865449420302342': 'Session CSV could not be exported.',
  '1459586565397898784': 'Results are in.',
  '3158548505527185467': "Time's up.",
  '1777945885954120583': 'Waiting for ratings…',
  '6747188936976845111': 'Waiting for answers…',
  '5598682335417207093': '<x id="PH"/> of <x id="PH_1"/> has responded',
  '4585702281654307614': '<x id="PH"/> of <x id="PH_1"/> have responded',
  '1234284807882172595': 'Result CSV exported.',
  '163495290423277905': 'Live freetext is being updated.',
  '5499551582155303933': 'Current question is not a freetext question.',
  '3759418096569402581': 'No active question yet.',
  '464314562794611731': 'Live freetext data could not be loaded.',
  '9100338136740737033': 'Yes, gladly again',
  '1129377650136106404': 'Yes, gladly',
  '872696803891941459': 'Rather not',
  '9175670018185396326': 'Error',
};

const xlf = fs.readFileSync(xlfPath, 'utf8');
const en = fs.readFileSync(enPath, 'utf8');

const enIds = new Set();
const idRegex = /<trans-unit id="([^"]+)"/g;
let match;
while ((match = idRegex.exec(en)) !== null) enIds.add(match[1]);

const unitRegex = /<trans-unit id="([^"]+)"[^>]*>([\s\S]*?)<\/trans-unit>/g;
const toInsert = [];

while ((match = unitRegex.exec(xlf)) !== null) {
  const id = match[1];
  if (!enIds.has(id) && TARGET_BY_ID[id]) {
    const inner = match[2];
    const targetEscaped = TARGET_BY_ID[id].replace(/&/g, '&amp;');
    const withTarget = inner.replace(/\s*<\/source>\s*/, `</source>\n        <target>${targetEscaped}</target>\n        `);
    toInsert.push(`      <trans-unit id="${id}" datatype="html">
        ${withTarget.trim()}
      </trans-unit>`);
  }
}

if (toInsert.length === 0) {
  console.log('No missing translations to add.');
  process.exit(0);
}

const insertPoint = en.lastIndexOf('    </body>');
const before = en.slice(0, insertPoint);
const after = en.slice(insertPoint);
const out = before + '\n' + toInsert.join('\n') + '\n' + after;
fs.writeFileSync(enPath, out, 'utf8');
console.log(`Added ${toInsert.length} missing translation(s) to messages.en.xlf`);
