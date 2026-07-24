import { beforeEach, describe, expect, it } from 'vitest';
import {
  getWebSocketTelemetrySnapshot,
  recordTrpcWebSocketConnected,
  recordTrpcWebSocketDisconnected,
  resetWebSocketTelemetryForTests,
} from './websocketTelemetry';

describe('websocketTelemetry', () => {
  beforeEach(() => {
    resetWebSocketTelemetryForTests();
  });

  it('zählt aktive tRPC-WebSocket-Verbindungen', () => {
    recordTrpcWebSocketConnected();
    recordTrpcWebSocketConnected();
    recordTrpcWebSocketDisconnected();

    expect(getWebSocketTelemetrySnapshot()).toEqual({ trpcConnectionsActive: 1 });
  });

  it('fällt bei doppelten Close-Ereignissen nicht unter null', () => {
    recordTrpcWebSocketDisconnected();

    expect(getWebSocketTelemetrySnapshot()).toEqual({ trpcConnectionsActive: 0 });
  });
});
