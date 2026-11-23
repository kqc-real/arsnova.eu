import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import {
  MODERATION_ANALYSIS_CONTEXT_CONTRACT_VERSION,
  MODERATION_ANALYSIS_SOURCE_LIMIT,
  MODERATION_DOMAIN_CONTEXT_CONTRACT_VERSION,
  MODERATION_PROMPT_CONTEXT_SCHEMA_VERSION,
  MODERATION_PROMPT_DEFINITION_SET_VERSION,
  QA_RANKING_VERSION,
  AppLocaleEnum,
  ModerationAnalysisContextV1Schema,
  ModerationPromptLimitationSchema,
  ModerationPromptSourceSchema,
  type AppLocale,
  type ModerationAnalysisContextV1,
  type ModerationAnalysisDomainContextV1,
  type ModerationPromptSource,
  type SessionLearningObjectiveDTO,
  type SessionLearningObjectivesSnapshot,
} from '@arsnova/shared-types';
import { prisma } from '../db';
import type { HostTokenContext } from './hostAuth';
import {
  assertModerationStateStillCurrent,
  buildAuthorizedModerationQaContext,
  loadAuthorizedModerationState,
  type AuthorizedModerationQaContext,
  type AuthorizedModerationState,
} from './moderationQaContext';
import { buildAuthorizedModerationTeachingSignals } from './moderationTeachingSignals';
import { getSessionLearningObjectivesSnapshotWithDb } from './sessionLearningObjectives';
import { parseSessionQuestionProgress } from './sessionQuestionProgress';
import type { WordCloudAnalysisCache } from './wordCloudAnalysisCache';

export const MODERATION_ANALYSIS_VERSION = 'moderation-analysis-builder-v1' as const;
export const MODERATION_ANALYSIS_SELECTION_VERSION = 'moderation-analysis-candidates-v1' as const;
export const MODERATION_SOURCE_REVISION_VERSION = 'moderation-source-revision-v1' as const;

const QUESTION_SOURCE_TEXT_LIMIT = 500;
const LEARNING_CONTEXT_QA_REFERENCE_LIMIT = 200;
const NON_SEMANTIC_SOURCE_TIMESTAMP_KEYS = new Set(['analyzedAt', 'classifiedAt', 'confirmedAt']);

type ModerationLimitation = ModerationAnalysisDomainContextV1['limitations'][number];
type ModerationLearningContext = ModerationAnalysisDomainContextV1['learningContext'];
type ModerationLearningObjective = Extract<
  ModerationLearningContext,
  { state: 'available' }
>['objectives'][number];
type ModerationLearningScope = ModerationLearningObjective['scope'];
type ModerationLearningOrigin = ModerationLearningObjective['origin'];
type ModerationLearningConfirmation = ModerationLearningObjective['confirmation'];
type ModerationSourceRevision =
  ModerationAnalysisDomainContextV1['meta']['revisions']['learningObjectives'];
type SessionLearningScopeTaskReference = Extract<
  SessionLearningObjectiveDTO['scope'],
  { kind: 'question-set' }
>['taskReferences'][number];
type SessionLearningOriginReference = Extract<
  SessionLearningObjectiveDTO['origin'],
  { kind: 'model-derived' }
>['derivedFrom'][number];
type SessionLearningTaskReference =
  SessionLearningScopeTaskReference | SessionLearningOriginReference;

type LearningContextProjection = {
  readonly learningContext: ModerationLearningContext;
  readonly sources: readonly ModerationPromptSource[];
  readonly limitations: readonly ModerationLimitation[];
  readonly revision: ModerationSourceRevision;
};

type AuthorizedLearningQaTask = Readonly<{ id: string }>;

type ReferencedLearningQaSelection = Readonly<{
  questionIds: readonly string[];
  omittedObjectiveIds: readonly string[];
}>;

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, nested) => {
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return Object.fromEntries(
        Object.entries(nested as Record<string, unknown>).sort(([left], [right]) =>
          compareCodeUnits(left, right),
        ),
      );
    }
    return nested;
  });
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function timestampNeutralSourceMaterial(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(timestampNeutralSourceMaterial);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !NON_SEMANTIC_SOURCE_TIMESTAMP_KEYS.has(key))
      .map(([key, item]) => [key, timestampNeutralSourceMaterial(item)]),
  );
}

