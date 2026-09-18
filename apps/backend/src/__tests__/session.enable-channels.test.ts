import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';

const { prismaMock, hostAuthMocks } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
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
const ACTIVE_SESSION = {
  id: SESSION_ID,
  status: 'ACTIVE',
  endedAt: null,
  expiresAt: new Date('2099-01-02T00:00:00.000Z'),
  qaClosesAt: new Date('2099-01-01T00:00:00.000Z'),
  sessionLifecycleRevision: 1,
  preferredChannel: 'quiz',
};
const QA_WORD_CLOUD_PROJECTION = {
  mode: 'SEMANTIC' as const,
  metric: 'BEST' as const,
  locale: 'de' as const,
  analysisEntries: [
    {
      key: 'kapitel-4',
      label: 'Kapitel 4',
      count: 7,
      basisLabel: 'Kapitel',
      members: [
        {
          sourceId: '11111111-1111-4111-8111-111111111111',
          text: 'Kommt Kapitel 4 in der Klausur vor?',
          weight: 4,
        },
      ],
      variants: ['Kapitel 4'],
      confidence: 0.88,
    },
  ],
  analyzedQuestionCount: 1,
  eligibleQuestionCount: 1,
  modelVersion: 'topic-v1',
  smoothingActive: false,
};

describe('session.enable channel mutations', () => {
  beforeEach(() => {
    vi.resetAllMocks();
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
      procedure: 'session.enableQaChannel',
      case: 'happy',
      mode: 'direct',
      title: 'liefert einen bereits fristgebunden eingerichteten Q&A-Kanal',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        ...ACTIVE_SESSION,
        id: SESSION_ID,
        type: 'QUIZ',
        quizId: '11111111-1111-4111-8111-111111111111',
        qaEnabled: true,
        qaOpen: true,
        qaTitle: null,
        qaModerationMode: false,
        title: null,
        moderationMode: false,
        quickFeedbackEnabled: false,
        quickFeedbackOpen: false,
      });
      const result = await caller.enableQaChannel({ code: 'abc123' });

      expect(prismaMock.session.update).not.toHaveBeenCalled();
      expect(result.qa.enabled).toBe(true);
      expect(result.qa.open).toBe(true);
      expect(result.quickFeedback.enabled).toBe(false);
    },
  );

  it('öffnet Q&A ohne bestätigte Q&A-Frist nicht über den Legacy-Schalter', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_SESSION,
      type: 'QUIZ',
      quizId: '11111111-1111-4111-8111-111111111111',
      qaEnabled: false,
      qaOpen: false,
      qaClosesAt: null,
      qaTitle: null,
      qaModerationMode: false,
      title: null,
      moderationMode: false,
      quickFeedbackEnabled: false,
      quickFeedbackOpen: false,
    });

    await expect(caller.enableQaChannel({ code: 'ABC123' })).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    });
    expect(prismaMock.session.update).not.toHaveBeenCalled();
  });

  trpcDodIt(
    {
      procedure: 'session.enableQuickFeedbackChannel',
      case: 'happy',
      mode: 'direct',
      title: 'aktiviert den Blitzlicht-Kanal für eine Session',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        ...ACTIVE_SESSION,
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
      ...ACTIVE_SESSION,
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
        .mockResolvedValueOnce({ id: SESSION_ID })
        .mockResolvedValueOnce({
          ...ACTIVE_SESSION,
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
        .mockResolvedValueOnce({ id: SESSION_ID })
        .mockResolvedValueOnce({
          ...ACTIVE_SESSION,
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
          ...ACTIVE_SESSION,
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
          ...ACTIVE_SESSION,
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
          data: expect.objectContaining({ qaOpen: false }),
        }),
      );
      expect(prismaMock.session.update).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { id: SESSION_ID },
          data: expect.objectContaining({ qaOpen: true }),
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
        ...ACTIVE_SESSION,
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
          data: expect.objectContaining({ qaOpen: true }),
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
        ...ACTIVE_SESSION,
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
        ...ACTIVE_SESSION,
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
      prismaMock.session.update.mockResolvedValue({
        preferredChannel: 'qa',
        sessionLifecycleRevision: 2,
      });

      const result = await caller.setPreferredLiveChannel({ code: 'ABC123', channel: 'qa' });

      expect(result).toMatchObject({ preferredChannel: 'qa', sessionLifecycleRevision: 2 });
      expect(result.serverNow).toMatch(/Z$/);
      expect(prismaMock.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ preferredChannel: 'qa' }),
        }),
      );
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
      let preferredChannel = 'quiz';
      let revision = 1;
      prismaMock.session.findUnique.mockImplementation(async () => ({
        ...ACTIVE_SESSION,
        preferredChannel,
        sessionLifecycleRevision: revision,
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
      }));
      prismaMock.session.update.mockImplementation(
        async (args: { data: { preferredChannel?: string } }) => {
          if (args.data.preferredChannel) {
            preferredChannel = args.data.preferredChannel;
            revision += 1;
          }
          return { preferredChannel, sessionLifecycleRevision: revision };
        },
      );

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
      case: 'happy',
      mode: 'direct',
      title: 'projiziert die Q&A-Wortwolke auch bei geschlossenem Beitragskanal',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        ...ACTIVE_SESSION,
        preferredChannel: 'qa',
        sessionLifecycleRevision: 3,
        type: 'QUIZ',
        quizId: '11111111-1111-4111-8111-111111111111',
        qaEnabled: true,
        qaOpen: false,
        qaClosesAt: new Date('2099-01-01T00:00:00.000Z'),
        qaTitle: 'Fragen',
        qaModerationMode: true,
        title: null,
        moderationMode: false,
        quickFeedbackEnabled: false,
        quickFeedbackOpen: false,
      });

      await expect(
        caller.setPresenterSurface({ code: 'ABC123', surface: 'qaWordCloud' }),
      ).resolves.toEqual({ presenterSurface: 'qaWordCloud' });
    },
  );

  it('lässt die Wortwolken-Fläche bei unverändertem Preferred-Channel bestehen', async () => {
    const { resetSessionReadCachesForTests } = await import('../routers/session');
    resetSessionReadCachesForTests();

    let preferredChannel = 'qa';
    let revision = 4;
    const baseSession = {
      id: SESSION_ID,
      code: 'ABC123',
      type: 'Q_AND_A' as const,
      status: 'ACTIVE',
      endedAt: null,
      expiresAt: new Date('2099-01-02T00:00:00.000Z'),
      qaClosesAt: new Date('2099-01-01T00:00:00.000Z'),
      title: 'Fragen',
      quizId: null,
      preferredChannel,
      sessionLifecycleRevision: revision,
      moderationMode: true,
      qaEnabled: true,
      qaOpen: true,
      qaTitle: 'Fragen',
      qaModerationMode: true,
      quickFeedbackEnabled: false,
      quickFeedbackOpen: false,
      _count: { participants: 2 },
    };
    prismaMock.session.findUnique.mockImplementation(async () => ({
      ...baseSession,
      preferredChannel,
      sessionLifecycleRevision: revision,
    }));
    prismaMock.session.update.mockImplementation(
      async (args: { data: { preferredChannel?: string } }) => {
        if (args.data.preferredChannel) {
          preferredChannel = args.data.preferredChannel;
          revision += 1;
        }
        return { preferredChannel, sessionLifecycleRevision: revision };
      },
    );

    await expect(
      caller.setPresenterSurface({ code: 'ABC123', surface: 'qaWordCloud' }),
    ).resolves.toEqual({ presenterSurface: 'qaWordCloud' });

    await expect(
      caller.setPreferredLiveChannel({ code: 'ABC123', channel: 'qa' }),
    ).resolves.toMatchObject({ preferredChannel: 'qa' });

    const info = await caller.getInfoForReconnect({ code: 'ABC123' });
    expect(info.presenterSurface).toBe('qaWordCloud');
  });

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
        ...ACTIVE_SESSION,
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
      ...ACTIVE_SESSION,
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
    prismaMock.session.update
      .mockResolvedValueOnce({ preferredChannel: 'qa', sessionLifecycleRevision: 2 })
      .mockResolvedValueOnce({ preferredChannel: 'quickFeedback', sessionLifecycleRevision: 2 });

    await expect(
      caller.setPreferredLiveChannel({ code: 'ABC123', channel: 'qa' }),
    ).resolves.toMatchObject({
      preferredChannel: 'qa',
    });
    await expect(
      caller.setPreferredLiveChannel({ code: 'ABC123', channel: 'quickFeedback' }),
    ).resolves.toMatchObject({
      preferredChannel: 'quickFeedback',
    });
  });

  it('weist einen nicht aktivierten Nebenkanal als Presenter-Ziel zurück', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_SESSION,
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

  it('weist Kanaländerungen nach dem globalen Sessionende zurück', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      ...ACTIVE_SESSION,
      id: SESSION_ID,
      status: 'FINISHED',
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

    for (const mutate of [
      () => caller.closeQaChannel({ code: 'ABC123' }),
      () => caller.reopenQaChannel({ code: 'ABC123' }),
      () => caller.closeQuickFeedbackChannel({ code: 'ABC123' }),
      () => caller.reopenQuickFeedbackChannel({ code: 'ABC123' }),
    ]) {
      await expect(mutate()).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    }
    expect(prismaMock.session.update).not.toHaveBeenCalled();
  });

  trpcDodIt(
    {
      procedure: 'session.setQaWordCloudProjection',
      case: 'happy',
      mode: 'direct',
      title: 'speichert die Host-Wortwolke für die Presenter-Projektion',
    },
    async () => {
      const { resetSessionReadCachesForTests } = await import('../routers/session');
      resetSessionReadCachesForTests();

      prismaMock.session.findUnique.mockResolvedValue({
        ...ACTIVE_SESSION,
        preferredChannel: 'qa',
        type: 'Q_AND_A',
        quizId: null,
        qaEnabled: true,
        qaOpen: true,
        qaTitle: 'Fragen',
        qaModerationMode: true,
        title: 'Fragen',
        moderationMode: false,
        quickFeedbackEnabled: false,
        quickFeedbackOpen: false,
      });

      await expect(
        caller.setQaWordCloudProjection({
          code: 'ABC123',
          projection: QA_WORD_CLOUD_PROJECTION,
        }),
      ).resolves.toEqual({
        projection: QA_WORD_CLOUD_PROJECTION,
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.getQaWordCloudProjection',
      case: 'happy',
      mode: 'direct',
      title: 'gibt die Host-Wortwolken-Einstellungen an den Presenter weiter',
    },
    async () => {
      const { resetSessionReadCachesForTests } = await import('../routers/session');
      resetSessionReadCachesForTests();

      prismaMock.session.findUnique.mockResolvedValue({
        ...ACTIVE_SESSION,
        preferredChannel: 'qa',
        type: 'Q_AND_A',
        quizId: null,
        qaEnabled: true,
        qaOpen: true,
        qaTitle: 'Fragen',
        qaModerationMode: true,
        title: 'Fragen',
        moderationMode: false,
        quickFeedbackEnabled: false,
        quickFeedbackOpen: false,
      });

      await expect(
        caller.setPresenterSurface({ code: 'ABC123', surface: 'qaWordCloud' }),
      ).resolves.toEqual({ presenterSurface: 'qaWordCloud' });
      await expect(
        caller.setQaWordCloudProjection({
          code: 'ABC123',
          projection: QA_WORD_CLOUD_PROJECTION,
        }),
      ).resolves.toEqual({
        projection: QA_WORD_CLOUD_PROJECTION,
      });
      await expect(caller.getQaWordCloudProjection({ code: 'ABC123' })).resolves.toEqual({
        projection: QA_WORD_CLOUD_PROJECTION,
      });

      await expect(
        caller.setPresenterSurface({ code: 'ABC123', surface: 'default' }),
      ).resolves.toEqual({ presenterSurface: 'default' });
      await expect(caller.getQaWordCloudProjection({ code: 'ABC123' })).resolves.toEqual({
        projection: null,
      });
    },
  );
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

trpcDodIt(
  {
    procedure: 'session.setQaWordCloudProjection',
    case: 'error',
    mode: 'direct',
    contract: 'UNAUTHORIZED',
    title: 'session.setQaWordCloudProjection weist ungültige Host-Token ab',
  },
  async () => {
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(false);
    await expect(
      caller.setQaWordCloudProjection({
        code: 'ABC123',
        projection: QA_WORD_CLOUD_PROJECTION,
      }),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  },
);

trpcDodIt(
  {
    procedure: 'session.getQaWordCloudProjection',
    case: 'error',
    mode: 'direct',
    contract: 'NOT_FOUND',
    title: 'session.getQaWordCloudProjection weist unbekannte Sessions zurück',
  },
  async () => {
    prismaMock.session.findUnique.mockResolvedValue(null);
    await expect(caller.getQaWordCloudProjection({ code: 'ZZZ999' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  },
);
