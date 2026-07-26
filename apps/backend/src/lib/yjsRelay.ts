import { createServer, type IncomingMessage, type Server as HttpServer } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import { docs, setupWSConnection } from '@y/websocket-server/utils';
import * as Y from 'yjs';
import {
  configureYjsWebSocketTelemetry,
  recordYjsWebSocketAwarenessRejected,
  recordYjsWebSocketConnected,
  recordYjsWebSocketDisconnected,
  recordYjsWebSocketDocumentRejected,
  recordYjsWebSocketOutboundRejected,
  recordYjsWebSocketPayloadRejected,
  recordYjsWebSocketProtocolError,
  recordYjsWebSocketRateLimitedMessage,
  recordYjsWebSocketRejectedUpgrade,
} from './websocketTelemetry';
import { authorizeYjsRoomUpgrade, onYjsShareRotated, YJS_SHARE_QUERY_PARAM } from './yjsShareToken';
import { logger } from './logger';

const ROOM_PATH_PATTERN =
  /^\/quiz-library-room-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
const UPGRADE_WINDOW_MS = 60_000;
const MESSAGE_WINDOW_MS = 10_000;
const MIB = 1024 * 1024;
/** Obere Schranke für teure Exact-Compactions je Raum und 10-Sekunden-Fenster. */
const MAX_EXACT_COMPACTIONS_PER_ROOM_PER_WINDOW = 30;

/**
 * Persistentes Limit bekannter Awareness-IDs je Raum relativ zu maxConnectionsPerRoom.
 * Erlaubt Reconnect-Churn, verhindert aber unbegrenztes meta-Tombstone-Wachstum,
 * solange ein Peer den Raum offen hält.
 */
const KNOWN_AWARENESS_IDS_PER_CONNECTION_SLOT = 2;

type YjsRoomAwareness = {
  meta: Map<number, unknown>;
  states: Map<number, unknown>;
};

type YjsRoomDoc = {
  awareness?: YjsRoomAwareness;
};

export interface YjsRelayLimits {
  maxConnections: number;
  maxConnectionsPerRoom: number;
  maxUpgradesPerMinute: number;
  maxUpgradesPerRoomPerMinute: number;
  maxPayloadBytes: number;
  maxMessagesPerWindow: number;
  maxBytesPerWindow: number;
  maxMessagesPerRoomPerWindow: number;
  maxBytesPerRoomPerWindow: number;
  maxMessagesGlobalPerWindow: number;
  maxBytesGlobalPerWindow: number;
  maxDocumentBytesPerRoom: number;
  maxDocumentBytesGlobal: number;
  maxAwarenessStateBytes: number;
  maxOutboundBytesPerWindow: number;
  maxOutboundBytesPerRoomPerWindow: number;
  maxOutboundBytesGlobalPerWindow: number;
}

export interface YjsRelayConfig extends YjsRelayLimits {
  host: string;
  port: number;
}

const STATIC_LIMIT_MAXIMA: YjsRelayLimits = {
  maxConnections: 2_000,
  maxConnectionsPerRoom: 500,
  maxUpgradesPerMinute: 6_000,
  maxUpgradesPerRoomPerMinute: 1_200,
  maxPayloadBytes: 32 * MIB,
  maxMessagesPerWindow: 1_200,
  maxBytesPerWindow: 64 * MIB,
  maxMessagesPerRoomPerWindow: 12_000,
  maxBytesPerRoomPerWindow: 512 * MIB,
  maxMessagesGlobalPerWindow: 60_000,
  maxBytesGlobalPerWindow: 2_048 * MIB,
  maxDocumentBytesPerRoom: 30 * MIB,
  maxDocumentBytesGlobal: 512 * MIB,
  maxAwarenessStateBytes: 16 * 1024,
  maxOutboundBytesPerWindow: 64 * MIB,
  maxOutboundBytesPerRoomPerWindow: 512 * MIB,
  maxOutboundBytesGlobalPerWindow: 2_048 * MIB,
};

export const DEFAULT_YJS_RELAY_LIMITS: YjsRelayLimits = {
  maxConnections: 1_000,
  maxConnectionsPerRoom: 200,
  maxUpgradesPerMinute: 3_000,
  maxUpgradesPerRoomPerMinute: 600,
  maxPayloadBytes: 16 * MIB,
  maxMessagesPerWindow: 600,
  maxBytesPerWindow: 32 * MIB,
  maxMessagesPerRoomPerWindow: 6_000,
  maxBytesPerRoomPerWindow: 256 * MIB,
  maxMessagesGlobalPerWindow: 30_000,
  maxBytesGlobalPerWindow: 1_024 * MIB,
  maxDocumentBytesPerRoom: 15 * MIB,
  maxDocumentBytesGlobal: 256 * MIB,
  maxAwarenessStateBytes: 4 * 1024,
  maxOutboundBytesPerWindow: 32 * MIB,
  maxOutboundBytesPerRoomPerWindow: 256 * MIB,
  maxOutboundBytesGlobalPerWindow: 1_024 * MIB,
};

function readBoundedPositiveInteger(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  maximum: number,
): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

