#!/usr/bin/env node
// Prüft das Referenzset: Struktur, Verteilung und Überschneidung mit dem 8.9b-Seed.
// Aufruf: node check-leakage.mjs <reference.json> <pfad/zu/qaNlpSeed.ts>
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const [refPath, seedPath] = process.argv.slice(2);
if (!refPath || !seedPath) {
  console.error('usage: node check-leakage.mjs <reference.json> <qaNlpSeed.ts>');
  process.exit(2);
}

const raw = readFileSync(refPath, 'utf8');
const ref = JSON.parse(raw);
const seedSrc = readFileSync(seedPath, 'utf8');

// Seed ist transliteriert (oe statt ö) – deshalb beide Seiten gleich falten.
const fold = (s) =>
  s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const tokens = (s) => new Set(fold(s).split(' ').filter(Boolean));
const jaccard = (a, b) => {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter || 1);
};

const seed = [
  ...seedSrc.matchAll(/text:\s*'((?:[^'\\]|\\.)*)',\s*category:\s*'(\w+)',\s*split:\s*'(\w+)'/g),
].map((m) => ({ text: m[1].replace(/\\'/g, "'"), category: m[2], split: m[3] }));

const errors = [];
const families = new Map(ref.families.map((f) => [f.id, f]));
const ids = new Set();
for (const it of ref.items) {
  if (ids.has(it.id)) errors.push(`doppelte id ${it.id}`);
  ids.add(it.id);
  const fam = families.get(it.family);
  if (fam && fam.category !== it.category) errors.push(`${it.id}: Kategorie ≠ Familienkategorie`);
  if (!fam && !it.family.startsWith('S-')) errors.push(`${it.id}: unbekannte Familie ${it.family}`);
  for (const tag of it.tags)
    if (!(tag in ref.meta.tags)) errors.push(`${it.id}: unbekannter Tag ${tag}`);
}
for (const f of ref.families) {
  const n = ref.items.filter((i) => i.family === f.id).length;
  if (n < 2) errors.push(`Familie ${f.id} hat nur ${n} Items`);
}

const LIMIT = 0.5;
const hits = [];
for (const it of ref.items) {
  const a = tokens(it.text);
  let best = { score: 0 };
  for (const s of seed) {
    const score = fold(it.text) === fold(s.text) ? 1 : jaccard(a, tokens(s.text));
    if (score > best.score) best = { score, s };
  }
  if (best.score >= LIMIT) hits.push({ id: it.id, text: it.text, score: best.score, seed: best.s });
}

const count = (key) =>
  ref.items.reduce((m, i) => {
    for (const k of [].concat(key(i))) m[k] = (m[k] ?? 0) + 1;
    return m;
  }, {});

console.log(
  `Referenzset ${ref.meta.version}: ${ref.items.length} Items, ${ref.families.length} Mehrfach-Familien`,
);
console.log(`SHA-256: ${createHash('sha256').update(raw).digest('hex')}`);
console.log(`Seed: ${seed.length} Beispiele gelesen`);
console.log(
  'Kategorie:',
  count((i) => String(i.category)),
);
console.log(
  'Locale:   ',
  count((i) => i.locale),
);
console.log(
  'Tags:     ',
  count((i) => (i.tags.length ? i.tags : ['(none)'])),
);
console.log(`\nSeed-Nähe (Jaccard ≥ ${LIMIT}): ${hits.length}`);
for (const h of hits) {
  console.log(
    `  ${h.id} ${h.score.toFixed(2)} [${h.seed.split}/${h.seed.category}] "${h.text}"  ~  "${h.seed.text}"`,
  );
}
console.log(`\nStrukturfehler: ${errors.length}`);
for (const e of errors) console.log('  ' + e);
process.exit(errors.length || hits.some((h) => h.seed.split !== 'eval') ? 1 : 0);
