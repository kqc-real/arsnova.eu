/**
 * Persistente Bereinigung sessiongebundener Blitzlicht-Daten.
 *
 * Die sessionId-Fence bleibt mindestens so lange erhalten wie jeder
 * Blitzlicht-Key. Sessiongebundene Writer prüfen dieselbe Fence zusammen mit
 * der gespeicherten sessionId in ihrer atomaren Lua-Mutation. Dadurch kann ein
 * vor dem Session-Purge gestarteter Writer die gelöschten Daten nicht wieder
 * anlegen.
 */
import { randomUUID } from 'node:crypto';
import { QuickFeedbackResultSchema } from '@arsnova/shared-types';
import type Redis from 'ioredis';
import { getRedis } from '../redis';

interface QuickFeedbackSessionPurgeEvent {
  readonly sessionId: string;
  readonly sessionCode: string;
}

const QUICK_FEEDBACK_PURGE_DURABILITY_PREFIX = 'qf:purge-durability:v1';
const QUICK_FEEDBACK_PURGE_DURABILITY_MARKER_TTL_SECONDS = 5 * 60;
const QUICK_FEEDBACK_PURGE_AOF_TIMEOUT_MS = 5_000;
const QUICK_FEEDBACK_LEGACY_SCAN_COUNT = 250;

export const QUICK_FEEDBACK_SESSION_PURGE_BATCH_SIZE = 25;
export const QUICK_FEEDBACK_SESSION_PURGE_FENCE_TTL_SECONDS = 35 * 60;

const PURGE_SESSION_BOUND_QUICK_FEEDBACK_LUA = `
-- quick_feedback_session_purge_v1
redis.call('SET', KEYS[7], '1', 'EX', tonumber(ARGV[2]))

local raw = redis.call('GET', KEYS[1])
if not raw then
  return {1, 0}
end

local decoded, result = pcall(cjson.decode, raw)
if not decoded or type(result) ~= 'table' then
  return {-1, 0}
end
if result['sessionBound'] ~= true then
  return {2, 0}
end
if result['sessionId'] ~= nil and result['sessionId'] ~= ARGV[1] then
  return {3, 0}
end

local deleted = 0
for index = 1, 6 do
  deleted = deleted + redis.call('UNLINK', KEYS[index])
end
return {1, deleted}
`;

const PURGE_LEGACY_SESSION_BOUND_QUICK_FEEDBACK_LUA = `
-- quick_feedback_legacy_session_bound_rollout_purge_v1
local raw = redis.call('GET', KEYS[1])
if not raw then
  return {0, 0}
end
if raw ~= ARGV[1] then
  return {2, 0}
end

local decoded, result = pcall(cjson.decode, raw)
if not decoded or type(result) ~= 'table' then
  return {-1, 0}
end
if result['sessionBound'] ~= true or result['sessionId'] ~= nil then
  return {0, 0}
end

local deleted = 0
for index = 1, 6 do
  deleted = deleted + redis.call('UNLINK', KEYS[index])
end
return {1, deleted}
`;

function normalizeQuickFeedbackSessionId(sessionId: string): string {
  const normalized = sessionId.trim();
  if (!normalized || normalized.includes('{') || normalized.includes('}')) {
    throw new Error('A valid session ID is required for the quick-feedback purge.');
  }
  return normalized;
}

function normalizeQuickFeedbackSessionCode(sessionCode: string): string {
  const normalized = sessionCode.trim().toUpperCase();
  if (!normalized) {
    throw new Error('A valid session code is required for the quick-feedback purge.');
  }
  return normalized;
}

export function buildQuickFeedbackSessionPurgeFenceKey(sessionId: string): string {
  return `qf:purged-session:v1:${normalizeQuickFeedbackSessionId(sessionId)}`;
}

