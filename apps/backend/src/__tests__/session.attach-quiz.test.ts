import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, hostAuthMocks } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    quiz: {
      findUnique: vi.fn(),
    },
    team: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    participant: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
  hostAuthMocks: {
    extractHostTokenMock: vi.fn(),
    extractHostTokenFromConnectionParamsMock: vi.fn(() => null as string | null),
    isHostSessionTokenValidMock: vi.fn(),
  },
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/rateLimit', () => ({
  checkSessionCreateRate: vi.fn(),
  isSessionCodeLockedOut: vi.fn(),
  recordFailedSessionCodeAttempt: vi.fn(),
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
const SESSION_ID = '6a8edced-5f8f-4cfa-9176-454fac9570ad';
const QUIZ_ID = '11111111-1111-4111-8111-111111111111';
const TEAM_A = '22222222-2222-4222-8222-222222222222';
const TEAM_B = '33333333-3333-4333-8333-333333333333';

describe('session.attachQuizToSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostAuthMocks.extractHostTokenMock.mockReturnValue('host-token-123');
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
    prismaMock.team.createMany.mockResolvedValue({ count: 2 });
    prismaMock.team.findMany.mockResolvedValue([
      { id: TEAM_A, name: 'Team A', color: '#1E88E5', _count: { participants: 0 } },
      { id: TEAM_B, name: 'Team B', color: '#43A047', _count: { participants: 0 } },
    ]);
    prismaMock.participant.findMany.mockResolvedValue([]);
  });

  it('hängt ein Quiz an eine laufende Quiz-Session ohne Quiz an', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      status: 'LOBBY',
      quizId: null,
      qaEnabled: true,
      qaOpen: true,
      qaTitle: 'Fragen',
      qaModerationMode: true,
      title: null,
      moderationMode: false,
      quickFeedbackEnabled: true,
      quickFeedbackOpen: true,
      _count: { participants: 3 },
    });
    prismaMock.quiz.findUnique.mockResolvedValue({
      id: QUIZ_ID,
      teamMode: false,
      teamCount: null,
      teamAssignment: 'AUTO',
      teamNames: [],
    });
    prismaMock.session.update.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      quizId: QUIZ_ID,
      qaEnabled: true,
      qaOpen: true,
      qaTitle: 'Fragen',
      qaModerationMode: true,
      title: null,
      moderationMode: false,
      quickFeedbackEnabled: true,
      quickFeedbackOpen: true,
    });

    const result = await caller.attachQuizToSession({ code: 'abc123', quizId: QUIZ_ID });

    expect(prismaMock.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SESSION_ID },
        data: { type: 'QUIZ', quizId: QUIZ_ID, currentQuestion: null, currentRound: 1 },
        select: expect.any(Object),
      }),
    );
    expect(result.quiz.enabled).toBe(true);
    expect(result.qa.enabled).toBe(true);
    expect(result.quickFeedback.enabled).toBe(true);
    expect(prismaMock.participant.update).not.toHaveBeenCalled();
  });

  it('weist bestehende Teilnehmende bei AUTO-Teammodus nachträglich Teams zu', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      status: 'LOBBY',
      quizId: null,
      qaEnabled: false,
      qaOpen: false,
      qaTitle: null,
      qaModerationMode: false,
      title: null,
      moderationMode: false,
      quickFeedbackEnabled: true,
      quickFeedbackOpen: true,
      _count: { participants: 3 },
    });
    prismaMock.quiz.findUnique.mockResolvedValue({
      id: QUIZ_ID,
      teamMode: true,
      teamCount: 2,
      teamAssignment: 'AUTO',
      teamNames: ['Rot', 'Blau'],
    });
    prismaMock.session.update.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      quizId: QUIZ_ID,
      qaEnabled: false,
      qaOpen: false,
      qaTitle: null,
      qaModerationMode: false,
      title: null,
      moderationMode: false,
      quickFeedbackEnabled: true,
      quickFeedbackOpen: true,
    });
    prismaMock.participant.findMany.mockResolvedValue([
      { id: 'p-1', teamId: null },
      { id: 'p-2', teamId: null },
      { id: 'p-3', teamId: null },
    ]);

    await caller.attachQuizToSession({ code: 'ABC123', quizId: QUIZ_ID });

    expect(prismaMock.participant.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'p-1' },
      data: { teamId: TEAM_A },
    });
    expect(prismaMock.participant.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'p-2' },
      data: { teamId: TEAM_B },
    });
    expect(prismaMock.participant.update).toHaveBeenNthCalledWith(3, {
      where: { id: 'p-3' },
      data: { teamId: TEAM_A },
    });
  });

  it('lehnt Team-Quiz mit manueller Teamwahl ab, wenn bereits Teilnehmende verbunden sind', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      status: 'LOBBY',
      quizId: null,
      qaEnabled: false,
      qaOpen: false,
      qaTitle: null,
      qaModerationMode: false,
      title: null,
      moderationMode: false,
      quickFeedbackEnabled: false,
      quickFeedbackOpen: false,
      _count: { participants: 2 },
    });
    prismaMock.quiz.findUnique.mockResolvedValue({
      id: QUIZ_ID,
      teamMode: true,
      teamCount: 2,
      teamAssignment: 'MANUAL',
      teamNames: ['Rot', 'Blau'],
    });

    await expect(
      caller.attachQuizToSession({ code: 'ABC123', quizId: QUIZ_ID }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message:
        'Team-Quiz mit manueller Teamwahl können nur angehängt werden, solange noch niemand beigetreten ist.',
    });

    expect(prismaMock.session.update).not.toHaveBeenCalled();
  });

  it('konvertiert eine alte Q_AND_A-Session beim Anhängen in eine QUIZ-Session', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      type: 'Q_AND_A',
      status: 'ACTIVE',
      quizId: null,
      qaEnabled: true,
      qaOpen: true,
      qaTitle: 'Fragen',
      qaModerationMode: true,
      title: 'Fragen',
      moderationMode: true,
      quickFeedbackEnabled: false,
      quickFeedbackOpen: false,
      _count: { participants: 0 },
    });
    prismaMock.quiz.findUnique.mockResolvedValue({
      id: QUIZ_ID,
      teamMode: false,
      teamCount: null,
      teamAssignment: 'AUTO',
      teamNames: [],
    });
    prismaMock.session.update.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      quizId: QUIZ_ID,
      qaEnabled: true,
      qaOpen: true,
      qaTitle: 'Fragen',
      qaModerationMode: true,
      title: 'Fragen',
      moderationMode: true,
      quickFeedbackEnabled: false,
      quickFeedbackOpen: false,
    });

    const result = await caller.attachQuizToSession({ code: 'ABC123', quizId: QUIZ_ID });

    expect(prismaMock.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SESSION_ID },
        data: expect.objectContaining({ type: 'QUIZ', quizId: QUIZ_ID }),
      }),
    );
    expect(result.quiz.enabled).toBe(true);
    expect(result.qa.enabled).toBe(true);
  });
});
