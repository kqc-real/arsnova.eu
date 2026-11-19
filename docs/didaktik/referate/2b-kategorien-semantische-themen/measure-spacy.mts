#!/usr/bin/env tsx
/**
 * Referat 2B – Lexikalische Baseline mit spaCy-Glättung (Story 1.14b) gegen ohne und gegen Encoder-Themen.
 *
 * Ist die lexikalische Baseline nur deshalb schwach, weil sie ungeglättet gemessen wurde? Mit
 * spaCy aktiv fordert der Host beim Öffnen der Q&A-Wortwolke automatisch `LEMMA` an
 * (`qaWordCloudLemmaPreferred`), und der Kompass nimmt dann die Lemma-Terme vor allen Themen
 * (`moderationCompassQaTerms`). Gemessen wird deshalb, was im Kompass ankommt:
 *
 *   L0 »Wörter« ohne spaCy           LEXICAL, normalization NONE
 *   L1 »Wörter« mit spaCy            LEXICAL, normalization LEMMA (echter Sidecar)
 *   T0 »Wortgruppen« ohne spaCy THEME (= V0 in measure-compass.mts)
 *   T1 »Wortgruppen« mit spaCy  Phrasen aus THEME + Lemma-Unigramme, wie der Host mischt
 *                                    (mergeThemePhrasesWithLemmaUnigrams, max. 80 Einträge)
 *   S  »Themen« (Encoder)             SEMANTIC, e5-Encoder (nur de/en; sonst lexikalischer Fallback)
 *
 * Release-Funktionen: analyzeWordCloudSnapshot (Host-Pfad inkl. Normalisierung), Lemma-Normalizer,
 * buildLexicalSemanticFallbackEntries, analyzeSemanticWordCloudSnapshot, mergeThemePhrasesWithLemmaUnigrams,
 * compassTermsFromAnalysisEntries, buildModerationCompassView. Der Sidecar ist das Release-Image
 * `docker/spacy` (spaCy 3.8.15); da es nur einen Unix-Socket anbietet, ruft die Messung
 * ihn per `docker exec` im Container auf (Injektionspunkt `options.sidecar` des Releasecodes).
 * Die gemessene Sidecar-Zeit ist die Zeit des HTTP-Aufrufs im Container, ohne `docker exec`.
 *
 * --sidecar socket: kein Injektionspunkt, sondern der Release-Client normalizeWithSpacySidecar
 * über NLP_SOCKET_PATH (nur unter Linux, z. B. in einem Node-Container, der das Socket-Volume
 * des Sidecars einbindet). Gemessen wird dann die Zeit des Release-Client-Aufrufs.
 *
 * Aufruf aus dem Repo-Root:
 *   docker build -t arsnova-spacy:3.8.15 docker/spacy
 *   docker run -d --name arsnova-2b-spacy --read-only --tmpfs /tmp --tmpfs /run/spacy:uid=1000 \
 *     --cap-drop ALL --security-opt no-new-privileges arsnova-spacy:3.8.15
 *   npx tsx docs/didaktik/referate/2b-kategorien-semantische-themen/measure-spacy.mts --ref docs/didaktik/referate/2b-kategorien-semantische-themen/reference-dataset.v2.2.json --out docs/didaktik/referate/2b-kategorien-semantische-themen/results
 */
process.env['NODE_ENV'] = 'test'; // In-Memory statt Redis-Cache; jede Analyse wird frisch berechnet
import { execSync, spawnSync } from 'node:child_process';
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
const CONTAINER = args.get('container') ?? 'arsnova-2b-spacy';
const SIDECAR_MODE = args.get('sidecar') ?? 'exec'; // exec | socket
const SOCKET_PATH = args.get('socket') ?? '/run/spacy/nlp.sock';
const TOP = 12;

const lib = (name: string) =>
  import(pathToFileURL(join(repo, 'apps/backend/src/lib', `${name}.ts`)).href);