function feedbackKeys(sessionCode: string): readonly string[] {
  const code = normalizeQuickFeedbackSessionCode(sessionCode);
  return [
    `qf:${code}`,
    `qf:known:${code}`,
    `qf:voters:${code}`,
    `qf:choices:${code}`,
    `qf:choices:r1:${code}`,
    `qf:tempo:buckets:${code}`,
  ];
}

function requiresQuickFeedbackPurgeDurability(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.QUICK_FEEDBACK_PURGE_REQUIRE_DURABILITY === '1'
  );
}

interface RedisDurabilityContext {
  readonly clientId: string;
  readonly serverRunId: string;
}

async function readRedisClientId(redis: Redis): Promise<string> {
  const clientId = String(await redis.call('CLIENT', 'ID'));
  if (!/^[1-9]\d*$/.test(clientId)) {
    throw new Error('QUICK_FEEDBACK_PURGE_DURABILITY_UNAVAILABLE');
  }
  return clientId;
}

async function readRedisServerRunId(redis: Redis): Promise<string> {
  const info = String(await redis.call('INFO', 'server'));
  const runId = info.match(/(?:^|\r?\n)run_id:([0-9a-f]{40})(?:\r?\n|$)/i)?.[1];
  if (!runId) {
    throw new Error('QUICK_FEEDBACK_PURGE_DURABILITY_UNAVAILABLE');
  }
  return runId.toLowerCase();
}

async function readRedisDurabilityContext(redis: Redis): Promise<RedisDurabilityContext> {
  const clientId = await readRedisClientId(redis);
  const serverRunId = await readRedisServerRunId(redis);
  const verifiedClientId = await readRedisClientId(redis);
  if (verifiedClientId !== clientId) {
    throw new Error('QUICK_FEEDBACK_PURGE_DURABILITY_UNAVAILABLE');
  }
  return { clientId, serverRunId };
}

function sameRedisDurabilityContext(
  left: RedisDurabilityContext,
  right: RedisDurabilityContext,
): boolean {
  return left.clientId === right.clientId && left.serverRunId === right.serverRunId;
}

async function beginQuickFeedbackPurgeDurability(
  redis: Redis,
): Promise<RedisDurabilityContext | null> {
  return requiresQuickFeedbackPurgeDurability() ? readRedisDurabilityContext(redis) : null;
}

async function awaitQuickFeedbackPurgeDurability(
  redis: Redis,
  expectedContext: RedisDurabilityContext | null,
): Promise<void> {
  if (expectedContext === null) return;

  const contextBeforeMarker = await readRedisDurabilityContext(redis);
  if (!sameRedisDurabilityContext(contextBeforeMarker, expectedContext)) {
    throw new Error('QUICK_FEEDBACK_PURGE_DURABILITY_UNAVAILABLE');
  }
  await redis.set(
    `${QUICK_FEEDBACK_PURGE_DURABILITY_PREFIX}:${randomUUID()}`,
    randomUUID(),
    'EX',
    QUICK_FEEDBACK_PURGE_DURABILITY_MARKER_TTL_SECONDS,
  );
  const waitResult = (await redis.call(
    'WAITAOF',
    1,
    0,
    QUICK_FEEDBACK_PURGE_AOF_TIMEOUT_MS,
  )) as unknown;
  const contextAfterWait = await readRedisDurabilityContext(redis);
  if (
    !Array.isArray(waitResult) ||
    Number(waitResult[0]) < 1 ||
    !sameRedisDurabilityContext(contextAfterWait, expectedContext)
  ) {
    throw new Error('QUICK_FEEDBACK_PURGE_DURABILITY_UNAVAILABLE');
  }
}

