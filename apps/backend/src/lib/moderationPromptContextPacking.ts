import { createHash } from 'node:crypto';
import {
  MODERATION_ANALYSIS_CONTEXT_CONTRACT_VERSION,
  MODERATION_PROMPT_BUDGET_VERSION,
  MODERATION_PROMPT_CONTEXT_CONTRACT_VERSION,
  MODERATION_PROMPT_CONTEXT_SCHEMA_VERSION,
  MODERATION_PROMPT_HASH_MATERIAL_VERSION,
  MODERATION_PROMPT_SOURCE_LIMIT,
  ModerationAnalysisContextV1Schema,
  ModerationPromptContextV1Schema,
  ModerationPromptDomainContextV1Schema,
  type ModerationAnalysisContextV1,
  type ModerationPromptBudgetV1,
  type ModerationPromptContextV1,
  type ModerationPromptDomainContextV1,
  type ModerationPromptSection,
  type ModerationPromptSource,
} from '@arsnova/shared-types';
import { registerSessionPurgeInvalidator } from './sessionPurgeInvalidation';

export const MODERATION_PROMPT_SELECTION_VERSION = 'moderation-prompt-selection-v1' as const;
export const MODERATION_PROMPT_UTF8_ESTIMATOR_ID = 'utf8-byte-upper-bound' as const;
export const MODERATION_PROMPT_UTF8_ESTIMATOR_VERSION = '1' as const;
export const MODERATION_PROMPT_PACKING_CACHE_TTL_MS = 30_000;
export const MODERATION_PROMPT_PACKING_CACHE_MAX_ENTRIES = 64;
const MODERATION_PROMPT_PURGE_FENCE_MS = 60_000;

type AnalysisDomain = ModerationAnalysisContextV1['context'];
type AnalysisQuestion = Extract<
  AnalysisDomain['questions'],
  { state: 'available' }
>['items'][number];
type AnalysisTopic = Extract<AnalysisDomain['topics'], { state: 'available' }>['items'][number];
type AnalysisSignal = Extract<AnalysisDomain['compass'], { state: 'available' }>['signals'][number];
type AnalysisObjective = Extract<
  AnalysisDomain['learningContext'],
  { state: 'available' }
>['objectives'][number];

export type ModerationPromptPackingProfile = Readonly<{
  modelProfile: string;
  contextWindowTokens: number;
  instructionText: string;
  definitionText: string;
  reservedOutputTokens: number;
  safetyMarginTokens: number;
}>;

export type PackModerationPromptContextInput = Readonly<{
  analysis: ModerationAnalysisContextV1;
  profile: ModerationPromptPackingProfile;
  packedAt?: Date;
  candidatePriority?: 'balanced' | 'topics-first';
}>;

type CandidateBundle = Readonly<{
  key: string;
  kind: 'question' | 'topic' | 'signal' | 'objective' | 'result' | 'feedback';
  sourceId: string;
}>;

type Selection = {
  questionIds: Set<string>;
  questionTextSourceIds: Set<string>;
  topicIds: Set<string>;
  signalIds: Set<string>;
  objectiveIds: Set<string>;
  resultIds: Set<string>;
  feedbackIds: Set<string>;
};

type PackingIndex = {
  sourceById: Map<string, ModerationPromptSource>;
  questionById: Map<string, AnalysisQuestion>;
  topicById: Map<string, AnalysisTopic>;
  signalById: Map<string, AnalysisSignal>;
  objectiveById: Map<string, AnalysisObjective>;
  resultIds: Set<string>;
  feedbackIds: Set<string>;
  canonicalQuestionIds: Set<string>;
  canonicalQuestionIdById: Map<string, string>;
  questionGroupCountByCanonicalId: Map<string, number>;
};

type DomainBuild = {
  context: ModerationPromptDomainContextV1;
  truncations: ModerationPromptBudgetV1['truncations'];
};

type BuiltCandidate = {
  context: ModerationPromptDomainContextV1;
  budget: ModerationPromptBudgetV1;
};

type CandidateBuildResult =
  | { status: 'accepted'; candidate: BuiltCandidate }
  | { status: 'rejected'; reason: 'source-limit' | 'invalid' };

class ModerationPromptSourceLimitError extends Error {}

function assertPackingProfile(profile: ModerationPromptPackingProfile): void {
  const integers = [
    profile.contextWindowTokens,
    profile.reservedOutputTokens,
    profile.safetyMarginTokens,
  ];
  if (
    !profile.modelProfile.trim() ||
    profile.modelProfile.length > 120 ||
    integers.some((value) => !Number.isSafeInteger(value) || value < 0) ||
    profile.contextWindowTokens <= 0
  ) {
    throw new Error('Invalid moderation prompt packing profile.');
  }
}

export function compareModerationPromptCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * JSON canonicalization used only for hashing and conservative byte counting.
 * Object keys use ECMAScript code-unit order; array order remains semantic.
 */
export function canonicalModerationPromptJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Canonical JSON requires finite numbers.');
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalModerationPromptJson(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => compareModerationPromptCodeUnits(left, right));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalModerationPromptJson(item)}`)
      .join(',')}}`;
  }
  throw new Error('Canonical JSON does not support this value.');
}

/**
 * Qwen/llama.cpp can always fall back to byte tokens. Counting each UTF-8 byte
 * as one token is therefore deliberately conservative; Slice 8 still measures
 * the real tokenizer/prefill behavior for the deployed model.
 */
export function estimateModerationPromptUtf8Tokens(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

const NON_SEMANTIC_ANALYSIS_TIMESTAMP_KEYS = new Set(['analyzedAt', 'classifiedAt', 'confirmedAt']);

/**
 * Runtime timestamps describe when already revisioned material was produced;
 * changing only those clocks must not invalidate an otherwise identical
 * semantic snapshot. Interval `from`/`to` values remain part of the hash
 * because they define the selected domain scope.
 */
function timestampNeutralHashMaterial(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(timestampNeutralHashMaterial);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !NON_SEMANTIC_ANALYSIS_TIMESTAMP_KEYS.has(key))
      .map(([key, item]) => [key, timestampNeutralHashMaterial(item)]),
  );
}

