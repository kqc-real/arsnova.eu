import { beforeEach, describe, expect, it } from 'vitest';
import {
  configureYjsWebSocketTelemetry,
  getWebSocketTelemetrySnapshot,
  recordTrpcWebSocketConnected,
  recordTrpcWebSocketDisconnected,
  recordYjsWebSocketConnected,
  recordYjsWebSocketDisconnected,
  recordYjsWebSocketDocumentRejected,
  recordYjsWebSocketOutboundRejected,
  recordYjsWebSocketPayloadRejected,
  recordYjsWebSocketProtocolError,
  recordYjsWebSocketRateLimitedMessage,
  recordYjsWebSocketRejectedUpgrade,
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

    expect(getWebSocketTelemetrySnapshot().trpcConnectionsActive).toBe(1);
  });

  it('fällt bei doppelten Close-Ereignissen nicht unter null', () => {
    recordTrpcWebSocketDisconnected();

    expect(getWebSocketTelemetrySnapshot().trpcConnectionsActive).toBe(0);
  });

  it('zählt Yjs-Verbindungen, Räume, Caps und Ablehnungen', () => {
    configureYjsWebSocketTelemetry({
      connectionLimit: 1_000,
      perRoomConnectionLimit: 100,
    });
    recordYjsWebSocketConnected('quiz-library-room-a');
    recordYjsWebSocketConnected('quiz-library-room-a');
    recordYjsWebSocketConnected('quiz-library-room-b');
    recordYjsWebSocketDisconnected('quiz-library-room-a');
    recordYjsWebSocketRejectedUpgrade();
    recordYjsWebSocketPayloadRejected();
    recordYjsWebSocketRateLimitedMessage();
    recordYjsWebSocketProtocolError();
    recordYjsWebSocketDocumentRejected();
    recordYjsWebSocketOutboundRejected();

    expect(getWebSocketTelemetrySnapshot()).toMatchObject({
      yjsConnectionsActive: 2,
      yjsRoomsActive: 2,
      yjsConnectionLimit: 1_000,
      yjsPerRoomConnectionLimit: 100,
      yjsRejectedUpgradesLastMinute: 1,
      yjsPayloadRejectedLastMinute: 1,
      yjsRateLimitedMessagesLastMinute: 1,
      yjsProtocolErrorsLastMinute: 1,
      yjsDocumentRejectedLastMinute: 1,
      yjsOutboundRejectedLastMinute: 1,
    });
  });
});
