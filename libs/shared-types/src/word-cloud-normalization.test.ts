import { describe, expect, it } from 'vitest';
import {
  isTransientWordCloudNormalizationFallback,
  isWordCloudLemmaLocale,
  resolveWordCloudLemmaApplication,
  WORD_CLOUD_DEFAULT_MAX_NGRAM_LENGTH,
  WORD_CLOUD_DEFAULT_NORMALIZATION,
  WORD_CLOUD_LEMMA_EXCLUDED_MODELS,
  WORD_CLOUD_LEMMA_MODELS,
  WORD_CLOUD_MAX_ANALYZE_ITEMS,
  WORD_CLOUD_MAX_ITEM_TEXT_CHARS,
  WORD_CLOUD_MAX_NGRAM_LENGTH_VALUES,
  WORD_CLOUD_PHRASE_MAX_NGRAM_LENGTH,
  WORD_CLOUD_NORMALIZATION_ANALYSIS_VERSION,
  WORD_CLOUD_SPACY_RUNTIME_VERSION,
  createWordCloudLemmaFallback,
  wordCloudLemmaModelId,
} from './word-cloud-normalization.js';

describe('word-cloud-normalization (Story 1.14b)', () => {
  it('begrenzt Lemma-Locales auf de/en/fr/es und haelt it ausserhalb', () => {
    expect(isWordCloudLemmaLocale('de')).toBe(true);
    expect(isWordCloudLemmaLocale('en')).toBe(true);
    expect(isWordCloudLemmaLocale('fr')).toBe(true);
    expect(isWordCloudLemmaLocale('es')).toBe(true);
    expect(isWordCloudLemmaLocale('it')).toBe(false);
    expect(WORD_CLOUD_LEMMA_MODELS.de.license).toBe('MIT');
    expect(WORD_CLOUD_LEMMA_MODELS.en.license).toBe('MIT');
    expect(WORD_CLOUD_LEMMA_MODELS.fr.license).toBe('LGPL-LR');
    expect(WORD_CLOUD_LEMMA_MODELS.es.license).toBe('GPL-3.0');
    expect(WORD_CLOUD_LEMMA_EXCLUDED_MODELS.it.license).toBe('CC BY-NC-SA 3.0');
    expect(wordCloudLemmaModelId('de')).toBe('de_core_news_sm@3.8.0');
    expect(wordCloudLemmaModelId('fr')).toBe('fr_core_news_sm@3.8.0');
    expect(wordCloudLemmaModelId('es')).toBe('es_core_news_sm@3.8.0');
    expect(wordCloudLemmaModelId('it')).toBeNull();
  });

  it('pinnt Runtime und Vertragsversion für Cache-Schlüssel', () => {
    expect(WORD_CLOUD_SPACY_RUNTIME_VERSION).toBe('3.8.15');
    expect(WORD_CLOUD_NORMALIZATION_ANALYSIS_VERSION).toBe('1.14b.8');
    expect(WORD_CLOUD_DEFAULT_NORMALIZATION).toBe('NONE');
    expect(WORD_CLOUD_DEFAULT_MAX_NGRAM_LENGTH).toBe(1);
    expect(WORD_CLOUD_PHRASE_MAX_NGRAM_LENGTH).toBe(3);
    expect(WORD_CLOUD_MAX_NGRAM_LENGTH_VALUES).toEqual([1, 2, 3]);
    expect(WORD_CLOUD_MAX_ITEM_TEXT_CHARS).toBe(4000);
    expect(WORD_CLOUD_MAX_ANALYZE_ITEMS).toBe(500);
  });

  it('markiert nur transiente Sidecar-Fehler als nicht cachebar', () => {
    expect(isTransientWordCloudNormalizationFallback('TIMEOUT')).toBe(true);
    expect(isTransientWordCloudNormalizationFallback('SIDECAR_UNAVAILABLE')).toBe(true);
    expect(isTransientWordCloudNormalizationFallback('INVALID_RESPONSE')).toBe(true);
    expect(isTransientWordCloudNormalizationFallback('NLP_DISABLED')).toBe(false);
    expect(isTransientWordCloudNormalizationFallback('MODE_UNSUPPORTED')).toBe(false);
    expect(isTransientWordCloudNormalizationFallback(null)).toBe(false);
  });

  it('laesst NONE unveraendert und ohne Fallback', () => {
    expect(
      resolveWordCloudLemmaApplication({
        requested: 'NONE',
        mode: 'LEXICAL',
        locale: 'de',
        nlpEnabled: true,
        sidecarAvailable: true,
      }),
    ).toEqual({
      requested: 'NONE',
      applied: 'NONE',
      fallbackUsed: false,
      reason: null,
      fallbackLocale: 'de',
      modelId: null,
    });
  });

  it('wendet LEMMA nur im lexikalischen Pfad mit aktivem Sidecar an', () => {
    expect(
      resolveWordCloudLemmaApplication({
        requested: 'LEMMA',
        mode: 'LEXICAL',
        locale: 'en',
        nlpEnabled: true,
        sidecarAvailable: true,
      }),
    ).toEqual({
      requested: 'LEMMA',
      applied: 'LEMMA',
      fallbackUsed: false,
      reason: null,
      fallbackLocale: 'en',
      modelId: 'en_core_web_sm@3.8.0',
    });
  });

  it('lehnt THEME + LEMMA als Mode-Fallback ab', () => {
    expect(
      resolveWordCloudLemmaApplication({
        requested: 'LEMMA',
        mode: 'THEME',
        locale: 'de',
        nlpEnabled: true,
        sidecarAvailable: true,
      }).reason,
    ).toBe('MODE_UNSUPPORTED');
  });

  it('faellt bei deaktiviertem NLP und fehlendem Sidecar lexikalisch zurueck', () => {
    expect(
      resolveWordCloudLemmaApplication({
        requested: 'LEMMA',
        mode: 'LEXICAL',
        locale: 'de',
        nlpEnabled: false,
        sidecarAvailable: false,
      }).reason,
    ).toBe('NLP_DISABLED');
    expect(
      resolveWordCloudLemmaApplication({
        requested: 'LEMMA',
        mode: 'LEXICAL',
        locale: 'de',
        nlpEnabled: true,
        sidecarAvailable: false,
      }).reason,
    ).toBe('SIDECAR_UNAVAILABLE');
  });

  it('bildet Laufzeit-Fallbacks fuer Timeout und ungueltige Sidecar-Antworten', () => {
    expect(createWordCloudLemmaFallback('LEMMA', 'de', 'TIMEOUT')).toMatchObject({
      requested: 'LEMMA',
      applied: 'NONE',
      reason: 'TIMEOUT',
      modelId: null,
    });
    expect(createWordCloudLemmaFallback('LEMMA', 'en', 'INVALID_RESPONSE').reason).toBe(
      'INVALID_RESPONSE',
    );
  });

  it('wendet LEMMA fuer fr und es an und haelt it ausserhalb', () => {
    expect(
      resolveWordCloudLemmaApplication({
        requested: 'LEMMA',
        mode: 'LEXICAL',
        locale: 'fr',
        nlpEnabled: true,
        sidecarAvailable: true,
      }),
    ).toEqual({
      requested: 'LEMMA',
      applied: 'LEMMA',
      fallbackUsed: false,
      reason: null,
      fallbackLocale: 'fr',
      modelId: 'fr_core_news_sm@3.8.0',
    });
    expect(
      resolveWordCloudLemmaApplication({
        requested: 'LEMMA',
        mode: 'LEXICAL',
        locale: 'es',
        nlpEnabled: true,
        sidecarAvailable: true,
      }).modelId,
    ).toBe('es_core_news_sm@3.8.0');
    expect(
      resolveWordCloudLemmaApplication({
        requested: 'LEMMA',
        mode: 'LEXICAL',
        locale: 'it',
        nlpEnabled: true,
        sidecarAvailable: true,
      }),
    ).toMatchObject({
      applied: 'NONE',
      reason: 'LOCALE_UNSUPPORTED',
      fallbackLocale: 'de',
      modelId: null,
    });
  });
});
