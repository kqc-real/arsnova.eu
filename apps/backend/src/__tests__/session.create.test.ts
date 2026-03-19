import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, checkSessionCreateRateMock, shouldBypassSessionCreateRateMock } = vi.hoisted(
  () => ({
    prismaMock: {
      session: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      team: {
        findMany: vi.fn(),
        createMany: vi.fn(),
      },
    },
    checkSessionCreateRateMock: vi.fn(),
    shouldBypassSessionCreateRateMock: vi.fn(),
  }),
);

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/rateLimit', () => ({
  checkSessionCreateRate: checkSessionCreateRateMock,
  shouldBypassSessionCreateRate: shouldBypassSessionCreateRateMock,
}));

import { sessionRouter } from '../routers/session';

const caller = sessionRouter.createCaller({ req: undefined });
const SESSION_ID = '6a8edced-5f8f-4cfa-9176-454fac9570ad';
const QUIZ_ID = '11111111-1111-4111-8111-111111111111';
const CODE = 'ABC123';

describe('session.create (Story 2.1a)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkSessionCreateRateMock.mockResolvedValue({ allowed: true });
    shouldBypassSessionCreateRateMock.mockReturnValue(false);
    prismaMock.session.findUnique.mockResolvedValue(null);
    prismaMock.session.create.mockResolvedValue({
      id: SESSION_ID,
      code: CODE,
      type: 'QUIZ',
      status: 'LOBBY',
      quizId: QUIZ_ID,
      qaEnabled: false,
      qaTitle: null,
      qaModerationMode: false,
      quickFeedbackEnabled: false,
      quiz: { name: 'Mein Quiz', teamMode: false, teamCount: null, teamNames: [] },
    });
  });

  it('erstellt Session mit Code und Status LOBBY', async () => {
    const result = await caller.create({ quizId: QUIZ_ID });

    expect(result.sessionId).toBe(SESSION_ID);
    expect(result.code).toBe(CODE);
    expect(result.status).toBe('LOBBY');
    expect(result.quizName).toBe('Mein Quiz');
    expect(prismaMock.session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'LOBBY',
          type: 'QUIZ',
          quizId: QUIZ_ID,
          qaEnabled: false,
          qaTitle: null,
          qaModerationMode: false,
          quickFeedbackEnabled: false,
        }),
      }),
    );
  });

  it('setzt Q&A-Vorab-Moderation standardmäßig an wenn Q&A aktiviert', async () => {
    prismaMock.session.create.mockResolvedValueOnce({
      id: SESSION_ID,
      code: CODE,
      type: 'QUIZ',
      status: 'LOBBY',
      quizId: QUIZ_ID,
      qaEnabled: true,
      qaTitle: 'Fragen',
      qaModerationMode: true,
      quickFeedbackEnabled: false,
      quiz: { name: 'Mein Quiz', teamMode: false, teamCount: null, teamNames: [] },
    });

    await caller.create({
      quizId: QUIZ_ID,
      qaEnabled: true,
      qaTitle: 'Fragen',
    });

    expect(prismaMock.session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          qaEnabled: true,
          qaTitle: 'Fragen',
          qaModerationMode: true,
        }),
      }),
    );
  });

  it('aktiviert optionale Live-Kanäle für Quiz-Sessions', async () => {
    prismaMock.session.create.mockResolvedValueOnce({
      id: SESSION_ID,
      code: CODE,
      type: 'QUIZ',
      status: 'LOBBY',
      quizId: QUIZ_ID,
      qaEnabled: true,
      qaTitle: 'Fragen zum Kapitel 3',
      qaModerationMode: true,
      quickFeedbackEnabled: true,
      quiz: { name: 'Mein Quiz', teamMode: false, teamCount: null, teamNames: [] },
    });

    await caller.create({
      quizId: QUIZ_ID,
      qaEnabled: true,
      qaTitle: '  Fragen zum Kapitel 3  ',
      qaModerationMode: true,
      quickFeedbackEnabled: true,
    });

    expect(prismaMock.session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'QUIZ',
          quizId: QUIZ_ID,
          qaEnabled: true,
          qaTitle: 'Fragen zum Kapitel 3',
          qaModerationMode: true,
          quickFeedbackEnabled: true,
        }),
      }),
    );
  });

  it('erstellt Q&A-Session ohne quizId und mit optionalem Titel', async () => {
    prismaMock.session.create.mockResolvedValueOnce({
      id: SESSION_ID,
      code: CODE,
      type: 'Q_AND_A',
      status: 'LOBBY',
      quizId: null,
      title: 'Offene Fragerunde',
      quiz: null,
    });

    const result = await caller.create({
      type: 'Q_AND_A',
      title: '  Offene Fragerunde  ',
    });

    expect(result).toEqual({
      sessionId: SESSION_ID,
      code: CODE,
      status: 'LOBBY',
      quizName: null,
    });
    expect(prismaMock.session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'Q_AND_A',
          quizId: null,
          title: 'Offene Fragerunde',
          moderationMode: true,
          qaEnabled: true,
          qaTitle: 'Offene Fragerunde',
          qaModerationMode: true,
          quickFeedbackEnabled: false,
          status: 'LOBBY',
        }),
      }),
    );
  });

  it('erlaubt Blitzlicht-only ohne quizId', async () => {
    prismaMock.session.create.mockResolvedValueOnce({
      id: SESSION_ID,
      code: CODE,
      type: 'QUIZ',
      status: 'LOBBY',
      quizId: null,
      qaEnabled: false,
      qaTitle: null,
      qaModerationMode: false,
      quickFeedbackEnabled: true,
      quiz: null,
    });

    const result = await caller.create({
      type: 'QUIZ',
      quickFeedbackEnabled: true,
    });

    expect(result).toEqual({
      sessionId: SESSION_ID,
      code: CODE,
      status: 'LOBBY',
      quizName: null,
    });
    expect(prismaMock.session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'QUIZ',
          quizId: null,
          qaEnabled: false,
          qaTitle: null,
          qaModerationMode: false,
          quickFeedbackEnabled: true,
          status: 'LOBBY',
        }),
      }),
    );
  });

  it('lehnt Quiz-Sessions ohne quizId ab', async () => {
    await expect(caller.create({})).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });

    expect(prismaMock.session.create).not.toHaveBeenCalled();
  });

  it('wirft TOO_MANY_REQUESTS wenn Rate-Limit überschritten', async () => {
    checkSessionCreateRateMock.mockResolvedValue({ allowed: false, remaining: 0 });

    await expect(caller.create({ quizId: QUIZ_ID })).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });

    expect(prismaMock.session.create).not.toHaveBeenCalled();
  });

  it('umgeht das Session-Rate-Limit lokal in der Entwicklung', async () => {
    shouldBypassSessionCreateRateMock.mockReturnValue(true);
    checkSessionCreateRateMock.mockResolvedValue({ allowed: false, remaining: 0 });

    const result = await caller.create({ quizId: QUIZ_ID });

    expect(result.sessionId).toBe(SESSION_ID);
    expect(checkSessionCreateRateMock).not.toHaveBeenCalled();
    expect(prismaMock.session.create).toHaveBeenCalled();
  });
});
