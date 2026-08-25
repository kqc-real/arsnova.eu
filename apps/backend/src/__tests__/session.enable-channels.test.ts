import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';

const { prismaMock, hostAuthMocks } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
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

describe('session.enable channel mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostAuthMocks.extractHostTokenMock.mockReturnValue('host-token-123');
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
  });

  trpcDodIt(
    {
      procedure: 'session.enableQaChannel',
      case: 'happy',
      mode: 'direct',
      title: 'aktiviert den Q&A-Kanal für eine Quiz-Session',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
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
      });
      prismaMock.session.update.mockResolvedValue({
        type: 'QUIZ',
        quizId: '11111111-1111-4111-8111-111111111111',
        qaEnabled: true,
        qaOpen: true,
        qaTitle: null,
        qaModerationMode: true,
        title: null,
        moderationMode: false,
        quickFeedbackEnabled: false,
        quickFeedbackOpen: false,
      });

      const result = await caller.enableQaChannel({ code: 'abc123' });

      expect(prismaMock.session.update).toHaveBeenCalledWith({
        where: { id: SESSION_ID },
        data: { qaEnabled: true, qaOpen: true, qaModerationMode: false },
        select: expect.any(Object),
      });
      expect(result.qa.enabled).toBe(true);
      expect(result.qa.open).toBe(true);
      expect(result.quickFeedback.enabled).toBe(false);
    },
  );

  trpcDodIt(
    {
      procedure: 'session.enableQuickFeedbackChannel',
      case: 'happy',
      mode: 'direct',
      title: 'aktiviert den Blitzlicht-Kanal für eine Session',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
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
      });
      prismaMock.session.update.mockResolvedValue({
        type: 'QUIZ',
        quizId: '11111111-1111-4111-8111-111111111111',
        qaEnabled: false,
        qaOpen: false,
        qaTitle: null,
        qaModerationMode: false,
        title: null,
        moderationMode: false,
        quickFeedbackEnabled: true,
        quickFeedbackOpen: true,
      });

      const result = await caller.enableQuickFeedbackChannel({ code: 'ABC123' });

      expect(prismaMock.session.update).toHaveBeenCalledWith({
        where: { id: SESSION_ID },
        data: { quickFeedbackEnabled: true, quickFeedbackOpen: true },
        select: expect.any(Object),
      });
      expect(result.quickFeedback.enabled).toBe(true);
      expect(result.quickFeedback.open).toBe(true);
      expect(result.qa.enabled).toBe(false);
    },
  );

  it('ist idempotent, wenn der Kanal bereits aktiv ist', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      quizId: '11111111-1111-4111-8111-111111111111',
      qaEnabled: true,
      qaOpen: true,
      qaTitle: 'Fragen',
      qaModerationMode: true,
      title: null,
      moderationMode: false,
      quickFeedbackEnabled: true,
      quickFeedbackOpen: true,
    });

    const result = await caller.enableQaChannel({ code: 'ABC123' });

    expect(prismaMock.session.update).not.toHaveBeenCalled();
    expect(result.qa.enabled).toBe(true);
    expect(result.qa.open).toBe(true);
    expect(result.quickFeedback.enabled).toBe(true);
    expect(result.quickFeedback.open).toBe(true);
  });

  trpcDodIt(
    {
      procedure: 'session.closeQaChannel',
      case: 'happy',
      mode: 'direct',
      title: 'schließt und öffnet den Q&A-Kanal ohne die Aktivierung zu verlieren',
    },
    async () => {
      prismaMock.session.findUnique
        .mockResolvedValueOnce({
          id: SESSION_ID,
          type: 'QUIZ',
          quizId: '11111111-1111-4111-8111-111111111111',
          qaEnabled: true,
          qaOpen: true,
          qaTitle: 'Fragen',
          qaModerationMode: true,
          title: null,
          moderationMode: false,
          quickFeedbackEnabled: false,
          quickFeedbackOpen: false,
        })
        .mockResolvedValueOnce({
          id: SESSION_ID,
          type: 'QUIZ',
          quizId: '11111111-1111-4111-8111-111111111111',
          qaEnabled: true,
          qaOpen: false,
          qaTitle: 'Fragen',
          qaModerationMode: true,
          title: null,
          moderationMode: false,
          quickFeedbackEnabled: false,
          quickFeedbackOpen: false,
        });
      prismaMock.session.update
        .mockResolvedValueOnce({
          type: 'QUIZ',
          quizId: '11111111-1111-4111-8111-111111111111',
          qaEnabled: true,
          qaOpen: false,
          qaTitle: 'Fragen',
          qaModerationMode: true,
          title: null,
          moderationMode: false,
          quickFeedbackEnabled: false,
          quickFeedbackOpen: false,
        })
        .mockResolvedValueOnce({
          type: 'QUIZ',
          quizId: '11111111-1111-4111-8111-111111111111',
          qaEnabled: true,
          qaOpen: true,
          qaTitle: 'Fragen',
          qaModerationMode: true,
          title: null,
          moderationMode: false,
          quickFeedbackEnabled: false,
          quickFeedbackOpen: false,
        });

      const closed = await caller.closeQaChannel({ code: 'ABC123' });
      const reopened = await caller.reopenQaChannel({ code: 'ABC123' });

      expect(prismaMock.session.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { id: SESSION_ID },
          data: { qaOpen: false },
        }),
      );
      expect(prismaMock.session.update).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { id: SESSION_ID },
          data: { qaOpen: true },
        }),
      );
      expect(closed.qa).toMatchObject({ enabled: true, open: false });
      expect(reopened.qa).toMatchObject({ enabled: true, open: true });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.closeQuickFeedbackChannel',
      case: 'happy',
      mode: 'direct',
      title: 'schließt und öffnet den Blitzlicht-Kanal ohne die Aktivierung zu verlieren',
    },
    async () => {
      prismaMock.session.findUnique
        .mockResolvedValueOnce({
          id: SESSION_ID,
          type: 'QUIZ',
          quizId: '11111111-1111-4111-8111-111111111111',
          qaEnabled: false,
          qaOpen: false,
          qaTitle: null,
          qaModerationMode: false,
          title: null,
          moderationMode: false,
          quickFeedbackEnabled: true,
          quickFeedbackOpen: true,
        })
        .mockResolvedValueOnce({
          id: SESSION_ID,
          type: 'QUIZ',
          quizId: '11111111-1111-4111-8111-111111111111',
          qaEnabled: false,
          qaOpen: false,
          qaTitle: null,
          qaModerationMode: false,
          title: null,
          moderationMode: false,
          quickFeedbackEnabled: true,
          quickFeedbackOpen: false,
        });
      prismaMock.session.update
        .mockResolvedValueOnce({
          type: 'QUIZ',
          quizId: '11111111-1111-4111-8111-111111111111',
          qaEnabled: false,
          qaOpen: false,
          qaTitle: null,
          qaModerationMode: false,
          title: null,
          moderationMode: false,
          quickFeedbackEnabled: true,
          quickFeedbackOpen: false,
        })
        .mockResolvedValueOnce({
          type: 'QUIZ',
          quizId: '11111111-1111-4111-8111-111111111111',
          qaEnabled: false,
          qaOpen: false,
          qaTitle: null,
          qaModerationMode: false,
          title: null,
          moderationMode: false,
          quickFeedbackEnabled: true,
          quickFeedbackOpen: true,
        });

      const closed = await caller.closeQuickFeedbackChannel({ code: 'ABC123' });
      const reopened = await caller.reopenQuickFeedbackChannel({ code: 'ABC123' });

      expect(prismaMock.session.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { id: SESSION_ID },
          data: { quickFeedbackOpen: false },
        }),
      );
      expect(prismaMock.session.update).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { id: SESSION_ID },
          data: { quickFeedbackOpen: true },
        }),
      );
      expect(closed.quickFeedback).toMatchObject({ enabled: true, open: false });
      expect(reopened.quickFeedback).toMatchObject({ enabled: true, open: true });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.reopenQaChannel',
      case: 'happy',
      mode: 'direct',
      title: 'öffnet einen aktivierten, zuvor geschlossenen Q&A-Kanal wieder',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        type: 'QUIZ',
        quizId: '11111111-1111-4111-8111-111111111111',
        qaEnabled: true,
        qaOpen: false,
        qaTitle: 'Fragen',
        qaModerationMode: true,
        title: null,
        moderationMode: false,
        quickFeedbackEnabled: false,
        quickFeedbackOpen: false,
      });
      prismaMock.session.update.mockResolvedValue({
        type: 'QUIZ',
        quizId: '11111111-1111-4111-8111-111111111111',
        qaEnabled: true,
        qaOpen: true,
        qaTitle: 'Fragen',
        qaModerationMode: true,
        title: null,
        moderationMode: false,
        quickFeedbackEnabled: false,
        quickFeedbackOpen: false,
      });

      const result = await caller.reopenQaChannel({ code: 'ABC123' });

      expect(prismaMock.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SESSION_ID },
          data: { qaOpen: true },
        }),
      );
      expect(result.qa).toMatchObject({ enabled: true, open: true });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.reopenQuickFeedbackChannel',
      case: 'happy',
      mode: 'direct',
      title: 'öffnet einen aktivierten, zuvor geschlossenen Blitzlicht-Kanal wieder',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        type: 'QUIZ',
        quizId: '11111111-1111-4111-8111-111111111111',
        qaEnabled: false,
        qaOpen: false,
        qaTitle: null,
        qaModerationMode: false,
        title: null,
        moderationMode: false,
        quickFeedbackEnabled: true,
        quickFeedbackOpen: false,
      });
      prismaMock.session.update.mockResolvedValue({
        type: 'QUIZ',
        quizId: '11111111-1111-4111-8111-111111111111',
        qaEnabled: false,
        qaOpen: false,
        qaTitle: null,
        qaModerationMode: false,
        title: null,
        moderationMode: false,
        quickFeedbackEnabled: true,
        quickFeedbackOpen: true,
      });

      const result = await caller.reopenQuickFeedbackChannel({ code: 'ABC123' });

      expect(prismaMock.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SESSION_ID },
          data: { quickFeedbackOpen: true },
        }),
      );
      expect(result.quickFeedback).toMatchObject({ enabled: true, open: true });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.setPreferredLiveChannel',
      case: 'happy',
      mode: 'direct',
      title: 'setzt den bevorzugten Live-Kanal auf Q&A, wenn der Kanal aktiv ist',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        type: 'QUIZ',
        quizId: '11111111-1111-4111-8111-111111111111',
        qaEnabled: true,
        qaOpen: true,
        qaTitle: 'Fragen',
        qaModerationMode: true,
        title: null,
        moderationMode: false,
        quickFeedbackEnabled: true,
        quickFeedbackOpen: true,
      });

      const result = await caller.setPreferredLiveChannel({ code: 'ABC123', channel: 'qa' });

      expect(result).toEqual({ preferredChannel: 'qa' });
      expect(prismaMock.session.update).not.toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'session.setPresenterSurface',
      case: 'happy',
      mode: 'direct',
      title: 'schaltet die Q&A-Wortwolke exklusiv auf die Presenter-Fläche',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        type: 'QUIZ',
        quizId: '11111111-1111-4111-8111-111111111111',
        qaEnabled: true,
        qaOpen: true,
        qaTitle: 'Fragen',
        qaModerationMode: true,
        title: null,
        moderationMode: false,
        quickFeedbackEnabled: true,
        quickFeedbackOpen: true,
      });

      await caller.setPreferredLiveChannel({ code: 'ABC123', channel: 'qa' });
      await expect(
        caller.setPresenterSurface({ code: 'ABC123', surface: 'qaWordCloud' }),
      ).resolves.toEqual({ presenterSurface: 'qaWordCloud' });

      await caller.setPreferredLiveChannel({ code: 'ABC123', channel: 'quiz' });
      await expect(
        caller.setPresenterSurface({ code: 'ABC123', surface: 'qaWordCloud' }),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: 'Die Q&A-Wortwolke ist nicht präsentationsbereit.',
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.setPresenterSurface',
      case: 'error',
      mode: 'direct',
      contract: 'BAD_REQUEST',
      title: 'weist eine Wortwolke außerhalb ihres projizierten Kanals zurück',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        type: 'QUIZ',
        quizId: '11111111-1111-4111-8111-111111111111',
        qaEnabled: true,
        qaOpen: true,
        qaTitle: 'Fragen',
        qaModerationMode: true,
        title: null,
        moderationMode: false,
        quickFeedbackEnabled: true,
        quickFeedbackOpen: true,
      });

      await caller.setPreferredLiveChannel({ code: 'ABC123', channel: 'quiz' });
      await expect(
        caller.setPresenterSurface({ code: 'ABC123', surface: 'qaWordCloud' }),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: 'Die Q&A-Wortwolke ist nicht präsentationsbereit.',
      });
    },
  );

  it('behält geschlossene, aktivierte Nebenkanäle als Presenter-Ziel bei', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      type: 'QUIZ',
      quizId: '11111111-1111-4111-8111-111111111111',
      qaEnabled: true,
      qaOpen: false,
      qaTitle: 'Fragen',
      qaModerationMode: true,
      title: null,
      moderationMode: false,
      quickFeedbackEnabled: true,
      quickFeedbackOpen: false,
    });

    await expect(
      caller.setPreferredLiveChannel({ code: 'ABC123', channel: 'qa' }),
    ).resolves.toEqual({
      preferredChannel: 'qa',
    });
    await expect(
      caller.setPreferredLiveChannel({ code: 'ABC123', channel: 'quickFeedback' }),
    ).resolves.toEqual({
      preferredChannel: 'quickFeedback',
    });
  });

  it('weist einen nicht aktivierten Nebenkanal als Presenter-Ziel zurück', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
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
    });

    await expect(
      caller.setPreferredLiveChannel({ code: 'ABC123', channel: 'qa' }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Q&A-Kanal ist nicht aktiv.',
    });
    await expect(
      caller.setPreferredLiveChannel({ code: 'ABC123', channel: 'quickFeedback' }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Blitzlicht-Kanal ist nicht aktiv.',
    });
  });
});