export function resolveYjsRelayConfig(env: NodeJS.ProcessEnv = process.env): YjsRelayConfig {
  return {
    host: env['YJS_WS_HOST'] ?? env['HOST'] ?? '127.0.0.1',
    port: readBoundedPositiveInteger(env, 'YJS_WS_PORT', 3002, 65_535),
    maxConnections: readBoundedPositiveInteger(
      env,
      'YJS_WS_MAX_CONNECTIONS',
      DEFAULT_YJS_RELAY_LIMITS.maxConnections,
      STATIC_LIMIT_MAXIMA.maxConnections,
    ),
    maxConnectionsPerRoom: readBoundedPositiveInteger(
      env,
      'YJS_WS_MAX_CONNECTIONS_PER_ROOM',
      DEFAULT_YJS_RELAY_LIMITS.maxConnectionsPerRoom,
      STATIC_LIMIT_MAXIMA.maxConnectionsPerRoom,
    ),
    maxUpgradesPerMinute: readBoundedPositiveInteger(
      env,
      'YJS_WS_MAX_UPGRADES_PER_MINUTE',
      DEFAULT_YJS_RELAY_LIMITS.maxUpgradesPerMinute,
      STATIC_LIMIT_MAXIMA.maxUpgradesPerMinute,
    ),
    maxUpgradesPerRoomPerMinute: readBoundedPositiveInteger(
      env,
      'YJS_WS_MAX_UPGRADES_PER_ROOM_PER_MINUTE',
      DEFAULT_YJS_RELAY_LIMITS.maxUpgradesPerRoomPerMinute,
      STATIC_LIMIT_MAXIMA.maxUpgradesPerRoomPerMinute,
    ),
    maxPayloadBytes: readBoundedPositiveInteger(
      env,
      'YJS_WS_MAX_PAYLOAD_BYTES',
      DEFAULT_YJS_RELAY_LIMITS.maxPayloadBytes,
      STATIC_LIMIT_MAXIMA.maxPayloadBytes,
    ),
    maxMessagesPerWindow: readBoundedPositiveInteger(
      env,
      'YJS_WS_MAX_MESSAGES_PER_10_SECONDS',
      DEFAULT_YJS_RELAY_LIMITS.maxMessagesPerWindow,
      STATIC_LIMIT_MAXIMA.maxMessagesPerWindow,
    ),
    maxBytesPerWindow: readBoundedPositiveInteger(
      env,
      'YJS_WS_MAX_BYTES_PER_10_SECONDS',
      DEFAULT_YJS_RELAY_LIMITS.maxBytesPerWindow,
      STATIC_LIMIT_MAXIMA.maxBytesPerWindow,
    ),
    maxMessagesPerRoomPerWindow: readBoundedPositiveInteger(
      env,
      'YJS_WS_MAX_MESSAGES_PER_ROOM_PER_10_SECONDS',
      DEFAULT_YJS_RELAY_LIMITS.maxMessagesPerRoomPerWindow,
      STATIC_LIMIT_MAXIMA.maxMessagesPerRoomPerWindow,
    ),
    maxBytesPerRoomPerWindow: readBoundedPositiveInteger(
      env,
      'YJS_WS_MAX_BYTES_PER_ROOM_PER_10_SECONDS',
      DEFAULT_YJS_RELAY_LIMITS.maxBytesPerRoomPerWindow,
      STATIC_LIMIT_MAXIMA.maxBytesPerRoomPerWindow,
    ),
    maxMessagesGlobalPerWindow: readBoundedPositiveInteger(
      env,
      'YJS_WS_MAX_MESSAGES_GLOBAL_PER_10_SECONDS',
      DEFAULT_YJS_RELAY_LIMITS.maxMessagesGlobalPerWindow,
      STATIC_LIMIT_MAXIMA.maxMessagesGlobalPerWindow,
    ),
    maxBytesGlobalPerWindow: readBoundedPositiveInteger(
      env,
      'YJS_WS_MAX_BYTES_GLOBAL_PER_10_SECONDS',
      DEFAULT_YJS_RELAY_LIMITS.maxBytesGlobalPerWindow,
      STATIC_LIMIT_MAXIMA.maxBytesGlobalPerWindow,
    ),
    maxDocumentBytesPerRoom: readBoundedPositiveInteger(
      env,
      'YJS_WS_MAX_DOCUMENT_BYTES_PER_ROOM',
      DEFAULT_YJS_RELAY_LIMITS.maxDocumentBytesPerRoom,
      STATIC_LIMIT_MAXIMA.maxDocumentBytesPerRoom,
    ),
    maxDocumentBytesGlobal: readBoundedPositiveInteger(
      env,
      'YJS_WS_MAX_DOCUMENT_BYTES_GLOBAL',
      DEFAULT_YJS_RELAY_LIMITS.maxDocumentBytesGlobal,
      STATIC_LIMIT_MAXIMA.maxDocumentBytesGlobal,
    ),
    maxAwarenessStateBytes: readBoundedPositiveInteger(
      env,
      'YJS_WS_MAX_AWARENESS_STATE_BYTES',
      DEFAULT_YJS_RELAY_LIMITS.maxAwarenessStateBytes,
      STATIC_LIMIT_MAXIMA.maxAwarenessStateBytes,
    ),
    maxOutboundBytesPerWindow: readBoundedPositiveInteger(
      env,
      'YJS_WS_MAX_OUTBOUND_BYTES_PER_10_SECONDS',
      DEFAULT_YJS_RELAY_LIMITS.maxOutboundBytesPerWindow,
      STATIC_LIMIT_MAXIMA.maxOutboundBytesPerWindow,
    ),
    maxOutboundBytesPerRoomPerWindow: readBoundedPositiveInteger(
      env,
      'YJS_WS_MAX_OUTBOUND_BYTES_PER_ROOM_PER_10_SECONDS',
      DEFAULT_YJS_RELAY_LIMITS.maxOutboundBytesPerRoomPerWindow,
      STATIC_LIMIT_MAXIMA.maxOutboundBytesPerRoomPerWindow,
    ),
    maxOutboundBytesGlobalPerWindow: readBoundedPositiveInteger(
      env,
      'YJS_WS_MAX_OUTBOUND_BYTES_GLOBAL_PER_10_SECONDS',
      DEFAULT_YJS_RELAY_LIMITS.maxOutboundBytesGlobalPerWindow,
      STATIC_LIMIT_MAXIMA.maxOutboundBytesGlobalPerWindow,
    ),
  };
}

