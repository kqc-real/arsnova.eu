import { randomUUID } from 'node:crypto';
import type Redis from 'ioredis';
import { getRedis } from '../redis';
import { logger } from './logger';

export const TRPC_WS_INSTANCES_KEY = 'trpc:ws:instances:v1';
export const TRPC_WS_GLOBAL_CONNECTIONS_KEY = 'trpc:ws:global:v1';
export const TRPC_WS_UPGRADE_BUCKET_PREFIX = 'trpc:ws:upgrades:v1:';
export const TRPC_WS_SESSION_PREFIX = 'trpc:ws:session:v1:';
export const TRPC_WS_PARTICIPANT_PREFIX = 'trpc:ws:participant:v1:';
export const TRPC_WS_UPGRADE_RESERVATION_PREFIX = 'trpc:ws:upgres:v1:';
export const TRPC_WS_BINDING_RESERVATION_PREFIX = 'trpc:ws:bindres:v1:';

const DEFAULT_LEASE_TTL_MS = 30_000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 10_000;
const DEFAULT_OPERATION_TIMEOUT_MS = 1_000;
const HASH_IDLE_TTL_MS = 24 * 60 * 60 * 1_000;
const RESERVATION_TOMBSTONE_TTL_MS = 2 * 60 * 1_000;
const RELEASE_RETRY_DELAY_MS = 200;
const UPGRADE_BUCKET_SECONDS = 10;
const UPGRADE_BUCKET_COUNT = 6;
const UPGRADE_BUCKET_TTL_SECONDS = 70;

/**
 * Atomare, idempotente Upgrade-Reservierung über alle lebenden App-Instanzen:
 * KEYS[1]    = ZSET lebender Instanzen (Score = Ablaufzeit in ms)
 * KEYS[2]    = HASH globaler offener/ausstehender Verbindungen je Instanz
 * KEYS[3..8] = 6 Zehn-Sekunden-Buckets für globale Upgrade-Rate (KEYS[8] = aktuell)
 * KEYS[9]    = Reservierungs-Statuskey (`nil` -> `admitted` -> `released` bzw. `nil` -> `released`)
 * ARGV[1]    = instanceId
 * ARGV[2]    = nowMs
 * ARGV[3]    = leaseTtlMs
 * ARGV[4]    = maxClusterUpgradesPerMinute
 * ARGV[5]    = maxClusterConnections
 * ARGV[6]    = hashIdleTtlMs
 * ARGV[7]    = upgradeBucketTtlSeconds
 *
 * Rückgabe:
 *  >= 1 : reserviert (neuer globaler Verbindungsstand)
 *  -1   : globales Upgrade-Budget pro Minute erschöpft (HTTP 429)
 *  -2   : globales Verbindungs-Cap erreicht (HTTP 503)
 *  -3   : Reservierung wurde bereits vor Ausführung storniert (Tombstone `released`)
 */
const ADMIT_UPGRADE_LUA = `
local instancesKey = KEYS[1]
local globalKey = KEYS[2]
local reservationKey = KEYS[9]
local instanceId = ARGV[1]
local nowMs = tonumber(ARGV[2])
local leaseTtlMs = tonumber(ARGV[3])
local maxUpgrades = tonumber(ARGV[4])
local maxConnections = tonumber(ARGV[5])
local hashIdleTtlMs = tonumber(ARGV[6])
local bucketTtlSec = tonumber(ARGV[7])

local existingState = redis.call('GET', reservationKey)
if existingState == 'released' then
  return -3
end
if existingState == 'admitted' then
  return 1
end

redis.call('ZREMRANGEBYSCORE', instancesKey, '-inf', nowMs)
redis.call('ZADD', instancesKey, nowMs + leaseTtlMs, instanceId)
redis.call('PEXPIRE', instancesKey, leaseTtlMs * 2)

local upgradesLastMinute = 0
for i = 3, 8 do
  upgradesLastMinute = upgradesLastMinute + (tonumber(redis.call('GET', KEYS[i])) or 0)
end
if upgradesLastMinute >= maxUpgrades then
  return -1
end

local entries = redis.call('HGETALL', globalKey)
local activeConnections = 0
for i = 1, #entries, 2 do
  local ownerId = entries[i]
  local count = tonumber(entries[i + 1]) or 0
  if count <= 0 then
    redis.call('HDEL', globalKey, ownerId)
  elseif ownerId == instanceId or redis.call('ZSCORE', instancesKey, ownerId) ~= false then
    activeConnections = activeConnections + count
  else
    redis.call('HDEL', globalKey, ownerId)
  end
end

if activeConnections >= maxConnections then
  return -2
end

redis.call('SET', reservationKey, 'admitted', 'PX', hashIdleTtlMs)
redis.call('INCR', KEYS[8])
redis.call('EXPIRE', KEYS[8], bucketTtlSec)
redis.call('HINCRBY', globalKey, instanceId, 1)
redis.call('PEXPIRE', globalKey, hashIdleTtlMs)
return activeConnections + 1
`;