function truncateSchemaString(
  text: string,
  maxLength: number,
): { readonly text: string; readonly truncated: boolean } {
  const normalized = text.trim();
  let bounded = '';
  for (const codePoint of normalized) {
    if (bounded.length + codePoint.length > maxLength) break;
    bounded += codePoint;
  }
  return { text: bounded, truncated: bounded.length < normalized.length };
}

function failDuplicateSource(sourceId: string): never {
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: `Duplicate moderation source identifier: ${sourceId}`,
  });
}

function registerUniqueSources(
  sources: readonly ModerationPromptSource[],
): Map<string, ModerationPromptSource> {
  const sourceById = new Map<string, ModerationPromptSource>();
  for (const candidate of sources) {
    const source = ModerationPromptSourceSchema.parse(candidate);
    if (sourceById.has(source.id)) failDuplicateSource(source.id);
    sourceById.set(source.id, source);
  }
  return sourceById;
}

function assertReusableSource(
  existing: ModerationPromptSource,
  expected: ModerationPromptSource,
): void {
  if (canonicalJson(existing) !== canonicalJson(expected)) {
    failDuplicateSource(expected.id);
  }
}

function objectiveRevision(revision: number): string {
  return `learning-objective-revision-v1:${revision}`;
}

function projectConfirmation(
  confirmation: SessionLearningObjectiveDTO['confirmation'],
): ModerationLearningConfirmation {
  if (confirmation.state === 'draft') return { state: 'draft' };
  if (confirmation.state === 'confirmed') {
    return {
      state: 'confirmed',
      confirmedAt: confirmation.confirmedAt,
      revision: objectiveRevision(confirmation.confirmedRevision),
    };
  }
  const previousConfirmation =
    confirmation.previousConfirmation.state === 'confirmed'
      ? {
          state: 'confirmed' as const,
          revision: objectiveRevision(confirmation.previousConfirmation.revision),
          confirmedAt: confirmation.previousConfirmation.confirmedAt,
        }
      : {
          state: 'draft' as const,
          revision: objectiveRevision(confirmation.previousConfirmation.revision),
        };
  return {
    state: 'needs-review',
    previousConfirmation,
    currentRevision: objectiveRevision(confirmation.currentRevision),
    reason: confirmation.reason,
  };
}

function qaQuestionSourceId(questionId: string): string {
  return `qa-question:${questionId}`;
}

function quizQuestionSourceId(questionId: string): string {
  return `quiz-question:${questionId}`;
}

function quizScopeId(quizId: string): string {
  return `quiz-scope:${quizId}`;
}

function learningObjectiveSourceId(objectiveId: string): string {
  return `learning-objective:${objectiveId}`;
}

function sourceRedactionLimitation(omittedObjectives: number): ModerationLimitation {
  return ModerationPromptLimitationSchema.parse({
    code: 'source-redacted',
    section: 'learning-context',
    detail: `${omittedObjectives} learning objective(s) with unresolved, removed, archived, unclassified, or otherwise inadmissible task references were omitted.`,
  });
}

function qaReferenceBudgetLimitation(omittedObjectives: number): ModerationLimitation {
  return ModerationPromptLimitationSchema.parse({
    code: 'budget-truncated',
    section: 'learning-context',
    detail: `${omittedObjectives} learning objective(s) were omitted because their complete Q&A reference bundles exceeded the ${LEARNING_CONTEXT_QA_REFERENCE_LIMIT}-reference analysis limit.`,
  });
}

function learningObjectiveConfirmationRank(objective: SessionLearningObjectiveDTO): number {
  return objective.confirmation.state === 'confirmed'
    ? 0
    : objective.confirmation.state === 'needs-review'
      ? 1
      : 2;
}

function compareLearningObjectivePriority(
  left: SessionLearningObjectiveDTO,
  right: SessionLearningObjectiveDTO,
): number {
  return (
    learningObjectiveConfirmationRank(left) - learningObjectiveConfirmationRank(right) ||
    compareCodeUnits(left.id, right.id)
  );
}

