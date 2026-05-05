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

describe('session.getLastSessionFeedbackForQuiz', () => {
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

  it('liefert aggregiertes Feedback fuer den letzten passenden Durchlauf', async () => {
    const accessProof = await createQuizHistoryAccessProof(QUIZ_INPUT);
    prismaMock.session.findFirst.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      endedAt: new Date('2026-03-10T12:00:00.000Z'),
    });
    prismaMock.sessionFeedback.findMany.mockResolvedValue([
      { overallRating: 5, questionQualityRating: 4, wouldRepeat: true },
      { overallRating: 3, questionQualityRating: null, wouldRepeat: false },
    ]);

    const result = await caller.getLastSessionFeedbackForQuiz({ quizId: QUIZ_ID, accessProof });

    expect(result).toEqual({
      endedAt: '2026-03-10T12:00:00.000Z',
      summary: {
        totalResponses: 2,
        overallAverage: 4,
        overallDistribution: { '3': 1, '5': 1 },
        questionQualityAverage: 4,
        questionQualityDistribution: { '4': 1 },
        wouldRepeatYes: 1,
        wouldRepeatNo: 1,
      },
    });
  });

  it('lehnt Zugriff mit ungueltigem Besitz-Nachweis ab', async () => {
    await expect(
      caller.getLastSessionFeedbackForQuiz({
        quizId: QUIZ_ID,
        accessProof: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      }),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Zugriff auf diese Quiz-Historie ist nicht erlaubt.',
    });

    expect(prismaMock.session.findFirst).not.toHaveBeenCalled();
  });

  it('sucht das letzte Feedback ueber alle passenden Quizkopien mit identischem Proof', async () => {
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

    await caller.getLastSessionFeedbackForQuiz({ quizId: QUIZ_ID, accessProof });

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
