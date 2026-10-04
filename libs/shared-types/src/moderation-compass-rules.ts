import type { QaNlpStatus, QuestionType, QuickFeedbackType, TempoTrendStatus } from './schemas.js';

export const MODERATION_COMPASS_RULES_VERSION = 'moderation-compass-rules-v1' as const;

// `nextStep` remains a frontend presentation-only card kind. The shared planner
// emits only canonical evidence-bearing cards and attaches a structured reason.
export const MODERATION_COMPASS_CARD_KINDS = [
  'topics',
  'clarification',
  'friction',
  'tempo',
] as const;
export type ModerationCompassCardKind = (typeof MODERATION_COMPASS_CARD_KINDS)[number];

export const MODERATION_COMPASS_VISIBLE_SOURCE_COUNT = 3;
export const MODERATION_COMPASS_STORED_SOURCE_COUNT = 8;

export const MODERATION_COMPASS_RULE_THRESHOLDS = {
  topic: {
    minimumDocumentFrequency: 2,
    minimumSourceCount: 2,
    maximumTermsPerChannel: 5,
  },
  quiz: {
    maximumFactsPerQuestion: 6,
    inBandPercentExclusiveMaximum: 50,
    histogramMinimumResponses: 8,
    histogramMinimumPeakShare: 0.3,
    roundInBandDeltaMaximum: -5,
    medianMinimumRelativeDeviation: 0.1,
    spreadMinimumResponses: 8,
    spreadBandWidthMultiplier: 0.75,
    ratingMinimumResponses: 3,
    ratingMaximumAverage: 2.5,
    repeatedTextMinimumLength: 8,
    repeatedTextMinimumCount: 2,
  },
  feedback: {
    minimumResponses: 3,
    ratingMaximumAverage: 2.5,
    majorityMinimumShare: 0.6,
    splitSecondMinimumShare: 0.3,
  },
} as const;

const NEGATIVE_FEEDBACK_KEYS = new Set(['NEGATIVE', 'NO', 'FALSE', 'LOST', 'SLOW_DOWN', '1', '2']);

export type ModerationCompassQuizInsightKind = 'scorable' | 'survey' | 'rating';

export type ModerationCompassQuizQuestion = {
  readonly type?: QuestionType;
  readonly totalVotes?: number;
  readonly correctVoterCount?: number;
  readonly incorrectVoterCount?: number;
  readonly voteDistribution?: readonly {
    readonly text: string;
    readonly isCorrect: boolean;
    readonly voteCount: number;
  }[];
  readonly numericReferenceValue?: number | null;
  readonly numericIntervalLeft?: number | null;
  readonly numericIntervalRight?: number | null;
  readonly numericStats?: {
    readonly n: number;
    readonly median?: number | null;
    readonly stdDev?: number | null;
    readonly inBandPercent?: number | null;
  } | null;
  readonly numericHistogram?: readonly {
    readonly from: number;
    readonly to: number;
    readonly count: number;
    readonly inBand: boolean;
  }[];
  readonly numericRoundComparison?: {
    readonly inBandPercentDelta?: number | null;
    readonly pairedAnalysis?: {
      readonly fartherCount: number;
      readonly closerCount: number;
    } | null;
  } | null;
  readonly roundComparison?: {
    readonly round1CorrectCount?: number;
    readonly round2CorrectCount?: number;
  } | null;
  readonly matchingStats?: {
    readonly totalVotes: number;
    readonly fullyCorrectCount: number;
    readonly commonConfusions?: readonly {
      readonly left: string;
      readonly wrongRight: string;
      readonly count: number;
    }[];
  } | null;
  readonly orderingStats?: {
    readonly totalVotes: number;
    readonly fullyCorrectCount: number;
    readonly commonSwaps?: readonly {
      readonly itemAText: string;
      readonly itemBText: string;
      readonly count: number;
    }[];
  } | null;
  readonly categorizationStats?: {
    readonly totalVotes: number;
    readonly fullyCorrectCount: number;
    readonly commonMisclassifications?: readonly {
      readonly itemText: string;
      readonly wrongCategoryName: string;
      readonly count: number;
    }[];
  } | null;
  readonly ratingAvg?: number | null;
  readonly ratingCount?: number;
  readonly freeTextResponses?: readonly string[];
};

