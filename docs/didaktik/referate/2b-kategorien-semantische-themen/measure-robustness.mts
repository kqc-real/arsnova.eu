#!/usr/bin/env tsx
/**
 * Referat 2B – Robustheit der Clustering-Befunde über zufällige Teilsitzungen.
 *
 * Die Kompass- und spaCy-Befunde (measure-compass.mts, measure-spacy.mts) beruhen je Fach auf
 * einer einzigen Sitzung. Hier werden aus jeder Sitzung viele zufällige Teilsitzungen gezogen
 * (ohne Zurücklegen, fester Seed) und jede mit denselben Release-Funktionen bewertet:
 *
 *   L0 »Wörter« ohne spaCy   LEXICAL, normalization NONE      (Host-Pfad analyzeWordCloudSnapshot)
 *   L1 »Wörter« mit spaCy    LEXICAL, normalization LEMMA     (Release-Sidecar docker/spacy)
 *   S  »Themen« (Encoder)     SEMANTIC, e5-Encoder             (analyzeSemanticWordCloudSnapshot)
 *
 * Kennzahlen je Teilsitzung: schlüssige Themen-Quellen im Kompass (von 3), Top-12-Paare
 * gleiches Anliegen, sowie ARI der Partition »Wortgruppen« (lexikalischer Fallback) und
 * der Encoder-Partition gegen die Anliegen (wie measure-topics.mts). Ausgegeben werden Median,
 * 95-%-Perzentilintervall und gepaarte Anteile (»S besser als L1 in x % der Teilsitzungen«).
 *
 * Der spaCy-Sidecar lemmatisiert jeden Text unabhängig; die Messung fragt deshalb jeden Text
 * genau einmal ab und setzt die Antwort je Teilsitzung zusammen (Injektionspunkt options.sidecar).
 * Encoder-Embeddings hängen nur vom Text ab; für den ARI werden sie einmal geholt.
 * Die Kompass-Variante S läuft dagegen je Teilsitzung vollständig über den Encoder-Sidecar.
 *
 * --set locales (Zusatz): französische und spanische Statistik-Sitzung. Das Release ruft den
 * Encoder dort nicht auf (WORD_CLOUD_SEMANTIC_LOCALES = de, en; Status »fallback«). S ist hier
 * hypothetisch: dieselbe Analyse mit Sitzungs-Locale de, also so, als stünden fr/es in der
 * Liste. Die Locale-Prüfung ist die einzige Stelle, an der die Analyse die Sitzungssprache
 * auswertet (Encoder-Anfrage für Nicht-de/en ohnehin mit locale de; Themenname extraktiv).
 *
 * Aufruf aus dem Repo-Root (Encoder- und spaCy-Container wie in measure-topics/measure-spacy):
 *   npx tsx docs/didaktik/referate/2b-kategorien-semantische-themen/measure-robustness.mts --ref docs/didaktik/referate/2b-kategorien-semantische-themen/reference-dataset.v2.2.json \
 *     --out docs/didaktik/referate/2b-kategorien-semantische-themen/results [--draws 100] [--seed 2026]
 */
process.env['NODE_ENV'] = 'test'; // In-Memory statt Redis-Cache; jede Analyse wird frisch berechnet
import { execSync, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2)
  args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const repo = resolve(args.get('repo') ?? '.');
const refPath = resolve(
  args.get('ref') ??
    'docs/didaktik/referate/2b-kategorien-semantische-themen/reference-dataset.v2.2.json',
);
const outRoot = resolve(
  args.get('out') ?? 'docs/didaktik/referate/2b-kategorien-semantische-themen/results',
);
const ENCODER_URL = args.get('url') ?? 'http://127.0.0.1:8790/embed';
const CONTAINER = args.get('container') ?? 'arsnova-2b-spacy';
const DRAWS = Number(args.get('draws') ?? 100);
const SEED = Number(args.get('seed') ?? 2026);
const SET = args.get('set') ?? 'main'; // main | locales
const TOP = 12;

const lib = (name: string) =>
  import(pathToFileURL(join(repo, 'apps/backend/src/lib', `${name}.ts`)).href);
