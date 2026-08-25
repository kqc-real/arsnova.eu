import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';

const { prismaMock, hostAuthMocks, readingReadyMocks, platformStatisticMocks, loadSignalMocks } =
  vi.hoisted(() => ({
    prismaMock: {
      session: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      participant: {
        groupBy: vi.fn(),
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
    readingReadyMocks: {
      clearReadingReady: vi.fn(),
    },
    platformStatisticMocks: {
      incrementCompletedSessionsTotal: vi.fn(),
    },
    loadSignalMocks: {
      recordSessionTransitionActivity: vi.fn(),
      markCountdownSessionActive: vi.fn(),
    },
  }));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/hostAuth', async () => {
  const { buildHostAuthTestMock } = await import('./lib/hostAuth-vitest-mock');
  return buildHostAuthTestMock({
    extractHostToken: hostAuthMocks.extractHostTokenMock,
    extractHostTokenFromConnectionParams: hostAuthMocks.extractHostTokenFromConnectionParamsMock,
    isHostSessionTokenValid: hostAuthMocks.isHostSessionTokenValidMock,
  });
});

vi.mock('../lib/readingReady', () => ({
  clearReadingReady: readingReadyMocks.clearReadingReady,
}));

vi.mock('../lib/platformStatistic', () => ({
  incrementCompletedSessionsTotal: platformStatisticMocks.incrementCompletedSessionsTotal,
  updateDailyMaxParticipants: vi.fn(),
  updateMaxParticipantsSingleSession: vi.fn(),
}));

vi.mock('../lib/loadSignal', () => ({
  recordSessionTransitionActivity: loadSignalMocks.recordSessionTransitionActivity,
  markCountdownSessionActive: loadSignalMocks.markCountdownSessionActive,
}));

import { sessionRouter } from '../routers/session';

const caller = sessionRouter.createCaller({ req: {} as never });
const SESSION_ID = '6a8edced-5f8f-4cfa-9176-454fac9570ad';
const CODE = 'ABC123';

