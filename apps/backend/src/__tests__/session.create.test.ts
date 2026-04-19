import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  prismaMock,
  checkSessionCreateRateMock,
  shouldBypassSessionCreateRateMock,
  createHostSessionTokenMock,
} = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    quiz: {
      findUnique: vi.fn(),
    },
    team: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
  checkSessionCreateRateMock: vi.fn(),
  shouldBypassSessionCreateRateMock: vi.fn(),
  createHostSessionTokenMock: vi.fn(),
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/rateLimit', () => ({
  checkSessionCreateRate: checkSessionCreateRateMock,
  shouldBypassSessionCreateRate: shouldBypassSessionCreateRateMock,
}));

vi.mock('../lib/hostAuth', () => ({
  createHostSessionToken: createHostSessionTokenMock,
}));

import { sessionRouter } from '../routers/session';

const caller = sessionRouter.createCaller({ req: undefined });
const SESSION_ID = '6a8edced-5f8f-4cfa-9176-454fac9570ad';
const QUIZ_ID = '11111111-1111-4111-8111-111111111111';
const CODE = 'ABC123';
const HOST_TOKEN = 'host-token-123';

describe('session.create (Story 2.1a)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkSessionCreateRateMock.mockResolvedValue({ allowed: true });
    shouldBypassSessionCreateRateMock.mockReturnValue(false);
    createHostSessionTokenMock.mockResolvedValue(HOST_TOKEN);
    prismaMock.session.findUnique.mockResolvedValue(null);
    prismaMock.quiz.findUnique.mockResolvedValue({
      id: QUIZ_ID,
      name: 'Mein Quiz',
      nicknameTheme: 'HIGH_SCHOOL',
      allowCustomNicknames: false,
      anonymousMode: false,
      teamMode: false,
      teamCount: null,
      teamAssignment: 'AUTO',
      teamNames: [],
    });
    prismaMock.session.create.mockResolvedValue({
      id: SESSION_ID,
      code: CODE,
      type: 'QUIZ',
      status: 'LOBBY',
      quizId: QUIZ_ID,
      qaEnabled: false,
      qaOpen: false,
      qaTitle: null,
      qaModerationMode: false,
      quickFeedbackEnabled: false,
      quickFeedbackOpen: false,
      quiz: { name: 'Mein Quiz', teamMode: false, teamCount: null, teamNames: [] },
    });
  });

  it('erstellt Session mit Code und Status LOBBY', async () => {
    const result = await caller.create({ quizId: QUIZ_ID });

    expect(result.sessionId).toBe(SESSION_ID);
    expect(result.code).toBe(CODE);
    expect(result.status).toBe('LOBBY');
    expect(result.quizName).toBe('Mein Quiz');
    expect(result.hostToken).toBe(HOST_TOKEN);
    expect(prismaMock.session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'LOBBY',
          type: 'QUIZ',
          quizId: QUIZ_ID,
          qaEnabled: false,
          qaOpen: false,
          qaTitle: null,
          qaModerationMode: false,
          quickFeedbackEnabled: false,
          quickFeedbackOpen: false,
          onboardingProfileConfigured: true,
          onboardingAllowCustomNicknames: false,
          onboardingAnonymousMode: false,
          onboardingTeamMode: false,
          onboardingTeamCount: null,
          onboardingTeamAssignment: 'AUTO',
          onboardingTeamNames: [],
          onboardingNicknameTheme: 'HIGH_SCHOOL',
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
      qaOpen: true,
      qaTitle: 'Fragen',
      qaModerationMode: true,
      quickFeedbackEnabled: false,
      quickFeedbackOpen: false,
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
          qaOpen: true,
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
      qaOpen: true,
      qaTitle: 'Fragen zum Kapitel 3',
      qaModerationMode: true,
      quickFeedbackEnabled: true,
      quickFeedbackOpen: true,
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
          qaOpen: true,
          qaTitle: 'Fragen zum Kapitel 3',
          qaModerationMode: true,
          quickFeedbackEnabled: true,
          quickFeedbackOpen: true,
        }),
      }),
    );
  });

  it('erstellt eine quizlose Quiz-Session mit aktiviertem Q&A-Kanal', async () => {
    prismaMock.session.create.mockResolvedValueOnce({
      id: SESSION_ID,
      code: CODE,
      type: 'QUIZ',
      status: 'LOBBY',
      quizId: null,
      title: 'Offene Fragerunde',
      moderationMode: true,
      qaEnabled: true,
      qaOpen: true,
      qaTitle: 'Offene Fragerunde',
      qaModerationMode: true,
      quickFeedbackEnabled: false,
      quickFeedbackOpen: false,
      quiz: null,
    });

    const result = await caller.create({
      type: 'QUIZ',
      qaEnabled: true,
      title: '  Offene Fragerunde  ',
    });

    expect(result).toEqual({
      sessionId: SESSION_ID,
      code: CODE,
      status: 'LOBBY',
      quizName: null,
      hostToken: HOST_TOKEN,
    });
    expect(prismaMock.session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'QUIZ',
          quizId: null,
          title: 'Offene Fragerunde',
          moderationMode: true,
          qaEnabled: true,
          qaOpen: true,
          qaTitle: 'Offene Fragerunde',
          qaModerationMode: true,
          quickFeedbackEnabled: false,
          quickFeedbackOpen: false,
          onboardingProfileConfigured: true,
          onboardingAllowCustomNicknames: true,
          onboardingAnonymousMode: false,
          onboardingTeamMode: false,
          onboardingTeamCount: null,
          onboardingTeamAssignment: 'AUTO',
          onboardingTeamNames: [],
          onboardingNicknameTheme: 'HIGH_SCHOOL',
          status: 'LOBBY',
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
      qaOpen: true,
      quickFeedbackOpen: false,
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
      hostToken: HOST_TOKEN,
    });
    expect(prismaMock.session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'Q_AND_A',
          quizId: null,
          title: 'Offene Fragerunde',
          moderationMode: true,
          qaEnabled: true,
          qaOpen: true,
          qaTitle: 'Offene Fragerunde',
          qaModerationMode: true,
          quickFeedbackEnabled: false,
          quickFeedbackOpen: false,
          onboardingProfileConfigured: true,
          onboardingAllowCustomNicknames: true,
          onboardingAnonymousMode: false,
          onboardingTeamMode: false,
          onboardingTeamCount: null,
          onboardingTeamAssignment: 'AUTO',
          onboardingTeamNames: [],
          onboardingNicknameTheme: 'HIGH_SCHOOL',
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
      qaOpen: false,
      qaTitle: null,
      qaModerationMode: false,
      quickFeedbackEnabled: true,
      quickFeedbackOpen: true,
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
      hostToken: HOST_TOKEN,
    });
    expect(prismaMock.session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'QUIZ',
          quizId: null,
          qaEnabled: false,
          qaOpen: false,
          qaTitle: null,
          qaModerationMode: false,
          quickFeedbackEnabled: true,
          quickFeedbackOpen: true,
          onboardingProfileConfigured: true,
          onboardingAllowCustomNicknames: true,
          onboardingAnonymousMode: false,
          onboardingTeamMode: false,
          onboardingTeamCount: null,
          onboardingTeamAssignment: 'AUTO',
          onboardingTeamNames: [],
          onboardingNicknameTheme: 'HIGH_SCHOOL',
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