const shared = await import(pathToFileURL(join(repo, 'libs/shared-types/src/index.ts')).href);
const hostDir = join(repo, 'apps/frontend/src/app/features/session/session-host');
const compass = await import(pathToFileURL(join(hostDir, 'moderation-compass.ts')).href);
const routerMod = await import(
  pathToFileURL(join(repo, 'apps/backend/src/routers/wordCloud.ts')).href
);
const [analyzeMod, normMod, clusterMod, clientMod] = await Promise.all([
  lib('wordCloudSemanticAnalyze'),
  lib('wordCloudNormalization'),
  lib('wordCloudSemanticCluster'),
  lib('wordCloudEncoderClient'),
]);
const LEMMA_MAX_ENTRIES = 80; // session-host.component.ts: WORD_CLOUD_LEMMA_MAX_ENTRIES
const VISIBLE: number = shared.MODERATION_COMPASS_VISIBLE_SOURCE_COUNT;
const THRESHOLD: number = shared.WORD_CLOUD_SEMANTIC_COSINE_THRESHOLD;

type Item = { id: string; text: string; locale: string; family: string; domain?: string };
const refRaw = readFileSync(refPath, 'utf8');
const ref = JSON.parse(refRaw) as { meta: { version: string }; items: Item[] };
const dom = (i: Item) => i.domain ?? 'statistics';
const pct = (x: number) => `${(x * 100).toFixed(1).replace('.', ',')} %`;
const dec = (x: number) => x.toFixed(2).replace('.', ',');

// ---------- spaCy-Sidecar im Container, je Text einmal ----------
const PY = [
  'import sys, socket, http.client',
  'class C(http.client.HTTPConnection):',
  '    def connect(self):',
  '        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)',
  "        self.sock.connect('/run/spacy/nlp.sock')",
  "c = C('localhost', timeout=300)",
  "c.request('POST', '/normalize', sys.stdin.buffer.read(), {'Content-Type': 'application/json'})",
  'r = c.getresponse(); sys.stdout.buffer.write(r.read())',
  'sys.exit(0 if r.status == 200 else 2)',
].join('\n');
const lemmaCache = new Map<string, any[]>(); // `${locale}\u0000${text}` -> tokens
let modelIds: Record<string, string> = {};
let sidecarRequests = 0;
async function cachedSidecar(locale: string, texts: readonly { id: string; text: string }[]) {
  const key = (t: string) => `${locale}\u0000${t}`;
  const missing = [...new Set(texts.map((t) => t.text).filter((t) => !lemmaCache.has(key(t))))];
  if (missing.length) {
    sidecarRequests++;
    const res = spawnSync('docker', ['exec', '-i', CONTAINER, 'python', '-c', PY], {
      input: JSON.stringify({ locale, texts: missing.map((text, i) => ({ id: `m${i}`, text })) }),
      maxBuffer: 64e6,
    });
    if (res.status !== 0) throw new Error(`spaCy-Sidecar: ${res.stderr?.toString().slice(0, 200)}`);
    const out = JSON.parse(res.stdout.toString('utf8'));
    modelIds[locale] = out.modelId;
    const byId = new Map<string, any[]>(out.items.map((x: any) => [x.id, x.tokens]));
    missing.forEach((text, i) => lemmaCache.set(key(text), byId.get(`m${i}`) ?? []));
  }
  return {
    locale,
    modelId: modelIds[locale],
    items: texts.map((t) => ({ id: t.id, tokens: lemmaCache.get(key(t.text))! })),
  };
}
const lemmaEnv = { ...process.env, NLP_ENABLED: 'true', NLP_SOCKET_PATH: '/run/spacy/nlp.sock' };
const encoderEnv = {
  ...process.env,
  WORD_CLOUD_SEMANTIC_ENABLED: 'true',
  WORD_CLOUD_ENCODER_URL: ENCODER_URL,
  WORD_CLOUD_ENCODER_SOCKET_PATH: '',
};

// ---------- Analysen über den Host-Pfad (wie measure-spacy.mts) ----------
const input = (items: Item[], mode: string, locale: string, normalization: string) =>
  shared.AnalyzeWordCloudInputSchema.parse({
    sessionCode: 'REF2BR',
    mode,
    locale,
    metric: 'TOP',
    channel: 'QA',
    normalization,
    refresh: true,
    maxEntries: LEMMA_MAX_ENTRIES,
    items: items.map((i) => ({ id: i.id, text: i.text, weight: 1 })),
  });
