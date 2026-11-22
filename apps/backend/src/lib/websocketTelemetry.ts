import { randomUUID } from 'node:crypto';
import { getRedis } from '../redis';
import { logger } from './logger';

const INSTANCE_ID = randomUUID();
const WS_INSTANCE_KEY_PREFIX = 'ws:telemetry:instance:';
/** Bounded Registry lebender Instanzen (Score = Unix-Expiry), vermeidet Keyspace-SCAN. */
const WS_INSTANCE_REGISTRY_KEY = 'ws:telemetry:registry';
const WS_INSTANCE_TTL_SECONDS = 20;
const WS_PUBLISH_INTERVAL_MS = 5_000;

export type ClusterLiveMetrics = {
  available: boolean;
  trpcOpen: number;
  yjsOpen: number;
  trpcOpenedLastMinute: number;
  trpcClosedLastMinute: number;
  yjsOpenedLastMinute: number;
  yjsClosedLastMinute: number;
  rejectsLastMinute: number;
  rateLimitedMessagesLastMinute: number;
  lastSuccessfulReadAt: string | null;
  yjsConfiguredAlive?: boolean;
};

let publishTimer: NodeJS.Timeout | null = null;
let publishWarned = false;
let readClusterWarned = false;

let trpcConnectionsActive = 0;
let trpcConnectionLimit = 1;
let trpcClusterConnectionLimit: number | null = null;
let trpcConfigured = false;
let trpcBoundConnectionsActive = 0;
let trpcSessionConnectionLimit = 1;
let trpcParticipantConnectionLimit = 1;
let yjsConnectionsActive = 0;
let yjsConnectionLimit = 1;
let yjsPerRoomConnectionLimit = 1;
let yjsConfigured = false;
const yjsRoomConnections = new Map<string, number>();

const TELEMETRY_BUCKET_MS = 10_000;
const TELEMETRY_WINDOW_MS = 60_000;

class RollingCounter {
  private readonly buckets = new Map<number, number>();

  increment(now = Date.now()): void {
    this.prune(now);
    const bucket = Math.floor(now / TELEMETRY_BUCKET_MS) * TELEMETRY_BUCKET_MS;
    this.buckets.set(bucket, (this.buckets.get(bucket) ?? 0) + 1);
  }

  sum(now = Date.now()): number {
    this.prune(now);
    let total = 0;
    for (const value of this.buckets.values()) total += value;
    return total;
  }

  reset(): void {
    this.buckets.clear();
  }

  private prune(now: number): void {
    const oldestIncluded = now - TELEMETRY_WINDOW_MS;
    for (const bucket of this.buckets.keys()) {
      // Der Schlüssel ist der Bucket-Beginn. Erst löschen, wenn auch sein
      // spätestes mögliches Ereignis vollständig außerhalb der Minute liegt.
      if (bucket + TELEMETRY_BUCKET_MS <= oldestIncluded) this.buckets.delete(bucket);
    }
  }
}

const trpcRejectedUpgrades = new RollingCounter();
const trpcPayloadRejected = new RollingCounter();
const trpcRateLimitedMessages = new RollingCounter();
const trpcSessionCapRejected = new RollingCounter();
const trpcParticipantCapRejected = new RollingCounter();
const trpcOpened = new RollingCounter();
const trpcClosed = new RollingCounter();
const yjsOpened = new RollingCounter();
const yjsClosed = new RollingCounter();
const yjsRejectedUpgrades = new RollingCounter();
export const YJS_UPGRADE_REJECTION_REASONS = [
  'globalRate',
  'invalidPath',
  'authorizationUnavailable',
  'legacyCutoff',
  'tokenRequired',
  'invalidToken',
  'staleGeneration',
  'roomRate',
  'globalConnectionCap',
  'roomConnectionCap',
] as const;
export type YjsUpgradeRejectionReason = (typeof YJS_UPGRADE_REJECTION_REASONS)[number];
const yjsRejectedUpgradesByReason = Object.fromEntries(
  YJS_UPGRADE_REJECTION_REASONS.map((reason) => [reason, new RollingCounter()]),
) as Record<YjsUpgradeRejectionReason, RollingCounter>;
const yjsPayloadRejected = new RollingCounter();
const yjsRateLimitedMessages = new RollingCounter();
const yjsProtocolErrors = new RollingCounter();
const yjsDocumentRejected = new RollingCounter();
const yjsAwarenessRejected = new RollingCounter();
const yjsOutboundRejected = new RollingCounter();

