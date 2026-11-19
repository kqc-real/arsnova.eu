#!/usr/bin/env tsx
/**
 * Referat 2B – Laufzeitpfade von 8.9b (Kategorie) und 1.14c (Encoder-Thema) unter Gegenvarianten.
 *
 * Misst am unveränderten Releasecode, wie beide Pfade sich unter Störungen verhalten:
 *  A  8.9b: Submit wartet nicht, kein Netz-/LLM-Aufruf, Queue-Limit, Timeout, CPU-gebundene Arbeit,
 *     Sichtbarkeit von »uncertain« im Moderationskompass
 *  B  1.14c: Encoder normal / gestoppt / hängend / Circuit-Breaker → Fallback
 *  C  Kategorie und Thema derselben Sitzung nebeneinander
 *
 * Testadapter (ausdrücklich zulässig für Fault-Injection): In-Memory-Writer statt Prisma,
 * verzögerte bzw. CPU-blockierende Processor-Varianten. Klassifikator, Queue, Timeout,
 * Encoder-Client, Clustering und Fallback sind Releasecode.
 *
 * Aufruf aus dem Repo-Root (Encoder-Container muss laufen; wird für B2 kurz gestoppt):
 *   npx tsx <pfad>/check-runtime-paths.mts --repo . --ref <reference.json> --out <dir>
 */
import { execSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import os from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2)
  args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const repo = resolve(args.get('repo') ?? '.');
const refPath = resolve(args.get('ref') ?? 'reference-dataset.v2.1.json');
const outRoot = resolve(args.get('out') ?? 'results');
const CONTAINER = args.get('container') ?? 'arsnova-2b-encoder';
const ENCODER_URL = args.get('url') ?? 'http://127.0.0.1:8790/embed';
const HANG_PORT = 8791;

const lib = (name: string) =>
  import(pathToFileURL(join(repo, 'apps/backend/src/lib', `${name}.ts`)).href);
const shared = await import(pathToFileURL(join(repo, 'libs/shared-types/src/index.ts')).href);
const [queueMod, workerMod, configMod, cascadeMod, analyzeMod, normMod, wcConfigMod] =
  await Promise.all([
    lib('qaNlpQueue'),
    lib('qaNlpWorker'),
    lib('qaNlpConfig'),
    lib('qaNlpCascade'),
    lib('wordCloudSemanticAnalyze'),
    lib('wordCloudNormalization'),
    lib('wordCloudSemanticConfig'),
  ]);

const sh = (c: string) => {
  try {
    return execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'n/a';
  }
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const r1 = (x: number) => Math.round(x * 10) / 10;
const quant = (arr: number[], q: number) => {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))];
};

type Item = {
  id: string;
  text: string;
  locale: string;
  tags: string[];
  family: string;
  category: string | null;
  domain?: string;
  expectUncertain?: boolean;
};
const refRaw = readFileSync(refPath, 'utf8');
const ref = JSON.parse(refRaw) as { meta: { version: string }; items: Item[] };
const stats = ref.items.filter((i) => !i.domain);
// Realistische Sitzung: alle deutschen Statistik-Fragen inkl. mehrdeutiger und Rausch-Items
const session = stats.filter((i) => i.locale === 'de');

// ---------- Netz-Zähler (für »kein LLM-/Netzaufruf«) ----------
const net_ = { http: 0, https: 0, fetch: 0, socket: 0 };
const origHttp = http.request,
  origHttps = https.request,
  origFetch = globalThis.fetch,
  origConnect = net.Socket.prototype.connect;
function countNetwork(on: boolean) {
  if (on) {
    (http as any).request = (...a: any[]) => {
      net_.http += 1;
      return (origHttp as any)(...a);
    };
    (https as any).request = (...a: any[]) => {
      net_.https += 1;
      return (origHttps as any)(...a);
    };
    globalThis.fetch = ((...a: any[]) => {
      net_.fetch += 1;
      return (origFetch as any)(...a);
    }) as any;
    net.Socket.prototype.connect = function (this: any, ...a: any[]) {
      net_.socket += 1;
      return (origConnect as any).apply(this, a);
    } as any;
  } else {
    (http as any).request = origHttp;
    (https as any).request = origHttps;
    globalThis.fetch = origFetch;
    net.Socket.prototype.connect = origConnect;
  }
}

