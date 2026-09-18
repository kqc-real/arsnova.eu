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

export function requireRejoinToken(joined, label = 'Join') {
  const token = typeof joined?.rejoinToken === 'string' ? joined.rejoinToken.trim() : '';
  if (!token) {
    throw new Error(`${label} lieferte kein rejoinToken.`);
  }
  return token;
}

function authHeaders(hostToken, adminToken, diagnosticSecret, participantCapability) {
  return {
    ...(hostToken ? { 'x-host-token': hostToken } : {}),
    ...(adminToken ? { 'x-admin-token': adminToken } : {}),
    ...(diagnosticSecret ? { 'x-admin-diagnostic-secret': diagnosticSecret } : {}),
    ...(participantCapability ? { 'x-participant-capability': participantCapability } : {}),
  };
}

export function createHttpTrpc(
  trpcUrl,
  hostToken,
  adminToken,
  diagnosticSecret,
  participantCapability,
) {
  const link = httpBatchLink({
    url: trpcUrl,
    headers:
      hostToken || adminToken || diagnosticSecret || participantCapability
        ? () => authHeaders(hostToken, adminToken, diagnosticSecret, participantCapability)
        : undefined,
  });
  return createTRPCProxyClient({ links: [link] });
}

export function createHttpTrpcSingle(
  trpcUrl,
  hostToken,
  adminToken,
  diagnosticSecret,
  participantCapability,
) {
  const link = httpLink({
    url: trpcUrl,
    headers:
      hostToken || adminToken || diagnosticSecret || participantCapability
        ? () => authHeaders(hostToken, adminToken, diagnosticSecret, participantCapability)
        : undefined,
  });
  return createTRPCProxyClient({ links: [link] });
}

export function productionRetryDelayMs(attempt, random = Math.random) {
  const base = Math.min(500 * Math.pow(2, attempt), 10_000);
  return base + Math.floor(random() * 350);
}

function participantConnectionParams(
  sessionCode,
  participantId,
  participantCapability,
  extra = {},
) {
  return {
    ...(sessionCode ? { sessionCode: String(sessionCode).trim().toUpperCase() } : {}),
    ...(participantId ? { participantId } : {}),
    ...(participantCapability ? { participantCapability } : {}),
    ...extra,
  };
}

export function createHostWsTrpc(wsUrl, hostToken, sessionCode) {
  const wsClient = createWSClient({
    url: wsUrl,
    connectionParams: () =>
      participantConnectionParams(sessionCode, null, null, { 'x-host-token': hostToken }),
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
      binding.sessionCode || binding.participantId || binding.participantCapability
        ? () =>
            participantConnectionParams(
              binding.sessionCode,
              binding.participantId,
              binding.participantCapability,
            )
        : undefined,
    lazy: { enabled: false, closeMs: 0 },
    retryDelayMs: productionRetryDelayMs,
  });
  const trpc = createTRPCProxyClient({
    links: [wsLink({ client: wsClient })],
  });
  return { trpc, wsClient };
}
