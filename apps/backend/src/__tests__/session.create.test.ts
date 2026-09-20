import type { IncomingMessage } from 'node:http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';

const {
  prismaMock,
  checkSessionCreateRateMock,
  shouldBypassSessionCreateRateMock,
  createCredentialBoundHostTokenMock,
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
  createCredentialBoundHostTokenMock: vi.fn(),
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/rateLimit', () => ({
  checkSessionCreateRate: checkSessionCreateRateMock,
  shouldBypassSessionCreateRate: shouldBypassSessionCreateRateMock,
}));

vi.mock('../lib/hostAuth', () => ({
  createCredentialBoundHostToken: createCredentialBoundHostTokenMock,
}));

import { sessionRouter } from '../routers/session';

const caller = sessionRouter.createCaller({ req: undefined });
const SESSION_ID = '6a8edced-5f8f-4cfa-9176-454fac9570ad';
const QUIZ_ID = '11111111-1111-4111-8111-111111111111';
const CODE = 'ABC123';
const HOST_TOKEN = 'host-token-123';
const HOST_TOKEN_EXPIRES_AT = '2026-03-14T12:15:00.000Z';

describe('session.create (Story 2.1a)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkSessionCreateRateMock.mockResolvedValue({ allowed: true });
    shouldBypassSessionCreateRateMock.mockReturnValue(false);
    createCredentialBoundHostTokenMock.mockResolvedValue({
      token: HOST_TOKEN,
      expiresAt: HOST_TOKEN_EXPIRES_AT,
    });
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
      _count: { questions: 3 },
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

  trpcDodIt(
    {
      procedure: 'session.create',
      case: 'happy',
      mode: 'direct',
      title: 'erstellt Session mit Code und Status LOBBY',
    },
    async () => {
      const result = await caller.create({ quizId: QUIZ_ID });

      expect(result.sessionId).toBe(SESSION_ID);
      expect(result.code).toBe(CODE);
      expect(result.status).toBe('LOBBY');
      expect(result.quizName).toBe('Mein Quiz');
      expect(result.hostToken).toBe(HOST_TOKEN);
      expect(createCredentialBoundHostTokenMock).toHaveBeenCalledOnce();
      expect(createCredentialBoundHostTokenMock).toHaveBeenCalledWith({
        sessionCode: CODE,
        credentialVersion: 1,
      });
      expect(prismaMock.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'LOBBY',
            currentQuestion: null,
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
    },
  );

  it('setzt beim Start ab bestimmter Frage nur den initialen Fragenzeiger', async () => {
    await caller.create({ quizId: QUIZ_ID, startQuestionIndex: 2 });

    expect(prismaMock.session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quizId: QUIZ_ID,
          currentQuestion: 1,
        }),
      }),
    );
  });

  trpcDodIt(
    {
      procedure: 'session.create',
      case: 'error',
      mode: 'direct',
      contract: 'BAD_REQUEST',
      title: 'weist einen Startindex außerhalb des Quiz zurück',
    },
    async () => {
      await expect(caller.create({ quizId: QUIZ_ID, startQuestionIndex: 3 })).rejects.toMatchObject(
        {
          code: 'BAD_REQUEST',
        },
      );

      expect(prismaMock.session.create).not.toHaveBeenCalled();
    },
  );

  it('setzt Q&A-Vorab-Moderation standardmäßig an wenn Q&A aktiviert', async () => {
    prismaMock.session.create.mockResolvedValueOnce({
      id: SESSION_ID,
      code: CODE,
      type: 'QUIZ',
      status: 'LOBBY',
      quizId: QUIZ_ID,
      qaEnabled: true,
      qaOpen: false,
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
          qaOpen: false,
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
      qaOpen: false,
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
          qaOpen: false,
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

    expect(result).toMatchObject({
      sessionId: SESSION_ID,
      code: CODE,
      status: 'LOBBY',
      quizName: null,
      hostToken: HOST_TOKEN,
      timeZone: 'UTC',
      sessionLifecycleRevision: 0,
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
          onboardingAllowCustomNicknames: false,
          onboardingAnonymousMode: false,
          onboardingTeamMode: false,
          onboardingTeamCount: null,
          onboardingTeamAssignment: 'AUTO',
          onboardingTeamNames: [],
          onboardingNicknameTheme: 'KINDERGARTEN',
          status: 'LOBBY',
        }),
      }),
    );
    const createData = prismaMock.session.create.mock.calls.at(-1)?.[0]?.data as {
      qaClosesAt: Date;
      expiresAt: Date;
    };
    expect(createData.qaClosesAt).toEqual(createData.expiresAt);
  });

  it.each([
    {
      label: 'vorgegebene Pseudonyme',
      allowCustomNicknames: false,
      anonymousMode: false,
      nicknameTheme: 'PRIMARY_SCHOOL' as const,
    },
    {
      label: 'eigene Nicknames',
      allowCustomNicknames: true,
      anonymousMode: false,
      nicknameTheme: 'HIGH_SCHOOL' as const,
    },
    {
      label: 'Anonymmodus',
      allowCustomNicknames: false,
      anonymousMode: true,
      nicknameTheme: 'MIDDLE_SCHOOL' as const,
    },
  ])('persistiert $label beim direkten Q&A-Start ohne Quiz', async (profile) => {
    await caller.create({
      type: 'QUIZ',
      qaEnabled: true,
      allowCustomNicknames: profile.allowCustomNicknames,
      anonymousMode: profile.anonymousMode,
      nicknameTheme: profile.nicknameTheme,
    });

    expect(prismaMock.session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quizId: null,
          qaEnabled: true,
          onboardingProfileConfigured: true,
          onboardingAllowCustomNicknames: profile.allowCustomNicknames,
          onboardingAnonymousMode: profile.anonymousMode,
          onboardingNicknameTheme: profile.nicknameTheme,
          qaOpen: true,
          qaTitle: 'Fragen & Antworten',
        }),
      }),
    );
    const createData = prismaMock.session.create.mock.calls.at(-1)?.[0]?.data as {
      qaClosesAt: Date;
      expiresAt: Date;
    };
    expect(createData.qaClosesAt).toEqual(createData.expiresAt);
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

    expect(result).toMatchObject({
      sessionId: SESSION_ID,
      code: CODE,
      status: 'LOBBY',
      quizName: null,
      hostToken: HOST_TOKEN,
      timeZone: 'UTC',
      sessionLifecycleRevision: 0,
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
          onboardingAllowCustomNicknames: false,
          onboardingAnonymousMode: false,
          onboardingTeamMode: false,
          onboardingTeamCount: null,
          onboardingTeamAssignment: 'AUTO',
          onboardingTeamNames: [],
          onboardingNicknameTheme: 'KINDERGARTEN',
          status: 'LOBBY',
        }),
      }),
    );
    const createData = prismaMock.session.create.mock.calls.at(-1)?.[0]?.data as {
      qaClosesAt: Date;
      expiresAt: Date;
    };
    expect(createData.qaClosesAt).toEqual(createData.expiresAt);
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

    expect(result).toMatchObject({
      sessionId: SESSION_ID,
      code: CODE,
      status: 'LOBBY',
      quizName: null,
      hostToken: HOST_TOKEN,
      timeZone: 'UTC',
      sessionLifecycleRevision: 0,
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
          onboardingAllowCustomNicknames: false,
          onboardingAnonymousMode: false,
          onboardingTeamMode: false,
          onboardingTeamCount: null,
          onboardingTeamAssignment: 'AUTO',
          onboardingTeamNames: [],
          onboardingNicknameTheme: 'KINDERGARTEN',
          status: 'LOBBY',
        }),
      }),
    );
  });

  it('erlaubt Quiz-Sessions ohne quizId als leeren Quizkanal', async () => {
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
      quickFeedbackEnabled: false,
      quickFeedbackOpen: false,
      quiz: null,
    });

    const result = await caller.create({ type: 'QUIZ' });

    expect(result).toMatchObject({
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
          quickFeedbackEnabled: false,
          preferredChannel: 'quiz',
        }),
      }),
    );
  });

  it('wirft TOO_MANY_REQUESTS wenn Rate-Limit überschritten', async () => {
    checkSessionCreateRateMock.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 900,
    });

    await expect(caller.create({ quizId: QUIZ_ID })).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
      message: 'Zu viele Session-Erstellungen. Bitte später erneut versuchen.',
      cause: { retryAfterSeconds: 900 },
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

  it('verwendet für den Rate-Limit-Bucket nur Express req.ip', async () => {
    const req = {
      headers: {
        'cf-connecting-ip': '203.0.113.1',
        'true-client-ip': '203.0.113.2',
        'x-forwarded-for': '203.0.113.3',
        'x-real-ip': '203.0.113.4',
      },
      ip: '198.51.100.77',
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as IncomingMessage;
    const trustedIpCaller = sessionRouter.createCaller({ req });

    await trustedIpCaller.create({ quizId: QUIZ_ID });

    expect(shouldBypassSessionCreateRateMock).toHaveBeenCalledWith('198.51.100.77');
    expect(checkSessionCreateRateMock).toHaveBeenCalledWith('198.51.100.77');
  });
});
