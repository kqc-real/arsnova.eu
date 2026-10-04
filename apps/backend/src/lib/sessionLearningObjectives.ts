import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import {
  LEARNING_OBJECTIVE_MAX_OBJECTIVES,
  LEARNING_OBJECTIVE_REVISION_MAX,
  SESSION_LEARNING_OBJECTIVE_SCHEMA_VERSION,
  SessionLearningObjectivesSnapshotSchema,
  type LearningObjectiveConfirmation,
  type QuizLearningObjectiveBundleV1,
  type SaveSessionLearningObjectivesInput,
  type SessionLearningObjectiveDTO,
  type SessionLearningObjectiveWriteScope,
  type SessionLearningObjectivesSnapshot,
} from '@arsnova/shared-types';
import { prisma } from '../db';
import { buildSessionRetentionTimeline, isSessionEffectivelyFinished } from './sessionLifecycle';

type LearningObjectiveDb = Prisma.TransactionClient;

const sessionObjectiveInclude = {
  references: {
    orderBy: { id: 'asc' as const },
  },
} as const;

type SessionObjectiveRow = Prisma.SessionLearningObjectiveGetPayload<{
  include: typeof sessionObjectiveInclude;
}>;

const learningSourceQuestionSelect = {
  id: true,
  sourceQuestionId: true,
  text: true,
  type: true,
  ratingMin: true,
  ratingMax: true,
  ratingLabelMin: true,
  ratingLabelMax: true,
  shortTextEvaluationKind: true,
  shortTextMaxLength: true,
  shortTextCaseSensitive: true,
  shortTextEvaluationMode: true,
  shortTextToleranceLevel: true,
  shortTextAllowPartialCredit: true,
  shortTextTrimWhitespace: true,
  shortTextNormalizeWhitespace: true,
  numericInputKind: true,
  numericToleranceMode: true,
  numericAbsoluteTolerance: true,
  numericRelativeTolerancePercent: true,
  numericUnitFamily: true,
  numericRequireUnit: true,
  numericAcceptEquivalentUnits: true,
  numericReferenceValue: true,
  numericTolerancePercent: true,
  numericIntervalLeft: true,
  numericIntervalRight: true,
  numericInputType: true,
  numericDecimalPlaces: true,
  numericMin: true,
  numericMax: true,
  numericTwoRounds: true,
  matchingPairs: true,
  matchingShuffleRight: true,
  orderingItems: true,
  categories: true,
  categorizationItems: true,
  categorizationShuffleItems: true,
  answers: { select: { text: true, isCorrect: true } },
} as const satisfies Prisma.QuestionSelect;

type LearningSourceQuestion = Prisma.QuestionGetPayload<{
  select: typeof learningSourceQuestionSelect;
}>;

type SessionSnapshotRow = {
  id: string;
  status: string;
  endedAt: Date | null;
  expiresAt: Date;
  quizId: string | null;
  learningContextRevision: number;
  learningContextConfigured: boolean;
};

function conflict(message = 'Der Lernzielstand wurde zwischenzeitlich geändert.'): never {
  throw new TRPCError({ code: 'CONFLICT', message });
}

function assertRevisionCanAdvance(revision: number): void {
  if (revision >= LEARNING_OBJECTIVE_REVISION_MAX) {
    conflict('Der Lernzielstand hat seine maximale Revisionsnummer erreicht.');
  }
}

function scopeToDb(scope: { kind: string }): 'SESSION' | 'QUIZ' | 'TASKS' {
  if (scope.kind === 'session') return 'SESSION';
  if (scope.kind === 'quiz-wide') return 'QUIZ';
  return 'TASKS';
}

function confirmationToDb(
  confirmation: LearningObjectiveConfirmation,
  lifecycleAt: Date,
): {
  confirmationState: 'DRAFT' | 'CONFIRMED' | 'NEEDS_REVIEW';
  confirmationRevision: number | null;
  confirmationAt: Date | null;
  previousConfirmationState: 'DRAFT' | 'CONFIRMED' | null;
  needsReviewReason:
    'SOURCE_CONTENT_CHANGED' | 'SOURCE_REFERENCE_REMOVED' | 'DERIVATION_REPLACED' | null;
} {
  if (confirmation.state === 'draft') {
    return {
      confirmationState: 'DRAFT',
      confirmationRevision: null,
      confirmationAt: null,
      previousConfirmationState: null,
      needsReviewReason: null,
    };
  }
  if (confirmation.state === 'confirmed') {
    return {
      confirmationState: 'CONFIRMED',
      confirmationRevision: confirmation.confirmedRevision,
      confirmationAt: lifecycleAt,
      previousConfirmationState: null,
      needsReviewReason: null,
    };
  }
  return {
    confirmationState: 'NEEDS_REVIEW',
    confirmationRevision: confirmation.previousConfirmation.revision,
    confirmationAt: confirmation.previousConfirmation.state === 'confirmed' ? lifecycleAt : null,
    previousConfirmationState:
      confirmation.previousConfirmation.state === 'confirmed' ? 'CONFIRMED' : 'DRAFT',
    needsReviewReason:
      confirmation.reason === 'source-content-changed'
        ? 'SOURCE_CONTENT_CHANGED'
        : confirmation.reason === 'source-reference-removed'
          ? 'SOURCE_REFERENCE_REMOVED'
          : 'DERIVATION_REPLACED',
  };
}

