#!/usr/bin/env tsx
/**
 * Referat 2B – Klassifikationsmessung (Story 8.9b) gegen das eigene Referenzset.
 *
 * Vergleicht drei Systeme aus dem unveränderten Releasecode:
 *   keyword    – qaNlpKeywordBaseline (regelbasierte Baseline)
 *   gatekeeper – Hash-n-Gramm-Naive-Bayes, nur Konfidenzschwelle
 *   cascade    – produktive Kaskade (Gatekeeper + Early-Exit + k-NN-Fallback)
 *
 * Aufruf (aus dem Repo-Root, damit tsx und Workspace-Pakete auflösen):
 *   npx tsx <pfad>/measure-classification.ts --repo . --ref <reference.json> --out <dir>
 * Optionen: --runs 20 (Timing-Wiederholungen), --bootstrap 2000, --seed 456
 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

// ---------- Argumente ----------
const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2)
  args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const repo = resolve(args.get('repo') ?? '.');
const refPath = resolve(args.get('ref') ?? 'reference-dataset.v1.json');
const outRoot = resolve(args.get('out') ?? 'results');
const RUNS = Number(args.get('runs') ?? 20);
const BOOTSTRAP = Number(args.get('bootstrap') ?? 2000);
const SEED = Number(args.get('seed') ?? 456);

// ---------- Releasemodule laden (Kaltstart wird separat gemessen) ----------
const lib = (name: string) =>
  import(pathToFileURL(join(repo, 'apps/backend/src/lib', `${name}.ts`)).href);
const memBefore = process.memoryUsage();
const [cfg, nbMod, gkMod, fbMod, cascadeMod, kwMod] = await Promise.all([
  lib('qaNlpConfig'),
  lib('qaNlpNaiveBayes'),
  lib('qaNlpGatekeeper'),
  lib('qaNlpFallback'),
  lib('qaNlpCascade'),
  lib('qaNlpKeywordBaseline'),
]);
let t0 = performance.now();
const model = gkMod.getQaNlpGatekeeperModel();
const gatekeeperTrainMs = performance.now() - t0;
t0 = performance.now();
fbMod.getQaNlpFallbackPrototypes();
const fallbackBuildMs = performance.now() - t0;
const memAfter = process.memoryUsage();

// ---------- Typen ----------
type Category = 'content' | 'organization' | 'technical';
const CATEGORIES: Category[] = ['content', 'organization', 'technical'];
type Item = {
  id: string;
  text: string;
  locale: string;
  tags: string[];
  family: string;
  category: Category | null;
  expectUncertain?: boolean;
  domain?: string;
};
type Pred = { category: Category; confidence: number; accepted: boolean; path?: string };
type System = { id: string; label: string; predict: (text: string, t: number) => Pred };

const refRaw = readFileSync(refPath, 'utf8');
const refAll = JSON.parse(refRaw) as { meta: { version: string }; items: Item[] };
// Untersuchungsumfang wie bei der Themenmessung: de/en/fr/es (+ mixed); 'it' ausgeschlossen
const LOCALES = (args.get('locales') ?? 'de,en,fr,es').split(',').map((s) => s.trim());
// Fachdomäne (ab v2.1): Items ohne domain gehören zur Statistik-Vorlesung; 'all' nimmt alle Domänen
const DOMAIN = args.get('domain') ?? 'statistics';
const inDomain = (i: Item) => DOMAIN === 'all' || (i.domain ?? 'statistics') === DOMAIN;
const ref = {
  ...refAll,
  items: refAll.items.filter(
    (i) => (i.locale === 'mixed' || LOCALES.includes(i.locale)) && inDomain(i),
  ),
};
const labeled = ref.items.filter((i) => i.category !== null && !i.expectUncertain);
const abstain = ref.items.filter((i) => i.expectUncertain);

const FIXED_DATE = new Date('2026-01-01T00:00:00Z');
const SYSTEMS: System[] = [
  {
    id: 'keyword',
    label: 'Keyword-Baseline (regelbasiert)',
    predict: (text, t) => {
      const p = kwMod.predictQaNlpKeywordBaseline(text);
      return { category: p.category, confidence: p.confidence, accepted: p.confidence >= t };
    },
  },
  {
    id: 'gatekeeper',
    label: 'Gatekeeper (Naive Bayes, nur Schwelle)',
    predict: (text, t) => {
      const p = nbMod.predictQaNlpNaiveBayes(model, text);
      return { category: p.category, confidence: p.confidence, accepted: p.confidence >= t };
    },
  },
  {
    id: 'cascade',
    label: 'Kaskade 1.3 (Gatekeeper + k-NN)',
    predict: (text, t) => {
      const d = cascadeMod.classifyQaNlpCascade({ text: text.trim().slice(0, 500) }, t, FIXED_DATE);
      return {
        category: (d.category ?? 'content') as Category,
        confidence: d.confidence ?? 0,
        accepted: d.status === 'classified',
        path: d.earlyExit ? 'early-exit' : d.usedFallback ? 'fallback' : 'none',
      };
    },
  },
];

// ---------- Kontrollierte Variante: Transliteration (Seed/Keywords sind transliteriert) ----------
const TRANSLIT: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  Ä: 'Ae',
  Ö: 'Oe',
  Ü: 'Ue',
  ß: 'ss',
};
const transliterate = (s: string) => s.replace(/[äöüÄÖÜß]/g, (c) => TRANSLIT[c]);
type Variant = { id: string; label: string; text: (i: Item) => string };
const VARIANTS: Variant[] = [
  { id: 'original', label: 'Originalschreibung (Umlaute)', text: (i) => i.text },
  {
    id: 'translit',
    label: 'DE/mixed transliteriert (ä→ae …)',
    text: (i) => (i.locale === 'de' || i.locale === 'mixed' ? transliterate(i.text) : i.text),
  },
];

// ---------- Metriken ----------
const OPERATING = cfg.QA_NLP_MIN_CONFIDENCE_DEFAULT as number;
const SWEEP = [0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.8, 0.9];
// Vorab festgelegte Kriterien = Releasekonstanten aus qaNlpCalibrate.ts
const MIN_ACCEPTED_PRECISION = 0.8;
const MAX_UNCERTAIN_RATE = 0.3;

type Outcome = { item: Item; pred: Pred; correct: boolean };
const run = (sys: System, items: Item[], v: Variant, t: number): Outcome[] =>
  items.map((item) => {
    const pred = sys.predict(v.text(item), t);
    return { item, pred, correct: pred.category === item.category };
  });

function labeledMetrics(o: Outcome[]) {
  const n = o.length;
  const accepted = o.filter((x) => x.pred.accepted);
  const acceptedCorrect = accepted.filter((x) => x.correct).length;
  const confusion = Object.fromEntries(
    CATEGORIES.map((g) => [g, Object.fromEntries(CATEGORIES.map((p) => [p, 0]))]),
  ) as Record<Category, Record<Category, number>>;
  for (const x of o) confusion[x.item.category as Category][x.pred.category] += 1;
  const perClass = Object.fromEntries(
    CATEGORIES.map((c) => {
      const tp = confusion[c][c];
      const support = CATEGORIES.reduce((s, p) => s + confusion[c][p], 0);
      const predicted = CATEGORIES.reduce((s, g) => s + confusion[g][c], 0);
      const precision = predicted ? tp / predicted : 0;
      const recall = support ? tp / support : 0;
      const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
      return [c, { precision, recall, f1, support }];
    }),
  ) as Record<Category, { precision: number; recall: number; f1: number; support: number }>;
  return {
    n,
    bestGuessAccuracy: n ? o.filter((x) => x.correct).length / n : 0,
    macroF1: CATEGORIES.reduce((s, c) => s + perClass[c].f1, 0) / CATEGORIES.length,
    coverage: n ? accepted.length / n : 0,
    uncertainRate: n ? 1 - accepted.length / n : 0,
    acceptedPrecision: accepted.length ? acceptedCorrect / accepted.length : 0,
    usefulRate: n ? acceptedCorrect / n : 0,
    wrongAcceptedRate: n ? (accepted.length - acceptedCorrect) / n : 0,
    perClass,
    confusion,
  };
}
const abstentionRate = (o: Outcome[]) =>
  o.length ? o.filter((x) => !x.pred.accepted).length / o.length : 0;

function slices(o: Outcome[], key: (i: Item) => string[]) {
  const groups = new Map<string, Outcome[]>();
  for (const x of o) for (const k of key(x.item)) groups.set(k, [...(groups.get(k) ?? []), x]);
  return Object.fromEntries(
    [...groups].map(([k, g]) => {
      const m = labeledMetrics(g);
      return [
        k,
        {
          n: m.n,
          bestGuessAccuracy: m.bestGuessAccuracy,
          coverage: m.coverage,
          acceptedPrecision: m.acceptedPrecision,
          usefulRate: m.usefulRate,
          wrongAcceptedRate: m.wrongAcceptedRate,
        },
      ];
    }),
  );
}

function calibration(o: Outcome[]) {
  const edges = [0, 0.4, 0.55, 0.7, 0.85, 1.0001];
  const bins = edges.slice(0, -1).map((lo, i) => {
    const hi = edges[i + 1];
    const b = o.filter((x) => x.pred.confidence >= lo && x.pred.confidence < hi);
    const meanConf = b.length ? b.reduce((s, x) => s + x.pred.confidence, 0) / b.length : 0;
    const acc = b.length ? b.filter((x) => x.correct).length / b.length : 0;
    return {
      range: `[${lo.toFixed(2)}, ${Math.min(hi, 1).toFixed(2)}${hi > 1 ? ']' : ')'}`,
      n: b.length,
      meanConfidence: meanConf,
      accuracy: acc,
    };
  });
  const ece = bins.reduce(
    (s, b) => s + (b.n / o.length) * Math.abs(b.accuracy - b.meanConfidence),
    0,
  );
  return { bins, ece };
}

// Seeded RNG für reproduzierbares Bootstrap
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function bootstrap(o: Outcome[]) {
  const rnd = mulberry32(SEED);
  const keys = [
    'usefulRate',
    'acceptedPrecision',
    'coverage',
    'macroF1',
    'wrongAcceptedRate',
  ] as const;
  const samples: Record<string, number[]> = Object.fromEntries(keys.map((k) => [k, []]));
  for (let b = 0; b < BOOTSTRAP; b += 1) {
    const s = o.map(() => o[Math.floor(rnd() * o.length)]);
    const m = labeledMetrics(s);
    for (const k of keys) samples[k].push(m[k]);
  }
  const q = (arr: number[], p: number) =>
    arr.sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(p * arr.length))];
  return Object.fromEntries(
    keys.map((k) => [k, { lo: q(samples[k], 0.025), hi: q(samples[k], 0.975) }]),
  );
}

// Exakter zweiseitiger McNemar-Test auf gepaarten binären Ergebnissen
function mcnemar(a: boolean[], b: boolean[]) {
  let onlyA = 0;
  let onlyB = 0;
  a.forEach((x, i) => {
    if (x && !b[i]) onlyA += 1;
    if (!x && b[i]) onlyB += 1;
  });
  const n = onlyA + onlyB;
  let tail = 0;
  let term = Math.pow(0.5, n); // C(n,0)/2^n
  for (let k = 0; k <= Math.min(onlyA, onlyB); k += 1) {
    tail += term;
    term = (term * (n - k)) / (k + 1);
  }
  return { onlyA, onlyB, p: n === 0 ? 1 : Math.min(1, 2 * tail) };
}

function latency(sys: System, texts: string[]) {
  for (const t of texts) sys.predict(t, OPERATING); // Warm-up
  const samples: number[] = [];
  const start = performance.now();
  for (let r = 0; r < RUNS; r += 1) {
    for (const t of texts) {
      const s = performance.now();
      sys.predict(t, OPERATING);
      samples.push(performance.now() - s);
    }
  }
  const totalMs = performance.now() - start;
  samples.sort((a, b) => a - b);
  const pct = (p: number) => samples[Math.min(samples.length - 1, Math.floor(p * samples.length))];
  return {
    calls: samples.length,
    meanMs: samples.reduce((s, x) => s + x, 0) / samples.length,
    p50Ms: pct(0.5),
    p95Ms: pct(0.95),
    p99Ms: pct(0.99),
    maxMs: samples[samples.length - 1],
    throughputPerSec: samples.length / (totalMs / 1000),
  };
}

// ---------- Ausführung ----------
const results: Record<string, any> = {};
for (const v of VARIANTS) {
  results[v.id] = {};
  for (const sys of SYSTEMS) {
    const op = run(sys, labeled, v, OPERATING);
    const opAbstain = run(sys, abstain, v, OPERATING);
    results[v.id][sys.id] = {
      operatingPoint: OPERATING,
      labeled: labeledMetrics(op),
      abstentionOnAmbiguousAndNoise: { n: opAbstain.length, rate: abstentionRate(opAbstain) },
      byLocale: slices(op, (i) => [i.locale]),
      byTag: slices(op, (i) => (i.tags.length ? i.tags : ['(none)'])),
      byGoldCategory: slices(op, (i) => [i.category as string]),
      calibration: sys.id === 'keyword' ? null : calibration(op),
      bootstrap95: bootstrap(op),
      sweep: SWEEP.map((t) => {
        const m = labeledMetrics(run(sys, labeled, v, t));
        const ab = abstentionRate(run(sys, abstain, v, t));
        return {
          threshold: t,
          coverage: m.coverage,
          uncertainRate: m.uncertainRate,
          acceptedPrecision: m.acceptedPrecision,
          usefulRate: m.usefulRate,
          wrongAcceptedRate: m.wrongAcceptedRate,
          abstention: ab,
          meetsCriteria:
            m.acceptedPrecision >= MIN_ACCEPTED_PRECISION && m.uncertainRate <= MAX_UNCERTAIN_RATE,
        };
      }),
      cascadePaths:
        sys.id === 'cascade'
          ? op.reduce<Record<string, number>>(
              (m, x) => ({ ...m, [x.pred.path!]: (m[x.pred.path!] ?? 0) + 1 }),
              {},
            )
          : undefined,
      outcomes: [...op, ...opAbstain].map((x) => ({
        id: x.item.id,
        category: x.pred.category,
        confidence: Number(x.pred.confidence.toFixed(4)),
        accepted: x.pred.accepted,
        correct: x.item.category === null ? null : x.correct,
        path: x.pred.path,
      })),
    };
  }
}

// Paarvergleiche (Originalschreibung, Betriebspunkt)
const outcomesFor = (sysId: string) =>
  run(
    SYSTEMS.find((s) => s.id === sysId)!,
    labeled,
    VARIANTS[0],
    OPERATING,
  );
const oKw = outcomesFor('keyword');
const oGk = outcomesFor('gatekeeper');
const oCa = outcomesFor('cascade');
const useful = (o: Outcome[]) => o.map((x) => x.pred.accepted && x.correct);
const best = (o: Outcome[]) => o.map((x) => x.correct);
const pairwise = {
  'cascade vs keyword': {
    useful: mcnemar(useful(oCa), useful(oKw)),
    bestGuess: mcnemar(best(oCa), best(oKw)),
  },
  'gatekeeper vs keyword': {
    useful: mcnemar(useful(oGk), useful(oKw)),
    bestGuess: mcnemar(best(oGk), best(oKw)),
  },
  'cascade vs gatekeeper': {
    useful: mcnemar(useful(oCa), useful(oGk)),
    bestGuess: mcnemar(best(oCa), best(oGk)),
  },
};

const texts = ref.items.map((i) => i.text);
const runtime = {
  coldStart: {
    gatekeeperTrainMs,
    fallbackPrototypeBuildMs: fallbackBuildMs,
    heapUsedDeltaMB: (memAfter.heapUsed - memBefore.heapUsed) / 2 ** 20,
    rssDeltaMB: (memAfter.rss - memBefore.rss) / 2 ** 20,
    note: 'Delta enthält Modul-Import und Training; Größenordnung, keine exakte Modellgröße.',
  },
  warmLatency: Object.fromEntries(SYSTEMS.map((s) => [s.id, latency(s, texts)])),
  productionTimeoutMs: cfg.QA_NLP_TIMEOUT_DEFAULT_MS,
};

const git = (c: string) => {
  try {
    return execSync(`git -C "${repo}" ${c}`, { encoding: 'utf8' }).trim();
  } catch {
    return 'n/a';
  }
};
const manifest = {
  timestamp: new Date().toISOString(),
  commit: git('rev-parse HEAD'),
  describe: git('describe --tags --always --dirty'),
  qaNlpSourcesDirty: git('status --porcelain -- apps/backend/src/lib') !== '',
  node: process.version,
  platform: `${os.platform()} ${os.release()} ${os.arch()}`,
  cpu: `${os.cpus()[0]?.model} × ${os.cpus().length}`,
  totalMemGB: Number((os.totalmem() / 2 ** 30).toFixed(1)),
  reference: {
    path: refPath,
    version: ref.meta.version,
    sha256: createHash('sha256').update(refRaw).digest('hex'),
    labeled: labeled.length,
    expectUncertain: abstain.length,
    itemsInFile: refAll.items.length,
    locales: LOCALES,
    domain: DOMAIN,
  },
  releaseConstants: {
    QA_NLP_MIN_CONFIDENCE_DEFAULT: cfg.QA_NLP_MIN_CONFIDENCE_DEFAULT,
    QA_NLP_EARLY_EXIT_MARGIN: cfg.QA_NLP_EARLY_EXIT_MARGIN,
    QA_NLP_EARLY_EXIT_MIN_TOKENS: cfg.QA_NLP_EARLY_EXIT_MIN_TOKENS,
    QA_NLP_FALLBACK_K: cfg.QA_NLP_FALLBACK_K,
    QA_NLP_FALLBACK_MIN_AGREEMENT: cfg.QA_NLP_FALLBACK_MIN_AGREEMENT,
    QA_NLP_GATEKEEPER_MODEL_VERSION: cfg.QA_NLP_GATEKEEPER_MODEL_VERSION,
    QA_NLP_FALLBACK_MODEL_VERSION: cfg.QA_NLP_FALLBACK_MODEL_VERSION,
  },
  criteria: {
    MIN_ACCEPTED_PRECISION,
    MAX_UNCERTAIN_RATE,
    source: 'apps/backend/src/lib/qaNlpCalibrate.ts',
  },
  settings: { RUNS, BOOTSTRAP, SEED, SWEEP },
};

// ---------- Ausgabe ----------
const stamp = manifest.timestamp.replace(/[:.]/g, '-');
const outDir = join(
  outRoot,
  `classification-${DOMAIN === 'statistics' ? '' : DOMAIN + '-'}${stamp}`,
);
mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, 'results.json'),
  JSON.stringify({ manifest, results, pairwise, runtime }, null, 2),
);

const csvEsc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
const csvHead = ['id', 'locale', 'tags', 'family', 'gold', 'expectUncertain', 'text'];
const csvRows = [
  [
    ...csvHead,
    ...VARIANTS.flatMap((v) =>
      SYSTEMS.flatMap((s) => [
        `${v.id}.${s.id}.category`,
        `${v.id}.${s.id}.confidence`,
        `${v.id}.${s.id}.accepted`,
      ]),
    ),
  ].join(';'),
];
for (const item of ref.items) {
  const row: unknown[] = [
    item.id,
    item.locale,
    item.tags.join('|'),
    item.family,
    item.category ?? '',
    item.expectUncertain ? 1 : 0,
    item.text,
  ];
  for (const v of VARIANTS)
    for (const s of SYSTEMS) {
      const o = results[v.id][s.id].outcomes.find((x: any) => x.id === item.id);
      row.push(o.category, o.confidence, o.accepted ? 1 : 0);
    }
  csvRows.push(row.map(csvEsc).join(';'));
}
writeFileSync(join(outDir, 'items.csv'), '﻿' + csvRows.join('\n'));

const pct = (x: number) => `${(x * 100).toFixed(1)} %`;
const ci = (c: { lo: number; hi: number }) => `[${pct(c.lo)}; ${pct(c.hi)}]`;
const ms = (x: number) => (x < 1 ? `${(x * 1000).toFixed(0)} µs` : `${x.toFixed(2)} ms`);
const L: string[] = [];
const R = results.original;
L.push('# Referat 2B – Klassifikationsmessung 8.9b', '');
L.push(
  `Commit \`${manifest.commit.slice(0, 12)}\` (${manifest.describe}), Referenzset ${ref.meta.version} (SHA-256 \`${manifest.reference.sha256.slice(0, 16)}…\`), ${manifest.timestamp}`,
);
L.push(
  `Node ${manifest.node}, ${manifest.cpu}, ${manifest.totalMemGB} GB RAM, ${manifest.platform}`,
);
if (manifest.qaNlpSourcesDirty)
  L.push(
    '',
    '> **Achtung:** `apps/backend/src/lib` hat lokale Änderungen – keine unveränderte Baseline.',
  );
L.push(
  '',
  `Umfang: ${ref.items.length} von ${refAll.items.length} Items, Domäne ${DOMAIN}, Sprachen ${LOCALES.join(', ')} (+ mixed); Italienisch ausgeschlossen (Untersuchungsumfang an Wortwolken-Locales angeglichen).`,
);
L.push(
  '',
  `Gelabelt: ${labeled.length} Items · erwartet unsicher (mehrdeutig/Rauschen): ${abstain.length} · Betriebspunkt \`QA_NLP_MIN_CONFIDENCE\` = ${OPERATING}`,
);
L.push('', '## 1. Hauptergebnis (Originalschreibung, Betriebspunkt)', '');
L.push(
  '| System | Best-Guess-Acc. | Macro-F1 | Abdeckung | Präzision akzeptiert | Nutzbar korrekt | Falsch akzeptiert | Enthaltung mehrdeutig/Rauschen |',
);
L.push('|---|---:|---:|---:|---:|---:|---:|---:|');
for (const s of SYSTEMS) {
  const m = R[s.id].labeled;
  L.push(
    `| ${s.label} | ${pct(m.bestGuessAccuracy)} | ${m.macroF1.toFixed(3)} | ${pct(m.coverage)} | ${pct(m.acceptedPrecision)} | ${pct(m.usefulRate)} | ${pct(m.wrongAcceptedRate)} | ${pct(R[s.id].abstentionOnAmbiguousAndNoise.rate)} |`,
  );
}
L.push(
  '',
  '*Nutzbar korrekt* = akzeptiert und richtig, bezogen auf alle gelabelten Items. *Falsch akzeptiert* = Lehrperson sieht eine sichere, aber falsche Kategorie.',
);
L.push('', '### 95-%-Bootstrap-Intervalle', '');
L.push(
  '| System | Nutzbar korrekt | Präzision akzeptiert | Abdeckung | Macro-F1 |',
  '|---|---|---|---|---|',
);
for (const s of SYSTEMS) {
  const b = R[s.id].bootstrap95;
  L.push(
    `| ${s.label} | ${ci(b.usefulRate)} | ${ci(b.acceptedPrecision)} | ${ci(b.coverage)} | [${b.macroF1.lo.toFixed(3)}; ${b.macroF1.hi.toFixed(3)}] |`,
  );
}
L.push('', '### Paarvergleich (exakter McNemar-Test, gepaart über dieselben Items)', '');
L.push('| Vergleich | Merkmal | nur A richtig | nur B richtig | p |', '|---|---|---:|---:|---:|');
for (const [name, r] of Object.entries(pairwise))
  for (const [k, v] of Object.entries(r))
    L.push(
      `| ${name} | ${k === 'useful' ? 'nutzbar korrekt' : 'Best-Guess korrekt'} | ${v.onlyA} | ${v.onlyB} | ${v.p.toFixed(4)} |`,
    );
L.push(
  '',
  `Kaskadenpfade: ${Object.entries(R.cascade.cascadePaths)
    .map(([k, v]) => `${k} ${v}`)
    .join(', ')}`,
);

L.push(
  '',
  '## 2. Schwellen-Sweep',
  '',
  `Vorab festgelegte Kriterien (Releasekonstanten): Präzision akzeptiert ≥ ${pct(MIN_ACCEPTED_PRECISION)}, Unsicher-Rate ≤ ${pct(MAX_UNCERTAIN_RATE)}.`,
);
for (const s of SYSTEMS) {
  L.push(
    '',
    `**${s.label}**`,
    '',
    '| Schwelle | Abdeckung | Präzision akz. | Nutzbar korrekt | Falsch akz. | Enthaltung mehrd. | Kriterien |',
    '|---:|---:|---:|---:|---:|---:|:---:|',
  );
  for (const p of R[s.id].sweep)
    L.push(
      `| ${p.threshold.toFixed(2)}${p.threshold === OPERATING ? ' ◀' : ''} | ${pct(p.coverage)} | ${pct(p.acceptedPrecision)} | ${pct(p.usefulRate)} | ${pct(p.wrongAcceptedRate)} | ${pct(p.abstention)} | ${p.meetsCriteria ? '✓' : '–'} |`,
    );
}

L.push('', '## 3. Slices (Betriebspunkt)', '');
for (const [title, key] of [
  ['Sprache', 'byLocale'],
  ['Tag', 'byTag'],
  ['Gold-Kategorie', 'byGoldCategory'],
] as const) {
  L.push(
    `**${title}** – nutzbar korrekt / falsch akzeptiert (n)`,
    '',
    `| ${title} | n | ${SYSTEMS.map((s) => s.id).join(' | ')} |`,
    `|---|---:|${SYSTEMS.map(() => '---').join('|')}|`,
  );
  for (const k of Object.keys(R.cascade[key]))
    L.push(
      `| ${k} | ${R.cascade[key][k].n} | ${SYSTEMS.map((s) => {
        const x = R[s.id][key][k];
        return `${pct(x.usefulRate)} / ${pct(x.wrongAcceptedRate)}`;
      }).join(' | ')} |`,
    );
  L.push('');
}

L.push('## 4. Kalibrierung der Konfidenz', '');
for (const s of SYSTEMS.filter((x) => x.id !== 'keyword')) {
  const c = R[s.id].calibration;
  L.push(
    `**${s.label}** – ECE ${c.ece.toFixed(3)}`,
    '',
    '| Konfidenzbereich | n | mittlere Konfidenz | tatsächliche Acc. |',
    '|---|---:|---:|---:|',
  );
  for (const b of c.bins)
    L.push(
      `| ${b.range} | ${b.n} | ${b.n ? b.meanConfidence.toFixed(3) : '–'} | ${b.n ? pct(b.accuracy) : '–'} |`,
    );
  L.push('');
}

L.push(
  '## 5. Kontrollierte Variante: Transliteration',
  '',
  'Seed und Keyword-Liste sind transliteriert. Gleiche Items, DE/mixed mit ä→ae usw.',
  '',
);
L.push(
  '| System | Nutzbar korrekt (orig → translit) | Falsch akzeptiert (orig → translit) | Macro-F1 (orig → translit) |',
  '|---|---|---|---|',
);
for (const s of SYSTEMS) {
  const a = results.original[s.id].labeled;
  const b = results.translit[s.id].labeled;
  L.push(
    `| ${s.label} | ${pct(a.usefulRate)} → ${pct(b.usefulRate)} | ${pct(a.wrongAcceptedRate)} → ${pct(b.wrongAcceptedRate)} | ${a.macroF1.toFixed(3)} → ${b.macroF1.toFixed(3)} |`,
  );
}

L.push('', '## 6. Laufzeit und Ressourcen', '');
L.push(
  `Kaltstart: Gatekeeper-Training ${ms(runtime.coldStart.gatekeeperTrainMs)}, k-NN-Prototypen ${ms(runtime.coldStart.fallbackPrototypeBuildMs)}, Heap-Δ ${runtime.coldStart.heapUsedDeltaMB.toFixed(1)} MB, RSS-Δ ${runtime.coldStart.rssDeltaMB.toFixed(1)} MB (inkl. Modulimport).`,
);
L.push(
  '',
  `Warm, ${RUNS} Durchläufe × ${texts.length} Texte, ein Thread:`,
  '',
  '| System | p50 | p95 | p99 | max | Durchsatz/s |',
  '|---|---:|---:|---:|---:|---:|',
);
for (const s of SYSTEMS) {
  const l = runtime.warmLatency[s.id];
  L.push(
    `| ${s.label} | ${ms(l.p50Ms)} | ${ms(l.p95Ms)} | ${ms(l.p99Ms)} | ${ms(l.maxMs)} | ${Math.round(l.throughputPerSec).toLocaleString('de-DE')} |`,
  );
}
L.push(
  '',
  `Produktions-Timeout je Job: ${runtime.productionTimeoutMs} ms (Queue/Worker-Overhead hier nicht gemessen).`,
);

L.push('', '## 7. Fehlerfälle (Betriebspunkt, Originalschreibung)', '');
const byId = new Map(ref.items.map((i) => [i.id, i]));
for (const s of SYSTEMS) {
  const wrong = R[s.id].outcomes.filter(
    (o: any) => o.accepted && (o.correct === false || byId.get(o.id)!.expectUncertain),
  );
  L.push(
    `**${s.label}** – ${wrong.length} sicher, aber falsch bzw. trotz Mehrdeutigkeit akzeptiert`,
    '',
  );
  if (wrong.length) {
    L.push('| ID | Text | Gold | Vorhersage | Konfidenz |', '|---|---|---|---|---:|');
    for (const o of wrong) {
      const it = byId.get(o.id)!;
      L.push(
        `| ${o.id} | ${it.text.replace(/\|/g, '\\|')} | ${it.category ?? '–'}${it.expectUncertain ? ' (unsicher erwartet)' : ''} | ${o.category} | ${o.confidence.toFixed(3)} |`,
      );
    }
  }
  L.push('');
}
L.push('## Gültigkeitsgrenzen', '');
L.push(
  '- Synthetisches, kleines Referenzset (Bootstrap-Intervalle beachten); keine Aussage über reale Hörsaalverteilung.',
);
L.push('- Konfidenz ist ohne Kalibrierung keine Erfolgswahrscheinlichkeit (siehe ECE).');
L.push('- Gemessen ist die In-Process-Klassifikation, nicht Queue, Persistenz oder Worker-Latenz.');
writeFileSync(join(outDir, 'report.md'), L.join('\n') + '\n');

console.log(`Ergebnisse: ${outDir}`);
for (const s of SYSTEMS) {
  const m = R[s.id].labeled;
  console.log(
    `${s.id.padEnd(10)} useful ${pct(m.usefulRate).padStart(7)}  wrongAcc ${pct(m.wrongAcceptedRate).padStart(7)}  cov ${pct(m.coverage).padStart(7)}  prec ${pct(m.acceptedPrecision).padStart(7)}  F1 ${m.macroF1.toFixed(3)}`,
  );
}