trpcDodIt(
  {
    procedure: 'session.closeQaChannel',
    case: 'error',
    mode: 'direct',
    contract: 'UNAUTHORIZED',
    title: 'session.closeQaChannel weist ungültige Host-Token ab',
  },
  async () => {
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(false);
    await expect(caller.closeQaChannel({ code: 'ABC123' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  },
);

trpcDodIt(
  {
    procedure: 'session.closeQuickFeedbackChannel',
    case: 'error',
    mode: 'direct',
    contract: 'UNAUTHORIZED',
    title: 'session.closeQuickFeedbackChannel weist ungültige Host-Token ab',
  },
  async () => {
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(false);
    await expect(caller.closeQuickFeedbackChannel({ code: 'ABC123' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  },
);

trpcDodIt(
  {
    procedure: 'session.reopenQaChannel',
    case: 'error',
    mode: 'direct',
    contract: 'UNAUTHORIZED',
    title: 'session.reopenQaChannel weist ungültige Host-Token ab',
  },
  async () => {
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(false);
    await expect(caller.reopenQaChannel({ code: 'ABC123' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  },
);

trpcDodIt(
  {
    procedure: 'session.reopenQuickFeedbackChannel',
    case: 'error',
    mode: 'direct',
    contract: 'UNAUTHORIZED',
    title: 'session.reopenQuickFeedbackChannel weist ungültige Host-Token ab',
  },
  async () => {
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(false);
    await expect(caller.reopenQuickFeedbackChannel({ code: 'ABC123' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  },
);

trpcDodIt(
  {
    procedure: 'session.enableQaChannel',
    case: 'error',
    mode: 'direct',
    contract: 'UNAUTHORIZED',
    title: 'session.enableQaChannel weist ungültige Host-Token ab',
  },
  async () => {
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(false);
    await expect(caller.enableQaChannel({ code: 'ABC123' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  },
);

trpcDodIt(
  {
    procedure: 'session.enableQuickFeedbackChannel',
    case: 'error',
    mode: 'direct',
    contract: 'UNAUTHORIZED',
    title: 'session.enableQuickFeedbackChannel weist ungültige Host-Token ab',
  },
  async () => {
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(false);
    await expect(caller.enableQuickFeedbackChannel({ code: 'ABC123' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  },
);

trpcDodIt(
  {
    procedure: 'session.setPreferredLiveChannel',
    case: 'error',
    mode: 'direct',
    contract: 'UNAUTHORIZED',
    title: 'session.setPreferredLiveChannel weist ungültige Host-Token ab',
  },
  async () => {
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(false);
    await expect(
      caller.setPreferredLiveChannel({ code: 'ABC123', channel: 'qa' }),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  },
);
