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
const wsClient = isBrowser ? createWSClient({ url: getTrpcWsUrl() }) : null;

/**
 * tRPC-Client für das Angular-Frontend.
 * Queries/Mutations: HTTP Batch; Subscriptions: WebSocket (Story 0.2).
 * SSR: WebSocket existiert nicht in Node – nur HTTP-Link verwenden.
 */
export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    isBrowser && wsClient
      ? splitLink({
          condition: (op) => op.type === 'subscription',
          true: wsLink({ client: wsClient }),
          false: httpBatchLink({ url: '/trpc' }),
        })
      : httpBatchLink({ url: '/trpc' }),
  ],
});
