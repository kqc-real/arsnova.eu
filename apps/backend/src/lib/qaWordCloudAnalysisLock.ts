import { createHash, randomBytes } from 'node:crypto';
import { getRedis } from '../redis';

const LOCK_PREFIX = 'qa:word-cloud:analysis:v1:';
const LOCK_TTL_SECONDS = 120;
const RELEASE_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

function lockKey(sessionCode: string): string {
  const sessionDigest = createHash('sha256')
    .update(sessionCode.trim().toUpperCase())
    .digest('hex')
    .slice(0, 24);
  return `${LOCK_PREFIX}${sessionDigest}`;
}

/**
 * Instanzübergreifende Einzelbelegung für bewusst angeforderte Q&A-Analysen.
 * Der Redis-Schlüssel enthält weder Sessioncode noch Inhalte.
 */
export async function acquireQaWordCloudAnalysisLock(
  sessionCode: string,
): Promise<(() => Promise<void>) | null> {
  const redis = getRedis();
  const key = lockKey(sessionCode);
  const owner = randomBytes(16).toString('hex');
  const acquired = await redis.set(key, owner, 'EX', LOCK_TTL_SECONDS, 'NX');
  if (acquired !== 'OK') return null;

  return async () => {
    await redis.eval(RELEASE_LOCK_LUA, 1, key, owner);
  };
}
