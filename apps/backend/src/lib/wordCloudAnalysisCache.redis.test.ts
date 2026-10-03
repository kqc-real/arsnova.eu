import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AnalyzeWordCloudInput, AnalyzeWordCloudOutput } from '@arsnova/shared-types';
import { closeRedis, getRedis } from '../redis';
import {
  buildWordCloudSnapshotIndexKey,
  buildWordCloudSnapshotPurgeFenceKey,
  createRedisWordCloudAnalysisCache,
  evictAllWordCloudAnalysisCacheForRollout,
  evictLegacyWordCloudAnalysisSnapshots,
  evictWordCloudAnalysisSnapshotsForSession,
  resetWordCloudAnalysisCacheMigrationForTests,
  WORD_CLOUD_SNAPSHOT_PURGE_FENCE_TTL_SECONDS,
} from './wordCloudAnalysisCache';

const RUN_REDIS = process.env['RUN_REDIS_WORD_CLOUD_CACHE_TESTS'] === '1';
const SESSION_A = '10000000-0000-4000-8000-000000000001';
const SESSION_B = '10000000-0000-4000-8000-000000000002';
const V2_TEST_PATTERN = 'nlp:wc:snapshot:v2:{10000000-0000-4000-8000-00000000000*';
const LEGACY_TEST_KEY = 'nlp:wc:snap:WCLEG1:LEXICAL:TOP:NONE:legacy-test';
const LEGACY_BARRIER_KEY = 'nlp:wc:snapshot:v2:legacy-purge-barrier';
const DURABILITY_MARKER_PATTERN = 'nlp:wc:purge-durability:v1:*';
const TEXT_SENTINEL_KEY = 'nlp:wc:text:word-cloud-purge-integration-sentinel';
const previousDurabilityRequirement = process.env['WORD_CLOUD_PURGE_REQUIRE_DURABILITY'];

const input = {
  sessionCode: 'REUSE1',
  mode: 'LEXICAL',
  locale: 'de',
  metric: 'TOP',
  normalization: 'NONE',
  items: [{ id: 'item-1', text: 'Vertrauliche Antwort', weight: 1 }],
} as const satisfies AnalyzeWordCloudInput;

const output = {
  mode: 'LEXICAL',
  locale: 'de',
  metric: 'TOP',
  generatedAt: '2026-10-03T10:00:00.000Z',
  fallbackUsed: false,
  normalization: 'NONE',
  normalizationApplied: 'NONE',
  normalizationFallbackUsed: false,
  normalizationFallbackReason: null,
  fallbackLocale: 'de',
  analysisVersion: '1.14b.14',
  modelId: null,
  snapshotHash: 'a'.repeat(64),
  status: 'ready',
  modelVersion: null,
  entries: [
    {
      key: 'vertraulich',
      label: 'Vertraulich',
      count: 1,
      basisLabel: null,
      members: [{ sourceId: 'item-1', text: 'Vertrauliche Antwort', weight: 1 }],
      variants: ['Vertraulich'],
      confidence: null,
    },
  ],
} as const satisfies AnalyzeWordCloudOutput;

async function clearWordCloudTestKeys(): Promise<void> {
  const redis = getRedis();
  const keys = [
    ...(await redis.keys(V2_TEST_PATTERN)),
    ...(await redis.keys(DURABILITY_MARKER_PATTERN)),
  ];
  if (keys.length > 0) await redis.unlink(...keys);
  await redis.unlink(LEGACY_TEST_KEY, LEGACY_BARRIER_KEY, TEXT_SENTINEL_KEY);
}