async function lexical(items: Item[], locale: string, lemma: boolean) {
  const out = await routerMod.analyzeWordCloudSnapshot(
    input(items, 'LEXICAL', locale, lemma ? 'LEMMA' : 'NONE'),
    lemma ? { env: lemmaEnv, sidecar: cachedSidecar } : {},
  );
  if (lemma && out.normalizationApplied !== 'LEMMA')
    throw new Error(`spaCy nicht angewandt: ${out.normalizationFallbackReason}`);
  return out.entries as any[];
}
async function semantic(items: Item[], locale: string) {
  analyzeMod.resetWordCloudSemanticAnalyzeForTests();
  const inp = input(items, 'SEMANTIC', locale, 'NONE');
  const out = await analyzeMod.analyzeSemanticWordCloudSnapshot(
    inp,
    normMod.resolveWordCloudNormalizationMeta(inp),
    { sessionId: randomUUID(), env: encoderEnv },
  );
  return { entries: out.entries as any[], status: out.status as string };
}

// ---------- Bewertung im Kompass (identisch zu measure-spacy.mts) ----------
function memberIds(entry: any, known: Set<string>) {
  return [
    ...new Set<string>(
      (entry.members ?? [])
        .map((m: any) =>
          String(m.sourceId ?? '')
            .split(':')
            .pop(),
        )
        .filter((id: string) => known.has(id)),
    ),
  ];
}
function evaluate(items: Item[], entries: any[], variant: 'LEXICAL' | 'THEME') {
  const byId = new Map(items.map((i) => [i.id, i]));
  const known = new Set(byId.keys());
  const view = compass.buildModerationCompassView({
    qaQuestions: items.map((i) => ({ id: i.id, text: i.text, status: 'ACTIVE' as const })),
    qaSortMode: 'TOP',
    qaTerms:
      compass.compassTermsFromAnalysisEntries(entries, {
        sortMode: 'TOP',
        analysisVariant: variant,
      }) ?? [],
    freetextTerms: [],
    extraTopicSources: [],
    nlpTopicSources: [],
    topicWeightLabel: null,
    tempo: null,
    quizSources: [],
    quizInsightKind: null,
  });
  const card = view.cards.find((c: any) => c.kind === 'topics');
  const visible = (card?.sources ?? []).slice(0, VISIBLE).map((s: any) => {
    const term = s.target?.termLabel ?? s.label;
    const e = entries.find((x: any) => x.label === term || String(x.label).startsWith(term));
    const ids = e ? memberIds(e, known) : [];
    const fam = new Map<string, number>();
    for (const id of ids) fam.set(byId.get(id)!.family, (fam.get(byId.get(id)!.family) ?? 0) + 1);
    const top = Math.max(0, ...fam.values());
    return { n: ids.length, purity: ids.length ? top / ids.length : 0 };
  });
  const pairs = new Set<string>();
  for (const e of entries.slice(0, TOP)) {
    const ids = memberIds(e, known).sort();
    for (let a = 0; a < ids.length; a++)
      for (let b = a + 1; b < ids.length; b++) pairs.add(`${ids[a]}|${ids[b]}`);
  }
  let same = 0;
  for (const p of pairs) {
    const [a, b] = p.split('|');
    if (byId.get(a)!.family === byId.get(b)!.family) same++;
  }
  return {
    coherent: visible.filter((s: any) => s.n >= 2 && s.purity >= 0.8).length,
    pairPrecision: pairs.size ? same / pairs.size : null,
  };
}

// ---------- Partitionen und ARI (wie measure-topics.mts) ----------
type Partition = Map<string, string>;
const hashOf = (s: string) => createHash('sha256').update(s).digest('hex');
const encoderConfig = {
  enabled: true,
  socketPath: '',
  inferenceUrl: ENCODER_URL,
  inferenceToken: null,
  timeoutMs: 120_000,
  cacheTtlSeconds: 1800,
};
const vectors = new Map<string, number[]>();
async function embedAll(items: Item[]) {
  const need = items.filter((i) => !vectors.has(i.id)).map((i) => ({ id: i.id, text: i.text }));
  if (!need.length) return;
  const res = await clientMod.embedWithWordCloudEncoder(
    { locale: 'de', snapshotHash: hashOf(JSON.stringify(need)), items: need },
    encoderConfig,
  );
  for (const x of res.items) vectors.set(x.id, x.embedding);
}
function toPartition(clusters: { memberIds: string[] }[], items: Item[], prefix: string) {
  const p: Partition = new Map();
  clusters.forEach((c, k) =>
    c.memberIds.forEach((id) => {
      if (!p.has(id)) p.set(id, `${prefix}${k}`);
    }),
  );
  for (const i of items) if (!p.has(i.id)) p.set(i.id, `${prefix}single-${i.id}`);
  return p;
}
const encoderPartition = (items: Item[]) =>
  toPartition(
    clusterMod.clusterWordCloudEmbeddings(
      items.map((i) => ({ id: i.id, text: i.text, vector: vectors.get(i.id)! })),
      THRESHOLD,
    ),
    items,
    'e',
  );
