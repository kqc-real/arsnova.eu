import type {
  AnalyzeWordCloudInput,
  AnalyzeWordCloudOutput,
  WordCloudAnalysisSourceItem,
} from '@arsnova/shared-types';
import { deu, eng } from 'stopword';

type WordCloudAnalysisEntry = AnalyzeWordCloudOutput['entries'][number];
type SupportedLocale = AnalyzeWordCloudInput['locale'];
type GroupingKind = 'token' | 'phrase';

export interface WordCloudRawToken {
  readonly display: string;
  readonly lookup: string;
  /** Ungeglättete Oberfläche; Stopwortfilter prüft sie zusätzlich zum Lemma. */
  readonly surfaceLookup?: string;
  /** Universal-POS aus spaCy; ohne POS bleibt der Identity-Pfad ungefiltert. */
  readonly pos?: string;
}

interface Candidate {
  readonly key: string;
  readonly label: string;
  readonly kind: GroupingKind;
  readonly containsNumeric: boolean;
  readonly pos?: string;
}

interface CandidateStats {
  readonly key: string;
  readonly kind: GroupingKind;
  readonly containsNumeric: boolean;
  readonly labels: Map<string, number>;
  responseCount: number;
  weightSum: number;
}

interface PreparedItem {
  readonly item: WordCloudAnalysisSourceItem;
  readonly exactKey: string;
  readonly tokens: Candidate[];
  readonly candidates: Candidate[];
}

interface LexicalBucket {
  key: string;
  count: number;
  labels: Map<string, number>;
  members: WordCloudAnalysisEntry['members'];
}

type WordCloudMaxNgramLength = NonNullable<AnalyzeWordCloudInput['maxNgramLength']>;

interface ThemeBucket {
  readonly key: string;
  readonly anchor: Candidate | null;
  readonly anchorStats: CandidateStats | null;
  readonly members: WordCloudAnalysisEntry['members'];
  readonly textVariants: Map<string, number>;
  readonly anchorLabels: Map<string, number>;
  count: number;
}

export interface ThemeWordCloudAnalysisResult {
  readonly entries: WordCloudAnalysisEntry[];
  readonly usedThemeAnchors: boolean;
}

interface GroupingRule {
  readonly pattern: RegExp;
  readonly toGroupKey: (match: RegExpExecArray) => string;
  readonly toDisplay?: (match: RegExpExecArray) => string;
}

const MIN_TOKEN_LENGTH = 2;
const LEMMA_UNIGRAM_POS_TYPES = new Set(['NOUN', 'PROPN', 'NUM', 'X']);
const LEMMA_PHRASE_POS_TYPES = new Set(['NOUN', 'PROPN', 'NUM', 'X', 'ADJ']);
const TOKEN_PATTERN = /-?\d+(?:[.,]\d+)*|[\p{L}\p{N}-]+/gu;
const NUMBER_TOKEN_PATTERN = /^-?\d+(?:[.,]\d+)*$/;
const WHITESPACE_PATTERN = /\s+/gu;
const COMBINING_MARK_PATTERN = /\p{M}+/gu;
const DECIMAL_SEPARATOR_SPACING_PATTERN = /(\d)\s*([.,])\s*(?=\d)/g;

