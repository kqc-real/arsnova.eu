import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';

const {
  acquireQaWordCloudAnalysisLockMock,
  extractHostTokenFromContextMock,
  isHostSessionTokenValidMock,
  prismaMock,
} = vi.hoisted(() => ({
  acquireQaWordCloudAnalysisLockMock: vi.fn(),
  extractHostTokenFromContextMock: vi.fn(),
  isHostSessionTokenValidMock: vi.fn(),
  prismaMock: {
    $queryRaw: vi.fn(),
    participant: { count: vi.fn() },
    session: { findUnique: vi.fn() },
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
vi.mock('../lib/wordCloudAnalysisCache', () => ({
  getWordCloudAnalysisCache: () => ({
    getSnapshot: vi.fn().mockResolvedValue(null),
    setSnapshot: vi.fn().mockResolvedValue(undefined),
    getText: vi.fn().mockResolvedValue(null),
    setText: vi.fn().mockResolvedValue(undefined),
  }),
}));

import { wordCloudRouter } from '../routers/wordCloud';

const caller = wordCloudRouter.createCaller({ req: {} as never });

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
      });

      expect(result.eligibleQuestionCount).toBe(eligibleCount);
      expect(result.analyzedQuestionCount).toBe(returnedCount);
      expect(result.sortMode).toBe('TOP');
      expect(result.filter).toBe('ALL_ELIGIBLE');
      expect(prismaMock.$queryRaw.mock.calls[0]?.slice(1)).toContain(500);
      const corpusSql = (prismaMock.$queryRaw.mock.calls[0]?.[0] as readonly string[]).join('');
      expect(corpusSql).toContain('END AS "bestScore"');
      expect(corpusSql).toContain('END AS "controversyScore"');
      expect(result.entries.length).toBeLessThanOrEqual(80);
      expect(
        Math.max(0, ...result.entries.map((entry) => entry.members.length)),
      ).toBeLessThanOrEqual(1);
      expect(Buffer.byteLength(JSON.stringify(result), 'utf8')).toBeLessThanOrEqual(256 * 1024);
      if (returnedCount === 500) {
        expect(result.entries.some((entry) => entry.membersTruncated)).toBe(true);
        expect(Math.max(...result.entries.map((entry) => entry.memberCount))).toBe(500);
      }
    });
  }

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
