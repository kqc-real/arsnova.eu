import { z } from 'zod';
import {
  LEARNING_OBJECTIVE_MAX_OBJECTIVES,
  LEARNING_OBJECTIVE_MAX_REFERENCES,
  LEARNING_OBJECTIVE_MODEL_METADATA_MAX_LENGTH,
  LEARNING_OBJECTIVE_TEXT_MAX_LENGTH,
  LearningObjectiveRevisionSchema,
  LearningObjectiveSourceDigestSchema,
  QuizSourceQuestionIdSchema,
} from './learning-objectives';
import { QaSummaryLocaleEnum, QuizUploadQuestionInputSchema } from './schemas';
import { QUIZ_UPLOAD_MAX_QUESTIONS } from './quiz-contract-limits';

/** Versioned public application contract for explicit quiz-objective derivation. */
export const LEARNING_OBJECTIVE_DERIVATION_SCHEMA_VERSION = 1 as const;
/** Version written into every model-derived objective for later invalidation/migration. */
export const LEARNING_OBJECTIVE_DERIVATION_VERSION = 'learning-objectives-v1' as const;

const DerivationSchemaVersionField = z.literal(LEARNING_OBJECTIVE_DERIVATION_SCHEMA_VERSION);

/**
 * Reuses the complete quiz-upload question contract so every solution-bearing
 * question kind crosses the boundary without an application-local shadow DTO.
 */
export const LearningObjectiveDerivationQuestionSchema = QuizUploadQuestionInputSchema.safeExtend({
  sourceQuestionId: QuizSourceQuestionIdSchema,
  enabled: z.boolean(),
}).strict();
export type LearningObjectiveDerivationQuestion = z.input<
  typeof LearningObjectiveDerivationQuestionSchema
>;

export const LearningObjectiveDerivationCorrelationSchema = z
  .object({
    schemaVersion: DerivationSchemaVersionField,
    operationId: z.uuid(),
    quizId: z.uuid(),
    expectedBundleRevision: LearningObjectiveRevisionSchema,
  })
  .strict();
export type LearningObjectiveDerivationCorrelation = z.infer<
  typeof LearningObjectiveDerivationCorrelationSchema
>;

export const LearningObjectiveDerivationInputSchema =
  LearningObjectiveDerivationCorrelationSchema.extend({
    locale: QaSummaryLocaleEnum,
    maximumDrafts: z.number().int().min(1).max(LEARNING_OBJECTIVE_MAX_OBJECTIVES),
    questions: z
      .array(LearningObjectiveDerivationQuestionSchema)
      .min(1)
      .max(QUIZ_UPLOAD_MAX_QUESTIONS),
  })
    .strict()
    .superRefine((value, ctx) => {
      const seen = new Set<string>();
      value.questions.forEach((question, index) => {
        if (seen.has(question.sourceQuestionId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['questions', index, 'sourceQuestionId'],
            message: 'Quellfragen-IDs eines Ableitungsauftrags müssen eindeutig sein.',
          });
        }
        seen.add(question.sourceQuestionId);
      });
    });
export type LearningObjectiveDerivationInput = z.input<
  typeof LearningObjectiveDerivationInputSchema
>;

const DerivedQuestionSetScopeSchema = z
  .object({
    kind: z.literal('question-set'),
    sourceQuestionIds: z
      .array(QuizSourceQuestionIdSchema)
      .min(1)
      .max(LEARNING_OBJECTIVE_MAX_REFERENCES),
  })
  .strict();

const DerivedModelOriginSchema = z
  .object({
    kind: z.literal('model-derived'),
    modelId: z.string().trim().min(1).max(LEARNING_OBJECTIVE_MODEL_METADATA_MAX_LENGTH),
    modelVersion: z.string().trim().min(1).max(LEARNING_OBJECTIVE_MODEL_METADATA_MAX_LENGTH),
    derivationVersion: z.literal(LEARNING_OBJECTIVE_DERIVATION_VERSION),
    derivedFromSourceQuestionIds: z
      .array(QuizSourceQuestionIdSchema)
      .min(1)
      .max(LEARNING_OBJECTIVE_MAX_REFERENCES),
    sourceDigest: LearningObjectiveSourceDigestSchema,
  })
  .strict();

