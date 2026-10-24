import { extractExportQuestionText } from '../../../core/markdown-plain-text.util';
import { replaceEmojiShortcodes } from '../../../shared/emoji-shortcode.util';
import {
  MODERATION_COMPASS_STORED_SOURCE_COUNT,
  MODERATION_COMPASS_VISIBLE_SOURCE_COUNT,
  collectModerationQuizFacts as collectSharedModerationQuizFacts,
  confidenceResultResponseCount,
  isNegativeFeedbackKey,
  notableQuickFeedbackSplit,
  planModerationCompass,
  resolveModerationCompassAnalysisMode,
  moderationQuizFactEvidenceRole,
  type ModerationCompassEvidenceRole,
  selectFrictionQuestionSourceIds,
  selectModerationCompassTopicSourceIds,
  selectPendingModerationQuestionSourceIds,
  type QaNlpCategory,
  type QaNlpResult,
  type QuestionType,
  type TempoTrendStatus,
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
  type ConfidenceResult,
} from '@arsnova/shared-types';
import {
  toQaSummaryScanBullet,
  type QaSummaryScanLocale,
} from '@arsnova/shared-types/qa-summary-scan';

export {
  MODERATION_COMPASS_STORED_SOURCE_COUNT,
  MODERATION_COMPASS_VISIBLE_SOURCE_COUNT,
  isNegativeFeedbackKey,
  moderationQuizFactEvidenceRole,
  notableQuickFeedbackSplit,
  resolveModerationCompassAnalysisMode,
};

export type { ModerationCompassEvidenceRole };

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
  /** Konkreter Beleg unter der Überschrift, etwa ein Antwortpaar. */
  readonly evidence?: string;
  /** Kurzkontext, etwa der Fragenstamm — nie eine Wiederholung von label/evidence. */
  readonly context?: string;
  readonly focusHint?: string;
  readonly target?: ModerationCompassSourceTarget;
  readonly evidenceRole?: ModerationCompassEvidenceRole;
};

export type ModerationCompassCardTone = SharedModerationCompassCardTone;

export type ModerationCompassCard = {
  readonly kind: ModerationCompassCardKind;
  readonly sources: readonly ModerationCompassSource[];
  readonly nextStepReason?: ModerationCompassNextStepReason;
  readonly title?: string;
  readonly hint?: string;
  readonly tone?: ModerationCompassCardTone;
  readonly tempoStatus?: Exclude<TempoTrendStatus, 'NEUTRAL'>;
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
  /** Optionaler kurzer Kopf, etwa das Stimmenverhältnis bei Reibung. */
  readonly sourceHeadline?: string;
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
  /** Presentation headline; jump and focus still use `label`. */
  readonly displayLabel?: string;
  readonly documentFrequency: number;
  readonly sourceCount: number;
  readonly memberTexts: readonly string[];
  readonly memberSourceIds?: readonly string[];
  readonly questionId?: string;
  readonly sortMode?: ModerationCompassSortMode;
  readonly analysisVariant?: ModerationCompassAnalysisVariant;
};

export type ModerationCompassTempo = {
  readonly label: string;
  readonly tone: 'neutral' | 'good' | 'caution' | 'alert';
  readonly variant?: 'tempo' | 'feedback';
  readonly title?: string;
  readonly tempoStatus?: Exclude<TempoTrendStatus, 'NEUTRAL'>;
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

export function truncateCompassLabelAtWord(text: string, max: number): string {
  const trimmed = replaceEmojiShortcodes(text).trim().replace(/\s+/g, ' ');
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

function normalizeCompassCompareText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('de-DE')
    .replace(/[.…]+$/u, '');
}

function compassContentTokens(text: string): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const token of normalizeCompassCompareText(text).split(/[^\p{L}\p{N}-]+/u)) {
    if (token.length < 4 || seen.has(token)) {
      continue;
    }
    seen.add(token);
    tokens.push(token);
  }
  return tokens;
}

function looksLikeCompassSentence(text: string): boolean {
  const trimmed = text.trim();
  if (/[.?!…]/.test(trimmed)) {
    return true;
  }
  return /^(wie|was|warum|weshalb|wieso|welche|welcher|welches|wann|wo|womit|wodurch|how|what|why|when|where|which|qui|que|pourquoi|quand|où|cuál|qué|quando|perché)\b/iu.test(
    trimmed,
  );
}