describe('session.nextQuestion (Story 2.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostAuthMocks.extractHostTokenMock.mockReturnValue('host-token-123');
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
    prismaMock.vote.findMany.mockResolvedValue([]);
    prismaMock.$executeRaw.mockResolvedValue(1);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      fn(prismaMock),
    );
  });

  trpcDodIt(
    {
      procedure: 'session.nextQuestion',
      case: 'happy',
      mode: 'direct',
      title: 'wechselt von LOBBY zu QUESTION_OPEN wenn Lesephase aktiv',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        status: 'LOBBY',
        currentQuestion: null,
        quiz: {
          readingPhaseEnabled: true,
          questions: [{ id: 'q1' }, { id: 'q2' }],
        },
      });
      prismaMock.session.update.mockResolvedValue({
        id: SESSION_ID,
        status: 'QUESTION_OPEN',
        currentQuestion: 0,
      });

      const result = await caller.nextQuestion({ code: CODE });

      expect(result.status).toBe('QUESTION_OPEN');
      expect(result.currentQuestion).toBe(0);
      expect(prismaMock.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SESSION_ID },
          data: expect.objectContaining({ status: 'QUESTION_OPEN', currentQuestion: 0 }),
        }),
      );
    },
  );

  it('wechselt von LOBBY zu ACTIVE wenn Lesephase deaktiviert', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      status: 'LOBBY',
      currentQuestion: null,
      quiz: {
        readingPhaseEnabled: false,
        questions: [{ id: 'q1' }],
      },
    });
    prismaMock.session.update.mockResolvedValue({
      id: SESSION_ID,
      status: 'ACTIVE',
      currentQuestion: 0,
    });

    const result = await caller.nextQuestion({ code: CODE });

    expect(result.status).toBe('ACTIVE');
    expect(result.currentQuestion).toBe(0);
    expect(prismaMock.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SESSION_ID },
        data: expect.objectContaining({ status: 'ACTIVE', currentQuestion: 0 }),
      }),
    );
  });

  it('überspringt Lesephase bei SURVEY trotz aktivierter Lesephase', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      status: 'LOBBY',
      currentQuestion: null,
      quiz: {
        readingPhaseEnabled: true,
        questions: [{ id: 'q1', type: 'SURVEY' }],
      },
    });
    prismaMock.session.update.mockResolvedValue({
      id: SESSION_ID,
      status: 'ACTIVE',
      currentQuestion: 0,
    });

    const result = await caller.nextQuestion({ code: CODE });

    expect(result.status).toBe('ACTIVE');
    expect(result.currentQuestion).toBe(0);
    expect(prismaMock.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SESSION_ID },
        data: expect.objectContaining({ status: 'ACTIVE', currentQuestion: 0 }),
      }),
    );
  });

  it('überspringt Lesephase bei explizitem Frage-Override trotz aktivierter Lesephase', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      status: 'LOBBY',
      currentQuestion: null,
      quiz: {
        readingPhaseEnabled: true,
        questions: [{ id: 'q1', type: 'MULTIPLE_CHOICE', skipReadingPhase: true }],
      },
    });
    prismaMock.session.update.mockResolvedValue({
      id: SESSION_ID,
      status: 'ACTIVE',
      currentQuestion: 0,
    });

    const result = await caller.nextQuestion({ code: CODE });

    expect(result.status).toBe('ACTIVE');
    expect(result.currentQuestion).toBe(0);
    expect(prismaMock.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SESSION_ID },
        data: expect.objectContaining({ status: 'ACTIVE', currentQuestion: 0 }),
      }),
    );
  });

  it('oeffnet aus der Lobby die Startfrage, wenn currentQuestion auf den Vorgaenger zeigt', async () => {
    const startId = '33333333-3333-4333-8333-333333333333';
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      status: 'LOBBY',
      currentQuestion: 1,
      questionProgress: {},
      questionProgressComplete: true,
      quiz: {
        readingPhaseEnabled: false,
        questions: [
          { id: '11111111-1111-4111-8111-111111111111', order: 0, type: 'SINGLE_CHOICE' },
          { id: '22222222-2222-4222-8222-222222222222', order: 1, type: 'SINGLE_CHOICE' },
          { id: startId, order: 2, type: 'SINGLE_CHOICE' },
        ],
      },
    });
    prismaMock.session.update.mockResolvedValue({
      id: SESSION_ID,
      status: 'ACTIVE',
      currentQuestion: 2,
    });

    const result = await caller.nextQuestion({ code: CODE });

    expect(result.status).toBe('ACTIVE');
    expect(result.currentQuestion).toBe(2);
    expect(prismaMock.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SESSION_ID },
        data: expect.objectContaining({
          status: 'ACTIVE',
          currentQuestion: 2,
          questionProgress: expect.objectContaining({
            [startId]: expect.objectContaining({ state: 'OPENED' }),
          }),
        }),
      }),
    );
    const progress = prismaMock.session.update.mock.calls[0][0].data.questionProgress as Record<
      string,
      { state: string }
    >;
    expect(progress['11111111-1111-4111-8111-111111111111']).toBeUndefined();
    expect(progress['22222222-2222-4222-8222-222222222222']).toBeUndefined();
  });

  it('setzt FINISHED wenn nach letzter Frage', async () => {
    const questionId = '33333333-3333-4333-8333-333333333333';
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      status: 'RESULTS',
      currentQuestion: 0,
      questionProgress: {
        [questionId]: {
          state: 'OPENED',
          openedAt: '2026-08-10T12:00:00.000Z',
        },
      },
      questionProgressComplete: true,
      quiz: {
        name: 'Testquiz',
        readingPhaseEnabled: true,
        bonusTokenCount: 1,
        questions: [{ id: questionId, order: 0, type: 'SINGLE_CHOICE' }],
      },
      participants: [{ id: 'p1', nickname: 'Ada' }],
      bonusTokens: [],
    });
    prismaMock.session.update.mockResolvedValue({
      id: SESSION_ID,
      status: 'FINISHED',
      currentQuestion: null,
    });
    prismaMock.vote.findMany.mockResolvedValue([
      {
        participantId: 'p1',
        questionId,
        round: 1,
        score: 2000,
        responseTimeMs: 900,
      },
    ]);
    prismaMock.bonusToken.createMany.mockResolvedValue({ count: 1 });

    const result = await caller.nextQuestion({ code: CODE });

    expect(result.status).toBe('FINISHED');
    expect(result.currentQuestion).toBeNull();
    expect(prismaMock.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SESSION_ID },
        data: expect.objectContaining({ status: 'FINISHED', currentQuestion: null }),
      }),
    );
    expect(platformStatisticMocks.incrementCompletedSessionsTotal).toHaveBeenCalledWith();
    expect(prismaMock.$executeRaw).toHaveBeenCalledOnce();
    expect(prismaMock.bonusToken.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ participantId: 'p1', totalScore: 2000, rank: 1 })],
      }),
    );
    expect(prismaMock.bonusToken.createMany.mock.invocationCallOrder[0]).toBeLessThan(
      platformStatisticMocks.incrementCompletedSessionsTotal.mock.invocationCallOrder[0]!,
    );
  });

  trpcDodIt(
    {
      procedure: 'session.nextQuestion',
      case: 'error',
      mode: 'direct',
      contract: 'NOT_FOUND',
      title: 'wirft NOT_FOUND wenn Session fehlt',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue(null);

      await expect(caller.nextQuestion({ code: 'NONEXI' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'Session oder Quiz nicht gefunden.',
      });
    },
  );

  it('wirft BAD_REQUEST wenn Status nicht LOBBY/PAUSED/RESULTS', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      status: 'ACTIVE',
      currentQuestion: 0,
      quiz: { readingPhaseEnabled: true, questions: [{ id: 'q1' }] },
    });

    await expect(caller.nextQuestion({ code: CODE })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: /Nächste Frage nur aus Status/,
    });
  });

  it('lehnt Host-Steuerung ohne gültigen Host-Token ab', async () => {
    hostAuthMocks.extractHostTokenMock.mockReturnValue(null);

    await expect(caller.nextQuestion({ code: CODE })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Host-Authentifizierung erforderlich.',
    });

    expect(prismaMock.session.findUnique).not.toHaveBeenCalled();
  });

  it('erlaubt erste Frage bei ACTIVE ohne currentQuestion (nach Q&A-Start)', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      status: 'ACTIVE',
      currentQuestion: null,
      quiz: {
        readingPhaseEnabled: false,
        questions: [{ id: 'q1' }],
      },
    });
    prismaMock.session.update.mockResolvedValue({
      id: SESSION_ID,
      status: 'ACTIVE',
      currentQuestion: 0,
    });

    const result = await caller.nextQuestion({ code: CODE });

    expect(result.status).toBe('ACTIVE');
    expect(result.currentQuestion).toBe(0);
    expect(prismaMock.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SESSION_ID },
        data: expect.objectContaining({ status: 'ACTIVE', currentQuestion: 0 }),
      }),
    );
  });

  it('springt mit skipCurrentResultQuestion auf die naechste noch nicht gezeigte Frage', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      status: 'RESULTS',
      currentQuestion: 1,
      quiz: {
        readingPhaseEnabled: false,
        questions: [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }, { id: 'q4' }],
      },
    });
    prismaMock.session.update.mockResolvedValue({
      id: SESSION_ID,
      status: 'ACTIVE',
      currentQuestion: 3,
    });

    const result = await caller.nextQuestion({ code: CODE, skipCurrentResultQuestion: true });

    expect(result.status).toBe('ACTIVE');
    expect(result.currentQuestion).toBe(3);
    expect(prismaMock.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SESSION_ID },
        data: expect.objectContaining({ status: 'ACTIVE', currentQuestion: 3 }),
      }),
    );
  });

  it('wirft BAD_REQUEST bei skipCurrentResultQuestion ausserhalb RESULTS/DISCUSSION', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      status: 'PAUSED',
      currentQuestion: 1,
      quiz: {
        readingPhaseEnabled: false,
        questions: [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }],
      },
    });

    await expect(
      caller.nextQuestion({ code: CODE, skipCurrentResultQuestion: true }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'skipCurrentResultQuestion ist nur aus Status RESULTS oder DISCUSSION erlaubt.',
    });
  });

  it('öffnet eine unter der Sperre bereits beendete Session nicht mit der nächsten Frage erneut', async () => {
    prismaMock.session.findUnique.mockResolvedValueOnce({ id: SESSION_ID }).mockResolvedValueOnce({
      id: SESSION_ID,
      status: 'FINISHED',
      currentQuestion: null,
      quiz: { readingPhaseEnabled: false, questions: [{ id: 'q1' }] },
      participants: [],
      bonusTokens: [],
    });

    await expect(caller.nextQuestion({ code: CODE })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: /Nächste Frage nur aus Status/,
    });
    expect(prismaMock.$executeRaw).toHaveBeenCalledOnce();
    expect(prismaMock.session.update).not.toHaveBeenCalled();
    expect(platformStatisticMocks.incrementCompletedSessionsTotal).not.toHaveBeenCalled();
  });
});

