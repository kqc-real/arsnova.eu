import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import {
  DEFAULT_YJS_RELAY_LIMITS,
  resolveYjsRelayConfig,
  YjsRelayServer,
  type YjsRelayConfig,
} from './yjsRelay';

const ROOM_A = 'quiz-library-room-6a8edced-5f8f-4cfa-9176-454fac9570ad';
const ROOM_B = 'quiz-library-room-7b9fedde-6a90-4dfb-a287-565bda0681be';
const servers: YjsRelayServer[] = [];
const sockets: WebSocket[] = [];

afterEach(async () => {
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

function validPaddedSyncStep1(size: number): Buffer {
  const frame = Buffer.alloc(size, 0);
  // y-websocket messageSync, y-protocols messageYjsSyncStep1,
  // varUint8Array length 1, leerer Yjs-State-Vector.
  frame.set([0, 0, 1, 0]);
  return frame;
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

  it('akzeptiert Sammlungsframes am konfigurierten Limit und weist größere mit 1009 ab', async () => {
    const maxPayloadBytes = 64 * 1024;
    const baseUrl = await startRelay({
      maxPayloadBytes,
      maxBytesPerWindow: maxPayloadBytes * 2,
    });
    const accepted = await connect(`${baseUrl}/${ROOM_A}`);
    const response = new Promise<void>((resolve) => accepted.once('message', () => resolve()));
    const boundaryFrame = validPaddedSyncStep1(maxPayloadBytes);
    accepted.send(boundaryFrame);
    await expect(response).resolves.toBeUndefined();

    const rejected = await connect(`${baseUrl}/${ROOM_B}`);
    const closed = new Promise<number>((resolve) => rejected.once('close', resolve));

    rejected.send(Buffer.alloc(maxPayloadBytes + 1));

    await expect(closed).resolves.toBe(1009);
  });
});
