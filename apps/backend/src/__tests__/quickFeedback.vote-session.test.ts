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
    hget: vi.fn(),
    hgetall: vi.fn(),
    set: vi.fn(),
    sismember: vi.fn(),
    eval: vi.fn(),
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
  assertHostSessionAccessFromContext: vi.fn(async (ctx: { req?: unknown }, sessionCode: string) => {
    const token = extractHostTokenMock(ctx.req);
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
let lastTempoEvalResult: { totalVotes: number; distribution: Record<string, number> } | null = null;
let lastTempoChoiceAction: {
  method: 'hset' | 'hdel';
  key: string;
  voterId: string;
  value: string;
} | null = null;

describe('quickFeedback.vote und Session-Status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    extractHostTokenMock.mockReturnValue('host-token-123');
    isHostSessionTokenValidMock.mockResolvedValue(true);
    createFeedbackHostTokenMock.mockResolvedValue('feedback-owner-token');
    assertFeedbackHostAccessMock.mockResolvedValue('feedback-owner-token');
    invalidateFeedbackHostTokenMock.mockResolvedValue(undefined);
    redisMock.set.mockResolvedValue('OK');
    redisMock.hget.mockResolvedValue(null);
    redisMock.hgetall.mockResolvedValue({});
    redisMock.sismember.mockResolvedValue(0);
    lastTempoEvalResult = null;
    lastTempoChoiceAction = null;
    redisMock.eval.mockImplementation(
      async (
        _script: string,
        _keyCount: number,
        key: string,
        cKey: string,
        _bucketKey: string,
        voterId: string,
        value: string,
        _ttl: string,
        _bucket: string,
        ...tempoValues: string[]
      ) => {
        const raw = (await redisMock.get(key)) as string | null;
        if (!raw) {
          return JSON.stringify({ error: 'MISSING' });
        }

        const result = JSON.parse(raw) as {
          locked?: boolean;
          type?: string;
          totalVotes: number;
          distribution?: Record<string, number>;
        };
        if (result.type !== 'TEMPO') {
          return JSON.stringify({ error: 'TYPE_CHANGED' });
        }
        if (result.locked === true) {
          return JSON.stringify({ error: 'LOCKED' });
        }

        const previousValue = (await redisMock.hget(cKey, voterId)) as string | null;
        const distribution = Object.fromEntries(
          tempoValues.map((tempoValue) => [
            tempoValue,
            Math.max(0, Math.round(result.distribution?.[tempoValue] ?? 0)),
          ]),
        ) as Record<string, number>;

        if (previousValue && Object.hasOwn(distribution, previousValue)) {
          distribution[previousValue] = Math.max(0, distribution[previousValue] - 1);
        }

        const removesCurrentChoice = previousValue === value;
        if (removesCurrentChoice) {
          lastTempoChoiceAction = { method: 'hdel', key: cKey, voterId, value };
        } else {
          distribution[value] = (distribution[value] ?? 0) + 1;
          lastTempoChoiceAction = { method: 'hset', key: cKey, voterId, value };
        }

        result.distribution = distribution;
        result.totalVotes = Object.values(distribution).reduce((sum, count) => sum + count, 0);
        lastTempoEvalResult = {
          totalVotes: result.totalVotes,
          distribution,
        };

        return JSON.stringify({ totalVotes: result.totalVotes, removesCurrentChoice });
      },
    );
    redisMock.multi.mockReturnValue({
      set: vi.fn().mockReturnThis(),
      del: vi.fn().mockReturnThis(),
      sadd: vi.fn().mockReturnThis(),
      hset: vi.fn().mockReturnThis(),
      hdel: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    });
  });

  it('lehnt ab, wenn die Live-Session beendet ist', async () => {
    redisMock.get.mockResolvedValue(
      JSON.stringify({
        type: 'MOOD',
        locked: false,
        totalVotes: 0,
        distribution: { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 },
        sessionBound: true,
      }),
    );
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      quickFeedbackEnabled: true,
      quickFeedbackOpen: true,
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

  it('lehnt ab, wenn der Blitzlicht-Kanal für Teilnehmende geschlossen ist', async () => {
    redisMock.get.mockResolvedValue(
      JSON.stringify({
        type: 'MOOD',
        locked: false,
        totalVotes: 0,
        distribution: { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 },
        sessionBound: true,
      }),
    );
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      quickFeedbackEnabled: true,
      quickFeedbackOpen: false,
      status: 'ACTIVE',
    });

    await expect(
      caller.vote({
        sessionCode: 'ABCDEF',
        voterId: VOTER_ID,
        value: 'POSITIVE',
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Der Blitzlicht-Kanal ist aktuell geschlossen.',
    });
  });

  it('erlaubt Standalone-Blitzlicht-Stimmen ohne Session-Nachschlag', async () => {
    redisMock.get.mockResolvedValue(
      JSON.stringify({
        type: 'MOOD',
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

  it('setzt bei Tempo eine aktuelle Auswahl ohne One-Shot-Sperre', async () => {
    redisMock.get.mockResolvedValue(
      JSON.stringify({
        type: 'TEMPO',
        locked: false,
        totalVotes: 0,
        distribution: { SPEED_UP: 0, FOLLOWING: 0, SLOW_DOWN: 0, LOST: 0 },
        sessionBound: false,
      }),
    );

    await expect(
      caller.vote({
        sessionCode: 'ABCDEF',
        voterId: VOTER_ID,
        value: 'FOLLOWING',
      }),
    ).resolves.toEqual({ ok: true });

    expect(redisMock.sismember).not.toHaveBeenCalled();
    expect(redisMock.hget).toHaveBeenCalledWith('qf:choices:ABCDEF', VOTER_ID);
    expect(redisMock.eval).toHaveBeenCalledWith(
      expect.any(String),
      3,
      'qf:ABCDEF',
      'qf:choices:ABCDEF',
      'qf:tempo:buckets:ABCDEF',
      VOTER_ID,
      'FOLLOWING',
      expect.any(String),
      expect.any(String),
      'SPEED_UP',
      'FOLLOWING',
      'SLOW_DOWN',
      'LOST',
    );
    expect(lastTempoEvalResult?.totalVotes).toBe(1);
    expect(lastTempoEvalResult?.distribution).toMatchObject({
      SPEED_UP: 0,
      FOLLOWING: 1,
      SLOW_DOWN: 0,
      LOST: 0,
    });
    expect(lastTempoChoiceAction).toEqual({
      method: 'hset',
      key: 'qf:choices:ABCDEF',
      voterId: VOTER_ID,
      value: 'FOLLOWING',
    });
  });

  it('wechselt bei Tempo per Delta auf die neue Auswahl', async () => {
    redisMock.hget.mockResolvedValue('SPEED_UP');
    redisMock.get.mockResolvedValue(
      JSON.stringify({
        type: 'TEMPO',
        locked: false,
        totalVotes: 1,
        distribution: { SPEED_UP: 1, FOLLOWING: 0, SLOW_DOWN: 0, LOST: 0 },
        sessionBound: false,
      }),
    );

    await caller.vote({
      sessionCode: 'ABCDEF',
      voterId: VOTER_ID,
      value: 'SLOW_DOWN',
    });

    expect(lastTempoEvalResult?.totalVotes).toBe(1);
    expect(lastTempoEvalResult?.distribution).toMatchObject({
      SPEED_UP: 0,
      FOLLOWING: 0,
      SLOW_DOWN: 1,
      LOST: 0,
    });
    expect(lastTempoChoiceAction).toEqual({
      method: 'hset',
      key: 'qf:choices:ABCDEF',
      voterId: VOTER_ID,
      value: 'SLOW_DOWN',
    });
  });

  it('entfernt bei Tempo die aktive Auswahl per Re-Tap', async () => {
    redisMock.hget.mockResolvedValue('SLOW_DOWN');
    redisMock.get.mockResolvedValue(
      JSON.stringify({
        type: 'TEMPO',
        locked: false,
        totalVotes: 1,
        distribution: { SPEED_UP: 0, FOLLOWING: 0, SLOW_DOWN: 1, LOST: 0 },
        sessionBound: false,
      }),
    );

    await caller.vote({
      sessionCode: 'ABCDEF',
      voterId: VOTER_ID,
      value: 'SLOW_DOWN',
    });

    expect(lastTempoEvalResult?.totalVotes).toBe(0);
    expect(lastTempoEvalResult?.distribution).toMatchObject({
      SPEED_UP: 0,
      FOLLOWING: 0,
      SLOW_DOWN: 0,
      LOST: 0,
    });
    expect(lastTempoChoiceAction).toEqual({
      method: 'hdel',
      key: 'qf:choices:ABCDEF',
      voterId: VOTER_ID,
      value: 'SLOW_DOWN',
    });
  });

  it('laesst klassische Blitzlicht-Typen weiter bei One-Shot-Semantik', async () => {
    redisMock.sismember.mockResolvedValue(1);
    redisMock.get.mockResolvedValue(
      JSON.stringify({
        type: 'MOOD',
        locked: false,
        totalVotes: 1,
        distribution: { POSITIVE: 1, NEUTRAL: 0, NEGATIVE: 0 },
        sessionBound: false,
      }),
    );

    await expect(
      caller.vote({
        sessionCode: 'ABCDEF',
        voterId: VOTER_ID,
        value: 'NEUTRAL',
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Du hast bereits abgestimmt.',
    });
  });

  it('liefert fuer Tempo nur Aggregation und Tendenz aus', async () => {
    redisMock.get.mockResolvedValue(
      JSON.stringify({
        type: 'TEMPO',
        locked: false,
        totalVotes: 8,
        distribution: { SPEED_UP: 0, FOLLOWING: 8, SLOW_DOWN: 0, LOST: 0 },
        sessionBound: false,
      }),
    );
    redisMock.hgetall.mockResolvedValue({
      [String(Date.now())]: JSON.stringify({
        totalVotes: 8,
        distribution: { SPEED_UP: 0, FOLLOWING: 8, SLOW_DOWN: 0, LOST: 0 },
      }),
    });

    const result = await caller.hostResults({ sessionCode: 'ABCDEF' });

    expect(result.tempoTrend).toMatchObject({
      status: 'FOLLOWING',
      active: true,
      activeParticipants: 8,
      tempoVotes: 8,
      requiredVotes: 8,
    });
    expect(JSON.stringify(result)).not.toContain(VOTER_ID);
  });

  it('haelt die Tempo-Tendenz unterhalb der Mindestquote neutral', async () => {
    redisMock.get.mockResolvedValue(
      JSON.stringify({
        type: 'TEMPO',
        locked: false,
        totalVotes: 1,
        distribution: { SPEED_UP: 1, FOLLOWING: 0, SLOW_DOWN: 0, LOST: 0 },
        sessionBound: false,
      }),
    );

    const result = await caller.hostResults({ sessionCode: 'ABCDEF' });

    expect(result.tempoTrend).toMatchObject({
      status: 'NEUTRAL',
      active: false,
      activeParticipants: 1,
      tempoVotes: 1,
      requiredVotes: 8,
    });
  });

  it('wertet gemischte Tempo-Rueckmeldungen oberhalb der Mindestquote als heterogen', async () => {
    redisMock.get.mockResolvedValue(
      JSON.stringify({
        type: 'TEMPO',
        locked: false,
        totalVotes: 200,
        distribution: { SPEED_UP: 40, FOLLOWING: 80, SLOW_DOWN: 55, LOST: 25 },
        sessionBound: false,
      }),
    );

    const result = await caller.hostResults({ sessionCode: 'ABCDEF' });

    expect(result.tempoTrend).toMatchObject({
      status: 'HETEROGENEOUS',
      active: true,
      activeParticipants: 200,
      tempoVotes: 200,
      requiredVotes: 20,
    });
  });

  it('erlaubt Standalone-Blitzlicht ohne Host-Token', async () => {
    const result = await caller.create({
      type: 'MOOD',
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
        locked: false,
        totalVotes: 0,
        distribution: { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 },
        sessionBound: false,
      }),
    );

    const result = await caller.toggleLock({ sessionCode: 'ABC123' });

    expect(assertFeedbackHostAccessMock).toHaveBeenCalledWith(undefined, 'ABC123', undefined);
    expect(result).toEqual({ locked: true });
  });

  it('erlaubt Standalone-Blitzlicht-Steuerung ueber WebSocket-connectionParams', async () => {
    redisMock.get.mockResolvedValue(
      JSON.stringify({
        type: 'MOOD',
        locked: false,
        totalVotes: 0,
        distribution: { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 },
        sessionBound: false,
      }),
    );

    const wsCaller = quickFeedbackRouter.createCaller({
      req: undefined,
      connectionParams: { 'x-feedback-host-token': 'feedback-owner-token' },
    });

    const result = await wsCaller.toggleLock({ sessionCode: 'ABC123' });

    expect(assertFeedbackHostAccessMock).toHaveBeenCalledWith(undefined, 'ABC123', {
      'x-feedback-host-token': 'feedback-owner-token',
    });
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
