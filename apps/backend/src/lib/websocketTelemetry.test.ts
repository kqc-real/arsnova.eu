import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configureTrpcWebSocketTelemetry,
  configureYjsWebSocketTelemetry,
  getWebSocketTelemetrySnapshot,
  recordTrpcWebSocketBindingConnected,
  recordTrpcWebSocketBindingDisconnected,
  recordTrpcWebSocketConnected,
  recordTrpcWebSocketDisconnected,
  recordTrpcWebSocketParticipantCapRejected,
  recordTrpcWebSocketPayloadRejected,
  recordTrpcWebSocketRateLimitedMessage,
  recordTrpcWebSocketRejectedUpgrade,
  recordTrpcWebSocketSessionCapRejected,
  recordYjsWebSocketAwarenessRejected,
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('zählt tRPC-WebSocket-Verbindungen, Cap und Ablehnungen', () => {
    configureTrpcWebSocketTelemetry({
      connectionLimit: 1_000,
      sessionConnectionLimit: 800,
      participantConnectionLimit: 2,
    });
    recordTrpcWebSocketConnected();
    recordTrpcWebSocketConnected();
    recordTrpcWebSocketDisconnected();
    recordTrpcWebSocketBindingConnected();
    recordTrpcWebSocketBindingDisconnected();
    recordTrpcWebSocketBindingConnected();
    recordTrpcWebSocketSessionCapRejected();
    recordTrpcWebSocketParticipantCapRejected();
    recordTrpcWebSocketRejectedUpgrade();
    recordTrpcWebSocketPayloadRejected();
    recordTrpcWebSocketRateLimitedMessage();

    expect(getWebSocketTelemetrySnapshot()).toMatchObject({
      trpcConnectionsActive: 1,
      trpcConnectionLimit: 1_000,
      trpcBoundConnectionsActive: 1,
      trpcSessionConnectionLimit: 800,
      trpcParticipantConnectionLimit: 2,
      trpcSessionCapRejectedLastMinute: 1,
      trpcParticipantCapRejectedLastMinute: 1,
      trpcRejectedUpgradesLastMinute: 1,
      trpcPayloadRejectedLastMinute: 1,
      trpcRateLimitedMessagesLastMinute: 1,
    });
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
    recordYjsWebSocketAwarenessRejected();
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
      yjsAwarenessRejectedLastMinute: 1,
      yjsOutboundRejectedLastMinute: 1,
    });
  });

  it('behält Ereignisse am Ende des ältesten Zehn-Sekunden-Buckets eine volle Minute', () => {
    let now = 9_999;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    recordYjsWebSocketProtocolError();

    now = 69_998;
    expect(getWebSocketTelemetrySnapshot().yjsProtocolErrorsLastMinute).toBe(1);

    now = 70_000;
    expect(getWebSocketTelemetrySnapshot().yjsProtocolErrorsLastMinute).toBe(0);
  });
});
