import {
  createTRPCProxyClient,
  createWSClient,
  httpBatchLink,
  splitLink,
  type TRPCLink,
  wsLink,
} from '@trpc/client';
import { observable } from '@trpc/server/observable';
import type { AppRouter } from '@arsnova/api';
import type { TrpcWebSocketParticipantBinding } from '@arsnova/shared-types';
import { getFeedbackHostToken, normalizeFeedbackCode } from './feedback-host-token';
import {
  getHostToken,
  normalizeHostSessionCode,
  setHostToken as storeHostToken,
} from './host-session-token';
import { getTrpcWsUrl } from './ws-urls';

const isBrowser = globalThis.window !== undefined;
const SUPPORTED_LOCALES = new Set(['de', 'en', 'fr', 'it', 'es']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** SSR/Prerender: relatives `/trpc` in Node nicht zuverlässig – öffentliche Produktions-API als Fallback. */
const DEFAULT_PRERENDER_TRPC_URL = 'https://arsnova.eu/trpc';

function resolveTrpcBatchLinkUrl(): string {
  if (isBrowser) {
    return new URL('/trpc', globalThis.window.location.origin).toString();
  }
  const fromEnv =
    typeof process !== 'undefined' && process.env
      ? process.env['ARSNOVA_PRERENDER_TRPC_URL']
      : undefined;
  if (fromEnv && String(fromEnv).trim()) {
    return String(fromEnv).trim();
  }
  return DEFAULT_PRERENDER_TRPC_URL;
}
const ADMIN_TOKEN_STORAGE_KEY = 'arsnova-admin-token';
let adminToken: string | null = null;
let pendingHostSessionCode: string | null = null;

function getRouteSegments(): string[] {
  if (!isBrowser) {
    return [];
  }

  const segments = globalThis.window.location.pathname.split('/').filter(Boolean);
  if (segments[0] && SUPPORTED_LOCALES.has(segments[0])) {
    return segments.slice(1);
  }
  return segments;
}

function normalizeRouteCode(
  code: string | undefined,
  normalize: (value: string) => string,
): string | null {
  if (!code || !/^[a-zA-Z0-9]{6}$/.test(code)) {
    return null;
  }
  return normalize(code);
}

function resolveRouteHostSessionCode(): string | null {
  const segments = getRouteSegments();
  if (segments[2] !== 'host' && segments[2] !== 'present') {
    return null;
  }

  return resolveRouteSessionCode();
}

function resolveRouteSessionCode(): string | null {
  const segments = getRouteSegments();
  if (segments[0] !== 'session') {
    return null;
  }
  return normalizeRouteCode(segments[1], normalizeHostSessionCode);
}

function resolveRouteFeedbackCode(): string | null {
  const segments = getRouteSegments();
  if (segments[0] !== 'feedback') {
    return null;
  }

  return normalizeRouteCode(segments[1], normalizeFeedbackCode);
}

function resolveActiveHostToken(): string | null {
  const hostSessionCode = resolveRouteHostSessionCode() ?? pendingHostSessionCode;
  if (!hostSessionCode) {
    return null;
  }
  return getHostToken(hostSessionCode);
}

function createTrpcHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};

  if (adminToken) {
    headers['x-admin-token'] = adminToken;
  }

  const hostToken = resolveActiveHostToken();
  if (hostToken) {
    headers['x-host-token'] = hostToken;
  }

  const feedbackCode = resolveRouteFeedbackCode();
  if (feedbackCode) {
    const feedbackHostToken = getFeedbackHostToken(feedbackCode);
    if (feedbackHostToken) {
      headers['x-feedback-host-token'] = feedbackHostToken;
    }
  }

  return headers;
}

function resolveWsParticipantBinding(): TrpcWebSocketParticipantBinding | null {
  const sessionCode = resolveRouteSessionCode();
  const storedParticipantId = sessionCode
    ? globalThis.window.localStorage.getItem(`arsnova-participant-${sessionCode}`)
    : null;
  return sessionCode
    ? {
        sessionCode,
        ...(storedParticipantId && UUID_PATTERN.test(storedParticipantId)
          ? { participantId: storedParticipantId }
          : {}),
      }
    : null;
}

