import { randomUUID } from 'node:crypto';
import { getRedis } from '../redis';
import { logger } from './logger';

const INSTANCE_ID = randomUUID();
const WS_INSTANCE_KEY_PREFIX = 'ws:telemetry:instance:';
const WS_INSTANCE_TTL_SECONDS = 20;
const WS_PUBLISH_INTERVAL_MS = 5_000;

type ClusterLiveMetrics = {
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
};

let publishTimer: NodeJS.Timeout | null = null;
let publishWarned = false;
let readClusterWarned = false;

let trpcConnectionsActive = 0;
let trpcConnectionLimit = 1;
let trpcBoundConnectionsActive = 0;
let trpcSessionConnectionLimit = 1;
let trpcParticipantConnectionLimit = 1;
let yjsConnectionsActive = 0;
let yjsConnectionLimit = 1;
let yjsPerRoomConnectionLimit = 1;
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
  sessionConnectionLimit: number;
  participantConnectionLimit: number;
}): void {
  trpcConnectionLimit = limits.connectionLimit;
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

function localRejectsAndRateLimits(snapshot: ReturnType<typeof getWebSocketTelemetrySnapshot>): {
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
      updatedAt: Date.now(),
    });
    await getRedis().set(
      `${WS_INSTANCE_KEY_PREFIX}${INSTANCE_ID}`,
      payload,
      'EX',
      WS_INSTANCE_TTL_SECONDS,
    );
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
    await getRedis().del(`${WS_INSTANCE_KEY_PREFIX}${INSTANCE_ID}`);
  } catch {
    // Shutdown: best effort
  }
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
    };
  }

  try {
    const redis = getRedis();
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [next, batch] = await redis.scan(
        cursor,
        'MATCH',
        `${WS_INSTANCE_KEY_PREFIX}*`,
        'COUNT',
        64,
      );
      cursor = next;
      keys.push(...batch);
    } while (cursor !== '0');

    if (keys.length === 0) {
      // Mindestens den lokalen Snapshot publizieren und erneut lesen.
      await publishInstanceWebSocketTelemetry();
      const localKey = `${WS_INSTANCE_KEY_PREFIX}${INSTANCE_ID}`;
      const localRaw = await redis.get(localKey);
      if (!localRaw) {
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
        };
      }
      keys.push(localKey);
    }

    const values = await redis.mget(...keys);
    let trpcOpen = 0;
    let yjsOpen = 0;
    let trpcOpenedLastMinute = 0;
    let trpcClosedLastMinute = 0;
    let yjsOpenedLastMinute = 0;
    let yjsClosedLastMinute = 0;
    let rejectsLastMinute = 0;
    let rateLimitedMessagesLastMinute = 0;
    let sawAny = false;

    for (const raw of values) {
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as Partial<ClusterLiveMetrics> & { updatedAt?: number };
        if (
          typeof parsed.updatedAt === 'number' &&
          nowMs - parsed.updatedAt > WS_INSTANCE_TTL_SECONDS * 1000
        ) {
          continue;
        }
        sawAny = true;
        trpcOpen += Number(parsed.trpcOpen) || 0;
        yjsOpen += Number(parsed.yjsOpen) || 0;
        trpcOpenedLastMinute += Number(parsed.trpcOpenedLastMinute) || 0;
        trpcClosedLastMinute += Number(parsed.trpcClosedLastMinute) || 0;
        yjsOpenedLastMinute += Number(parsed.yjsOpenedLastMinute) || 0;
        yjsClosedLastMinute += Number(parsed.yjsClosedLastMinute) || 0;
        rejectsLastMinute += Number(parsed.rejectsLastMinute) || 0;
        rateLimitedMessagesLastMinute += Number(parsed.rateLimitedMessagesLastMinute) || 0;
      } catch {
        // Ungültigen Snapshot ignorieren
      }
    }

    if (!sawAny) {
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
      };
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
    };
  }
}

export function resetWebSocketTelemetryForTests(): void {
  trpcConnectionsActive = 0;
  trpcConnectionLimit = 1;
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
