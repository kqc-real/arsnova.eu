import { extractExportQuestionText } from '../../../core/markdown-plain-text.util';
import { replaceEmojiShortcodes } from '../../../shared/emoji-shortcode.util';
import {
  MODERATION_COMPASS_STORED_SOURCE_COUNT,
  MODERATION_COMPASS_VISIBLE_SOURCE_COUNT,
  collectModerationQuizFacts as collectSharedModerationQuizFacts,
  isNegativeFeedbackKey,
  notableQuickFeedbackSplit,
  planModerationCompass,
  resolveModerationCompassAnalysisMode,
  selectFrictionQuestionSourceIds,
  selectModerationCompassTopicSourceIds,
  selectPendingModerationQuestionSourceIds,
  type QaNlpCategory,
  type QaNlpResult,
  type QuestionType,
  type ModerationCompassAnalysisMode as SharedModerationCompassAnalysisMode,
  type ModerationCompassCardKind as SharedModerationCompassCardKind,
  type ModerationCompassCardTone as SharedModerationCompassCardTone,
  type ModerationCompassNextStepReason as SharedModerationCompassNextStepReason,
  type ModerationCompassQuizInsightKind as SharedModerationCompassQuizInsightKind,
  type ModerationCompassQuizQuestion as SharedModerationCompassQuizQuestion,
  type ModerationCompassRuleQuestion,
  type ModerationCompassSortMode as SharedModerationCompassSortMode,
  type ModerationCompassTopicRuleSource,
  type ModerationCompassTopicTermRuleSource,
  type ModerationQuizFact as SharedModerationQuizFact,
} from '@arsnova/shared-types';
import {
  toQaSummaryScanBullet,
  type QaSummaryScanLocale,
} from '@arsnova/shared-types/qa-summary-scan';

export {
  MODERATION_COMPASS_STORED_SOURCE_COUNT,
  MODERATION_COMPASS_VISIBLE_SOURCE_COUNT,
  isNegativeFeedbackKey,
  notableQuickFeedbackSplit,
  resolveModerationCompassAnalysisMode,
};

export type ModerationCompassCardKind = SharedModerationCompassCardKind | 'nextStep';

export type ModerationCompassNextStepReason = SharedModerationCompassNextStepReason;

export type ModerationCompassQuizInsightKind = SharedModerationCompassQuizInsightKind;

export type ModerationCompassSourceKind =
  'qa-question' | 'qa-term' | 'freetext-term' | 'tempo' | 'quiz-result';

export type ModerationCompassLiveChannel = 'quiz' | 'qa' | 'quickFeedback';

export type ModerationCompassSortMode = SharedModerationCompassSortMode;
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
  readonly focusHint?: string;
  readonly target?: ModerationCompassSourceTarget;
};

export type ModerationCompassCardTone = SharedModerationCompassCardTone;

export type ModerationCompassCard = {
  readonly kind: ModerationCompassCardKind;
  readonly sources: readonly ModerationCompassSource[];
  readonly nextStepReason?: ModerationCompassNextStepReason;
  readonly title?: string;
  readonly tone?: ModerationCompassCardTone;
};

export type ModerationCompassQuizSourceCacheEntry = {
  readonly questionId: string;
  readonly questionType?: QuestionType;
  readonly sources: readonly ModerationCompassSource[];
};

export type ModerationCompassAnalysisMode = SharedModerationCompassAnalysisMode;

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
  readonly nlp?: QaNlpResult;
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
  readonly nlpTopicSources?: readonly ModerationCompassSource[];
  readonly topicWeightLabel: string | null;
  readonly tempo: ModerationCompassTempo | null;
  readonly quizSources: readonly ModerationCompassSource[];
  readonly quizInsightKind?: ModerationCompassQuizInsightKind | null;
};

export type ModerationCompassQuizQuestion = SharedModerationCompassQuizQuestion;

export type ModerationQuizFact = SharedModerationQuizFact;

const SOURCE_LABEL_MAX = 88;

export type ModerationCompassSourceDestination = 'qa' | 'quiz' | 'word-cloud' | 'quickFeedback';

export function visibleModerationCompassSources(
  sources: readonly ModerationCompassSource[],
): readonly ModerationCompassSource[] {
  return sources.slice(0, MODERATION_COMPASS_VISIBLE_SOURCE_COUNT);
}

