import type { SessionLearningObjectiveDTO } from '@arsnova/shared-types';

/** Quizweites Ziel oder ein Ziel, das die aktuelle Quizfrage ausdrücklich nennt. */
export function learningObjectiveAppliesToQuestion(
  objective: SessionLearningObjectiveDTO,
  questionId: string,
): boolean {
  if (objective.purpose === 'forum-assignment') return false;
  if (objective.scope.kind === 'quiz-wide') return true;
  if (objective.scope.kind !== 'question-set') return false;
  return objective.scope.taskReferences.some(
    (reference) => reference.kind === 'quiz-question' && reference.questionId === questionId,
  );
}

export function isConfirmedDisplayedLearningObjective(
  objective: SessionLearningObjectiveDTO,
): boolean {
  return objective.purpose !== 'forum-assignment' && objective.confirmation.state === 'confirmed';
}

export function confirmedLearningObjectiveAppliesToQuestion(
  objective: SessionLearningObjectiveDTO,
  questionId: string,
): boolean {
  return (
    objective.confirmation.state === 'confirmed' &&
    learningObjectiveAppliesToQuestion(objective, questionId)
  );
}