const GERMAN_GROUPING_RULES: readonly GroupingRule[] = [
  {
    pattern: /^haeng(?:e|en|t|te|ten|tet|test|end|ende|endem|enden|ender|endes)$/u,
    toGroupKey: () => 'haengen',
    toDisplay: () => 'haengen',
  },
  {
    pattern: /^(.{3,}(?:al|ar|aer|bar|ell|frei|haft|ig|isch|iv|lich|los|sam))e(?:m|n|r|s)$/u,
    toGroupKey: ([, stem]) => `${stem}e`,
    toDisplay: ([, stem]) => `${stem}e`,
  },
  {
    pattern: /^(.{3,})isierung(?:en)?$/u,
    toGroupKey: ([, stem]) => `${stem}isieren`,
    toDisplay: ([, stem]) => `${stem}isieren`,
  },
  {
    pattern: /^(.{3,})isiert(?:e|em|en|er|es|et|est)?$/u,
    toGroupKey: ([, stem]) => `${stem}isieren`,
    toDisplay: ([, stem]) => `${stem}isieren`,
  },
  {
    pattern: /^(.{3,})isierend(?:e|em|en|er|es)?$/u,
    toGroupKey: ([, stem]) => `${stem}isieren`,
    toDisplay: ([, stem]) => `${stem}isieren`,
  },
  {
    pattern: /^(.{3,})ierung(?:en)?$/u,
    toGroupKey: ([, stem]) => `${stem}ieren`,
    toDisplay: ([, stem]) => `${stem}ieren`,
  },
  {
    pattern: /^(.{3,})iert(?:e|em|en|er|es|et|est)?$/u,
    toGroupKey: ([, stem]) => `${stem}ieren`,
    toDisplay: ([, stem]) => `${stem}ieren`,
  },
  {
    pattern: /^(.{3,})ierend(?:e|em|en|er|es)?$/u,
    toGroupKey: ([, stem]) => `${stem}ieren`,
    toDisplay: ([, stem]) => `${stem}ieren`,
  },
];

const ENGLISH_GROUPING_RULES: readonly GroupingRule[] = [
  {
    pattern: /^(.{3,})izations?$/u,
    toGroupKey: ([, stem]) => `${stem}ize`,
    toDisplay: ([, stem]) => `${stem}ize`,
  },
  {
    pattern: /^(.{3,})iz(?:ed|es|ing|er|ers)$/u,
    toGroupKey: ([, stem]) => `${stem}ize`,
    toDisplay: ([, stem]) => `${stem}ize`,
  },
  {
    pattern: /^validat(?:ed|es|ing|ion|ions|or|ors|ory)$/u,
    toGroupKey: () => 'validate',
    toDisplay: () => 'validate',
  },
];

const GROUPING_RULES_BY_LOCALE: Record<SupportedLocale, readonly GroupingRule[]> = {
  de: GERMAN_GROUPING_RULES,
  en: ENGLISH_GROUPING_RULES,
};

/**
 * Inhaltswörter, die in der Upstream-Stopliste `stopword` stehen, in der Produktwolke
 * aber sichtbar bleiben sollen — analog `STOPWORD_ALLOWLIST_BY_LOCALE` im Frontend.
 */
const STOPWORD_ALLOWLIST_BY_LOCALE: Record<SupportedLocale, readonly string[]> = {
  de: [
    'beispiel',
    'beispiele',
    'machen',
    'macht',
    'machte',
    'gemacht',
    'besser',
    'wirklich',
    'heute',
    'morgen',
    'jetzt',
  ],
  en: ['make', 'makes', 'made', 'making', 'now'],
};

function foldWordCloudStopword(token: string, locale: SupportedLocale): string {
  const normalized = token.trim().toLocaleLowerCase();
  if (!normalized) {
    return '';
  }

  const comparable =
    locale === 'de'
      ? normalized
          .replaceAll('ä', 'ae')
          .replaceAll('ö', 'oe')
          .replaceAll('ü', 'ue')
          .replaceAll('ß', 'ss')
      : normalized;
  return comparable.normalize('NFKD').replace(COMBINING_MARK_PATTERN, '');
}

function createWordCloudStopwordLookup(
  locale: SupportedLocale,
  upstream: readonly string[],
  extras: readonly string[],
): ReadonlySet<string> {
  const allowlist = new Set<string>();
  for (const word of STOPWORD_ALLOWLIST_BY_LOCALE[locale]) {
    const normalized = word.trim().toLocaleLowerCase();
    const folded = foldWordCloudStopword(normalized, locale);
    if (normalized) {
      allowlist.add(normalized);
    }
    if (folded) {
      allowlist.add(folded);
    }
  }

  const lookup = new Set<string>();
  for (const word of [...upstream, ...extras]) {
    const normalized = word.trim().toLocaleLowerCase();
    if (!normalized) {
      continue;
    }
    const folded = foldWordCloudStopword(normalized, locale);
    if (allowlist.has(normalized) || (folded && allowlist.has(folded))) {
      continue;
    }
    lookup.add(normalized);
    if (folded) {
      lookup.add(folded);
    }
  }
  return lookup;
}

