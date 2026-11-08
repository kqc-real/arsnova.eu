import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  MODERATION_ANALYSIS_CONTEXT_CONTRACT_VERSION,
  MODERATION_PROMPT_CONTEXT_METADATA_FIXTURE_V1,
  ModerationAnalysisContextV1Schema,
  OpenWeightLlmOutputSchema,
} from '@arsnova/shared-types';
import { canonicalModerationPromptJson } from './moderationPromptContextPacking';
import {
  prepareModerationSummaryContextFromAnalysis,
  resolveQaSummaryAdapterPlan,
} from './moderationSummaryContext';
import { hasAcceptableQaSummaryQuality } from './qaSummaryQuality';

type Question = { id: string; text: string };
const root = '/design';
const evidence = '/evidence';
const at = new Date('2026-01-15T10:05:00Z');
const read = (path: string) => readFileSync(path, 'utf8');
const save = (name: string, data: unknown) =>
  writeFileSync(evidence + '/' + name, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });

function buildSnapshot(questions: Question[]) {
  const base = MODERATION_PROMPT_CONTEXT_METADATA_FIXTURE_V1.context;
  const size = questions.length;
  return ModerationAnalysisContextV1Schema.parse({
    schemaVersion: 1,
    contractVersion: MODERATION_ANALYSIS_CONTEXT_CONTRACT_VERSION,
    assembledAt: at.toISOString(),
    context: {
      ...base,
      representation: 'analysis-candidates',
      meta: { ...base.meta, sourceRevision: 'direkt-12-v1' },
      questions: {
        ...base.questions,
        corpus: {
          total: size,
          eligible: size,
          analyzed: size,
          deduplicated: size,
          represented: size,
        },
        items: questions.map(({ id }) => ({
          sourceId: id,
          status: 'ACTIVE',
          answerState: { state: id.endsWith('003') ? 'addressed' : 'unaddressed' },
          votes: { state: 'unavailable', reason: 'not-collected' },
          nlp: { state: 'disabled', reason: 'nicht erhoben' },
          topicSourceIds: [],
        })),
      },
      sources: questions.map(({ id, text }) => ({
        id,
        kind: 'qa-question',
        content: { state: 'included', text, truncated: false },
      })),
    },
  });
}

it('vergleicht die vom Backend ausgewählten Fragen mit der vollständigen freigegebenen Liste', () => {
  const all: Question[] = JSON.parse(read(root + '/fragen.json'));
  expect(all).toHaveLength(12);
  expect(new Set(all.map((q) => q.id)).size).toBe(all.length);
  const analysis = buildSnapshot(all);
  const prepared = prepareModerationSummaryContextFromAnalysis({
    analysis,
    packedAt: at,
    plan: {
      ...resolveQaSummaryAdapterPlan(),
      selectedMode: 'full-context',
      inferenceConfigured: true,
      fallback: null,
    },
  });
  const selected = prepared.request.promptContext.context.sources.flatMap((source) =>
    source.kind === 'qa-question' && source.content.state === 'included'
      ? [{ id: source.id, text: source.content.text }]
      : [],
  );
  expect(selected.length).toBeGreaterThan(0);
  expect(selected.length).toBeLessThan(all.length);
  const ids = new Set(selected.map((q) => q.id));
  expect(selected).toEqual(all.filter((q) => ids.has(q.id)));

  // Wire-Vorlage aus demselben Anwendungsexport. Beide Arme ersetzen nur Texte und zulässige IDs.
  const archived = read('/vorlage/rohdaten-1024.jsonl')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  const template = archived.find((item) => item.file === 'request-S6-B.json').data;
  expect(template.messages.slice(0, 2)).toEqual([
    { role: 'system', content: prepared.request.instructionText },
    { role: 'system', content: prepared.request.definitionText },
  ]);
  expect(template).toMatchObject({
    max_tokens: 1024,
    temperature: 0,
    seed: 456,
    cache_prompt: false,
    stream: true,
  });
  save('snapshot.json', analysis);
  save('auswahl.json', prepared.request.promptContext);
  for (const [arm, questions] of Object.entries({ auswahl: selected, alle: all })) {
    const body = structuredClone(template);
    body.messages[2].content = canonicalModerationPromptJson(questions);
    const grammar = body.response_format.schema.properties.output.properties;
    for (const section of ['statements', 'suggestedNextSteps']) {
      grammar[section].items.properties.sourceIds.items.enum = questions.map((q) => q.id);
    }
    save('request-' + arm + '.json', body);
  }
  const names = [
    'fragen.json',
    'versuchsplan.md',
    'messen.py',
    'quellenauswahl.test.ts',
    'starten.sh',
  ];
  save(
    'design-sha256.json',
    Object.fromEntries(
      names.map((name) => [
        name,
        createHash('sha256')
          .update(read(root + '/' + name))
          .digest('hex'),
      ]),
    ),
  );
  if (process.env.ONLY_PACK === '1') return;

  execFileSync('python3', [root + '/messen.py'], { stdio: 'inherit', timeout: 700_000 });
  const runs = read(evidence + '/messungen.jsonl')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  expect(runs).toHaveLength(10);
  const validations = runs.map((run) => {
    let content: unknown;
    try {
      content = JSON.parse(run.raw);
    } catch {
      return { id: run.id, json: false, schema: false, ids: null, form: null };
    }
    const parsed = OpenWeightLlmOutputSchema.safeParse(content);
    if (
      !parsed.success ||
      parsed.data.taskType !== 'qa_summary' ||
      parsed.data.schemaVersion !== 2
    ) {
      return { id: run.id, json: true, schema: false, ids: null, form: null };
    }
    const output = parsed.data.output;
    const allowed = new Set((run.arm === 'alle' ? all : selected).map((q) => q.id));
    return {
      id: run.id,
      json: true,
      schema: true,
      ids: [...output.statements, ...output.suggestedNextSteps].every((s) =>
        s.sourceIds.every((id) => allowed.has(id)),
      ),
      form: hasAcceptableQaSummaryQuality(output, 'de'),
      status: output.status,
    };
  });
  save('validierung.json', validations);
}, 735_000);