const RELEASE_CONNECTION_LUA = `
local globalKey = KEYS[1]
local reservationKey = KEYS[2]
local instanceId = ARGV[1]
local tombstoneTtlMs = tonumber(ARGV[2]) or 120000

if reservationKey ~= nil and reservationKey ~= '' then
  local state = redis.call('GET', reservationKey)
  if state == 'released' then
    return 0
  end
  redis.call('SET', reservationKey, 'released', 'PX', tombstoneTtlMs)
  if state ~= 'admitted' then
    return 0
  end
end

local remaining = redis.call('HINCRBY', globalKey, instanceId, -1)
if remaining <= 0 then
  redis.call('HDEL', globalKey, instanceId)
  return 0
end
return remaining
`;

/**
 * Atomare, idempotente Session- und optionale Participant-Bindung über alle lebenden Instanzen:
 * KEYS[1] = ZSET lebender Instanzen
 * KEYS[2] = Reservierungs-Statuskey (`nil` -> `admitted` -> `released` bzw. `nil` -> `released`)
 * KEYS[3] = HASH Session-Verbindungen je Instanz
 * KEYS[4] = optional HASH Participant-Verbindungen je Instanz
 * ARGV[1] = instanceId
 * ARGV[2] = nowMs
 * ARGV[3] = leaseTtlMs
 * ARGV[4] = maxConnectionsPerSession
 * ARGV[5] = maxConnectionsPerParticipant
 * ARGV[6] = hashIdleTtlMs
 *
 * Rückgabe:
 *   1 : reserviert
 *  -1 : Session-Cap erreicht
 *  -2 : Participant-Cap erreicht
 *  -3 : Reservierung wurde bereits vor Ausführung storniert (Tombstone `released`)
 */
const ADMIT_BINDING_LUA = `
local instancesKey = KEYS[1]
local reservationKey = KEYS[2]
local sessionKey = KEYS[3]
local participantKey = KEYS[4]
local instanceId = ARGV[1]
local nowMs = tonumber(ARGV[2])
local leaseTtlMs = tonumber(ARGV[3])
local maxSession = tonumber(ARGV[4])
local maxParticipant = tonumber(ARGV[5])
local hashIdleTtlMs = tonumber(ARGV[6])

local existingState = redis.call('GET', reservationKey)
if existingState == 'released' then
  return -3
end
if existingState == 'admitted' then
  return 1
end

redis.call('ZREMRANGEBYSCORE', instancesKey, '-inf', nowMs)
redis.call('ZADD', instancesKey, nowMs + leaseTtlMs, instanceId)
redis.call('PEXPIRE', instancesKey, leaseTtlMs * 2)

local function sumLiveHash(hashKey)
  local raw = redis.call('HGETALL', hashKey)
  local total = 0
  for i = 1, #raw, 2 do
    local ownerId = raw[i]
    local count = tonumber(raw[i + 1]) or 0
    if count <= 0 then
      redis.call('HDEL', hashKey, ownerId)
    elseif ownerId == instanceId or redis.call('ZSCORE', instancesKey, ownerId) ~= false then
      total = total + count
    else
      redis.call('HDEL', hashKey, ownerId)
    end
  end
  return total
end

if sumLiveHash(sessionKey) >= maxSession then
  return -1
end

if participantKey ~= nil and participantKey ~= '' then
  if sumLiveHash(participantKey) >= maxParticipant then
    return -2
  end
end

redis.call('SET', reservationKey, 'admitted', 'PX', hashIdleTtlMs)
redis.call('HINCRBY', sessionKey, instanceId, 1)
redis.call('PEXPIRE', sessionKey, hashIdleTtlMs)
if participantKey ~= nil and participantKey ~= '' then
  redis.call('HINCRBY', participantKey, instanceId, 1)
  redis.call('PEXPIRE', participantKey, hashIdleTtlMs)
end
return 1
`;

