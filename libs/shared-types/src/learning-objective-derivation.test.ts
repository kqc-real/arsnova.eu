import { describe, expect, it } from 'vitest';
import {
  LEARNING_OBJECTIVE_DERIVATION_SCHEMA_VERSION,
  LEARNING_OBJECTIVE_DERIVATION_VERSION,
  GetLearningObjectiveDerivationProgressOutputSchema,
  LearningObjectiveDerivationInputSchema,
  LearningObjectiveDerivationResultSchema,
  LearningObjectiveDerivedDraftSchema,
  type LearningObjectiveDerivationInput,
} from './learning-objective-derivation.js';

const OPERATION_ID = '11111111-1111-4111-8111-111111111111';
const QUIZ_ID = '22222222-2222-4222-8222-222222222222';
const QUESTION_ID = '33333333-3333-4333-8333-333333333333';

function validInput(): LearningObjectiveDerivationInput {
  return {
    schemaVersion: LEARNING_OBJECTIVE_DERIVATION_SCHEMA_VERSION,
    operationId: OPERATION_ID,
    quizId: QUIZ_ID,
    expectedBundleRevision: 4,
    locale: 'de',
    maximumDrafts: 96,
    questions: [
      {
        sourceQuestionId: QUESTION_ID,
        enabled: true,
        order: 0,
        text: 'Welche Aussage stimmt?',
        type: 'SINGLE_CHOICE',
        answers: [
          { text: 'Richtig', isCorrect: true },
          { text: 'Falsch', isCorrect: false },
        ],
      },
    ],
  };
}

function validDraft() {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    revision: 0,
    text: 'Die Studierenden können die richtige Aussage begründen.',
    scope: { kind: 'question-set', sourceQuestionIds: [QUESTION_ID] },
    origin: {
      kind: 'model-derived',
      modelId: 'open-weight-llm',
      modelVersion: 'fixture-model',
      derivationVersion: LEARNING_OBJECTIVE_DERIVATION_VERSION,
      derivedFromSourceQuestionIds: [QUESTION_ID],
      sourceDigest: 'a'.repeat(64),
    },
    confirmation: { state: 'draft' },
    createdAt: '2026-10-05T12:00:00.000Z',
    updatedAt: '2026-10-05T12:00:00.000Z',
  } as const;
}

describe('learning-objective derivation contracts', () => {
  it('reuses the full quiz-question contract and rejects shadow/unknown fields', () => {
    expect(LearningObjectiveDerivationInputSchema.parse(validInput())).toMatchObject({
      operationId: OPERATION_ID,
      questions: [{ sourceQuestionId: QUESTION_ID, enabled: true }],
    });
    expect(
      LearningObjectiveDerivationInputSchema.safeParse({
        ...validInput(),
        questions: [{ ...validInput().questions[0]!, solution: 'leak' }],
      }).success,
    ).toBe(false);
    expect(
      LearningObjectiveDerivationInputSchema.safeParse({
        ...validInput(),
        questions: [validInput().questions[0]!, { ...validInput().questions[0]!, order: 1 }],
      }).success,
    ).toBe(false);
    expect(
      LearningObjectiveDerivationInputSchema.safeParse({
        ...validInput(),
        maximumDrafts: 0,
      }).success,
    ).toBe(false);
    expect(
      LearningObjectiveDerivationInputSchema.safeParse({
        ...validInput(),
        maximumDrafts: 101,
      }).success,
    ).toBe(false);
  });

  it('permits only a model-derived, unconfirmed, question-set draft', () => {
    expect(LearningObjectiveDerivedDraftSchema.parse(validDraft())).toEqual(validDraft());
    expect(
      LearningObjectiveDerivedDraftSchema.safeParse({
        ...validDraft(),
        confirmation: {
          state: 'confirmed',
          confirmedAt: '2026-10-05T12:00:00.000Z',
          confirmedRevision: 0,
        },
      }).success,
    ).toBe(false);
    expect(
      LearningObjectiveDerivedDraftSchema.safeParse({
        ...validDraft(),
        origin: {
          ...validDraft().origin,
          derivedFromSourceQuestionIds: ['55555555-5555-4555-8555-555555555555'],
        },
      }).success,
    ).toBe(false);
  });

  it('models completion, manual overload retry, and explicit single-input overflow strictly', () => {
    const correlation = {
      schemaVersion: LEARNING_OBJECTIVE_DERIVATION_SCHEMA_VERSION,
      operationId: OPERATION_ID,
      quizId: QUIZ_ID,
      expectedBundleRevision: 4,
    } as const;
    expect(
      LearningObjectiveDerivationResultSchema.parse({
        ...correlation,
        status: 'completed',
        drafts: [validDraft()],
        limitations: [],
        batchCount: 1,
      }).status,
    ).toBe('completed');
    expect(
      LearningObjectiveDerivationResultSchema.parse({
        ...correlation,
        status: 'busy',
        retry: 'manual',
      }),
    ).toMatchObject({ status: 'busy', retry: 'manual' });
    expect(
      LearningObjectiveDerivationResultSchema.parse({
        ...correlation,
        status: 'input_too_large',
        sourceQuestionId: QUESTION_ID,
      }),
    ).toMatchObject({ status: 'input_too_large', sourceQuestionId: QUESTION_ID });
    expect(
      LearningObjectiveDerivationResultSchema.safeParse({
        ...correlation,
        status: 'busy',
        retry: 'automatic',
      }).success,
    ).toBe(false);
    expect(
      LearningObjectiveDerivationResultSchema.safeParse({
        ...correlation,
        status: 'completed',
        drafts: [],
        limitations: [],
        batchCount: 1,
        confidence: 1,
      }).success,
    ).toBe(false);
    expect(
      LearningObjectiveDerivationResultSchema.safeParse({
        ...correlation,
        status: 'aborted',
      }).success,
    ).toBe(false);
    expect(
      LearningObjectiveDerivationResultSchema.parse({
        ...correlation,
        status: 'timeout',
        progress: {
          completedGroups: 1,
          totalGroups: 4,
          elapsedMs: 90_000,
          promptTokens: 800,
          completionTokens: 160,
          queuedObjectives: 3,
        },
      }),
    ).toMatchObject({
      status: 'timeout',
      progress: { completedGroups: 1, totalGroups: 4, queuedObjectives: 3 },
    });
    expect(
      GetLearningObjectiveDerivationProgressOutputSchema.parse({
        ...correlation,
        found: true,
        progress: {
          completedGroups: 1,
          totalGroups: 4,
          elapsedMs: 90_000,
          promptTokens: 800,
          completionTokens: 160,
          queuedObjectives: 3,
        },
      }),
    ).toMatchObject({ found: true, progress: { completedGroups: 1, queuedObjectives: 3 } });
    expect(
      GetLearningObjectiveDerivationProgressOutputSchema.parse({
        ...correlation,
        found: false,
        progress: null,
      }),
    ).toMatchObject({ found: false, progress: null });
  });
});