// ---------- A: 8.9b-Klassifikationspfad ----------
type Written = {
  status: string;
  category: string | null;
  confidence: number | null;
  reason?: string;
  at: number;
};
function memWriter(store: Map<string, Written>) {
  return async (questionId: string, result: any) => {
    store.set(questionId, {
      status: result.status,
      category: result.category ?? null,
      confidence: result.confidence ?? null,
      reason: result.reason,
      at: performance.now(),
    });
  };
}
const releaseConfig = (env: Record<string, string>) => () =>
  configMod.resolveQaNlpConfig({ ...process.env, ...env });

// Event-Loop-Belegung: Lücken zwischen 1-ms-Timer-Ticks (größte Lücke ≈ längste Blockade)
function loopGapTracker() {
  const gaps: number[] = [];
  let last = performance.now();
  const t = setInterval(() => {
    const now = performance.now();
    gaps.push(now - last);
    last = now;
  }, 1);
  return {
    stop: () => {
      clearInterval(t);
      return gaps;
    },
  };
}

async function burst(
  items: Item[],
  opts: {
    env: Record<string, string>;
    processor?: (s: any) => Promise<any>;
    idleMs?: number;
    spaced?: boolean;
  },
) {
  const store = new Map<string, Written>();
  queueMod.resetQaNlpQueueForTests({
    writer: memWriter(store),
    config: releaseConfig(opts.env),
    ...(opts.processor ? { processor: opts.processor } : {}),
  });
  const gap = loopGapTracker();
  const enqueueMs: number[] = [];
  const enqueuedAt = new Map<string, number>();
  const outcome: Record<string, number> = {};
  const ids = items.map(() => randomUUID());
  const t0 = performance.now();
  for (const [k, it] of items.entries()) {
    // spaced: jede Einreichung in eigenem Makrotask wie getrennte HTTP-Requests; sonst alle im selben Tick
    if (opts.spaced) await new Promise((r) => setImmediate(r));
    const s = performance.now();
    const r = queueMod.enqueueQaNlpJob({
      sessionId: 'ref2b-session',
      questionId: ids[k],
      text: it.text,
    });
    enqueueMs.push(performance.now() - s);
    enqueuedAt.set(ids[k], s);
    outcome[r] = (outcome[r] ?? 0) + 1;
  }
  const burstMs = performance.now() - t0;
  await queueMod.waitForQaNlpIdleForTests(opts.idleMs ?? 60_000);
  await sleep(20);
  const gaps = gap.stop();
  const lat = ids
    .filter((id) => store.has(id))
    .map((id) => store.get(id)!.at - enqueuedAt.get(id)!);
  const statuses: Record<string, number> = {};
  for (const w of store.values()) {
    const k = w.reason ? `${w.status}:${w.reason}` : w.status;
    statuses[k] = (statuses[k] ?? 0) + 1;
  }
  return {
    n: items.length,
    enqueueResult: outcome,
    enqueueCallMs: {
      p50: Number(quant(enqueueMs, 0.5).toFixed(3)),
      max: Number(Math.max(...enqueueMs).toFixed(3)),
    },
    wholeBurstEnqueueMs: r1(burstMs),
    persisted: store.size,
    statuses,
    resultLatencyMs: lat.length
      ? { p50: r1(quant(lat, 0.5)), p95: r1(quant(lat, 0.95)), max: r1(Math.max(...lat)) }
      : null,
    eventLoopGapMs: { p99: r1(quant(gaps, 0.99)), max: r1(Math.max(...gaps)) },
    metrics: queueMod.getQaNlpMetrics(),
    store,
    ids,
  };
}

// Reine CPU-Zeit je Klassifikation (ohne Queue), um Event-Loop-Belegung einzuordnen
const cpuMs: number[] = [];
for (const it of session) {
  const s = performance.now();
  cascadeMod.classifyQaNlpCascade({ text: it.text });
  cpuMs.push(performance.now() - s);
}

console.log('A1 Normalbetrieb …');
countNetwork(true);
const a1 = await burst(session, { env: { QA_NLP_ENABLED: 'true' }, spaced: true });
countNetwork(false);
const a1Network = { ...net_ };

console.log('A2 Kill-Switch aus …');
const a2 = await burst(session.slice(0, 20), { env: { QA_NLP_ENABLED: 'false' }, spaced: true });

