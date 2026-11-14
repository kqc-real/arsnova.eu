#!/usr/bin/env tsx
/**
 * Referat 2B – Kontexttest mit dem gemeinsamen Sechs-Fragen-Szenario aus #456 §12
 * (Fixture libs/shared-types/src/moderation-prompt-context-fixtures.ts, wie in 2A verwendet).
 *
 * Kein Gütenachweis (dafür dient das Referenzset): Der Kursrahmen erlaubt die Paare A/B, C/D, E/F
 * nur als Kontexttest. Gezeigt wird, was 8.9b und der echte Encoder für genau diese sechs Fragen
 * liefern und was dadurch im Kompass (Varianten V0–V3) ankommt, bewertet mit der 2A-Rubrik
 * (D1–D5, Regeln unten im Skript).
 *
 * Aufruf aus dem Repo-Root (Encoder-Container wie in measure-topics.mts):
 *   npx tsx docs/didaktik/referate/2b-kategorien-semantische-themen/check-group-scenario.mts [--url http://127.0.0.1:8790/embed] [--out docs/didaktik/referate/2b-kategorien-semantische-themen/results]
 */
import { execSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2)
  args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const repo = resolve(args.get('repo') ?? '.');
const URL_ = args.get('url') ?? 'http://127.0.0.1:8790/embed';
const lib = (n: string) =>
  import(pathToFileURL(join(repo, 'apps/backend/src/lib', `${n}.ts`)).href);
const shared = await import(pathToFileURL(join(repo, 'libs/shared-types/src/index.ts')).href);
const compass = await import(
  pathToFileURL(
    join(repo, 'apps/frontend/src/app/features/session/session-host/moderation-compass.ts'),
  ).href
);
const [workerMod, snapMod, analyzeMod, normMod] = await Promise.all([
  lib('qaNlpWorker'),
  lib('qaNlpSnapshot'),
  lib('wordCloudSemanticAnalyze'),
  lib('wordCloudNormalization'),
]);

// Texte wie in der Fixture (#456 §12); Anliegen nach 2A-Rubrik: Ü Übungswunsch, P Prüfung, K geteilte Bewertung
const S = [
  { k: 'A', g: 'Ü', text: 'Können wir mehr Beispiele zur linearen Regression bearbeiten?' },
  { k: 'B', g: 'Ü', text: 'Gibt es ein weiteres Beispiel zur linearen Regression?' },
  { k: 'C', g: 'P', text: 'Ist Kapitel 4 klausurrelevant?' },
  { k: 'D', g: 'P', text: 'Müssen wir den vierten Abschnitt für die Prüfung lernen?' },
  { k: 'E', g: 'K', text: 'Soll die Anwesenheit verpflichtend sein?' },
  { k: 'F', g: 'K', text: 'Sollten wir eine Anwesenheitspflicht einführen?' },
];

console.log('8.9b je Frage:');
const nlp = new Map<string, any>();
for (const q of S) {
  const r = await workerMod.runQaNlpClassifier(snapMod.buildQaNlpAnalysisSnapshot(q.text));
  nlp.set(q.k, r);
  console.log(
    `  ${q.k} (${q.g})  ${r.status.padEnd(10)} ${String(r.category ?? '–').padEnd(12)} ${r.confidence?.toFixed(3) ?? ''}  ${q.text}`,
  );
}

const items = S.map((q) => ({ id: q.k, text: q.text, weight: 1 }));
const run = async (mode: 'THEME' | 'SEMANTIC') => {
  const input = shared.AnalyzeWordCloudInputSchema.parse({
    sessionCode: 'REF2BS',
    mode,
    locale: 'de',
    metric: 'TOP',
    channel: 'QA',
    normalization: 'NONE',
    items,
  });
  if (mode === 'THEME')
    return { status: 'lexical', entries: analyzeMod.buildLexicalSemanticFallbackEntries(input) };
  analyzeMod.resetWordCloudSemanticAnalyzeForTests();
  const meta = normMod.resolveWordCloudNormalizationMeta(input);
  return analyzeMod.analyzeSemanticWordCloudSnapshot(input, meta, {
    sessionId: randomUUID(),
    env: {
      ...process.env,
      WORD_CLOUD_SEMANTIC_ENABLED: 'true',
      WORD_CLOUD_ENCODER_URL: URL_,
      WORD_CLOUD_ENCODER_SOCKET_PATH: '',
    },
  });
};
const members = (e: any) =>
  (e.members ?? []).map((m: any) => String(m.sourceId).split(':').pop()).join('');
