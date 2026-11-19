#!/usr/bin/env tsx
/**
 * Referat 2B – Was der Moderationskompass aus 8.9b (Kategorien) und 1.14c (Encoder-Themen) macht.
 *
 * Misst nicht die Funktionen isoliert, sondern ihr Ergebnis dort, wo die Lehrperson es sieht:
 * Statuszeile und Karte »Häufige Themen« des Kompasses. Verwendet unveränderten Releasecode:
 *   - Klassifikation: runQaNlpClassifier (qaNlpWorker.ts) über die Release-Queue (Last)
 *   - Themen: buildLexicalSemanticFallbackEntries (»Wortgruppen«) und
 *     analyzeSemanticWordCloudSnapshot (»Themen«, Encoder) aus wordCloudSemanticAnalyze.ts
 *   - Kompass: collectQaNlpCategorySources, compassTermsFromAnalysisEntries,
 *     buildModerationCompassView (Frontend moderation-compass.ts) und
 *     resolveModerationCompassAnalysisMode (shared-types)
 *
 * Teil 1  Fächer:   je Fach eine deutsche Sitzung, vier Varianten (2B aus / + Kategorien /
 *                   + Encoder-Themen / beides)
 * Teil 2  Sprachen: dieselbe Fragensammlung je Sprache (de, en, fr, es, gemischt), so wie das
 *                   Produkt sie behandelt (Encoder nur für de/en)
 * Teil 3  Last:     Statuszeile und Kategorien bei hoher Einreichungsrate, Nachbarsitzung auf
 *                   derselben Instanz, gleichzeitige Themenanalysen mehrerer Sitzungen
 *
 * Voraussetzung: Encoder-Container wie in measure-topics.mts (loopback-HTTP).
 * Aufruf aus dem Repo-Root:
 *   npx tsx docs/didaktik/referate/2b-kategorien-semantische-themen/measure-compass.mts --repo . --ref docs/didaktik/referate/2b-kategorien-semantische-themen/reference-dataset.v2.2.json \
 *     --out docs/didaktik/referate/2b-kategorien-semantische-themen/results [--url http://127.0.0.1:8790/embed]
 *
 * Nur Last wiederholen (Teil 3, Einreichungsraten 200/s und 1000/s je N-mal, Bericht load-*):
 *   npx tsx docs/didaktik/referate/2b-kategorien-semantische-themen/measure-compass.mts --load-repeats 20 --out docs/didaktik/referate/2b-kategorien-semantische-themen/results
 */
import { execSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
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
const LOAD_REPEATS = Number(args.get('load-repeats') ?? 0);

const lib = (name: string) =>
  import(pathToFileURL(join(repo, 'apps/backend/src/lib', `${name}.ts`)).href);
const shared = await import(pathToFileURL(join(repo, 'libs/shared-types/src/index.ts')).href);
const compass = await import(
  pathToFileURL(
    join(repo, 'apps/frontend/src/app/features/session/session-host/moderation-compass.ts'),
  ).href
);
const [queueMod, workerMod, snapMod, configMod, analyzeMod, normMod] = await Promise.all([
  lib('qaNlpQueue'),
  lib('qaNlpWorker'),
  lib('qaNlpSnapshot'),
  lib('qaNlpConfig'),
  lib('wordCloudSemanticAnalyze'),
  lib('wordCloudNormalization'),
]);

const VISIBLE: number = shared.MODERATION_COMPASS_VISIBLE_SOURCE_COUNT;
const SEMANTIC_LOCALES: readonly string[] = shared.WORD_CLOUD_SEMANTIC_LOCALES;
// Labels wie im Host (session-host.component.ts, moderationNlpCategoryLabels)
const LABELS = {
  content: 'Inhaltliche Fragen',
  organization: 'Fragen zum Ablauf',
  technical: 'Technische Fragen',
} as const;
const LABEL_TO_CAT = new Map(Object.entries(LABELS).map(([k, v]) => [v, k]));
// Statuszeilen wie im Dialog (moderation-compass-dialog.component.html)
const STATUS_TEXT: Record<string, string> = {
  disabled: 'Die automatische Sortierung der Fragen ist aus.',
  pending: 'Die Fragen werden gerade geordnet.',
  uncertain: 'Einige Fragen konnten nicht eindeutig zugeordnet werden.',
  failed: 'Die Fragen können gerade nicht automatisch geordnet werden.',
  classified: 'Die Fragen sind nach Inhalt, Organisation und Technik geordnet.',
  'rule-based': '(keine Statuszeile)',
};

type Item = {
  id: string;
  text: string;
  locale: string;
  family: string;
  category: string | null;
  domain?: string;
  tags: string[];
};
const refRaw = readFileSync(refPath, 'utf8');
const ref = JSON.parse(refRaw) as { meta: { version: string }; items: Item[] };
const dom = (i: Item) => i.domain ?? 'statistics';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const r1 = (x: number) => Math.round(x * 10) / 10;
const pct = (x: number) => `${(x * 100).toFixed(1).replace('.', ',')} %`;
const quant = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0;
};

