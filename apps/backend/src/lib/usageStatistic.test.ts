import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db', () => ({
  prisma: {
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    dailyUsageStatistic: { findMany: vi.fn() },
  },
}));

vi.mock('./logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { prisma } from '../db';
import {
  buildUsageReport,
  classBump,
  recordUsageQuizAnswer,
  recordUsageSessionParticipation,
  resetUsageTrackingThrottleForTests,
  resolveUsagePeriod,
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

  it('zaehlt Erstteilnahme atomar (FOR UPDATE Transaktion)', async () => {
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
    vi.mocked(prisma.$executeRaw).mockResolvedValue(1 as never);

    await recordUsageSessionParticipation('session-1', new Date('2026-05-04T12:00:00.000Z'));

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(prisma.$executeRaw).toHaveBeenCalled();
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
    vi.mocked(prisma.$executeRaw).mockResolvedValue(1 as never);

    await recordUsageQuizAnswer('session-1', new Date('2026-05-04T12:00:00.000Z'));
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it('aggregiert Report mit Pre-Tracking-Lücken und joinOnly', async () => {
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([
        {
          usageStatisticsTrackingStartedAt: new Date('2026-05-01T00:00:00.000Z'),
          usageStatisticsProjectedAt: new Date('2026-05-04T12:00:00.000Z'),
          qaStatisticsTrackingStartedAt: null,
          qaQuestionsTotal: 0,
          completedSessionsTotal: 4,
        },
      ])
      .mockResolvedValueOnce([{ participationCount: 12 }, { participationCount: 40 }]);
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
      },
    ] as never);

    const report = await buildUsageReport({
      kind: 'CUSTOM',
      from: '2026-04-30',
      to: '2026-05-04',
      now: new Date('2026-05-04T15:00:00.000Z'),
    });

    expect(report.historyComplete).toBe(true);
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
    expect(report.sizeDistribution?.median).toBe(26);
  });
});
