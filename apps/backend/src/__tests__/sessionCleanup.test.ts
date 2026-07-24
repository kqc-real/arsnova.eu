import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, platformStatisticMocks, loggerMocks } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
    session: {
      updateMany: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    quiz: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    bonusToken: {
      deleteMany: vi.fn(),
    },
    sessionFeedback: {
      deleteMany: vi.fn(),
    },
  },
  platformStatisticMocks: {
    incrementCompletedSessionsTotal: vi.fn(),
  },
  loggerMocks: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/platformStatistic', () => ({
  incrementCompletedSessionsTotal: platformStatisticMocks.incrementCompletedSessionsTotal,
}));

vi.mock('../lib/logger', () => ({
  logger: loggerMocks,
}));

import {
  cleanupExpiredFinishedSessions,
  cleanupExpiredSessionFeedback,
  cleanupOrphanQuizUploads,
  cleanupStaleSessions,
  ORPHAN_QUIZ_CLEANUP_BATCH_SIZE,
} from '../lib/sessionCleanup';

describe('sessionCleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock),
    );
  });

  it('inkrementiert den completedSessionsCounter fuer automatisch beendete verwaiste Sessions', async () => {
    prismaMock.session.updateMany.mockResolvedValue({ count: 3 });

    const result = await cleanupStaleSessions();

    expect(result).toBe(3);
    expect(platformStatisticMocks.incrementCompletedSessionsTotal).toHaveBeenCalledWith(3);
  });

  it('inkrementiert den completedSessionsCounter nicht, wenn keine Session beendet wurde', async () => {
    prismaMock.session.updateMany.mockResolvedValue({ count: 0 });

    const result = await cleanupStaleSessions();

    expect(result).toBe(0);
    expect(platformStatisticMocks.incrementCompletedSessionsTotal).not.toHaveBeenCalled();
  });

  it('loescht abgelaufenes Session-Feedback mit eigener Retention', async () => {
    prismaMock.sessionFeedback.deleteMany.mockResolvedValue({ count: 4 });

    const result = await cleanupExpiredSessionFeedback();

    expect(result).toBe(4);
    expect(prismaMock.sessionFeedback.deleteMany).toHaveBeenCalledWith({
      where: {
        createdAt: { lt: expect.any(Date) },
        session: { status: 'FINISHED' },
      },
    });
    expect(loggerMocks.info).toHaveBeenCalledWith(
      expect.stringContaining('SessionFeedback-Cleanup: 4 Bewertung(en)'),
    );
  });

  it('purged nur beendete Sessions ohne aktiven Bonus- oder Feedback-Verlauf', async () => {
    prismaMock.session.findMany.mockResolvedValue([
      { id: 'session-1', quizId: 'quiz-1' },
      { id: 'session-2', quizId: null },
    ]);
    prismaMock.session.deleteMany.mockResolvedValue({ count: 2 });
    prismaMock.quiz.findMany.mockResolvedValue([{ id: 'quiz-1' }]);
    prismaMock.quiz.deleteMany.mockResolvedValue({ count: 1 });

    const result = await cleanupExpiredFinishedSessions();

    expect(result).toBe(2);
    expect(prismaMock.session.findMany).toHaveBeenCalledWith({
      where: {
        status: 'FINISHED',
        endedAt: { not: null, lt: expect.any(Date) },
        OR: [{ legalHoldUntil: null }, { legalHoldUntil: { lte: expect.any(Date) } }],
        bonusTokens: {
          none: {
            generatedAt: { gte: expect.any(Date) },
          },
        },
        sessionFeedbacks: {
          none: {
            createdAt: { gte: expect.any(Date) },
          },
        },
      },
      select: {
        id: true,
        quizId: true,
      },
    });
    expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['session-1', 'session-2'] } },
    });
    expect(prismaMock.quiz.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['quiz-1'] },
        sessions: { none: {} },
      },
      select: { id: true },
    });
    expect(prismaMock.quiz.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['quiz-1'] } },
    });
    expect(loggerMocks.info).toHaveBeenCalledWith(
      expect.stringContaining('Session-Purge: 2 beendete Session(s)'),
    );
  });

  it('löscht verwaiste Uploads bounded und prüft Schutzbedingungen beim Delete erneut', async () => {
    prismaMock.quiz.findMany.mockResolvedValue([
      { id: 'orphan-1', historyScopeId: null },
      { id: 'orphan-2', historyScopeId: null },
    ]);
    prismaMock.quiz.deleteMany.mockResolvedValue({ count: 1 });

    await expect(cleanupOrphanQuizUploads()).resolves.toBe(1);

    expect(prismaMock.quiz.findMany).toHaveBeenCalledWith({
      where: {
        createdAt: { lt: expect.any(Date) },
        sessions: { none: {} },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: ORPHAN_QUIZ_CLEANUP_BATCH_SIZE,
      select: { id: true, historyScopeId: true },
    });
    expect(prismaMock.quiz.deleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['orphan-1', 'orphan-2'] },
        createdAt: { lt: expect.any(Date) },
        sessions: { none: {} },
      },
    });
    expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
  });

  it('löscht keine Quiz-Sammlung, History oder Session-gebundene Quizkopie', async () => {
    prismaMock.quiz.findMany
      .mockResolvedValueOnce([
        {
          id: 'history-anchor',
          historyScopeId: '11111111-1111-4111-8111-111111111111',
        },
      ])
      .mockResolvedValueOnce([
        {
          historyScopeId: '11111111-1111-4111-8111-111111111111',
        },
      ]);

    await expect(cleanupOrphanQuizUploads()).resolves.toBe(0);

    expect(prismaMock.quiz.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdAt: { lt: expect.any(Date) },
          sessions: { none: {} },
        },
      }),
    );
    expect(prismaMock.quiz.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        historyScopeId: {
          in: ['11111111-1111-4111-8111-111111111111'],
        },
        sessions: { some: {} },
      },
      select: { historyScopeId: true },
    });
    expect(prismaMock.quiz.deleteMany).not.toHaveBeenCalled();
  });

  it('löscht moderne verwaiste Uploadkopien ohne Session-Historie im Scope', async () => {
    const scopeId = '22222222-2222-4222-8222-222222222222';
    prismaMock.quiz.findMany
      .mockResolvedValueOnce([{ id: 'modern-orphan', historyScopeId: scopeId }])
      .mockResolvedValueOnce([]);
    prismaMock.quiz.deleteMany.mockResolvedValue({ count: 1 });

    await expect(cleanupOrphanQuizUploads()).resolves.toBe(1);

    expect(prismaMock.quiz.deleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['modern-orphan'] },
        createdAt: { lt: expect.any(Date) },
        sessions: { none: {} },
      },
    });
  });
});