function projectLearningContext(input: {
  readonly snapshot: SessionLearningObjectivesSnapshot;
  readonly state: AuthorizedModerationState;
  readonly sourceById: Map<string, ModerationPromptSource>;
  readonly authorizedQaTasks: readonly AuthorizedLearningQaTask[];
  readonly qaReferenceBudgetOmittedObjectiveIds: readonly string[];
}): LearningContextProjection {
  if (!input.snapshot.configured) {
    return {
      learningContext: { state: 'unavailable', reason: 'not-collected' },
      sources: [],
      limitations: [],
      revision: { state: 'unavailable', reason: 'not-collected' },
    };
  }

  const quizTasksById = new Map(
    input.snapshot.availableQuizTasks.map((task) => [task.questionId, task] as const),
  );
  const qaTasksById = new Map(input.authorizedQaTasks.map((task) => [task.id, task] as const));
  const questionProgress = parseSessionQuestionProgress(input.state.questionProgress);
  const additionalSources = new Map<string, ModerationPromptSource>();
  const projectedObjectives: ModerationLearningObjective[] = [];
  const budgetOmittedObjectiveIds = new Set(input.qaReferenceBudgetOmittedObjectiveIds);
  let redactedObjectives = 0;
  let budgetOmittedObjectives = 0;
  let unreleasedObjectives = 0;

  const lookupSource = (sourceId: string): ModerationPromptSource | undefined =>
    additionalSources.get(sourceId) ?? input.sourceById.get(sourceId);

  const stageQuizSource = (
    questionId: string,
    stagedSources: Map<string, ModerationPromptSource>,
  ): string | null => {
    if (!input.state.quizId) return null;
    const task = quizTasksById.get(questionId);
    if (!task) return null;
    const boundedText = truncateSchemaString(task.text, QUESTION_SOURCE_TEXT_LIMIT);
    if (boundedText.text.length === 0) return null;
    const expected = ModerationPromptSourceSchema.parse({
      id: quizQuestionSourceId(questionId),
      kind: 'quiz-question',
      quizScopeId: quizScopeId(input.state.quizId),
      text: boundedText.text,
      truncated: boundedText.truncated,
    });
    const existing = stagedSources.get(expected.id) ?? lookupSource(expected.id);
    if (existing) {
      assertReusableSource(existing, expected);
    } else {
      stagedSources.set(expected.id, expected);
    }
    return expected.id;
  };

  const stageQaSource = (
    questionId: string,
    stagedSources: Map<string, ModerationPromptSource>,
  ): string | null => {
    if (!qaTasksById.has(questionId)) return null;
    const sourceId = qaQuestionSourceId(questionId);
    const existing = stagedSources.get(sourceId) ?? lookupSource(sourceId);
    if (existing) return existing.kind === 'qa-question' ? sourceId : null;
    const expected = ModerationPromptSourceSchema.parse({
      id: sourceId,
      kind: 'qa-question',
      content: { state: 'reference-only', reason: 'not-selected' },
    });
    stagedSources.set(expected.id, expected);
    return expected.id;
  };

  const resolveTaskReference = (
    reference: SessionLearningTaskReference,
    stagedSources: Map<string, ModerationPromptSource>,
    quizOnly: boolean,
  ): string | null => {
    if (reference.kind === 'unresolved-task') return null;
    if (reference.kind === 'qa-question') {
      if (quizOnly) return null;
      return stageQaSource(reference.questionId, stagedSources);
    }
    return stageQuizSource(reference.questionId, stagedSources);
  };

  const orderedObjectives = [...input.snapshot.objectives]
    .filter((objective) => objective.purpose !== 'forum-assignment')
    .sort((left, right) => compareCodeUnits(left.id, right.id));
  for (const objective of orderedObjectives) {
    if (budgetOmittedObjectiveIds.has(objective.id)) {
      budgetOmittedObjectives += 1;
      continue;
    }
    const stagedSources = new Map<string, ModerationPromptSource>();
    let scope: ModerationLearningScope | null = null;
    if (objective.scope.kind === 'session') {
      scope = { kind: 'session' };
    } else if (objective.scope.kind === 'quiz-wide') {
      scope = input.state.quizId
        ? { kind: 'quiz', quizScopeId: quizScopeId(input.state.quizId) }
        : null;
    } else {
      const taskSourceIds = objective.scope.taskReferences.map((reference) =>
        resolveTaskReference(reference, stagedSources, objective.origin.kind === 'model-derived'),
      );
      scope = taskSourceIds.every((sourceId): sourceId is string => sourceId !== null)
        ? { kind: 'tasks', taskSourceIds: [...taskSourceIds].sort(compareCodeUnits) }
        : null;
    }

    const origin: ModerationLearningOrigin | null =
      objective.origin.kind === 'manual'
        ? { kind: 'manual' }
        : (() => {
            const derivedFromSourceIds = objective.origin.derivedFrom.map((reference) =>
              resolveTaskReference(reference, stagedSources, true),
            );
            return derivedFromSourceIds.every((sourceId): sourceId is string => sourceId !== null)
              ? {
                  kind: 'model-derived',
                  modelId: objective.origin.modelId,
                  modelVersion: objective.origin.modelVersion,
                  derivationVersion: objective.origin.derivationVersion,
                  derivedFromSourceIds: [...derivedFromSourceIds].sort(compareCodeUnits),
                }
              : null;
          })();

    if (
      !scope ||
      !origin ||
      (origin.kind === 'model-derived' && scope.kind === 'session') ||
      (origin.kind === 'model-derived' &&
        scope.kind === 'tasks' &&
        origin.derivedFromSourceIds.some((sourceId) => !scope.taskSourceIds.includes(sourceId)))
    ) {
      redactedObjectives += 1;
      continue;
    }

    // The preparation model sees correct answers. A derived objective can
    // repeat one in prose, so its text needs the same release boundary.
    if (
      objective.origin.kind === 'model-derived' &&
      (objective.origin.derivedFrom.some(
        (reference) =>
          reference.kind !== 'quiz-question' ||
          questionProgress[reference.questionId]?.state !== 'COMPLETED',
      ) ||
        (objective.scope.kind === 'question-set' &&
          objective.scope.taskReferences.some(
            (reference) =>
              reference.kind === 'quiz-question' &&
              questionProgress[reference.questionId]?.state !== 'COMPLETED',
          )))
    ) {
      unreleasedObjectives += 1;
      continue;
    }

    const objectiveSource = ModerationPromptSourceSchema.parse({
      id: learningObjectiveSourceId(objective.id),
      kind: 'learning-objective',
      text: objective.text,
    });
    if (lookupSource(objectiveSource.id) || stagedSources.has(objectiveSource.id)) {
      failDuplicateSource(objectiveSource.id);
    }
    stagedSources.set(objectiveSource.id, objectiveSource);
    for (const [sourceId, source] of stagedSources) {
      const existing = lookupSource(sourceId);
      if (existing) assertReusableSource(existing, source);
      else additionalSources.set(sourceId, source);
    }
    projectedObjectives.push({
      sourceId: objectiveSource.id,
      scope,
      origin,
      confirmation: projectConfirmation(objective.confirmation),
    });
  }

  return {
    learningContext: {
      state: 'available',
      objectives: projectedObjectives.sort((left, right) =>
        compareCodeUnits(left.sourceId, right.sourceId),
      ),
    },
    sources: [...additionalSources.values()].sort((left, right) =>
      compareCodeUnits(left.id, right.id),
    ),
    limitations: [
      ...(redactedObjectives > 0 ? [sourceRedactionLimitation(redactedObjectives)] : []),
      ...(budgetOmittedObjectives > 0
        ? [qaReferenceBudgetLimitation(budgetOmittedObjectives)]
        : []),
      ...(unreleasedObjectives > 0
        ? [
            ModerationPromptLimitationSchema.parse({
              code: 'not-released',
              section: 'learning-context',
              detail: `${unreleasedObjectives} model-derived learning objective(s) withheld until their quiz questions are released.`,
            }),
          ]
        : []),
    ],
    revision: {
      state: 'available',
      value: `learning-context-v1:${input.snapshot.learningContextRevision}`,
    },
  };
}

