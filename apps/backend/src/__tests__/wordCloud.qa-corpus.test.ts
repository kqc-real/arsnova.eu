import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';

const {
  acquireQaWordCloudAnalysisLockMock,
  analyzeSemanticWordCloudSnapshotMock,
  extractHostTokenFromContextMock,
  isHostSessionTokenValidMock,
  prismaMock,
  wordCloudCacheMocks,
} = vi.hoisted(() => ({
  acquireQaWordCloudAnalysisLockMock: vi.fn(),
  analyzeSemanticWordCloudSnapshotMock: vi.fn(),
  extractHostTokenFromContextMock: vi.fn(),
  isHostSessionTokenValidMock: vi.fn(),
  prismaMock: {
    $queryRaw: vi.fn(),
    participant: { count: vi.fn() },
    session: { findUnique: vi.fn() },
  },
  wordCloudCacheMocks: {
    getSnapshot: vi.fn().mockResolvedValue(null),
    setSnapshot: vi.fn().mockResolvedValue(undefined),
    getLatestQaSemanticTopicSnapshot: vi.fn().mockResolvedValue(null),
    setLatestQaSemanticTopicSnapshot: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../db', () => ({ prisma: prismaMock }));
vi.mock('../lib/hostAuth', () => ({
  extractHostTokenFromContext: extractHostTokenFromContextMock,
  isHostSessionTokenValid: isHostSessionTokenValidMock,
}));
vi.mock('../lib/qaWordCloudAnalysisLock', () => ({
  acquireQaWordCloudAnalysisLock: acquireQaWordCloudAnalysisLockMock,
}));
vi.mock('../lib/wordCloudSemanticAnalyze', () => ({
  analyzeSemanticWordCloudSnapshot: analyzeSemanticWordCloudSnapshotMock,
}));
vi.mock('../lib/wordCloudAnalysisCache', () => ({
  getWordCloudAnalysisCache: () => ({
    getSnapshot: wordCloudCacheMocks.getSnapshot,
    setSnapshot: wordCloudCacheMocks.setSnapshot,
    getText: vi.fn().mockResolvedValue(null),
    setText: vi.fn().mockResolvedValue(undefined),
    getLatestQaSemanticTopicSnapshot: wordCloudCacheMocks.getLatestQaSemanticTopicSnapshot,
    setLatestQaSemanticTopicSnapshot: wordCloudCacheMocks.setLatestQaSemanticTopicSnapshot,
  }),
}));

import { wordCloudRouter } from '../routers/wordCloud';

const caller = wordCloudRouter.createCaller({ req: {} as never });

function flattenSql(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(flattenSql).join('');
  }
  if (value && typeof value === 'object') {
    return flattenSql(Object.values(value));
  }
  return String(value ?? '');
}

function corpusRows(returnedCount: number, eligibleCount: number) {
  return Array.from({ length: returnedCount }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    text: `Skalierungsfrage ${index + 1}`,
    upvoteCount: returnedCount - index,
    positiveVoteCount: returnedCount - index,
    negativeVoteCount: 0,
    createdAt: new Date(1_700_000_000_000 + index),
    bestScore: 0.5,
    controversyScore: 0,
    eligibleCount,
  }));
}

describe('wordCloud.analyzeQa – kanonisch begrenzter Korpus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    extractHostTokenFromContextMock.mockReturnValue('host-token');
    isHostSessionTokenValidMock.mockResolvedValue(true);
    acquireQaWordCloudAnalysisLockMock.mockResolvedValue(async () => undefined);
    prismaMock.session.findUnique.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      qaRankingRevision: 17,
    });
    prismaMock.participant.count.mockResolvedValue(2_500);
  });

  for (const eligibleCount of [0, 499, 500, 501, 25_000]) {
    it(`analysiert bei ${eligibleCount} berechtigten Fragen exakt min(500, Bestand)`, async () => {
      const returnedCount = Math.min(500, eligibleCount);
      prismaMock.$queryRaw.mockResolvedValue(corpusRows(returnedCount, eligibleCount));

      const result = await caller.analyzeQa({
        sessionCode: 'ABC123',
        mode: 'LEXICAL',
        locale: 'de',
        metric: 'TOP',
        filter: 'ALL_ELIGIBLE',
        normalization: 'NONE',
        maxEntries: 40,
        limit: 500,
      });

      expect(result.eligibleQuestionCount).toBe(eligibleCount);
      expect(result.analyzedQuestionCount).toBe(returnedCount);
      expect(result.sortMode).toBe('TOP');
      expect(result.filter).toBe('ALL_ELIGIBLE');
      expect(prismaMock.$queryRaw.mock.calls[0]?.slice(1)).toContain(500);
      const corpusSql = flattenSql(prismaMock.$queryRaw.mock.calls[0]);
      expect(corpusSql).toContain('END AS "bestScore"');
      expect(corpusSql).toContain('END AS "controversyScore"');
      expect(corpusSql).toContain('ranked."upvoteCount" DESC');
      expect(result.entries.length).toBeLessThanOrEqual(80);
      expect(
        Math.max(0, ...result.entries.map((entry) => entry.members.length)),
      ).toBeLessThanOrEqual(1);
      expect(Buffer.byteLength(JSON.stringify(result), 'utf8')).toBeLessThanOrEqual(256 * 1024);
      expect(wordCloudCacheMocks.getSnapshot).toHaveBeenCalledWith(expect.anything(), {
        sessionId: '11111111-1111-4111-8111-111111111111',
      });
      expect(wordCloudCacheMocks.setSnapshot).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { sessionId: '11111111-1111-4111-8111-111111111111' },
      );
      if (returnedCount === 500) {
        expect(result.entries.some((entry) => entry.membersTruncated)).toBe(true);
        expect(Math.max(...result.entries.map((entry) => entry.memberCount))).toBe(500);
      }
    });
  }

  it('begrenzt den Korpus auf die Host-Forum-Seitengröße 100', async () => {
    prismaMock.$queryRaw.mockResolvedValue(corpusRows(100, 250));

    const result = await caller.analyzeQa({
      sessionCode: 'ABC123',
      mode: 'LEXICAL',
      locale: 'de',
      metric: 'TOP',
      filter: 'ALL_ELIGIBLE',
      normalization: 'NONE',
      maxEntries: 40,
      limit: 100,
    });

    expect(result.eligibleQuestionCount).toBe(250);
    expect(result.analyzedQuestionCount).toBe(100);
    expect(prismaMock.$queryRaw.mock.calls[0]?.slice(1)).toContain(100);
  });

  it('wertet bei TIME alle berechtigten Fragen gleich und sortiert nach createdAt', async () => {
    prismaMock.$queryRaw.mockResolvedValue(corpusRows(120, 120));

    const result = await caller.analyzeQa({
      sessionCode: 'ABC123',
      mode: 'LEXICAL',
      locale: 'de',
      metric: 'TIME',
      filter: 'ALL_ELIGIBLE',
      normalization: 'NONE',
      maxEntries: 40,
      limit: 500,
    });

    expect(result.eligibleQuestionCount).toBe(120);
    expect(result.analyzedQuestionCount).toBe(120);
    expect(result.sortMode).toBe('TIME');
    const corpusSql = flattenSql(prismaMock.$queryRaw.mock.calls[0]);
    expect(corpusSql).toContain('ranked."createdAt" DESC');
    expect(corpusSql).not.toContain('ranked."upvoteCount" DESC');
  });

  it('speichert nur intern die vollständige Membership eines frischen semantischen Ergebnisses', async () => {
    const corpus = corpusRows(2, 2);
    prismaMock.$queryRaw.mockResolvedValue(corpus);
    analyzeSemanticWordCloudSnapshotMock.mockResolvedValue({
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
          key: 'semantic-topic',
          label: corpus[1]!.text,
          count: 2,
          basisLabel: corpus[1]!.text,
          members: corpus.map((question) => ({
            sourceId: question.id,
            text: question.text,
            weight: 1,
          })),
          variants: corpus.map((question) => question.text),
          confidence: 0.9,
        },
      ],
    });

    const result = await caller.analyzeQa({
      sessionCode: 'ABC123',
      mode: 'SEMANTIC',
      locale: 'de',
      metric: 'BEST',
      filter: 'ALL_ELIGIBLE',
      normalization: 'NONE',
      maxEntries: 40,
      limit: 500,
    });

    expect(result.entries[0]).toMatchObject({ memberCount: 2, membersTruncated: true });
    expect(result.entries[0]?.members).toHaveLength(1);
    expect(wordCloudCacheMocks.setLatestQaSemanticTopicSnapshot).toHaveBeenCalledOnce();
    const [latest, scope] = wordCloudCacheMocks.setLatestQaSemanticTopicSnapshot.mock.calls[0]!;
    expect(scope).toEqual({ sessionId: '11111111-1111-4111-8111-111111111111' });
    expect(latest.topics[0]?.members).toHaveLength(2);
    expect(JSON.stringify(latest)).not.toContain(corpus[0]!.text);
    expect(JSON.stringify(latest)).not.toContain(corpus[1]!.text);
    expect(wordCloudCacheMocks.setSnapshot).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entries: [expect.objectContaining({ memberCount: 2, membersTruncated: true })],
      }),
      { sessionId: '11111111-1111-4111-8111-111111111111' },
    );
  });

  it('bindet den Latest-Beleg an den tatsächlich analysierbaren Korpus', async () => {
    const corpus = corpusRows(3, 3);
    corpus[2]!.text = '![Diagramm](https://example.org/bild.png)';
    prismaMock.$queryRaw.mockResolvedValue(corpus);
    analyzeSemanticWordCloudSnapshotMock.mockImplementation(async (analysisInput) => {
      expect(analysisInput.items).toEqual(
        corpus
          .slice(0, 2)
          .map((question) => expect.objectContaining({ id: question.id, text: question.text })),
      );
      return {
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
        snapshotHash: 'b'.repeat(64),
        status: 'ready',
        modelVersion: 'sha256:test-model',
        entries: [
          {
            key: 'semantic-topic',
            label: corpus[0]!.text,
            count: 2,
            basisLabel: corpus[0]!.text,
            members: corpus.slice(0, 2).map((question) => ({
              sourceId: question.id,
              text: question.text,
              weight: 1,
            })),
            variants: corpus.slice(0, 2).map((question) => question.text),
            confidence: 0.9,
          },
        ],
      };
    });

    await caller.analyzeQa({
      sessionCode: 'ABC123',
      mode: 'SEMANTIC',
      locale: 'de',
      metric: 'BEST',
      filter: 'ALL_ELIGIBLE',
      normalization: 'NONE',
      maxEntries: 40,
      limit: 500,
    });

    expect(wordCloudCacheMocks.setLatestQaSemanticTopicSnapshot).toHaveBeenCalledOnce();
    const [latest] = wordCloudCacheMocks.setLatestQaSemanticTopicSnapshot.mock.calls[0]!;
    expect(latest).toMatchObject({
      eligibleQuestionCount: 3,
      analyzedQuestionCount: 2,
      topics: [{ members: [{ questionId: corpus[0]!.id }, { questionId: corpus[1]!.id }] }],
    });
    expect(JSON.stringify(latest)).not.toContain(corpus[2]!.id);
  });

  trpcDodIt(
    {
      procedure: 'wordCloud.analyzeQa',
      case: 'happy',
      mode: 'direct',
      title: 'analysiert einen kanonisch begrenzten Q&A-Korpus über den Host-Vertrag',
    },
    async () => {
      prismaMock.$queryRaw.mockResolvedValue(corpusRows(1, 1));

      await expect(
        caller.analyzeQa({
          sessionCode: 'ABC123',
          mode: 'LEXICAL',
          locale: 'de',
          metric: 'TOP',
          filter: 'ALL_ELIGIBLE',
          normalization: 'NONE',
          maxEntries: 40,
        }),
      ).resolves.toMatchObject({
        eligibleQuestionCount: 1,
        analyzedQuestionCount: 1,
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'wordCloud.analyzeQa',
      case: 'error',
      mode: 'direct',
      contract: 'CONFLICT',
      title: 'verhindert eine zweite parallele Q&A-Analyse derselben Session',
    },
    async () => {
      acquireQaWordCloudAnalysisLockMock.mockResolvedValue(null);

      await expect(
        caller.analyzeQa({
          sessionCode: 'ABC123',
          mode: 'LEXICAL',
          locale: 'de',
          metric: 'TOP',
          filter: 'ALL_ELIGIBLE',
          normalization: 'NONE',
          maxEntries: 40,
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'wordCloud.analyzeQa',
      case: 'error',
      mode: 'direct',
      contract: 'BAD_REQUEST',
      title: 'lehnt widersprüchliche code- und sessionCode-Felder vor der Korpusladung ab',
    },
    async () => {
      await expect(
        caller.analyzeQa({
          code: 'AAAAAA',
          sessionCode: 'BBBBBB',
          mode: 'LEXICAL',
          locale: 'de',
          metric: 'TOP',
          filter: 'ALL_ELIGIBLE',
          normalization: 'NONE',
          maxEntries: 40,
        } as never),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: 'Session-Code im Request ist widersprüchlich.',
      });
      expect(isHostSessionTokenValidMock).not.toHaveBeenCalled();
      expect(prismaMock.session.findUnique).not.toHaveBeenCalled();
    },
  );
});
