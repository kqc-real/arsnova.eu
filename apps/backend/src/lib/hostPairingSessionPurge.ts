/**
 * Durable, identity-bound cleanup for Redis host-pairing artifacts.
 *
 * The immutable sessionId fence is set while holding the code-scoped pairing
 * lock. Pairing writers take the same lock and check the fence before writing,
 * which closes the pre-delete authorization / post-delete write race.
 */
import { randomUUID } from 'node:crypto';
import type Redis from 'ioredis';
import { getRedis } from '../redis';
import {
  buildHostPairingSessionIndexKey,
  buildHostPairingSessionKey,
  buildHostPairingSessionPurgeFenceKey,
  HOST_PAIRING_CLAIM_PREFIX,
  HOST_PAIRING_INVITE_LOOKUP_PREFIX,
  HOST_PAIRING_OUTCOME_PREFIX,
  HOST_PAIRING_REQUEST_LOOKUP_PREFIX,
  HOST_PAIRING_TOKEN_LOOKUP_PREFIX,
  normalizeHostPairingSessionCode,
  notifyPairedHostTokenInvalidated,
  parseHostPairingRecord,
} from './hostPairing';
import { withHostPairingSessionLock } from './hostPairingLock';
import type { HostPairingRecord } from './hostPairingState';

const HOST_PAIRING_PURGE_DURABILITY_PREFIX = 'host:pairing:v1:purge-durability';
const HOST_PAIRING_PURGE_DURABILITY_MARKER_TTL_SECONDS = 5 * 60;
const HOST_PAIRING_PURGE_AOF_TIMEOUT_MS = 5_000;
const HOST_PAIRING_PURGE_SCAN_COUNT = 250;
const HOST_PAIRING_PURGE_DELETE_BATCH_SIZE = 250;
const HOST_PAIRING_SESSION_INDEX_MAX_ENTRIES = 2_048;

export const HOST_PAIRING_PURGE_BATCH_SIZE = 25;
export const HOST_PAIRING_PURGE_FENCE_TTL_SECONDS = 8 * 60 * 60 + 5 * 60;

export type HostPairingSessionPurgeEvent = {
  sessionId: string;
  sessionCode: string;
};

type RedisDurabilityContext = {
  readonly clientId: string;
  readonly serverRunId: string;
};

type PurgeCandidate = { key: string; raw: string };

type PurgePlan = {
  readonly event: HostPairingSessionPurgeEvent;
  readonly record: HostPairingRecord | null;
  readonly recordRaw: string | null;
  readonly ownsRecord: boolean;
  readonly indexKey: string;
  readonly indexRaw: string | null;
  readonly references: ReturnType<typeof recordReferences>;
  readonly artifacts: Map<string, string>;
};

const ARTIFACT_PREFIXES = [
  HOST_PAIRING_INVITE_LOOKUP_PREFIX,
  HOST_PAIRING_REQUEST_LOOKUP_PREFIX,
  HOST_PAIRING_TOKEN_LOOKUP_PREFIX,
  HOST_PAIRING_CLAIM_PREFIX,
  HOST_PAIRING_OUTCOME_PREFIX,
] as const;

function normalizeSessionId(sessionId: string): string {
  const normalized = sessionId.trim();
  // Keep this aligned with the writer-side key builder and reject glob/key
  // injection before any SCAN pattern or deletion is derived from input.
  buildHostPairingSessionPurgeFenceKey(normalized);
  return normalized;
}

function normalizeEvent(event: HostPairingSessionPurgeEvent): HostPairingSessionPurgeEvent {
  const sessionCode = normalizeHostPairingSessionCode(event.sessionCode);
  if (!/^[A-Z0-9_-]{1,64}$/.test(sessionCode)) {
    throw new Error('A valid session code is required for host pairing purge.');
  }
  return { sessionId: normalizeSessionId(event.sessionId), sessionCode };
}

