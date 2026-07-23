import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyWSSHandler } from '@trpc/server/adapters/ws';
import WebSocket, { WebSocketServer } from 'ws';
import { z } from 'zod';
import { TRPC_MAX_BODY_SIZE_BYTES } from '../lib/requestLimits';
import { publicProcedure, router } from '../trpc';

describe('tRPC WebSocket payload limit', () => {
  let client: WebSocket | undefined;
  let wss: WebSocketServer | undefined;
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

  beforeEach(() => {
    resolverInvocations = 0;
  });

  afterEach(async () => {
    client?.terminate();
    client = undefined;
    await new Promise<void>((resolve) => {
      if (!wss) {
        resolve();
        return;
      }
      wss.close(() => resolve());
      wss = undefined;
    });
  });

  async function startTestServer(): Promise<string> {
    wss = new WebSocketServer({
      host: '127.0.0.1',
      port: 0,
      maxPayload: TRPC_MAX_BODY_SIZE_BYTES,
    });
    applyWSSHandler({ wss, router: testRouter });
    await new Promise<void>((resolve) => wss!.once('listening', resolve));
    const address = wss.address() as AddressInfo;
    return `ws://127.0.0.1:${address.port}`;
  }

  async function connect(url: string): Promise<WebSocket> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });
    client = socket;
    return socket;
  }

  it('schließt übergroße Nachrichten mit 1009, bevor ein Resolver läuft', async () => {
    const socket = await connect(await startTestServer());
    const closed = new Promise<number>((resolve) => {
      socket.once('close', (code) => resolve(code));
    });

    socket.send(
      JSON.stringify({
        id: 1,
        method: 'mutation',
        params: {
          path: 'echo',
          input: { value: 'x'.repeat(TRPC_MAX_BODY_SIZE_BYTES) },
        },
      }),
    );

    await expect(closed).resolves.toBe(1009);
    expect(resolverInvocations).toBe(0);
  });

  it('lässt normale Subscriptions weiterhin Nachrichten liefern', async () => {
    const socket = await connect(await startTestServer());
    const ready = new Promise<unknown>((resolve, reject) => {
      socket.on('message', (data) => {
        const message = JSON.parse(data.toString()) as {
          result?: { type?: string; data?: unknown };
        };
        if (message.result?.type === 'data') {
          resolve(message.result.data);
        }
      });
      socket.once('error', reject);
    });

    socket.send(
      JSON.stringify({
        id: 1,
        method: 'subscription',
        params: {
          path: 'updates',
          input: null,
        },
      }),
    );

    await expect(ready).resolves.toEqual({ status: 'ready' });
  });
});
