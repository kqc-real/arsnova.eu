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

function authHeaders(hostToken, adminToken, diagnosticSecret) {
  return {
    ...(hostToken ? { 'x-host-token': hostToken } : {}),
    ...(adminToken ? { 'x-admin-token': adminToken } : {}),
    ...(diagnosticSecret ? { 'x-admin-diagnostic-secret': diagnosticSecret } : {}),
  };
}

export function createHttpTrpc(trpcUrl, hostToken, adminToken, diagnosticSecret) {
  const link = httpBatchLink({
    url: trpcUrl,
    headers:
      hostToken || adminToken || diagnosticSecret
        ? () => authHeaders(hostToken, adminToken, diagnosticSecret)
        : undefined,
  });
  return createTRPCProxyClient({ links: [link] });
}

export function createHttpTrpcSingle(trpcUrl, hostToken, adminToken, diagnosticSecret) {
  const link = httpLink({
    url: trpcUrl,
    headers:
      hostToken || adminToken || diagnosticSecret
        ? () => authHeaders(hostToken, adminToken, diagnosticSecret)
        : undefined,
  });
  return createTRPCProxyClient({ links: [link] });
}

export function productionRetryDelayMs(attempt, random = Math.random) {
  const base = Math.min(500 * Math.pow(2, attempt), 10_000);
  return base + Math.floor(random() * 350);
}

function participantConnectionParams(sessionCode, participantId, extra = {}) {
  return {
    ...(sessionCode ? { sessionCode: String(sessionCode).trim().toUpperCase() } : {}),
    ...(participantId ? { participantId } : {}),
    ...extra,
  };
}

export function createHostWsTrpc(wsUrl, hostToken, sessionCode) {
  const wsClient = createWSClient({
    url: wsUrl,
    connectionParams: () =>
      participantConnectionParams(sessionCode, null, { 'x-host-token': hostToken }),
    lazy: { enabled: false, closeMs: 0 },
    retryDelayMs: productionRetryDelayMs,
  });
  const trpc = createTRPCProxyClient({
    links: [wsLink({ client: wsClient })],
  });
  return { trpc, wsClient };
}

export function createPublicWsTrpc(wsUrl, binding = {}) {
  const wsClient = createWSClient({
    url: wsUrl,
    connectionParams:
      binding.sessionCode || binding.participantId
        ? () => participantConnectionParams(binding.sessionCode, binding.participantId)
        : undefined,
    lazy: { enabled: false, closeMs: 0 },
    retryDelayMs: productionRetryDelayMs,
  });
  const trpc = createTRPCProxyClient({
    links: [wsLink({ client: wsClient })],
  });
  return { trpc, wsClient };
}
