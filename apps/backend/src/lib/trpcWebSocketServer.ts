import { createServer, type IncomingMessage, type Server as HttpServer } from 'node:http';
import type { Duplex } from 'node:stream';
import { TrpcWebSocketParticipantBindingSchema } from '@arsnova/shared-types';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import { TRPC_MAX_BODY_SIZE_BYTES } from './requestLimits';
import { TrpcWebSocketClusterBudget } from './trpcWebSocketClusterBudget';
import {
  configureTrpcWebSocketTelemetry,
  recordTrpcWebSocketBindingConnected,
  recordTrpcWebSocketBindingDisconnected,
  recordTrpcWebSocketConnected,
  recordTrpcWebSocketDisconnected,
  recordTrpcWebSocketParticipantCapRejected,
  recordTrpcWebSocketPayloadRejected,
  recordTrpcWebSocketRateLimitedMessage,
  recordTrpcWebSocketRejectedUpgrade,
  recordTrpcWebSocketSessionCapRejected,
} from './websocketTelemetry';

const MESSAGE_WINDOW_MS = 10_000;
const UPGRADE_WINDOW_MS = 60_000;
const CONNECTION_PARAMS_PARSE_MAX_BYTES = 16 * 1024;
export const MAX_PENDING_BINDING_FRAMES = 64;
export const MAX_PENDING_BINDING_BYTES_PER_CONNECTION = 64 * 1024;
export const MAX_PENDING_BINDING_BYTES_GLOBAL = 8 * 1024 * 1024;
const DEFAULT_SHUTDOWN_DRAIN_TIMEOUT_MS = 2_000;

export interface TrpcWebSocketLimits {
  maxConnections: number;
  maxClusterConnections: number;
  maxConnectionsPerSession: number;
  maxConnectionsPerParticipant: number;
  maxUpgradesPerMinute: number;
  maxClusterUpgradesPerMinute: number;
  maxMessagesPerWindow: number;
  maxMessagesGlobalPerWindow: number;
}

export interface TrpcWebSocketConfig extends TrpcWebSocketLimits {
  host: string;
  port: number;
  sharedLimitsEnabled?: boolean;
  clusterBudget?: TrpcWebSocketClusterBudget | null;
  shutdownDrainTimeoutMs?: number;
}

export const STATIC_TRPC_WS_LIMIT_MAXIMA: Readonly<TrpcWebSocketLimits> = {
  maxConnections: 5_000,
  maxClusterConnections: 10_000,
  maxConnectionsPerSession: 5_000,
  maxConnectionsPerParticipant: 10,
  maxUpgradesPerMinute: 30_000,
  maxClusterUpgradesPerMinute: 60_000,
  maxMessagesPerWindow: 1_200,
  maxMessagesGlobalPerWindow: 300_000,
};