console.log('A3 Queue-Limit …');
const over = Array.from({ length: 150 }, (_, k) => stats[k % stats.length]);
const a3 = await burst(over, { env: { QA_NLP_ENABLED: 'true' } });

console.log('A4 Timeout (asynchron verzögert) …');
const a4 = await burst(session.slice(0, 3), {
  env: { QA_NLP_ENABLED: 'true' },
  processor: async (snap: any) => {
    await sleep(3000);
    return workerMod.runQaNlpClassifier(snap);
  },
});

console.log('A5 CPU-gebunden (synchron blockierend) …');
const a5 = await burst(session.slice(0, 1), {
  env: { QA_NLP_ENABLED: 'true' },
  processor: async (snap: any) => {
    const s = performance.now();
    while (performance.now() - s < 2500) {
      /* busy */
    }
    return workerMod.runQaNlpClassifier(snap);
  },
});

// A6 Sichtbarkeit im Kompass (Releaselogik aus shared-types bzw. Frontend nachgebildet)
const sessionStatuses = a1.ids.map((id) => a1.store.get(id)?.status);
const modeOf = (statuses: (string | undefined)[]) =>
  shared.resolveModerationCompassAnalysisMode({ enabled: true, statuses });
const a1Written = a1.ids.map((id, k) => ({ item: session[k], w: a1.store.get(id)! }));
const uncertainCount = a1Written.filter((x) => x.w.status === 'uncertain').length;
const classifiedCount = a1Written.filter((x) => x.w.status === 'classified').length;
const classifiedWrong = a1Written.filter(
  (x) =>
    x.w.status === 'classified' &&
    x.item.category &&
    !x.item.expectUncertain &&
    x.w.category !== x.item.category,
).length;
const classifiedOnAmbiguous = a1Written.filter(
  (x) => x.w.status === 'classified' && x.item.expectUncertain,
).length;
const a6 = {
  sessionMode: modeOf(sessionStatuses),
  classified: classifiedCount,
  uncertain: uncertainCount,
  // collectQaNlpCategorySources (moderation-compass.ts:702) übernimmt nur status === 'classified'
  uncertainInCompassCategorySources: 0,
  classifiedButWrongCategory: classifiedWrong,
  classifiedAlthoughAmbiguousOrNoise: classifiedOnAmbiguous,
  scenarios: {
    allUncertain: modeOf(['uncertain', 'uncertain', 'uncertain']),
    oneClassifiedRestUncertain: modeOf(['classified', 'uncertain', 'uncertain']),
    oneFailedRestClassified: modeOf(['classified', 'classified', 'failed']),
    onePending: modeOf(['classified', 'pending']),
  },
};

// ---------- B: 1.14c-Encoderpfad und Fallback ----------
const semItems = session
  .slice(0, 80)
  .map((i) => ({ id: randomUUID(), text: i.text, weight: 1, ref: i }));
const input = shared.AnalyzeWordCloudInputSchema.parse({
  sessionCode: 'REF2B1',
  mode: 'SEMANTIC',
  locale: 'de',
  metric: 'BEST',
  channel: 'QA',
  normalization: 'NONE',
  items: semItems.map(({ id, text, weight }) => ({ id, text, weight })),
});
const meta = normMod.resolveWordCloudNormalizationMeta(input);
const envFor = (url: string) => ({
  ...process.env,
  WORD_CLOUD_SEMANTIC_ENABLED: 'true',
  WORD_CLOUD_ENCODER_URL: url,
  WORD_CLOUD_ENCODER_SOCKET_PATH: '',
});
async function analyze(url: string, resetFirst = true) {
  if (resetFirst) analyzeMod.resetWordCloudSemanticAnalyzeForTests();
  const s = performance.now();
  const out = await analyzeMod.analyzeSemanticWordCloudSnapshot(input, meta, {
    sessionId: randomUUID(),
    env: envFor(url),
  });
  return {
    ms: r1(performance.now() - s),
    status: out.status as string,
    fallbackUsed: out.fallbackUsed as boolean,
    modelVersion: out.modelVersion as string | null,
    entries: out.entries as any[],
  };
}
const healthy = async () => {
  try {
    return (await origFetch(ENCODER_URL.replace(/\/embed$/, '/health'))).status === 204;
  } catch {
    return false;
  }
};

if (!(await healthy())) throw new Error(`Encoder unter ${ENCODER_URL} nicht erreichbar`);
console.log('B1 Encoder normal …');
await analyze(ENCODER_URL); // Aufwärmen (Modell im Container laden)
const b1 = await analyze(ENCODER_URL);

