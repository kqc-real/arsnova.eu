import { describe, expect, it } from 'vitest';
import {
  LEARNING_OBJECTIVE_MAX_OBJECTIVES,
  LEARNING_OBJECTIVE_MAX_REFERENCES,
  LEARNING_OBJECTIVE_REVISION_MAX,
  LEARNING_OBJECTIVE_TEXT_MAX_LENGTH,
  SESSION_LEARNING_OBJECTIVE_QA_TASK_CATALOG_MAX,
  QuizLearningObjectiveBundleV1Schema,
  SaveSessionLearningObjectivesInputSchema,
  SessionLearningObjectiveAvailableQaTaskSchema,
  SessionLearningObjectiveAvailableQuizTaskSchema,
  SessionLearningObjectiveDTOSchema,
  SessionLearningObjectivesSnapshotSchema,
  findUnresolvedQuizLearningObjectiveReferences,
  type QuizLearningObjectiveBundleV1,
} from './learning-objectives.js';
import {
  QUIZ_QUESTION_TEXT_MAX_LENGTH,
  QUIZ_UPLOAD_MAX_QUESTIONS,
} from './quiz-contract-limits.js';

const QUIZ_ID = '11111111-1111-4111-8111-111111111111';
const QUESTION_A_ID = '22222222-2222-4222-8222-222222222222';
const QUESTION_B_ID = '33333333-3333-4333-8333-333333333333';
const QA_QUESTION_ID = '44444444-4444-4444-8444-444444444444';
const OBJECTIVE_A_ID = '55555555-5555-4555-8555-555555555555';
const OBJECTIVE_B_ID = '66666666-6666-4666-8666-666666666666';
const SESSION_ID = '77777777-7777-4777-8777-777777777777';
const CREATED_AT = '2026-10-04T08:00:00.000Z';
const UPDATED_AT = '2026-10-04T08:05:00.000Z';
const SOURCE_DIGEST = 'a'.repeat(64);

