import { z } from 'zod';
import { QUIZ_QUESTION_TEXT_MAX_LENGTH, QUIZ_UPLOAD_MAX_QUESTIONS } from './quiz-contract-limits';
import { QA_QUESTION_TEXT_MAX_CODE_POINTS, qaTextCodePointLength } from './qa-redaction';

/**
 * Shared persistence and host-API contracts for manual learning objectives.
 *
 * The local/quiz contract intentionally uses stable source IDs and may retain an
 * internal source digest for staleness detection. The session/host contract uses
 * server-side question references and intentionally has no field for source
 * digests, answer options, correctness markers, or other solution material.
 */

export const QUIZ_LEARNING_OBJECTIVE_SCHEMA_VERSION = 1 as const;
export const SESSION_LEARNING_OBJECTIVE_SCHEMA_VERSION = 1 as const;
export const LEARNING_OBJECTIVE_MAX_OBJECTIVES = 100;
export const LEARNING_OBJECTIVE_MAX_REFERENCES = 100;
export const LEARNING_OBJECTIVE_TEXT_MAX_LENGTH = 500;
export const LEARNING_OBJECTIVE_MODEL_METADATA_MAX_LENGTH = 120;
/** Bounded host catalog; larger forums expose truncation explicitly. */
export const SESSION_LEARNING_OBJECTIVE_QA_TASK_CATALOG_MAX = 500;
/** PostgreSQL/Prisma `Int` upper bound used by bundle, row, and CAS revisions. */
export const LEARNING_OBJECTIVE_REVISION_MAX = 2_147_483_647;

export const LearningObjectiveIdSchema = z.uuid();
export type LearningObjectiveId = z.infer<typeof LearningObjectiveIdSchema>;

export const LearningObjectiveRevisionSchema = z
  .number()
  .int()
  .min(0)
  .max(LEARNING_OBJECTIVE_REVISION_MAX);
export type LearningObjectiveRevision = z.infer<typeof LearningObjectiveRevisionSchema>;

/** SHA-256 digest of the solution-bearing preparation source; never a live/model source ID. */
export const LearningObjectiveSourceDigestSchema = z.string().regex(/^[a-f0-9]{64}$/);
export type LearningObjectiveSourceDigest = z.infer<typeof LearningObjectiveSourceDigestSchema>;

const LearningObjectiveTimestampSchema = z.string().datetime({ offset: true });
const LearningObjectiveTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(LEARNING_OBJECTIVE_TEXT_MAX_LENGTH);
export const QuizSourceQuestionIdSchema = z.uuid();
export type QuizSourceQuestionId = z.infer<typeof QuizSourceQuestionIdSchema>;

function addUniqueStringIssues(
  values: readonly string[],
  ctx: z.RefinementCtx,
  path: PropertyKey[],
  message: string,
): void {
  const seen = new Set<string>();
  for (const [index, value] of values.entries()) {
    if (seen.has(value)) {
      ctx.addIssue({ code: 'custom', path: [...path, index], message });
    }
    seen.add(value);
  }
}

// ---------------------------------------------------------------------------
// Quiz-local sidecar and upload staging (internal preparation provenance)
// ---------------------------------------------------------------------------

/**
 * Stable scope inside one local quiz. A question-set scope is always explicit;
 * question order/current phase is never interpreted as an implicit section.
 */
export const QuizLearningObjectiveScopeSchema = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('quiz-wide') }).strict(),
    z
      .object({
        kind: z.literal('question-set'),
        sourceQuestionIds: z
          .array(QuizSourceQuestionIdSchema)
          .min(1)
          .max(LEARNING_OBJECTIVE_MAX_REFERENCES),
      })
      .strict(),
  ])
  .superRefine((value, ctx) => {
    if (value.kind === 'question-set') {
      addUniqueStringIssues(
        value.sourceQuestionIds,
        ctx,
        ['sourceQuestionIds'],
        'Aufgabenreferenzen eines Lernziels müssen eindeutig sein.',
      );
    }
  });
export type QuizLearningObjectiveScope = z.infer<typeof QuizLearningObjectiveScopeSchema>;

/**
 * Preparation provenance. The digest is internal invalidation material; it is
 * deliberately absent from every host/live DTO below.
 */