export function compassSourcePartsOverlap(primary: string, extra: string): boolean {
  const left = normalizeCompassCompareText(primary);
  const right = normalizeCompassCompareText(extra);
  if (!left || !right) {
    return true;
  }
  if (left === right || left.includes(right)) {
    return true;
  }
  const extraTokens = compassContentTokens(extra);
  if (extraTokens.length === 0) {
    return normalizeCompassCompareText(extra).replace(/[^\p{L}\p{N}]+/gu, '').length === 0;
  }
  const hits = extraTokens.filter((token) => left.includes(token)).length;
  return hits / extraTokens.length >= 0.6;
}

/** Liefert einen Zweittext nur, wenn er zur Überschrift etwas Neues beiträgt. */
export function pickCompassSourceDetail(
  primary: string,
  extra: string | undefined,
): string | undefined {
  const trimmed = extra?.trim() ?? '';
  if (!trimmed) {
    return undefined;
  }
  if (compassSourcePartsOverlap(primary, trimmed)) {
    return undefined;
  }
  const extraTokens = compassContentTokens(trimmed);
  const primaryNorm = normalizeCompassCompareText(primary);
  if (
    !looksLikeCompassSentence(trimmed) &&
    extraTokens.length <= 2 &&
    extraTokens.some((token) => primaryNorm.includes(token))
  ) {
    return undefined;
  }
  return trimmed;
}

export function compassSourceSpokenLabel(source: ModerationCompassSource): string {
  return [source.label, source.evidence, source.context]
    .map((part) => part?.trim() ?? '')
    .filter((part) => part.length > 0)
    .join('. ');
}

/** Kurzer Fragetitel für Kompass-Quellen, ohne Markdown und Medien. */
export function compassQuestionStem(text: string, max = 56): string {
  return truncateCompassLabelAtWord(extractExportQuestionText(text, max + 24), max);
}

function confidenceMisconceptionFromResult(
  result: ConfidenceResult | null | undefined,
): ModerationCompassQuizQuestion['confidenceMisconception'] {
  if (!result || result.highConfidenceWrongCount <= 0) {
    return undefined;
  }
  return {
    responseCount: confidenceResultResponseCount(result),
    highConfidenceWrongCount: result.highConfidenceWrongCount,
    wrongOptions: result.highConfidenceWrongOptions?.map((option) => ({
      text: option.text,
      count: option.count,
    })),
  };
}

export function collectModerationQuizFacts(
  question: ModerationCompassQuizQuestion & { confidenceResult?: ConfidenceResult | null },
): ModerationQuizFact[] {
  const confidenceMisconception =
    question.confidenceMisconception ??
    confidenceMisconceptionFromResult(question.confidenceResult);
  // Legacy frontend callers omitted numericStats or its band percentage when a histogram
  // implied a configured band.
  // Explicit null/object states remain authoritative; all thresholds and fact selection stay shared.
  if (question.numericHistogram?.length && question.numericStats?.inBandPercent === undefined) {
    return collectSharedModerationQuizFacts({
      ...question,
      ...(confidenceMisconception ? { confidenceMisconception } : {}),
      numericStats: {
        ...(question.numericStats ?? {}),
        n: question.numericStats?.n ?? 0,
        inBandPercent: 100,
      },
    });
  }
  return collectSharedModerationQuizFacts({
    ...question,
    ...(confidenceMisconception ? { confidenceMisconception } : {}),
  });
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
    .map((source) => withQuizQuestionTarget(source, questionId))
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
        (source, sourceIndex) =>
          source.label === other.sources[sourceIndex]?.label &&
          source.evidence === other.sources[sourceIndex]?.evidence &&
          source.context === other.sources[sourceIndex]?.context &&
          source.evidenceRole === other.sources[sourceIndex]?.evidenceRole &&
          JSON.stringify(source.target ?? null) ===
            JSON.stringify(other.sources[sourceIndex]?.target ?? null),
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
    const key = sourceDedupeKey(source);
    if (!label || seen.has(key)) {
      return;
    }
    seen.add(key);
    merged.push(withDefaultSourceTarget(source));
  };

  for (const source of current) {
    push(currentQuestionId ? withQuizQuestionTarget(source, currentQuestionId) : source);
  }
  for (const entry of cached) {
    if (entry.questionId === currentQuestionId) {
      continue;
    }
    const firstSource = entry.sources[0];
    if (firstSource) {
      push(withQuizQuestionTarget(firstSource, entry.questionId));
    }
  }
  return merged;
}

