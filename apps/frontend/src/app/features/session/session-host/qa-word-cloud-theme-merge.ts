import {
  WORD_CLOUD_PHRASE_MAX_NGRAM_LENGTH,
  type AnalyzeWordCloudOutput,
} from '@arsnova/shared-types';

type WordCloudAnalysisEntry = AnalyzeWordCloudOutput['entries'][number];

export function isWordCloudUnigramEntryKey(key: string): boolean {
  return !key.includes(' ');
}

export function isPhraseLikeWordCloudEntry(entry: {
  readonly key: string;
  readonly label: string;
}): boolean {
  if (isWordCloudUnigramEntryKey(entry.key) && !/\s/u.test(entry.label.trim())) {
    return false;
  }

  return isShortWordCloudPhraseTokenCount(entry);
}

export function isDisplayableThemeWordCloudEntry(entry: {
  readonly key: string;
  readonly label: string;
}): boolean {
  const tokenCount = phraseTokenCount(entry);
  return tokenCount >= 1 && tokenCount <= WORD_CLOUD_PHRASE_MAX_NGRAM_LENGTH;
}

export function mergeThemePhrasesWithLemmaUnigrams(
  themeEntries: AnalyzeWordCloudOutput['entries'] | null | undefined,
  lemmaEntries: AnalyzeWordCloudOutput['entries'] | null | undefined,
  maxEntries: number,
): AnalyzeWordCloudOutput['entries'] {
  const phrases = (themeEntries ?? []).filter(isPhraseLikeWordCloudEntry);
  const unigrams = (lemmaEntries ?? []).filter((entry) => isWordCloudUnigramEntryKey(entry.key));
  return [...unigrams, ...phrases]
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, maxEntries);
}

function phraseTokenCount(entry: { readonly key: string; readonly label: string }): number {
  return Math.max(countPhraseTokens(entry.key), countPhraseTokens(entry.label));
}

function isShortWordCloudPhraseTokenCount(entry: {
  readonly key: string;
  readonly label: string;
}): boolean {
  const tokenCount = phraseTokenCount(entry);
  return tokenCount >= 2 && tokenCount <= WORD_CLOUD_PHRASE_MAX_NGRAM_LENGTH;
}

function countPhraseTokens(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/u).length;
}

export function selectFreetextLemmaDisplayEntries(
  entries: WordCloudAnalysisEntry[],
  mode: 'WORDS' | 'PHRASES' | 'SEMANTIC',
  maxEntries: number,
): WordCloudAnalysisEntry[] {
  const visible =
    mode === 'WORDS' ? entries.filter((entry) => isWordCloudUnigramEntryKey(entry.key)) : entries;
  return [...visible]
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, maxEntries);
}
