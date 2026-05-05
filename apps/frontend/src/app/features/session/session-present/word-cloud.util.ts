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

// Kurze Fachbegriffe wie "pi" oder "KI" sollen sichtbar bleiben.
// Ein-Zeichen-Rauschen wird nur fuer Nicht-Zahlen gefiltert.
const MIN_TEXT_TOKEN_LENGTH = 2;
const NUMBER_TOKEN_PATTERN = /^-?\d+(?:[.,]\d+)*$/;
const TOKEN_PATTERN = /-?\d+(?:[.,]\d+)*|[\p{L}\p{N}-]+/gu;
const DECIMAL_SEPARATOR_SPACING_PATTERN = /(\d)\s*([.,])\s*(?=\d)/g;

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
      if (!isNumericToken(word) && word.length < MIN_TEXT_TOKEN_LENGTH) continue;
      if (stopwords.has(word)) continue;
      counts.set(word, (counts.get(word) ?? 0) + weight);
    }
  }

  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

export function normalizeFreeTextResponseForDisplay(value: string): string {
  const collapsed = collapseNumericSeparatorSpacing(value);
  if (isNumericToken(collapsed)) {
    return normalizeToken(collapsed);
  }

  return value.trim();
}

export function responseContainsWord(response: string, word: string): boolean {
  const normalizedWord = normalizeToken(collapseNumericSeparatorSpacing(word).toLowerCase());
  return tokenize(response).includes(normalizedWord);
}

function normalizeWeight(weight?: number): number {
  if (!Number.isFinite(weight)) {
    return 1;
  }

  return Math.max(1, Math.round(weight ?? 1));
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

function collapseNumericSeparatorSpacing(value: string): string {
  return value.trim().replace(DECIMAL_SEPARATOR_SPACING_PATTERN, '$1$2');
}
