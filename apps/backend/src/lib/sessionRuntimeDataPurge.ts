/**
 * Dauerhafte Bereinigung kurzlebiger, teilnehmerbezogener Session-Daten.
 *
 * Die Fence wird vor jeder Löschung gesetzt. Presence- und Readiness-Writer
 * prüfen dieselbe Fence in ihrer atomaren Lua-Mutation, sodass ein bereits
 * gestarteter Request die Daten nach dem Purge nicht erneut anlegen kann.
 */
import { randomUUID } from 'node:crypto';
import type Redis from 'ioredis';
import { getRedis } from '../redis';

const SESSION_RUNTIME_DATA_PURGE_DURABILITY_PREFIX = 'session:runtime-data:purge-durability:v1';
const SESSION_RUNTIME_DATA_PURGE_DURABILITY_MARKER_TTL_SECONDS = 5 * 60;
const SESSION_RUNTIME_DATA_PURGE_AOF_TIMEOUT_MS = 5_000;
const SESSION_RUNTIME_DATA_PURGE_SCAN_COUNT = 250;
const SESSION_RUNTIME_DATA_PURGE_UNLINK_BATCH_SIZE = 250;

export const SESSION_RUNTIME_DATA_PURGE_BATCH_SIZE = 25;
export const SESSION_RUNTIME_DATA_PURGE_FENCE_TTL_SECONDS = 6 * 60 * 60 + 5 * 60;

const BEGIN_SESSION_RUNTIME_DATA_PURGE_LUA = `
-- session_runtime_data_purge_v1
redis.call('SET', KEYS[1], '1', 'EX', tonumber(ARGV[1]))
return redis.call('UNLINK', KEYS[2])
`;

function normalizeSessionRuntimeId(value: string, label: string): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(normalized)) {
    throw new Error(`A valid ${label} is required for session runtime data.`);
  }
  return normalized;
}

export function buildSessionPresenceKey(sessionId: string): string {
  return `presence:session:${normalizeSessionRuntimeId(sessionId, 'session ID')}`;
}

export function buildReadingReadyKey(sessionId: string, questionId: string): string {
  return `reading-ready:${normalizeSessionRuntimeId(
    sessionId,
    'session ID',
  )}:${normalizeSessionRuntimeId(questionId, 'question ID')}`;
}

export function buildSessionRuntimeDataPurgeFenceKey(sessionId: string): string {
  return `session:runtime-data:v1:${normalizeSessionRuntimeId(sessionId, 'session ID')}:purged`;
}

function requiresSessionRuntimeDataPurgeDurability(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.SESSION_RUNTIME_DATA_PURGE_REQUIRE_DURABILITY === '1'
  );
}

interface RedisDurabilityContext {
  readonly clientId: string;
  readonly serverRunId: string;
}

async function readRedisClientId(redis: Redis): Promise<string> {
  const clientId = String(await redis.call('CLIENT', 'ID'));
  if (!/^[1-9]\d*$/.test(clientId)) {
    throw new Error('SESSION_RUNTIME_DATA_PURGE_DURABILITY_UNAVAILABLE');
  }
  return clientId;
}

async function readRedisServerRunId(redis: Redis): Promise<string> {
  const info = String(await redis.call('INFO', 'server'));
  const runId = info.match(/(?:^|\r?\n)run_id:([0-9a-f]{40})(?:\r?\n|$)/i)?.[1];
  if (!runId) {
    throw new Error('SESSION_RUNTIME_DATA_PURGE_DURABILITY_UNAVAILABLE');
  }
  return runId.toLowerCase();
}

async function readRedisDurabilityContext(redis: Redis): Promise<RedisDurabilityContext> {
  const clientId = await readRedisClientId(redis);
  const serverRunId = await readRedisServerRunId(redis);
  const verifiedClientId = await readRedisClientId(redis);
  if (verifiedClientId !== clientId) {
    throw new Error('SESSION_RUNTIME_DATA_PURGE_DURABILITY_UNAVAILABLE');
  }
  return { clientId, serverRunId };
}

function sameRedisDurabilityContext(
  left: RedisDurabilityContext,
  right: RedisDurabilityContext,
): boolean {
  return left.clientId === right.clientId && left.serverRunId === right.serverRunId;
}

async function beginSessionRuntimeDataPurgeDurability(
  redis: Redis,
): Promise<RedisDurabilityContext | null> {
  return requiresSessionRuntimeDataPurgeDurability() ? readRedisDurabilityContext(redis) : null;
}

async function awaitSessionRuntimeDataPurgeDurability(
  redis: Redis,
  expectedContext: RedisDurabilityContext | null,
): Promise<void> {
  if (expectedContext === null) return;

  const contextBeforeMarker = await readRedisDurabilityContext(redis);
  if (!sameRedisDurabilityContext(contextBeforeMarker, expectedContext)) {
    throw new Error('SESSION_RUNTIME_DATA_PURGE_DURABILITY_UNAVAILABLE');
  }
  await redis.set(
    `${SESSION_RUNTIME_DATA_PURGE_DURABILITY_PREFIX}:${randomUUID()}`,
    randomUUID(),
    'EX',
    SESSION_RUNTIME_DATA_PURGE_DURABILITY_MARKER_TTL_SECONDS,
  );
  const waitResult = (await redis.call(
    'WAITAOF',
    1,
    0,
    SESSION_RUNTIME_DATA_PURGE_AOF_TIMEOUT_MS,
  )) as unknown;
  const contextAfterWait = await readRedisDurabilityContext(redis);
  if (
    !Array.isArray(waitResult) ||
    Number(waitResult[0]) < 1 ||
    !sameRedisDurabilityContext(contextAfterWait, expectedContext)
  ) {
    throw new Error('SESSION_RUNTIME_DATA_PURGE_DURABILITY_UNAVAILABLE');
  }
}

