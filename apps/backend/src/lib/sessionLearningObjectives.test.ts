import type { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    quiz: { findUnique: vi.fn() },
    question: { findMany: vi.fn() },
    qaQuestion: { findMany: vi.fn() },
    quizLearningObjectiveBundle: { findUnique: vi.fn() },
    sessionLearningObjective: {
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    sessionLearningObjectiveReference: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));

vi.mock('../db', () => ({ prisma: prismaMock }));

import {
  buildQuizLearningObjectiveBundleCreate,
  getSessionLearningObjectives,
  getSessionLearningObjectivesSnapshotWithDb,
  replaceSessionQuizLearningObjectives,
  saveSessionLearningObjectives,
} from './sessionLearningObjectives';

const SESSION_ID = '10000000-0000-4000-8000-000000000001';
const QUIZ_A_ID = '10000000-0000-4000-8000-000000000002';
const QUIZ_B_ID = '10000000-0000-4000-8000-000000000003';
const SOURCE_QUIZ_ID = '10000000-0000-4000-8000-000000000008';
const OTHER_SOURCE_QUIZ_ID = '10000000-0000-4000-8000-000000000009';
const OLD_QUESTION_ID = '10000000-0000-4000-8000-000000000004';
const NEW_QUESTION_ID = '10000000-0000-4000-8000-000000000005';
const SOURCE_QUESTION_ID = '10000000-0000-4000-8000-000000000006';
const OBJECTIVE_ID = '10000000-0000-4000-8000-000000000007';
const QA_QUESTION_ID = '10000000-0000-4000-8000-000000000010';
const OBJECTIVE_ROW_ID = 'objective-row-1';
const NOW = new Date('2026-10-04T10:00:00.000Z');

function sessionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    status: 'LOBBY',
    endedAt: null,
    expiresAt: new Date('2026-10-05T10:00:00.000Z'),
    quizId: QUIZ_A_ID,
    learningContextRevision: 4,
    learningContextConfigured: true,
    ...overrides,
  };
}

function objectiveRow(overrides: Record<string, unknown> = {}) {
  return {
    id: OBJECTIVE_ROW_ID,
    sessionId: SESSION_ID,
    objectiveId: OBJECTIVE_ID,
    revision: 2,
    text: 'Steigungen interpretieren',
    scope: 'TASKS',
    origin: 'MODEL_DERIVED',
    modelId: 'model-a',
    modelVersion: '1',
    derivationVersion: '1',
    confirmationState: 'DRAFT',
    confirmationRevision: null,
    confirmationAt: null,
    previousConfirmationState: null,
    needsReviewReason: null,
    projection: 'QUIZ_PROJECTED',
    sourceQuizId: SOURCE_QUIZ_ID,
    suppressedAt: null,
    createdAt: new Date('2026-10-04T08:00:00.000Z'),
    updatedAt: new Date('2026-10-04T09:00:00.000Z'),
    references: [
      {
        id: 'task-ref',
        sourceReferenceId: OLD_QUESTION_ID,
        objectiveRowId: OBJECTIVE_ROW_ID,
        kind: 'TASK',
        sourceKind: 'QUIZ_QUESTION',
        quizQuestionId: OLD_QUESTION_ID,
        qaQuestionId: null,
        unresolvedReason: null,
      },
      {
        id: 'derivation-ref',
        sourceReferenceId: OLD_QUESTION_ID,
        objectiveRowId: OBJECTIVE_ROW_ID,
        kind: 'DERIVATION',
        sourceKind: 'QUIZ_QUESTION',
        quizQuestionId: OLD_QUESTION_ID,
        qaQuestionId: null,
        unresolvedReason: null,
      },
    ],
    ...overrides,
  };
}

function txMock() {
  return {
    $executeRaw: vi.fn(),
    session: { findUnique: vi.fn(), update: vi.fn() },
    quiz: { findUnique: vi.fn().mockResolvedValue({ sourceQuizId: SOURCE_QUIZ_ID }) },
    question: { findMany: vi.fn() },
    quizLearningObjectiveBundle: { findUnique: vi.fn() },
    sessionLearningObjective: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    sessionLearningObjectiveReference: {
      createMany: vi.fn(),
      update: vi.fn(),
    },
  };
}

