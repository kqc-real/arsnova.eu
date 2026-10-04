import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthorizedModerationState } from './moderationQaContext';
import type { ReleasedQuizRow } from './moderationTeachingSignals';
import type { QuickFeedbackModerationProjection } from './quickFeedbackModerationSnapshot';

const { loadStateMock, loadFeedbackMock, prismaMock, txMock } = vi.hoisted(() => ({
  loadStateMock: vi.fn(),
  loadFeedbackMock: vi.fn(),
  prismaMock: { $transaction: vi.fn() },
  txMock: { $queryRaw: vi.fn() },
}));

vi.mock('../db', () => ({ prisma: prismaMock }));
vi.mock('./moderationQaContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./moderationQaContext')>();
  return { ...actual, loadAuthorizedModerationState: loadStateMock };
});
vi.mock('./quickFeedbackModerationSnapshot', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./quickFeedbackModerationSnapshot')>();
  return { ...actual, loadQuickFeedbackModerationSnapshot: loadFeedbackMock };
});

import { buildAuthorizedModerationTeachingSignals } from './moderationTeachingSignals';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const QUIZ_ID = '22222222-2222-4222-8222-222222222222';
const QUESTION_ID = '33333333-3333-4333-8333-333333333333';

function state(overrides: Partial<AuthorizedModerationState> = {}): AuthorizedModerationState {
  return {
    id: SESSION_ID,
    code: 'ABC123',
    type: 'QUIZ',
    status: 'RESULTS',
    currentQuestion: 0,
    currentRound: 1,
    questionProgress: {
      [QUESTION_ID]: {
        state: 'COMPLETED',
        openedAt: '2026-10-04T09:00:00.000Z',
        completedAt: '2026-10-04T09:05:00.000Z',
      },
    },
    questionProgressComplete: true,
    quizId: QUIZ_ID,
    endedAt: null,
    expiresAt: new Date('2026-10-05T10:00:00.000Z'),
    qaEnabled: false,
    qaOpen: false,
    qaClosesAt: null,
    quickFeedbackEnabled: true,
    quickFeedbackOpen: true,
    participantCount: 2,
    sessionLifecycleRevision: 1,
    qaRankingRevision: 0,
    participantRevision: 2,
    learningContextRevision: 4,
    learningContextConfigured: true,
    activeSortMode: 'BEST',
    authorizedAt: new Date('2026-10-04T10:00:00.000Z'),
    ...overrides,
  };
}

function quizRow(overrides: Partial<ReleasedQuizRow> = {}): ReleasedQuizRow {
  return {
    questionId: QUESTION_ID,
    text: 'Question',
    type: 'SINGLE_CHOICE',
    order: 0,
    ratingMin: null,
    ratingMax: null,
    numericToleranceMode: null,
    numericReferenceValue: null,
    numericTolerancePercent: null,
    numericIntervalLeft: null,
    numericIntervalRight: null,
    matchingPairs: null,
    orderingItems: null,
    categories: null,
    categorizationItems: null,
    participantCount: 2n,
    scopeCount: 1n,
    effectiveRound: 1n,
    effectiveResponseCount: 1n,
    correctCount: 0n,
    incorrectCount: 1n,
    unansweredCount: 0n,
    round1ResponseCount: 1n,
    round1CorrectCount: 0n,
    round1IncorrectCount: 1n,
    round2ResponseCount: 0n,
    round2CorrectCount: 0n,
    round2IncorrectCount: 0n,
    options: [
      {
        id: '44444444-4444-4444-8444-444444444444',
        text: 'A',
        isCorrect: false,
        count: 1,
      },
      {
        id: '55555555-5555-4555-8555-555555555555',
        text: 'B',
        isCorrect: true,
        count: 0,
      },
    ],
    ratingValueCount: 0n,
    ratingBuckets: [],
    numericValueCount: 0n,
    numericValues: [],
    round1NumericValueCount: 0n,
    round1NumericValues: [],
    round2NumericValueCount: 0n,
    round2NumericValues: [],
    numericPairCount: 0n,
    numericPairs: [],
    factVotes: [],
    ...overrides,
  };
}

