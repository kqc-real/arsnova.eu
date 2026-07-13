import { buildConfidenceResult, type ConfidenceResult } from '@arsnova/shared-types';
import { prisma } from '../db';

export type ConfidenceAnswerOption = {
  id: string;
  text: string;
  isCorrect: boolean;
};

export async function loadConfidenceResultForQuestion(input: {
  sessionId: string;
  questionId: string;
  round: number;
  answerOptions?: ConfidenceAnswerOption[];
}): Promise<ConfidenceResult | null> {
  const votes = await prisma.vote.findMany({
    where: {
      sessionId: input.sessionId,
      questionId: input.questionId,
      round: input.round,
    },
    select: {
      confidenceValue: true,
      isCorrect: true,
      selectedAnswers: { select: { answerOptionId: true } },
    },
  });

  return buildConfidenceResult({
    votes: votes.map((vote) => ({
      confidenceValue: vote.confidenceValue,
      isCorrect: vote.isCorrect,
      selectedAnswerIds: vote.selectedAnswers.map((selected) => selected.answerOptionId),
    })),
    answerOptions: input.answerOptions,
  });
}