describe('session Quiz-Pause', () => {
  const snapshotSession = (
    status: 'PAUSED' | 'ACTIVE' | 'QUESTION_OPEN',
    statusChangedAt: Date,
    activeQuestionStartedAt: Date | null,
    pausedFromStatus: 'QUESTION_OPEN' | 'ACTIVE' | null = status === 'PAUSED' ? 'ACTIVE' : null,
  ) => ({
    type: 'QUIZ',
    quizId: '11111111-1111-4111-8111-111111111111',
    qaEnabled: false,
    qaOpen: false,
    qaTitle: null,
    qaModerationMode: false,
    title: null,
    moderationMode: false,
    quickFeedbackEnabled: false,
    quickFeedbackOpen: false,
    status,
    currentQuestion: 0,
    currentRound: 1,
    pausedFromStatus,
    statusChangedAt,
    activeQuestionStartedAt,
    lastSkippedQuestionId: null,
    lastQuestionSkippedAt: null,
    quiz: {
      defaultTimer: 60,
      timerScaleByDifficulty: false,
      questions: [{ timer: 60, difficulty: 'MEDIUM' }],
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    hostAuthMocks.extractHostTokenMock.mockReturnValue('host-token-123');
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
    prismaMock.$executeRaw.mockResolvedValue(1);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      fn(prismaMock),
    );
  });

  trpcDodIt(
    {
      procedure: 'session.pauseQuiz',
      case: 'happy',
      mode: 'direct',
      title: 'pausiert eine aktive Quizfrage unter Zeilen-Sperre',
    },
    async () => {
      const activeAt = new Date('2026-08-25T12:00:00.000Z');
      const pausedAt = new Date('2026-08-25T12:00:10.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(pausedAt);
      try {
        prismaMock.session.findUnique
          .mockResolvedValueOnce({ id: SESSION_ID })
          .mockResolvedValueOnce({
            status: 'ACTIVE',
            currentQuestion: 0,
            quizId: '11111111-1111-4111-8111-111111111111',
          })
          .mockResolvedValueOnce(snapshotSession('PAUSED', pausedAt, activeAt));

        await expect(caller.pauseQuiz({ code: CODE })).resolves.toMatchObject({
          status: 'PAUSED',
          currentQuestion: 0,
          pausedFromStatus: 'ACTIVE',
        });
        expect(prismaMock.session.update).toHaveBeenCalledWith({
          where: { id: SESSION_ID },
          data: {
            status: 'PAUSED',
            pausedFromStatus: 'ACTIVE',
            statusChangedAt: pausedAt,
          },
        });
        expect(loadSignalMocks.recordSessionTransitionActivity).toHaveBeenCalledOnce();
        expect(loadSignalMocks.markCountdownSessionActive).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it('setzt eine pausierte Lesephase ohne Abstimmungs-Timer fort', async () => {
    const pausedAt = new Date('2026-08-25T12:00:10.000Z');
    const resumedAt = new Date('2026-08-25T12:00:40.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(resumedAt);
    try {
      prismaMock.session.findUnique
        .mockResolvedValueOnce({ id: SESSION_ID })
        .mockResolvedValueOnce({
          status: 'PAUSED',
          currentQuestion: 0,
          pausedFromStatus: 'QUESTION_OPEN',
          statusChangedAt: pausedAt,
          activeQuestionStartedAt: null,
          quizId: '11111111-1111-4111-8111-111111111111',
        })
        .mockResolvedValueOnce(snapshotSession('QUESTION_OPEN', resumedAt, null));

      await expect(caller.resumeQuiz({ code: CODE })).resolves.toMatchObject({
        status: 'QUESTION_OPEN',
        currentQuestion: 0,
        pausedFromStatus: null,
      });
      expect(prismaMock.session.update).toHaveBeenCalledWith({
        where: { id: SESSION_ID },
        data: {
          status: 'QUESTION_OPEN',
          pausedFromStatus: null,
          statusChangedAt: resumedAt,
          activeQuestionStartedAt: null,
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('öffnet während einer Host-Pause nicht versehentlich die nächste Frage', async () => {
    prismaMock.session.findUnique.mockResolvedValueOnce({ id: SESSION_ID }).mockResolvedValueOnce({
      id: SESSION_ID,
      status: 'PAUSED',
      pausedFromStatus: 'ACTIVE',
      currentQuestion: 0,
      quiz: {
        readingPhaseEnabled: true,
        questions: [{ id: 'q1' }, { id: 'q2' }],
      },
    });

    await expect(caller.nextQuestion({ code: CODE })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Das pausierte Quiz muss zuerst fortgesetzt werden.',
    });
    expect(prismaMock.session.update).not.toHaveBeenCalled();
  });

  trpcDodIt(
    {
      procedure: 'session.resumeQuiz',
      case: 'happy',
      mode: 'direct',
      title: 'setzt eine aktive Quizfrage mit eingefrorenem Timer fort',
    },
    async () => {
      const activeAt = new Date('2026-08-25T12:00:00.000Z');
      const pausedAt = new Date('2026-08-25T12:00:10.000Z');
      const resumedAt = new Date('2026-08-25T12:00:40.000Z');
      const shiftedActiveAt = new Date('2026-08-25T12:00:30.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(resumedAt);
      try {
        prismaMock.session.findUnique
          .mockResolvedValueOnce({ id: SESSION_ID })
          .mockResolvedValueOnce({
            status: 'PAUSED',
            currentQuestion: 0,
            pausedFromStatus: 'ACTIVE',
            statusChangedAt: pausedAt,
            activeQuestionStartedAt: activeAt,
            quizId: '11111111-1111-4111-8111-111111111111',
          })
          .mockResolvedValueOnce(snapshotSession('ACTIVE', resumedAt, shiftedActiveAt));

        await expect(caller.resumeQuiz({ code: CODE })).resolves.toMatchObject({
          status: 'ACTIVE',
          currentQuestion: 0,
          pausedFromStatus: null,
          activeAt: shiftedActiveAt.toISOString(),
          timer: 60,
        });
        expect(prismaMock.session.update).toHaveBeenCalledWith({
          where: { id: SESSION_ID },
          data: {
            status: 'ACTIVE',
            pausedFromStatus: null,
            statusChangedAt: resumedAt,
            activeQuestionStartedAt: shiftedActiveAt,
          },
        });
        expect(loadSignalMocks.recordSessionTransitionActivity).toHaveBeenCalledOnce();
        expect(loadSignalMocks.markCountdownSessionActive).toHaveBeenCalledWith(SESSION_ID);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  trpcDodIt(
    {
      procedure: 'session.pauseQuiz',
      case: 'error',
      mode: 'direct',
      contract: 'BAD_REQUEST',
      title: 'weist eine Quiz-Pause außerhalb einer laufenden Frage zurück',
    },
    async () => {
      prismaMock.session.findUnique
        .mockResolvedValueOnce({ id: SESSION_ID })
        .mockResolvedValueOnce({
          status: 'RESULTS',
          currentQuestion: 0,
          quizId: '11111111-1111-4111-8111-111111111111',
        });

      await expect(caller.pauseQuiz({ code: CODE })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
      expect(prismaMock.session.update).not.toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'session.resumeQuiz',
      case: 'error',
      mode: 'direct',
      contract: 'BAD_REQUEST',
      title: 'weist Fortsetzen ohne autoritative Ausgangsphase zurück',
    },
    async () => {
      prismaMock.session.findUnique
        .mockResolvedValueOnce({ id: SESSION_ID })
        .mockResolvedValueOnce({
          status: 'PAUSED',
          currentQuestion: 0,
          pausedFromStatus: null,
          statusChangedAt: new Date(),
          activeQuestionStartedAt: null,
          quizId: '11111111-1111-4111-8111-111111111111',
        });

      await expect(caller.resumeQuiz({ code: CODE })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
      expect(prismaMock.session.update).not.toHaveBeenCalled();
    },
  );
});

describe('session.skipQuestion', () => {
  const QUESTION_ID_1 = '11111111-1111-4111-8111-111111111111';
  const QUESTION_ID_2 = '22222222-2222-4222-8222-222222222222';

  function activeSession(overrides: Record<string, unknown> = {}) {
    return {
      id: SESSION_ID,
      status: 'ACTIVE',
      currentQuestion: 0,
      currentRound: 1,
      questionProgress: {
        [QUESTION_ID_1]: {
          state: 'OPENED',
          openedAt: '2026-08-10T12:00:00.000Z',
        },
      },
      questionProgressComplete: true,
      answerDisplayOrder: {},
      quiz: {
        name: 'Testquiz',
        readingPhaseEnabled: true,
        defaultTimer: null,
        timerScaleByDifficulty: true,
        bonusTokenCount: null,
        questions: [
          {
            id: QUESTION_ID_1,
            order: 0,
            type: 'SINGLE_CHOICE',
            skipReadingPhase: false,
            timer: null,
            difficulty: 'MEDIUM',
            answers: [],
          },
          {
            id: QUESTION_ID_2,
            order: 1,
            type: 'SINGLE_CHOICE',
            skipReadingPhase: false,
            timer: null,
            difficulty: 'MEDIUM',
            answers: [],
          },
        ],
      },
      participants: [],
      bonusTokens: [],
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    hostAuthMocks.extractHostTokenMock.mockReturnValue('host-token-123');
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
    prismaMock.$executeRaw.mockResolvedValue(1);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      fn(prismaMock),
    );
    prismaMock.session.update.mockResolvedValue({ id: SESSION_ID });
  });

  trpcDodIt(
    {
      procedure: 'session.skipQuestion',
      case: 'happy',
      mode: 'direct',
      title: 'lässt die aktive Frage atomar aus und öffnet die Folgefrage',
    },
    async () => {
      prismaMock.session.findUnique
        .mockResolvedValueOnce({ id: SESSION_ID })
        .mockResolvedValueOnce(activeSession());

      const result = await caller.skipQuestion({ code: CODE, questionId: QUESTION_ID_1 });

      expect(result).toMatchObject({
        status: 'QUESTION_OPEN',
        currentQuestion: 1,
        currentRound: 1,
        skippedQuestionId: QUESTION_ID_1,
      });
      expect(prismaMock.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SESSION_ID },
          data: expect.objectContaining({
            status: 'QUESTION_OPEN',
            currentQuestion: 1,
            questionProgress: expect.objectContaining({
              [QUESTION_ID_1]: expect.objectContaining({ state: 'SKIPPED' }),
              [QUESTION_ID_2]: expect.objectContaining({ state: 'OPENED' }),
            }),
          }),
        }),
      );
      expect(readingReadyMocks.clearReadingReady).toHaveBeenCalledWith(SESSION_ID, QUESTION_ID_1);
    },
  );

  it('beendet die Session regulär, wenn die letzte Frage ausgelassen wird', async () => {
    prismaMock.session.findUnique.mockResolvedValueOnce({ id: SESSION_ID }).mockResolvedValueOnce(
      activeSession({
        currentQuestion: 1,
        questionProgress: {
          [QUESTION_ID_1]: {
            state: 'COMPLETED',
            openedAt: '2026-08-10T11:00:00.000Z',
            completedAt: '2026-08-10T11:01:00.000Z',
          },
          [QUESTION_ID_2]: {
            state: 'OPENED',
            openedAt: '2026-08-10T12:00:00.000Z',
          },
        },
      }),
    );

    await expect(
      caller.skipQuestion({ code: CODE, questionId: QUESTION_ID_2 }),
    ).resolves.toMatchObject({
      status: 'FINISHED',
      currentQuestion: null,
      skippedQuestionId: QUESTION_ID_2,
    });
    expect(platformStatisticMocks.incrementCompletedSessionsTotal).toHaveBeenCalledOnce();
  });

  it('erzeugt Bonus-Tokens beim letzten Skip vor den Abschluss-Nebenwirkungen', async () => {
    const completedAt = '2026-08-10T11:01:00.000Z';
    const openedAt = '2026-08-10T12:00:00.000Z';
    const session = activeSession({
      currentQuestion: 1,
      questionProgress: {
        [QUESTION_ID_1]: {
          state: 'COMPLETED',
          openedAt: '2026-08-10T11:00:00.000Z',
          completedAt,
        },
        [QUESTION_ID_2]: { state: 'OPENED', openedAt },
      },
      quiz: {
        ...activeSession().quiz,
        bonusTokenCount: 1,
      },
      participants: [{ id: 'p1', nickname: 'Ada' }],
    });
    prismaMock.session.findUnique
      .mockResolvedValueOnce({ id: SESSION_ID })
      .mockResolvedValueOnce(session)
      .mockResolvedValueOnce({
        questionProgress: {
          [QUESTION_ID_1]: {
            state: 'COMPLETED',
            openedAt: '2026-08-10T11:00:00.000Z',
            completedAt,
          },
          [QUESTION_ID_2]: {
            state: 'SKIPPED',
            openedAt,
            skippedAt: '2026-08-10T12:01:00.000Z',
          },
        },
        questionProgressComplete: true,
        quiz: {
          questions: [
            { id: QUESTION_ID_1, order: 0 },
            { id: QUESTION_ID_2, order: 1 },
          ],
        },
      });
    prismaMock.vote.findMany.mockResolvedValue([
      {
        participantId: 'p1',
        questionId: QUESTION_ID_1,
        round: 1,
        score: 2000,
        responseTimeMs: 900,
      },
    ]);
    prismaMock.bonusToken.createMany.mockResolvedValue({ count: 1 });

    await expect(
      caller.skipQuestion({ code: CODE, questionId: QUESTION_ID_2 }),
    ).resolves.toMatchObject({ status: 'FINISHED' });

    expect(prismaMock.bonusToken.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            sessionId: SESSION_ID,
            participantId: 'p1',
            totalScore: 2000,
            rank: 1,
          }),
        ],
      }),
    );
    expect(prismaMock.bonusToken.createMany.mock.invocationCallOrder[0]).toBeLessThan(
      platformStatisticMocks.incrementCompletedSessionsTotal.mock.invocationCallOrder[0]!,
    );
  });

  it('behandelt eine Wiederholung desselben Skip-Requests idempotent', async () => {
    const skippedAt = '2026-08-10T12:01:00.000Z';
    prismaMock.session.findUnique.mockResolvedValueOnce({ id: SESSION_ID }).mockResolvedValueOnce(
      activeSession({
        status: 'QUESTION_OPEN',
        currentQuestion: 1,
        questionProgress: {
          [QUESTION_ID_1]: {
            state: 'SKIPPED',
            openedAt: '2026-08-10T12:00:00.000Z',
            skippedAt,
          },
          [QUESTION_ID_2]: {
            state: 'OPENED',
            openedAt: skippedAt,
          },
        },
      }),
    );

    await expect(
      caller.skipQuestion({ code: CODE, questionId: QUESTION_ID_1 }),
    ).resolves.toMatchObject({
      status: 'QUESTION_OPEN',
      currentQuestion: 1,
      skippedQuestionId: QUESTION_ID_1,
      questionSkippedAt: skippedAt,
    });
    expect(prismaMock.session.update).not.toHaveBeenCalled();
    expect(loadSignalMocks.recordSessionTransitionActivity).not.toHaveBeenCalled();
  });

  trpcDodIt(
    {
      procedure: 'session.skipQuestion',
      case: 'error',
      mode: 'direct',
      contract: 'BAD_REQUEST',
      title: 'lehnt das Auslassen außerhalb der Lese- und Abstimmungsphase ab',
    },
    async () => {
      prismaMock.session.findUnique
        .mockResolvedValueOnce({ id: SESSION_ID })
        .mockResolvedValueOnce(activeSession({ status: 'RESULTS' }));

      await expect(
        caller.skipQuestion({ code: CODE, questionId: QUESTION_ID_1 }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
      expect(prismaMock.session.update).not.toHaveBeenCalled();
    },
  );
});

describe('session.revealAnswers (Story 2.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$executeRaw.mockResolvedValue(1);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      fn(prismaMock),
    );
  });

  it('wechselt von QUESTION_OPEN zu ACTIVE', async () => {
    prismaMock.session.findUnique
      .mockResolvedValueOnce({
        id: SESSION_ID,
        status: 'QUESTION_OPEN',
        currentQuestion: 0,
        currentRound: 1,
      })
      .mockResolvedValueOnce({
        status: 'QUESTION_OPEN',
        currentQuestion: 0,
      });
    prismaMock.session.update.mockResolvedValue({
      id: SESSION_ID,
      status: 'ACTIVE',
      currentQuestion: 0,
    });

    const result = await caller.revealAnswers({ code: CODE });

    expect(result.status).toBe('ACTIVE');
    expect(result.currentQuestion).toBe(0);
    expect(prismaMock.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SESSION_ID },
        data: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
  });

  trpcDodIt(
    {
      procedure: 'session.revealAnswers',
      case: 'error',
      mode: 'direct',
      contract: 'BAD_REQUEST',
      title: 'wirft BAD_REQUEST wenn nicht QUESTION_OPEN',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        status: 'ACTIVE',
        currentQuestion: 0,
        currentRound: 1,
      });

      await expect(caller.revealAnswers({ code: CODE })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: 'Antworten freigeben nur im Status QUESTION_OPEN (Lesephase).',
      });
    },
  );
});

describe('session.revealResults (Story 2.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostAuthMocks.extractHostTokenMock.mockReturnValue('host-token-123');
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
    prismaMock.$executeRaw.mockResolvedValue(1);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      fn(prismaMock),
    );
  });

  trpcDodIt(
    {
      procedure: 'session.revealResults',
      case: 'happy',
      mode: 'direct',
      title: 'wechselt von ACTIVE zu RESULTS',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        status: 'ACTIVE',
        currentQuestion: 0,
        currentRound: 1,
      });
      prismaMock.session.update.mockResolvedValue({
        id: SESSION_ID,
        status: 'RESULTS',
        currentQuestion: 0,
      });

      const result = await caller.revealResults({ code: CODE });

      expect(result.status).toBe('RESULTS');
      expect(result.currentQuestion).toBe(0);
      expect(prismaMock.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SESSION_ID },
          data: expect.objectContaining({ status: 'RESULTS' }),
        }),
      );
    },
  );

  it('wartet mit Ergebnissen bis garantierte Zusatzzeit beendet ist', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      status: 'ACTIVE',
      currentQuestion: 0,
      currentRound: 1,
      activeQuestionStartedAt: new Date(),
      quiz: {
        defaultTimer: 30,
        timerScaleByDifficulty: true,
        questions: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            type: 'SINGLE_CHOICE',
            timer: null,
            difficulty: 'MEDIUM',
            numericTwoRounds: false,
          },
        ],
      },
    });
    prismaMock.participant.groupBy.mockResolvedValue([
      { timerAccommodation: 'EXTENDED', _count: { _all: 1 } },
    ]);

    await expect(caller.revealResults({ code: CODE })).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: 'Eine Person nutzt noch ihre garantierte Zusatzzeit.',
    });
    expect(prismaMock.session.update).not.toHaveBeenCalled();
  });

  it('lehnt Force-Close ab solange der Raum-Countdown läuft', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      status: 'ACTIVE',
      currentQuestion: 0,
      currentRound: 1,
      activeQuestionStartedAt: new Date(),
      quiz: {
        defaultTimer: 30,
        timerScaleByDifficulty: true,
        questions: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            type: 'SINGLE_CHOICE',
            timer: null,
            difficulty: 'MEDIUM',
            numericTwoRounds: false,
          },
        ],
      },
    });
    prismaMock.participant.groupBy.mockResolvedValue([
      { timerAccommodation: 'EXTENDED', _count: { _all: 1 } },
    ]);

    await expect(
      caller.revealResults({ code: CODE, forceClosePersonalTimers: true }),
    ).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message:
        'Persönliche Fristen dürfen erst nach Ablauf des Raum-Countdowns vorzeitig beendet werden.',
    });
    expect(prismaMock.session.update).not.toHaveBeenCalled();
  });

  it('erlaubt Force-Close nach Ablauf des Raum-Countdowns trotz offener 10×-Fenster', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      status: 'ACTIVE',
      currentQuestion: 0,
      currentRound: 1,
      activeQuestionStartedAt: new Date(Date.now() - 31_000),
      quiz: {
        defaultTimer: 30,
        timerScaleByDifficulty: true,
        questions: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            type: 'SINGLE_CHOICE',
            timer: 30,
            difficulty: 'MEDIUM',
            numericTwoRounds: false,
          },
        ],
      },
    });
    prismaMock.participant.groupBy.mockResolvedValue([
      { timerAccommodation: 'EXTENDED', _count: { _all: 2 } },
    ]);
    prismaMock.session.update.mockResolvedValue({
      id: SESSION_ID,
      status: 'RESULTS',
      currentQuestion: 0,
    });

    const result = await caller.revealResults({
      code: CODE,
      forceClosePersonalTimers: true,
    });

    expect(result.status).toBe('RESULTS');
    expect(prismaMock.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SESSION_ID },
        data: expect.objectContaining({ status: 'RESULTS' }),
      }),
    );
  });

  it('öffnet eine fragefreie Session nach parallelem Abschluss nicht als RESULTS erneut', async () => {
    prismaMock.session.findUnique
      .mockResolvedValueOnce({
        id: SESSION_ID,
        status: 'ACTIVE',
        currentQuestion: null,
        currentRound: 1,
        activeQuestionStartedAt: null,
        questionProgress: null,
        quiz: null,
      })
      .mockResolvedValueOnce({ status: 'FINISHED', currentQuestion: null });

    await expect(caller.revealResults({ code: CODE })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Ergebnis anzeigen nur im Status ACTIVE.',
    });
    expect(prismaMock.$executeRaw).toHaveBeenCalledOnce();
    expect(prismaMock.session.update).not.toHaveBeenCalled();
  });

  trpcDodIt(
    {
      procedure: 'session.revealResults',
      case: 'error',
      mode: 'direct',
      contract: 'BAD_REQUEST',
      title: 'wirft BAD_REQUEST wenn nicht ACTIVE',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        status: 'RESULTS',
        currentQuestion: 0,
        currentRound: 1,
      });

      await expect(caller.revealResults({ code: CODE })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: 'Ergebnis anzeigen nur im Status ACTIVE.',
      });
    },
  );
});