export type ModerationQuizFact =
  | { readonly type: 'wrong-majority'; readonly incorrect: number; readonly total: number }
  | { readonly type: 'in-band'; readonly percent: number }
  | { readonly type: 'numeric-round-worse'; readonly percentPoints: number }
  | { readonly type: 'numeric-round-farther' }
  | { readonly type: 'matching-confusion'; readonly left: string; readonly wrong: string }
  | { readonly type: 'ordering-swap'; readonly a: string; readonly b: string }
  | { readonly type: 'categorization-miss'; readonly item: string; readonly wrongCategory: string }
  | { readonly type: 'wrong-option'; readonly option: string }
  | { readonly type: 'survey-top'; readonly option: string; readonly share: number }
  | { readonly type: 'numeric-median'; readonly median: number; readonly reference: number }
  | { readonly type: 'numeric-spread' }
  | {
      readonly type: 'histogram-peak-out';
      readonly from: number;
      readonly to: number;
      readonly share: number;
    }
  | { readonly type: 'round-drop' }
  | { readonly type: 'rating-low'; readonly avg: number }
  | { readonly type: 'freetext-repeat'; readonly text: string; readonly count: number };

export function collectModerationQuizFacts(
  question: ModerationCompassQuizQuestion,
): ModerationQuizFact[] {
  if (question.type === 'SURVEY') {
    return collectSurveyQuizFacts(question);
  }
  if (question.type === 'RATING') {
    return collectRatingQuizFacts(question);
  }
  if (question.type === 'FREETEXT') {
    return collectFreetextQuizFacts(question);
  }
  return collectScorableQuizFacts(question);
}

function topVoteDistributionOption(
  voteDistribution: ModerationCompassQuizQuestion['voteDistribution'],
): { text: string; voteCount: number } | null {
  const top = [...(voteDistribution ?? [])]
    .filter((option) => option.voteCount > 0)
    .sort((left, right) => right.voteCount - left.voteCount)[0];
  return top ?? null;
}

function collectSurveyQuizFacts(question: ModerationCompassQuizQuestion): ModerationQuizFact[] {
  const facts: ModerationQuizFact[] = [];
  const total = question.totalVotes ?? 0;
  const top = topVoteDistributionOption(question.voteDistribution);
  if (top && total > 0) {
    facts.push({
      type: 'survey-top',
      option: top.text,
      share: Math.round((top.voteCount / total) * 100),
    });
  }
  const repeat = mostCommonFreeText(question.freeTextResponses ?? []);
  if (repeat) {
    facts.push(repeat);
  }
  return facts.slice(0, MODERATION_COMPASS_RULE_THRESHOLDS.quiz.maximumFactsPerQuestion);
}

function collectRatingQuizFacts(question: ModerationCompassQuizQuestion): ModerationQuizFact[] {
  const facts: ModerationQuizFact[] = [];
  if (
    typeof question.ratingAvg === 'number' &&
    (question.ratingCount ?? 0) >= MODERATION_COMPASS_RULE_THRESHOLDS.quiz.ratingMinimumResponses &&
    question.ratingAvg <= MODERATION_COMPASS_RULE_THRESHOLDS.quiz.ratingMaximumAverage
  ) {
    facts.push({ type: 'rating-low', avg: question.ratingAvg });
  }
  const repeat = mostCommonFreeText(question.freeTextResponses ?? []);
  if (repeat) {
    facts.push(repeat);
  }
  return facts.slice(0, MODERATION_COMPASS_RULE_THRESHOLDS.quiz.maximumFactsPerQuestion);
}

function collectFreetextQuizFacts(question: ModerationCompassQuizQuestion): ModerationQuizFact[] {
  const repeat = mostCommonFreeText(question.freeTextResponses ?? []);
  return repeat ? [repeat] : [];
}

