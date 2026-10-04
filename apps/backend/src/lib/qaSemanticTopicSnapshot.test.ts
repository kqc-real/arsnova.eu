import type { AnalyzeWordCloudOutput } from '@arsnova/shared-types';
import { describe, expect, it, vi } from 'vitest';
import type { WordCloudAnalysisCache } from './wordCloudAnalysisCache';
import {
  buildQaSemanticTopicSnapshot,
  hashQaSemanticTopicMemberText,
  QaSemanticTopicSnapshotSchema,
  recordLatestQaSemanticTopicSnapshot,
  type QaSemanticTopicSnapshotBuildInput,
} from './qaSemanticTopicSnapshot';

const firstQuestion = {
  id: '11111111-1111-4111-8111-111111111111',
  text: 'Wie funktioniert die erste vertrauliche Frage?',
  weight: 3,
} as const;
const secondQuestion = {
  id: '22222222-2222-4222-8222-222222222222',
  text: 'Die zweite vertrauliche Frage ist das Label',
  weight: 2,
} as const;

const analysis = {
  mode: 'SEMANTIC',
  locale: 'de',
  metric: 'BEST',
  generatedAt: '2026-10-04T10:00:00.000Z',
  fallbackUsed: false,
  normalization: 'NONE',
  normalizationApplied: 'NONE',
  normalizationFallbackUsed: false,
  normalizationFallbackReason: null,
  fallbackLocale: 'de',
  analysisVersion: '1.14c.4',
  modelId: 'intfloat/multilingual-e5-small',
  snapshotHash: 'a'.repeat(64),
  status: 'ready',
  modelVersion: 'sha256:test-model',
  entries: [
    {
      key: `semantic-0-${firstQuestion.id}`,
      label: secondQuestion.text,
      count: 5,
      basisLabel: secondQuestion.text,
      members: [
        { sourceId: secondQuestion.id, text: secondQuestion.text, weight: 2 },
        { sourceId: firstQuestion.id, text: firstQuestion.text, weight: 3 },
      ],
      variants: [firstQuestion.text, secondQuestion.text],
      confidence: 0.91,
    },
  ],
} as const satisfies AnalyzeWordCloudOutput;

const buildInput = {
  request: { mode: 'SEMANTIC', filter: 'ALL_ELIGIBLE', metric: 'BEST' },
  analysis,
  corpusRevision: 'ranking-revision-7',
  eligibleQuestionCount: 4,
  corpusItems: [firstQuestion, secondQuestion],
} as const satisfies QaSemanticTopicSnapshotBuildInput;

function createCacheMock() {
  return {
    getText: vi.fn(async () => null),
    setText: vi.fn(async () => undefined),
    getSnapshot: vi.fn(async () => null),
    setSnapshot: vi.fn(async () => undefined),
    getLatestQaSemanticTopicSnapshot: vi.fn(async () => null),
    setLatestQaSemanticTopicSnapshot: vi.fn(async () => undefined),
  } satisfies WordCloudAnalysisCache;
}