// ---------- Bausteine aus dem Release ----------
async function classify(items: Item[]) {
  const out = new Map<string, any>();
  for (const it of items)
    out.set(it.id, await workerMod.runQaNlpClassifier(snapMod.buildQaNlpAnalysisSnapshot(it.text)));
  return out;
}
const analysisInput = (items: Item[], mode: 'THEME' | 'SEMANTIC', locale: string) =>
  shared.AnalyzeWordCloudInputSchema.parse({
    sessionCode: 'REF2BK',
    mode,
    locale,
    metric: 'TOP',
    channel: 'QA',
    normalization: 'NONE',
    items: items.map((i) => ({ id: i.id, text: i.text, weight: 1 })),
  });
const encoderEnv = {
  ...process.env,
  WORD_CLOUD_SEMANTIC_ENABLED: 'true',
  WORD_CLOUD_ENCODER_URL: ENCODER_URL,
  WORD_CLOUD_ENCODER_SOCKET_PATH: '',
};
function lexicalEntries(items: Item[], locale: string) {
  return analyzeMod.buildLexicalSemanticFallbackEntries(analysisInput(items, 'THEME', locale));
}
async function semanticEntries(items: Item[], locale: string, opts: { reset?: boolean } = {}) {
  if (opts.reset !== false) analyzeMod.resetWordCloudSemanticAnalyzeForTests();
  const input = analysisInput(items, 'SEMANTIC', locale);
  const meta = normMod.resolveWordCloudNormalizationMeta(input);
  const s = performance.now();
  const out = await analyzeMod.analyzeSemanticWordCloudSnapshot(input, meta, {
    sessionId: randomUUID(),
    env: encoderEnv,
  });
  return {
    ms: r1(performance.now() - s),
    status: out.status as string,
    fallbackUsed: Boolean(out.fallbackUsed),
    encoderCalled: Boolean(out.encoderCalled),
    entries: out.entries as any[],
  };
}

// ---------- Kompass aufbauen wie im Host ----------
type Variant = { id: string; name: string; categories: boolean; topics: boolean };
const VARIANTS: Variant[] = [
  {
    id: 'V0',
    name: '2B aus (Regelkern, Wortwolke »Wortgruppen«)',
    categories: false,
    topics: false,
  },
  { id: 'V1', name: '+ Kategorien (8.9b)', categories: true, topics: false },
  { id: 'V2', name: '+ Encoder-Themen (1.14c, »Themen«)', categories: false, topics: true },
  { id: 'V3', name: '+ beides', categories: true, topics: true },
];

function buildCompass(items: Item[], nlp: Map<string, any> | null, entries: any[]) {
  const questions = items.map((it) => ({
    id: it.id,
    text: it.text,
    status: 'ACTIVE' as const,
    ...(nlp ? { nlp: nlp.get(it.id) } : {}),
  }));
  const view = compass.buildModerationCompassView({
    qaQuestions: questions,
    qaSortMode: 'TOP',
    qaTerms:
      compass.compassTermsFromAnalysisEntries(entries, {
        sortMode: 'TOP',
        analysisVariant: 'THEME',
      }) ?? [],
    freetextTerms: [],
    extraTopicSources: [],
    nlpTopicSources: nlp ? compass.collectQaNlpCategorySources(questions, LABELS) : [],
    topicWeightLabel: null,
    tempo: null,
    quizSources: [],
    quizInsightKind: null,
  });
  const mode = shared.resolveModerationCompassAnalysisMode({
    enabled: Boolean(nlp),
    statuses: nlp ? items.map((it) => nlp.get(it.id)?.status) : [],
  });
  return { view, mode };
}

const stripId = (id: string, known: Set<string>) => {
  if (known.has(id)) return id;
  const tail = id.split(':').pop() ?? id;
  return known.has(tail) ? tail : id;
};

