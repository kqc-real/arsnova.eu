import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeRedis, getRedis } from '../redis';
import { checkSessionCreateRate, RATE_LIMIT_ENV } from './rateLimit';

const RUN_REDIS = process.env['RUN_REDIS_SESSION_CREATE_TESTS'] === '1';
const KEY_PREFIX = 'rl:sessionCreate:';

describe.skipIf(!RUN_REDIS)('Session-Create-Budget mit echtem Redis', () => {
  beforeEach(async () => {
    const redis = getRedis();
    const existing = await redis.keys(`${KEY_PREFIX}*`);
    if (existing.length > 0) await redis.del(...existing);
  });

  afterAll(async () => {
    const redis = getRedis();
    const existing = await redis.keys(`${KEY_PREFIX}*`);
    if (existing.length > 0) await redis.del(...existing);
    await closeRedis();
  });

  it('begrenzt parallele verteilte Creates atomar und erzeugt danach keinen IP-Key', async () => {
    expect(RATE_LIMIT_ENV).toMatchObject({
      sessionCreatePerHour: 3,
      sessionCreateGlobalPerHour: 5,
    });

    const decisions = await Promise.all(
      Array.from({ length: 20 }, (_, index) => checkSessionCreateRate(`198.51.100.${index + 1}`)),
    );

    expect(decisions.filter((decision) => decision.allowed)).toHaveLength(5);
    expect(decisions.filter((decision) => !decision.allowed)).toHaveLength(15);

    const redis = getRedis();
    expect(await redis.get(`${KEY_PREFIX}global`)).toBe('5');
    expect(await redis.keys(`${KEY_PREFIX}ip:*`)).toHaveLength(5);
    expect(await redis.ttl(`${KEY_PREFIX}global`)).toBeGreaterThan(0);

    const rotatedIp = '203.0.113.250';
    await expect(checkSessionCreateRate(rotatedIp)).resolves.toMatchObject({
      allowed: false,
      remaining: 0,
    });
    expect(await redis.exists(`${KEY_PREFIX}ip:${rotatedIp}`)).toBe(0);
  });
});
