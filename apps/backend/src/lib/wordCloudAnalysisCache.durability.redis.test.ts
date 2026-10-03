import { afterAll, describe, expect, it } from 'vitest';
import type { AnalyzeWordCloudInput, AnalyzeWordCloudOutput } from '@arsnova/shared-types';
import { closeRedis, getRedis } from '../redis';
import {
  buildWordCloudSnapshotCacheKey,
  buildWordCloudSnapshotIndexKey,
  buildWordCloudSnapshotPurgeFenceKey,
  createRedisWordCloudAnalysisCache,
  evictAllWordCloudAnalysisCacheForRollout,
  evictWordCloudAnalysisSnapshotsForSession,
} from './wordCloudAnalysisCache';
import {
  buildQuickFeedbackSessionPurgeFenceKey,
  evictLegacySessionBoundQuickFeedbackForRollout,
  purgeSessionBoundQuickFeedbackForSessions,
} from './quickFeedbackSessionPurge';
import {
  PRODUCT_FEEDBACK_CONSUME_PREFIX,
  PRODUCT_FEEDBACK_FOLLOWUP_PREFIX,
  PRODUCT_FEEDBACK_META_PREFIX,
  PRODUCT_FEEDBACK_TOKEN_PREFIX,
  buildProductFeedbackSessionIndexKey,
  buildProductFeedbackSessionPurgeFenceKey,
  buildSlotKeyForTests,
  hashToken,
  purgeProductFeedbackInvitesForSessions,
} from './productFeedbackTokens';

