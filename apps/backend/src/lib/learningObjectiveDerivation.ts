import { createHash } from 'node:crypto';
import {
  hasOnlyAllowedOpenWeightLlmReferences,
  isNumericEstimateToleranceMode,
  isNumericToleranceMode,
  LEARNING_OBJECTIVE_DERIVATION_SCHEMA_VERSION,
  LEARNING_OBJECTIVE_DERIVATION_VERSION,
  LEARNING_OBJECTIVE_MAX_OBJECTIVES,
  LearningObjectiveDerivationInputSchema,
  LearningObjectiveDerivationProgressSchema,
  LearningObjectiveDerivationResultSchema,
  normalizeLearningObjectiveText,
  OpenWeightLlmLearningObjectivesOutputSchema,
  OpenWeightLlmLearningObjectivesRequestSchema,
  OPEN_WEIGHT_LLM_SCHEMA_VERSION,
  resolveNumericEstimateToleranceMode,
  resolveNumericQuestionEvaluationSettings,
  resolveShortAnswerEvaluationSettings,
  resolveShortTextEvaluationKind,
  resolveShortTextMaxLength,
  type LearningObjectiveDerivationInput,
  type LearningObjectiveDerivationProgress,
  type LearningObjectiveDerivationQuestion,
  type LearningObjectiveDerivationResult,
  type OpenWeightLlmLearningObjectivesRequest,
} from '@arsnova/shared-types';
import {
  inspectOpenWeightLlmAvailability,
  OPEN_WEIGHT_LLM_AVAILABILITY_PREFLIGHT_MS,
  runOpenWeightLlmLearningObjectives,
  type OpenWeightLlmAvailabilityStatus,
  type OpenWeightLlmTelemetry,
} from './openWeightLlmClient';
import { OPEN_WEIGHT_LLM_MODEL_ID, OPEN_WEIGHT_LLM_MODEL_VERSION } from './openWeightLlmConfig';
import { logger } from './logger';

/** One explicit host action has one wall-clock budget across every deterministic batch. */
export const LEARNING_OBJECTIVE_DERIVATION_OVERALL_TIMEOUT_MS = 20 * 60_000;

const DERIVATION_LIMITATIONS = {
  de: {
    capped: 'Weitere Vorschläge wurden wegen der Lernziel-Obergrenze nicht übernommen.',
    empty: 'Das Modell hat keine belegten Lernzielvorschläge geliefert.',
  },
  en: {
    capped: 'Additional suggestions were omitted because of the learning-objective limit.',
    empty: 'The model returned no supported learning-objective suggestions.',
  },
  fr: {
    capped:
      'D’autres suggestions ont été omises en raison de la limite des objectifs pédagogiques.',
    empty: 'Le modèle n’a fourni aucune suggestion d’objectif pédagogique étayée.',
  },
  es: {
    capped: 'Se omitieron más sugerencias debido al límite de objetivos de aprendizaje.',
    empty: 'El modelo no devolvió sugerencias de objetivos de aprendizaje fundamentadas.',
  },
  it: {
    capped: 'Altri suggerimenti sono stati omessi a causa del limite degli obiettivi didattici.',
    empty: 'Il modello non ha restituito suggerimenti di obiettivi didattici comprovati.',
  },
} as const;

type LearningObjectiveRuntimeResult = Awaited<
  ReturnType<typeof runOpenWeightLlmLearningObjectives>
>;

type DerivationHooks = {
  readonly run?: (
    request: OpenWeightLlmLearningObjectivesRequest,
    options: { readonly signal?: AbortSignal },
  ) => Promise<LearningObjectiveRuntimeResult>;
  readonly now?: () => Date;
  readonly modelId?: string;
  /** Overrides runtime telemetry in deterministic tests or controlled deployments. */
  readonly modelVersion?: string;
  readonly signal?: AbortSignal;
  readonly overallTimeoutMs?: number;
  readonly onProgress?: (progress: LearningObjectiveDerivationProgress) => void | Promise<void>;
  readonly preflight?: (options: {
    readonly signal?: AbortSignal;
  }) => Promise<OpenWeightLlmAvailabilityStatus>;
};

type CanonicalQuestion = OpenWeightLlmLearningObjectivesRequest['questions'][number];