class FixedWindowCounter {
  private startedAt = 0;
  private count = 0;

  constructor(private readonly windowMs: number = UPGRADE_WINDOW_MS) {}

  consume(limit: number, now = Date.now()): boolean {
    if (now - this.startedAt >= this.windowMs) {
      this.startedAt = now;
      this.count = 0;
    }
    if (this.count >= limit) return false;
    this.count += 1;
    return true;
  }

  get expiresAt(): number {
    return this.startedAt + this.windowMs;
  }
}

class FixedWindowMessageBudget {
  private startedAt = 0;
  private messages = 0;
  private bytes = 0;

  consume(maxMessages: number, maxBytes: number, messageBytes: number, now = Date.now()): boolean {
    if (now - this.startedAt >= MESSAGE_WINDOW_MS) {
      this.startedAt = now;
      this.messages = 0;
      this.bytes = 0;
    }
    if (this.messages >= maxMessages || messageBytes > maxBytes - this.bytes) return false;
    this.messages += 1;
    this.bytes += messageBytes;
    return true;
  }

  get expiresAt(): number {
    return this.startedAt + MESSAGE_WINDOW_MS;
  }
}

class FixedWindowByteBudget {
  private startedAt = 0;
  private bytes = 0;

  allows(maxBytes: number, messageBytes: number, now = Date.now()): boolean {
    if (now - this.startedAt >= MESSAGE_WINDOW_MS) {
      this.startedAt = now;
      this.bytes = 0;
    }
    return messageBytes <= maxBytes - this.bytes;
  }

  commit(messageBytes: number, now = Date.now()): void {
    if (now - this.startedAt >= MESSAGE_WINDOW_MS) {
      this.startedAt = now;
      this.bytes = 0;
    }
    this.bytes += messageBytes;
  }

  get expiresAt(): number {
    return this.startedAt + MESSAGE_WINDOW_MS;
  }
}

function rawDataByteLength(data: RawData): number {
  if (Array.isArray(data)) return data.reduce((total, part) => total + part.byteLength, 0);
  return data.byteLength;
}

function hasKnownYjsMessageType(data: RawData): boolean {
  let firstByte: number | undefined;
  if (Array.isArray(data)) {
    firstByte = data.find((part) => part.byteLength > 0)?.[0];
  } else if (data instanceof ArrayBuffer) {
    firstByte = data.byteLength > 0 ? new Uint8Array(data, 0, 1)[0] : undefined;
  } else {
    firstByte = data.byteLength > 0 ? data[0] : undefined;
  }
  // @y/websocket-server@0.1.1 kennt nur messageSync=0 und messageAwareness=1.
  return firstByte === 0 || firstByte === 1;
}

function rawDataBytes(data: RawData): Uint8Array {
  if (Array.isArray(data)) return Buffer.concat(data);
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return data;
}

function readVarUint(bytes: Uint8Array, cursor: { offset: number }): number {
  let value = 0;
  let multiplier = 1;
  for (let index = 0; index < 8; index += 1) {
    const byte = bytes[cursor.offset];
    if (byte === undefined) throw new Error('Unvollständiger Yjs-VarUint');
    cursor.offset += 1;
    value += (byte & 0x7f) * multiplier;
    if (byte < 0x80) {
      if (!Number.isSafeInteger(value)) throw new Error('Yjs-VarUint außerhalb des Zahlenbereichs');
      return value;
    }
    multiplier *= 128;
  }
  throw new Error('Yjs-VarUint ist zu lang');
}

function extractYjsUpdate(data: RawData): Uint8Array | null {
  const bytes = rawDataBytes(data);
  const cursor = { offset: 0 };
  const messageType = readVarUint(bytes, cursor);
  if (messageType !== 0) return null;
  const syncType = readVarUint(bytes, cursor);
  if (syncType !== 1 && syncType !== 2) return null;
  const updateLength = readVarUint(bytes, cursor);
  if (updateLength > bytes.byteLength - cursor.offset) {
    throw new Error('Unvollständiger Yjs-Update-Payload');
  }
  return bytes.subarray(cursor.offset, cursor.offset + updateLength);
}

/** y-protocols sync step 1 (messageSync=0, syncStep1=0) löst große Sync-Antworten aus. */
function isYjsSyncStep1(data: RawData): boolean {
  try {
    const bytes = rawDataBytes(data);
    const cursor = { offset: 0 };
    if (readVarUint(bytes, cursor) !== 0) return false;
    return readVarUint(bytes, cursor) === 0;
  } catch {
    return false;
  }
}

