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
const ADMIN_TOKEN_STORAGE_KEY = 'arsnova-admin-token';
let adminToken: string | null = null;

if (isBrowser) {
  adminToken = window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
}

/**
 * Exponential Backoff: 500ms → 1s → 2s → 4s → max 10s (Story 4.3).
 */
function retryDelayMs(attempt: number): number {
  return Math.min(500 * Math.pow(2, attempt), 10_000);
}

/** Connection state observable for UI feedback (Story 4.3). */
export type WsConnectionState = 'connected' | 'disconnected' | 'reconnecting';
type StateListener = (state: WsConnectionState) => void;
const stateListeners = new Set<StateListener>();
let currentWsState: WsConnectionState = isBrowser ? 'disconnected' : 'connected';

export function getWsConnectionState(): WsConnectionState { return currentWsState; }
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
      onOpen() { setWsState('connected'); },
      onClose() { setWsState('reconnecting'); },
    })
  : null;

if (isBrowser && wsClient) {
  setWsState('connected');
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
            url: '/trpc',
            headers() {
              return adminToken ? { 'x-admin-token': adminToken } : {};
            },
          }),
        })
      : httpBatchLink({
          url: '/trpc',
          headers() {
            return adminToken ? { 'x-admin-token': adminToken } : {};
          },
        }),
  ],
});