export const QuizLearningObjectiveOriginSchema = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('manual') }).strict(),
    z
      .object({
        kind: z.literal('model-derived'),
        modelId: z.string().trim().min(1).max(LEARNING_OBJECTIVE_MODEL_METADATA_MAX_LENGTH),
        modelVersion: z.string().trim().min(1).max(LEARNING_OBJECTIVE_MODEL_METADATA_MAX_LENGTH),
        derivationVersion: z
          .string()
          .trim()
          .min(1)
          .max(LEARNING_OBJECTIVE_MODEL_METADATA_MAX_LENGTH),
        derivedFromSourceQuestionIds: z
          .array(QuizSourceQuestionIdSchema)
          .min(1)
          .max(LEARNING_OBJECTIVE_MAX_REFERENCES),
        sourceDigest: LearningObjectiveSourceDigestSchema,
      })
      .strict(),
  ])
  .superRefine((value, ctx) => {
    if (value.kind === 'model-derived') {
      addUniqueStringIssues(
        value.derivedFromSourceQuestionIds,
        ctx,
        ['derivedFromSourceQuestionIds'],
        'Herleitungsreferenzen eines Lernziels müssen eindeutig sein.',
      );
    }
  });
export type QuizLearningObjectiveOrigin = z.infer<typeof QuizLearningObjectiveOriginSchema>;

export const LearningObjectiveNeedsReviewReasonSchema = z.enum([
  'source-content-changed',
  'source-reference-removed',
  'derivation-replaced',
]);
export type LearningObjectiveNeedsReviewReason = z.infer<
  typeof LearningObjectiveNeedsReviewReasonSchema
>;

export const LearningObjectivePreviousConfirmationSchema = z.discriminatedUnion('state', [
  z
    .object({
      state: z.literal('draft'),
      revision: LearningObjectiveRevisionSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal('confirmed'),
      revision: LearningObjectiveRevisionSchema,
      confirmedAt: LearningObjectiveTimestampSchema,
    })
    .strict(),
]);
export type LearningObjectivePreviousConfirmation = z.infer<
  typeof LearningObjectivePreviousConfirmationSchema
>;

/** Confirmation is independent of provenance and guarded by row revisions. */
export const LearningObjectiveConfirmationSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('draft') }).strict(),
  z
    .object({
      state: z.literal('confirmed'),
      confirmedAt: LearningObjectiveTimestampSchema,
      confirmedRevision: LearningObjectiveRevisionSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal('needs-review'),
      previousConfirmation: LearningObjectivePreviousConfirmationSchema,
      currentRevision: LearningObjectiveRevisionSchema,
      reason: LearningObjectiveNeedsReviewReasonSchema,
    })
    .strict()
    .superRefine((value, ctx) => {
      if (value.currentRevision <= value.previousConfirmation.revision) {
        ctx.addIssue({
          code: 'custom',
          path: ['currentRevision'],
          message: 'Prüfbedarf benötigt eine neuere aktuelle Revision.',
        });
      }
    }),
]);
export type LearningObjectiveConfirmation = z.infer<typeof LearningObjectiveConfirmationSchema>;

export const QuizLearningObjectiveV1Schema = z
  .object({
    id: LearningObjectiveIdSchema,
    revision: LearningObjectiveRevisionSchema,
    text: LearningObjectiveTextSchema,
    scope: QuizLearningObjectiveScopeSchema,
    origin: QuizLearningObjectiveOriginSchema,
    confirmation: LearningObjectiveConfirmationSchema,
    createdAt: LearningObjectiveTimestampSchema,
    updatedAt: LearningObjectiveTimestampSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Date.parse(value.updatedAt) < Date.parse(value.createdAt)) {
      ctx.addIssue({
        code: 'custom',
        path: ['updatedAt'],
        message: 'updatedAt darf nicht vor createdAt liegen.',
      });
    }

    const confirmedAt =
      value.confirmation.state === 'confirmed'
        ? value.confirmation.confirmedAt
        : value.confirmation.state === 'needs-review' &&
            value.confirmation.previousConfirmation.state === 'confirmed'
          ? value.confirmation.previousConfirmation.confirmedAt
          : null;
    if (
      confirmedAt &&
      (Date.parse(confirmedAt) < Date.parse(value.createdAt) ||
        Date.parse(confirmedAt) > Date.parse(value.updatedAt))
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmation'],
        message: 'Der Bestätigungszeitpunkt muss im Lebenszyklus des Lernziels liegen.',
      });
    }

    if (
      value.confirmation.state === 'confirmed' &&
      value.confirmation.confirmedRevision !== value.revision
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmation', 'confirmedRevision'],
        message: 'Ein bestätigtes Lernziel muss seine aktuelle Revision bestätigen.',
      });
    }

    if (
      value.confirmation.state === 'needs-review' &&
      value.confirmation.currentRevision !== value.revision
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmation', 'currentRevision'],
        message: 'Prüfbedarf muss sich auf die aktuelle Lernzielrevision beziehen.',
      });
    }

    if (value.origin.kind === 'model-derived' && value.scope.kind === 'question-set') {
      const scopedIds = new Set(value.scope.sourceQuestionIds);
      value.origin.derivedFromSourceQuestionIds.forEach((sourceQuestionId, index) => {
        if (!scopedIds.has(sourceQuestionId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['origin', 'derivedFromSourceQuestionIds', index],
            message: 'Herleitungsfragen müssen im expliziten Aufgabenbereich liegen.',
          });
        }
      });
    }
  });
