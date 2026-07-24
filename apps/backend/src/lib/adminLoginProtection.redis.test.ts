import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeRedis, getRedis } from '../redis';
import { ADMIN_LOGIN_PROTECTION_LIMITS, checkAdminLoginFailure } from './adminLoginProtection';

const RUN_REDIS = process.env['RUN_REDIS_ADMIN_LOGIN_TESTS'] === '1';
const GLOBAL_KEY = 'security:admin-login:global-failures';

describe.skipIf(!RUN_REDIS)('Admin-Login-Schutz mit echtem Redis', () => {
  beforeEach(async () => {
    await getRedis().del(GLOBAL_KEY);
  });

  afterAll(async () => {
    await getRedis().del(GLOBAL_KEY);
    await closeRedis();
  });

  it('begrenzt parallele verteilte Fehlversuche atomar mit progressivem Delay', async () => {
    expect(ADMIN_LOGIN_PROTECTION_LIMITS).toMatchObject({
      windowSeconds: 30,
      globalFailuresPerWindow: 5,
      delayBaseMs: 10,
      delayMaxMs: 80,
    });

    const decisions = await Promise.all(Array.from({ length: 20 }, () => checkAdminLoginFailure()));

    const allowed = decisions.filter((decision) => decision.allowed);
    const rejected = decisions.filter((decision) => !decision.allowed);
    expect(allowed).toHaveLength(5);
    expect(rejected).toHaveLength(15);
    expect(allowed.map((decision) => decision.delayMs).sort((a, b) => a - b)).toEqual([
      10, 20, 40, 80, 80,
    ]);
    expect(rejected.every((decision) => (decision.retryAfterSeconds ?? 0) > 0)).toBe(true);

    const redis = getRedis();
    expect(await redis.get(GLOBAL_KEY)).toBe('5');
    expect(await redis.ttl(GLOBAL_KEY)).toBeGreaterThan(0);
    expect(await redis.keys('security:admin-login:*')).toEqual([GLOBAL_KEY]);
  });
});