describe('session.prevQuestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostAuthMocks.extractHostTokenMock.mockReturnValue('host-token-123');
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
    prismaMock.vote.findMany.mockResolvedValue([]);
    prismaMock.$executeRaw.mockResolvedValue(1);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      fn(prismaMock),
    );
  });

  trpcDodIt(
    {
      procedure: 'session.prevQuestion',
      case: 'happy',
      mode: 'direct',
      title: 'wechselt von RESULTS zu RESULTS mit vorheriger Frage',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        status: 'RESULTS',
        currentQuestion: 2,
        questionProgress: null,
        questionProgressComplete: false,
        quiz: { questions: [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }] },
      });
      prismaMock.session.update.mockResolvedValue({
        id: SESSION_ID,
        status: 'RESULTS',
        currentQuestion: 1,
      });

      const result = await caller.prevQuestion({ code: CODE });

      expect(result.status).toBe('RESULTS');
      expect(result.currentQuestion).toBe(1);
      expect(prismaMock.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SESSION_ID },
          data: expect.objectContaining({ status: 'RESULTS', currentQuestion: 1, currentRound: 1 }),
        }),
      );
    },
  );

  trpcDodIt(
    {
      procedure: 'session.prevQuestion',
      case: 'error',
      mode: 'direct',
      contract: 'BAD_REQUEST',
      title: 'wirft BAD_REQUEST wenn Status nicht RESULTS oder DISCUSSION',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        status: 'ACTIVE',
        currentQuestion: 2,
      });

      await expect(caller.prevQuestion({ code: CODE })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: 'Zurück nur aus Status RESULTS oder DISCUSSION möglich.',
      });
    },
  );

  it('wirft BAD_REQUEST bei erster Frage (currentQuestion === 0)', async () => {
    const firstId = '11111111-1111-4111-8111-111111111111';
    const secondId = '22222222-2222-4222-8222-222222222222';
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      status: 'RESULTS',
      currentQuestion: 0,
      questionProgress: {
        [firstId]: {
          state: 'COMPLETED',
          openedAt: '2026-08-21T10:00:00.000Z',
          completedAt: '2026-08-21T10:01:00.000Z',
        },
      },
      questionProgressComplete: true,
      quiz: {
        questions: [
          { id: firstId, order: 0 },
          { id: secondId, order: 1 },
        ],
      },
    });

    await expect(caller.prevQuestion({ code: CODE })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Bereits bei der ersten Frage – Rückwärtsnavigation nicht möglich.',
    });
    expect(prismaMock.session.update).not.toHaveBeenCalled();
  });

  it('wirft BAD_REQUEST wenn vor der Startfrage nie geöffnete Fragen liegen', async () => {
    const firstId = '11111111-1111-4111-8111-111111111111';
    const secondId = '22222222-2222-4222-8222-222222222222';
    const startId = '33333333-3333-4333-8333-333333333333';
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      status: 'RESULTS',
      currentQuestion: 2,
      questionProgress: {
        [startId]: {
          state: 'COMPLETED',
          openedAt: '2026-08-21T10:00:00.000Z',
          completedAt: '2026-08-21T10:01:00.000Z',
        },
      },
      questionProgressComplete: true,
      quiz: {
        questions: [
          { id: firstId, order: 0 },
          { id: secondId, order: 1 },
          { id: startId, order: 2 },
        ],
      },
    });

    await expect(caller.prevQuestion({ code: CODE })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Bereits bei der ersten Frage – Rückwärtsnavigation nicht möglich.',
    });
    expect(prismaMock.session.update).not.toHaveBeenCalled();
  });

  it('wirft BAD_REQUEST wenn die Vorgängerfrage ausgelassen wurde', async () => {
    const firstId = '11111111-1111-4111-8111-111111111111';
    const secondId = '22222222-2222-4222-8222-222222222222';
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      status: 'RESULTS',
      currentQuestion: 1,
      questionProgress: {
        [firstId]: {
          state: 'SKIPPED',
          openedAt: '2026-08-21T10:00:00.000Z',
          skippedAt: '2026-08-21T10:00:01.000Z',
        },
        [secondId]: {
          state: 'COMPLETED',
          openedAt: '2026-08-21T10:00:02.000Z',
          completedAt: '2026-08-21T10:01:00.000Z',
        },
      },
      questionProgressComplete: true,
      quiz: {
        questions: [
          { id: firstId, order: 0 },
          { id: secondId, order: 1 },
        ],
      },
    });

    await expect(caller.prevQuestion({ code: CODE })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Bereits bei der ersten Frage – Rückwärtsnavigation nicht möglich.',
    });
    expect(prismaMock.session.update).not.toHaveBeenCalled();
  });

  it.each(['SURVEY', 'FREETEXT', 'ORDERING', 'RATING'] as const)(
    'blaettert von RESULTS auf die vorherige %s-Frage ohne Musterloesung zurueck',
    async (previousType) => {
      const firstId = '11111111-1111-4111-8111-111111111111';
      const secondId = '22222222-2222-4222-8222-222222222222';
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        status: 'RESULTS',
        currentQuestion: 1,
        questionProgress: {
          [firstId]: {
            state: 'COMPLETED',
            openedAt: '2026-08-21T10:00:00.000Z',
            completedAt: '2026-08-21T10:01:00.000Z',
          },
          [secondId]: {
            state: 'COMPLETED',
            openedAt: '2026-08-21T10:01:00.000Z',
            completedAt: '2026-08-21T10:02:00.000Z',
          },
        },
        questionProgressComplete: true,
        quiz: {
          questions: [
            { id: firstId, order: 0, type: previousType },
            { id: secondId, order: 1, type: 'SINGLE_CHOICE' },
          ],
        },
      });
      prismaMock.session.update.mockResolvedValue({
        id: SESSION_ID,
        status: 'RESULTS',
        currentQuestion: 0,
      });

      const result = await caller.prevQuestion({ code: CODE });

      expect(result.status).toBe('RESULTS');
      expect(result.currentQuestion).toBe(0);
      expect(prismaMock.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SESSION_ID },
          data: expect.objectContaining({ status: 'RESULTS', currentQuestion: 0, currentRound: 1 }),
        }),
      );
    },
  );

  it('öffnet eine unter der Sperre bereits beendete Session nicht rückwärts erneut', async () => {
    prismaMock.session.findUnique.mockResolvedValueOnce({ id: SESSION_ID }).mockResolvedValueOnce({
      id: SESSION_ID,
      status: 'FINISHED',
      currentQuestion: null,
      questionProgress: null,
      questionProgressComplete: true,
      quiz: {
        questions: [
          { id: 'q1', order: 0 },
          { id: 'q2', order: 1 },
        ],
      },
    });

    await expect(caller.prevQuestion({ code: CODE })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Zurück nur aus Status RESULTS oder DISCUSSION möglich.',
    });
    expect(prismaMock.$executeRaw).toHaveBeenCalledOnce();
    expect(prismaMock.session.update).not.toHaveBeenCalled();
  });
});

