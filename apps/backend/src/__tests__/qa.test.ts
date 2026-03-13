import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
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
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

import { qaRouter } from '../routers/qa';

const caller = qaRouter.createCaller({ req: undefined });
const SESSION_ID = '6a8edced-5f8f-4cfa-9176-454fac9570ad';
const PARTICIPANT_ID = '33333333-3333-4333-8333-333333333333';
const QUESTION_ID = '44444444-4444-4444-8444-444444444444';

describe('qa router (Epic 8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('liefert sichtbare Fragen für einen Teilnehmer inklusive Upvote-Status', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      qaEnabled: true,
      qaModerationMode: false,
    });
    prismaMock.qaQuestion.findMany.mockResolvedValue([
      {
        id: QUESTION_ID,
        text: 'Was ist klausurrelevant?',
        upvoteCount: 4,
        status: 'ACTIVE',
        createdAt: new Date('2026-03-13T12:00:00.000Z'),
        upvotes: [{ participantId: PARTICIPANT_ID }],
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
        qaModerationMode: false,
        moderationMode: false,
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

  it('begrenzt Studierende auf maximal 3 Fragen pro Session', async () => {
    prismaMock.participant.findUnique.mockResolvedValue({
      id: PARTICIPANT_ID,
      sessionId: SESSION_ID,
      session: {
        id: SESSION_ID,
        type: 'QUIZ',
        qaEnabled: true,
        qaModerationMode: false,
        moderationMode: false,
      },
    });
    prismaMock.qaQuestion.count.mockResolvedValue(3);

    await expect(caller.submit({
      sessionId: SESSION_ID,
      participantId: PARTICIPANT_ID,
      text: 'Noch eine Frage?',
    })).rejects.toMatchObject({
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
        session: { id: SESSION_ID, type: 'QUIZ', qaEnabled: true },
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

  it('moderiert Fragen und hebt beim Pinnen alte Pins auf', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      qaEnabled: true,
    });
    prismaMock.qaQuestion.findUnique
      .mockResolvedValueOnce({
        id: QUESTION_ID,
        sessionId: SESSION_ID,
        text: 'Welche Themen kommen dran?',
        upvoteCount: 5,
        status: 'ACTIVE',
        createdAt: new Date('2026-03-13T12:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: QUESTION_ID,
        text: 'Welche Themen kommen dran?',
        upvoteCount: 5,
        status: 'PINNED',
        createdAt: new Date('2026-03-13T12:00:00.000Z'),
      });
    prismaMock.$transaction.mockResolvedValue([]);

    const result = await caller.moderate({
      sessionCode: 'ABC123',
      questionId: QUESTION_ID,
      action: 'PIN',
    });

    expect(prismaMock.qaQuestion.updateMany).toHaveBeenCalledWith({
      where: {
        sessionId: SESSION_ID,
        status: 'PINNED',
        NOT: { id: QUESTION_ID },
      },
      data: { status: 'ACTIVE' },
    });
    expect(result.status).toBe('PINNED');
  });
});