console.log('B2 Encoder gestoppt …');
sh(`docker stop ${CONTAINER}`);
const b2 = await analyze(ENCODER_URL);
sh(`docker start ${CONTAINER}`);
const restartStart = performance.now();
while (!(await healthy())) {
  if (performance.now() - restartStart > 300_000) break;
  await sleep(200);
}
const restartMs = r1(performance.now() - restartStart);

console.log('B3 Encoder hängt (Timeout) …');
const hanging = net.createServer(() => {
  /* Verbindung annehmen, nie antworten */
});
await new Promise<void>((r) => hanging.listen(HANG_PORT, '127.0.0.1', () => r()));
const b3 = await analyze(`http://127.0.0.1:${HANG_PORT}/embed`);
console.log('B4 Circuit-Breaker (hängender Encoder, fünf Analysen) …');
analyzeMod.resetWordCloudSemanticAnalyzeForTests();
const b4: { call: number; ms: number; status: string }[] = [];
for (let k = 1; k <= 5; k += 1) {
  const r = await analyze(`http://127.0.0.1:${HANG_PORT}/embed`, false);
  b4.push({ call: k, ms: r.ms, status: r.status });
}
hanging.close();

// ---------- C: Kategorie und Thema derselben Sitzung ----------
const byId = new Map(semItems.map((x) => [x.id, x]));
const catOf = (text: string) => {
  const r = cascadeMod.classifyQaNlpCascade({ text });
  return r.status === 'classified' ? r.category : `uncertain(${r.category ?? '–'})`;
};
const topics = b1.entries
  .filter((e) => e.members.length >= 2)
  .map((e) => {
    const members = e.members
      .map((m: any) => byId.get(m.sourceId))
      .filter(Boolean) as typeof semItems;
    const predicted = members.map((m) => catOf(m.text));
    return {
      label: e.label,
      confidence: e.confidence,
      size: members.length,
      families: [...new Set(members.map((m) => m.ref.family))],
      goldCategories: [...new Set(members.map((m) => m.ref.category ?? 'none'))],
      predictedCategories: Object.fromEntries(
        [...new Set(predicted)].map((c) => [c, predicted.filter((p) => p === c).length]),
      ),
      example: members[0]?.text,
    };
  });
const c = {
  topicsShown: b1.entries.length,
  multiMemberTopics: topics.length,
  topicsWithMixedPredictedCategory: topics.filter(
    (t) => Object.keys(t.predictedCategories).length > 1,
  ).length,
  topics,
};

// ---------- Ausgabe ----------
const manifest = {
  timestamp: new Date().toISOString(),
  commit: sh(`git -C "${repo}" rev-parse HEAD`),
  describe: sh(`git -C "${repo}" describe --tags --always --dirty`),
  sourcesDirty:
    sh(`git -C "${repo}" status --porcelain -- apps/backend/src/lib libs/shared-types/src`) !== '',
  node: process.version,
  cpu: `${os.cpus()[0]?.model} × ${os.cpus().length}`,
  reference: {
    path: refPath,
    version: ref.meta.version,
    sha256: createHash('sha256').update(refRaw).digest('hex'),
  },
  releaseConstants: {
    QA_NLP_TIMEOUT_DEFAULT_MS: configMod.QA_NLP_TIMEOUT_DEFAULT_MS,
    QA_NLP_QUEUE_LIMIT_DEFAULT: configMod.QA_NLP_QUEUE_LIMIT_DEFAULT,
    QA_NLP_CONCURRENCY_DEFAULT: configMod.QA_NLP_CONCURRENCY_DEFAULT,
    QA_NLP_MIN_CONFIDENCE_DEFAULT: configMod.QA_NLP_MIN_CONFIDENCE_DEFAULT,
    WORD_CLOUD_ENCODER_TIMEOUT_DEFAULT_MS: wcConfigMod.WORD_CLOUD_ENCODER_TIMEOUT_DEFAULT_MS,
    WORD_CLOUD_ENCODER_CIRCUIT_FAILURE_THRESHOLD:
      wcConfigMod.WORD_CLOUD_ENCODER_CIRCUIT_FAILURE_THRESHOLD,
    WORD_CLOUD_ENCODER_CIRCUIT_OPEN_MS: wcConfigMod.WORD_CLOUD_ENCODER_CIRCUIT_OPEN_MS,
  },
  adapters: [
    'In-Memory-Writer statt Prisma (A1–A5)',
    'verzögerter Processor (A4)',
    'CPU-blockierender Processor (A5)',
    'TCP-Server ohne Antwort (B3)',
    'docker stop/start (B2)',
  ],
};
const strip = ({ store, ids, ...rest }: any) => rest;
const results = {
  manifest,
  A: {
    classificationCpuMs: {
      n: cpuMs.length,
      p50: r1(quant(cpuMs, 0.5) * 100) / 100,
      p95: r1(quant(cpuMs, 0.95) * 100) / 100,
      max: r1(Math.max(...cpuMs) * 100) / 100,
    },
    a1: strip(a1),
    a1Network,
    a2: strip(a2),
    a3: strip(a3),
    a4: strip(a4),
    a5: strip(a5),
    a6,
  },
  B: {
    b1: { ...b1, entries: b1.entries.length },
    b2: { ...b2, entries: b2.entries.length },
    b3: { ...b3, entries: b3.entries.length },
    b4,
    encoderRestartMs: restartMs,
  },
  C: c,
};
const stamp = manifest.timestamp.replace(/[:.]/g, '-');
const outDir = join(outRoot, `paths-${stamp}`);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'results.json'), JSON.stringify(results, null, 2));