export type QuizLearningObjectiveV1 = z.infer<typeof QuizLearningObjectiveV1Schema>;

/** Canonical JSON value stored in the `quiz-learning-objectives-v1` Yjs sidecar. */
export const QuizLearningObjectiveBundleV1Schema = z
  .object({
    schemaVersion: z.literal(QUIZ_LEARNING_OBJECTIVE_SCHEMA_VERSION),
    quizId: z.uuid(),
    revision: LearningObjectiveRevisionSchema,
    objectives: z.array(QuizLearningObjectiveV1Schema).max(LEARNING_OBJECTIVE_MAX_OBJECTIVES),
  })
  .strict()
  .superRefine((value, ctx) => {
    addUniqueStringIssues(
      value.objectives.map((objective) => objective.id),
      ctx,
      ['objectives'],
      'Lernziel-IDs müssen innerhalb eines Quiz eindeutig sein.',
    );
  });
export type QuizLearningObjectiveBundleV1 = z.infer<typeof QuizLearningObjectiveBundleV1Schema>;

export interface QuizLearningObjectiveReferenceIssue {
  objectiveIndex: number;
  field: 'scope' | 'origin';
  referenceIndex: number;
  sourceQuestionId: string;
}

/**
 * Resolves all sidecar references against the questions crossing the same
 * import/upload boundary. Callers use the returned indexes for precise Zod/UI
 * paths; IDs are never inferred from question text.
 */
export function findUnresolvedQuizLearningObjectiveReferences(
  bundle: QuizLearningObjectiveBundleV1,
  knownSourceQuestionIds: ReadonlySet<string>,
): QuizLearningObjectiveReferenceIssue[] {
  const issues: QuizLearningObjectiveReferenceIssue[] = [];
  bundle.objectives.forEach((objective, objectiveIndex) => {
    if (objective.scope.kind === 'question-set') {
      objective.scope.sourceQuestionIds.forEach((sourceQuestionId, referenceIndex) => {
        if (!knownSourceQuestionIds.has(sourceQuestionId)) {
          issues.push({
            objectiveIndex,
            field: 'scope',
            referenceIndex,
            sourceQuestionId,
          });
        }
      });
    }
    if (objective.origin.kind === 'model-derived') {
      objective.origin.derivedFromSourceQuestionIds.forEach((sourceQuestionId, referenceIndex) => {
        if (!knownSourceQuestionIds.has(sourceQuestionId)) {
          issues.push({
            objectiveIndex,
            field: 'origin',
            referenceIndex,
            sourceQuestionId,
          });
        }
      });
    }
  });
  return issues;
}

// ---------------------------------------------------------------------------
// Session-authoritative host API (explicitly solution-free)
// ---------------------------------------------------------------------------

const SessionQuizQuestionReferenceSchema = z
  .object({ kind: z.literal('quiz-question'), questionId: z.uuid() })
  .strict();
const SessionQaQuestionReferenceSchema = z
  .object({ kind: z.literal('qa-question'), questionId: z.uuid() })
  .strict();