function selectReferencedQaQuestions(
  snapshot: SessionLearningObjectivesSnapshot,
): ReferencedLearningQaSelection {
  const ids = new Set<string>();
  const omittedObjectiveIds: string[] = [];
  for (const objective of [...snapshot.objectives]
    .filter((candidate) => candidate.purpose !== 'forum-assignment')
    .sort(compareLearningObjectivePriority)) {
    if (objective.scope.kind !== 'question-set') continue;
    const objectiveIds = objective.scope.taskReferences
      .flatMap((reference) => (reference.kind === 'qa-question' ? [reference.questionId] : []))
      .sort(compareCodeUnits);
    const nextIds = objectiveIds.filter((questionId) => !ids.has(questionId));
    if (ids.size + nextIds.length > LEARNING_CONTEXT_QA_REFERENCE_LIMIT) {
      omittedObjectiveIds.push(objective.id);
      continue;
    }
    objectiveIds.forEach((questionId) => ids.add(questionId));
  }
  return {
    questionIds: [...ids].sort(compareCodeUnits),
    omittedObjectiveIds: omittedObjectiveIds.sort(compareCodeUnits),
  };
}

function assertLearningSnapshotStillCurrent(
  snapshot: SessionLearningObjectivesSnapshot,
  state: AuthorizedModerationState,
): void {
  if (
    snapshot.sessionId !== state.id ||
    snapshot.learningContextRevision !== state.learningContextRevision ||
    snapshot.configured !== state.learningContextConfigured
  ) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'The learning context changed while the moderation context was built.',
    });
  }
}