for (const mode of ['THEME', 'SEMANTIC'] as const) {
  const out: any = await run(mode);
  console.log(
    `\nWortwolke ${mode === 'THEME' ? '»Wortgruppen« (lexikalisch)' : '»Themen« (Encoder)'}: status ${out.status}${out.fallbackUsed ? ', Fallback' : ''}`,
  );
  for (const e of out.entries)
    console.log(`  ${String(e.label).slice(0, 60).padEnd(60)} Mitglieder ${members(e)}`);
}

// Encoder-Paare direkt: Kosinus-Ähnlichkeit der Paare gegen Schwelle 0,87
const client = await lib('wordCloudEncoderClient');
const emb = await client.embedWithWordCloudEncoder(
  {
    locale: 'de',
    snapshotHash: createHash('sha256').update(randomUUID()).digest('hex'),
    items: S.map((q) => ({ id: q.k, text: q.text })),
  },
  {
    enabled: true,
    socketPath: '',
    inferenceUrl: URL_,
    inferenceToken: null,
    timeoutMs: 60000,
    cacheTtlSeconds: 60,
  },
);
const v = new Map(emb.items.map((x: any) => [x.id, x.embedding as number[]]));
const cos = (a: number[], b: number[]) =>
  a.reduce((s, x, i) => s + x * b[i], 0) /
  Math.sqrt(a.reduce((s, x) => s + x * x, 0) * b.reduce((s, x) => s + x * x, 0));
console.log(`\nKosinus je Paar (Schwelle ${shared.WORD_CLOUD_SEMANTIC_COSINE_THRESHOLD}):`);
for (const [a, b] of [
  ['A', 'B'],
  ['C', 'D'],
  ['E', 'F'],
  ['A', 'C'],
  ['C', 'E'],
])
  console.log(`  ${a}–${b} ${cos(v.get(a)!, v.get(b)!).toFixed(3)}`);