export function configureTrpcWebSocketTelemetry(limits: {
  connectionLimit: number;
  clusterConnectionLimit?: number | null;
  sessionConnectionLimit: number;
  participantConnectionLimit: number;
}): void {
  trpcConfigured = true;
  trpcConnectionLimit = limits.connectionLimit;
  trpcClusterConnectionLimit =
    typeof limits.clusterConnectionLimit === 'number' && limits.clusterConnectionLimit > 0
      ? limits.clusterConnectionLimit
      : null;
  trpcSessionConnectionLimit = limits.sessionConnectionLimit;
  trpcParticipantConnectionLimit = limits.participantConnectionLimit;
}

export function recordTrpcWebSocketConnected(): void {
  trpcConnectionsActive += 1;
  trpcOpened.increment();
}

export function recordTrpcWebSocketDisconnected(): void {
  trpcConnectionsActive = Math.max(0, trpcConnectionsActive - 1);
  trpcClosed.increment();
}

export function recordTrpcWebSocketRejectedUpgrade(): void {
  trpcRejectedUpgrades.increment();
}

export function recordTrpcWebSocketPayloadRejected(): void {
  trpcPayloadRejected.increment();
}

export function recordTrpcWebSocketRateLimitedMessage(): void {
  trpcRateLimitedMessages.increment();
}

export function recordTrpcWebSocketBindingConnected(): void {
  trpcBoundConnectionsActive += 1;
}

export function recordTrpcWebSocketBindingDisconnected(): void {
  trpcBoundConnectionsActive = Math.max(0, trpcBoundConnectionsActive - 1);
}

export function recordTrpcWebSocketSessionCapRejected(): void {
  trpcSessionCapRejected.increment();
}

export function recordTrpcWebSocketParticipantCapRejected(): void {
  trpcParticipantCapRejected.increment();
}

export function configureYjsWebSocketTelemetry(limits: {
  connectionLimit: number;
  perRoomConnectionLimit: number;
}): void {
  yjsConfigured = true;
  yjsConnectionLimit = limits.connectionLimit;
  yjsPerRoomConnectionLimit = limits.perRoomConnectionLimit;
}

export function recordYjsWebSocketConnected(room: string): void {
  yjsConnectionsActive += 1;
  yjsOpened.increment();
  yjsRoomConnections.set(room, (yjsRoomConnections.get(room) ?? 0) + 1);
}

export function recordYjsWebSocketDisconnected(room: string): void {
  yjsConnectionsActive = Math.max(0, yjsConnectionsActive - 1);
  yjsClosed.increment();
  const remaining = Math.max(0, (yjsRoomConnections.get(room) ?? 0) - 1);
  if (remaining === 0) yjsRoomConnections.delete(room);
  else yjsRoomConnections.set(room, remaining);
}

export function recordYjsWebSocketRejectedUpgrade(reason: YjsUpgradeRejectionReason): void {
  yjsRejectedUpgrades.increment();
  yjsRejectedUpgradesByReason[reason].increment();
}

export function recordYjsWebSocketPayloadRejected(): void {
  yjsPayloadRejected.increment();
}

export function recordYjsWebSocketRateLimitedMessage(): void {
  yjsRateLimitedMessages.increment();
}

export function recordYjsWebSocketProtocolError(): void {
  yjsProtocolErrors.increment();
}

export function recordYjsWebSocketDocumentRejected(): void {
  yjsDocumentRejected.increment();
}

export function recordYjsWebSocketAwarenessRejected(): void {
  yjsAwarenessRejected.increment();
}

export function recordYjsWebSocketOutboundRejected(): void {
  yjsOutboundRejected.increment();
}