// Bewertet die Karte »Häufige Themen« aus Sicht der Lehrperson
function evaluate(items: Item[], built: ReturnType<typeof buildCompass>, entries: any[]) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const known = new Set(byId.keys());
  const card = built.view.cards.find((c: any) => c.kind === 'topics');
  const sources: any[] = card?.sources ?? [];
  const evalSource = (s: any, rank: number) => {
    if (s.kind === 'qa-question' && LABEL_TO_CAT.has(s.focusHint)) {
      const claimed = LABEL_TO_CAT.get(s.focusHint)!;
      const ids: string[] = s.target?.questionIds ?? [];
      const wrong = ids.filter((id) => byId.get(id)?.category !== claimed);
      return {
        rank,
        kind: 'Kategorie',
        label: s.label,
        n: ids.length,
        correct: ids.length - wrong.length,
        precision: ids.length ? (ids.length - wrong.length) / ids.length : null,
        wrongExamples: wrong.slice(0, 3).map((id) => byId.get(id)!.text),
        ids,
      };
    }
    const term: string = s.target?.termLabel ?? s.label;
    const entry = entries.find((e: any) => e.label === term || String(e.label).startsWith(term));
    const ids: string[] = (entry?.members ?? [])
      .map((m: any) => stripId(String(m.sourceId ?? ''), known))
      .filter((id: string) => known.has(id));
    const fam = new Map<string, number>();
    for (const id of ids) fam.set(byId.get(id)!.family, (fam.get(byId.get(id)!.family) ?? 0) + 1);
    const top = [...fam.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      rank,
      kind: 'Thema/Term',
      label: s.label,
      n: ids.length,
      dominantFamily: top?.[0] ?? null,
      purity: ids.length ? (top?.[1] ?? 0) / ids.length : null,
      families: fam.size,
      ids,
    };
  };
  const all = sources.map((s, k) => evalSource(s, k + 1));
  const visible = all.slice(0, VISIBLE);
  const reach = new Set(visible.flatMap((s) => s.ids));
  const shownLabels = [...(built.view.cards ?? [])].length;
  const catVisible = visible.filter((s) => s.kind === 'Kategorie');
  const catQuestions = catVisible.reduce((a, s) => a + s.n, 0);
  const catCorrect = catVisible.reduce((a, s) => a + (s.correct ?? 0), 0);
  const termVisible = visible.filter((s) => s.kind === 'Thema/Term');
  const coherent = termVisible.filter((s) => s.n >= 2 && (s.purity ?? 0) >= 0.8).length;
  return {
    statusMode: built.mode,
    statusLine: STATUS_TEXT[built.mode] ?? built.mode,
    recommendation: built.view.actionRecommendation,
    cards: shownLabels,
    storedSources: all.length,
    visible: visible.map(({ ids, ...rest }) => rest),
    reachableShare: items.length ? reach.size / items.length : 0,
    categoryVisiblePrecision: catQuestions ? catCorrect / catQuestions : null,
    categoryShownWrong: catQuestions - catCorrect,
    termVisible: termVisible.length,
    termCoherent: coherent,
  };
}

async function sessionReport(items: Item[], locale: string, variants = VARIANTS) {
  const nlp = await classify(items);
  const statuses: Record<string, number> = {};
  for (const r of nlp.values()) statuses[r.status] = (statuses[r.status] ?? 0) + 1;
  const lex = lexicalEntries(items, locale);
  const sem = await semanticEntries(items, locale);
  const out: Record<string, any> = {};
  for (const v of variants) {
    const entries = v.topics ? sem.entries : lex;
    out[v.id] = evaluate(items, buildCompass(items, v.categories ? nlp : null, entries), entries);
  }
  return {
    n: items.length,
    nlpStatuses: statuses,
    semantic: {
      status: sem.status,
      fallbackUsed: sem.fallbackUsed,
      encoderCalled: sem.encoderCalled,
      ms: sem.ms,
    },
    variants: out,
  };
}

// ---------- Encoder erreichbar? ----------
const healthy = async () => {
  try {
    return (await fetch(ENCODER_URL.replace(/\/embed$/, '/health'))).status === 204;
  } catch {
    return false;
  }
};
if (!(await healthy())) throw new Error(`Encoder unter ${ENCODER_URL} nicht erreichbar`);
await semanticEntries(ref.items.slice(0, 20), 'de'); // Aufwärmen

