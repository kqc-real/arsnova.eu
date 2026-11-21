// Gate-Ablation offline: wendet das Quality-Gate (v1.4.0) auf aufgezeichnete Modellantworten an
// und zerlegt das Urteil je Regel. Vorab festgelegt in ../2026-11-16-gate-ablation.md.
// Aufruf: node --import tsx docs/referat-thema-1/evidenz/1C/messung/gate-ablation.mjs
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const hier = dirname(fileURLToPath(import.meta.url));

// Nachbildung der Regeln aus apps/backend/src/lib/qaSummaryQuality.ts (Stand v1.4.0).
const GENERISCH_DE = new Set(['beispiel', 'beispiele', 'frage', 'fragen']);
const META = [
  /\b(?:source|quellen)[- ]?ids?\b/iu,
  /\b(?:token|kontext)[- ]?budget\b/iu,
  /\b(?:aufgrund|wegen)\s+(?:des|eines|dem)?\s*(?:token[- ]?|kontext[- ]?)?budgets?\b/iu,
  /\b(?:einige|mehrere|\d+)\s+(?:fragen|themen|einträge|inhalte)\s+(?:wurden\s+)?nicht berücksichtigt\b/iu,
  /\b(?:some|several|\d+)\s+(?:questions|topics|items|sources)\s+(?:were\s+)?(?:not included|omitted)\b/iu,
  /\b(?:als\s+)?(?:pending|pinned|active)(?:-status)?\s+(?:markiert|gekennzeichnet)\b/iu,
  /\bstatus\s*[:=]\s*(?:pending|pinned|active)\b/iu,
];
const ABBRUCH =
  /\b(?:eine|einen|einem|einer|hohe|niedrige|mehrere|wenige|positive[nmrs]?|negative[nmrs]?|starke[nmrs]?|geringe[nmrs]?)\s*[.!?…»”’)]*$/iu;

function teile(text) {
  const doppelpunkt = text.indexOf(':');
  const strich = text.match(/\s[–—-]\s/u);
  const trenner =
    doppelpunkt > 0
      ? { index: doppelpunkt, laenge: 1 }
      : strich?.index !== undefined
        ? { index: strich.index, laenge: strich[0].length }
        : null;
  if (!trenner || trenner.index <= 0 || trenner.index > 48) return null;
  const lead = text
    .slice(0, trenner.index)
    .normalize('NFKC')
    .replace(/^[\s*_`~#]+|[\s*_`~#]+$/gu, '')
    .trim()
    .toLocaleLowerCase('de');
  const body = text
    .slice(trenner.index + trenner.laenge)
    .replace(/[*_`~#]+/gu, '')
    .trim();
  return lead && body ? { lead, body } : null;
}

export const REGELN = {
  R1: 'Form',
  R2: 'Form',
  R3: 'Form',
  R4: 'Inhalt',
  R5: 'Inhalt',
  R6: 'Form',
  R7: 'Form',
  R8: 'Inhalt',
};

/** Verletzte Regeln einer Ausgabe; leere Liste = Gate lässt durch. */
export function verletzteRegeln(output) {
  if (output.status === 'failed') return [];
  if (output.status === 'uncertain' && output.statements.length === 0) return [];
  const texte = output.statements.map((s) => s.text);
  const t = texte.map(teile);
  const v = new Set();
  if (texte.length < 2) v.add('R1');
  if (t.some((x) => x === null)) v.add('R2');
  if (texte.some((x) => x.includes('**') || x.includes('__') || x.includes('`'))) v.add('R3');
  if (texte.some((x) => META.some((m) => m.test(x)))) v.add('R4');
  if (t.some((x) => x && ABBRUCH.test(x.body))) v.add('R5');
  if (t.some((x) => x && !(x.body.length >= 12 && /[.!?…»”’)]$/u.test(x.body)))) v.add('R6');
  const leads = t.filter(Boolean).map((x) => x.lead);
  if (new Set(leads).size !== leads.length) v.add('R7');
  if (leads.some((l) => GENERISCH_DE.has(l))) v.add('R8');
  return [...v].sort();
}

/** Alle Modellantworten (Ausgabe-Objekte) einer Rohdatei; null = nicht auswertbar. */
export function antworten(datei) {
  const j = JSON.parse(gunzipSync(readFileSync(datei)).toString('utf8'));
  const gefunden = [];
  const lauf = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) return o.forEach(lauf);
    if ('rawResponseBody' in o && o.rawResponseBody) {
      const roh =
        typeof o.rawResponseBody === 'string' ? JSON.parse(o.rawResponseBody) : o.rawResponseBody;
      const inhalt = roh?.choices?.[0]?.message?.content;
      if (inhalt !== undefined) {
        try {
          const env = JSON.parse(inhalt);
          gefunden.push(env?.output?.statements ? env.output : null);
        } catch {
          gefunden.push(null);
        }
      }
    }
    Object.values(o).forEach(lauf);
  };
  lauf(j);
  return { commit: j.environment?.baseline ?? null, antworten: gefunden };
}

async function main() {
  const { hasAcceptableQaSummaryQuality } =
    await import('../../../../../apps/backend/src/lib/qaSummaryQuality.ts');
  const dateien = [
    ['def56700 Laptop', '2026-11-09-labor-nachlauf.json.gz'],
    ['9f230abc Laptop', '2026-11-05-labor.json.gz'],
    ['9f230abc PC', '2026-11-05-labor-pc.json.gz'],
  ];
  const bericht = {};
  for (const [name, datei] of dateien) {
    const { commit, antworten: liste } = antworten(join(hier, datei));
    const auswertbar = liste.filter(Boolean);
    const zaehler = Object.fromEntries(Object.keys(REGELN).map((r) => [r, 0]));
    let nurR2 = 0;
    let inhalt = 0;
    let verworfen = 0;
    let abweichung = 0;
    for (const out of auswertbar) {
      const v = verletzteRegeln(out);
      const echt = hasAcceptableQaSummaryQuality(out, 'de');
      if (echt !== (v.length === 0)) abweichung++;
      if (!echt) verworfen++;
      v.forEach((r) => zaehler[r]++);
      if (v.length === 1 && v[0] === 'R2') nurR2++;
      if (v.some((r) => REGELN[r] === 'Inhalt')) inhalt++;
    }
    bericht[name] = {
      datei,
      baseline: commit,
      antworten: liste.length,
      nichtAuswertbar: liste.length - auswertbar.length,
      auswertbar: auswertbar.length,
      gateVerwirft: verworfen,
      konsistenzAbweichungen: abweichung,
      regelVerletzt: zaehler,
      nurR2,
      mitInhaltsregel: inhalt,
    };
  }
  console.log(JSON.stringify(bericht, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
