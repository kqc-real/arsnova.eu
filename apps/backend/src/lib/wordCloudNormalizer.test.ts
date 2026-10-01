import { describe, expect, it, vi } from 'vitest';
import type { AnalyzeWordCloudInput } from '@arsnova/shared-types';
import { SpacyClientError } from './spacyClient';
import { createMemoryWordCloudAnalysisCache } from './wordCloudAnalysisCache';
import { hashWordCloudText } from './wordCloudNormalization';
import {
  IdentityNormalizer,
  LemmaNormalizer,
  chunkSpacyNormalizeTexts,
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
    expect(
      mapSpacyTokenToWordCloud(
        { text: 'Macht', lemma: 'Macht', pos: 'NOUN', tag: 'VVFIN' },
        { next: { text: 'das', lemma: 'der', pos: 'PRON' } },
      ),
    ).toEqual({
      display: 'Macht',
      lookup: 'macht',
      pos: 'VERB',
    });
    expect(
      mapSpacyTokenToWordCloud(
        { text: 'Macht', lemma: 'Macht', pos: 'NOUN', tag: 'NN' },
        { next: { text: 'der', lemma: 'der', pos: 'DET' } },
      ),
    ).toEqual({
      display: 'Macht',
      lookup: 'macht',
      pos: 'NOUN',
    });
    expect(
      mapSpacyTokenToWordCloud(
        { text: 'Zählt', lemma: 'Zählt', pos: 'PROPN' },
        { next: { text: 'Online-Teilnahme', lemma: 'Online-Teilnahme', pos: 'NOUN' } },
      ),
    ).toEqual({
      display: 'Zählt',
      lookup: 'zählt',
      pos: 'VERB',
    });
    expect(
      mapSpacyTokenToWordCloud(
        { text: 'Zählt', lemma: 'Zählt', pos: 'X' },
        { next: { text: 'ungekennzeichnete', lemma: 'ungekennzeichnet', pos: 'ADJ' } },
      ),
    ).toEqual({
      display: 'Zählt',
      lookup: 'zählt',
      pos: 'VERB',
    });
    expect(
      mapSpacyTokenToWordCloud(
        { text: 'Läuft', lemma: 'Läuft', pos: 'NOUN', tag: 'NN' },
        { next: { text: 'der', lemma: 'der', pos: 'DET' } },
      ),
    ).toEqual({
      display: 'Läuft',
      lookup: 'läuft',
      pos: 'VERB',
    });
    expect(
      mapSpacyTokenToWordCloud({ text: 'zählt', lemma: 'zählen', pos: 'VERB', tag: 'VVFIN' }),
    ).toEqual({
      display: 'zählen',
      lookup: 'zählen',
      pos: 'VERB',
      surfaceLookup: 'zählt',
    });
    expect(
      mapSpacyTokenToWordCloud({ text: 'Gelernt', lemma: 'Gelernt', pos: 'VERB', tag: 'VVPP' }),
    ).toEqual({
      display: 'Gelernt',
      lookup: 'gelernt',
      pos: 'VERB',
    });
    expect(
      mapSpacyTokenToWordCloud({ text: 'Gelernte', lemma: 'Gelernt', pos: 'NOUN', tag: 'NN' }),
    ).toEqual({
      display: 'Gelernt',
      lookup: 'gelernt',
      pos: 'VERB',
      surfaceLookup: 'gelernte',
    });
    expect(
      mapSpacyTokenToWordCloud(
        { text: 'Berlin', lemma: 'Berlin', pos: 'PROPN', tag: 'NE', entType: 'GPE' },
        { next: { text: 'ist', lemma: 'sein', pos: 'AUX' } },
      ),
    ).toEqual({
      display: 'Berlin',
      lookup: 'berlin',
      pos: 'PROPN',
    });
    expect(
      mapSpacyTokenToWordCloud(
        { text: 'Angular', lemma: 'Angular', pos: 'PROPN', tag: 'NE' },
        { next: { text: 'Framework', lemma: 'Framework', pos: 'NOUN' } },
      ),
    ).toEqual({
      display: 'Angular',
      lookup: 'angular',
      pos: 'PROPN',
    });
  });

  it('wendet Lemma nur an, wenn der Sidecar Tokens liefert', async () => {
    const sidecar = vi.fn(async () => ({
      locale: 'de' as const,
      modelId: 'de_core_news_sm@3.8.0',
      items: [
        { id: 'item-1::0', tokens: [{ text: 'Häuser', lemma: 'Haus', pos: 'NOUN' }] },
        { id: 'item-2::0', tokens: [{ text: 'Haus', lemma: 'Haus', pos: 'NOUN' }] },
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

  it('ruft den Sidecar bei THEME + LEMMA und SEMANTIC + LEMMA nicht an', async () => {
    const sidecar = vi.fn(async () => {
      throw new Error('Sidecar darf bei THEME/SEMANTIC nicht aufgerufen werden');
    });
    const theme = await normalizeWordCloudItems(
      { ...lemmaInput, mode: 'THEME' },
      { env: { NLP_ENABLED: 'true' }, sidecar },
    );
    const semantic = await normalizeWordCloudItems(
      { ...lemmaInput, mode: 'SEMANTIC' },
      { env: { NLP_ENABLED: 'true' }, sidecar },
    );
    expect(sidecar).not.toHaveBeenCalled();
    expect(theme.meta.normalizationFallbackReason).toBe('MODE_UNSUPPORTED');
    expect(semantic.meta.normalizationFallbackReason).toBe('MODE_UNSUPPORTED');
    expect(theme.tokensByItemId.get('item-1')).toEqual([{ display: 'Häuser', lookup: 'häuser' }]);
  });

  it('laesst LemmaNormalizer den Sidecar sprechen', async () => {
    const sidecar = vi.fn(async () => ({
      locale: 'en' as const,
      modelId: 'en_core_web_sm@3.8.0',
      items: [{ id: 'a::0', tokens: [{ text: 'cats', lemma: 'cat', pos: 'NOUN' }] }],
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
        { id: 'item-1::0', tokens: [{ text: 'Häuser', lemma: 'Haus', pos: 'NOUN' }] },
        { id: 'item-2::0', tokens: [{ text: 'Haus', lemma: 'Haus', pos: 'NOUN' }] },
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
      items: [{ id: 'item-2::0', tokens: [{ text: 'Haus', lemma: 'Haus', pos: 'NOUN' }] }],
    }));

    const result = await normalizeWordCloudItems(lemmaInput, {
      env: { NLP_ENABLED: 'true' },
      sidecar,
      cache,
    });

    expect(sidecar).toHaveBeenCalledOnce();
    expect(sidecar).toHaveBeenCalledWith(
      'de',
      [{ id: 'item-2::0', text: 'Haus' }],
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

  it('teilt expandierte Segmente in Sidecar-Batches unter dem 500er-Vertrag', () => {
    const texts = Array.from({ length: 502 }, (_, index) => ({
      id: `item-${index}::0`,
      text: 'Haus',
    }));
    const batches = chunkSpacyNormalizeTexts(texts, { maxItems: 500 });
    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(500);
    expect(batches[1]).toHaveLength(2);
  });

  it('zaehlt Byte-Budgets inkrementell und respektiert Escapes sowie Unicode', () => {
    const locale = 'de';
    const emptyBytes = Buffer.byteLength(JSON.stringify({ locale, texts: [] }), 'utf8');
    const items = [
      { id: 'a', text: 'Haus' },
      { id: 'b', text: 'x"y\\z' },
      { id: 'c', text: 'Ä😊' },
    ];
    const itemBytes = items.map((item) => Buffer.byteLength(JSON.stringify(item), 'utf8'));
    const firstTwoBytes =
      emptyBytes + itemBytes[0]! + itemBytes[1]! + 1; /* Komma zwischen zwei Items */
    const batches = chunkSpacyNormalizeTexts(items, {
      locale,
      maxItems: 10,
      maxRequestBytes: firstTwoBytes,
    });
    expect(batches).toHaveLength(2);
    expect(batches[0]).toEqual([items[0], items[1]]);
    expect(batches[1]).toEqual([items[2]]);
    expect(Buffer.byteLength(JSON.stringify({ locale, texts: batches[0] }), 'utf8')).toBe(
      firstTwoBytes,
    );
  });

  it('bleibt bei 500 Items ohne quadratische Serialisierung unter 100 ms', () => {
    const texts = Array.from({ length: 500 }, (_, index) => ({
      id: `item-${index}`,
      text: 'x'.repeat(1000),
    }));
    const started = performance.now();
    const batches = chunkSpacyNormalizeTexts(texts, { maxItems: 500 });
    const elapsed = performance.now() - started;
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(500);
    expect(elapsed).toBeLessThan(100);
  });

  it('sendet bei >500 expandierten Segmenten mehrere Sidecar-Requests', async () => {
    const items = Array.from({ length: 251 }, (_, index) => ({
      id: `item-${index}`,
      text: 'Eins\n\nZwei',
      weight: 1,
    }));
    const sidecar = vi.fn(
      async (
        _locale: 'de' | 'en' | 'fr' | 'es',
        texts: readonly { id: string; text: string }[],
      ) => ({
        locale: 'de' as const,
        modelId: 'de_core_news_sm@3.8.0',
        items: texts.map((text) => ({
          id: text.id,
          tokens: [{ text: text.text, lemma: text.text, pos: 'NOUN' }],
        })),
      }),
    );

    const tokens = await new LemmaNormalizer('de', sidecar, {
      enabled: true,
      socketPath: '/run/spacy/nlp.sock',
      timeoutMs: 1000,
      cacheTtlSeconds: 1800,
    }).normalize(items);

    expect(sidecar.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(sidecar.mock.calls.every((call) => call[1].length <= 500)).toBe(true);
    expect(tokens.get('item-0')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ display: 'Eins' }),
        expect.objectContaining({ display: 'Zwei' }),
      ]),
    );
  });
});