type BatchPlan =
  | {
      readonly status: 'ready';
      readonly requests: readonly OpenWeightLlmLearningObjectivesRequest[];
    }
  | { readonly status: 'input_too_large'; readonly sourceQuestionId: string };

function stableUuid(seed: string): string {
  const bytes = createHash('sha256').update(seed, 'utf8').digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(value);
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function projectChoiceQuestion(
  question: LearningObjectiveDerivationQuestion,
): CanonicalQuestion | null {
  if (!question.answers.some((answer) => answer.isCorrect)) return null;
  return {
    id: question.sourceQuestionId,
    text: question.text.trim(),
    answerOptions: question.answers.map((answer) => ({
      text: answer.text.trim(),
      isCorrect: answer.isCorrect,
    })),
    solutionExplanation: canonicalJson({ questionType: question.type }),
  };
}

function projectShortTextQuestion(
  question: LearningObjectiveDerivationQuestion,
): CanonicalQuestion {
  const evaluationKind = resolveShortTextEvaluationKind(question.shortTextEvaluationKind);
  const textSettings = resolveShortAnswerEvaluationSettings({
    evaluationMode: question.shortTextEvaluationMode,
    toleranceLevel: question.shortTextToleranceLevel,
    allowPartialCredit: question.shortTextAllowPartialCredit,
    caseSensitive: question.shortTextCaseSensitive,
    trimWhitespace: question.shortTextTrimWhitespace,
    normalizeWhitespace: question.shortTextNormalizeWhitespace,
  });
  const numericSettings = resolveNumericQuestionEvaluationSettings({
    numericInputKind: question.numericInputKind,
    numericToleranceMode: isNumericToleranceMode(question.numericToleranceMode)
      ? question.numericToleranceMode
      : undefined,
    numericAbsoluteTolerance: question.numericAbsoluteTolerance,
    numericRelativeTolerancePercent: question.numericRelativeTolerancePercent,
    numericUnitFamily: question.numericUnitFamily,
    numericRequireUnit: question.numericRequireUnit,
    numericAcceptEquivalentUnits: question.numericAcceptEquivalentUnits,
  });
  return {
    id: question.sourceQuestionId,
    text: question.text.trim(),
    answerOptions: question.answers.map((answer) => ({
      text: answer.text.trim(),
      isCorrect: answer.isCorrect,
    })),
    solutionExplanation: canonicalJson({
      questionType: question.type,
      evaluationKind,
      maxLength: resolveShortTextMaxLength(question.shortTextMaxLength),
      textSettings,
      numericSettings: evaluationKind === 'text' ? null : numericSettings,
    }),
  };
}

function projectNumericEstimateQuestion(
  question: LearningObjectiveDerivationQuestion,
): CanonicalQuestion {
  const toleranceMode = resolveNumericEstimateToleranceMode(question.numericToleranceMode);
  const solution = {
    questionType: question.type,
    toleranceMode,
    referenceValue: question.numericReferenceValue ?? null,
    tolerancePercent: question.numericTolerancePercent ?? null,
    intervalLeft: question.numericIntervalLeft ?? null,
    intervalRight: question.numericIntervalRight ?? null,
    inputType: question.numericInputType ?? 'DECIMAL',
    decimalPlaces: question.numericDecimalPlaces ?? null,
    minimum: question.numericMin ?? null,
    maximum: question.numericMax ?? null,
    twoRounds: question.numericTwoRounds ?? false,
  };
  const answerText = isNumericEstimateToleranceMode(question.numericToleranceMode)
    ? toleranceMode === 'RELATIVE_PERCENT'
      ? String(question.numericReferenceValue)
      : `${question.numericIntervalLeft}…${question.numericIntervalRight}`
    : `${question.numericIntervalLeft}…${question.numericIntervalRight}`;
  return {
    id: question.sourceQuestionId,
    text: question.text.trim(),
    answerOptions: [{ text: answerText, isCorrect: true }],
    solutionExplanation: canonicalJson(solution),
  };
}

function projectMatchingQuestion(question: LearningObjectiveDerivationQuestion): CanonicalQuestion {
  return {
    id: question.sourceQuestionId,
    text: question.text.trim(),
    answerOptions: (question.matchingPairs ?? []).map((pair) => ({
      text: `${pair.left.trim()} ⇔ ${pair.right.trim()}`,
      isCorrect: true,
    })),
    solutionExplanation: canonicalJson({ questionType: question.type }),
  };
}

function projectOrderingQuestion(question: LearningObjectiveDerivationQuestion): CanonicalQuestion {
  return {
    id: question.sourceQuestionId,
    text: question.text.trim(),
    answerOptions: (question.orderingItems ?? []).map((item, index) => ({
      text: `${index + 1}. ${item.text.trim()}`,
      isCorrect: true,
    })),
    solutionExplanation: canonicalJson({ questionType: question.type }),
  };
}

function projectCategorizationQuestion(
  question: LearningObjectiveDerivationQuestion,
): CanonicalQuestion {
  const categories = (question.categories ?? []).map((category) => ({
    id: category.id,
    name: category.name.trim(),
  }));
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const assignments = (question.categorizationItems ?? []).map((item) => ({
    itemId: item.id,
    item: item.text.trim(),
    categoryId: item.correctCategoryId,
    category: categoryNames.get(item.correctCategoryId) ?? item.correctCategoryId,
  }));
  return {
    id: question.sourceQuestionId,
    text: question.text.trim(),
    answerOptions: [],
    solutionExplanation: canonicalJson({
      questionType: question.type,
      categories,
      assignments,
    }),
  };
}

/** Returns null for disabled, survey-like, or otherwise non-solution-bearing tasks. */
export function projectLearningObjectiveDerivationQuestion(
  question: LearningObjectiveDerivationQuestion,
): CanonicalQuestion | null {
  if (!question.enabled) return null;
  switch (question.type) {
    case 'MULTIPLE_CHOICE':
    case 'SINGLE_CHOICE':
      return projectChoiceQuestion(question);
    case 'SHORT_TEXT':
      return projectShortTextQuestion(question);
    case 'NUMERIC_ESTIMATE':
      return projectNumericEstimateQuestion(question);
    case 'MATCHING':
      return projectMatchingQuestion(question);
    case 'ORDERING':
      return projectOrderingQuestion(question);
    case 'CATEGORIZATION':
      return projectCategorizationQuestion(question);
    case 'FREETEXT':
    case 'SURVEY':
    case 'RATING':
      return null;
  }
}

function batchRequestId(operationId: string, batchIndex: number): string {
  return stableUuid(`learning-objective-batch\u0000${operationId}\u0000${batchIndex}`);
}

function makeRuntimeRequest(
  input: Pick<LearningObjectiveDerivationInput, 'operationId' | 'locale'>,
  batchIndex: number,
  questions: readonly CanonicalQuestion[],
): OpenWeightLlmLearningObjectivesRequest {
  return {
    schemaVersion: OPEN_WEIGHT_LLM_SCHEMA_VERSION,
    taskType: 'learning_objectives',
    locale: input.locale,
    requestId: batchRequestId(input.operationId, batchIndex),
    questions: [...questions],
  };
}

function planBatches(
  input: Pick<LearningObjectiveDerivationInput, 'operationId' | 'locale'>,
  questions: readonly CanonicalQuestion[],
): BatchPlan {
  const requests: OpenWeightLlmLearningObjectivesRequest[] = [];
  let current: CanonicalQuestion[] = [];

  for (const question of questions) {
    const candidate = [...current, question];
    const candidateRequest = makeRuntimeRequest(input, requests.length, candidate);
    if (OpenWeightLlmLearningObjectivesRequestSchema.safeParse(candidateRequest).success) {
      current = candidate;
      continue;
    }

    if (current.length === 0) {
      return { status: 'input_too_large', sourceQuestionId: question.id };
    }
    requests.push(makeRuntimeRequest(input, requests.length, current));
    current = [question];
    const singleRequest = makeRuntimeRequest(input, requests.length, current);
    if (!OpenWeightLlmLearningObjectivesRequestSchema.safeParse(singleRequest).success) {
      return { status: 'input_too_large', sourceQuestionId: question.id };
    }
  }

  if (current.length > 0) {
    requests.push(makeRuntimeRequest(input, requests.length, current));
  }
  return { status: 'ready', requests };
}

function correlation(input: LearningObjectiveDerivationInput) {
  return {
    schemaVersion: LEARNING_OBJECTIVE_DERIVATION_SCHEMA_VERSION,
    operationId: input.operationId,
    quizId: input.quizId,
    expectedBundleRevision: input.expectedBundleRevision,
  } as const;
}

function sourceDigest(questions: readonly CanonicalQuestion[]): string {
  return createHash('sha256')
    .update(
      canonicalJson({
        derivationVersion: LEARNING_OBJECTIVE_DERIVATION_VERSION,
        questions,
      }),
      'utf8',
    )
    .digest('hex');
}

function normalizeMetadata(value: string | null | undefined, fallback: string): string {
  const normalized = value?.trim();
  if (!normalized) return fallback;
  if (normalized.length <= 120) return normalized;
  const digest = createHash('sha256').update(normalized, 'utf8').digest('hex').slice(0, 16);
  const suffix = `|override-sha256:${digest}`;
  return `${fallback.slice(0, 120 - suffix.length)}${suffix}`;
}

function modelVersionFor(configuredVersion: string | undefined): string {
  return normalizeMetadata(configuredVersion, OPEN_WEIGHT_LLM_MODEL_VERSION);
}

function suggestionKey(text: string, sourceQuestionIds: readonly string[]): string {
  return `${text.toLowerCase()}\u0000${sourceQuestionIds.join('\u0000')}`;
}

function interruptedStatus(
  callerSignal: AbortSignal | undefined,
  deadlineSignal: AbortSignal,
): 'aborted' | 'timeout' {
  return callerSignal?.aborted ? 'aborted' : deadlineSignal.aborted ? 'timeout' : 'aborted';
}

export function emptyLearningObjectiveDerivationProgress(): LearningObjectiveDerivationProgress {
  return LearningObjectiveDerivationProgressSchema.parse({
    completedGroups: 0,
    totalGroups: 0,
    elapsedMs: 0,
    promptTokens: 0,
    completionTokens: 0,
    queuedObjectives: 0,
  });
}

function tokenCount(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
}

/**
 * Executes deterministic batches sequentially. Any batch failure discards all
 * preceding model output so callers can only apply one atomic completed result.
 */
export async function deriveLearningObjectiveDrafts(
  rawInput: LearningObjectiveDerivationInput,
  hooks: DerivationHooks = {},
): Promise<LearningObjectiveDerivationResult> {
  const parsedInput = LearningObjectiveDerivationInputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    // Router input validation normally prevents this path. Keep a fail-closed
    // result for direct internal callers without leaking question/solution data.
    return LearningObjectiveDerivationResultSchema.parse({
      ...correlation(rawInput),
      status: 'invalid_response',
    });
  }
  const input = parsedInput.data;
  const resultCorrelation = correlation(input);
  const startedAtMs = (hooks.now ?? (() => new Date()))().getTime();
  let totalGroups = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  let queuedObjectives = 0;
  const snapshot = (completedGroups: number): LearningObjectiveDerivationProgress =>
    LearningObjectiveDerivationProgressSchema.parse({
      completedGroups,
      totalGroups,
      elapsedMs: Math.max(0, (hooks.now ?? (() => new Date()))().getTime() - startedAtMs),
      promptTokens,
      completionTokens,
      queuedObjectives,
    });
  const publish = async (progress: LearningObjectiveDerivationProgress): Promise<void> => {
    try {
      await hooks.onProgress?.(progress);
    } catch {
      // Fortschritt ist Hilfsinformation; ein Schreibfehler darf den Lauf nicht beenden.
    }
  };
  const interrupted = async (
    status: 'aborted' | 'timeout',
    completedGroups = 0,
  ): Promise<LearningObjectiveDerivationResult> => {
    const progress = snapshot(completedGroups);
    await publish(progress);
    return LearningObjectiveDerivationResultSchema.parse({
      ...resultCorrelation,
      status,
      progress,
    });
  };
  if (hooks.signal?.aborted) {
    return interrupted('aborted');
  }

  const eligibleQuestions = input.questions
    .slice()
    .sort(
      (left, right) =>
        left.order - right.order || compareCodeUnits(left.sourceQuestionId, right.sourceQuestionId),
    )
    .map(projectLearningObjectiveDerivationQuestion)
    .filter((question): question is CanonicalQuestion => question !== null);

  if (eligibleQuestions.length === 0) {
    return { ...resultCorrelation, status: 'no_eligible_questions' };
  }

  const plan = planBatches(input, eligibleQuestions);
  if (plan.status === 'input_too_large') {
    return {
      ...resultCorrelation,
      status: 'input_too_large',
      sourceQuestionId: plan.sourceQuestionId,
    };
  }

  const run = hooks.run ?? runOpenWeightLlmLearningObjectives;
  const deadlineSignal = AbortSignal.timeout(
    Math.max(1, hooks.overallTimeoutMs ?? LEARNING_OBJECTIVE_DERIVATION_OVERALL_TIMEOUT_MS),
  );
  const runSignal = hooks.signal ? AbortSignal.any([hooks.signal, deadlineSignal]) : deadlineSignal;
  const preflight =
    hooks.preflight ??
    (hooks.run
      ? async () => 'ready' as const
      : async (options: { readonly signal?: AbortSignal }) =>
          inspectOpenWeightLlmAvailability({
            signal: options.signal,
            timeoutMs: OPEN_WEIGHT_LLM_AVAILABILITY_PREFLIGHT_MS,
          }));
  const availability = await preflight({ signal: runSignal });
  if (runSignal.aborted) {
    return interrupted(interruptedStatus(hooks.signal, deadlineSignal));
  }
  if (availability !== 'ready') {
    return availability === 'busy'
      ? { ...resultCorrelation, status: 'busy', retry: 'manual' }
      : { ...resultCorrelation, status: availability };
  }
  const completed: Array<{
    readonly request: OpenWeightLlmLearningObjectivesRequest;
    readonly output: ReturnType<typeof OpenWeightLlmLearningObjectivesOutputSchema.parse>;
    readonly telemetry: OpenWeightLlmTelemetry;
  }> = [];
  totalGroups = plan.requests.length;
  await publish(snapshot(0));

  for (const [batchIndex, request] of plan.requests.entries()) {
    const batch = batchIndex + 1;
    const batchCount = plan.requests.length;
    if (runSignal.aborted) {
      logger.warn('learning_objectives:batch_failed', {
        batch,
        batchCount,
        status: interruptedStatus(hooks.signal, deadlineSignal),
      });
      return interrupted(interruptedStatus(hooks.signal, deadlineSignal), completed.length);
    }
    const batchResult = await run(request, { signal: runSignal });
    if (runSignal.aborted) {
      logger.warn('learning_objectives:batch_failed', {
        batch,
        batchCount,
        status: interruptedStatus(hooks.signal, deadlineSignal),
      });
      return interrupted(interruptedStatus(hooks.signal, deadlineSignal), completed.length);
    }
    if (batchResult.status !== 'completed') {
      logger.warn('learning_objectives:batch_failed', {
        batch,
        batchCount,
        status: batchResult.status,
      });
      if (batchResult.status === 'aborted' || batchResult.status === 'timeout') {
        return interrupted(batchResult.status, completed.length);
      }
      return batchResult.status === 'busy'
        ? { ...resultCorrelation, status: 'busy', retry: 'manual' }
        : { ...resultCorrelation, status: batchResult.status };
    }
    const output = OpenWeightLlmLearningObjectivesOutputSchema.safeParse(batchResult.output);
    if (!output.success) {
      logger.warn('learning_objectives:batch_failed', {
        batch,
        batchCount,
        status: 'invalid_response',
        reason: 'output_schema',
      });
      return { ...resultCorrelation, status: 'invalid_response' };
    }
    const invalidReason = !hasOnlyAllowedOpenWeightLlmReferences(request, output.data)
      ? 'question_references'
      : output.data.objectives.some(
            ({ questionIds }) => new Set(questionIds).size !== questionIds.length,
          )
        ? 'duplicate_question_references'
        : null;
    if (invalidReason) {
      logger.warn('learning_objectives:batch_failed', {
        batch,
        batchCount,
        status: 'invalid_response',
        reason: invalidReason,
      });
      return { ...resultCorrelation, status: 'invalid_response' };
    }
    logger.info('learning_objectives:batch_completed', {
      batch,
      batchCount,
      elapsedMs: batchResult.telemetry.elapsedMs,
      promptTokens: batchResult.telemetry.promptTokens,
      completionTokens: batchResult.telemetry.completionTokens,
    });
    completed.push({ request, output: output.data, telemetry: batchResult.telemetry });
    promptTokens += tokenCount(batchResult.telemetry.promptTokens);
    completionTokens += tokenCount(batchResult.telemetry.completionTokens);
    queuedObjectives = Math.min(
      LEARNING_OBJECTIVE_MAX_OBJECTIVES,
      input.maximumDrafts,
      completed.reduce((sum, item) => sum + item.output.objectives.length, 0),
    );
    await publish(snapshot(completed.length));
  }

  if (runSignal.aborted) {
    logger.warn('learning_objectives:derivation_failed', {
      status: interruptedStatus(hooks.signal, deadlineSignal),
    });
    return interrupted(interruptedStatus(hooks.signal, deadlineSignal), completed.length);
  }

  const canonicalById = new Map(eligibleQuestions.map((question) => [question.id, question]));
  const suggestions = completed
    .flatMap(({ output }) =>
      output.objectives.map((objective) => {
        const sourceQuestionIds = [...objective.questionIds].sort(compareCodeUnits);
        const sourceQuestions = sourceQuestionIds.map((id) => canonicalById.get(id));
        if (sourceQuestions.some((question) => question === undefined)) return null;
        const text = normalizeLearningObjectiveText(objective.text, input.locale);
        return {
          text,
          sourceQuestionIds,
          sourceDigest: sourceDigest(sourceQuestions as CanonicalQuestion[]),
          modelVersion: modelVersionFor(hooks.modelVersion),
        };
      }),
    )
    .filter((suggestion): suggestion is NonNullable<typeof suggestion> => suggestion !== null)
    .sort(
      (left, right) =>
        compareCodeUnits(
          left.sourceQuestionIds.join('\u0000'),
          right.sourceQuestionIds.join('\u0000'),
        ) ||
        compareCodeUnits(left.text, right.text) ||
        compareCodeUnits(left.modelVersion, right.modelVersion),
    );

  const deduplicated = new Map<string, (typeof suggestions)[number]>();
  for (const suggestion of suggestions) {
    const key = suggestionKey(suggestion.text, suggestion.sourceQuestionIds);
    if (!deduplicated.has(key)) deduplicated.set(key, suggestion);
  }

  const createdAt = (hooks.now ?? (() => new Date()))().toISOString();
  const modelId = normalizeMetadata(hooks.modelId, OPEN_WEIGHT_LLM_MODEL_ID);
  const allSuggestions = [...deduplicated.values()];
  const draftLimit = Math.min(input.maximumDrafts, LEARNING_OBJECTIVE_MAX_OBJECTIVES);
  const wasCapped = allSuggestions.length > draftLimit;
  const drafts = allSuggestions.slice(0, draftLimit).map((suggestion) => ({
    id: stableUuid(
      [
        'learning-objective-draft',
        input.operationId,
        suggestionKey(suggestion.text, suggestion.sourceQuestionIds),
        suggestion.sourceDigest,
        modelId,
        suggestion.modelVersion,
        LEARNING_OBJECTIVE_DERIVATION_VERSION,
      ].join('\u0000'),
    ),
    revision: 0 as const,
    text: suggestion.text,
    scope: {
      kind: 'question-set' as const,
      sourceQuestionIds: suggestion.sourceQuestionIds,
    },
    origin: {
      kind: 'model-derived' as const,
      modelId,
      modelVersion: suggestion.modelVersion,
      derivationVersion: LEARNING_OBJECTIVE_DERIVATION_VERSION,
      derivedFromSourceQuestionIds: suggestion.sourceQuestionIds,
      sourceDigest: suggestion.sourceDigest,
    },
    confirmation: { state: 'draft' as const },
    createdAt,
    updatedAt: createdAt,
  }));

  // Model-authored limitations are unverified free text and often repeat the
  // system prompt across batches. Show only limitations established here.
  const internalLimitation = wasCapped
    ? DERIVATION_LIMITATIONS[input.locale].capped
    : drafts.length === 0
      ? DERIVATION_LIMITATIONS[input.locale].empty
      : null;

  const result = LearningObjectiveDerivationResultSchema.parse({
    ...resultCorrelation,
    status: 'completed',
    drafts,
    limitations: internalLimitation ? [internalLimitation] : [],
    batchCount: plan.requests.length,
  });
  logger.info('learning_objectives:derivation_completed', {
    batchCount: plan.requests.length,
    draftCount: drafts.length,
  });
  return result;
}
