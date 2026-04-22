import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createLegacyQuizHistoryAccessProof,
  createQuizHistoryAccessProof,
} from '@arsnova/shared-types';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    quiz: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

import { sessionRouter } from '../routers/session';

const caller = sessionRouter.createCaller({ req: undefined });
const QUIZ_ID = '11111111-1111-4111-8111-111111111111';
const HISTORY_SCOPE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
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

function buildStoredQuiz(overrides?: Partial<{ historyScopeId: string | null; name: string }>) {
  return {
    ...QUIZ_INPUT,
    id: QUIZ_ID,
    historyScopeId: overrides?.historyScopeId ?? null,
    name: overrides?.name ?? QUIZ_INPUT.name,
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
  };
}

describe('session.bindQuizHistoryScope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.quiz.updateMany.mockResolvedValue({ count: 1 });
  });

  it('bindet legacy-quizkopien mit gleichem namen an die stabile quiz-id', async () => {
    prismaMock.quiz.findUnique.mockResolvedValue(buildStoredQuiz());
    const accessProof = await createQuizHistoryAccessProof(QUIZ_INPUT);

    const result = await caller.bindQuizHistoryScope({
      quizId: QUIZ_ID,
      accessProof,
      historyScopeId: HISTORY_SCOPE_ID,
    });

    expect(prismaMock.quiz.updateMany).toHaveBeenCalledWith({
      where: {
        historyScopeId: null,
        name: 'Chemie',
      },
      data: { historyScopeId: HISTORY_SCOPE_ID },
    });
    expect(result).toEqual({ accessProof: HISTORY_SCOPE_ID });
  });

  it('gibt bestehenden stabilen scope zurueck, auch wenn noch ein legacy-proof uebergeben wird', async () => {
    prismaMock.quiz.findUnique.mockResolvedValue(
      buildStoredQuiz({ historyScopeId: HISTORY_SCOPE_ID }),
    );
    const accessProof = await createLegacyQuizHistoryAccessProof(QUIZ_INPUT);

    const result = await caller.bindQuizHistoryScope({
      quizId: QUIZ_ID,
      accessProof,
      historyScopeId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });

    expect(prismaMock.quiz.updateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ accessProof: HISTORY_SCOPE_ID });
  });
});
