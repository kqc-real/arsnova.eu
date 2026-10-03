import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WORD_CLOUD_SEMANTIC_ANALYSIS_VERSION,
  type AnalyzeWordCloudInput,
  type AnalyzeWordCloudOutput,
} from '@arsnova/shared-types';
import { hashWordCloudText } from './wordCloudNormalization';

const mocks = vi.hoisted(() => ({
  getRedis: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('../redis', () => ({
  getRedis: mocks.getRedis,
}));

vi.mock('./logger', () => ({
  logger: {
    warn: mocks.warn,
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  buildWordCloudSnapshotCacheKey,
  buildWordCloudSnapshotSessionPattern,
  buildWordCloudTextCacheKey,
  createMemoryWordCloudAnalysisCache,
  createRedisWordCloudAnalysisCache,
  evictWordCloudAnalysisSnapshotsForSession,
  shouldCacheWordCloudSnapshot,
} from './wordCloudAnalysisCache';

const input = {
  sessionCode: 'abc123',
  mode: 'LEXICAL',
  locale: 'de',
  metric: 'TOP',
  normalization: 'LEMMA',
  items: [{ id: 'item-1', text: 'Häuser', weight: 2 }],
} as const satisfies AnalyzeWordCloudInput;

const output = {
  mode: 'LEXICAL',
  locale: 'de',
  metric: 'TOP',
  generatedAt: '2026-08-15T10:00:00.000Z',
  fallbackUsed: false,
  normalization: 'LEMMA',
  normalizationApplied: 'LEMMA',
  normalizationFallbackUsed: false,
  normalizationFallbackReason: null,
  fallbackLocale: 'de',
  analysisVersion: '1.14b.14',
  modelId: 'de_core_news_sm@3.8.0',
  snapshotHash: 'a'.repeat(64),
  status: 'ready',
  modelVersion: null,
  entries: [
    {
      key: 'haus',
      label: 'Haus',
      count: 2,
      basisLabel: null,
      members: [{ sourceId: 'item-1', text: 'Häuser', weight: 2 }],
      variants: ['Haus'],
      confidence: null,
    },
  ],
} as const satisfies AnalyzeWordCloudOutput;

describe('wordCloudAnalysisCache', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('bildet Text-Schluessel ohne Rohtext und mit Analyseversion', () => {
    const textHash = hashWordCloudText('Häuser');
    const key = buildWordCloudTextCacheKey('de', textHash);
    expect(key).toContain('nlp:wc:text:de:1.14b.14:');
    expect(key).toContain(textHash);
    expect(key).not.toContain('Häuser');
  });

  it('bildet Snapshot-Schluessel aus Session, Modus und Hash', () => {
    const key = buildWordCloudSnapshotCacheKey(input);
    expect(key.startsWith('nlp:wc:snap:ABC123:LEXICAL:TOP:LEMMA:1.14b.14:')).toBe(true);
    expect(key).not.toContain('Häuser');
    expect(buildWordCloudSnapshotCacheKey({ ...input, maxEntries: 40 })).not.toBe(key);
    expect(buildWordCloudSnapshotCacheKey({ ...input, maxNgramLength: 3 })).not.toBe(key);
    expect(buildWordCloudSnapshotCacheKey({ ...input, sessionCode: 'XYZ789' })).not.toBe(key);
  });

  it('cacht transiente Sidecar-Fallbacks und NLP_DISABLED nicht', () => {
    expect(shouldCacheWordCloudSnapshot(output)).toBe(true);
    expect(
      shouldCacheWordCloudSnapshot({
        ...output,
        normalizationApplied: 'NONE',
        normalizationFallbackUsed: true,
        normalizationFallbackReason: 'TIMEOUT',
        modelId: null,
      }),
    ).toBe(false);
    expect(
      shouldCacheWordCloudSnapshot({
        ...output,
        normalizationApplied: 'NONE',
        normalizationFallbackUsed: true,
        normalizationFallbackReason: 'NLP_DISABLED',
        modelId: null,
      }),
    ).toBe(false);
    expect(
      shouldCacheWordCloudSnapshot({
        ...output,
        mode: 'SEMANTIC',
        status: 'disabled',
        fallbackUsed: true,
        analysisVersion: WORD_CLOUD_SEMANTIC_ANALYSIS_VERSION,
      }),
    ).toBe(false);
    expect(
      shouldCacheWordCloudSnapshot({
        ...output,
        mode: 'SEMANTIC',
        status: 'ready',
        analysisVersion: WORD_CLOUD_SEMANTIC_ANALYSIS_VERSION,
        modelVersion: 'intfloat/multilingual-e5-small@sha256:test',
      }),
    ).toBe(true);
  });

  it('liefert Memory-Hits und laesst TTL verfallen', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T12:00:00.000Z'));
    const cache = createMemoryWordCloudAnalysisCache(60);
    const tokens = [{ display: 'Haus', lookup: 'haus' }];
    const textHash = hashWordCloudText('Häuser');

    await cache.setText('de', textHash, tokens);
    await cache.setSnapshot(input, output);
    expect(await cache.getText('de', textHash)).toEqual(tokens);
    expect(await cache.getSnapshot(input)).toEqual(output);

    vi.advanceTimersByTime(60_000);
    expect(await cache.getText('de', textHash)).toBeNull();
    expect(await cache.getSnapshot(input)).toBeNull();
  });

  it('schreibt transiente Snapshot-Fallbacks nicht in den Memory-Cache', async () => {
    const cache = createMemoryWordCloudAnalysisCache();
    await cache.setSnapshot(input, {
      ...output,
      normalizationApplied: 'NONE',
      normalizationFallbackUsed: true,
      normalizationFallbackReason: 'SIDECAR_UNAVAILABLE',
      modelId: null,
    });
    expect(await cache.getSnapshot(input)).toBeNull();
  });

  it('schreibt NLP_DISABLED-Snapshots nicht in den Memory-Cache', async () => {
    const cache = createMemoryWordCloudAnalysisCache();
    await cache.setSnapshot(input, {
      ...output,
      normalizationApplied: 'NONE',
      normalizationFallbackUsed: true,
      normalizationFallbackReason: 'NLP_DISABLED',
      modelId: null,
    });
    expect(await cache.getSnapshot(input)).toBeNull();
  });

  it('liefert SEMANTIC-Cache-Hits nicht nach Kill-Switch-Rollback', async () => {
    vi.stubEnv('WORD_CLOUD_SEMANTIC_ENABLED', 'true');
    const cache = createMemoryWordCloudAnalysisCache(60);
    const semanticInput = { ...input, mode: 'SEMANTIC' } as const satisfies AnalyzeWordCloudInput;
    const semanticOutput = {
      ...output,
      mode: 'SEMANTIC',
      status: 'ready',
      analysisVersion: WORD_CLOUD_SEMANTIC_ANALYSIS_VERSION,
      modelVersion: 'intfloat/multilingual-e5-small@sha256:test',
    } as const satisfies AnalyzeWordCloudOutput;

    await cache.setSnapshot(semanticInput, semanticOutput);
    expect(await cache.getSnapshot(semanticInput)).toMatchObject({ status: 'ready' });

    vi.stubEnv('WORD_CLOUD_SEMANTIC_ENABLED', 'false');
    expect(await cache.getSnapshot(semanticInput)).toBeNull();
  });

  it('nutzt fuer SEMANTIC die Encoder-TTL statt NLP_CACHE_TTL_SECONDS', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T12:00:00.000Z'));
    vi.stubEnv('WORD_CLOUD_SEMANTIC_ENABLED', 'true');
    vi.stubEnv('WORD_CLOUD_ENCODER_CACHE_TTL_SECONDS', '120');
    const cache = createMemoryWordCloudAnalysisCache(60);
    const semanticInput = { ...input, mode: 'SEMANTIC' } as const satisfies AnalyzeWordCloudInput;
    const semanticOutput = {
      ...output,
      mode: 'SEMANTIC',
      status: 'ready',
      analysisVersion: WORD_CLOUD_SEMANTIC_ANALYSIS_VERSION,
      modelVersion: 'intfloat/multilingual-e5-small@sha256:test',
    } as const satisfies AnalyzeWordCloudOutput;

    await cache.setSnapshot(semanticInput, semanticOutput);
    vi.advanceTimersByTime(60_000);
    expect(await cache.getSnapshot(semanticInput)).toMatchObject({ status: 'ready' });
    vi.advanceTimersByTime(60_000);
    expect(await cache.getSnapshot(semanticInput)).toBeNull();
  });
});

describe('createRedisWordCloudAnalysisCache', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    mocks.getRedis.mockReturnValue({
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      set: vi.fn(async (key: string, value: string) => {
        store.set(key, value);
        return 'OK';
      }),
      scan: vi.fn(async (_cursor: string, _match: string, pattern: string) => {
        const literalPrefix = pattern.slice(0, -1);
        return ['0', [...store.keys()].filter((key) => key.startsWith(literalPrefix))] as const;
      }),
      unlink: vi.fn(async (...keys: string[]) => {
        let deleted = 0;
        for (const key of keys) {
          if (store.delete(key)) deleted += 1;
        }
        return deleted;
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rundet Text- und Snapshot-Werte ueber Redis', async () => {
    const cache = createRedisWordCloudAnalysisCache(90);
    const textHash = hashWordCloudText('Häuser');
    await cache.setText('de', textHash, [{ display: 'Haus', lookup: 'haus' }]);
    await cache.setSnapshot(input, output);

    expect(await cache.getText('de', textHash)).toEqual([{ display: 'Haus', lookup: 'haus' }]);
    expect(await cache.getSnapshot(input)).toMatchObject({
      generatedAt: output.generatedAt,
      normalizationApplied: 'LEMMA',
    });
    expect(mocks.getRedis().set).toHaveBeenCalledWith(
      buildWordCloudTextCacheKey('de', textHash),
      expect.any(String),
      'EX',
      90,
    );
  });

  it('schreibt SEMANTIC-Snapshots mit Encoder-TTL', async () => {
    vi.stubEnv('WORD_CLOUD_SEMANTIC_ENABLED', 'true');
    vi.stubEnv('WORD_CLOUD_ENCODER_CACHE_TTL_SECONDS', '120');
    const cache = createRedisWordCloudAnalysisCache(90);
    const semanticInput = { ...input, mode: 'SEMANTIC' } as const satisfies AnalyzeWordCloudInput;
    const semanticOutput = {
      ...output,
      mode: 'SEMANTIC',
      status: 'ready',
      analysisVersion: WORD_CLOUD_SEMANTIC_ANALYSIS_VERSION,
      modelVersion: 'intfloat/multilingual-e5-small@sha256:test',
    } as const satisfies AnalyzeWordCloudOutput;

    await cache.setSnapshot(semanticInput, semanticOutput);
    expect(mocks.getRedis().set).toHaveBeenCalledWith(
      buildWordCloudSnapshotCacheKey(semanticInput),
      expect.any(String),
      'EX',
      120,
    );
    expect(await cache.getSnapshot(semanticInput)).toMatchObject({ status: 'ready' });

    vi.stubEnv('WORD_CLOUD_SEMANTIC_ENABLED', 'false');
    expect(await cache.getSnapshot(semanticInput)).toBeNull();
  });

  it('entfernt fertige Freitext-Snapshots beim Session-Purge idempotent', async () => {
    vi.stubEnv('WORD_CLOUD_SEMANTIC_ENABLED', 'true');
    const cache = createRedisWordCloudAnalysisCache(90);
    const semanticInput = {
      ...input,
      mode: 'SEMANTIC',
      channel: 'FREETEXT',
    } as const satisfies AnalyzeWordCloudInput;
    const otherSessionInput = {
      ...semanticInput,
      sessionCode: 'DEF456',
    } as const satisfies AnalyzeWordCloudInput;
    const semanticOutput = {
      ...output,
      mode: 'SEMANTIC',
      status: 'ready',
      analysisVersion: WORD_CLOUD_SEMANTIC_ANALYSIS_VERSION,
      modelVersion: 'intfloat/multilingual-e5-small@sha256:test',
    } as const satisfies AnalyzeWordCloudOutput;

    await cache.setSnapshot(semanticInput, semanticOutput);
    await cache.setSnapshot(otherSessionInput, semanticOutput);
    const targetKey = buildWordCloudSnapshotCacheKey(semanticInput);
    const otherKey = buildWordCloudSnapshotCacheKey(otherSessionInput);
    expect(store.get(targetKey)).toContain('Häuser');

    await expect(evictWordCloudAnalysisSnapshotsForSession(' abc123 ')).resolves.toBe(1);
    await expect(evictWordCloudAnalysisSnapshotsForSession('ABC123')).resolves.toBe(0);

    expect(store.has(targetKey)).toBe(false);
    expect(store.has(otherKey)).toBe(true);
    expect(await cache.getSnapshot(semanticInput)).toBeNull();
    expect(await cache.getSnapshot(otherSessionInput)).toMatchObject({ status: 'ready' });
    expect(mocks.getRedis().scan).toHaveBeenCalledWith(
      '0',
      'MATCH',
      buildWordCloudSnapshotSessionPattern('ABC123'),
      'COUNT',
      100,
    );
    expect(mocks.getRedis().unlink).toHaveBeenCalledTimes(1);
  });

  it('scannt beim Purge alle Redis-Seiten und reicht Fehler fail-closed weiter', async () => {
    const firstKey = 'nlp:wc:snap:ABC123:SEMANTIC:TOP:NONE:first';
    const secondKey = 'nlp:wc:snap:ABC123:SEMANTIC:TOP:NONE:second';
    store.set(firstKey, 'first');
    store.set(secondKey, 'second');
    const redis = mocks.getRedis();
    redis.scan.mockResolvedValueOnce(['17', [firstKey]]).mockResolvedValueOnce(['0', [secondKey]]);

    await expect(evictWordCloudAnalysisSnapshotsForSession('ABC123')).resolves.toBe(2);
    expect(redis.scan).toHaveBeenNthCalledWith(
      1,
      '0',
      'MATCH',
      'nlp:wc:snap:ABC123:*',
      'COUNT',
      100,
    );
    expect(redis.scan).toHaveBeenNthCalledWith(
      2,
      '17',
      'MATCH',
      'nlp:wc:snap:ABC123:*',
      'COUNT',
      100,
    );

    redis.scan.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(evictWordCloudAnalysisSnapshotsForSession('ABC123')).rejects.toThrow(
      'ECONNREFUSED',
    );
  });

  it('ist fail-open bei Redis-Fehlern und kaputten Eintraegen', async () => {
    mocks.getRedis.mockReturnValue({
      get: vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
      set: vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
    });
    const cache = createRedisWordCloudAnalysisCache();
    await expect(
      cache.setText('de', 'abc', [{ display: 'Haus', lookup: 'haus' }]),
    ).resolves.toBeUndefined();
    await expect(cache.setSnapshot(input, output)).resolves.toBeUndefined();
    expect(await cache.getText('de', 'abc')).toBeNull();
    expect(await cache.getSnapshot(input)).toBeNull();
    expect(mocks.warn).toHaveBeenCalled();

    mocks.getRedis.mockReturnValue({
      get: vi.fn(async () => '{"tokens":[{"display":1}]}'),
      set: vi.fn(),
    });
    expect(await cache.getText('de', 'abc')).toBeNull();

    mocks.getRedis.mockReturnValue({
      get: vi.fn(async () => '{"mode":"LEXICAL"}'),
      set: vi.fn(),
    });
    expect(await cache.getSnapshot(input)).toBeNull();
  });
});
