import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
    },
    vote: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

import { sessionRouter } from '../routers/session';

const caller = sessionRouter.createCaller({ req: undefined });

describe('session.getLeaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('zaehlt bei MULTIPLE_CHOICE nur vollständig korrekt beantwortete Fragen als "Richtig"', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      quiz: {
        showLeaderboard: true,
        questions: [{ type: 'MULTIPLE_CHOICE' }],
      },
      participants: [
        { id: 'p1', nickname: 'Ada' },
        { id: 'p2', nickname: 'Bob' },
      ],
    });
    prismaMock.vote.findMany.mockResolvedValue([
      {
        participantId: 'p1',
        score: 2000,
        responseTimeMs: 1000,
        question: {
          type: 'MULTIPLE_CHOICE',
          answers: [
            { id: 'a1', isCorrect: true },
            { id: 'a2', isCorrect: true },
            { id: 'a3', isCorrect: false },
          ],
        },
        selectedAnswers: [{ answerOptionId: 'a1' }, { answerOptionId: 'a2' }],
      },
      {
        participantId: 'p2',
        score: 0,
        responseTimeMs: 1200,
        question: {
          type: 'MULTIPLE_CHOICE',
          answers: [
            { id: 'a1', isCorrect: true },
            { id: 'a2', isCorrect: true },
            { id: 'a3', isCorrect: false },
          ],
        },
        selectedAnswers: [{ answerOptionId: 'a1' }],
      },
    ]);

    const result = await caller.getLeaderboard({ code: 'ABC123' });

    expect(result).toEqual([
      expect.objectContaining({
        nickname: 'Ada',
        correctCount: 1,
        totalQuestions: 1,
      }),
    ]);
  });
});