export const DEFAULT_TRPC_WS_LIMITS: Readonly<TrpcWebSocketLimits> = {
  // Zwei 500er-Kohorten plus Reserve für Steuer- und weitere öffentliche Sockets je Prozess.
  maxConnections: 1_200,
  // Globales Cluster-Budget über 2–3 App-Replikate (Hörsaal + Reconnect-Overlap + Reserve).
  maxClusterConnections: 2_100,
  // Eine volle 500er-Kohorte, stale Ersatzkohorte und 100 Steuer-Sockets.
  maxConnectionsPerSession: 1_100,
  // Zwei Browser-Tabs oder ein kurzer Reconnect-Overlap je Participant.
  maxConnectionsPerParticipant: 2,
  // Sechs vollständige 500er-Reconnect-Wellen pro Minute je Prozess, ohne NAT/IP-Bucket.
  maxUpgradesPerMinute: 3_000,
  // Globales Upgrade-Budget über alle App-Replikate (zwölf 500er-Wellen/Minute).
  maxClusterUpgradesPerMinute: 6_000,
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
    sharedLimitsEnabled: env['TRPC_WS_SHARED_LIMITS_ENABLED'] === 'true',
    maxConnections: readBoundedPositiveInteger(
      env,
      'TRPC_WS_MAX_CONNECTIONS',
      DEFAULT_TRPC_WS_LIMITS.maxConnections,
      STATIC_TRPC_WS_LIMIT_MAXIMA.maxConnections,
    ),
    maxClusterConnections: readBoundedPositiveInteger(
      env,
      'TRPC_WS_CLUSTER_MAX_CONNECTIONS',
      DEFAULT_TRPC_WS_LIMITS.maxClusterConnections,
      STATIC_TRPC_WS_LIMIT_MAXIMA.maxClusterConnections,
    ),
    maxConnectionsPerSession: Math.max(
      750,
      readBoundedPositiveInteger(
        env,
        'TRPC_WS_MAX_CONNECTIONS_PER_SESSION',
        DEFAULT_TRPC_WS_LIMITS.maxConnectionsPerSession,
        STATIC_TRPC_WS_LIMIT_MAXIMA.maxConnectionsPerSession,
      ),
    ),
    maxConnectionsPerParticipant: readBoundedPositiveInteger(
      env,
      'TRPC_WS_MAX_CONNECTIONS_PER_PARTICIPANT',
      DEFAULT_TRPC_WS_LIMITS.maxConnectionsPerParticipant,
      STATIC_TRPC_WS_LIMIT_MAXIMA.maxConnectionsPerParticipant,
    ),
    maxUpgradesPerMinute: readBoundedPositiveInteger(
      env,
      'TRPC_WS_MAX_UPGRADES_PER_MINUTE',
      DEFAULT_TRPC_WS_LIMITS.maxUpgradesPerMinute,
      STATIC_TRPC_WS_LIMIT_MAXIMA.maxUpgradesPerMinute,
    ),
    maxClusterUpgradesPerMinute: readBoundedPositiveInteger(
      env,
      'TRPC_WS_CLUSTER_MAX_UPGRADES_PER_MINUTE',
      DEFAULT_TRPC_WS_LIMITS.maxClusterUpgradesPerMinute,
      STATIC_TRPC_WS_LIMIT_MAXIMA.maxClusterUpgradesPerMinute,
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

interface ActiveBinding {
  sessionCode: string;
  participantKey: string | null;
}

type BindingAdmission = ActiveBinding | 'session-cap' | 'participant-cap';

function rawDataByteLength(data: RawData): number {
  if (Array.isArray(data)) {
    return data.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  }
  return data.byteLength;
}

function decodeBoundedTextFrame(data: RawData, isBinary: boolean): string | null {
  if (isBinary) return null;
  const byteLength = rawDataByteLength(data);
  if (byteLength > CONNECTION_PARAMS_PARSE_MAX_BYTES) return null;
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  return data.toString('utf8');
}

function parseParticipantBindingFrame(
  data: RawData,
  isBinary: boolean,
): { recognized: boolean; binding: ActiveBinding | null } {
  const text = decodeBoundedTextFrame(data, isBinary);
  if (text === null) return { recognized: false, binding: null };
  try {
    const frame: unknown = JSON.parse(text);
    if (
      !frame ||
      typeof frame !== 'object' ||
      (frame as Record<string, unknown>)['method'] !== 'connectionParams'
    ) {
      return { recognized: false, binding: null };
    }
    const parsed = TrpcWebSocketParticipantBindingSchema.safeParse(
      (frame as Record<string, unknown>)['data'],
    );
    if (!parsed.success) return { recognized: true, binding: null };
    return {
      recognized: true,
      binding: {
        sessionCode: parsed.data.sessionCode,
        participantKey: parsed.data.participantId
          ? `${parsed.data.sessionCode}:${parsed.data.participantId}`
          : null,
      },
    };
  } catch {
    return { recognized: false, binding: null };
  }
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
  socket.on('error', () => undefined);
  const statusText = status === 429 ? 'Too Many Requests' : 'Service Unavailable';
  if (!socket.destroyed && socket.writable) {
    socket.write(
      `HTTP/1.1 ${status} ${statusText}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
    );
  }
  if (!socket.destroyed) {
    socket.destroy();
  }
  recordTrpcWebSocketRejectedUpgrade();
}

async function waitUntilTaskSetDrained(
  tasks: ReadonlySet<Promise<void>>,
  listeners: Set<() => void>,
  maxWaitMs: number,
): Promise<void> {
  if (tasks.size === 0) return;
  const budgetMs = Math.max(0, maxWaitMs);
  if (budgetMs === 0) return;
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      listeners.delete(onEmpty);
      resolve();
    };
    const onEmpty = (): void => {
      if (tasks.size === 0) {
        finish();
      }
    };
    const timer = setTimeout(finish, budgetMs);
    timer.unref();
    listeners.add(onEmpty);
    onEmpty();
  });
}

export class TrpcWebSocketServer {
  readonly webSocketServer: WebSocketServer;
  private readonly httpServer: HttpServer;
  private readonly clusterBudget: TrpcWebSocketClusterBudget | null;
  private readonly shutdownDrainTimeoutMs: number;
  private readonly globalUpgradeWindow = new FixedWindowCounter();
  private readonly globalMessageWindow = new FixedWindowCounter();
  private readonly sessionConnections = new Map<string, number>();
  private readonly participantConnections = new Map<string, number>();
  private readonly pendingUpgradeSockets = new Set<Duplex>();
  private readonly inFlightUpgrades = new Set<Promise<void>>();
  private readonly inFlightUpgradeDrainListeners = new Set<() => void>();
  private readonly inFlightClusterReleases = new Set<Promise<void>>();
  private readonly inFlightReleaseDrainListeners = new Set<() => void>();
  private connectionsActive = 0;
  private upgradesPending = 0;
  private pendingBindingBytesGlobal = 0;
  private closing = false;

  constructor(private readonly config: TrpcWebSocketConfig) {
    this.shutdownDrainTimeoutMs =
      config.shutdownDrainTimeoutMs ?? DEFAULT_SHUTDOWN_DRAIN_TIMEOUT_MS;
    this.webSocketServer = new WebSocketServer({
      noServer: true,
      maxPayload: TRPC_MAX_BODY_SIZE_BYTES,
    });
    this.clusterBudget =
      config.clusterBudget !== undefined
        ? config.clusterBudget
        : config.sharedLimitsEnabled
          ? new TrpcWebSocketClusterBudget({
              maxClusterConnections: config.maxClusterConnections,
              maxClusterUpgradesPerMinute: config.maxClusterUpgradesPerMinute,
              maxConnectionsPerSession: config.maxConnectionsPerSession,
              maxConnectionsPerParticipant: config.maxConnectionsPerParticipant,
              ...(config.shutdownDrainTimeoutMs !== undefined
                ? { shutdownDrainTimeoutMs: config.shutdownDrainTimeoutMs }
                : {}),
            })
          : null;
    configureTrpcWebSocketTelemetry({
      connectionLimit: config.maxConnections,
      clusterConnectionLimit: this.clusterBudget ? config.maxClusterConnections : null,
      sessionConnectionLimit: config.maxConnectionsPerSession,
      participantConnectionLimit: config.maxConnectionsPerParticipant,
    });
    this.httpServer = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('okay');
    });
    this.httpServer.on('upgrade', (request, socket, head) => {
      const upgradeTask = this.handleHttpUpgrade(request, socket, head);
      this.inFlightUpgrades.add(upgradeTask);
      void upgradeTask.finally(() => {
        this.inFlightUpgrades.delete(upgradeTask);
        if (this.inFlightUpgrades.size === 0) {
          for (const notify of [...this.inFlightUpgradeDrainListeners]) {
            notify();
          }
        }
      });
    });
  }

  listen(callback?: () => void): void {
    this.clusterBudget?.start();
    this.httpServer.listen(this.config.port, this.config.host, callback);
  }

  address(): ReturnType<HttpServer['address']> {
    return this.httpServer.address();
  }

  async close(): Promise<void> {
    this.closing = true;
    for (const pendingSocket of [...this.pendingUpgradeSockets]) {
      if (!pendingSocket.destroyed) {
        rejectUpgrade(pendingSocket, 503);
      }
    }
    for (const client of this.webSocketServer.clients) client.terminate();
    await new Promise<void>((resolve, reject) => {
      this.webSocketServer.close(() => {
        this.httpServer.close((error) => (error ? reject(error) : resolve()));
      });
    });
    const drainDeadline = Date.now() + this.shutdownDrainTimeoutMs;
    await waitUntilTaskSetDrained(
      this.inFlightUpgrades,
      this.inFlightUpgradeDrainListeners,
      drainDeadline - Date.now(),
    );
    await waitUntilTaskSetDrained(
      this.inFlightClusterReleases,
      this.inFlightReleaseDrainListeners,
      drainDeadline - Date.now(),
    );
    await this.clusterBudget?.close();
  }

  private trackClusterRelease(promise: Promise<void>): void {
    this.inFlightClusterReleases.add(promise);
    void promise.finally(() => {
      this.inFlightClusterReleases.delete(promise);
      if (this.inFlightClusterReleases.size === 0) {
        for (const notify of [...this.inFlightReleaseDrainListeners]) {
          notify();
        }
      }
    });
  }

  private async handleHttpUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): Promise<void> {
    if (this.closing) {
      rejectUpgrade(socket, 503);
      return;
    }
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
    this.pendingUpgradeSockets.add(socket);
    // `ws` ruft den Success-Callback bei ungültigem Handshake nicht auf und
    // zerstört den Socket direkt. Pending-Slots müssen deshalb auch auf
    // Close/Error freigegeben werden, sonst bleiben sie dauerhaft belegt.
    let pendingReleased = false;
    const releasePendingUpgrade = (): void => {
      if (pendingReleased) return;
      pendingReleased = true;
      this.pendingUpgradeSockets.delete(socket);
      this.upgradesPending = Math.max(0, this.upgradesPending - 1);
      socket.off('close', releasePendingUpgrade);
      socket.off('error', releasePendingUpgrade);
    };
    socket.once('close', releasePendingUpgrade);
    socket.once('error', releasePendingUpgrade);

    let releaseClusterConnection: (() => void) | null = null;
    if (this.clusterBudget) {
      const ignoreUpgradeSocketError = (): void => {
        // Verhindert unbehandelte Duplex-Fehler während des kurzen Redis-Awaits.
      };
      socket.on('error', ignoreUpgradeSocketError);
      socket.pause();
      try {
        const upgradeReservation =
          typeof this.clusterBudget.admitUpgradeReservation === 'function'
            ? await this.clusterBudget.admitUpgradeReservation()
            : { decision: await this.clusterBudget.admitUpgrade(), reservationId: null };
        const { decision, reservationId } = upgradeReservation;
        if (decision === 'rate-limited' || decision === 'connection-cap') {
          releasePendingUpgrade();
          if (!socket.destroyed) {
            rejectUpgrade(socket, decision === 'rate-limited' ? 429 : 503);
          }
          return;
        }
        if (decision === 'admitted') {
          let clusterReleased = false;
          const budget = this.clusterBudget;
          releaseClusterConnection = (): void => {
            if (clusterReleased) return;
            clusterReleased = true;
            this.trackClusterRelease(budget.releaseConnection(reservationId));
          };
        }
        if (this.closing || socket.destroyed || !socket.writable) {
          releasePendingUpgrade();
          releaseClusterConnection?.();
          if (!socket.destroyed) {
            rejectUpgrade(socket, 503);
          }
          return;
        }
      } finally {
        socket.off('error', ignoreUpgradeSocketError);
        if (!this.closing && !socket.destroyed) socket.resume();
      }
    }

    const releaseClusterOnFailedHandshake = (): void => {
      releaseClusterConnection?.();
    };
    if (releaseClusterConnection) {
      socket.once('close', releaseClusterOnFailedHandshake);
      socket.once('error', releaseClusterOnFailedHandshake);
    }

    this.webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      if (releaseClusterConnection) {
        socket.off('close', releaseClusterOnFailedHandshake);
        socket.off('error', releaseClusterOnFailedHandshake);
      }
      releasePendingUpgrade();
      this.attachConnectionGuard(webSocket, releaseClusterConnection);
      this.webSocketServer.emit('connection', webSocket, request);
    });
  }

  private attachConnectionGuard(
    webSocket: WebSocket,
    releaseClusterConnection: (() => void) | null = null,
  ): void {
    this.connectionsActive += 1;
    recordTrpcWebSocketConnected();
    let disconnected = false;
    let payloadRejected = false;
    let rateLimited = false;
    let connectionParamsObserved = false;
    let bindingPending = false;
    let activeBinding: ActiveBinding | null = null;
    let clusterBindingHeld = false;
    let clusterBindingReservationId: string | null = null;
    let pendingBindingBytes = 0;
    const pendingBindingFrames: Array<[RawData, boolean]> = [];
    const connectionMessageWindow = new FixedWindowCounter();

    const clearPendingBindingFrames = (): Array<[RawData, boolean]> => {
      if (pendingBindingBytes > 0) {
        this.pendingBindingBytesGlobal = Math.max(
          0,
          this.pendingBindingBytesGlobal - pendingBindingBytes,
        );
        pendingBindingBytes = 0;
      }
      return pendingBindingFrames.splice(0);
    };

    const enqueuePendingBindingFrame = (frameData: RawData, frameIsBinary: boolean): boolean => {
      if (pendingBindingFrames.length >= MAX_PENDING_BINDING_FRAMES) {
        rateLimited = true;
        clearPendingBindingFrames();
        recordTrpcWebSocketRateLimitedMessage();
        webSocket.terminate();
        return false;
      }
      const frameBytes = rawDataByteLength(frameData);
      if (
        pendingBindingBytes + frameBytes > MAX_PENDING_BINDING_BYTES_PER_CONNECTION ||
        this.pendingBindingBytesGlobal + frameBytes > MAX_PENDING_BINDING_BYTES_GLOBAL
      ) {
        payloadRejected = true;
        rateLimited = true;
        clearPendingBindingFrames();
        recordTrpcWebSocketPayloadRejected();
        webSocket.close(1009, 'pending binding buffer exceeded');
        const forceCloseTimer = setTimeout(() => {
          if (webSocket.readyState !== WebSocket.CLOSED) {
            webSocket.terminate();
          }
        }, 1_000);
        forceCloseTimer.unref();
        return false;
      }
      pendingBindingFrames.push([frameData, frameIsBinary]);
      pendingBindingBytes += frameBytes;
      this.pendingBindingBytesGlobal += frameBytes;
      return true;
    };

    webSocket.once('close', () => {
      if (disconnected) return;
      disconnected = true;
      clearPendingBindingFrames();
      this.connectionsActive = Math.max(0, this.connectionsActive - 1);
      recordTrpcWebSocketDisconnected();
      releaseClusterConnection?.();
      if (activeBinding) {
        const bound = activeBinding;
        const releaseInCluster = clusterBindingHeld;
        const boundReservationId = clusterBindingReservationId;
        activeBinding = null;
        clusterBindingHeld = false;
        clusterBindingReservationId = null;
        this.releaseLocalBinding(bound);
        recordTrpcWebSocketBindingDisconnected();
        if (releaseInCluster && this.clusterBudget) {
          this.trackClusterRelease(this.clusterBudget.releaseBinding(bound, boundReservationId));
        }
      }
    });
    webSocket.on('error', (error: Error & { code?: string }) => {
      if (!payloadRejected && error.code === 'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH') {
        payloadRejected = true;
        recordTrpcWebSocketPayloadRejected();
      }
    });

    const consumeMessageBudget = (): boolean => {
      const now = Date.now();
      const admitted =
        connectionMessageWindow.consume(this.config.maxMessagesPerWindow, MESSAGE_WINDOW_MS, now) &&
        this.globalMessageWindow.consume(
          this.config.maxMessagesGlobalPerWindow,
          MESSAGE_WINDOW_MS,
          now,
        );
      if (!admitted) {
        rateLimited = true;
        clearPendingBindingFrames();
        recordTrpcWebSocketRateLimitedMessage();
        webSocket.terminate();
        return false;
      }
      return true;
    };

    const originalEmit = webSocket.emit;
    Object.defineProperty(webSocket, 'emit', {
      configurable: true,
      value: (event: string | symbol, ...args: unknown[]): boolean => {
        if (event === 'message') {
          if (rateLimited || disconnected) return false;
          const [data, isBinary] = args as [RawData, boolean];

          if (bindingPending) {
            if (!consumeMessageBudget()) return false;
            return enqueuePendingBindingFrame(data, isBinary);
          }

          if (!connectionParamsObserved) {
            // tRPC erlaubt connectionParams nur als ersten Anwendungsframe.
            // Legacy-Clients werden danach ohne wiederholtes JSON-Parsing weitergereicht.
            connectionParamsObserved = true;
            const paramsFrame = parseParticipantBindingFrame(data, isBinary);
            if (paramsFrame.recognized && paramsFrame.binding) {
              const localAdmission = this.admitLocalBinding(paramsFrame.binding);
              if (localAdmission === 'session-cap') {
                recordTrpcWebSocketSessionCapRejected();
                webSocket.close(1008, 'connection limit exceeded');
                return false;
              }
              if (localAdmission === 'participant-cap') {
                recordTrpcWebSocketParticipantCapRejected();
                webSocket.close(1008, 'connection limit exceeded');
                return false;
              }

              if (this.clusterBudget) {
                if (!consumeMessageBudget()) {
                  this.releaseLocalBinding(localAdmission);
                  return false;
                }
                if (!enqueuePendingBindingFrame(data, isBinary)) {
                  this.releaseLocalBinding(localAdmission);
                  return false;
                }
                bindingPending = true;
                const budget = this.clusterBudget;
                const reservationPromise =
                  typeof budget.admitBindingReservation === 'function'
                    ? budget.admitBindingReservation(localAdmission)
                    : budget.admitBinding(localAdmission).then((decision) => ({
                        decision,
                        reservationId: null,
                      }));
                void reservationPromise.then(({ decision: clusterDecision, reservationId }) => {
                  bindingPending = false;
                  if (disconnected || rateLimited || webSocket.readyState !== WebSocket.OPEN) {
                    clearPendingBindingFrames();
                    this.releaseLocalBinding(localAdmission);
                    if (clusterDecision === 'admitted') {
                      this.trackClusterRelease(
                        budget.releaseBinding(localAdmission, reservationId),
                      );
                    }
                    return;
                  }
                  if (clusterDecision === 'session-cap') {
                    clearPendingBindingFrames();
                    this.releaseLocalBinding(localAdmission);
                    recordTrpcWebSocketSessionCapRejected();
                    webSocket.close(1008, 'connection limit exceeded');
                    return;
                  }
                  if (clusterDecision === 'participant-cap') {
                    clearPendingBindingFrames();
                    this.releaseLocalBinding(localAdmission);
                    recordTrpcWebSocketParticipantCapRejected();
                    webSocket.close(1008, 'connection limit exceeded');
                    return;
                  }
                  activeBinding = localAdmission;
                  clusterBindingHeld = clusterDecision === 'admitted';
                  clusterBindingReservationId =
                    clusterDecision === 'admitted' ? reservationId : null;
                  recordTrpcWebSocketBindingConnected();
                  const queued = clearPendingBindingFrames();
                  for (const [queuedData, queuedIsBinary] of queued) {
                    if (disconnected || rateLimited || webSocket.readyState !== WebSocket.OPEN) {
                      break;
                    }
                    Reflect.apply(originalEmit, webSocket, ['message', queuedData, queuedIsBinary]);
                  }
                });
                return true;
              }

              activeBinding = localAdmission;
              recordTrpcWebSocketBindingConnected();
            }
          }

          if (!consumeMessageBudget()) return false;
        }
        return Reflect.apply(originalEmit, webSocket, [event, ...args]) as boolean;
      },
    });
  }

  private admitLocalBinding(binding: ActiveBinding): BindingAdmission {
    const sessionCount = this.sessionConnections.get(binding.sessionCode) ?? 0;
    if (sessionCount >= this.config.maxConnectionsPerSession) return 'session-cap';

    if (binding.participantKey) {
      const participantCount = this.participantConnections.get(binding.participantKey) ?? 0;
      if (participantCount >= this.config.maxConnectionsPerParticipant) {
        return 'participant-cap';
      }
    }

    this.sessionConnections.set(binding.sessionCode, sessionCount + 1);
    if (binding.participantKey) {
      this.participantConnections.set(
        binding.participantKey,
        (this.participantConnections.get(binding.participantKey) ?? 0) + 1,
      );
    }
    return binding;
  }

  private releaseLocalBinding(binding: ActiveBinding): void {
    const sessionRemaining = Math.max(
      0,
      (this.sessionConnections.get(binding.sessionCode) ?? 0) - 1,
    );
    if (sessionRemaining === 0) this.sessionConnections.delete(binding.sessionCode);
    else this.sessionConnections.set(binding.sessionCode, sessionRemaining);

    if (binding.participantKey) {
      const participantRemaining = Math.max(
        0,
        (this.participantConnections.get(binding.participantKey) ?? 0) - 1,
      );
      if (participantRemaining === 0) this.participantConnections.delete(binding.participantKey);
      else this.participantConnections.set(binding.participantKey, participantRemaining);
    }
  }
}