interface AwarenessEntry {
  clientId: number;
  stateBytes: number;
  /** Yjs codiert Removals als JSON `null` (4 Bytes), nicht als leeren State. */
  isNullState: boolean;
}

const awarenessStateDecoder = new TextDecoder();

function decodeAwarenessStateIsNull(stateBytes: Uint8Array): boolean {
  let state: unknown;
  try {
    state = JSON.parse(awarenessStateDecoder.decode(stateBytes));
  } catch {
    throw new Error('Ungültiger Yjs-Awareness-State');
  }
  return state === null;
}

function extractAwarenessEntries(
  data: RawData,
  maxEntries: number,
  maxAwarenessStateBytes: number,
): AwarenessEntry[] | 'limit-exceeded' | null {
  const bytes = rawDataBytes(data);
  const outerCursor = { offset: 0 };
  const messageType = readVarUint(bytes, outerCursor);
  if (messageType !== 1) return null;
  const updateLength = readVarUint(bytes, outerCursor);
  if (
    updateLength > bytes.byteLength - outerCursor.offset ||
    outerCursor.offset + updateLength !== bytes.byteLength
  ) {
    throw new Error('Ungültige Yjs-Awareness-Payloadlänge');
  }

  const update = bytes.subarray(outerCursor.offset, outerCursor.offset + updateLength);
  const cursor = { offset: 0 };
  const entryCount = readVarUint(update, cursor);
  if (entryCount > maxEntries) return 'limit-exceeded';
  const entries: AwarenessEntry[] = [];
  for (let index = 0; index < entryCount; index += 1) {
    const clientId = readVarUint(update, cursor);
    readVarUint(update, cursor); // Awareness-Clock
    const stateBytes = readVarUint(update, cursor);
    if (stateBytes > update.byteLength - cursor.offset) {
      throw new Error('Unvollständiger Yjs-Awareness-State');
    }
    // Cap vor UTF-8-/JSON-Materialisierung: nur gebundene States werden decodiert.
    if (stateBytes > maxAwarenessStateBytes) return 'limit-exceeded';
    const stateSlice = update.subarray(cursor.offset, cursor.offset + stateBytes);
    cursor.offset += stateBytes;
    // Leerer Payload ist kein gültiges y-protocols-Encoding; Removals sind JSON `null`.
    const isNullState = stateBytes === 0 || decodeAwarenessStateIsNull(stateSlice);
    entries.push({ clientId, stateBytes, isNullState });
  }
  if (cursor.offset !== update.byteLength) {
    throw new Error('Unerwartete Bytes im Yjs-Awareness-Update');
  }
  return entries;
}

function outboundDataByteLength(data: unknown): number {
  if (typeof data === 'string') return Buffer.byteLength(data);
  if (data instanceof ArrayBuffer) return data.byteLength;
  if (ArrayBuffer.isView(data)) return data.byteLength;
  if (Array.isArray(data)) {
    return data.reduce(
      (total, part) => total + (ArrayBuffer.isView(part) ? part.byteLength : 0),
      0,
    );
  }
  return 0;
}

interface DocumentReservation {
  reservedBytes: number;
}

function parseRoomUpgrade(request: IncomingMessage): {
  room: string;
  shareToken: string | null;
} | null {
  let url: URL;
  try {
    url = new URL(request.url ?? '', 'http://yjs-relay.invalid');
  } catch {
    return null;
  }
  if (url.hash) return null;
  const match = ROOM_PATH_PATTERN.exec(url.pathname);
  if (!match) return null;

  // Only the dedicated share-token query key is allowed (ADR-0033).
  for (const key of url.searchParams.keys()) {
    if (key !== YJS_SHARE_QUERY_PARAM) return null;
  }
  const shareTokenRaw = url.searchParams.get(YJS_SHARE_QUERY_PARAM);
  const shareToken = shareTokenRaw && shareTokenRaw.trim().length > 0 ? shareTokenRaw.trim() : null;
  if (url.search && !shareToken) return null;

  return {
    room: `quiz-library-room-${match[1].toLowerCase()}`,
    shareToken,
  };
}

