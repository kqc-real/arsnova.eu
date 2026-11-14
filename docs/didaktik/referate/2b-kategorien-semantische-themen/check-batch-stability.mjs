#!/usr/bin/env node
// Prüft, ob das Embedding eines Textes von den anderen Texten derselben Anfrage abhängt.
// Aufruf: node check-batch-stability.mjs <reference.json> [http://127.0.0.1:8790/embed]
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const [refPath, url = 'http://127.0.0.1:8790/embed'] = process.argv.slice(2);
const ref = JSON.parse(readFileSync(refPath, 'utf8'));
const all = ref.items.map((i) => ({ id: i.id, text: i.text }));
const noIt = ref.items.filter((i) => i.locale !== 'it').map((i) => ({ id: i.id, text: i.text }));

async function embed(items) {
  const body = JSON.stringify({
    locale: 'de',
    snapshotHash: createHash('sha256').update(JSON.stringify(items)).digest('hex'),
    items,
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return new Map((await res.json()).items.map((x) => [x.id, x.embedding]));
}
const cos = (a, b) => {
  let d = 0,
    na = 0,
    nb = 0;
  for (let k = 0; k < a.length; k += 1) {
    d += a[k] * b[k];
    na += a[k] ** 2;
    nb += b[k] ** 2;
  }
  return d / Math.sqrt(na * nb);
};

const full1 = await embed(all);
const full2 = await embed(all);
const subset = await embed(noIt);
const singles = new Map();
for (const it of noIt.slice(0, 20)) singles.set(it.id, (await embed([it])).get(it.id));

const stat = (pairs) => {
  const d = pairs.map(([a, b]) => 1 - cos(a, b)).sort((x, y) => x - y);
  return `max ${d.at(-1).toExponential(2)}, median ${d[Math.floor(d.length / 2)].toExponential(2)}, n ${d.length}`;
};
console.log(
  'gleiche Anfrage zweimal       (1 - cos):',
  stat(all.map((i) => [full1.get(i.id), full2.get(i.id)])),
);
console.log(
  'Gesamtset vs. ohne Italienisch (1 - cos):',
  stat(noIt.map((i) => [full1.get(i.id), subset.get(i.id)])),
);
console.log(
  'Gesamtset vs. Einzelanfrage    (1 - cos):',
  stat([...singles].map(([id, v]) => [full1.get(id), v])),
);

// Wie stark verschieben sich Paarähnlichkeiten in der Nähe der Schwelle 0,87?
let flips = 0,
  near = 0;
const ids = noIt.map((i) => i.id);
for (let a = 0; a < ids.length; a += 1)
  for (let b = a + 1; b < ids.length; b += 1) {
    const s1 = cos(full1.get(ids[a]), full1.get(ids[b]));
    const s2 = cos(subset.get(ids[a]), subset.get(ids[b]));
    if (Math.abs(s1 - 0.87) < 0.01) near += 1;
    if (s1 >= 0.87 !== s2 >= 0.87) flips += 1;
  }
console.log(
  `Paare mit |cos - 0,87| < 0,01: ${near}; Paare, die je nach Batch die Schwelle wechseln: ${flips}`,
);