function requestedConfirmationToDb(state: 'draft' | 'confirmed', revision: number, now: Date) {
  return state === 'confirmed'
    ? {
        confirmationState: 'CONFIRMED' as const,
        confirmationRevision: revision,
        confirmationAt: now,
        previousConfirmationState: null,
        needsReviewReason: null,
      }
    : {
        confirmationState: 'DRAFT' as const,
        confirmationRevision: null,
        confirmationAt: null,
        previousConfirmationState: null,
        needsReviewReason: null,
      };
}

function confirmationFromRow(row: SessionObjectiveRow): LearningObjectiveConfirmation {
  if (row.confirmationState === 'DRAFT') return { state: 'draft' };
  if (row.confirmationState === 'CONFIRMED') {
    if (row.confirmationRevision === null || row.confirmationAt === null) {
      throw new Error('Persisted confirmed learning objective is incomplete.');
    }
    return {
      state: 'confirmed',
      confirmedRevision: row.confirmationRevision,
      confirmedAt: row.confirmationAt.toISOString(),
    };
  }
  if (
    row.confirmationRevision === null ||
    row.previousConfirmationState === null ||
    row.needsReviewReason === null
  ) {
    throw new Error('Persisted stale learning objective is incomplete.');
  }
  const previousConfirmation =
    row.previousConfirmationState === 'CONFIRMED'
      ? (() => {
          if (row.confirmationAt === null) {
            throw new Error('Persisted confirmed predecessor is missing its timestamp.');
          }
          return {
            state: 'confirmed' as const,
            revision: row.confirmationRevision,
            confirmedAt: row.confirmationAt.toISOString(),
          };
        })()
      : { state: 'draft' as const, revision: row.confirmationRevision };
  return {
    state: 'needs-review',
    previousConfirmation,
    currentRevision: row.revision,
    reason:
      row.needsReviewReason === 'SOURCE_CONTENT_CHANGED'
        ? 'source-content-changed'
        : row.needsReviewReason === 'SOURCE_REFERENCE_REMOVED'
          ? 'source-reference-removed'
          : 'derivation-replaced',
  };
}

function referenceKey(reference: {
  kind: string;
  questionId?: string;
  sourceReferenceId?: string;
  sourceKind?: string;
}): string {
  return `${reference.kind}:${reference.sourceKind ?? ''}:${reference.questionId ?? reference.sourceReferenceId ?? ''}`;
}

function objectiveFromRow(row: SessionObjectiveRow): SessionLearningObjectiveDTO {
  const taskReferences = row.references
    .filter((reference) => reference.kind === 'TASK')
    .map((reference) => {
      if (reference.quizQuestionId) {
        return { kind: 'quiz-question' as const, questionId: reference.quizQuestionId };
      }
      if (reference.qaQuestionId) {
        return { kind: 'qa-question' as const, questionId: reference.qaQuestionId };
      }
      return {
        kind: 'unresolved-task' as const,
        sourceReferenceId: reference.sourceReferenceId,
        sourceKind:
          reference.sourceKind === 'QUIZ_QUESTION'
            ? ('quiz-question' as const)
            : ('qa-question' as const),
        reason:
          reference.unresolvedReason === 'SOURCE_NOT_IN_UPLOAD'
            ? ('source-not-in-upload' as const)
            : ('source-removed' as const),
      };
    })
    .sort((left, right) => referenceKey(left).localeCompare(referenceKey(right)));
  const derivedFrom = row.references
    .filter((reference) => reference.kind === 'DERIVATION')
    .map((reference) =>
      reference.quizQuestionId
        ? {
            kind: 'quiz-question' as const,
            questionId: reference.quizQuestionId,
          }
        : {
            kind: 'unresolved-task' as const,
            sourceReferenceId: reference.sourceReferenceId,
            sourceKind: 'quiz-question' as const,
            reason:
              reference.unresolvedReason === 'SOURCE_NOT_IN_UPLOAD'
                ? ('source-not-in-upload' as const)
                : ('source-removed' as const),
          },
    )
    .sort((left, right) => referenceKey(left).localeCompare(referenceKey(right)));

  const scope =
    row.scope === 'SESSION'
      ? ({ kind: 'session' } as const)
      : row.scope === 'QUIZ'
        ? ({ kind: 'quiz-wide' } as const)
        : ({ kind: 'question-set', taskReferences } as const);
  const origin =
    row.origin === 'MANUAL'
      ? ({ kind: 'manual' } as const)
      : ({
          kind: 'model-derived' as const,
          modelId: row.modelId ?? '',
          modelVersion: row.modelVersion ?? '',
          derivationVersion: row.derivationVersion ?? '',
          derivedFrom,
        } as const);

  return {
    id: row.objectiveId,
    revision: row.revision,
    text: row.text,
    scope,
    origin,
    confirmation: confirmationFromRow(row),
    projection:
      row.projection === 'QUIZ_PROJECTED'
        ? 'quiz-projected'
        : row.projection === 'SESSION_OVERRIDE'
          ? 'session-override'
          : 'session-manual',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function assertHostReadWindow(session: SessionSnapshotRow, now: Date): boolean {
  const finished = isSessionEffectivelyFinished(session, now);
  if (finished && !buildSessionRetentionTimeline(session, now).hostPostProcessingAccessAllowed) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Die Host-Nachbereitung dieser Session ist beendet.',
    });
  }
  return finished;
}

