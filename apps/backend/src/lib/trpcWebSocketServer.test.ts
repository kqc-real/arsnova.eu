import type { AddressInfo } from 'node:net';
import { connect as netConnect } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTRPCProxyClient, createWSClient, wsLink } from '@trpc/client';
import { applyWSSHandler } from '@trpc/server/adapters/ws';
import WebSocket from 'ws';
import { z } from 'zod';
import { publicProcedure, router } from '../trpc';
import { TRPC_MAX_BODY_SIZE_BYTES } from './requestLimits';
import {
  DEFAULT_TRPC_WS_LIMITS,
  resolveTrpcWebSocketConfig,
  TrpcWebSocketServer,
  type TrpcWebSocketConfig,
} from './trpcWebSocketServer';
import {
  getWebSocketTelemetrySnapshot,
  resetWebSocketTelemetryForTests,
} from './websocketTelemetry';

const servers: TrpcWebSocketServer[] = [];
const sockets: WebSocket[] = [];
const trpcWsClients: Array<ReturnType<typeof createWSClient>> = [];
let resolverInvocations = 0;

const testRouter = router({
  echo: publicProcedure.input(z.object({ value: z.string() })).mutation(({ input }) => {
    resolverInvocations += 1;
    return { length: input.value.length };
  }),
  updates: publicProcedure.subscription(async function* () {
    yield { status: 'ready' as const };
  }),
  persistentUpdates: publicProcedure.subscription(async function* ({ signal }) {
    yield { status: 'ready' as const };
    await new Promise<void>((resolve) => {
      signal?.addEventListener('abort', () => resolve(), { once: true });
    });
  }),
});

function config(overrides: Partial<TrpcWebSocketConfig> = {}): TrpcWebSocketConfig {
  return {
    host: '127.0.0.1',
    port: 0,
    ...DEFAULT_TRPC_WS_LIMITS,
    ...overrides,
  };
}

async function startServer(overrides: Partial<TrpcWebSocketConfig> = {}): Promise<string> {
  const server = new TrpcWebSocketServer(config(overrides));
  applyWSSHandler({ wss: server.webSocketServer, router: testRouter });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(resolve));
  const address = server.address() as AddressInfo;
  return `ws://127.0.0.1:${address.port}`;
}

async function connect(url: string): Promise<WebSocket> {
  const socket = new WebSocket(url);
  sockets.push(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  return socket;
}

async function close(socket: WebSocket): Promise<void> {
  if (socket.readyState === WebSocket.CLOSED) return;
  const closed = new Promise<void>((resolve) => socket.once('close', () => resolve()));
  socket.close();
  await closed;
}

async function rejectedStatus(url: string): Promise<number> {
  const socket = new WebSocket(url);
  sockets.push(socket);
  return new Promise((resolve, reject) => {
    socket.once('unexpected-response', (_request, response) => {
      response.resume();
      resolve(response.statusCode ?? 0);
    });
    socket.once('open', () => reject(new Error('Upgrade wurde unerwartet akzeptiert')));
    socket.once('error', () => {
      // `unexpected-response` ist die relevante, deterministische Auswertung.
    });
  });
}

function echoMessage(id: number, value = 'ok'): string {
  return JSON.stringify({
    id,
    method: 'mutation',
    params: { path: 'echo', input: { value } },
  });
}

function connectionParamsMessage(
  sessionCode: string,
  participantId?: string,
  extra: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    method: 'connectionParams',
    data: { sessionCode, ...(participantId ? { participantId } : {}), ...extra },
  });
}

async function waitForTelemetry(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  expect(predicate()).toBe(true);
}

async function waitForResolverInvocations(expected: number): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (resolverInvocations < expected && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  expect(resolverInvocations).toBe(expected);
}

beforeEach(() => {
  resolverInvocations = 0;
  resetWebSocketTelemetryForTests();
});

