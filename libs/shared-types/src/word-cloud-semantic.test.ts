import { describe, expect, it } from 'vitest';
import {
  fromWordCloudSemanticSourceId,
  isWordCloudSemanticLocale,
  toWordCloudSemanticSourceId,
  WORD_CLOUD_SEMANTIC_ANALYSIS_VERSION,
  WORD_CLOUD_SEMANTIC_LOCALES,
  WORD_CLOUD_SEMANTIC_MAX_TOPICS,
  WORD_CLOUD_SEMANTIC_SOURCE_ID_PREFIX,
} from './word-cloud-semantic.js';

describe('word-cloud-semantic', () => {
  it('begrenzt Pflichtlocales auf de und en', () => {
    expect(WORD_CLOUD_SEMANTIC_LOCALES).toEqual(['de', 'en']);
    expect(isWordCloudSemanticLocale('de')).toBe(true);
    expect(isWordCloudSemanticLocale('fr')).toBe(false);
    expect(WORD_CLOUD_SEMANTIC_ANALYSIS_VERSION).toBe('1.14c.1');
    expect(WORD_CLOUD_SEMANTIC_MAX_TOPICS).toBe(12);
  });

  it('bildet anonyme Quellschluessel ohne Participant-IDs', () => {
    const sourceId = toWordCloudSemanticSourceId('11111111-1111-4111-8111-111111111111');
    expect(sourceId).toBe(
      `${WORD_CLOUD_SEMANTIC_SOURCE_ID_PREFIX}11111111-1111-4111-8111-111111111111`,
    );
    expect(fromWordCloudSemanticSourceId(sourceId)).toBe('11111111-1111-4111-8111-111111111111');
    expect(toWordCloudSemanticSourceId(sourceId)).toBe(sourceId);
  });
});