// ---------- Teil 1: Fächer (deutsche Sitzungen) ----------
const DOMAINS = ['statistics', 'botany', 'history', 'police'];
const subjects: Record<string, any> = {};
for (const d of LOAD_REPEATS ? [] : DOMAINS) {
  const items = ref.items.filter((i) => dom(i) === d && i.locale === 'de');
  console.log(`Teil 1 – ${d}: ${items.length} Fragen`);
  subjects[d] = await sessionReport(items, 'de');
}

// ---------- Teil 2: Sprachen (wie das Produkt sie behandelt) ----------
const LANGS = ['de', 'en', 'fr', 'es', 'mixed'];
const languages: Record<string, any> = {};
for (const d of LOAD_REPEATS ? [] : ['statistics', 'police']) {
  languages[d] = {};
  for (const l of LANGS) {
    const items = ref.items.filter((i) => dom(i) === d && i.locale === l);
    if (items.length < 5) continue;
    console.log(`Teil 2 – ${d}/${l}: ${items.length} Fragen`);
    // Gemischte Fragen laufen in einer deutschen Sitzung
    languages[d][l] = await sessionReport(items, l === 'mixed' ? 'de' : l);
  }
}

// ---------- Teil 3: Last ----------
type Written = { status: string; category: string | null; reason?: string; at: number };
const loadPool = ref.items.filter((i) => i.locale === 'de');

