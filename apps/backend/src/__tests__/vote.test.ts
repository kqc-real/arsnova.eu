import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, checkVoteRateMock } = vi.hoisted(() => ({
  prismaMock: {
    participant: {
      findFirst: vi.fn(),
    },
    question: {
      findFirst: vi.fn(),
    },
    vote: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
  checkVoteRateMock: vi.fn(),
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/rateLimit', () => ({
  checkVoteRate: checkVoteRateMock,
}));

import { checkVoteRate } from '../lib/rateLimit';
import { voteRouter } from '../routers/vote';

const caller = voteRouter.createCaller({ req: undefined });
const ANSWER_ID_1 = '11111111-1111-4111-8111-111111111111';
const ANSWER_ID_2 = '22222222-2222-4222-8222-222222222222';

describe('vote.submit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkVoteRate).mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    prismaMock.participant.findFirst.mockResolvedValue({
      id: 'participant-1',
      sessionId: 'session-1',
      session: { status: 'ACTIVE', quizId: 'quiz-1' },
    });
    prismaMock.vote.findUnique.mockResolvedValue(null);
    prismaMock.vote.create.mockResolvedValue({ id: '11111111-1111-4111-8111-111111111119' });
  });

  it('vergibt für FREETEXT immer 0 Punkte und speichert keine selectedAnswers', async () => {
    prismaMock.question.findFirst.mockResolvedValue({
      id: 'question-1',
      quizId: 'quiz-1',
      type: 'FREETEXT',
      difficulty: 'MEDIUM',
      ratingMin: null,
      ratingMax: null,
      answers: [],
    });

    await caller.submit({
      sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      participantId: '7290465d-5982-4b3d-ab47-a2088830d4b0',
      questionId: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
      freeText: 'Meine Antwort',
    });

    expect(prismaMock.vote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          score: 0,
          freeText: 'Meine Antwort',
          selectedAnswers: undefined,
        }),
      }),
    );
  });

  it('vergibt für SURVEY immer 0 Punkte', async () => {
    prismaMock.question.findFirst.mockResolvedValue({
      id: 'question-1',
      quizId: 'quiz-1',
      type: 'SURVEY',
      difficulty: 'MEDIUM',
      ratingMin: null,
      ratingMax: null,
      answers: [
        { id: ANSWER_ID_1, isCorrect: false },
        { id: ANSWER_ID_2, isCorrect: false },
      ],
    });

    await caller.submit({
      sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      participantId: '7290465d-5982-4b3d-ab47-a2088830d4b0',
      questionId: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
      answerIds: [ANSWER_ID_1],
    });

    expect(prismaMock.vote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          score: 0,
          selectedAnswers: { create: [{ answerOptionId: ANSWER_ID_1 }] },
        }),
      }),
    );
  });

  it('berechnet Punkte bei korrekter SINGLE_CHOICE-Antwort', async () => {
    prismaMock.question.findFirst.mockResolvedValue({
      id: 'question-1',
      quizId: 'quiz-1',
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM',
      ratingMin: null,
      ratingMax: null,
      answers: [
        { id: ANSWER_ID_1, isCorrect: true },
        { id: ANSWER_ID_2, isCorrect: false },
      ],
    });

    await caller.submit({
      sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      participantId: '7290465d-5982-4b3d-ab47-a2088830d4b0',
      questionId: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
      answerIds: [ANSWER_ID_1],
    });

    expect(prismaMock.vote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          score: 2000,
        }),
      }),
    );
  });

  it('lehnt Antwortoptionen bei FREETEXT ab', async () => {
    prismaMock.question.findFirst.mockResolvedValue({
      id: 'question-1',
      quizId: 'quiz-1',
      type: 'FREETEXT',
      difficulty: 'MEDIUM',
      ratingMin: null,
      ratingMax: null,
      answers: [],
    });

    await expect(
      caller.submit({
        sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
        participantId: '7290465d-5982-4b3d-ab47-a2088830d4b0',
        questionId: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
        answerIds: [ANSWER_ID_1],
        freeText: 'Antwort',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
