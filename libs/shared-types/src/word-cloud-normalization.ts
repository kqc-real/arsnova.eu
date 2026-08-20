/**
 * Story 1.14b: optionale sprachliche Glättung der Wortwolke.
 *
 * spaCy liefert nur Lemma/POS-Hilfsdaten. Semantische Themen gehören zu Story 1.14c.
 * Diese Datei ist die schema-nahe Quelle für Normalisierungsmodus, Locale-/Lizenzgrenze
 * (`de`/`en` MIT, `fr` LGPL-LR, `es` GPL-3.0; `it` ausgeschlossen) und den Resolver,
 * der entscheidet, ob LEMMA tatsächlich angewandt werden darf.
 */

export const WORD_CLOUD_NORMALIZATION_VALUES = ['NONE', 'LEMMA'] as const;
type WordCloudNormalization = (typeof WORD_CLOUD_NORMALIZATION_VALUES)[number];
export const WORD_CLOUD_DEFAULT_NORMALIZATION: WordCloudNormalization = 'NONE';

/** Vertragsversion der Normalisierungsachse; Cache- und Snapshot-Schlüssel müssen sie enthalten. */
export const WORD_CLOUD_NORMALIZATION_ANALYSIS_VERSION = '1.14b.8';

/** Hartes Textbudget je Analyse-Item; identisch zum Sidecar-Client. */
export const WORD_CLOUD_MAX_ITEM_TEXT_CHARS = 4_000;

/** Obere Grenze für stabile Item-IDs (UUIDs oder `response-${index}`). */
export const WORD_CLOUD_MAX_ITEM_ID_CHARS = 128;

/** Snapshot-Größe; deckt Hörsaal-Q&A und Freitext ab. */
export const WORD_CLOUD_MAX_ANALYZE_ITEMS = 500;

/**
 * N-Gramm-Länge der lexikalischen Aggregation.
 * `1` = nur Unigramme (Q&A-Einzelwörter, Default).
 * `2`/`3` = zusätzlich Bigramme bzw. Trigramme für Freitext „Wörter & Phrasen“.
 */
export const WORD_CLOUD_MAX_NGRAM_LENGTH_VALUES = [1, 2, 3] as const;
export type WordCloudMaxNgramLength = (typeof WORD_CLOUD_MAX_NGRAM_LENGTH_VALUES)[number];
export const WORD_CLOUD_DEFAULT_MAX_NGRAM_LENGTH: WordCloudMaxNgramLength = 1;
export const WORD_CLOUD_PHRASE_MAX_NGRAM_LENGTH: WordCloudMaxNgramLength = 3;

/** Transiente Sidecar-Fehler: nicht cachen, damit ein Retry den Dienst erneut versucht. */
export const WORD_CLOUD_TRANSIENT_NORMALIZATION_FALLBACK_REASONS = [
  'TIMEOUT',
  'SIDECAR_UNAVAILABLE',
  'INVALID_RESPONSE',
] as const;

/** Gepinnte spaCy-Runtime für das Sidecar (Phase 3). Patch-Updates bleiben in 3.8.x. */
export const WORD_CLOUD_SPACY_RUNTIME_VERSION = '3.8.15';

export const WORD_CLOUD_LEMMA_LOCALES = ['de', 'en', 'fr', 'es'] as const;
export type WordCloudLemmaLocale = (typeof WORD_CLOUD_LEMMA_LOCALES)[number];

export const WORD_CLOUD_LEMMA_EXCLUDED_LOCALES = ['it'] as const;
export type WordCloudLemmaExcludedLocale = (typeof WORD_CLOUD_LEMMA_EXCLUDED_LOCALES)[number];

export interface WordCloudLemmaModelPin {
  readonly id: string;
  readonly version: string;
  readonly license: string;
}

export const WORD_CLOUD_LEMMA_MODELS = {
  de: { id: 'de_core_news_sm', version: '3.8.0', license: 'MIT' },
  en: { id: 'en_core_web_sm', version: '3.8.0', license: 'MIT' },
  fr: { id: 'fr_core_news_sm', version: '3.8.0', license: 'LGPL-LR' },
  es: { id: 'es_core_news_sm', version: '3.8.0', license: 'GPL-3.0' },
} as const satisfies Record<WordCloudLemmaLocale, WordCloudLemmaModelPin>;