const STOPWORDS_BY_LOCALE: Record<SupportedLocale, ReadonlySet<string>> = {
  de: createWordCloudStopwordLookup('de', deu, [
    'aber',
    'als',
    'am',
    'an',
    'auch',
    'auf',
    'aus',
    'bei',
    'beim',
    'bitte',
    'brauchen',
    'braucht',
    'brauchtet',
    'braeuchten',
    'brauchten',
    'damit',
    'das',
    'dem',
    'den',
    'der',
    'des',
    'die',
    'direkt',
    'dran',
    'du',
    'ein',
    'eine',
    'einer',
    'einem',
    'einen',
    'eher',
    'einmal',
    'er',
    'erklaere',
    'erklaerst',
    'erklaert',
    'erklaeren',
    'erkläre',
    'erklärst',
    'erklärt',
    'erklären',
    'es',
    'fuer',
    'frage',
    'fragen',
    'für',
    'geben',
    'grosse',
    'große',
    'hat',
    'haben',
    'heute',
    'hilft',
    'helfen',
    'helfe',
    'hilfst',
    'geholfen',
    'ich',
    'im',
    'in',
    'ist',
    'ja',
    'jetzt',
    'kann',
    'kannst',
    'kleiner',
    'koennen',
    'können',
    'kommt',
    'kommen',
    'laesst',
    'lässt',
    'liegt',
    'mal',
    'mehr',
    'mit',
    'morgen',
    'muss',
    'muessen',
    'müssen',
    'noch',
    'nochmal',
    'nochmals',
    'oder',
    'schwaecht',
    'schwächt',
    'sind',
    'sich',
    'soll',
    'sollte',
    'sollten',
    'thema',
    'themen',
    'trotz',
    'und',
    'uns',
    'ueber',
    'vor',
    'wann',
    'warum',
    'was',
    'welche',
    'welcher',
    'welches',
    'wenn',
    'werden',
    'wie',
    'wir',
    'wird',
    'wo',
    'worum',
    'zu',
    'zum',
    'zur',
    'über',
    'bleibt',
    'bleiben',
    'bleibe',
    'bleibst',
    'geblieben',
    'kurz',
    'kurze',
    'kurzer',
    'kurzes',
    'kurzem',
    'kurzen',
    'antwort',
    'antworten',
  ]),
  en: createWordCloudStopwordLookup('en', eng, [
    'a',
    'about',
    'again',
    'an',
    'and',
    'are',
    'at',
    'be',
    'because',
    'can',
    'could',
    'do',
    'does',
    'for',
    'from',
    'how',
    'i',
    'if',
    'in',
    'is',
    'it',
    'just',
    'me',
    'need',
    'needs',
    'of',
    'on',
    'or',
    'our',
    'please',
    'should',
    'still',
    'the',
    'their',
    'there',
    'this',
    'to',
    'topic',
    'topics',
    'use',
    'we',
    'what',
    'when',
    'where',
    'which',
    'why',
    'with',
    'would',
    'you',
    'question',
    'questions',
  ]),
};

export function buildLexicalWordCloudEntries(
  items: WordCloudAnalysisSourceItem[],
  locale: SupportedLocale,
  limit?: number,
  tokensByItemId?: ReadonlyMap<string, readonly WordCloudRawToken[]>,
  maxNgramLength: WordCloudMaxNgramLength = 1,
): WordCloudAnalysisEntry[] {
  const tokenBuckets = new Map<string, LexicalBucket>();
  const phraseBuckets = new Map<string, LexicalBucket>();

  for (const item of items) {
    const prepared = prepareItem(item, locale, tokensByItemId?.get(item.id));
    const seenKeys = new Set<string>();
    const unigramTokens = prepared.tokens.filter(isLemmaUnigramCandidate);
    const phraseTokens = prepared.tokens.filter(isLemmaPhraseCandidate);

    for (const candidate of [
      ...unigramTokens,
      ...buildLexicalNgramCandidates(phraseTokens, maxNgramLength),
    ]) {
      if (seenKeys.has(candidate.key)) {
        continue;
      }
      seenKeys.add(candidate.key);
      addLexicalCandidate(
        candidate.kind === 'phrase' ? phraseBuckets : tokenBuckets,
        candidate,
        item,
      );
    }
  }

  const minDf = resolveLexicalMinDocumentFrequency(items.length);
  const isFrequentEnough = (bucket: LexicalBucket): boolean =>
    uniqueSourceCount(bucket.members) >= minDf;
  const tokenEntries = lexicalBucketsToEntries(tokenBuckets, locale, isFrequentEnough);
  if (maxNgramLength <= 1) {
    return sortEntries(tokenEntries, limit);
  }

  const phraseEntries = lexicalBucketsToEntries(phraseBuckets, locale, isFrequentEnough);
  return [...sortEntries(tokenEntries, limit), ...sortEntries(phraseEntries, limit)];
}