export function getWebSocketTelemetrySnapshot(): {
  trpcConnectionsActive: number;
  trpcConnectionLimit: number;
  trpcBoundConnectionsActive: number;
  trpcSessionConnectionLimit: number;
  trpcParticipantConnectionLimit: number;
  trpcSessionCapRejectedLastMinute: number;
  trpcParticipantCapRejectedLastMinute: number;
  trpcRejectedUpgradesLastMinute: number;
  trpcPayloadRejectedLastMinute: number;
  trpcRateLimitedMessagesLastMinute: number;
  trpcOpenedLastMinute: number;
  trpcClosedLastMinute: number;
  yjsConnectionsActive: number;
  yjsRoomsActive: number;
  yjsConnectionLimit: number;
  yjsPerRoomConnectionLimit: number;
  yjsRejectedUpgradesLastMinute: number;
  yjsRejectedUpgradesByReasonLastMinute: Record<YjsUpgradeRejectionReason, number>;
  yjsPayloadRejectedLastMinute: number;
  yjsRateLimitedMessagesLastMinute: number;
  yjsProtocolErrorsLastMinute: number;
  yjsDocumentRejectedLastMinute: number;
  yjsAwarenessRejectedLastMinute: number;
  yjsOutboundRejectedLastMinute: number;
  yjsOpenedLastMinute: number;
  yjsClosedLastMinute: number;
} {
  return {
    trpcConnectionsActive,
    trpcConnectionLimit,
    trpcBoundConnectionsActive,
    trpcSessionConnectionLimit,
    trpcParticipantConnectionLimit,
    trpcSessionCapRejectedLastMinute: trpcSessionCapRejected.sum(),
    trpcParticipantCapRejectedLastMinute: trpcParticipantCapRejected.sum(),
    trpcRejectedUpgradesLastMinute: trpcRejectedUpgrades.sum(),
    trpcPayloadRejectedLastMinute: trpcPayloadRejected.sum(),
    trpcRateLimitedMessagesLastMinute: trpcRateLimitedMessages.sum(),
    trpcOpenedLastMinute: trpcOpened.sum(),
    trpcClosedLastMinute: trpcClosed.sum(),
    yjsConnectionsActive,
    yjsRoomsActive: yjsRoomConnections.size,
    yjsConnectionLimit,
    yjsPerRoomConnectionLimit,
    yjsRejectedUpgradesLastMinute: yjsRejectedUpgrades.sum(),
    yjsRejectedUpgradesByReasonLastMinute: Object.fromEntries(
      YJS_UPGRADE_REJECTION_REASONS.map((reason) => [
        reason,
        yjsRejectedUpgradesByReason[reason].sum(),
      ]),
    ) as Record<YjsUpgradeRejectionReason, number>,
    yjsPayloadRejectedLastMinute: yjsPayloadRejected.sum(),
    yjsRateLimitedMessagesLastMinute: yjsRateLimitedMessages.sum(),
    yjsProtocolErrorsLastMinute: yjsProtocolErrors.sum(),
    yjsDocumentRejectedLastMinute: yjsDocumentRejected.sum(),
    yjsAwarenessRejectedLastMinute: yjsAwarenessRejected.sum(),
    yjsOutboundRejectedLastMinute: yjsOutboundRejected.sum(),
    yjsOpenedLastMinute: yjsOpened.sum(),
    yjsClosedLastMinute: yjsClosed.sum(),
  };
}

export type WebSocketTelemetrySnapshot = ReturnType<typeof getWebSocketTelemetrySnapshot>;

type InstanceWebSocketTelemetryPayload = Partial<ClusterLiveMetrics> & {
  updatedAt?: number;
  trpcConfigured?: boolean;
  trpcClusterConnectionLimit?: number | null;
  yjsConfigured?: boolean;
  snapshot?: Partial<WebSocketTelemetrySnapshot>;
};