function collectScorableQuizFacts(question: ModerationCompassQuizQuestion): ModerationQuizFact[] {
  const facts: ModerationQuizFact[] = [];
  const correct = question.correctVoterCount;
  const incorrect = question.incorrectVoterCount;
  const total = question.totalVotes;
  if (
    typeof correct === 'number' &&
    typeof incorrect === 'number' &&
    typeof total === 'number' &&
    total > 0 &&
    incorrect > correct
  ) {
    facts.push({ type: 'wrong-majority', incorrect, total });
  }

  const inBandPercent = question.numericStats?.inBandPercent;
  if (
    typeof inBandPercent === 'number' &&
    inBandPercent < MODERATION_COMPASS_RULE_THRESHOLDS.quiz.inBandPercentExclusiveMaximum
  ) {
    facts.push({ type: 'in-band', percent: Math.round(inBandPercent) });
  }

  const histogramPeak =
    typeof inBandPercent === 'number' ? outOfBandHistogramPeak(question.numericHistogram) : null;
  if (histogramPeak) {
    facts.push(histogramPeak);
  }

  const inBandDelta = question.numericRoundComparison?.inBandPercentDelta;
  if (
    typeof inBandDelta === 'number' &&
    inBandDelta <= MODERATION_COMPASS_RULE_THRESHOLDS.quiz.roundInBandDeltaMaximum
  ) {
    facts.push({ type: 'numeric-round-worse', percentPoints: Math.round(Math.abs(inBandDelta)) });
  }

  const paired = question.numericRoundComparison?.pairedAnalysis;
  if (paired && paired.fartherCount > paired.closerCount && paired.fartherCount > 0) {
    facts.push({ type: 'numeric-round-farther' });
  }

  const confusion = question.matchingStats?.commonConfusions?.[0];
  if (confusion && confusion.count > 0) {
    facts.push({
      type: 'matching-confusion',
      left: confusion.left,
      wrong: confusion.wrongRight,
    });
  }

  const swap = question.orderingStats?.commonSwaps?.[0];
  if (swap && swap.count > 0) {
    facts.push({ type: 'ordering-swap', a: swap.itemAText, b: swap.itemBText });
  }

  const miss = question.categorizationStats?.commonMisclassifications?.[0];
  if (miss && miss.count > 0) {
    facts.push({
      type: 'categorization-miss',
      item: miss.itemText,
      wrongCategory: miss.wrongCategoryName,
    });
  }

  const wrongOption = [...(question.voteDistribution ?? [])]
    .filter((option) => !option.isCorrect && option.voteCount > 0)
    .sort((left, right) => right.voteCount - left.voteCount)[0];
  if (wrongOption) {
    facts.push({ type: 'wrong-option', option: wrongOption.text });
  }

  const median = question.numericStats?.median;
  const reference = question.numericReferenceValue;
  if (
    typeof median === 'number' &&
    typeof reference === 'number' &&
    Number.isFinite(median) &&
    Number.isFinite(reference)
  ) {
    const gap = Math.abs(median - reference);
    const scale = Math.max(Math.abs(reference), 1);
    if (gap / scale >= MODERATION_COMPASS_RULE_THRESHOLDS.quiz.medianMinimumRelativeDeviation) {
      facts.push({ type: 'numeric-median', median, reference });
    }
  }

  const stdDev = question.numericStats?.stdDev;
  const left = question.numericIntervalLeft;
  const right = question.numericIntervalRight;
  const bandWidth = typeof left === 'number' && typeof right === 'number' ? right - left : null;
  if (
    (question.numericStats?.n ?? 0) >=
      MODERATION_COMPASS_RULE_THRESHOLDS.quiz.spreadMinimumResponses &&
    typeof stdDev === 'number' &&
    typeof bandWidth === 'number' &&
    bandWidth > 0 &&
    stdDev > bandWidth * MODERATION_COMPASS_RULE_THRESHOLDS.quiz.spreadBandWidthMultiplier
  ) {
    facts.push({ type: 'numeric-spread' });
  }

  const round1 = question.roundComparison?.round1CorrectCount;
  const round2 = question.roundComparison?.round2CorrectCount;
  if (typeof round1 === 'number' && typeof round2 === 'number' && round2 < round1) {
    facts.push({ type: 'round-drop' });
  }

  const repeat = mostCommonFreeText(question.freeTextResponses ?? []);
  if (repeat) {
    facts.push(repeat);
  }

  return facts.slice(0, MODERATION_COMPASS_RULE_THRESHOLDS.quiz.maximumFactsPerQuestion);
}