const SessionUnresolvedTaskReferenceSchema = z
  .object({
    kind: z.literal('unresolved-task'),
    /** Stable former server source ID shared across TASK/DERIVATION; never a local source ID. */
    sourceReferenceId: z.uuid(),
    sourceKind: z.enum(['quiz-question', 'qa-question']),
    reason: z.enum(['source-removed', 'source-not-in-upload']),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.sourceKind === 'qa-question' && value.reason !== 'source-removed') {
      ctx.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'Q&A-Referenzen können nur durch Quellenlöschung unauflösbar werden.',
      });
    }
  });

export const SessionLearningObjectiveResolvedTaskReferenceSchema = z.discriminatedUnion('kind', [
  SessionQuizQuestionReferenceSchema,
  SessionQaQuestionReferenceSchema,
]);
export type SessionLearningObjectiveResolvedTaskReference = z.infer<
  typeof SessionLearningObjectiveResolvedTaskReferenceSchema
>;

export const SessionLearningObjectiveTaskReferenceSchema = z.discriminatedUnion('kind', [
  SessionQuizQuestionReferenceSchema,
  SessionQaQuestionReferenceSchema,
  SessionUnresolvedTaskReferenceSchema,
]);
export type SessionLearningObjectiveTaskReference = z.infer<
  typeof SessionLearningObjectiveTaskReferenceSchema
>;

function taskReferenceKey(reference: SessionLearningObjectiveTaskReference): string {
  return reference.kind === 'unresolved-task'
    ? `${reference.kind}:${reference.sourceKind}:${reference.sourceReferenceId}`
    : `${reference.kind}:${reference.questionId}`;
}

export const SessionLearningObjectiveScopeSchema = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('session') }).strict(),
    z.object({ kind: z.literal('quiz-wide') }).strict(),
    z
      .object({
        kind: z.literal('question-set'),
        taskReferences: z
          .array(SessionLearningObjectiveTaskReferenceSchema)
          .min(1)
          .max(LEARNING_OBJECTIVE_MAX_REFERENCES),
      })
      .strict(),
  ])
  .superRefine((value, ctx) => {
    if (value.kind === 'question-set') {
      addUniqueStringIssues(
        value.taskReferences.map(taskReferenceKey),
        ctx,
        ['taskReferences'],
        'Aufgabenreferenzen eines Lernziels müssen eindeutig sein.',
      );
    }
  });
export type SessionLearningObjectiveScope = z.infer<typeof SessionLearningObjectiveScopeSchema>;

/** Host writes can select only currently resolvable tasks; unresolved refs are server-produced. */
export const SessionLearningObjectiveWriteScopeSchema = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('session') }).strict(),
    z.object({ kind: z.literal('quiz-wide') }).strict(),
    z
      .object({
        kind: z.literal('question-set'),
        taskReferences: z
          .array(SessionLearningObjectiveResolvedTaskReferenceSchema)
          .min(1)
          .max(LEARNING_OBJECTIVE_MAX_REFERENCES),
      })
      .strict(),
  ])
  .superRefine((value, ctx) => {
    if (value.kind === 'question-set') {
      addUniqueStringIssues(
        value.taskReferences.map(taskReferenceKey),
        ctx,
        ['taskReferences'],
        'Aufgabenreferenzen eines Lernziels müssen eindeutig sein.',
      );
    }
  });
export type SessionLearningObjectiveWriteScope = z.infer<
  typeof SessionLearningObjectiveWriteScopeSchema
>;

export const SessionLearningObjectiveDerivationReferenceSchema = z
  .discriminatedUnion('kind', [
    SessionQuizQuestionReferenceSchema,
    SessionUnresolvedTaskReferenceSchema,
  ])
  .superRefine((value, ctx) => {
    if (value.kind === 'unresolved-task' && value.sourceKind !== 'quiz-question') {
      ctx.addIssue({
        code: 'custom',
        path: ['sourceKind'],
        message: 'Modellherleitungen dürfen nur Quizaufgaben referenzieren.',
      });
    }
  });
export type SessionLearningObjectiveDerivationReference = z.infer<
  typeof SessionLearningObjectiveDerivationReferenceSchema
>;

