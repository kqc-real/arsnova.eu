import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeRedis, getRedis } from '../redis';
import {
  acknowledgeYjsRelayRotation,
  createYjsRotationCapability,
  createYjsShare,
  parseYjsShareRotationEvent,
  rotateYjsShare,
  YJS_SHARE_METADATA_TTL_SECONDS,
  YJS_SHARE_ROTATION_CHANNEL,
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
    const redisVersion = (await redis.info('server')).match(/redis_version:(\d+)\.(\d+)\./);
    expect(Number(redisVersion?.[1]) * 100 + Number(redisVersion?.[2])).toBeGreaterThanOrEqual(702);
    expect(await redis.config('GET', 'appendonly')).toEqual(['appendonly', 'yes']);

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

  it('bestätigt eine ausstehende Generation beim erneuten Aufruf über den externen Relay', async () => {
    vi.stubEnv('YJS_RELAY_MODE', 'external');
    const redis = getRedis();
    const subscriber = redis.duplicate();
    try {
      const rotationCapability = createYjsRotationCapability();
      const { roomId } = await createYjsShare({ rotationCapability });
      const request = { roomId, rotationCapability };
      const key = `yjs:share:v1:${roomId}`;
      await expect(rotateYjsShare(request)).rejects.toThrow('RELAY_UNAVAILABLE');
      expect(await redis.hget(key, 'generation')).toBe('2');

      subscriber.on('message', (_channel, message) => {
        const event = parseYjsShareRotationEvent(message);
        if (event) void acknowledgeYjsRelayRotation(event);
      });
      await subscriber.subscribe(YJS_SHARE_ROTATION_CHANNEL);
      await expect(rotateYjsShare(request)).resolves.toMatchObject({ generation: 2 });
      expect(await redis.hget(key, 'rotationPending')).toBeNull();
      await expect(rotateYjsShare(request)).resolves.toMatchObject({ generation: 3 });
    } finally {
      subscriber.disconnect();
      vi.unstubAllEnvs();
    }
  }, 12_000);
});