const RELEASE_BINDING_LUA = `
local instanceId = ARGV[1]
local hasReservation = ARGV[2] == '1'
local tombstoneTtlMs = tonumber(ARGV[3]) or 120000
local startIdx = 1

if hasReservation then
  local reservationKey = KEYS[1]
  local state = redis.call('GET', reservationKey)
  if state == 'released' then
    return 0
  end
  redis.call('SET', reservationKey, 'released', 'PX', tombstoneTtlMs)
  if state ~= 'admitted' then
    return 0
  end
  startIdx = 2
end

for i = startIdx, #KEYS do
  local remaining = redis.call('HINCRBY', KEYS[i], instanceId, -1)
  if remaining <= 0 then
    redis.call('HDEL', KEYS[i], instanceId)
  end
end
return 1
`;

const SHUTDOWN_INSTANCE_LUA = `
redis.call('ZREM', KEYS[1], ARGV[1])
redis.call('HDEL', KEYS[2], ARGV[1])
return 1
`;

export interface TrpcWebSocketClusterBudgetOptions {
  maxClusterConnections: number;
  maxClusterUpgradesPerMinute: number;
  maxConnectionsPerSession: number;
  maxConnectionsPerParticipant: number;
  instanceId?: string;
  leaseTtlMs?: number;
  heartbeatIntervalMs?: number;
  operationTimeoutMs?: number;
  now?: () => number;
  redisProvider?: () => Pick<Redis, 'eval' | 'zadd' | 'pexpire'>;
}

export type ClusterUpgradeDecision =
  'admitted' | 'fallback-local' | 'rate-limited' | 'connection-cap';

export type ClusterBindingDecision =
  'admitted' | 'fallback-local' | 'session-cap' | 'participant-cap';

export interface ClusterUpgradeReservation {
  decision: ClusterUpgradeDecision;
  reservationId: string | null;
}

export interface ClusterBindingReservation {
  decision: ClusterBindingDecision;
  reservationId: string | null;
}

export function buildTrpcWsSessionBudgetKey(sessionCode: string): string {
  return `${TRPC_WS_SESSION_PREFIX}${sessionCode}`;
}

export function buildTrpcWsParticipantBudgetKey(participantKey: string): string {
  return `${TRPC_WS_PARTICIPANT_PREFIX}${participantKey}`;
}

export function buildTrpcWsUpgradeReservationKey(reservationId: string): string {
  return `${TRPC_WS_UPGRADE_RESERVATION_PREFIX}${reservationId}`;
}

export function buildTrpcWsBindingReservationKey(reservationId: string): string {
  return `${TRPC_WS_BINDING_RESERVATION_PREFIX}${reservationId}`;
}

function bindingScopeKey(binding: { sessionCode: string; participantKey: string | null }): string {
  return `${binding.sessionCode}\0${binding.participantKey ?? ''}`;
}

function buildUpgradeBucketKeys(nowMs: number): string[] {
  const currentBucket = Math.floor(nowMs / (UPGRADE_BUCKET_SECONDS * 1_000));
  const keys: string[] = [];
  for (let offset = UPGRADE_BUCKET_COUNT - 1; offset >= 0; offset -= 1) {
    keys.push(`${TRPC_WS_UPGRADE_BUCKET_PREFIX}${currentBucket - offset}`);
  }
  return keys;
}

