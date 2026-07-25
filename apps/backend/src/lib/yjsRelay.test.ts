import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WebSocket, { type RawData } from 'ws';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import {
  DEFAULT_YJS_RELAY_LIMITS,
  resolveYjsRelayConfig,
  YjsRelayServer,
  type YjsRelayConfig,
} from './yjsRelay';
import {
  getWebSocketTelemetrySnapshot,
  resetWebSocketTelemetryForTests,
} from './websocketTelemetry';

const ROOM_A = 'quiz-library-room-6a8edced-5f8f-4cfa-9176-454fac9570ad';
const ROOM_B = 'quiz-library-room-7b9fedde-6a90-4dfb-a287-565bda0681be';
const servers: YjsRelayServer[] = [];
const sockets: WebSocket[] = [];

beforeEach(() => {
  resetWebSocketTelemetryForTests();
});

afterEach(async () => {
  vi.restoreAllMocks();
  for (const socket of sockets.splice(0)) socket.terminate();
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

function testConfig(overrides: Partial<YjsRelayConfig> = {}): YjsRelayConfig {
  return {
    host: '127.0.0.1',
    port: 0,
    ...DEFAULT_YJS_RELAY_LIMITS,
    ...overrides,
  };
}

async function startRelay(overrides: Partial<YjsRelayConfig> = {}): Promise<string> {
  const server = new YjsRelayServer(testConfig(overrides));
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(resolve));
  const address = server.address() as AddressInfo;
  return `ws://127.0.0.1:${address.port}`;
}

function connect(url: string): Promise<WebSocket> {
  const socket = new WebSocket(url);
  sockets.push(socket);
  return new Promise((resolve, reject) => {
    socket.once('open', () => resolve(socket));
    socket.once('error', reject);
  });
}

async function connectAfterInitialSync(url: string): Promise<WebSocket> {
  const socket = new WebSocket(url);
  sockets.push(socket);
  await Promise.all([
    new Promise<void>((resolve, reject) => {
      socket.once('open', () => resolve());
      socket.once('error', reject);
    }),
    new Promise<void>((resolve) => socket.once('message', () => resolve())),
  ]);
  return socket;
}

function validPaddedSyncStep1(size: number): Buffer {
  const frame = Buffer.alloc(size, 0);
  // y-websocket messageSync, y-protocols messageYjsSyncStep1,
  // varUint8Array length 1, leerer Yjs-State-Vector.
  frame.set([0, 0, 1, 0]);
  return frame;
}

function encodeVarUint(value: number): number[] {
  const bytes: number[] = [];
  let remaining = value;
  do {
    let byte = remaining & 0x7f;
    remaining = Math.floor(remaining / 128);
    if (remaining > 0) byte |= 0x80;
    bytes.push(byte);
  } while (remaining > 0);
  return bytes;
}

function yjsUpdateFrame(doc: Y.Doc): Buffer {
  const update = Y.encodeStateAsUpdate(doc);
  return Buffer.from([0, 2, ...encodeVarUint(update.byteLength), ...update]);
}

function awarenessFrame(
  entries: Array<{ clientId: number; clock?: number; state: unknown }>,
): Buffer {
  const update: number[] = [...encodeVarUint(entries.length)];
  for (const entry of entries) {
    const state = Buffer.from(JSON.stringify(entry.state));
    update.push(
      ...encodeVarUint(entry.clientId),
      ...encodeVarUint(entry.clock ?? 1),
      ...encodeVarUint(state.byteLength),
      ...state,
    );
  }
  return Buffer.from([1, ...encodeVarUint(update.length), ...update]);
}

function createLibraryDoc(payloadBytes: number, id = 'library-boundary'): Y.Doc {
  const doc = new Y.Doc();
  doc.getMap('quiz-library').set(
    'quizzes',
    JSON.stringify([
      {
        id,
        name: 'Große Quiz-Sammlung',
        description: 'x'.repeat(payloadBytes),
        questions: [],
      },
    ]),
  );
  return doc;
}

async function waitForCondition(predicate: () => boolean, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  expect(predicate()).toBe(true);
}

function decodeVarUint(bytes: Uint8Array, cursor: { offset: number }): number {
  let value = 0;
  let multiplier = 1;
  while (true) {
    const byte = bytes[cursor.offset++];
    if (byte === undefined) throw new Error('Unvollständiger Test-VarUint');
    value += (byte & 0x7f) * multiplier;
    if (byte < 0x80) return value;
    multiplier *= 128;
  }
}

function applySyncResponse(doc: Y.Doc, data: RawData): void {
  const bytes = Array.isArray(data)
    ? Buffer.concat(data)
    : data instanceof ArrayBuffer
      ? new Uint8Array(data)
      : data;
  const cursor = { offset: 0 };
  expect(decodeVarUint(bytes, cursor)).toBe(0);
  expect(decodeVarUint(bytes, cursor)).toBe(1);
  const length = decodeVarUint(bytes, cursor);
  Y.applyUpdate(doc, bytes.subarray(cursor.offset, cursor.offset + length));
}

function expectUpgradeRejected(url: string, status: number): Promise<void> {
  const socket = new WebSocket(url);
  sockets.push(socket);
  return new Promise((resolve, reject) => {
    socket.once('unexpected-response', (_request, response) => {
      try {
        expect(response.statusCode).toBe(status);
        response.resume();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
    socket.once('open', () => reject(new Error('Upgrade wurde unerwartet akzeptiert')));
    socket.once('error', (error) => {
      if (!String(error.message).includes(`Unexpected server response: ${status}`)) reject(error);
    });
  });
}

describe('resolveYjsRelayConfig', () => {
  it('nutzt großzügige Defaults und lässt Env nur bis zu statischen Maxima anheben', () => {
    expect(resolveYjsRelayConfig({})).toMatchObject(DEFAULT_YJS_RELAY_LIMITS);
    expect(
      resolveYjsRelayConfig({
        YJS_WS_MAX_CONNECTIONS: '999999',
        YJS_WS_MAX_CONNECTIONS_PER_ROOM: '999999',
        YJS_WS_MAX_UPGRADES_PER_MINUTE: '999999',
        YJS_WS_MAX_UPGRADES_PER_ROOM_PER_MINUTE: '999999',
        YJS_WS_MAX_PAYLOAD_BYTES: '9999999999',
        YJS_WS_MAX_MESSAGES_PER_10_SECONDS: '999999',
        YJS_WS_MAX_BYTES_PER_10_SECONDS: '9999999999',
        YJS_WS_MAX_MESSAGES_PER_ROOM_PER_10_SECONDS: '999999',
        YJS_WS_MAX_BYTES_PER_ROOM_PER_10_SECONDS: '9999999999',
        YJS_WS_MAX_MESSAGES_GLOBAL_PER_10_SECONDS: '999999',
        YJS_WS_MAX_BYTES_GLOBAL_PER_10_SECONDS: '9999999999',
        YJS_WS_MAX_DOCUMENT_BYTES_PER_ROOM: '9999999999',
        YJS_WS_MAX_DOCUMENT_BYTES_GLOBAL: '9999999999',
        YJS_WS_MAX_AWARENESS_STATE_BYTES: '9999999999',
        YJS_WS_MAX_OUTBOUND_BYTES_PER_10_SECONDS: '9999999999',
        YJS_WS_MAX_OUTBOUND_BYTES_PER_ROOM_PER_10_SECONDS: '9999999999',
        YJS_WS_MAX_OUTBOUND_BYTES_GLOBAL_PER_10_SECONDS: '9999999999',
      }),
    ).toMatchObject({
      maxConnections: 2_000,
      maxConnectionsPerRoom: 500,
      maxUpgradesPerMinute: 6_000,
      maxUpgradesPerRoomPerMinute: 1_200,
      maxPayloadBytes: 32 * 1024 * 1024,
      maxMessagesPerWindow: 1_200,
      maxBytesPerWindow: 64 * 1024 * 1024,
      maxMessagesPerRoomPerWindow: 12_000,
      maxBytesPerRoomPerWindow: 512 * 1024 * 1024,
      maxMessagesGlobalPerWindow: 60_000,
      maxBytesGlobalPerWindow: 2_048 * 1024 * 1024,
      maxDocumentBytesPerRoom: 30 * 1024 * 1024,
      maxDocumentBytesGlobal: 512 * 1024 * 1024,
      maxAwarenessStateBytes: 16 * 1024,
      maxOutboundBytesPerWindow: 64 * 1024 * 1024,
      maxOutboundBytesPerRoomPerWindow: 512 * 1024 * 1024,
      maxOutboundBytesGlobalPerWindow: 2_048 * 1024 * 1024,
    });
  });
});

describe('YjsRelayServer', () => {
  it('akzeptiert ausschließlich quiz-library-room-UUID-Pfade', async () => {
    const baseUrl = await startRelay();

    await expectUpgradeRejected(`${baseUrl}/arbitrary-room`, 400);
    await expectUpgradeRejected(`${baseUrl}/${ROOM_A}?token=ignored`, 400);
    const accepted = await connect(`${baseUrl}/${ROOM_A}`);

    expect(accepted.readyState).toBe(WebSocket.OPEN);
  });

  it('begrenzt Verbindungen global und pro Raum ohne IP-Buckets', async () => {
    const baseUrl = await startRelay({ maxConnections: 2, maxConnectionsPerRoom: 1 });
    await connect(`${baseUrl}/${ROOM_A}`);

    await expectUpgradeRejected(`${baseUrl}/${ROOM_A}`, 503);
    await connect(`${baseUrl}/${ROOM_B}`);
    await expectUpgradeRejected(
      `${baseUrl}/quiz-library-room-8cafeeee-7ba1-4efc-b398-676ceb1792cf`,
      503,
    );
  });

  it('hält zwei echte Provider trotz Peer-Awareness-Rebroadcast verbunden', async () => {
    const baseUrl = await startRelay({ maxAwarenessStateBytes: 512 });
    const firstDoc = new Y.Doc();
    const secondDoc = new Y.Doc();
    const WebSocketPolyfill = WebSocket as unknown as typeof globalThis.WebSocket;
    const first = new WebsocketProvider(baseUrl, ROOM_A, firstDoc, {
      WebSocketPolyfill,
      connect: false,
    });
    const second = new WebsocketProvider(baseUrl, ROOM_A, secondDoc, {
      WebSocketPolyfill,
      connect: false,
    });
    try {
      first.awareness.setLocalStateField('syncClient', { deviceId: 'device-a' });
      second.awareness.setLocalStateField('syncClient', { deviceId: 'device-b' });
      first.connect();
      second.connect();

      await waitForCondition(
        () =>
          first.wsconnected &&
          second.wsconnected &&
          first.awareness.getStates().size === 2 &&
          second.awareness.getStates().size === 2,
      );
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(first.wsconnected).toBe(true);
      expect(second.wsconnected).toBe(true);
      expect(getWebSocketTelemetrySnapshot().yjsAwarenessRejectedLastMinute).toBe(0);

      // Peer-Disconnect sendet Null-State-Removals; der verbleibende Provider
      // muss verbunden bleiben (kein Awareness-Reject wegen verwaister IDs).
      first.destroy();
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(second.wsconnected).toBe(true);
      expect(getWebSocketTelemetrySnapshot().yjsAwarenessRejectedLastMinute).toBe(0);
    } finally {
      second.destroy();
      firstDoc.destroy();
      secondDoc.destroy();
    }
  });

  it('behandelt JSON-null Awareness-Removals fremder IDs nicht als Ownership', async () => {
    const baseUrl = await startRelay();
    const socket = await connectAfterInitialSync(`${baseUrl}/${ROOM_A}`);
    // awarenessFrame codiert state:null als JSON.stringify(null) → 4 Bytes.
    expect(Buffer.byteLength(JSON.stringify(null), 'utf8')).toBe(4);

    socket.send(awarenessFrame([{ clientId: 100, state: { syncClient: {} } }]));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(socket.readyState).toBe(WebSocket.OPEN);

    // Provider-Rebroadcast nach Peer-Disconnect: fremde ID mit Null-State.
    socket.send(awarenessFrame([{ clientId: 999, clock: 2, state: null }]));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(socket.readyState).toBe(WebSocket.OPEN);
    expect(getWebSocketTelemetrySnapshot().yjsAwarenessRejectedLastMinute).toBe(0);
  });

  it('verhindert persistentes Wachstum durch wechselnde Awareness-IDs', async () => {
    const baseUrl = await startRelay();
    const socket = await connectAfterInitialSync(`${baseUrl}/${ROOM_A}`);
    const closed = new Promise<number>((resolve) => socket.once('close', (code) => resolve(code)));
    socket.send(awarenessFrame([{ clientId: 100, state: { syncClient: {} } }]));
    socket.send(awarenessFrame([{ clientId: 101, clock: 2, state: { syncClient: {} } }]));

    await expect(closed).resolves.toBe(1006);
    expect(getWebSocketTelemetrySnapshot().yjsAwarenessRejectedLastMinute).toBe(1);
  });

  it('verwirft Awareness-States oberhalb des persistenten Bytecaps', async () => {
    const baseUrl = await startRelay({ maxAwarenessStateBytes: 128 });
    const socket = await connectAfterInitialSync(`${baseUrl}/${ROOM_A}`);
    const closed = new Promise<number>((resolve) => socket.once('close', (code) => resolve(code)));
    socket.send(
      awarenessFrame([
        {
          clientId: 200,
          state: { syncClient: {}, padding: 'x'.repeat(256) },
        },
      ]),
    );

    await expect(closed).resolves.toBe(1006);
    expect(getWebSocketTelemetrySnapshot().yjsAwarenessRejectedLastMinute).toBe(1);
  });

  it('verwirft zu viele Awareness-Einträge vor unbeschränkter Allokation', async () => {
    const baseUrl = await startRelay({ maxConnectionsPerRoom: 2 });
    const socket = await connectAfterInitialSync(`${baseUrl}/${ROOM_A}`);
    const closed = new Promise<number>((resolve) => socket.once('close', (code) => resolve(code)));
    socket.send(
      awarenessFrame([
        { clientId: 300, state: null },
        { clientId: 300, clock: 2, state: null },
        { clientId: 300, clock: 3, state: null },
      ]),
    );

    await expect(closed).resolves.toBe(1006);
    expect(getWebSocketTelemetrySnapshot().yjsAwarenessRejectedLastMinute).toBe(1);
  });

  it('begrenzt Upgrade-Versuche global ohne IP-Limit', async () => {
    const baseUrl = await startRelay({ maxUpgradesPerMinute: 1 });

    await expectUpgradeRejected(`${baseUrl}/invalid`, 400);
    await expectUpgradeRejected(`${baseUrl}/${ROOM_A}`, 429);
  });

  it('terminiert Verbindungen vor Verarbeitung der Nachricht über dem Rate-Limit', async () => {
    const baseUrl = await startRelay({ maxMessagesPerWindow: 1 });
    const socket = await connect(`${baseUrl}/${ROOM_A}`);
    const closed = new Promise<number>((resolve) => socket.once('close', resolve));

    socket.send(validPaddedSyncStep1(4));
    socket.send(validPaddedSyncStep1(4));

    await expect(closed).resolves.toBe(1006);
  });

  it('begrenzt viele kleine Frames zusätzlich global über Räume hinweg', async () => {
    const baseUrl = await startRelay({ maxMessagesGlobalPerWindow: 3 });
    const socketA = await connect(`${baseUrl}/${ROOM_A}`);
    const socketB = await connect(`${baseUrl}/${ROOM_B}`);
    const closed = new Promise<number>((resolve) => socketB.once('close', resolve));

    socketA.send(validPaddedSyncStep1(4));
    socketA.send(validPaddedSyncStep1(4));
    socketB.send(validPaddedSyncStep1(4));
    socketB.send(validPaddedSyncStep1(4));

    await expect(closed).resolves.toBe(1006);
  });

  it('teilt das Nachrichtenbudget zwischen Verbindungen desselben Raums', async () => {
    const baseUrl = await startRelay({ maxMessagesPerRoomPerWindow: 2 });
    const socketA = await connect(`${baseUrl}/${ROOM_A}`);
    const socketB = await connect(`${baseUrl}/${ROOM_A}`);
    const closed = new Promise<number>((resolve) => socketB.once('close', resolve));

    socketA.send(validPaddedSyncStep1(4));
    socketB.send(validPaddedSyncStep1(4));
    socketB.send(validPaddedSyncStep1(4));

    await expect(closed).resolves.toBe(1006);
  });

  it('begrenzt wiederholte große Frames anhand des Bytebudgets vor dem Parser', async () => {
    const baseUrl = await startRelay({ maxBytesPerWindow: 100 });
    const socket = await connect(`${baseUrl}/${ROOM_A}`);
    const closed = new Promise<number>((resolve) => socket.once('close', resolve));
    const validLargeSyncStep1 = validPaddedSyncStep1(60);

    socket.send(validLargeSyncStep1);
    socket.send(validLargeSyncStep1);

    await expect(closed).resolves.toBe(1006);
  });

  it('teilt das Bytebudget global zwischen unterschiedlichen Räumen', async () => {
    const baseUrl = await startRelay({ maxBytesGlobalPerWindow: 100 });
    const socketA = await connect(`${baseUrl}/${ROOM_A}`);
    const socketB = await connect(`${baseUrl}/${ROOM_B}`);
    const closed = new Promise<number>((resolve) => socketB.once('close', resolve));
    const validLargeSyncStep1 = validPaddedSyncStep1(60);

    socketA.send(validLargeSyncStep1);
    socketB.send(validLargeSyncStep1);

    await expect(closed).resolves.toBe(1006);
  });

  it('unterdrückt ungefilterte Parserlogs und terminiert ungültige Yjs-Frames', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const baseUrl = await startRelay();
    const socket = await connect(`${baseUrl}/${ROOM_A}`);
    const closed = new Promise<number>((resolve) => socket.once('close', resolve));

    // Bekannter Sync-Typ ohne erforderlichen Subtyp löst den Paketparser aus.
    socket.send(Buffer.from([0]));

    await expect(closed).resolves.toBe(1006);
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('synchronisiert eine echte Sammlung knapp unter dem Dokumentlimit beim Reconnect', async () => {
    const documentLimit = 64 * 1024;
    const baseUrl = await startRelay({
      maxPayloadBytes: 64 * 1024,
      maxDocumentBytesPerRoom: documentLimit,
      maxDocumentBytesGlobal: documentLimit * 4,
      maxBytesPerWindow: 256 * 1024,
      maxOutboundBytesPerWindow: 256 * 1024,
      maxOutboundBytesPerRoomPerWindow: 512 * 1024,
    });
    const sourceDoc = createLibraryDoc(60 * 1024);
    expect(yjsUpdateFrame(sourceDoc).byteLength).toBeLessThan(64 * 1024);
    const source = await connectAfterInitialSync(`${baseUrl}/${ROOM_A}`);
    const sourceBroadcast = new Promise<void>((resolve) => source.once('message', () => resolve()));
    source.send(yjsUpdateFrame(sourceDoc));
    await sourceBroadcast;

    const reconnect = await connectAfterInitialSync(`${baseUrl}/${ROOM_A}`);
    const syncResponse = new Promise<RawData>((resolve) => reconnect.once('message', resolve));
    reconnect.send(validPaddedSyncStep1(4));
    const reconnectDoc = new Y.Doc();
    applySyncResponse(reconnectDoc, await syncResponse);

    expect(reconnectDoc.getMap('quiz-library').get('quizzes')).toBe(
      sourceDoc.getMap('quiz-library').get('quizzes'),
    );
    sourceDoc.destroy();
    reconnectDoc.destroy();
  });

  it('verwirft eine echte Sammlung oberhalb des Dokumentlimits vor Zustandsänderung', async () => {
    const documentLimit = 64 * 1024;
    const baseUrl = await startRelay({
      maxPayloadBytes: 128 * 1024,
      maxDocumentBytesPerRoom: documentLimit,
      maxDocumentBytesGlobal: documentLimit * 4,
      maxBytesPerWindow: 256 * 1024,
    });
    const oversizedDoc = createLibraryDoc(70 * 1024);
    const socket = await connectAfterInitialSync(`${baseUrl}/${ROOM_A}`);
    const closed = new Promise<number>((resolve) => socket.once('close', resolve));

    socket.send(yjsUpdateFrame(oversizedDoc));

    await expect(closed).resolves.toBe(1006);
    oversizedDoc.destroy();
  });

  it('begrenzt wachsende Dokumente unabhängig von neuen Eingangszeitfenstern', async () => {
    let now = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const baseUrl = await startRelay({
      maxDocumentBytesPerRoom: 20 * 1024,
      maxDocumentBytesGlobal: 100 * 1024,
      maxPayloadBytes: 64 * 1024,
    });
    const sourceDoc = new Y.Doc();
    const socket = await connectAfterInitialSync(`${baseUrl}/${ROOM_A}`);

    for (let index = 0; index < 3; index += 1) {
      sourceDoc.getMap('quiz-library').set(`chunk-${index}`, 'x'.repeat(5 * 1024));
      const broadcast = new Promise<void>((resolve) => socket.once('message', () => resolve()));
      socket.send(yjsUpdateFrame(sourceDoc));
      await broadcast;
      now += 10_001;
    }

    sourceDoc.getMap('quiz-library').set('chunk-3', 'x'.repeat(5 * 1024));
    const closed = new Promise<number>((resolve) => socket.once('close', resolve));
    socket.send(yjsUpdateFrame(sourceDoc));

    await expect(closed).resolves.toBe(1006);
    sourceDoc.destroy();
  });

  it('begrenzt den Dokumentzustand global über viele neu erzeugte Räume', async () => {
    const baseUrl = await startRelay({
      maxDocumentBytesPerRoom: 64 * 1024,
      maxDocumentBytesGlobal: 90 * 1024,
      maxPayloadBytes: 128 * 1024,
    });
    const roomADoc = createLibraryDoc(50 * 1024, 'room-a');
    const roomBDoc = createLibraryDoc(50 * 1024, 'room-b');
    const socketA = await connectAfterInitialSync(`${baseUrl}/${ROOM_A}`);
    const accepted = new Promise<void>((resolve) => socketA.once('message', () => resolve()));
    socketA.send(yjsUpdateFrame(roomADoc));
    await accepted;

    const socketB = await connectAfterInitialSync(`${baseUrl}/${ROOM_B}`);
    const closed = new Promise<number>((resolve) => socketB.once('close', resolve));
    socketB.send(yjsUpdateFrame(roomBDoc));

    await expect(closed).resolves.toBe(1006);
    roomADoc.destroy();
    roomBDoc.destroy();
  });

  it('begrenzt tatsächlich versendete Sync-Bytes bei Reconnect-Verstärkung', async () => {
    const baseUrl = await startRelay({
      maxDocumentBytesPerRoom: 64 * 1024,
      maxDocumentBytesGlobal: 128 * 1024,
      maxOutboundBytesPerWindow: 64 * 1024,
      maxOutboundBytesPerRoomPerWindow: 30 * 1024,
      maxOutboundBytesGlobalPerWindow: 128 * 1024,
    });
    const sourceDoc = createLibraryDoc(20 * 1024);
    const source = await connectAfterInitialSync(`${baseUrl}/${ROOM_A}`);
    const accepted = new Promise<void>((resolve) => source.once('message', () => resolve()));
    source.send(yjsUpdateFrame(sourceDoc));
    await accepted;

    const reconnect = await connectAfterInitialSync(`${baseUrl}/${ROOM_A}`);
    const closed = new Promise<number>((resolve) => reconnect.once('close', resolve));
    reconnect.send(validPaddedSyncStep1(4));

    await expect(closed).resolves.toBe(1006);
    sourceDoc.destroy();
  });

  it('weist WebSocket-Frames über dem Transportlimit mit 1009 ab', async () => {
    const maxPayloadBytes = 64 * 1024;
    const baseUrl = await startRelay({ maxPayloadBytes });
    const rejected = await connect(`${baseUrl}/${ROOM_A}`);
    const closed = new Promise<number>((resolve) => rejected.once('close', resolve));

    rejected.send(Buffer.alloc(maxPayloadBytes + 1));

    await expect(closed).resolves.toBe(1009);
  });
});