async function arrivalRun(
  label: string,
  total: number,
  perSecond: number | 'tick',
  neighbour = false,
) {
  const store = new Map<string, Written>();
  queueMod.resetQaNlpQueueForTests({
    writer: async (questionId: string, result: any) => {
      store.set(questionId, {
        status: result.status,
        category: result.category ?? null,
        reason: result.reason,
        at: performance.now(),
      });
    },
    config: () => configMod.resolveQaNlpConfig({ ...process.env, QA_NLP_ENABLED: 'true' }),
  });
  const main = Array.from({ length: total }, (_, k) => ({
    id: randomUUID(),
    item: loadPool[k % loadPool.length],
  }));
  const other = neighbour
    ? Array.from({ length: 10 }, (_, k) => ({
        id: randomUUID(),
        item: loadPool[(k * 7) % loadPool.length],
      }))
    : [];
  const submitted = new Set<string>();
  const rejected = new Set<string>();
  const enqueue = (id: string, text: string, session: string) => {
    submitted.add(id);
    const res = queueMod.enqueueQaNlpJob({ sessionId: session, questionId: id, text });
    if (res !== 'queued') rejected.add(id);
  };
  const modeOf = (ids: string[]) =>
    shared.resolveModerationCompassAnalysisMode({
      enabled: true,
      statuses: ids
        .filter((id) => submitted.has(id))
        .map((id) => store.get(id)?.status ?? 'pending'),
    });
  const timeline: { t: number; mode: string; neighbour?: string; pending: number }[] = [];
  const t0 = performance.now();
  let maxGap = 0;
  let last = performance.now();
  const sampler = setInterval(() => {
    const now = performance.now();
    maxGap = Math.max(maxGap, now - last);
    last = now;
    const ids = main.map((m) => m.id);
    timeline.push({
      t: r1(now - t0),
      mode: modeOf(ids),
      ...(neighbour ? { neighbour: modeOf(other.map((o) => o.id)) } : {}),
      pending: ids.filter((id) => submitted.has(id) && !store.has(id)).length,
    });
  }, 5);
  if (perSecond === 'tick') {
    for (const m of main) enqueue(m.id, m.item.text, 'S-main');
    for (const [k, o] of other.entries()) {
      if (k > 0) await sleep(5);
      enqueue(o.id, o.item.text, 'S-neighbour');
    }
  } else {
    const perTick = Math.max(1, Math.round(perSecond / 62.5)); // 16-ms-Takt
    for (let k = 0; k < main.length; k += perTick) {
      for (const m of main.slice(k, k + perTick)) enqueue(m.id, m.item.text, 'S-main');
      if (neighbour && k / perTick < other.length)
        enqueue(other[k / perTick].id, other[k / perTick].item.text, 'S-neighbour');
      await sleep(16);
    }
  }
  await queueMod.waitForQaNlpIdleForTests(120_000);
  await sleep(30);
  clearInterval(sampler);
  const durationMs = r1(performance.now() - t0);
  const statusCount = (ids: string[]) => {
    const c: Record<string, number> = {};
    for (const id of ids) {
      const w = store.get(id);
      const k = w ? (w.reason ? `${w.status}:${w.reason}` : w.status) : 'nie geschrieben';
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  };
  const modeTime = (key: 'mode' | 'neighbour') => {
    const c: Record<string, number> = {};
    for (const s of timeline) if (s[key]) c[s[key]!] = (c[s[key]!] ?? 0) + 5;
    return c;
  };
  const finalMain = modeOf(main.map((m) => m.id));
  const classifiedShown = main.filter((m) => store.get(m.id)?.status === 'classified').length;
  return {
    label,
    total,
    arrival: perSecond === 'tick' ? 'alle im selben Tick' : `${perSecond}/s`,
    durationMs,
    statuses: statusCount(main.map((m) => m.id)),
    rejectedAtEnqueue: main.filter((m) => rejected.has(m.id)).length,
    finalStatusMode: finalMain,
    finalStatusLine: STATUS_TEXT[finalMain],
    classifiedShownInCompass: classifiedShown,
    statusLineTimeMs: modeTime('mode'),
    maxPending: Math.max(0, ...timeline.map((s) => s.pending)),
    maxEventLoopGapMs: r1(maxGap),
    ...(neighbour
      ? {
          neighbour: {
            statuses: statusCount(other.map((o) => o.id)),
            finalStatusLine: STATUS_TEXT[modeOf(other.map((o) => o.id))],
            statusLineTimeMs: modeTime('neighbour'),
          },
        }
      : {}),
  };
}

if (LOAD_REPEATS) {
  // Nur Teil 3 wiederholen: Anteil der Läufe, in denen die Queue überläuft
  const runs: Record<string, any[]> = {};
  for (const rate of [200, 1000] as const) {
    runs[rate] = [];
    for (let k = 0; k < LOAD_REPEATS; k++) {
      console.log(`Last ${rate}/s – Lauf ${k + 1}/${LOAD_REPEATS}`);
      runs[rate].push(await arrivalRun(`500 Fragen, ${rate}/s`, 500, rate));
    }
  }
  const wilson = (x: number, n: number) => {
    const z = 1.96;
    const p = x / n;
    const d = 1 + (z * z) / n;
    const c = (p + (z * z) / (2 * n)) / d;
    const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
    return [Math.max(0, c - h), Math.min(1, c + h)];
  };
  const summary = Object.fromEntries(
    Object.entries(runs).map(([rate, rs]) => {
      const overflow = rs.filter((r) => r.rejectedAtEnqueue > 0).length;
      const unavailable = rs.filter((r) => r.finalStatusMode !== 'classified').length;
      return [
        rate,
        {
          runs: rs.length,
          runsWithOverflow: overflow,
          overflowShare: overflow / rs.length,
          overflowWilson95: wilson(overflow, rs.length),
          runsNotSorted: unavailable,
          finalStatusLines: rs.reduce(
            (c: Record<string, number>, r) => (
              (c[r.finalStatusLine] = (c[r.finalStatusLine] ?? 0) + 1),
              c
            ),
            {},
          ),
          rejectedPerRun: rs.map((r) => r.rejectedAtEnqueue),
          maxPendingPerRun: rs.map((r) => r.maxPending),
          maxEventLoopGapMs: rs.map((r) => r.maxEventLoopGapMs),
        },
      ];
    }),
  );
  const ts = new Date().toISOString();
  const loadManifest = {
    timestamp: ts,
    commit: execSync(`git -C "${repo}" rev-parse HEAD`, { encoding: 'utf8' }).trim(),
    node: process.version,
    platform: `${os.platform()} ${os.release()} ${os.arch()}`,
    cpu: `${os.cpus()[0]?.model} × ${os.cpus().length}`,
    repeats: LOAD_REPEATS,
    queueLimit: configMod.resolveQaNlpConfig({ ...process.env, QA_NLP_ENABLED: 'true' }),
  };
  const ldir = join(outRoot, `load-${ts.replace(/[:.]/g, '-')}`);
  mkdirSync(ldir, { recursive: true });
  writeFileSync(
    join(ldir, 'results.json'),
    JSON.stringify({ manifest: loadManifest, summary, runs }, null, 2) + '\n',
  );
  const pc = (x: number) => `${(x * 100).toFixed(0)} %`;
  const LL = [
    '# Referat 2B – Last wiederholt: Queue-Überlauf bei hoher Einreichungsrate',
    '',
    `Commit \`${loadManifest.commit.slice(0, 12)}\`, ${ts}, ${loadManifest.cpu}, Node ${loadManifest.node}. Je Rate ${LOAD_REPEATS} Läufe à 500 Fragen (Release-Queue, Klassifikator 8.9b).`,
    '',
    '| Rate | Läufe | mit Queue-Überlauf | Anteil [95-%-Wilson] | Statuszeile am Ende | abgewiesene Fragen je Lauf (min–max) | max. offen (min–max) | max. Event-Loop-Lücke ms (min–max) |',
    '|---|---:|---:|---|---|---|---|---|',
    ...Object.entries(summary).map(([rate, x]: [string, any]) => {
      const mm = (a: number[]) => `${Math.min(...a)}–${Math.max(...a)}`;
      return `| ${rate}/s | ${x.runs} | ${x.runsWithOverflow} | ${pc(x.overflowShare)} [${pc(x.overflowWilson95[0])}; ${pc(x.overflowWilson95[1])}] | ${Object.entries(
        x.finalStatusLines,
      )
        .map(([k, v]) => `${k} ×${v}`)
        .join(
          ', ',
        )} | ${mm(x.rejectedPerRun)} | ${mm(x.maxPendingPerRun)} | ${mm(x.maxEventLoopGapMs)} |`;
    }),
    '',
    'Gültigkeitsgrenze: ein Prozess auf dem Messrechner; die Überlaufgrenze hängt von der CPU-Zeit je Klassifikation ab.',
  ];
  writeFileSync(join(ldir, 'report.md'), LL.join('\n') + '\n');
  console.log(LL.join('\n'));
  process.exit(0);
}
console.log('Teil 3 – Einreichungsraten …');
const load = {
  arrival: [] as any[],
  encoder: [] as any[],
};
for (const [n, rate] of [
  [500, 50],
  [500, 200],
  [500, 1000],
  [500, 'tick'],
] as const) {
  load.arrival.push(
    await arrivalRun(`${n} Fragen, ${rate === 'tick' ? 'gleichzeitig' : rate + '/s'}`, n, rate),
  );
}
console.log('Teil 3 – Nachbarsitzung …');
load.arrival.push(
  await arrivalRun(
    '150 Fragen gleichzeitig in Sitzung A, Sitzung B fragt nebenher',
    150,
    'tick',
    true,
  ),
);

console.log('Teil 3 – gleichzeitige Themenanalysen …');
const sessionsItems = (k: number) =>
  Array.from({ length: k }, (_, s) =>
    ref.items
      .filter((i) => dom(i) === 'statistics' && i.locale === 'de')
      .slice(0, 60)
      .map((i) => ({ ...i, id: `${i.id}-s${s}`, text: `${i.text} (Sitzung ${s + 1})` })),
  );
for (const k of [1, 2, 4, 8]) {
  analyzeMod.resetWordCloudSemanticAnalyzeForTests();
  const runs = await Promise.all(
    sessionsItems(k).map((items) => semanticEntries(items, 'de', { reset: false })),
  );
  // Direkt danach: eine weitere Sitzung mit frischen Fragen – trifft sie einen offenen Circuit-Breaker?
  const after = await semanticEntries(
    ref.items
      .filter((i) => dom(i) === 'police' && i.locale === 'de')
      .slice(0, 40)
      .map((i) => ({ ...i, id: `${i.id}-after${k}`, text: `${i.text} (danach ${k})` })),
    'de',
    { reset: false },
  );
  load.encoder.push({
    sessions: k,
    results: runs.map((r) => ({ status: r.status, fallbackUsed: r.fallbackUsed, ms: r.ms })),
    withTopics: runs.filter((r) => !r.fallbackUsed).length,
    withFallback: runs.filter((r) => r.fallbackUsed).length,
    nextSessionAfterwards: { status: after.status, fallbackUsed: after.fallbackUsed, ms: after.ms },
  });
}
analyzeMod.resetWordCloudSemanticAnalyzeForTests();

// ---------- Manifest und Ausgabe ----------
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
  sourcesDirty:
    git(
      'status --porcelain -- apps/backend/src/lib apps/frontend/src/app/features/session/session-host/moderation-compass.ts libs/shared-types/src',
    ) !== '',
  node: process.version,
  platform: `${os.platform()} ${os.release()} ${os.arch()}`,
  cpu: `${os.cpus()[0]?.model} × ${os.cpus().length}`,
  reference: {
    path: refPath,
    version: ref.meta.version,
    sha256: createHash('sha256').update(refRaw).digest('hex'),
  },
  releaseConstants: {
    visibleSources: VISIBLE,
    storedSources: shared.MODERATION_COMPASS_STORED_SOURCE_COUNT,
    qaNlpQueueLimit: configMod.QA_NLP_QUEUE_LIMIT_DEFAULT,
    qaNlpConcurrency: configMod.QA_NLP_CONCURRENCY_DEFAULT,
    semanticLocales: SEMANTIC_LOCALES,
  },
};
const stamp = manifest.timestamp.replace(/[:.]/g, '-');
const dir = join(outRoot, `compass-${stamp}`);
mkdirSync(dir, { recursive: true });
writeFileSync(
  join(dir, 'results.json'),
  JSON.stringify({ manifest, subjects, languages, load }, null, 2),
);