function isArtifactKey(key: string): boolean {
  return ARTIFACT_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function parseIndex(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      !Array.isArray(parsed) ||
      parsed.length > HOST_PAIRING_SESSION_INDEX_MAX_ENTRIES ||
      !parsed.every((key): key is string => typeof key === 'string' && isArtifactKey(key))
    ) {
      throw new Error('HOST_PAIRING_SESSION_INDEX_SCOPE_MISMATCH');
    }
    return [...new Set(parsed)];
  } catch (error) {
    if (error instanceof Error && error.message === 'HOST_PAIRING_SESSION_INDEX_SCOPE_MISMATCH') {
      throw error;
    }
    throw new Error('HOST_PAIRING_SESSION_INDEX_SCOPE_MISMATCH', { cause: error });
  }
}

function parsePayload(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function recordReferences(record: HostPairingRecord | null): {
  requestSecretHashes: Set<string>;
  tokenIds: Set<string>;
  tokenHashes: Set<string>;
} {
  return {
    requestSecretHashes: new Set([
      ...(record?.purgeReferences?.requestSecretHashes ?? []),
      ...(record?.pending?.requestSecretHash ? [record.pending.requestSecretHash] : []),
    ]),
    tokenIds: new Set([
      ...(record?.purgeReferences?.tokenIds ?? []),
      ...(record?.pairedHosts.map((entry) => entry.tokenId) ?? []),
    ]),
    tokenHashes: new Set([
      ...(record?.purgeReferences?.tokenHashes ?? []),
      ...(record?.pairedHosts.map((entry) => entry.tokenHash) ?? []),
    ]),
  };
}

function legacyPayloadBelongsToSession(
  key: string,
  payload: Record<string, unknown>,
  event: HostPairingSessionPurgeEvent,
  references: ReturnType<typeof recordReferences>,
): boolean {
  if (
    key.startsWith(HOST_PAIRING_INVITE_LOOKUP_PREFIX) ||
    key.startsWith(HOST_PAIRING_REQUEST_LOOKUP_PREFIX) ||
    key.startsWith(HOST_PAIRING_TOKEN_LOOKUP_PREFIX)
  ) {
    return (
      typeof payload.sessionCode === 'string' &&
      normalizeHostPairingSessionCode(payload.sessionCode) === event.sessionCode
    );
  }
  const secretHash = key.slice(key.lastIndexOf(':') + 1);
  return (
    references.requestSecretHashes.has(secretHash) ||
    (typeof payload.tokenId === 'string' && references.tokenIds.has(payload.tokenId))
  );
}

function payloadBelongsToSession(
  key: string,
  raw: string,
  event: HostPairingSessionPurgeEvent,
  references: ReturnType<typeof recordReferences>,
): boolean {
  const payload = parsePayload(raw);
  if (!payload) return false;
  if (typeof payload.sessionId === 'string') return payload.sessionId === event.sessionId;
  return legacyPayloadBelongsToSession(key, payload, event, references);
}

function requiresDurability(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.HOST_PAIRING_PURGE_REQUIRE_DURABILITY === '1'
  );
}

async function readRedisClientId(redis: Redis): Promise<string> {
  const clientId = String(await redis.call('CLIENT', 'ID'));
  if (!/^[1-9]\d*$/.test(clientId)) {
    throw new Error('HOST_PAIRING_PURGE_DURABILITY_UNAVAILABLE');
  }
  return clientId;
}

async function readRedisServerRunId(redis: Redis): Promise<string> {
  const info = String(await redis.call('INFO', 'server'));
  const runId = info.match(/(?:^|\r?\n)run_id:([0-9a-f]{40})(?:\r?\n|$)/i)?.[1];
  if (!runId) throw new Error('HOST_PAIRING_PURGE_DURABILITY_UNAVAILABLE');
  return runId.toLowerCase();
}

async function readDurabilityContext(redis: Redis): Promise<RedisDurabilityContext> {
  const clientId = await readRedisClientId(redis);
  const serverRunId = await readRedisServerRunId(redis);
  if ((await readRedisClientId(redis)) !== clientId) {
    throw new Error('HOST_PAIRING_PURGE_DURABILITY_UNAVAILABLE');
  }
  return { clientId, serverRunId };
}

function sameContext(left: RedisDurabilityContext, right: RedisDurabilityContext): boolean {
  return left.clientId === right.clientId && left.serverRunId === right.serverRunId;
}