/**
 * THEME bleibt ohne spaCy: immer interne Tokenisierung, nie Lemma-Overrides.
 */
export function buildThemeWordCloudAnalysis(
  input: AnalyzeWordCloudInput,
): ThemeWordCloudAnalysisResult {
  const preparedItems = input.items.map((item) => prepareItem(item, input.locale));
  const candidateStats = collectCandidateStats(preparedItems);
  const buckets = new Map<string, ThemeBucket>();

  for (const prepared of preparedItems) {
    const anchor = chooseThemeAnchor(prepared, candidateStats);
    const bucket = getOrCreateBucket(
      buckets,
      anchor?.key ?? prepared.exactKey,
      anchor,
      anchor ? (candidateStats.get(anchor.key) ?? null) : null,
    );

    bucket.count += prepared.item.weight;
    bucket.members.push({
      sourceId: prepared.item.id,
      text: prepared.item.text,
      weight: prepared.item.weight,
    });
    bucket.textVariants.set(
      prepared.item.text,
      (bucket.textVariants.get(prepared.item.text) ?? 0) + prepared.item.weight,
    );
    if (anchor) {
      bucket.anchorLabels.set(
        anchor.label,
        (bucket.anchorLabels.get(anchor.label) ?? 0) + prepared.item.weight,
      );
    }
  }

  const finalizedBuckets = [...buckets.values()];

  return {
    entries: sortEntries(
      finalizedBuckets.map((bucket) => finalizeThemeBucket(bucket, input.locale)),
      input.maxEntries,
    ),
    usedThemeAnchors: finalizedBuckets.some((bucket) => bucket.anchor !== null),
  };
}

function prepareItem(
  item: WordCloudAnalysisSourceItem,
  locale: SupportedLocale,
  rawTokens?: readonly WordCloudRawToken[],
): PreparedItem {
  const candidates = new Map<string, Candidate>();
  const tokens = (rawTokens ?? tokenizeWordCloudText(item.text))
    .filter((token) => isNumericToken(token.lookup) || token.lookup.length >= MIN_TOKEN_LENGTH)
    .filter((token) => !isStopwordRawToken(token, locale))
    .map((token) => getTokenCandidate(token, locale));

  for (const token of tokens) {
    candidates.set(token.key, token);
  }

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const left = tokens[index]!;
    const right = tokens[index + 1]!;
    if (!shouldCreatePhrase(left, right)) {
      continue;
    }

    const phrase: Candidate = {
      key: `${left.key} ${right.key}`,
      label: `${left.label} ${right.label}`,
      kind: 'phrase',
      containsNumeric: left.containsNumeric || right.containsNumeric,
    };
    candidates.set(phrase.key, phrase);
  }

  return {
    item,
    exactKey: normalizeExactTextKey(item.text),
    tokens,
    candidates: [...candidates.values()],
  };
}

function buildLexicalNgramCandidates(
  tokens: readonly Candidate[],
  maxNgramLength: WordCloudMaxNgramLength,
): Candidate[] {
  if (maxNgramLength <= 1 || tokens.length < 2) {
    return [];
  }

  const phrases: Candidate[] = [];
  for (let size = 2; size <= maxNgramLength; size += 1) {
    for (let index = 0; index <= tokens.length - size; index += 1) {
      const slice = tokens.slice(index, index + size);
      if (new Set(slice.map((token) => token.key)).size !== slice.length) {
        continue;
      }
      if (!sliceHasLemmaNominalHead(slice)) {
        continue;
      }

      phrases.push({
        key: slice.map((token) => token.key).join(' '),
        label: slice.map((token) => token.label).join(' '),
        kind: 'phrase',
        containsNumeric: slice.some((token) => token.containsNumeric),
      });
    }
  }

  return phrases;
}

