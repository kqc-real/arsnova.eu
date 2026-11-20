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

export interface RedisLease {
  refresh(): Promise<boolean>;
  release(): Promise<void>;
}

export async function acquireRedisLease(key: string, ttlMs: number): Promise<RedisLease | null> {
  const redis = getRedis();
  const owner = randomUUID();
  if ((await redis.set(key, owner, 'PX', ttlMs, 'NX')) !== 'OK') return null;

  return {
    async refresh() {
      return (await redis.eval(REFRESH_LEASE, 1, key, owner, ttlMs)) === 1;
    },
    async release() {
      await redis.eval(RELEASE_LEASE, 1, key, owner);
    },
  };
}
