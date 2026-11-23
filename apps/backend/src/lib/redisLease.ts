import { randomUUID } from 'node:crypto';
import { getRedis } from '../redis';

const REFRESH_LEASE = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
return redis.call('PEXPIRE', KEYS[1], ARGV[2])
`;
const RELEASE_LEASE = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
return redis.call('DEL', KEYS[1])
`;

const CLAIM_LEASE = `
local current = redis.call('GET', KEYS[1])
if current then return current end
redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2])
return ARGV[1]
`;

export interface RedisLease {
  refresh(ttlMs?: number): Promise<boolean>;
  release(): Promise<void>;
}

export async function acquireRedisLease(key: string, ttlMs: number): Promise<RedisLease | null> {
  const redis = getRedis();
  const owner = randomUUID();
  if ((await redis.set(key, owner, 'PX', ttlMs, 'NX')) !== 'OK') return null;
  return makeLease(redis, key, owner, ttlMs);
}

/** Returns the same generation to the owner and workers joining its operation. */
export async function claimRedisLease(
  key: string,
  ttlMs: number,
): Promise<{ owner: string; lease: RedisLease | null }> {
  const redis = getRedis();
  const proposed = randomUUID();
  const owner = await redis.eval(CLAIM_LEASE, 1, key, proposed, ttlMs);
  if (typeof owner !== 'string') throw new Error('Invalid Redis lease owner');
  return {
    owner,
    lease: owner === proposed ? makeLease(redis, key, owner, ttlMs) : null,
  };
}

function makeLease(
  redis: ReturnType<typeof getRedis>,
  key: string,
  owner: string,
  ttlMs: number,
): RedisLease {
  return {
    async refresh(nextTtlMs = ttlMs) {
      return (await redis.eval(REFRESH_LEASE, 1, key, owner, nextTtlMs)) === 1;
    },
    async release() {
      await redis.eval(RELEASE_LEASE, 1, key, owner);
    },
  };
}