function localRejectsAndRateLimits(snapshot: WebSocketTelemetrySnapshot): {
  rejectsLastMinute: number;
  rateLimitedMessagesLastMinute: number;
} {
  const rejectsLastMinute =
    snapshot.trpcRejectedUpgradesLastMinute +
    snapshot.trpcPayloadRejectedLastMinute +
    snapshot.trpcSessionCapRejectedLastMinute +
    snapshot.trpcParticipantCapRejectedLastMinute +
    snapshot.yjsRejectedUpgradesLastMinute +
    snapshot.yjsPayloadRejectedLastMinute +
    snapshot.yjsProtocolErrorsLastMinute +
    snapshot.yjsDocumentRejectedLastMinute +
    snapshot.yjsAwarenessRejectedLastMinute +
    snapshot.yjsOutboundRejectedLastMinute;
  const rateLimitedMessagesLastMinute =
    snapshot.trpcRateLimitedMessagesLastMinute + snapshot.yjsRateLimitedMessagesLastMinute;
  return { rejectsLastMinute, rateLimitedMessagesLastMinute };
}

/** Publiziert Prozess-Snapshot nach Redis (TTL); abgestürzte Instanzen verschwinden. */
export async function publishInstanceWebSocketTelemetry(): Promise<void> {
  if (process.env['NODE_ENV'] === 'test') return;
  try {
    const snapshot = getWebSocketTelemetrySnapshot();
    const { rejectsLastMinute, rateLimitedMessagesLastMinute } =
      localRejectsAndRateLimits(snapshot);
    const payload = JSON.stringify({
      trpcOpen: snapshot.trpcConnectionsActive,
      yjsOpen: snapshot.yjsConnectionsActive,
      trpcOpenedLastMinute: snapshot.trpcOpenedLastMinute,
      trpcClosedLastMinute: snapshot.trpcClosedLastMinute,
      yjsOpenedLastMinute: snapshot.yjsOpenedLastMinute,
      yjsClosedLastMinute: snapshot.yjsClosedLastMinute,
      rejectsLastMinute,
      rateLimitedMessagesLastMinute,
      trpcConfigured,
      trpcClusterConnectionLimit,
      yjsConfigured,
      snapshot,
      updatedAt: Date.now(),
    } satisfies InstanceWebSocketTelemetryPayload);
    const redis = getRedis();
    const key = `${WS_INSTANCE_KEY_PREFIX}${INSTANCE_ID}`;
    const expiresAt = Math.floor(Date.now() / 1000) + WS_INSTANCE_TTL_SECONDS;
    const pipeline = redis.multi();
    pipeline.set(key, payload, 'EX', WS_INSTANCE_TTL_SECONDS);
    pipeline.zadd(WS_INSTANCE_REGISTRY_KEY, expiresAt, INSTANCE_ID);
    pipeline.zremrangebyscore(WS_INSTANCE_REGISTRY_KEY, '-inf', Math.floor(Date.now() / 1000));
    await pipeline.exec();
  } catch (error) {
    if (!publishWarned) {
      publishWarned = true;
      logger.warn(
        'websocketTelemetry.publish: Redis nicht erreichbar, Cluster-Snapshot übersprungen.',
        error,
      );
    }
  }
}

export function startWebSocketTelemetryClusterPublisher(): void {
  if (process.env['NODE_ENV'] === 'test' || publishTimer) return;
  void publishInstanceWebSocketTelemetry();
  publishTimer = setInterval(() => {
    void publishInstanceWebSocketTelemetry();
  }, WS_PUBLISH_INTERVAL_MS);
  publishTimer.unref();
}

export async function stopWebSocketTelemetryClusterPublisher(): Promise<void> {
  if (publishTimer) {
    clearInterval(publishTimer);
    publishTimer = null;
  }
  if (process.env['NODE_ENV'] === 'test') return;
  try {
    const redis = getRedis();
    const pipeline = redis.multi();
    pipeline.del(`${WS_INSTANCE_KEY_PREFIX}${INSTANCE_ID}`);
    pipeline.zrem(WS_INSTANCE_REGISTRY_KEY, INSTANCE_ID);
    await pipeline.exec();
  } catch {
    // Shutdown: best effort
  }
}

