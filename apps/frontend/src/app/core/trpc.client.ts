import {
  createTRPCProxyClient,
  createWSClient,
  httpBatchLink,
  splitLink,
  wsLink,
} from '@trpc/client';
import type { AppRouter } from '@arsnova/api';
import { getTrpcWsUrl } from './ws-urls';

const isBrowser = typeof window !== 'undefined';

/** SSR/Prerender: relatives `/trpc` in Node nicht zuverlässig – öffentliche Produktions-API als Fallback. */
const DEFAULT_PRERENDER_TRPC_URL = 'https://arsnova.eu/trpc';

function resolveTrpcBatchLinkUrl(): string {
  if (isBrowser) {
    return '/trpc';
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

if (isBrowser) {
  adminToken = window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
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
    window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, adminToken);
  } else {
    window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  }
}

export function getAdminToken(): string | null {
  return adminToken;
}

const wsClient = isBrowser
  ? createWSClient({
      url: getTrpcWsUrl(),
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
        setWsState(cs.error !== null ? 'reconnecting' : 'disconnected');
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
              return adminToken ? { 'x-admin-token': adminToken } : {};
            },
          }),
        })
      : httpBatchLink({
          url: resolveTrpcBatchLinkUrl(),
          headers() {
            return adminToken ? { 'x-admin-token': adminToken } : {};
          },
        }),
  ],
});