async function beginDurability(redis: Redis): Promise<RedisDurabilityContext | null> {
  return requiresDurability() ? readDurabilityContext(redis) : null;
}

async function awaitDurability(
  redis: Redis,
  expectedContext: RedisDurabilityContext | null,
): Promise<void> {
  if (!expectedContext) return;
  if (!sameContext(await readDurabilityContext(redis), expectedContext)) {
    throw new Error('HOST_PAIRING_PURGE_DURABILITY_UNAVAILABLE');
  }
  await redis.set(
    `${HOST_PAIRING_PURGE_DURABILITY_PREFIX}:${randomUUID()}`,
    randomUUID(),
    'EX',
    HOST_PAIRING_PURGE_DURABILITY_MARKER_TTL_SECONDS,
  );
  const waitResult = (await redis.call(
    'WAITAOF',
    1,
    0,
    HOST_PAIRING_PURGE_AOF_TIMEOUT_MS,
  )) as unknown;
  if (
    !Array.isArray(waitResult) ||
    Number(waitResult[0]) < 1 ||
    !sameContext(await readDurabilityContext(redis), expectedContext)
  ) {
    throw new Error('HOST_PAIRING_PURGE_DURABILITY_UNAVAILABLE');
  }
}

function chooseLegacyPlan(
  key: string,
  payload: Record<string, unknown>,
  plans: readonly PurgePlan[],
): PurgePlan | null {
  let matches: PurgePlan[];
  if (
    key.startsWith(HOST_PAIRING_INVITE_LOOKUP_PREFIX) ||
    key.startsWith(HOST_PAIRING_REQUEST_LOOKUP_PREFIX) ||
    key.startsWith(HOST_PAIRING_TOKEN_LOOKUP_PREFIX)
  ) {
    if (typeof payload.sessionCode !== 'string') return null;
    const code = normalizeHostPairingSessionCode(payload.sessionCode);
    matches = plans.filter((plan) => plan.event.sessionCode === code);
  } else {
    const secretHash = key.slice(key.lastIndexOf(':') + 1);
    matches = plans.filter(
      (plan) =>
        plan.references.requestSecretHashes.has(secretHash) ||
        (typeof payload.tokenId === 'string' && plan.references.tokenIds.has(payload.tokenId)),
    );
  }
  if (matches.length > 1) throw new Error('HOST_PAIRING_LEGACY_ATTRIBUTION_AMBIGUOUS');
  return matches[0] ?? null;
}

function choosePlanForPayload(
  key: string,
  raw: string,
  plans: readonly PurgePlan[],
): PurgePlan | null {
  const payload = parsePayload(raw);
  if (!payload) return null;
  if (typeof payload.sessionId === 'string') {
    return plans.find((plan) => plan.event.sessionId === payload.sessionId) ?? null;
  }
  return chooseLegacyPlan(key, payload, plans);
}

async function collectLegacyArtifactCandidates(
  redis: Redis,
  plans: readonly PurgePlan[],
): Promise<void> {
  for (const prefix of ARTIFACT_PREFIXES) {
    let cursor = '0';
    do {
      const result = await redis.scan(
        cursor,
        'MATCH',
        `${prefix}*`,
        'COUNT',
        HOST_PAIRING_PURGE_SCAN_COUNT,
      );
      if (
        !Array.isArray(result) ||
        result.length !== 2 ||
        typeof result[0] !== 'string' ||
        !/^\d+$/.test(result[0]) ||
        !Array.isArray(result[1]) ||
        !result[1].every((key): key is string => typeof key === 'string' && key.startsWith(prefix))
      ) {
        throw new Error('HOST_PAIRING_PURGE_SCAN_INVALID');
      }
      cursor = result[0];
      const keys = result[1];
      for (let offset = 0; offset < keys.length; offset += HOST_PAIRING_PURGE_DELETE_BATCH_SIZE) {
        const batch = keys.slice(offset, offset + HOST_PAIRING_PURGE_DELETE_BATCH_SIZE);
        const values = await redis.mget(...batch);
        for (let index = 0; index < batch.length; index += 1) {
          const raw = values[index];
          if (!raw) continue;
          const key = batch[index]!;
          const plan = choosePlanForPayload(key, raw, plans);
          if (plan && !plan.artifacts.has(key)) plan.artifacts.set(key, raw);
        }
      }
    } while (cursor !== '0');
  }
}

