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
        {
          id: 'p2',
          nickname: 'Bob',
          team: { name: ':apple: Team Apfel', color: '#1E88E5' },
        },
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

  it('nutzt nur Antwortzeiten von positiv bewerteten Antworten als Tiebreaker', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      quiz: {
        showLeaderboard: true,
        questions: [{ type: 'SINGLE_CHOICE' }, { type: 'SURVEY' }],
      },
      participants: [
        { id: 'p1', nickname: 'Ada' },
        {
          id: 'p2',
          nickname: 'Bob',
          team: { name: ':apple: Team Apfel', color: '#1E88E5' },
        },
      ],
    });
    prismaMock.vote.findMany.mockResolvedValue([
      {
        participantId: 'p1',
        score: 2000,
        responseTimeMs: 5000,
        question: {
          type: 'SINGLE_CHOICE',
          answers: [
            { id: 'a1', isCorrect: true },
            { id: 'a2', isCorrect: false },
          ],
        },
        selectedAnswers: [{ answerOptionId: 'a1' }],
      },
      {
        participantId: 'p1',
        score: 0,
        responseTimeMs: 120_000,
        question: {
          type: 'SURVEY',
          answers: [
            { id: 's1', isCorrect: false },
            { id: 's2', isCorrect: false },
          ],
        },
        selectedAnswers: [{ answerOptionId: 's1' }],
      },
      {
        participantId: 'p2',
        score: 2000,
        responseTimeMs: 6000,
        question: {
          type: 'SINGLE_CHOICE',
          answers: [
            { id: 'a1', isCorrect: true },
            { id: 'a2', isCorrect: false },
          ],
        },
        selectedAnswers: [{ answerOptionId: 'a1' }],
      },
    ]);

    const result = await caller.getLeaderboard({ code: 'ABC123' });

    expect(result).toEqual([
      expect.objectContaining({
        rank: 1,
        nickname: 'Ada',
        totalScore: 2000,
        totalResponseTimeMs: 5000,
      }),
      expect.objectContaining({
        rank: 2,
        nickname: 'Bob',
        totalScore: 2000,
        totalResponseTimeMs: 6000,
        teamName: ':apple: Team Apfel',
        teamColor: '#1E88E5',
      }),
    ]);
  });
});
