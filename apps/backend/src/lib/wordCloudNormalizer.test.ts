import { describe, expect, it, vi } from 'vitest';
import type { AnalyzeWordCloudInput } from '@arsnova/shared-types';
import { SpacyClientError } from './spacyClient';
import { createMemoryWordCloudAnalysisCache } from './wordCloudAnalysisCache';
import { hashWordCloudText } from './wordCloudNormalization';
import {
  IdentityNormalizer,
  LemmaNormalizer,
  mapSpacyTokenToWordCloud,
  normalizeWordCloudItems,
} from './wordCloudNormalizer';

const lemmaInput = {
  sessionCode: 'ABC123',
  mode: 'LEXICAL',
  locale: 'de',
  metric: 'TOP',
  normalization: 'LEMMA',
  items: [
    { id: 'item-1', text: 'Häuser', weight: 2 },
    { id: 'item-2', text: 'Haus', weight: 1 },
  ],
} as const satisfies AnalyzeWordCloudInput;

describe('wordCloudNormalizer', () => {
  it('bildet Identity-Tokens wie die lexikalische Tokenisierung', () => {
    const tokens = new IdentityNormalizer().normalize(lemmaInput.items);
    expect(tokens.get('item-1')).toEqual([{ display: 'Häuser', lookup: 'häuser' }]);
    expect(tokens.get('item-2')).toEqual([{ display: 'Haus', lookup: 'haus' }]);
  });

  it('nutzt bei Nomen, Verben und Adjektiven das Lemma und laesst Namen unangetastet', () => {
    expect(mapSpacyTokenToWordCloud({ text: 'Häuser', lemma: 'Haus', pos: 'NOUN' })).toEqual({
      display: 'Haus',
      lookup: 'haus',
      pos: 'NOUN',
      surfaceLookup: 'häuser',
    });
    expect(mapSpacyTokenToWordCloud({ text: 'macht', lemma: 'machen', pos: 'VERB' })).toEqual({
      display: 'machen',
      lookup: 'machen',
      pos: 'VERB',
      surfaceLookup: 'macht',
    });
    expect(mapSpacyTokenToWordCloud({ text: 'brauche', lemma: 'brauchen', pos: 'VERB' })).toEqual({
      display: 'brauchen',
      lookup: 'brauchen',
      pos: 'VERB',
      surfaceLookup: 'brauche',
    });
    expect(mapSpacyTokenToWordCloud({ text: 'verliere', lemma: 'verlieren', pos: 'VERB' })).toEqual(
      {
        display: 'verlieren',
        lookup: 'verlieren',
        pos: 'VERB',
        surfaceLookup: 'verliere',
      },
    );
    expect(mapSpacyTokenToWordCloud({ text: 'kurze', lemma: 'kurz', pos: 'ADJ' })).toEqual({
      display: 'kurz',
      lookup: 'kurz',
      pos: 'ADJ',
      surfaceLookup: 'kurze',
    });
    expect(mapSpacyTokenToWordCloud({ text: 'Berlins', lemma: 'Berlin', pos: 'PROPN' })).toEqual({
      display: 'Berlins',
      lookup: 'berlins',
      pos: 'PROPN',
    });
    expect(
      mapSpacyTokenToWordCloud({
        text: 'Berlin',
        lemma: 'berlin',
        pos: 'NOUN',
        entType: 'GPE',
      }),
    ).toEqual({ display: 'Berlin', lookup: 'berlin', pos: 'NOUN' });
    expect(
      mapSpacyTokenToWordCloud({ text: 'validiert', lemma: 'validieren', pos: 'VERB' }),
    ).toEqual({
      display: 'validieren',
      lookup: 'validieren',
      pos: 'VERB',
      surfaceLookup: 'validiert',
    });
    expect(mapSpacyTokenToWordCloud({ text: 'Lernen', lemma: 'lernen', pos: 'VERB' })).toEqual({
      display: 'Lernen',
      lookup: 'lernen',
      pos: 'NOUN',
    });
    expect(
      mapSpacyTokenToWordCloud(
        { text: 'Machen', lemma: 'machen', pos: 'VERB' },
        { next: { text: 'wir', lemma: 'wir', pos: 'PRON' } },
      ),
    ).toEqual({
      display: 'machen',
      lookup: 'machen',
      pos: 'VERB',
    });
  });

  it('wendet Lemma nur an, wenn der Sidecar Tokens liefert', async () => {
    const sidecar = vi.fn(async () => ({
      locale: 'de' as const,
      modelId: 'de_core_news_sm@3.8.0',
      items: [
        { id: 'item-1', tokens: [{ text: 'Häuser', lemma: 'Haus', pos: 'NOUN' }] },
        { id: 'item-2', tokens: [{ text: 'Haus', lemma: 'Haus', pos: 'NOUN' }] },
      ],
    }));

    const result = await normalizeWordCloudItems(lemmaInput, {
      env: { NLP_ENABLED: 'true' },
      sidecar,
    });

    expect(sidecar).toHaveBeenCalledOnce();
    expect(result.cache).toEqual({ textHits: 0, textMisses: 2, sidecarCalled: true });
    expect(result.meta.normalizationApplied).toBe('LEMMA');
    expect(result.meta.modelId).toBe('de_core_news_sm@3.8.0');
    expect(result.tokensByItemId.get('item-1')).toEqual([
      { display: 'Haus', lookup: 'haus', pos: 'NOUN', surfaceLookup: 'häuser' },
    ]);
    expect(result.tokensByItemId.get('item-2')).toEqual([
      { display: 'Haus', lookup: 'haus', pos: 'NOUN' },
    ]);
  });

  it('faellt bei Timeout und ungueltiger Antwort auf Identity zurueck', async () => {
    const timeout = await normalizeWordCloudItems(lemmaInput, {
      env: { NLP_ENABLED: 'true' },
      sidecar: async () => {
        throw new SpacyClientError('TIMEOUT');
      },
    });
    expect(timeout.meta).toMatchObject({
      normalizationApplied: 'NONE',
      normalizationFallbackReason: 'TIMEOUT',
    });
    expect(timeout.tokensByItemId.get('item-1')).toEqual([{ display: 'Häuser', lookup: 'häuser' }]);

    const invalid = await normalizeWordCloudItems(lemmaInput, {
      env: { NLP_ENABLED: 'true' },
      sidecar: async () => {
        throw new SpacyClientError('INVALID_RESPONSE');
      },
    });
    expect(invalid.meta.normalizationFallbackReason).toBe('INVALID_RESPONSE');
  });

  it('ruft den Sidecar bei THEME + LEMMA nicht an', async () => {
    const sidecar = vi.fn(async () => {
      throw new Error('Sidecar darf bei THEME nicht aufgerufen werden');
    });
    const result = await normalizeWordCloudItems(
      { ...lemmaInput, mode: 'THEME' },
      { env: { NLP_ENABLED: 'true' }, sidecar },
    );
    expect(sidecar).not.toHaveBeenCalled();
    expect(result.meta.normalizationFallbackReason).toBe('MODE_UNSUPPORTED');
    expect(result.tokensByItemId.get('item-1')).toEqual([{ display: 'Häuser', lookup: 'häuser' }]);
  });

  it('laesst LemmaNormalizer den Sidecar sprechen', async () => {
    const sidecar = vi.fn(async () => ({
      locale: 'en' as const,
      modelId: 'en_core_web_sm@3.8.0',
      items: [{ id: 'a', tokens: [{ text: 'cats', lemma: 'cat', pos: 'NOUN' }] }],
    }));
    const tokens = await new LemmaNormalizer('en', sidecar, {
      enabled: true,
      socketPath: '/run/spacy/nlp.sock',
      timeoutMs: 1000,
      cacheTtlSeconds: 1800,
    }).normalize([{ id: 'a', text: 'cats', weight: 1 }]);
    expect(tokens.get('a')).toEqual([
      { display: 'cat', lookup: 'cat', pos: 'NOUN', surfaceLookup: 'cats' },
    ]);
  });

  it('ruft den Sidecar beim zweiten gleichen Text nicht erneut an', async () => {
    const cache = createMemoryWordCloudAnalysisCache();
    const sidecar = vi.fn(async () => ({
      locale: 'de' as const,
      modelId: 'de_core_news_sm@3.8.0',
      items: [
        { id: 'item-1', tokens: [{ text: 'Häuser', lemma: 'Haus', pos: 'NOUN' }] },
        { id: 'item-2', tokens: [{ text: 'Haus', lemma: 'Haus', pos: 'NOUN' }] },
      ],
    }));
    const options = { env: { NLP_ENABLED: 'true' }, sidecar, cache };

    await normalizeWordCloudItems(lemmaInput, options);
    const second = await normalizeWordCloudItems(lemmaInput, options);

    expect(sidecar).toHaveBeenCalledOnce();
    expect(second.cache).toEqual({ textHits: 2, textMisses: 0, sidecarCalled: false });
    expect(second.tokensByItemId.get('item-1')).toEqual([
      { display: 'Haus', lookup: 'haus', pos: 'NOUN', surfaceLookup: 'häuser' },
    ]);
  });

  it('sendet bei gemischtem Cache nur die fehlenden Texte an den Sidecar', async () => {
    const cache = createMemoryWordCloudAnalysisCache();
    await cache.setText('de', hashWordCloudText('Häuser'), [{ display: 'Haus', lookup: 'haus' }]);
    const sidecar = vi.fn(async () => ({
      locale: 'de' as const,
      modelId: 'de_core_news_sm@3.8.0',
      items: [{ id: 'item-2', tokens: [{ text: 'Haus', lemma: 'Haus', pos: 'NOUN' }] }],
    }));

    const result = await normalizeWordCloudItems(lemmaInput, {
      env: { NLP_ENABLED: 'true' },
      sidecar,
      cache,
    });

    expect(sidecar).toHaveBeenCalledOnce();
    expect(sidecar).toHaveBeenCalledWith(
      'de',
      [{ id: 'item-2', text: 'Haus' }],
      expect.objectContaining({ enabled: true }),
    );
    expect(result.cache).toEqual({ textHits: 1, textMisses: 1, sidecarCalled: true });
    expect(result.tokensByItemId.get('item-1')).toEqual([{ display: 'Haus', lookup: 'haus' }]);
    expect(result.tokensByItemId.get('item-2')).toEqual([
      { display: 'Haus', lookup: 'haus', pos: 'NOUN' },
    ]);
  });

  it('cacht Sidecar-Fehler nicht und faellt vollstaendig auf Identity zurueck', async () => {
    const cache = createMemoryWordCloudAnalysisCache();
    const result = await normalizeWordCloudItems(lemmaInput, {
      env: { NLP_ENABLED: 'true' },
      cache,
      sidecar: async () => {
        throw new SpacyClientError('TIMEOUT');
      },
    });

    expect(result.meta.normalizationFallbackReason).toBe('TIMEOUT');
    expect(result.cache.sidecarCalled).toBe(true);
    expect(await cache.getText('de', hashWordCloudText('Häuser'))).toBeNull();
    expect(result.tokensByItemId.get('item-1')).toEqual([{ display: 'Häuser', lookup: 'häuser' }]);
  });
});
