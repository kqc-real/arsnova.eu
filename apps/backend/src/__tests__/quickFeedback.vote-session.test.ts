import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  redisMock,
  prismaMock,
  extractHostTokenMock,
  isHostSessionTokenValidMock,
  createFeedbackHostTokenMock,
  assertFeedbackHostAccessMock,
  invalidateFeedbackHostTokenMock,
} = vi.hoisted(() => ({
  redisMock: {
    get: vi.fn(),
    set: vi.fn(),
    sismember: vi.fn(),
    multi: vi.fn(),
  },
  prismaMock: {
    session: {
      findUnique: vi.fn(),
    },
  },
  extractHostTokenMock: vi.fn(),
  isHostSessionTokenValidMock: vi.fn(),
  createFeedbackHostTokenMock: vi.fn(),
  assertFeedbackHostAccessMock: vi.fn(),
  invalidateFeedbackHostTokenMock: vi.fn(),
}));

vi.mock('../redis', () => ({
  getRedis: () => redisMock,
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/hostAuth', () => ({
  assertHostSessionAccess: vi.fn(async (req, sessionCode: string) => {
    const token = extractHostTokenMock(req);
    if (!token) {
      const { TRPCError } = await import('@trpc/server');
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Host-Authentifizierung erforderlich.',
      });
    }
    const valid = await isHostSessionTokenValidMock(sessionCode, token);
    if (!valid) {
      const { TRPCError } = await import('@trpc/server');
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Host-Session ungültig oder abgelaufen.',
      });
    }
    return token;
  }),
  extractHostToken: extractHostTokenMock,
  isHostSessionTokenValid: isHostSessionTokenValidMock,
}));

vi.mock('../lib/feedbackHostAuth', () => ({
  createFeedbackHostToken: createFeedbackHostTokenMock,
  assertFeedbackHostAccess: assertFeedbackHostAccessMock,
  invalidateFeedbackHostToken: invalidateFeedbackHostTokenMock,
}));

import { quickFeedbackRouter } from '../routers/quickFeedback';

const caller = quickFeedbackRouter.createCaller({ req: undefined });
const hostCaller = quickFeedbackRouter.createCaller({ req: {} as never });
const VOTER_ID = '33333333-3333-4333-8333-333333333333';

describe('quickFeedback.vote und Session-Status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    extractHostTokenMock.mockReturnValue('host-token-123');
    isHostSessionTokenValidMock.mockResolvedValue(true);
    createFeedbackHostTokenMock.mockResolvedValue('feedback-owner-token');
    assertFeedbackHostAccessMock.mockResolvedValue('feedback-owner-token');
    invalidateFeedbackHostTokenMock.mockResolvedValue(undefined);
    redisMock.set.mockResolvedValue('OK');
    redisMock.sismember.mockResolvedValue(0);
    redisMock.multi.mockReturnValue({
      set: vi.fn().mockReturnThis(),
      del: vi.fn().mockReturnThis(),
      sadd: vi.fn().mockReturnThis(),
      hset: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    });
  });

  it('lehnt ab, wenn die Live-Session beendet ist', async () => {
    redisMock.get.mockResolvedValue(
      JSON.stringify({
        type: 'MOOD',
        theme: 'light',
        preset: 'serious',
        locked: false,
        totalVotes: 0,
        distribution: { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 },
        sessionBound: true,
      }),
    );
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      quickFeedbackEnabled: true,
      status: 'FINISHED',
    });

    await expect(
      caller.vote({
        sessionCode: 'ABCDEF',
        voterId: VOTER_ID,
        value: 'POSITIVE',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(redisMock.get).toHaveBeenCalledWith('qf:ABCDEF');
  });

  it('erlaubt Standalone-Blitzlicht-Stimmen ohne Session-Nachschlag', async () => {
    redisMock.get.mockResolvedValue(
      JSON.stringify({
        type: 'MOOD',
        theme: 'light',
        preset: 'serious',
        locked: false,
        totalVotes: 0,
        distribution: { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 },
        sessionBound: false,
      }),
    );

    await expect(
      caller.vote({
        sessionCode: 'ABCDEF',
        voterId: VOTER_ID,
        value: 'POSITIVE',
      }),
    ).resolves.toEqual({ ok: true });

    expect(prismaMock.session.findUnique).not.toHaveBeenCalled();
    expect(redisMock.sismember).toHaveBeenCalledWith('qf:voters:ABCDEF', VOTER_ID);
  });

  it('erlaubt Standalone-Blitzlicht ohne Host-Token', async () => {
    const result = await caller.create({
      type: 'MOOD',
      theme: 'light',
      preset: 'serious',
    });

    expect(result.sessionCode).toHaveLength(6);
    expect(result.hostToken).toBe('feedback-owner-token');
    expect(createFeedbackHostTokenMock).toHaveBeenCalledWith(result.sessionCode);
    expect(redisMock.multi).toHaveBeenCalledTimes(1);
  });

  it('lehnt sessiongebundene Blitzlicht-Erstellung ohne Host-Token ab', async () => {
    extractHostTokenMock.mockReturnValue(null);

    await expect(
      hostCaller.create({
        type: 'MOOD',
        theme: 'light',
        preset: 'serious',
        sessionCode: 'ABC123',
      }),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Host-Authentifizierung erforderlich.',
    });
  });

  it('erlaubt Standalone-Blitzlicht-Steuerung mit Blitzlicht-Host-Token', async () => {
    redisMock.get.mockResolvedValue(
      JSON.stringify({
        type: 'MOOD',
        theme: 'light',
        preset: 'serious',
        locked: false,
        totalVotes: 0,
        distribution: { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 },
        sessionBound: false,
      }),
    );

    const result = await caller.toggleLock({ sessionCode: 'ABC123' });

    expect(assertFeedbackHostAccessMock).toHaveBeenCalledWith(undefined, 'ABC123');
    expect(result).toEqual({ locked: true });
  });

  it('lehnt Standalone-Blitzlicht-Steuerung ohne Blitzlicht-Host-Token ab', async () => {
    const { TRPCError } = await import('@trpc/server');
    assertFeedbackHostAccessMock.mockRejectedValue(
      new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Blitzlicht-Host-Authentifizierung erforderlich.',
      }),
    );
    redisMock.get.mockResolvedValue(
      JSON.stringify({
        type: 'MOOD',
        theme: 'light',
        preset: 'serious',
        locked: false,
        totalVotes: 0,
        distribution: { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 },
        sessionBound: false,
      }),
    );

    await expect(caller.toggleLock({ sessionCode: 'ABC123' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Blitzlicht-Host-Authentifizierung erforderlich.',
    });
  });

  it('lehnt sessiongebundene Blitzlicht-Steuerung ohne Host-Token ab', async () => {
    extractHostTokenMock.mockReturnValue(null);
    redisMock.get.mockResolvedValue(
      JSON.stringify({
        type: 'MOOD',
        theme: 'light',
        preset: 'serious',
        locked: false,
        totalVotes: 0,
        distribution: { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 },
        sessionBound: true,
      }),
    );

    await expect(hostCaller.toggleLock({ sessionCode: 'ABC123' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Host-Authentifizierung erforderlich.',
    });
  });
});
