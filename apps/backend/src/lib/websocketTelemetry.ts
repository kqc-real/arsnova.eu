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
}

export function recordTrpcWebSocketDisconnected(): void {
  trpcConnectionsActive = Math.max(0, trpcConnectionsActive - 1);
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
  yjsRoomConnections.set(room, (yjsRoomConnections.get(room) ?? 0) + 1);
}

export function recordYjsWebSocketDisconnected(room: string): void {
  yjsConnectionsActive = Math.max(0, yjsConnectionsActive - 1);
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
  };
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
}