// ---------- Kompass V0–V3 wie in measure-compass.mts ----------
// V0/V1 nutzen die lexikalische Wortwolke (»Wortgruppen«), V2/V3 die Encoder-Themen (»Themen«).
const LABELS = {
  content: 'Inhaltliche Fragen',
  organization: 'Fragen zum Ablauf',
  technical: 'Technische Fragen',
};
const STATUS_TEXT: Record<string, string> = {
  disabled: 'Die automatische Sortierung der Fragen ist aus.',
  pending: 'Die Fragen werden gerade geordnet.',
  uncertain: 'Einige Fragen konnten nicht eindeutig zugeordnet werden.',
  failed: 'Die Fragen können gerade nicht automatisch geordnet werden.',
  classified: 'Die Fragen sind nach Inhalt, Organisation und Technik geordnet.',
};
const VISIBLE: number = shared.MODERATION_COMPASS_VISIBLE_SOURCE_COUNT;
const ANLIEGEN = new Map(S.map((q) => [q.k, q.g]));
const lexical: any = await run('THEME');
const encoder: any = await run('SEMANTIC');
const idsOf = (src: any, entries: any[]): string[] => {
  if (src.target?.questionIds?.length) return src.target.questionIds;
  const term = src.target?.termLabel ?? src.label;
  const e = entries.find((x: any) => x.label === term || String(x.label).startsWith(term));
  return (e?.members ?? [])
    .map((m: any) => String(m.sourceId).split(':').pop())
    .filter((id: string) => ANLIEGEN.has(id));
};
const VARIANTS = [
  { id: 'V0', name: '2B aus (Regelkern, »Wortgruppen«)', cat: false, enc: false },
  { id: 'V1', name: '+ Kategorien (8.9b)', cat: true, enc: false },
  { id: 'V2', name: '+ Encoder-Themen (1.14c)', cat: false, enc: true },
  { id: 'V3', name: '+ beides', cat: true, enc: true },
];
const rows: any[] = [];
for (const variant of VARIANTS) {
  const entries = variant.enc ? encoder.entries : lexical.entries;
  const qs = S.map((q) => ({
    id: q.k,
    text: q.text,
    status: 'ACTIVE' as const,
    ...(variant.cat ? { nlp: nlp.get(q.k) } : {}),
  }));
  const view = compass.buildModerationCompassView({
    qaQuestions: qs,
    qaSortMode: 'TOP',
    qaTerms:
      compass.compassTermsFromAnalysisEntries(entries, {
        sortMode: 'TOP',
        analysisVariant: 'THEME',
      }) ?? [],
    freetextTerms: [],
    extraTopicSources: [],
    nlpTopicSources: variant.cat ? compass.collectQaNlpCategorySources(qs, LABELS) : [],
    topicWeightLabel: null,
    tempo: null,
    quizSources: [],
    quizInsightKind: null,
  });
  const mode = shared.resolveModerationCompassAnalysisMode({
    enabled: variant.cat,
    statuses: variant.cat ? S.map((q) => nlp.get(q.k).status) : [],
  });
  const card = view.cards.find((c: any) => c.kind === 'topics');
  const visible = (card?.sources ?? []).slice(0, VISIBLE).map((src: any) => {
    const ids = idsOf(src, entries);
    return {
      label: String(src.label),
      ids,
      anliegen: [...new Set(ids.map((id) => ANLIEGEN.get(id)))],
    };
  });
  const reach = new Set(visible.flatMap((x: any) => x.ids));
  const missing = S.map((q) => q.k).filter((k) => !reach.has(k));
  const anliegenSeen = new Set(visible.flatMap((x: any) => x.anliegen));
  const mixed = visible.filter((x: any) => x.anliegen.length > 1).length;
  // Rubrik nach 2A (0–2 je Kriterium); Regeln mechanisch, damit nachrechenbar:
  // D1 Quellen: 2 = jede sichtbare Quelle führt zu ihren Fragen, 1 = nur teilweise, 0 = keine Quelle
  // D2 Bewertung: keine 2B-Funktion (Kategorien/Themen ignorieren Stimmen) → nicht bewertet
  // D3 Trennung: 2 = keine sichtbare Quelle mischt Anliegen, 1 = teils gemischt, 0 = nur gemischt/keine
  // D4 Lücken: 2 = alle Fragen erreichbar oder Statuszeile meldet Unsicherheit/Ausfall, sonst 0
  // D5 Umfang: Anliegen (Ü/P/K) über sichtbare Quellen erreichbar: 3 → 2, 2 → 1, ≤ 1 → 0
  const d1 = !visible.length ? 0 : visible.every((x: any) => x.ids.length) ? 2 : 1;
  const d3 = !visible.length ? 0 : mixed === 0 ? 2 : mixed < visible.length ? 1 : 0;
  const d4 = !missing.length || ['uncertain', 'failed', 'pending'].includes(mode) ? 2 : 0;
  const d5 = anliegenSeen.size >= 3 ? 2 : anliegenSeen.size === 2 ? 1 : 0;
  rows.push({
    id: variant.id,
    name: variant.name,
    mode,
    status: variant.cat ? STATUS_TEXT[mode] : '(Sortierung aus)',
    visible,
    missing,
    next: view.actionRecommendation,
    rubric: { D1: d1, D2: null, D3: d3, D4: d4, D5: d5, sum: d1 + d3 + d4 + d5 },
  });
}

const L: string[] = [
  '',
  `## Kompass, Karte »Häufige Themen« (sichtbar ${VISIBLE} Quellen)`,
  '',
  '| Variante | Statuszeile | sichtbare Quellen → Fragen | nicht erreichbar | »Als Nächstes« | D1 | D2 | D3 | D4 | D5 | Summe (max. 8) |',
  '|---|---|---|---|---|---:|---:|---:|---:|---:|---:|',
];
for (const r of rows)
  L.push(
    `| ${r.id} ${r.name} | ${r.status} | ${r.visible.map((x: any) => `${x.label.replace(/\|/g, '/')} → ${x.ids.join(', ')}`).join('<br>') || '–'} | ${r.missing.join(', ') || '–'} | ${r.next ?? '–'} | ${r.rubric.D1} | – | ${r.rubric.D3} | ${r.rubric.D4} | ${r.rubric.D5} | ${r.rubric.sum} |`,
  );
