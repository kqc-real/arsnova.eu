import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import {
  calculateModerationQaBestScoreV1,
  calculateModerationQaControversyScoreV1,
} from '@arsnova/shared-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertHostSessionAccessFromContextMock,
  cacheMock,
  isWordCloudSemanticEnabledMock,
  prismaMock,
  resolveQaPresenterSortModeMock,
  txMock,
} = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    participant: { count: vi.fn() },
    qaQuestion: { findMany: vi.fn() },
  };
  return {
    assertHostSessionAccessFromContextMock: vi.fn(),
    cacheMock: {
      getLatestQaSemanticTopicSnapshot: vi.fn(),
      setLatestQaSemanticTopicSnapshot: vi.fn(),
    },
    isWordCloudSemanticEnabledMock: vi.fn(),
    prismaMock: {
      session: { findUnique: vi.fn() },
      $transaction: vi.fn(),
    },
    resolveQaPresenterSortModeMock: vi.fn(),
    txMock: tx,
  };
});

vi.mock('../db', () => ({ prisma: prismaMock }));
vi.mock('./hostAuth', () => ({
  assertHostSessionAccessFromContext: assertHostSessionAccessFromContextMock,
}));
vi.mock('./qaPresenterSortMode', () => ({
  resolveQaPresenterSortMode: resolveQaPresenterSortModeMock,
}));
vi.mock('./wordCloudAnalysisCache', () => ({
  getWordCloudAnalysisCache: () => cacheMock,
}));
vi.mock('./wordCloudSemanticConfig', () => ({
  isWordCloudSemanticEnabled: isWordCloudSemanticEnabledMock,
}));

import { buildAuthorizedModerationQaContext } from './moderationQaContext';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-10-04T10:00:00.000Z');

function sessionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    code: 'ABC123',
    type: 'Q_AND_A',
    status: 'ACTIVE',
    endedAt: null,
    expiresAt: new Date('2026-10-05T10:00:00.000Z'),
    qaEnabled: true,
    qaOpen: true,
    qaClosesAt: new Date('2026-10-05T09:00:00.000Z'),
    sessionLifecycleRevision: 3,
    qaRankingRevision: 17,
    participantRevision: 5,
    ...overrides,
  };
}

function candidateRow() {
  const positive = 40;
  const negative = 40;
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    text: 'Sollten wir mehr Beispiele rechnen?',
    upvoteCount: 0,
    positiveVoteCount: positive,
    negativeVoteCount: negative,
    status: 'ACTIVE',
    createdAt: new Date('2026-10-04T09:00:00.000Z'),
    updatedAt: new Date('2026-10-04T09:01:00.000Z'),
    nlpStatus: 'DISABLED',
    nlpCategory: null,
    nlpConfidence: null,
    nlpModelVersion: null,
    nlpAnalyzedAt: null,
    bestScore: calculateModerationQaBestScoreV1({ positive, negative }),
    controversyScore: calculateModerationQaControversyScoreV1({
      positive,
      negative,
      participantBasis: 200,
    }),
    totalCount: 1n,
    eligibleCount: 1n,
  };
}

describe('buildAuthorizedModerationQaContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveQaPresenterSortModeMock.mockReturnValue('BEST');
    isWordCloudSemanticEnabledMock.mockReturnValue(false);
    assertHostSessionAccessFromContextMock.mockResolvedValue({
      token: 'host-token',
      role: 'ORIGINAL_HOST',
    });
    prismaMock.session.findUnique.mockResolvedValue(sessionRow());
    txMock.participant.count.mockResolvedValue(200);
    txMock.$queryRaw.mockResolvedValue([candidateRow()]);
    txMock.qaQuestion.findMany.mockResolvedValue([]);
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => unknown) =>
      callback(txMock),
    );
  });

  it('collects with a repeatable-read transaction and rechecks host access and revisions', async () => {
    const access = { hostToken: 'host-token' };
    const result = await buildAuthorizedModerationQaContext({
      sessionId: SESSION_ID,
      access,
      clock: { now: () => NOW },
      cache: cacheMock as never,
    });

    expect(result.questions.state).toBe('available');
    expect(result.topics.state).toBe('disabled');
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(prismaMock.$transaction.mock.calls[0]?.[1]).toEqual({
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
    expect(txMock.participant.count).toHaveBeenCalledOnce();
    expect(txMock.$queryRaw).toHaveBeenCalledOnce();
    expect(txMock.qaQuestion.findMany).not.toHaveBeenCalled();
    expect(prismaMock.session.findUnique).toHaveBeenCalledTimes(2);
    expect(assertHostSessionAccessFromContextMock).toHaveBeenCalledTimes(2);
    expect(assertHostSessionAccessFromContextMock).toHaveBeenNthCalledWith(1, access, 'ABC123');
    expect(assertHostSessionAccessFromContextMock).toHaveBeenNthCalledWith(2, access, 'ABC123');
    expect(cacheMock.getLatestQaSemanticTopicSnapshot).not.toHaveBeenCalled();
  });

  it('rejects the built context when the final Q&A revision changed', async () => {
    prismaMock.session.findUnique
      .mockResolvedValueOnce(sessionRow())
      .mockResolvedValueOnce(sessionRow({ qaRankingRevision: 18 }));

    await expect(
      buildAuthorizedModerationQaContext({
        sessionId: SESSION_ID,
        access: { hostToken: 'host-token' },
        clock: { now: () => NOW },
        cache: cacheMock as never,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(assertHostSessionAccessFromContextMock).toHaveBeenCalledTimes(2);
  });

  it('never returns data when the final host authorization was revoked', async () => {
    assertHostSessionAccessFromContextMock
      .mockResolvedValueOnce({ token: 'host-token', role: 'ORIGINAL_HOST' })
      .mockRejectedValueOnce(new TRPCError({ code: 'UNAUTHORIZED' }));

    await expect(
      buildAuthorizedModerationQaContext({
        sessionId: SESSION_ID,
        access: { hostToken: 'host-token' },
        clock: { now: () => NOW },
        cache: cacheMock as never,
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });

  it('samples the retention boundary after the final asynchronous host authorization', async () => {
    const endedAt = new Date(NOW.getTime() - 336 * 60 * 60 * 1000 + 1);
    prismaMock.session.findUnique.mockResolvedValue(
      sessionRow({ status: 'FINISHED', endedAt, expiresAt: endedAt }),
    );
    let currentNow = NOW;
    assertHostSessionAccessFromContextMock
      .mockResolvedValueOnce({ token: 'host-token', role: 'ORIGINAL_HOST' })
      .mockImplementationOnce(async () => {
        await Promise.resolve();
        currentNow = new Date(NOW.getTime() + 2);
        return { token: 'host-token', role: 'ORIGINAL_HOST' };
      });
    const clock = {
      now: vi.fn(() => currentNow),
    };

    await expect(
      buildAuthorizedModerationQaContext({
        sessionId: SESSION_ID,
        access: { hostToken: 'host-token' },
        clock,
        cache: cacheMock as never,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(clock.now).toHaveBeenCalledTimes(2);
    expect(assertHostSessionAccessFromContextMock).toHaveBeenCalledTimes(2);
  });

  it('degrades a disabled Q&A channel without opening a transaction or cache', async () => {
    prismaMock.session.findUnique.mockResolvedValue(
      sessionRow({ type: 'QUIZ', qaEnabled: false, qaOpen: false }),
    );

    const result = await buildAuthorizedModerationQaContext({
      sessionId: SESSION_ID,
      access: { hostToken: 'host-token' },
      clock: { now: () => NOW },
      cache: cacheMock as never,
    });

    expect(result.questions.state).toBe('disabled');
    expect(result.topics.state).toBe('disabled');
    expect(result.sources).toEqual([]);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(cacheMock.getLatestQaSemanticTopicSnapshot).not.toHaveBeenCalled();
    expect(assertHostSessionAccessFromContextMock).toHaveBeenCalledTimes(2);
  });

  it('preserves the measured total when no Q&A rows are currently eligible', async () => {
    txMock.$queryRaw.mockResolvedValue([
      {
        ...candidateRow(),
        id: null,
        text: null,
        upvoteCount: null,
        positiveVoteCount: null,
        negativeVoteCount: null,
        status: null,
        createdAt: null,
        updatedAt: null,
        nlpStatus: null,
        bestScore: null,
        controversyScore: null,
        totalCount: 2n,
        eligibleCount: 0n,
      },
    ]);

    const result = await buildAuthorizedModerationQaContext({
      sessionId: SESSION_ID,
      access: { hostToken: 'host-token' },
      clock: { now: () => NOW },
      cache: cacheMock as never,
    });

    expect(result.questions).toMatchObject({
      state: 'available',
      corpus: { total: 2, eligible: 0, analyzed: 0, deduplicated: 0, represented: 0 },
      items: [],
    });
    expect(result.topics).toEqual({ state: 'unavailable', reason: 'no-data' });
    expect(result.sources).toEqual([]);
    expect(txMock.qaQuestion.findMany).not.toHaveBeenCalled();
  });
});