const PHASE = process.env['WORD_CLOUD_DURABILITY_TEST_PHASE'];
const ROLLOUT_SESSION_ID = '30000000-0000-4000-8000-000000000001';
const PURGE_SESSION_ID = '30000000-0000-4000-8000-000000000002';
const QUICK_FEEDBACK_SESSION_ID = '30000000-0000-4000-8000-000000000003';
const PRODUCT_FEEDBACK_SESSION_ID = '30000000-0000-4000-8000-000000000004';
const QUICK_FEEDBACK_CODE = 'CRQF01';
const LEGACY_QUICK_FEEDBACK_CODE = 'LQF001';
const LEGACY_KEY = 'nlp:wc:snap:CRASH1:LEXICAL:TOP:NONE:crash-regression';
const LEGACY_TEXT_KEY = 'nlp:wc:text:de:1.14b.14:crash-regression';
const OLD_V2_BARRIER_KEY = 'nlp:wc:snapshot:v2:legacy-purge-barrier';
const DURABILITY_MARKER_PATTERN = 'nlp:wc:purge-durability:v1:*';
const QUICK_FEEDBACK_DURABILITY_MARKER_PATTERN = 'qf:purge-durability:v1:*';
const PRODUCT_FEEDBACK_DURABILITY_MARKER_PATTERN = 'productFeedback:purge-durability:v1:*';
const QUICK_FEEDBACK_KEYS = [
  `qf:${QUICK_FEEDBACK_CODE}`,
  `qf:known:${QUICK_FEEDBACK_CODE}`,
  `qf:voters:${QUICK_FEEDBACK_CODE}`,
  `qf:choices:${QUICK_FEEDBACK_CODE}`,
  `qf:choices:r1:${QUICK_FEEDBACK_CODE}`,
  `qf:tempo:buckets:${QUICK_FEEDBACK_CODE}`,
] as const;
const QUICK_FEEDBACK_HOST_KEY = `qf:host:${QUICK_FEEDBACK_CODE}`;
const LEGACY_QUICK_FEEDBACK_KEYS = [
  `qf:${LEGACY_QUICK_FEEDBACK_CODE}`,
  `qf:known:${LEGACY_QUICK_FEEDBACK_CODE}`,
  `qf:voters:${LEGACY_QUICK_FEEDBACK_CODE}`,
  `qf:choices:${LEGACY_QUICK_FEEDBACK_CODE}`,
  `qf:choices:r1:${LEGACY_QUICK_FEEDBACK_CODE}`,
  `qf:tempo:buckets:${LEGACY_QUICK_FEEDBACK_CODE}`,
] as const;
const LEGACY_QUICK_FEEDBACK_HOST_KEY = `qf:host:${LEGACY_QUICK_FEEDBACK_CODE}`;
const PRODUCT_FEEDBACK_SLOT_KEY = buildSlotKeyForTests(PRODUCT_FEEDBACK_SESSION_ID, 'HOST', 'host');
const PRODUCT_FEEDBACK_TOKEN_KEY = `${PRODUCT_FEEDBACK_TOKEN_PREFIX}${hashToken(
  'crash-durable-product-feedback-token',
)}`;
const PRODUCT_FEEDBACK_CONSUME_KEY = `${PRODUCT_FEEDBACK_CONSUME_PREFIX}${hashToken(
  'crash-durable-product-feedback-token',
)}`;
const PRODUCT_FEEDBACK_META_KEY = `${PRODUCT_FEEDBACK_META_PREFIX}${PRODUCT_FEEDBACK_SESSION_ID}`;
const PRODUCT_FEEDBACK_FOLLOWUP_KEY = `${PRODUCT_FEEDBACK_FOLLOWUP_PREFIX}${hashToken(
  'anonymous-follow-up-sentinel',
)}`;
const PRODUCT_FEEDBACK_KEYS = [
  PRODUCT_FEEDBACK_SLOT_KEY,
  PRODUCT_FEEDBACK_TOKEN_KEY,
  PRODUCT_FEEDBACK_CONSUME_KEY,
  PRODUCT_FEEDBACK_META_KEY,
] as const;
const PRODUCT_FEEDBACK_LEGACY_KEYS = [
  buildSlotKeyForTests(PRODUCT_FEEDBACK_SESSION_ID, 'PARTICIPANT', 'legacy-participant'),
  `${PRODUCT_FEEDBACK_TOKEN_PREFIX}${hashToken('legacy-crash-durable-product-feedback-token')}`,
] as const;
const rolloutScope = { sessionId: ROLLOUT_SESSION_ID } as const;
const purgeScope = { sessionId: PURGE_SESSION_ID } as const;
const input = {
  sessionCode: 'CRASH1',
  mode: 'LEXICAL',
  locale: 'de',
  metric: 'TOP',
  normalization: 'NONE',
  items: [{ id: 'item-1', text: 'Crash-durable vertrauliche Antwort', weight: 1 }],
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
  snapshotHash: 'c'.repeat(64),
  status: 'ready',
  modelVersion: null,
  entries: [
    {
      key: 'vertraulich',
      label: 'Vertraulich',
      count: 1,
      basisLabel: null,
      members: [{ sourceId: 'item-1', text: 'Crash-durable vertrauliche Antwort', weight: 1 }],
      variants: ['Vertraulich'],
      confidence: null,
    },
  ],
} as const satisfies AnalyzeWordCloudOutput;

afterAll(async () => {
  if (PHASE === 'prepare' || PHASE === 'verify') {
    await closeRedis();
  }
});

