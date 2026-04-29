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
  },
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

import { sessionRouter } from '../routers/session';

const caller = sessionRouter.createCaller({ req: undefined });
const QUIZ_ID = '11111111-1111-4111-8111-111111111111';
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

describe('session.getQuizCollectionHistoryAvailability', () => {
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

  it('liefert Verfügbarkeitsflags für Bonus-Codes und letztes Feedback', async () => {
    const accessProof = await createQuizHistoryAccessProof(QUIZ_INPUT);
    prismaMock.session.findFirst
      .mockResolvedValueOnce({ id: 'session-bonus' })
      .mockResolvedValueOnce(null);

    const result = await caller.getQuizCollectionHistoryAvailability([
      { quizId: QUIZ_ID, accessProof },
    ]);

    expect(result).toEqual([
      {
        quizId: QUIZ_ID,
        hasBonusTokens: true,
        hasLastSessionFeedback: false,
      },
    ]);
    expect(prismaMock.session.findFirst).toHaveBeenCalledTimes(2);
  });
});