function addLexicalCandidate(
  buckets: Map<string, LexicalBucket>,
  candidate: Candidate,
  item: WordCloudAnalysisSourceItem,
): void {
  const existing = buckets.get(candidate.key);
  if (existing) {
    existing.count += item.weight;
    existing.labels.set(candidate.label, (existing.labels.get(candidate.label) ?? 0) + item.weight);
    existing.members.push({
      sourceId: item.id,
      text: item.text,
      weight: item.weight,
    });
    return;
  }

  buckets.set(candidate.key, {
    key: candidate.key,
    count: item.weight,
    labels: new Map([[candidate.label, item.weight]]),
    members: [
      {
        sourceId: item.id,
        text: item.text,
        weight: item.weight,
      },
    ],
  });
}

function lexicalBucketsToEntries(
  buckets: Map<string, LexicalBucket>,
  locale: SupportedLocale,
  isEligible: (bucket: LexicalBucket) => boolean = () => true,
): WordCloudAnalysisEntry[] {
  return [...buckets.values()].filter(isEligible).map((bucket) => {
    const variants = sortVariantEntries(bucket.labels, locale).map(([variant]) => variant);
    return {
      key: bucket.key,
      label: variants[0] ?? bucket.key,
      count: bucket.count,
      basisLabel: null,
      members: bucket.members.sort(
        (left, right) => right.weight - left.weight || left.text.localeCompare(right.text),
      ),
      variants,
      confidence: null,
    };
  });
}

/**
 * Entspricht `WordCloudTermExtractorService.resolveMinDocumentFrequency`:
 * Einmal-Tokens sollen in großen Hörsälen nicht die geglättete Wolke füllen.
 */
function resolveLexicalMinDocumentFrequency(totalItems: number): number {
  if (totalItems < 15) {
    return 1;
  }
  if (totalItems < 50) {
    return 2;
  }
  return 3;
}

function uniqueSourceCount(members: WordCloudAnalysisEntry['members']): number {
  return new Set(members.map((member) => member.sourceId)).size;
}

function collectCandidateStats(preparedItems: PreparedItem[]): Map<string, CandidateStats> {
  const stats = new Map<string, CandidateStats>();

  for (const prepared of preparedItems) {
    for (const candidate of prepared.candidates) {
      const existing = stats.get(candidate.key);
      if (existing) {
        existing.responseCount += 1;
        existing.weightSum += prepared.item.weight;
        existing.labels.set(
          candidate.label,
          (existing.labels.get(candidate.label) ?? 0) + prepared.item.weight,
        );
        continue;
      }

      stats.set(candidate.key, {
        key: candidate.key,
        kind: candidate.kind,
        containsNumeric: candidate.containsNumeric,
        labels: new Map([[candidate.label, prepared.item.weight]]),
        responseCount: 1,
        weightSum: prepared.item.weight,
      });
    }
  }

  return stats;
}

function chooseThemeAnchor(
  prepared: PreparedItem,
  candidateStats: ReadonlyMap<string, CandidateStats>,
): Candidate | null {
  const ranked = prepared.candidates
    .map((candidate) => ({
      candidate,
      stats: candidateStats.get(candidate.key) ?? null,
    }))
    .filter(
      (entry): entry is { candidate: Candidate; stats: CandidateStats } =>
        entry.stats !== null && isThemeCandidateEligible(entry.candidate, entry.stats),
    )
    .sort(
      (left, right) =>
        scoreThemeCandidate(right.candidate, right.stats) -
          scoreThemeCandidate(left.candidate, left.stats) ||
        right.stats.weightSum - left.stats.weightSum ||
        right.candidate.label.length - left.candidate.label.length ||
        left.candidate.label.localeCompare(right.candidate.label),
    );

  return ranked[0]?.candidate ?? null;
}

function isThemeCandidateEligible(candidate: Candidate, stats: CandidateStats): boolean {
  if (candidate.kind === 'phrase') {
    return candidate.containsNumeric || stats.responseCount > 1;
  }

  return stats.responseCount > 1 && !candidate.containsNumeric && candidate.key.length >= 4;
}