const shared = await import(pathToFileURL(join(repo, 'libs/shared-types/src/index.ts')).href);
const hostDir = join(repo, 'apps/frontend/src/app/features/session/session-host');
const compass = await import(pathToFileURL(join(hostDir, 'moderation-compass.ts')).href);
const merge = await import(pathToFileURL(join(hostDir, 'qa-word-cloud-theme-merge.ts')).href);
const routerMod = await import(
  pathToFileURL(join(repo, 'apps/backend/src/routers/wordCloud.ts')).href
);
const [analyzeMod, normMod, spacyClient] = await Promise.all([
  lib('wordCloudSemanticAnalyze'),
  lib('wordCloudNormalization'),
  lib('spacyClient'),
]);
const LEMMA_MAX_ENTRIES = 80; // session-host.component.ts: WORD_CLOUD_LEMMA_MAX_ENTRIES
const VISIBLE: number = shared.MODERATION_COMPASS_VISIBLE_SOURCE_COUNT;

type Item = { id: string; text: string; locale: string; family: string; domain?: string };
const refRaw = readFileSync(refPath, 'utf8');
const ref = JSON.parse(refRaw) as { meta: { version: string }; items: Item[] };
const dom = (i: Item) => i.domain ?? 'statistics';
const pct = (x: number) => `${(x * 100).toFixed(1).replace('.', ',')} %`;
const r1 = (x: number) => Math.round(x * 10) / 10;

// ---------- spaCy-Sidecar im Container (Unix-Socket) ----------
const PY = [
  'import sys, socket, time, http.client',
  'class C(http.client.HTTPConnection):',
  '    def connect(self):',
  '        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)',
  "        self.sock.connect('/run/spacy/nlp.sock')",
  'b = sys.stdin.buffer.read()',
  't = time.perf_counter()',
  "c = C('localhost', timeout=120)",
  "c.request('POST', '/normalize', b, {'Content-Type': 'application/json'})",
  'r = c.getresponse(); out = r.read()',
  "sys.stderr.write('%.1f' % ((time.perf_counter() - t) * 1000))",
  'sys.stdout.buffer.write(out)',
  'sys.exit(0 if r.status == 200 else 2)',
].join('\n');
const sidecarCalls: { locale: string; texts: number; ms: number }[] = [];
async function dockerSidecar(locale: string, texts: readonly { id: string; text: string }[]) {
  const res = spawnSync('docker', ['exec', '-i', CONTAINER, 'python', '-c', PY], {
    input: JSON.stringify({ locale, texts }),
    maxBuffer: 64e6,
  });
  if (res.status !== 0) throw new Error(`spaCy-Sidecar: ${res.stderr?.toString().slice(0, 200)}`);
  sidecarCalls.push({ locale, texts: texts.length, ms: Number(res.stderr.toString()) });
  return JSON.parse(res.stdout.toString('utf8'));
}
// Release-Client über den Unix-Socket; der Wrapper misst nur die Zeit
async function socketSidecar(
  locale: string,
  texts: readonly { id: string; text: string }[],
  config: unknown,
) {
  const t = performance.now();
  const out = await spacyClient.normalizeWithSpacySidecar(locale, texts, config);
  sidecarCalls.push({ locale, texts: texts.length, ms: performance.now() - t });
  return out;
}
const sidecar = SIDECAR_MODE === 'socket' ? socketSidecar : dockerSidecar;
const lemmaEnv = { ...process.env, NLP_ENABLED: 'true', NLP_SOCKET_PATH: SOCKET_PATH };
const encoderEnv = {
  ...process.env,
  WORD_CLOUD_SEMANTIC_ENABLED: 'true',
  WORD_CLOUD_ENCODER_URL: ENCODER_URL,
  WORD_CLOUD_ENCODER_SOCKET_PATH: '',
};

// ---------- Analysen über den Host-Pfad ----------
const input = (items: Item[], mode: string, locale: string, normalization: string) =>
  shared.AnalyzeWordCloudInputSchema.parse({
    sessionCode: 'REF2BS',
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
    lemma ? { env: lemmaEnv, sidecar } : {},
  );
  return {
    entries: out.entries as any[],
    applied: out.normalizationApplied as string,
    fallback: out.normalizationFallbackReason as string | null,
  };
}
const theme = (items: Item[], locale: string) =>
  analyzeMod.buildLexicalSemanticFallbackEntries(input(items, 'THEME', locale, 'NONE')) as any[];
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