/** Live-safe provenance: it retains traceability but never carries source digests or solutions. */
export const SessionLearningObjectiveOriginSchema = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('manual') }).strict(),
    z
      .object({
        kind: z.literal('model-derived'),
        modelId: z.string().trim().min(1).max(LEARNING_OBJECTIVE_MODEL_METADATA_MAX_LENGTH),
        modelVersion: z.string().trim().min(1).max(LEARNING_OBJECTIVE_MODEL_METADATA_MAX_LENGTH),
        derivationVersion: z
          .string()
          .trim()
          .min(1)
          .max(LEARNING_OBJECTIVE_MODEL_METADATA_MAX_LENGTH),
        derivedFrom: z
          .array(SessionLearningObjectiveDerivationReferenceSchema)
          .min(1)
          .max(LEARNING_OBJECTIVE_MAX_REFERENCES),
      })
      .strict(),
  ])
  .superRefine((value, ctx) => {
    if (value.kind === 'model-derived') {
      addUniqueStringIssues(
        value.derivedFrom.map(taskReferenceKey),
        ctx,
        ['derivedFrom'],
        'Herleitungsreferenzen eines Lernziels müssen eindeutig sein.',
      );
    }
  });
export type SessionLearningObjectiveOrigin = z.infer<typeof SessionLearningObjectiveOriginSchema>;

export const SessionLearningObjectiveProjectionSchema = z.enum([
  'quiz-projected',
  'session-manual',
  'session-override',
]);
export type SessionLearningObjectiveProjection = z.infer<
  typeof SessionLearningObjectiveProjectionSchema
>;

export const SessionLearningObjectiveDTOSchema = z
  .object({
    id: LearningObjectiveIdSchema,
    revision: LearningObjectiveRevisionSchema,
    text: LearningObjectiveTextSchema,
    scope: SessionLearningObjectiveScopeSchema,
    origin: SessionLearningObjectiveOriginSchema,
    confirmation: LearningObjectiveConfirmationSchema,
    projection: SessionLearningObjectiveProjectionSchema,
    createdAt: LearningObjectiveTimestampSchema,
    updatedAt: LearningObjectiveTimestampSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Date.parse(value.updatedAt) < Date.parse(value.createdAt)) {
      ctx.addIssue({
        code: 'custom',
        path: ['updatedAt'],
        message: 'updatedAt darf nicht vor createdAt liegen.',
      });
    }
    const confirmedAt =
      value.confirmation.state === 'confirmed'
        ? value.confirmation.confirmedAt
        : value.confirmation.state === 'needs-review' &&
            value.confirmation.previousConfirmation.state === 'confirmed'
          ? value.confirmation.previousConfirmation.confirmedAt
          : null;
    if (
      confirmedAt &&
      (Date.parse(confirmedAt) < Date.parse(value.createdAt) ||
        Date.parse(confirmedAt) > Date.parse(value.updatedAt))
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmation'],
        message: 'Der Bestätigungszeitpunkt muss im Lebenszyklus des Lernziels liegen.',
      });
    }
    if (value.projection === 'session-manual' && value.origin.kind !== 'manual') {
      ctx.addIssue({
        code: 'custom',
        path: ['origin', 'kind'],
        message: 'Sessionmanuelle Ziele benötigen manuelle Herkunft.',
      });
    }
    if (value.projection === 'quiz-projected') {
      if (value.scope.kind === 'session') {
        ctx.addIssue({
          code: 'custom',
          path: ['scope', 'kind'],
          message: 'Quizprojizierte Ziele benötigen einen Quiz-Aufgabenbereich.',
        });
      }
      if (value.scope.kind === 'question-set') {
        value.scope.taskReferences.forEach((reference, index) => {
          if (reference.kind !== 'quiz-question') {
            ctx.addIssue({
              code: 'custom',
              path: ['scope', 'taskReferences', index, 'kind'],
              message: 'Quizprojizierte Ziele dürfen nur Quizaufgaben referenzieren.',
            });
          }
        });
      }
      if (
        value.origin.kind === 'model-derived' &&
        value.origin.derivedFrom.some((reference) => reference.kind === 'unresolved-task')
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['origin', 'derivedFrom'],
          message: 'Eine direkte Quizprojektion darf keine unaufgelöste Herleitung enthalten.',
        });
      }
    }
    if (value.origin.kind === 'model-derived' && value.scope.kind === 'session') {
      ctx.addIssue({
        code: 'custom',
        path: ['scope', 'kind'],
        message: 'Modellabgeleitete Ziele benötigen einen expliziten Quiz-Aufgabenbereich.',
      });
    }
    if (value.origin.kind === 'model-derived' && value.scope.kind === 'question-set') {
      value.scope.taskReferences.forEach((reference, index) => {
        if (
          reference.kind === 'qa-question' ||
          (reference.kind === 'unresolved-task' && reference.sourceKind !== 'quiz-question')
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['scope', 'taskReferences', index, 'kind'],
            message: 'Modellabgeleitete Ziele dürfen nur Quizaufgaben referenzieren.',
          });
        }
      });
      const scopeReferences = new Set(value.scope.taskReferences.map(taskReferenceKey));
      value.origin.derivedFrom.forEach((reference, index) => {
        if (!scopeReferences.has(taskReferenceKey(reference))) {
          ctx.addIssue({
            code: 'custom',
            path: ['origin', 'derivedFrom', index],
            message: 'Herleitungsfragen müssen im expliziten Aufgabenbereich liegen.',
          });
        }
      });
    }
    const hasUnresolvedReference =
      (value.scope.kind === 'question-set' &&
        value.scope.taskReferences.some((reference) => reference.kind === 'unresolved-task')) ||
      (value.origin.kind === 'model-derived' &&
        value.origin.derivedFrom.some((reference) => reference.kind === 'unresolved-task'));
    if (
      hasUnresolvedReference &&
      !(
        value.confirmation.state === 'needs-review' &&
        value.confirmation.reason === 'source-reference-removed'
      )
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmation'],
        message: 'Nicht auflösbare Aufgabenreferenzen müssen als Prüfbedarf markiert sein.',
      });
    }
    if (
      value.confirmation.state === 'confirmed' &&
      value.confirmation.confirmedRevision !== value.revision
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmation', 'confirmedRevision'],
        message: 'Ein bestätigtes Lernziel muss seine aktuelle Revision bestätigen.',
      });
    }
    if (
      value.confirmation.state === 'needs-review' &&
      value.confirmation.currentRevision !== value.revision
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmation', 'currentRevision'],
        message: 'Prüfbedarf muss sich auf die aktuelle Lernzielrevision beziehen.',
      });
    }
  });
