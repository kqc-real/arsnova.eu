import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  redisMock,
  prismaMock,
  extractHostTokenMock,
  isHostSessionTokenValidMock,
  createFeedbackHostTokenMock,
  assertFeedbackHostAccessMock,
  invalidateFeedbackHostTokenMock,
  getActiveParticipantIdsForSessionMock,
  touchParticipantPresenceMock,
  checkQuickFeedbackSessionCreateRateMock,
  checkQuickFeedbackStandaloneCreateRateMock,
} = vi.hoisted(() => ({
  redisMock: {
    get: vi.fn(),
    hget: vi.fn(),
    hgetall: vi.fn(),
    hdel: vi.fn(),
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
  getActiveParticipantIdsForSessionMock: vi.fn(),
  touchParticipantPresenceMock: vi.fn(),
  checkQuickFeedbackSessionCreateRateMock: vi.fn(),
  checkQuickFeedbackStandaloneCreateRateMock: vi.fn(),
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

vi.mock('../lib/presence', () => ({
  getActiveParticipantIdsForSession: getActiveParticipantIdsForSessionMock,
  touchParticipantPresence: touchParticipantPresenceMock,
}));

vi.mock('../lib/rateLimit', () => ({
  checkQuickFeedbackSessionCreateRate: checkQuickFeedbackSessionCreateRateMock,
  checkQuickFeedbackStandaloneCreateRate: checkQuickFeedbackStandaloneCreateRateMock,
}));

import { quickFeedbackRouter } from '../routers/quickFeedback';

const caller = quickFeedbackRouter.createCaller({ req: undefined });
const hostCaller = quickFeedbackRouter.createCaller({
  req: { headers: {}, socket: { remoteAddress: '203.0.113.10' } } as never,
});
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
    getActiveParticipantIdsForSessionMock.mockResolvedValue(new Set());
    touchParticipantPresenceMock.mockResolvedValue(undefined);
    checkQuickFeedbackSessionCreateRateMock.mockResolvedValue({ allowed: true, remaining: 119 });
    checkQuickFeedbackStandaloneCreateRateMock.mockResolvedValue({
      allowed: true,
      remaining: 599,
    });
    redisMock.set.mockResolvedValue('OK');
    redisMock.hget.mockResolvedValue(null);
    redisMock.hgetall.mockResolvedValue({});
    redisMock.hdel.mockResolvedValue(1);
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

        const resetsToDefault = previousValue === value && value !== 'FOLLOWING';
        const nextValue = resetsToDefault ? 'FOLLOWING' : value;
        distribution[nextValue] = (distribution[nextValue] ?? 0) + 1;
        lastTempoChoiceAction = { method: 'hset', key: cKey, voterId, value: nextValue };
        result.distribution = distribution;
        result.totalVotes = Object.values(distribution).reduce((sum, count) => sum + count, 0);
        lastTempoEvalResult = {
          totalVotes: result.totalVotes,
          distribution,
        };

        return JSON.stringify({ totalVotes: result.totalVotes, resetsToDefault });
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
      _count: { participants: 0 },
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
      _count: { participants: 0 },
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

  it('aktualisiert Presence bei sessiongebundenen Blitzlicht-Stimmen', async () => {
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
      status: 'ACTIVE',
      _count: { participants: 1 },
    });

    await expect(
      caller.vote({
        sessionCode: 'ABCDEF',
        voterId: VOTER_ID,
        value: 'POSITIVE',
      }),
    ).resolves.toEqual({ ok: true });

    expect(touchParticipantPresenceMock).toHaveBeenCalledWith(
      '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      VOTER_ID,
    );
  });

  it('speichert bei Tempo Auswahlen ohne One-Shot-Sperre', async () => {
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
        value: 'SLOW_DOWN',
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
      'SLOW_DOWN',
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

  it('registriert bei Tempo FOLLOWING als Default-Auswahl', async () => {
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
      value: 'FOLLOWING',
    });

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

  it('entfernt Standalone-Tempo-Auswahl beim Verlassen aus dem Barometer', async () => {
    redisMock.hget.mockResolvedValue('FOLLOWING');
    redisMock.get.mockResolvedValue(
      JSON.stringify({
        type: 'TEMPO',
        locked: false,
        totalVotes: 1,
        distribution: { SPEED_UP: 0, FOLLOWING: 1, SLOW_DOWN: 0, LOST: 0 },
        sessionBound: false,
      }),
    );

    await expect(
      caller.leaveTempo({
        sessionCode: 'ABCDEF',
        voterId: VOTER_ID,
      }),
    ).resolves.toEqual({ ok: true });

    const multi = redisMock.multi.mock.results[redisMock.multi.mock.results.length - 1]?.value as {
      set: ReturnType<typeof vi.fn>;
      hdel: ReturnType<typeof vi.fn>;
      hset: ReturnType<typeof vi.fn>;
      expire: ReturnType<typeof vi.fn>;
      exec: ReturnType<typeof vi.fn>;
    };
    expect(multi.hdel).toHaveBeenCalledWith('qf:choices:ABCDEF', VOTER_ID);
    expect(multi.set).toHaveBeenCalledWith(
      'qf:ABCDEF',
      expect.any(String),
      'EX',
      expect.any(Number),
    );
    const stored = JSON.parse(String(multi.set.mock.calls[0]?.[1])) as {
      totalVotes: number;
      distribution: Record<string, number>;
    };
    expect(stored.totalVotes).toBe(0);
    expect(stored.distribution).toMatchObject({
      SPEED_UP: 0,
      FOLLOWING: 0,
      SLOW_DOWN: 0,
      LOST: 0,
    });
    expect(multi.hset).toHaveBeenCalledWith(
      'qf:tempo:buckets:ABCDEF',
      expect.any(String),
      expect.stringContaining('"totalVotes":0'),
    );
    expect(multi.expire).toHaveBeenCalledWith('qf:choices:ABCDEF', expect.any(Number));
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

  it('setzt bei Tempo die aktive Abweichung per Re-Tap auf FOLLOWING zurueck', async () => {
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

  it('liefert fuer Tempo ab drei aktiven Teilnehmenden Default-Following und Tendenz aus', async () => {
    redisMock.get.mockResolvedValue(
      JSON.stringify({
        type: 'TEMPO',
        locked: false,
        totalVotes: 0,
        distribution: { SPEED_UP: 0, FOLLOWING: 0, SLOW_DOWN: 0, LOST: 0 },
        sessionBound: true,
      }),
    );
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      quickFeedbackEnabled: true,
      quickFeedbackOpen: true,
      status: 'ACTIVE',
      _count: { participants: 3 },
    });
    getActiveParticipantIdsForSessionMock.mockResolvedValue(new Set(['p1', 'p2', 'p3']));
    redisMock.hgetall.mockImplementation(async (key: string) =>
      key === 'qf:tempo:buckets:ABCDEF'
        ? {
            [String(Date.now())]: JSON.stringify({
              totalVotes: 0,
              distribution: { SPEED_UP: 0, FOLLOWING: 0, SLOW_DOWN: 0, LOST: 0 },
            }),
          }
        : {},
    );

    const result = await caller.hostResults({ sessionCode: 'ABCDEF' });

    expect(result.distribution).toMatchObject({
      SPEED_UP: 0,
      FOLLOWING: 3,
      SLOW_DOWN: 0,
      LOST: 0,
    });
    expect(result.tempoTrend).toMatchObject({
      status: 'FOLLOWING',
      active: true,
      activeParticipants: 3,
      tempoVotes: 3,
      requiredVotes: 3,
    });
    expect(JSON.stringify(result)).not.toContain(VOTER_ID);
  });

  it('zaehlt bei Tempo bekannte Session-Teilnehmende ohne Presence nicht als online', async () => {
    redisMock.get.mockResolvedValue(
      JSON.stringify({
        type: 'TEMPO',
        locked: false,
        totalVotes: 0,
        distribution: { SPEED_UP: 0, FOLLOWING: 0, SLOW_DOWN: 0, LOST: 0 },
        sessionBound: true,
      }),
    );
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      quickFeedbackEnabled: true,
      quickFeedbackOpen: true,
      status: 'ACTIVE',
      _count: { participants: 4 },
    });
    getActiveParticipantIdsForSessionMock.mockResolvedValue(new Set());
    redisMock.hgetall.mockResolvedValue({});

    const result = await caller.hostResults({ sessionCode: 'ABCDEF' });

    expect(result.totalVotes).toBe(0);
    expect(result.distribution).toMatchObject({
      SPEED_UP: 0,
      FOLLOWING: 0,
      SLOW_DOWN: 0,
      LOST: 0,
    });
    expect(result.tempoTrend).toMatchObject({
      activeParticipants: 0,
      tempoVotes: 0,
    });
  });

  it('zaehlt bei sessiongebundenem Tempo gespeicherte FOLLOWING-Stimmen ohne Presence nicht als online', async () => {
    redisMock.get.mockResolvedValue(
      JSON.stringify({
        type: 'TEMPO',
        locked: false,
        totalVotes: 1,
        distribution: { SPEED_UP: 0, FOLLOWING: 1, SLOW_DOWN: 0, LOST: 0 },
        sessionBound: true,
      }),
    );
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      quickFeedbackEnabled: true,
      quickFeedbackOpen: true,
      status: 'ACTIVE',
      _count: { participants: 1 },
    });
    getActiveParticipantIdsForSessionMock.mockResolvedValue(new Set());
    redisMock.hgetall.mockResolvedValue({});

    const result = await caller.hostResults({ sessionCode: 'ABCDEF' });

    expect(result.totalVotes).toBe(0);
    expect(result.distribution).toMatchObject({
      SPEED_UP: 0,
      FOLLOWING: 0,
      SLOW_DOWN: 0,
      LOST: 0,
    });
    expect(result.tempoTrend).toMatchObject({
      activeParticipants: 0,
      tempoVotes: 0,
    });
  });

  it('zaehlt bei sessiongebundenem Tempo gespeicherte Abweichungen ohne Presence nicht als online', async () => {
    redisMock.get.mockResolvedValue(
      JSON.stringify({
        type: 'TEMPO',
        locked: false,
        totalVotes: 1,
        distribution: { SPEED_UP: 0, FOLLOWING: 0, SLOW_DOWN: 1, LOST: 0 },
        sessionBound: true,
      }),
    );
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      quickFeedbackEnabled: true,
      quickFeedbackOpen: true,
      status: 'ACTIVE',
      _count: { participants: 1 },
    });
    getActiveParticipantIdsForSessionMock.mockResolvedValue(new Set());
    redisMock.hgetall.mockResolvedValue({
      [VOTER_ID]: 'SLOW_DOWN',
    });

    const result = await caller.hostResults({ sessionCode: 'ABCDEF' });

    expect(result.totalVotes).toBe(0);
    expect(result.distribution).toMatchObject({
      SPEED_UP: 0,
      FOLLOWING: 0,
      SLOW_DOWN: 0,
      LOST: 0,
    });
    expect(result.tempoTrend).toMatchObject({
      activeParticipants: 0,
      tempoVotes: 0,
    });
  });

  it('ignoriert bei sessiongebundenem Tempo Choices mit nicht aktiver Standalone-ID', async () => {
    redisMock.get.mockResolvedValue(
      JSON.stringify({
        type: 'TEMPO',
        locked: false,
        totalVotes: 2,
        distribution: { SPEED_UP: 0, FOLLOWING: 1, SLOW_DOWN: 1, LOST: 0 },
        sessionBound: true,
      }),
    );
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      quickFeedbackEnabled: true,
      quickFeedbackOpen: true,
      status: 'ACTIVE',
      _count: { participants: 1 },
    });
    getActiveParticipantIdsForSessionMock.mockResolvedValue(new Set(['participant-live']));
    redisMock.hgetall.mockImplementation(async (key: string) =>
      key === 'qf:choices:ABCDEF'
        ? {
            'standalone-voter': 'SLOW_DOWN',
          }
        : {},
    );

    const result = await caller.hostResults({ sessionCode: 'ABCDEF' });

    expect(result.totalVotes).toBe(1);
    expect(result.distribution).toMatchObject({
      SPEED_UP: 0,
      FOLLOWING: 1,
      SLOW_DOWN: 0,
      LOST: 0,
    });
  });

  it('ignoriert bei sessiongebundenem Tempo alte Trend-Buckets mit nicht aktiven Choices', async () => {
    redisMock.get.mockResolvedValue(
      JSON.stringify({
        type: 'TEMPO',
        locked: false,
        totalVotes: 3,
        distribution: { SPEED_UP: 0, FOLLOWING: 0, SLOW_DOWN: 0, LOST: 3 },
        sessionBound: true,
      }),
    );
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      quickFeedbackEnabled: true,
      quickFeedbackOpen: true,
      status: 'ACTIVE',
      _count: { participants: 3 },
    });
    getActiveParticipantIdsForSessionMock.mockResolvedValue(new Set(['p1', 'p2', 'p3']));
    redisMock.hgetall.mockImplementation(async (key: string) =>
      key === 'qf:tempo:buckets:ABCDEF'
        ? {
            [String(Date.now())]: JSON.stringify({
              totalVotes: 3,
              distribution: { SPEED_UP: 0, FOLLOWING: 0, SLOW_DOWN: 0, LOST: 3 },
            }),
          }
        : {},
    );

    const result = await caller.hostResults({ sessionCode: 'ABCDEF' });

    expect(result.distribution).toMatchObject({
      SPEED_UP: 0,
      FOLLOWING: 3,
      SLOW_DOWN: 0,
      LOST: 0,
    });
    expect(result.tempoTrend).toMatchObject({
      status: 'FOLLOWING',
      active: true,
      activeParticipants: 3,
      tempoVotes: 3,
    });
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
      requiredVotes: 3,
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

  it('ignoriert gefälschte Proxy-Header für den Standalone-Create-Bucket', async () => {
    const trustedIpCaller = quickFeedbackRouter.createCaller({
      req: {
        ip: '198.51.100.77',
        headers: {
          'cf-connecting-ip': '203.0.113.1',
          'true-client-ip': '203.0.113.2',
          'x-forwarded-for': '203.0.113.3',
        },
        socket: { remoteAddress: '127.0.0.1' },
      } as never,
    });

    await trustedIpCaller.create({ type: 'MOOD' });

    expect(checkQuickFeedbackStandaloneCreateRateMock).toHaveBeenCalledWith('198.51.100.77');
  });

  it('begrenzt Standalone-Create-Spam ohne Redis-Runde anzulegen', async () => {
    checkQuickFeedbackStandaloneCreateRateMock.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 300,
    });

    await expect(caller.create({ type: 'MOOD' })).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
      cause: { retryAfterSeconds: 300 },
    });
    expect(redisMock.multi).not.toHaveBeenCalled();
    expect(createFeedbackHostTokenMock).not.toHaveBeenCalled();
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
    expect(checkQuickFeedbackSessionCreateRateMock).not.toHaveBeenCalled();
  });

  it('begrenzt sessiongebundene Host-Starts pro Session statt pro Hörsaal-IP', async () => {
    checkQuickFeedbackSessionCreateRateMock.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 20,
    });

    await expect(
      hostCaller.create({
        type: 'MOOD',
        sessionCode: 'ABC123',
      }),
    ).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
      cause: { retryAfterSeconds: 20 },
    });
    expect(checkQuickFeedbackSessionCreateRateMock).toHaveBeenCalledWith('ABC123');
    expect(checkQuickFeedbackStandaloneCreateRateMock).not.toHaveBeenCalled();
    expect(redisMock.multi).not.toHaveBeenCalled();
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
