import {
  createTRPCProxyClient,
  createWSClient,
  httpBatchLink,
  splitLink,
  wsLink,
} from '@trpc/client';
import type { AppRouter } from '@arsnova/api';
import { getFeedbackHostToken, normalizeFeedbackCode } from './feedback-host-token';
import {
  getHostToken,
  normalizeHostSessionCode,
  setHostToken as storeHostToken,
} from './host-session-token';
import { getTrpcWsUrl } from './ws-urls';

const isBrowser = globalThis.window !== undefined;
const SUPPORTED_LOCALES = new Set(['de', 'en', 'fr', 'it', 'es']);

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
  if (segments[0] !== 'session') {
    return null;
  }

  if (segments[2] !== 'host' && segments[2] !== 'present') {
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

function createWsConnectionParams(): Record<string, string> | null {
  const hostToken = resolveActiveHostToken();
  if (!hostToken) {
    return null;
  }

  return { 'x-host-token': hostToken };
}

if (isBrowser) {
  adminToken = globalThis.window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
}

/**
 * Exponential Backoff: 500ms → 1s → 2s → 4s → max 10s (Story 4.3).
 * Zufalls-Jitter (0–349ms) entkoppelt Reconnects nach Deploy — weniger Lastspitze auf dem Server.
 * Nach Deploy: siehe docs/deployment-debian-root-server.md § 7.1.
 */
function retryDelayMs(attempt: number): number {
  const base = Math.min(500 * Math.pow(2, attempt), 10_000);
  const jitter = Math.floor(Math.random() * 350);
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
    isBrowser && wsClient
      ? splitLink({
          condition: (op) => op.type === 'subscription',
          true: wsLink({ client: wsClient }),
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