function rejectUpgrade(socket: Duplex, status: 400 | 429 | 503): void {
  const statusText =
    status === 400 ? 'Bad Request' : status === 429 ? 'Too Many Requests' : 'Service Unavailable';
  socket.write(
    `HTTP/1.1 ${status} ${statusText}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
  );
  socket.destroy();
  recordYjsWebSocketRejectedUpgrade();
}

export class YjsRelayServer {
  private readonly httpServer: HttpServer;
  private readonly webSocketServer: WebSocketServer;
  private readonly globalUpgradeWindow = new FixedWindowCounter();
  private readonly roomUpgradeWindows = new Map<string, FixedWindowCounter>();
  private readonly globalMessageWindow = new FixedWindowMessageBudget();
  private readonly roomMessageWindows = new Map<string, FixedWindowMessageBudget>();
  private readonly globalOutboundWindow = new FixedWindowByteBudget();
  private readonly roomOutboundWindows = new Map<string, FixedWindowByteBudget>();
  private readonly documentReservations = new Map<string, DocumentReservation>();
  private readonly roomConnections = new Map<string, number>();
  private readonly roomConnectionGenerations = new Map<string, Map<WebSocket, number | null>>();
  private readonly roomAwarenessOwners = new Map<string, Map<number, WebSocket>>();
  /** Bekannte bzw. kürzlich getrennte Awareness-IDs je Raum (für Null-Removals). */
  private readonly roomKnownAwarenessIds = new Map<string, Set<number>>();
  private readonly roomExactCompactionWindows = new Map<string, FixedWindowCounter>();
  private connectionsActive = 0;
  private documentBytesReserved = 0;
  private readonly unsubscribeShareRotation: () => void;

  constructor(private readonly config: YjsRelayConfig) {
    this.unsubscribeShareRotation = onYjsShareRotated(({ roomId, generation }) => {
      this.revokeOlderRoomConnections(`quiz-library-room-${roomId}`, generation);
    });
    this.webSocketServer = new WebSocketServer({
      noServer: true,
      maxPayload: config.maxPayloadBytes,
    });
    configureYjsWebSocketTelemetry({
      connectionLimit: config.maxConnections,
      perRoomConnectionLimit: config.maxConnectionsPerRoom,
    });
    this.httpServer = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('okay');
    });
    this.httpServer.on('upgrade', (request, socket, head) => {
      void this.handleUpgrade(request, socket, head);
    });
  }

  listen(callback?: () => void): void {
    this.httpServer.listen(this.config.port, this.config.host, callback);
  }

  address(): ReturnType<HttpServer['address']> {
    return this.httpServer.address();
  }

  async close(): Promise<void> {
    this.unsubscribeShareRotation();
    for (const client of this.webSocketServer.clients) client.terminate();
    await new Promise<void>((resolve, reject) => {
      this.webSocketServer.close(() => {
        this.httpServer.close((error) => (error ? reject(error) : resolve()));
      });
    });
  }

  private async handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): Promise<void> {
    const now = Date.now();
    if (!this.globalUpgradeWindow.consume(this.config.maxUpgradesPerMinute, now)) {
      rejectUpgrade(socket, 429);
      return;
    }

    const parsed = parseRoomUpgrade(request);
    if (!parsed) {
      rejectUpgrade(socket, 400);
      return;
    }
    const { room, shareToken } = parsed;

    let authorized: Awaited<ReturnType<typeof authorizeYjsRoomUpgrade>>;
    try {
      authorized = await authorizeYjsRoomUpgrade({ roomId: room, shareToken });
    } catch {
      logger.warn('[security] yjs_share_authorize_failed', { reason: 'redis_or_internal' });
      rejectUpgrade(socket, 503);
      return;
    }
    if (!authorized.ok) {
      logger.warn('[security] yjs_share_upgrade_rejected', { reason: authorized.reason });
      rejectUpgrade(socket, 400);
      return;
    }

    this.pruneRoomUpgradeWindows(now);
    const roomUpgradeWindow = this.roomUpgradeWindows.get(room) ?? new FixedWindowCounter();
    this.roomUpgradeWindows.set(room, roomUpgradeWindow);
    if (!roomUpgradeWindow.consume(this.config.maxUpgradesPerRoomPerMinute, now)) {
      rejectUpgrade(socket, 429);
      return;
    }

    const roomConnections = this.roomConnections.get(room) ?? 0;
    if (
      this.connectionsActive >= this.config.maxConnections ||
      roomConnections >= this.config.maxConnectionsPerRoom
    ) {
      rejectUpgrade(socket, 503);
      return;
    }

    this.webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      this.attachConnection(webSocket, request, room, authorized.generation);
    });
  }

  private attachConnection(
    webSocket: WebSocket,
    request: IncomingMessage,
    room: string,
    generation: number | null,
  ): void {
    this.connectionsActive += 1;
    this.roomConnections.set(room, (this.roomConnections.get(room) ?? 0) + 1);
    const generations = this.roomConnectionGenerations.get(room) ?? new Map();
    generations.set(webSocket, generation);
    this.roomConnectionGenerations.set(room, generations);
    recordYjsWebSocketConnected(room);

    const connectionMessageWindow = new FixedWindowMessageBudget();
    let ownedAwarenessClientId: number | null = null;
    let rateLimited = false;
    let payloadRejected = false;
    const connectionOutboundWindow = new FixedWindowByteBudget();
    webSocket.on('error', (error: Error & { code?: string }) => {
      if (!payloadRejected && error.code === 'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH') {
        payloadRejected = true;
        recordYjsWebSocketPayloadRejected();
      }
      // `ws` schließt Protokoll-/Payload-Verstöße selbst; kein attacker-kontrolliertes Log.
    });

    const originalSend = webSocket.send;
    Object.defineProperty(webSocket, 'send', {
      configurable: true,
      value: (data: unknown, ...args: unknown[]): void => {
        const now = Date.now();
        this.pruneRoomOutboundWindows(now);
        const roomOutboundWindow =
          this.roomOutboundWindows.get(room) ?? new FixedWindowByteBudget();
        this.roomOutboundWindows.set(room, roomOutboundWindow);
        const messageBytes = outboundDataByteLength(data);
        const admitted =
          this.globalOutboundWindow.allows(
            this.config.maxOutboundBytesGlobalPerWindow,
            messageBytes,
            now,
          ) &&
          roomOutboundWindow.allows(
            this.config.maxOutboundBytesPerRoomPerWindow,
            messageBytes,
            now,
          ) &&
          connectionOutboundWindow.allows(this.config.maxOutboundBytesPerWindow, messageBytes, now);
        if (!admitted) {
          recordYjsWebSocketOutboundRejected();
          webSocket.terminate();
          return;
        }
        this.globalOutboundWindow.commit(messageBytes, now);
        roomOutboundWindow.commit(messageBytes, now);
        connectionOutboundWindow.commit(messageBytes, now);
        Reflect.apply(originalSend, webSocket, [data, ...args]);
      },
    });

    setupWSConnection(webSocket, request, { docName: room, gc: true });
    const protocolMessageListeners = webSocket.rawListeners('message') as Array<
      (data: RawData, isBinary: boolean) => void
    >;
    webSocket.removeAllListeners('message');
    webSocket.on('message', (data, isBinary) => {
      if (rateLimited) return;
      const now = Date.now();
      this.pruneRoomMessageWindows(now);
      const roomMessageWindow = this.roomMessageWindows.get(room) ?? new FixedWindowMessageBudget();
      this.roomMessageWindows.set(room, roomMessageWindow);
      const messageBytes = rawDataByteLength(data);
      const admitted =
        this.globalMessageWindow.consume(
          this.config.maxMessagesGlobalPerWindow,
          this.config.maxBytesGlobalPerWindow,
          messageBytes,
          now,
        ) &&
        roomMessageWindow.consume(
          this.config.maxMessagesPerRoomPerWindow,
          this.config.maxBytesPerRoomPerWindow,
          messageBytes,
          now,
        ) &&
        connectionMessageWindow.consume(
          this.config.maxMessagesPerWindow,
          this.config.maxBytesPerWindow,
          messageBytes,
          now,
        );
      if (!admitted) {
        rateLimited = true;
        recordYjsWebSocketRateLimitedMessage();
        webSocket.terminate();
        return;
      }
      if (!hasKnownYjsMessageType(data)) {
        recordYjsWebSocketProtocolError();
        webSocket.terminate();
        return;
      }
      let awarenessEntries: AwarenessEntry[] | 'limit-exceeded' | null;
      try {
        awarenessEntries = extractAwarenessEntries(
          data,
          this.config.maxConnectionsPerRoom,
          this.config.maxAwarenessStateBytes,
        );
      } catch {
        recordYjsWebSocketProtocolError();
        webSocket.terminate();
        return;
      }
      if (awarenessEntries === 'limit-exceeded') {
        recordYjsWebSocketAwarenessRejected();
        webSocket.terminate();
        return;
      }
      if (awarenessEntries) {
        const roomAwarenessOwners =
          this.roomAwarenessOwners.get(room) ?? new Map<number, WebSocket>();
        const knownAwarenessIds = this.roomKnownAwarenessIds.get(room) ?? new Set<number>();
        let newlyOwnedClientId: number | null = null;
        for (const entry of awarenessEntries) {
          if (entry.stateBytes > this.config.maxAwarenessStateBytes) {
            recordYjsWebSocketAwarenessRejected();
            webSocket.terminate();
            return;
          }
          // Aktive Ownership-IDs dürfen Provider rebroadcasten (State oder Null).
          if (roomAwarenessOwners.has(entry.clientId)) continue;
          // Null-Removals nur für zuvor bekannte bzw. kürzlich getrennte IDs —
          // sonst wächst Awareness.meta fensterübergreifend unbeschränkt.
          if (entry.isNullState) {
            if (!knownAwarenessIds.has(entry.clientId)) {
              recordYjsWebSocketAwarenessRejected();
              webSocket.terminate();
              return;
            }
            continue;
          }
          // Ein Provider darf genau eine neue lokale ID mit State einführen.
          if (
            (ownedAwarenessClientId !== null && entry.clientId !== ownedAwarenessClientId) ||
            (newlyOwnedClientId !== null && entry.clientId !== newlyOwnedClientId)
          ) {
            recordYjsWebSocketAwarenessRejected();
            webSocket.terminate();
            return;
          }
          newlyOwnedClientId = entry.clientId;
        }
        if (newlyOwnedClientId !== null) {
          if (
            !this.rememberAwarenessId(
              room,
              newlyOwnedClientId,
              roomAwarenessOwners,
              knownAwarenessIds,
            )
          ) {
            recordYjsWebSocketAwarenessRejected();
            webSocket.terminate();
            return;
          }
          ownedAwarenessClientId = newlyOwnedClientId;
          roomAwarenessOwners.set(newlyOwnedClientId, webSocket);
          this.roomAwarenessOwners.set(room, roomAwarenessOwners);
        }
      }
      const documentAdmission = this.admitDocumentUpdate(room, data);
      if (documentAdmission === 'protocol-error') {
        recordYjsWebSocketProtocolError();
        webSocket.terminate();
        return;
      }
      if (documentAdmission === false) {
        recordYjsWebSocketDocumentRejected();
        webSocket.terminate();
        return;
      }

      // Sync-Step-1 vor dem Protokollhandler: große encodeStateAsUpdate-Antworten
      // dürfen das Outbound-Budget nicht umgehen, indem sie erst nach Allokation fallen.
      if (
        isYjsSyncStep1(data) &&
        !this.canAdmitEstimatedSyncResponse(room, connectionOutboundWindow, now)
      ) {
        if (typeof documentAdmission === 'function') documentAdmission();
        recordYjsWebSocketOutboundRejected();
        webSocket.terminate();
        return;
      }

      // @y/websocket-server@0.1.1 fängt Parserfehler selbst und schreibt sie
      // ungefiltert nach console.error. Der gepinnte synchrone Handler wird
      // deshalb kontrolliert ausgeführt: keine attacker-kontrollierten Logs,
      // ein Diagnosezähler und sofortige Trennung bei ungültigem Protokoll.
      const originalConsoleError = console.error;
      let protocolError = false;
      const protocolDoc = docs.get(room) as
        | {
            on(event: 'error', listener: () => void): void;
            off(event: 'error', listener: () => void): void;
          }
        | undefined;
      const markProtocolError = (): void => {
        protocolError = true;
      };
      protocolDoc?.on('error', markProtocolError);
      console.error = () => {
        protocolError = true;
      };
      try {
        for (const listener of protocolMessageListeners) {
          listener.call(webSocket, data, isBinary);
        }
      } catch {
        protocolError = true;
      } finally {
        console.error = originalConsoleError;
        protocolDoc?.off('error', markProtocolError);
      }
      if (protocolError) {
        if (typeof documentAdmission === 'function') documentAdmission();
        recordYjsWebSocketProtocolError();
        webSocket.terminate();
      }
    });

    webSocket.once('close', () => {
      this.connectionsActive = Math.max(0, this.connectionsActive - 1);
      const remaining = Math.max(0, (this.roomConnections.get(room) ?? 0) - 1);
      if (remaining === 0) this.roomConnections.delete(room);
      else this.roomConnections.set(room, remaining);
      const generations = this.roomConnectionGenerations.get(room);
      generations?.delete(webSocket);
      if (generations?.size === 0) this.roomConnectionGenerations.delete(room);
      recordYjsWebSocketDisconnected(room);

      const roomAwarenessOwners = this.roomAwarenessOwners.get(room);
      if (
        ownedAwarenessClientId !== null &&
        roomAwarenessOwners?.get(ownedAwarenessClientId) === webSocket
      ) {
        roomAwarenessOwners.delete(ownedAwarenessClientId);
        const knownAwarenessIds = this.roomKnownAwarenessIds.get(room) ?? new Set<number>();
        const remembered = this.rememberAwarenessId(
          room,
          ownedAwarenessClientId,
          roomAwarenessOwners ?? new Map(),
          knownAwarenessIds,
        );
        if (!remembered) {
          // Bound mit aktiven Owners voll: kein Tombstone, meta sofort bereinigen.
          const awareness = (docs.get(room) as YjsRoomDoc | undefined)?.awareness;
          awareness?.meta.delete(ownedAwarenessClientId);
          awareness?.states.delete(ownedAwarenessClientId);
        }
      }
      if (remaining === 0 || roomAwarenessOwners?.size === 0) {
        this.roomAwarenessOwners.delete(room);
      }
      if (remaining === 0) {
        this.roomKnownAwarenessIds.delete(room);
        this.roomExactCompactionWindows.delete(room);
      }

      const doc = docs.get(room);
      if (doc?.conns.size === 0) {
        const reservation = this.documentReservations.get(room);
        if (reservation) {
          this.documentBytesReserved = Math.max(
            0,
            this.documentBytesReserved - reservation.reservedBytes,
          );
          this.documentReservations.delete(room);
        }
        doc.destroy();
        docs.delete(room);
      }
    });
  }

  /** Rotation widerruft bestehende ältere/Legacy-Verbindungen sofort. */
  private revokeOlderRoomConnections(room: string, generation: number): void {
    const connections = this.roomConnectionGenerations.get(room);
    if (!connections) return;
    for (const [webSocket, connectedGeneration] of connections) {
      if (connectedGeneration === null || connectedGeneration < generation) {
        webSocket.terminate();
      }
    }
  }

  private maxKnownAwarenessIdsPerRoom(): number {
    return this.config.maxConnectionsPerRoom * KNOWN_AWARENESS_IDS_PER_CONNECTION_SLOT;
  }

  /**
   * Merkt eine Awareness-ID persistent pro Raum. Bei vollem Bound werden älteste
   * nicht mehr aktiv besessene IDs inkl. Awareness-meta-Tombstones entfernt.
   */
  private rememberAwarenessId(
    room: string,
    clientId: number,
    owners: Map<number, WebSocket>,
    known: Set<number>,
  ): boolean {
    if (known.has(clientId)) {
      // LRU: ans Ende verschieben.
      known.delete(clientId);
      known.add(clientId);
      this.roomKnownAwarenessIds.set(room, known);
      return true;
    }
    const limit = this.maxKnownAwarenessIdsPerRoom();
    if (known.size >= limit) {
      this.evictUnownedKnownAwarenessIds(room, known, owners, known.size - limit + 1);
    }
    if (known.size >= limit) return false;
    known.add(clientId);
    this.roomKnownAwarenessIds.set(room, known);
    return true;
  }

  private evictUnownedKnownAwarenessIds(
    room: string,
    known: Set<number>,
    owners: Map<number, WebSocket>,
    needed: number,
  ): void {
    if (needed <= 0) return;
    const awareness = (docs.get(room) as YjsRoomDoc | undefined)?.awareness;
    let removed = 0;
    for (const clientId of [...known]) {
      if (removed >= needed) break;
      if (owners.has(clientId)) continue;
      known.delete(clientId);
      awareness?.meta.delete(clientId);
      awareness?.states.delete(clientId);
      removed += 1;
    }
  }

  private estimatedSyncResponseBytes(room: string): number {
    const reservation = this.documentReservations.get(room);
    if (reservation) return Math.max(reservation.reservedBytes, 64);
    // Dokument ohne Reservierung: konservativ das Raumlimit als Antwortgröße.
    if (docs.has(room)) return this.config.maxDocumentBytesPerRoom;
    return 64;
  }

  private canAdmitEstimatedSyncResponse(
    room: string,
    connectionOutboundWindow: FixedWindowByteBudget,
    now: number,
  ): boolean {
    const estimatedBytes = this.estimatedSyncResponseBytes(room);
    this.pruneRoomOutboundWindows(now);
    const roomOutboundWindow = this.roomOutboundWindows.get(room) ?? new FixedWindowByteBudget();
    this.roomOutboundWindows.set(room, roomOutboundWindow);
    return (
      this.globalOutboundWindow.allows(
        this.config.maxOutboundBytesGlobalPerWindow,
        estimatedBytes,
        now,
      ) &&
      roomOutboundWindow.allows(
        this.config.maxOutboundBytesPerRoomPerWindow,
        estimatedBytes,
        now,
      ) &&
      connectionOutboundWindow.allows(this.config.maxOutboundBytesPerWindow, estimatedBytes, now)
    );
  }

  private pruneRoomUpgradeWindows(now: number): void {
    for (const [room, counter] of this.roomUpgradeWindows) {
      if (counter.expiresAt <= now && !this.roomConnections.has(room)) {
        this.roomUpgradeWindows.delete(room);
      }
    }
  }

  private pruneRoomMessageWindows(now: number): void {
    for (const [room, budget] of this.roomMessageWindows) {
      if (budget.expiresAt <= now && !this.roomConnections.has(room)) {
        this.roomMessageWindows.delete(room);
      }
    }
  }

  private pruneRoomOutboundWindows(now: number): void {
    for (const [room, budget] of this.roomOutboundWindows) {
      if (budget.expiresAt <= now && !this.roomConnections.has(room)) {
        this.roomOutboundWindows.delete(room);
      }
    }
  }

  private admitDocumentUpdate(
    room: string,
    data: RawData,
  ): false | 'protocol-error' | null | (() => void) {
    let update: Uint8Array | null;
    try {
      update = extractYjsUpdate(data);
    } catch {
      return 'protocol-error';
    }
    if (!update) return null;

    const doc = docs.get(room);
    if (!doc) return false;
    let reservation = this.documentReservations.get(room);
    const previousRoomBytes = reservation?.reservedBytes;
    const previousGlobalBytes = this.documentBytesReserved;
    const rollback = (): void => {
      this.documentBytesReserved = previousGlobalBytes;
      if (previousRoomBytes === undefined) this.documentReservations.delete(room);
      else {
        const current = this.documentReservations.get(room);
        if (current) current.reservedBytes = previousRoomBytes;
      }
    };
    if (!reservation) {
      const initialSize = Y.encodeStateAsUpdate(doc as unknown as Y.Doc).byteLength;
      if (
        initialSize > this.config.maxDocumentBytesPerRoom ||
        initialSize > this.config.maxDocumentBytesGlobal - this.documentBytesReserved
      ) {
        return false;
      }
      reservation = { reservedBytes: initialSize };
      this.documentReservations.set(room, reservation);
      this.documentBytesReserved += initialSize;
    }

    const projectedRoomBytes = reservation.reservedBytes + update.byteLength;
    const projectedGlobalBytes = this.documentBytesReserved + update.byteLength;
    if (
      projectedRoomBytes <= this.config.maxDocumentBytesPerRoom &&
      projectedGlobalBytes <= this.config.maxDocumentBytesGlobal
    ) {
      reservation.reservedBytes = projectedRoomBytes;
      this.documentBytesReserved = projectedGlobalBytes;
      return rollback;
    }

    // Exact-Compaction ist teuer (vollständiger Clone + zweifaches Encode).
    // Pro Raum und 10-Sekunden-Fenster nur begrenzt zulassen.
    let compactionWindow = this.roomExactCompactionWindows.get(room);
    if (!compactionWindow) {
      compactionWindow = new FixedWindowCounter(MESSAGE_WINDOW_MS);
      this.roomExactCompactionWindows.set(room, compactionWindow);
    }
    if (!compactionWindow.consume(MAX_EXACT_COMPACTIONS_PER_ROOM_PER_WINDOW, Date.now())) {
      return false;
    }

    const candidate = new Y.Doc({ gc: true });
    try {
      Y.applyUpdate(candidate, Y.encodeStateAsUpdate(doc as unknown as Y.Doc));
      Y.applyUpdate(candidate, update);
      const exactSize = Y.encodeStateAsUpdate(candidate).byteLength;
      const globalAfterCompaction =
        this.documentBytesReserved - reservation.reservedBytes + exactSize;
      if (
        exactSize > this.config.maxDocumentBytesPerRoom ||
        globalAfterCompaction > this.config.maxDocumentBytesGlobal
      ) {
        return false;
      }
      reservation.reservedBytes = exactSize;
      this.documentBytesReserved = globalAfterCompaction;
      return rollback;
    } catch {
      return 'protocol-error';
    } finally {
      candidate.destroy();
    }
  }
}
