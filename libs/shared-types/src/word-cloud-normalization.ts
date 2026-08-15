/**
 * Story 1.14b: optionale sprachliche Glättung der Wortwolke.
 *
 * spaCy liefert nur Lemma/POS-Hilfsdaten. Semantische Themen gehören zu Story 1.14c.
 * Diese Datei ist die schema-nahe Quelle für Normalisierungsmodus, Locale-/Lizenzgrenze
 * und den Resolver, der entscheidet, ob LEMMA tatsächlich angewandt werden darf.
 */

export const WORD_CLOUD_NORMALIZATION_VALUES = ['NONE', 'LEMMA'] as const;
type WordCloudNormalization = (typeof WORD_CLOUD_NORMALIZATION_VALUES)[number];
export const WORD_CLOUD_DEFAULT_NORMALIZATION: WordCloudNormalization = 'NONE';

/** Vertragsversion der Normalisierungsachse; Cache- und Snapshot-Schlüssel müssen sie enthalten. */
export const WORD_CLOUD_NORMALIZATION_ANALYSIS_VERSION = '1.14b.1';

/** Gepinnte spaCy-Runtime für das Sidecar (Phase 3). Patch-Updates bleiben in 3.8.x. */
export const WORD_CLOUD_SPACY_RUNTIME_VERSION = '3.8.15';

export const WORD_CLOUD_LEMMA_LOCALES = ['de', 'en'] as const;
export type WordCloudLemmaLocale = (typeof WORD_CLOUD_LEMMA_LOCALES)[number];

export const WORD_CLOUD_LEMMA_DEFERRED_LOCALES = ['fr', 'es'] as const;
export type WordCloudLemmaDeferredLocale = (typeof WORD_CLOUD_LEMMA_DEFERRED_LOCALES)[number];

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
} as const satisfies Record<WordCloudLemmaLocale, WordCloudLemmaModelPin>;

export const WORD_CLOUD_LEMMA_DEFERRED_MODELS = {
  fr: { id: 'fr_core_news_sm', version: '3.8.0', license: 'LGPL-LR' },
  es: { id: 'es_core_news_sm', version: '3.8.0', license: 'GPL-3.0' },
} as const satisfies Record<WordCloudLemmaDeferredLocale, WordCloudLemmaModelPin>;

export const WORD_CLOUD_LEMMA_EXCLUDED_MODELS = {
  it: { id: 'it_core_news_sm', version: '3.8.0', license: 'CC BY-NC-SA 3.0' },
} as const satisfies Record<WordCloudLemmaExcludedLocale, WordCloudLemmaModelPin>;

export const WORD_CLOUD_NORMALIZATION_FALLBACK_REASONS = [
  'NLP_DISABLED',
  'LOCALE_UNSUPPORTED',
  'MODE_UNSUPPORTED',
  'SIDECAR_UNAVAILABLE',
] as const;
type WordCloudNormalizationFallbackReason =
  (typeof WORD_CLOUD_NORMALIZATION_FALLBACK_REASONS)[number];

export function isWordCloudLemmaLocale(locale: string): locale is WordCloudLemmaLocale {
  return locale === 'de' || locale === 'en';
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
  readonly mode: 'LEXICAL' | 'THEME';
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
 * THEME + LEMMA ist in Story 1.14b bewusst kein Produktpfad.
 * Ohne Sidecar (Phase 1–2) bleibt applied immer NONE.
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
    return deny(input.requested, fallbackLocale, 'MODE_UNSUPPORTED');
  }
  if (!isWordCloudLemmaLocale(input.locale)) {
    return deny(input.requested, fallbackLocale, 'LOCALE_UNSUPPORTED');
  }
  if (!input.nlpEnabled) {
    return deny(input.requested, fallbackLocale, 'NLP_DISABLED');
  }
  if (!input.sidecarAvailable) {
    return deny(input.requested, fallbackLocale, 'SIDECAR_UNAVAILABLE');
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

function deny(
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
