let trpcConnectionsActive = 0;

export function recordTrpcWebSocketConnected(): void {
  trpcConnectionsActive += 1;
}

export function recordTrpcWebSocketDisconnected(): void {
  trpcConnectionsActive = Math.max(0, trpcConnectionsActive - 1);
}

export function getWebSocketTelemetrySnapshot(): { trpcConnectionsActive: number } {
  return { trpcConnectionsActive };
}

export function resetWebSocketTelemetryForTests(): void {
  trpcConnectionsActive = 0;
}
