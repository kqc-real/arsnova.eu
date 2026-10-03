import { afterAll, describe, expect, it } from 'vitest';
import { closeRedis, getRedis } from '../redis';
import { touchParticipantPresence } from './presence';
import { markParticipantReadingReady } from './readingReady';
import {
  buildReadingReadyKey,
  buildSessionPresenceKey,
  buildSessionRuntimeDataPurgeFenceKey,
  purgeSessionRuntimeDataForSessions,
} from './sessionRuntimeDataPurge';

const PHASE = process.env['SESSION_RUNTIME_DATA_DURABILITY_TEST_PHASE'];
const SESSION_ID = '60000000-0000-4000-8000-000000000001';
const QUESTION_ID = '60000000-0000-4000-8000-000000000002';
const PARTICIPANT_ID = '60000000-0000-4000-8000-000000000003';
const PRESENCE_KEY = buildSessionPresenceKey(SESSION_ID);
const READING_READY_KEY = buildReadingReadyKey(SESSION_ID, QUESTION_ID);
const FENCE_KEY = buildSessionRuntimeDataPurgeFenceKey(SESSION_ID);
const DURABILITY_MARKER_PATTERN = 'session:runtime-data:purge-durability:v1:*';

async function attemptLateWrites(): Promise<void> {
  const previousNodeEnv = process.env['NODE_ENV'];
  process.env['NODE_ENV'] = 'development';
  try {
    await touchParticipantPresence(SESSION_ID, PARTICIPANT_ID);
    await markParticipantReadingReady(SESSION_ID, QUESTION_ID, PARTICIPANT_ID);
  } finally {
    process.env['NODE_ENV'] = previousNodeEnv;
  }
}

afterAll(async () => {
  if (PHASE === 'prepare' || PHASE === 'verify') {
    await closeRedis();
  }
});

describe.skipIf(PHASE !== 'prepare')('Session runtime data AOF crash regression (prepare)', () => {
  it('bestätigt Participant-Daten-Purge und Fence vor dem SIGKILL', async () => {
    process.env['SESSION_RUNTIME_DATA_PURGE_REQUIRE_DURABILITY'] = '1';
    const redis = getRedis();
    expect(await redis.config('GET', 'appendonly')).toEqual(['appendonly', 'yes']);
    const oldMarkers = await redis.keys(DURABILITY_MARKER_PATTERN);
    if (oldMarkers.length > 0) await redis.unlink(...oldMarkers);
    await redis.unlink(PRESENCE_KEY, READING_READY_KEY, FENCE_KEY);
    await redis.zadd(PRESENCE_KEY, Date.now(), PARTICIPANT_ID);
    await redis.expire(PRESENCE_KEY, 210);
    await redis.sadd(READING_READY_KEY, PARTICIPANT_ID);
    await redis.expire(READING_READY_KEY, 6 * 60 * 60);

    await expect(purgeSessionRuntimeDataForSessions([SESSION_ID])).resolves.toBe(2);

    expect(await redis.zrange(PRESENCE_KEY, 0, -1)).toEqual([]);
    expect(await redis.smembers(READING_READY_KEY)).toEqual([]);
    expect(await redis.get(FENCE_KEY)).toBe('1');
    expect(await redis.keys(DURABILITY_MARKER_PATTERN)).toHaveLength(1);

    await attemptLateWrites();
    expect(await redis.zrange(PRESENCE_KEY, 0, -1)).toEqual([]);
    expect(await redis.smembers(READING_READY_KEY)).toEqual([]);
  });
});

describe.skipIf(PHASE !== 'verify')('Session runtime data AOF crash regression (verify)', () => {
  it('restauriert nach Redis-SIGKILL weder Participant-Daten noch Schreibrecht', async () => {
    const redis = getRedis();
    expect(await redis.zrange(PRESENCE_KEY, 0, -1)).toEqual([]);
    expect(await redis.smembers(READING_READY_KEY)).toEqual([]);
    expect(await redis.get(FENCE_KEY)).toBe('1');
    expect(await redis.keys(DURABILITY_MARKER_PATTERN)).toHaveLength(1);

    await attemptLateWrites();
    expect(await redis.zrange(PRESENCE_KEY, 0, -1)).toEqual([]);
    expect(await redis.smembers(READING_READY_KEY)).toEqual([]);
  });
});
