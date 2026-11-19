#!/usr/bin/env tsx
/**
 * Referat 2B – Themenmessung (Story 1.14c) gegen das eigene Referenzset.
 *
 * Vergleicht aus dem unveränderten Releasecode:
 *   lexical  – lexikalischer Themenmodus (THEME, Ankerwörter) = Fallback/Baseline
 *   encoder  – e5-small-Sidecar + Complete-Linkage-Clustering (Schwelle 0,87)
 *
 * Voraussetzung (nur Labor): Encoder-Container mit loopback-HTTP, z. B.
 *   docker run -d --name arsnova-2b-encoder --cpus 1.0 --memory 2g --read-only \
 *     --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges \
 *     -e WORD_CLOUD_ENCODER_HTTP_BIND=0.0.0.0:8790 -p 127.0.0.1:8790:8790 \
 *     arsnova-wordcloud-encoder:e5-small
 *
 * Aufruf aus dem Repo-Root:
 *   npx tsx <pfad>/measure-topics.mts --repo . --ref <reference.json> --out <dir> \
 *     [--url http://127.0.0.1:8790/embed] [--container arsnova-2b-encoder] [--runs 10]
 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2)
  args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const repo = resolve(args.get('repo') ?? '.');
const refPath = resolve(args.get('ref') ?? 'reference-dataset.v1.json');
const outRoot = resolve(args.get('out') ?? 'results');
const URL_ = args.get('url') ?? 'http://127.0.0.1:8790/embed';
const CONTAINER = args.get('container') ?? 'arsnova-2b-encoder';
const RUNS = Number(args.get('runs') ?? 10);
// Untersuchungsumfang: Wortwolken-Locales des Produkts (WORD_CLOUD_LEMMA_LOCALES); 'it' wird dort nicht unterstützt
const LOCALES = (args.get('locales') ?? 'de,en,fr,es').split(',').map((s) => s.trim());

const lib = (name: string) =>
  import(pathToFileURL(join(repo, 'apps/backend/src/lib', `${name}.ts`)).href);
const [clusterMod, analyzeMod, clientMod] = await Promise.all([
  lib('wordCloudSemanticCluster'),
  lib('wordCloudSemanticAnalyze'),
  lib('wordCloudEncoderClient'),
]);
const shared = await import(pathToFileURL(join(repo, 'libs/shared-types/src/index.ts')).href);
const THRESHOLD: number = shared.WORD_CLOUD_SEMANTIC_COSINE_THRESHOLD;
const MAX_TOPICS: number = shared.WORD_CLOUD_SEMANTIC_MAX_TOPICS;
const SEMANTIC_LOCALES: readonly string[] = shared.WORD_CLOUD_SEMANTIC_LOCALES;

type Item = {
  id: string;
  text: string;
  locale: string;
  tags: string[];
  family: string;
  category: string | null;
  domain?: string;
};
const refRaw = readFileSync(refPath, 'utf8');
const refAll = JSON.parse(refRaw) as { meta: { version: string }; items: Item[] };
// 'mixed' (Sprachmischung im Satz) bleibt enthalten
// Fachdomäne (ab v2.1): eine Sitzung = ein Fach, Domänen werden nie gemischt; Items ohne domain = Statistik
const DOMAIN = args.get('domain') ?? 'statistics';
const ref = {
  ...refAll,
  items: refAll.items.filter(
    (i) =>
      (i.locale === 'mixed' || LOCALES.includes(i.locale)) && (i.domain ?? 'statistics') === DOMAIN,
  ),
};
const byId = new Map(ref.items.map((i) => [i.id, i]));

const sh = (c: string) => {
  try {
    return execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'n/a';
  }
};

// ---------- Kaltstart des Sidecars ----------
async function healthy(): Promise<boolean> {
  try {
    return (await fetch(URL_.replace(/\/embed$/, '/health'))).status === 204;
  } catch {
    return false;
  }
}
let coldStartMs: number | null = null;
if (
  args.get('skip-restart') !== 'true' &&
  sh(`docker inspect -f "{{.State.Running}}" ${CONTAINER}`) === 'true'
) {
  sh(`docker restart ${CONTAINER}`);
  const s = performance.now();
  while (!(await healthy())) {
    if (performance.now() - s > 300_000) throw new Error('Encoder nicht gesund nach 300 s');
    await new Promise((r) => setTimeout(r, 100));
  }
  coldStartMs = performance.now() - s;
}
if (!(await healthy())) throw new Error(`Encoder unter ${URL_} nicht erreichbar`);

// ---------- Embeddings über den Release-Client ----------
const config = {
  enabled: true,
  socketPath: '',
  inferenceUrl: URL_,
  inferenceToken: null,
  timeoutMs: 120_000,
  cacheTtlSeconds: 1800,
};
const hashOf = (s: string) => createHash('sha256').update(s).digest('hex');
async function embed(items: { id: string; text: string }[], locale: 'de' | 'en' = 'de') {
  return clientMod.embedWithWordCloudEncoder(
    { locale, snapshotHash: hashOf(JSON.stringify(items)), items },
    config,
  );
}
// e5-Embeddings hängen nur von "query: " + Text ab, nicht vom locale (siehe wordCloudSemanticAnalyze.ts)
const firstWarm = performance.now();
const response = await embed(ref.items.map((i) => ({ id: i.id, text: i.text })));
const firstCallMs = performance.now() - firstWarm;
const vectors = new Map<string, number[]>(response.items.map((x: any) => [x.id, x.embedding]));

// ---------- Partitionen ----------
type Partition = Map<string, string>; // itemId -> clusterId
function encoderClusters(items: Item[], threshold: number, vecs: Map<string, number[]> = vectors) {
  return clusterMod.clusterWordCloudEmbeddings(
    items.map((i) => ({ id: i.id, text: i.text, vector: vecs.get(i.id)! })),
    threshold,
  ) as { memberIds: string[]; label: string; confidence: number }[];
}
function toPartition(
  clusters: { memberIds: string[] }[],
  items: Item[],
  prefix: string,
): Partition {
  const p: Partition = new Map();
  clusters.forEach((c, k) =>
    c.memberIds.forEach((id) => {
      if (!p.has(id)) p.set(id, `${prefix}${k}`);
    }),
  );
  for (const i of items) if (!p.has(i.id)) p.set(i.id, `${prefix}single-${i.id}`);
  return p;
}
function lexicalClusters(items: Item[], locale: string) {
  const entries = analyzeMod.buildLexicalSemanticFallbackEntries({
    sessionCode: 'REF2B0',
    mode: 'THEME',
    locale,
    metric: 'COUNT',
    maxEntries: 100,
    items: items.map((i) => ({ id: i.id, text: i.text, weight: 1 })),
  });
  return entries.map((e: any) => ({
    memberIds: e.members.map((m: any) => m.sourceId),
    label: e.label,
    confidence: e.confidence ?? null,
  }));
}
const gold = (items: Item[]): Partition => new Map(items.map((i) => [i.id, i.family]));

// ---------- Metriken ----------
const comb2 = (n: number) => (n * (n - 1)) / 2;
function contingency(a: Partition, b: Partition, ids: string[]) {
  const t = new Map<string, Map<string, number>>();
  for (const id of ids) {
    const x = a.get(id)!;
    const y = b.get(id)!;
    if (!t.has(x)) t.set(x, new Map());
    t.get(x)!.set(y, (t.get(x)!.get(y) ?? 0) + 1);
  }
  return t;
}
function ari(goldP: Partition, pred: Partition, ids: string[]) {
  const t = contingency(goldP, pred, ids);
  let sumIJ = 0;
  const rowS = new Map<string, number>();
  const colS = new Map<string, number>();
  for (const [r, row] of t)
    for (const [c, n] of row) {
      sumIJ += comb2(n);
      rowS.set(r, (rowS.get(r) ?? 0) + n);
      colS.set(c, (colS.get(c) ?? 0) + n);
    }
  const sumA = [...rowS.values()].reduce((s, n) => s + comb2(n), 0);
  const sumB = [...colS.values()].reduce((s, n) => s + comb2(n), 0);
  const expected = (sumA * sumB) / comb2(ids.length);
  const max = (sumA + sumB) / 2;
  return max === expected ? 1 : (sumIJ - expected) / (max - expected);
}
function nmi(goldP: Partition, pred: Partition, ids: string[]) {
  const n = ids.length;
  const t = contingency(goldP, pred, ids);
  const rowS = new Map<string, number>();
  const colS = new Map<string, number>();
  for (const [r, row] of t)
    for (const [c, k] of row) {
      rowS.set(r, (rowS.get(r) ?? 0) + k);
      colS.set(c, (colS.get(c) ?? 0) + k);
    }
  const H = (m: Map<string, number>) =>
    -[...m.values()].reduce((s, k) => s + (k / n) * Math.log(k / n), 0);
  let I = 0;
  for (const [r, row] of t)
    for (const [c, k] of row) I += (k / n) * Math.log((k * n) / (rowS.get(r)! * colS.get(c)!));
  const denom = (H(rowS) + H(colS)) / 2;
  return denom === 0 ? 1 : I / denom;
}
function bcubed(goldP: Partition, pred: Partition, ids: string[]) {
  let P = 0;
  let R = 0;
  for (const i of ids) {
    const sameP = ids.filter((j) => pred.get(j) === pred.get(i));
    const sameG = ids.filter((j) => goldP.get(j) === goldP.get(i));
    const both = sameP.filter((j) => goldP.get(j) === goldP.get(i)).length;
    P += both / sameP.length;
    R += both / sameG.length;
  }
  P /= ids.length;
  R /= ids.length;
  return { precision: P, recall: R, f1: P + R ? (2 * P * R) / (P + R) : 0 };
}
function pairs(goldP: Partition, pred: Partition, items: Item[]) {
  const r = {
    sameFamily: 0,
    sameFamilyTogether: 0,
    monoPairs: 0,
    monoTogether: 0,
    crossPairs: 0,
    crossTogether: 0,
    falseMerges: [] as string[][],
  };
  for (let a = 0; a < items.length; a += 1)
    for (let b = a + 1; b < items.length; b += 1) {
      const x = items[a];
      const y = items[b];
      const together = pred.get(x.id) === pred.get(y.id);
      if (goldP.get(x.id) === goldP.get(y.id)) {
        r.sameFamily += 1;
        if (together) r.sameFamilyTogether += 1;
        if (x.locale === y.locale) {
          r.monoPairs += 1;
          if (together) r.monoTogether += 1;
        } else {
          r.crossPairs += 1;
          if (together) r.crossTogether += 1;
        }
      } else if (together) r.falseMerges.push([x.id, y.id]);
    }
  return {
    pairRecall: r.sameFamily ? r.sameFamilyTogether / r.sameFamily : 0,
    monolingualPairRecall: r.monoPairs ? r.monoTogether / r.monoPairs : null,
    crossLingualPairRecall: r.crossPairs ? r.crossTogether / r.crossPairs : null,
    falseMergePairs: r.falseMerges.length,
    falseMerges: r.falseMerges,
  };
}
function evaluate(items: Item[], pred: Partition) {
  const ids = items.map((i) => i.id);
  const g = gold(items);
  const predSizes = new Map<string, number>();
  for (const id of ids) predSizes.set(pred.get(id)!, (predSizes.get(pred.get(id)!) ?? 0) + 1);
  const goldMulti = new Set(
    [...new Set(ids.map((id) => g.get(id)!))].filter(
      (f) => ids.filter((id) => g.get(id) === f).length >= 2,
    ),
  );
  const p = pairs(g, pred, items);
  return {
    n: ids.length,
    goldTopics: new Set(g.values()).size,
    goldMultiTopics: goldMulti.size,
    predictedTopics: predSizes.size,
    predictedMultiTopics: [...predSizes.values()].filter((s) => s >= 2).length,
    missedSingletonRate: (() => {
      const inMulti = ids.filter((id) => goldMulti.has(g.get(id)!));
      return inMulti.length
        ? inMulti.filter((id) => predSizes.get(pred.get(id)!) === 1).length / inMulti.length
        : 0;
    })(),
    ari: ari(g, pred, ids),
    nmi: nmi(g, pred, ids),
    bcubed: bcubed(g, pred, ids),
    ...p,
  };
}
// Produktansicht: Zuverlässigkeits-Gate, Top-12, Status
function productView(clusters: { memberIds: string[]; confidence: number }[], items: Item[]) {
  const ranked = clusterMod.rankSemanticClusters(
    clusters,
    items.map((i) => ({ id: i.id, text: i.text, weight: 1 })),
    MAX_TOPICS,
  );
  const reliable = clusterMod.hasReliableSemanticCluster(ranked);
  const shown = ranked.filter((c: any) => c.memberIds.length >= 2);
  const covered = shown.reduce((s: number, c: any) => s + c.memberIds.length, 0);
  return {
    reliableGatePassed: reliable,
    status: !reliable
      ? 'fallback'
      : ranked.every((c: any) => c.confidence < 0.85)
        ? 'uncertain'
        : 'ready',
    topicsShown: ranked.length,
    multiMemberTopicsShown: shown.length,
    itemsInShownMultiTopics: covered / items.length,
  };
}

// ---------- Teilmengen ----------
type Subset = {
  id: string;
  label: string;
  items: Item[];
  lexLocale: string;
  productRunsEncoder: boolean;
};
const subset = (
  id: string,
  label: string,
  pred: (i: Item) => boolean,
  lexLocale: string,
): Subset => ({
  id,
  label,
  items: ref.items.filter(pred),
  lexLocale,
  productRunsEncoder: SEMANTIC_LOCALES.includes(lexLocale),
});
const SUBSETS: Subset[] = (
  [
    subset('mixed', `Gesamtset (${LOCALES.join('/')}), Session-Locale de`, () => true, 'de'),
    subset('de', 'nur Deutsch', (i) => i.locale === 'de', 'de'),
    subset('en', 'nur Englisch', (i) => i.locale === 'en', 'en'),
    subset('fr', 'nur Französisch', (i) => i.locale === 'fr', 'fr'),
    subset('es', 'nur Spanisch', (i) => i.locale === 'es', 'es'),
  ] as Subset[]
).filter((s) => s.id === 'mixed' || LOCALES.includes(s.id));
const SWEEP = [0.8, 0.82, 0.84, 0.85, 0.86, 0.87, 0.88, 0.89, 0.9, 0.92];

const results: Record<string, any> = {};
for (const s of SUBSETS) {
  const enc = encoderClusters(s.items, THRESHOLD);
  const lex = lexicalClusters(s.items, s.lexLocale);
  const encP = toPartition(enc, s.items, 'e');
  const lexP = toPartition(lex, s.items, 'l');
  results[s.id] = {
    label: s.label,
    productRunsEncoder: s.productRunsEncoder,
    encoder: {
      ...evaluate(s.items, encP),
      product: productView(enc, s.items),
      clusters: enc
        .filter((c) => c.memberIds.length >= 2)
        .map((c) => ({
          label: c.label,
          confidence: Number(c.confidence.toFixed(3)),
          members: c.memberIds,
          families: [...new Set(c.memberIds.map((id) => byId.get(id)!.family))],
        })),
    },
    lexical: {
      ...evaluate(s.items, lexP),
      clusters: lex
        .filter((c: any) => c.memberIds.length >= 2)
        .map((c: any) => ({
          label: c.label,
          members: c.memberIds,
          families: [...new Set(c.memberIds.map((id: string) => byId.get(id)!.family))],
        })),
    },
    sweep: SWEEP.map((t) => {
      const m = evaluate(s.items, toPartition(encoderClusters(s.items, t), s.items, 'e'));
      return {
        threshold: t,
        ari: m.ari,
        bcubedF1: m.bcubed.f1,
        bcubedP: m.bcubed.precision,
        bcubedR: m.bcubed.recall,
        predictedMultiTopics: m.predictedMultiTopics,
        falseMergePairs: m.falseMergePairs,
        crossLingualPairRecall: m.crossLingualPairRecall,
      };
    }),
  };
}

// ---------- Stabilität: Abhängigkeit von der Batch-Zusammensetzung ----------
// Das Produkt bettet neue Fragen inkrementell ein. Simuliert wird das durch zufällige
// Reihenfolge und zufällige Anfragegrößen (5–40 Texte); je Wiederholung ein eigener Seed.
const REPEATS = Number(args.get('repeats') ?? 10);
function lcg(seed: number) {
  let a = seed;
  return () => {
    a = (a * 1103515245 + 12345) & 0x7fffffff;
    return a / 0x7fffffff;
  };
}
async function embedIncremental(seed: number) {
  const r = lcg(seed);
  const order = [...ref.items];
  for (let k = order.length - 1; k > 0; k -= 1) {
    const j = Math.floor(r() * (k + 1));
    [order[k], order[j]] = [order[j], order[k]];
  }
  const out = new Map<string, number[]>();
  for (let k = 0; k < order.length;) {
    const size = 5 + Math.floor(r() * 36);
    const chunk = order.slice(k, k + size);
    const res = await embed(chunk.map((i) => ({ id: i.id, text: i.text })));
    for (const x of res.items) out.set(x.id, x.embedding);
    k += size;
  }
  return out;
}
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const span = (xs: number[]) => ({ median: median(xs), min: Math.min(...xs), max: Math.max(...xs) });
const runs: Map<string, number[]>[] = [];
for (let k = 0; k < REPEATS; k += 1) runs.push(await embedIncremental(1000 + k));
const drift: number[] = [];
for (const v of runs)
  for (const i of ref.items)
    drift.push(1 - clusterMod.cosineSimilarity(vectors.get(i.id)!, v.get(i.id)!));
const stability: Record<string, any> = {
  _vectorDrift: {
    description: '1 - cos zwischen Gesamtanfrage und inkrementellen Läufen',
    ...span(drift),
  },
};
for (const s of SUBSETS) {
  const perRun = runs.map((v) =>
    evaluate(s.items, toPartition(encoderClusters(s.items, THRESHOLD, v), s.items, 'e')),
  );
  stability[s.id] = {
    ari: span(perRun.map((m) => m.ari)),
    bcubedF1: span(perRun.map((m) => m.bcubed.f1)),
    falseMergePairs: span(perRun.map((m) => m.falseMergePairs)),
    predictedMultiTopics: span(perRun.map((m) => m.predictedMultiTopics)),
    sweep: SWEEP.map((t) => {
      const ms = runs.map((v) =>
        evaluate(s.items, toPartition(encoderClusters(s.items, t, v), s.items, 'e')),
      );
      return {
        threshold: t,
        ari: span(ms.map((m) => m.ari)),
        bcubedF1: span(ms.map((m) => m.bcubed.f1)),
        falseMergePairs: span(ms.map((m) => m.falseMergePairs)),
      };
    }),
  };
}

// Ähnlichkeitsverteilung: gleiche Familie vs. verschiedene Familien (Gesamtset)
const cos = clusterMod.cosineSimilarity as (a: number[], b: number[]) => number;
const simSame: number[] = [];
const simDiff: number[] = [];
const simFrame: number[] = [];
for (let a = 0; a < ref.items.length; a += 1)
  for (let b = a + 1; b < ref.items.length; b += 1) {
    const x = ref.items[a];
    const y = ref.items[b];
    const s = cos(vectors.get(x.id)!, vectors.get(y.id)!);
    if (x.family === y.family) simSame.push(s);
    else simDiff.push(s);
    if (x.family !== y.family && x.tags.includes('frame') && y.tags.includes('frame'))
      simFrame.push(s);
  }
const q = (arr: number[], p: number) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const dist = (arr: number[]) => ({
  n: arr.length,
  min: q(arr, 0),
  p10: q(arr, 0.1),
  p50: q(arr, 0.5),
  p90: q(arr, 0.9),
  max: q(arr, 1),
});
const similarity = {
  sameFamily: dist(simSame),
  differentFamily: dist(simDiff),
  differentFamilyFramePairs: dist(simFrame),
  differentFamilyAboveThreshold: simDiff.filter((s) => s >= THRESHOLD).length,
  sameFamilyBelowThreshold: simSame.filter((s) => s < THRESHOLD).length,
};

// ---------- Laufzeit ----------
async function timeEmbed(n: number) {
  const items = ref.items.slice(0, n).map((i) => ({ id: i.id, text: i.text }));
  await embed(items);
  const samples: number[] = [];
  for (let r = 0; r < RUNS; r += 1) {
    const s = performance.now();
    await embed(items);
    samples.push(performance.now() - s);
  }
  samples.sort((a, b) => a - b);
  return {
    items: n,
    runs: RUNS,
    p50Ms: q(samples, 0.5),
    p95Ms: q(samples, 0.95),
    maxMs: samples[samples.length - 1],
    msPerItemP50: q(samples, 0.5) / n,
  };
}
const embedLatency = [];
for (const n of [16, 56, ref.items.length]) embedLatency.push(await timeEmbed(n));
const stats = sh(`docker stats --no-stream --format "{{.MemUsage}}|{{.CPUPerc}}" ${CONTAINER}`);

// Clustering-Skalierung (Node, naive Complete-Linkage): reale Vektoren, für größere n mit kleinem Jitter dupliziert
const rnd = (() => {
  let a = 456;
  return () => {
    a = (a * 1103515245 + 12345) & 0x7fffffff;
    return a / 0x7fffffff;
  };
})();
const clusterTiming = [];
for (const n of [100, 250, 500]) {
  const emb = Array.from({ length: n }, (_, k) => {
    const base = ref.items[k % ref.items.length];
    const v = vectors
      .get(base.id)!
      .map((x) => (k < ref.items.length ? x : x + (rnd() - 0.5) * 0.02));
    return { id: `${base.id}-${k}`, text: base.text, vector: v };
  });
  const s = performance.now();
  clusterMod.clusterWordCloudEmbeddings(emb, THRESHOLD);
  clusterTiming.push({ items: n, ms: performance.now() - s });
}

const git = (c: string) => sh(`git -C "${repo}" ${c}`);
const manifest = {
  timestamp: new Date().toISOString(),
  commit: git('rev-parse HEAD'),
  describe: git('describe --tags --always --dirty'),
  wordCloudSourcesDirty:
    git(
      'status --porcelain -- apps/backend/src/lib docker/wordcloud-encoder libs/shared-types/src',
    ) !== '',
  node: process.version,
  platform: `${os.platform()} ${os.release()} ${os.arch()}`,
  cpu: `${os.cpus()[0]?.model} × ${os.cpus().length}`,
  reference: {
    version: ref.meta.version,
    sha256: hashOf(refRaw),
    items: ref.items.length,
    itemsInFile: refAll.items.length,
    locales: LOCALES,
    domain: DOMAIN,
  },
  encoder: {
    modelId: response.modelId,
    modelVersion: response.modelVersion,
    dimensions: response.items[0]?.embedding.length,
    image: sh(`docker inspect -f "{{.Config.Image}} {{.Image}}" ${CONTAINER}`),
    imageSizeMB:
      Number(
        sh(
          `docker image inspect -f "{{.Size}}" ${sh(`docker inspect -f "{{.Image}}" ${CONTAINER}`)}`,
        ),
      ) / 1e6 || null,
    limits: sh(
      `docker inspect -f "cpus={{.HostConfig.NanoCpus}} mem={{.HostConfig.Memory}}" ${CONTAINER}`,
    ),
    transport: `loopback HTTP ${URL_} (Labor; Produktion: Unix-Socket, network_mode none)`,
  },
  releaseConstants: {
    WORD_CLOUD_SEMANTIC_COSINE_THRESHOLD: THRESHOLD,
    WORD_CLOUD_SEMANTIC_MAX_TOPICS: MAX_TOPICS,
    WORD_CLOUD_SEMANTIC_LOCALES: SEMANTIC_LOCALES,
    reliableGate: 'mind. 1 Cluster ≥ 2 Mitglieder und Konfidenz ≥ 0,65',
    readyStatus: 'mind. 1 Cluster mit Konfidenz ≥ 0,85',
  },
  settings: { RUNS, SWEEP },
};
const runtime = {
  coldStartToHealthyMs: coldStartMs,
  firstEmbedCallMs: firstCallMs,
  embedLatency,
  containerStatsAfterLoad: stats,
  clusterTiming,
};

const stamp = manifest.timestamp.replace(/[:.]/g, '-');
const outDir = join(outRoot, `topics-${DOMAIN === 'statistics' ? '' : DOMAIN + '-'}${stamp}`);
mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, 'results.json'),
  JSON.stringify({ manifest, results, stability, similarity, runtime }, null, 2),
);

// ---------- Bericht ----------
const pct = (x: number | null) => (x === null ? '–' : `${(x * 100).toFixed(1)} %`);
const f3 = (x: number) => x.toFixed(3);
const L: string[] = [];
L.push('# Referat 2B – Themenmessung 1.14c (Encoder vs. lexikalisch)', '');
L.push(
  `Commit \`${manifest.commit.slice(0, 12)}\` (${manifest.describe}), Referenzset ${ref.meta.version} (SHA-256 \`${manifest.reference.sha256.slice(0, 16)}…\`), ${manifest.timestamp}`,
);
L.push(
  `Modell \`${response.modelId}\` / \`${response.modelVersion}\`, ${manifest.encoder.dimensions} Dimensionen · Container-Limits ${manifest.encoder.limits} · ${manifest.encoder.transport}`,
);
if (manifest.wordCloudSourcesDirty)
  L.push(
    '',
    '> **Achtung:** lokale Änderungen in den gemessenen Quellen – keine unveränderte Baseline.',
  );
L.push(
  '',
  `Umfang: ${ref.items.length} von ${refAll.items.length} Items, Domäne ${DOMAIN}, Sprachen ${LOCALES.join(', ')} (+ mixed). Italienisch ausgeschlossen, weil die Wortwolke es nicht unterstützt (WORD_CLOUD_LEMMA_LOCALES).`,
);
L.push(
  '',
  'Goldstandard: Themenfamilien des Referenzsets; Near-Miss-, mehrdeutige und Rausch-Items sind Einzelthemen.',
  '',
);
L.push('## 1. Hauptergebnis', '');
L.push(
  '| Teilmenge | n | System | ARI | NMI | BCubed P | BCubed R | BCubed F1 | Themen ≥2 (Gold) | Falsch-Merge-Paare | Paar-Recall einsprachig | Paar-Recall sprachübergreifend |',
);
L.push('|---|---:|---|---:|---:|---:|---:|---:|---|---:|---:|---:|');
for (const s of SUBSETS) {
  const r = results[s.id];
  for (const [sys, m] of [
    ['Encoder', r.encoder],
    ['Lexikalisch', r.lexical],
  ] as const)
    L.push(
      `| ${r.label}${sys === 'Encoder' && !r.productRunsEncoder ? ' ⚠' : ''}${m.goldMultiTopics === 0 ? ' †' : ''} | ${m.n} | ${sys} | ${f3(m.ari)} | ${f3(m.nmi)} | ${pct(m.bcubed.precision)} | ${pct(m.bcubed.recall)} | ${pct(m.bcubed.f1)} | ${m.predictedMultiTopics} (${m.goldMultiTopics}) | ${m.falseMergePairs} | ${pct(m.monolingualPairRecall)} | ${pct(m.crossLingualPairRecall)} |`,
    );
}
L.push(
  '',
  '† Nicht aussagekräftig: In dieser Teilmenge hat keine Familie zwei Mitglieder derselben Sprache. ARI ist dann 0, BCubed belohnt bloßes Nicht-Zusammenfassen. Nur Gesamtset und Deutsch tragen eine Aussage; für Einsprachigkeit in en/fr/es wären mehr Items je Sprache nötig.',
);
L.push(
  '',
  `⚠ Session-Locale nicht in \`WORD_CLOUD_SEMANTIC_LOCALES\` (${SEMANTIC_LOCALES.join(', ')}): Das Produkt ruft den Encoder dort **nicht** auf und zeigt den lexikalischen Fallback. Encoderwerte zeigen nur das ungenutzte Potenzial.`,
);
const rng = (x: { median: number; min: number; max: number }, fmt: (v: number) => string) =>
  `${fmt(x.median)} [${fmt(x.min)}–${fmt(x.max)}]`;
const int = (v: number) => String(Math.round(v));
L.push('', '### Stabilität über die Batch-Zusammensetzung', '');
L.push(
  `Das Embedding einer Frage hängt von den anderen Texten derselben Anfrage ab (Vektor-Drift 1 − cos: Median ${stability._vectorDrift.median.toExponential(1)}, max ${stability._vectorDrift.max.toExponential(1)}). Vermutete Ursache: quantisiertes ONNX-Modell (nicht verifiziert). Tabelle 1 oben zeigt **eine** Gesamtanfrage; hier ${REPEATS} Läufe mit zufälliger Reihenfolge und Anfragegrößen 5–40 (simuliert inkrementelles Einbetten). Werte: Median [min–max].`,
  '',
);
L.push(
  '| Teilmenge | Encoder ARI | Encoder BCubed F1 | Falsch-Merge-Paare | Themen ≥2 | Lexikalisch ARI (deterministisch) |',
  '|---|---|---|---|---|---:|',
);
for (const s of SUBSETS) {
  const st = stability[s.id];
  L.push(
    `| ${results[s.id].label}${results[s.id].encoder.goldMultiTopics === 0 ? ' †' : ''} | ${rng(st.ari, f3)} | ${rng(st.bcubedF1, (v) => pct(v))} | ${rng(st.falseMergePairs, int)} | ${rng(st.predictedMultiTopics, int)} | ${f3(results[s.id].lexical.ari)} |`,
  );
}
L.push(
  '',
  '## 2. Produktansicht (Gate, Top-12, Status)',
  '',
  '| Teilmenge | Gate bestanden | Status | angezeigte Themen | davon ≥2 Mitglieder | Anteil Fragen in angezeigten Mehrfach-Themen |',
  '|---|:---:|---|---:|---:|---:|',
);
for (const s of SUBSETS) {
  const p = results[s.id].encoder.product;
  L.push(
    `| ${results[s.id].label} | ${p.reliableGatePassed ? '✓' : '–'} | ${s.productRunsEncoder ? p.status : 'fallback (Locale)'} | ${p.topicsShown} | ${p.multiMemberTopicsShown} | ${pct(p.itemsInShownMultiTopics)} |`,
  );
}
L.push(
  '',
  '## 3. Ähnlichkeitsverteilung (Kosinus, Gesamtset)',
  '',
  '| Paare | n | min | p10 | Median | p90 | max |',
  '|---|---:|---:|---:|---:|---:|---:|',
);
for (const [k, label] of [
  ['sameFamily', 'gleiche Familie'],
  ['differentFamily', 'verschiedene Familien'],
  ['differentFamilyFramePairs', 'verschiedene Familien, gleicher Satzrahmen'],
] as const) {
  const d = (similarity as any)[k];
  if (!d.n) continue; // fachfremde Domänen haben keine Satzrahmen-Items
  L.push(
    `| ${label} | ${d.n} | ${f3(d.min)} | ${f3(d.p10)} | ${f3(d.p50)} | ${f3(d.p90)} | ${f3(d.max)} |`,
  );
}
L.push(
  '',
  `Paare verschiedener Familien ≥ ${THRESHOLD}: ${similarity.differentFamilyAboveThreshold} · Paare gleicher Familie < ${THRESHOLD}: ${similarity.sameFamilyBelowThreshold} von ${similarity.sameFamily.n}`,
);
L.push('', '## 4. Schwellen-Sweep (Encoder)', '');
for (const id of ['mixed', 'de']) {
  L.push(
    `**${results[id].label}**`,
    '',
    '| Schwelle | ARI | BCubed P | BCubed R | BCubed F1 | Themen ≥2 | Falsch-Merge-Paare | Paar-Recall sprachübergr. |',
    '|---:|---:|---:|---:|---:|---:|---:|---:|',
  );
  for (const p of results[id].sweep)
    L.push(
      `| ${p.threshold.toFixed(2)}${p.threshold === THRESHOLD ? ' ◀' : ''} | ${f3(p.ari)} | ${pct(p.bcubedP)} | ${pct(p.bcubedR)} | ${pct(p.bcubedF1)} | ${p.predictedMultiTopics} | ${p.falseMergePairs} | ${pct(p.crossLingualPairRecall)} |`,
    );
  L.push('');
}
L.push(
  `**Sweep über ${REPEATS} inkrementelle Läufe** – BCubed F1 bzw. Falsch-Merge-Paare, Median [min–max]`,
  '',
  '| Schwelle | Gesamtset F1 | Gesamtset Falsch-Merges | Deutsch F1 | Deutsch Falsch-Merges |',
  '|---:|---|---|---|---|',
);
SWEEP.forEach((t, k) => {
  const m = stability.mixed.sweep[k];
  const d = stability.de.sweep[k];
  L.push(
    `| ${t.toFixed(2)}${t === THRESHOLD ? ' ◀' : ''} | ${rng(m.bcubedF1, (v) => pct(v))} | ${rng(m.falseMergePairs, int)} | ${rng(d.bcubedF1, (v) => pct(v))} | ${rng(d.falseMergePairs, int)} |`,
  );
});
L.push('');
L.push('## 5. Gefundene Themen im Gesamtset (eine Gesamtanfrage)', '');
for (const [sys, key] of [
  ['Encoder', 'encoder'],
  ['Lexikalisch', 'lexical'],
] as const) {
  L.push(
    `**${sys}** (nur Themen mit ≥ 2 Mitgliedern; ✗ = mischt Familien)`,
    '',
    '| Label | Konfidenz | Mitglieder | Familien |',
    '|---|---:|---|---|',
  );
  for (const c of results.mixed[key].clusters)
    L.push(
      `| ${String(c.label).replace(/\|/g, '\\|')} | ${c.confidence ?? '–'} | ${c.members.join(', ')} | ${c.families.length > 1 ? '✗ ' : ''}${c.families.join(', ')} |`,
    );
  L.push('');
}
L.push('## 6. Falsch zusammengeführte Paare (Encoder, Gesamtset)', '');
for (const [a, b] of results.mixed.encoder.falseMerges)
  L.push(`- ${a} »${byId.get(a)!.text}« ↔ ${b} »${byId.get(b)!.text}«`);
if (!results.mixed.encoder.falseMerges.length) L.push('- keine');
L.push('', '## 7. Laufzeit und Ressourcen', '');
L.push(
  `Kaltstart Container → /health: ${coldStartMs === null ? 'nicht gemessen' : `${(coldStartMs / 1000).toFixed(1)} s`} · erster Embed-Aufruf (${ref.items.length} Texte): ${firstCallMs.toFixed(0)} ms · Image ${manifest.encoder.imageSizeMB ? `${manifest.encoder.imageSizeMB.toFixed(0)} MB` : 'n/a'} · Container nach Last: ${stats}`,
);
L.push('', '| Texte pro Anfrage | p50 | p95 | max | ms/Text (p50) |', '|---:|---:|---:|---:|---:|');
for (const e of embedLatency)
  L.push(
    `| ${e.items} | ${e.p50Ms.toFixed(0)} ms | ${e.p95Ms.toFixed(0)} ms | ${e.maxMs.toFixed(0)} ms | ${e.msPerItemP50.toFixed(1)} |`,
  );
L.push(
  '',
  'Clustering in Node (naive Complete-Linkage, ein Thread):',
  '',
  '| Texte | Zeit |',
  '|---:|---:|',
);
for (const c of clusterTiming) L.push(`| ${c.items} | ${c.ms.toFixed(0)} ms |`);
L.push('', '## Gültigkeitsgrenzen', '');
L.push('- Synthetisches Referenzset; ein Annotator; Familien sind sprachunabhängig definiert.');
L.push(
  '- Laborbetrieb über loopback-HTTP statt Unix-Socket; Transport-Overhead daher nicht produktionsgleich.',
);
L.push(
  '- Embedding-Cache der App (Redis/In-Process) nicht genutzt: Latenzen sind Kaltpfad-Werte je Anfrage.',
);
L.push('- Themenhäufigkeit ist kein Lernstandsmaß.');
writeFileSync(join(outDir, 'report.md'), L.join('\n') + '\n');

console.log(`Ergebnisse: ${outDir}`);
for (const s of SUBSETS) {
  const r = results[s.id];
  console.log(
    `${s.id.padEnd(6)} enc ARI ${f3(r.encoder.ari)} F1 ${pct(r.encoder.bcubed.f1).padStart(7)} FM ${String(r.encoder.falseMergePairs).padStart(3)} | lex ARI ${f3(r.lexical.ari)} F1 ${pct(r.lexical.bcubed.f1).padStart(7)} FM ${String(r.lexical.falseMergePairs).padStart(3)}`,
  );
}
