/**
 * PostgreSQL-Regression für W1.3: History-Scope-Anker dürfen sessionlose
 * Geschwister nicht unbegrenzt schützen.
 *
 * Läuft nur mit erreichbarer DATABASE_URL (CI Migration-Job / lokales Docker).
 */
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../db';
import {
  cleanupOrphanQuizUploads,
  ORPHAN_QUIZ_MAX_SESSIONLESS_PER_HISTORY_SCOPE,
  ORPHAN_QUIZ_UPLOAD_GRACE_HOURS,
} from '../lib/sessionCleanup';
import {
  lockSessionDeletionQuizParents,
  lockSessionDeletionTargets,
  runSessionBoundWrite,
  runSerializableSessionDeletion,
} from '../lib/sessionDeletion';
import { enqueueProductFeedbackInviteJob } from '../lib/productFeedbackInvite';

/** Opt-in: CI Migration-Job und lokale Abnahme setzen `RUN_PG_CLEANUP_TESTS=1`. */
const RUN_PG = process.env['RUN_PG_CLEANUP_TESTS'] === '1';
const DATABASE_URL =
  process.env['DATABASE_URL'] ??
  'postgresql://arsnova_user:secretpassword@localhost:5432/arsnova_v3_dev?schema=public';

async function canReachDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function waitForBlockedDeletionTargetLock(monitor: Client, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await monitor.query<{ count: string }>(`
      SELECT COUNT(*)::text AS count
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND wait_event_type = 'Lock'
        AND query LIKE '%arsnova-session-deletion-target-lock%'
    `);
    if (Number(result.rows[0]?.count ?? 0) > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Der konkurrierende Session-Target-Lock wurde nicht als wartend beobachtet.');
}

describe.skipIf(!RUN_PG)('cleanupOrphanQuizUploads history-scope bounds (PostgreSQL)', () => {
  const createdQuizIds: string[] = [];
  const createdSessionIds: string[] = [];
  const createdAuditIds: string[] = [];
  let dbReady = false;
  let monitor: Client | null = null;

  beforeAll(async () => {
    dbReady = await canReachDatabase();
    if (dbReady) {
      monitor = new Client({ connectionString: DATABASE_URL });
      await monitor.connect();
    }
  });

  afterAll(async () => {
    if (!dbReady) return;
    if (createdAuditIds.length > 0) {
      await prisma.adminAuditLog.deleteMany({ where: { id: { in: createdAuditIds } } });
    }
    if (createdSessionIds.length > 0) {
      await prisma.productFeedbackInviteJob.deleteMany({
        where: { sessionId: { in: createdSessionIds } },
      });
    }
    if (createdSessionIds.length > 0) {
      await prisma.session.deleteMany({ where: { id: { in: createdSessionIds } } });
    }
    if (createdQuizIds.length > 0) {
      await prisma.quiz.deleteMany({ where: { id: { in: createdQuizIds } } });
    }
    await monitor?.end();
  });

  it('löscht alte sessionlose Geschwister oberhalb des Scope-Limits trotz aktivem Anker', async ({
    skip,
  }) => {
    if (!dbReady) {
      skip('PostgreSQL nicht erreichbar');
    }

    const historyScopeId = randomUUID();
    const graceCutoff = new Date(
      Date.now() - (ORPHAN_QUIZ_UPLOAD_GRACE_HOURS + 1) * 60 * 60 * 1000,
    );
    const keepCount = ORPHAN_QUIZ_MAX_SESSIONLESS_PER_HISTORY_SCOPE;
    const excessCount = 3;
    const totalSessionless = keepCount + excessCount;

    const anchor = await prisma.quiz.create({
      data: {
        historyScopeId,
        name: `w1.3-anchor-${historyScopeId.slice(0, 8)}`,
        createdAt: graceCutoff,
        updatedAt: graceCutoff,
      },
    });
    createdQuizIds.push(anchor.id);

    const session = await prisma.session.create({
      data: {
        code: `T${historyScopeId.replace(/-/g, '').slice(0, 5).toUpperCase()}`,
        type: 'QUIZ',
        status: 'LOBBY',
        quizId: anchor.id,
      },
    });
    createdSessionIds.push(session.id);

    const sessionlessIds: string[] = [];
    for (let index = 0; index < totalSessionless; index += 1) {
      const createdAt = new Date(graceCutoff.getTime() + index * 60_000);
      const quiz = await prisma.quiz.create({
        data: {
          historyScopeId,
          name: `w1.3-sibling-${index}-${historyScopeId.slice(0, 8)}`,
          createdAt,
          updatedAt: createdAt,
        },
      });
      createdQuizIds.push(quiz.id);
      sessionlessIds.push(quiz.id);
    }

    const deleted = await cleanupOrphanQuizUploads();
    expect(deleted).toBeGreaterThanOrEqual(excessCount);

    const remaining = await prisma.quiz.findMany({
      where: { id: { in: [anchor.id, ...sessionlessIds] } },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    const remainingIds = new Set(remaining.map((entry) => entry.id));

    expect(remainingIds.has(anchor.id)).toBe(true);
    const remainingSessionless = sessionlessIds.filter((id) => remainingIds.has(id));
    expect(remainingSessionless).toHaveLength(keepCount);
    expect(remainingSessionless).toEqual(sessionlessIds.slice(-keepCount));
  });

  it('kaskadiert keine parallel noch uncommittete Session beim Parent-Quiz-Delete', async ({
    skip,
  }) => {
    if (!dbReady) {
      skip('PostgreSQL nicht erreichbar');
    }

    const suffix = randomUUID().replace(/-/g, '').toUpperCase();
    const quiz = await prisma.quiz.create({
      data: { name: `session-delete-race-${suffix.slice(0, 8)}` },
    });
    createdQuizIds.push(quiz.id);
    const oldSession = await prisma.session.create({
      data: {
        code: `A${suffix.slice(0, 5)}`,
        type: 'QUIZ',
        status: 'FINISHED',
        quizId: quiz.id,
      },
    });
    createdSessionIds.push(oldSession.id);

    let releaseAttach!: () => void;
    let markAttached!: () => void;
    const attachMayCommit = new Promise<void>((resolve) => {
      releaseAttach = resolve;
    });
    const attachInserted = new Promise<void>((resolve) => {
      markAttached = resolve;
    });
    let newSessionId = '';
    const concurrentAttach = prisma.$transaction(async (tx) => {
      const created = await tx.session.create({
        data: {
          code: `B${suffix.slice(5, 10)}`,
          type: 'QUIZ',
          status: 'LOBBY',
          quizId: quiz.id,
        },
      });
      newSessionId = created.id;
      createdSessionIds.push(created.id);
      markAttached();
      await attachMayCommit;
    });
    await attachInserted;

    let markDeletionStarted!: () => void;
    const deletionStarted = new Promise<void>((resolve) => {
      markDeletionStarted = resolve;
    });
    const deletion = runSerializableSessionDeletion(async (tx) => {
      markDeletionStarted();
      const targets = await lockSessionDeletionTargets(tx, [oldSession.id]);
      const quizIds = await lockSessionDeletionQuizParents(
        tx,
        targets.map((target) => target.quizId),
      );
      await tx.session.delete({ where: { id: oldSession.id } });
      return tx.quiz.deleteMany({
        where: { id: { in: [...quizIds] }, sessions: { none: {} } },
      });
    });
    await deletionStarted;
    releaseAttach();
    await concurrentAttach;

    await expect(deletion).resolves.toEqual({ count: 0 });
    await expect(
      prisma.session.findUnique({ where: { id: newSessionId } }),
    ).resolves.not.toBeNull();
    await expect(prisma.quiz.findUnique({ where: { id: quiz.id } })).resolves.not.toBeNull();
    await expect(prisma.session.findUnique({ where: { id: oldSession.id } })).resolves.toBeNull();
  });

  it('liest nach einem SERIALIZABLE-Retry den aktuell angehängten Parent erneut', async ({
    skip,
  }) => {
    if (!dbReady) {
      skip('PostgreSQL nicht erreichbar');
    }

    const suffix = randomUUID().replace(/-/g, '').toUpperCase();
    const [oldQuiz, currentQuiz] = await Promise.all([
      prisma.quiz.create({ data: { name: `session-delete-old-${suffix.slice(0, 8)}` } }),
      prisma.quiz.create({ data: { name: `session-delete-current-${suffix.slice(0, 8)}` } }),
    ]);
    createdQuizIds.push(oldQuiz.id, currentQuiz.id);
    const session = await prisma.session.create({
      data: {
        code: `C${suffix.slice(0, 5)}`,
        type: 'QUIZ',
        status: 'LOBBY',
        quizId: oldQuiz.id,
      },
    });
    createdSessionIds.push(session.id);

    let releaseAttach!: () => void;
    let markAttached!: () => void;
    const attachMayCommit = new Promise<void>((resolve) => {
      releaseAttach = resolve;
    });
    const attachUpdated = new Promise<void>((resolve) => {
      markAttached = resolve;
    });
    const concurrentAttach = prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "Session" WHERE "id" = ${session.id} FOR UPDATE`;
      await tx.session.update({
        where: { id: session.id },
        data: { quizId: currentQuiz.id },
      });
      markAttached();
      await attachMayCommit;
    });
    await attachUpdated;

    let markDeletionStarted!: () => void;
    const deletionStarted = new Promise<void>((resolve) => {
      markDeletionStarted = resolve;
    });
    const deletion = runSerializableSessionDeletion(async (tx) => {
      markDeletionStarted();
      const targets = await lockSessionDeletionTargets(tx, [session.id]);
      const quizIds = await lockSessionDeletionQuizParents(
        tx,
        targets.map((target) => target.quizId),
      );
      await tx.session.delete({ where: { id: session.id } });
      return tx.quiz.deleteMany({
        where: { id: { in: [...quizIds] }, sessions: { none: {} } },
      });
    });
    await deletionStarted;
    releaseAttach();
    await concurrentAttach;

    await expect(deletion).resolves.toEqual({ count: 1 });
    await expect(prisma.session.findUnique({ where: { id: session.id } })).resolves.toBeNull();
    await expect(prisma.quiz.findUnique({ where: { id: currentQuiz.id } })).resolves.toBeNull();
    await expect(prisma.quiz.findUnique({ where: { id: oldQuiz.id } })).resolves.not.toBeNull();
  });

  it('erzeugt nach einem gewonnenen Purge weder Audit-Rohbezug noch Invite-Job neu', async ({
    skip,
  }) => {
    if (!dbReady) {
      skip('PostgreSQL nicht erreichbar');
    }

    const suffix = randomUUID().replace(/-/g, '').toUpperCase();
    const session = await prisma.session.create({
      data: {
        code: `D${suffix.slice(0, 5)}`,
        type: 'Q_AND_A',
        status: 'LOBBY',
      },
    });
    createdSessionIds.push(session.id);
    await prisma.session.update({
      where: { id: session.id },
      data: { status: 'FINISHED', endedAt: new Date() },
    });

    let releasePurge!: () => void;
    let markPurgeDeleted!: () => void;
    const purgeMayCommit = new Promise<void>((resolve) => {
      releasePurge = resolve;
    });
    const purgeDeleted = new Promise<void>((resolve) => {
      markPurgeDeleted = resolve;
    });
    const purge = runSerializableSessionDeletion(async (tx) => {
      await lockSessionDeletionTargets(tx, [session.id]);
      await tx.session.delete({ where: { id: session.id } });
      markPurgeDeleted();
      await purgeMayCommit;
    });
    await purgeDeleted;

    const auditWrite = runSessionBoundWrite(session.id, async (tx, target) => {
      await tx.adminAuditLog.create({
        data: {
          action: 'EXPORT_FOR_AUTHORITIES',
          sessionId: target.id,
          sessionCode: target.code,
          reason: 'late-writer-regression',
        },
      });
      return true;
    });
    const inviteEnqueued = enqueueProductFeedbackInviteJob(session.id);
    await waitForBlockedDeletionTargetLock(monitor!);
    releasePurge();
    await purge;

    await expect(auditWrite).resolves.toBeNull();
    await expect(inviteEnqueued).resolves.toBe(false);
    await expect(
      prisma.adminAuditLog.count({
        where: { OR: [{ sessionId: session.id }, { sessionCode: session.code }] },
      }),
    ).resolves.toBe(0);
    await expect(
      prisma.productFeedbackInviteJob.count({ where: { sessionId: session.id } }),
    ).resolves.toBe(0);
  });

  it('wiederholt einen wartenden Purge und bereinigt zuvor committe FK-lose Writer', async ({
    skip,
  }) => {
    if (!dbReady) {
      skip('PostgreSQL nicht erreichbar');
    }

    const suffix = randomUUID().replace(/-/g, '').toUpperCase();
    const session = await prisma.session.create({
      data: {
        code: `E${suffix.slice(0, 5)}`,
        type: 'Q_AND_A',
        status: 'LOBBY',
      },
    });
    createdSessionIds.push(session.id);
    await prisma.session.update({
      where: { id: session.id },
      data: { status: 'FINISHED', endedAt: new Date() },
    });

    let releaseWriter!: () => void;
    let markWriterReady!: () => void;
    const writerMayCommit = new Promise<void>((resolve) => {
      releaseWriter = resolve;
    });
    const writerReady = new Promise<void>((resolve) => {
      markWriterReady = resolve;
    });
    const writer = runSessionBoundWrite(session.id, async (tx, target) => {
      const audit = await tx.adminAuditLog.create({
        data: {
          action: 'EXPORT_FOR_AUTHORITIES',
          sessionId: target.id,
          sessionCode: target.code,
          reason: 'writer-first-race-regression',
        },
      });
      createdAuditIds.push(audit.id);
      await tx.productFeedbackInviteJob.upsert({
        where: { sessionId: target.id },
        create: { sessionId: target.id },
        update: {},
      });
      markWriterReady();
      await writerMayCommit;
      return true;
    });
    await writerReady;

    let attempts = 0;
    const purge = runSerializableSessionDeletion(async (tx) => {
      attempts += 1;
      const [target] = await lockSessionDeletionTargets(tx, [session.id]);
      if (!target) return false;
      await tx.adminAuditLog.updateMany({
        where: { OR: [{ sessionId: target.id }, { sessionCode: target.code }] },
        data: {
          sessionId: null,
          sessionCode: null,
          sessionReferenceHash: '0'.repeat(64),
        },
      });
      await tx.productFeedbackInviteJob.deleteMany({
        where: { sessionId: target.id },
      });
      await tx.session.delete({ where: { id: target.id } });
      return true;
    });
    await waitForBlockedDeletionTargetLock(monitor!);
    releaseWriter();
    await expect(writer).resolves.toBe(true);
    await expect(purge).resolves.toBe(true);

    expect(attempts).toBeGreaterThanOrEqual(2);
    await expect(prisma.session.findUnique({ where: { id: session.id } })).resolves.toBeNull();
    await expect(
      prisma.productFeedbackInviteJob.count({ where: { sessionId: session.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.adminAuditLog.findUnique({ where: { id: createdAuditIds.at(-1)! } }),
    ).resolves.toMatchObject({
      sessionId: null,
      sessionCode: null,
      sessionReferenceHash: '0'.repeat(64),
    });
  });
});