function outOfBandHistogramPeak(
  histogram: ModerationCompassQuizQuestion['numericHistogram'],
): Extract<ModerationQuizFact, { type: 'histogram-peak-out' }> | null {
  if (!histogram?.length) {
    return null;
  }
  const total = histogram.reduce((sum, bin) => sum + positiveCount(bin.count), 0);
  if (total < MODERATION_COMPASS_RULE_THRESHOLDS.quiz.histogramMinimumResponses) {
    return null;
  }
  const peak = [...histogram].sort(
    (left, right) => positiveCount(right.count) - positiveCount(left.count),
  )[0];
  if (
    !peak ||
    peak.inBand ||
    positiveCount(peak.count) / total <
      MODERATION_COMPASS_RULE_THRESHOLDS.quiz.histogramMinimumPeakShare
  ) {
    return null;
  }
  return {
    type: 'histogram-peak-out',
    from: peak.from,
    to: peak.to,
    share: Math.round((positiveCount(peak.count) / total) * 100),
  };
}

function mostCommonFreeText(
  responses: readonly string[],
): Extract<ModerationQuizFact, { type: 'freetext-repeat' }> | null {
  const counts = new Map<string, number>();
  for (const response of responses) {
    const normalized = response.trim().replace(/\s+/g, ' ');
    if (normalized.length < MODERATION_COMPASS_RULE_THRESHOLDS.quiz.repeatedTextMinimumLength) {
      continue;
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  const winner = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];
  if (!winner || winner[1] < MODERATION_COMPASS_RULE_THRESHOLDS.quiz.repeatedTextMinimumCount) {
    return null;
  }
  return { type: 'freetext-repeat', text: winner[0], count: winner[1] };
}

function positiveCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

export function notableQuickFeedbackSplit(
  totalVotes: number,
  distribution: Readonly<Record<string, number>>,
): {
  majorityKey: string | null;
  majorityRatio: number;
  split: boolean;
  starAverage: number | null;
} {
  const entries = Object.entries(distribution)
    .map(([key, count]) => [key, positiveCount(count)] as const)
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1]);
  const top = entries[0];
  const second = entries[1];
  const majorityRatio = top && totalVotes > 0 ? top[1] / totalVotes : 0;
  const secondRatio = second && totalVotes > 0 ? second[1] / totalVotes : 0;
  return {
    majorityKey: top?.[0] ?? null,
    majorityRatio,
    split:
      majorityRatio < MODERATION_COMPASS_RULE_THRESHOLDS.feedback.majorityMinimumShare &&
      secondRatio >= MODERATION_COMPASS_RULE_THRESHOLDS.feedback.splitSecondMinimumShare,
    starAverage: starAverage(distribution, totalVotes),
  };
}

function starAverage(
  distribution: Readonly<Record<string, number>>,
  totalVotes: number,
): number | null {
  if (totalVotes <= 0) {
    return null;
  }
  let weighted = 0;
  let counted = 0;
  for (const [key, count] of Object.entries(distribution)) {
    const stars = Number.parseInt(key, 10);
    if (Number.isInteger(stars) && stars >= 1 && stars <= 5) {
      weighted += stars * positiveCount(count);
      counted += positiveCount(count);
    }
  }
  return counted > 0 ? weighted / counted : null;
}

export function isNegativeFeedbackKey(key: string | null): boolean {
  return key !== null && NEGATIVE_FEEDBACK_KEYS.has(key);
}

export type ModerationCompassFeedbackTrigger =
  | { readonly type: 'tempo-trend'; readonly status: Exclude<TempoTrendStatus, 'NEUTRAL'> }
  | { readonly type: 'rating-low'; readonly average: number }
  | { readonly type: 'split' }
  | { readonly type: 'negative-majority'; readonly key: string; readonly share: number };

export type ModerationCompassFeedbackDecision = {
  readonly variant: 'tempo' | 'feedback';
  readonly tone: 'good' | 'caution' | 'alert';
  readonly trigger: ModerationCompassFeedbackTrigger;
  readonly ruleScore: 1;
};

