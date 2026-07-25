import { createServer, type Server as HttpServer } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import { TRPC_MAX_BODY_SIZE_BYTES } from './requestLimits';
import {
  configureTrpcWebSocketTelemetry,
  recordTrpcWebSocketConnected,
  recordTrpcWebSocketDisconnected,
  recordTrpcWebSocketPayloadRejected,
  recordTrpcWebSocketRateLimitedMessage,
  recordTrpcWebSocketRejectedUpgrade,
} from './websocketTelemetry';

const MESSAGE_WINDOW_MS = 10_000;
const UPGRADE_WINDOW_MS = 60_000;

export interface TrpcWebSocketLimits {
  maxConnections: number;
  maxUpgradesPerMinute: number;
  maxMessagesPerWindow: number;
  maxMessagesGlobalPerWindow: number;
}

export interface TrpcWebSocketConfig extends TrpcWebSocketLimits {
  host: string;
  port: number;
}

export const STATIC_TRPC_WS_LIMIT_MAXIMA: Readonly<TrpcWebSocketLimits> = {
  maxConnections: 5_000,
  maxUpgradesPerMinute: 30_000,
  maxMessagesPerWindow: 1_200,
  maxMessagesGlobalPerWindow: 300_000,
};

export const DEFAULT_TRPC_WS_LIMITS: Readonly<TrpcWebSocketLimits> = {
  // Zwei gleichzeitige 500er-Kohorten bleiben möglich.
  maxConnections: 1_000,
  // Sechs vollständige 500er-Reconnect-Wellen pro Minute, ohne NAT/IP-Bucket.
  maxUpgradesPerMinute: 3_000,
  // 12 Nachrichten/s pro Verbindung über zehn Sekunden sind deutlich oberhalb
  // der regulären Subscription-, Ping- und Interaktionslast.
  maxMessagesPerWindow: 120,
  // 500 Verbindungen dürfen im Mittel 60 Nachrichten je zehn Sekunden senden.
  maxMessagesGlobalPerWindow: 30_000,
};

function readBoundedPositiveInteger(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: number,
  maximum: number,
): number {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
}

export function resolveTrpcWebSocketConfig(
  env: NodeJS.ProcessEnv = process.env,
): TrpcWebSocketConfig {
  return {
    host: env['WS_HOST']?.trim() || '0.0.0.0',
    port: readBoundedPositiveInteger(env, 'WS_PORT', 3001, 65_535),
    maxConnections: readBoundedPositiveInteger(
      env,
      'TRPC_WS_MAX_CONNECTIONS',
      DEFAULT_TRPC_WS_LIMITS.maxConnections,
      STATIC_TRPC_WS_LIMIT_MAXIMA.maxConnections,
    ),
    maxUpgradesPerMinute: readBoundedPositiveInteger(
      env,
      'TRPC_WS_MAX_UPGRADES_PER_MINUTE',
      DEFAULT_TRPC_WS_LIMITS.maxUpgradesPerMinute,
      STATIC_TRPC_WS_LIMIT_MAXIMA.maxUpgradesPerMinute,
    ),
    maxMessagesPerWindow: readBoundedPositiveInteger(
      env,
      'TRPC_WS_MAX_MESSAGES_PER_10_SECONDS',
      DEFAULT_TRPC_WS_LIMITS.maxMessagesPerWindow,
      STATIC_TRPC_WS_LIMIT_MAXIMA.maxMessagesPerWindow,
    ),
    maxMessagesGlobalPerWindow: readBoundedPositiveInteger(
      env,
      'TRPC_WS_MAX_MESSAGES_GLOBAL_PER_10_SECONDS',
      DEFAULT_TRPC_WS_LIMITS.maxMessagesGlobalPerWindow,
      STATIC_TRPC_WS_LIMIT_MAXIMA.maxMessagesGlobalPerWindow,
    ),
  };
}

class FixedWindowCounter {
  private windowStartedAt = 0;
  private count = 0;

  consume(limit: number, windowMs: number, now = Date.now()): boolean {
    if (this.windowStartedAt === 0 || now - this.windowStartedAt >= windowMs) {
      this.windowStartedAt = now;
      this.count = 0;
    }
    if (this.count >= limit) return false;
    this.count += 1;
    return true;
  }
}