export function extraModerationCompassSources(
  sources: readonly ModerationCompassSource[],
): readonly ModerationCompassSource[] {
  return sources.slice(MODERATION_COMPASS_VISIBLE_SOURCE_COUNT);
}

export type ModerationCompassMoreSourcesKind = 'word-cloud-top' | 'word-cloud-more' | 'generic';

function moderationCompassSourceTopicLabel(source: ModerationCompassSource): string {
  const fromTarget = source.target?.termLabel?.trim() ?? '';
  if (fromTarget) {
    return fromTarget;
  }
  return (source.label.split(' · ')[0] ?? source.label).trim();
}

function isSingleWordCloudTopic(topic: string): boolean {
  return topic.length > 0 && !/\s/u.test(topic);
}

/**
 * Label-Art für »weitere Quellen«.
 * »Top-Themen der Wortwolke« nur bei BEST + aktiver Glättung + Einzelwort-Modus
 * (keine Phrasen-/Themen-Analyse).
 */
export function resolveModerationCompassMoreSourcesKind(
  extras: readonly ModerationCompassSource[],
  options: {
    readonly qaSortMode: ModerationCompassSortMode;
    readonly wordCloudSmoothingActive: boolean;
    readonly wordCloudSingleWordsOnly: boolean;
  },
): ModerationCompassMoreSourcesKind {
  if (extras.length === 0) {
    return 'generic';
  }
  const allWordCloudTerms = extras.every(
    (source) => source.kind === 'qa-term' || source.kind === 'freetext-term',
  );
  if (!allWordCloudTerms) {
    return 'generic';
  }
  const allSingleWords = extras.every((source) =>
    isSingleWordCloudTopic(moderationCompassSourceTopicLabel(source)),
  );
  if (
    options.qaSortMode === 'BEST' &&
    options.wordCloudSmoothingActive &&
    options.wordCloudSingleWordsOnly &&
    allSingleWords
  ) {
    return 'word-cloud-top';
  }
  return 'word-cloud-more';
}

export type ModerationSummaryScanParts = {
  readonly lead: string | null;
  readonly body: string;
};

const SUMMARY_LEAD_RE = /^([^:：]{2,36})[:：] (.+)$/u;

/** Splits "Median: Formel unklar" so the host can scan the topic first. */
export function splitModerationSummaryLead(
  text: string,
  locale: QaSummaryScanLocale = 'de',
): ModerationSummaryScanParts {
  const body = toQaSummaryScanBullet(text, locale);
  const match = body.match(SUMMARY_LEAD_RE);
  if (!match) {
    return { lead: null, body };
  }
  const lead = match[1].trim();
  const rest = match[2].trim();
  if (!rest || lead.includes('.') || /\d{1,2}:\d{2}$/.test(lead)) {
    return { lead: null, body };
  }
  return { lead, body: rest };
}

export function moderationCompassSourceDestination(
  source: ModerationCompassSource,
): ModerationCompassSourceDestination {
  if (source.target?.surface === 'word-cloud') {
    return 'word-cloud';
  }
  if (!source.target && (source.kind === 'qa-term' || source.kind === 'freetext-term')) {
    return 'word-cloud';
  }
  const channel =
    source.target?.channel ??
    (source.kind === 'quiz-result' || source.kind === 'freetext-term'
      ? 'quiz'
      : source.kind === 'tempo'
        ? 'quickFeedback'
        : 'qa');
  if (channel === 'quiz') {
    return 'quiz';
  }
  if (channel === 'quickFeedback') {
    return 'quickFeedback';
  }
  return 'qa';
}