function feedback(fingerprint = 'feedback-v1'): QuickFeedbackModerationProjection {
  return {
    feedback: { state: 'available', aggregates: [] },
    sources: [],
    limitations: [],
    revision: { state: 'available', value: fingerprint },
    fingerprint,
    ruleInput: null,
  };
}

describe('buildAuthorizedModerationTeachingSignals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadStateMock.mockResolvedValue(state());
    loadFeedbackMock.mockResolvedValue(feedback());
    txMock.$queryRaw.mockResolvedValue([quizRow()]);
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => unknown) =>
      callback(txMock),
    );
  });

  it('uses repeatable-read snapshots, reauthorizes, then closes both evidence revisions', async () => {
    const clock = { now: vi.fn(() => new Date('2026-10-04T10:00:00.000Z')) };
    const result = await buildAuthorizedModerationTeachingSignals({
      sessionId: SESSION_ID,
      access: { hostToken: 'host-token' },
      clock,
    });

    expect(result.releasedResults.state).toBe('available');
    expect(loadStateMock).toHaveBeenCalledTimes(3);
    expect(loadStateMock).toHaveBeenNthCalledWith(1, {
      sessionId: SESSION_ID,
      access: { hostToken: 'host-token' },
      clock,
    });
    expect(loadFeedbackMock).toHaveBeenCalledTimes(2);
    expect(txMock.$queryRaw).toHaveBeenCalledTimes(2);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
    expect(prismaMock.$transaction.mock.calls.map((call) => call[1])).toEqual([
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    ]);
  });

  it('reauthorizes before and after the closing evidence reads', async () => {
    const events: string[] = [];
    loadStateMock.mockImplementation(async () => {
      events.push(`auth-${loadStateMock.mock.calls.length}`);
      return state();
    });
    loadFeedbackMock.mockImplementation(async () => {
      events.push(`feedback-${loadFeedbackMock.mock.calls.length}`);
      return feedback();
    });
    txMock.$queryRaw.mockImplementation(async () => {
      events.push(`quiz-${txMock.$queryRaw.mock.calls.length}`);
      return [quizRow()];
    });

    await buildAuthorizedModerationTeachingSignals({
      sessionId: SESSION_ID,
      access: { hostToken: 'host-token' },
    });

    const preReadAuthorization = events.indexOf('auth-2');
    const finalAuthorization = events.indexOf('auth-3');
    expect(preReadAuthorization).toBeGreaterThan(events.indexOf('quiz-1'));
    expect(preReadAuthorization).toBeLessThan(events.indexOf('quiz-2'));
    expect(preReadAuthorization).toBeLessThan(events.indexOf('feedback-2'));
    expect(finalAuthorization).toBeGreaterThan(events.indexOf('quiz-2'));
    expect(finalAuthorization).toBeGreaterThan(events.indexOf('feedback-2'));
  });

  it('rejects a host revocation before the closing evidence reads', async () => {
    loadStateMock
      .mockResolvedValueOnce(state())
      .mockRejectedValueOnce(new TRPCError({ code: 'UNAUTHORIZED' }));

    await expect(
      buildAuthorizedModerationTeachingSignals({
        sessionId: SESSION_ID,
        access: { hostToken: 'host-token' },
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(txMock.$queryRaw).toHaveBeenCalledOnce();
    expect(loadFeedbackMock).toHaveBeenCalledOnce();
  });

  it('rejects a lifecycle or release-gate change at the final state recheck', async () => {
    loadStateMock.mockResolvedValueOnce(state()).mockResolvedValueOnce(state({ currentRound: 2 }));

    await expect(
      buildAuthorizedModerationTeachingSignals({
        sessionId: SESSION_ID,
        access: { hostToken: 'host-token' },
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(txMock.$queryRaw).toHaveBeenCalledOnce();
  });

  it('rejects a lifecycle or release-gate change after the closing evidence reads', async () => {
    loadStateMock
      .mockResolvedValueOnce(state())
      .mockResolvedValueOnce(state())
      .mockResolvedValueOnce(state({ quickFeedbackEnabled: false }));

    await expect(
      buildAuthorizedModerationTeachingSignals({
        sessionId: SESSION_ID,
        access: { hostToken: 'host-token' },
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(txMock.$queryRaw).toHaveBeenCalledTimes(2);
    expect(loadFeedbackMock).toHaveBeenCalledTimes(2);
  });

  it('rejects a host revocation after the closing evidence reads', async () => {
    loadStateMock
      .mockResolvedValueOnce(state())
      .mockResolvedValueOnce(state())
      .mockRejectedValueOnce(new TRPCError({ code: 'UNAUTHORIZED' }));

    await expect(
      buildAuthorizedModerationTeachingSignals({
        sessionId: SESSION_ID,
        access: { hostToken: 'host-token' },
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(txMock.$queryRaw).toHaveBeenCalledTimes(2);
    expect(loadFeedbackMock).toHaveBeenCalledTimes(2);
  });

  it('rejects a quiz mutation detected by the final aggregate revision', async () => {
    txMock.$queryRaw.mockResolvedValueOnce([quizRow()]).mockResolvedValueOnce([
      quizRow({
        effectiveResponseCount: 2n,
        correctCount: 0n,
        incorrectCount: 2n,
        round1ResponseCount: 2n,
        round1IncorrectCount: 2n,
        options: [
          {
            id: '44444444-4444-4444-8444-444444444444',
            text: 'A',
            isCorrect: false,
            count: 2,
          },
          {
            id: '55555555-5555-4555-8555-555555555555',
            text: 'B',
            isCorrect: true,
            count: 0,
          },
        ],
      }),
    ]);

    await expect(
      buildAuthorizedModerationTeachingSignals({
        sessionId: SESSION_ID,
        access: { hostToken: 'host-token' },
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('rejects a quick-feedback mutation detected by the final purge-fenced revision', async () => {
    loadFeedbackMock
      .mockResolvedValueOnce(feedback('feedback-v1'))
      .mockResolvedValueOnce(feedback('feedback-v2'));

    await expect(
      buildAuthorizedModerationTeachingSignals({
        sessionId: SESSION_ID,
        access: { hostToken: 'host-token' },
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('does not expose a raw-text dictionary oracle when sanitized evidence stays equal', async () => {
    const first = quizRow({
      type: 'FREETEXT',
      effectiveResponseCount: 2n,
      correctCount: 0n,
      incorrectCount: 0n,
      unansweredCount: 2n,
      round1ResponseCount: 0n,
      round1IncorrectCount: 0n,
      options: [],
      factVotes: [{ freeText: 'Repeated alpha' }, { freeText: 'Repeated alpha' }],
    });
    const second = quizRow({
      ...first,
      factVotes: [{ freeText: 'Repeated bravo' }, { freeText: 'Repeated bravo' }],
    });
    txMock.$queryRaw.mockResolvedValueOnce([first]).mockResolvedValueOnce([second]);

    const result = await buildAuthorizedModerationTeachingSignals({
      sessionId: SESSION_ID,
      access: { hostToken: 'host-token' },
    });

    expect(result.revisions.releasedResults.state).toBe('available');
    expect(JSON.stringify(result)).not.toContain('Repeated alpha');
    expect(JSON.stringify(result)).not.toContain('Repeated bravo');
  });

  it('closes over sanitized derived facts even when public aggregate counts stay equal', async () => {
    const matchingPairs = [
      { leftId: 'left-a', left: 'A', rightId: 'right-a', right: 'A1' },
      { leftId: 'left-b', left: 'B', rightId: 'right-b', right: 'B1' },
    ];
    const first = quizRow({
      type: 'MATCHING',
      matchingPairs,
      options: [],
      factVotes: [
        {
          matchingSelections: [
            { leftId: 'left-a', rightId: 'right-b' },
            { leftId: 'left-b', rightId: 'right-a' },
          ],
        },
      ],
    });
    const second = quizRow({
      ...first,
      factVotes: [
        {
          matchingSelections: [
            { leftId: 'left-a', rightId: 'right-a' },
            { leftId: 'left-b', rightId: 'right-b' },
          ],
        },
      ],
    });
    txMock.$queryRaw.mockResolvedValueOnce([first]).mockResolvedValueOnce([second]);

    await expect(
      buildAuthorizedModerationTeachingSignals({
        sessionId: SESSION_ID,
        access: { hostToken: 'host-token' },
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