function scoreThemeCandidate(candidate: Candidate, stats: CandidateStats): number {
  return (
    stats.responseCount * 100 +
    Math.min(40, stats.weightSum) * 4 +
    (candidate.kind === 'phrase' ? 30 : 0) +
    (candidate.containsNumeric ? 40 : 0) +
    Math.min(candidate.label.length, 20)
  );
}

function getOrCreateBucket(
  buckets: Map<string, ThemeBucket>,
  key: string,
  anchor: Candidate | null,
  anchorStats: CandidateStats | null,
): ThemeBucket {
  const existing = buckets.get(key);
  if (existing) {
    return existing;
  }

  const created: ThemeBucket = {
    key,
    anchor,
    anchorStats,
    members: [],
    textVariants: new Map(),
    anchorLabels: new Map(),
    count: 0,
  };
  buckets.set(key, created);
  return created;
}

function finalizeThemeBucket(bucket: ThemeBucket, locale: SupportedLocale): WordCloudAnalysisEntry {
  const lexicalVariants = sortVariantEntries(bucket.textVariants, locale).map(
    ([variant]) => variant,
  );
  const members = [...bucket.members].sort(
    (left, right) => right.weight - left.weight || left.text.localeCompare(right.text),
  );

  if (!bucket.anchor || !bucket.anchorStats) {
    return {
      key: bucket.key,
      label: lexicalVariants[0] ?? bucket.key,
      count: bucket.count,
      basisLabel: null,
      members,
      variants: lexicalVariants,
      confidence: null,
    };
  }

  const anchorVariants = sortVariantEntries(bucket.anchorLabels, locale).map(
    ([variant]) => variant,
  );
  const basisLabel = anchorVariants[0] ?? lexicalVariants[0] ?? bucket.anchor.label;

  return {
    key: bucket.key,
    label: basisLabel,
    count: bucket.count,
    basisLabel,
    members,
    variants: anchorVariants.length > 0 ? anchorVariants : [basisLabel],
    confidence: computeConfidence(bucket.anchor, bucket.anchorStats, members.length),
  };
}

function computeConfidence(
  anchor: Candidate,
  stats: CandidateStats,
  memberCount: number,
): number | null {
  const confidence =
    0.12 +
    Math.min(3, stats.responseCount) * 0.17 +
    Math.min(3, memberCount) * 0.11 +
    (anchor.kind === 'phrase' ? 0.08 : 0.03) +
    (anchor.containsNumeric ? 0.03 : 0);

  return Math.min(0.97, Number(confidence.toFixed(2)));
}

function sortEntries(entries: WordCloudAnalysisEntry[], limit?: number): WordCloudAnalysisEntry[] {
  const sorted = [...entries].sort(
    (left, right) => right.count - left.count || left.label.localeCompare(right.label),
  );
  if (!limit || sorted.length <= limit) {
    return sorted;
  }

  return sorted.slice(0, limit);
}

export function tokenizeWordCloudText(value: string): WordCloudRawToken[] {
  const collapsed = collapseNumericSeparatorSpacing(value.trim());
  return Array.from(collapsed.matchAll(TOKEN_PATTERN), (match) => {
    const raw = match[0] ?? '';
    return {
      display: isNumericToken(raw) ? normalizeToken(raw) : raw,
      lookup: toWordCloudLookupToken(raw),
    };
  });
}

export function toWordCloudLookupToken(value: string): string {
  return normalizeLookupToken(value);
}

function getTokenCandidate(token: WordCloudRawToken, locale: SupportedLocale): Candidate {
  const pos = token.pos?.toUpperCase();
  if (isNumericToken(token.lookup)) {
    return {
      key: token.lookup,
      label: token.display,
      kind: 'token',
      containsNumeric: true,
      ...(pos ? { pos } : {}),
    };
  }

  const comparableToken = normalizeTokenForGrouping(token.lookup, locale);
  if (!pos) {
    for (const rule of GROUPING_RULES_BY_LOCALE[locale]) {
      const match = rule.pattern.exec(comparableToken);
      if (!match) {
        continue;
      }

      return {
        key: rule.toGroupKey(match),
        label: rule.toDisplay?.(match) ?? token.display,
        kind: 'token',
        containsNumeric: false,
      };
    }
  }

  return {
    key: comparableToken,
    label: token.display,
    kind: 'token',
    containsNumeric: false,
    ...(pos ? { pos } : {}),
  };
}

