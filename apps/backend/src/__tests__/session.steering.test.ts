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

  it('setzt FINISHED wenn nach letzter Frage', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      status: 'RESULTS',
      currentQuestion: 0,
      quiz: {
        readingPhaseEnabled: true,
        questions: [{ id: 'q1' }],
      },
    });
    prismaMock.session.update.mockResolvedValue({
      id: SESSION_ID,
      status: 'FINISHED',
      currentQuestion: null,
    });

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
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      status: 'RESULTS',
      currentQuestion: 0,
    });

    await expect(caller.prevQuestion({ code: CODE })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Bereits bei der ersten Frage – Rückwärtsnavigation nicht möglich.',
    });
  });
});

describe('session peer-instruction steering gates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostAuthMocks.extractHostTokenMock.mockReturnValue('host-token-123');
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
    prismaMock.vote.findMany.mockResolvedValue([]);
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