const L: string[] = [];
const fmt = (o: Record<string, number>) =>
  Object.entries(o)
    .map(([k, v]) => `${k} ${v}`)
    .join(', ');
L.push('# Referat 2B – Laufzeitpfade Kategorie (8.9b) und Encoder-Thema (1.14c)', '');
L.push(
  `Commit \`${manifest.commit.slice(0, 12)}\` (${manifest.describe})${manifest.sourcesDirty ? ' – **Achtung: lokale Änderungen in gemessenen Quellen**' : ''}, Referenzset ${ref.meta.version} (SHA-256 \`${manifest.reference.sha256.slice(0, 16)}…\`), ${manifest.timestamp}`,
);
L.push(`${manifest.cpu}, Node ${manifest.node}. Testadapter: ${manifest.adapters.join('; ')}.`, '');
L.push('## A. 8.9b – Klassifikation nach `qa.submit`', '');
L.push(
  `Sitzung: ${session.length} deutsche Statistik-Fragen (inkl. mehrdeutiger und Rausch-Items); A1/A2 je Einreichung ein eigener Makrotask wie getrennte Requests, A3 alle im selben Event-Loop-Tick. Releasewerte: Timeout ${configMod.QA_NLP_TIMEOUT_DEFAULT_MS} ms, Queue-Limit ${configMod.QA_NLP_QUEUE_LIMIT_DEFAULT}, Parallelität ${configMod.QA_NLP_CONCURRENCY_DEFAULT}.`,
  '',
);
L.push(
  '| Variante | n | enqueue-Ergebnis | Dauer je enqueue-Aufruf p50 / max | gespeicherte Status | Zeit bis Ergebnis p50 / p95 / max | Event-Loop-Lücke p99 / max |',
  '|---|---:|---|---|---|---|---|',
);
for (const [name, r] of [
  ['A1 normal, Einreichungen nacheinander', a1],
  ['A2 Kill-Switch aus', a2],
  ['A3 150 Fragen im selben Tick', a3],
  ['A4 Processor 3 s verzögert (async)', a4],
  ['A5 Processor 2,5 s CPU-blockierend', a5],
] as const) {
  L.push(
    `| ${name} | ${r.n} | ${fmt(r.enqueueResult)} | ${r.enqueueCallMs.p50} / ${r.enqueueCallMs.max} ms | ${fmt(r.statuses) || '–'} | ${r.resultLatencyMs ? `${r.resultLatencyMs.p50} / ${r.resultLatencyMs.p95} / ${r.resultLatencyMs.max} ms` : '–'} | ${r.eventLoopGapMs.p99} / ${r.eventLoopGapMs.max} ms |`,
  );
}
L.push(
  '',
  `Reine Klassifikationszeit je Frage (synchron, Haupt-Thread): p50 ${results.A.classificationCpuMs.p50} ms, p95 ${results.A.classificationCpuMs.p95} ms, max ${results.A.classificationCpuMs.max} ms.`,
);
L.push(
  `Netzaufrufe während A1 (http/https/fetch/Socket): ${a1Network.http}/${a1Network.https}/${a1Network.fetch}/${a1Network.socket} – kein Encoder-, Sidecar- oder llama-Aufruf.`,
  '',
);
L.push('**Sichtbarkeit im Moderationskompass (A1-Ergebnis):**', '');
L.push(
  `- Status gesamt: ${a6.classified} classified, ${a6.uncertain} uncertain → Kompass-Analysemodus \`${a6.sessionMode}\`.`,
);
L.push(
  `- In die Kategorie-Quellen des Kompasses gehen nur \`classified\`-Fragen ein; die ${a6.uncertain} unsicheren erscheinen dort nicht.`,
);
L.push(
  `- Von den classified-Fragen tragen ${a6.classifiedButWrongCategory} eine falsche Kategorie, ${a6.classifiedAlthoughAmbiguousOrNoise} waren mehrdeutige oder Rausch-Items.`,
);
L.push(
  `- Modus-Szenarien (Releasefunktion \`resolveModerationCompassAnalysisMode\`): alle uncertain → \`${a6.scenarios.allUncertain}\`; eine classified, Rest uncertain → \`${a6.scenarios.oneClassifiedRestUncertain}\`; eine failed → \`${a6.scenarios.oneFailedRestClassified}\`; eine pending → \`${a6.scenarios.onePending}\`.`,
  '',
);
L.push('## B. 1.14c – Encoder-Thema nach Host-`wordCloud.analyze`', '');
L.push(
  `Snapshot: ${semItems.length} deutsche Fragen. Releasewerte: Encoder-Timeout ${wcConfigMod.WORD_CLOUD_ENCODER_TIMEOUT_DEFAULT_MS} ms, Circuit-Breaker nach ${wcConfigMod.WORD_CLOUD_ENCODER_CIRCUIT_FAILURE_THRESHOLD} Fehlern für ${wcConfigMod.WORD_CLOUD_ENCODER_CIRCUIT_OPEN_MS / 1000} s.`,
  '',
);
L.push(
  '| Variante | Dauer | Status | Fallback | Modellversion | Einträge |',
  '|---|---:|---|:---:|---|---:|',
);
for (const [name, r] of [
  ['B1 Encoder läuft', b1],
  ['B2 Encoder gestoppt', b2],
  ['B3 Encoder antwortet nicht', b3],
] as const) {
  L.push(
    `| ${name} | ${r.ms} ms | ${r.status} | ${r.fallbackUsed ? '✓' : '–'} | ${r.modelVersion ?? '–'} | ${r.entries.length} |`,
  );
}
L.push(
  '',
  `Circuit-Breaker (Encoder antwortet nicht, fünf Analysen hintereinander): ${b4.map((x) => `#${x.call} ${x.ms} ms ${x.status}`).join(' · ')}. Neustart des Encoders bis gesund: ${restartMs} ms.`,
  '',
);
L.push('## C. Kategorie und Thema derselben Sitzung', '');
L.push(
  `Aus B1: ${c.multiMemberTopics} Themen mit ≥ 2 Fragen; ${c.topicsWithMixedPredictedCategory} davon enthalten Fragen mit unterschiedlicher 8.9b-Kategorie.`,
  '',
);
L.push(
  '| Thema (Label) | Konfidenz | Fragen | Gold-Familien | 8.9b-Kategorien der Mitglieder |',
  '|---|---:|---:|---|---|',
);
for (const t of c.topics)
  L.push(
    `| ${String(t.label).replace(/\|/g, '\\|')} | ${t.confidence?.toFixed?.(3) ?? '–'} | ${t.size} | ${t.families.join(', ')} | ${fmt(t.predictedCategories)} |`,
  );
L.push('', '## Gültigkeitsgrenzen', '');
L.push(
  '- In-Process gemessen, ohne HTTP, Datenbank und echte Parallelnutzer; Latenzen sind Untergrenzen.',
);
L.push(
  '- Der In-Memory-Writer ersetzt das Prisma-Update; Persistenzzeit und DB-Fehler sind nicht gemessen.',
);
L.push(
  '- B3 simuliert einen hängenden Encoder per TCP-Server ohne Antwort, nicht einen überlasteten Container.',
);
writeFileSync(join(outDir, 'report.md'), L.join('\n') + '\n');
console.log(`Ergebnisse: ${outDir}`);
process.exit(0);
