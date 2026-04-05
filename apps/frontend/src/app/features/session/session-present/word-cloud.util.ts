import { deu, eng, fra, ita, spa } from 'stopword';
import type { SupportedLocale } from '../../../core/locale-from-path';

export interface WordAggregate {
  word: string;
  count: number;
}

export interface WeightedWordSource {
  text: string;
  weight?: number;
}

const MIN_WORD_LENGTH = 3;

const STOPWORDS_BY_LOCALE: Record<SupportedLocale, ReadonlySet<string>> = {
  de: new Set(deu),
  en: new Set(eng),
  fr: new Set(fra),
  it: new Set(ita),
  es: new Set(spa),
};

export const DEFAULT_STOPWORDS = STOPWORDS_BY_LOCALE.de;

export function getStopwordsForLocale(locale: SupportedLocale): ReadonlySet<string> {
  return STOPWORDS_BY_LOCALE[locale] ?? DEFAULT_STOPWORDS;
}

export function aggregateWords(
  responses: string[],
  stopwords: ReadonlySet<string> = DEFAULT_STOPWORDS,
): WordAggregate[] {
  return aggregateWeightedWords(
    responses.map((response) => ({ text: response })),
    stopwords,
  );
}

export function aggregateWeightedWords(
  sources: WeightedWordSource[],
  stopwords: ReadonlySet<string> = DEFAULT_STOPWORDS,
): WordAggregate[] {
  const counts = new Map<string, number>();

  for (const source of sources) {
    const words = tokenize(source.text);
    const weight = normalizeWeight(source.weight);
    for (const word of words) {
      if (word.length < MIN_WORD_LENGTH) continue;
      if (stopwords.has(word)) continue;
      counts.set(word, (counts.get(word) ?? 0) + weight);
    }
  }

  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

function normalizeWeight(weight?: number): number {
  if (!Number.isFinite(weight)) {
    return 1;
  }

  return Math.max(1, Math.round(weight ?? 1));
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}-]+/gu, ' ')
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