function validBundle(): QuizLearningObjectiveBundleV1 {
  return {
    schemaVersion: 1,
    quizId: QUIZ_ID,
    revision: 4,
    objectives: [
      {
        id: OBJECTIVE_A_ID,
        revision: 2,
        text: 'Die Studierenden können lineare Regressionsmodelle anwenden.',
        scope: { kind: 'quiz-wide' },
        origin: { kind: 'manual' },
        confirmation: {
          state: 'confirmed',
          confirmedAt: UPDATED_AT,
          confirmedRevision: 2,
        },
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
      {
        id: OBJECTIVE_B_ID,
        revision: 3,
        text: 'Die Studierenden können Regressionsparameter interpretieren.',
        scope: {
          kind: 'question-set',
          sourceQuestionIds: [QUESTION_A_ID, QUESTION_B_ID],
        },
        origin: {
          kind: 'model-derived',
          modelId: 'qwen3-4b-instruct-2507',
          modelVersion: 'q4_k_m',
          derivationVersion: 'learning-objective-v1',
          derivedFromSourceQuestionIds: [QUESTION_A_ID],
          sourceDigest: SOURCE_DIGEST,
        },
        confirmation: {
          state: 'needs-review',
          previousConfirmation: {
            state: 'confirmed',
            revision: 2,
            confirmedAt: CREATED_AT,
          },
          currentRevision: 3,
          reason: 'source-content-changed',
        },
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    ],
  };
}

function validSessionObjective() {
  return {
    id: OBJECTIVE_A_ID,
    revision: 2,
    text: 'Die Studierenden können lineare Regressionsmodelle anwenden.',
    scope: { kind: 'session' as const },
    origin: { kind: 'manual' as const },
    confirmation: {
      state: 'confirmed' as const,
      confirmedAt: UPDATED_AT,
      confirmedRevision: 2,
    },
    projection: 'session-manual' as const,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  };
}

describe('quiz learning-objective sidecar contract', () => {
  it('accepts a bounded versioned bundle with independent origin and confirmation', () => {
    expect(QuizLearningObjectiveBundleV1Schema.parse(validBundle())).toEqual(validBundle());
  });

  it('rejects unknown sidecar schema versions instead of stripping them', () => {
    expect(
      QuizLearningObjectiveBundleV1Schema.safeParse({
        ...validBundle(),
        schemaVersion: 2,
      }).success,
    ).toBe(false);
  });

  it('keeps stable IDs unique and question-set references explicit and unique', () => {
    const duplicateIds = validBundle();
    duplicateIds.objectives[1]!.id = duplicateIds.objectives[0]!.id;
    expect(QuizLearningObjectiveBundleV1Schema.safeParse(duplicateIds).success).toBe(false);

    const duplicateReferences = validBundle();
    const objective = duplicateReferences.objectives[1]!;
    if (objective.scope.kind !== 'question-set') throw new Error('invalid test fixture');
    objective.scope.sourceQuestionIds = [QUESTION_A_ID, QUESTION_A_ID];
    expect(QuizLearningObjectiveBundleV1Schema.safeParse(duplicateReferences).success).toBe(false);
  });

  it('requires model derivation references to stay inside an explicit question-set scope', () => {
    const bundle = validBundle();
    const objective = bundle.objectives[1]!;
    if (objective.origin.kind !== 'model-derived') throw new Error('invalid test fixture');
    objective.origin.derivedFromSourceQuestionIds = ['88888888-8888-4888-8888-888888888888'];
    expect(QuizLearningObjectiveBundleV1Schema.safeParse(bundle).success).toBe(false);
  });

  it('reports foreign or removed question references without deriving IDs from content', () => {
    const issues = findUnresolvedQuizLearningObjectiveReferences(
      validBundle(),
      new Set([QUESTION_A_ID]),
    );
    expect(issues).toEqual([
      {
        objectiveIndex: 1,
        field: 'scope',
        referenceIndex: 1,
        sourceQuestionId: QUESTION_B_ID,
      },
    ]);
  });

  it('enforces objective, reference, and compact-text limits', () => {
    const tooManyObjectives = validBundle();
    tooManyObjectives.objectives = Array.from(
      { length: LEARNING_OBJECTIVE_MAX_OBJECTIVES + 1 },
      (_, index) => ({
        ...validBundle().objectives[0]!,
        id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      }),
    );
    expect(QuizLearningObjectiveBundleV1Schema.safeParse(tooManyObjectives).success).toBe(false);

    const tooManyReferences = validBundle();
    const objective = tooManyReferences.objectives[1]!;
    if (objective.scope.kind !== 'question-set') throw new Error('invalid test fixture');
    objective.scope.sourceQuestionIds = Array.from(
      { length: LEARNING_OBJECTIVE_MAX_REFERENCES + 1 },
      (_, index) => `00000000-0000-4000-8001-${String(index).padStart(12, '0')}`,
    );
    expect(QuizLearningObjectiveBundleV1Schema.safeParse(tooManyReferences).success).toBe(false);

    const longText = validBundle();
    longText.objectives[0]!.text = 'x'.repeat(LEARNING_OBJECTIVE_TEXT_MAX_LENGTH + 1);
    expect(QuizLearningObjectiveBundleV1Schema.safeParse(longText).success).toBe(false);
  });

  it('rejects revision contradictions and backwards timestamps', () => {
    const staleConfirmation = validBundle();
    const confirmation = staleConfirmation.objectives[0]!.confirmation;
    if (confirmation.state !== 'confirmed') throw new Error('invalid test fixture');
    confirmation.confirmedRevision = 1;
    expect(QuizLearningObjectiveBundleV1Schema.safeParse(staleConfirmation).success).toBe(false);

    const backwardsTime = validBundle();
    backwardsTime.objectives[0]!.updatedAt = '2026-10-04T07:59:59.000Z';
    expect(QuizLearningObjectiveBundleV1Schema.safeParse(backwardsTime).success).toBe(false);

    const impossibleConfirmationTime = validBundle();
    const impossibleConfirmation = impossibleConfirmationTime.objectives[0]!.confirmation;
    if (impossibleConfirmation.state !== 'confirmed') throw new Error('invalid test fixture');
    impossibleConfirmation.confirmedAt = '2026-10-04T07:59:59.000Z';
    expect(QuizLearningObjectiveBundleV1Schema.safeParse(impossibleConfirmationTime).success).toBe(
      false,
    );

    expect(
      QuizLearningObjectiveBundleV1Schema.safeParse({
        ...validBundle(),
        revision: LEARNING_OBJECTIVE_REVISION_MAX + 1,
      }).success,
    ).toBe(false);
  });

  it('represents review-needed drafts without inventing a confirmation', () => {
    const bundle = validBundle();
    bundle.objectives[1]!.confirmation = {
      state: 'needs-review',
      previousConfirmation: { state: 'draft', revision: 2 },
      currentRevision: 3,
      reason: 'source-content-changed',
    };
    expect(QuizLearningObjectiveBundleV1Schema.safeParse(bundle).success).toBe(true);
  });

  it('strictly rejects solution material and unrelated fields in the sidecar', () => {
    const bundle = validBundle() as unknown as Record<string, unknown>;
    const objectives = bundle['objectives'] as Array<Record<string, unknown>>;
    objectives[0]!['answers'] = [{ text: '42', isCorrect: true }];
    expect(QuizLearningObjectiveBundleV1Schema.safeParse(bundle).success).toBe(false);
  });
});

describe('session learning-objective host contract', () => {
  it('accepts a host-safe manual Q&A objective and a read-only lifecycle state', () => {
    const snapshot = {
      schemaVersion: 1,
      sessionId: SESSION_ID,
      learningContextRevision: 5,
      configured: true,
      access: { state: 'read-only', reason: 'session-finished' },
      availableQuizTasks: [
        {
          kind: 'quiz-question',
          questionId: QUESTION_A_ID,
          text: 'Was beschreibt die Steigung?',
          order: 0,
        },
      ],
      availableQaTasks: [
        {
          kind: 'qa-question',
          questionId: QA_QUESTION_ID,
          text: 'Wie hängt das zusammen?',
        },
      ],
      availableQaTasksTruncated: false,
      objectives: [validSessionObjective()],
    };
    expect(SessionLearningObjectivesSnapshotSchema.parse(snapshot)).toEqual(snapshot);
  });

  it('exposes a bounded, trimmed, solution-free catalog of available quiz tasks', () => {
    const base = {
      kind: 'quiz-question' as const,
      questionId: QUESTION_A_ID,
      text: 'Was beschreibt die Steigung?',
      order: 0,
    };
    expect(
      SessionLearningObjectiveAvailableQuizTaskSchema.parse({
        kind: 'quiz-question',
        questionId: QUESTION_A_ID,
        text: '  Was beschreibt die Steigung?  ',
        order: 0,
      }),
    ).toEqual({
      kind: 'quiz-question',
      questionId: QUESTION_A_ID,
      text: 'Was beschreibt die Steigung?',
      order: 0,
    });

    expect(
      SessionLearningObjectiveAvailableQuizTaskSchema.safeParse({
        kind: 'quiz-question',
        questionId: QUESTION_A_ID,
        text: 'x'.repeat(QUIZ_QUESTION_TEXT_MAX_LENGTH + 1),
        order: 0,
      }).success,
    ).toBe(false);
    expect(
      SessionLearningObjectiveAvailableQuizTaskSchema.safeParse({ ...base, text: '   ' }).success,
    ).toBe(false);
    expect(
      SessionLearningObjectiveAvailableQuizTaskSchema.safeParse({ ...base, order: -1 }).success,
    ).toBe(false);

    for (const forbidden of [
      { isCorrect: true },
      { answers: [{ text: '42', isCorrect: true }] },
      { sourceQuestionId: QUESTION_B_ID },
      { sourceQuizId: QUIZ_ID },
      { sourceDigest: SOURCE_DIGEST },
    ]) {
      expect(
        SessionLearningObjectiveAvailableQuizTaskSchema.safeParse({ ...base, ...forbidden })
          .success,
      ).toBe(false);
    }
  });

  it('supports explicit Q&A and quiz task references without an inferred section', () => {
    const objective = {
      ...validSessionObjective(),
      scope: {
        kind: 'question-set',
        taskReferences: [
          { kind: 'quiz-question', questionId: QUESTION_A_ID },
          { kind: 'qa-question', questionId: QA_QUESTION_ID },
        ],
      },
    };
    expect(SessionLearningObjectiveDTOSchema.safeParse(objective).success).toBe(true);
  });

  it('exposes a bounded, trimmed, solution-free Q&A task catalog', () => {
    expect(
      SessionLearningObjectiveAvailableQaTaskSchema.parse({
        kind: 'qa-question',
        questionId: QA_QUESTION_ID,
        text: '  Wie hängt das zusammen?  ',
      }),
    ).toEqual({
      kind: 'qa-question',
      questionId: QA_QUESTION_ID,
      text: 'Wie hängt das zusammen?',
    });
    expect(
      SessionLearningObjectiveAvailableQaTaskSchema.safeParse({
        kind: 'qa-question',
        questionId: QA_QUESTION_ID,
        text: 'Frage?',
        participantId: SESSION_ID,
      }).success,
    ).toBe(false);
  });

  it('keeps a removed last task reference traceable without widening its scope', () => {
    const unresolved = {
      ...validSessionObjective(),
      revision: 3,
      scope: {
        kind: 'question-set',
        taskReferences: [
          {
            kind: 'unresolved-task',
            sourceReferenceId: '99999999-9999-4999-8999-999999999999',
            sourceKind: 'quiz-question',
            reason: 'source-removed',
          },
        ],
      },
      confirmation: {
        state: 'needs-review',
        previousConfirmation: {
          state: 'confirmed',
          revision: 2,
          confirmedAt: CREATED_AT,
        },
        currentRevision: 3,
        reason: 'source-reference-removed',
      },
    };
    expect(SessionLearningObjectiveDTOSchema.safeParse(unresolved).success).toBe(true);
    expect(
      SessionLearningObjectiveDTOSchema.safeParse({
        ...unresolved,
        confirmation: {
          state: 'confirmed',
          confirmedAt: UPDATED_AT,
          confirmedRevision: 3,
        },
      }).success,
    ).toBe(false);

    expect(
      SessionLearningObjectiveDTOSchema.safeParse({
        ...unresolved,
        scope: {
          kind: 'question-set',
          taskReferences: [
            {
              kind: 'unresolved-task',
              sourceReferenceId: '99999999-9999-4999-8999-999999999999',
              sourceKind: 'qa-question',
              reason: 'source-removed',
            },
          ],
        },
      }).success,
    ).toBe(true);

    expect(
      SessionLearningObjectiveDTOSchema.safeParse({
        ...unresolved,
        scope: {
          kind: 'question-set',
          taskReferences: [
            {
              kind: 'unresolved-task',
              sourceReferenceId: '99999999-9999-4999-8999-999999999999',
              sourceKind: 'qa-question',
              reason: 'source-not-in-upload',
            },
          ],
        },
      }).success,
    ).toBe(false);
  });

  it('retains live-safe model provenance but rejects digests and solution fields', () => {
    const projected = {
      ...validSessionObjective(),
      projection: 'quiz-projected',
      scope: {
        kind: 'question-set',
        taskReferences: [{ kind: 'quiz-question', questionId: QUESTION_A_ID }],
      },
      origin: {
        kind: 'model-derived',
        modelId: 'qwen3-4b-instruct-2507',
        modelVersion: 'q4_k_m',
        derivationVersion: 'learning-objective-v1',
        derivedFrom: [{ kind: 'quiz-question', questionId: QUESTION_A_ID }],
      },
    };
    expect(SessionLearningObjectiveDTOSchema.safeParse(projected).success).toBe(true);

    for (const [field, value] of [
      ['sourceDigest', SOURCE_DIGEST],
      ['sourceQuestionId', QUESTION_A_ID],
      ['answers', [{ text: '42', isCorrect: true }]],
      ['isCorrect', true],
    ] as const) {
      expect(
        SessionLearningObjectiveDTOSchema.safeParse({ ...projected, [field]: value }).success,
      ).toBe(false);
    }
  });

  it('keeps a host-mutated quiz goal as a session-owned override with its provenance', () => {
    const override = {
      ...validSessionObjective(),
      projection: 'session-override',
      scope: {
        kind: 'question-set',
        taskReferences: [{ kind: 'quiz-question', questionId: QUESTION_A_ID }],
      },
      origin: {
        kind: 'model-derived',
        modelId: 'qwen3-4b-instruct-2507',
        modelVersion: 'q4_k_m',
        derivationVersion: 'learning-objective-v1',
        derivedFrom: [{ kind: 'quiz-question', questionId: QUESTION_A_ID }],
      },
    };
    expect(SessionLearningObjectiveDTOSchema.safeParse(override).success).toBe(true);
  });

  it('keeps an unremappable override derivation explicit and review-required', () => {
    const unresolvedReference = {
      kind: 'unresolved-task' as const,
      sourceReferenceId: '99999999-9999-4999-8999-999999999999',
      sourceKind: 'quiz-question' as const,
      reason: 'source-removed' as const,
    };
    const override = {
      ...validSessionObjective(),
      revision: 3,
      projection: 'session-override',
      scope: {
        kind: 'question-set',
        taskReferences: [unresolvedReference],
      },
      origin: {
        kind: 'model-derived',
        modelId: 'qwen3-4b-instruct-2507',
        modelVersion: 'q4_k_m',
        derivationVersion: 'learning-objective-v1',
        derivedFrom: [unresolvedReference],
      },
      confirmation: {
        state: 'needs-review',
        previousConfirmation: {
          state: 'confirmed',
          revision: 2,
          confirmedAt: CREATED_AT,
        },
        currentRevision: 3,
        reason: 'source-reference-removed',
      },
    };
    expect(SessionLearningObjectiveDTOSchema.safeParse(override).success).toBe(true);
    expect(
      SessionLearningObjectiveDTOSchema.safeParse({
        ...override,
        projection: 'quiz-projected',
      }).success,
    ).toBe(false);
  });

  it('does not allow model provenance to masquerade as a session-manual objective', () => {
    const objective = {
      ...validSessionObjective(),
      origin: {
        kind: 'model-derived',
        modelId: 'model',
        modelVersion: 'version',
        derivationVersion: 'derivation',
        derivedFrom: [{ kind: 'quiz-question', questionId: QUESTION_A_ID }],
      },
    };
    expect(SessionLearningObjectiveDTOSchema.safeParse(objective).success).toBe(false);
  });

  it('does not classify session or Q&A scopes as quiz projections', () => {
    expect(
      SessionLearningObjectiveDTOSchema.safeParse({
        ...validSessionObjective(),
        projection: 'quiz-projected',
      }).success,
    ).toBe(false);

    expect(
      SessionLearningObjectiveDTOSchema.safeParse({
        ...validSessionObjective(),
        projection: 'quiz-projected',
        scope: {
          kind: 'question-set',
          taskReferences: [{ kind: 'qa-question', questionId: QA_QUESTION_ID }],
        },
      }).success,
    ).toBe(false);
  });

  it('does not invent a session scope for a model-derived objective', () => {
    const objective = {
      ...validSessionObjective(),
      projection: 'quiz-projected',
      origin: {
        kind: 'model-derived',
        modelId: 'model',
        modelVersion: 'version',
        derivationVersion: 'derivation',
        derivedFrom: [{ kind: 'quiz-question', questionId: QUESTION_A_ID }],
      },
    };
    expect(SessionLearningObjectiveDTOSchema.safeParse(objective).success).toBe(false);
  });

  it('rejects Q&A task references from model-derived objectives', () => {
    const objective = {
      ...validSessionObjective(),
      projection: 'quiz-projected',
      scope: {
        kind: 'question-set',
        taskReferences: [
          { kind: 'quiz-question', questionId: QUESTION_A_ID },
          { kind: 'qa-question', questionId: QA_QUESTION_ID },
        ],
      },
      origin: {
        kind: 'model-derived',
        modelId: 'model',
        modelVersion: 'version',
        derivationVersion: 'derivation',
        derivedFrom: [{ kind: 'quiz-question', questionId: QUESTION_A_ID }],
      },
    };
    expect(SessionLearningObjectiveDTOSchema.safeParse(objective).success).toBe(false);
  });

  it('distinguishes an unconfigured context from an explicitly configured empty one', () => {
    const base = {
      schemaVersion: 1,
      sessionId: SESSION_ID,
      learningContextRevision: 0,
      access: { state: 'writable' },
      availableQuizTasks: [],
      availableQaTasks: [],
      availableQaTasksTruncated: false,
      objectives: [] as ReturnType<typeof validSessionObjective>[],
    };
    expect(
      SessionLearningObjectivesSnapshotSchema.safeParse({ ...base, configured: false }).success,
    ).toBe(true);
    expect(
      SessionLearningObjectivesSnapshotSchema.safeParse({ ...base, configured: true }).success,
    ).toBe(true);
    expect(
      SessionLearningObjectivesSnapshotSchema.safeParse({
        ...base,
        configured: false,
        objectives: [validSessionObjective()],
      }).success,
    ).toBe(false);
  });

  it('bounds and de-duplicates the available quiz-task catalog', () => {
    const base = {
      schemaVersion: 1,
      sessionId: SESSION_ID,
      learningContextRevision: 0,
      configured: false,
      access: { state: 'writable' as const },
      availableQaTasks: [],
      availableQaTasksTruncated: false,
      objectives: [],
    };
    const availableQuizTasks = Array.from({ length: QUIZ_UPLOAD_MAX_QUESTIONS }, (_, order) => ({
      kind: 'quiz-question' as const,
      questionId: `00000000-0000-4000-8002-${String(order).padStart(12, '0')}`,
      text: `Aufgabe ${order + 1}`,
      order,
    }));
    expect(
      SessionLearningObjectivesSnapshotSchema.safeParse({ ...base, availableQuizTasks }).success,
    ).toBe(true);
    expect(
      SessionLearningObjectivesSnapshotSchema.safeParse({
        ...base,
        availableQuizTasks: [availableQuizTasks[0], availableQuizTasks[0]],
      }).success,
    ).toBe(false);
    expect(
      SessionLearningObjectivesSnapshotSchema.safeParse({
        ...base,
        availableQuizTasks: [
          ...availableQuizTasks,
          {
            kind: 'quiz-question',
            questionId: '00000000-0000-4000-8002-000000000200',
            text: 'Eine Aufgabe zu viel',
            order: QUIZ_UPLOAD_MAX_QUESTIONS,
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('bounds and de-duplicates the available Q&A task catalog', () => {
    const base = {
      schemaVersion: 1,
      sessionId: SESSION_ID,
      learningContextRevision: 0,
      configured: false,
      access: { state: 'writable' as const },
      availableQuizTasks: [],
      availableQaTasksTruncated: false,
      objectives: [],
    };
    const availableQaTasks = Array.from(
      { length: SESSION_LEARNING_OBJECTIVE_QA_TASK_CATALOG_MAX },
      (_, index) => ({
        kind: 'qa-question' as const,
        questionId: `00000000-0000-4000-8003-${String(index).padStart(12, '0')}`,
        text: `Q&A-Aufgabe ${index + 1}`,
      }),
    );
    expect(
      SessionLearningObjectivesSnapshotSchema.safeParse({ ...base, availableQaTasks }).success,
    ).toBe(true);
    expect(
      SessionLearningObjectivesSnapshotSchema.safeParse({
        ...base,
        availableQaTasks: [availableQaTasks[0], availableQaTasks[0]],
      }).success,
    ).toBe(false);
    expect(
      SessionLearningObjectivesSnapshotSchema.safeParse({
        ...base,
        availableQaTasks: [
          ...availableQaTasks,
          {
            kind: 'qa-question',
            questionId: '00000000-0000-4000-8003-000000000500',
            text: 'Eine Q&A-Aufgabe zu viel',
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('requires global and per-row revisions and a client UUID for atomic writes', () => {
    const create = {
      code: 'ABC123',
      expectedLearningContextRevision: 4,
      mutations: [
        {
          action: 'upsert',
          objectiveId: OBJECTIVE_A_ID,
          expectedRevision: null,
          text: 'Manuelles Ziel',
          scope: { kind: 'session' },
          confirmationState: 'draft',
        },
      ],
    };
    expect(SaveSessionLearningObjectivesInputSchema.safeParse(create).success).toBe(true);

    const update = structuredClone(create);
    update.mutations[0]!.expectedRevision = 2;
    update.mutations[0]!.confirmationState = 'confirmed';
    expect(SaveSessionLearningObjectivesInputSchema.safeParse(update).success).toBe(true);

    const deleteInput = {
      code: 'ABC123',
      expectedLearningContextRevision: 5,
      mutations: [{ action: 'delete', objectiveId: OBJECTIVE_A_ID, expectedRevision: 3 }],
    };
    expect(SaveSessionLearningObjectivesInputSchema.safeParse(deleteInput).success).toBe(true);

    expect(
      SaveSessionLearningObjectivesInputSchema.safeParse({
        ...create,
        expectedLearningContextRevision: -1,
      }).success,
    ).toBe(false);
    expect(
      SaveSessionLearningObjectivesInputSchema.safeParse({
        ...create,
        mutations: [create.mutations[0], create.mutations[0]],
      }).success,
    ).toBe(false);
  });

  it('does not let a host write origin, digest, or solution data', () => {
    const input = {
      code: 'ABC123',
      expectedLearningContextRevision: 0,
      mutations: [
        {
          action: 'upsert',
          objectiveId: OBJECTIVE_A_ID,
          expectedRevision: null,
          text: 'Manuelles Ziel',
          scope: { kind: 'session' },
          confirmationState: 'draft',
          origin: { kind: 'model-derived' },
          sourceDigest: SOURCE_DIGEST,
          answers: [{ text: '42', isCorrect: true }],
        },
      ],
    };
    expect(SaveSessionLearningObjectivesInputSchema.safeParse(input).success).toBe(false);
  });

  it('does not let the client manufacture unresolved task references', () => {
    expect(
      SaveSessionLearningObjectivesInputSchema.safeParse({
        code: 'ABC123',
        expectedLearningContextRevision: 3,
        mutations: [
          {
            action: 'upsert',
            objectiveId: OBJECTIVE_A_ID,
            expectedRevision: 2,
            text: 'Manuelles Ziel',
            scope: {
              kind: 'question-set',
              taskReferences: [
                {
                  kind: 'unresolved-task',
                  sourceReferenceId: '99999999-9999-4999-8999-999999999999',
                  sourceKind: 'quiz-question',
                  reason: 'source-removed',
                },
              ],
            },
            confirmationState: 'confirmed',
          },
        ],
      }).success,
    ).toBe(false);
  });
});
