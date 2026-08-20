/**
 * Story 1.14c Stufe 1: semantischer Q&A-Themenmodus (Encoder + Clustering).
 *
 * Kein 8.9b-/8.9c-Vertrag. Encoder-HTTP bleibt backend-intern; das Frontend
 * spricht nur `wordCloud.analyze`. Pflichtlocales der Stufe: de/en.
 */

export const WORD_CLOUD_SEMANTIC_ANALYSIS_VERSION = '1.14c.1';

/** Hugging-Face-Karte; Digest kommt vom Inferenzdienst. */
export const WORD_CLOUD_SEMANTIC_MODEL_ID = 'intfloat/multilingual-e5-small';

export const WORD_CLOUD_SEMANTIC_LOCALES = ['de', 'en'] as const;
export type WordCloudSemanticLocale = (typeof WORD_CLOUD_SEMANTIC_LOCALES)[number];

export const WORD_CLOUD_ANALYSIS_CHANNEL_VALUES = ['QA', 'FREETEXT'] as const;
export type WordCloudAnalysisChannel = (typeof WORD_CLOUD_ANALYSIS_CHANNEL_VALUES)[number];

export const WORD_CLOUD_SEMANTIC_SOURCE_ID_PREFIX = 'qa-question:';

export const WORD_CLOUD_SEMANTIC_MIN_TOPICS = 5;
export const WORD_CLOUD_SEMANTIC_MAX_TOPICS = 12;

/** Average-Linkage: Cluster mergen, solange mittlere Kosinusähnlichkeit >= Schwelle. */
export const WORD_CLOUD_SEMANTIC_COSINE_THRESHOLD = 0.8;

export const WORD_CLOUD_SEMANTIC_MIN_CLUSTER_SIZE = 2;

export function isWordCloudSemanticLocale(locale: string): locale is WordCloudSemanticLocale {
  return (WORD_CLOUD_SEMANTIC_LOCALES as readonly string[]).includes(locale);
}

export function toWordCloudSemanticSourceId(itemId: string): string {
  const trimmed = itemId.trim();
  if (trimmed.startsWith(WORD_CLOUD_SEMANTIC_SOURCE_ID_PREFIX)) {
    return trimmed;
  }
  return `${WORD_CLOUD_SEMANTIC_SOURCE_ID_PREFIX}${trimmed}`;
}

export function fromWordCloudSemanticSourceId(sourceId: string): string {
  const trimmed = sourceId.trim();
  if (trimmed.startsWith(WORD_CLOUD_SEMANTIC_SOURCE_ID_PREFIX)) {
    return trimmed.slice(WORD_CLOUD_SEMANTIC_SOURCE_ID_PREFIX.length);
  }
  return trimmed;
}
