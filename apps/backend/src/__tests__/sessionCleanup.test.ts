import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, platformStatisticMocks, loggerMocks } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
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
  ORPHAN_QUIZ_CLEANUP_MAX_BATCHES,
  ORPHAN_QUIZ_MAX_SESSIONLESS_PER_HISTORY_SCOPE,
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
    prismaMock.$queryRaw.mockResolvedValue([{ id: 'orphan-1' }, { id: 'orphan-2' }]);

    await expect(cleanupOrphanQuizUploads()).resolves.toBe(2);

    const query = prismaMock.$queryRaw.mock.calls[0]?.[0] as { strings?: string[] };
    const sql = query.strings?.join('?') ?? '';
    expect(sql).toContain('DELETE FROM "Quiz" AS target');
    expect(sql).toContain('RETURNING target."id"');
    expect(sql).toContain('newer_sessionless');
    expect(sql).toContain('FOR UPDATE OF candidate SKIP LOCKED');
    expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
  });

  it('begrenzt sessionlose History-Geschwister trotz aktivem Scope-Anker', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ id: 'excess-sibling' }]);

    await expect(cleanupOrphanQuizUploads()).resolves.toBe(1);

    const query = prismaMock.$queryRaw.mock.calls[0]?.[0] as {
      strings?: string[];
      values?: unknown[];
    };
    const sql = query.strings?.join('?') ?? '';
    expect(sql).toContain('newer_sessionless."historyScopeId" = candidate."historyScopeId"');
    expect(sql).toContain('newer_sessionless."historyScopeId" = target."historyScopeId"');
    expect(sql).toContain('bounded_newer');
    expect(sql).toContain(') >= ?');
    expect(query.values).toEqual(
      expect.arrayContaining([
        ORPHAN_QUIZ_MAX_SESSIONLESS_PER_HISTORY_SCOPE,
        ORPHAN_QUIZ_MAX_SESSIONLESS_PER_HISTORY_SCOPE,
      ]),
    );
    // Keep-Set-Suche ist auf den Grenzwert begrenzt (nicht voller Scope-COUNT).
    expect(sql.match(/AS bounded_newer/g)).toHaveLength(2);
  });

  it('überspringt 100 geschützte alte Scopes vor LIMIT und löscht das spätere echte Orphan', async () => {
    const protectedOldCandidates = Array.from(
      { length: ORPHAN_QUIZ_CLEANUP_BATCH_SIZE },
      (_, index) => `protected-${index}`,
    );
    expect(protectedOldCandidates).toHaveLength(100);
    prismaMock.$queryRaw.mockResolvedValue([{ id: 'later-real-orphan' }]);

    await expect(cleanupOrphanQuizUploads()).resolves.toBe(1);

    const query = prismaMock.$queryRaw.mock.calls[0]?.[0] as { strings?: string[] };
    const sql = query.strings?.join('?') ?? '';
    expect(sql).toContain('scoped_quiz."historyScopeId" = candidate."historyScopeId"');
    expect(sql).toContain('scoped_quiz."historyScopeId" = target."historyScopeId"');
    expect(sql).toContain('FOR UPDATE OF candidate SKIP LOCKED');
    expect(sql.indexOf('scoped_session')).toBeLessThan(sql.indexOf('LIMIT'));
  });

  it('löscht keine Quiz-Sammlung, History oder Session-gebundene Quizkopie', async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);

    await expect(cleanupOrphanQuizUploads()).resolves.toBe(0);

    expect(prismaMock.$queryRaw).toHaveBeenCalledOnce();
  });

  it('holt bis zu 1.300 Orphans pro Stundenlauf bounded auf', async () => {
    const batch = Array.from({ length: ORPHAN_QUIZ_CLEANUP_BATCH_SIZE }, (_, index) => ({
      id: `orphan-${index}`,
    }));
    prismaMock.$queryRaw.mockResolvedValue(batch);

    await expect(cleanupOrphanQuizUploads()).resolves.toBe(
      ORPHAN_QUIZ_CLEANUP_BATCH_SIZE * ORPHAN_QUIZ_CLEANUP_MAX_BATCHES,
    );
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(ORPHAN_QUIZ_CLEANUP_MAX_BATCHES);
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(ORPHAN_QUIZ_CLEANUP_MAX_BATCHES);
  });
});
