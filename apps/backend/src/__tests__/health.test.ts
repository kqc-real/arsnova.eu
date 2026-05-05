/**
 * Tests für den Health-Router (Story 0.1, 0.2, 0.4).
 * Mocked: Redis (pingRedis) und Prisma (session.count/findMany).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Redis from 'ioredis';

vi.mock('../redis', () => ({
  pingRedis: vi.fn(),
  getRedis: vi.fn(() => ({
    scan: vi.fn().mockResolvedValue(['0', []]),
  })),
}));

vi.mock('../db', () => ({
  prisma: {
    session: { count: vi.fn(), findMany: vi.fn() },
    dailyStatistic: { findMany: vi.fn() },
    platformStatistic: { findUnique: vi.fn() },
  },
}));

vi.mock('../lib/platformStatistic', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/platformStatistic')>();
  return {
    ...actual,
    updateCompletedSessionsTotal: vi.fn(),
  };
});

vi.mock('../lib/presence', () => ({
  countActiveParticipantsForSessions: vi.fn(),
  getActiveParticipantCountsForSessions: vi.fn(),
}));

vi.mock('../lib/loadSignal', () => ({
  readLoadSignals: vi.fn(),
}));

vi.mock('../lib/sloTelemetry', () => ({
  readSloSignals: vi.fn(),
  isTrackedLiveProcedure: vi.fn(() => false),
  recordLiveRequestTelemetry: vi.fn(),
}));

import { pingRedis, getRedis } from '../redis';
import { prisma } from '../db';
import { updateCompletedSessionsTotal } from '../lib/platformStatistic';
import { countActiveParticipantsForSessions } from '../lib/presence';
import { getActiveParticipantCountsForSessions } from '../lib/presence';
import { readLoadSignals } from '../lib/loadSignal';
import { readSloSignals } from '../lib/sloTelemetry';
import { healthRouter, heartbeatGenerator } from '../routers/health';

const caller = healthRouter.createCaller({ req: undefined });

describe('health.check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.session.findMany).mockResolvedValue([]);
    vi.mocked(prisma.dailyStatistic.findMany).mockResolvedValue([]);
    vi.mocked(countActiveParticipantsForSessions).mockResolvedValue(0);
    vi.mocked(getActiveParticipantCountsForSessions).mockResolvedValue(new Map());
    vi.mocked(readLoadSignals).mockResolvedValue({
      votesLastMinute: 0,
      sessionTransitionsLastMinute: 0,
      activeCountdownSessions: 0,
    });
    vi.mocked(readSloSignals).mockResolvedValue({
      totalRequestsLastMinute: 0,
      errorRatePercentLastMinute: 0,
      p95LatencyMsLastMinute: 0,
      p99LatencyMsLastMinute: 0,
    });
  });

  it('gibt status "ok" zurück wenn Redis erreichbar ist', async () => {
    vi.mocked(pingRedis).mockResolvedValue(true);

    const result = await caller.check(undefined);

    expect(result.status).toBe('ok');
    expect(result.redis).toBe('ok');
    expect(result.timestamp).toBeDefined();
    expect(result.version).toBeDefined();
  });

  it('gibt redis "unavailable" zurück wenn Redis nicht erreichbar ist', async () => {
    vi.mocked(pingRedis).mockResolvedValue(false);

    const result = await caller.check(undefined);

    expect(result.status).toBe('ok');
    expect(result.redis).toBe('unavailable');
  });
});

describe('health.footerBundle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.session.findMany).mockResolvedValue([]);
    vi.mocked(prisma.dailyStatistic.findMany).mockResolvedValue([]);
    vi.mocked(countActiveParticipantsForSessions).mockResolvedValue(0);
    vi.mocked(getActiveParticipantCountsForSessions).mockResolvedValue(new Map());
    vi.mocked(readLoadSignals).mockResolvedValue({
      votesLastMinute: 0,
      sessionTransitionsLastMinute: 0,
      activeCountdownSessions: 0,
    });
    vi.mocked(readSloSignals).mockResolvedValue({
      totalRequestsLastMinute: 0,
      errorRatePercentLastMinute: 0,
      p95LatencyMsLastMinute: 0,
      p99LatencyMsLastMinute: 0,
    });
  });

  it('liefert check und stats in einem Aufruf', async () => {
    vi.mocked(pingRedis).mockResolvedValue(true);
    vi.mocked(prisma.session.count).mockResolvedValue(0);
    vi.mocked(prisma.platformStatistic.findUnique).mockResolvedValue({
      id: 'default',
      updatedAt: new Date(),
      maxParticipantsSingleSession: 42,
      completedSessionsTotal: 0,
    } as never);

    const result = await caller.footerBundle(undefined);

    expect(result.check.status).toBe('ok');
    expect(result.check.redis).toBe('ok');
    expect(result.stats.openSessions).toBe(0);
    expect(result.stats.activeSessions).toBe(0);
    expect(result.stats.votesLastMinute).toBe(0);
    expect(result.stats.sessionTransitionsLastMinute).toBe(0);
    expect(result.stats.activeCountdownSessions).toBe(0);
    expect(result.stats.maxParticipantsSingleSession).toBe(42);
    expect(result.stats.dailyHighscores).toHaveLength(30);
    expect(result.stats.maxParticipantsStatisticUpdatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.stats.serviceStatus).toBe('stable');
    expect(result.stats.loadStatus).toBe('healthy');
  });
});

describe('health.stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.session.findMany).mockResolvedValue([]);
    vi.mocked(prisma.dailyStatistic.findMany).mockResolvedValue([]);
    vi.mocked(countActiveParticipantsForSessions).mockResolvedValue(0);
    vi.mocked(getActiveParticipantCountsForSessions).mockResolvedValue(new Map());
    vi.mocked(readLoadSignals).mockResolvedValue({
      votesLastMinute: 0,
      sessionTransitionsLastMinute: 0,
      activeCountdownSessions: 0,
    });
    vi.mocked(readSloSignals).mockResolvedValue({
      totalRequestsLastMinute: 0,
      errorRatePercentLastMinute: 0,
      p95LatencyMsLastMinute: 0,
      p99LatencyMsLastMinute: 0,
    });
  });

  it('liefert Initialwerte (0) wenn keine Sessions existieren', async () => {
    vi.mocked(prisma.session.count).mockResolvedValue(0);
    vi.mocked(prisma.platformStatistic.findUnique).mockResolvedValue(null);

    const result = await caller.stats(undefined);

    expect(result.openSessions).toBe(0);
    expect(result.activeSessions).toBe(0);
    expect(result.totalParticipants).toBe(0);
    expect(result.votesLastMinute).toBe(0);
    expect(result.sessionTransitionsLastMinute).toBe(0);
    expect(result.activeCountdownSessions).toBe(0);
    expect(result.completedSessions).toBe(0);
    expect(result.maxParticipantsSingleSession).toBe(0);
    expect(result.dailyHighscores).toHaveLength(30);
    expect(
      result.dailyHighscores.every((entry) => entry.count === 0 && entry.updatedAt === null),
    ).toBe(true);
    expect(result.maxParticipantsStatisticUpdatedAt).toBeNull();
    expect(result.serviceStatus).toBe('stable');
    expect(result.loadStatus).toBe('healthy');
  });

  it('berechnet loadStatus "healthy" bei niedriger Last', async () => {
    vi.mocked(prisma.session.count)
      .mockResolvedValueOnce(10) // openSessions (status != FINISHED)
      .mockResolvedValueOnce(5); // completedSessions (FINISHED)
    vi.mocked(prisma.session.findMany).mockResolvedValue(
      Array.from({ length: 10 }, (_, index) => ({ id: `s-${index + 1}` })) as never,
    );
    vi.mocked(countActiveParticipantsForSessions).mockResolvedValue(42);
    vi.mocked(getActiveParticipantCountsForSessions).mockResolvedValue(
      new Map(Array.from({ length: 10 }, (_, index) => [`s-${index + 1}`, index < 2 ? 21 : 0])),
    );
    vi.mocked(prisma.platformStatistic.findUnique).mockResolvedValue({
      id: 'default',
      updatedAt: new Date(),
      maxParticipantsSingleSession: 100,
      completedSessionsTotal: 0,
    } as never);

    const result = await caller.stats(undefined);

    expect(result.openSessions).toBe(10);
    expect(result.activeSessions).toBe(2);
    expect(result.totalParticipants).toBe(42);
    expect(result.votesLastMinute).toBe(0);
    expect(result.sessionTransitionsLastMinute).toBe(0);
    expect(result.activeCountdownSessions).toBe(0);
    expect(result.completedSessions).toBe(5);
    expect(result.maxParticipantsSingleSession).toBe(100);
    expect(result.loadStatus).toBe('healthy');
    expect(result.serviceStatus).toBe('stable');
    expect(prisma.session.count).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          status: { not: 'FINISHED' },
        }),
      }),
    );
    expect(prisma.session.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { not: 'FINISHED' },
        }),
        select: { id: true },
      }),
    );
    expect(countActiveParticipantsForSessions).toHaveBeenCalledWith(
      Array.from({ length: 10 }, (_, index) => `s-${index + 1}`),
    );
  });

  it('berechnet loadStatus "busy" bei hoher Teilnehmerzahl (Hard-Limit)', async () => {
    vi.mocked(prisma.session.count).mockResolvedValueOnce(6).mockResolvedValueOnce(50);
    vi.mocked(countActiveParticipantsForSessions).mockResolvedValue(69);
    vi.mocked(getActiveParticipantCountsForSessions).mockResolvedValue(
      new Map([
        ['s-1', 20],
        ['s-2', 18],
        ['s-3', 12],
        ['s-4', 10],
        ['s-5', 5],
        ['s-6', 4],
      ]),
    );
    vi.mocked(prisma.platformStatistic.findUnique).mockResolvedValue({
      id: 'default',
      updatedAt: new Date(),
      maxParticipantsSingleSession: 0,
      completedSessionsTotal: 0,
    } as never);

    const result = await caller.stats(undefined);

    expect(result.openSessions).toBe(6);
    expect(result.activeSessions).toBe(5);
    expect(result.loadStatus).toBe('busy');
    expect(result.serviceStatus).toBe('limited');
  });

  it('berechnet loadStatus "overloaded" bei sehr hoher Teilnehmerzahl', async () => {
    vi.mocked(prisma.session.count).mockResolvedValueOnce(12).mockResolvedValueOnce(1000);
    vi.mocked(countActiveParticipantsForSessions).mockResolvedValue(260);
    vi.mocked(getActiveParticipantCountsForSessions).mockResolvedValue(
      new Map(Array.from({ length: 12 }, (_, index) => [`s-${index + 1}`, 10])),
    );
    vi.mocked(prisma.platformStatistic.findUnique).mockResolvedValue({
      id: 'default',
      updatedAt: new Date(),
      maxParticipantsSingleSession: 0,
      completedSessionsTotal: 0,
    } as never);

    const result = await caller.stats(undefined);

    expect(result.openSessions).toBe(12);
    expect(result.activeSessions).toBe(12);
    expect(result.loadStatus).toBe('overloaded');
    expect(result.serviceStatus).toBe('critical');
  });

  it('berücksichtigt Dynamiksignal (Votes/Transitions/Countdown) auch bei moderaten Bestandswerten', async () => {
    vi.mocked(prisma.session.count).mockResolvedValueOnce(10).mockResolvedValueOnce(20);
    vi.mocked(countActiveParticipantsForSessions).mockResolvedValue(40);
    vi.mocked(getActiveParticipantCountsForSessions).mockResolvedValue(
      new Map([
        ['s-1', 10],
        ['s-2', 10],
        ['s-3', 10],
        ['s-4', 10],
      ]),
    );
    vi.mocked(readLoadSignals).mockResolvedValue({
      votesLastMinute: 280,
      sessionTransitionsLastMinute: 16,
      activeCountdownSessions: 12,
    });
    vi.mocked(prisma.platformStatistic.findUnique).mockResolvedValue({
      id: 'default',
      updatedAt: new Date(),
      maxParticipantsSingleSession: 0,
      completedSessionsTotal: 0,
    } as never);

    const result = await caller.stats(undefined);

    expect(result.votesLastMinute).toBe(280);
    expect(result.sessionTransitionsLastMinute).toBe(16);
    expect(result.activeCountdownSessions).toBe(12);
    expect(result.loadStatus).toBe('busy');
    expect(result.serviceStatus).toBe('limited');
  });

  it('leitet serviceStatus aus echter SLO-Telemetrie ab (critical bei schlechter Latenz)', async () => {
    vi.mocked(prisma.session.count).mockResolvedValueOnce(8).mockResolvedValueOnce(20);
    vi.mocked(countActiveParticipantsForSessions).mockResolvedValue(35);
    vi.mocked(getActiveParticipantCountsForSessions).mockResolvedValue(
      new Map([
        ['s-1', 10],
        ['s-2', 10],
        ['s-3', 8],
        ['s-4', 7],
      ]),
    );
    vi.mocked(readLoadSignals).mockResolvedValue({
      votesLastMinute: 20,
      sessionTransitionsLastMinute: 2,
      activeCountdownSessions: 1,
    });
    vi.mocked(readSloSignals).mockResolvedValue({
      totalRequestsLastMinute: 120,
      errorRatePercentLastMinute: 1.4,
      p95LatencyMsLastMinute: 1900,
      p99LatencyMsLastMinute: 4200,
    });
    vi.mocked(prisma.platformStatistic.findUnique).mockResolvedValue({
      id: 'default',
      updatedAt: new Date(),
      maxParticipantsSingleSession: 0,
      completedSessionsTotal: 0,
    } as never);

    const result = await caller.stats(undefined);

    expect(result.loadStatus).toBe('healthy');
    expect(result.serviceStatus).toBe('critical');
  });

  it('exponiert keine personenbezogenen Daten – nur aggregierte Zahlen', async () => {
    vi.mocked(prisma.session.count).mockResolvedValue(0);
    vi.mocked(prisma.platformStatistic.findUnique).mockResolvedValue({
      id: 'default',
      updatedAt: new Date(),
      maxParticipantsSingleSession: 0,
      completedSessionsTotal: 0,
    } as never);

    const result = await caller.stats(undefined);

    const keys = Object.keys(result);
    expect(keys).toEqual(
      expect.arrayContaining([
        'openSessions',
        'activeSessions',
        'totalParticipants',
        'votesLastMinute',
        'sessionTransitionsLastMinute',
        'activeCountdownSessions',
        'completedSessions',
        'activeBlitzRounds',
        'maxParticipantsSingleSession',
        'dailyHighscores',
        'maxParticipantsStatisticUpdatedAt',
        'serviceStatus',
        'loadStatus',
      ]),
    );
    expect(keys).not.toContain('participants');
    expect(keys).not.toContain('nicknames');
    expect(keys).not.toContain('emails');
  });

  it('zählt activeBlitzRounds nur einmal pro Quick-Feedback (Primär-Key qf:<code>)', async () => {
    vi.mocked(getRedis).mockReturnValueOnce({
      scan: vi
        .fn()
        .mockResolvedValue([
          '0',
          [
            'qf:ABCD12',
            'qf:voters:ABCD12',
            'qf:choices:ABCD12',
            'qf:choices:r1:ABCD12',
            'qf:host:ABCD12',
            'qf:ZZZZ99',
          ],
        ]),
    } as unknown as Redis);
    vi.mocked(prisma.session.count).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    vi.mocked(prisma.platformStatistic.findUnique).mockResolvedValue(null);

    const result = await caller.stats(undefined);

    expect(result.activeBlitzRounds).toBe(2);
  });

  it('nutzt DB-Statistiken weiter, wenn Redis-Scan fehlschlägt', async () => {
    vi.mocked(getRedis).mockReturnValueOnce({
      scan: vi.fn().mockRejectedValue(new Error('redis unavailable')),
    } as unknown as Redis);
    vi.mocked(prisma.session.count).mockResolvedValueOnce(6).mockResolvedValueOnce(11);
    vi.mocked(prisma.session.findMany).mockResolvedValue([{ id: 's-1' }, { id: 's-2' }] as never);
    vi.mocked(countActiveParticipantsForSessions).mockResolvedValue(69);
    vi.mocked(getActiveParticipantCountsForSessions).mockResolvedValue(
      new Map([
        ['s-1', 40],
        ['s-2', 29],
      ]),
    );
    vi.mocked(prisma.platformStatistic.findUnique).mockResolvedValue({
      id: 'default',
      updatedAt: new Date(),
      maxParticipantsSingleSession: 120,
      completedSessionsTotal: 0,
    } as never);

    const result = await caller.stats(undefined);

    expect(result.openSessions).toBe(6);
    expect(result.activeSessions).toBe(2);
    expect(result.totalParticipants).toBe(69);
    expect(result.completedSessions).toBe(11);
    expect(result.activeBlitzRounds).toBe(0);
    expect(result.maxParticipantsSingleSession).toBe(120);
  });

  it('nutzt monotone completedSessionsTotal auch wenn FINISHED-Zeilen sinken', async () => {
    vi.mocked(prisma.session.count).mockResolvedValueOnce(0).mockResolvedValueOnce(11);
    vi.mocked(prisma.platformStatistic.findUnique).mockResolvedValue({
      id: 'default',
      updatedAt: new Date(),
      maxParticipantsSingleSession: 120,
      completedSessionsTotal: 12,
    } as never);

    const result = await caller.stats(undefined);

    expect(result.completedSessions).toBe(12);
    expect(updateCompletedSessionsTotal).not.toHaveBeenCalled();
  });

  it('persistiert höhere FINISHED-Zahl in den monotonen Counter', async () => {
    vi.mocked(prisma.session.count).mockResolvedValueOnce(0).mockResolvedValueOnce(13);
    vi.mocked(prisma.platformStatistic.findUnique).mockResolvedValue({
      id: 'default',
      updatedAt: new Date(),
      maxParticipantsSingleSession: 120,
      completedSessionsTotal: 12,
    } as never);

    const result = await caller.stats(undefined);

    expect(result.completedSessions).toBe(13);
    expect(updateCompletedSessionsTotal).toHaveBeenCalledWith(13);
  });

  it('zählt nur Sessions mit mindestens 5 aktiven Teilnehmenden als activeSessions', async () => {
    vi.mocked(prisma.session.count).mockResolvedValueOnce(4).mockResolvedValueOnce(2);
    vi.mocked(prisma.session.findMany).mockResolvedValue([
      { id: 's-1' },
      { id: 's-2' },
      { id: 's-3' },
      { id: 's-4' },
    ] as never);
    vi.mocked(countActiveParticipantsForSessions).mockResolvedValue(14);
    vi.mocked(getActiveParticipantCountsForSessions).mockResolvedValue(
      new Map([
        ['s-1', 5],
        ['s-2', 4],
        ['s-3', 0],
        ['s-4', 5],
      ]),
    );
    vi.mocked(prisma.platformStatistic.findUnique).mockResolvedValue(null);

    const result = await caller.stats(undefined);

    expect(result.openSessions).toBe(4);
    expect(result.activeSessions).toBe(2);
    expect(result.totalParticipants).toBe(14);
  });

  it('liefert die letzten 30 UTC-Tage chronologisch und füllt Lücken mit 0 auf', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-04T15:30:00.000Z'));
    vi.mocked(prisma.session.count).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    vi.mocked(prisma.platformStatistic.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.dailyStatistic.findMany).mockResolvedValue([
      {
        date: new Date('2026-05-02T00:00:00.000Z'),
        maxParticipantsSingleSession: 17,
        updatedAt: new Date('2026-05-02T10:15:30.000Z'),
      },
      {
        date: new Date('2026-05-04T00:00:00.000Z'),
        maxParticipantsSingleSession: 23,
        updatedAt: new Date('2026-05-04T12:45:00.000Z'),
      },
    ] as never);

    try {
      const result = await caller.stats(undefined);

      expect(result.dailyHighscores).toHaveLength(30);
      expect(result.dailyHighscores[0]).toEqual({
        date: '2026-04-05',
        count: 0,
        updatedAt: null,
      });
      expect(result.dailyHighscores.slice(-3)).toEqual([
        { date: '2026-05-02', count: 17, updatedAt: '2026-05-02T10:15:30.000Z' },
        { date: '2026-05-03', count: 0, updatedAt: null },
        { date: '2026-05-04', count: 23, updatedAt: '2026-05-04T12:45:00.000Z' },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('health.ping (Story 0.2 – Subscription Heartbeat)', () => {
  it('liefert mindestens einen Heartbeat mit ISO-Timestamp', async () => {
    const stream = heartbeatGenerator(10); // kurzes Intervall für Test
    const { value } = await stream.next();
    expect(value).toBeDefined();
    expect(value).toHaveProperty('heartbeat');
    expect(typeof value!.heartbeat).toBe('string');
    expect(value!.heartbeat).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
