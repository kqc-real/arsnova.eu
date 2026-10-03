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
  beginWordCloudAnalysisCacheShutdown,
  buildWordCloudSnapshotCacheKey,
  buildWordCloudSnapshotIndexKey,
  buildWordCloudSnapshotPurgeFenceKey,
  buildWordCloudTextCacheKey,
  createMemoryWordCloudAnalysisCache,
  createRedisWordCloudAnalysisCache,
  evictAllWordCloudAnalysisCacheForRollout,
  evictLegacyWordCloudAnalysisSnapshots,
  evictWordCloudAnalysisSnapshotsForSession,
  evictWordCloudAnalysisSnapshotsForSessions,
  resetWordCloudAnalysisCacheMigrationForTests,
  shouldCacheWordCloudSnapshot,
  WORD_CLOUD_SNAPSHOT_PURGE_BATCH_SIZE,
  WORD_CLOUD_SNAPSHOT_PURGE_FENCE_TTL_SECONDS,
} from './wordCloudAnalysisCache';

const scope = { sessionId: '11111111-1111-4111-8111-111111111111' } as const;
const otherScope = { sessionId: '22222222-2222-4222-8222-222222222222' } as const;

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
    const key = buildWordCloudSnapshotCacheKey(input, scope);
    expect(
      key.startsWith(
        'nlp:wc:snapshot:v2:{11111111-1111-4111-8111-111111111111}:value:ABC123:LEXICAL:TOP:LEMMA:1.14b.14:',
      ),
    ).toBe(true);
    expect(key).not.toContain('Häuser');
    expect(buildWordCloudSnapshotCacheKey({ ...input, maxEntries: 40 }, scope)).not.toBe(key);
    expect(buildWordCloudSnapshotCacheKey({ ...input, maxNgramLength: 3 }, scope)).not.toBe(key);
    expect(buildWordCloudSnapshotCacheKey({ ...input, sessionCode: 'XYZ789' }, scope)).not.toBe(
      key,
    );
    expect(buildWordCloudSnapshotCacheKey(input, otherScope)).not.toBe(key);
    expect(buildWordCloudSnapshotIndexKey(scope.sessionId)).toContain(`{${scope.sessionId}}:index`);
    expect(buildWordCloudSnapshotPurgeFenceKey(scope.sessionId)).toContain(
      `{${scope.sessionId}}:purged`,
    );
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
  const snapshotIndexes = new Map<string, Set<string>>();
  const redisClientIds: number[] = [];
  const redisRunIds: string[] = [];
  const waitAofResults: Array<[number, number]> = [];
  const redisEvents: string[] = [];
  const defaultRunId = 'a'.repeat(40);

  function createRedisMock() {
    const redis = {
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      mget: vi.fn(async (...keys: string[]) => keys.map((key) => store.get(key) ?? null)),
      set: vi.fn(async (key: string, value: string) => {
        redisEvents.push(`SET ${key}`);
        store.set(key, value);
        return 'OK';
      }),
      smembers: vi.fn(async (key: string) => [...(snapshotIndexes.get(key) ?? [])]),
      scan: vi.fn(
        async (_cursor: string, _match: string, pattern: string): Promise<[string, string[]]> => {
          redisEvents.push(`SCAN ${pattern}`);
          const literalPrefix = pattern.slice(0, -1);
          const keys = new Set([...store.keys(), ...snapshotIndexes.keys()]);
          return ['0', [...keys].filter((key) => key.startsWith(literalPrefix))];
        },
      ),
      unlink: vi.fn(async (...keys: string[]) => {
        redisEvents.push(`UNLINK ${keys.length}`);
        let deleted = 0;
        for (const key of keys) {
          const deletedValue = store.delete(key);
          const deletedIndex = snapshotIndexes.delete(key);
          if (deletedValue || deletedIndex) deleted += 1;
        }
        return deleted;
      }),
      call: vi.fn(async (command: string, ...args: Array<string | number>) => {
        redisEvents.push(`${command} ${String(args[0] ?? '')}`.trim());
        if (command === 'CLIENT' && args[0] === 'ID') {
          return redisClientIds.shift() ?? 41;
        }
        if (command === 'INFO' && args[0] === 'server') {
          return `# Server\r\nrun_id:${redisRunIds.shift() ?? defaultRunId}\r\n`;
        }
        if (command === 'WAITAOF') {
          return waitAofResults.shift() ?? [1, 0];
        }
        throw new Error(`unexpected Redis command: ${command}`);
      }),
      eval: vi.fn(
        async (script: string, keyCount: number, ...parameters: Array<string | number>) => {
          redisEvents.push(
            script.includes('wordcloud_snapshot_write_v2') ? 'EVAL write' : 'EVAL purge',
          );
          const keys = parameters.slice(0, keyCount).map(String);
          const args = parameters.slice(keyCount).map(String);
          if (script.includes('wordcloud_snapshot_write_v2')) {
            const [valueKey, indexKey, fenceKey] = keys;
            if (!valueKey || !indexKey || !fenceKey) throw new Error('invalid write keys');
            if (store.has(fenceKey)) return 0;
            const index = snapshotIndexes.get(indexKey) ?? new Set<string>();
            if (!index.has(valueKey) && index.size >= Number(args[3])) return -1;
            index.add(valueKey);
            snapshotIndexes.set(indexKey, index);
            store.set(valueKey, args[0] ?? '');
            return 1;
          }
          if (script.includes('wordcloud_snapshot_purge_v2')) {
            const [indexKey, fenceKey, ...valueKeys] = keys;
            if (!indexKey || !fenceKey) throw new Error('invalid purge keys');
            store.set(fenceKey, '1');
            const index = snapshotIndexes.get(indexKey) ?? new Set<string>();
            if (index.size !== Number(args[1])) return [0, 0];
            if (!valueKeys.every((key) => index.has(key))) return [0, 0];
            let deleted = 0;
            for (const key of valueKeys) {
              if (store.delete(key)) deleted += 1;
            }
            snapshotIndexes.delete(indexKey);
            return [1, deleted];
          }
          throw new Error('unexpected Lua script');
        },
      ),
    };
    return redis;
  }

  let redisMock: ReturnType<typeof createRedisMock>;

  beforeEach(() => {
    store.clear();
    snapshotIndexes.clear();
    redisClientIds.length = 0;
    redisRunIds.length = 0;
    waitAofResults.length = 0;
    redisEvents.length = 0;
    resetWordCloudAnalysisCacheMigrationForTests();
    redisMock = createRedisMock();
    mocks.getRedis.mockReturnValue(redisMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('cacht Snapshots, aber keine potenziell rohen Text-Tokens mehr in Redis', async () => {
    const cache = createRedisWordCloudAnalysisCache(90);
    const textHash = hashWordCloudText('Häuser');
    await cache.setText('de', textHash, [{ display: 'Haus', lookup: 'haus' }]);
    await cache.setSnapshot(input, output, scope);

    expect(await cache.getText('de', textHash)).toBeNull();
    expect(await cache.getSnapshot(input, scope)).toMatchObject({
      generatedAt: output.generatedAt,
      normalizationApplied: 'LEMMA',
    });
    expect(mocks.getRedis().set).not.toHaveBeenCalled();
  });

  it('schreibt ohne autoritativen Session-ID-Scope keinen Redis-Snapshot', async () => {
    const cache = createRedisWordCloudAnalysisCache(90);

    await cache.setSnapshot(input, output);

    expect(redisMock.eval).not.toHaveBeenCalled();
    expect(await cache.getSnapshot(input)).toBeNull();
    expect(mocks.warn).toHaveBeenCalledWith('wordcloud:snapshot_cache_scope_missing');
  });

  it('blockiert persistente Snapshot-Writes ab Beginn des Graceful Shutdowns', async () => {
    const cache = createRedisWordCloudAnalysisCache(90);

    beginWordCloudAnalysisCacheShutdown();
    await cache.setSnapshot(input, output, scope);

    expect(redisMock.eval).not.toHaveBeenCalled();
    expect(store.has(buildWordCloudSnapshotCacheKey(input, scope))).toBe(false);
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

    await cache.setSnapshot(semanticInput, semanticOutput, scope);
    expect(redisMock.eval).toHaveBeenCalledWith(
      expect.stringContaining('wordcloud_snapshot_write_v2'),
      3,
      buildWordCloudSnapshotCacheKey(semanticInput, scope),
      buildWordCloudSnapshotIndexKey(scope.sessionId),
      buildWordCloudSnapshotPurgeFenceKey(scope.sessionId),
      expect.any(String),
      '120',
      '420',
      '2048',
    );
    expect(await cache.getSnapshot(semanticInput, scope)).toMatchObject({ status: 'ready' });

    vi.stubEnv('WORD_CLOUD_SEMANTIC_ENABLED', 'false');
    expect(await cache.getSnapshot(semanticInput, scope)).toBeNull();
  });

  it('fenced Writes atomar, purgt idempotent und isoliert wiederverwendete Codes per Session-ID', async () => {
    vi.stubEnv('WORD_CLOUD_SEMANTIC_ENABLED', 'true');
    const cache = createRedisWordCloudAnalysisCache(90);
    const semanticInput = {
      ...input,
      mode: 'SEMANTIC',
      channel: 'FREETEXT',
    } as const satisfies AnalyzeWordCloudInput;
    const semanticOutput = {
      ...output,
      mode: 'SEMANTIC',
      status: 'ready',
      analysisVersion: WORD_CLOUD_SEMANTIC_ANALYSIS_VERSION,
      modelVersion: 'intfloat/multilingual-e5-small@sha256:test',
    } as const satisfies AnalyzeWordCloudOutput;

    await cache.setSnapshot(semanticInput, semanticOutput, scope);
    await cache.setSnapshot(semanticInput, semanticOutput, otherScope);
    const targetKey = buildWordCloudSnapshotCacheKey(semanticInput, scope);
    const otherKey = buildWordCloudSnapshotCacheKey(semanticInput, otherScope);
    expect(store.get(targetKey)).toContain('Häuser');

    await expect(evictWordCloudAnalysisSnapshotsForSession(scope.sessionId)).resolves.toBe(1);
    await expect(evictWordCloudAnalysisSnapshotsForSession(scope.sessionId)).resolves.toBe(0);
    await cache.setSnapshot(semanticInput, semanticOutput, scope);

    expect(store.has(targetKey)).toBe(false);
    expect(store.has(otherKey)).toBe(true);
    expect(store.get(buildWordCloudSnapshotPurgeFenceKey(scope.sessionId))).toBe('1');
    expect(await cache.getSnapshot(semanticInput, scope)).toBeNull();
    expect(await cache.getSnapshot(semanticInput, otherScope)).toMatchObject({ status: 'ready' });
    expect(redisMock.scan).not.toHaveBeenCalled();
    expect(redisMock.eval).toHaveBeenCalledWith(
      expect.stringContaining('wordcloud_snapshot_purge_v2'),
      expect.any(Number),
      buildWordCloudSnapshotIndexKey(scope.sessionId),
      buildWordCloudSnapshotPurgeFenceKey(scope.sessionId),
      expect.anything(),
      String(WORD_CLOUD_SNAPSHOT_PURGE_FENCE_TTL_SECONDS),
      expect.any(String),
    );
  });

  it('schließt Write/Purge-Races und wiederholt nach einer Indexänderung mit gesetzter Fence', async () => {
    const cache = createRedisWordCloudAnalysisCache(90);
    await cache.setSnapshot(input, output, scope);
    const raceInput = { ...input, maxEntries: 40 } as const satisfies AnalyzeWordCloudInput;
    const raceKey = buildWordCloudSnapshotCacheKey(raceInput, scope);
    const indexKey = buildWordCloudSnapshotIndexKey(scope.sessionId);
    redisMock.smembers.mockImplementationOnce(async () => {
      const beforeRace = [...(snapshotIndexes.get(indexKey) ?? [])];
      snapshotIndexes.get(indexKey)?.add(raceKey);
      store.set(raceKey, JSON.stringify(output));
      return beforeRace;
    });

    await expect(evictWordCloudAnalysisSnapshotsForSession(scope.sessionId)).resolves.toBe(2);
    expect(redisMock.smembers).toHaveBeenCalledTimes(2);
    expect(store.has(raceKey)).toBe(false);

    const lateWrite = cache.setSnapshot({ ...input, maxEntries: 80 }, output, scope);
    await expect(lateWrite).resolves.toBeUndefined();
    expect(await cache.getSnapshot({ ...input, maxEntries: 80 }, scope)).toBeNull();
  });

  it('bestätigt produktive Purges lokal im AOF und scheitert ohne Fsync fail-closed', async () => {
    vi.stubEnv('WORD_CLOUD_PURGE_REQUIRE_DURABILITY', '1');
    const cache = createRedisWordCloudAnalysisCache(90);
    await cache.setSnapshot(input, output, scope);
    redisEvents.length = 0;
    waitAofResults.push([0, 0]);

    await expect(evictWordCloudAnalysisSnapshotsForSession(scope.sessionId)).rejects.toThrow(
      'WORD_CLOUD_PURGE_DURABILITY_UNAVAILABLE',
    );

    expect(redisMock.call.mock.calls.filter(([command]) => command === 'WAITAOF')).toEqual([
      ['WAITAOF', 1, 0, 5_000],
    ]);
    expect(store.has(buildWordCloudSnapshotPurgeFenceKey(scope.sessionId))).toBe(true);
    expect(redisEvents).toEqual([
      'CLIENT ID',
      'INFO server',
      'CLIENT ID',
      'EVAL purge',
      'CLIENT ID',
      'INFO server',
      'CLIENT ID',
      expect.stringMatching(/^SET nlp:wc:purge-durability:v1:/),
      'WAITAOF 1',
      'CLIENT ID',
      'INFO server',
      'CLIENT ID',
    ]);

    redisEvents.length = 0;
    waitAofResults.push([1, 0]);
    await expect(evictWordCloudAnalysisSnapshotsForSession(scope.sessionId)).resolves.toBe(0);
  });

  it('lehnt eine AOF-Bestätigung nach einem Redis-Reconnect fail-closed ab', async () => {
    vi.stubEnv('WORD_CLOUD_PURGE_REQUIRE_DURABILITY', '1');
    const cache = createRedisWordCloudAnalysisCache(90);
    await cache.setSnapshot(input, output, scope);
    redisClientIds.push(41, 41, 41, 41, 42, 42);

    await expect(evictWordCloudAnalysisSnapshotsForSession(scope.sessionId)).rejects.toThrow(
      'WORD_CLOUD_PURGE_DURABILITY_UNAVAILABLE',
    );

    const markerCall = redisMock.set.mock.calls.find(([key]) =>
      String(key).startsWith('nlp:wc:purge-durability:v1:'),
    );
    expect(markerCall).toEqual([
      expect.stringMatching(/^nlp:wc:purge-durability:v1:[0-9a-f-]{36}$/),
      expect.stringMatching(/^[0-9a-f-]{36}$/),
      'EX',
      300,
    ]);
    expect(String(markerCall?.[1])).not.toContain('Häuser');
    expect(store.has(buildWordCloudSnapshotPurgeFenceKey(scope.sessionId))).toBe(true);

    await expect(evictWordCloudAnalysisSnapshotsForSession(scope.sessionId)).resolves.toBe(0);
  });

  it('setzt nach einem Redis-Restart zwischen Mutation und Marker keinen Durability-Marker', async () => {
    vi.stubEnv('WORD_CLOUD_PURGE_REQUIRE_DURABILITY', '1');
    const cache = createRedisWordCloudAnalysisCache(90);
    await cache.setSnapshot(input, output, scope);
    redisRunIds.push(defaultRunId, 'b'.repeat(40));

    await expect(evictWordCloudAnalysisSnapshotsForSession(scope.sessionId)).rejects.toThrow(
      'WORD_CLOUD_PURGE_DURABILITY_UNAVAILABLE',
    );

    expect(
      redisMock.set.mock.calls.some(([key]) =>
        String(key).startsWith('nlp:wc:purge-durability:v1:'),
      ),
    ).toBe(false);
    expect(redisMock.call.mock.calls.some(([command]) => command === 'WAITAOF')).toBe(false);
    expect(store.has(buildWordCloudSnapshotPurgeFenceKey(scope.sessionId))).toBe(true);
  });

  it('setzt nach einem Reconnect zwischen Mutation und Marker keinen Durability-Marker', async () => {
    vi.stubEnv('WORD_CLOUD_PURGE_REQUIRE_DURABILITY', '1');
    const cache = createRedisWordCloudAnalysisCache(90);
    await cache.setSnapshot(input, output, scope);
    redisClientIds.push(41, 41, 42, 42);

    await expect(evictWordCloudAnalysisSnapshotsForSession(scope.sessionId)).rejects.toThrow(
      'WORD_CLOUD_PURGE_DURABILITY_UNAVAILABLE',
    );

    expect(
      redisMock.set.mock.calls.some(([key]) =>
        String(key).startsWith('nlp:wc:purge-durability:v1:'),
      ),
    ).toBe(false);
    expect(redisMock.call.mock.calls.some(([command]) => command === 'WAITAOF')).toBe(false);
  });

  it('bestätigt Bulk-Purges in begrenzten Chunks statt einmal pro Session', async () => {
    vi.stubEnv('WORD_CLOUD_PURGE_REQUIRE_DURABILITY', '1');
    const sessionIds = Array.from(
      { length: WORD_CLOUD_SNAPSHOT_PURGE_BATCH_SIZE * 2 + 7 },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    );

    await expect(evictWordCloudAnalysisSnapshotsForSessions(sessionIds)).resolves.toBe(0);

    expect(redisMock.eval).toHaveBeenCalledTimes(sessionIds.length);
    expect(redisMock.call.mock.calls.filter(([command]) => command === 'WAITAOF')).toHaveLength(3);
    expect(
      redisMock.set.mock.calls.filter(([key]) =>
        String(key).startsWith('nlp:wc:purge-durability:v1:'),
      ),
    ).toHaveLength(3);
  });

  it('begrenzt den Session-Index und hinterlässt bei Ablehnung keinen Rohtext', async () => {
    const cache = createRedisWordCloudAnalysisCache(90);
    const indexKey = buildWordCloudSnapshotIndexKey(scope.sessionId);
    snapshotIndexes.set(
      indexKey,
      new Set(
        Array.from(
          { length: 2_048 },
          (_, index) => `nlp:wc:snapshot:v2:{${scope.sessionId}}:value:ABC123:LEXICAL:${index}`,
        ),
      ),
    );

    await cache.setSnapshot(input, output, scope);

    expect(store.has(buildWordCloudSnapshotCacheKey(input, scope))).toBe(false);
    expect(mocks.warn).toHaveBeenCalledWith(
      'wordcloud:snapshot_cache_index_full',
      expect.objectContaining({ maxEntries: 2_048 }),
    );
  });

  it('entfernt unindizierte v1-Altlasten einmal global statt pro Session', async () => {
    const firstKey = 'nlp:wc:snap:ABC123:SEMANTIC:TOP:NONE:first';
    const secondKey = 'nlp:wc:snap:DEF456:LEXICAL:TOP:LEMMA:second';
    const v2Key = buildWordCloudSnapshotCacheKey(input, scope);
    store.set(firstKey, 'first raw answer');
    store.set(secondKey, 'second raw answer');
    store.set(v2Key, 'v2 answer');

    const results = await Promise.all(
      Array.from({ length: 50 }, () => evictLegacyWordCloudAnalysisSnapshots()),
    );

    expect(new Set(results)).toEqual(new Set([2]));
    expect(redisMock.scan).toHaveBeenCalledOnce();
    expect(redisMock.scan).toHaveBeenCalledWith('0', 'MATCH', 'nlp:wc:snap:*', 'COUNT', 500);
    expect(store.has(firstKey)).toBe(false);
    expect(store.has(secondKey)).toBe(false);
    expect(store.has(v2Key)).toBe(true);
  });

  it('entfernt beim Rollout nach einem Rollback v1, v2 und den alten Textcache', async () => {
    vi.stubEnv('WORD_CLOUD_PURGE_REQUIRE_DURABILITY', '1');
    const cache = createRedisWordCloudAnalysisCache(90);
    const v1Key = 'nlp:wc:snap:ROLLB1:LEXICAL:TOP:NONE:rollback-write';
    const v2Key = buildWordCloudSnapshotCacheKey(input, scope);
    const indexKey = buildWordCloudSnapshotIndexKey(scope.sessionId);
    const fenceKey = buildWordCloudSnapshotPurgeFenceKey(scope.sessionId);
    const oldBarrierKey = 'nlp:wc:snapshot:v2:legacy-purge-barrier';
    const textKey = buildWordCloudTextCacheKey('de', hashWordCloudText('Häuser'));
    store.set(v1Key, 'rollback private answer');
    store.set(textKey, 'derived tokens');
    await cache.setSnapshot(input, output, scope);
    store.set(fenceKey, '1');
    store.set(oldBarrierKey, '1');
    redisEvents.length = 0;

    await expect(evictAllWordCloudAnalysisCacheForRollout()).resolves.toBe(6);

    expect(redisMock.scan).toHaveBeenCalledWith('0', 'MATCH', 'nlp:wc:snap*', 'COUNT', 500);
    expect(redisMock.scan).toHaveBeenCalledWith('0', 'MATCH', 'nlp:wc:text:*', 'COUNT', 500);
    expect(store.has(v1Key)).toBe(false);
    expect(store.has(v2Key)).toBe(false);
    expect(snapshotIndexes.has(indexKey)).toBe(false);
    expect(store.has(fenceKey)).toBe(false);
    expect(store.has(oldBarrierKey)).toBe(false);
    expect(store.has(textKey)).toBe(false);
    expect([...store.keys()].some((key) => key.startsWith('nlp:wc:purge-durability:v1:'))).toBe(
      true,
    );
    expect(redisEvents).toEqual([
      'CLIENT ID',
      'INFO server',
      'CLIENT ID',
      'SCAN nlp:wc:snap*',
      'UNLINK 5',
      'SCAN nlp:wc:text:*',
      'UNLINK 1',
      'CLIENT ID',
      'INFO server',
      'CLIENT ID',
      expect.stringMatching(/^SET nlp:wc:purge-durability:v1:/),
      'WAITAOF 1',
      'CLIENT ID',
      'INFO server',
      'CLIENT ID',
    ]);
  });

  it('durchläuft beim einmaligen Legacy-Sweep alle Redis-SCAN-Seiten', async () => {
    const firstKey = 'nlp:wc:snap:ABC123:LEXICAL:TOP:NONE:first';
    const secondKey = 'nlp:wc:snap:DEF456:SEMANTIC:TOP:NONE:second';
    store.set(firstKey, 'first raw answer');
    store.set(secondKey, 'second raw answer');
    redisMock.scan
      .mockResolvedValueOnce(['17', [firstKey]])
      .mockResolvedValueOnce(['0', [secondKey]]);

    await expect(evictLegacyWordCloudAnalysisSnapshots()).resolves.toBe(2);

    expect(redisMock.scan).toHaveBeenNthCalledWith(1, '0', 'MATCH', 'nlp:wc:snap:*', 'COUNT', 500);
    expect(redisMock.scan).toHaveBeenNthCalledWith(2, '17', 'MATCH', 'nlp:wc:snap:*', 'COUNT', 500);
    expect(store.has(firstKey)).toBe(false);
    expect(store.has(secondKey)).toBe(false);
  });

  it('setzt den Legacy-Sweep nach Fehler für einen fail-closed Retry zurück', async () => {
    redisMock.scan.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(evictLegacyWordCloudAnalysisSnapshots()).rejects.toThrow('ECONNREFUSED');
    await expect(evictLegacyWordCloudAnalysisSnapshots()).resolves.toBe(0);
    expect(redisMock.scan).toHaveBeenCalledTimes(2);
  });

  it('bestätigt auch den einmaligen Runtime-v1-Sweep per AOF', async () => {
    vi.stubEnv('WORD_CLOUD_PURGE_REQUIRE_DURABILITY', '1');
    store.set('nlp:wc:snap:ABC123:LEXICAL:TOP:NONE:legacy', 'private answer');
    waitAofResults.push([0, 0]);

    await expect(evictLegacyWordCloudAnalysisSnapshots()).rejects.toThrow(
      'WORD_CLOUD_PURGE_DURABILITY_UNAVAILABLE',
    );

    waitAofResults.push([1, 0]);
    await expect(evictLegacyWordCloudAnalysisSnapshots()).resolves.toBe(0);
    expect(redisMock.call.mock.calls.filter(([command]) => command === 'WAITAOF')).toEqual([
      ['WAITAOF', 1, 0, 5_000],
      ['WAITAOF', 1, 0, 5_000],
    ]);
    const markerCalls = redisMock.set.mock.calls.filter(([key]) =>
      String(key).startsWith('nlp:wc:purge-durability:v1:'),
    );
    expect(markerCalls).toHaveLength(2);
    expect(markerCalls[1]).toEqual([
      expect.stringMatching(/^nlp:wc:purge-durability:v1:[0-9a-f-]{36}$/),
      expect.stringMatching(/^[0-9a-f-]{36}$/),
      'EX',
      300,
    ]);
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
    await expect(cache.setSnapshot(input, output, scope)).resolves.toBeUndefined();
    expect(await cache.getText('de', 'abc')).toBeNull();
    expect(await cache.getSnapshot(input, scope)).toBeNull();
    expect(mocks.warn).toHaveBeenCalled();

    mocks.getRedis.mockReturnValue({
      get: vi.fn(async () => '{"tokens":[{"display":1}]}'),
      set: vi.fn(),
    });
    expect(await cache.getText('de', 'abc')).toBeNull();

    mocks.getRedis.mockReturnValue({
      mget: vi.fn(async () => [null, '{"mode":"LEXICAL"}']),
      set: vi.fn(),
    });
    expect(await cache.getSnapshot(input, scope)).toBeNull();
  });
});
