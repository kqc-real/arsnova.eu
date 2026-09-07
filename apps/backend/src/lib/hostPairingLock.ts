/**
 * Redis-Session-Lock für Pairing-Mutationen.
 * Jede Acquisition bekommt ein eigenes Owner-Token; Freigabe nur per CAS.
 */
import { randomBytes } from 'node:crypto';
import { getRedis } from '../redis';

export const HOST_PAIRING_LOCK_PREFIX = 'host:pairing:v1:lock:';
export const HOST_PAIRING_LOCK_TTL_SECONDS = 10;

/** Nur den eigenen Lock löschen — niemals den eines späteren Owners. */
export const RELEASE_HOST_PAIRING_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export function hostPairingLockKey(sessionCode: string): string {
  return `${HOST_PAIRING_LOCK_PREFIX}${sessionCode.trim().toUpperCase()}`;
}

export function createHostPairingLockOwnerToken(): string {
  return randomBytes(16).toString('hex');
}

export async function releaseHostPairingLockIfOwned(
  sessionCode: string,
  ownerToken: string,
): Promise<number> {
  const released = await getRedis().eval(
    RELEASE_HOST_PAIRING_LOCK_LUA,
    1,
    hostPairingLockKey(sessionCode),
    ownerToken,
  );
  return typeof released === 'number' ? released : Number(released) || 0;
}

export async function withHostPairingSessionLock<T>(
  sessionCode: string,
  fn: () => Promise<T>,
  onBusy: () => never,
): Promise<T> {
  const redis = getRedis();
  const key = hostPairingLockKey(sessionCode);
  const ownerToken = createHostPairingLockOwnerToken();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const locked = await redis.set(key, ownerToken, 'EX', HOST_PAIRING_LOCK_TTL_SECONDS, 'NX');
    if (locked === 'OK') {
      try {
        return await fn();
      } finally {
        await releaseHostPairingLockIfOwned(sessionCode, ownerToken);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
  }
  return onBusy();
}
