import { createHash } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeRedis, getRedis } from '../redis';
import {
  checkInvalidSessionCodeFailure,
  SESSION_CODE_PROTECTION_LIMITS,
} from './sessionCodeProtection';

const RUN_REDIS = process.env['RUN_REDIS_SESSION_CODE_TESTS'] === '1';
const KEY_PREFIX = 'security:session-code:';
const CLIENT_A = '11111111-1111-4111-8111-111111111111';
const CLIENT_B = '22222222-2222-4222-8222-222222222222';
const CODE = 'ZZZ999';

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function clientKey(clientId: string): string {
  return `${KEY_PREFIX}client:${hash(clientId)}`;
}

function codeKey(code: string): string {
  return `${KEY_PREFIX}code:${hash(code)}`;
}

describe.skipIf(!RUN_REDIS)('Session-Code-Schutz mit echtem Redis', () => {
  const createdKeys = new Set<string>([`${KEY_PREFIX}global`]);

  beforeEach(async () => {
    const redis = getRedis();
    const existing = await redis.keys(`${KEY_PREFIX}*`);
    if (existing.length > 0) await redis.del(...existing);
    createdKeys.clear();
    createdKeys.add(`${KEY_PREFIX}global`);
  });

  afterAll(async () => {
    const redis = getRedis();
    if (createdKeys.size > 0) await redis.del(...createdKeys);
    await closeRedis();
  });

  it('führt Client-Cap, Code-Delay und Kardinalitätsgrenze atomar aus', async () => {
    expect(SESSION_CODE_PROTECTION_LIMITS).toMatchObject({
      windowSeconds: 30,
      clientFailuresPerWindow: 3,
      codeSoftCapPerWindow: 5,
      globalSoftCapPerWindow: 10,
      delayBaseMs: 10,
      delayMaxMs: 20,
    });

    createdKeys.add(clientKey(CLIENT_A));
    createdKeys.add(codeKey(CODE));
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(checkInvalidSessionCodeFailure(CLIENT_A, CODE)).resolves.toMatchObject({
        allowed: true,
      });
    }

    const blocked = await checkInvalidSessionCodeFailure(CLIENT_A, CODE);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

    createdKeys.add(clientKey(CLIENT_B));
    const delayed = await checkInvalidSessionCodeFailure(CLIENT_B, CODE);
    expect(delayed).toMatchObject({ allowed: true, delayMs: 10 });

    for (let index = 0; index < 6; index += 1) {
      const clientId = `30000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
      const guessedCode = `X${String(index).padStart(5, '0')}`;
      createdKeys.add(clientKey(clientId));
      createdKeys.add(codeKey(guessedCode));
      await checkInvalidSessionCodeFailure(clientId, guessedCode);
    }

    const rotatedClient = '44444444-4444-4444-8444-444444444444';
    const rotatedCode = 'NEW999';
    const saturated = await checkInvalidSessionCodeFailure(rotatedClient, rotatedCode);
    expect(saturated).toMatchObject({
      allowed: true,
      delayMs: SESSION_CODE_PROTECTION_LIMITS.delayMaxMs,
      globalUtilizationPercent: 100,
    });

    const redis = getRedis();
    expect(await redis.exists(clientKey(rotatedClient))).toBe(0);
    expect(await redis.exists(codeKey(rotatedCode))).toBe(0);
    expect(await redis.ttl(`${KEY_PREFIX}global`)).toBeGreaterThan(0);
    expect(await redis.ttl(clientKey(CLIENT_A))).toBeGreaterThan(0);

    const keys = await redis.keys(`${KEY_PREFIX}*`);
    expect(keys.join(' ')).not.toContain(CLIENT_A);
    expect(keys.join(' ')).not.toContain(CODE);
  });
});
