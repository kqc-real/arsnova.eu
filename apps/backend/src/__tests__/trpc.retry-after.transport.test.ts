import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createTRPCClient, httpLink, TRPCClientError } from '@trpc/client';
import { TRPCError } from '@trpc/server';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { publicProcedure, router } from '../trpc';

let rateLimitCause: unknown;

const testRouter = router({
  session: router({
    create: publicProcedure.mutation(() => {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Zu viele Session-Erstellungen. Bitte später erneut versuchen.',
        cause: rateLimitCause,
      });
    }),
  }),
});

describe('tRPC retryAfterSeconds transport', () => {
  let server: Server | undefined;

  afterEach(
    () =>
      new Promise<void>((resolve, reject) => {
        if (!server) {
          resolve();
          return;
        }
        server.close((error) => (error ? reject(error) : resolve()));
        server = undefined;
      }),
  );

  async function createClient() {
    const app = express();
    app.use(
      '/trpc',
      createExpressMiddleware({
        router: testRouter,
        createContext: ({ req }) => ({ req }),
      }),
    );
    server = await new Promise<Server>((resolve) => {
      const listeningServer = app.listen(0, '127.0.0.1', () => resolve(listeningServer));
    });
    const address = server.address() as AddressInfo;

    return createTRPCClient<typeof testRouter>({
      links: [httpLink({ url: `http://127.0.0.1:${address.port}/trpc` })],
    });
  }

  it('liefert die positive Wartezeit über den echten HTTP/tRPC-Client', async () => {
    rateLimitCause = { retryAfterSeconds: 12.2, internalDetail: 'nicht serialisieren' };
    const client = await createClient();

    const error = await client.session.create.mutate().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TRPCClientError);
    expect(error).toMatchObject({
      data: {
        code: 'TOO_MANY_REQUESTS',
        httpStatus: 429,
        retryAfterSeconds: 13,
      },
    });
    expect(JSON.stringify(error)).not.toContain('internalDetail');
  });

  it('serialisiert weder ungültige Wartezeiten noch übrige Cause-Daten', async () => {
    rateLimitCause = { retryAfterSeconds: -1, internalDetail: 'nicht serialisieren' };
    const client = await createClient();

    const error = await client.session.create.mutate().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TRPCClientError);
    expect(error).not.toMatchObject({
      data: {
        retryAfterSeconds: expect.anything(),
      },
    });
    expect(JSON.stringify(error)).not.toContain('internalDetail');
  });
});