afterEach(async () => {
  await Promise.all(trpcWsClients.splice(0).map((client) => client.close()));
  for (const socket of sockets.splice(0)) socket.terminate();
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe('resolveTrpcWebSocketConfig', () => {
  it('verwendet 500er-taugliche Defaults und begrenzt Env-Werte statisch', () => {
    expect(resolveTrpcWebSocketConfig({})).toMatchObject({
      maxConnections: 1_200,
      maxConnectionsPerSession: 1_100,
      maxConnectionsPerParticipant: 2,
      maxUpgradesPerMinute: 3_000,
      maxMessagesPerWindow: 120,
      maxMessagesGlobalPerWindow: 30_000,
    });
    expect(
      resolveTrpcWebSocketConfig({
        TRPC_WS_MAX_CONNECTIONS: '999999',
        TRPC_WS_MAX_CONNECTIONS_PER_SESSION: '999999',
        TRPC_WS_MAX_CONNECTIONS_PER_PARTICIPANT: '999999',
        TRPC_WS_MAX_UPGRADES_PER_MINUTE: '999999',
        TRPC_WS_MAX_MESSAGES_PER_10_SECONDS: '999999',
        TRPC_WS_MAX_MESSAGES_GLOBAL_PER_10_SECONDS: '999999',
      }),
    ).toMatchObject({
      maxConnections: 5_000,
      maxConnectionsPerSession: 5_000,
      maxConnectionsPerParticipant: 10,
      maxUpgradesPerMinute: 30_000,
      maxMessagesPerWindow: 1_200,
      maxMessagesGlobalPerWindow: 300_000,
    });
    expect(
      resolveTrpcWebSocketConfig({
        TRPC_WS_MAX_CONNECTIONS_PER_SESSION: '100',
      }).maxConnectionsPerSession,
    ).toBe(750);
  });
});

describe('TrpcWebSocketServer', () => {
  it('bindet einen gültigen Session-Code und eine Participant-UUID genau einmal pro Socket', async () => {
    const url = await startServer();
    const socket = await connect(url);

    socket.send(connectionParamsMessage('abc123', '11111111-1111-4111-8111-111111111111'));
    await waitForTelemetry(() => getWebSocketTelemetrySnapshot().trpcBoundConnectionsActive === 1);

    socket.send(echoMessage(1));
    socket.send(echoMessage(2));
    await waitForResolverInvocations(2);
    expect(getWebSocketTelemetrySnapshot()).toMatchObject({
      trpcBoundConnectionsActive: 1,
      trpcSessionConnectionLimit: 1_100,
      trpcParticipantConnectionLimit: 2,
    });
  });

  it('beendet nur die dritte Verbindung desselben Participants', async () => {
    const url = await startServer({ maxConnectionsPerParticipant: 2 });
    const participantId = '11111111-1111-4111-8111-111111111111';
    const first = await connect(url);
    const second = await connect(url);
    const third = await connect(url);
    first.send(connectionParamsMessage('ABC123', participantId));
    second.send(connectionParamsMessage('ABC123', participantId));
    await waitForTelemetry(() => getWebSocketTelemetrySnapshot().trpcBoundConnectionsActive === 2);
    const thirdClosed = new Promise<number>((resolve) =>
      third.once('close', (code) => resolve(code)),
    );
    third.send(connectionParamsMessage('ABC123', participantId));

    await expect(thirdClosed).resolves.toBe(1008);
    expect(first.readyState).toBe(WebSocket.OPEN);
    expect(second.readyState).toBe(WebSocket.OPEN);
    expect(getWebSocketTelemetrySnapshot().trpcParticipantCapRejectedLastMinute).toBe(1);
  });

  it('blockiert zwei Participants derselben NAT-IP nicht gegenseitig', async () => {
    const url = await startServer({ maxConnectionsPerParticipant: 1 });
    const first = await connect(url);
    const second = await connect(url);
    first.send(connectionParamsMessage('ABC123', '11111111-1111-4111-8111-111111111111'));
    second.send(connectionParamsMessage('ABC123', '22222222-2222-4222-8222-222222222222'));

    await waitForTelemetry(() => getWebSocketTelemetrySnapshot().trpcBoundConnectionsActive === 2);
    expect(first.readyState).toBe(WebSocket.OPEN);
    expect(second.readyState).toBe(WebSocket.OPEN);
  });

  it('erzwingt das großzügige Session-Cap über verschiedene Participants', async () => {
    const url = await startServer({ maxConnectionsPerSession: 2 });
    const first = await connect(url);
    const second = await connect(url);
    const third = await connect(url);
    first.send(connectionParamsMessage('ABC123', '11111111-1111-4111-8111-111111111111'));
    second.send(connectionParamsMessage('ABC123', '22222222-2222-4222-8222-222222222222'));
    await waitForTelemetry(() => getWebSocketTelemetrySnapshot().trpcBoundConnectionsActive === 2);
    const thirdClosed = new Promise<number>((resolve) =>
      third.once('close', (code) => resolve(code)),
    );
    third.send(connectionParamsMessage('ABC123', '33333333-3333-4333-8333-333333333333'));

    await expect(thirdClosed).resolves.toBe(1008);
    expect(getWebSocketTelemetrySnapshot().trpcSessionCapRejectedLastMinute).toBe(1);
  });

  it('gibt Session- und Participant-Zähler nach Close exakt frei', async () => {
    const url = await startServer({
      maxConnectionsPerSession: 1,
      maxConnectionsPerParticipant: 1,
    });
    const participantId = '11111111-1111-4111-8111-111111111111';
    const first = await connect(url);
    first.send(connectionParamsMessage('ABC123', participantId));
    await waitForTelemetry(() => getWebSocketTelemetrySnapshot().trpcBoundConnectionsActive === 1);
    await close(first);
    await waitForTelemetry(() => getWebSocketTelemetrySnapshot().trpcBoundConnectionsActive === 0);

    const second = await connect(url);
    second.send(connectionParamsMessage('ABC123', participantId));
    await waitForTelemetry(() => getWebSocketTelemetrySnapshot().trpcBoundConnectionsActive === 1);
    expect(second.readyState).toBe(WebSocket.OPEN);
  });

  it('gibt beim Sessionwechsel A frei und bindet den neuen physischen Socket an B', async () => {
    const url = await startServer({ maxConnectionsPerSession: 1 });
    const first = await connect(url);
    first.send(connectionParamsMessage('AAA111', '11111111-1111-4111-8111-111111111111'));
    await waitForTelemetry(() => getWebSocketTelemetrySnapshot().trpcBoundConnectionsActive === 1);
    await close(first);
    await waitForTelemetry(() => getWebSocketTelemetrySnapshot().trpcBoundConnectionsActive === 0);

    const second = await connect(url);
    second.send(connectionParamsMessage('BBB222', '22222222-2222-4222-8222-222222222222'));
    await waitForTelemetry(() => getWebSocketTelemetrySnapshot().trpcBoundConnectionsActive === 1);

    expect(second.readyState).toBe(WebSocket.OPEN);
    expect(getWebSocketTelemetrySnapshot()).toMatchObject({
      trpcBoundConnectionsActive: 1,
      trpcSessionCapRejectedLastMinute: 0,
      trpcParticipantCapRejectedLastMinute: 0,
    });
  });

  it('erhält eine aktive tRPC-Subscription beim Transport-Reconnect mit neuem Binding', async () => {
    const url = await startServer({ maxConnectionsPerSession: 1 });
    let binding = {
      sessionCode: 'AAA111',
      participantId: '11111111-1111-4111-8111-111111111111',
    };
    const client = createWSClient({
      url,
      WebSocket: WebSocket as unknown as typeof globalThis.WebSocket,
      connectionParams: () => binding,
      retryDelayMs: () => 0,
      lazy: { enabled: true, closeMs: 60_000 },
    });
    trpcWsClients.push(client);
    const trpc = createTRPCProxyClient<typeof testRouter>({
      links: [wsLink({ client })],
    });
    let dataEvents = 0;
    let subscriptionErrors = 0;
    const subscription = trpc.persistentUpdates.subscribe(undefined, {
      onData() {
        dataEvents += 1;
      },
      onError() {
        subscriptionErrors += 1;
      },
    });
    await waitForTelemetry(
      () => dataEvents === 1 && getWebSocketTelemetrySnapshot().trpcBoundConnectionsActive === 1,
    );
    const previousConnectionId = client.connection?.id;

    binding = {
      sessionCode: 'BBB222',
      participantId: '22222222-2222-4222-8222-222222222222',
    };
    client.connection?.ws.close(3001, 'binding changed');

    await waitForTelemetry(
      () =>
        dataEvents >= 2 &&
        client.connection?.id !== previousConnectionId &&
        getWebSocketTelemetrySnapshot().trpcBoundConnectionsActive === 1,
    );
    expect(subscriptionErrors).toBe(0);

    // A muss nach dem Close freigegeben sein, obwohl dieselbe Subscription
    // auf der neuen, an B gebundenen Verbindung weiterläuft.
    const newSessionAClient = await connect(url);
    newSessionAClient.send(
      connectionParamsMessage('AAA111', '33333333-3333-4333-8333-333333333333'),
    );
    await waitForTelemetry(() => getWebSocketTelemetrySnapshot().trpcBoundConnectionsActive === 2);
    expect(newSessionAClient.readyState).toBe(WebSocket.OPEN);
    subscription.unsubscribe();
  });

  it('behandelt ungültige Binding-Signale fail-safe und verarbeitet normale Frames weiter', async () => {
    const url = await startServer();
    const socket = await connect(url);
    socket.send(connectionParamsMessage('TOO-LONG', 'not-a-uuid'));
    socket.send(echoMessage(1));

    await waitForResolverInvocations(1);
    expect(getWebSocketTelemetrySnapshot().trpcBoundConnectionsActive).toBe(0);
    expect(socket.readyState).toBe(WebSocket.OPEN);
  });

  it('bleibt für Legacy-Clients ohne connectionParams kompatibel', async () => {
    const url = await startServer();
    const socket = await connect(url);
    socket.send(echoMessage(1));

    await waitForResolverInvocations(1);
    expect(getWebSocketTelemetrySnapshot().trpcBoundConnectionsActive).toBe(0);
  });

  it('weist Verbindungen oberhalb des globalen Caps vor dem Upgrade mit 503 ab', async () => {
    const url = await startServer({ maxConnections: 1 });
    await connect(url);

    await expect(rejectedStatus(url)).resolves.toBe(503);
    expect(getWebSocketTelemetrySnapshot()).toMatchObject({
      trpcConnectionsActive: 1,
      trpcConnectionLimit: 1,
      trpcRejectedUpgradesLastMinute: 1,
    });
  });

  it('gibt Pending-Slots nach abgelehnten Handshakes wieder frei', async () => {
    const url = await startServer({ maxConnections: 1 });
    const port = Number(new URL(url).port);

    // Ungültiger Sec-WebSocket-Key: `ws` bricht den Handshake ab, ohne den
    // Success-Callback zu rufen. Ohne Close/Error-Release bliebe der Slot belegt.
    await new Promise<void>((resolve, reject) => {
      const socket = netConnect({ host: '127.0.0.1', port }, () => {
        socket.write(
          'GET / HTTP/1.1\r\n' +
            'Host: 127.0.0.1\r\n' +
            'Upgrade: websocket\r\n' +
            'Connection: Upgrade\r\n' +
            'Sec-WebSocket-Key: invalid\r\n' +
            'Sec-WebSocket-Version: 13\r\n' +
            '\r\n',
        );
      });
      let settled = false;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        resolve();
      };
      socket.once('data', (chunk) => {
        expect(chunk.toString('utf8')).toContain('400');
        socket.end();
      });
      socket.once('close', finish);
      socket.once('error', finish);
      socket.setTimeout(2_000, () => {
        socket.destroy();
        reject(new Error('Malformed-Upgrade-Handshake timeout'));
      });
    });
    // Ein Tick, damit der Server-Socket Close/Error den Pending-Slot freigibt.
    await new Promise((resolve) => setImmediate(resolve));

    const legitimate = await connect(url);
    expect(legitimate.readyState).toBe(WebSocket.OPEN);
    expect(getWebSocketTelemetrySnapshot()).toMatchObject({
      trpcConnectionsActive: 1,
      trpcRejectedUpgradesLastMinute: 0,
    });
  });

  it('weist eine Upgrade-Welle oberhalb des globalen Minutenbudgets mit 429 ab', async () => {
    const url = await startServer({ maxUpgradesPerMinute: 2 });
    await close(await connect(url));
    await close(await connect(url));

    await expect(rejectedStatus(url)).resolves.toBe(429);
    expect(getWebSocketTelemetrySnapshot().trpcRejectedUpgradesLastMinute).toBe(1);
  });

  it('stoppt den überschreitenden Frame vor dem tRPC-Resolver', async () => {
    const url = await startServer({ maxMessagesPerWindow: 2 });
    const socket = await connect(url);
    const closed = new Promise<number>((resolve) => socket.once('close', (code) => resolve(code)));

    socket.send(echoMessage(1));
    socket.send(echoMessage(2));
    socket.send(echoMessage(3));

    await expect(closed).resolves.toBe(1006);
    expect(resolverInvocations).toBe(2);
    expect(getWebSocketTelemetrySnapshot().trpcRateLimitedMessagesLastMinute).toBe(1);
  });

  it('erzwingt das globale Nachrichtenbudget über mehrere Verbindungen', async () => {
    const url = await startServer({ maxMessagesGlobalPerWindow: 2 });
    const first = await connect(url);
    const second = await connect(url);
    const firstClosed = new Promise<number>((resolve) =>
      first.once('close', (code) => resolve(code)),
    );

    first.send(echoMessage(1));
    second.send(echoMessage(2));
    await waitForResolverInvocations(2);
    first.send(echoMessage(3));

    await expect(firstClosed).resolves.toBe(1006);
    expect(resolverInvocations).toBe(2);
  });

  it('hält das feste 2-MiB-Payload-Cap und telemetriert die Ablehnung', async () => {
    const url = await startServer();
    const socket = await connect(url);
    const closed = new Promise<number>((resolve) => socket.once('close', (code) => resolve(code)));

    socket.send(echoMessage(1, 'x'.repeat(TRPC_MAX_BODY_SIZE_BYTES)));

    await expect(closed).resolves.toBe(1009);
    expect(resolverInvocations).toBe(0);
    expect(getWebSocketTelemetrySnapshot().trpcPayloadRejectedLastMinute).toBe(1);
  });

  it('trägt eine vollständige 500er-Reconnect-Welle mit den Defaults', async () => {
    const url = await startServer();
    const firstWave = await Promise.all(Array.from({ length: 500 }, () => connect(url)));
    await Promise.all(firstWave.map(close));

    const reconnectWave = await Promise.all(Array.from({ length: 500 }, () => connect(url)));

    expect(reconnectWave).toHaveLength(500);
    expect(getWebSocketTelemetrySnapshot()).toMatchObject({
      trpcConnectionsActive: 500,
      trpcRejectedUpgradesLastMinute: 0,
    });
  }, 20_000);
});