const RAW_CAS_DELETE_LUA = `
-- host_pairing_raw_cas_delete_v1
local deleted = 0
for index = 1, #KEYS do
  if redis.call('GET', KEYS[index]) == ARGV[index] then
    deleted = deleted + redis.call('DEL', KEYS[index])
  end
end
return deleted
`;

async function rawCasDelete(redis: Redis, candidates: readonly PurgeCandidate[]): Promise<number> {
  let deleted = 0;
  for (let offset = 0; offset < candidates.length; offset += HOST_PAIRING_PURGE_DELETE_BATCH_SIZE) {
    const batch = candidates.slice(offset, offset + HOST_PAIRING_PURGE_DELETE_BATCH_SIZE);
    if (batch.length === 0) continue;
    const count = Number(
      await redis.eval(
        RAW_CAS_DELETE_LUA,
        batch.length,
        ...batch.map(({ key }) => key),
        ...batch.map(({ raw }) => raw),
      ),
    );
    if (!Number.isSafeInteger(count) || count < 0 || count > batch.length) {
      throw new Error('HOST_PAIRING_PURGE_FAILED');
    }
    deleted += count;
  }
  return deleted;
}

async function planOne(redis: Redis, event: HostPairingSessionPurgeEvent): Promise<PurgePlan> {
  return withHostPairingSessionLock(
    event.sessionCode,
    async () => {
      await redis.set(
        buildHostPairingSessionPurgeFenceKey(event.sessionId),
        '1',
        'EX',
        HOST_PAIRING_PURGE_FENCE_TTL_SECONDS,
      );

      const recordKey = buildHostPairingSessionKey(event.sessionCode);
      const recordRaw = await redis.get(recordKey);
      const record = parseHostPairingRecord(recordRaw);
      if (recordRaw && !record) throw new Error('HOST_PAIRING_RECORD_INVALID');
      const ownsRecord = Boolean(
        record && (record.sessionId === event.sessionId || record.sessionId === null),
      );
      const targetRecord = ownsRecord ? record : null;
      const references = recordReferences(targetRecord);

      const indexKey = buildHostPairingSessionIndexKey(event.sessionId);
      const indexRaw = await redis.get(indexKey);
      const indexedKeys = parseIndex(indexRaw);
      const artifacts = new Map<string, string>();
      if (indexedKeys.length > 0) {
        const values = await redis.mget(...indexedKeys);
        for (let index = 0; index < indexedKeys.length; index += 1) {
          const raw = values[index];
          if (!raw) continue;
          const payload = parsePayload(raw);
          if (!payload || payload.sessionId !== event.sessionId) {
            throw new Error('HOST_PAIRING_SESSION_INDEX_SCOPE_MISMATCH');
          }
          artifacts.set(indexedKeys[index]!, raw);
        }
      }
      return {
        event,
        record: targetRecord,
        recordRaw,
        ownsRecord,
        indexKey,
        indexRaw,
        references,
        artifacts,
      };
    },
    () => {
      throw new Error('HOST_PAIRING_PURGE_LOCK_BUSY');
    },
  );
}

function remainingArtifactBelongsToPlan(key: string, raw: string, plan: PurgePlan): boolean {
  return payloadBelongsToSession(key, raw, plan.event, plan.references);
}

