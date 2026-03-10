import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

import { sessionRouter } from '../routers/session';

const caller = sessionRouter.createCaller({ req: undefined });
const SESSION_ID = '6a8edced-5f8f-4cfa-9176-454fac9570ad';
const CODE = 'ABC123';

describe('session.nextQuestion (Story 2.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it('wechselt von ACTIVE zu RESULTS', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      status: 'ACTIVE',
      currentQuestion: 0,
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

  it('wirft BAD_REQUEST wenn nicht ACTIVE', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      status: 'RESULTS',
      currentQuestion: 0,
    });

    await expect(caller.revealResults({ code: CODE })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Ergebnis anzeigen nur im Status ACTIVE.',
    });
  });
});
