import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, platformStatisticMocks, loggerMocks, credentialMocks, purgeInvalidationMocks } =
  vi.hoisted(() => ({
    prismaMock: {
      $transaction: vi.fn(),
      $queryRaw: vi.fn(),
      session: {
        updateMany: vi.fn(),
        updateManyAndReturn: vi.fn(),
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
      adminAuditLog: {
        deleteMany: vi.fn(),
        updateMany: vi.fn(),
      },
      productFeedbackInviteJob: {
        createMany: vi.fn(),
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
    credentialMocks: {
      invalidateHostSessionToken: vi.fn(),
      invalidateHostPairingForSession: vi.fn(),
    },
    purgeInvalidationMocks: {
      publishSessionPurgeInvalidation: vi.fn(),
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

vi.mock('../lib/hostAuth', () => ({
  invalidateHostSessionToken: credentialMocks.invalidateHostSessionToken,
}));

vi.mock('../lib/hostPairing', () => ({
  invalidateHostPairingForSession: credentialMocks.invalidateHostPairingForSession,
}));

vi.mock('../lib/sessionPurgeInvalidation', () => ({
  publishSessionPurgeInvalidation: purgeInvalidationMocks.publishSessionPurgeInvalidation,
}));

vi.mock('../lib/productFeedbackInvite', () => ({
  issueProductFeedbackInvitesAfterFinish: vi.fn(),
}));

vi.mock('../lib/productFeedbackCleanup', () => ({
  cleanupProductFeedbackMessages: vi.fn(async () => 0),
  cleanupProductFeedbackRecords: vi.fn(async () => 0),
  cleanupProductFeedbackInviteJobs: vi.fn(async () => 0),
}));

import {
  cleanupExpiredAdminAuditLogs,
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
    credentialMocks.invalidateHostSessionToken.mockResolvedValue(undefined);
    credentialMocks.invalidateHostPairingForSession.mockResolvedValue(undefined);
    purgeInvalidationMocks.publishSessionPurgeInvalidation.mockResolvedValue(undefined);
    prismaMock.adminAuditLog.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.productFeedbackInviteJob.deleteMany.mockResolvedValue({ count: 0 });
  });

  it('inkrementiert den completedSessionsCounter fuer automatisch beendete verwaiste Sessions', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ id: 's1' }, { id: 's2' }, { id: 's3' }]);

    const result = await cleanupStaleSessions();

    expect(result).toBe(3);
    expect(platformStatisticMocks.incrementCompletedSessionsTotal).toHaveBeenCalledWith(3);
    const query = prismaMock.$queryRaw.mock.calls[0]?.[0] as { strings?: string[] };
    const sql = query.strings?.join('?') ?? '';
    expect(sql).toContain(`candidate."expiresAt" <= timezone('UTC', clock_timestamp())`);
    expect(sql).toContain('FOR UPDATE OF candidate SKIP LOCKED');
    expect(sql).toContain('"endedAt" = target."expiresAt"');
  });

  it('inkrementiert den completedSessionsCounter nicht, wenn keine Session beendet wurde', async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);

    const result = await cleanupStaleSessions();

    expect(result).toBe(0);
    expect(prismaMock.productFeedbackInviteJob.createMany).not.toHaveBeenCalled();
    expect(platformStatisticMocks.incrementCompletedSessionsTotal).not.toHaveBeenCalled();
  });

  it('loescht abgelaufenes Session-Feedback mit eigener Retention', async () => {
    prismaMock.sessionFeedback.deleteMany.mockResolvedValue({ count: 4 });

    const result = await cleanupExpiredSessionFeedback();

    expect(result).toBe(4);
    expect(prismaMock.sessionFeedback.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: expect.any(Date) } },
    });
    expect(loggerMocks.info).toHaveBeenCalledWith(
      expect.stringContaining('SessionFeedback-Cleanup: 4 Bewertung(en)'),
    );
  });

  it('löscht minimierte Admin-Audits nach ihrer eigenen Jahresfrist', async () => {
    prismaMock.adminAuditLog.deleteMany.mockResolvedValue({ count: 2 });

    await expect(cleanupExpiredAdminAuditLogs()).resolves.toBe(2);

    expect(prismaMock.adminAuditLog.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: expect.any(Date) } },
    });
  });

  it('purged beendete Sessions erst nach 336 Stunden und trennt Retention-Nebenbestände', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        { id: 'session-1', code: 'ABC123', quizId: 'quiz-1' },
        { id: 'session-2', code: 'DEF456', quizId: null },
      ])
      .mockResolvedValueOnce([
        { id: 'session-1', code: 'ABC123', quizId: 'quiz-1' },
        { id: 'session-2', code: 'DEF456', quizId: null },
      ])
      .mockResolvedValueOnce([
        { id: 'session-1', code: 'ABC123', quizId: 'quiz-1' },
        { id: 'session-2', code: 'DEF456', quizId: null },
      ]);
    prismaMock.quiz.deleteMany.mockResolvedValue({ count: 1 });

    const result = await cleanupExpiredFinishedSessions();

    expect(result).toBe(2);
    expect(credentialMocks.invalidateHostSessionToken).toHaveBeenCalledWith('ABC123');
    expect(credentialMocks.invalidateHostSessionToken).toHaveBeenCalledWith('DEF456');
    expect(credentialMocks.invalidateHostPairingForSession).toHaveBeenCalledWith('ABC123');
    expect(credentialMocks.invalidateHostPairingForSession).toHaveBeenCalledWith('DEF456');
    expect(purgeInvalidationMocks.publishSessionPurgeInvalidation).toHaveBeenCalledTimes(4);
    const selectionSql = (
      prismaMock.$queryRaw.mock.calls[0]?.[0] as { strings?: string[] }
    ).strings?.join('?');
    const lockSql = (
      prismaMock.$queryRaw.mock.calls[1]?.[0] as { strings?: string[] }
    ).strings?.join('?');
    const deleteSql = (
      prismaMock.$queryRaw.mock.calls[2]?.[0] as { strings?: string[] }
    ).strings?.join('?');
    expect(selectionSql).toContain("INTERVAL '1 hour'");
    expect(selectionSql).toContain("timezone('UTC', clock_timestamp())");
    expect(selectionSql).toContain('LIMIT');
    expect(lockSql).toContain("INTERVAL '1 hour'");
    expect(lockSql).toContain('FOR UPDATE OF candidate SKIP LOCKED');
    expect(deleteSql).toContain('DELETE FROM "Session" AS target');
    expect(prismaMock.productFeedbackInviteJob.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: { in: ['session-1', 'session-2'] } },
    });
    expect(prismaMock.adminAuditLog.updateMany).toHaveBeenCalledTimes(2);
    expect(prismaMock.adminAuditLog.updateMany).toHaveBeenCalledWith({
      where: {
        OR: [{ sessionId: 'session-1' }, { sessionCode: 'ABC123' }],
      },
      data: {
        sessionId: null,
        sessionCode: null,
        sessionReferenceHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    });
    expect(prismaMock.quiz.deleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['quiz-1'] },
        sessions: { none: {} },
      },
    });
    expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(loggerMocks.info).toHaveBeenCalledWith(
      expect.stringContaining('Session-Purge: 2 beendete Session(s)'),
    );
  });

  it('behält den Sessionkern bei einem fehlgeschlagenen Credential-Cleanup für den Retry', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ id: 'session-1', code: 'ABC123', quizId: null }]);
    credentialMocks.invalidateHostSessionToken.mockRejectedValueOnce(new Error('Redis down'));

    await expect(cleanupExpiredFinishedSessions()).resolves.toBe(0);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(loggerMocks.warn).toHaveBeenCalledWith(
      expect.stringContaining('Credential-/Runtime-Cleanup fehlgeschlagen'),
      'Redis down',
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