L.push(
  '',
  'Rubrik nach 2A (D1 Quellenbindung, D2 Bedeutung der Bewertungen, D3 Trennung von Übungswunsch Ü, Prüfungsorganisation P und Kontroverse K, D4 Kennzeichnung von Lücken, D5 sichtbare Anliegen), je 0–2. D2 wird nicht bewertet: Kategorien und Themen ignorieren Stimmen, deren Deutung bleibt beim Regelkern (2A). Die Bewertungsregeln stehen mechanisch im Skript (`check-group-scenario.mts`). Bewertet wird nur die Karte »Häufige Themen«, die 2B speist; Stimmen sind nicht gesetzt.',
);
console.log(L.join('\n'));

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
  encoderUrl: URL_,
  fixture: 'libs/shared-types/src/moderation-prompt-context-fixtures.ts (#456 §12)',
};
const outRoot = resolve(
  args.get('out') ?? join(repo, 'docs/didaktik/referate/2b-kategorien-semantische-themen/results'),
);
const dir = join(outRoot, `group-scenario-${manifest.timestamp.replace(/[:.]/g, '-')}`);
mkdirSync(dir, { recursive: true });
const pairs = Object.fromEntries(
  [
    ['A', 'B'],
    ['C', 'D'],
    ['E', 'F'],
    ['A', 'C'],
    ['C', 'E'],
  ].map(([a, b]) => [`${a}–${b}`, +cos(v.get(a)!, v.get(b)!).toFixed(3)]),
);
writeFileSync(
  join(dir, 'results.json'),
  JSON.stringify(
    {
      manifest,
      nlp: Object.fromEntries(
        [...nlp].map(([k, r]) => [
          k,
          { status: r.status, category: r.category, confidence: r.confidence },
        ]),
      ),
      lexical: lexical.entries.map((e: any) => ({ label: e.label, members: members(e) })),
      encoder: {
        status: encoder.status,
        entries: encoder.entries.map((e: any) => ({ label: e.label, members: members(e) })),
      },
      cosine: pairs,
      variants: rows,
    },
    null,
    2,
  ) + '\n',
);
const H: string[] = [
  '# Referat 2B – Kontexttest: Sechs-Fragen-Szenario (#456 §12) im Kompass',
  '',
  `Commit \`${manifest.commit.slice(0, 12)}\` (${manifest.describe}), ${manifest.timestamp}. Kein Gütenachweis (dafür dient das Referenzset); die Paare A/B, C/D, E/F dienen laut Kursrahmen nur als Kontexttest. Anliegen nach 2A: Ü Übungswunsch, P Prüfungsorganisation, K Kontroverse.`,
  '',
  '## 8.9b je Frage',
  '',
  '| Frage | Anliegen | Status | Kategorie | Konfidenz | Text |',
  '|---|---|---|---|---:|---|',
  ...S.map((q) => {
    const r = nlp.get(q.k);
    return `| ${q.k} | ${q.g} | ${r.status} | ${r.category ?? '–'} | ${r.confidence?.toFixed(3) ?? ''} | ${q.text} |`;
  }),
  '',
  '## Wortwolke',
  '',
  `- »Wortgruppen« (lexikalisch): ${lexical.entries.map((e: any) => `${e.label} (${members(e)})`).join(' · ')}`,
  `- »Themen« (Encoder, Status ${encoder.status}): ${encoder.entries.map((e: any) => members(e)).join(' · ')}`,
  `- Kosinus (Schwelle ${shared.WORD_CLOUD_SEMANTIC_COSINE_THRESHOLD}): ${Object.entries(pairs)
    .map(([k, x]) => `${k} ${x}`)
    .join(' · ')}`,
];
writeFileSync(join(dir, 'report.md'), [...H, ...L].join('\n') + '\n');
console.log(`\nErgebnisse: ${dir}`);