function semanticProfileMaterial(profile: ModerationPromptPackingProfile) {
  return {
    modelProfile: profile.modelProfile,
    contextWindowTokens: profile.contextWindowTokens,
    instructionText: profile.instructionText,
    definitionText: profile.definitionText,
    reservedOutputTokens: profile.reservedOutputTokens,
    safetyMarginTokens: profile.safetyMarginTokens,
    estimator: {
      id: MODERATION_PROMPT_UTF8_ESTIMATOR_ID,
      version: MODERATION_PROMPT_UTF8_ESTIMATOR_VERSION,
    },
    selectionVersion: MODERATION_PROMPT_SELECTION_VERSION,
  };
}

/** `assembledAt` is intentionally excluded: it is transport time, not content. */
export function hashModerationAnalysisForPacking(
  analysis: ModerationAnalysisContextV1,
  profile: ModerationPromptPackingProfile,
): string {
  const parsed = ModerationAnalysisContextV1Schema.parse(analysis);
  if (parsed.contractVersion !== MODERATION_ANALYSIS_CONTEXT_CONTRACT_VERSION) {
    throw new Error('Unsupported moderation analysis context version.');
  }
  assertPackingProfile(profile);
  return sha256(
    canonicalModerationPromptJson({
      hashMaterialVersion: MODERATION_PROMPT_HASH_MATERIAL_VERSION,
      analysis: timestampNeutralHashMaterial(parsed.context),
      profile: semanticProfileMaterial(profile),
    }),
  );
}

export function hashModerationPromptContextMaterial(
  context: ModerationPromptDomainContextV1,
  budget: ModerationPromptBudgetV1,
  profile: Pick<ModerationPromptPackingProfile, 'instructionText' | 'definitionText'>,
): string {
  const {
    dataTokens: _dataTokens,
    packedInputTokens: _packedInputTokens,
    ...semanticBudget
  } = budget;
  return sha256(
    canonicalModerationPromptJson({
      hashMaterialVersion: MODERATION_PROMPT_HASH_MATERIAL_VERSION,
      context: timestampNeutralHashMaterial(context),
      // Both omitted totals are derived from serialized material. In
      // particular, harmless ISO timestamp precision must not perturb the
      // semantic snapshot hash through a different byte count.
      budget: semanticBudget,
      instructionText: profile.instructionText,
      definitionText: profile.definitionText,
    }),
  );
}

function emptySelection(): Selection {
  return {
    questionIds: new Set(),
    questionTextSourceIds: new Set(),
    topicIds: new Set(),
    signalIds: new Set(),
    objectiveIds: new Set(),
    resultIds: new Set(),
    feedbackIds: new Set(),
  };
}

function cloneSelection(selection: Selection): Selection {
  return {
    questionIds: new Set(selection.questionIds),
    questionTextSourceIds: new Set(selection.questionTextSourceIds),
    topicIds: new Set(selection.topicIds),
    signalIds: new Set(selection.signalIds),
    objectiveIds: new Set(selection.objectiveIds),
    resultIds: new Set(selection.resultIds),
    feedbackIds: new Set(selection.feedbackIds),
  };
}

const OUTER_QUESTION_QUOTE_PAIRS = [
  ['"', '"'],
  ["'", "'"],
  ['`', '`'],
  ['´', '´'],
  ['‘', '’'],
  ['‚', '‘'],
  ['‛', '’'],
  ['“', '”'],
  ['„', '“'],
  ['‟', '”'],
  ['«', '»'],
  ['»', '«'],
] as const;

function stripOuterQuestionQuotes(text: string): string {
  for (const [opening, closing] of OUTER_QUESTION_QUOTE_PAIRS) {
    if (text.startsWith(opening) && text.endsWith(closing) && text.length > 2) {
      return text.slice(opening.length, -closing.length).trim();
    }
  }
  return text;
}