describe('qaSemanticTopicSnapshot', () => {
  it('speichert vollständige Membership, Text-Digests und die extraktive Labelquelle ohne Rohtexte', () => {
    const snapshot = buildQaSemanticTopicSnapshot(buildInput);

    expect(snapshot).not.toBeNull();
    expect(snapshot?.topics).toEqual([
      {
        topicId: expect.stringMatching(/^[a-f0-9]{64}$/),
        confidence: 0.91,
        labelSourceQuestionId: secondQuestion.id,
        members: [
          {
            questionId: firstQuestion.id,
            textDigest: hashQaSemanticTopicMemberText(firstQuestion.text),
          },
          {
            questionId: secondQuestion.id,
            textDigest: hashQaSemanticTopicMemberText(secondQuestion.text),
          },
        ],
      },
    ]);
    expect(snapshot).toMatchObject({
      status: 'ready',
      metric: 'BEST',
      corpusRevision: 'ranking-revision-7',
      eligibleQuestionCount: 4,
      analyzedQuestionCount: 2,
    });
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain(firstQuestion.text);
    expect(serialized).not.toContain(secondQuestion.text);
    expect(QaSemanticTopicSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it('bildet topicId und Membership unabhängig von der Member-Reihenfolge stabil', () => {
    const first = buildQaSemanticTopicSnapshot(buildInput);
    const reordered = buildQaSemanticTopicSnapshot({
      ...buildInput,
      analysis: {
        ...analysis,
        entries: [{ ...analysis.entries[0], members: [...analysis.entries[0].members].reverse() }],
      },
    });

    expect(reordered?.topics).toEqual(first?.topics);
  });

  it.each([
    ['lexikalischer Auftrag', { request: { ...buildInput.request, mode: 'LEXICAL' as const } }],
    ['Pinned-only-Auftrag', { request: { ...buildInput.request, filter: 'PINNED_ONLY' as const } }],
    ['Fallback-Ergebnis', { analysis: { ...analysis, status: 'fallback' as const } }],
    ['fehlgeschlagenes Ergebnis', { analysis: { ...analysis, status: 'failed' as const } }],
    ['inkonsistente Metrik', { analysis: { ...analysis, metric: 'TOP' as const } }],
    [
      'kompaktierte Membership',
      {
        analysis: {
          ...analysis,
          entries: [
            {
              ...analysis.entries[0],
              members: [analysis.entries[0].members[0]],
              memberCount: 2,
              membersTruncated: true,
            },
          ],
        },
      },
    ],
    [
      'nicht-extraktives Label',
      {
        analysis: {
          ...analysis,
          entries: [{ ...analysis.entries[0], label: 'Erfunden', basisLabel: 'Erfunden' }],
        },
      },
    ],
    [
      'abweichender aktueller Text',
      {
        corpusItems: [{ ...firstQuestion, text: 'Nachträglich geändert' }, secondQuestion],
      },
    ],
    [
      'für den Themenvertrag zu lange Modellkennung',
      { analysis: { ...analysis, modelId: 'm'.repeat(121) } },
    ],
    [
      'für den Themenvertrag zu lange Modellversion',
      { analysis: { ...analysis, modelVersion: 'v'.repeat(121) } },
    ],
  ])('verwirft %s statt einen unvollständigen Latest-Snapshot zu speichern', (_name, change) => {
    expect(buildQaSemanticTopicSnapshot({ ...buildInput, ...change })).toBeNull();
  });

  it('akzeptiert uncertain als semantischen Analysezustand', () => {
    expect(
      buildQaSemanticTopicSnapshot({
        ...buildInput,
        analysis: { ...analysis, status: 'uncertain' },
      }),
    ).toMatchObject({ status: 'uncertain' });
  });

  it('verwirft einen Cachewert, dessen Membership den analysierten Korpus übersteigt', () => {
    const snapshot = buildQaSemanticTopicSnapshot(buildInput);
    if (!snapshot) throw new Error('snapshot unavailable');
    expect(
      QaSemanticTopicSnapshotSchema.safeParse({
        ...snapshot,
        analyzedQuestionCount: 1,
      }).success,
    ).toBe(false);
  });

  it('recorded nur geeignete ALL_ELIGIBLE-Semantik und übergibt denselben Session-Scope', async () => {
    const cache = createCacheMock();
    const scope = { sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } as const;

    const recorded = await recordLatestQaSemanticTopicSnapshot({
      cache,
      scope,
      ...buildInput,
    });
    const skipped = await recordLatestQaSemanticTopicSnapshot({
      cache,
      scope,
      ...buildInput,
      request: { ...buildInput.request, filter: 'PINNED_ONLY' },
    });

    expect(recorded).not.toBeNull();
    expect(skipped).toBeNull();
    expect(cache.setLatestQaSemanticTopicSnapshot).toHaveBeenCalledOnce();
    expect(cache.setLatestQaSemanticTopicSnapshot).toHaveBeenCalledWith(recorded, scope);
  });
});
