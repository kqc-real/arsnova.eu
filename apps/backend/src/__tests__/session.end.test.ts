import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';

const {
  prismaMock,
  hostAuthMocks,
  loadSignalMocks,
  platformStatisticMocks,
  invalidateHostPairingForSessionMock,
} = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    vote: {
      findMany: vi.fn(),
    },
    bonusToken: {
      createMany: vi.fn(),
    },
    productFeedbackInviteJob: {
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  },
  hostAuthMocks: {
    extractHostTokenMock: vi.fn(),
    extractHostTokenFromConnectionParamsMock: vi.fn(() => null as string | null),
    isHostSessionTokenValidMock: vi.fn(),
  },
  loadSignalMocks: {
    recordSessionTransitionActivity: vi.fn(),
    markCountdownSessionActive: vi.fn(),
  },
  platformStatisticMocks: {
    incrementCompletedSessionsTotal: vi.fn(),
  },
  invalidateHostPairingForSessionMock: vi.fn(),
}));

const { redisMock } = vi.hoisted(() => ({
  redisMock: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../redis', () => ({
  getRedis: vi.fn(() => redisMock),
}));

vi.mock('../lib/loadSignal', () => ({
  recordSessionTransitionActivity: loadSignalMocks.recordSessionTransitionActivity,
  markCountdownSessionActive: loadSignalMocks.markCountdownSessionActive,
}));

vi.mock('../lib/platformStatistic', () => ({
  incrementCompletedSessionsTotal: platformStatisticMocks.incrementCompletedSessionsTotal,
  updateDailyMaxParticipants: vi.fn(),
  updateMaxParticipantsSingleSession: vi.fn(),
}));

vi.mock('../lib/hostAuth', async () => {
  const { buildHostAuthTestMock } = await import('./lib/hostAuth-vitest-mock');
  return buildHostAuthTestMock({
    extractHostToken: hostAuthMocks.extractHostTokenMock,
    extractHostTokenFromConnectionParams: hostAuthMocks.extractHostTokenFromConnectionParamsMock,
    isHostSessionTokenValid: hostAuthMocks.isHostSessionTokenValidMock,
  });
});

vi.mock('../lib/hostPairing', () => ({
  invalidateHostPairingForSession: (...args: unknown[]) =>
    invalidateHostPairingForSessionMock(...args),
  findPairedHostByToken: vi.fn(async () => null),
}));

import { sessionRouter, resetSessionReadCachesForTests } from '../routers/session';

const caller = sessionRouter.createCaller({ req: {} as never });