export type SessionLearningObjectiveDTO = z.infer<typeof SessionLearningObjectiveDTOSchema>;

export const SessionLearningObjectivesAccessSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('writable') }).strict(),
  z
    .object({
      state: z.literal('read-only'),
      reason: z.enum(['session-finished', 'write-window-closed']),
    })
    .strict(),
]);
export type SessionLearningObjectivesAccess = z.infer<typeof SessionLearningObjectivesAccessSchema>;

/**
 * Host-only, solution-free catalog used to author explicit quiz-task scopes.
 * Local source IDs and answer/correctness material are intentionally excluded.
 */
export const SessionLearningObjectiveAvailableQuizTaskSchema = z
  .object({
    kind: z.literal('quiz-question'),
    questionId: z.uuid(),
    text: z.string().trim().min(1).max(QUIZ_QUESTION_TEXT_MAX_LENGTH),
    order: z.number().int().min(0),
  })
  .strict();
export type SessionLearningObjectiveAvailableQuizTask = z.infer<
  typeof SessionLearningObjectiveAvailableQuizTaskSchema
>;

/** Host-only, solution-free Q&A task entry independent of forum UI pagination/filtering. */
export const SessionLearningObjectiveAvailableQaTaskSchema = z
  .object({
    kind: z.literal('qa-question'),
    questionId: z.uuid(),
    text: z
      .string()
      .trim()
      .min(1)
      .refine((value) => qaTextCodePointLength(value) <= QA_QUESTION_TEXT_MAX_CODE_POINTS),
  })
  .strict();
export type SessionLearningObjectiveAvailableQaTask = z.infer<
  typeof SessionLearningObjectiveAvailableQaTaskSchema
>;