// ---------- Bericht ----------
const L: string[] = [];
const DN: Record<string, string> = {
  statistics: 'Statistik',
  botany: 'Botanik',
  history: 'Geschichte',
  police: 'Polizeischule',
};
L.push('# Referat 2B – Was der Moderationskompass aus Kategorien und Themen macht', '');
L.push(
  `Commit \`${manifest.commit.slice(0, 12)}\` (${manifest.describe})${manifest.sourcesDirty ? ' – **Achtung: lokale Änderungen in gemessenen Quellen**' : ''}, Referenzset ${ref.meta.version} (SHA-256 \`${manifest.reference.sha256.slice(0, 16)}…\`), ${manifest.timestamp}`,
  `${manifest.cpu}, Node ${manifest.node}. Kompass-Funktionen aus dem Release; sichtbar sind ${VISIBLE} Quellen je Karte, gespeichert bis ${manifest.releaseConstants.storedSources}.`,
  '',
  '**Lesart:** *Statuszeile* = was oben im Kompass-Dialog steht. *Kategorie-Quellen korrekt* = Anteil der Fragen hinter den sichtbaren Kategorie-Quellen, deren Referenzkategorie stimmt. *Themen schlüssig* = sichtbare Themen/Terme mit ≥ 2 Fragen, von denen ≥ 80 % zu einem Anliegen (Familie) gehören. *Erreichbar* = Anteil aller Fragen, die über die drei sichtbaren Quellen erreichbar sind.',
  '',
);
const row = (v: any) =>
  `${v.statusLine} | ${v.categoryVisiblePrecision === null ? '–' : pct(v.categoryVisiblePrecision) + ` (${v.categoryShownWrong} falsch)`} | ${v.termVisible ? `${v.termCoherent} / ${v.termVisible}` : '–'} | ${pct(v.reachableShare)}`;
