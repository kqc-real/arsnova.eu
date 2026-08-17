import { extractExportQuestionText } from '../../../core/markdown-plain-text.util';

export type ModerationCompassCardKind =
  'topics' | 'clarification' | 'friction' | 'tempo' | 'nextStep';

export type ModerationCompassNextStepReason =
  'pending-qa' | 'quiz-confusion' | 'controversy' | 'tempo' | 'feedback' | 'topics' | 'steady';

export type ModerationCompassSourceKind =
  'qa-question' | 'qa-term' | 'freetext-term' | 'tempo' | 'quiz-result';

export type ModerationCompassLiveChannel = 'quiz' | 'qa' | 'quickFeedback';

export type ModerationCompassSortMode = 'TOP' | 'BEST' | 'CONTROVERSIAL';
export type ModerationCompassAnalysisVariant = 'LEXICAL' | 'THEME';

export type ModerationCompassSourceTarget = {
  readonly channel: ModerationCompassLiveChannel;
  readonly questionId?: string;
  readonly questionIds?: readonly string[];
  readonly surface?: 'word-cloud';
  readonly termLabel?: string;
  readonly memberText?: string;
  readonly memberTexts?: readonly string[];
  readonly sortMode?: ModerationCompassSortMode;
  readonly analysisVariant?: ModerationCompassAnalysisVariant;
};

export type ModerationCompassSource = {
  readonly kind: ModerationCompassSourceKind;
  readonly label: string;
  readonly target?: ModerationCompassSourceTarget;
};

export type ModerationCompassCardTone = 'neutral' | 'caution' | 'alert';

export type ModerationCompassCard = {
  readonly kind: ModerationCompassCardKind;
  readonly sources: readonly ModerationCompassSource[];
  readonly nextStepReason?: ModerationCompassNextStepReason;
  readonly title?: string;
  readonly tone?: ModerationCompassCardTone;
};

export type ModerationCompassQuizSourceCacheEntry = {
  readonly questionId: string;
  readonly sources: readonly ModerationCompassSource[];
};

export type ModerationCompassQaQuestion = {
  readonly id: string;
  readonly text: string;
  readonly status: 'PENDING' | 'ACTIVE' | 'PINNED' | 'ARCHIVED' | 'DELETED';
  readonly isControversial?: boolean;
  readonly positiveVoteCount?: number;
  readonly negativeVoteCount?: number;
  readonly score?: number;
  readonly bestScore?: number;
  readonly controversyScore?: number;
};

export type ModerationCompassTermOrigin = {
  readonly sortMode?: ModerationCompassSortMode;
  readonly analysisVariant?: ModerationCompassAnalysisVariant;
};

export type ModerationCompassTerm = {
  readonly label: string;
  readonly documentFrequency: number;
  readonly sourceCount: number;
  readonly memberTexts: readonly string[];
  readonly memberSourceIds?: readonly string[];
  readonly sortMode?: ModerationCompassSortMode;
  readonly analysisVariant?: ModerationCompassAnalysisVariant;
};

export type ModerationCompassTempo = {
  readonly label: string;
  readonly tone: 'neutral' | 'good' | 'caution' | 'alert';
  readonly variant?: 'tempo' | 'feedback';
  readonly title?: string;
};

export type ModerationCompassSnapshot = {
  readonly qaQuestions: readonly ModerationCompassQaQuestion[];
  readonly qaSortMode?: ModerationCompassSortMode;
  readonly qaTerms: readonly ModerationCompassTerm[];
  readonly freetextTerms: readonly ModerationCompassTerm[];
  readonly extraTopicSources: readonly ModerationCompassSource[];
  readonly topicWeightLabel: string | null;
  readonly tempo: ModerationCompassTempo | null;
  readonly quizSources: readonly ModerationCompassSource[];
};

