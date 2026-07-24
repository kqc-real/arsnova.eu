import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TRPCError } from '@trpc/server';

const mocks = vi.hoisted(() => ({
  recordRateLimitRejection: vi.fn(),
  recordSessionCreateCompleted: vi.fn(),
  logRateLimitRejection: vi.fn(),
}));

vi.mock('./lib/sloTelemetry', () => ({
  isTrackedLiveProcedure: vi.fn(() => false),
  recordLiveRequestTelemetry: vi.fn(),
}));

vi.mock('./lib/abuseTelemetry', () => ({
  logRateLimitRejection: mocks.logRateLimitRejection,
  recordRateLimitRejection: mocks.recordRateLimitRejection,
  recordSessionCreateCompleted: mocks.recordSessionCreateCompleted,
}));

import { publicProcedure, router } from './trpc';

const testRouter = router({
  session: router({
    create: publicProcedure.mutation(() => ({ code: 'ABC123' })),
    join: publicProcedure.mutation(() => {
      throw new TRPCError({ code: 'TOO_MANY_REQUESTS' });
    }),
    getSessionExportPdf: publicProcedure.query(() => {
      throw new TRPCError({ code: 'TOO_MANY_REQUESTS' });
    }),
  }),
  vote: router({
    submit: publicProcedure.mutation(() => {
      throw new TRPCError({ code: 'TOO_MANY_REQUESTS' });
    }),
  }),
  example: router({
    limited: publicProcedure.query(() => {
      throw new TRPCError({ code: 'TOO_MANY_REQUESTS' });
    }),
  }),
});

describe('zentrale Security-Telemetrie', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('zählt erfolgreiche Session-Erstellungen', async () => {
    const caller = testRouter.createCaller({ req: undefined });

    await expect(caller.session.create()).resolves.toEqual({ code: 'ABC123' });
    expect(mocks.recordSessionCreateCompleted).toHaveBeenCalledOnce();
  });

  it.each([
    [
      'session.join',
      'sessionCode',
      () => testRouter.createCaller({ req: undefined }).session.join(),
    ],
    ['vote.submit', 'vote', () => testRouter.createCaller({ req: undefined }).vote.submit()],
    [
      'session.getSessionExportPdf',
      'pdf',
      () => testRouter.createCaller({ req: undefined }).session.getSessionExportPdf(),
    ],
    [
      'example.limited',
      'other',
      () => testRouter.createCaller({ req: undefined }).example.limited(),
    ],
  ] as const)('ordnet 429 auf %s der Kategorie %s zu', async (path, category, call) => {
    await expect(call()).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });

    expect(mocks.recordRateLimitRejection).toHaveBeenCalledWith(category);
    expect(mocks.logRateLimitRejection).toHaveBeenCalledWith(
      expect.objectContaining({ path, category }),
    );
  });
});