export const SessionLearningObjectivesSnapshotSchema = z
  .object({
    schemaVersion: z.literal(SESSION_LEARNING_OBJECTIVE_SCHEMA_VERSION),
    sessionId: z.uuid(),
    learningContextRevision: LearningObjectiveRevisionSchema,
    configured: z.boolean(),
    access: SessionLearningObjectivesAccessSchema,
    availableQuizTasks: z
      .array(SessionLearningObjectiveAvailableQuizTaskSchema)
      .max(QUIZ_UPLOAD_MAX_QUESTIONS),
    availableQaTasks: z
      .array(SessionLearningObjectiveAvailableQaTaskSchema)
      .max(SESSION_LEARNING_OBJECTIVE_QA_TASK_CATALOG_MAX),
    availableQaTasksTruncated: z.boolean(),
    objectives: z.array(SessionLearningObjectiveDTOSchema).max(LEARNING_OBJECTIVE_MAX_OBJECTIVES),
  })
  .strict()
  .superRefine((value, ctx) => {
    addUniqueStringIssues(
      value.objectives.map((objective) => objective.id),
      ctx,
      ['objectives'],
      'Lernziel-IDs müssen innerhalb einer Session eindeutig sein.',
    );
    addUniqueStringIssues(
      value.availableQuizTasks.map((task) => task.questionId),
      ctx,
      ['availableQuizTasks'],
      'Verfügbare Quizaufgaben müssen innerhalb einer Session eindeutig sein.',
    );
    addUniqueStringIssues(
      value.availableQaTasks.map((task) => task.questionId),
      ctx,
      ['availableQaTasks'],
      'Verfügbare Q&A-Aufgaben müssen innerhalb einer Session eindeutig sein.',
    );
    if (!value.configured && value.objectives.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['configured'],
        message: 'Ein nicht konfigurierter Lernkontext darf keine Ziele enthalten.',
      });
    }
  });
export type SessionLearningObjectivesSnapshot = z.infer<
  typeof SessionLearningObjectivesSnapshotSchema
>;

export const GetSessionLearningObjectivesOutputSchema = SessionLearningObjectivesSnapshotSchema;
export type GetSessionLearningObjectivesOutput = z.infer<
  typeof GetSessionLearningObjectivesOutputSchema
>;

export const GetSessionLearningObjectivesInputSchema = z
  .object({ code: z.string().length(6) })
  .strict();
export type GetSessionLearningObjectivesInput = z.infer<
  typeof GetSessionLearningObjectivesInputSchema
>;

const SessionLearningObjectiveUpsertSchema = z
  .object({
    action: z.literal('upsert'),
    /** Client-generated UUID; `expectedRevision: null` is create-only. */
    objectiveId: LearningObjectiveIdSchema,
    expectedRevision: LearningObjectiveRevisionSchema.nullable(),
    text: LearningObjectiveTextSchema,
    scope: SessionLearningObjectiveWriteScopeSchema,
    confirmationState: z.enum(['draft', 'confirmed']),
  })
  .strict();

const SessionLearningObjectiveDeleteSchema = z
  .object({
    action: z.literal('delete'),
    objectiveId: LearningObjectiveIdSchema,
    expectedRevision: LearningObjectiveRevisionSchema,
  })
  .strict();

export const SessionLearningObjectiveMutationSchema = z.discriminatedUnion('action', [
  SessionLearningObjectiveUpsertSchema,
  SessionLearningObjectiveDeleteSchema,
]);
export type SessionLearningObjectiveMutation = z.infer<
  typeof SessionLearningObjectiveMutationSchema
>;

/**
 * One atomic host write. The global CAS protects the set/projection, while each
 * mutation protects the addressed row against a newer host edit.
 */
export const SaveSessionLearningObjectivesInputSchema = z
  .object({
    code: z.string().length(6),
    expectedLearningContextRevision: LearningObjectiveRevisionSchema,
    mutations: z
      .array(SessionLearningObjectiveMutationSchema)
      .min(1)
      .max(LEARNING_OBJECTIVE_MAX_OBJECTIVES),
  })
  .strict()
  .superRefine((value, ctx) => {
    addUniqueStringIssues(
      value.mutations.map((mutation) => mutation.objectiveId),
      ctx,
      ['mutations'],
      'Ein Lernziel darf pro Schreibvorgang nur einmal geändert werden.',
    );
  });
export type SaveSessionLearningObjectivesInput = z.infer<
  typeof SaveSessionLearningObjectivesInputSchema
>;

/** Save returns the new authoritative snapshot, avoiding a race-prone follow-up read. */
export const SaveSessionLearningObjectivesOutputSchema = SessionLearningObjectivesSnapshotSchema;
export type SaveSessionLearningObjectivesOutput = z.infer<
  typeof SaveSessionLearningObjectivesOutputSchema
>;
