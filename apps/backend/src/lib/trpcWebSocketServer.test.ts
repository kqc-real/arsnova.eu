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
  MAX_PENDING_BINDING_BYTES_PER_CONNECTION,
  resolveTrpcWebSocketConfig,
  TrpcWebSocketServer,
  type TrpcWebSocketConfig,
} from './trpcWebSocketServer';
import {
  type ClusterBindingDecision,
  type ClusterUpgradeDecision,
  TrpcWebSocketClusterBudget,
} from './trpcWebSocketClusterBudget';
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
      sharedLimitsEnabled: false,
      maxConnections: 1_200,
      maxClusterConnections: 2_100,
      maxConnectionsPerSession: 1_100,
      maxConnectionsPerParticipant: 2,
      maxUpgradesPerMinute: 3_000,
      maxClusterUpgradesPerMinute: 6_000,
      maxMessagesPerWindow: 120,
      maxMessagesGlobalPerWindow: 30_000,
    });
    expect(
      resolveTrpcWebSocketConfig({
        TRPC_WS_SHARED_LIMITS_ENABLED: 'true',
        TRPC_WS_MAX_CONNECTIONS: '999999',
        TRPC_WS_CLUSTER_MAX_CONNECTIONS: '999999',
        TRPC_WS_MAX_CONNECTIONS_PER_SESSION: '999999',
        TRPC_WS_MAX_CONNECTIONS_PER_PARTICIPANT: '999999',
        TRPC_WS_MAX_UPGRADES_PER_MINUTE: '999999',
        TRPC_WS_CLUSTER_MAX_UPGRADES_PER_MINUTE: '999999',
        TRPC_WS_MAX_MESSAGES_PER_10_SECONDS: '999999',
        TRPC_WS_MAX_MESSAGES_GLOBAL_PER_10_SECONDS: '999999',
      }),
    ).toMatchObject({
      sharedLimitsEnabled: true,
      maxConnections: 5_000,
      maxClusterConnections: 10_000,
      maxConnectionsPerSession: 5_000,
      maxConnectionsPerParticipant: 10,
      maxUpgradesPerMinute: 30_000,
      maxClusterUpgradesPerMinute: 60_000,
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

  it('erzwingt gemeinsame Cluster-Caps über zwei Server-Instanzen und puffert frühe Frames geordnet', async () => {
    const sharedState = {
      openConnections: 0,
      upgrades: 0,
      sessions: new Map<string, number>(),
      participants: new Map<string, number>(),
    };

    const createFakeClusterBudget = (limits: {
      maxClusterConnections: number;
      maxClusterUpgradesPerMinute: number;
      maxConnectionsPerSession: number;
      maxConnectionsPerParticipant: number;
    }): TrpcWebSocketClusterBudget =>
      ({
        instanceId: 'fake',
        start: () => undefined,
        refreshLease: async () => undefined,
        admitUpgrade: async (): Promise<ClusterUpgradeDecision> => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          if (sharedState.upgrades >= limits.maxClusterUpgradesPerMinute) return 'rate-limited';
          if (sharedState.openConnections >= limits.maxClusterConnections) return 'connection-cap';
          sharedState.upgrades += 1;
          sharedState.openConnections += 1;
          return 'admitted';
        },
        releaseConnection: async () => {
          sharedState.openConnections = Math.max(0, sharedState.openConnections - 1);
        },
        admitBinding: async (binding: {
          sessionCode: string;
          participantKey: string | null;
        }): Promise<ClusterBindingDecision> => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          const sessionCount = sharedState.sessions.get(binding.sessionCode) ?? 0;
          if (sessionCount >= limits.maxConnectionsPerSession) return 'session-cap';
          if (binding.participantKey) {
            const partCount = sharedState.participants.get(binding.participantKey) ?? 0;
            if (partCount >= limits.maxConnectionsPerParticipant) return 'participant-cap';
          }
          sharedState.sessions.set(binding.sessionCode, sessionCount + 1);
          if (binding.participantKey) {
            sharedState.participants.set(
              binding.participantKey,
              (sharedState.participants.get(binding.participantKey) ?? 0) + 1,
            );
          }
          return 'admitted';
        },
        releaseBinding: async (binding: { sessionCode: string; participantKey: string | null }) => {
          const nextS = Math.max(0, (sharedState.sessions.get(binding.sessionCode) ?? 0) - 1);
          if (nextS === 0) sharedState.sessions.delete(binding.sessionCode);
          else sharedState.sessions.set(binding.sessionCode, nextS);
          if (binding.participantKey) {
            const nextP = Math.max(
              0,
              (sharedState.participants.get(binding.participantKey) ?? 0) - 1,
            );
            if (nextP === 0) sharedState.participants.delete(binding.participantKey);
            else sharedState.participants.set(binding.participantKey, nextP);
          }
        },
        close: async () => undefined,
      }) as unknown as TrpcWebSocketClusterBudget;

    const budgetLimits = {
      maxClusterConnections: 3,
      maxClusterUpgradesPerMinute: 10,
      maxConnectionsPerSession: 3,
      maxConnectionsPerParticipant: 2,
    };
    const urlA = await startServer({
      maxConnections: 10,
      maxConnectionsPerSession: 10,
      maxConnectionsPerParticipant: 5,
      clusterBudget: createFakeClusterBudget(budgetLimits),
    });
    const urlB = await startServer({
      maxConnections: 10,
      maxConnectionsPerSession: 10,
      maxConnectionsPerParticipant: 5,
      clusterBudget: createFakeClusterBudget(budgetLimits),
    });

    const participantId = '11111111-1111-4111-8111-111111111111';
    const socketA = await connect(urlA);
    const socketB1 = await connect(urlB);

    // Sendet connectionParams + unmittelbare Mutation ohne künstliche Pause dazwischen.
    socketA.send(connectionParamsMessage('ABC123', participantId));
    socketA.send(echoMessage(1, 'hello'));
    socketB1.send(connectionParamsMessage('ABC123', participantId));
    socketB1.send(echoMessage(2, 'world'));

    await waitForResolverInvocations(2);
    expect(sharedState.openConnections).toBe(2);

    // Dritter Tab desselben Participants auf Replikat B wird trotz lokalem Limit 5 mit 1008 abgewiesen;
    // die direkt mitgesendete Mutation erreicht den Resolver nicht.
    const socketB2 = await connect(urlB);
    const thirdClosed = new Promise<number>((resolve) =>
      socketB2.once('close', (code) => resolve(code)),
    );
    socketB2.send(connectionParamsMessage('ABC123', participantId));
    socketB2.send(echoMessage(3, 'blocked'));
    await expect(thirdClosed).resolves.toBe(1008);
    expect(resolverInvocations).toBe(2);

    // Nach Close von socketB2 sind wieder 2 globale Verbindungen aktiv -> 3. Verbindung erlaubt, 4. mit 503 abgewiesen.
    await waitForTelemetry(() => sharedState.openConnections === 2);
    const extraOpen = await connect(urlA);
    expect(extraOpen.readyState).toBe(WebSocket.OPEN);
    await expect(rejectedStatus(urlB)).resolves.toBe(503);

    await close(socketA);
    await close(socketB1);
    await close(extraOpen);
    await waitForTelemetry(() => sharedState.openConnections === 0);
    expect(sharedState.participants.size).toBe(0);
    expect(sharedState.sessions.size).toBe(0);
  });

  it('begrenzt ausstehende Binding-Frames auch nach Bytevolumen und gibt Bytezähler vollständig frei', async () => {
    const bindingGate: { release: (() => void) | null } = { release: null };
    let releasedBindings = 0;

    const delayedBudget = {
      instanceId: 'byte-guard',
      start: () => undefined,
      refreshLease: async () => undefined,
      admitUpgradeReservation: async () => ({
        decision: 'admitted' as const,
        reservationId: 'upg-1',
      }),
      admitUpgrade: async () => 'admitted' as const,
      releaseConnection: async () => undefined,
      admitBindingReservation: async () => {
        if (bindingGate.release === null) {
          await new Promise<void>((resolve) => {
            bindingGate.release = resolve;
          });
        }
        return { decision: 'admitted' as const, reservationId: 'bind-1' };
      },
      admitBinding: async () => 'admitted' as const,
      releaseBinding: async () => {
        releasedBindings += 1;
      },
      close: async () => undefined,
    } as unknown as TrpcWebSocketClusterBudget;

    const url = await startServer({ clusterBudget: delayedBudget });
    const socket = await connect(url);
    const closed = new Promise<number>((resolve) => socket.once('close', (code) => resolve(code)));

    const participantId = '22222222-2222-4222-8222-222222222222';
    socket.send(connectionParamsMessage('ABC123', participantId));
    // Überschreitet das 64-KiB-Pending-Bytebudget während admitBinding noch wartet (unterhalb des 2-MiB-Frame-Caps).
    socket.send(echoMessage(1, 'x'.repeat(MAX_PENDING_BINDING_BYTES_PER_CONNECTION)));

    await expect(closed).resolves.toBe(1009);
    expect(resolverInvocations).toBe(0);
    expect(getWebSocketTelemetrySnapshot().trpcPayloadRejectedLastMinute).toBe(1);

    // Nach verspäteter Auflösung der ausstehenden Reservierung wird auch die Cluster-Bindung freigegeben.
    bindingGate.release?.();
    await waitForTelemetry(() => releasedBindings === 1);

    // Folgeverbindungen können reguläre frühe Frames problemlos puffern (kein geleakter Global-Bytezähler).
    const healthySocket = await connect(url);
    healthySocket.send(connectionParamsMessage('ABC123', participantId));
    healthySocket.send(echoMessage(2, 'ok'));
    await waitForResolverInvocations(1);
    await close(healthySocket);
  });

  it('schließt noch ausstehende Upgrade-Sockets bei server.close() sofort ohne Hänger und gibt späte Zulassungen frei', async () => {
    const upgradeGate: {
      resolve:
        ((res: { decision: ClusterUpgradeDecision; reservationId: string | null }) => void) | null;
    } = { resolve: null };
    let upgradeEntered!: () => void;
    const enteredPromise = new Promise<void>((resolve) => {
      upgradeEntered = resolve;
    });
    let releasedConnections = 0;
    let budgetClosed = false;

    const slowUpgradeBudget = {
      instanceId: 'shutdown-guard',
      start: () => undefined,
      refreshLease: async () => undefined,
      admitUpgradeReservation: () => {
        upgradeEntered();
        return new Promise<{ decision: ClusterUpgradeDecision; reservationId: string | null }>(
          (resolve) => {
            upgradeGate.resolve = resolve;
          },
        );
      },
      admitUpgrade: async () => 'admitted' as const,
      releaseConnection: async () => {
        releasedConnections += 1;
      },
      admitBinding: async () => 'admitted' as const,
      releaseBinding: async () => undefined,
      close: async () => {
        budgetClosed = true;
      },
    } as unknown as TrpcWebSocketClusterBudget;

    const server = new TrpcWebSocketServer(config({ clusterBudget: slowUpgradeBudget }));
    applyWSSHandler({ wss: server.webSocketServer, router: testRouter });
    await new Promise<void>((resolve) => server.listen(resolve));
    const port = (server.address() as AddressInfo).port;

    const rawResponseChunks: Buffer[] = [];
    const clientSocketClosed = new Promise<void>((resolve) => {
      const tcpSocket = netConnect({ host: '127.0.0.1', port }, () => {
        tcpSocket.write(
          'GET / HTTP/1.1\r\n' +
            'Host: 127.0.0.1\r\n' +
            'Upgrade: websocket\r\n' +
            'Connection: Upgrade\r\n' +
            'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n' +
            'Sec-WebSocket-Version: 13\r\n' +
            '\r\n',
        );
      });
      tcpSocket.on('data', (chunk) => rawResponseChunks.push(Buffer.from(chunk)));
      tcpSocket.once('close', () => resolve());
      tcpSocket.on('error', () => resolve());
    });

    await enteredPromise;

    // Shutdown startet während admitUpgradeReservation noch aussteht.
    const closePromise = server.close();

    // Der ausstehende Upgrade-Socket wird sofort mit 503 geschlossen statt offen zu hängen.
    await clientSocketClosed;
    expect(Buffer.concat(rawResponseChunks).toString('utf8')).toContain('503');

    // Sobald das ausstehende Redis-Upgrade verspätet 'admitted' meldet, räumt close() die Reservierung frei und kehrt zurück.
    upgradeGate.resolve?.({ decision: 'admitted', reservationId: 'late-upg-1' });
    await closePromise;

    expect(releasedConnections).toBe(1);
    expect(budgetClosed).toBe(true);
  });

  it('hinterlässt nach Redis-Timeout mit späterem EVAL-Erfolg und Socket-Close keine Geisterreservierungen', async () => {
    let delayEval = true;
    const strings = new Map<string, string>();
    const hashes = new Map<string, Map<string, number>>();
    const zsets = new Map<string, Map<string, number>>();

    const hincrby = (key: string, field: string, delta: number): number => {
      const h = hashes.get(key) ?? new Map<string, number>();
      const next = (h.get(field) ?? 0) + delta;
      h.set(field, next);
      hashes.set(key, h);
      return next;
    };
    const hdel = (key: string, field: string): void => {
      const h = hashes.get(key);
      if (!h) return;
      h.delete(field);
      if (h.size === 0) hashes.delete(key);
    };
    const sumHash = (key: string): number => {
      const h = hashes.get(key);
      if (!h) return 0;
      let sum = 0;
      for (const v of h.values()) sum += v;
      return sum;
    };

    const budget = new TrpcWebSocketClusterBudget({
      instanceId: 'ws-timeout-e2e',
      maxClusterConnections: 2,
      maxClusterUpgradesPerMinute: 30,
      maxConnectionsPerSession: 4,
      maxConnectionsPerParticipant: 2,
      operationTimeoutMs: 25,
      redisProvider: () => ({
        zadd: (async (key: string, score: number, member: string) => {
          const z = zsets.get(key) ?? new Map<string, number>();
          z.set(member, Number(score));
          zsets.set(key, z);
          return 1;
        }) as never,
        pexpire: (async () => 1) as never,
        eval: (async (script: string, numKeys: number, ...rest: string[]) => {
          const keys = rest.slice(0, numKeys);
          const argv = rest.slice(numKeys);
          const isAdmit =
            script.includes('return activeConnections + 1') || script.includes('maxSession');
          let result = 1;

          if (script.includes('return activeConnections + 1')) {
            const globalKey = keys[1]!;
            const resKey = keys[8]!;
            const inst = argv[0]!;
            const maxConn = Number(argv[4]);
            const state = strings.get(resKey);
            if (state === 'released') result = -3;
            else if (state === 'admitted') result = 1;
            else if (sumHash(globalKey) >= maxConn) result = -2;
            else {
              strings.set(resKey, 'admitted');
              hincrby(globalKey, inst, 1);
              result = sumHash(globalKey);
            }
          } else if (script.includes('maxSession')) {
            const resKey = keys[1]!;
            const sessKey = keys[2]!;
            const partKey = keys[3];
            const inst = argv[0]!;
            const maxPart = Number(argv[4]);
            const state = strings.get(resKey);
            if (state === 'released') result = -3;
            else if (state === 'admitted') result = 1;
            else if (partKey && sumHash(partKey) >= maxPart) result = -2;
            else {
              strings.set(resKey, 'admitted');
              hincrby(sessKey, inst, 1);
              if (partKey) hincrby(partKey, inst, 1);
              result = 1;
            }
          } else if (script.includes('hasReservation')) {
            const inst = argv[0]!;
            const resKey = keys[0]!;
            const state = strings.get(resKey);
            if (state === 'released') result = 0;
            else {
              strings.set(resKey, 'released');
              if (state === 'admitted') {
                for (let i = 1; i < keys.length; i += 1) {
                  if (hincrby(keys[i]!, inst, -1) <= 0) hdel(keys[i]!, inst);
                }
              }
            }
          } else if (script.includes('ZREM')) {
            hdel(keys[1]!, argv[0]!);
          } else {
            const globalKey = keys[0]!;
            const resKey = keys[1];
            const inst = argv[0]!;
            if (resKey) {
              const state = strings.get(resKey);
              if (state !== 'released') {
                strings.set(resKey, 'released');
                if (state === 'admitted' && hincrby(globalKey, inst, -1) <= 0) {
                  hdel(globalKey, inst);
                }
              }
            }
          }

          if (isAdmit && delayEval) {
            await new Promise((resolve) => setTimeout(resolve, 75));
          }
          return result;
        }) as never,
      }),
    });

    const url = await startServer({ clusterBudget: budget });
    const participantId = '44444444-4444-4444-8444-444444444444';

    // Zwei Verbindungen während Redis-Störung: laufen in fallback-local, während EVAL verspätet bucht.
    const fallback1 = await connect(url);
    const fallback2 = await connect(url);
    fallback1.send(connectionParamsMessage('ABC123', participantId));
    fallback2.send(connectionParamsMessage('ABC123', participantId));
    fallback1.send(echoMessage(1, 'a'));
    fallback2.send(echoMessage(2, 'b'));
    await waitForResolverInvocations(2);

    await close(fallback1);
    await close(fallback2);
    await new Promise((resolve) => setTimeout(resolve, 110));
    await budget.flushPendingCompensations();

    // Nach Ende der Redis-Störung sind beide Cluster- und Participant-Slots wieder frei!
    delayEval = false;
    const reconnect1 = await connect(url);
    const reconnect2 = await connect(url);
    reconnect1.send(connectionParamsMessage('ABC123', participantId));
    reconnect2.send(connectionParamsMessage('ABC123', participantId));
    reconnect1.send(echoMessage(3, 'c'));
    reconnect2.send(echoMessage(4, 'd'));
    await waitForResolverInvocations(4);

    expect(reconnect1.readyState).toBe(WebSocket.OPEN);
    expect(reconnect2.readyState).toBe(WebSocket.OPEN);
  });

  it('kehrt bei dauerhaft ausstehenden Redis-EVAL-Antworten beim Server-Shutdown fristgerecht zurück', async () => {
    const stalledBudget = new TrpcWebSocketClusterBudget({
      instanceId: 'ws-stalled-shutdown',
      maxClusterConnections: 4,
      maxClusterUpgradesPerMinute: 30,
      maxConnectionsPerSession: 4,
      maxConnectionsPerParticipant: 2,
      operationTimeoutMs: 20,
      shutdownDrainTimeoutMs: 40,
      redisProvider: () => ({
        zadd: (() => new Promise<number>(() => {})) as never,
        pexpire: (() => new Promise<number>(() => {})) as never,
        eval: (() => new Promise<number>(() => {})) as never,
      }),
    });

    const server = new TrpcWebSocketServer(
      config({ clusterBudget: stalledBudget, shutdownDrainTimeoutMs: 60 }),
    );
    applyWSSHandler({ wss: server.webSocketServer, router: testRouter });
    await new Promise<void>((resolve) => server.listen(resolve));
    const port = (server.address() as AddressInfo).port;
    const url = `ws://127.0.0.1:${port}`;

    const client = await connect(url);
    client.send(connectionParamsMessage('ABC123', '55555555-5555-4555-8555-555555555555'));
    client.send(echoMessage(1, 'fallback'));
    await waitForResolverInvocations(1);

    const startedAt = Date.now();
    await server.close();
    expect(Date.now() - startedAt).toBeLessThan(350);
  });
});
