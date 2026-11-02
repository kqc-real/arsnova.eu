import { describe, expect, it } from 'vitest';
import type { SessionLearningObjectiveDTO } from '@arsnova/shared-types';
import {
  learningObjectiveMisconceptionLinks,
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

describe('learningObjectiveMisconceptionLinks', () => {
  const single = questionSet('11111111-1111-4111-8111-111111111111', 'Nur diese Frage erklären.', [
    QUESTION_A,
  ]);
  const secondSingle = questionSet(
    '22222222-2222-4222-8222-222222222222',
    'Dieselbe Frage noch einmal fassen.',
    [QUESTION_A],
  );
  const misconception = {
    questionId: QUESTION_A,
    questionOrder: 2,
    responseCount: 12,
    incorrectHigh: 4,
    topWrongOption: 'nur die Steigung',
  };

  it('nennt bestätigte Ziele, die genau die Frage mit Fehlkonzept betreffen', () => {
    expect(
      learningObjectiveMisconceptionLinks({
        objectives: [
          secondSingle,
          single,
          objective({
            id: '33333333-3333-4333-8333-333333333333',
            text: 'Quizweit',
            scope: { kind: 'quiz-wide' },
          }),
          questionSet('44444444-4444-4444-8444-444444444444', 'Zwei Fragen', [
            QUESTION_A,
            QUESTION_B,
          ]),
          questionSet('55555555-5555-4555-8555-555555555555', 'Andere Frage', [QUESTION_B]),
          {
            ...single,
            id: '66666666-6666-4666-8666-666666666666',
            text: 'Noch Entwurf',
            confirmation: { state: 'draft' },
          },
        ],
        questions: [misconception],
      }),
    ).toEqual([
      {
        objectiveId: single.id,
        objectiveText: 'Nur diese Frage erklären.',
        questionId: QUESTION_A,
        questionNumber: 3,
        incorrectHigh: 4,
        responseCount: 12,
        topWrongOption: 'nur die Steigung',
      },
      {
        objectiveId: secondSingle.id,
        objectiveText: 'Dieselbe Frage noch einmal fassen.',
        questionId: QUESTION_A,
        questionNumber: 3,
        incorrectHigh: 4,
        responseCount: 12,
        topWrongOption: 'nur die Steigung',
      },
    ]);
  });

  it('bleibt unter der Nachbesprechungsschwelle ohne Zielbezug', () => {
    expect(
      learningObjectiveMisconceptionLinks({
        objectives: [single],
        questions: [{ ...misconception, incorrectHigh: 1, responseCount: 12 }],
      }),
    ).toEqual([]);
  });
});