function shouldCreatePhrase(left: Candidate, right: Candidate): boolean {
  if (left.containsNumeric || left.key === right.key) {
    return false;
  }

  if (
    (!left.containsNumeric && left.label.length < 3) ||
    (!right.containsNumeric && right.label.length < 3)
  ) {
    return false;
  }

  if (right.containsNumeric) {
    return true;
  }

  return left.label.length >= 4 && right.label.length >= 4;
}

function isStopwordRawToken(token: WordCloudRawToken, locale: SupportedLocale): boolean {
  if (isStopwordToken(token.lookup, locale)) {
    return true;
  }

  return Boolean(token.surfaceLookup && isStopwordToken(token.surfaceLookup, locale));
}

function isLemmaUnigramCandidate(token: Candidate): boolean {
  return !token.pos || LEMMA_UNIGRAM_POS_TYPES.has(token.pos);
}

function isLemmaPhraseCandidate(token: Candidate): boolean {
  return !token.pos || LEMMA_PHRASE_POS_TYPES.has(token.pos);
}

function sliceHasLemmaNominalHead(tokens: readonly Candidate[]): boolean {
  if (tokens.every((token) => !token.pos)) {
    return true;
  }

  return tokens.some((token) => !token.pos || LEMMA_UNIGRAM_POS_TYPES.has(token.pos));
}

function isStopwordToken(token: string, locale: SupportedLocale): boolean {
  if (!token) {
    return true;
  }

  const lookup = STOPWORDS_BY_LOCALE[locale];
  if (lookup.has(token)) {
    return true;
  }

  const folded = foldWordCloudStopword(token, locale);
  return folded !== '' && lookup.has(folded);
}

function normalizeExactTextKey(value: string): string {
  return collapseNumericSeparatorSpacing(value)
    .trim()
    .replace(WHITESPACE_PATTERN, ' ')
    .toLocaleLowerCase();
}

function normalizeLookupToken(value: string): string {
  return normalizeToken(collapseNumericSeparatorSpacing(value).trim().toLocaleLowerCase());
}

function normalizeToken(value: string): string {
  if (isNumericToken(value)) {
    return value.replaceAll(',', '.');
  }

  return value;
}

function isNumericToken(value: string): boolean {
  return NUMBER_TOKEN_PATTERN.test(value);
}

function normalizeTokenForGrouping(token: string, locale: SupportedLocale): string {
  if (isNumericToken(token)) {
    return token;
  }

  let comparable = token;
  if (locale === 'de') {
    comparable = comparable
      .replaceAll('ä', 'ae')
      .replaceAll('ö', 'oe')
      .replaceAll('ü', 'ue')
      .replaceAll('ß', 'ss');
  }

  return comparable.normalize('NFKD').replace(COMBINING_MARK_PATTERN, '');
}

function sortVariantEntries(
  variants: ReadonlyMap<string, number>,
  locale: SupportedLocale,
): Array<[string, number]> {
  return [...variants.entries()].sort(
    ([leftVariant, leftCount], [rightVariant, rightCount]) =>
      rightCount - leftCount ||
      scoreDisplayVariant(rightVariant, locale) - scoreDisplayVariant(leftVariant, locale) ||
      leftVariant.length - rightVariant.length ||
      leftVariant.localeCompare(rightVariant),
  );
}

function scoreDisplayVariant(value: string, locale: SupportedLocale): number {
  let score = isAscii(value) ? 0 : 2;
  if (locale === 'de' && /(ae|oe|ue)/u.test(value)) {
    score -= 1;
  }

  return score;
}

function isAscii(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) > 0x7f) {
      return false;
    }
  }

  return true;
}

function collapseNumericSeparatorSpacing(value: string): string {
  return value.trim().replace(DECIMAL_SEPARATOR_SPACING_PATTERN, '$1$2');
}