export function createWsBindingFingerprint(
  binding: TrpcWebSocketParticipantBinding | null,
): string | null {
  return binding ? `${binding.sessionCode}:${binding.participantId ?? ''}` : null;
}

function createWsConnectionParams(): Record<string, string> | null {
  const feedbackCode = resolveRouteFeedbackCode();
  const feedbackHostToken = feedbackCode ? getFeedbackHostToken(feedbackCode) : null;
  const hostToken = resolveActiveHostToken();
  const participantBinding = resolveWsParticipantBinding();
  if (!hostToken && !feedbackHostToken && !participantBinding) {
    return null;
  }

  return {
    ...(participantBinding ?? {}),
    ...(hostToken ? { 'x-host-token': hostToken } : {}),
    ...(feedbackHostToken ? { 'x-feedback-host-token': feedbackHostToken } : {}),
  };
}

if (isBrowser) {
  adminToken = globalThis.window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
}

/**
 * Exponential Backoff: 500ms → 1s → 2s → 4s → max 10s (Story 4.3).
 * Zufalls-Jitter (0–349ms) entkoppelt Reconnects nach Deploy — weniger Lastspitze auf dem Server.
 * Nach Deploy: siehe docs/deployment-debian-root-server.md § 7.1.
 */
export function retryDelayMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(500 * Math.pow(2, attempt), 10_000);
  const jitter = Math.floor(random() * 350);
  return base + jitter;
}

/** Connection state observable for UI feedback (Story 4.3). */
export type WsConnectionState = 'connected' | 'disconnected' | 'reconnecting' | 'idle';
type StateListener = (state: WsConnectionState) => void;
const stateListeners = new Set<StateListener>();
/** Browser + Lazy-WS: tRPC startet in `idle` (noch keine Subscription). */
let currentWsState: WsConnectionState = isBrowser ? 'idle' : 'connected';

export function getWsConnectionState(): WsConnectionState {
  return currentWsState;
}
export function onWsStateChange(fn: StateListener): () => void {
  stateListeners.add(fn);
  return () => stateListeners.delete(fn);
}

function setWsState(state: WsConnectionState): void {
  if (state === currentWsState) return;
  currentWsState = state;
  stateListeners.forEach((fn) => fn(state));
}

export function setAdminToken(token: string | null): void {
  adminToken = token?.trim() || null;
  if (!isBrowser) return;
  if (adminToken) {
    globalThis.window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, adminToken);
  } else {
    globalThis.window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  }
}

export function getAdminToken(): string | null {
  return adminToken;
}

export function setHostToken(sessionCode: string, token: string | null): void {
  storeHostToken(sessionCode, token);
}

export function setPendingHostSessionCode(sessionCode: string | null): void {
  pendingHostSessionCode = sessionCode ? normalizeHostSessionCode(sessionCode) : null;
}

export function clearPendingHostSessionCode(): void {
  pendingHostSessionCode = null;
}

let activeWsBindingFingerprint = createWsBindingFingerprint(
  isBrowser ? resolveWsParticipantBinding() : null,
);
let bindingRefreshPromise: Promise<void> = Promise.resolve();
const wsClient = isBrowser
  ? createWSClient({
      url: getTrpcWsUrl(),
      connectionParams: createWsConnectionParams,
      retryDelayMs,
      /** Erst bei erster Subscription verbinden – vermeidet Konsolen-Fehler ohne Backend (z. B. Lighthouse). */
      lazy: { enabled: true, closeMs: 60_000 },
    })
  : null;

/**
 * Schließt eine wiederverwendete physische Verbindung kontrolliert, sobald
 * SPA-Route oder lokal gespeicherte Participant-ID ein anderes Binding ergeben.
 * Der nächste Subscription-Start öffnet den lazy Client mit frischen Params.
 */
export function refreshTrpcWsBinding(): boolean {
  if (!wsClient) return false;
  const nextFingerprint = createWsBindingFingerprint(resolveWsParticipantBinding());
  if (nextFingerprint === activeWsBindingFingerprint) return false;
  activeWsBindingFingerprint = nextFingerprint;
  bindingRefreshPromise = bindingRefreshPromise
    .catch(() => undefined)
    .then(() => reconnectWsForBindingChange());
  return true;
}