function rejectUpgrade(socket: Duplex, status: 429 | 503): void {
  const statusText = status === 429 ? 'Too Many Requests' : 'Service Unavailable';
  socket.write(
    `HTTP/1.1 ${status} ${statusText}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
  );
  socket.destroy();
  recordTrpcWebSocketRejectedUpgrade();
}

export class TrpcWebSocketServer {
  readonly webSocketServer: WebSocketServer;
  private readonly httpServer: HttpServer;
  private readonly globalUpgradeWindow = new FixedWindowCounter();
  private readonly globalMessageWindow = new FixedWindowCounter();
  private connectionsActive = 0;
  private upgradesPending = 0;

  constructor(private readonly config: TrpcWebSocketConfig) {
    this.webSocketServer = new WebSocketServer({
      noServer: true,
      maxPayload: TRPC_MAX_BODY_SIZE_BYTES,
    });
    configureTrpcWebSocketTelemetry({ connectionLimit: config.maxConnections });
    this.httpServer = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('okay');
    });
    this.httpServer.on('upgrade', (request, socket, head) => {
      const now = Date.now();
      if (
        !this.globalUpgradeWindow.consume(this.config.maxUpgradesPerMinute, UPGRADE_WINDOW_MS, now)
      ) {
        rejectUpgrade(socket, 429);
        return;
      }
      if (this.connectionsActive + this.upgradesPending >= this.config.maxConnections) {
        rejectUpgrade(socket, 503);
        return;
      }

      this.upgradesPending += 1;
      // `ws` ruft den Success-Callback bei ungültigem Handshake nicht auf und
      // zerstört den Socket direkt. Pending-Slots müssen deshalb auch auf
      // Close/Error freigegeben werden, sonst bleiben sie dauerhaft belegt.
      let pendingReleased = false;
      const releasePendingUpgrade = (): void => {
        if (pendingReleased) return;
        pendingReleased = true;
        this.upgradesPending = Math.max(0, this.upgradesPending - 1);
        socket.off('close', releasePendingUpgrade);
        socket.off('error', releasePendingUpgrade);
      };
      socket.once('close', releasePendingUpgrade);
      socket.once('error', releasePendingUpgrade);

      this.webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
        releasePendingUpgrade();
        this.attachConnectionGuard(webSocket);
        this.webSocketServer.emit('connection', webSocket, request);
      });
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

  private attachConnectionGuard(webSocket: WebSocket): void {
    this.connectionsActive += 1;
    recordTrpcWebSocketConnected();
    let disconnected = false;
    let payloadRejected = false;
    let rateLimited = false;
    const connectionMessageWindow = new FixedWindowCounter();

    webSocket.once('close', () => {
      if (disconnected) return;
      disconnected = true;
      this.connectionsActive = Math.max(0, this.connectionsActive - 1);
      recordTrpcWebSocketDisconnected();
    });
    webSocket.on('error', (error: Error & { code?: string }) => {
      if (!payloadRejected && error.code === 'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH') {
        payloadRejected = true;
        recordTrpcWebSocketPayloadRejected();
      }
    });

    const originalEmit = webSocket.emit;
    Object.defineProperty(webSocket, 'emit', {
      configurable: true,
      value: (event: string | symbol, ...args: unknown[]): boolean => {
        if (event === 'message') {
          if (rateLimited) return false;
          const now = Date.now();
          const admitted =
            connectionMessageWindow.consume(
              this.config.maxMessagesPerWindow,
              MESSAGE_WINDOW_MS,
              now,
            ) &&
            this.globalMessageWindow.consume(
              this.config.maxMessagesGlobalPerWindow,
              MESSAGE_WINDOW_MS,
              now,
            );
          if (!admitted) {
            rateLimited = true;
            recordTrpcWebSocketRateLimitedMessage();
            webSocket.terminate();
            return false;
          }
        }
        return Reflect.apply(originalEmit, webSocket, [event, ...args]) as boolean;
      },
    });
  }
}
