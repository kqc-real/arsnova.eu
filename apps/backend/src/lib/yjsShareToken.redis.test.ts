import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeRedis, getRedis } from '../redis';
import {
  createYjsRotationCapability,
  createYjsShare,
  rotateYjsShare,
  YJS_SHARE_METADATA_TTL_SECONDS,
} from './yjsShareToken';

const RUN_REDIS = process.env['RUN_REDIS_YJS_SHARE_TESTS'] === '1';
const KEY_PATTERN = 'yjs:share:v1:*';
const EXPIRY_INDEX_KEY = 'yjs:share:v1:_expires';

async function clearYjsShareKeys(): Promise<void> {
  const redis = getRedis();
  const keys = await redis.keys(KEY_PATTERN);
  if (keys.length > 0) await redis.del(...keys);
}

describe.skipIf(!RUN_REDIS)('Yjs-Share-Metadaten mit echtem Redis 7', () => {
  beforeEach(clearYjsShareKeys);

  afterAll(async () => {
    await clearYjsShareKeys();
    await closeRedis();
  });

  it('erstellt, rotiert und bereinigt den TTL-Ablaufindex atomar', async () => {
    const redis = getRedis();
    const redisVersion = (await redis.info('server')).match(/redis_version:(\d+)\./)?.[1];
    expect(Number(redisVersion)).toBeGreaterThanOrEqual(7);

    const capability = createYjsRotationCapability();
    const created = await createYjsShare({ rotationCapability: capability });
    const shareKey = `yjs:share:v1:${created.roomId}`;
    expect(await redis.hgetall(shareKey)).toMatchObject({
      generation: '1',
      rotationCapabilityHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(await redis.ttl(shareKey)).toBeGreaterThan(YJS_SHARE_METADATA_TTL_SECONDS - 10);
    const initialExpiry = Number(await redis.zscore(EXPIRY_INDEX_KEY, shareKey));
    expect(initialExpiry).toBeGreaterThan(Date.now());

    const rotated = await rotateYjsShare({
      roomId: created.roomId,
      rotationCapability: capability,
    });
    expect(rotated.generation).toBe(2);
    expect(await redis.hget(shareKey, 'generation')).toBe('2');
    expect(Number(await redis.zscore(EXPIRY_INDEX_KEY, shareKey))).toBeGreaterThanOrEqual(
      initialExpiry,
    );

    const staleMember = 'yjs:share:v1:00000000-0000-4000-8000-000000000999';
    await redis.zadd(EXPIRY_INDEX_KEY, Date.now() - 1, staleMember);
    await createYjsShare({ rotationCapability: createYjsRotationCapability() });
    expect(await redis.zscore(EXPIRY_INDEX_KEY, staleMember)).toBeNull();
  });
});