// ---------- Bewertung ----------
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
  // Kompass, Karte »Häufige Themen« ohne Kategorien
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
    return { label: String(s.label), n: ids.length, purity: ids.length ? top / ids.length : 0 };
  });
  const reach = new Set<string>();
  for (const s of visible) {
    const e = entries.find((x: any) => x.label === s.label || String(x.label).startsWith(s.label));
    if (e) memberIds(e, known).forEach((id) => reach.add(id));
  }
  // Top-12 der Wortwolke: Paare in einem gemeinsamen Eintrag – gleiches Anliegen?
  const top12 = entries.slice(0, TOP);
  const pairs = new Set<string>();
  const covered = new Set<string>();
  for (const e of top12) {
    const ids = memberIds(e, known).sort();
    ids.forEach((id) => covered.add(id));
    for (let a = 0; a < ids.length; a++)
      for (let b = a + 1; b < ids.length; b++) pairs.add(`${ids[a]}|${ids[b]}`);
  }
  let same = 0;
  for (const p of pairs) {
    const [a, b] = p.split('|');
    if (byId.get(a)!.family === byId.get(b)!.family) same++;
  }
  return {
    visible,
    termCoherent: visible.filter((s: any) => s.n >= 2 && s.purity >= 0.8).length,
    termVisible: visible.length,
    reachableShare: items.length ? reach.size / items.length : 0,
    top12Labels: top12.map((e: any) => String(e.label)),
    top12Coverage: items.length ? covered.size / items.length : 0,
    top12Pairs: pairs.size,
    top12PairPrecision: pairs.size ? same / pairs.size : null,
  };
}

async function sessionReport(items: Item[], locale: string) {
  const l0 = await lexical(items, locale, false);
  const l1 = await lexical(items, locale, true);
  const t0 = theme(items, locale);
  const t1 = merge.mergeThemePhrasesWithLemmaUnigrams(
    t0.filter(merge.isDisplayableThemeWordCloudEntry),
    l1.applied === 'LEMMA' ? l1.entries : null,
    LEMMA_MAX_ENTRIES,
  );
  const sem = await semantic(items, locale);
  const l0Labels = new Set(l0.entries.slice(0, TOP).map((e: any) => String(e.label)));
  return {
    n: items.length,
    locale,
    spacy: { applied: l1.applied, fallback: l1.fallback },
    encoderStatus: sem.status,
    newLemmaLabels: l1.entries
      .slice(0, TOP)
      .map((e: any) => String(e.label))
      .filter((l: string) => !l0Labels.has(l)),
    variants: {
      L0: evaluate(items, l0.entries, 'LEXICAL'),
      L1: evaluate(items, l1.entries, 'LEXICAL'),
      T0: evaluate(items, t0, 'THEME'),
      T1: evaluate(items, t1, l1.applied === 'LEMMA' ? 'LEXICAL' : 'THEME'),
      S: evaluate(items, sem.entries, 'THEME'),
    },
  };
}

// ---------- Datensätze ----------
const SUBJ = [
  ['statistics', 'Statistik'],
  ['botany', 'Botanik'],
  ['history', 'Geschichte'],
  ['police', 'Polizeischule'],
] as const;
const subjects: Record<string, any> = {};
for (const [d] of SUBJ)
  subjects[d] = await sessionReport(
    ref.items.filter((i) => dom(i) === d && i.locale === 'de'),
    'de',
  );
const languages: Record<string, any> = {};
for (const l of ['de', 'en', 'fr', 'es'])
  languages[l] = await sessionReport(
    ref.items.filter((i) => dom(i) === 'statistics' && i.locale === l),
    l,
  );
