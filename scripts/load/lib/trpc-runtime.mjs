let trpcClientModule;
try {
  trpcClientModule = await import('@trpc/client');
} catch {
  trpcClientModule =
    await import('../../../apps/frontend/node_modules/@trpc/client/dist/index.mjs');
}

let wsModule;
try {
  wsModule = await import('ws');
} catch {
  wsModule = await import('../../../apps/frontend/node_modules/ws/wrapper.mjs');
}

const { createTRPCProxyClient, createWSClient, httpBatchLink, httpLink, wsLink } = trpcClientModule;
const WebSocketPonyfill = globalThis.WebSocket ?? wsModule.WebSocket ?? wsModule.default;
if (!globalThis.WebSocket && WebSocketPonyfill) {
  globalThis.WebSocket = WebSocketPonyfill;
}

function authHeaders(hostToken, adminToken) {
  return {
    ...(hostToken ? { 'x-host-token': hostToken } : {}),
    ...(adminToken ? { 'x-admin-token': adminToken } : {}),
  };
}

export function createHttpTrpc(trpcUrl, hostToken, adminToken) {
  const link = httpBatchLink({
    url: trpcUrl,
    headers: hostToken || adminToken ? () => authHeaders(hostToken, adminToken) : undefined,
  });
  return createTRPCProxyClient({ links: [link] });
}

export function createHttpTrpcSingle(trpcUrl, hostToken, adminToken) {
  const link = httpLink({
    url: trpcUrl,
    headers: hostToken || adminToken ? () => authHeaders(hostToken, adminToken) : undefined,
  });
  return createTRPCProxyClient({ links: [link] });
}

export function createHostWsTrpc(wsUrl, hostToken) {
  const wsClient = createWSClient({
    url: wsUrl,
    connectionParams: () => ({ 'x-host-token': hostToken }),
    lazy: { enabled: false, closeMs: 0 },
    retryDelayMs: () => 1_000,
  });
  const trpc = createTRPCProxyClient({
    links: [wsLink({ client: wsClient })],
  });
  return { trpc, wsClient };
}

export function createPublicWsTrpc(wsUrl) {
  const wsClient = createWSClient({
    url: wsUrl,
    lazy: { enabled: false, closeMs: 0 },
    retryDelayMs: () => 1_000,
  });
  const trpc = createTRPCProxyClient({
    links: [wsLink({ client: wsClient })],
  });
  return { trpc, wsClient };
}