export const WORD_CLOUD_LEMMA_EXCLUDED_MODELS = {
  it: { id: 'it_core_news_sm', version: '3.8.0', license: 'CC BY-NC-SA 3.0' },
} as const satisfies Record<WordCloudLemmaExcludedLocale, WordCloudLemmaModelPin>;

export const WORD_CLOUD_NORMALIZATION_FALLBACK_REASONS = [
  'NLP_DISABLED',
  'LOCALE_UNSUPPORTED',
  'MODE_UNSUPPORTED',
  'SIDECAR_UNAVAILABLE',
  'TIMEOUT',
  'INVALID_RESPONSE',
] as const;
type WordCloudNormalizationFallbackReason =
  (typeof WORD_CLOUD_NORMALIZATION_FALLBACK_REASONS)[number];

export function isWordCloudLemmaLocale(locale: string): locale is WordCloudLemmaLocale {
  return (WORD_CLOUD_LEMMA_LOCALES as readonly string[]).includes(locale);
}

export function isTransientWordCloudNormalizationFallback(
  reason: WordCloudNormalizationFallbackReason | null | undefined,
): boolean {
  return reason === 'TIMEOUT' || reason === 'SIDECAR_UNAVAILABLE' || reason === 'INVALID_RESPONSE';
}

export function wordCloudLemmaModelId(locale: string): string | null {
  if (!isWordCloudLemmaLocale(locale)) {
    return null;
  }
  const model = WORD_CLOUD_LEMMA_MODELS[locale];
  return `${model.id}@${model.version}`;
}

export interface ResolveWordCloudLemmaApplicationInput {
  readonly requested: WordCloudNormalization;
  readonly mode: 'LEXICAL' | 'THEME' | 'SEMANTIC';
  readonly locale: string;
  readonly nlpEnabled: boolean;
  readonly sidecarAvailable: boolean;
}

export interface WordCloudLemmaApplication {
  readonly requested: WordCloudNormalization;
  readonly applied: WordCloudNormalization;
  readonly fallbackUsed: boolean;
  readonly reason: WordCloudNormalizationFallbackReason | null;
  readonly fallbackLocale: string;
  readonly modelId: string | null;
}

/**
 * Entscheidet, ob eine angeforderte Lemma-Glättung tatsächlich laufen darf.
 *
 * THEME + LEMMA und SEMANTIC + LEMMA sind bewusst kein Produktpfad.
 * Ohne erreichbaren Sidecar bleibt applied immer NONE.
 */
export function resolveWordCloudLemmaApplication(
  input: ResolveWordCloudLemmaApplicationInput,
): WordCloudLemmaApplication {
  const fallbackLocale = isWordCloudLemmaLocale(input.locale) ? input.locale : 'de';

  if (input.requested === 'NONE') {
    return {
      requested: 'NONE',
      applied: 'NONE',
      fallbackUsed: false,
      reason: null,
      fallbackLocale,
      modelId: null,
    };
  }

  if (input.mode !== 'LEXICAL') {
    return createWordCloudLemmaFallback(input.requested, fallbackLocale, 'MODE_UNSUPPORTED');
  }
  if (!isWordCloudLemmaLocale(input.locale)) {
    return createWordCloudLemmaFallback(input.requested, fallbackLocale, 'LOCALE_UNSUPPORTED');
  }
  if (!input.nlpEnabled) {
    return createWordCloudLemmaFallback(input.requested, fallbackLocale, 'NLP_DISABLED');
  }
  if (!input.sidecarAvailable) {
    return createWordCloudLemmaFallback(input.requested, fallbackLocale, 'SIDECAR_UNAVAILABLE');
  }

  return {
    requested: 'LEMMA',
    applied: 'LEMMA',
    fallbackUsed: false,
    reason: null,
    fallbackLocale: input.locale,
    modelId: wordCloudLemmaModelId(input.locale),
  };
}

export function createWordCloudLemmaFallback(
  requested: WordCloudNormalization,
  fallbackLocale: string,
  reason: WordCloudNormalizationFallbackReason,
): WordCloudLemmaApplication {
  return {
    requested,
    applied: 'NONE',
    fallbackUsed: true,
    reason,
    fallbackLocale,
    modelId: null,
  };
}
