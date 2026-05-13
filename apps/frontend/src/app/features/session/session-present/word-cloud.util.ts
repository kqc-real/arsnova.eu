import { deu, eng, fra, ita, spa } from 'stopword';
import type { SupportedLocale } from '../../../core/locale-from-path';

export type WordCloudAnalysisMode = 'default' | 'qa';

export interface WordAggregate {
  word: string;
  count: number;
  groupKey: string;
  variants: string[];
}

export interface WeightedWordSource {
  text: string;
  weight?: number;
}

type GroupingKind = 'token' | 'phrase';

interface WordGrouping {
  readonly groupKey: string;
  readonly display: string;
  readonly preferredDisplay: string | null;
  readonly kind: GroupingKind;
  readonly containsNumeric: boolean;
}

interface AggregateBucket {
  readonly groupKey: string;
  readonly kind: GroupingKind;
  count: number;
  readonly variants: Map<string, number>;
  preferredDisplay: string | null;
}

interface ResponseGroupingBucket {
  readonly groupKey: string;
  readonly kind: GroupingKind;
  readonly containsNumeric: boolean;
  readonly displays: Set<string>;
  preferredDisplay: string | null;
}

interface GroupingRule {
  readonly pattern: RegExp;
  readonly toGroupKey: (match: RegExpExecArray) => string;
  readonly toDisplay?: (match: RegExpExecArray) => string;
}

// Kurze Fachbegriffe wie "pi" oder "KI" sollen sichtbar bleiben.
// Ein-Zeichen-Rauschen wird nur fuer Nicht-Zahlen gefiltert.
const MIN_TEXT_TOKEN_LENGTH = 2;
const NUMBER_TOKEN_PATTERN = /^-?\d+(?:[.,]\d+)*$/;
const TOKEN_PATTERN = /-?\d+(?:[.,]\d+)*|[\p{L}\p{N}-]+/gu;
const DECIMAL_SEPARATOR_SPACING_PATTERN = /(\d)\s*([.,])\s*(?=\d)/g;
const COMBINING_MARK_PATTERN = /\p{M}+/gu;