const lexicalPartition = (items: Item[], locale: string) =>
  toPartition(
    analyzeMod
      .buildLexicalSemanticFallbackEntries({
        sessionCode: 'REF2B0',
        mode: 'THEME',
        locale,
        metric: 'COUNT',
        maxEntries: 100,
        items: items.map((i) => ({ id: i.id, text: i.text, weight: 1 })),
      })
      .map((e: any) => ({ memberIds: e.members.map((m: any) => m.sourceId) })),
    items,
    'l',
  );
const comb2 = (n: number) => (n * (n - 1)) / 2;
function ari(items: Item[], pred: Partition) {
  const t = new Map<string, Map<string, number>>();
  for (const i of items) {
    if (!t.has(i.family)) t.set(i.family, new Map());
    const row = t.get(i.family)!;
    row.set(pred.get(i.id)!, (row.get(pred.get(i.id)!) ?? 0) + 1);
  }
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
  const expected = (sumA * sumB) / comb2(items.length);
  const max = (sumA + sumB) / 2;
  return max === expected ? 1 : (sumIJ - expected) / (max - expected);
}

// ---------- Teilsitzungen ----------
function lcg(seed: number) {
  let a = seed;
  return () => {
    a = (a * 1103515245 + 12345) & 0x7fffffff;
    return a / 0x7fffffff;
  };
}
function sample<T>(xs: T[], k: number, rnd: () => number) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
}
type Session = {
  id: string;
  label: string;
  locale: string;
  domain: string;
  k: number;
  encoderLocale?: string; // nur --set locales: Encoder hypothetisch mit Sitzungs-Locale de
};
const SESSIONS: Session[] =
  SET === 'locales'
    ? [
        {
          id: 'statistics-fr',
          label: 'Statistik fr',
          locale: 'fr',
          domain: 'statistics',
          k: 40,
          encoderLocale: 'de',
        },
        {
          id: 'statistics-es',
          label: 'Statistik es',
          locale: 'es',
          domain: 'statistics',
          k: 40,
          encoderLocale: 'de',
        },
      ]
    : [
        { id: 'statistics-de', label: 'Statistik de', locale: 'de', domain: 'statistics', k: 60 },
        { id: 'police-de', label: 'Polizeischule de', locale: 'de', domain: 'police', k: 45 },
        { id: 'statistics-en', label: 'Statistik en', locale: 'en', domain: 'statistics', k: 60 },
      ];
const q = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * p;
  return s[Math.floor(i)] + (s[Math.ceil(i)] - s[Math.floor(i)]) * (i - Math.floor(i));
};
const summary = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return {
    n: v.length,
    median: q(v, 0.5),
    lo: q(v, 0.025),
    hi: q(v, 0.975),
    mean: v.reduce((s, x) => s + x, 0) / v.length,
  };
};
const share = (xs: boolean[]) => xs.filter(Boolean).length / xs.length;

