let trpcConnectionsActive = 0;
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
      if (bucket < oldestIncluded) this.buckets.delete(bucket);
    }
  }
}

const yjsRejectedUpgrades = new RollingCounter();
const yjsPayloadRejected = new RollingCounter();
const yjsRateLimitedMessages = new RollingCounter();
const yjsProtocolErrors = new RollingCounter();

export function recordTrpcWebSocketConnected(): void {
  trpcConnectionsActive += 1;
}

export function recordTrpcWebSocketDisconnected(): void {
  trpcConnectionsActive = Math.max(0, trpcConnectionsActive - 1);
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

export function recordYjsWebSocketRejectedUpgrade(): void {
  yjsRejectedUpgrades.increment();
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

export function getWebSocketTelemetrySnapshot(): {
  trpcConnectionsActive: number;
  yjsConnectionsActive: number;
  yjsRoomsActive: number;
  yjsConnectionLimit: number;
  yjsPerRoomConnectionLimit: number;
  yjsRejectedUpgradesLastMinute: number;
  yjsPayloadRejectedLastMinute: number;
  yjsRateLimitedMessagesLastMinute: number;
  yjsProtocolErrorsLastMinute: number;
} {
  return {
    trpcConnectionsActive,
    yjsConnectionsActive,
    yjsRoomsActive: yjsRoomConnections.size,
    yjsConnectionLimit,
    yjsPerRoomConnectionLimit,
    yjsRejectedUpgradesLastMinute: yjsRejectedUpgrades.sum(),
    yjsPayloadRejectedLastMinute: yjsPayloadRejected.sum(),
    yjsRateLimitedMessagesLastMinute: yjsRateLimitedMessages.sum(),
    yjsProtocolErrorsLastMinute: yjsProtocolErrors.sum(),
  };
}

export function resetWebSocketTelemetryForTests(): void {
  trpcConnectionsActive = 0;
  yjsConnectionsActive = 0;
  yjsConnectionLimit = 1;
  yjsPerRoomConnectionLimit = 1;
  yjsRoomConnections.clear();
  yjsRejectedUpgrades.reset();
  yjsPayloadRejected.reset();
  yjsRateLimitedMessages.reset();
  yjsProtocolErrors.reset();
}