// Sechs-Fragen-Szenario aus #456 §12 (Kontexttest); Familie = Anliegen nach 2A
const SCEN: Item[] = [
  ['A', 'Ü', 'Können wir mehr Beispiele zur linearen Regression bearbeiten?'],
  ['B', 'Ü', 'Gibt es ein weiteres Beispiel zur linearen Regression?'],
  ['C', 'P', 'Ist Kapitel 4 klausurrelevant?'],
  ['D', 'P', 'Müssen wir den vierten Abschnitt für die Prüfung lernen?'],
  ['E', 'K', 'Soll die Anwesenheit verpflichtend sein?'],
  ['F', 'K', 'Sollten wir eine Anwesenheitspflicht einführen?'],
].map(([id, family, text]) => ({ id, family, text, locale: 'de' }));
const scenario = await sessionReport(SCEN, 'de');

// ---------- Bericht ----------
const git = (c: string) => {
  try {
    return execSync(`git -C "${repo}" ${c}`, { encoding: 'utf8' }).trim();
  } catch {
    return 'n/a';
  }
};
const image = (() => {
  try {
    return execSync(`docker inspect --format "{{.Config.Image}} {{.Image}}" ${CONTAINER}`, {
      encoding: 'utf8',
    }).trim();
  } catch {
    return 'n/a';
  }
})();
const dockerOut = (cmd: string) => {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch {
    return 'n/a';
  }
};
const sidecarResources = {
  memoryAfterLoad: dockerOut(`docker stats --no-stream --format "{{.MemUsage}}" ${CONTAINER}`),
  imageSize: dockerOut('docker image ls arsnova-spacy:3.8.15 --format "{{.Size}}"'),
};
const manifest = {
  timestamp: new Date().toISOString(),
  // im Linux-Container ohne git: --commit/--describe vom Host übergeben
  commit: args.get('commit') ?? git('rev-parse HEAD'),
  describe: args.get('describe') ?? git('describe --tags --always --dirty'),
  node: process.version,
  platform: `${os.platform()} ${os.release()} ${os.arch()}`,
  cpu: `${os.cpus()[0]?.model} × ${os.cpus().length}`,
  reference: {
    path: refPath,
    version: ref.meta.version,
    sha256: createHash('sha256').update(refRaw).digest('hex'),
  },
  spacy: {
    sidecarMode: SIDECAR_MODE,
    runtime: shared.WORD_CLOUD_SPACY_RUNTIME_VERSION,
    models: shared.WORD_CLOUD_LEMMA_MODELS,
    container: image,
    resources: sidecarResources,
  },
  normalizationVersion: shared.WORD_CLOUD_NORMALIZATION_ANALYSIS_VERSION,
};
const dir = join(
  outRoot,
  `spacy-${SIDECAR_MODE === 'socket' ? 'socket-' : ''}${manifest.timestamp.replace(/[:.]/g, '-')}`,
);
mkdirSync(dir, { recursive: true });
writeFileSync(
  join(dir, 'results.json'),
  JSON.stringify({ manifest, subjects, languages, scenario, sidecarCalls }, null, 2) + '\n',
);