export function collectModerationFeedbackDecision(input: {
  readonly type: QuickFeedbackType;
  readonly totalVotes: number;
  readonly distribution: Readonly<Record<string, number>>;
  readonly tempoTrend?: { readonly status: TempoTrendStatus } | null;
}): ModerationCompassFeedbackDecision | null {
  if (input.type === 'TEMPO') {
    const status = input.tempoTrend?.status;
    if (!status || status === 'NEUTRAL') {
      return null;
    }
    const tone = status === 'FOLLOWING' ? 'good' : status === 'LOST' ? 'alert' : 'caution';
    return {
      variant: 'tempo',
      tone,
      trigger: { type: 'tempo-trend', status },
      ruleScore: 1,
    };
  }
  if (input.totalVotes < MODERATION_COMPASS_RULE_THRESHOLDS.feedback.minimumResponses) {
    return null;
  }
  const summary = notableQuickFeedbackSplit(input.totalVotes, input.distribution);
  if (
    summary.starAverage !== null &&
    summary.starAverage <= MODERATION_COMPASS_RULE_THRESHOLDS.feedback.ratingMaximumAverage
  ) {
    return {
      variant: 'feedback',
      tone: 'caution',
      trigger: { type: 'rating-low', average: summary.starAverage },
      ruleScore: 1,
    };
  }
  if (summary.split) {
    return {
      variant: 'feedback',
      tone: 'caution',
      trigger: { type: 'split' },
      ruleScore: 1,
    };
  }
  if (
    summary.majorityRatio >= MODERATION_COMPASS_RULE_THRESHOLDS.feedback.majorityMinimumShare &&
    isNegativeFeedbackKey(summary.majorityKey)
  ) {
    return {
      variant: 'feedback',
      tone: 'caution',
      trigger: {
        type: 'negative-majority',
        key: summary.majorityKey!,
        share: summary.majorityRatio,
      },
      ruleScore: 1,
    };
  }
  return null;
}

export type ModerationCompassSortMode = 'TOP' | 'BEST' | 'CONTROVERSIAL' | 'TIME';

export type ModerationCompassRuleQuestion = {
  readonly sourceId: string;
  readonly status: 'PENDING' | 'ACTIVE' | 'PINNED' | 'ARCHIVED' | 'DELETED';
  readonly isControversial?: boolean;
  readonly positiveVoteCount?: number;
  readonly negativeVoteCount?: number;
  readonly score?: number;
  readonly bestScore?: number;
  readonly controversyScore?: number;
};

function qaRankValue(
  question: ModerationCompassRuleQuestion,
  sortMode: ModerationCompassSortMode | undefined,
): number {
  if (sortMode === 'BEST') {
    return question.bestScore ?? 0;
  }
  if (sortMode === 'CONTROVERSIAL') {
    return question.controversyScore ?? 0;
  }
  if (typeof question.score === 'number') {
    return question.score;
  }
  return (question.positiveVoteCount ?? 0) - (question.negativeVoteCount ?? 0);
}

function compareQaQuestions(
  left: ModerationCompassRuleQuestion,
  right: ModerationCompassRuleQuestion,
  sortMode: ModerationCompassSortMode | undefined,
): number {
  const rankDiff = qaRankValue(right, sortMode) - qaRankValue(left, sortMode);
  return rankDiff !== 0 ? rankDiff : left.sourceId.localeCompare(right.sourceId);
}

export function selectPendingModerationQuestionSourceIds(
  questions: readonly ModerationCompassRuleQuestion[],
  sortMode?: ModerationCompassSortMode,
): string[] {
  return questions
    .filter((question) => question.status === 'PENDING')
    .sort((left, right) => compareQaQuestions(left, right, sortMode))
    .map((question) => question.sourceId);
}

export function selectFrictionQuestionSourceIds(
  questions: readonly ModerationCompassRuleQuestion[],
): string[] {
  return questions
    .filter(
      (question) =>
        (question.status === 'ACTIVE' || question.status === 'PINNED') &&
        question.isControversial === true,
    )
    .sort((left, right) => {
      const scoreDiff = (right.controversyScore ?? 0) - (left.controversyScore ?? 0);
      return scoreDiff !== 0 ? scoreDiff : left.sourceId.localeCompare(right.sourceId);
    })
    .map((question) => question.sourceId)
    .slice(0, MODERATION_COMPASS_STORED_SOURCE_COUNT);
}