export type ModerationCompassQuizQuestion = {
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

const MAX_SOURCES = 3;
const MAX_TOPIC_TERMS = 5;
const SOURCE_LABEL_MAX = 88;
const NEGATIVE_FEEDBACK_KEYS = new Set(['NEGATIVE', 'NO', 'FALSE', 'LOST', 'SLOW_DOWN', '1', '2']);

export function truncateCompassLabel(text: string, max = SOURCE_LABEL_MAX): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function truncateCompassLabelAtWord(text: string, max: number): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= max) {
    return trimmed;
  }
  const budget = Math.max(1, max - 1);
  const slice = trimmed.slice(0, budget);
  const breakAt = slice.lastIndexOf(' ');
  const minKeep = Math.max(8, Math.floor(budget * 0.6));
  const kept = (breakAt >= minKeep ? slice.slice(0, breakAt) : slice).trimEnd();
  return `${kept}…`;
}

/** Kurzer Fragetitel für Kompass-Quellen, ohne Markdown und Medien. */
export function compassQuestionStem(text: string, max = 56): string {
  return truncateCompassLabelAtWord(extractExportQuestionText(text, max + 24), max);
}

export function collectModerationQuizFacts(
  question: ModerationCompassQuizQuestion,
): ModerationQuizFact[] {
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
  if (typeof inBandPercent === 'number' && inBandPercent < 50) {
    facts.push({ type: 'in-band', percent: Math.round(inBandPercent) });
  }

  const histogramPeak = outOfBandHistogramPeak(question.numericHistogram);
  if (histogramPeak) {
    facts.push(histogramPeak);
  }

  const inBandDelta = question.numericRoundComparison?.inBandPercentDelta;
  if (typeof inBandDelta === 'number' && inBandDelta <= -5) {
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
    if (gap / scale >= 0.1) {
      facts.push({ type: 'numeric-median', median, reference });
    }
  }

  const stdDev = question.numericStats?.stdDev;
  const left = question.numericIntervalLeft;
  const right = question.numericIntervalRight;
  const bandWidth = typeof left === 'number' && typeof right === 'number' ? right - left : null;
  if (
    (question.numericStats?.n ?? 0) >= 8 &&
    typeof stdDev === 'number' &&
    typeof bandWidth === 'number' &&
    bandWidth > 0 &&
    stdDev > bandWidth * 0.75
  ) {
    facts.push({ type: 'numeric-spread' });
  }

  const round1 = question.roundComparison?.round1CorrectCount;
  const round2 = question.roundComparison?.round2CorrectCount;
  if (typeof round1 === 'number' && typeof round2 === 'number' && round2 < round1) {
    facts.push({ type: 'round-drop' });
  }

  if (
    typeof question.ratingAvg === 'number' &&
    (question.ratingCount ?? 0) >= 3 &&
    question.ratingAvg <= 2.5
  ) {
    facts.push({ type: 'rating-low', avg: question.ratingAvg });
  }

  const repeat = mostCommonFreeText(question.freeTextResponses ?? []);
  if (repeat) {
    facts.push(repeat);
  }

  return facts.slice(0, 6);
}

export function notableQuickFeedbackSplit(
  totalVotes: number,
  distribution: Record<string, number>,
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
    split: majorityRatio < 0.6 && secondRatio >= 0.3,
    starAverage: starAverage(distribution, totalVotes),
  };
}

function positiveCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