const GERMAN_GROUPING_RULES: readonly GroupingRule[] = [
  {
    pattern: /^haeng(?:e|en|t|te|ten|tet|test|end|ende|endem|enden|ender|endes)$/u,
    toGroupKey: () => 'haengen',
    toDisplay: () => 'hängen',
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

const GROUPING_RULES_BY_LOCALE: Partial<Record<SupportedLocale, readonly GroupingRule[]>> = {
  de: GERMAN_GROUPING_RULES,
  en: ENGLISH_GROUPING_RULES,
};

const STOPWORDS_BY_LOCALE: Record<SupportedLocale, ReadonlySet<string>> = {
  de: new Set(deu),
  en: new Set(eng),
  fr: new Set(fra),
  it: new Set(ita),
  es: new Set(spa),
};

const QA_EXTRA_STOPWORDS_BY_LOCALE: Partial<Record<SupportedLocale, readonly string[]>> = {
  de: [
    'bitte',
    'genau',
    'einmal',
    'nochmal',
    'nochmals',
    'kommt',
    'kommen',
    'kann',
    'kannst',
    'könnt',
    'koennt',
    'können',
    'koennen',
    'brauchen',
    'braucht',
    'muss',
    'müssen',
    'muessen',
    'soll',
    'sollen',
    'gemeint',
  ],
  en: ['please', 'exactly', 'again', 'could', 'would', 'should', 'need', 'needs', 'needed'],
  fr: ['svp', "s'il", 'vous', 'plait', 'encore', 'exactement', 'faut', 'doit', 'doivent'],
  it: ['per', 'favore', 'ancora', 'esattamente', 'serve', 'servono', 'devo', 'dobbiamo'],
  es: ['favor', 'exactamente', 'otra', 'vez', 'puede', 'pueden', 'necesito', 'necesitamos'],
};

export const DEFAULT_STOPWORDS = STOPWORDS_BY_LOCALE.de;

export function getStopwordsForLocale(locale: SupportedLocale): ReadonlySet<string> {
  return STOPWORDS_BY_LOCALE[locale] ?? DEFAULT_STOPWORDS;
}

export function createWordCloudStopwordLookup(
  stopwords: ReadonlySet<string> = DEFAULT_STOPWORDS,
  locale: SupportedLocale = 'de',
  analysisMode: WordCloudAnalysisMode = 'default',
): ReadonlySet<string> {
  return createStopwordLookup(stopwords, locale, analysisMode);
}

export function aggregateWords(
  responses: string[],
  stopwords: ReadonlySet<string> = DEFAULT_STOPWORDS,
  locale: SupportedLocale = 'de',
  analysisMode: WordCloudAnalysisMode = 'default',
): WordAggregate[] {
  return aggregateWeightedWords(
    responses.map((response) => ({ text: response })),
    stopwords,
    locale,
    analysisMode,
  );
}

export function aggregateWeightedWords(
  sources: WeightedWordSource[],
  stopwords: ReadonlySet<string> = DEFAULT_STOPWORDS,
  locale: SupportedLocale = 'de',
  analysisMode: WordCloudAnalysisMode = 'default',
): WordAggregate[] {
  const buckets = new Map<string, AggregateBucket>();
  const stopwordLookup = createWordCloudStopwordLookup(stopwords, locale, analysisMode);
  const groupedSources = sources.map((source) => ({
    weight: normalizeWeight(source.weight),
    groupings: [
      ...collectResponseGroupings(source.text, stopwordLookup, locale, analysisMode).values(),
    ],
  }));
  const phraseResponseSupport = new Map<string, number>();
  const phraseWeightedSupport = new Map<string, number>();

  for (const source of groupedSources) {
    for (const grouping of source.groupings) {
      if (grouping.kind !== 'phrase') {
        continue;
      }

      phraseResponseSupport.set(
        grouping.groupKey,
        (phraseResponseSupport.get(grouping.groupKey) ?? 0) + 1,
      );
      phraseWeightedSupport.set(
        grouping.groupKey,
        (phraseWeightedSupport.get(grouping.groupKey) ?? 0) + source.weight,
      );
    }
  }

  for (const source of groupedSources) {
    for (const grouping of source.groupings) {
      if (
        grouping.kind === 'phrase' &&
        !shouldAggregatePhrase(grouping, phraseResponseSupport, phraseWeightedSupport)
      ) {
        continue;
      }

      const bucket = getOrCreateBucket(buckets, grouping);
      bucket.count += source.weight;
      for (const display of grouping.displays) {
        bucket.variants.set(display, (bucket.variants.get(display) ?? 0) + source.weight);
      }
      if (grouping.preferredDisplay) {
        bucket.preferredDisplay = bucket.preferredDisplay ?? grouping.preferredDisplay;
      }
    }
  }

  return [...buckets.values()]
    .map((bucket) => {
      const variants = sortVariantEntries(bucket.variants, locale).map(([variant]) => variant);
      return {
        word: bucket.preferredDisplay ?? variants[0] ?? bucket.groupKey,
        count: bucket.count,
        groupKey: bucket.groupKey,
        variants,
      };
    })
    .sort((a, b) => {
      const rightBucket = buckets.get(b.groupKey);
      const leftBucket = buckets.get(a.groupKey);
      return (
        b.count - a.count ||
        scoreGroupingKind(rightBucket?.kind ?? 'token') -
          scoreGroupingKind(leftBucket?.kind ?? 'token') ||
        a.word.localeCompare(b.word)
      );
    });
}

export function getWordCloudWeightFromUpvotes(upvoteCount: number): number {
  if (!Number.isFinite(upvoteCount)) {
    return 1;
  }

  const normalized = Math.max(0, Math.round(upvoteCount));
  return 1 + Math.max(0, Math.round(Math.sqrt(normalized)));
}

export function normalizeFreeTextResponseForDisplay(value: string): string {
  const collapsed = collapseNumericSeparatorSpacing(value);
  if (isNumericToken(collapsed)) {
    return normalizeToken(collapsed);
  }

  return value.trim();
}

export function responseContainsWord(
  response: string,
  word: string,
  locale: SupportedLocale = 'de',
  analysisMode: WordCloudAnalysisMode = 'default',
): boolean {
  const targetGroupKey = getLookupGroupKey(word, locale);
  if (!targetGroupKey) {
    return false;
  }

  return collectResponseGroupings(response, new Set<string>(), locale, analysisMode).has(
    targetGroupKey,
  );
}

export function extractResponseGroupKeys(
  response: string,
  stopwordLookup: ReadonlySet<string>,
  locale: SupportedLocale = 'de',
  analysisMode: WordCloudAnalysisMode = 'default',
): string[] {
  return [...collectResponseGroupings(response, stopwordLookup, locale, analysisMode).keys()];
}

function normalizeWeight(weight?: number): number {
  if (!Number.isFinite(weight)) {
    return 1;
  }

  return Math.max(1, Math.round(weight ?? 1));
}

function getOrCreateBucket(
  buckets: Map<string, AggregateBucket>,
  grouping: ResponseGroupingBucket,
): AggregateBucket {
  const existing = buckets.get(grouping.groupKey);
  if (existing) {
    return existing;
  }

  const created: AggregateBucket = {
    groupKey: grouping.groupKey,
    kind: grouping.kind,
    count: 0,
    variants: new Map<string, number>(),
    preferredDisplay: null,
  };
  buckets.set(grouping.groupKey, created);
  return created;
}

function collectResponseGroupings(
  response: string,
  stopwordLookup: ReadonlySet<string>,
  locale: SupportedLocale,
  analysisMode: WordCloudAnalysisMode,
): Map<string, ResponseGroupingBucket> {
  const groupings = new Map<string, ResponseGroupingBucket>();
  const tokenGroupings: WordGrouping[] = [];

  for (const word of tokenize(response)) {
    if (!isNumericToken(word) && word.length < MIN_TEXT_TOKEN_LENGTH) continue;
    const grouping = getWordGrouping(word, locale);
    if (stopwordLookup.has(word) || stopwordLookup.has(grouping.groupKey)) continue;

    tokenGroupings.push(grouping);
    addResponseGrouping(groupings, grouping);
  }

  if (analysisMode === 'qa') {
    for (const phrase of buildQaPhraseGroupings(tokenGroupings)) {
      addResponseGrouping(groupings, phrase);
    }
  }

  return groupings;
}

function addResponseGrouping(
  groupings: Map<string, ResponseGroupingBucket>,
  grouping: WordGrouping,
): void {
  const bucket = getOrCreateResponseGroupingBucket(groupings, grouping);
  bucket.displays.add(grouping.display);
  if (grouping.preferredDisplay) {
    bucket.preferredDisplay = bucket.preferredDisplay ?? grouping.preferredDisplay;
  }
}

function getOrCreateResponseGroupingBucket(
  groupings: Map<string, ResponseGroupingBucket>,
  grouping: WordGrouping,
): ResponseGroupingBucket {
  const existing = groupings.get(grouping.groupKey);
  if (existing) {
    return existing;
  }

  const created: ResponseGroupingBucket = {
    groupKey: grouping.groupKey,
    kind: grouping.kind,
    containsNumeric: grouping.containsNumeric,
    displays: new Set<string>(),
    preferredDisplay: null,
  };
  groupings.set(grouping.groupKey, created);
  return created;
}

function tokenize(value: string): string[] {
  const normalizedInput = collapseNumericSeparatorSpacing(value).toLowerCase();
  return Array.from(normalizedInput.matchAll(TOKEN_PATTERN), (match) => normalizeToken(match[0]!));
}

function isNumericToken(value: string): boolean {
  return NUMBER_TOKEN_PATTERN.test(value);
}

function normalizeToken(value: string): string {
  if (isNumericToken(value)) {
    // "3,14" und "3.14" sollen in derselben Wolke zusammenlaufen.
    return value.replaceAll(',', '.');
  }

  return value;
}

function createStopwordLookup(
  stopwords: ReadonlySet<string>,
  locale: SupportedLocale,
  analysisMode: WordCloudAnalysisMode,
): ReadonlySet<string> {
  const lookup = new Set<string>();
  for (const stopword of [...stopwords, ...getAnalysisStopwords(locale, analysisMode)]) {
    const normalized = normalizeLookupToken(stopword);
    if (!normalized) {
      continue;
    }

    lookup.add(normalized);
    lookup.add(getWordGrouping(normalized, locale).groupKey);
  }

  return lookup;
}

function normalizeLookupToken(value: string): string {
  return normalizeToken(collapseNumericSeparatorSpacing(value).trim().toLowerCase());
}

function getLookupGroupKey(value: string, locale: SupportedLocale): string {
  const tokens = tokenize(value).filter(
    (token) => isNumericToken(token) || token.length >= MIN_TEXT_TOKEN_LENGTH,
  );
  if (tokens.length === 0) {
    return '';
  }

  return tokens.map((token) => getWordGrouping(token, locale).groupKey).join(' ');
}

function getWordGrouping(token: string, locale: SupportedLocale): WordGrouping {
  if (isNumericToken(token)) {
    return {
      groupKey: token,
      display: token,
      preferredDisplay: token,
      kind: 'token',
      containsNumeric: true,
    };
  }

  const comparableToken = normalizeTokenForGrouping(token, locale);
  const rules = GROUPING_RULES_BY_LOCALE[locale] ?? [];
  for (const rule of rules) {
    const match = rule.pattern.exec(comparableToken);
    if (!match) {
      continue;
    }

    return {
      groupKey: rule.toGroupKey(match),
      display: token,
      preferredDisplay: rule.toDisplay?.(match) ?? null,
      kind: 'token',
      containsNumeric: false,
    };
  }

  return {
    groupKey: comparableToken,
    display: token,
    preferredDisplay: null,
    kind: 'token',
    containsNumeric: false,
  };
}

function getAnalysisStopwords(
  locale: SupportedLocale,
  analysisMode: WordCloudAnalysisMode,
): readonly string[] {
  if (analysisMode !== 'qa') {
    return [];
  }

  return QA_EXTRA_STOPWORDS_BY_LOCALE[locale] ?? [];
}

function buildQaPhraseGroupings(tokens: readonly WordGrouping[]): WordGrouping[] {
  const phrases: WordGrouping[] = [];
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const left = tokens[index]!;
    const right = tokens[index + 1]!;
    if (!shouldCreateQaPhrase(left, right)) {
      continue;
    }

    phrases.push({
      groupKey: `${left.groupKey} ${right.groupKey}`,
      display: `${left.display} ${right.display}`,
      preferredDisplay: `${left.preferredDisplay ?? left.display} ${
        right.preferredDisplay ?? right.display
      }`,
      kind: 'phrase',
      containsNumeric: left.containsNumeric || right.containsNumeric,
    });
  }

  return phrases;
}

function shouldCreateQaPhrase(left: WordGrouping, right: WordGrouping): boolean {
  if (left.containsNumeric || left.groupKey === right.groupKey) {
    return false;
  }

  const leftLabel = left.preferredDisplay ?? left.display;
  const rightLabel = right.preferredDisplay ?? right.display;
  if (
    (!left.containsNumeric && leftLabel.length < 3) ||
    (!right.containsNumeric && rightLabel.length < 3)
  ) {
    return false;
  }

  if (right.containsNumeric) {
    return true;
  }

  return leftLabel.length >= 4 && rightLabel.length >= 4;
}

function shouldAggregatePhrase(
  grouping: ResponseGroupingBucket,
  phraseResponseSupport: ReadonlyMap<string, number>,
  phraseWeightedSupport: ReadonlyMap<string, number>,
): boolean {
  if (grouping.containsNumeric) {
    return true;
  }

  return (
    (phraseResponseSupport.get(grouping.groupKey) ?? 0) > 1 ||
    (phraseWeightedSupport.get(grouping.groupKey) ?? 0) >= 3
  );
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

function scoreGroupingKind(kind: GroupingKind): number {
  return kind === 'phrase' ? 1 : 0;
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