describe.skipIf(!RUN_REDIS)('Word-Cloud Snapshot-Fence mit echtem Redis 7', () => {
  beforeAll(async () => {
    process.env['WORD_CLOUD_PURGE_REQUIRE_DURABILITY'] = '1';
    expect(await getRedis().config('GET', 'appendonly')).toEqual(['appendonly', 'yes']);
  });

  beforeEach(async () => {
    resetWordCloudAnalysisCacheMigrationForTests();
    await clearWordCloudTestKeys();
  });

  afterAll(async () => {
    await clearWordCloudTestKeys();
    await closeRedis();
    if (previousDurabilityRequirement === undefined) {
      delete process.env['WORD_CLOUD_PURGE_REQUIRE_DURABILITY'];
    } else {
      process.env['WORD_CLOUD_PURGE_REQUIRE_DURABILITY'] = previousDurabilityRequirement;
    }
  });

  it('linearisiert konkurrierende Writes gegen den Purge und isoliert Code-Reuse per ID', async () => {
    const cache = createRedisWordCloudAnalysisCache(90);
    const scopeA = { sessionId: SESSION_A } as const;
    const scopeB = { sessionId: SESSION_B } as const;
    await cache.setSnapshot(input, output, scopeA);
    await cache.setSnapshot(input, output, scopeB);

    const purge = evictWordCloudAnalysisSnapshotsForSession(SESSION_A);
    const racingWrites = Array.from({ length: 32 }, (_, index) =>
      cache.setSnapshot(
        { ...input, maxEntries: index + 1 } satisfies AnalyzeWordCloudInput,
        output,
        scopeA,
      ),
    );
    await Promise.all([purge, ...racingWrites]);

    expect(await cache.getSnapshot(input, scopeA)).toBeNull();
    expect(await cache.getSnapshot(input, scopeB)).toMatchObject({ status: 'ready' });
    expect(await getRedis().smembers(buildWordCloudSnapshotIndexKey(SESSION_A))).toEqual([]);
    expect(await evictWordCloudAnalysisSnapshotsForSession(SESSION_A)).toBe(0);
    expect(await getRedis().ttl(buildWordCloudSnapshotPurgeFenceKey(SESSION_A))).toBeGreaterThan(
      WORD_CLOUD_SNAPSHOT_PURGE_FENCE_TTL_SECONDS - 10,
    );
  });

  it('entfernt den v1-Namespace global und lässt v2 sowie Text-Cache unangetastet', async () => {
    const redis = getRedis();
    const cache = createRedisWordCloudAnalysisCache(90);
    await redis.set(LEGACY_TEST_KEY, 'legacy raw answer', 'EX', 90);
    await redis.set(TEXT_SENTINEL_KEY, 'derived token', 'EX', 90);
    await cache.setSnapshot(input, output, { sessionId: SESSION_B });

    await expect(evictLegacyWordCloudAnalysisSnapshots()).resolves.toBeGreaterThanOrEqual(1);

    expect(await redis.get(LEGACY_TEST_KEY)).toBeNull();
    expect(await redis.get(TEXT_SENTINEL_KEY)).toBe('derived token');
    expect(await cache.getSnapshot(input, { sessionId: SESSION_B })).toMatchObject({
      status: 'ready',
    });
  });

  it('leert beim Rollout nach Writer-Drain v1, v2 und den alten Redis-Textcache', async () => {
    const redis = getRedis();
    const cache = createRedisWordCloudAnalysisCache(90);
    const scopeB = { sessionId: SESSION_B } as const;
    await redis.set(LEGACY_TEST_KEY, 'rollback raw answer', 'EX', 90);
    await redis.set(TEXT_SENTINEL_KEY, 'derived token', 'EX', 90);
    await cache.setSnapshot(input, output, scopeB);
    await redis.set(buildWordCloudSnapshotPurgeFenceKey(SESSION_B), '1', 'EX', 90);
    await redis.set(LEGACY_BARRIER_KEY, '1', 'EX', 90);

    await expect(evictAllWordCloudAnalysisCacheForRollout()).resolves.toBeGreaterThanOrEqual(6);

    expect(await redis.get(LEGACY_TEST_KEY)).toBeNull();
    expect(await redis.keys(V2_TEST_PATTERN)).toEqual([]);
    expect(await redis.get(LEGACY_BARRIER_KEY)).toBeNull();
    expect(await redis.get(TEXT_SENTINEL_KEY)).toBeNull();
    expect(await redis.keys(DURABILITY_MARKER_PATTERN)).not.toEqual([]);
  });
});
