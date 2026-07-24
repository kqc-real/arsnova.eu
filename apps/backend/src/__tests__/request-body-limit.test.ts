import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { QuizUploadInputSchema } from '@arsnova/shared-types';
import express from 'express';
import { z } from 'zod';
import { TRPC_MAX_BODY_SIZE_BYTES, TRPC_MAX_BODY_SIZE_LABEL } from '../lib/requestLimits';
import { publicProcedure, router } from '../trpc';

const testRouter = router({
  echo: publicProcedure
    .input(z.object({ value: z.string() }))
    .mutation(({ input }) => ({ length: input.value.length })),
  acceptQuizUpload: publicProcedure.input(QuizUploadInputSchema).mutation(() => ({ ok: true })),
});

describe('tRPC request body limit', () => {
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

  async function startTestServer(): Promise<string> {
    const app = express();
    app.use(
      '/trpc',
      createExpressMiddleware({
        router: testRouter,
        maxBodySize: TRPC_MAX_BODY_SIZE_BYTES,
      }),
    );

    server = await new Promise<Server>((resolve) => {
      const listeningServer = app.listen(0, '127.0.0.1', () => resolve(listeningServer));
    });
    const address = server.address() as AddressInfo;
    return `http://127.0.0.1:${address.port}`;
  }

  it('akzeptiert normale Payloads unterhalb des Limits', async () => {
    const baseUrl = await startTestServer();
    const response = await fetch(`${baseUrl}/trpc/echo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'Classroom-Quiz' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ result: { data: { length: 14 } } });
  });

  it('lässt ein normales 100-Fragen-Classroom-Quiz unterhalb beider Limits durch', async () => {
    const baseUrl = await startTestServer();
    const classroomQuiz = {
      name: 'Classroom-Quiz',
      description: 'd'.repeat(5_000),
      showLeaderboard: true,
      allowCustomNicknames: false,
      enableSoundEffects: true,
      enableRewardEffects: true,
      enableMotivationMessages: true,
      enableEmojiReactions: true,
      anonymousMode: false,
      teamMode: false,
      nicknameTheme: 'NOBEL_LAUREATES',
      questions: Array.from({ length: 100 }, (_, order) => ({
        text: `Classroom-Frage ${order + 1}`,
        type: 'MULTIPLE_CHOICE',
        difficulty: 'MEDIUM',
        order,
        answers: Array.from({ length: 4 }, (_, answerIndex) => ({
          text: `Antwort ${answerIndex + 1}`,
          isCorrect: answerIndex === 0,
        })),
      })),
    };
    const body = JSON.stringify(classroomQuiz);
    expect(Buffer.byteLength(body)).toBeLessThan(TRPC_MAX_BODY_SIZE_BYTES);

    const response = await fetch(`${baseUrl}/trpc/acceptQuizUpload`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ result: { data: { ok: true } } });
  });

  it('weist übergroße Payloads mit 413 und klarer Fehlermeldung ab', async () => {
    const baseUrl = await startTestServer();
    const response = await fetch(`${baseUrl}/trpc/echo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'x'.repeat(TRPC_MAX_BODY_SIZE_BYTES) }),
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        message: `Die Anfrage ist zu groß. Maximal ${TRPC_MAX_BODY_SIZE_LABEL} sind erlaubt.`,
        data: {
          code: 'PAYLOAD_TOO_LARGE',
          httpStatus: 413,
        },
      },
    });
  });

  it('liefert den 413-Fehler für Batch-Requests im tRPC-Arrayformat', async () => {
    const baseUrl = await startTestServer();
    const response = await fetch(`${baseUrl}/trpc/echo?batch=1`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        0: { value: 'x'.repeat(TRPC_MAX_BODY_SIZE_BYTES) },
      }),
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject([
      {
        error: {
          message: `Die Anfrage ist zu groß. Maximal ${TRPC_MAX_BODY_SIZE_LABEL} sind erlaubt.`,
          data: {
            code: 'PAYLOAD_TOO_LARGE',
            httpStatus: 413,
          },
        },
      },
    ]);
  });
});
