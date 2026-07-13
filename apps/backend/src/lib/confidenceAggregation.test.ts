import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    vote: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

import { loadConfidenceResultForQuestion } from './confidenceAggregation';

describe('loadConfidenceResultForQuestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aggregiert Confidence-Werte mit Korrektheit und falschen Optionen', async () => {
    prismaMock.vote.findMany.mockResolvedValue([
      {
        confidenceValue: 5,
        isCorrect: false,
        selectedAnswers: [{ answerOptionId: 'wrong-a' }],
      },
      {
        confidenceValue: 2,
        isCorrect: true,
        selectedAnswers: [{ answerOptionId: 'right' }],
      },
    ]);

    const result = await loadConfidenceResultForQuestion({
      sessionId: 'session-1',
      questionId: 'question-1',
      round: 1,
      answerOptions: [
        { id: 'wrong-a', text: 'Falsch', isCorrect: false },
        { id: 'right', text: 'Richtig', isCorrect: true },
      ],
    });

    expect(result).toMatchObject({
      highConfidenceWrongCount: 1,
      crossTab: {
        correctHigh: 0,
        correctMid: 0,
        correctLow: 1,
        incorrectHigh: 1,
        incorrectMid: 0,
        incorrectLow: 0,
      },
      highConfidenceWrongOptions: [{ answerId: 'wrong-a', text: 'Falsch', count: 1 }],
    });
  });
});