L.push('## 1. Fächer: Karte »Häufige Themen« in einer deutschen Sitzung', '');
for (const d of DOMAINS) {
  const s = subjects[d];
  L.push(
    `### ${DN[d]} (${s.n} Fragen; 8.9b: ${Object.entries(s.nlpStatuses)
      .map(([k, n]) => `${n} ${k}`)
      .join(', ')}; Encoder: ${s.semantic.status}${s.semantic.fallbackUsed ? ', Fallback' : ''})`,
    '',
  );
  L.push(
    '| Variante | Statuszeile | Kategorie-Quellen korrekt | Themen schlüssig | Erreichbar |',
    '|---|---|---|---|---|',
  );
  for (const v of VARIANTS) L.push(`| ${v.id} ${v.name} | ${row(s.variants[v.id])} |`);
  L.push('', 'Sichtbare Quellen (V3):', '');
  for (const q of s.variants.V3.visible)
    L.push(
      `- ${q.rank}. **${q.label}** – ${q.kind}, ${q.n} Fragen, ${q.kind === 'Kategorie' ? `korrekt ${q.precision === null ? '–' : pct(q.precision)}${q.wrongExamples?.length ? `; z. B. falsch: »${q.wrongExamples[0]}«` : ''}` : `Reinheit ${q.purity === null ? '–' : pct(q.purity)} (${q.families} Anliegen)`}`,
    );
  L.push('');
}
L.push('## 2. Sprachen: dieselbe Fragensammlung je Sprache', '');
for (const d of Object.keys(languages)) {
  L.push(
    `### ${DN[d]}`,
    '',
    '| Sprache | n | 8.9b classified / uncertain | Statuszeile mit 8.9b | Kategorie-Quellen korrekt (V1) | Encoder im Produkt | Themen schlüssig: lexikalisch (V0) → Encoder (V2) | Erreichbar V0 → V2 |',
    '|---|---:|---|---|---|---|---|---|',
  );
  for (const [l, s] of Object.entries<any>(languages[d])) {
    const v0 = s.variants.V0;
    const v1 = s.variants.V1;
    const v2 = s.variants.V2;
    L.push(
      `| ${l} | ${s.n} | ${s.nlpStatuses.classified ?? 0} / ${s.nlpStatuses.uncertain ?? 0} | ${v1.statusLine} | ${v1.categoryVisiblePrecision === null ? '–' : pct(v1.categoryVisiblePrecision) + ` (${v1.categoryShownWrong} falsch)`} | ${s.semantic.encoderCalled ? 'ja' : 'nein'} (${s.semantic.status}${s.semantic.fallbackUsed ? ', Fallback' : ''}) | ${v0.termCoherent}/${v0.termVisible} → ${v2.termCoherent}/${v2.termVisible} | ${pct(v0.reachableShare)} → ${pct(v2.reachableShare)} |`,
    );
  }
  L.push('');
}
L.push(
  '## 3. Last: was die Lehrperson im Kompass sieht',
  '',
  `Release-Queue für 8.9b: Limit ${manifest.releaseConstants.qaNlpQueueLimit}, Parallelität ${manifest.releaseConstants.qaNlpConcurrency}, **eine Queue je Backend-Prozess für alle Sitzungen**. Encoder: höchstens 1 Anfrage gleichzeitig je Prozess.`,
  '',
);
L.push(
  '| Szenario | Dauer | 8.9b-Status am Ende | Statuszeile am Ende | Zeit mit »werden noch sortiert« | max. wartend | größte Event-Loop-Lücke |',
  '|---|---:|---|---|---:|---:|---:|',
);
for (const a of load.arrival)
  L.push(
    `| ${a.label} | ${a.durationMs} ms | ${Object.entries(a.statuses)
      .map(([k, n]) => `${n} ${k}`)
      .join(
        ', ',
      )} | ${a.finalStatusLine} | ${a.statusLineTimeMs.pending ?? 0} ms | ${a.maxPending} | ${a.maxEventLoopGapMs} ms |`,
  );