function mergeLimitations(
  ...groups: readonly (readonly ModerationLimitation[])[]
): ModerationLimitation[] {
  const byCanonicalValue = new Map<string, ModerationLimitation>();
  for (const limitation of groups.flat()) {
    const parsed = ModerationPromptLimitationSchema.parse(limitation);
    byCanonicalValue.set(canonicalJson(parsed), parsed);
  }
  return [...byCanonicalValue.values()].sort(
    (left, right) =>
      compareCodeUnits(left.section, right.section) ||
      compareCodeUnits(left.code, right.code) ||
      compareCodeUnits(left.detail, right.detail),
  );
}

function channelsForState(
  state: AuthorizedModerationState,
): Array<'qa' | 'quickFeedback' | 'quiz'> {
  const channels = new Set<'qa' | 'quickFeedback' | 'quiz'>();
  if (state.type === 'QUIZ' || state.quizId) channels.add('quiz');
  if (state.type === 'Q_AND_A' || state.qaEnabled) channels.add('qa');
  if (state.quickFeedbackEnabled) channels.add('quickFeedback');
  return [...channels].sort(compareCodeUnits);
}

function buildScope(
  state: AuthorizedModerationState,
  questions: AuthorizedModerationQaContext['questions'],
): ModerationAnalysisDomainContextV1['scope'] {
  const hasQaQuestions = questions.state === 'available';
  return {
    channels: channelsForState(state),
    sessionPhase: state.status,
    questionFilter: hasQaQuestions
      ? {
          state: 'available',
          statuses: ['PENDING', 'ACTIVE', 'PINNED'],
          timeWindow: { kind: 'entire-session' },
        }
      : {
          state: 'not-applicable',
          reason: 'The authorized Q&A candidate section is not available.',
        },
    activeWeighting: hasQaQuestions
      ? { kind: 'qa-ranking', version: QA_RANKING_VERSION, sortMode: state.activeSortMode }
      : { kind: 'none', reason: 'No authorized Q&A candidate ranking is available.' },
    selectionLimits: {
      questions: 200,
      topics: 30,
      compassSignals: 30,
      learningObjectives: 100,
      resultAggregates: 100,
      feedbackAggregates: 100,
    },
  };
}

function sourceRevisionFor(
  context: Omit<ModerationAnalysisDomainContextV1, 'meta'> & {
    readonly meta: Omit<ModerationAnalysisDomainContextV1['meta'], 'sourceRevision'>;
  },
): string {
  return `${MODERATION_SOURCE_REVISION_VERSION}:${sha256(
    canonicalJson({
      version: MODERATION_SOURCE_REVISION_VERSION,
      context: timestampNeutralSourceMaterial(context),
    }),
  )}`;
}

/**
 * N10 host-only orchestration. It creates the complete, solution-free analysis
 * candidate graph; token packing and model invocation remain separate stages.
 */
