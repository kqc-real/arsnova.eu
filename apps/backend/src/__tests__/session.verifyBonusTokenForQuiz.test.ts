import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQuizHistoryAccessProof } from '@arsnova/shared-types';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    quiz: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    bonusToken: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
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

describe('session.verifyBonusTokenForQuiz', () => {
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
    prismaMock.bonusToken.deleteMany.mockResolvedValue({ count: 1 });
  });

  it('liefert gueltige Bonus-Code-Details aus der DB', async () => {
    const accessProof = await createQuizHistoryAccessProof(QUIZ_INPUT);
    prismaMock.bonusToken.findFirst.mockResolvedValue({
      token: 'BNS-TEST-1234',
      nickname: 'Ada',
      rank: 1,
      totalScore: 42,
      session: { code: 'ABCDEF' },
    });

    const result = await caller.verifyBonusTokenForQuiz({
      quizId: QUIZ_ID,
      accessProof,
      bonusCode: 'bns-test-1234',
    });

    expect(prismaMock.bonusToken.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          token: 'BNS-TEST-1234',
          session: expect.objectContaining({
            quizId: { in: [QUIZ_ID] },
            status: 'FINISHED',
          }),
        }),
      }),
    );
    expect(result).toEqual({
      valid: true,
      sessionCode: 'ABCDEF',
      nickname: 'Ada',
      rank: 1,
      totalScore: 42,
    });
  });

  it('liefert valid=false wenn kein Bonus-Code gefunden wird', async () => {
    const accessProof = await createQuizHistoryAccessProof(QUIZ_INPUT);
    prismaMock.bonusToken.findFirst.mockResolvedValue(null);

    const result = await caller.verifyBonusTokenForQuiz({
      quizId: QUIZ_ID,
      accessProof,
      bonusCode: 'BNS-UNKNOWN',
    });

    expect(result).toEqual({ valid: false });
  });

  it('lehnt Zugriff mit ungueltigem Besitz-Nachweis ab', async () => {
    await expect(
      caller.verifyBonusTokenForQuiz({
        quizId: QUIZ_ID,
        accessProof: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        bonusCode: 'BNS-TEST-1234',
      }),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Zugriff auf diese Quiz-Historie ist nicht erlaubt.',
    });

    expect(prismaMock.bonusToken.findFirst).not.toHaveBeenCalled();
  });

  it('loescht einen gueltigen Bonus-Code aus der Quiz-Historie', async () => {
    const accessProof = await createQuizHistoryAccessProof(QUIZ_INPUT);

    const result = await caller.deleteBonusTokenForQuiz({
      quizId: QUIZ_ID,
      accessProof,
      bonusCode: 'BNS-TEST-1234',
    });

    expect(prismaMock.bonusToken.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          token: 'BNS-TEST-1234',
          session: expect.objectContaining({
            quizId: { in: [QUIZ_ID] },
            status: 'FINISHED',
          }),
        }),
      }),
    );
    expect(result).toEqual({ deleted: true });
  });

  it('meldet deleted=false wenn beim Loeschen kein Bonus-Code vorhanden ist', async () => {
    const accessProof = await createQuizHistoryAccessProof(QUIZ_INPUT);
    prismaMock.bonusToken.deleteMany.mockResolvedValue({ count: 0 });

    const result = await caller.deleteBonusTokenForQuiz({
      quizId: QUIZ_ID,
      accessProof,
      bonusCode: 'BNS-ABCD-0000',
    });

    expect(result).toEqual({ deleted: false });
  });

  it('prueft und loescht Bonus-Codes ueber mehrere passende Quizkopien mit identischem Proof', async () => {
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
    prismaMock.bonusToken.findFirst.mockResolvedValue(null);

    await caller.verifyBonusTokenForQuiz({
      quizId: QUIZ_ID,
      accessProof,
      bonusCode: 'BNS-TEST-1234',
    });
    await caller.deleteBonusTokenForQuiz({
      quizId: QUIZ_ID,
      accessProof,
      bonusCode: 'BNS-TEST-1234',
    });

    expect(prismaMock.bonusToken.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          token: 'BNS-TEST-1234',
          session: expect.objectContaining({
            quizId: { in: [QUIZ_ID, OTHER_QUIZ_ID] },
            status: 'FINISHED',
          }),
        }),
      }),
    );
    expect(prismaMock.bonusToken.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          token: 'BNS-TEST-1234',
          session: expect.objectContaining({
            quizId: { in: [QUIZ_ID, OTHER_QUIZ_ID] },
            status: 'FINISHED',
          }),
        }),
      }),
    );
  });
});