export type ModerationCompassTopicRuleSource = {
  readonly sourceId: string;
  readonly dedupeKey?: string;
};

export type ModerationCompassTopicTermRuleSource = ModerationCompassTopicRuleSource & {
  readonly documentFrequency: number;
  readonly sourceCount: number;
};

export function isModerationCompassTopicSupported(
  term: Pick<ModerationCompassTopicTermRuleSource, 'documentFrequency' | 'sourceCount'>,
): boolean {
  return (
    term.documentFrequency >= MODERATION_COMPASS_RULE_THRESHOLDS.topic.minimumDocumentFrequency ||
    term.sourceCount >= MODERATION_COMPASS_RULE_THRESHOLDS.topic.minimumSourceCount
  );
}

export function selectModerationCompassTopicSourceIds(input: {
  readonly classified: readonly ModerationCompassTopicRuleSource[];
  readonly qaTerms: readonly ModerationCompassTopicTermRuleSource[];
  readonly freetextTerms: readonly ModerationCompassTopicTermRuleSource[];
  readonly extras: readonly ModerationCompassTopicRuleSource[];
  readonly topicWeight?: ModerationCompassTopicRuleSource | null;
}): string[] {
  const isUsableSource = (source: ModerationCompassTopicRuleSource): boolean => {
    const sourceId = source.sourceId.trim();
    return sourceId.length > 0 && (source.dedupeKey ?? sourceId).trim().length > 0;
  };
  const qa = input.qaTerms
    .filter(isModerationCompassTopicSupported)
    .slice(0, MODERATION_COMPASS_RULE_THRESHOLDS.topic.maximumTermsPerChannel)
    .filter(isUsableSource);
  const freetext = input.freetextTerms
    .filter(isModerationCompassTopicSupported)
    .slice(0, MODERATION_COMPASS_RULE_THRESHOLDS.topic.maximumTermsPerChannel)
    .filter(isUsableSource);
  const extras = input.extras.filter(isUsableSource);
  const mixed: string[] = [];
  const seen = new Set<string>();
  const push = (source: ModerationCompassTopicRuleSource | undefined | null) => {
    if (!source || mixed.length >= MODERATION_COMPASS_STORED_SOURCE_COUNT) {
      return;
    }
    const sourceId = source.sourceId.trim();
    const key = (source.dedupeKey ?? sourceId).trim();
    if (!sourceId || !key || seen.has(key)) {
      return;
    }
    seen.add(key);
    mixed.push(sourceId);
  };

  for (const source of input.classified) {
    push(source);
  }
  push(qa[0]);
  push(freetext[0]);
  push(extras[0]);
  for (const source of [...qa.slice(1), ...freetext.slice(1), ...extras.slice(1)]) {
    push(source);
  }
  if (mixed.length > 0 && mixed.length < MODERATION_COMPASS_VISIBLE_SOURCE_COUNT) {
    push(input.topicWeight);
  }
  return mixed;
}

export type ModerationCompassNextStepReason =
  | 'pending-qa'
  | 'quiz-confusion'
  | 'quiz-survey'
  | 'quiz-rating'
  | 'controversy'
  | 'tempo'
  | 'feedback'
  | 'topics'
  | 'steady';

export type ModerationCompassCardTone = 'neutral' | 'caution' | 'alert';

export type ModerationCompassRuleCard = {
  readonly kind: ModerationCompassCardKind;
  readonly tone: ModerationCompassCardTone;
  readonly sourceIds: readonly string[];
  readonly nextStepReason?: ModerationCompassNextStepReason;
};

export type ModerationCompassFeedbackRuleInput = {
  readonly sourceId: string;
  readonly tone: 'neutral' | 'good' | 'caution' | 'alert';
  readonly variant?: 'tempo' | 'feedback';
};

export type ModerationCompassPlanInput = {
  readonly topicSourceIds: readonly string[];
  readonly pendingQuestionSourceIds: readonly string[];
  readonly frictionQuestionSourceIds: readonly string[];
  readonly quizResultSourceIds: readonly string[];
  readonly quizInsightKind?: ModerationCompassQuizInsightKind | null;
  readonly feedback?: ModerationCompassFeedbackRuleInput | null;
};