export function truncateCompassLabel(text: string, max = SOURCE_LABEL_MAX): string {
  const trimmed = replaceEmojiShortcodes(text).trim().replace(/\s+/g, ' ');
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
  // Legacy frontend callers omitted numericStats or its band percentage when a histogram
  // implied a configured band.
  // Explicit null/object states remain authoritative; all thresholds and fact selection stay shared.
  if (question.numericHistogram?.length && question.numericStats?.inBandPercent === undefined) {
    return collectSharedModerationQuizFacts({
      ...question,
      numericStats: {
        ...(question.numericStats ?? {}),
        n: question.numericStats?.n ?? 0,
        inBandPercent: 100,
      },
    });
  }
  return collectSharedModerationQuizFacts(question);
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
  questionType?: QuestionType,
  maxQuestions = MODERATION_COMPASS_STORED_SOURCE_COUNT,
): readonly ModerationCompassQuizSourceCacheEntry[] {
  const nextSources = sources
    .filter((source) => source.label.trim().length > 0)
    .map(withDefaultSourceTarget)
    .slice(0, MODERATION_COMPASS_STORED_SOURCE_COUNT);
  const next =
    nextSources.length === 0
      ? existing.filter((entry) => entry.questionId !== questionId)
      : [
          { questionId, questionType, sources: nextSources },
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
  max = MODERATION_COMPASS_STORED_SOURCE_COUNT,
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

function termSource(
  term: ModerationCompassTerm,
  kind: Extract<ModerationCompassSourceKind, 'qa-term' | 'freetext-term'>,
): ModerationCompassSource | null {
  const channel = kind === 'freetext-term' ? 'quiz' : 'qa';
  const topic = truncateCompassLabel(term.label);
  if (!topic) {
    return null;
  }
  const memberTexts = uniqueNonEmpty(term.memberTexts);
  const example = memberTexts[0] ? truncateCompassLabel(memberTexts[0], 64) : '';
  const label = example ? `${topic} · ${example}` : topic;
  const memberIds = kind === 'qa-term' ? uniqueNonEmpty(term.memberSourceIds) : [];
  return {
    kind,
    label,
    focusHint: topic,
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
  };
}

function quizConfusionSources(
  sources: readonly ModerationCompassSource[],
): ModerationCompassSource[] {
  return sources
    .filter((source) => source.kind === 'quiz-result' && source.label.trim().length > 0)
    .map(withDefaultSourceTarget)
    .slice(0, MODERATION_COMPASS_STORED_SOURCE_COUNT);
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

function sourceDedupeKey(source: ModerationCompassSource): string {
  return JSON.stringify([source.kind, source.label]);
}

function registerRuleSource(
  registry: Map<string, ModerationCompassSource>,
  sourceId: string,
  source: ModerationCompassSource,
): string {
  registry.set(sourceId, source);
  return sourceId;
}

function topicRuleSources(
  sources: readonly ModerationCompassSource[],
  prefix: string,
  registry: Map<string, ModerationCompassSource>,
): ModerationCompassTopicRuleSource[] {
  return sources.flatMap((candidate, index) => {
    if (!candidate.label.trim()) {
      return [];
    }
    const source = withDefaultSourceTarget(candidate);
    const sourceId = registerRuleSource(registry, `${prefix}:${index}`, source);
    return [{ sourceId, dedupeKey: sourceDedupeKey(source) }];
  });
}

function topicTermRuleSources(
  terms: readonly ModerationCompassTerm[],
  kind: Extract<ModerationCompassSourceKind, 'qa-term' | 'freetext-term'>,
  prefix: string,
  registry: Map<string, ModerationCompassSource>,
): ModerationCompassTopicTermRuleSource[] {
  return terms.map((term, index) => {
    const source = termSource(term, kind);
    const sourceId = source ? registerRuleSource(registry, `${prefix}:${index}`, source) : '';
    return {
      sourceId,
      ...(source ? { dedupeKey: sourceDedupeKey(source) } : {}),
      documentFrequency: term.documentFrequency,
      sourceCount: term.sourceCount,
    };
  });
}

function questionRuleSources(
  questions: readonly ModerationCompassQaQuestion[],
  prefix: string,
  registry: Map<string, ModerationCompassSource>,
): ModerationCompassRuleQuestion[] {
  return questions.flatMap((question, index) => {
    const source = qaQuestionSource(question);
    if (!source) {
      return [];
    }
    return [
      {
        sourceId: registerRuleSource(
          registry,
          `${prefix}:${question.id}:${String(index).padStart(10, '0')}`,
          source,
        ),
        status: question.status,
        isControversial: question.isControversial,
        positiveVoteCount: question.positiveVoteCount,
        negativeVoteCount: question.negativeVoteCount,
        score: question.score,
        bestScore: question.bestScore,
        controversyScore: question.controversyScore,
      },
    ];
  });
}

function registeredSourceIds(
  sources: readonly ModerationCompassSource[],
  prefix: string,
  registry: Map<string, ModerationCompassSource>,
): string[] {
  return sources.map((source, index) => registerRuleSource(registry, `${prefix}:${index}`, source));
}

export function buildModerationCompassCards(
  snapshot: ModerationCompassSnapshot,
): ModerationCompassCard[] {
  const registry = new Map<string, ModerationCompassSource>();
  const topicWeightSource: ModerationCompassSource | null = snapshot.topicWeightLabel
    ? {
        kind: 'qa-term',
        label: snapshot.topicWeightLabel,
        target: { channel: 'qa' },
      }
    : null;
  const topicWeight = topicWeightSource
    ? {
        sourceId: registerRuleSource(registry, 'topic:weight', topicWeightSource),
        dedupeKey: sourceDedupeKey(topicWeightSource),
      }
    : null;
  const topicSourceIds = selectModerationCompassTopicSourceIds({
    classified: topicRuleSources(snapshot.nlpTopicSources ?? [], 'topic:nlp', registry),
    qaTerms: topicTermRuleSources(snapshot.qaTerms, 'qa-term', 'topic:qa', registry),
    freetextTerms: topicTermRuleSources(
      snapshot.freetextTerms,
      'freetext-term',
      'topic:freetext',
      registry,
    ),
    extras: topicRuleSources(snapshot.extraTopicSources, 'topic:extra', registry),
    topicWeight,
  });
  const pendingQuestionSourceIds = selectPendingModerationQuestionSourceIds(
    questionRuleSources(snapshot.qaQuestions, 'pending', registry),
    snapshot.qaSortMode,
  );
  const frictionQuestionSourceIds = selectFrictionQuestionSourceIds(
    questionRuleSources(snapshot.qaQuestions, 'friction', registry),
  );
  const quizSources = quizConfusionSources(snapshot.quizSources);
  const quizResultSourceIds = registeredSourceIds(quizSources, 'quiz', registry);
  const feedback = snapshot.tempo
    ? {
        sourceId: registerRuleSource(registry, 'feedback:0', {
          kind: 'tempo',
          label: snapshot.tempo.label,
          target: { channel: 'quickFeedback' },
        }),
        tone: snapshot.tempo.tone,
        variant: snapshot.tempo.variant,
      }
    : null;
  const plan = planModerationCompass({
    topicSourceIds,
    pendingQuestionSourceIds,
    frictionQuestionSourceIds,
    quizResultSourceIds,
    quizInsightKind: snapshot.quizInsightKind,
    feedback,
  });
  return plan.cards.map((card) => {
    const mapped: ModerationCompassCard = {
      kind: card.kind,
      tone: card.tone,
      sources: card.sourceIds.flatMap((sourceId) => {
        const source = registry.get(sourceId);
        return source ? [source] : [];
      }),
      ...(card.nextStepReason ? { nextStepReason: card.nextStepReason } : {}),
    };
    return card.kind === 'tempo' ? { ...mapped, title: snapshot.tempo?.title } : mapped;
  });
}

export function collectQaNlpCategorySources(
  questions: readonly ModerationCompassQaQuestion[],
  labels: Readonly<Record<QaNlpCategory, string>>,
): ModerationCompassSource[] {
  const grouped = new Map<QaNlpCategory, string[]>();
  for (const question of questions) {
    if (
      (question.status !== 'ACTIVE' && question.status !== 'PINNED') ||
      question.nlp?.status !== 'classified' ||
      !question.nlp.category
    ) {
      continue;
    }
    const ids = grouped.get(question.nlp.category) ?? [];
    ids.push(question.id);
    grouped.set(question.nlp.category, ids);
  }
  return [...grouped.entries()]
    .sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]))
    .map(([category, questionIds]) => ({
      kind: 'qa-question' as const,
      label:
        questionIds.length > 1 ? `${labels[category]} · ${questionIds.length}` : labels[category],
      focusHint: labels[category],
      target: {
        channel: 'qa' as const,
        questionId: questionIds[0],
        questionIds,
      },
    }));
}