async function readFreshInstancePayloads(
  nowMs: number,
): Promise<InstanceWebSocketTelemetryPayload[] | null> {
  const redis = getRedis();
  const nowSec = Math.floor(nowMs / 1000);
  await redis.zremrangebyscore(WS_INSTANCE_REGISTRY_KEY, '-inf', nowSec);
  const instanceIds = await redis.zrange(WS_INSTANCE_REGISTRY_KEY, 0, -1);
  let keys = instanceIds.map((id) => `${WS_INSTANCE_KEY_PREFIX}${id}`);

  if (keys.length === 0) {
    // Mindestens den lokalen Snapshot publizieren und erneut lesen.
    await publishInstanceWebSocketTelemetry();
    const localKey = `${WS_INSTANCE_KEY_PREFIX}${INSTANCE_ID}`;
    const localRaw = await redis.get(localKey);
    if (!localRaw) return null;
    keys = [localKey];
  }

  const values = await redis.mget(...keys);
  const fresh: InstanceWebSocketTelemetryPayload[] = [];
  for (const raw of values) {
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as InstanceWebSocketTelemetryPayload;
      if (
        typeof parsed.updatedAt === 'number' &&
        nowMs - parsed.updatedAt > WS_INSTANCE_TTL_SECONDS * 1000
      ) {
        continue;
      }
      fresh.push(parsed);
    } catch {
      // Ungültigen Snapshot ignorieren
    }
  }
  return fresh.length > 0 ? fresh : null;
}

/**
 * Summiert Live-Kennzahlen aller Instanzen mit gültigem Redis-TTL-Snapshot.
 * Ohne lesbare Clusterdaten: unavailable (keine prozesslokalen Werte als Plattformtotal).
 */
export async function readClusterLiveConnectionMetrics(
  nowMs: number = Date.now(),
): Promise<ClusterLiveMetrics> {
  if (process.env['NODE_ENV'] === 'test') {
    const snapshot = getWebSocketTelemetrySnapshot();
    const { rejectsLastMinute, rateLimitedMessagesLastMinute } =
      localRejectsAndRateLimits(snapshot);
    return {
      available: true,
      trpcOpen: snapshot.trpcConnectionsActive,
      yjsOpen: snapshot.yjsConnectionsActive,
      trpcOpenedLastMinute: snapshot.trpcOpenedLastMinute,
      trpcClosedLastMinute: snapshot.trpcClosedLastMinute,
      yjsOpenedLastMinute: snapshot.yjsOpenedLastMinute,
      yjsClosedLastMinute: snapshot.yjsClosedLastMinute,
      rejectsLastMinute,
      rateLimitedMessagesLastMinute,
      lastSuccessfulReadAt: new Date(nowMs).toISOString(),
      yjsConfiguredAlive: yjsConfigured,
    };
  }

  try {
    const payloads = await readFreshInstancePayloads(nowMs);
    if (!payloads) {
      return {
        available: false,
        trpcOpen: 0,
        yjsOpen: 0,
        trpcOpenedLastMinute: 0,
        trpcClosedLastMinute: 0,
        yjsOpenedLastMinute: 0,
        yjsClosedLastMinute: 0,
        rejectsLastMinute: 0,
        rateLimitedMessagesLastMinute: 0,
        lastSuccessfulReadAt: null,
        yjsConfiguredAlive: false,
      };
    }

    let trpcOpen = 0;
    let yjsOpen = 0;
    let trpcOpenedLastMinute = 0;
    let trpcClosedLastMinute = 0;
    let yjsOpenedLastMinute = 0;
    let yjsClosedLastMinute = 0;
    let rejectsLastMinute = 0;
    let rateLimitedMessagesLastMinute = 0;
    let yjsConfiguredAlive = false;

    for (const parsed of payloads) {
      trpcOpen += Number(parsed.trpcOpen) || 0;
      yjsOpen += Number(parsed.yjsOpen) || 0;
      trpcOpenedLastMinute += Number(parsed.trpcOpenedLastMinute) || 0;
      trpcClosedLastMinute += Number(parsed.trpcClosedLastMinute) || 0;
      yjsOpenedLastMinute += Number(parsed.yjsOpenedLastMinute) || 0;
      yjsClosedLastMinute += Number(parsed.yjsClosedLastMinute) || 0;
      rejectsLastMinute += Number(parsed.rejectsLastMinute) || 0;
      rateLimitedMessagesLastMinute += Number(parsed.rateLimitedMessagesLastMinute) || 0;
      if (parsed.yjsConfigured === true) {
        yjsConfiguredAlive = true;
      }
    }

    return {
      available: true,
      trpcOpen,
      yjsOpen,
      trpcOpenedLastMinute,
      trpcClosedLastMinute,
      yjsOpenedLastMinute,
      yjsClosedLastMinute,
      rejectsLastMinute,
      rateLimitedMessagesLastMinute,
      lastSuccessfulReadAt: new Date(nowMs).toISOString(),
      yjsConfiguredAlive,
    };
  } catch (error) {
    if (!readClusterWarned) {
      readClusterWarned = true;
      logger.warn(
        'websocketTelemetry.readCluster: Redis nicht erreichbar, Live-Verbindungen unavailable.',
        error,
      );
    }
    return {
      available: false,
      trpcOpen: 0,
      yjsOpen: 0,
      trpcOpenedLastMinute: 0,
      trpcClosedLastMinute: 0,
      yjsOpenedLastMinute: 0,
      yjsClosedLastMinute: 0,
      rejectsLastMinute: 0,
      rateLimitedMessagesLastMinute: 0,
      lastSuccessfulReadAt: null,
      yjsConfiguredAlive: false,
    };
  }
}