async function snapshotWithDb(
  db: LearningObjectiveDb,
  session: SessionSnapshotRow,
  now: Date,
): Promise<SessionLearningObjectivesSnapshot> {
  const finished = assertHostReadWindow(session, now);
  const [rows, availableQuizTasks] = await Promise.all([
    db.sessionLearningObjective.findMany({
      where: { sessionId: session.id, suppressedAt: null },
      include: sessionObjectiveInclude,
      orderBy: [{ createdAt: 'asc' }, { objectiveId: 'asc' }],
    }),
    session.quizId
      ? db.question.findMany({
          where: { quizId: session.quizId },
          select: { id: true, text: true, order: true },
          orderBy: [{ order: 'asc' }, { id: 'asc' }],
        })
      : [],
  ]);
  return SessionLearningObjectivesSnapshotSchema.parse({
    schemaVersion: SESSION_LEARNING_OBJECTIVE_SCHEMA_VERSION,
    sessionId: session.id,
    learningContextRevision: session.learningContextRevision,
    configured: session.learningContextConfigured,
    access: finished ? { state: 'read-only', reason: 'session-finished' } : { state: 'writable' },
    availableQuizTasks: availableQuizTasks.map((question) => ({
      kind: 'quiz-question' as const,
      questionId: question.id,
      text: question.text,
      order: question.order,
    })),
    objectives: rows.map(objectiveFromRow),
  });
}

export async function getSessionLearningObjectives(
  code: string,
  now = new Date(),
): Promise<SessionLearningObjectivesSnapshot> {
  const session = await prisma.session.findUnique({
    where: { code: code.toUpperCase() },
    select: {
      id: true,
      status: true,
      endedAt: true,
      expiresAt: true,
      quizId: true,
      learningContextRevision: true,
      learningContextConfigured: true,
    },
  });
  if (!session) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
  }
  return snapshotWithDb(prisma, session, now);
}

function quizReferenceIds(scope: SessionLearningObjectiveWriteScope): string[] {
  return scope.kind === 'question-set'
    ? scope.taskReferences
        .filter((reference) => reference.kind === 'quiz-question')
        .map((reference) => reference.questionId)
    : [];
}

function qaReferenceIds(scope: SessionLearningObjectiveWriteScope): string[] {
  return scope.kind === 'question-set'
    ? scope.taskReferences
        .filter((reference) => reference.kind === 'qa-question')
        .map((reference) => reference.questionId)
    : [];
}

function scopeUsesQuiz(scope: SessionLearningObjectiveWriteScope): boolean {
  return (
    scope.kind === 'quiz-wide' ||
    (scope.kind === 'question-set' &&
      scope.taskReferences.some((reference) => reference.kind === 'quiz-question'))
  );
}

function canonicalWriteScope(scope: SessionLearningObjectiveWriteScope): string {
  if (scope.kind !== 'question-set') return scope.kind;
  return `${scope.kind}:${scope.taskReferences.map(referenceKey).sort().join('|')}`;
}

function persistedScope(row: SessionObjectiveRow): SessionLearningObjectiveWriteScope | null {
  const dto = objectiveFromRow(row);
  if (dto.scope.kind !== 'question-set') return dto.scope;
  if (dto.scope.taskReferences.some((reference) => reference.kind === 'unresolved-task')) {
    return null;
  }
  return {
    kind: 'question-set',
    taskReferences: dto.scope.taskReferences.filter(
      (
        reference,
      ): reference is Extract<
        (typeof dto.scope.taskReferences)[number],
        { kind: 'quiz-question' | 'qa-question' }
      > => reference.kind !== 'unresolved-task',
    ),
  };
}

function taskReferenceCreateRows(
  objectiveRowId: string,
  scope: SessionLearningObjectiveWriteScope,
) {
  if (scope.kind !== 'question-set') return [];
  return scope.taskReferences.map((reference) => ({
    id: randomUUID(),
    sourceReferenceId: reference.questionId,
    objectiveRowId,
    kind: 'TASK' as const,
    sourceKind:
      reference.kind === 'quiz-question' ? ('QUIZ_QUESTION' as const) : ('QA_QUESTION' as const),
    quizQuestionId: reference.kind === 'quiz-question' ? reference.questionId : null,
    qaQuestionId: reference.kind === 'qa-question' ? reference.questionId : null,
    unresolvedReason: null,
  }));
}

async function validateWriteReferences(
  tx: LearningObjectiveDb,
  session: SessionSnapshotRow,
  mutations: SaveSessionLearningObjectivesInput['mutations'],
): Promise<void> {
  const scopes = mutations.flatMap((mutation) =>
    mutation.action === 'upsert' ? [mutation.scope] : [],
  );
  if (scopes.some((scope) => scope.kind === 'quiz-wide') && !session.quizId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Ein quizweites Lernziel benötigt ein angehängtes Quiz.',
    });
  }
  const quizIds = [...new Set(scopes.flatMap(quizReferenceIds))];
  const qaIds = [...new Set(scopes.flatMap(qaReferenceIds))];
  const [quizQuestions, qaQuestions] = await Promise.all([
    quizIds.length
      ? tx.question.findMany({
          where: { id: { in: quizIds } },
          select: { id: true, quizId: true },
        })
      : [],
    qaIds.length
      ? tx.qaQuestion.findMany({
          where: { id: { in: qaIds } },
          select: { id: true, sessionId: true, status: true },
        })
      : [],
  ]);
  const validQuizIds = new Set(
    quizQuestions
      .filter((question) => question.quizId === session.quizId)
      .map((question) => question.id),
  );
  const validQaIds = new Set(
    qaQuestions
      .filter((question) => question.sessionId === session.id && question.status !== 'DELETED')
      .map((question) => question.id),
  );
  if (quizIds.some((id) => !validQuizIds.has(id)) || qaIds.some((id) => !validQaIds.has(id))) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Mindestens eine Aufgabenreferenz gehört nicht zu dieser Session.',
    });
  }
}

