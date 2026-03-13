import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    quiz: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

import { quizRouter } from '../routers/quiz';

const caller = quizRouter.createCaller({});
const QUIZ_ID = '11111111-1111-4111-8111-111111111111';

describe('quiz.upload (Story 2.1a)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.quiz.create.mockResolvedValue({ id: QUIZ_ID });
  });

  it('erstellt Quiz mit Fragen und Antworten und liefert quizId', async () => {
    const input = {
      name: 'Test-Quiz',
      showLeaderboard: true,
      allowCustomNicknames: true,
      enableSoundEffects: true,
      enableRewardEffects: true,
      enableMotivationMessages: true,
      enableEmojiReactions: true,
      anonymousMode: false,
      teamMode: false,
      teamNames: [],
      nicknameTheme: 'NOBEL_LAUREATES' as const,
      questions: [
        {
          text: 'Was ist 2+2?',
          type: 'SINGLE_CHOICE' as const,
          difficulty: 'EASY' as const,
          order: 0,
          answers: [
            { text: '3', isCorrect: false },
            { text: '4', isCorrect: true },
          ],
        },
      ],
    };

    const result = await caller.upload(input);

    expect(result.quizId).toBe(QUIZ_ID);
    expect(prismaMock.quiz.create).toHaveBeenCalledTimes(1);
    const createCall = prismaMock.quiz.create.mock.calls[0]![0];
    expect(createCall.data.name).toBe('Test-Quiz');
    expect(createCall.data.questions.create).toHaveLength(1);
    expect(createCall.data.questions.create[0].text).toBe('Was ist 2+2?');
    expect(createCall.data.questions.create[0].answers.create).toHaveLength(2);
    expect(createCall.data.questions.create[0].answers.create[1]).toEqual({
      text: '4',
      isCorrect: true,
    });
  });

  it('übernimmt readingPhaseEnabled (default true)', async () => {
    const input = {
      name: 'Quiz',
      showLeaderboard: false,
      allowCustomNicknames: false,
      enableSoundEffects: false,
      enableRewardEffects: false,
      enableMotivationMessages: false,
      enableEmojiReactions: false,
      anonymousMode: false,
      teamMode: false,
      teamNames: [],
      nicknameTheme: 'NOBEL_LAUREATES' as const,
      questions: [
        {
          text: 'Frage',
          type: 'SINGLE_CHOICE' as const,
          difficulty: 'MEDIUM' as const,
          order: 0,
          answers: [{ text: 'A', isCorrect: true }],
        },
      ],
    };

    await caller.upload(input);

    expect(prismaMock.quiz.create.mock.calls[0]![0].data.readingPhaseEnabled).toBe(true);
  });
});