async function purgeSessionBoundQuickFeedbackMutation(
  redis: Redis,
  event: QuickFeedbackSessionPurgeEvent,
): Promise<number> {
  const sessionId = normalizeQuickFeedbackSessionId(event.sessionId);
  const keys = feedbackKeys(event.sessionCode);
  const result = await redis.eval(
    PURGE_SESSION_BOUND_QUICK_FEEDBACK_LUA,
    7,
    ...keys,
    buildQuickFeedbackSessionPurgeFenceKey(sessionId),
    sessionId,
    String(QUICK_FEEDBACK_SESSION_PURGE_FENCE_TTL_SECONDS),
  );
  if (!Array.isArray(result) || result.length !== 2) {
    throw new Error('QUICK_FEEDBACK_SESSION_PURGE_FAILED');
  }
  const status = Number(result[0]);
  const deleted = Number(result[1]);
  if (status === -1) {
    throw new Error('QUICK_FEEDBACK_SESSION_PURGE_MALFORMED_RECORD');
  }
  if (![1, 2, 3].includes(status) || !Number.isSafeInteger(deleted) || deleted < 0) {
    throw new Error('QUICK_FEEDBACK_SESSION_PURGE_FAILED');
  }
  return deleted;
}

/**
 * Purgt höchstens 25 Sessions pro AOF-Barriere. Die Barriere erfasst ihren
 * Redis-Verbindungs-/Run-Kontext vor der ersten Mutation des Chunks.
 */
export async function purgeSessionBoundQuickFeedbackForSessions(
  events: readonly QuickFeedbackSessionPurgeEvent[],
): Promise<number> {
  const uniqueEvents = [
    ...new Map(
      events.map((event) => {
        const normalized = {
          sessionId: normalizeQuickFeedbackSessionId(event.sessionId),
          sessionCode: normalizeQuickFeedbackSessionCode(event.sessionCode),
        };
        return [`${normalized.sessionId}\u0000${normalized.sessionCode}`, normalized] as const;
      }),
    ).values(),
  ];
  if (uniqueEvents.length === 0) return 0;

  const redis = getRedis();
  let deleted = 0;
  for (
    let offset = 0;
    offset < uniqueEvents.length;
    offset += QUICK_FEEDBACK_SESSION_PURGE_BATCH_SIZE
  ) {
    const chunk = uniqueEvents.slice(offset, offset + QUICK_FEEDBACK_SESSION_PURGE_BATCH_SIZE);
    const durabilityContext = await beginQuickFeedbackPurgeDurability(redis);
    const results = await Promise.allSettled(
      chunk.map((event) => purgeSessionBoundQuickFeedbackMutation(redis, event)),
    );
    const failed = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (failed) throw failed.reason;
    await awaitQuickFeedbackPurgeDurability(redis, durabilityContext);
    deleted += results.reduce(
      (sum, result) => sum + (result.status === 'fulfilled' ? result.value : 0),
      0,
    );
  }
  return deleted;
}

function parseLegacySessionBoundQuickFeedback(raw: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('QUICK_FEEDBACK_LEGACY_PURGE_MALFORMED_RECORD');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('QUICK_FEEDBACK_LEGACY_PURGE_MALFORMED_RECORD');
  }
  if (!QuickFeedbackResultSchema.safeParse(parsed).success) {
    throw new Error('QUICK_FEEDBACK_LEGACY_PURGE_MALFORMED_RECORD');
  }
  const record = parsed as Record<string, unknown>;
  if (record.sessionBound === true) {
    if (!Object.hasOwn(record, 'sessionId')) return true;
    if (typeof record.sessionId !== 'string' || record.sessionId.trim().length === 0) {
      throw new Error('QUICK_FEEDBACK_LEGACY_PURGE_MALFORMED_RECORD');
    }
    return false;
  }
  if (record.sessionBound !== undefined && record.sessionBound !== false) {
    throw new Error('QUICK_FEEDBACK_LEGACY_PURGE_MALFORMED_RECORD');
  }
  return false;
}

