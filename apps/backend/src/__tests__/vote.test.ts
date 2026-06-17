import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, checkVoteRateMock } = vi.hoisted(() => ({
  prismaMock: {
    participant: {
      findFirst: vi.fn(),
    },
    question: {
      findFirst: vi.fn(),
    },
    quiz: {
      findUnique: vi.fn(),
    },
    vote: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
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
const QUESTION_ID_2 = '33333333-3333-4333-a333-333333333333';

describe('vote.submit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkVoteRate).mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    prismaMock.participant.findFirst.mockResolvedValue({
      id: 'participant-1',
      sessionId: 'session-1',
      session: { status: 'ACTIVE', quizId: 'quiz-1' },
    });
    prismaMock.quiz.findUnique.mockResolvedValue({ defaultTimer: null });
    prismaMock.vote.findUnique.mockResolvedValue(null);
    prismaMock.vote.findFirst.mockResolvedValue(null);
    prismaMock.vote.create.mockResolvedValue({ id: '11111111-1111-4111-8111-111111111119' });
  });

  it('vergibt für FREETEXT immer 0 Punkte und speichert keine selectedAnswers', async () => {
    prismaMock.question.findFirst.mockResolvedValue({
      id: 'question-1',
      quizId: 'quiz-1',
      type: 'FREETEXT',
      difficulty: 'MEDIUM',
      shortTextMaxLength: null,
      shortTextCaseSensitive: false,
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
      shortTextMaxLength: null,
      shortTextCaseSensitive: false,
      ratingMin: null,
      ratingMax: null,
      answers: [
        { id: ANSWER_ID_1, text: 'A', isCorrect: false },
        { id: ANSWER_ID_2, text: 'B', isCorrect: false },
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
      shortTextMaxLength: null,
      shortTextCaseSensitive: false,
      ratingMin: null,
      ratingMax: null,
      answers: [
        { id: ANSWER_ID_1, text: '4', isCorrect: true },
        { id: ANSWER_ID_2, text: '5', isCorrect: false },
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
          streakCount: 1,
          streakBonus: 1.0,
        }),
      }),
    );
  });

  it('skaliert den Timer bei der Punkteberechnung nach Schwierigkeitsgrad', async () => {
    prismaMock.quiz.findUnique.mockResolvedValue({
      defaultTimer: 40,
      timerScaleByDifficulty: true,
    });
    prismaMock.question.findFirst.mockResolvedValue({
      id: 'question-1',
      quizId: 'quiz-1',
      type: 'SINGLE_CHOICE',
      difficulty: 'HARD',
      timer: null,
      shortTextMaxLength: null,
      shortTextCaseSensitive: false,
      ratingMin: null,
      ratingMax: null,
      answers: [
        { id: ANSWER_ID_1, text: 'A', isCorrect: true },
        { id: ANSWER_ID_2, text: 'B', isCorrect: false },
      ],
    });

    await caller.submit({
      sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      participantId: '7290465d-5982-4b3d-ab47-a2088830d4b0',
      questionId: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
      answerIds: [ANSWER_ID_1],
      responseTimeMs: 70000,
    });

    expect(prismaMock.vote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          score: 375,
        }),
      }),
    );
  });

  it('skaliert einen expliziten Frage-Timer bei der Punkteberechnung nicht', async () => {
    prismaMock.quiz.findUnique.mockResolvedValue({
      defaultTimer: 40,
      timerScaleByDifficulty: true,
    });
    prismaMock.question.findFirst.mockResolvedValue({
      id: 'question-1',
      quizId: 'quiz-1',
      type: 'SINGLE_CHOICE',
      difficulty: 'HARD',
      timer: 30,
      shortTextMaxLength: null,
      shortTextCaseSensitive: false,
      ratingMin: null,
      ratingMax: null,
      answers: [
        { id: ANSWER_ID_1, text: 'A', isCorrect: true },
        { id: ANSWER_ID_2, text: 'B', isCorrect: false },
      ],
    });

    await caller.submit({
      sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      participantId: '7290465d-5982-4b3d-ab47-a2088830d4b0',
      questionId: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
      answerIds: [ANSWER_ID_1],
      responseTimeMs: 20000,
    });

    expect(prismaMock.vote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          score: 1000,
        }),
      }),
    );
  });

  it('berechnet die Antwortzeit bei Timer-Fragen aus der Serverzeit', async () => {
    const activeAt = new Date('2026-05-24T10:00:00.000Z');
    const nowSpy = vi
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-05-24T10:00:10.000Z').getTime());
    prismaMock.participant.findFirst.mockResolvedValue({
      id: 'participant-1',
      sessionId: 'session-1',
      session: { status: 'ACTIVE', quizId: 'quiz-1', statusChangedAt: activeAt },
    });
    prismaMock.quiz.findUnique.mockResolvedValue({
      defaultTimer: 30,
      timerScaleByDifficulty: true,
    });
    prismaMock.question.findFirst.mockResolvedValue({
      id: 'question-1',
      quizId: 'quiz-1',
      type: 'SINGLE_CHOICE',
      difficulty: 'EASY',
      timer: null,
      shortTextMaxLength: null,
      shortTextCaseSensitive: false,
      ratingMin: null,
      ratingMax: null,
      answers: [
        { id: ANSWER_ID_1, text: 'A', isCorrect: true },
        { id: ANSWER_ID_2, text: 'B', isCorrect: false },
      ],
    });

    try {
      await caller.submit({
        sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
        participantId: '7290465d-5982-4b3d-ab47-a2088830d4b0',
        questionId: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
        answerIds: [ANSWER_ID_1],
        responseTimeMs: 0,
      });
    } finally {
      nowSpy.mockRestore();
    }

    expect(prismaMock.vote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          responseTimeMs: 10_000,
          score: 667,
        }),
      }),
    );
  });

  it('speichert die Antwortzeit auch ohne Countdown aus der Serverzeit', async () => {
    const activeAt = new Date('2026-05-24T10:00:00.000Z');
    const nowSpy = vi
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-05-24T10:00:07.500Z').getTime());
    prismaMock.participant.findFirst.mockResolvedValue({
      id: 'participant-1',
      sessionId: 'session-1',
      session: { status: 'ACTIVE', quizId: 'quiz-1', statusChangedAt: activeAt },
    });
    prismaMock.quiz.findUnique.mockResolvedValue({
      defaultTimer: null,
      timerScaleByDifficulty: true,
    });
    prismaMock.question.findFirst.mockResolvedValue({
      id: 'question-1',
      quizId: 'quiz-1',
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM',
      timer: null,
      shortTextMaxLength: null,
      shortTextCaseSensitive: false,
      ratingMin: null,
      ratingMax: null,
      answers: [
        { id: ANSWER_ID_1, text: 'A', isCorrect: true },
        { id: ANSWER_ID_2, text: 'B', isCorrect: false },
      ],
    });

    try {
      await caller.submit({
        sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
        participantId: '7290465d-5982-4b3d-ab47-a2088830d4b0',
        questionId: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
        answerIds: [ANSWER_ID_1],
      });
    } finally {
      nowSpy.mockRestore();
    }

    expect(prismaMock.vote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          responseTimeMs: 7500,
          score: 2000,
        }),
      }),
    );
  });

  it('erzwingt die aktuell aktive Frage', async () => {
    prismaMock.participant.findFirst.mockResolvedValue({
      id: 'participant-1',
      sessionId: 'session-1',
      session: {
        status: 'ACTIVE',
        quizId: 'quiz-1',
        currentQuestion: 1,
        currentRound: 1,
      },
    });
    prismaMock.question.findFirst.mockResolvedValue({
      id: 'question-1',
      order: 0,
      quizId: 'quiz-1',
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM',
      shortTextMaxLength: null,
      shortTextCaseSensitive: false,
      ratingMin: null,
      ratingMax: null,
      answers: [
        { id: ANSWER_ID_1, text: 'A', isCorrect: true },
        { id: ANSWER_ID_2, text: 'B', isCorrect: false },
      ],
    });

    await expect(
      caller.submit({
        sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
        participantId: '7290465d-5982-4b3d-ab47-a2088830d4b0',
        questionId: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
        answerIds: [ANSWER_ID_1],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(prismaMock.vote.create).not.toHaveBeenCalled();
  });

  it('erzwingt die aktuell aktive Abstimmungsrunde', async () => {
    prismaMock.participant.findFirst.mockResolvedValue({
      id: 'participant-1',
      sessionId: 'session-1',
      session: {
        status: 'ACTIVE',
        quizId: 'quiz-1',
        currentQuestion: 0,
        currentRound: 2,
      },
    });
    prismaMock.question.findFirst.mockResolvedValue({
      id: 'question-1',
      order: 0,
      quizId: 'quiz-1',
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM',
      shortTextMaxLength: null,
      shortTextCaseSensitive: false,
      ratingMin: null,
      ratingMax: null,
      answers: [
        { id: ANSWER_ID_1, text: 'A', isCorrect: true },
        { id: ANSWER_ID_2, text: 'B', isCorrect: false },
      ],
    });

    await expect(
      caller.submit({
        sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
        participantId: '7290465d-5982-4b3d-ab47-a2088830d4b0',
        questionId: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
        answerIds: [ANSWER_ID_1],
        round: 1,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(prismaMock.vote.create).not.toHaveBeenCalled();
  });

  it('wendet in Peer-Instruction-Runde 2 keinen versteckten Timer an', async () => {
    const activeAt = new Date('2026-05-24T10:00:00.000Z');
    const nowSpy = vi
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-05-24T10:02:00.000Z').getTime());
    prismaMock.participant.findFirst.mockResolvedValue({
      id: 'participant-1',
      sessionId: 'session-1',
      session: {
        status: 'ACTIVE',
        quizId: 'quiz-1',
        statusChangedAt: activeAt,
        currentQuestion: 0,
        currentRound: 2,
      },
    });
    prismaMock.quiz.findUnique.mockResolvedValue({
      defaultTimer: 30,
      timerScaleByDifficulty: true,
    });
    prismaMock.question.findFirst.mockResolvedValue({
      id: 'question-1',
      order: 0,
      quizId: 'quiz-1',
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM',
      timer: null,
      shortTextMaxLength: null,
      shortTextCaseSensitive: false,
      ratingMin: null,
      ratingMax: null,
      answers: [
        { id: ANSWER_ID_1, text: 'A', isCorrect: true },
        { id: ANSWER_ID_2, text: 'B', isCorrect: false },
      ],
    });

    try {
      await caller.submit({
        sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
        participantId: '7290465d-5982-4b3d-ab47-a2088830d4b0',
        questionId: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
        answerIds: [ANSWER_ID_1],
        round: 2,
      });
    } finally {
      nowSpy.mockRestore();
    }

    expect(prismaMock.vote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          responseTimeMs: 120_000,
          score: 2000,
          round: 2,
        }),
      }),
    );
  });

  it('lehnt Runde 2 nur fuer NUMERIC_ESTIMATE ohne Zwei-Runden-Konfiguration ab', async () => {
    prismaMock.participant.findFirst.mockResolvedValue({
      id: 'participant-1',
      sessionId: 'session-1',
      session: {
        status: 'ACTIVE',
        quizId: 'quiz-1',
        currentQuestion: 0,
        currentRound: 2,
      },
    });
    prismaMock.question.findFirst.mockResolvedValue({
      id: 'question-1',
      order: 0,
      quizId: 'quiz-1',
      type: 'NUMERIC_ESTIMATE',
      difficulty: 'MEDIUM',
      timer: null,
      shortTextMaxLength: null,
      shortTextCaseSensitive: false,
      ratingMin: null,
      ratingMax: null,
      numericTwoRounds: false,
      answers: [],
    });

    await expect(
      caller.submit({
        sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
        participantId: '7290465d-5982-4b3d-ab47-a2088830d4b0',
        questionId: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
        numericValue: 42,
        round: 2,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(prismaMock.vote.create).not.toHaveBeenCalled();
  });

  it('lehnt NUMERIC_ESTIMATE-Werte in Exponentialnotation mit zu vielen Nachkommastellen ab', async () => {
    prismaMock.question.findFirst.mockResolvedValue({
      id: 'question-1',
      order: 0,
      quizId: 'quiz-1',
      type: 'NUMERIC_ESTIMATE',
      difficulty: 'MEDIUM',
      timer: null,
      shortTextMaxLength: null,
      shortTextCaseSensitive: false,
      ratingMin: null,
      ratingMax: null,
      numericInputType: 'DECIMAL',
      numericDecimalPlaces: 2,
      numericMin: null,
      numericMax: null,
      numericTwoRounds: false,
      answers: [],
    });

    await expect(
      caller.submit({
        sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
        participantId: '7290465d-5982-4b3d-ab47-a2088830d4b0',
        questionId: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
        numericValue: 1e-7,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(prismaMock.vote.create).not.toHaveBeenCalled();
  });

  it('validiert NUMERIC_ESTIMATE-Dezimalstellen auch bei unerwartetem numericInputType', async () => {
    prismaMock.question.findFirst.mockResolvedValue({
      id: 'question-1',
      order: 0,
      quizId: 'quiz-1',
      type: 'NUMERIC_ESTIMATE',
      difficulty: 'MEDIUM',
      timer: null,
      shortTextMaxLength: null,
      shortTextCaseSensitive: false,
      ratingMin: null,
      ratingMax: null,
      numericInputType: 'FLOAT',
      numericDecimalPlaces: 2,
      numericMin: null,
      numericMax: null,
      numericTwoRounds: false,
      answers: [],
    });

    await expect(
      caller.submit({
        sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
        participantId: '7290465d-5982-4b3d-ab47-a2088830d4b0',
        questionId: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
        numericValue: 1.234,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(prismaMock.vote.create).not.toHaveBeenCalled();
  });

  it('setzt Streak nach falscher Antwort zurück (nächste richtige = Serie 1, ×1.0)', async () => {
    prismaMock.question.findFirst.mockResolvedValue({
      id: 'question-2',
      quizId: 'quiz-1',
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM',
      shortTextMaxLength: null,
      shortTextCaseSensitive: false,
      ratingMin: null,
      ratingMax: null,
      answers: [
        { id: ANSWER_ID_1, text: 'A', isCorrect: true },
        { id: ANSWER_ID_2, text: 'B', isCorrect: false },
      ],
    });
    prismaMock.vote.findFirst.mockResolvedValue({
      score: 0,
      streakCount: 0,
    });

    await caller.submit({
      sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      participantId: '7290465d-5982-4b3d-ab47-a2088830d4b0',
      questionId: QUESTION_ID_2,
      answerIds: [ANSWER_ID_1],
    });

    expect(prismaMock.vote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          score: 2000,
          streakCount: 1,
          streakBonus: 1.0,
        }),
      }),
    );
  });

  it('erhöht Streak bei aufeinanderfolgenden richtigen SC-Antworten (×1.1 ab 2. Treffer)', async () => {
    prismaMock.question.findFirst.mockResolvedValue({
      id: 'question-2',
      quizId: 'quiz-1',
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM',
      shortTextMaxLength: null,
      shortTextCaseSensitive: false,
      ratingMin: null,
      ratingMax: null,
      answers: [
        { id: ANSWER_ID_1, text: 'A', isCorrect: true },
        { id: ANSWER_ID_2, text: 'B', isCorrect: false },
      ],
    });
    prismaMock.vote.findFirst.mockResolvedValue({
      score: 2000,
      streakCount: 1,
    });

    await caller.submit({
      sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      participantId: '7290465d-5982-4b3d-ab47-a2088830d4b0',
      questionId: QUESTION_ID_2,
      answerIds: [ANSWER_ID_1],
    });

    expect(prismaMock.vote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          score: 2200,
          streakCount: 2,
          streakBonus: 1.1,
        }),
      }),
    );
  });

  it('beruecksichtigt SHORT_TEXT beim Streak-Verlauf', async () => {
    prismaMock.question.findFirst.mockResolvedValue({
      id: 'question-2',
      quizId: 'quiz-1',
      type: 'SHORT_TEXT',
      difficulty: 'MEDIUM',
      shortTextMaxLength: 40,
      shortTextCaseSensitive: false,
      ratingMin: null,
      ratingMax: null,
      answers: [{ id: ANSWER_ID_1, text: 'Ada Lovelace', isCorrect: true }],
    });
    prismaMock.vote.findFirst.mockResolvedValue({
      score: 2000,
      streakCount: 1,
    });

    await caller.submit({
      sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      participantId: '7290465d-5982-4b3d-ab47-a2088830d4b0',
      questionId: QUESTION_ID_2,
      freeText: 'Ada Lovelace',
    });

    expect(prismaMock.vote.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          question: {
            type: { in: ['MULTIPLE_CHOICE', 'SINGLE_CHOICE', 'SHORT_TEXT', 'NUMERIC_ESTIMATE'] },
          },
        }),
      }),
    );
    expect(prismaMock.vote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          score: 2200,
          streakCount: 2,
          streakBonus: 1.1,
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
      shortTextMaxLength: null,
      shortTextCaseSensitive: false,
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

  it('bewertet SHORT_TEXT korrekt und speichert normalisierte Kurzantwort', async () => {
    prismaMock.question.findFirst.mockResolvedValue({
      id: 'question-1',
      quizId: 'quiz-1',
      type: 'SHORT_TEXT',
      difficulty: 'MEDIUM',
      shortTextMaxLength: 40,
      shortTextCaseSensitive: false,
      ratingMin: null,
      ratingMax: null,
      answers: [
        { id: ANSWER_ID_1, text: 'Ada Lovelace', isCorrect: true },
        { id: ANSWER_ID_2, text: 'A. Lovelace', isCorrect: true },
      ],
    });

    await caller.submit({
      sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      participantId: '7290465d-5982-4b3d-ab47-a2088830d4b0',
      questionId: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
      freeText: '  Ada   Lovelace  ',
    });

    expect(prismaMock.vote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          score: 2000,
          freeText: 'Ada Lovelace',
          selectedAnswers: undefined,
          streakCount: 1,
        }),
      }),
    );
  });

  it('lehnt zu lange SHORT_TEXT-Antworten ab', async () => {
    prismaMock.question.findFirst.mockResolvedValue({
      id: 'question-1',
      quizId: 'quiz-1',
      type: 'SHORT_TEXT',
      difficulty: 'MEDIUM',
      shortTextMaxLength: 5,
      shortTextCaseSensitive: false,
      ratingMin: null,
      ratingMax: null,
      answers: [{ id: ANSWER_ID_1, text: 'Ada', isCorrect: true }],
    });

    await expect(
      caller.submit({
        sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
        participantId: '7290465d-5982-4b3d-ab47-a2088830d4b0',
        questionId: '7ed3cc25-3179-4a91-9dc3-acc00971fb46',
        freeText: 'Ada Lovelace',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