describe('session peer-instruction steering gates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostAuthMocks.extractHostTokenMock.mockReturnValue('host-token-123');
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
    prismaMock.vote.findMany.mockResolvedValue([]);
    prismaMock.$executeRaw.mockResolvedValue(1);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      fn(prismaMock),
    );
  });

  it.each(['MATCHING', 'ORDERING', 'CATEGORIZATION'] as const)(
    'erlaubt den produktiven Diskussions- und Runde-2-Pfad für %s',
    async (type) => {
      prismaMock.session.findUnique
        .mockResolvedValueOnce({
          id: SESSION_ID,
          status: 'ACTIVE',
          currentQuestion: 0,
          currentRound: 1,
          activeQuestionStartedAt: new Date('2026-08-09T10:00:00.000Z'),
          quiz: {
            defaultTimer: null,
            timerScaleByDifficulty: true,
            questions: [
              {
                id: '33333333-3333-4333-8333-333333333333',
                type,
                timer: null,
                difficulty: 'MEDIUM',
              },
            ],
          },
        })
        .mockResolvedValueOnce({
          status: 'ACTIVE',
          currentQuestion: 0,
          currentRound: 1,
        })
        .mockResolvedValueOnce({
          id: SESSION_ID,
          status: 'DISCUSSION',
          currentQuestion: 0,
          quiz: { questions: [{ type }] },
        })
        .mockResolvedValueOnce({
          id: SESSION_ID,
          status: 'DISCUSSION',
          currentQuestion: 0,
          quiz: { questions: [{ type }] },
        });
      prismaMock.session.update.mockResolvedValue({ id: SESSION_ID });
      prismaMock.$executeRaw.mockResolvedValue(1);
      prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
        fn(prismaMock),
      );
      prismaMock.participant.groupBy.mockResolvedValue([]);
      prismaMock.vote.findMany.mockResolvedValue([
        { isCorrect: true },
        { isCorrect: false },
        { isCorrect: false },
      ]);

      await expect(caller.startDiscussion({ code: CODE })).resolves.toMatchObject({
        status: 'DISCUSSION',
        currentRound: 1,
      });
      await expect(caller.startSecondRound({ code: CODE })).resolves.toMatchObject({
        status: 'ACTIVE',
        currentRound: 2,
      });
    },
  );

  it.each(['MATCHING', 'ORDERING', 'CATEGORIZATION'] as const)(
    'lehnt die Diskussionsphase für %s bei 100 % vollständig richtigen Antworten ab',
    async (type) => {
      prismaMock.session.findUnique
        .mockResolvedValueOnce({
          id: SESSION_ID,
          status: 'ACTIVE',
          currentQuestion: 0,
          currentRound: 1,
          activeQuestionStartedAt: new Date('2026-08-09T10:00:00.000Z'),
          quiz: {
            defaultTimer: null,
            timerScaleByDifficulty: true,
            questions: [
              {
                id: '33333333-3333-4333-8333-333333333333',
                type,
                timer: null,
                difficulty: 'MEDIUM',
              },
            ],
          },
        })
        .mockResolvedValueOnce({ status: 'ACTIVE', currentQuestion: 0, currentRound: 1 });
      prismaMock.vote.findMany.mockResolvedValue([{ isCorrect: true }]);
      prismaMock.$executeRaw.mockResolvedValue(1);
      prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
        fn(prismaMock),
      );

      await expect(caller.startDiscussion({ code: CODE })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message:
          'Diskussionsphase nur bei einem Anteil vollständig korrekter Antworten zwischen einem Drittel und zwei Dritteln.',
      });
      expect(prismaMock.session.update).not.toHaveBeenCalled();
    },
  );

  it('verwirft eine überholte Diskussionsaktion, wenn ein paralleler Skip bereits weitergeschaltet hat', async () => {
    prismaMock.session.findUnique
      .mockResolvedValueOnce({
        id: SESSION_ID,
        status: 'ACTIVE',
        currentQuestion: 0,
        currentRound: 1,
        activeQuestionStartedAt: new Date('2026-08-09T10:00:00.000Z'),
        quiz: {
          defaultTimer: null,
          timerScaleByDifficulty: true,
          questions: [
            {
              id: '33333333-3333-4333-8333-333333333333',
              type: 'MATCHING',
              timer: null,
              difficulty: 'MEDIUM',
            },
          ],
        },
      })
      .mockResolvedValueOnce({ status: 'ACTIVE', currentQuestion: 1, currentRound: 1 });
    prismaMock.$executeRaw.mockResolvedValue(1);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      fn(prismaMock),
    );

    await expect(caller.startDiscussion({ code: CODE })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(prismaMock.vote.findMany).not.toHaveBeenCalled();
    expect(prismaMock.session.update).not.toHaveBeenCalled();
  });

  trpcDodIt(
    {
      procedure: 'session.startDiscussion',
      case: 'error',
      mode: 'direct',
      contract: 'BAD_REQUEST',
      title: 'lehnt die Diskussionsphase fuer NUMERIC_ESTIMATE ohne Zwei-Runden-Konfiguration ab',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        status: 'ACTIVE',
        currentQuestion: 0,
        currentRound: 1,
        quiz: {
          questions: [{ type: 'NUMERIC_ESTIMATE', numericTwoRounds: false }],
        },
      });

      await expect(caller.startDiscussion({ code: CODE })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: 'Diese Frage ist nicht für eine zweite Runde konfiguriert.',
      });
      expect(prismaMock.session.update).not.toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'session.startDiscussion',
      case: 'happy',
      mode: 'direct',
      title: 'startet die Diskussionsphase fuer NUMERIC_ESTIMATE mit Zwei-Runden-Konfiguration',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        status: 'ACTIVE',
        currentQuestion: 0,
        currentRound: 1,
        quiz: {
          questions: [{ type: 'NUMERIC_ESTIMATE', numericTwoRounds: true }],
        },
      });
      prismaMock.session.update.mockResolvedValue({
        id: SESSION_ID,
        status: 'DISCUSSION',
        currentQuestion: 0,
      });

      const result = await caller.startDiscussion({ code: CODE });

      expect(result).toEqual(
        expect.objectContaining({ status: 'DISCUSSION', currentQuestion: 0, currentRound: 1 }),
      );
      expect(prismaMock.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SESSION_ID },
          data: expect.objectContaining({ status: 'DISCUSSION' }),
        }),
      );
    },
  );

  trpcDodIt(
    {
      procedure: 'session.startSecondRound',
      case: 'happy',
      mode: 'direct',
      title: 'wechselt nach einer Diskussion in die zweite Abstimmungsrunde',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        status: 'DISCUSSION',
        currentQuestion: 0,
        quiz: {
          questions: [{ type: 'NUMERIC_ESTIMATE', numericTwoRounds: true }],
        },
      });

      const result = await caller.startSecondRound({ code: CODE });

      expect(result).toMatchObject({
        status: 'ACTIVE',
        currentQuestion: 0,
        currentRound: 2,
        activeAt: expect.any(String),
      });
      expect(prismaMock.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SESSION_ID },
          data: expect.objectContaining({ status: 'ACTIVE', currentRound: 2 }),
        }),
      );
      expect(loadSignalMocks.markCountdownSessionActive).toHaveBeenCalledWith(SESSION_ID);
    },
  );

  it('öffnet eine unter der Sperre bereits beendete Session nicht für Runde 2 erneut', async () => {
    prismaMock.session.findUnique.mockResolvedValueOnce({ id: SESSION_ID }).mockResolvedValueOnce({
      id: SESSION_ID,
      status: 'FINISHED',
      currentQuestion: null,
      quiz: { questions: [{ type: 'SINGLE_CHOICE', numericTwoRounds: false }] },
    });

    await expect(caller.startSecondRound({ code: CODE })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Zweite Runde nur aus Status DISCUSSION.',
    });
    expect(prismaMock.$executeRaw).toHaveBeenCalledOnce();
    expect(prismaMock.session.update).not.toHaveBeenCalled();
  });

  trpcDodIt(
    {
      procedure: 'session.startSecondRound',
      case: 'error',
      mode: 'direct',
      contract: 'BAD_REQUEST',
      title: 'lehnt Runde 2 fuer NUMERIC_ESTIMATE ohne Zwei-Runden-Konfiguration ab',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        status: 'DISCUSSION',
        currentQuestion: 0,
        quiz: {
          questions: [{ type: 'NUMERIC_ESTIMATE', numericTwoRounds: false }],
        },
      });

      await expect(caller.startSecondRound({ code: CODE })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: 'Diese Frage ist nicht für eine zweite Runde konfiguriert.',
      });
      expect(prismaMock.session.update).not.toHaveBeenCalled();
    },
  );
});
