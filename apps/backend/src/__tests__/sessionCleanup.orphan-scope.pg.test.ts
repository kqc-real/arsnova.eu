/**
 * PostgreSQL-Regression für W1.3: History-Scope-Anker dürfen sessionlose
 * Geschwister nicht unbegrenzt schützen.
 *
 * Läuft nur mit erreichbarer DATABASE_URL (CI Migration-Job / lokales Docker).
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../db';
import {
  cleanupOrphanQuizUploads,
  ORPHAN_QUIZ_MAX_SESSIONLESS_PER_HISTORY_SCOPE,
  ORPHAN_QUIZ_UPLOAD_GRACE_HOURS,
} from '../lib/sessionCleanup';

/** Opt-in: CI Migration-Job und lokale Abnahme setzen `RUN_PG_CLEANUP_TESTS=1`. */
const RUN_PG = process.env['RUN_PG_CLEANUP_TESTS'] === '1';

async function canReachDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

describe.skipIf(!RUN_PG)('cleanupOrphanQuizUploads history-scope bounds (PostgreSQL)', () => {
  const createdQuizIds: string[] = [];
  const createdSessionIds: string[] = [];
  let dbReady = false;

  beforeAll(async () => {
    dbReady = await canReachDatabase();
  });

  afterAll(async () => {
    if (!dbReady) return;
    if (createdSessionIds.length > 0) {
      await prisma.session.deleteMany({ where: { id: { in: createdSessionIds } } });
    }
    if (createdQuizIds.length > 0) {
      await prisma.quiz.deleteMany({ where: { id: { in: createdQuizIds } } });
    }
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
});