const results: Record<string, any> = {};
const t0 = Date.now();
for (const s of SESSIONS) {
  const pool = ref.items.filter((i) => dom(i) === s.domain && i.locale === s.locale);
  await embedAll(pool);
  // Kontrolle: ganze Sitzung, muss measure-spacy.mts reproduzieren
  const full = {
    L0: evaluate(pool, await lexical(pool, s.locale, false), 'LEXICAL'),
    L1: evaluate(pool, await lexical(pool, s.locale, true), 'LEXICAL'),
    S: evaluate(pool, (await semantic(pool, s.encoderLocale ?? s.locale)).entries, 'THEME'),
  };
  const productStatus = (await semantic(pool, s.locale)).status; // was das Release tut
  const rnd = lcg(SEED + s.id.length * 7919);
  const draws: any[] = [];
  for (let d = 0; d < DRAWS; d++) {
    const items = sample(pool, Math.min(s.k, pool.length), rnd);
    const l0 = evaluate(items, await lexical(items, s.locale, false), 'LEXICAL');
    const l1 = evaluate(items, await lexical(items, s.locale, true), 'LEXICAL');
    const sem = await semantic(items, s.encoderLocale ?? s.locale); // Status wird mitgeschrieben (Fallback = Releaseverhalten)
    const S = evaluate(items, sem.entries, 'THEME');
    draws.push({
      ids: items.map((i) => i.id),
      encoderStatus: sem.status,
      L0: l0,
      L1: l1,
      S,
      ariLexical: ari(items, lexicalPartition(items, s.locale)),
      ariEncoder: ari(items, encoderPartition(items)),
    });
    if ((d + 1) % 10 === 0)
      console.log(`${s.id}: ${d + 1}/${DRAWS} (${Math.round((Date.now() - t0) / 1000)} s)`);
  }
  const gt = (a: number | null, b: number | null) => a !== null && b !== null && a > b;
  const ge = (a: number, b: number) => a >= b;
  results[s.id] = {
    label: s.label,
    poolSize: pool.length,
    k: Math.min(s.k, pool.length),
    hypotheticalEncoder: Boolean(s.encoderLocale),
    productStatus,
    full,
    encoderStatus: Object.fromEntries(
      [...new Set(draws.map((x) => x.encoderStatus))].map((st) => [
        st,
        draws.filter((x) => x.encoderStatus === st).length,
      ]),
    ),
    coherent: {
      L0: summary(draws.map((x) => x.L0.coherent)),
      L1: summary(draws.map((x) => x.L1.coherent)),
      S: summary(draws.map((x) => x.S.coherent)),
    },
    pairPrecision: {
      L0: summary(draws.map((x) => x.L0.pairPrecision)),
      L1: summary(draws.map((x) => x.L1.pairPrecision)),
      S: summary(draws.map((x) => x.S.pairPrecision)),
    },
    ari: {
      lexical: summary(draws.map((x) => x.ariLexical)),
      encoder: summary(draws.map((x) => x.ariEncoder)),
    },
    paired: {
      coherentSgtL1: share(draws.map((x) => x.S.coherent > x.L1.coherent)),
      coherentSgeL1: share(draws.map((x) => ge(x.S.coherent, x.L1.coherent))),
      coherentSgtL0: share(draws.map((x) => x.S.coherent > x.L0.coherent)),
      coherentL1gtL0: share(draws.map((x) => x.L1.coherent > x.L0.coherent)),
      coherentL1ltL0: share(draws.map((x) => x.L1.coherent < x.L0.coherent)),
      pairSgtL1: share(draws.map((x) => gt(x.S.pairPrecision, x.L1.pairPrecision))),
      pairL1gtL0: share(draws.map((x) => gt(x.L1.pairPrecision, x.L0.pairPrecision))),
      ariEncGtLex: share(draws.map((x) => x.ariEncoder > x.ariLexical)),
    },
    draws,
  };
}

// ---------- Bericht ----------
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
  node: process.version,
  platform: `${os.platform()} ${os.release()} ${os.arch()}`,
  cpu: `${os.cpus()[0]?.model} × ${os.cpus().length}`,
  reference: {
    path: refPath,
    version: ref.meta.version,
    sha256: createHash('sha256').update(refRaw).digest('hex'),
  },
  draws: DRAWS,
  seed: SEED,
  set: SET,
  threshold: THRESHOLD,
  spacy: { runtime: shared.WORD_CLOUD_SPACY_RUNTIME_VERSION, models: modelIds, sidecarRequests },
  durationSeconds: Math.round((Date.now() - t0) / 1000),
};
const dir = join(
  outRoot,
  `robustness-${SET === 'locales' ? 'locales-' : ''}${manifest.timestamp.replace(/[:.]/g, '-')}`,
);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'results.json'), JSON.stringify({ manifest, results }, null, 2) + '\n');