export type ModerationCompassRecommendation = {
  readonly reason: ModerationCompassNextStepReason;
  readonly preferredCardKind: ModerationCompassCardKind;
  readonly attachToCard: boolean;
};

export type ModerationCompassRulePlan = {
  readonly rulesVersion: typeof MODERATION_COMPASS_RULES_VERSION;
  readonly cards: readonly ModerationCompassRuleCard[];
  readonly recommendation: ModerationCompassRecommendation | null;
};

const CARD_KIND_ORDER: readonly ModerationCompassCardKind[] = [
  'tempo',
  'friction',
  'clarification',
  'topics',
];

function uniqueNonEmptySourceIds(sourceIds: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const sourceId of sourceIds) {
    const normalized = sourceId.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function nextStepReason(input: {
  pendingCount: number;
  hasQuizConfusion: boolean;
  quizInsightKind?: ModerationCompassQuizInsightKind | null;
  hasFriction: boolean;
  feedbackTone: ModerationCompassFeedbackRuleInput['tone'] | null;
  feedbackVariant?: ModerationCompassFeedbackRuleInput['variant'];
  hasTopics: boolean;
}): ModerationCompassNextStepReason | null {
  if (input.feedbackTone === 'alert') {
    return input.feedbackVariant === 'feedback' ? 'feedback' : 'tempo';
  }
  if (input.hasQuizConfusion) {
    if (input.quizInsightKind === 'survey') {
      return 'quiz-survey';
    }
    if (input.quizInsightKind === 'rating') {
      return 'quiz-rating';
    }
    return 'quiz-confusion';
  }
  if (input.feedbackTone === 'caution') {
    return input.feedbackVariant === 'feedback' ? 'feedback' : 'tempo';
  }
  if (input.pendingCount > 0) {
    return 'pending-qa';
  }
  if (input.hasFriction) {
    return 'controversy';
  }
  if (input.hasTopics) {
    return 'topics';
  }
  if (input.feedbackTone === 'good') {
    return 'steady';
  }
  return null;
}

function nextStepSourceKind(reason: ModerationCompassNextStepReason): ModerationCompassCardKind {
  switch (reason) {
    case 'pending-qa':
    case 'quiz-confusion':
    case 'quiz-survey':
    case 'quiz-rating':
      return 'clarification';
    case 'controversy':
      return 'friction';
    case 'tempo':
    case 'feedback':
    case 'steady':
      return 'tempo';
    case 'topics':
      return 'topics';
  }
}

function nextStepCardTone(
  reason: ModerationCompassNextStepReason,
  feedbackTone: ModerationCompassFeedbackRuleInput['tone'] | null,
): ModerationCompassCardTone {
  if ((reason === 'tempo' || reason === 'feedback') && feedbackTone === 'alert') {
    return 'alert';
  }
  if (reason === 'topics' || reason === 'steady') {
    return 'neutral';
  }
  return 'caution';
}

function preferredNextStepCardIndex(
  cards: readonly ModerationCompassRuleCard[],
  reason: ModerationCompassNextStepReason,
): number {
  const preferredKind = nextStepSourceKind(reason);
  const preferred = cards.findIndex((card) => card.kind === preferredKind);
  if (preferred >= 0) {
    return preferred;
  }
  const tempo = cards.findIndex((card) => card.kind === 'tempo');
  return tempo >= 0 ? tempo : 0;
}

function isTautologicalNextStep(
  reason: ModerationCompassNextStepReason,
  cardKind: ModerationCompassCardKind,
): boolean {
  return (
    (reason === 'pending-qa' && cardKind === 'clarification') ||
    (reason === 'controversy' && cardKind === 'friction') ||
    (reason === 'topics' && cardKind === 'topics')
  );
}

function feedbackCardTone(
  tone: ModerationCompassFeedbackRuleInput['tone'],
): ModerationCompassCardTone {
  if (tone === 'alert') {
    return 'alert';
  }
  if (tone === 'caution') {
    return 'caution';
  }
  return 'neutral';
}

export function planModerationCompass(
  input: ModerationCompassPlanInput,
): ModerationCompassRulePlan {
  const topicSourceIds = uniqueNonEmptySourceIds(input.topicSourceIds).slice(
    0,
    MODERATION_COMPASS_STORED_SOURCE_COUNT,
  );
  const pendingQuestionSourceIds = uniqueNonEmptySourceIds(input.pendingQuestionSourceIds);
  const frictionQuestionSourceIds = uniqueNonEmptySourceIds(input.frictionQuestionSourceIds).slice(
    0,
    MODERATION_COMPASS_STORED_SOURCE_COUNT,
  );
  const quizResultSourceIds = uniqueNonEmptySourceIds(input.quizResultSourceIds).slice(
    0,
    MODERATION_COMPASS_STORED_SOURCE_COUNT,
  );
  const cards: ModerationCompassRuleCard[] = [];

  if (topicSourceIds.length > 0) {
    cards.push({ kind: 'topics', tone: 'neutral', sourceIds: topicSourceIds });
  }

  const quizTake = Math.min(
    quizResultSourceIds.length,
    pendingQuestionSourceIds.length > 0 ? 2 : MODERATION_COMPASS_STORED_SOURCE_COUNT,
  );
  const clarificationSourceIds = [
    ...quizResultSourceIds.slice(0, quizTake),
    ...pendingQuestionSourceIds.slice(0, MODERATION_COMPASS_STORED_SOURCE_COUNT - quizTake),
  ];
  if (clarificationSourceIds.length > 0) {
    cards.push({ kind: 'clarification', tone: 'caution', sourceIds: clarificationSourceIds });
  }

  if (frictionQuestionSourceIds.length > 0) {
    cards.push({ kind: 'friction', tone: 'caution', sourceIds: frictionQuestionSourceIds });
  }

  const feedbackSourceId = input.feedback?.sourceId.trim() ?? '';
  if (input.feedback && feedbackSourceId) {
    cards.push({
      kind: 'tempo',
      tone: feedbackCardTone(input.feedback.tone),
      sourceIds: [feedbackSourceId],
    });
  }

  const feedback = input.feedback && feedbackSourceId ? input.feedback : null;

  const reason = nextStepReason({
    pendingCount: pendingQuestionSourceIds.length,
    hasQuizConfusion: quizResultSourceIds.length > 0,
    quizInsightKind: input.quizInsightKind,
    hasFriction: frictionQuestionSourceIds.length > 0,
    feedbackTone: feedback?.tone ?? null,
    feedbackVariant: feedback?.variant,
    hasTopics: topicSourceIds.length > 0,
  });
  let recommendation: ModerationCompassRecommendation | null = null;
  if (reason && cards.length > 0) {
    const preferredIndex = preferredNextStepCardIndex(cards, reason);
    const sourceCard = cards[preferredIndex];
    if (sourceCard) {
      const attachToCard = cards.length > 1 || !isTautologicalNextStep(reason, sourceCard.kind);
      recommendation = {
        reason,
        preferredCardKind: sourceCard.kind,
        attachToCard,
      };
      if (attachToCard) {
        cards[preferredIndex] = {
          ...sourceCard,
          nextStepReason: reason,
          tone: nextStepCardTone(reason, feedback?.tone ?? null),
        };
      }
    }
  }

  return {
    rulesVersion: MODERATION_COMPASS_RULES_VERSION,
    cards: cards.sort(
      (left, right) => CARD_KIND_ORDER.indexOf(left.kind) - CARD_KIND_ORDER.indexOf(right.kind),
    ),
    recommendation,
  };
}

export type ModerationCompassAnalysisMode =
  'rule-based' | 'disabled' | 'pending' | 'uncertain' | 'failed' | 'classified';

export function resolveModerationCompassAnalysisMode(input: {
  readonly enabled: boolean;
  readonly statuses?: readonly (QaNlpStatus | undefined)[];
}): ModerationCompassAnalysisMode {
  if (!input.enabled) {
    return 'disabled';
  }
  const statuses = (input.statuses ?? []).filter((status): status is QaNlpStatus =>
    Boolean(status),
  );
  if (statuses.includes('pending')) {
    return 'pending';
  }
  if (statuses.includes('failed')) {
    return 'failed';
  }
  if (statuses.includes('classified')) {
    return 'classified';
  }
  if (statuses.includes('uncertain')) {
    return 'uncertain';
  }
  return 'rule-based';
}
