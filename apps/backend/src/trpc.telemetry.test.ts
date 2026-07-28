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
    getInfo: publicProcedure.query(() => {
      throw new TRPCError({ code: 'TOO_MANY_REQUESTS' });
    }),
    getInfoForReconnect: publicProcedure.query(() => {
      throw new TRPCError({ code: 'TOO_MANY_REQUESTS' });
    }),
    getParticipantSelf: publicProcedure.query(() => {
      throw new TRPCError({ code: 'TOO_MANY_REQUESTS' });
    }),
    getLeaderboard: publicProcedure.query(() => {
      throw new TRPCError({ code: 'TOO_MANY_REQUESTS' });
    }),
    getSessionConfidenceSummary: publicProcedure.query(() => {
      throw new TRPCError({ code: 'TOO_MANY_REQUESTS' });
    }),
    confirmReadingReady: publicProcedure.mutation(() => {
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
  quiz: router({
    upload: publicProcedure.mutation(() => {
      throw new TRPCError({ code: 'TOO_MANY_REQUESTS' });
    }),
  }),
  quickFeedback: router({
    create: publicProcedure.mutation(() => {
      throw new TRPCError({ code: 'TOO_MANY_REQUESTS' });
    }),
    isActiveForReconnect: publicProcedure.query(() => {
      throw new TRPCError({ code: 'TOO_MANY_REQUESTS' });
    }),
    vote: publicProcedure.mutation(() => {
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
    [
      'session.getInfo',
      'sessionCode',
      () => testRouter.createCaller({ req: undefined }).session.getInfo(),
    ],
    [
      'session.getInfoForReconnect',
      'sessionCodeReconnect',
      () => testRouter.createCaller({ req: undefined }).session.getInfoForReconnect(),
    ],
    [
      'session.getParticipantSelf',
      'sessionCodeReconnect',
      () => testRouter.createCaller({ req: undefined }).session.getParticipantSelf(),
    ],
    [
      'session.getLeaderboard',
      'sessionCodeReconnect',
      () => testRouter.createCaller({ req: undefined }).session.getLeaderboard(),
    ],
    [
      'session.getSessionConfidenceSummary',
      'sessionCodeReconnect',
      () => testRouter.createCaller({ req: undefined }).session.getSessionConfidenceSummary(),
    ],
    [
      'session.confirmReadingReady',
      'sessionCode',
      () => testRouter.createCaller({ req: undefined }).session.confirmReadingReady(),
    ],
    ['vote.submit', 'vote', () => testRouter.createCaller({ req: undefined }).vote.submit()],
    ['quiz.upload', 'quizUpload', () => testRouter.createCaller({ req: undefined }).quiz.upload()],
    [
      'quickFeedback.create',
      'quickFeedback',
      () => testRouter.createCaller({ req: undefined }).quickFeedback.create(),
    ],
    [
      'quickFeedback.isActiveForReconnect',
      'sessionCodeReconnect',
      () => testRouter.createCaller({ req: undefined }).quickFeedback.isActiveForReconnect(),
    ],
    [
      'quickFeedback.vote',
      'sessionCode',
      () => testRouter.createCaller({ req: undefined }).quickFeedback.vote(),
    ],
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
    expect(mocks.logRateLimitRejection).not.toHaveBeenCalledWith(
      expect.objectContaining({ clientIp: expect.anything() }),
    );
  });
});