function reconnectWsForBindingChange(): Promise<void> {
  if (!wsClient) return Promise.resolve();
  const connection = wsClient.connection;
  if (!connection || connection.state === 'closed') return Promise.resolve();
  if (connection.state === 'connecting') {
    return new Promise<void>((resolve) => {
      let subscription: { unsubscribe(): void } | null = null;
      subscription = wsClient.connectionState.subscribe({
        next(state) {
          if (state.state !== 'pending' && state.state !== 'idle') return;
          queueMicrotask(() => {
            subscription?.unsubscribe();
            void reconnectWsForBindingChange().then(resolve);
          });
        },
      });
    });
  }

  return new Promise<void>((resolve) => {
    const previousConnectionId = connection.id;
    let closeObserved = false;
    let settled = false;
    let stateSubscription: { unsubscribe(): void } | null = null;

    const finish = (): void => {
      if (settled) return;
      settled = true;
      stateSubscription?.unsubscribe();
      resolve();
    };

    stateSubscription = wsClient.connectionState.subscribe({
      next(state) {
        if (
          closeObserved &&
          state.state === 'pending' &&
          wsClient.connection?.id !== previousConnectionId
        ) {
          finish();
        }
      },
    });

    connection.ws.addEventListener(
      'close',
      () => {
        closeObserved = true;
        queueMicrotask(() => {
          // Ohne aktive Subscription reconnectet der lazy Client nicht selbst.
          // Dann darf die wartende neue Operation den frischen Socket öffnen.
          if (wsClient.connectionState.get().state !== 'connecting') finish();
        });
      },
      { once: true },
    );
    // Nur den Transport schließen: `WsClient.close()` würde aktive
    // Subscription-Requests abschließen statt sie beim Reconnect erneut zu senden.
    connection.ws.close(3001, 'binding changed');
  });
}

async function waitForBindingRefresh(): Promise<void> {
  let pending: Promise<void>;
  do {
    pending = bindingRefreshPromise;
    await pending;
  } while (pending !== bindingRefreshPromise);
}

const bindingAwareWsLink: TRPCLink<AppRouter> | null = wsClient
  ? (runtime) => {
      const execute = wsLink<AppRouter>({ client: wsClient })(runtime);
      return ({ op, next }) =>
        observable((observer) => {
          let subscription: { unsubscribe(): void } | null = null;
          let cancelled = false;
          void waitForBindingRefresh().then(() => {
            if (cancelled) return;
            subscription = execute({ op, next }).subscribe(observer);
          });
          return () => {
            cancelled = true;
            subscription?.unsubscribe();
          };
        });
    }
  : null;

/**
 * UI-Status aus tRPC `connectionState` ableiten (nicht nur WS onClose):
 * Nach Lazy-Close ohne Subscriptions bleibt der Client `idle` — kein „Reconnect läuft“.
 */
if (wsClient) {
  wsClient.connectionState.subscribe({
    next(cs) {
      if (cs.state === 'idle') {
        setWsState('idle');
        return;
      }
      if (cs.state === 'pending') {
        setWsState('connected');
        return;
      }
      if (cs.state === 'connecting') {
        setWsState(cs.error === null ? 'disconnected' : 'reconnecting');
      }
    },
  });
}

/**
 * tRPC-Client für das Angular-Frontend.
 * Queries/Mutations: HTTP Batch; Subscriptions: WebSocket (Story 0.2, 4.3).
 * SSR: WebSocket existiert nicht in Node – nur HTTP-Link verwenden.
 */
export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    isBrowser && wsClient && bindingAwareWsLink
      ? splitLink({
          condition: (op) => {
            if (op.type === 'subscription') refreshTrpcWsBinding();
            return op.type === 'subscription';
          },
          true: bindingAwareWsLink,
          false: httpBatchLink({
            url: resolveTrpcBatchLinkUrl(),
            headers() {
              return createTrpcHeaders();
            },
          }),
        })
      : httpBatchLink({
          url: resolveTrpcBatchLinkUrl(),
          headers() {
            return createTrpcHeaders();
          },
        }),
  ],
});