function parseReadingReadySessionId(key: string): string | null {
  if (!key.startsWith('reading-ready:')) return null;
  const parts = key.split(':');
  if (parts.length !== 3 || parts[0] !== 'reading-ready') return null;
  try {
    normalizeSessionRuntimeId(parts[1]!, 'session ID');
    normalizeSessionRuntimeId(parts[2]!, 'question ID');
    return parts[1]!;
  } catch {
    return null;
  }
}

async function collectReadingReadyKeys(
  redis: Redis,
  targetedSessionIds: ReadonlySet<string>,
): Promise<string[]> {
  const keys = new Set<string>();
  let cursor = '0';
  do {
    const result = await redis.scan(
      cursor,
      'MATCH',
      'reading-ready:*',
      'COUNT',
      SESSION_RUNTIME_DATA_PURGE_SCAN_COUNT,
    );
    if (
      !Array.isArray(result) ||
      result.length !== 2 ||
      typeof result[0] !== 'string' ||
      !/^\d+$/.test(result[0]) ||
      !Array.isArray(result[1]) ||
      !result[1].every(
        (key): key is string => typeof key === 'string' && key.startsWith('reading-ready:'),
      )
    ) {
      throw new Error('SESSION_RUNTIME_DATA_PURGE_SCAN_INVALID');
    }
    cursor = result[0];
    for (const key of result[1]) {
      const sessionId = parseReadingReadySessionId(key);
      if (sessionId && targetedSessionIds.has(sessionId)) keys.add(key);
    }
  } while (cursor !== '0');
  return [...keys];
}

async function beginSessionRuntimeDataPurgeMutation(
  redis: Redis,
  sessionId: string,
): Promise<number> {
  const normalizedSessionId = normalizeSessionRuntimeId(sessionId, 'session ID');
  const result = await redis.eval(
    BEGIN_SESSION_RUNTIME_DATA_PURGE_LUA,
    2,
    buildSessionRuntimeDataPurgeFenceKey(normalizedSessionId),
    buildSessionPresenceKey(normalizedSessionId),
    String(SESSION_RUNTIME_DATA_PURGE_FENCE_TTL_SECONDS),
  );
  const presenceDeleted = Number(result);
  if (!Number.isSafeInteger(presenceDeleted) || presenceDeleted < 0 || presenceDeleted > 1) {
    throw new Error('SESSION_RUNTIME_DATA_PURGE_FAILED');
  }
  return presenceDeleted;
}

async function deleteReadingReadyKeys(
  redis: Redis,
  targetedSessionIds: ReadonlySet<string>,
): Promise<number> {
  const readingReadyKeys = await collectReadingReadyKeys(redis, targetedSessionIds);
  let deleted = 0;
  for (
    let offset = 0;
    offset < readingReadyKeys.length;
    offset += SESSION_RUNTIME_DATA_PURGE_UNLINK_BATCH_SIZE
  ) {
    const batch = readingReadyKeys.slice(
      offset,
      offset + SESSION_RUNTIME_DATA_PURGE_UNLINK_BATCH_SIZE,
    );
    const unlinked = Number(await redis.unlink(...batch));
    if (!Number.isSafeInteger(unlinked) || unlinked < 0 || unlinked > batch.length) {
      throw new Error('SESSION_RUNTIME_DATA_PURGE_FAILED');
    }
    deleted += unlinked;
  }
  return deleted;
}

/**
 * Purgt höchstens 25 Sessions pro AOF-Barriere. Der Redis-Verbindungs- und
 * Serverlauf-Kontext wird vor der ersten Fence-/Delete-Mutation erfasst.
 */
export async function purgeSessionRuntimeDataForSessions(
  sessionIds: readonly string[],
): Promise<number> {
  const uniqueSessionIds = [
    ...new Set(sessionIds.map((id) => normalizeSessionRuntimeId(id, 'session ID'))),
  ];
  if (uniqueSessionIds.length === 0) return 0;

  const redis = getRedis();
  let deleted = 0;
  for (
    let offset = 0;
    offset < uniqueSessionIds.length;
    offset += SESSION_RUNTIME_DATA_PURGE_BATCH_SIZE
  ) {
    const chunk = uniqueSessionIds.slice(offset, offset + SESSION_RUNTIME_DATA_PURGE_BATCH_SIZE);
    const durabilityContext = await beginSessionRuntimeDataPurgeDurability(redis);
    const results = await Promise.allSettled(
      chunk.map((sessionId) => beginSessionRuntimeDataPurgeMutation(redis, sessionId)),
    );
    const failed = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (failed) throw failed.reason;
    deleted += results.reduce(
      (sum, result) => sum + (result.status === 'fulfilled' ? result.value : 0),
      0,
    );
    const isLastChunk = offset + SESSION_RUNTIME_DATA_PURGE_BATCH_SIZE >= uniqueSessionIds.length;
    if (isLastChunk) {
      deleted += await deleteReadingReadyKeys(redis, new Set(uniqueSessionIds));
    }
    await awaitSessionRuntimeDataPurgeDurability(redis, durabilityContext);
  }
  return deleted;
}

export async function purgeSessionRuntimeData(sessionId: string): Promise<number> {
  return purgeSessionRuntimeDataForSessions([sessionId]);
}