describe('session.end', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSessionReadCachesForTests();
    hostAuthMocks.extractHostTokenMock.mockReturnValue('host-token-123');
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
    redisMock.get.mockResolvedValue(null);
    redisMock.set.mockResolvedValue('OK');
    prismaMock.$executeRaw.mockResolvedValue(1);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      fn(prismaMock),
    );
    prismaMock.session.update.mockImplementation(
      async ({ data }: { data?: { endedAt?: Date } }) => ({
        endedAt: data?.endedAt ?? new Date('2026-09-15T06:00:00.000Z'),
        expiresAt: new Date('2026-09-16T06:00:00.000Z'),
        sessionLifecycleRevision: 1,
      }),
    );
    prismaMock.productFeedbackInviteJob.upsert.mockResolvedValue({});
    prismaMock.productFeedbackInviteJob.updateMany.mockResolvedValue({ count: 1 });
  });

  it('vergibt keine Bonus-Codes, wenn die Session vor der letzten Frage beendet wird', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      status: 'ACTIVE',
      currentQuestion: 0,
      quizId: 'quiz-1',
      quiz: {
        name: 'Quiz',
        bonusTokenCount: 3,
        questions: [{ type: 'SINGLE_CHOICE' }, { type: 'SINGLE_CHOICE' }],
      },
      participants: [{ id: 'p1', nickname: 'Ada' }],
      bonusTokens: [],
    });

    await caller.end({ code: 'ABC123' });

    expect(invalidateHostPairingForSessionMock).toHaveBeenCalledWith('ABC123');
    expect(platformStatisticMocks.incrementCompletedSessionsTotal).toHaveBeenCalledWith();
    expect(prismaMock.productFeedbackInviteJob.upsert).toHaveBeenCalledWith({
      where: { sessionId: 'sess-1' },
      create: { sessionId: 'sess-1' },
      update: {},
    });
    expect(prismaMock.productFeedbackInviteJob.upsert.mock.invocationCallOrder[0]).toBeLessThan(
      platformStatisticMocks.incrementCompletedSessionsTotal.mock.invocationCallOrder[0]!,
    );
    expect(prismaMock.bonusToken.createMany).not.toHaveBeenCalled();
    expect(prismaMock.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          qaOpen: false,
          quickFeedbackOpen: false,
          hostEnded: true,
          sessionLifecycleRevision: { increment: 1 },
          lastSkippedQuestionId: null,
          lastQuestionSkippedAt: null,
        }),
      }),
    );
  });

  it('beendet die Session auch wenn Pairing-Invalidierung fehlschlägt', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      status: 'ACTIVE',
      currentQuestion: 0,
      quizId: 'quiz-1',
      quiz: {
        name: 'Quiz',
        bonusTokenCount: 0,
        questions: [{ type: 'SINGLE_CHOICE' }],
      },
      participants: [],
      bonusTokens: [],
    });
    invalidateHostPairingForSessionMock.mockRejectedValueOnce(new Error('Redis nicht erreichbar'));

    await expect(caller.end({ code: 'ABC123' })).resolves.toMatchObject({ status: 'FINISHED' });
    expect(invalidateHostPairingForSessionMock).toHaveBeenCalledWith('ABC123');
  });

  trpcDodIt(
    {
      procedure: 'session.end',
      case: 'happy',
      mode: 'direct',
      title: 'vergibt Bonus-Codes erst, wenn die letzte Frage erreicht wurde',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: 'sess-1',
        status: 'RESULTS',
        currentQuestion: 1,
        quizId: 'quiz-1',
        quiz: {
          name: 'Quiz',
          bonusTokenCount: 3,
          questions: [
            { id: 'q1', order: 0, type: 'SINGLE_CHOICE' },
            { id: 'q2', order: 1, type: 'SINGLE_CHOICE' },
          ],
        },
        participants: [{ id: 'p1', nickname: 'Ada' }],
        bonusTokens: [],
      });
      prismaMock.vote.findMany.mockResolvedValue([
        { participantId: 'p1', questionId: 'q1', round: 1, score: 2000, responseTimeMs: 900 },
      ]);

      await caller.end({ code: 'ABC123' });

      expect(platformStatisticMocks.incrementCompletedSessionsTotal).toHaveBeenCalledWith();
      expect(prismaMock.bonusToken.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            expect.objectContaining({
              sessionId: 'sess-1',
              participantId: 'p1',
              nickname: 'Ada',
              quizName: 'Quiz',
              totalScore: 2000,
              rank: 1,
            }),
          ],
        }),
      );
      expect(prismaMock.bonusToken.createMany.mock.invocationCallOrder[0]).toBeLessThan(
        platformStatisticMocks.incrementCompletedSessionsTotal.mock.invocationCallOrder[0]!,
      );
    },
  );

  it('liefert bei Wiederholung dasselbe kanonische Ende ohne erneute Nebenwirkungen', async () => {
    const endedAt = new Date('2026-09-15T06:00:00.000Z');
    const expiresAt = new Date('2026-09-16T06:00:00.000Z');
    prismaMock.session.findUnique.mockResolvedValueOnce({ id: 'sess-1' }).mockResolvedValueOnce({
      id: 'sess-1',
      status: 'FINISHED',
      endedAt,
      expiresAt,
      hostEnded: true,
      sessionLifecycleRevision: 1,
      currentQuestion: null,
      quiz: null,
      participants: [],
      bonusTokens: [],
    });

    await expect(caller.end({ code: 'ABC123' })).resolves.toMatchObject({
      status: 'FINISHED',
      currentQuestion: null,
      endedAt: endedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      sessionLifecycleRevision: 1,
    });

    expect(prismaMock.$executeRaw).toHaveBeenCalledOnce();
    expect(prismaMock.$executeRaw.mock.invocationCallOrder[0]!).toBeLessThan(
      prismaMock.session.findUnique.mock.invocationCallOrder[1]!,
    );
    expect(prismaMock.session.update).not.toHaveBeenCalled();
    expect(prismaMock.bonusToken.createMany).not.toHaveBeenCalled();
    expect(platformStatisticMocks.incrementCompletedSessionsTotal).not.toHaveBeenCalled();
    expect(loadSignalMocks.recordSessionTransitionActivity).not.toHaveBeenCalled();
  });

  it('schließt offenes Q&A und Blitzlicht auch nach bereits gesetztem FINISHED', async () => {
    const endedAt = new Date('2026-09-15T06:00:00.000Z');
    const expiresAt = new Date('2026-09-16T06:00:00.000Z');
    prismaMock.session.findUnique.mockResolvedValueOnce({ id: 'sess-1' }).mockResolvedValueOnce({
      id: 'sess-1',
      status: 'FINISHED',
      endedAt,
      expiresAt,
      qaOpen: true,
      quickFeedbackOpen: true,
      hostEnded: false,
      sessionLifecycleRevision: 2,
      currentQuestion: null,
      quiz: null,
      participants: [],
      bonusTokens: [],
    });
    prismaMock.session.update.mockResolvedValue({
      endedAt,
      expiresAt,
      sessionLifecycleRevision: 3,
    });

    await expect(caller.end({ code: 'ABC123' })).resolves.toMatchObject({
      status: 'FINISHED',
      endedAt: endedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      sessionLifecycleRevision: 3,
    });

    expect(prismaMock.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          qaOpen: false,
          quickFeedbackOpen: false,
          hostEnded: true,
          sessionLifecycleRevision: { increment: 1 },
        },
      }),
    );
    expect(platformStatisticMocks.incrementCompletedSessionsTotal).not.toHaveBeenCalled();
  });

  it('markiert ein bereits beendetes Quiz nach session.end als hostEnded', async () => {
    const endedAt = new Date('2026-09-15T06:00:00.000Z');
    const expiresAt = new Date('2026-09-16T06:00:00.000Z');
    prismaMock.session.findUnique.mockResolvedValueOnce({ id: 'sess-1' }).mockResolvedValueOnce({
      id: 'sess-1',
      status: 'FINISHED',
      endedAt,
      expiresAt,
      qaOpen: false,
      quickFeedbackOpen: false,
      hostEnded: false,
      sessionLifecycleRevision: 2,
      currentQuestion: null,
      quiz: null,
      participants: [],
      bonusTokens: [],
    });
    prismaMock.session.update.mockResolvedValue({
      endedAt,
      expiresAt,
      sessionLifecycleRevision: 3,
    });

    await expect(caller.end({ code: 'ABC123' })).resolves.toMatchObject({
      status: 'FINISHED',
      hostEnded: true,
      sessionLifecycleRevision: 3,
    });
    expect(prismaMock.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          qaOpen: false,
          quickFeedbackOpen: false,
          hostEnded: true,
          sessionLifecycleRevision: { increment: 1 },
        },
      }),
    );
  });

  it('liefert bei bereits fälliger Frist das trigger-kanonische endedAt = expiresAt', async () => {
    const expiresAt = new Date('2026-09-15T05:00:00.000Z');
    prismaMock.session.findUnique.mockResolvedValueOnce({ id: 'sess-1' }).mockResolvedValueOnce({
      id: 'sess-1',
      status: 'ACTIVE',
      endedAt: null,
      expiresAt,
      sessionLifecycleRevision: 2,
      currentQuestion: 0,
      quiz: { name: 'Quiz', bonusTokenCount: 0, questions: [] },
      participants: [],
      bonusTokens: [],
    });
    prismaMock.session.update.mockResolvedValue({
      endedAt: expiresAt,
      expiresAt,
      sessionLifecycleRevision: 3,
    });

    await expect(caller.end({ code: 'ABC123' })).resolves.toMatchObject({
      status: 'FINISHED',
      currentQuestion: null,
      endedAt: expiresAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      sessionLifecycleRevision: 3,
    });
    expect(prismaMock.session.update).toHaveBeenCalledOnce();
  });
});