const nb = load.arrival.find((a) => a.neighbour);
if (nb)
  L.push(
    '',
    `**Nachbarsitzung B** (10 Fragen, während A 150 gleichzeitig einreicht): ${Object.entries(
      nb.neighbour.statuses,
    )
      .map(([k, n]) => `${n} ${k}`)
      .join(', ')} → Statuszeile am Ende: »${nb.neighbour.finalStatusLine}«.`,
  );
L.push(
  '',
  '| Gleichzeitige Themenanalysen | mit Encoder-Themen | lexikalischer Fallback | Dauer je Sitzung | nächste Sitzung direkt danach |',
  '|---:|---:|---:|---|---|',
);
for (const e of load.encoder)
  L.push(
    `| ${e.sessions} | ${e.withTopics} | ${e.withFallback} | ${e.results.map((r: any) => `${r.ms} ms`).join(', ')} | ${e.nextSessionAfterwards.fallbackUsed ? 'Fallback' : 'Themen'} (${e.nextSessionAfterwards.ms} ms) |`,
  );
L.push(
  '',
  '## Gültigkeitsgrenzen',
  '',
  '- Kompass ohne Stimmen, Quiz und Blitzlicht: nur die Karte »Häufige Themen« und die Statuszeile werden bewertet; Sortierung TOP.',
  '- Themen-Quellen werden über ihre vollständige Mitgliedschaft bewertet (das sieht die Lehrperson nach dem Sprung in die Wortwolke); im Dialog selbst trägt eine Quelle nur eine Beispielfrage.',
  '- Last in-process mit Release-Queue und In-Memory-Writer, ohne HTTP und Datenbank; Ankunft in 16-ms-Takten. Gleichzeitige Themenanalysen mit leicht veränderten Texten, damit kein Cache greift.',
  '- Lexikalische Baseline ohne spaCy-Glättung (`normalization: NONE`).',
);
writeFileSync(join(dir, 'report.md'), L.join('\n') + '\n');
console.log(`Ergebnisse: ${dir}`);