function withQuizQuestionTarget(
  source: ModerationCompassSource,
  questionId: string,
): ModerationCompassSource {
  if (source.kind !== 'quiz-result') {
    return withDefaultSourceTarget(source);
  }
  return {
    ...source,
    target: { ...(source.target ?? { channel: 'quiz' }), channel: 'quiz', questionId },
  };
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
  const topic = truncateCompassLabelAtWord(term.label, SOURCE_LABEL_MAX);
  if (!topic) {
    return null;
  }
  const presentation = term.displayLabel?.trim() || topic;
  const memberTexts = uniqueNonEmpty(term.memberTexts);
  const rawExample = memberTexts[0] ? truncateCompassLabelAtWord(memberTexts[0], 72) : '';
  const example = rawExample ? pickCompassSourceDetail(presentation, rawExample) : undefined;
  const memberIds = kind === 'qa-term' ? uniqueNonEmpty(term.memberSourceIds) : [];
  return {
    kind,
    label: presentation,
    ...(example ? { evidence: example } : {}),
    focusHint: topic,
    target: {
      channel,
      surface: 'word-cloud',
      termLabel: topic,
      ...(rawExample ? { memberText: rawExample } : {}),
      ...(memberTexts.length > 0 ? { memberTexts } : {}),
      ...(memberIds[0] ? { questionId: memberIds[0] } : {}),
      ...(memberIds.length > 0 ? { questionIds: memberIds } : {}),
      ...(kind === 'freetext-term' && term.questionId ? { questionId: term.questionId } : {}),
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
  const headline = question.sourceHeadline?.trim() ?? '';
  const stem = compassQuestionStem(question.text, 72);
  if (headline) {
    const context = pickCompassSourceDetail(headline, stem);
    return {
      kind: 'qa-question',
      label: headline,
      ...(context ? { context } : {}),
      target: { channel: 'qa', questionId: question.id },
    };
  }
  if (!stem) {
    return null;
  }
  return {
    kind: 'qa-question',
    label: stem,
    target: { channel: 'qa', questionId: question.id },
  };
}

function sourceDedupeKey(source: ModerationCompassSource): string {
  return JSON.stringify([
    source.kind,
    source.label,
    source.evidence ?? '',
    source.context ?? '',
    source.target?.questionId ?? '',
  ]);
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
  });
  const pendingQuestionSourceIds = selectPendingModerationQuestionSourceIds(
    questionRuleSources(snapshot.qaQuestions, 'pending', registry),
    snapshot.qaSortMode,
  );
  const frictionQuestionSourceIds = selectFrictionQuestionSourceIds(
    questionRuleSources(snapshot.qaQuestions, 'friction', registry),
  );
  const quizSources = quizConfusionSources(snapshot.quizSources);
  const quizRole = (source: ModerationCompassSource): ModerationCompassEvidenceRole =>
    source.evidenceRole ?? 'clarification';
  const quizResultSourceIds = registeredSourceIds(
    quizSources.filter((source) => quizRole(source) === 'clarification'),
    'quiz',
    registry,
  );
  const surveySourceIds = registeredSourceIds(
    quizSources.filter((source) => quizRole(source) === 'survey'),
    'survey',
    registry,
  );
  const freetextSourceIds = registeredSourceIds(
    quizSources.filter((source) => quizRole(source) === 'freetext'),
    'freetext',
    registry,
  );
  const mentionQuizSourceIds = registeredSourceIds(
    quizSources.filter((source) => quizRole(source) === 'mention'),
    'mention',
    registry,
  );
  const feedback = snapshot.tempo
    ? {
        sourceId: registerRuleSource(registry, 'feedback:0', {
          kind: 'tempo',
          label: snapshot.tempo.label,
          target: { channel: 'quickFeedback' },
        }),
        tone: snapshot.tempo.tone,
        variant: snapshot.tempo.variant,
        ...(snapshot.tempo.tempoStatus ? { tempoStatus: snapshot.tempo.tempoStatus } : {}),
      }
    : null;
  const plan = planModerationCompass({
    topicSourceIds,
    pendingQuestionSourceIds,
    frictionQuestionSourceIds,
    quizResultSourceIds,
    surveySourceIds,
    freetextSourceIds,
    mentionQuizSourceIds,
    quizInsightKind:
      quizResultSourceIds.length > 0 && snapshot.quizInsightKind !== 'survey'
        ? snapshot.quizInsightKind
        : null,
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
    if (card.kind === 'tempo') {
      return {
        ...mapped,
        title: snapshot.tempo?.title,
        ...(snapshot.tempo?.tempoStatus ? { tempoStatus: snapshot.tempo.tempoStatus } : {}),
      };
    }
    if (card.kind === 'topics' && snapshot.topicWeightLabel) {
      return { ...mapped, hint: snapshot.topicWeightLabel };
    }
    return mapped;
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