function starAverage(distribution: Record<string, number>, totalVotes: number): number | null {
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

function outOfBandHistogramPeak(
  histogram: ModerationCompassQuizQuestion['numericHistogram'],
): Extract<ModerationQuizFact, { type: 'histogram-peak-out' }> | null {
  if (!histogram?.length) {
    return null;
  }
  const total = histogram.reduce((sum, bin) => sum + positiveCount(bin.count), 0);
  if (total < 8) {
    return null;
  }
  const peak = [...histogram].sort(
    (left, right) => positiveCount(right.count) - positiveCount(left.count),
  )[0];
  if (!peak || peak.inBand || positiveCount(peak.count) / total < 0.3) {
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
    if (normalized.length < 8) {
      continue;
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  const winner = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];
  if (!winner || winner[1] < 2) {
    return null;
  }
  return { type: 'freetext-repeat', text: winner[0], count: winner[1] };
}

function termHasEnoughSupport(term: ModerationCompassTerm): boolean {
  return term.documentFrequency >= 2 || term.sourceCount >= 2;
}

function pickTopicTerms(terms: readonly ModerationCompassTerm[]): ModerationCompassTerm[] {
  return terms.filter(termHasEnoughSupport).slice(0, MAX_TOPIC_TERMS);
}

export function compassTermsFromAnalysisEntries(
  entries:
    | readonly {
        readonly label: string;
        readonly count: number;
        readonly members: readonly { readonly text: string; readonly sourceId?: string }[];
      }[]
    | null
    | undefined,
  origin?: ModerationCompassTermOrigin,
): ModerationCompassTerm[] | null {
  if (!entries?.length) {
    return null;
  }

  return entries.map((entry) => {
    const memberSourceIds = entry.members
      .map((member) => member.sourceId?.trim() ?? '')
      .filter((id) => id.length > 0);
    return {
      label: entry.label,
      documentFrequency: entry.count,
      sourceCount: entry.members.length,
      memberTexts: entry.members.map((member) => member.text),
      ...(memberSourceIds.length > 0 ? { memberSourceIds } : {}),
      ...origin,
    };
  });
}

export function rememberModerationQuizSnapshot(
  existing: readonly ModerationCompassQuizSourceCacheEntry[],
  questionId: string,
  sources: readonly ModerationCompassSource[],
  maxQuestions = MAX_SOURCES,
): readonly ModerationCompassQuizSourceCacheEntry[] {
  const nextSources = sources
    .filter((source) => source.label.trim().length > 0)
    .map(withDefaultSourceTarget)
    .slice(0, MAX_SOURCES);
  const next =
    nextSources.length === 0
      ? existing.filter((entry) => entry.questionId !== questionId)
      : [
          { questionId, sources: nextSources },
          ...existing.filter((entry) => entry.questionId !== questionId),
        ].slice(0, maxQuestions);

  if (quizSourceCacheEquals(existing, next)) {
    return existing;
  }
  return next;
}

function quizSourceCacheEquals(
  left: readonly ModerationCompassQuizSourceCacheEntry[],
  right: readonly ModerationCompassQuizSourceCacheEntry[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((entry, index) => {
    const other = right[index];
    return (
      !!other &&
      entry.questionId === other.questionId &&
      entry.sources.length === other.sources.length &&
      entry.sources.every(
        (source, sourceIndex) => source.label === other.sources[sourceIndex]?.label,
      )
    );
  });
}

export function mergeModerationQuizSources(
  current: readonly ModerationCompassSource[],
  cached: readonly ModerationCompassQuizSourceCacheEntry[],
  currentQuestionId: string | null,
  max = MAX_SOURCES,
): ModerationCompassSource[] {
  const merged: ModerationCompassSource[] = [];
  const seen = new Set<string>();
  const push = (source: ModerationCompassSource | undefined) => {
    if (!source || merged.length >= max) {
      return;
    }
    const label = source.label.trim();
    if (!label || seen.has(label)) {
      return;
    }
    seen.add(label);
    merged.push(withDefaultSourceTarget(source));
  };

  for (const source of current) {
    push(source);
  }
  for (const entry of cached) {
    if (entry.questionId === currentQuestionId) {
      continue;
    }
    push(entry.sources[0]);
  }
  return merged;
}

function withDefaultSourceTarget(source: ModerationCompassSource): ModerationCompassSource {
  if (source.target) {
    return source;
  }
  if (source.kind === 'freetext-term' || source.kind === 'quiz-result') {
    return { ...source, target: { channel: 'quiz' } };
  }
  if (source.kind === 'tempo') {
    return { ...source, target: { channel: 'quickFeedback' } };
  }
  return { ...source, target: { channel: 'qa' } };
}

function uniqueNonEmpty(values: readonly string[] | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values ?? []) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function termSources(
  terms: readonly ModerationCompassTerm[],
  kind: Extract<ModerationCompassSourceKind, 'qa-term' | 'freetext-term'>,
): ModerationCompassSource[] {
  const channel = kind === 'freetext-term' ? 'quiz' : 'qa';
  return terms.flatMap((term) => {
    const topic = truncateCompassLabel(term.label);
    if (!topic) {
      return [];
    }
    const memberTexts = uniqueNonEmpty(term.memberTexts);
    const example = memberTexts[0] ? truncateCompassLabel(memberTexts[0], 64) : '';
    const label = example ? `${topic} · ${example}` : topic;
    const memberIds = kind === 'qa-term' ? uniqueNonEmpty(term.memberSourceIds) : [];
    return [
      {
        kind,
        label,
        target: {
          channel,
          surface: 'word-cloud',
          termLabel: topic,
          ...(example ? { memberText: example } : {}),
          ...(memberTexts.length > 0 ? { memberTexts } : {}),
          ...(memberIds[0] ? { questionId: memberIds[0] } : {}),
          ...(memberIds.length > 0 ? { questionIds: memberIds } : {}),
          ...(term.sortMode ? { sortMode: term.sortMode } : {}),
          ...(term.analysisVariant ? { analysisVariant: term.analysisVariant } : {}),
        },
      },
    ];
  });
}

function mixTopicSources(snapshot: ModerationCompassSnapshot): ModerationCompassSource[] {
  const qa = termSources(pickTopicTerms(snapshot.qaTerms), 'qa-term');
  const freetext = termSources(pickTopicTerms(snapshot.freetextTerms), 'freetext-term');
  const extras = snapshot.extraTopicSources
    .filter((source) => source.label.trim().length > 0)
    .map(withDefaultSourceTarget);
  const mixed: ModerationCompassSource[] = [];
  const seen = new Set<string>();
  const push = (source: ModerationCompassSource | undefined) => {
    if (!source || mixed.length >= MAX_SOURCES) {
      return;
    }
    const key = `${source.kind}:${source.label}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    mixed.push(source);
  };

  push(qa[0]);
  push(freetext[0]);
  push(extras[0]);
  for (const source of [...qa.slice(1), ...freetext.slice(1), ...extras.slice(1)]) {
    push(source);
  }
  if (mixed.length > 0 && mixed.length < MAX_SOURCES && snapshot.topicWeightLabel) {
    push({
      kind: 'qa-term',
      label: snapshot.topicWeightLabel,
      target: { channel: 'qa' },
    });
  }
  return mixed;
}

function qaRankValue(
  question: ModerationCompassQaQuestion,
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
  left: ModerationCompassQaQuestion,
  right: ModerationCompassQaQuestion,
  sortMode: ModerationCompassSortMode | undefined,
): number {
  const rankDiff = qaRankValue(right, sortMode) - qaRankValue(left, sortMode);
  if (rankDiff !== 0) {
    return rankDiff;
  }
  return left.id.localeCompare(right.id);
}

function pendingQuestions(
  questions: readonly ModerationCompassQaQuestion[],
  sortMode: ModerationCompassSortMode | undefined,
): ModerationCompassQaQuestion[] {
  return questions
    .filter((question) => question.status === 'PENDING')
    .sort((left, right) => compareQaQuestions(left, right, sortMode));
}

function isFrictionQuestion(question: ModerationCompassQaQuestion): boolean {
  if (question.status === 'ARCHIVED' || question.status === 'DELETED') {
    return false;
  }
  if (question.isControversial === true) {
    return true;
  }
  return (question.controversyScore ?? 0) > 0.5;
}

function controversialQuestions(
  questions: readonly ModerationCompassQaQuestion[],
): ModerationCompassQaQuestion[] {
  return questions.filter(isFrictionQuestion).sort((left, right) => {
    const scoreDiff = (right.controversyScore ?? 0) - (left.controversyScore ?? 0);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return left.id.localeCompare(right.id);
  });
}

function quizConfusionSources(
  sources: readonly ModerationCompassSource[],
): ModerationCompassSource[] {
  return sources
    .filter((source) => source.kind === 'quiz-result' && source.label.trim().length > 0)
    .map(withDefaultSourceTarget)
    .slice(0, MAX_SOURCES);
}

function qaQuestionSource(question: ModerationCompassQaQuestion): ModerationCompassSource | null {
  const label = truncateCompassLabel(question.text);
  if (!label) {
    return null;
  }
  return {
    kind: 'qa-question',
    label,
    target: { channel: 'qa', questionId: question.id },
  };
}

function tempoCardTone(tone: ModerationCompassTempo['tone']): ModerationCompassCardTone {
  if (tone === 'alert') {
    return 'alert';
  }
  if (tone === 'caution') {
    return 'caution';
  }
  return 'neutral';
}

function nextStepCardTone(
  reason: ModerationCompassNextStepReason,
  tempoTone: ModerationCompassTempo['tone'] | null,
): ModerationCompassCardTone {
  if ((reason === 'tempo' || reason === 'feedback') && tempoTone === 'alert') {
    return 'alert';
  }
  if (reason === 'topics' || reason === 'steady') {
    return 'neutral';
  }
  return 'caution';
}

function nextStepReason(input: {
  pendingCount: number;
  hasQuizConfusion: boolean;
  hasFriction: boolean;
  tempoTone: ModerationCompassTempo['tone'] | null;
  tempoVariant: ModerationCompassTempo['variant'];
  hasTopics: boolean;
}): ModerationCompassNextStepReason | null {
  if (input.tempoTone === 'alert') {
    return input.tempoVariant === 'feedback' ? 'feedback' : 'tempo';
  }
  if (input.hasQuizConfusion) {
    return 'quiz-confusion';
  }
  if (input.tempoTone === 'caution') {
    return input.tempoVariant === 'feedback' ? 'feedback' : 'tempo';
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
  if (input.tempoTone === 'good') {
    return 'steady';
  }
  return null;
}

function nextStepSourceKind(reason: ModerationCompassNextStepReason): ModerationCompassCardKind {
  switch (reason) {
    case 'pending-qa':
    case 'quiz-confusion':
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

export function buildModerationCompassCards(
  snapshot: ModerationCompassSnapshot,
): ModerationCompassCard[] {
  const cards: ModerationCompassCard[] = [];

  const topicSources = mixTopicSources(snapshot);
  if (topicSources.length > 0) {
    cards.push({ kind: 'topics', tone: 'neutral', sources: topicSources });
  }

  const pending = pendingQuestions(snapshot.qaQuestions, snapshot.qaSortMode).filter(
    (question) => truncateCompassLabel(question.text).length > 0,
  );
  const quizSources = quizConfusionSources(snapshot.quizSources);
  const quizTake = Math.min(quizSources.length, pending.length > 0 ? 2 : MAX_SOURCES);
  const takenQuiz = quizSources.slice(0, quizTake);
  const pendingSources = pending.slice(0, MAX_SOURCES - takenQuiz.length).flatMap((question) => {
    const source = qaQuestionSource(question);
    return source ? [source] : [];
  });
  const clarificationSources: ModerationCompassSource[] = [...takenQuiz, ...pendingSources];
  if (clarificationSources.length > 0) {
    cards.push({
      kind: 'clarification',
      tone: 'caution',
      sources: clarificationSources,
    });
  }

  const frictionSources = controversialQuestions(snapshot.qaQuestions)
    .flatMap((question) => {
      const source = qaQuestionSource(question);
      return source ? [source] : [];
    })
    .slice(0, MAX_SOURCES);
  if (frictionSources.length > 0) {
    cards.push({ kind: 'friction', tone: 'caution', sources: frictionSources });
  }

  if (snapshot.tempo) {
    cards.push({
      kind: 'tempo',
      title: snapshot.tempo.title,
      tone: tempoCardTone(snapshot.tempo.tone),
      sources: [
        {
          kind: 'tempo',
          label: snapshot.tempo.label,
          target: { channel: 'quickFeedback' },
        },
      ],
    });
  }

  const tempoTone = snapshot.tempo?.tone ?? null;
  const reason = nextStepReason({
    pendingCount: pending.length,
    hasQuizConfusion: quizSources.length > 0,
    hasFriction: frictionSources.length > 0,
    tempoTone,
    tempoVariant: snapshot.tempo?.variant,
    hasTopics: topicSources.length > 0,
  });
  if (reason && cards.length > 0) {
    const preferredKind = nextStepSourceKind(reason);
    const sourceCard =
      cards.find((card) => card.kind === preferredKind) ??
      cards.find((card) => card.kind === 'tempo') ??
      cards[0];
    cards.push({
      kind: 'nextStep',
      nextStepReason: reason,
      tone: nextStepCardTone(reason, tempoTone),
      sources: sourceCard.sources.slice(0, MAX_SOURCES),
    });
  }

  return cards;
}
