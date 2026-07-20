import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, hostAuthMocks, readingReadyMocks, platformStatisticMocks, loadSignalMocks } =
  vi.hoisted(() => ({
    prismaMock: {
      session: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      participant: {
        groupBy: vi.fn(),
      },
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
  });

  it('wechselt von LOBBY zu QUESTION_OPEN wenn Lesephase aktiv', async () => {
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
  });

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

  it('wirft NOT_FOUND wenn Session fehlt', async () => {
    prismaMock.session.findUnique.mockResolvedValue(null);

    await expect(caller.nextQuestion({ code: 'NONEXI' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Session oder Quiz nicht gefunden.',
    });
  });

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

describe('session.revealAnswers (Story 2.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wechselt von QUESTION_OPEN zu ACTIVE', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      status: 'QUESTION_OPEN',
      currentQuestion: 0,
      currentRound: 1,
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

  it('wirft BAD_REQUEST wenn nicht QUESTION_OPEN', async () => {
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
  });
});

describe('session.revealResults (Story 2.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostAuthMocks.extractHostTokenMock.mockReturnValue('host-token-123');
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
  });

  it('wechselt von ACTIVE zu RESULTS', async () => {
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
  });

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

  it('wirft BAD_REQUEST wenn nicht ACTIVE', async () => {
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
  });
});

describe('session.prevQuestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostAuthMocks.extractHostTokenMock.mockReturnValue('host-token-123');
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
  });

  it('wechselt von RESULTS zu RESULTS mit vorheriger Frage', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      status: 'RESULTS',
      currentQuestion: 2,
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
  });

  it('wirft BAD_REQUEST wenn Status nicht RESULTS oder DISCUSSION', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      status: 'ACTIVE',
      currentQuestion: 2,
    });

    await expect(caller.prevQuestion({ code: CODE })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Zurück nur aus Status RESULTS oder DISCUSSION möglich.',
    });
  });

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
  });

  it('lehnt die Diskussionsphase fuer NUMERIC_ESTIMATE ohne Zwei-Runden-Konfiguration ab', async () => {
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
  });

  it('startet die Diskussionsphase fuer NUMERIC_ESTIMATE mit Zwei-Runden-Konfiguration', async () => {
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
  });

  it('lehnt Runde 2 fuer NUMERIC_ESTIMATE ohne Zwei-Runden-Konfiguration ab', async () => {
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
  });
});