/** Directly persistable draft; it deliberately cannot claim confirmation. */
export const LearningObjectiveDerivedDraftSchema = z
  .object({
    id: z.uuid(),
    revision: z.literal(0),
    text: z.string().trim().min(1).max(LEARNING_OBJECTIVE_TEXT_MAX_LENGTH),
    scope: DerivedQuestionSetScopeSchema,
    origin: DerivedModelOriginSchema,
    confirmation: z.object({ state: z.literal('draft') }).strict(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
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

    const scopeIds = new Set<string>();
    value.scope.sourceQuestionIds.forEach((sourceQuestionId, index) => {
      if (scopeIds.has(sourceQuestionId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['scope', 'sourceQuestionIds', index],
          message: 'Aufgabenreferenzen eines abgeleiteten Lernziels müssen eindeutig sein.',
        });
      }
      scopeIds.add(sourceQuestionId);
    });

    const originIds = new Set<string>();
    value.origin.derivedFromSourceQuestionIds.forEach((sourceQuestionId, index) => {
      if (originIds.has(sourceQuestionId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['origin', 'derivedFromSourceQuestionIds', index],
          message: 'Herleitungsreferenzen eines abgeleiteten Lernziels müssen eindeutig sein.',
        });
      }
      originIds.add(sourceQuestionId);
      if (!scopeIds.has(sourceQuestionId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['origin', 'derivedFromSourceQuestionIds', index],
          message: 'Herleitungsfragen müssen im expliziten Aufgabenbereich liegen.',
        });
      }
    });
  });
export type LearningObjectiveDerivedDraft = z.infer<typeof LearningObjectiveDerivedDraftSchema>;

const LearningObjectiveDerivationCompletedResultSchema =
  LearningObjectiveDerivationCorrelationSchema.extend({
    status: z.literal('completed'),
    drafts: z.array(LearningObjectiveDerivedDraftSchema).max(LEARNING_OBJECTIVE_MAX_OBJECTIVES),
    limitations: z.array(z.string().trim().min(1).max(280)).max(6),
    batchCount: z.number().int().min(1).max(QUIZ_UPLOAD_MAX_QUESTIONS),
  }).strict();

const LearningObjectiveDerivationBusyResultSchema =
  LearningObjectiveDerivationCorrelationSchema.extend({
    status: z.literal('busy'),
    retry: z.literal('manual'),
  }).strict();

export const LearningObjectiveDerivationProgressSchema = z
  .object({
    completedGroups: z.number().int().min(0).max(QUIZ_UPLOAD_MAX_QUESTIONS),
    totalGroups: z.number().int().min(0).max(QUIZ_UPLOAD_MAX_QUESTIONS),
    elapsedMs: z.number().int().min(0),
    promptTokens: z.number().int().min(0),
    completionTokens: z.number().int().min(0),
    queuedObjectives: z.number().int().min(0).max(LEARNING_OBJECTIVE_MAX_OBJECTIVES),
  })
  .strict();
export type LearningObjectiveDerivationProgress = z.infer<
  typeof LearningObjectiveDerivationProgressSchema
>;

export const GetLearningObjectiveDerivationProgressInputSchema =
  LearningObjectiveDerivationCorrelationSchema;
export type GetLearningObjectiveDerivationProgressInput = z.infer<
  typeof GetLearningObjectiveDerivationProgressInputSchema
>;

export const GetLearningObjectiveDerivationProgressOutputSchema =
  LearningObjectiveDerivationCorrelationSchema.extend({
    found: z.boolean(),
    progress: LearningObjectiveDerivationProgressSchema.nullable(),
  }).strict();
export type GetLearningObjectiveDerivationProgressOutput = z.infer<
  typeof GetLearningObjectiveDerivationProgressOutputSchema
>;

const DERIVATION_SIMPLE_FAILURE_STATUSES = [
  'disabled',
  'unavailable',
  'invalid_response',
  'misconfigured',
  'circuit_open',
  'no_eligible_questions',
] as const;

const LearningObjectiveDerivationSimpleFailureResultSchema =
  LearningObjectiveDerivationCorrelationSchema.extend({
    status: z.enum(DERIVATION_SIMPLE_FAILURE_STATUSES),
  }).strict();

const LearningObjectiveDerivationInterruptedResultSchema =
  LearningObjectiveDerivationCorrelationSchema.extend({
    status: z.enum(['aborted', 'timeout']),
    progress: LearningObjectiveDerivationProgressSchema,
  }).strict();

const LearningObjectiveDerivationInputTooLargeResultSchema =
  LearningObjectiveDerivationCorrelationSchema.extend({
    status: z.literal('input_too_large'),
    sourceQuestionId: QuizSourceQuestionIdSchema,
  }).strict();

/** Every expected outcome is data, including overload and explicit single-item overflow. */
export const LearningObjectiveDerivationResultSchema = z.discriminatedUnion('status', [
  LearningObjectiveDerivationCompletedResultSchema,
  LearningObjectiveDerivationBusyResultSchema,
  LearningObjectiveDerivationInterruptedResultSchema,
  LearningObjectiveDerivationSimpleFailureResultSchema,
  LearningObjectiveDerivationInputTooLargeResultSchema,
]);
export type LearningObjectiveDerivationResult = z.infer<
  typeof LearningObjectiveDerivationResultSchema
>;
