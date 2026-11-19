import type { SessionLearningOverviewDTO } from '@arsnova/shared-types';
import { isFullyCorrectCompetitionVote, type CompetitionVoteRow } from './sessionRankingCache';

export function buildSessionLearningOverview(
  questions: readonly { id: string; order: number; text: string }[],
  participantIds: readonly string[],
  effectiveVotes: readonly CompetitionVoteRow[],
): SessionLearningOverviewDTO {
  const statsByQuestion = new Map(
    questions.map(({ id, order, text }) => [
      id,
      { questionId: id, questionOrder: order, text, correctCount: 0, responseCount: 0 },
    ]),
  );
  const participants = new Set(participantIds);
  const correctByRespondent = new Map<string, number>();
  for (const vote of effectiveVotes) {
    const stats = statsByQuestion.get(vote.questionId);
    if (!stats || !participants.has(vote.participantId)) continue;
    const correct = Number(isFullyCorrectCompetitionVote(vote));
    stats.responseCount += 1;
    stats.correctCount += correct;
    correctByRespondent.set(
      vote.participantId,
      (correctByRespondent.get(vote.participantId) ?? 0) + correct,
    );
  }

  const counts = [...correctByRespondent.values()].sort((a, b) => a - b);
  const distribution: SessionLearningOverviewDTO['distribution'] = [0, 0, 0, 0];
  for (const count of counts) {
    const band = Math.min(3, Math.floor((4 * count) / questions.length));
    distribution[band] += 1;
  }
  const middle = Math.floor(counts.length / 2);
  const medianCorrectCount =
    counts.length === 0 ? null : (counts[Math.floor((counts.length - 1) / 2)] + counts[middle]) / 2;

  const reviewQuestions = [...statsByQuestion.values()]
    .filter(
      ({ correctCount, responseCount }) =>
        responseCount > 0 && 3 * correctCount < 2 * responseCount,
    )
    .sort(
      (a, b) =>
        a.correctCount / a.responseCount - b.correctCount / b.responseCount ||
        b.responseCount - a.responseCount ||
        a.questionOrder - b.questionOrder,
    )
    .slice(0, 3);

  return {
    questionCount: questions.length,
    respondentCount: counts.length,
    noResponseCount: participants.size - counts.length,
    medianCorrectCount,
    distribution,
    reviewQuestions,
  };
}
