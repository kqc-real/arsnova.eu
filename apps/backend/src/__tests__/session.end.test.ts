import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';

const { prismaMock, hostAuthMocks, loadSignalMocks, platformStatisticMocks } = vi.hoisted(() => ({
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
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
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

import { sessionRouter } from '../routers/session';

const caller = sessionRouter.createCaller({ req: {} as never });

describe('session.end', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostAuthMocks.extractHostTokenMock.mockReturnValue('host-token-123');
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
    prismaMock.$executeRaw.mockResolvedValue(1);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      fn(prismaMock),
    );
    prismaMock.session.update.mockResolvedValue({
      id: 'sess-1',
      status: 'FINISHED',
      currentQuestion: null,
      currentRound: 1,
    });
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

    expect(platformStatisticMocks.incrementCompletedSessionsTotal).toHaveBeenCalledWith();
    expect(prismaMock.bonusToken.createMany).not.toHaveBeenCalled();
    expect(prismaMock.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastSkippedQuestionId: null,
          lastQuestionSkippedAt: null,
        }),
      }),
    );
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

  it('führt nach verlorenem End-/Skip-Race keine Abschluss-Nebenwirkungen erneut aus', async () => {
    prismaMock.session.findUnique.mockResolvedValueOnce({ id: 'sess-1' }).mockResolvedValueOnce({
      id: 'sess-1',
      status: 'FINISHED',
      currentQuestion: null,
      quiz: null,
      participants: [],
      bonusTokens: [],
    });

    await expect(caller.end({ code: 'ABC123' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Session ist bereits beendet.',
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