function normalizeQuestionForDedupe(text: string): string {
  // Normalize only presentation-level wrappers. Operators and punctuation
  // inside the question can carry meaning (for example `<` versus `>`, `5!`
  // versus `5`, or `f'(x)` versus `f(x)`), so broad punctuation stripping
  // would merge semantically different questions.
  const withoutOutsideTerminator = text
    .normalize('NFC')
    .trim()
    .replace(/\s*[.?…]+\s*$/u, '');
  return stripOuterQuestionQuotes(withoutOutsideTerminator)
    .replace(/^\s*[¿¡]+\s*/u, '')
    .replace(/\s*[.?…]+\s*$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sourceText(source: ModerationPromptSource | undefined): string | null {
  return source?.kind === 'qa-question' && source.content.state === 'included'
    ? source.content.text
    : null;
}

function buildPackingIndex(context: AnalysisDomain): PackingIndex {
  const sourceById = new Map(context.sources.map((source) => [source.id, source] as const));
  const questions = context.questions.state === 'available' ? context.questions.items : [];
  const questionById = new Map(questions.map((question) => [question.sourceId, question] as const));
  const topicById = new Map(
    (context.topics.state === 'available' ? context.topics.items : []).map(
      (topic) => [topic.sourceId, topic] as const,
    ),
  );
  const signalById = new Map(
    (context.compass.state === 'available' ? context.compass.signals : []).map(
      (signal) => [signal.sourceId, signal] as const,
    ),
  );
  const objectiveById = new Map(
    (context.learningContext.state === 'available' ? context.learningContext.objectives : []).map(
      (objective) => [objective.sourceId, objective] as const,
    ),
  );
  const resultIds = new Set(
    context.releasedResults.state === 'available'
      ? context.releasedResults.aggregates.map(({ sourceId }) => sourceId)
      : [],
  );
  const feedbackIds = new Set(
    context.feedback.state === 'available'
      ? context.feedback.aggregates.map(({ sourceId }) => sourceId)
      : [],
  );

  // Compass and learning-context references carry per-source semantics (for
  // example exact signal frequency or an explicitly selected task). Keep
  // those questions distinct instead of silently redirecting the reference
  // to an otherwise metadata-identical duplicate.
  const protectedQuestionIds = new Set<string>();
  for (const signal of signalById.values()) {
    signal.questionSourceIds.forEach((sourceId) => protectedQuestionIds.add(sourceId));
    signal.evidence.forEach(({ sourceId }) => {
      if (sourceById.get(sourceId)?.kind === 'qa-question') {
        protectedQuestionIds.add(sourceId);
      }
    });
  }
  for (const objective of objectiveById.values()) {
    if (objective.scope.kind === 'tasks') {
      objective.scope.taskSourceIds.forEach((sourceId) => {
        if (sourceById.get(sourceId)?.kind === 'qa-question') {
          protectedQuestionIds.add(sourceId);
        }
      });
    }
    if (objective.origin.kind === 'model-derived') {
      objective.origin.derivedFromSourceIds.forEach((sourceId) => {
        if (sourceById.get(sourceId)?.kind === 'qa-question') {
          protectedQuestionIds.add(sourceId);
        }
      });
    }
  }

  const questionIdsByDedupeKey = new Map<string, string[]>();
  for (const question of [...questions].sort((left, right) =>
    compareModerationPromptCodeUnits(left.sourceId, right.sourceId),
  )) {
    const text = sourceText(sourceById.get(question.sourceId));
    const normalized = text ? normalizeQuestionForDedupe(text) : '';
    const { sourceId: _sourceId, deduplication: _deduplication, ...metadata } = question;
    const key = protectedQuestionIds.has(question.sourceId)
      ? `source:${question.sourceId}`
      : normalized
        ? `${normalized}\u0000${canonicalModerationPromptJson(metadata)}`
        : `source:${question.sourceId}`;
    const group = questionIdsByDedupeKey.get(key) ?? [];
    group.push(question.sourceId);
    questionIdsByDedupeKey.set(key, group);
  }
  const canonicalQuestionIdById = new Map<string, string>();
  const questionGroupCountByCanonicalId = new Map<string, number>();
  for (const sourceIds of questionIdsByDedupeKey.values()) {
    const canonicalSourceId = sourceIds[0]!;
    questionGroupCountByCanonicalId.set(canonicalSourceId, sourceIds.length);
    sourceIds.forEach((sourceId) => canonicalQuestionIdById.set(sourceId, canonicalSourceId));
  }

  return {
    sourceById,
    questionById,
    topicById,
    signalById,
    objectiveById,
    resultIds,
    feedbackIds,
    canonicalQuestionIds: new Set(questionGroupCountByCanonicalId.keys()),
    canonicalQuestionIdById,
    questionGroupCountByCanonicalId,
  };
}

function metricValue(question: AnalysisQuestion, metric: 'bestScore' | 'controversyScore'): number {
  if (question.votes.state !== 'available') return -1;
  const value = question.votes[metric];
  return value.state === 'available' ? value.value : -1;
}

function questionVoteTotal(question: AnalysisQuestion): number {
  return question.votes.state === 'available' ? question.votes.total : -1;
}

function bundle(kind: CandidateBundle['kind'], sourceId: string): CandidateBundle {
  return { key: `${kind}:${sourceId}`, kind, sourceId };
}

function candidateSection(kind: CandidateBundle['kind']): ModerationPromptSection {
  switch (kind) {
    case 'question':
      return 'questions';
    case 'topic':
      return 'topics';
    case 'signal':
      return 'compass';
    case 'objective':
      return 'learning-context';
    case 'result':
      return 'released-results';
    case 'feedback':
      return 'feedback';
  }
}

function roundRobin(lanes: readonly (readonly CandidateBundle[])[]): CandidateBundle[] {
  const output: CandidateBundle[] = [];
  const seen = new Set<string>();
  const maximum = Math.max(0, ...lanes.map((lane) => lane.length));
  for (let index = 0; index < maximum; index += 1) {
    for (const lane of lanes) {
      const candidate = lane[index];
      if (candidate && !seen.has(candidate.key)) {
        seen.add(candidate.key);
        output.push(candidate);
      }
    }
  }
  return output;
}

function buildCandidateBundles(context: AnalysisDomain, index: PackingIndex): CandidateBundle[] {
  const canonicalQuestions = [...index.canonicalQuestionIds]
    .map((sourceId) => index.questionById.get(sourceId))
    .filter((question): question is AnalysisQuestion => Boolean(question));
  const byId = (left: { sourceId: string }, right: { sourceId: string }) =>
    compareModerationPromptCodeUnits(left.sourceId, right.sourceId);
  const questionsById = [...canonicalQuestions].sort(byId);
  const organization = questionsById.filter(
    ({ nlp }) => nlp.state === 'classified' && nlp.category === 'organization',
  );
  const technical = questionsById.filter(
    ({ nlp }) => nlp.state === 'classified' && nlp.category === 'technical',
  );
  const topics = [...index.topicById.values()].sort(
    (left, right) =>
      right.aggregates.questionCount - left.aggregates.questionCount || byId(left, right),
  );
  const pinned = questionsById.filter(({ status }) => status === 'PINNED');
  const pending = questionsById.filter(({ status }) => status === 'PENDING');
  const controversial = [...questionsById].sort(
    (left, right) =>
      metricValue(right, 'controversyScore') - metricValue(left, 'controversyScore') ||
      questionVoteTotal(right) - questionVoteTotal(left) ||
      byId(left, right),
  );
  const supported = [...questionsById].sort(
    (left, right) =>
      metricValue(right, 'bestScore') - metricValue(left, 'bestScore') ||
      questionVoteTotal(right) - questionVoteTotal(left) ||
      byId(left, right),
  );
  const unvoted = questionsById.filter((question) => questionVoteTotal(question) === 0);
  const objectives = [...index.objectiveById.values()].sort((left, right) => {
    const rank = (value: AnalysisObjective) =>
      value.confirmation.state === 'confirmed'
        ? 0
        : value.confirmation.state === 'needs-review'
          ? 1
          : 2;
    return rank(left) - rank(right) || byId(left, right);
  });
  const signals = [...index.signalById.values()].sort((left, right) => {
    const primary =
      context.compass.state === 'available' ? context.compass.primarySignalSourceId : null;
    const leftPrimary = left.sourceId === primary ? 0 : 1;
    const rightPrimary = right.sourceId === primary ? 0 : 1;
    return leftPrimary - rightPrimary || right.value - left.value || byId(left, right);
  });
  const resultIds = [...index.resultIds].sort(compareModerationPromptCodeUnits);
  const feedbackIds = [...index.feedbackIds].sort(compareModerationPromptCodeUnits);

  return roundRobin([
    organization.map(({ sourceId }) => bundle('question', sourceId)),
    technical.map(({ sourceId }) => bundle('question', sourceId)),
    topics.map(({ sourceId }) => bundle('topic', sourceId)),
    pinned.map(({ sourceId }) => bundle('question', sourceId)),
    pending.map(({ sourceId }) => bundle('question', sourceId)),
    controversial.map(({ sourceId }) => bundle('question', sourceId)),
    supported.map(({ sourceId }) => bundle('question', sourceId)),
    unvoted.map(({ sourceId }) => bundle('question', sourceId)),
    objectives.map(({ sourceId }) => bundle('objective', sourceId)),
    signals.map(({ sourceId }) => bundle('signal', sourceId)),
    resultIds.map((sourceId) => bundle('result', sourceId)),
    feedbackIds.map((sourceId) => bundle('feedback', sourceId)),
    questionsById.map(({ sourceId }) => bundle('question', sourceId)),
  ]);
}

function prioritizeCandidateBundles(
  candidates: readonly CandidateBundle[],
  priority: PackModerationPromptContextInput['candidatePriority'],
): CandidateBundle[] {
  if (priority !== 'topics-first') return [...candidates];
  const rank = (candidate: CandidateBundle): number => {
    switch (candidate.kind) {
      case 'topic':
        return 0;
      case 'signal':
        return 1;
      case 'question':
        return 2;
      default:
        return 3;
    }
  };
  return candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((left, right) => rank(left.candidate) - rank(right.candidate) || left.index - right.index)
    .map(({ candidate }) => candidate);
}

function addQuestion(selection: Selection, index: PackingIndex, sourceId: string): void {
  const canonicalSourceId = index.canonicalQuestionIdById.get(sourceId) ?? sourceId;
  if (index.questionById.has(canonicalSourceId)) {
    selection.questionIds.add(canonicalSourceId);
    selection.questionTextSourceIds.add(canonicalSourceId);
  }
}

function addTopicQuestionText(selection: Selection, index: PackingIndex, sourceId: string): void {
  const canonicalSourceId = index.canonicalQuestionIdById.get(sourceId) ?? sourceId;
  const source = index.sourceById.get(canonicalSourceId);
  if (source?.kind !== 'qa-question' || source.content.state !== 'included') return;
  selection.questionTextSourceIds.add(canonicalSourceId);
  if (index.questionById.has(canonicalSourceId)) {
    selection.questionIds.add(canonicalSourceId);
  }
}

function addTopic(selection: Selection, index: PackingIndex, sourceId: string): void {
  if (selection.topicIds.has(sourceId)) return;
  const topic = index.topicById.get(sourceId);
  if (!topic) return;
  selection.topicIds.add(sourceId);
  addTopicQuestionText(selection, index, topic.representativeQuestionSourceId);
  if (topic.labelOrigin.kind === 'source-extractive') {
    addTopicQuestionText(selection, index, topic.labelOrigin.sourceQuestionId);
  } else if (topic.labelOrigin.kind === 'model-generated') {
    topic.labelOrigin.derivedFromSourceIds.forEach((id) =>
      addTopicQuestionText(selection, index, id),
    );
  }
}

function addObjective(selection: Selection, index: PackingIndex, sourceId: string): void {
  if (selection.objectiveIds.has(sourceId)) return;
  const objective = index.objectiveById.get(sourceId);
  if (!objective) return;
  selection.objectiveIds.add(sourceId);
  if (objective.scope.kind === 'tasks') {
    objective.scope.taskSourceIds.forEach((id) => addQuestion(selection, index, id));
  }
}

function addResult(selection: Selection, index: PackingIndex, sourceId: string): void {
  if (index.resultIds.has(sourceId)) selection.resultIds.add(sourceId);
}

function addFeedback(selection: Selection, index: PackingIndex, sourceId: string): void {
  if (index.feedbackIds.has(sourceId)) selection.feedbackIds.add(sourceId);
}

function addEvidenceDependency(selection: Selection, index: PackingIndex, sourceId: string): void {
  const source = index.sourceById.get(sourceId);
  switch (source?.kind) {
    case 'qa-question':
      addQuestion(selection, index, sourceId);
      break;
    case 'semantic-topic':
      addTopic(selection, index, sourceId);
      break;
    case 'learning-objective':
      addObjective(selection, index, sourceId);
      break;
    case 'quiz-result-aggregate':
      addResult(selection, index, sourceId);
      break;
    case 'feedback-aggregate':
      addFeedback(selection, index, sourceId);
      break;
  }
}

function addSignal(selection: Selection, index: PackingIndex, sourceId: string): void {
  if (selection.signalIds.has(sourceId)) return;
  const signal = index.signalById.get(sourceId);
  if (!signal) return;
  selection.signalIds.add(sourceId);
  signal.questionSourceIds.forEach((id) => addQuestion(selection, index, id));
  signal.evidence.forEach(({ sourceId: id }) => addEvidenceDependency(selection, index, id));
}

function addCandidateBundle(
  selection: Selection,
  index: PackingIndex,
  candidate: CandidateBundle,
): void {
  switch (candidate.kind) {
    case 'question':
      addQuestion(selection, index, candidate.sourceId);
      break;
    case 'topic':
      addTopic(selection, index, candidate.sourceId);
      break;
    case 'signal':
      addSignal(selection, index, candidate.sourceId);
      break;
    case 'objective':
      addObjective(selection, index, candidate.sourceId);
      break;
    case 'result':
      addResult(selection, index, candidate.sourceId);
      break;
    case 'feedback':
      addFeedback(selection, index, candidate.sourceId);
      break;
  }
}

function stableSourceOrder<T extends { sourceId: string }>(values: readonly T[]): T[] {
  return [...values].sort((left, right) =>
    compareModerationPromptCodeUnits(left.sourceId, right.sourceId),
  );
}

function addTruncation(
  truncations: ModerationPromptBudgetV1['truncations'],
  section: ModerationPromptSection,
  omittedItems: number,
  reason: ModerationPromptBudgetV1['truncations'][number]['reason'],
): void {
  if (omittedItems > 0) truncations.push({ section, omittedItems, reason });
}

function limitationKey(limitation: AnalysisDomain['limitations'][number]): string {
  return `${limitation.section}\u0000${limitation.code}\u0000${limitation.detail}`;
}

function buildDomainContext(
  analysis: AnalysisDomain,
  index: PackingIndex,
  selection: Selection,
  sourceLimitedSections: ReadonlySet<ModerationPromptSection> = new Set(),
): DomainBuild {
  const selectedQuestions = stableSourceOrder(
    [...selection.questionIds]
      .map((sourceId) => index.questionById.get(sourceId))
      .filter((question): question is AnalysisQuestion => Boolean(question)),
  );
  const selectedTopics = stableSourceOrder(
    [...selection.topicIds]
      .map((sourceId) => index.topicById.get(sourceId))
      .filter((topic): topic is AnalysisTopic => Boolean(topic)),
  );
  const selectedTopicIds = new Set(selectedTopics.map(({ sourceId }) => sourceId));
  const selectedQuestionTextSourceIds = new Set(selection.questionTextSourceIds);

  const packedQuestions = selectedQuestions.map((question) => {
    const { deduplication: _deduplication, ...questionWithoutDedupe } = question;
    const questionCount = index.questionGroupCountByCanonicalId.get(question.sourceId) ?? 1;
    return {
      ...questionWithoutDedupe,
      topicSourceIds: [...question.topicSourceIds]
        .filter((sourceId) => selectedTopicIds.has(sourceId))
        .sort(compareModerationPromptCodeUnits),
      ...(questionCount > 1
        ? {
            deduplication: {
              rule: 'normalized-text-and-metadata-v1' as const,
              questionCount,
            },
          }
        : {}),
    };
  });
  const canonicalQuestionId = (sourceId: string) =>
    index.canonicalQuestionIdById.get(sourceId) ?? sourceId;
  const uniqueQuestionIds = (sourceIds: readonly string[]) =>
    [...new Set(sourceIds.map(canonicalQuestionId))].sort(compareModerationPromptCodeUnits);
  const uniqueSourceIds = (sourceIds: readonly string[]) =>
    [...new Set(sourceIds)].sort(compareModerationPromptCodeUnits);
  const packedTopics = selectedTopics.map((topic) => {
    const representedQuestionSourceIds = uniqueQuestionIds(topic.memberQuestionSourceIds).filter(
      (sourceId) => selectedQuestionTextSourceIds.has(sourceId),
    );
    const representativeQuestionSourceId = canonicalQuestionId(
      topic.representativeQuestionSourceId,
    );
    const labelOrigin =
      topic.labelOrigin.kind === 'source-extractive'
        ? {
            ...topic.labelOrigin,
            sourceQuestionId: canonicalQuestionId(topic.labelOrigin.sourceQuestionId),
          }
        : topic.labelOrigin.kind === 'model-generated'
          ? {
              ...topic.labelOrigin,
              // Die vollständige Themenmitgliedschaft bleibt absichtlich
              // undedupliziert. Generative Provenienz muss deshalb dieselben
              // Original-IDs behalten; eine Umleitung auf kanonische Fragen
              // würde Quellen erzeugen, die keine Themenmitglieder sind.
              derivedFromSourceIds: uniqueSourceIds(topic.labelOrigin.derivedFromSourceIds),
            }
          : topic.labelOrigin;
    return {
      ...topic,
      labelOrigin,
      memberQuestionSourceIds: [...topic.memberQuestionSourceIds].sort(
        compareModerationPromptCodeUnits,
      ),
      representedQuestionSourceIds,
      representativeQuestionSourceId,
    };
  });
  const representedTopicQuestionIds = new Set(
    packedTopics.flatMap(({ representedQuestionSourceIds }) => representedQuestionSourceIds),
  );

  const packedSignals = stableSourceOrder(
    [...selection.signalIds]
      .map((sourceId) => index.signalById.get(sourceId))
      .filter((signal): signal is AnalysisSignal => Boolean(signal)),
  );
  const packedObjectives = stableSourceOrder(
    [...selection.objectiveIds]
      .map((sourceId) => index.objectiveById.get(sourceId))
      .filter((objective): objective is AnalysisObjective => Boolean(objective)),
  );
  const packedResultIds = [...selection.resultIds].sort(compareModerationPromptCodeUnits);
  const packedFeedbackIds = [...selection.feedbackIds].sort(compareModerationPromptCodeUnits);

  const reachableSourceIds = new Set<string>();
  const includeSource = (sourceId: string): void => {
    if (reachableSourceIds.has(sourceId)) return;
    const source = index.sourceById.get(sourceId);
    if (!source) return;
    reachableSourceIds.add(sourceId);
    if (source.kind === 'quiz-result-aggregate' && source.scope.kind === 'question') {
      includeSource(source.scope.questionSourceId);
    }
  };
  packedQuestions.forEach(({ sourceId }) => includeSource(sourceId));
  packedTopics.forEach((topic) => {
    includeSource(topic.sourceId);
    topic.memberQuestionSourceIds.forEach(includeSource);
    topic.representedQuestionSourceIds.forEach(includeSource);
    includeSource(topic.representativeQuestionSourceId);
    if (topic.labelOrigin.kind === 'source-extractive') {
      includeSource(topic.labelOrigin.sourceQuestionId);
    } else if (topic.labelOrigin.kind === 'model-generated') {
      topic.labelOrigin.derivedFromSourceIds.forEach(includeSource);
    }
  });
  packedSignals.forEach((signal) => {
    includeSource(signal.sourceId);
    signal.questionSourceIds.forEach(includeSource);
    signal.evidence.forEach(({ sourceId }) => includeSource(sourceId));
  });
  packedObjectives.forEach((objective) => {
    includeSource(objective.sourceId);
    if (objective.scope.kind === 'tasks') objective.scope.taskSourceIds.forEach(includeSource);
    if (objective.origin.kind === 'model-derived') {
      objective.origin.derivedFromSourceIds.forEach(includeSource);
    }
  });
  packedResultIds.forEach(includeSource);
  packedFeedbackIds.forEach(includeSource);

  const packedSources = [...reachableSourceIds]
    .sort(compareModerationPromptCodeUnits)
    .flatMap((sourceId) => {
      const source = index.sourceById.get(sourceId);
      if (!source) return [];
      if (
        source.kind === 'qa-question' &&
        source.content.state === 'included' &&
        (!selectedQuestionTextSourceIds.has(source.id) ||
          (index.canonicalQuestionIdById.has(source.id) &&
            !index.canonicalQuestionIds.has(source.id)))
      ) {
        return [
          {
            ...source,
            content: {
              state: 'reference-only' as const,
              reason: index.canonicalQuestionIds.has(source.id)
                ? ('budget-truncated' as const)
                : ('deduplicated' as const),
            },
          },
        ];
      }
      return [source];
    });
  if (packedSources.length > MODERATION_PROMPT_SOURCE_LIMIT) {
    throw new ModerationPromptSourceLimitError();
  }

  const deduplicatedQuestionCount = Math.min(
    analysis.questions.state === 'available' ? analysis.questions.corpus.analyzed : 0,
    index.canonicalQuestionIds.size,
  );
  const truncations: ModerationPromptBudgetV1['truncations'] = [];
  const packedModelQuestionTexts = packedSources.filter(
    (source) =>
      source.kind === 'quiz-question' ||
      (source.kind === 'qa-question' && source.content.state === 'included'),
  ).length;
  const limitOrBudget = (
    section: ModerationPromptSection,
    selectedItems: number,
    configuredItemLimit: number,
  ) =>
    sourceLimitedSections.has(section) || selectedItems >= configuredItemLimit
      ? ('item-limit' as const)
      : ('token-budget' as const);
  if (analysis.questions.state === 'available') {
    addTruncation(
      truncations,
      'questions',
      analysis.questions.corpus.analyzed - deduplicatedQuestionCount,
      'deduplication',
    );
    addTruncation(
      truncations,
      'questions',
      deduplicatedQuestionCount - packedQuestions.length,
      limitOrBudget(
        'questions',
        packedModelQuestionTexts,
        analysis.scope.selectionLimits.questions,
      ),
    );
  }
  if (analysis.topics.state === 'available') {
    addTruncation(
      truncations,
      'topics',
      analysis.topics.items.length - packedTopics.length,
      limitOrBudget('topics', packedTopics.length, analysis.scope.selectionLimits.topics),
    );
  }
  if (analysis.compass.state === 'available') {
    addTruncation(
      truncations,
      'compass',
      analysis.compass.signals.length - packedSignals.length,
      limitOrBudget('compass', packedSignals.length, analysis.scope.selectionLimits.compassSignals),
    );
  }
  if (analysis.learningContext.state === 'available') {
    addTruncation(
      truncations,
      'learning-context',
      analysis.learningContext.objectives.length - packedObjectives.length,
      limitOrBudget(
        'learning-context',
        packedObjectives.length,
        analysis.scope.selectionLimits.learningObjectives,
      ),
    );
  }
  if (analysis.releasedResults.state === 'available') {
    addTruncation(
      truncations,
      'released-results',
      analysis.releasedResults.aggregates.length - packedResultIds.length,
      limitOrBudget(
        'released-results',
        packedResultIds.length,
        analysis.scope.selectionLimits.resultAggregates,
      ),
    );
  }
  if (analysis.feedback.state === 'available') {
    addTruncation(
      truncations,
      'feedback',
      analysis.feedback.aggregates.length - packedFeedbackIds.length,
      limitOrBudget(
        'feedback',
        packedFeedbackIds.length,
        analysis.scope.selectionLimits.feedbackAggregates,
      ),
    );
  }

  const limitations = new Map(
    [...analysis.limitations]
      .sort((left, right) =>
        compareModerationPromptCodeUnits(limitationKey(left), limitationKey(right)),
      )
      .map((limitation) => [limitationKey(limitation), limitation] as const),
  );
  for (const truncation of truncations) {
    if (truncation.reason !== 'token-budget' || limitations.size >= 100) continue;
    const limitation = {
      code: 'budget-truncated' as const,
      section: truncation.section,
      detail: `${truncation.omittedItems} item(s) were omitted by deterministic prompt packing.`,
    };
    limitations.set(limitationKey(limitation), limitation);
  }

  const promptContext = {
    ...analysis,
    representation: 'prompt-selection' as const,
    meta: {
      ...analysis.meta,
      selectionVersion: MODERATION_PROMPT_SELECTION_VERSION,
    },
    questions:
      analysis.questions.state === 'available'
        ? {
            ...analysis.questions,
            corpus: {
              ...analysis.questions.corpus,
              deduplicated: deduplicatedQuestionCount,
              represented: packedQuestions.length,
            },
            items: packedQuestions,
          }
        : analysis.questions,
    topics:
      analysis.topics.state === 'available'
        ? {
            ...analysis.topics,
            corpus: {
              ...analysis.topics.corpus,
              representedQuestions: representedTopicQuestionIds.size,
            },
            items: packedTopics,
          }
        : analysis.topics,
    compass:
      analysis.compass.state === 'available'
        ? {
            ...analysis.compass,
            signals: packedSignals,
            primarySignalSourceId:
              analysis.compass.primarySignalSourceId &&
              selection.signalIds.has(analysis.compass.primarySignalSourceId)
                ? analysis.compass.primarySignalSourceId
                : (packedSignals[0]?.sourceId ?? null),
          }
        : analysis.compass,
    learningContext:
      analysis.learningContext.state === 'available'
        ? { ...analysis.learningContext, objectives: packedObjectives }
        : analysis.learningContext,
    releasedResults:
      analysis.releasedResults.state === 'available'
        ? {
            ...analysis.releasedResults,
            aggregates: packedResultIds.map((sourceId) => ({ sourceId })),
          }
        : analysis.releasedResults,
    feedback:
      analysis.feedback.state === 'available'
        ? {
            ...analysis.feedback,
            aggregates: packedFeedbackIds.map((sourceId) => ({ sourceId })),
          }
        : analysis.feedback,
    sources: packedSources,
    limitations: [...limitations.values()],
  };

  return {
    context: ModerationPromptDomainContextV1Schema.parse(promptContext),
    truncations,
  };
}

function buildBudget(
  context: ModerationPromptDomainContextV1,
  profile: ModerationPromptPackingProfile,
  truncations: ModerationPromptBudgetV1['truncations'],
): ModerationPromptBudgetV1 {
  const instructionTokens = estimateModerationPromptUtf8Tokens(profile.instructionText);
  const definitionTokens = estimateModerationPromptUtf8Tokens(profile.definitionText);
  const dataTokens = estimateModerationPromptUtf8Tokens(canonicalModerationPromptJson(context));
  return {
    version: MODERATION_PROMPT_BUDGET_VERSION,
    tokenizer: {
      method: 'conservative-estimate',
      id: MODERATION_PROMPT_UTF8_ESTIMATOR_ID,
      version: MODERATION_PROMPT_UTF8_ESTIMATOR_VERSION,
    },
    modelProfile: profile.modelProfile,
    contextWindowTokens: profile.contextWindowTokens,
    instructionTokens,
    definitionTokens,
    dataTokens,
    packedInputTokens: instructionTokens + definitionTokens + dataTokens,
    reservedOutputTokens: profile.reservedOutputTokens,
    safetyMarginTokens: profile.safetyMarginTokens,
    truncations,
  };
}

function buildCandidate(
  analysis: AnalysisDomain,
  index: PackingIndex,
  selection: Selection,
  profile: ModerationPromptPackingProfile,
  sourceLimitedSections?: ReadonlySet<ModerationPromptSection>,
): CandidateBuildResult {
  let built: DomainBuild;
  try {
    built = buildDomainContext(analysis, index, selection, sourceLimitedSections);
  } catch (error) {
    return {
      status: 'rejected',
      reason: error instanceof ModerationPromptSourceLimitError ? 'source-limit' : 'invalid',
    };
  }
  const budget = buildBudget(built.context, profile, built.truncations);
  const parsed = ModerationPromptContextV1Schema.safeParse({
    schemaVersion: MODERATION_PROMPT_CONTEXT_SCHEMA_VERSION,
    contractVersion: MODERATION_PROMPT_CONTEXT_CONTRACT_VERSION,
    packedAt: '2000-01-01T00:00:00.000Z',
    hashAlgorithm: 'sha-256',
    hashMaterialVersion: MODERATION_PROMPT_HASH_MATERIAL_VERSION,
    snapshotHash: '0'.repeat(64),
    context: built.context,
    budget,
  });
  return parsed.success
    ? { status: 'accepted', candidate: { context: built.context, budget } }
    : { status: 'rejected', reason: 'invalid' };
}

export function packModerationPromptContext(
  input: PackModerationPromptContextInput,
): ModerationPromptContextV1 {
  const analysis = ModerationAnalysisContextV1Schema.parse(input.analysis);
  assertPackingProfile(input.profile);
  const index = buildPackingIndex(analysis.context);
  let selection = emptySelection();
  const base = buildCandidate(analysis.context, index, selection, input.profile);
  if (base.status === 'rejected') {
    throw new Error('Moderation prompt base metadata exceeds the configured context budget.');
  }

  const sourceLimitedSections = new Set<ModerationPromptSection>();
  const candidates = prioritizeCandidateBundles(
    buildCandidateBundles(analysis.context, index),
    input.candidatePriority,
  );
  for (const candidate of candidates) {
    const trial = cloneSelection(selection);
    addCandidateBundle(trial, index, candidate);
    const trialBuild = buildCandidate(analysis.context, index, trial, input.profile);
    if (trialBuild.status === 'accepted') {
      selection = trial;
    } else if (trialBuild.reason === 'source-limit') {
      sourceLimitedSections.add(candidateSection(candidate.kind));
    }
  }

  const finalBuild = buildCandidate(
    analysis.context,
    index,
    selection,
    input.profile,
    sourceLimitedSections,
  );
  if (finalBuild.status === 'rejected') {
    throw new Error('Moderation prompt packing failed after deterministic selection.');
  }
  const packed = finalBuild.candidate;
  const snapshotHash = hashModerationPromptContextMaterial(
    packed.context,
    packed.budget,
    input.profile,
  );
  return ModerationPromptContextV1Schema.parse({
    schemaVersion: MODERATION_PROMPT_CONTEXT_SCHEMA_VERSION,
    contractVersion: MODERATION_PROMPT_CONTEXT_CONTRACT_VERSION,
    packedAt: (input.packedAt ?? new Date()).toISOString(),
    hashAlgorithm: 'sha-256',
    hashMaterialVersion: MODERATION_PROMPT_HASH_MATERIAL_VERSION,
    snapshotHash,
    context: packed.context,
    budget: packed.budget,
  });
}

type CacheEntry = {
  readonly sessionId: string;
  readonly expiresAt: number;
  readonly value: ModerationPromptContextV1;
};

/** Analyzed Q&A questions present but no model-visible included question texts. */
export function isEmptyQaEvidencePack(promptContext: ModerationPromptContextV1): boolean {
  const analyzed =
    promptContext.context.questions.state === 'available'
      ? promptContext.context.questions.corpus.analyzed
      : 0;
  if (analyzed === 0) return false;
  return !promptContext.context.sources.some(
    (source) => source.kind === 'qa-question' && source.content.state === 'included',
  );
}

export type FreshlyAuthorizedPackingResult = Readonly<{
  promptContext: ModerationPromptContextV1;
  cache: 'hit' | 'miss' | 'purge-fenced';
}>;

/**
 * This cache intentionally has no session-id-only read API. A caller can reach
 * an entry only by supplying the complete, freshly host-authorized analysis
 * context again; authorization and source collection therefore always happen
 * before a cache lookup.
 */
export class ModerationPromptPackingCache {
  readonly #entries = new Map<string, CacheEntry>();
  #purgedUntil = 0;

  constructor(
    private readonly options: Readonly<{
      ttlMs?: number;
      maxEntries?: number;
      now?: () => number;
    }> = {},
  ) {
    const ttlMs = options.ttlMs ?? MODERATION_PROMPT_PACKING_CACHE_TTL_MS;
    const maxEntries = options.maxEntries ?? MODERATION_PROMPT_PACKING_CACHE_MAX_ENTRIES;
    if (
      !Number.isSafeInteger(ttlMs) ||
      ttlMs <= 0 ||
      !Number.isSafeInteger(maxEntries) ||
      maxEntries <= 0
    ) {
      throw new Error('Invalid moderation prompt packing cache bounds.');
    }
  }

  get size(): number {
    return this.#entries.size;
  }

  getOrPackFreshlyAuthorized(input: {
    readonly sessionId: string;
    readonly analysis: ModerationAnalysisContextV1;
    readonly profile: ModerationPromptPackingProfile;
    readonly packedAt?: Date;
    readonly pack?: (input: PackModerationPromptContextInput) => ModerationPromptContextV1;
  }): FreshlyAuthorizedPackingResult {
    const sessionId = input.sessionId.trim();
    if (!sessionId) throw new Error('A session ID is required for moderation prompt caching.');
    const pack = input.pack ?? packModerationPromptContext;
    const packInput: PackModerationPromptContextInput = {
      analysis: input.analysis,
      profile: input.profile,
      packedAt: input.packedAt,
    };
    const now = this.#now();
    this.#prune(now);
    const semanticHash = hashModerationAnalysisForPacking(input.analysis, input.profile);
    const key = `${sessionId}:${semanticHash}`;
    if (this.#purgedUntil > now) {
      return {
        promptContext: pack(packInput),
        cache: 'purge-fenced',
      };
    }

    const cached = this.#entries.get(key);
    if (cached && cached.expiresAt > now) {
      this.#entries.delete(key);
      this.#entries.set(key, cached);
      return { promptContext: structuredClone(cached.value), cache: 'hit' };
    }

    const promptContext = pack(packInput);
    // Do not cache empty-evidence packs: analyzed Q&A with zero included source
    // texts would stick extractive fallback for the TTL and block force-fit retries.
    if (!isEmptyQaEvidencePack(promptContext)) {
      while (this.#entries.size >= this.#maxEntries()) {
        const oldestKey = this.#entries.keys().next().value as string | undefined;
        if (!oldestKey) break;
        this.#entries.delete(oldestKey);
      }
      this.#entries.set(key, {
        sessionId,
        expiresAt: now + this.#ttlMs(),
        value: structuredClone(promptContext),
      });
    }
    return { promptContext, cache: 'miss' };
  }

  invalidateSession(sessionId: string): void {
    const normalized = sessionId.trim();
    if (!normalized) return;
    const now = this.#now();
    this.#prune(now);
    for (const [key, entry] of this.#entries) {
      if (entry.sessionId === normalized) this.#entries.delete(key);
    }
    // A single global fence is deliberately conservative and O(1): an
    // authorization read that started before any session purge cannot refill
    // the cache after that purge, while purge-only traffic cannot accumulate
    // one retained map entry per historical session.
    this.#purgedUntil = Math.max(this.#purgedUntil, now + MODERATION_PROMPT_PURGE_FENCE_MS);
  }

  clear(): void {
    this.#entries.clear();
    this.#purgedUntil = 0;
  }

  #now(): number {
    return this.options.now?.() ?? Date.now();
  }

  #ttlMs(): number {
    return this.options.ttlMs ?? MODERATION_PROMPT_PACKING_CACHE_TTL_MS;
  }

  #maxEntries(): number {
    return this.options.maxEntries ?? MODERATION_PROMPT_PACKING_CACHE_MAX_ENTRIES;
  }

  #prune(now: number): void {
    for (const [key, entry] of this.#entries) {
      if (entry.expiresAt <= now) this.#entries.delete(key);
    }
    if (this.#purgedUntil <= now) this.#purgedUntil = 0;
  }
}

const defaultModerationPromptPackingCache = new ModerationPromptPackingCache();

registerSessionPurgeInvalidator(({ sessionId }) => {
  defaultModerationPromptPackingCache.invalidateSession(sessionId);
});

export function packFreshlyAuthorizedModerationPromptContext(input: {
  readonly sessionId: string;
  readonly analysis: ModerationAnalysisContextV1;
  readonly profile: ModerationPromptPackingProfile;
  readonly packedAt?: Date;
  readonly pack?: (input: PackModerationPromptContextInput) => ModerationPromptContextV1;
}): FreshlyAuthorizedPackingResult {
  return defaultModerationPromptPackingCache.getOrPackFreshlyAuthorized(input);
}
