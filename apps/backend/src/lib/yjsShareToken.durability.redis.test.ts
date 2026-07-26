import { afterAll, describe, expect, it } from 'vitest';
import { closeRedis, getRedis } from '../redis';
import {
  authorizeYjsRoomUpgrade,
  createYjsRotationCapability,
  createYjsShare,
  rotateYjsShare,
  signYjsShareToken,
} from './yjsShareToken';

const RUN_DURABILITY = process.env['RUN_REDIS_YJS_DURABILITY_TESTS'] === '1';
const PHASE = process.env['YJS_DURABILITY_TEST_PHASE'];
const KEY_PATTERN = 'yjs:share:v1:*';

async function clearYjsShareKeys(): Promise<void> {
  const redis = getRedis();
  const keys = await redis.keys(KEY_PATTERN);
  if (keys.length > 0) await redis.del(...keys);
}

async function singleShareKey(): Promise<string> {
  const keys = (await getRedis().keys(KEY_PATTERN)).filter(
    (key) => key !== 'yjs:share:v1:_expires',
  );
  expect(keys).toHaveLength(1);
  return keys[0]!;
}

describe.skipIf(!RUN_DURABILITY)('Yjs-Share-Widerruf über Redis-Crash', () => {
  afterAll(closeRedis);

  it.skipIf(PHASE !== 'prepare')('bestätigt Generation 2 erst nach AOF-Fsync', async () => {
    await clearYjsShareKeys();
    const capability = createYjsRotationCapability();
    const created = await createYjsShare({ rotationCapability: capability });
    const rotated = await rotateYjsShare({
      roomId: created.roomId,
      rotationCapability: capability,
    });

    expect(rotated.generation).toBe(2);
    expect(await getRedis().hget(`yjs:share:v1:${created.roomId}`, 'generation')).toBe('2');
  });

  it.skipIf(PHASE !== 'verify')(
    'lädt Generation 2 nach SIGKILL aus AOF und lehnt Generation 1 ab',
    async () => {
      const shareKey = await singleShareKey();
      const roomId = shareKey.replace('yjs:share:v1:', '');
      expect(await getRedis().hget(shareKey, 'generation')).toBe('2');

      await expect(
        authorizeYjsRoomUpgrade({
          roomId,
          shareToken: signYjsShareToken(roomId, 1),
        }),
      ).resolves.toEqual({ ok: false, reason: 'stale_generation' });
      await expect(
        authorizeYjsRoomUpgrade({
          roomId,
          shareToken: signYjsShareToken(roomId, 2),
        }),
      ).resolves.toEqual({ ok: true, generation: 2 });

      await clearYjsShareKeys();
    },
  );
});
