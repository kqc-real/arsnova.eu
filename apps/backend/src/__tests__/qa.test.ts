import type { IncomingMessage } from 'node:http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, hostAuthMocks } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    participant: {
      findUnique: vi.fn(),
    },
    qaQuestion: {
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    qaUpvote: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
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

vi.mock('../lib/hostAuth', async () => {
  const { buildHostAuthTestMock } = await import('./lib/hostAuth-vitest-mock');
  return buildHostAuthTestMock({
    extractHostToken: hostAuthMocks.extractHostTokenMock,
    extractHostTokenFromConnectionParams: hostAuthMocks.extractHostTokenFromConnectionParamsMock,
    isHostSessionTokenValid: hostAuthMocks.isHostSessionTokenValidMock,
  });
});

import { qaRouter } from '../routers/qa';

function hostCtx(token: string | null) {
  return {
    req: {
      headers: token ? { 'x-host-token': token } : {},
    } as IncomingMessage,
  };
}

const caller = qaRouter.createCaller(hostCtx(null));
const hostCaller = qaRouter.createCaller(hostCtx('host-token-123'));
const SESSION_ID = '6a8edced-5f8f-4cfa-9176-454fac9570ad';
const PARTICIPANT_ID = '33333333-3333-4333-8333-333333333333';
const QUESTION_ID = '44444444-4444-4444-8444-444444444444';

describe('qa router (Epic 8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostAuthMocks.extractHostTokenMock.mockImplementation((req: unknown) => {
      const t = (req as { headers?: { 'x-host-token'?: string } } | undefined)?.headers?.[
        'x-host-token'
      ];
      return typeof t === 'string' ? t : null;
    });
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
  });

  it('liefert sichtbare Fragen für einen Teilnehmer inklusive Upvote-Status', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: 'CODE12',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: false,
    });
    prismaMock.qaQuestion.findMany.mockResolvedValue([
      {
        id: QUESTION_ID,
        participantId: 'other-participant',
        text: 'Was ist klausurrelevant?',
        upvoteCount: 4,
        status: 'ACTIVE',
        createdAt: new Date('2026-03-13T12:00:00.000Z'),
        upvotes: [{ participantId: PARTICIPANT_ID, direction: 'UP' }],
      },
    ]);

    const result = await caller.list({ sessionId: SESSION_ID, participantId: PARTICIPANT_ID });

    expect(result).toEqual([
      {
        id: QUESTION_ID,
        text: 'Was ist klausurrelevant?',
        upvoteCount: 4,
        status: 'ACTIVE',
        createdAt: '2026-03-13T12:00:00.000Z',
        hasUpvoted: true,
        isOwn: false,
        myVote: 'UP',
      },
    ]);
  });

  it('legt eine neue Frage an und setzt ohne Moderation den Status ACTIVE', async () => {
    prismaMock.participant.findUnique.mockResolvedValue({
      id: PARTICIPANT_ID,
      sessionId: SESSION_ID,
      session: {
        id: SESSION_ID,
        type: 'QUIZ',
        qaEnabled: true,
        qaOpen: true,
        qaModerationMode: false,
        moderationMode: false,
        status: 'ACTIVE',
      },
    });
    prismaMock.qaQuestion.count.mockResolvedValue(0);
    prismaMock.qaQuestion.create.mockResolvedValue({
      id: QUESTION_ID,
      text: 'Wie viele Punkte gibt es?',
      upvoteCount: 0,
      status: 'ACTIVE',
      createdAt: new Date('2026-03-13T12:00:00.000Z'),
      upvotes: [],
    });

    const result = await caller.submit({
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
      text: '  Wie viele Punkte gibt es?  ',
    });

    expect(prismaMock.qaQuestion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sessionId: SESSION_ID,
          participantId: PARTICIPANT_ID,
          text: 'Wie viele Punkte gibt es?',
          status: 'ACTIVE',
        }),
      }),
    );
    expect(result.status).toBe('ACTIVE');
  });

  it('lehnt neue Fragen ab, wenn die Session beendet ist', async () => {
    prismaMock.participant.findUnique.mockResolvedValue({
      id: PARTICIPANT_ID,
      sessionId: SESSION_ID,
      session: {
        id: SESSION_ID,
        type: 'QUIZ',
        qaEnabled: true,
        qaOpen: true,
        qaModerationMode: false,
        moderationMode: false,
        status: 'FINISHED',
      },
    });

    await expect(
      caller.submit({
        sessionId: SESSION_ID,
        participantId: PARTICIPANT_ID,
        text: 'Noch eine Frage?',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(prismaMock.qaQuestion.create).not.toHaveBeenCalled();
  });

  it('begrenzt Studierende auf maximal 3 Fragen pro Session', async () => {
    prismaMock.participant.findUnique.mockResolvedValue({
      id: PARTICIPANT_ID,
      sessionId: SESSION_ID,
      session: {
        id: SESSION_ID,
        type: 'QUIZ',
        qaEnabled: true,
        qaOpen: true,
        qaModerationMode: false,
        moderationMode: false,
        status: 'ACTIVE',
      },
    });
    prismaMock.qaQuestion.count.mockResolvedValue(3);

    await expect(
      caller.submit({
        sessionId: SESSION_ID,
        participantId: PARTICIPANT_ID,
        text: 'Noch eine Frage?',
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('togglet Upvotes pro Teilnehmer und Frage', async () => {
    prismaMock.qaQuestion.findUnique
      .mockResolvedValueOnce({
        id: QUESTION_ID,
        sessionId: SESSION_ID,
        status: 'ACTIVE',
        upvoteCount: 1,
        session: { id: SESSION_ID, type: 'QUIZ', qaEnabled: true, qaOpen: true, status: 'ACTIVE' },
      })
      .mockResolvedValueOnce({ upvoteCount: 2 });
    prismaMock.participant.findUnique.mockResolvedValue({
      id: PARTICIPANT_ID,
      sessionId: SESSION_ID,
    });
    prismaMock.qaUpvote.findUnique.mockResolvedValue(null);
    prismaMock.$transaction.mockResolvedValue([]);
    prismaMock.qaQuestion.updateMany.mockResolvedValue({ count: 0 });

    const result = await caller.upvote({
      questionId: QUESTION_ID,
      participantId: PARTICIPANT_ID,
    });

    expect(result).toEqual({
      questionId: QUESTION_ID,
      upvoted: true,
      upvoteCount: 2,
    });
  });

  it('moderiert Fragen und erlaubt mehrfaches Pinnen', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      status: 'ACTIVE',
    });
    prismaMock.qaQuestion.findUnique
      .mockResolvedValueOnce({
        id: QUESTION_ID,
        sessionId: SESSION_ID,
        participantId: PARTICIPANT_ID,
        text: 'Welche Themen kommen dran?',
        upvoteCount: 5,
        status: 'ACTIVE',
        createdAt: new Date('2026-03-13T12:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: QUESTION_ID,
        participantId: PARTICIPANT_ID,
        text: 'Welche Themen kommen dran?',
        upvoteCount: 5,
        status: 'PINNED',
        createdAt: new Date('2026-03-13T12:00:00.000Z'),
        upvotes: [],
      });
    prismaMock.qaQuestion.update.mockResolvedValue({});

    const result = await hostCaller.moderate({
      sessionCode: 'ABC123',
      questionId: QUESTION_ID,
      action: 'PIN',
    });

    expect(prismaMock.qaQuestion.update).toHaveBeenCalledWith({
      where: { id: QUESTION_ID },
      data: { status: 'PINNED' },
    });
    expect(prismaMock.qaQuestion.updateMany).not.toHaveBeenCalled();
    expect(result.status).toBe('PINNED');
  });

  it('lehnt Moderation ohne gültigen Host-Token ab', async () => {
    await expect(
      caller.moderate({
        sessionCode: 'ABC123',
        questionId: QUESTION_ID,
        action: 'PIN',
      }),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Host-Authentifizierung erforderlich.',
    });
  });

  it('schaltet Q&A-Moderation mit Host-Rechten um', async () => {
    prismaMock.session.findFirst.mockResolvedValue({
      id: SESSION_ID,
      status: 'ACTIVE',
    });
    prismaMock.session.update.mockResolvedValue({ qaModerationMode: true });

    const result = await hostCaller.toggleModeration({ sessionCode: 'ABC123', enabled: true });

    expect(prismaMock.session.update).toHaveBeenCalledWith({
      where: { id: SESSION_ID },
      data: { qaModerationMode: true },
      select: { qaModerationMode: true },
    });
    expect(result).toEqual({ enabled: true });
  });

  it('lehnt qa.list mit moderatorView ohne Host-Token ab', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: 'ABC123',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: true,
    });

    await expect(caller.list({ sessionId: SESSION_ID, moderatorView: true })).rejects.toMatchObject(
      {
        code: 'UNAUTHORIZED',
        message: 'Host-Authentifizierung erforderlich.',
      },
    );
  });

  it('liefert qa.list mit moderatorView bei gültigem Host-Token', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: 'ABC123',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
      qaModerationMode: true,
    });
    prismaMock.qaQuestion.findMany.mockResolvedValue([
      {
        id: QUESTION_ID,
        participantId: PARTICIPANT_ID,
        text: 'Noch nicht freigegeben',
        upvoteCount: 0,
        status: 'PENDING',
        createdAt: new Date('2026-03-13T12:00:00.000Z'),
      },
    ]);

    const result = await hostCaller.list({ sessionId: SESSION_ID, moderatorView: true });

    expect(result).toEqual([
      {
        id: QUESTION_ID,
        text: 'Noch nicht freigegeben',
        upvoteCount: 0,
        status: 'PENDING',
        createdAt: '2026-03-13T12:00:00.000Z',
        hasUpvoted: false,
        isOwn: false,
        myVote: null,
      },
    ]);
  });

  it('lehnt qa.onQuestionsUpdated mit moderatorView ohne Host-Token ab', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: 'ABC123',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: true,
    });

    const stream = await caller.onQuestionsUpdated({ sessionId: SESSION_ID, moderatorView: true });
    const iterator = stream[Symbol.asyncIterator]();

    await expect(iterator.next()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Host-Authentifizierung erforderlich.',
    });

    await iterator.return?.(undefined);
  });

  it('liefert qa.onQuestionsUpdated mit moderatorView bei gültigem Host-Token', async () => {
    prismaMock.session.findUnique
      .mockResolvedValueOnce({
        id: SESSION_ID,
        code: 'ABC123',
        type: 'QUIZ',
        qaEnabled: true,
        qaOpen: true,
      })
      .mockResolvedValueOnce({
        id: SESSION_ID,
        type: 'QUIZ',
        qaEnabled: true,
        qaOpen: true,
      });
    prismaMock.qaQuestion.findMany.mockResolvedValue([
      {
        id: QUESTION_ID,
        participantId: PARTICIPANT_ID,
        text: 'Noch nicht freigegeben',
        upvoteCount: 0,
        status: 'PENDING',
        createdAt: new Date('2026-03-13T12:00:00.000Z'),
      },
    ]);

    const stream = await hostCaller.onQuestionsUpdated({
      sessionId: SESSION_ID,
      moderatorView: true,
    });
    const iterator = stream[Symbol.asyncIterator]();
    const { value } = await iterator.next();

    expect(hostAuthMocks.isHostSessionTokenValidMock).toHaveBeenCalledWith(
      'ABC123',
      'host-token-123',
    );
    expect(value).toEqual([
      {
        id: QUESTION_ID,
        text: 'Noch nicht freigegeben',
        upvoteCount: 0,
        status: 'PENDING',
        createdAt: '2026-03-13T12:00:00.000Z',
        hasUpvoted: false,
        isOwn: false,
        myVote: null,
      },
    ]);

    await iterator.return?.(undefined);
  });

  it('liefert für Teilnehmende keine Q&A-Inhalte, wenn der Kanal geschlossen ist', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: 'CODE12',
      type: 'QUIZ',
      qaEnabled: true,
      qaOpen: false,
      qaModerationMode: false,
    });

    const result = await caller.list({ sessionId: SESSION_ID, participantId: PARTICIPANT_ID });

    expect(result).toEqual([]);
    expect(prismaMock.qaQuestion.findMany).not.toHaveBeenCalled();
  });

  it('lehnt neue Fragen ab, wenn der Q&A-Kanal geschlossen ist', async () => {
    prismaMock.participant.findUnique.mockResolvedValue({
      id: PARTICIPANT_ID,
      sessionId: SESSION_ID,
      session: {
        id: SESSION_ID,
        type: 'QUIZ',
        qaEnabled: true,
        qaOpen: false,
        qaModerationMode: false,
        moderationMode: false,
        status: 'ACTIVE',
      },
    });

    await expect(
      caller.submit({
        sessionId: SESSION_ID,
        participantId: PARTICIPANT_ID,
        text: 'Noch eine Frage?',
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Der Q&A-Kanal ist aktuell geschlossen.',
    });
    expect(prismaMock.qaQuestion.create).not.toHaveBeenCalled();
  });
});
