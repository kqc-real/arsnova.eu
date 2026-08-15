import { describe, expect, it, vi } from 'vitest';
import type { AnalyzeWordCloudInput } from '@arsnova/shared-types';
import { SpacyClientError } from './spacyClient';
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

  it('nutzt bei Nomen das Lemma und laesst Namen unangetastet', () => {
    expect(mapSpacyTokenToWordCloud({ text: 'Häuser', lemma: 'Haus', pos: 'NOUN' })).toEqual({
      display: 'Haus',
      lookup: 'haus',
    });
    expect(mapSpacyTokenToWordCloud({ text: 'Berlins', lemma: 'Berlin', pos: 'PROPN' })).toEqual({
      display: 'Berlins',
      lookup: 'berlins',
    });
    expect(
      mapSpacyTokenToWordCloud({
        text: 'Berlin',
        lemma: 'berlin',
        pos: 'NOUN',
        entType: 'GPE',
      }),
    ).toEqual({ display: 'Berlin', lookup: 'berlin' });
    expect(
      mapSpacyTokenToWordCloud({ text: 'validiert', lemma: 'validieren', pos: 'VERB' }),
    ).toEqual({ display: 'validiert', lookup: 'validiert' });
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
    expect(result.meta.normalizationApplied).toBe('LEMMA');
    expect(result.meta.modelId).toBe('de_core_news_sm@3.8.0');
    expect(result.tokensByItemId.get('item-1')).toEqual([{ display: 'Haus', lookup: 'haus' }]);
    expect(result.tokensByItemId.get('item-2')).toEqual([{ display: 'Haus', lookup: 'haus' }]);
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
    }).normalize([{ id: 'a', text: 'cats', weight: 1 }]);
    expect(tokens.get('a')).toEqual([{ display: 'cat', lookup: 'cat' }]);
  });
});
