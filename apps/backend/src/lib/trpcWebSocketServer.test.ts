import type { AddressInfo } from 'node:net';
import { connect as netConnect } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
let resolverInvocations = 0;

const testRouter = router({
  echo: publicProcedure.input(z.object({ value: z.string() })).mutation(({ input }) => {
    resolverInvocations += 1;
    return { length: input.value.length };
  }),
  updates: publicProcedure.subscription(async function* () {
    yield { status: 'ready' as const };
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
  for (const socket of sockets.splice(0)) socket.terminate();
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe('resolveTrpcWebSocketConfig', () => {
  it('verwendet 500er-taugliche Defaults und begrenzt Env-Werte statisch', () => {
    expect(resolveTrpcWebSocketConfig({})).toMatchObject({
      maxConnections: 1_000,
      maxUpgradesPerMinute: 3_000,
      maxMessagesPerWindow: 120,
      maxMessagesGlobalPerWindow: 30_000,
    });
    expect(
      resolveTrpcWebSocketConfig({
        TRPC_WS_MAX_CONNECTIONS: '999999',
        TRPC_WS_MAX_UPGRADES_PER_MINUTE: '999999',
        TRPC_WS_MAX_MESSAGES_PER_10_SECONDS: '999999',
        TRPC_WS_MAX_MESSAGES_GLOBAL_PER_10_SECONDS: '999999',
      }),
    ).toMatchObject({
      maxConnections: 5_000,
      maxUpgradesPerMinute: 30_000,
      maxMessagesPerWindow: 1_200,
      maxMessagesGlobalPerWindow: 300_000,
    });
  });
});

describe('TrpcWebSocketServer', () => {
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