function delayMs(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref();
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('tRPC-WebSocket-Cluster-Budget-Timeout'));
    }, timeoutMs);
    timer.unref();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export class TrpcWebSocketClusterBudget {
  readonly instanceId: string;
  private readonly leaseTtlMs: number;
  private readonly heartbeatIntervalMs: number;
  private readonly operationTimeoutMs: number;
  private readonly now: () => number;
  private readonly redisProvider: () => Pick<Redis, 'eval' | 'zadd' | 'pexpire'>;
  private readonly pendingCompensations = new Set<Promise<void>>();
  private readonly unscopedUpgradeReservations: string[] = [];
  private readonly unscopedBindingReservations = new Map<string, string[]>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private closed = false;
  private fallbackWarnedAt = 0;

  constructor(private readonly options: TrpcWebSocketClusterBudgetOptions) {
    this.instanceId = options.instanceId ?? randomUUID();
    this.leaseTtlMs = options.leaseTtlMs ?? DEFAULT_LEASE_TTL_MS;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
    this.operationTimeoutMs = options.operationTimeoutMs ?? DEFAULT_OPERATION_TIMEOUT_MS;
    this.now = options.now ?? Date.now;
    this.redisProvider = options.redisProvider ?? (() => getRedis());
  }

  start(): void {
    if (this.closed || this.heartbeatTimer) return;
    void this.refreshLease();
    this.heartbeatTimer = setInterval(() => {
      void this.refreshLease();
    }, this.heartbeatIntervalMs);
    this.heartbeatTimer.unref();
  }

  async refreshLease(): Promise<void> {
    if (this.closed) return;
    try {
      const nowMs = this.now();
      const redis = this.redisProvider();
      await withTimeout(
        Promise.all([
          redis.zadd(TRPC_WS_INSTANCES_KEY, nowMs + this.leaseTtlMs, this.instanceId),
          redis.pexpire(TRPC_WS_INSTANCES_KEY, this.leaseTtlMs * 2),
        ]),
        this.operationTimeoutMs,
      );
    } catch (error) {
      this.warnFallback('lease', error);
    }
  }

  private trackCompensation(task: Promise<void>): void {
    this.pendingCompensations.add(task);
    void task.finally(() => {
      this.pendingCompensations.delete(task);
    });
  }

  async flushPendingCompensations(): Promise<void> {
    while (this.pendingCompensations.size > 0) {
      await Promise.allSettled([...this.pendingCompensations]);
    }
  }

  async admitUpgradeReservation(): Promise<ClusterUpgradeReservation> {
    if (this.closed) return { decision: 'connection-cap', reservationId: null };
    const reservationId = randomUUID();
    let timedOutOrFailed = false;
    try {
      const nowMs = this.now();
      const keys = [
        TRPC_WS_INSTANCES_KEY,
        TRPC_WS_GLOBAL_CONNECTIONS_KEY,
        ...buildUpgradeBucketKeys(nowMs),
        buildTrpcWsUpgradeReservationKey(reservationId),
      ];
      const evalPromise = this.redisProvider().eval(
        ADMIT_UPGRADE_LUA,
        keys.length,
        ...keys,
        this.instanceId,
        String(nowMs),
        String(this.leaseTtlMs),
        String(this.options.maxClusterUpgradesPerMinute),
        String(this.options.maxClusterConnections),
        String(HASH_IDLE_TTL_MS),
        String(UPGRADE_BUCKET_TTL_SECONDS),
      );
      this.trackCompensation(
        evalPromise.then(
          async (raw) => {
            if (!timedOutOrFailed) return;
            if (Number(raw) >= 1) {
              await this.releaseConnection(reservationId);
            }
          },
          () => {
            // Bereits über catch/Fallback behandelt.
          },
        ),
      );

      const raw = await withTimeout(evalPromise, this.operationTimeoutMs);
      const code = Number(raw);
      if (code === -1) return { decision: 'rate-limited', reservationId: null };
      if (code === -2) return { decision: 'connection-cap', reservationId: null };
      if (code === -3) return { decision: 'fallback-local', reservationId: null };
      return { decision: 'admitted', reservationId };
    } catch (error) {
      timedOutOrFailed = true;
      this.trackCompensation(this.releaseConnection(reservationId));
      this.warnFallback('upgrade', error);
      return { decision: 'fallback-local', reservationId: null };
    }
  }

  async admitUpgrade(): Promise<ClusterUpgradeDecision> {
    const result = await this.admitUpgradeReservation();
    if (result.decision === 'admitted' && result.reservationId) {
      this.unscopedUpgradeReservations.push(result.reservationId);
    }
    return result.decision;
  }

  async releaseConnection(reservationId?: string | null): Promise<void> {
    const resolvedReservationId =
      reservationId !== undefined
        ? reservationId
        : (this.unscopedUpgradeReservations.shift() ?? null);
    const keys = resolvedReservationId
      ? [TRPC_WS_GLOBAL_CONNECTIONS_KEY, buildTrpcWsUpgradeReservationKey(resolvedReservationId)]
      : [TRPC_WS_GLOBAL_CONNECTIONS_KEY];

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await withTimeout(
          this.redisProvider().eval(
            RELEASE_CONNECTION_LUA,
            keys.length,
            ...keys,
            this.instanceId,
            String(RESERVATION_TOMBSTONE_TTL_MS),
          ),
          this.operationTimeoutMs,
        );
        return;
      } catch (error) {
        if (attempt === 0 && resolvedReservationId && !this.closed) {
          await delayMs(Math.min(RELEASE_RETRY_DELAY_MS, this.operationTimeoutMs));
          continue;
        }
        this.warnFallback('releaseConnection', error);
      }
    }
  }

  async admitBindingReservation(binding: {
    sessionCode: string;
    participantKey: string | null;
  }): Promise<ClusterBindingReservation> {
    if (this.closed) return { decision: 'session-cap', reservationId: null };
    const reservationId = randomUUID();
    let timedOutOrFailed = false;
    try {
      const nowMs = this.now();
      const keys = [
        TRPC_WS_INSTANCES_KEY,
        buildTrpcWsBindingReservationKey(reservationId),
        buildTrpcWsSessionBudgetKey(binding.sessionCode),
      ];
      if (binding.participantKey) {
        keys.push(buildTrpcWsParticipantBudgetKey(binding.participantKey));
      }
      const evalPromise = this.redisProvider().eval(
        ADMIT_BINDING_LUA,
        keys.length,
        ...keys,
        this.instanceId,
        String(nowMs),
        String(this.leaseTtlMs),
        String(this.options.maxConnectionsPerSession),
        String(this.options.maxConnectionsPerParticipant),
        String(HASH_IDLE_TTL_MS),
      );
      this.trackCompensation(
        evalPromise.then(
          async (raw) => {
            if (!timedOutOrFailed) return;
            if (Number(raw) === 1) {
              await this.releaseBinding(binding, reservationId);
            }
          },
          () => {
            // Bereits über catch/Fallback behandelt.
          },
        ),
      );

      const raw = await withTimeout(evalPromise, this.operationTimeoutMs);
      const code = Number(raw);
      if (code === -1) return { decision: 'session-cap', reservationId: null };
      if (code === -2) return { decision: 'participant-cap', reservationId: null };
      if (code === -3) return { decision: 'fallback-local', reservationId: null };
      return { decision: 'admitted', reservationId };
    } catch (error) {
      timedOutOrFailed = true;
      this.trackCompensation(this.releaseBinding(binding, reservationId));
      this.warnFallback('binding', error);
      return { decision: 'fallback-local', reservationId: null };
    }
  }

  async admitBinding(binding: {
    sessionCode: string;
    participantKey: string | null;
  }): Promise<ClusterBindingDecision> {
    const result = await this.admitBindingReservation(binding);
    if (result.decision === 'admitted' && result.reservationId) {
      const key = bindingScopeKey(binding);
      const list = this.unscopedBindingReservations.get(key) ?? [];
      list.push(result.reservationId);
      this.unscopedBindingReservations.set(key, list);
    }
    return result.decision;
  }

  async releaseBinding(
    binding: {
      sessionCode: string;
      participantKey: string | null;
    },
    reservationId?: string | null,
  ): Promise<void> {
    let resolvedReservationId: string | null;
    if (reservationId !== undefined) {
      resolvedReservationId = reservationId;
    } else {
      const scope = bindingScopeKey(binding);
      const list = this.unscopedBindingReservations.get(scope);
      resolvedReservationId = list?.shift() ?? null;
      if (list && list.length === 0) {
        this.unscopedBindingReservations.delete(scope);
      }
    }

    const keys = resolvedReservationId
      ? [
          buildTrpcWsBindingReservationKey(resolvedReservationId),
          buildTrpcWsSessionBudgetKey(binding.sessionCode),
        ]
      : [buildTrpcWsSessionBudgetKey(binding.sessionCode)];
    if (binding.participantKey) {
      keys.push(buildTrpcWsParticipantBudgetKey(binding.participantKey));
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await withTimeout(
          this.redisProvider().eval(
            RELEASE_BINDING_LUA,
            keys.length,
            ...keys,
            this.instanceId,
            resolvedReservationId ? '1' : '0',
            String(RESERVATION_TOMBSTONE_TTL_MS),
          ),
          this.operationTimeoutMs,
        );
        return;
      } catch (error) {
        if (attempt === 0 && resolvedReservationId && !this.closed) {
          await delayMs(Math.min(RELEASE_RETRY_DELAY_MS, this.operationTimeoutMs));
          continue;
        }
        this.warnFallback('releaseBinding', error);
      }
    }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    await this.flushPendingCompensations();
    try {
      await withTimeout(
        this.redisProvider().eval(
          SHUTDOWN_INSTANCE_LUA,
          2,
          TRPC_WS_INSTANCES_KEY,
          TRPC_WS_GLOBAL_CONNECTIONS_KEY,
          this.instanceId,
        ),
        this.operationTimeoutMs,
      );
    } catch {
      // Shutdown: Lease läuft bei nicht erreichbarem Redis über TTL ab.
    }
  }

  private warnFallback(scope: string, error: unknown): void {
    const nowMs = this.now();
    if (nowMs - this.fallbackWarnedAt < 30_000) return;
    this.fallbackWarnedAt = nowMs;
    logger.warn(
      `trpcWebSocketClusterBudget.${scope}: Redis nicht erreichbar, nutze lokale Prozess-Caps.`,
      error,
    );
  }
}
