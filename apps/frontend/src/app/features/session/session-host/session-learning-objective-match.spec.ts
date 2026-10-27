import { describe, expect, it } from 'vitest';
import type { SessionLearningObjectiveDTO } from '@arsnova/shared-types';
import {
  learningObjectiveQuestionNumbers,
  quizQuestionNumberById,
  sortLearningObjectivesByQuestionNumber,
} from './session-learning-objective-match';

const QUESTION_A = 'eb4a99f8-8d86-41ef-960c-130f6d9a48e3';
const QUESTION_B = 'fb4a99f8-8d86-41ef-960c-130f6d9a48e4';
const QUESTION_C = '0c4a99f8-8d86-41ef-960c-130f6d9a48e5';

const TASKS = [
  { questionId: QUESTION_A, order: 0 },
  { questionId: QUESTION_B, order: 1 },
  { questionId: QUESTION_C, order: 2 },
];

function objective(
  overrides: Partial<SessionLearningObjectiveDTO> &
    Pick<SessionLearningObjectiveDTO, 'id' | 'text'>,
): SessionLearningObjectiveDTO {
  return {
    revision: 1,
    scope: { kind: 'quiz-wide' },
    origin: { kind: 'manual' },
    confirmation: {
      state: 'confirmed',
      confirmedAt: '2026-10-27T10:00:00.000Z',
      confirmedRevision: 1,
    },
    projection: 'quiz-projected',
    purpose: 'learning-objective',
    createdAt: '2026-10-27T10:00:00.000Z',
    updatedAt: '2026-10-27T10:00:00.000Z',
    ...overrides,
  };
}

function questionSet(id: string, text: string, questionIds: readonly string[]) {
  return objective({
    id,
    text,
    scope: {
      kind: 'question-set',
      taskReferences: questionIds.map((questionId) => ({
        kind: 'quiz-question' as const,
        questionId,
      })),
    },
  });
}

describe('session-learning-objective-match question numbers', () => {
  it('mappt Katalogreihenfolge auf 1-basierte Fragennummern', () => {
    expect(quizQuestionNumberById(TASKS).get(QUESTION_C)).toBe(3);
  });

  it('sammelt eindeutige Fragennummern eines question-set-Ziels', () => {
    const numbers = learningObjectiveQuestionNumbers(
      questionSet('11111111-1111-4111-8111-111111111111', 'Mehrere Fragen', [
        QUESTION_C,
        QUESTION_A,
        QUESTION_C,
      ]),
      quizQuestionNumberById(TASKS),
    );
    expect(numbers).toEqual([1, 3]);
  });

  it('sortiert quizweite Ziele vor Fragenzielen und Sitzungsziele danach', () => {
    const quizWide = objective({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      text: 'Quizweit',
      scope: { kind: 'quiz-wide' },
    });
    const laterQuestion = questionSet('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Frage 3', [
      QUESTION_C,
    ]);
    const earlierQuestion = questionSet('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Frage 1', [
      QUESTION_A,
    ]);
    const sessionWide = objective({
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      text: 'Sitzung',
      scope: { kind: 'session' },
    });

    expect(
      sortLearningObjectivesByQuestionNumber(
        [laterQuestion, sessionWide, quizWide, earlierQuestion],
        TASKS,
      ).map((item) => item.text),
    ).toEqual(['Quizweit', 'Frage 1', 'Frage 3', 'Sitzung']);
  });

  it('ordnet ein Ziel mit mehreren Fragen nach der kleinsten Nummer ein', () => {
    const laterOnly = questionSet('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Nur Frage 2', [
      QUESTION_B,
    ]);
    const firstAndThird = questionSet('ffffffff-ffff-4fff-8fff-ffffffffffff', 'Fragen 1 und 3', [
      QUESTION_C,
      QUESTION_A,
    ]);

    expect(
      sortLearningObjectivesByQuestionNumber([laterOnly, firstAndThird], TASKS).map(
        (item) => item.text,
      ),
    ).toEqual(['Fragen 1 und 3', 'Nur Frage 2']);
  });
});
