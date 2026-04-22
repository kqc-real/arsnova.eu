import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQuizHistoryAccessProof } from '@arsnova/shared-types';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    quiz: {
      findUnique: vi.fn(),
    },
    session: {
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

describe('session.getBonusTokensForQuiz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.quiz.findUnique.mockResolvedValue({
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
  });

  it('liefert beendete Sessions mit Bonus-Tokens zur Server-Quiz-ID', async () => {
    const endedAt = new Date('2026-03-10T12:00:00.000Z');
    const generatedAt = new Date('2026-03-10T12:05:00.000Z');
    const accessProof = await createQuizHistoryAccessProof(QUIZ_INPUT);
    prismaMock.session.findMany.mockResolvedValue([
      {
        id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
        code: 'ABCDEF',
        endedAt,
        startedAt: new Date('2026-03-10T11:00:00.000Z'),
        quiz: { name: 'Chemie' },
        bonusTokens: [
          {
            token: 'BNS-TEST-1234',
            nickname: 'Ada',
            quizName: 'Chemie',
            totalScore: 42,
            rank: 1,
            generatedAt,
          },
        ],
      },
    ]);

    const result = await caller.getBonusTokensForQuiz({ quizId: QUIZ_ID, accessProof });

    expect(prismaMock.session.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          quizId: QUIZ_ID,
          status: 'FINISHED',
        }),
      }),
    );
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]?.sessionCode).toBe('ABCDEF');
    expect(result.sessions[0]?.endedAt).toBe(endedAt.toISOString());
    expect(result.sessions[0]?.tokens[0]?.token).toBe('BNS-TEST-1234');
  });

  it('lehnt Zugriff mit ungueltigem Besitz-Nachweis ab', async () => {
    await expect(
      caller.getBonusTokensForQuiz({
        quizId: QUIZ_ID,
        accessProof: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      }),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Zugriff auf diese Quiz-Historie ist nicht erlaubt.',
    });

    expect(prismaMock.session.findMany).not.toHaveBeenCalled();
  });
});