const iv = (x: any, f: (v: number) => string) => `${f(x.median)} [${f(x.lo)}; ${f(x.hi)}]`;
const int = (v: number) => (Number.isInteger(v) ? String(v) : dec(v));
const L: string[] = [
  SET === 'locales'
    ? '# Referat 2B – Zusatz: Encoder-Themen für fr/es (hypothetisch, Release ruft ihn dort nicht auf)'
    : '# Referat 2B – Robustheit über zufällige Teilsitzungen',
  '',
  ...(SET === 'locales'
    ? [
        `**Hypothetisch:** Das Release zeigt in fr/es den lexikalischen Fallback (Status ${(Object.values(results) as any[]).map((r) => `${r.label}: ${r.productStatus}`).join(', ')}). S = dieselbe Analyse mit Sitzungs-Locale de, als stünden fr/es in \`WORD_CLOUD_SEMANTIC_LOCALES\`; Releasecode unverändert.`,
        '',
      ]
    : []),
  `Commit \`${manifest.commit.slice(0, 12)}\` (${manifest.describe}), Referenzset ${ref.meta.version} (SHA-256 \`${manifest.reference.sha256.slice(0, 16)}…\`), ${manifest.timestamp}`,
  `${manifest.cpu}, Node ${manifest.node}. ${DRAWS} Teilsitzungen je Sitzung, Seed ${SEED}, Encoder-Schwelle ${THRESHOLD}, spaCy ${manifest.spacy.runtime}. Dauer ${manifest.durationSeconds} s.`,
  '',
  '**Lesart:** Median [2,5 %; 97,5 %-Perzentil] über die Teilsitzungen. _Schlüssig_ = sichtbare Kompass-Quelle mit ≥ 2 Fragen, davon ≥ 80 % ein Anliegen. _Paare_ = Anteil der Fragenpaare in einem der zwölf größten Wortwolken-Einträge, die zum selben Anliegen gehören. _ARI_ = Übereinstimmung der Partition mit den Anliegen (lexikalisch = »Wortgruppen«-Fallback).',
  '',
  '## 1. Verteilungen',
  '',
  '| Sitzung (Teilsitzung/Pool) | Kennzahl | L0 »Wörter« | L1 »Wörter« + spaCy | S »Themen« (Encoder) |',
  '|---|---|---|---|---|',
];
for (const r of Object.values(results) as any[]) {
  const name = `${r.label} (${r.k}/${r.poolSize})`;
  L.push(
    `| ${name} | schlüssige Quellen (von 3) | ${iv(r.coherent.L0, int)} | ${iv(r.coherent.L1, int)} | ${iv(r.coherent.S, int)} |`,
    `| ${name} | Top-12-Paare gleiches Anliegen | ${iv(r.pairPrecision.L0, pct)} | ${iv(r.pairPrecision.L1, pct)} | ${iv(r.pairPrecision.S, pct)} |`,
    `| ${name} | ARI (Partition) | ${iv(r.ari.lexical, dec)} (lexikalisch) | – | ${iv(r.ari.encoder, dec)} |`,
  );
}
L.push(
  '',
  (SET === 'locales'
    ? 'Kontrolle ganze Sitzung (L0/L1 müssen `measure-spacy.mts` entsprechen; S hypothetisch): '
    : 'Kontrolle ganze Sitzung (muss `measure-spacy.mts` entsprechen): ') +
    (Object.values(results) as any[])
      .map(
        (r) =>
          `${r.label} ${['L0', 'L1', 'S'].map((v) => `${v} ${r.full[v].coherent}/3 · ${r.full[v].pairPrecision === null ? '–' : pct(r.full[v].pairPrecision)}`).join(', ')}`,
      )
      .join('; '),
);
L.push(
  '',
  '## 2. Gepaarte Vergleiche (Anteil der Teilsitzungen)',
  '',
  '| Sitzung | S mehr schlüssige Quellen als L1 | S ≥ L1 | spaCy besser (L1 > L0) | spaCy schlechter (L1 < L0) | Paare: S > L1 | Paare: L1 > L0 | ARI: Encoder > lexikalisch | Encoder-Status |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---|',
);
for (const r of Object.values(results) as any[])
  L.push(
    `| ${r.label} | ${pct(r.paired.coherentSgtL1)} | ${pct(r.paired.coherentSgeL1)} | ${pct(r.paired.coherentL1gtL0)} | ${pct(r.paired.coherentL1ltL0)} | ${pct(r.paired.pairSgtL1)} | ${pct(r.paired.pairL1gtL0)} | ${pct(r.paired.ariEncGtLex)} | ${Object.entries(
      r.encoderStatus,
    )
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')} |`,
  );
L.push(
  '',
  '## Gültigkeitsgrenzen',
  '',
  '- Teilsitzungen sind Ziehungen aus demselben Referenzset, keine unabhängigen Lehrveranstaltungen; die Intervalle zeigen die Streuung über Sitzungszusammensetzungen, nicht über Fragenautoren.',
  '- spaCy je Text einmal per `docker exec` lemmatisiert und je Teilsitzung zusammengesetzt (spaCy verarbeitet jeden Text unabhängig).',
  '- Kompass ohne Kategorien und ohne Stimmen, Sortierung TOP, drei sichtbare Quellen wie im Release.',
);
writeFileSync(join(dir, 'report.md'), L.join('\n') + '\n');
console.log(L.slice(8).join('\n'));
console.log(`\nErgebnisse: ${dir}`);