describe.skipIf(PHASE !== 'prepare')('Word-Cloud-Purge AOF crash regression (prepare)', () => {
  it('bestätigt Rollout-Purge und Session-Fence vor dem SIGKILL', async () => {
    process.env['WORD_CLOUD_PURGE_REQUIRE_DURABILITY'] = '1';
    process.env['QUICK_FEEDBACK_PURGE_REQUIRE_DURABILITY'] = '1';
    process.env['PRODUCT_FEEDBACK_PURGE_REQUIRE_DURABILITY'] = '1';
    const redis = getRedis();
    expect(await redis.config('GET', 'appendonly')).toEqual(['appendonly', 'yes']);
    const oldMarkers = await redis.keys(DURABILITY_MARKER_PATTERN);
    if (oldMarkers.length > 0) await redis.unlink(...oldMarkers);
    const oldQuickFeedbackMarkers = await redis.keys(QUICK_FEEDBACK_DURABILITY_MARKER_PATTERN);
    if (oldQuickFeedbackMarkers.length > 0) await redis.unlink(...oldQuickFeedbackMarkers);
    const oldProductFeedbackMarkers = await redis.keys(PRODUCT_FEEDBACK_DURABILITY_MARKER_PATTERN);
    if (oldProductFeedbackMarkers.length > 0) await redis.unlink(...oldProductFeedbackMarkers);
    await redis.unlink(
      LEGACY_KEY,
      LEGACY_TEXT_KEY,
      OLD_V2_BARRIER_KEY,
      buildWordCloudSnapshotCacheKey(input, rolloutScope),
      buildWordCloudSnapshotIndexKey(ROLLOUT_SESSION_ID),
      buildWordCloudSnapshotPurgeFenceKey(ROLLOUT_SESSION_ID),
      buildWordCloudSnapshotCacheKey(input, purgeScope),
      buildWordCloudSnapshotIndexKey(PURGE_SESSION_ID),
      buildWordCloudSnapshotPurgeFenceKey(PURGE_SESSION_ID),
      ...QUICK_FEEDBACK_KEYS,
      QUICK_FEEDBACK_HOST_KEY,
      ...LEGACY_QUICK_FEEDBACK_KEYS,
      LEGACY_QUICK_FEEDBACK_HOST_KEY,
      buildQuickFeedbackSessionPurgeFenceKey(QUICK_FEEDBACK_SESSION_ID),
      ...PRODUCT_FEEDBACK_KEYS,
      ...PRODUCT_FEEDBACK_LEGACY_KEYS,
      PRODUCT_FEEDBACK_FOLLOWUP_KEY,
      buildProductFeedbackSessionIndexKey(PRODUCT_FEEDBACK_SESSION_ID),
      buildProductFeedbackSessionPurgeFenceKey(PRODUCT_FEEDBACK_SESSION_ID),
    );
    const cache = createRedisWordCloudAnalysisCache(90);
    await cache.setSnapshot(input, output, rolloutScope);
    await redis.set(LEGACY_KEY, 'legacy private answer', 'EX', 90);
    await redis.set(LEGACY_TEXT_KEY, 'legacy private text tokens', 'EX', 90);
    await redis.set(buildWordCloudSnapshotPurgeFenceKey(ROLLOUT_SESSION_ID), '1', 'EX', 90);
    await redis.set(OLD_V2_BARRIER_KEY, '1', 'EX', 90);
    expect(await redis.get(buildWordCloudSnapshotCacheKey(input, rolloutScope))).toContain(
      'Crash-durable vertrauliche Antwort',
    );

    await expect(evictAllWordCloudAnalysisCacheForRollout()).resolves.toBeGreaterThanOrEqual(6);

    expect(await redis.get(buildWordCloudSnapshotCacheKey(input, rolloutScope))).toBeNull();
    expect(await redis.get(buildWordCloudSnapshotIndexKey(ROLLOUT_SESSION_ID))).toBeNull();
    expect(await redis.get(buildWordCloudSnapshotPurgeFenceKey(ROLLOUT_SESSION_ID))).toBeNull();
    expect(await redis.get(LEGACY_KEY)).toBeNull();
    expect(await redis.get(LEGACY_TEXT_KEY)).toBeNull();
    expect(await redis.get(OLD_V2_BARRIER_KEY)).toBeNull();

    await cache.setSnapshot(input, output, purgeScope);
    await expect(evictWordCloudAnalysisSnapshotsForSession(PURGE_SESSION_ID)).resolves.toBe(1);

    expect(await redis.get(buildWordCloudSnapshotCacheKey(input, purgeScope))).toBeNull();
    expect(await redis.get(buildWordCloudSnapshotPurgeFenceKey(PURGE_SESSION_ID))).toBe('1');
    expect(await redis.keys(DURABILITY_MARKER_PATTERN)).toHaveLength(2);

    await redis.set(
      QUICK_FEEDBACK_KEYS[0],
      JSON.stringify({
        type: 'YESNO',
        locked: false,
        totalVotes: 1,
        distribution: { YES: 1, NO: 0, MAYBE: 0 },
        sessionBound: true,
        sessionId: QUICK_FEEDBACK_SESSION_ID,
      }),
      'EX',
      90,
    );
    for (const key of QUICK_FEEDBACK_KEYS.slice(1)) {
      await redis.set(key, 'private participant state', 'EX', 90);
    }
    await redis.set(QUICK_FEEDBACK_HOST_KEY, 'standalone host sentinel', 'EX', 90);

    await expect(
      purgeSessionBoundQuickFeedbackForSessions([
        { sessionId: QUICK_FEEDBACK_SESSION_ID, sessionCode: QUICK_FEEDBACK_CODE },
      ]),
    ).resolves.toBe(6);

    await expect(Promise.all(QUICK_FEEDBACK_KEYS.map((key) => redis.get(key)))).resolves.toEqual(
      QUICK_FEEDBACK_KEYS.map(() => null),
    );
    expect(await redis.get(QUICK_FEEDBACK_HOST_KEY)).toBe('standalone host sentinel');
    expect(await redis.get(buildQuickFeedbackSessionPurgeFenceKey(QUICK_FEEDBACK_SESSION_ID))).toBe(
      '1',
    );
    expect(await redis.keys(QUICK_FEEDBACK_DURABILITY_MARKER_PATTERN)).toHaveLength(1);

    await redis.set(
      LEGACY_QUICK_FEEDBACK_KEYS[0],
      JSON.stringify({
        type: 'YESNO',
        locked: false,
        totalVotes: 1,
        distribution: { YES: 1, NO: 0, MAYBE: 0 },
        sessionBound: true,
      }),
      'EX',
      90,
    );
    for (const key of LEGACY_QUICK_FEEDBACK_KEYS.slice(1)) {
      await redis.set(key, 'legacy private participant state', 'EX', 90);
    }
    await redis.set(LEGACY_QUICK_FEEDBACK_HOST_KEY, 'legacy standalone host sentinel', 'EX', 90);

    await expect(evictLegacySessionBoundQuickFeedbackForRollout()).resolves.toBe(6);

    await expect(
      Promise.all(LEGACY_QUICK_FEEDBACK_KEYS.map((key) => redis.get(key))),
    ).resolves.toEqual(LEGACY_QUICK_FEEDBACK_KEYS.map(() => null));
    expect(await redis.get(LEGACY_QUICK_FEEDBACK_HOST_KEY)).toBe('legacy standalone host sentinel');
    expect(await redis.keys(QUICK_FEEDBACK_DURABILITY_MARKER_PATTERN)).toHaveLength(2);

    const productFeedbackPayload = JSON.stringify({
      sessionId: PRODUCT_FEEDBACK_SESSION_ID,
      role: 'HOST',
      subjectId: 'host',
      surveyKey: 'POST_SESSION_EASE_HOST_V1',
      surveyVersion: 1,
      sessionKind: 'QUIZ',
      featureAreas: ['quiz'],
      sessionSizeClass: 'S',
      used: false,
    });
    for (const key of PRODUCT_FEEDBACK_KEYS) {
      await redis.set(key, productFeedbackPayload, 'EX', 90);
    }
    for (const key of PRODUCT_FEEDBACK_LEGACY_KEYS) {
      await redis.set(key, productFeedbackPayload, 'EX', 90);
    }
    await redis.sadd(
      buildProductFeedbackSessionIndexKey(PRODUCT_FEEDBACK_SESSION_ID),
      ...PRODUCT_FEEDBACK_KEYS,
    );
    await redis.expire(buildProductFeedbackSessionIndexKey(PRODUCT_FEEDBACK_SESSION_ID), 90);
    await redis.set(
      PRODUCT_FEEDBACK_FOLLOWUP_KEY,
      JSON.stringify({ feedbackId: 'anonymous-feedback', used: false }),
      'EX',
      90,
    );

    await expect(
      purgeProductFeedbackInvitesForSessions([PRODUCT_FEEDBACK_SESSION_ID]),
    ).resolves.toBe(6);

    await expect(Promise.all(PRODUCT_FEEDBACK_KEYS.map((key) => redis.get(key)))).resolves.toEqual(
      PRODUCT_FEEDBACK_KEYS.map(() => null),
    );
    await expect(
      Promise.all(PRODUCT_FEEDBACK_LEGACY_KEYS.map((key) => redis.get(key))),
    ).resolves.toEqual(PRODUCT_FEEDBACK_LEGACY_KEYS.map(() => null));
    expect(await redis.get(PRODUCT_FEEDBACK_FOLLOWUP_KEY)).not.toBeNull();
    expect(
      await redis.get(buildProductFeedbackSessionPurgeFenceKey(PRODUCT_FEEDBACK_SESSION_ID)),
    ).toBe('1');
    expect(await redis.keys(PRODUCT_FEEDBACK_DURABILITY_MARKER_PATTERN)).toHaveLength(1);
  });
});