async function deletePlan(redis: Redis, plan: PurgePlan): Promise<number> {
  return withHostPairingSessionLock(
    plan.event.sessionCode,
    async () => {
      // The durable fence must still be present before any delete. Its absence
      // would reopen the exact late-writer race this purge is meant to close.
      if (!(await redis.get(buildHostPairingSessionPurgeFenceKey(plan.event.sessionId)))) {
        throw new Error('HOST_PAIRING_PURGE_FENCE_LOST');
      }
      const candidates: PurgeCandidate[] = [...plan.artifacts].map(([key, raw]) => ({ key, raw }));
      if (plan.ownsRecord && plan.recordRaw) {
        candidates.push({
          key: buildHostPairingSessionKey(plan.event.sessionCode),
          raw: plan.recordRaw,
        });
      }
      if (plan.indexRaw) candidates.push({ key: plan.indexKey, raw: plan.indexRaw });

      const deleted = await rawCasDelete(redis, candidates);
      const remaining = await Promise.all(
        candidates.map(async (candidate) => ({
          ...candidate,
          current: await redis.get(candidate.key),
        })),
      );
      for (const candidate of remaining) {
        if (!candidate.current) continue;
        if (candidate.key === plan.indexKey) {
          throw new Error('HOST_PAIRING_SESSION_INDEX_CHANGED_DURING_PURGE');
        }
        if (candidate.key === buildHostPairingSessionKey(plan.event.sessionCode)) {
          const current = parseHostPairingRecord(candidate.current);
          if (
            !current ||
            current.sessionId === null ||
            current.sessionId === plan.event.sessionId
          ) {
            throw new Error('HOST_PAIRING_RECORD_CHANGED_DURING_PURGE');
          }
          continue;
        }
        if (remainingArtifactBelongsToPlan(candidate.key, candidate.current, plan)) {
          throw new Error('HOST_PAIRING_ARTIFACT_CHANGED_DURING_PURGE');
        }
      }

      for (const key of plan.artifacts.keys()) {
        if (key.startsWith(HOST_PAIRING_TOKEN_LOOKUP_PREFIX)) {
          notifyPairedHostTokenInvalidated(
            plan.event.sessionCode,
            key.slice(HOST_PAIRING_TOKEN_LOOKUP_PREFIX.length),
          );
        }
      }
      for (const tokenHash of plan.references.tokenHashes) {
        notifyPairedHostTokenInvalidated(plan.event.sessionCode, tokenHash);
      }
      return deleted;
    },
    () => {
      throw new Error('HOST_PAIRING_PURGE_LOCK_BUSY');
    },
  );
}

/**
 * Purges at most 25 immutable session identities per durability barrier.
 * A foreign record for a reused code is preserved; only the deleted identity's
 * indexed payloads and safely attributable legacy payloads are removed.
 */
export async function purgeHostPairingForSessions(
  rawEvents: readonly HostPairingSessionPurgeEvent[],
): Promise<number> {
  const unique = new Map<string, HostPairingSessionPurgeEvent>();
  for (const rawEvent of rawEvents) {
    const event = normalizeEvent(rawEvent);
    const existing = unique.get(event.sessionId);
    if (existing && existing.sessionCode !== event.sessionCode) {
      throw new Error('HOST_PAIRING_PURGE_EVENT_MISMATCH');
    }
    unique.set(event.sessionId, event);
  }
  const events = [...unique.values()];
  if (events.length === 0) return 0;

  const redis = getRedis();
  let deleted = 0;
  for (let offset = 0; offset < events.length; offset += HOST_PAIRING_PURGE_BATCH_SIZE) {
    const chunk = events.slice(offset, offset + HOST_PAIRING_PURGE_BATCH_SIZE);
    // Capture connection and Redis process identity before the first lock/fence
    // mutation in this chunk; reconnects or restarts fail the delete closed.
    const durabilityContext = await beginDurability(redis);
    const planned = await Promise.allSettled(chunk.map((event) => planOne(redis, event)));
    const planFailure = planned.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (planFailure) throw planFailure.reason;
    const plans = planned.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );

    // All fences in the chunk exist before the first global legacy scan. Each
    // key family is scanned once per chunk, independent of the session count.
    await collectLegacyArtifactCandidates(redis, plans);

    const results = await Promise.allSettled(plans.map((plan) => deletePlan(redis, plan)));
    const deleteFailure = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (deleteFailure) throw deleteFailure.reason;
    await awaitDurability(redis, durabilityContext);
    deleted += results.reduce(
      (sum, result) => sum + (result.status === 'fulfilled' ? result.value : 0),
      0,
    );
  }
  return deleted;
}

export async function purgeHostPairingForSession(
  event: HostPairingSessionPurgeEvent,
): Promise<number> {
  return purgeHostPairingForSessions([event]);
}