trpcDodIt(
  {
    procedure: 'session.end',
    case: 'error',
    mode: 'direct',
    contract: 'UNAUTHORIZED',
    title: 'session.end weist ungültige Host-Token ab',
  },
  async () => {
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(false);
    await expect(caller.end({ code: 'ABC123' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  },
);

describe('session.dismissFinishProjection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSessionReadCachesForTests();
    hostAuthMocks.extractHostTokenMock.mockReturnValue('host-token-123');
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
    redisMock.get.mockResolvedValue(null);
    redisMock.set.mockResolvedValue('OK');
  });

  trpcDodIt(
    {
      procedure: 'session.dismissFinishProjection',
      case: 'happy',
      mode: 'direct',
      title: 'setzt die Presenter-Abschlussprojektion auf Idle',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({ status: 'FINISHED' });

      await expect(caller.dismissFinishProjection({ code: 'ABC123' })).resolves.toEqual({
        finishProjection: 'idle',
      });
      expect(redisMock.set).toHaveBeenCalledWith(
        'session:finishProjection:ABC123',
        'idle',
        'EX',
        24 * 60 * 60,
      );
    },
  );

  trpcDodIt(
    {
      procedure: 'session.dismissFinishProjection',
      case: 'error',
      mode: 'direct',
      contract: 'BAD_REQUEST',
      title: 'lehnt Dismiss ab, wenn die Session noch nicht beendet ist',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({ status: 'RESULTS' });

      await expect(caller.dismissFinishProjection({ code: 'ABC123' })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    },
  );

  it('bestätigt Dismiss nicht, wenn Redis die Idle-Projektion nicht persistieren kann', async () => {
    prismaMock.session.findUnique.mockResolvedValue({ status: 'FINISHED' });
    redisMock.set.mockRejectedValueOnce(new Error('redis down'));

    await expect(caller.dismissFinishProjection({ code: 'ABC123' })).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
    });
  });
});
