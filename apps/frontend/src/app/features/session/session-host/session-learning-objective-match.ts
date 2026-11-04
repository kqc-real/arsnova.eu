import {
  isConfidenceDebriefRecommended,
  type SessionLearningObjectiveDTO,
} from '@arsnova/shared-types';

export type QuizQuestionNumberTask = {
  questionId: string;
  order: number;
};

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

/** 1-basierte Fragennummer aus dem Host-Fragenkatalog. */
export function quizQuestionNumberById(
  tasks: readonly QuizQuestionNumberTask[],
): ReadonlyMap<string, number> {
  return new Map(tasks.map((task) => [task.questionId, task.order + 1]));
}

/** Aufgelöste Fragennummern eines question-set-Ziels, aufsteigend und ohne Duplikate. */
export function learningObjectiveQuestionNumbers(
  objective: SessionLearningObjectiveDTO,
  numberByQuestionId: ReadonlyMap<string, number>,
): number[] {
  if (objective.purpose === 'forum-assignment' || objective.scope.kind !== 'question-set') {
    return [];
  }
  const numbers = new Set<number>();
  for (const reference of objective.scope.taskReferences) {
    if (reference.kind !== 'quiz-question') continue;
    const number = numberByQuestionId.get(reference.questionId);
    if (number !== undefined) numbers.add(number);
  }
  return [...numbers].sort((left, right) => left - right);
}

/**
 * Übersicht vor der ersten Frage: quizweite Ziele zuerst, dann question-set
 * nach kleinster Fragennummer, Sitzungsziele und unauflösbare Verweise zuletzt.
 */
export function sortLearningObjectivesByQuestionNumber<T extends SessionLearningObjectiveDTO>(
  objectives: readonly T[],
  tasks: readonly QuizQuestionNumberTask[],
): T[] {
  const numberByQuestionId = quizQuestionNumberById(tasks);
  return [...objectives].sort((left, right) => {
    const leftKey = overviewSortKey(left, numberByQuestionId);
    const rightKey = overviewSortKey(right, numberByQuestionId);
    if (leftKey.bucket !== rightKey.bucket) return leftKey.bucket - rightKey.bucket;
    const numberOrder = compareNumberLists(leftKey.numbers, rightKey.numbers);
    if (numberOrder !== 0) return numberOrder;
    return left.id.localeCompare(right.id);
  });
}

function overviewSortKey(
  objective: SessionLearningObjectiveDTO,
  numberByQuestionId: ReadonlyMap<string, number>,
): { bucket: number; numbers: readonly number[] } {
  if (objective.scope.kind === 'quiz-wide') return { bucket: 0, numbers: [] };
  if (objective.scope.kind === 'question-set') {
    const numbers = learningObjectiveQuestionNumbers(objective, numberByQuestionId);
    if (numbers.length > 0) return { bucket: 1, numbers };
  }
  return { bucket: 2, numbers: [] };
}

function compareNumberLists(left: readonly number[], right: readonly number[]): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if (index >= left.length) return -1;
    if (index >= right.length) return 1;
    const delta = left[index]! - right[index]!;
    if (delta !== 0) return delta;
  }
  return 0;
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

/** Bestätigtes Ziel, dessen Bereich genau eine Quizfrage ist. */
export function confirmedSingleQuestionLearningObjectives(
  objectives: readonly SessionLearningObjectiveDTO[],
  questionId: string,
): SessionLearningObjectiveDTO[] {
  return objectives
    .filter((objective) => objectiveRefersOnlyToQuizQuestion(objective, questionId))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export type LearningObjectiveMisconceptionQuestion = {
  readonly questionId: string;
  readonly questionOrder: number;
  readonly responseCount: number;
  readonly incorrectHigh: number;
  readonly topWrongOption?: string | null;
};

export type LearningObjectiveMisconceptionLink = {
  readonly objectiveId: string;
  readonly objectiveText: string;
  readonly questionId: string;
  readonly questionNumber: number;
  readonly incorrectHigh: number;
  readonly responseCount: number;
  readonly topWrongOption: string | null;
};

/**
 * Verbindet ein bestätigtes Ein-Fragen-Ziel mit der Nachbesprechungsschwelle
 * für falsche Antworten bei hoher Selbsteinschätzung.
 */
export function learningObjectiveMisconceptionLinks(input: {
  readonly objectives: readonly SessionLearningObjectiveDTO[];
  readonly questions: readonly LearningObjectiveMisconceptionQuestion[];
}): LearningObjectiveMisconceptionLink[] {
  const links: LearningObjectiveMisconceptionLink[] = [];
  for (const question of input.questions) {
    if (!questionMeetsConfidenceDebrief(question)) continue;
    const option = question.topWrongOption?.trim().replace(/\s+/g, ' ') ?? '';
    for (const objective of confirmedSingleQuestionLearningObjectives(
      input.objectives,
      question.questionId,
    )) {
      const objectiveText = objective.text.trim().replace(/\s+/g, ' ');
      if (objectiveText.length === 0) continue;
      links.push({
        objectiveId: objective.id,
        objectiveText,
        questionId: question.questionId,
        questionNumber: question.questionOrder + 1,
        incorrectHigh: question.incorrectHigh,
        responseCount: question.responseCount,
        topWrongOption: option.length > 0 ? option : null,
      });
    }
  }
  return links;
}

function objectiveRefersOnlyToQuizQuestion(
  objective: SessionLearningObjectiveDTO,
  questionId: string,
): boolean {
  if (objective.purpose === 'forum-assignment') return false;
  if (objective.confirmation.state !== 'confirmed') return false;
  if (objective.scope.kind !== 'question-set') return false;
  const [reference, ...rest] = objective.scope.taskReferences;
  return (
    rest.length === 0 && reference?.kind === 'quiz-question' && reference.questionId === questionId
  );
}

function questionMeetsConfidenceDebrief(question: LearningObjectiveMisconceptionQuestion): boolean {
  if (question.responseCount <= 0 || question.incorrectHigh <= 0) return false;
  return isConfidenceDebriefRecommended({
    responseCount: question.responseCount,
    result: {
      distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
      crossTab: {
        correctHigh: 0,
        correctMid: 0,
        correctLow: 0,
        incorrectHigh: question.incorrectHigh,
        incorrectMid: 0,
        incorrectLow: 0,
      },
      highConfidenceWrongCount: question.incorrectHigh,
    },
  });
}
