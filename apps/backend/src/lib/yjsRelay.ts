import { createServer, type IncomingMessage, type Server as HttpServer } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import { docs, setupWSConnection } from '@y/websocket-server/utils';
import { TRPC_MAX_BODY_SIZE_BYTES } from './requestLimits';
import {
  configureYjsWebSocketTelemetry,
  recordYjsWebSocketConnected,
  recordYjsWebSocketDisconnected,
  recordYjsWebSocketPayloadRejected,
  recordYjsWebSocketRateLimitedMessage,
  recordYjsWebSocketRejectedUpgrade,
} from './websocketTelemetry';

const ROOM_PATH_PATTERN =
  /^\/quiz-library-room-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
const UPGRADE_WINDOW_MS = 60_000;
const MESSAGE_WINDOW_MS = 10_000;

export interface YjsRelayLimits {
  maxConnections: number;
  maxConnectionsPerRoom: number;
  maxUpgradesPerMinute: number;
  maxUpgradesPerRoomPerMinute: number;
  maxMessagesPerWindow: number;
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
  maxMessagesPerWindow: 1_200,
};

export const DEFAULT_YJS_RELAY_LIMITS: YjsRelayLimits = {
  maxConnections: 1_000,
  maxConnectionsPerRoom: 200,
  maxUpgradesPerMinute: 3_000,
  maxUpgradesPerRoomPerMinute: 600,
  maxMessagesPerWindow: 600,
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
    maxMessagesPerWindow: readBoundedPositiveInteger(
      env,
      'YJS_WS_MAX_MESSAGES_PER_10_SECONDS',
      DEFAULT_YJS_RELAY_LIMITS.maxMessagesPerWindow,
      STATIC_LIMIT_MAXIMA.maxMessagesPerWindow,
    ),
  };
}

class FixedWindowCounter {
  private startedAt = 0;
  private count = 0;

  consume(limit: number, now = Date.now()): boolean {
    if (now - this.startedAt >= UPGRADE_WINDOW_MS) {
      this.startedAt = now;
      this.count = 0;
    }
    if (this.count >= limit) return false;
    this.count += 1;
    return true;
  }

  get expiresAt(): number {
    return this.startedAt + UPGRADE_WINDOW_MS;
  }
}

function parseRoomName(request: IncomingMessage): string | null {
  let url: URL;
  try {
    url = new URL(request.url ?? '', 'http://yjs-relay.invalid');
  } catch {
    return null;
  }
  if (url.search || url.hash) return null;
  const match = ROOM_PATH_PATTERN.exec(url.pathname);
  return match ? `quiz-library-room-${match[1].toLowerCase()}` : null;
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
  private readonly webSocketServer = new WebSocketServer({
    noServer: true,
    maxPayload: TRPC_MAX_BODY_SIZE_BYTES,
  });
  private readonly globalUpgradeWindow = new FixedWindowCounter();
  private readonly roomUpgradeWindows = new Map<string, FixedWindowCounter>();
  private readonly roomConnections = new Map<string, number>();
  private connectionsActive = 0;

  constructor(private readonly config: YjsRelayConfig) {
    configureYjsWebSocketTelemetry({
      connectionLimit: config.maxConnections,
      perRoomConnectionLimit: config.maxConnectionsPerRoom,
    });
    this.httpServer = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('okay');
    });
    this.httpServer.on('upgrade', (request, socket, head) => {
      this.handleUpgrade(request, socket, head);
    });
  }

  listen(callback?: () => void): void {
    this.httpServer.listen(this.config.port, this.config.host, callback);
  }

  address(): ReturnType<HttpServer['address']> {
    return this.httpServer.address();
  }

  async close(): Promise<void> {
    for (const client of this.webSocketServer.clients) client.terminate();
    await new Promise<void>((resolve, reject) => {
      this.webSocketServer.close(() => {
        this.httpServer.close((error) => (error ? reject(error) : resolve()));
      });
    });
  }

  private handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    const now = Date.now();
    if (!this.globalUpgradeWindow.consume(this.config.maxUpgradesPerMinute, now)) {
      rejectUpgrade(socket, 429);
      return;
    }

    const room = parseRoomName(request);
    if (!room) {
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
      this.attachConnection(webSocket, request, room);
    });
  }

  private attachConnection(webSocket: WebSocket, request: IncomingMessage, room: string): void {
    this.connectionsActive += 1;
    this.roomConnections.set(room, (this.roomConnections.get(room) ?? 0) + 1);
    recordYjsWebSocketConnected(room);

    let messageWindowStartedAt = Date.now();
    let messagesInWindow = 0;
    let rateLimited = false;
    let payloadRejected = false;
    webSocket.on('error', (error: Error & { code?: string }) => {
      if (!payloadRejected && error.code === 'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH') {
        payloadRejected = true;
        recordYjsWebSocketPayloadRejected();
      }
      // `ws` schließt Protokoll-/Payload-Verstöße selbst; kein attacker-kontrolliertes Log.
    });

    setupWSConnection(webSocket, request, { docName: room, gc: true });
    const protocolMessageListeners = webSocket.rawListeners('message') as Array<
      (data: RawData, isBinary: boolean) => void
    >;
    webSocket.removeAllListeners('message');
    webSocket.on('message', (data, isBinary) => {
      if (rateLimited) return;
      const now = Date.now();
      if (now - messageWindowStartedAt >= MESSAGE_WINDOW_MS) {
        messageWindowStartedAt = now;
        messagesInWindow = 0;
      }
      messagesInWindow += 1;
      if (messagesInWindow > this.config.maxMessagesPerWindow) {
        rateLimited = true;
        recordYjsWebSocketRateLimitedMessage();
        webSocket.terminate();
        return;
      }
      for (const listener of protocolMessageListeners) {
        listener.call(webSocket, data, isBinary);
      }
    });

    webSocket.once('close', () => {
      this.connectionsActive = Math.max(0, this.connectionsActive - 1);
      const remaining = Math.max(0, (this.roomConnections.get(room) ?? 0) - 1);
      if (remaining === 0) this.roomConnections.delete(room);
      else this.roomConnections.set(room, remaining);
      recordYjsWebSocketDisconnected(room);

      const doc = docs.get(room);
      if (doc?.conns.size === 0) {
        doc.destroy();
        docs.delete(room);
      }
    });
  }

  private pruneRoomUpgradeWindows(now: number): void {
    for (const [room, counter] of this.roomUpgradeWindows) {
      if (counter.expiresAt <= now && !this.roomConnections.has(room)) {
        this.roomUpgradeWindows.delete(room);
      }
    }
  }
}