async function collectQuickFeedbackPrimaryKeys(redis: Redis): Promise<string[]> {
  const primaryKeys = new Set<string>();
  let cursor = '0';
  do {
    const result = await redis.scan(
      cursor,
      'MATCH',
      'qf:*',
      'COUNT',
      QUICK_FEEDBACK_LEGACY_SCAN_COUNT,
    );
    if (
      !Array.isArray(result) ||
      result.length !== 2 ||
      typeof result[0] !== 'string' ||
      !/^\d+$/.test(result[0]) ||
      !Array.isArray(result[1]) ||
      !result[1].every((key): key is string => typeof key === 'string')
    ) {
      throw new Error('QUICK_FEEDBACK_LEGACY_PURGE_SCAN_INVALID');
    }
    cursor = result[0];
    for (const key of result[1]) {
      if (/^qf:[A-Z0-9]{6}$/.test(key)) primaryKeys.add(key);
    }
  } while (cursor !== '0');
  return [...primaryKeys].sort();
}

async function purgeLegacyQuickFeedbackMutation(
  redis: Redis,
  primaryKey: string,
  expectedRaw: string,
): Promise<number> {
  const code = primaryKey.slice(3);
  const result = await redis.eval(
    PURGE_LEGACY_SESSION_BOUND_QUICK_FEEDBACK_LUA,
    6,
    ...feedbackKeys(code),
    expectedRaw,
  );
  if (!Array.isArray(result) || result.length !== 2) {
    throw new Error('QUICK_FEEDBACK_LEGACY_PURGE_FAILED');
  }
  const status = Number(result[0]);
  const deleted = Number(result[1]);
  if (status === -1) {
    throw new Error('QUICK_FEEDBACK_LEGACY_PURGE_MALFORMED_RECORD');
  }
  if (![0, 1, 2].includes(status) || !Number.isSafeInteger(deleted) || deleted < 0) {
    throw new Error('QUICK_FEEDBACK_LEGACY_PURGE_FAILED');
  }
  return deleted;
}

/**
 * Rollout-only Cutover nach dem Drain des alten App-Writers. Der vollständige
 * `qf:*`-Namespace wird einmal cursor-basiert inventarisiert. Ausschließlich
 * alte sessiongebundene Primärwerte ohne `sessionId` werden anschließend in
 * 25er-Chunks atomar samt ihren fünf Nebenkeys entfernt und AOF-bestätigt.
 *
 * Die Raw-CAS-Prüfung schützt neue bzw. parallel veränderte Runden. Der neue
 * QF-Writer darf während dieses Rollout-Schritts noch nicht laufen.
 */
export async function evictLegacySessionBoundQuickFeedbackForRollout(): Promise<number> {
  const redis = getRedis();
  const primaryKeys = await collectQuickFeedbackPrimaryKeys(redis);
  let deleted = 0;

  for (
    let offset = 0;
    offset < primaryKeys.length;
    offset += QUICK_FEEDBACK_SESSION_PURGE_BATCH_SIZE
  ) {
    const keys = primaryKeys.slice(offset, offset + QUICK_FEEDBACK_SESSION_PURGE_BATCH_SIZE);
    const rawValues = await Promise.all(keys.map((key) => redis.get(key)));
    const candidates: Array<{ key: string; raw: string }> = [];
    for (let index = 0; index < keys.length; index += 1) {
      const raw = rawValues[index];
      if (raw === null || raw === undefined) continue;
      if (parseLegacySessionBoundQuickFeedback(raw)) {
        candidates.push({ key: keys[index]!, raw });
      }
    }
    if (candidates.length === 0) continue;

    const durabilityContext = await beginQuickFeedbackPurgeDurability(redis);
    const results = await Promise.allSettled(
      candidates.map(({ key, raw }) => purgeLegacyQuickFeedbackMutation(redis, key, raw)),
    );
    const failed = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (failed) throw failed.reason;
    await awaitQuickFeedbackPurgeDurability(redis, durabilityContext);
    deleted += results.reduce(
      (sum, result) => sum + (result.status === 'fulfilled' ? result.value : 0),
      0,
    );
  }

  return deleted;
}