describe.skipIf(PHASE !== 'verify')('Word-Cloud-Purge AOF crash regression (verify)', () => {
  it('stellt nach Redis-SIGKILL weder Rollout-Artefakte noch Session-Snapshots her', async () => {
    const redis = getRedis();
    expect(await redis.get(buildWordCloudSnapshotCacheKey(input, rolloutScope))).toBeNull();
    expect(await redis.smembers(buildWordCloudSnapshotIndexKey(ROLLOUT_SESSION_ID))).toEqual([]);
    expect(await redis.get(buildWordCloudSnapshotPurgeFenceKey(ROLLOUT_SESSION_ID))).toBeNull();
    expect(await redis.get(LEGACY_KEY)).toBeNull();
    expect(await redis.get(LEGACY_TEXT_KEY)).toBeNull();
    expect(await redis.get(OLD_V2_BARRIER_KEY)).toBeNull();
    expect(await redis.get(buildWordCloudSnapshotCacheKey(input, purgeScope))).toBeNull();
    expect(await redis.smembers(buildWordCloudSnapshotIndexKey(PURGE_SESSION_ID))).toEqual([]);
    expect(await redis.get(buildWordCloudSnapshotPurgeFenceKey(PURGE_SESSION_ID))).toBe('1');
    expect(await redis.keys(DURABILITY_MARKER_PATTERN)).toHaveLength(2);
    await expect(Promise.all(QUICK_FEEDBACK_KEYS.map((key) => redis.get(key)))).resolves.toEqual(
      QUICK_FEEDBACK_KEYS.map(() => null),
    );
    expect(await redis.get(QUICK_FEEDBACK_HOST_KEY)).toBe('standalone host sentinel');
    expect(await redis.get(buildQuickFeedbackSessionPurgeFenceKey(QUICK_FEEDBACK_SESSION_ID))).toBe(
      '1',
    );
    expect(await redis.keys(QUICK_FEEDBACK_DURABILITY_MARKER_PATTERN)).toHaveLength(2);
    await expect(
      Promise.all(LEGACY_QUICK_FEEDBACK_KEYS.map((key) => redis.get(key))),
    ).resolves.toEqual(LEGACY_QUICK_FEEDBACK_KEYS.map(() => null));
    expect(await redis.get(LEGACY_QUICK_FEEDBACK_HOST_KEY)).toBe('legacy standalone host sentinel');
    await expect(Promise.all(PRODUCT_FEEDBACK_KEYS.map((key) => redis.get(key)))).resolves.toEqual(
      PRODUCT_FEEDBACK_KEYS.map(() => null),
    );
    await expect(
      Promise.all(PRODUCT_FEEDBACK_LEGACY_KEYS.map((key) => redis.get(key))),
    ).resolves.toEqual(PRODUCT_FEEDBACK_LEGACY_KEYS.map(() => null));
    expect(await redis.get(PRODUCT_FEEDBACK_FOLLOWUP_KEY)).not.toBeNull();
    expect(
      await redis.get(buildProductFeedbackSessionPurgeFenceKey(PRODUCT_FEEDBACK_SESSION_ID)),
    ).toBe('1');
    expect(await redis.keys(PRODUCT_FEEDBACK_DURABILITY_MARKER_PATTERN)).toHaveLength(1);
  });
});