export async function saveSessionLearningObjectives(
  input: SaveSessionLearningObjectivesInput,
  now = new Date(),
): Promise<SessionLearningObjectivesSnapshot> {
  const identity = await prisma.session.findUnique({
    where: { code: input.code.toUpperCase() },
    select: { id: true },
  });
  if (!identity) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
  }

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT 1 FROM "Session" WHERE id = ${identity.id} FOR UPDATE`;
    const session = await tx.session.findUnique({
      where: { id: identity.id },
      select: {
        id: true,
        status: true,
        endedAt: true,
        expiresAt: true,
        quizId: true,
        learningContextRevision: true,
        learningContextConfigured: true,
      },
    });
    if (!session) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
    }
    if (isSessionEffectivelyFinished(session, now)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Beendete Sessions können nicht mehr verändert werden.',
      });
    }
    if (session.learningContextRevision !== input.expectedLearningContextRevision) conflict();
    assertRevisionCanAdvance(session.learningContextRevision);

    const rows = await tx.sessionLearningObjective.findMany({
      where: { sessionId: session.id },
      include: sessionObjectiveInclude,
    });
    const rowsByObjectiveId = new Map(rows.map((row) => [row.objectiveId, row]));
    let projectedCount = rows.filter((row) => row.suppressedAt === null).length;
    for (const mutation of input.mutations) {
      const existing = rowsByObjectiveId.get(mutation.objectiveId);
      if (existing?.suppressedAt) conflict();
      if (mutation.action === 'delete') {
        if (!existing || existing.revision !== mutation.expectedRevision) conflict();
        projectedCount -= 1;
      } else if (mutation.expectedRevision === null) {
        if (existing) conflict();
        projectedCount += 1;
      } else if (!existing || existing.revision !== mutation.expectedRevision) {
        conflict();
      }
    }
    if (projectedCount > LEARNING_OBJECTIVE_MAX_OBJECTIVES) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Zu viele Lernziele für diese Session.',
      });
    }
    await validateWriteReferences(tx, session, input.mutations);
    const currentSourceQuizId = session.quizId
      ? ((
          await tx.quiz.findUnique({
            where: { id: session.quizId },
            select: { sourceQuizId: true },
          })
        )?.sourceQuizId ?? null)
      : null;

    for (const mutation of input.mutations) {
      const existing = rowsByObjectiveId.get(mutation.objectiveId);
      if (mutation.action === 'delete') {
        if (existing!.projection !== 'SESSION_MANUAL' && existing!.sourceQuizId) {
          await tx.sessionLearningObjectiveReference.deleteMany({
            where: { objectiveRowId: existing!.id },
          });
          await tx.sessionLearningObjective.update({
            where: { id: existing!.id },
            data: {
              projection: 'SESSION_OVERRIDE',
              suppressedAt: now,
              updatedAt: now,
            },
          });
        } else {
          await tx.sessionLearningObjective.delete({ where: { id: existing!.id } });
        }
        continue;
      }
      if (!existing) {
        const objectiveRowId = randomUUID();
        await tx.sessionLearningObjective.create({
          data: {
            id: objectiveRowId,
            sessionId: session.id,
            objectiveId: mutation.objectiveId,
            revision: 0,
            text: mutation.text,
            scope: scopeToDb(mutation.scope),
            origin: 'MANUAL',
            modelId: null,
            modelVersion: null,
            derivationVersion: null,
            ...requestedConfirmationToDb(mutation.confirmationState, 0, now),
            projection: 'SESSION_MANUAL',
            sourceQuizId: scopeUsesQuiz(mutation.scope) ? currentSourceQuizId : null,
            createdAt: now,
            updatedAt: now,
            references: { create: taskReferenceCreateRows(objectiveRowId, mutation.scope) },
          },
        });
        continue;
      }

      assertRevisionCanAdvance(existing.revision);
      const nextRevision = existing.revision + 1;
      const oldScope = persistedScope(existing);
      const semanticChange =
        existing.text !== mutation.text ||
        oldScope === null ||
        canonicalWriteScope(oldScope) !== canonicalWriteScope(mutation.scope);
      const hasUnresolvedDerivation = existing.references.some(
        (reference) => reference.kind === 'DERIVATION' && reference.quizQuestionId === null,
      );
      if (
        existing.origin === 'MODEL_DERIVED' &&
        mutation.scope.kind === 'question-set' &&
        mutation.scope.taskReferences.some((reference) => reference.kind === 'qa-question')
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Modellabgeleitete Lernziele dürfen nur Quizaufgaben referenzieren.',
        });
      }
      if (existing.origin === 'MODEL_DERIVED' && semanticChange) {
        const derivedQuestionIds = new Set(
          existing.references
            .filter(
              (reference) => reference.kind === 'DERIVATION' && reference.quizQuestionId !== null,
            )
            .map((reference) => reference.quizQuestionId!),
        );
        const nextScopeQuestionIds =
          mutation.scope.kind === 'question-set'
            ? new Set(
                mutation.scope.taskReferences.flatMap((reference) =>
                  reference.kind === 'quiz-question' ? [reference.questionId] : [],
                ),
              )
            : null;
        if (
          mutation.scope.kind === 'session' ||
          (hasUnresolvedDerivation && mutation.scope.kind !== 'quiz-wide') ||
          (nextScopeQuestionIds &&
            [...derivedQuestionIds].some((questionId) => !nextScopeQuestionIds.has(questionId)))
        ) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Der Aufgabenbereich muss alle Herleitungsquellen des Lernziels enthalten.',
          });
        }
      }
      if (hasUnresolvedDerivation && mutation.confirmationState === 'confirmed') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Ein Lernziel mit entfernter Herleitungsquelle kann nicht bestätigt werden.',
        });
      }
      const promote = existing.projection === 'QUIZ_PROJECTED';
      await tx.sessionLearningObjectiveReference.deleteMany({
        where: {
          objectiveRowId: existing.id,
          kind: 'TASK',
        },
      });
      await tx.sessionLearningObjective.update({
        where: { id: existing.id },
        data: {
          revision: nextRevision,
          text: mutation.text,
          scope: scopeToDb(mutation.scope),
          ...(existing.projection === 'SESSION_MANUAL'
            ? {
                sourceQuizId: scopeUsesQuiz(mutation.scope) ? currentSourceQuizId : null,
              }
            : {}),
          ...(promote ? { projection: 'SESSION_OVERRIDE' as const } : {}),
          ...(hasUnresolvedDerivation
            ? staleConfirmationFields(existing)
            : requestedConfirmationToDb(mutation.confirmationState, nextRevision, now)),
          updatedAt: now,
        },
      });
      const referenceRows = taskReferenceCreateRows(existing.id, mutation.scope);
      if (referenceRows.length > 0) {
        await tx.sessionLearningObjectiveReference.createMany({ data: referenceRows });
      }
    }

    const learningContextRevision = session.learningContextRevision + 1;
    const updatedSession = await tx.session.update({
      where: { id: session.id },
      data: { learningContextRevision, learningContextConfigured: true },
      select: {
        id: true,
        status: true,
        endedAt: true,
        expiresAt: true,
        quizId: true,
        learningContextRevision: true,
        learningContextConfigured: true,
      },
    });
    return snapshotWithDb(tx, updatedSession, now);
  });
}

export function buildQuizLearningObjectiveBundleCreate(
  bundle: QuizLearningObjectiveBundleV1,
  questionIdBySourceId: ReadonlyMap<string, string>,
  lifecycleAt = new Date(),
) {
  return {
    sourceQuizId: bundle.quizId,
    schemaVersion: bundle.schemaVersion,
    revision: bundle.revision,
    objectives: {
      create: bundle.objectives.map((objective) => {
        const objectiveRowId = randomUUID();
        const taskSourceIds =
          objective.scope.kind === 'question-set' ? objective.scope.sourceQuestionIds : [];
        const derivationSourceIds =
          objective.origin.kind === 'model-derived'
            ? objective.origin.derivedFromSourceQuestionIds
            : [];
        const references = [
          ...taskSourceIds.map((sourceQuestionId) => ({
            id: randomUUID(),
            objectiveRowId,
            kind: 'TASK' as const,
            questionId: questionIdBySourceId.get(sourceQuestionId)!,
          })),
          ...derivationSourceIds.map((sourceQuestionId) => ({
            id: randomUUID(),
            objectiveRowId,
            kind: 'DERIVATION' as const,
            questionId: questionIdBySourceId.get(sourceQuestionId)!,
          })),
        ];
        return {
          id: objectiveRowId,
          objectiveId: objective.id,
          revision: objective.revision,
          text: objective.text,
          scope: scopeToDb(objective.scope),
          origin:
            objective.origin.kind === 'manual' ? ('MANUAL' as const) : ('MODEL_DERIVED' as const),
          modelId: objective.origin.kind === 'model-derived' ? objective.origin.modelId : null,
          modelVersion:
            objective.origin.kind === 'model-derived' ? objective.origin.modelVersion : null,
          derivationVersion:
            objective.origin.kind === 'model-derived' ? objective.origin.derivationVersion : null,
          sourceDigest:
            objective.origin.kind === 'model-derived' ? objective.origin.sourceDigest : null,
          ...confirmationToDb(objective.confirmation, lifecycleAt),
          createdAt: lifecycleAt,
          updatedAt: lifecycleAt,
          references: { create: references },
        };
      }),
    },
  };
}

type QuizBundleRow = Prisma.QuizLearningObjectiveBundleGetPayload<{
  include: {
    objectives: {
      include: { references: true };
    };
  };
}>;

async function loadQuizBundle(
  tx: LearningObjectiveDb,
  quizId: string,
): Promise<QuizBundleRow | null> {
  return tx.quizLearningObjectiveBundle.findUnique({
    where: { quizId },
    include: {
      objectives: {
        include: { references: true },
        orderBy: [{ createdAt: 'asc' }, { objectiveId: 'asc' }],
      },
    },
  });
}

async function cloneLoadedQuizBundle(
  tx: LearningObjectiveDb,
  sessionId: string,
  bundle: QuizBundleRow,
  excludedObjectiveIds: ReadonlySet<string> = new Set(),
): Promise<void> {
  const objectiveRows = bundle.objectives
    .filter((objective) => !excludedObjectiveIds.has(objective.objectiveId))
    .map((objective) => ({
      id: randomUUID(),
      source: objective,
    }));
  if (objectiveRows.length === 0) return;
  await tx.sessionLearningObjective.createMany({
    data: objectiveRows.map(({ id, source }) => ({
      id,
      sessionId,
      objectiveId: source.objectiveId,
      revision: source.revision,
      text: source.text,
      scope: source.scope,
      origin: source.origin,
      modelId: source.modelId,
      modelVersion: source.modelVersion,
      derivationVersion: source.derivationVersion,
      confirmationState: source.confirmationState,
      confirmationRevision: source.confirmationRevision,
      confirmationAt: source.confirmationAt,
      previousConfirmationState: source.previousConfirmationState,
      needsReviewReason: source.needsReviewReason,
      projection: 'QUIZ_PROJECTED',
      sourceQuizId: bundle.sourceQuizId,
      suppressedAt: null,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    })),
  });
  const references = objectiveRows.flatMap(({ id: objectiveRowId, source }) =>
    source.references.map((reference) => ({
      id: randomUUID(),
      sourceReferenceId: reference.questionId,
      objectiveRowId,
      kind: reference.kind,
      sourceKind: 'QUIZ_QUESTION' as const,
      quizQuestionId: reference.questionId,
      qaQuestionId: null,
      unresolvedReason: null,
    })),
  );
  if (references.length > 0) {
    await tx.sessionLearningObjectiveReference.createMany({ data: references });
  }
}

/** Clone the immutable quiz staging bundle during session.create. */
export async function initializeSessionLearningObjectivesFromQuiz(
  tx: LearningObjectiveDb,
  sessionId: string,
  quizId: string,
): Promise<boolean> {
  const bundle = await loadQuizBundle(tx, quizId);
  if (!bundle) return false;
  await cloneLoadedQuizBundle(tx, sessionId, bundle);
  return true;
}

type ConfirmationPersistenceRow = Pick<
  SessionObjectiveRow,
  | 'confirmationState'
  | 'confirmationRevision'
  | 'confirmationAt'
  | 'previousConfirmationState'
  | 'revision'
>;

function stableLearningSourceValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableLearningSourceValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableLearningSourceValue(entry)]),
    );
  }
  return value;
}

function learningSourceFingerprint(question: LearningSourceQuestion): string {
  const content = {
    text: question.text,
    type: question.type,
    answers: (question.answers ?? []).map(({ text, isCorrect }) => ({ text, isCorrect })),
    ratingMin: question.ratingMin,
    ratingMax: question.ratingMax,
    ratingLabelMin: question.ratingLabelMin,
    ratingLabelMax: question.ratingLabelMax,
    shortTextEvaluationKind: question.shortTextEvaluationKind,
    shortTextMaxLength: question.shortTextMaxLength,
    shortTextCaseSensitive: question.shortTextCaseSensitive,
    shortTextEvaluationMode: question.shortTextEvaluationMode,
    shortTextToleranceLevel: question.shortTextToleranceLevel,
    shortTextAllowPartialCredit: question.shortTextAllowPartialCredit,
    shortTextTrimWhitespace: question.shortTextTrimWhitespace,
    shortTextNormalizeWhitespace: question.shortTextNormalizeWhitespace,
    numericInputKind: question.numericInputKind,
    numericToleranceMode: question.numericToleranceMode,
    numericAbsoluteTolerance: question.numericAbsoluteTolerance,
    numericRelativeTolerancePercent: question.numericRelativeTolerancePercent,
    numericUnitFamily: question.numericUnitFamily,
    numericRequireUnit: question.numericRequireUnit,
    numericAcceptEquivalentUnits: question.numericAcceptEquivalentUnits,
    numericReferenceValue: question.numericReferenceValue,
    numericTolerancePercent: question.numericTolerancePercent,
    numericIntervalLeft: question.numericIntervalLeft,
    numericIntervalRight: question.numericIntervalRight,
    numericInputType: question.numericInputType,
    numericDecimalPlaces: question.numericDecimalPlaces,
    numericMin: question.numericMin,
    numericMax: question.numericMax,
    numericTwoRounds: question.numericTwoRounds,
    matchingPairs: question.matchingPairs,
    matchingShuffleRight: question.matchingShuffleRight,
    orderingItems: question.orderingItems,
    categories: question.categories,
    categorizationItems: question.categorizationItems,
    categorizationShuffleItems: question.categorizationShuffleItems,
  };
  return createHash('sha256')
    .update(JSON.stringify(stableLearningSourceValue(content)))
    .digest('hex');
}

type QuizReferenceRemap = {
  id: string;
  sourceReferenceId: string;
  quizQuestionId: string | null;
  unresolvedReason: 'SOURCE_NOT_IN_UPLOAD' | null;
};

async function applyQuizReferenceRemaps(
  tx: LearningObjectiveDb,
  remaps: QuizReferenceRemap[],
): Promise<void> {
  // Keep small mutations easy to observe and batch the valid 20k-reference
  // upper bound so attach does not issue one sequential statement per row.
  if (remaps.length <= 20) {
    for (const remap of remaps) {
      await tx.sessionLearningObjectiveReference.update({
        where: { id: remap.id },
        data: {
          sourceReferenceId: remap.sourceReferenceId,
          quizQuestionId: remap.quizQuestionId,
          unresolvedReason: remap.unresolvedReason,
        },
      });
    }
    return;
  }

  for (let offset = 0; offset < remaps.length; offset += 1_000) {
    const chunk = remaps.slice(offset, offset + 1_000);
    const values = Prisma.join(
      chunk.map(
        (remap) => Prisma.sql`(
          CAST(${remap.id} AS TEXT),
          CAST(${remap.sourceReferenceId} AS UUID),
          CAST(${remap.quizQuestionId} AS TEXT),
          CAST(${remap.unresolvedReason} AS "LearningObjectiveUnresolvedReason")
        )`,
      ),
    );
    await tx.$executeRaw(Prisma.sql`
      UPDATE "SessionLearningObjectiveReference" AS reference
      SET
        "sourceReferenceId" = replacement."sourceReferenceId",
        "quizQuestionId" = replacement."quizQuestionId",
        "unresolvedReason" = replacement."unresolvedReason"
      FROM (VALUES ${values}) AS replacement(
        "id", "sourceReferenceId", "quizQuestionId", "unresolvedReason"
      )
      WHERE reference.id = replacement.id
    `);
  }
}

function staleConfirmationFields(
  row: ConfirmationPersistenceRow,
  reason: 'SOURCE_CONTENT_CHANGED' | 'SOURCE_REFERENCE_REMOVED' = 'SOURCE_REFERENCE_REMOVED',
) {
  if (row.confirmationState === 'NEEDS_REVIEW') {
    return {
      confirmationState: 'NEEDS_REVIEW' as const,
      confirmationRevision: row.confirmationRevision,
      confirmationAt: row.confirmationAt,
      previousConfirmationState: row.previousConfirmationState,
      needsReviewReason: reason,
    };
  }
  return {
    confirmationState: 'NEEDS_REVIEW' as const,
    confirmationRevision: row.revision,
    confirmationAt: row.confirmationState === 'CONFIRMED' ? row.confirmationAt : null,
    previousConfirmationState:
      row.confirmationState === 'CONFIRMED' ? ('CONFIRMED' as const) : ('DRAFT' as const),
    needsReviewReason: reason,
  };
}

/**
 * Detach every reference to a removed Q&A source while the caller holds the
 * session row lock. This covers both physical moderator deletion and the
 * participant soft-delete path. The database source-delete trigger remains a
 * backstop for retention jobs and direct SQL deletes.
 */
export async function markSessionLearningObjectiveQaSourceRemoved(input: {
  tx: LearningObjectiveDb;
  sessionId: string;
  questionId: string;
  now?: Date;
}): Promise<boolean> {
  const now = input.now ?? new Date();
  const references = await input.tx.sessionLearningObjectiveReference.findMany({
    where: {
      sourceKind: 'QA_QUESTION',
      qaQuestionId: input.questionId,
      objective: { sessionId: input.sessionId },
    },
    select: {
      id: true,
      objective: {
        select: {
          id: true,
          revision: true,
          confirmationState: true,
          confirmationRevision: true,
          confirmationAt: true,
          previousConfirmationState: true,
        },
      },
    },
  });
  if (references.length === 0) return false;

  const objectives = new Map(
    references.map((reference) => [reference.objective.id, reference.objective]),
  );
  for (const objective of objectives.values()) {
    assertRevisionCanAdvance(objective.revision);
  }
  const session = await input.tx.session.findUnique({
    where: { id: input.sessionId },
    select: { learningContextRevision: true },
  });
  if (!session) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
  }
  assertRevisionCanAdvance(session.learningContextRevision);

  await input.tx.sessionLearningObjectiveReference.updateMany({
    where: { id: { in: references.map((reference) => reference.id) } },
    data: { qaQuestionId: null, unresolvedReason: 'SOURCE_REMOVED' },
  });
  for (const objective of objectives.values()) {
    await input.tx.sessionLearningObjective.update({
      where: { id: objective.id },
      data: {
        revision: objective.revision + 1,
        ...staleConfirmationFields(objective),
        updatedAt: now,
      },
    });
  }
  await input.tx.session.update({
    where: { id: input.sessionId },
    data: {
      learningContextRevision: session.learningContextRevision + 1,
      learningContextConfigured: true,
    },
  });
  return true;
}

/**
 * Replace only quiz-projected rows during attach. Session-manual rows survive;
 * their quiz-task references follow stable sourceQuestionId or become explicit
 * unresolved evidence that requires host review.
 */
export async function replaceSessionQuizLearningObjectives(input: {
  tx: LearningObjectiveDb;
  sessionId: string;
  previousQuizId: string | null;
  quizId: string;
  currentRevision: number;
  currentConfigured: boolean;
}): Promise<{ configured: boolean; revision: number }> {
  assertRevisionCanAdvance(input.currentRevision);
  const [loadedOwnedRows, newQuestions, bundle, newQuiz] = await Promise.all([
    input.tx.sessionLearningObjective.findMany({
      where: { sessionId: input.sessionId, projection: { not: 'QUIZ_PROJECTED' } },
      include: {
        references: {
          include: { quizQuestion: { select: learningSourceQuestionSelect } },
          orderBy: { id: 'asc' },
        },
      },
    }),
    input.tx.question.findMany({
      where: { quizId: input.quizId, sourceQuestionId: { not: null } },
      select: learningSourceQuestionSelect,
    }),
    loadQuizBundle(input.tx, input.quizId),
    input.tx.quiz.findUnique({
      where: { id: input.quizId },
      select: { sourceQuizId: true },
    }),
  ]);
  const newSourceQuizId = newQuiz?.sourceQuizId ?? bundle?.sourceQuizId ?? null;
  const retiredTombstoneIds = loadedOwnedRows
    .filter(
      (row) =>
        row.suppressedAt !== null &&
        (newSourceQuizId === null || row.sourceQuizId !== newSourceQuizId),
    )
    .map((row) => row.id);
  if (retiredTombstoneIds.length > 0) {
    await input.tx.sessionLearningObjective.deleteMany({
      where: { id: { in: retiredTombstoneIds } },
    });
  }
  const manualRows = loadedOwnedRows.filter((row) => !retiredTombstoneIds.includes(row.id));
  const newQuestionBySourceId = new Map<string, LearningSourceQuestion>(
    newQuestions.flatMap((question) =>
      question.sourceQuestionId ? [[question.sourceQuestionId, question] as const] : [],
    ),
  );
  const referenceRemaps: QuizReferenceRemap[] = [];

  for (const row of manualRows) {
    if (row.suppressedAt) continue;
    const sameSourceQuiz =
      row.sourceQuizId !== null && newSourceQuizId !== null
        ? row.sourceQuizId === newSourceQuizId
        : input.previousQuizId === input.quizId;
    let becameUnresolved =
      (row.scope === 'QUIZ' && !sameSourceQuiz) ||
      row.references.some(
        (reference) =>
          reference.sourceKind === 'QUIZ_QUESTION' && reference.quizQuestionId === null,
      );
    let sourceContentChanged = false;
    for (const reference of row.references) {
      if (reference.sourceKind !== 'QUIZ_QUESTION' || !reference.quizQuestionId) {
        continue;
      }
      const sourceQuestionId = reference.quizQuestion?.sourceQuestionId ?? null;
      const replacement =
        sameSourceQuiz && sourceQuestionId
          ? (newQuestionBySourceId.get(sourceQuestionId) ?? null)
          : null;
      const replacementId = replacement?.id ?? null;
      if (
        replacement &&
        reference.quizQuestion &&
        learningSourceFingerprint(reference.quizQuestion) !== learningSourceFingerprint(replacement)
      ) {
        sourceContentChanged = true;
      }
      referenceRemaps.push({
        id: reference.id,
        sourceReferenceId: replacementId ?? reference.sourceReferenceId,
        quizQuestionId: replacementId,
        unresolvedReason: replacementId ? null : 'SOURCE_NOT_IN_UPLOAD',
      });
      becameUnresolved ||= replacementId === null;
    }
    if (becameUnresolved) {
      assertRevisionCanAdvance(row.revision);
      await input.tx.sessionLearningObjective.update({
        where: { id: row.id },
        data: {
          revision: row.revision + 1,
          ...staleConfirmationFields(row as SessionObjectiveRow),
          updatedAt: new Date(),
        },
      });
    } else if (sourceContentChanged) {
      assertRevisionCanAdvance(row.revision);
      await input.tx.sessionLearningObjective.update({
        where: { id: row.id },
        data: {
          revision: row.revision + 1,
          ...staleConfirmationFields(row as SessionObjectiveRow, 'SOURCE_CONTENT_CHANGED'),
          updatedAt: new Date(),
        },
      });
    }
  }

  await applyQuizReferenceRemaps(input.tx, referenceRemaps);

  await input.tx.sessionLearningObjective.deleteMany({
    where: { sessionId: input.sessionId, projection: 'QUIZ_PROJECTED' },
  });
  const preservedObjectiveIds = new Set(manualRows.map((row) => row.objectiveId));
  const liveOwnedCount = manualRows.filter((row) => row.suppressedAt === null).length;
  const projectedCloneCount =
    bundle?.objectives.filter((objective) => !preservedObjectiveIds.has(objective.objectiveId))
      .length ?? 0;
  if (liveOwnedCount + projectedCloneCount > LEARNING_OBJECTIVE_MAX_OBJECTIVES) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Das Quiz überschreitet zusammen mit den Session-Lernzielen das Maximum.',
    });
  }
  if (bundle) {
    await cloneLoadedQuizBundle(input.tx, input.sessionId, bundle, preservedObjectiveIds);
  }
  return {
    configured: input.currentConfigured || bundle !== null || manualRows.length > 0,
    revision: input.currentRevision + 1,
  };
}

export async function getSessionLearningObjectivesSnapshotWithDb(
  tx: LearningObjectiveDb,
  sessionId: string,
  now = new Date(),
): Promise<SessionLearningObjectivesSnapshot> {
  const session = await tx.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
      endedAt: true,
      expiresAt: true,
      quizId: true,
      learningContextRevision: true,
      learningContextConfigured: true,
    },
  });
  if (!session) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
  }
  return snapshotWithDb(tx, session, now);
}

export const sessionLearningObjectivesInternals = {
  confirmationFromRow,
  objectiveFromRow,
  canonicalWriteScope,
};