const VN: [string, string][] = [
  ['L0', '»Wörter« ohne spaCy'],
  ['L1', '»Wörter« mit spaCy'],
  ['T0', '»Wortgruppen« ohne spaCy'],
  ['T1', '»Wortgruppen« mit spaCy'],
  ['S', '»Themen« (Encoder)'],
];
const fmtPP = (x: number | null) => (x === null ? '–' : pct(x));
const table = (rows: [string, any][]) => {
  const L = [
    '| Sitzung | Variante | Themen-Quellen schlüssig | erreichbar (3 Quellen) | Top-12: Fragen abgedeckt | Top-12: Paare gleiches Anliegen |',
    '|---|---|---|---:|---:|---:|',
  ];
  for (const [name, s] of rows)
    for (const [k, label] of VN) {
      const v = s.variants[k];
      L.push(
        `| ${name} | ${k} ${label} | ${v.termCoherent} / ${v.termVisible} | ${pct(v.reachableShare)} | ${pct(v.top12Coverage)} | ${fmtPP(v.top12PairPrecision)} (${v.top12Pairs}) |`,
      );
    }
  return L;
};
const L: string[] = [
  '# Referat 2B – Lexikalische Baseline mit spaCy-Glättung im Kompass',
  '',
  `Commit \`${manifest.commit.slice(0, 12)}\` (${manifest.describe}), Referenzset ${ref.meta.version} (SHA-256 \`${manifest.reference.sha256.slice(0, 16)}…\`), ${manifest.timestamp}`,
  `${manifest.cpu}, Node ${manifest.node}. spaCy ${manifest.spacy.runtime}, Modelle ${Object.values(
    manifest.spacy.models,
  )
    .map((m: any) => m.id)
    .join(', ')}; Container \`${image}\`.`,
  '',
  '**Lesart:** _schlüssig_ = sichtbare Quelle mit ≥ 2 Fragen, davon ≥ 80 % ein Anliegen (Familie). _Erreichbar_ = Anteil aller Fragen hinter den drei sichtbaren Quellen. _Top-12_ = die zwölf größten Einträge der Wortwolke; _Paare gleiches Anliegen_ = Anteil der Fragenpaare, die sich einen Eintrag teilen und zum selben Anliegen gehören (in Klammern: Zahl der Paare).',
  '',
  '## 1. Fächer, deutsche Sitzung',
  '',
  ...table(SUBJ.map(([d, n]) => [n, subjects[d]])),
  '',
  '## 2. Sprachen (Statistik)',
  '',
  ...table(Object.entries(languages).map(([l, s]) => [l, s])),
  '',
  'spaCy angewandt: ' +
    Object.entries(languages)
      .map(
        ([l, s]: [string, any]) =>
          `${l} ${s.spacy.applied}${s.spacy.fallback ? ` (${s.spacy.fallback})` : ''}, Encoder ${s.encoderStatus}`,
      )
      .join(' · '),
  '',
  '## 3. Sechs-Fragen-Szenario aus #456 (Kontexttest)',
  '',
  ...table([['Szenario', scenario]]),
  '',
  ...VN.map(
    ([k, label]) =>
      `- ${k} ${label}: ${scenario.variants[k].visible.map((v: any) => `${v.label} (${v.n})`).join(' · ') || '–'}`,
  ),
  '',
  '## 4. Was spaCy an den Begriffen ändert',
  '',
  ...Object.entries({ ...Object.fromEntries(SUBJ.map(([d, n]) => [n, subjects[d]])), ...languages })
    .filter(([k]) => !['de'].includes(k))
    .map(
      ([n, s]: [string, any]) =>
        `- ${n}: neu in den Top-12 mit spaCy: ${s.newLemmaLabels.slice(0, 6).join(', ') || '–'}`,
    ),
  '',
  '## 5. Laufzeit und Ressourcen des Sidecars',
  '',
  `Image ${sidecarResources.imageSize}, Arbeitsspeicher nach der Messung ${sidecarResources.memoryAfterLoad}.`,
  '',
  '| Locale | Texte | Sidecar-Aufruf |',
  '|---|---:|---:|',
  ...sidecarCalls.map((c) => `| ${c.locale} | ${c.texts} | ${r1(c.ms)} ms |`),
  '',
  '## Gültigkeitsgrenzen',
  '',
  SIDECAR_MODE === 'socket'
    ? '- Sidecar über den Release-Client und den Unix-Socket (Linux-Node-Container mit gemeinsamem Socket-Volume); die Zeitangabe misst den Release-Client-Aufruf.'
    : '- Sidecar per `docker exec` statt über den Produktions-Socket; die Zeitangabe misst nur den HTTP-Aufruf im Container.',
  '- Kompass ohne Kategorien (8.9b aus), ohne Stimmen; Sortierung TOP; drei sichtbare Quellen wie im Release.',
  '- Top-12-Paarmaß ist ein Hilfsmaß für überlappende Wortwolken-Einträge, keine Partition (daher kein ARI).',
];
writeFileSync(join(dir, 'report.md'), L.join('\n') + '\n');
console.log(L.slice(7, 30).join('\n'));
console.log(`\nErgebnisse: ${dir}`);