describe('session learning-objective service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      fn(prismaMock),
    );
    prismaMock.$executeRaw.mockResolvedValue(1);
    prismaMock.qaQuestion.findMany.mockResolvedValue([]);
    prismaMock.quiz.findUnique.mockResolvedValue({ sourceQuizId: SOURCE_QUIZ_ID });
  });

  it('normalizes future-skewed objective lifecycle timestamps at the upload boundary', () => {
    const create = buildQuizLearningObjectiveBundleCreate(
      {
        schemaVersion: 1,
        quizId: QUIZ_A_ID,
        revision: 3,
        objectives: [
          {
            id: OBJECTIVE_ID,
            revision: 3,
            text: 'Steigungen interpretieren',
            scope: { kind: 'question-set', sourceQuestionIds: [SOURCE_QUESTION_ID] },
            origin: { kind: 'manual' },
            confirmation: {
              state: 'confirmed',
              confirmedRevision: 3,
              confirmedAt: '2099-01-01T00:00:00.000Z',
            },
            createdAt: '2098-01-01T00:00:00.000Z',
            updatedAt: '2099-01-01T00:00:00.000Z',
          },
        ],
      },
      new Map([[SOURCE_QUESTION_ID, OLD_QUESTION_ID]]),
      NOW,
    );

    expect(create.objectives.create[0]).toMatchObject({
      createdAt: NOW,
      updatedAt: NOW,
      confirmationAt: NOW,
      confirmationRevision: 3,
    });
  });

  it('returns a bounded solution-free quiz task catalog from persisted question ids', async () => {
    prismaMock.session.findUnique.mockResolvedValue(sessionRow());
    prismaMock.sessionLearningObjective.findMany.mockResolvedValue([]);
    prismaMock.question.findMany.mockResolvedValue([
      { id: NEW_QUESTION_ID, text: 'Was ist die Änderungsrate?', order: 3 },
    ]);

    const snapshot = await getSessionLearningObjectives('abc123', NOW);

    expect(snapshot.availableQuizTasks).toEqual([
      {
        kind: 'quiz-question',
        questionId: NEW_QUESTION_ID,
        text: 'Was ist die Änderungsrate?',
        order: 3,
      },
    ]);
    expect(prismaMock.question.findMany).toHaveBeenCalledWith({
      where: { quizId: QUIZ_A_ID },
      select: { id: true, text: true, order: true },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });
  });

  it('keeps finished-session reads immutable only during the host post-processing window', async () => {
    prismaMock.session.findUnique.mockResolvedValue(
      sessionRow({
        status: 'FINISHED',
        endedAt: new Date('2026-10-01T10:00:00.000Z'),
        expiresAt: new Date('2026-10-01T10:00:00.000Z'),
        quizId: null,
      }),
    );
    prismaMock.sessionLearningObjective.findMany.mockResolvedValue([]);

    await expect(getSessionLearningObjectives('ABC123', NOW)).resolves.toMatchObject({
      access: { state: 'read-only', reason: 'session-finished' },
    });
    await expect(
      getSessionLearningObjectives('ABC123', new Date('2026-11-01T10:00:00.000Z')),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects global CAS conflicts and all writes after session finish', async () => {
    prismaMock.session.findUnique
      .mockResolvedValueOnce({ id: SESSION_ID })
      .mockResolvedValueOnce(sessionRow({ learningContextRevision: 5 }));

    await expect(
      saveSessionLearningObjectives({
        code: 'ABC123',
        expectedLearningContextRevision: 4,
        mutations: [
          {
            action: 'delete',
            objectiveId: OBJECTIVE_ID,
            expectedRevision: 2,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prismaMock.sessionLearningObjective.findMany).not.toHaveBeenCalled();

    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      fn(prismaMock),
    );
    prismaMock.session.findUnique.mockResolvedValueOnce({ id: SESSION_ID }).mockResolvedValueOnce(
      sessionRow({
        status: 'FINISHED',
        endedAt: new Date('2026-10-04T09:00:00.000Z'),
      }),
    );
    await expect(
      saveSessionLearningObjectives({
        code: 'ABC123',
        expectedLearningContextRevision: 4,
        mutations: [
          {
            action: 'delete',
            objectiveId: OBJECTIVE_ID,
            expectedRevision: 2,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('promotes a confirmation-only quiz projection to a provenance-preserving override', async () => {
    const existing = objectiveRow();
    const updated = objectiveRow({
      revision: 3,
      confirmationState: 'CONFIRMED',
      confirmationRevision: 3,
      confirmationAt: NOW,
      projection: 'SESSION_OVERRIDE',
      updatedAt: NOW,
    });
    prismaMock.session.findUnique
      .mockResolvedValueOnce({ id: SESSION_ID })
      .mockResolvedValueOnce(sessionRow());
    prismaMock.sessionLearningObjective.findMany
      .mockResolvedValueOnce([existing])
      .mockResolvedValueOnce([updated]);
    prismaMock.question.findMany
      .mockResolvedValueOnce([{ id: OLD_QUESTION_ID, quizId: QUIZ_A_ID }])
      .mockResolvedValueOnce([{ id: OLD_QUESTION_ID, text: 'Aufgabe', order: 0 }]);
    prismaMock.session.update.mockResolvedValue(sessionRow({ learningContextRevision: 5 }));

    const snapshot = await saveSessionLearningObjectives(
      {
        code: 'ABC123',
        expectedLearningContextRevision: 4,
        mutations: [
          {
            action: 'upsert',
            objectiveId: OBJECTIVE_ID,
            expectedRevision: 2,
            text: 'Steigungen interpretieren',
            scope: {
              kind: 'question-set',
              taskReferences: [{ kind: 'quiz-question', questionId: OLD_QUESTION_ID }],
            },
            confirmationState: 'confirmed',
          },
        ],
      },
      NOW,
    );

    expect(prismaMock.sessionLearningObjective.update).toHaveBeenCalledWith({
      where: { id: OBJECTIVE_ROW_ID },
      data: expect.objectContaining({
        revision: 3,
        projection: 'SESSION_OVERRIDE',
        confirmationState: 'CONFIRMED',
        confirmationRevision: 3,
      }),
    });
    const updateData = prismaMock.sessionLearningObjective.update.mock.calls[0]![0].data;
    expect(updateData).not.toHaveProperty('origin');
    expect(updateData).not.toHaveProperty('modelId');
    expect(prismaMock.sessionLearningObjectiveReference.deleteMany).toHaveBeenCalledWith({
      where: { objectiveRowId: OBJECTIVE_ROW_ID, kind: 'TASK' },
    });
    expect(snapshot.objectives[0]).toMatchObject({
      projection: 'session-override',
      origin: { kind: 'model-derived', modelId: 'model-a' },
      confirmation: { state: 'confirmed', confirmedRevision: 3 },
    });
  });

  it('rejects a stale per-objective revision even when the global CAS still matches', async () => {
    prismaMock.session.findUnique
      .mockResolvedValueOnce({ id: SESSION_ID })
      .mockResolvedValueOnce(sessionRow());
    prismaMock.sessionLearningObjective.findMany.mockResolvedValue([objectiveRow()]);

    await expect(
      saveSessionLearningObjectives({
        code: 'ABC123',
        expectedLearningContextRevision: 4,
        mutations: [
          {
            action: 'delete',
            objectiveId: OBJECTIVE_ID,
            expectedRevision: 1,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prismaMock.sessionLearningObjective.delete).not.toHaveBeenCalled();
    expect(prismaMock.session.update).not.toHaveBeenCalled();
  });

  it.each(['QUIZ_PROJECTED', 'SESSION_OVERRIDE'] as const)(
    'persists an internal same-source tombstone when deleting a %s objective',
    async (projection) => {
      const existing = objectiveRow({ projection });
      prismaMock.session.findUnique
        .mockResolvedValueOnce({ id: SESSION_ID })
        .mockResolvedValueOnce(sessionRow());
      prismaMock.sessionLearningObjective.findMany
        .mockResolvedValueOnce([existing])
        .mockResolvedValueOnce([]);
      prismaMock.question.findMany.mockResolvedValue([]);
      prismaMock.session.update.mockResolvedValue(sessionRow({ learningContextRevision: 5 }));

      await saveSessionLearningObjectives(
        {
          code: 'ABC123',
          expectedLearningContextRevision: 4,
          mutations: [
            {
              action: 'delete',
              objectiveId: OBJECTIVE_ID,
              expectedRevision: 2,
            },
          ],
        },
        NOW,
      );

      expect(prismaMock.sessionLearningObjectiveReference.deleteMany).toHaveBeenCalledWith({
        where: { objectiveRowId: OBJECTIVE_ROW_ID },
      });
      expect(prismaMock.sessionLearningObjective.update).toHaveBeenCalledWith({
        where: { id: OBJECTIVE_ROW_ID },
        data: {
          projection: 'SESSION_OVERRIDE',
          suppressedAt: NOW,
          updatedAt: NOW,
        },
      });
      expect(prismaMock.sessionLearningObjective.delete).not.toHaveBeenCalled();
    },
  );

  it('keeps a projected deletion suppressed across a same-source reattach', async () => {
    const tx = txMock();
    tx.sessionLearningObjective.findMany.mockResolvedValue([
      objectiveRow({
        projection: 'SESSION_OVERRIDE',
        suppressedAt: NOW,
        references: [],
      }),
    ]);
    tx.question.findMany.mockResolvedValue([]);
    tx.quizLearningObjectiveBundle.findUnique.mockResolvedValue({
      quizId: QUIZ_B_ID,
      sourceQuizId: SOURCE_QUIZ_ID,
      schemaVersion: 1,
      revision: 0,
      createdAt: NOW,
      updatedAt: NOW,
      objectives: [
        {
          ...objectiveRow(),
          id: 'quiz-row-suppressed',
          bundleQuizId: QUIZ_B_ID,
          sourceDigest: null,
          references: [],
        },
      ],
    });

    await replaceSessionQuizLearningObjectives({
      tx: tx as unknown as Prisma.TransactionClient,
      sessionId: SESSION_ID,
      previousQuizId: QUIZ_A_ID,
      quizId: QUIZ_B_ID,
      currentRevision: 4,
      currentConfigured: true,
    });

    expect(tx.sessionLearningObjective.createMany).not.toHaveBeenCalled();
    expect(tx.sessionLearningObjective.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.sessionLearningObjective.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: SESSION_ID, projection: 'QUIZ_PROJECTED' },
    });
  });

  it('retires a tombstone before cloning an unrelated source with the same objective id', async () => {
    const tx = txMock();
    tx.quiz.findUnique.mockResolvedValue({ sourceQuizId: OTHER_SOURCE_QUIZ_ID });
    tx.sessionLearningObjective.findMany.mockResolvedValue([
      objectiveRow({ projection: 'SESSION_OVERRIDE', suppressedAt: NOW, references: [] }),
    ]);
    tx.question.findMany.mockResolvedValue([]);
    tx.quizLearningObjectiveBundle.findUnique.mockResolvedValue({
      quizId: QUIZ_B_ID,
      sourceQuizId: OTHER_SOURCE_QUIZ_ID,
      schemaVersion: 1,
      revision: 0,
      createdAt: NOW,
      updatedAt: NOW,
      objectives: [
        {
          ...objectiveRow({ sourceQuizId: OTHER_SOURCE_QUIZ_ID }),
          id: 'quiz-row-unrelated',
          bundleQuizId: QUIZ_B_ID,
          sourceDigest: null,
          references: [],
        },
      ],
    });

    await replaceSessionQuizLearningObjectives({
      tx: tx as unknown as Prisma.TransactionClient,
      sessionId: SESSION_ID,
      previousQuizId: QUIZ_A_ID,
      quizId: QUIZ_B_ID,
      currentRevision: 4,
      currentConfigured: true,
    });

    expect(tx.sessionLearningObjective.deleteMany).toHaveBeenNthCalledWith(1, {
      where: { id: { in: [OBJECTIVE_ROW_ID] } },
    });
    expect(tx.sessionLearningObjective.createMany).toHaveBeenCalledOnce();
  });

  it('keeps an edited derived override and clones only non-colliding bundle rows on attach', async () => {
    const tx = txMock();
    const owned = objectiveRow({
      projection: 'SESSION_OVERRIDE',
      references: objectiveRow().references.map((reference) => ({
        ...reference,
        quizQuestion: { sourceQuestionId: SOURCE_QUESTION_ID },
      })),
    });
    tx.sessionLearningObjective.findMany.mockResolvedValue([owned]);
    tx.question.findMany.mockResolvedValue([
      { id: NEW_QUESTION_ID, sourceQuestionId: SOURCE_QUESTION_ID },
    ]);
    tx.quizLearningObjectiveBundle.findUnique.mockResolvedValue({
      quizId: QUIZ_B_ID,
      sourceQuizId: SOURCE_QUIZ_ID,
      schemaVersion: 1,
      revision: 0,
      createdAt: NOW,
      updatedAt: NOW,
      objectives: [
        {
          ...objectiveRow(),
          id: 'quiz-row-collision',
          bundleQuizId: QUIZ_B_ID,
          sourceDigest: null,
          references: [{ id: 'collision-ref', kind: 'TASK', questionId: NEW_QUESTION_ID }],
        },
        {
          ...objectiveRow({ objectiveId: '10000000-0000-4000-8000-000000000099' }),
          id: 'quiz-row-new',
          bundleQuizId: QUIZ_B_ID,
          sourceDigest: null,
          references: [{ id: 'new-ref', kind: 'TASK', questionId: NEW_QUESTION_ID }],
        },
      ],
    });

    const result = await replaceSessionQuizLearningObjectives({
      tx: tx as unknown as Prisma.TransactionClient,
      sessionId: SESSION_ID,
      previousQuizId: QUIZ_A_ID,
      quizId: QUIZ_B_ID,
      currentRevision: 5,
      currentConfigured: true,
    });

    expect(result).toEqual({ configured: true, revision: 6 });
    expect(tx.sessionLearningObjectiveReference.update).toHaveBeenCalledTimes(2);
    for (const call of tx.sessionLearningObjectiveReference.update.mock.calls) {
      expect(call[0].data).toEqual({
        sourceReferenceId: NEW_QUESTION_ID,
        quizQuestionId: NEW_QUESTION_ID,
        unresolvedReason: null,
      });
    }
    expect(tx.sessionLearningObjective.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: SESSION_ID, projection: 'QUIZ_PROJECTED' },
    });
    const clonedObjectives = tx.sessionLearningObjective.createMany.mock.calls[0]![0].data;
    expect(clonedObjectives).toHaveLength(1);
    expect(clonedObjectives[0].objectiveId).toBe('10000000-0000-4000-8000-000000000099');
    const clonedReferences = tx.sessionLearningObjectiveReference.createMany.mock.calls[0]![0].data;
    expect(clonedReferences).toHaveLength(1);
    expect(clonedReferences[0].objectiveRowId).toBe(clonedObjectives[0].id);
  });

  it('batches a large valid reference remap instead of issuing one statement per reference', async () => {
    const tx = txMock();
    const references = Array.from({ length: 21 }, (_, index) => {
      const suffix = String(index).padStart(12, '0');
      const oldId = `30000000-0000-4000-8000-${suffix}`;
      const sourceId = `40000000-0000-4000-8000-${suffix}`;
      return {
        id: `task-ref-${index}`,
        sourceReferenceId: oldId,
        objectiveRowId: OBJECTIVE_ROW_ID,
        kind: 'TASK',
        sourceKind: 'QUIZ_QUESTION',
        quizQuestionId: oldId,
        qaQuestionId: null,
        unresolvedReason: null,
        quizQuestion: {
          id: oldId,
          sourceQuestionId: sourceId,
          text: `Frage ${index}`,
          type: 'SINGLE_CHOICE',
          answers: [{ text: 'Ja', isCorrect: true }],
        },
      };
    });
    tx.sessionLearningObjective.findMany.mockResolvedValue([
      objectiveRow({
        origin: 'MANUAL',
        modelId: null,
        modelVersion: null,
        derivationVersion: null,
        projection: 'SESSION_MANUAL',
        references,
      }),
    ]);
    tx.question.findMany.mockResolvedValue(
      references.map((reference, index) => ({
        id: `50000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        sourceQuestionId: reference.quizQuestion.sourceQuestionId,
        text: reference.quizQuestion.text,
        type: reference.quizQuestion.type,
        answers: reference.quizQuestion.answers,
      })),
    );
    tx.quizLearningObjectiveBundle.findUnique.mockResolvedValue(null);

    await replaceSessionQuizLearningObjectives({
      tx: tx as unknown as Prisma.TransactionClient,
      sessionId: SESSION_ID,
      previousQuizId: QUIZ_A_ID,
      quizId: QUIZ_B_ID,
      currentRevision: 5,
      currentConfigured: true,
    });

    expect(tx.$executeRaw).toHaveBeenCalledOnce();
    expect(tx.sessionLearningObjectiveReference.update).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: 'question text',
      oldQuestion: {
        id: OLD_QUESTION_ID,
        sourceQuestionId: SOURCE_QUESTION_ID,
        text: 'Alte Frage',
        answers: [{ text: 'Antwort', isCorrect: true }],
      },
      newQuestion: {
        id: NEW_QUESTION_ID,
        sourceQuestionId: SOURCE_QUESTION_ID,
        text: 'Neue Frage',
        answers: [{ text: 'Antwort', isCorrect: true }],
      },
    },
    {
      label: 'answer correctness only',
      oldQuestion: {
        id: OLD_QUESTION_ID,
        sourceQuestionId: SOURCE_QUESTION_ID,
        text: 'Gleiche Frage',
        answers: [{ text: 'Antwort', isCorrect: true }],
      },
      newQuestion: {
        id: NEW_QUESTION_ID,
        sourceQuestionId: SOURCE_QUESTION_ID,
        text: 'Gleiche Frage',
        answers: [{ text: 'Antwort', isCorrect: false }],
      },
    },
  ])('marks a preserved override stale when $label changes on re-upload', async (fixture) => {
    const tx = txMock();
    tx.sessionLearningObjective.findMany.mockResolvedValue([
      objectiveRow({
        projection: 'SESSION_OVERRIDE',
        confirmationState: 'CONFIRMED',
        confirmationRevision: 2,
        confirmationAt: new Date('2026-10-04T09:00:00.000Z'),
        references: objectiveRow().references.map((reference) => ({
          ...reference,
          quizQuestion: fixture.oldQuestion,
        })),
      }),
    ]);
    tx.question.findMany.mockResolvedValue([fixture.newQuestion]);
    tx.quizLearningObjectiveBundle.findUnique.mockResolvedValue(null);

    await replaceSessionQuizLearningObjectives({
      tx: tx as unknown as Prisma.TransactionClient,
      sessionId: SESSION_ID,
      previousQuizId: QUIZ_A_ID,
      quizId: QUIZ_B_ID,
      currentRevision: 5,
      currentConfigured: true,
    });

    expect(tx.sessionLearningObjective.update).toHaveBeenCalledTimes(1);
    expect(tx.sessionLearningObjective.update).toHaveBeenCalledWith({
      where: { id: OBJECTIVE_ROW_ID },
      data: expect.objectContaining({
        revision: 3,
        confirmationState: 'NEEDS_REVIEW',
        confirmationRevision: 2,
        previousConfirmationState: 'CONFIRMED',
        needsReviewReason: 'SOURCE_CONTENT_CHANGED',
      }),
    });
  });

  it('does not stale an override for timer, difficulty, confidence, or question-order changes', async () => {
    const tx = txMock();
    const semanticQuestion = {
      sourceQuestionId: SOURCE_QUESTION_ID,
      text: 'Gleiche Frage',
      type: 'SINGLE_CHOICE',
      answers: [{ text: 'Antwort', isCorrect: true }],
    };
    tx.sessionLearningObjective.findMany.mockResolvedValue([
      objectiveRow({
        projection: 'SESSION_OVERRIDE',
        references: objectiveRow().references.map((reference) => ({
          ...reference,
          quizQuestion: {
            id: OLD_QUESTION_ID,
            ...semanticQuestion,
            timer: 20,
            difficulty: 'EASY',
            confidenceEnabled: false,
            order: 0,
          },
        })),
      }),
    ]);
    tx.question.findMany.mockResolvedValue([
      {
        id: NEW_QUESTION_ID,
        ...semanticQuestion,
        timer: 90,
        difficulty: 'HARD',
        confidenceEnabled: true,
        order: 7,
      },
    ]);
    tx.quizLearningObjectiveBundle.findUnique.mockResolvedValue(null);

    await replaceSessionQuizLearningObjectives({
      tx: tx as unknown as Prisma.TransactionClient,
      sessionId: SESSION_ID,
      previousQuizId: QUIZ_A_ID,
      quizId: QUIZ_B_ID,
      currentRevision: 5,
      currentConfigured: true,
    });

    expect(tx.sessionLearningObjective.update).not.toHaveBeenCalled();
  });

  it('keeps source-reference removal precedence when another retained source changes', async () => {
    const tx = txMock();
    const secondOldQuestionId = '10000000-0000-4000-8000-000000000011';
    const secondNewQuestionId = '10000000-0000-4000-8000-000000000012';
    const secondSourceQuestionId = '10000000-0000-4000-8000-000000000013';
    tx.sessionLearningObjective.findMany.mockResolvedValue([
      objectiveRow({
        revision: 3,
        projection: 'SESSION_OVERRIDE',
        confirmationState: 'NEEDS_REVIEW',
        confirmationRevision: 2,
        previousConfirmationState: 'CONFIRMED',
        confirmationAt: new Date('2026-10-04T09:00:00.000Z'),
        needsReviewReason: 'SOURCE_REFERENCE_REMOVED',
        references: [
          {
            ...objectiveRow().references[0],
            sourceReferenceId: OLD_QUESTION_ID,
            quizQuestionId: null,
            unresolvedReason: 'SOURCE_NOT_IN_UPLOAD',
            quizQuestion: null,
          },
          {
            ...objectiveRow().references[1],
            quizQuestionId: null,
            unresolvedReason: 'SOURCE_NOT_IN_UPLOAD',
            quizQuestion: null,
          },
          {
            ...objectiveRow().references[0],
            id: 'second-task-ref',
            sourceReferenceId: secondOldQuestionId,
            quizQuestionId: secondOldQuestionId,
            quizQuestion: {
              id: secondOldQuestionId,
              sourceQuestionId: secondSourceQuestionId,
              text: 'Alt',
              type: 'SINGLE_CHOICE',
              answers: [{ text: 'Ja', isCorrect: true }],
            },
          },
          {
            ...objectiveRow().references[1],
            id: 'second-derivation-ref',
            sourceReferenceId: secondOldQuestionId,
            quizQuestionId: secondOldQuestionId,
            quizQuestion: {
              id: secondOldQuestionId,
              sourceQuestionId: secondSourceQuestionId,
              text: 'Alt',
              type: 'SINGLE_CHOICE',
              answers: [{ text: 'Ja', isCorrect: true }],
            },
          },
        ],
      }),
    ]);
    tx.question.findMany.mockResolvedValue([
      {
        id: secondNewQuestionId,
        sourceQuestionId: secondSourceQuestionId,
        text: 'Neu',
        type: 'SINGLE_CHOICE',
        answers: [{ text: 'Ja', isCorrect: true }],
      },
    ]);
    tx.quizLearningObjectiveBundle.findUnique.mockResolvedValue(null);

    await replaceSessionQuizLearningObjectives({
      tx: tx as unknown as Prisma.TransactionClient,
      sessionId: SESSION_ID,
      previousQuizId: QUIZ_A_ID,
      quizId: QUIZ_B_ID,
      currentRevision: 5,
      currentConfigured: true,
    });

    expect(tx.sessionLearningObjective.update).toHaveBeenCalledWith({
      where: { id: OBJECTIVE_ROW_ID },
      data: expect.objectContaining({
        revision: 4,
        confirmationState: 'NEEDS_REVIEW',
        needsReviewReason: 'SOURCE_REFERENCE_REMOVED',
      }),
    });
  });

  it('rejects an attach whose preserved and newly projected live goals exceed the cap', async () => {
    const tx = txMock();
    tx.sessionLearningObjective.findMany.mockResolvedValue(
      Array.from({ length: 51 }, (_, index) =>
        objectiveRow({
          id: `owned-row-${index}`,
          objectiveId: `10000000-0000-4000-8001-${String(index).padStart(12, '0')}`,
          scope: 'SESSION',
          origin: 'MANUAL',
          modelId: null,
          modelVersion: null,
          derivationVersion: null,
          projection: 'SESSION_MANUAL',
          sourceQuizId: null,
          references: [],
        }),
      ),
    );
    tx.question.findMany.mockResolvedValue([]);
    tx.quizLearningObjectiveBundle.findUnique.mockResolvedValue({
      quizId: QUIZ_B_ID,
      sourceQuizId: SOURCE_QUIZ_ID,
      schemaVersion: 1,
      revision: 0,
      createdAt: NOW,
      updatedAt: NOW,
      objectives: Array.from({ length: 50 }, (_, index) => ({
        ...objectiveRow({
          objectiveId: `20000000-0000-4000-8002-${String(index).padStart(12, '0')}`,
        }),
        id: `bundle-row-${index}`,
        bundleQuizId: QUIZ_B_ID,
        sourceDigest: null,
        references: [],
      })),
    });

    await expect(
      replaceSessionQuizLearningObjectives({
        tx: tx as unknown as Prisma.TransactionClient,
        sessionId: SESSION_ID,
        previousQuizId: QUIZ_A_ID,
        quizId: QUIZ_B_ID,
        currentRevision: 4,
        currentConfigured: true,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(tx.sessionLearningObjective.createMany).not.toHaveBeenCalled();
  });

  it('retains explicit configured-empty state when attaching a quiz without a bundle', async () => {
    const tx = txMock();
    tx.sessionLearningObjective.findMany.mockResolvedValue([]);
    tx.question.findMany.mockResolvedValue([]);
    tx.quizLearningObjectiveBundle.findUnique.mockResolvedValue(null);

    await expect(
      replaceSessionQuizLearningObjectives({
        tx: tx as unknown as Prisma.TransactionClient,
        sessionId: SESSION_ID,
        previousQuizId: null,
        quizId: QUIZ_B_ID,
        currentRevision: 0,
        currentConfigured: true,
      }),
    ).resolves.toEqual({ configured: true, revision: 1 });
  });

  it('marks a session-owned quiz-wide goal stale when replacing its quiz', async () => {
    const tx = txMock();
    tx.quiz.findUnique.mockResolvedValue({ sourceQuizId: OTHER_SOURCE_QUIZ_ID });
    tx.sessionLearningObjective.findMany.mockResolvedValue([
      objectiveRow({
        scope: 'QUIZ',
        origin: 'MANUAL',
        modelId: null,
        modelVersion: null,
        derivationVersion: null,
        projection: 'SESSION_MANUAL',
        references: [],
      }),
    ]);
    tx.question.findMany.mockResolvedValue([]);
    tx.quizLearningObjectiveBundle.findUnique.mockResolvedValue(null);

    await replaceSessionQuizLearningObjectives({
      tx: tx as unknown as Prisma.TransactionClient,
      sessionId: SESSION_ID,
      previousQuizId: QUIZ_A_ID,
      quizId: QUIZ_B_ID,
      currentRevision: 4,
      currentConfigured: true,
    });

    expect(tx.sessionLearningObjective.update).toHaveBeenCalledWith({
      where: { id: OBJECTIVE_ROW_ID },
      data: expect.objectContaining({
        revision: 3,
        confirmationState: 'NEEDS_REVIEW',
        needsReviewReason: 'SOURCE_REFERENCE_REMOVED',
      }),
    });
  });

  it('keeps a quiz-wide session override current across a same-source re-upload', async () => {
    const tx = txMock();
    tx.sessionLearningObjective.findMany.mockResolvedValue([
      objectiveRow({
        scope: 'QUIZ',
        projection: 'SESSION_OVERRIDE',
        references: [],
      }),
    ]);
    tx.question.findMany.mockResolvedValue([]);
    tx.quizLearningObjectiveBundle.findUnique.mockResolvedValue(null);

    await replaceSessionQuizLearningObjectives({
      tx: tx as unknown as Prisma.TransactionClient,
      sessionId: SESSION_ID,
      previousQuizId: QUIZ_A_ID,
      quizId: QUIZ_B_ID,
      currentRevision: 4,
      currentConfigured: true,
    });

    expect(tx.sessionLearningObjective.update).not.toHaveBeenCalled();
  });

  it('serializes unresolved task and derivation rows with one stable source identity', async () => {
    const unresolved = objectiveRow({
      revision: 3,
      projection: 'SESSION_OVERRIDE',
      confirmationState: 'NEEDS_REVIEW',
      confirmationRevision: 2,
      previousConfirmationState: 'DRAFT',
      needsReviewReason: 'SOURCE_REFERENCE_REMOVED',
      references: objectiveRow().references.map((reference) => ({
        ...reference,
        sourceReferenceId: OLD_QUESTION_ID,
        quizQuestionId: null,
        unresolvedReason: 'SOURCE_NOT_IN_UPLOAD',
      })),
    });
    const tx = txMock();
    tx.session.findUnique.mockResolvedValue(sessionRow());
    tx.sessionLearningObjective.findMany.mockResolvedValue([unresolved]);
    tx.question.findMany.mockResolvedValue([]);

    const snapshot = await getSessionLearningObjectivesSnapshotWithDb(
      tx as unknown as Prisma.TransactionClient,
      SESSION_ID,
      NOW,
    );

    const objective = snapshot.objectives[0]!;
    expect(objective.scope).toEqual({
      kind: 'question-set',
      taskReferences: [
        {
          kind: 'unresolved-task',
          sourceReferenceId: OLD_QUESTION_ID,
          sourceKind: 'quiz-question',
          reason: 'source-not-in-upload',
        },
      ],
    });
    expect(objective.origin).toMatchObject({
      kind: 'model-derived',
      derivedFrom: [
        {
          kind: 'unresolved-task',
          sourceReferenceId: OLD_QUESTION_ID,
        },
      ],
    });
  });

  it('preserves needs-review when an unresolved derivation is rescaled quiz-wide', async () => {
    const existing = objectiveRow({
      revision: 3,
      projection: 'SESSION_OVERRIDE',
      confirmationState: 'NEEDS_REVIEW',
      confirmationRevision: 2,
      previousConfirmationState: 'DRAFT',
      needsReviewReason: 'SOURCE_REFERENCE_REMOVED',
      references: objectiveRow().references.map((reference) => ({
        ...reference,
        quizQuestionId: null,
        unresolvedReason: 'SOURCE_NOT_IN_UPLOAD',
      })),
    });
    const updated = objectiveRow({
      revision: 4,
      scope: 'QUIZ',
      projection: 'SESSION_OVERRIDE',
      confirmationState: 'NEEDS_REVIEW',
      confirmationRevision: 2,
      previousConfirmationState: 'DRAFT',
      needsReviewReason: 'SOURCE_REFERENCE_REMOVED',
      updatedAt: NOW,
      references: [existing.references[1]],
    });
    prismaMock.session.findUnique
      .mockResolvedValueOnce({ id: SESSION_ID })
      .mockResolvedValueOnce(sessionRow());
    prismaMock.sessionLearningObjective.findMany
      .mockResolvedValueOnce([existing])
      .mockResolvedValueOnce([updated]);
    prismaMock.question.findMany.mockResolvedValue([]);
    prismaMock.session.update.mockResolvedValue(sessionRow({ learningContextRevision: 5 }));

    const snapshot = await saveSessionLearningObjectives(
      {
        code: 'ABC123',
        expectedLearningContextRevision: 4,
        mutations: [
          {
            action: 'upsert',
            objectiveId: OBJECTIVE_ID,
            expectedRevision: 3,
            text: 'Steigungen weiterhin interpretieren',
            scope: { kind: 'quiz-wide' },
            confirmationState: 'draft',
          },
        ],
      },
      NOW,
    );

    expect(prismaMock.sessionLearningObjective.update).toHaveBeenCalledWith({
      where: { id: OBJECTIVE_ROW_ID },
      data: expect.objectContaining({
        revision: 4,
        scope: 'QUIZ',
        confirmationState: 'NEEDS_REVIEW',
        confirmationRevision: 2,
        previousConfirmationState: 'DRAFT',
        needsReviewReason: 'SOURCE_REFERENCE_REMOVED',
      }),
    });
    expect(snapshot.objectives[0]?.confirmation).toMatchObject({
      state: 'needs-review',
      currentRevision: 4,
    });
  });

  it('rejects confirmation while a retained derivation source is unresolved', async () => {
    prismaMock.session.findUnique
      .mockResolvedValueOnce({ id: SESSION_ID })
      .mockResolvedValueOnce(sessionRow());
    prismaMock.sessionLearningObjective.findMany.mockResolvedValue([
      objectiveRow({
        revision: 3,
        projection: 'SESSION_OVERRIDE',
        confirmationState: 'NEEDS_REVIEW',
        confirmationRevision: 2,
        previousConfirmationState: 'DRAFT',
        needsReviewReason: 'SOURCE_REFERENCE_REMOVED',
        references: objectiveRow().references.map((reference) => ({
          ...reference,
          quizQuestionId: null,
          unresolvedReason: 'SOURCE_NOT_IN_UPLOAD',
        })),
      }),
    ]);

    await expect(
      saveSessionLearningObjectives(
        {
          code: 'ABC123',
          expectedLearningContextRevision: 4,
          mutations: [
            {
              action: 'upsert',
              objectiveId: OBJECTIVE_ID,
              expectedRevision: 3,
              text: 'Steigungen weiterhin interpretieren',
              scope: { kind: 'quiz-wide' },
              confirmationState: 'confirmed',
            },
          ],
        },
        NOW,
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(prismaMock.sessionLearningObjective.update).not.toHaveBeenCalled();
  });

  it('rejects Q&A task references on model-derived overrides before persistence', async () => {
    prismaMock.session.findUnique
      .mockResolvedValueOnce({ id: SESSION_ID })
      .mockResolvedValueOnce(sessionRow());
    prismaMock.sessionLearningObjective.findMany.mockResolvedValue([objectiveRow()]);
    prismaMock.question.findMany.mockResolvedValue([{ id: OLD_QUESTION_ID, quizId: QUIZ_A_ID }]);
    prismaMock.qaQuestion.findMany.mockResolvedValue([
      { id: QA_QUESTION_ID, sessionId: SESSION_ID, status: 'ACTIVE' },
    ]);

    await expect(
      saveSessionLearningObjectives(
        {
          code: 'ABC123',
          expectedLearningContextRevision: 4,
          mutations: [
            {
              action: 'upsert',
              objectiveId: OBJECTIVE_ID,
              expectedRevision: 2,
              text: 'Steigungen interpretieren',
              scope: {
                kind: 'question-set',
                taskReferences: [
                  { kind: 'quiz-question', questionId: OLD_QUESTION_ID },
                  { kind: 'qa-question', questionId: QA_QUESTION_ID },
                ],
              },
              confirmationState: 'draft',
            },
          ],
        },
        NOW,
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(prismaMock.sessionLearningObjective.update).not.toHaveBeenCalled();
  });
});