/**
 * Aggregiert den vollständigen WebSocket-Telemetrie-Snapshot über alle aktiven
 * App- und Relay-Instanzen in Redis für `health.securityStats`.
 * Fällt bei Redis-Ausfall kontrolliert auf den prozesslokalen Snapshot zurück.
 */
export async function readClusterWebSocketTelemetrySnapshot(
  nowMs: number = Date.now(),
): Promise<WebSocketTelemetrySnapshot> {
  const local = getWebSocketTelemetrySnapshot();
  if (process.env['NODE_ENV'] === 'test') {
    return local;
  }

  try {
    const payloads = await readFreshInstancePayloads(nowMs);
    if (!payloads) return local;

    const yjsRejectedByReason = Object.fromEntries(
      YJS_UPGRADE_REJECTION_REASONS.map((reason) => [reason, 0]),
    ) as Record<YjsUpgradeRejectionReason, number>;

    let trpcConnectionsSum = 0;
    let trpcBoundSum = 0;
    let trpcConnectionLimitSum = 0;
    let trpcClusterLimitMin: number | null = null;
    let trpcSessionLimitMax = 0;
    let trpcParticipantLimitMax = 0;
    let sawTrpcConfigured = false;
    let trpcSessionCapRejectedSum = 0;
    let trpcParticipantCapRejectedSum = 0;
    let trpcRejectedUpgradesSum = 0;
    let trpcPayloadRejectedSum = 0;
    let trpcRateLimitedMessagesSum = 0;
    let trpcOpenedSum = 0;
    let trpcClosedSum = 0;

    let yjsConnectionsSum = 0;
    let yjsRoomsSum = 0;
    let yjsConnectionLimitSum = 0;
    let yjsPerRoomLimitMax = 0;
    let sawYjsConfigured = false;
    let yjsRejectedUpgradesSum = 0;
    let yjsPayloadRejectedSum = 0;
    let yjsRateLimitedMessagesSum = 0;
    let yjsProtocolErrorsSum = 0;
    let yjsDocumentRejectedSum = 0;
    let yjsAwarenessRejectedSum = 0;
    let yjsOutboundRejectedSum = 0;
    let yjsOpenedSum = 0;
    let yjsClosedSum = 0;

    for (const entry of payloads) {
      const snap = entry.snapshot;
      trpcConnectionsSum += Number(snap?.trpcConnectionsActive ?? entry.trpcOpen) || 0;
      trpcBoundSum += Number(snap?.trpcBoundConnectionsActive) || 0;
      trpcSessionCapRejectedSum += Number(snap?.trpcSessionCapRejectedLastMinute) || 0;
      trpcParticipantCapRejectedSum += Number(snap?.trpcParticipantCapRejectedLastMinute) || 0;
      trpcRejectedUpgradesSum += Number(snap?.trpcRejectedUpgradesLastMinute) || 0;
      trpcPayloadRejectedSum += Number(snap?.trpcPayloadRejectedLastMinute) || 0;
      trpcRateLimitedMessagesSum += Number(snap?.trpcRateLimitedMessagesLastMinute) || 0;
      trpcOpenedSum += Number(snap?.trpcOpenedLastMinute ?? entry.trpcOpenedLastMinute) || 0;
      trpcClosedSum += Number(snap?.trpcClosedLastMinute ?? entry.trpcClosedLastMinute) || 0;

      if (entry.trpcConfigured ?? (Number(snap?.trpcConnectionLimit) || 0) > 1) {
        sawTrpcConfigured = true;
        trpcConnectionLimitSum += Math.max(1, Number(snap?.trpcConnectionLimit) || 1);
        trpcSessionLimitMax = Math.max(
          trpcSessionLimitMax,
          Math.max(1, Number(snap?.trpcSessionConnectionLimit) || 1),
        );
        trpcParticipantLimitMax = Math.max(
          trpcParticipantLimitMax,
          Math.max(1, Number(snap?.trpcParticipantConnectionLimit) || 1),
        );
        const clusterLimit = Number(entry.trpcClusterConnectionLimit);
        if (Number.isFinite(clusterLimit) && clusterLimit > 0) {
          trpcClusterLimitMin =
            trpcClusterLimitMin === null
              ? clusterLimit
              : Math.min(trpcClusterLimitMin, clusterLimit);
        }
      }

      yjsConnectionsSum += Number(snap?.yjsConnectionsActive ?? entry.yjsOpen) || 0;
      yjsRoomsSum += Number(snap?.yjsRoomsActive) || 0;
      yjsRejectedUpgradesSum += Number(snap?.yjsRejectedUpgradesLastMinute) || 0;
      for (const reason of YJS_UPGRADE_REJECTION_REASONS) {
        yjsRejectedByReason[reason] +=
          Number(snap?.yjsRejectedUpgradesByReasonLastMinute?.[reason]) || 0;
      }
      yjsPayloadRejectedSum += Number(snap?.yjsPayloadRejectedLastMinute) || 0;
      yjsRateLimitedMessagesSum += Number(snap?.yjsRateLimitedMessagesLastMinute) || 0;
      yjsProtocolErrorsSum += Number(snap?.yjsProtocolErrorsLastMinute) || 0;
      yjsDocumentRejectedSum += Number(snap?.yjsDocumentRejectedLastMinute) || 0;
      yjsAwarenessRejectedSum += Number(snap?.yjsAwarenessRejectedLastMinute) || 0;
      yjsOutboundRejectedSum += Number(snap?.yjsOutboundRejectedLastMinute) || 0;
      yjsOpenedSum += Number(snap?.yjsOpenedLastMinute ?? entry.yjsOpenedLastMinute) || 0;
      yjsClosedSum += Number(snap?.yjsClosedLastMinute ?? entry.yjsClosedLastMinute) || 0;

      if (entry.yjsConfigured ?? (Number(snap?.yjsConnectionLimit) || 0) > 1) {
        sawYjsConfigured = true;
        yjsConnectionLimitSum += Math.max(1, Number(snap?.yjsConnectionLimit) || 1);
        yjsPerRoomLimitMax = Math.max(
          yjsPerRoomLimitMax,
          Math.max(1, Number(snap?.yjsPerRoomConnectionLimit) || 1),
        );
      }
    }

    const effectiveTrpcLimit = sawTrpcConfigured
      ? trpcClusterLimitMin !== null
        ? Math.max(1, Math.min(trpcConnectionLimitSum, trpcClusterLimitMin))
        : Math.max(1, trpcConnectionLimitSum)
      : Math.max(1, local.trpcConnectionLimit);

    return {
      trpcConnectionsActive: trpcConnectionsSum,
      trpcConnectionLimit: effectiveTrpcLimit,
      trpcBoundConnectionsActive: trpcBoundSum,
      trpcSessionConnectionLimit: sawTrpcConfigured
        ? Math.max(1, trpcSessionLimitMax)
        : Math.max(1, local.trpcSessionConnectionLimit),
      trpcParticipantConnectionLimit: sawTrpcConfigured
        ? Math.max(1, trpcParticipantLimitMax)
        : Math.max(1, local.trpcParticipantConnectionLimit),
      trpcSessionCapRejectedLastMinute: trpcSessionCapRejectedSum,
      trpcParticipantCapRejectedLastMinute: trpcParticipantCapRejectedSum,
      trpcRejectedUpgradesLastMinute: trpcRejectedUpgradesSum,
      trpcPayloadRejectedLastMinute: trpcPayloadRejectedSum,
      trpcRateLimitedMessagesLastMinute: trpcRateLimitedMessagesSum,
      trpcOpenedLastMinute: trpcOpenedSum,
      trpcClosedLastMinute: trpcClosedSum,
      yjsConnectionsActive: yjsConnectionsSum,
      yjsRoomsActive: yjsRoomsSum,
      yjsConnectionLimit: sawYjsConfigured
        ? Math.max(1, yjsConnectionLimitSum)
        : Math.max(1, local.yjsConnectionLimit),
      yjsPerRoomConnectionLimit: sawYjsConfigured
        ? Math.max(1, yjsPerRoomLimitMax)
        : Math.max(1, local.yjsPerRoomConnectionLimit),
      yjsRejectedUpgradesLastMinute: yjsRejectedUpgradesSum,
      yjsRejectedUpgradesByReasonLastMinute: yjsRejectedByReason,
      yjsPayloadRejectedLastMinute: yjsPayloadRejectedSum,
      yjsRateLimitedMessagesLastMinute: yjsRateLimitedMessagesSum,
      yjsProtocolErrorsLastMinute: yjsProtocolErrorsSum,
      yjsDocumentRejectedLastMinute: yjsDocumentRejectedSum,
      yjsAwarenessRejectedLastMinute: yjsAwarenessRejectedSum,
      yjsOutboundRejectedLastMinute: yjsOutboundRejectedSum,
      yjsOpenedLastMinute: yjsOpenedSum,
      yjsClosedLastMinute: yjsClosedSum,
    };
  } catch (error) {
    if (!readClusterWarned) {
      readClusterWarned = true;
      logger.warn(
        'websocketTelemetry.readClusterSnapshot: Redis nicht erreichbar, nutze lokalen Snapshot.',
        error,
      );
    }
    return local;
  }
}