export async function buildModerationPromptContext(input: {
  readonly sessionId: string;
  readonly locale: AppLocale;
  readonly access: HostTokenContext;
  readonly clock?: { readonly now: () => Date };
  readonly cache?: WordCloudAnalysisCache;
}): Promise<ModerationAnalysisContextV1> {
  const locale = AppLocaleEnum.parse(input.locale);
  const stateInput = {
    sessionId: input.sessionId,
    access: input.access,
    clock: input.clock,
  };
  const initial = await loadAuthorizedModerationState(stateInput);
  const qa = await buildAuthorizedModerationQaContext({ ...stateInput, cache: input.cache });
  assertModerationStateStillCurrent(initial, qa.state);

  const teaching = await buildAuthorizedModerationTeachingSignals({
    ...stateInput,
    qaContext: qa,
  });
  assertModerationStateStillCurrent(initial, teaching.state);

  const beforeLearning = await loadAuthorizedModerationState(stateInput);
  assertModerationStateStillCurrent(initial, beforeLearning);
  const learningRead = await prisma.$transaction(
    async (tx) => {
      const snapshot = await getSessionLearningObjectivesSnapshotWithDb(
        tx,
        input.sessionId,
        beforeLearning.authorizedAt,
      );
      const qaReferenceSelection = selectReferencedQaQuestions(snapshot);
      const authorizedQaTasks =
        qaReferenceSelection.questionIds.length === 0
          ? []
          : await tx.qaQuestion.findMany({
              where: {
                sessionId: input.sessionId,
                id: { in: [...qaReferenceSelection.questionIds] },
                status: { in: ['PENDING', 'ACTIVE', 'PINNED'] },
              },
              select: { id: true },
              orderBy: { id: 'asc' },
            });
      return { snapshot, authorizedQaTasks, qaReferenceSelection };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
  const learningSnapshot = learningRead.snapshot;

  const final = await loadAuthorizedModerationState(stateInput);
  assertModerationStateStillCurrent(initial, final);
  assertLearningSnapshotStillCurrent(learningSnapshot, beforeLearning);
  assertLearningSnapshotStillCurrent(learningSnapshot, final);

  const sourceById = registerUniqueSources([...qa.sources, ...teaching.sources]);
  const learning = projectLearningContext({
    snapshot: learningSnapshot,
    state: final,
    sourceById,
    authorizedQaTasks: learningRead.authorizedQaTasks,
    qaReferenceBudgetOmittedObjectiveIds: learningRead.qaReferenceSelection.omittedObjectiveIds,
  });
  for (const source of learning.sources) {
    if (sourceById.has(source.id)) failDuplicateSource(source.id);
    sourceById.set(source.id, source);
  }
  const limitations = mergeLimitations(qa.limitations, teaching.limitations, learning.limitations);
  const sources = [...sourceById.values()].sort((left, right) =>
    compareCodeUnits(left.id, right.id),
  );
  if (sources.length > MODERATION_ANALYSIS_SOURCE_LIMIT) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'The authorized moderation source graph exceeds its analysis contract bound.',
    });
  }
  const revisions = {
    ...qa.revisions,
    learningObjectives: learning.revision,
    releasedResults: teaching.revisions.releasedResults,
    feedback: teaching.revisions.feedback,
  };
  const contextWithoutSourceRevision = {
    contractVersion: MODERATION_DOMAIN_CONTEXT_CONTRACT_VERSION,
    representation: 'analysis-candidates',
    definitionsVersion: MODERATION_PROMPT_DEFINITION_SET_VERSION,
    locale,
    meta: {
      analysisVersion: MODERATION_ANALYSIS_VERSION,
      selectionVersion: MODERATION_ANALYSIS_SELECTION_VERSION,
      revisions,
    },
    scope: buildScope(final, qa.questions),
    questions: qa.questions,
    topics: qa.topics,
    compass: teaching.compass,
    learningContext: learning.learningContext,
    releasedResults: teaching.releasedResults,
    feedback: teaching.feedback,
    sources,
    limitations,
  } as const;
  const context = {
    ...contextWithoutSourceRevision,
    meta: {
      sourceRevision: sourceRevisionFor(contextWithoutSourceRevision),
      ...contextWithoutSourceRevision.meta,
    },
  };
  return ModerationAnalysisContextV1Schema.parse({
    schemaVersion: MODERATION_PROMPT_CONTEXT_SCHEMA_VERSION,
    contractVersion: MODERATION_ANALYSIS_CONTEXT_CONTRACT_VERSION,
    assembledAt: final.authorizedAt.toISOString(),
    context,
  });
}

export const moderationPromptContextInternals = {
  compareCodeUnits,
  compareLearningObjectivePriority,
  projectLearningContext,
  selectReferencedQaQuestions,
  registerUniqueSources,
  sourceRevisionFor,
};
