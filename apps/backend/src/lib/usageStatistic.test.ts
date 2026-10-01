import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db', () => ({
  prisma: {
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    dailyUsageStatistic: { findMany: vi.fn() },
    usageStatisticOutbox: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('./logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { prisma } from '../db';
import {
  buildUsageReport,
  classBump,
  enqueueUsageStatisticEvent,
  percentileFromSizeClassCounts,
  processUsageStatisticOutbox,
  recordUsageQuizAnswer,
  recordUsageSessionParticipation,
  resetUsageTrackingThrottleForTests,
  resolveUsagePeriod,
  sizeClassBump,
  sizeClassForCount,
} from './usageStatistic';

describe('usageStatistic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetUsageTrackingThrottleForTests();
  });

  it('löst Semester- und 30-Tage-Fenster in UTC auf', () => {
    const winter = resolveUsagePeriod('CURRENT_SEMESTER', new Date('2026-11-15T12:00:00.000Z'));
    expect(winter.from.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(winter.to.toISOString()).toBe('2026-11-15T00:00:00.000Z');

    const last30 = resolveUsagePeriod('LAST_30_DAYS', new Date('2026-05-04T15:00:00.000Z'));
    expect(last30.from.toISOString()).toBe('2026-04-05T00:00:00.000Z');
    expect(last30.to.toISOString()).toBe('2026-05-04T00:00:00.000Z');
  });

  it('ordnet Sessiongrößen dokumentierten Klassen zu', () => {
    expect(sizeClassForCount(1)).toBe('XS');
    expect(sizeClassForCount(30)).toBe('S');
    expect(sizeClassForCount(100)).toBe('M');
    expect(sizeClassForCount(301)).toBe('XL');
  });

  it('bildet Größenklassen-Bumps beim Grenzübertritt', () => {
    expect(sizeClassBump(0, 1)).toEqual({ sizeClassXs: 1 });
    expect(sizeClassBump(10, 11)).toEqual({ sizeClassXs: -1, sizeClassS: 1 });
    expect(sizeClassBump(5, 8)).toEqual({});
  });

  it('bildet disjunkte Funktionsklassen-Bumps inkl. JOIN_ONLY', () => {
    expect(classBump(null, 'JOIN_ONLY')).toEqual({ sessionsJoinOnly: 1 });
    expect(classBump('JOIN_ONLY', 'QUIZ_ONLY')).toEqual({
      sessionsJoinOnly: -1,
      sessionsQuizOnly: 1,
    });
    expect(classBump('QUIZ_ONLY', 'COMBINED')).toEqual({
      sessionsQuizOnly: -1,
      sessionsCombined: 1,
    });
    expect(classBump('QA_ONLY', 'QA_ONLY')).toEqual({});
  });

  it('schätzt Quantile aus Größenklassen-Histogrammen', () => {
    const counts = { XS: 2, S: 2, M: 0, L: 0, XL: 0 };
    expect(percentileFromSizeClassCounts(counts, 0.5)).toBe(13);
  });

  it('schreibt Erstteilnahme in einer Transaktion (Projektion + Tagesbump)', async () => {
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            functionClass: 'JOIN_ONLY',
            firstUsedUtcDate: new Date('2026-05-04T00:00:00.000Z'),
            hasQuizInteraction: false,
            hasQaInteraction: false,
            participationCount: 1,
          },
        ]),
      $executeRaw: vi.fn().mockResolvedValue(1),
    };
    vi.mocked(prisma.$transaction).mockImplementation(((fn: (t: typeof tx) => unknown) =>
      fn(tx)) as unknown as typeof prisma.$transaction);

    await recordUsageSessionParticipation('session-1', new Date('2026-05-04T12:00:00.000Z'));

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    // Advisory lock + projection upsert + daily bump in derselben Transaktion.
    expect(tx.$executeRaw.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('setzt Quiz-Funktionsklasse von JOIN_ONLY auf QUIZ_ONLY ohne doppeltes sessionsUsed', async () => {
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([
          {
            functionClass: 'JOIN_ONLY',
            firstUsedUtcDate: new Date('2026-05-01T00:00:00.000Z'),
            hasQuizInteraction: false,
            hasQaInteraction: false,
            participationCount: 3,
          },
        ])
        .mockResolvedValueOnce([
          {
            functionClass: 'QUIZ_ONLY',
            firstUsedUtcDate: new Date('2026-05-01T00:00:00.000Z'),
            hasQuizInteraction: true,
            hasQaInteraction: false,
            participationCount: 3,
          },
        ]),
      $executeRaw: vi.fn().mockResolvedValue(1),
    };
    vi.mocked(prisma.$transaction).mockImplementation(((fn: (t: typeof tx) => unknown) =>
      fn(tx)) as unknown as typeof prisma.$transaction);

    await recordUsageQuizAnswer('session-1', new Date('2026-05-04T12:00:00.000Z'));
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(tx.$executeRaw.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('aggregiert Report mit Pre-Tracking-Lücken und Größenklassen aus Tagesaggregaten', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      {
        usageStatisticsTrackingStartedAt: new Date('2026-05-01T00:00:00.000Z'),
        usageStatisticsProjectedAt: new Date('2026-05-04T12:00:00.000Z'),
        qaStatisticsTrackingStartedAt: null,
        qaQuestionsTotal: 0,
        completedSessionsTotal: 4,
      },
    ]);
    vi.mocked(prisma.dailyUsageStatistic.findMany).mockResolvedValue([
      {
        date: new Date('2026-05-03T00:00:00.000Z'),
        sessionsUsed: 2,
        sessionParticipations: 5,
        quizAnswers: 7,
        qaQuestionsAccepted: 1,
        qaRatingActions: 0,
        sessionsJoinOnly: 0,
        sessionsQuizOnly: 1,
        sessionsQaOnly: 0,
        sessionsCombined: 1,
        sizeClassXs: 0,
        sizeClassS: 1,
        sizeClassM: 1,
        sizeClassL: 0,
        sizeClassXl: 0,
      },
    ] as never);

    const report = await buildUsageReport({
      kind: 'CUSTOM',
      from: '2026-04-30',
      to: '2026-05-04',
      now: new Date('2026-05-04T15:00:00.000Z'),
    });

    expect(report.historyComplete).toBe(false);
    expect(report.sessionsUsed).toBe(2);
    expect(report.sessionsByFunction).toEqual({
      joinOnly: 0,
      quizOnly: 1,
      qaOnly: 0,
      combined: 1,
    });
    expect(report.monthlySeries.length).toBeGreaterThan(0);
    const preTracking = report.dailySeries.find((d) => d.date === '2026-04-30');
    expect(preTracking?.sessionsUsed).toBeNull();
    const measured = report.dailySeries.find((d) => d.date === '2026-05-03');
    expect(measured?.sessionsUsed).toBe(2);
    expect(report.sizeDistribution?.sampleSize).toBe(2);
    expect(report.sizeDistribution?.classes).toEqual([
      { id: 'XS', label: '1–10', count: 0 },
      { id: 'S', label: '11–30', count: 1 },
      { id: 'M', label: '31–100', count: 1 },
      { id: 'L', label: '101–300', count: 0 },
      { id: 'XL', label: '301+', count: 0 },
    ]);
    expect(report.sizeDistribution?.median).toBe(43);
  });

  it('setzt historyComplete nur wenn Erfassung den gesamten 30-Tage-Zeitraum abdeckt', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      {
        usageStatisticsTrackingStartedAt: new Date('2026-04-01T00:00:00.000Z'),
        usageStatisticsProjectedAt: new Date('2026-05-04T12:00:00.000Z'),
        qaStatisticsTrackingStartedAt: null,
        qaQuestionsTotal: 0,
        completedSessionsTotal: 0,
      },
    ]);
    vi.mocked(prisma.dailyUsageStatistic.findMany).mockResolvedValue([] as never);

    const complete = await buildUsageReport({
      kind: 'LAST_30_DAYS',
      now: new Date('2026-05-04T15:00:00.000Z'),
    });
    expect(complete.periodFrom).toBe('2026-04-05');
    expect(complete.historyComplete).toBe(true);

    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      {
        usageStatisticsTrackingStartedAt: new Date('2026-05-01T08:00:00.000Z'),
        usageStatisticsProjectedAt: new Date('2026-05-04T12:00:00.000Z'),
        qaStatisticsTrackingStartedAt: null,
        qaQuestionsTotal: 0,
        completedSessionsTotal: 0,
      },
    ]);
    vi.mocked(prisma.dailyUsageStatistic.findMany).mockResolvedValue([] as never);

    const incomplete = await buildUsageReport({
      kind: 'LAST_30_DAYS',
      now: new Date('2026-05-04T15:00:00.000Z'),
    });
    expect(incomplete.historyComplete).toBe(false);
    const earlyDay = incomplete.dailySeries.find((d) => d.date === '2026-04-10');
    expect(earlyDay?.sessionsUsed).toBeNull();
  });

  it('schreibt Outbox-Intent und verarbeitet fehlgeschlagene Drains nach', async () => {
    const tx = { usageStatisticOutbox: { create: vi.fn().mockResolvedValue({}) } };
    await enqueueUsageStatisticEvent(tx, {
      kind: 'PARTICIPATION',
      sessionId: 'session-1',
      idempotencyKey: 'participation:p1',
    });
    expect(tx.usageStatisticOutbox.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: 'PARTICIPATION',
        sessionId: 'session-1',
        idempotencyKey: 'participation:p1',
      }),
    });

    vi.mocked(prisma.usageStatisticOutbox.findMany).mockResolvedValue([
      {
        id: 'outbox-1',
        kind: 'PARTICIPATION',
        sessionId: 'session-1',
        idempotencyKey: 'participation:p1',
        createdAt: new Date(),
        processedAt: null,
        attempts: 0,
        lastError: null,
      },
    ] as never);

    const failingTx = {
      $queryRaw: vi.fn().mockRejectedValue(new Error('db temporarily unavailable')),
      $executeRaw: vi.fn(),
    };
    vi.mocked(prisma.$transaction).mockImplementation(((fn: (t: typeof failingTx) => unknown) =>
      fn(failingTx)) as unknown as typeof prisma.$transaction);
    vi.mocked(prisma.usageStatisticOutbox.update).mockResolvedValue({} as never);

    const first = await processUsageStatisticOutbox(10, new Date('2026-05-04T12:00:00.000Z'));
    expect(first).toBe(0);
    expect(prisma.usageStatisticOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'outbox-1' },
        data: expect.objectContaining({ attempts: { increment: 1 } }),
      }),
    );

    const okTx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            functionClass: 'JOIN_ONLY',
            firstUsedUtcDate: new Date('2026-05-04T00:00:00.000Z'),
            hasQuizInteraction: false,
            hasQaInteraction: false,
            participationCount: 1,
          },
        ]),
      $executeRaw: vi.fn().mockResolvedValue(1),
    };
    vi.mocked(prisma.$transaction).mockImplementation(((fn: (t: typeof okTx) => unknown) =>
      fn(okTx)) as unknown as typeof prisma.$transaction);
    vi.mocked(prisma.usageStatisticOutbox.findMany).mockResolvedValue([
      {
        id: 'outbox-1',
        kind: 'PARTICIPATION',
        sessionId: 'session-1',
        idempotencyKey: 'participation:p1',
        createdAt: new Date(),
        processedAt: null,
        attempts: 1,
        lastError: 'db temporarily unavailable',
      },
    ] as never);

    const second = await processUsageStatisticOutbox(10, new Date('2026-05-04T12:00:00.000Z'));
    expect(second).toBe(1);
    expect(prisma.usageStatisticOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'outbox-1' },
        data: expect.objectContaining({ processedAt: expect.any(Date), lastError: null }),
      }),
    );
  });
});