export function resetWebSocketTelemetryForTests(): void {
  trpcConnectionsActive = 0;
  trpcConnectionLimit = 1;
  trpcClusterConnectionLimit = null;
  trpcConfigured = false;
  trpcBoundConnectionsActive = 0;
  trpcSessionConnectionLimit = 1;
  trpcParticipantConnectionLimit = 1;
  trpcRejectedUpgrades.reset();
  trpcPayloadRejected.reset();
  trpcRateLimitedMessages.reset();
  trpcSessionCapRejected.reset();
  trpcParticipantCapRejected.reset();
  trpcOpened.reset();
  trpcClosed.reset();
  yjsOpened.reset();
  yjsClosed.reset();
  yjsConnectionsActive = 0;
  yjsConnectionLimit = 1;
  yjsPerRoomConnectionLimit = 1;
  yjsConfigured = false;
  yjsRoomConnections.clear();
  yjsRejectedUpgrades.reset();
  for (const counter of Object.values(yjsRejectedUpgradesByReason)) counter.reset();
  yjsPayloadRejected.reset();
  yjsRateLimitedMessages.reset();
  yjsProtocolErrors.reset();
  yjsDocumentRejected.reset();
  yjsAwarenessRejected.reset();
  yjsOutboundRejected.reset();
  if (publishTimer) {
    clearInterval(publishTimer);
    publishTimer = null;
  }
  publishWarned = false;
  readClusterWarned = false;
}
