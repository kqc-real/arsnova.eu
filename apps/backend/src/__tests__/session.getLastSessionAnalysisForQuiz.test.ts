import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQuizHistoryAccessProof } from '@arsnova/shared-types';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    quiz: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    session: {
      findFirst: vi.fn(),
    },
    sessionFeedback: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

import { sessionRouter } from '../routers/session';

const caller = sessionRouter.createCaller({ req: undefined });
const QUIZ_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_QUIZ_ID = '22222222-2222-4222-8222-222222222222';
const QUIZ_INPUT = {
  name: 'Chemie',
  description: undefined,
  motifImageUrl: null,
  showLeaderboard: true,
  allowCustomNicknames: true,
  defaultTimer: null,
  timerScaleByDifficulty: false,
  enableSoundEffects: true,
  enableRewardEffects: true,
  enableMotivationMessages: true,
  enableEmojiReactions: true,
  anonymousMode: false,
  teamMode: false,
  teamCount: undefined,
  teamAssignment: 'AUTO' as const,
  teamNames: [],
  backgroundMusic: undefined,
  nicknameTheme: 'NOBEL_LAUREATES' as const,
  bonusTokenCount: 3,
  readingPhaseEnabled: true,
  preset: 'PLAYFUL' as const,
  questions: [
    {
      text: 'Was ist Wasser?',
      type: 'SINGLE_CHOICE' as const,
      timer: null,
      difficulty: 'EASY' as const,
      order: 0,
      ratingMin: undefined,
      ratingMax: undefined,
      ratingLabelMin: undefined,
      ratingLabelMax: undefined,
      answers: [
        { text: 'H2O', isCorrect: true },
        { text: 'CO2', isCorrect: false },
      ],
    },
  ],
};

describe('session.getLastSessionAnalysisForQuiz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.quiz.findUnique.mockResolvedValue({
      id: QUIZ_ID,
      ...QUIZ_INPUT,
      description: null,
      teamCount: null,
      backgroundMusic: null,
      questions: QUIZ_INPUT.questions.map((question) => ({
        ...question,
        ratingMin: null,
        ratingMax: null,
        ratingLabelMin: null,
        ratingLabelMax: null,
      })),
    });
    prismaMock.quiz.findMany.mockResolvedValue([
      {
        id: QUIZ_ID,
        ...QUIZ_INPUT,
        description: null,
        teamCount: null,
        backgroundMusic: null,
        questions: QUIZ_INPUT.questions.map((question) => ({
          ...question,
          ratingMin: null,
          ratingMax: null,
          ratingLabelMin: null,
          ratingLabelMax: null,
        })),
      },
    ]);
  });

  it('liefert die datensparsame Auswertung des neuesten beendeten Durchlaufs', async () => {
    const accessProof = await createQuizHistoryAccessProof(QUIZ_INPUT);
    const questionId = '33333333-3333-4333-8333-333333333333';
    const rightId = '44444444-4444-4444-8444-444444444444';
    const wrongId = '55555555-5555-4555-8555-555555555555';
    prismaMock.session.findFirst.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      endedAt: new Date('2026-03-11T12:00:00.000Z'),
      quiz: {
        questions: [
          {
            id: questionId,
            order: 0,
            text: '### Was ist Wasser?\n\n> **Hinweis:** Denke an die Summenformel.',
            type: 'SINGLE_CHOICE',
            confidenceEnabled: true,
            answers: [
              { id: rightId, text: 'H2O', isCorrect: true },
              { id: wrongId, text: 'CO2', isCorrect: false },
            ],
          },
        ],
      },
      votes: [
        {
          questionId,
          round: 1,
          confidenceValue: 5,
          isCorrect: false,
          selectedAnswers: [{ answerOptionId: wrongId }],
        },
        {
          questionId,
          round: 1,
          confidenceValue: 4,
          isCorrect: false,
          selectedAnswers: [{ answerOptionId: wrongId }],
        },
        {
          questionId,
          round: 1,
          confidenceValue: 5,
          isCorrect: true,
          selectedAnswers: [{ answerOptionId: rightId }],
        },
        {
          questionId,
          round: 1,
          confidenceValue: 2,
          isCorrect: true,
          selectedAnswers: [{ answerOptionId: rightId }],
        },
        {
          questionId,
          round: 1,
          confidenceValue: 1,
          isCorrect: false,
          selectedAnswers: [{ answerOptionId: wrongId }],
        },
      ],
      sessionFeedbacks: [],
      _count: { participants: 5 },
    });

    const result = await caller.getLastSessionAnalysisForQuiz({ quizId: QUIZ_ID, accessProof });

    expect(result).toMatchObject({
      endedAt: '2026-03-11T12:00:00.000Z',
      participantCount: 5,
      feedbackSummary: null,
      confidenceSummary: {
        responseCount: 5,
        includedQuestionCount: 1,
        suppressedQuestionCount: 0,
        priorityQuestionCount: 1,
        highConfidenceWrongCount: 2,
        questions: [
          {
            questionOrder: 0,
            questionTextShort: '### Was ist Wasser?\n\n> **Hinweis:** Denke an die Summenformel.',
            responseCount: 5,
          },
        ],
      },
    });
    expect(prismaMock.session.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          quizId: { in: [QUIZ_ID] },
          status: 'FINISHED',
        },
      }),
    );
  });

  it('lehnt Zugriff mit ungueltigem Besitz-Nachweis ab', async () => {
    await expect(
      caller.getLastSessionAnalysisForQuiz({
        quizId: QUIZ_ID,
        accessProof: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      }),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Zugriff auf diese Quiz-Historie ist nicht erlaubt.',
    });

    expect(prismaMock.session.findFirst).not.toHaveBeenCalled();
  });

  it('sucht die letzte Auswertung ueber alle passenden Quizkopien mit identischem Proof', async () => {
    const accessProof = await createQuizHistoryAccessProof(QUIZ_INPUT);
    prismaMock.quiz.findMany.mockResolvedValue([
      {
        id: QUIZ_ID,
        ...QUIZ_INPUT,
        description: null,
        teamCount: null,
        backgroundMusic: null,
        questions: QUIZ_INPUT.questions.map((question) => ({
          ...question,
          ratingMin: null,
          ratingMax: null,
          ratingLabelMin: null,
          ratingLabelMax: null,
        })),
      },
      {
        id: OTHER_QUIZ_ID,
        ...QUIZ_INPUT,
        description: null,
        teamCount: null,
        backgroundMusic: null,
        questions: QUIZ_INPUT.questions.map((question) => ({
          ...question,
          ratingMin: null,
          ratingMax: null,
          ratingLabelMin: null,
          ratingLabelMax: null,
        })),
      },
    ]);
    prismaMock.session.findFirst.mockResolvedValue(null);

    await caller.getLastSessionAnalysisForQuiz({ quizId: QUIZ_ID, accessProof });

    expect(prismaMock.session.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          quizId: { in: [QUIZ_ID, OTHER_QUIZ_ID] },
          status: 'FINISHED',
        }),
      }),
    );
  });
});
