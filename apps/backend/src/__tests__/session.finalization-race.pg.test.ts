/**
 * PostgreSQL-Regression für konkurrierende Host-Steuerung und Sessionabschluss.
 *
 * Ein externer Row-Lock reiht `session.end` kontrolliert vor `nextQuestion`
 * beziehungsweise `prevQuestion` ein. Nach dem End-Commit muss der zweite
 * Übergang den gesperrt neu gelesenen FINISHED-Zustand ablehnen.
 */
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { hostAuthMocks } = vi.hoisted(() => ({
  hostAuthMocks: {
    extractHostTokenMock: vi.fn(),
    extractHostTokenFromConnectionParamsMock: vi.fn(() => null as string | null),
    isHostSessionTokenValidMock: vi.fn(),
  },
}));

vi.mock('../lib/hostAuth', async () => {
  const { buildHostAuthTestMock } = await import('./lib/hostAuth-vitest-mock');
  return buildHostAuthTestMock({
    extractHostToken: hostAuthMocks.extractHostTokenMock,
    extractHostTokenFromConnectionParams: hostAuthMocks.extractHostTokenFromConnectionParamsMock,
    isHostSessionTokenValid: hostAuthMocks.isHostSessionTokenValidMock,
  });
});

import { prisma } from '../db';
import { PLATFORM_STATISTIC_ID } from '../lib/platformStatistic';
import { sessionRouter } from '../routers/session';

const RUN_PG = process.env['RUN_PG_SESSION_RACE_TESTS'] === '1';
const DATABASE_URL =
  process.env['DATABASE_URL'] ??
  'postgresql://arsnova_user:secretpassword@localhost:5432/arsnova_v3_dev?schema=public';
const caller = sessionRouter.createCaller({ req: {} as never });

function uniqueSessionCode(): string {
  return `R${randomUUID().replaceAll('-', '').slice(0, 5).toUpperCase()}`;
}

async function waitForBlockedSessionLocks(
  monitor: Client,
  expectedCount: number,
  timeoutMs = 5_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await monitor.query<{ count: string }>(`
      SELECT COUNT(*)::text AS count
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND wait_event_type = 'Lock'
        AND query LIKE '%FROM "Session"%FOR UPDATE%'
    `);
    if (Number(result.rows[0]?.count ?? 0) >= expectedCount) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`${expectedCount} wartende Session-Row-Locks wurden nicht beobachtet.`);
}

async function completedSessionsTotal(): Promise<number> {
  const statistic = await prisma.platformStatistic.upsert({
    where: { id: PLATFORM_STATISTIC_ID },
    create: { id: PLATFORM_STATISTIC_ID },
    update: {},
    select: { completedSessionsTotal: true },
  });
  return statistic.completedSessionsTotal;
}

describe.skipIf(!RUN_PG)('session finalization races (PostgreSQL)', () => {
  const createdQuizIds: string[] = [];
  const createdSessionIds: string[] = [];
  let dbReady = false;

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
    dbReady = true;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    hostAuthMocks.extractHostTokenMock.mockReturnValue('host-token');
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
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

  it('lässt nextQuestion eine zuerst beendete Session nicht wieder öffnen', async () => {
    const quiz = await prisma.quiz.create({
      data: {
        name: `next-end-race-${randomUUID()}`,
        readingPhaseEnabled: false,
        questions: {
          create: [
            { text: 'Frage 1', type: 'SINGLE_CHOICE', order: 0 },
            { text: 'Frage 2', type: 'SINGLE_CHOICE', order: 1 },
          ],
        },
      },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
    createdQuizIds.push(quiz.id);
    const session = await prisma.session.create({
      data: {
        code: uniqueSessionCode(),
        quizId: quiz.id,
        status: 'RESULTS',
        currentQuestion: 0,
        quizStarted: true,
        questionProgressComplete: true,
        questionProgress: {
          [quiz.questions[0]!.id]: {
            state: 'OPENED',
            openedAt: new Date().toISOString(),
          },
        },
      },
    });
    createdSessionIds.push(session.id);
    const metricBefore = await completedSessionsTotal();

    const blocker = new Client({ connectionString: DATABASE_URL });
    const monitor = new Client({ connectionString: DATABASE_URL });
    await Promise.all([blocker.connect(), monitor.connect()]);
    let blockerTransactionOpen = false;
    try {
      await blocker.query('BEGIN');
      blockerTransactionOpen = true;
      await blocker.query('SELECT 1 FROM "Session" WHERE id = $1 FOR UPDATE', [session.id]);

      const ending = caller.end({ code: session.code });
      await waitForBlockedSessionLocks(monitor, 1);
      const navigating = caller.nextQuestion({ code: session.code });
      await waitForBlockedSessionLocks(monitor, 2);
      await blocker.query('COMMIT');
      blockerTransactionOpen = false;

      const [endResult, nextResult] = await Promise.allSettled([ending, navigating]);
      expect(endResult).toMatchObject({
        status: 'fulfilled',
        value: { status: 'FINISHED' },
      });
      expect(nextResult).toMatchObject({
        status: 'rejected',
        reason: { code: 'BAD_REQUEST' },
      });
    } finally {
      if (blockerTransactionOpen) {
        await blocker.query('ROLLBACK').catch(() => undefined);
      }
      await Promise.all([blocker.end(), monitor.end()]);
    }

    await expect(
      prisma.session.findUnique({
        where: { id: session.id },
        select: { status: true, currentQuestion: true, endedAt: true },
      }),
    ).resolves.toMatchObject({
      status: 'FINISHED',
      currentQuestion: null,
      endedAt: expect.any(Date),
    });
    await expect(completedSessionsTotal()).resolves.toBe(metricBefore + 1);
    await expect(prisma.bonusToken.count({ where: { sessionId: session.id } })).resolves.toBe(0);
  });

  it('lässt prevQuestion eine zuerst beendete Session nicht öffnen und erzeugt Bonus nur einmal', async () => {
    const quiz = await prisma.quiz.create({
      data: {
        name: `prev-end-race-${randomUUID()}`,
        bonusTokenCount: 1,
        questions: {
          create: [
            { text: 'Frage 1', type: 'SINGLE_CHOICE', order: 0 },
            { text: 'Frage 2', type: 'SINGLE_CHOICE', order: 1 },
          ],
        },
      },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
    createdQuizIds.push(quiz.id);
    const now = new Date().toISOString();
    const session = await prisma.session.create({
      data: {
        code: uniqueSessionCode(),
        quizId: quiz.id,
        status: 'RESULTS',
        currentQuestion: 1,
        quizStarted: true,
        questionProgressComplete: true,
        questionProgress: {
          [quiz.questions[0]!.id]: { state: 'COMPLETED', openedAt: now, completedAt: now },
          [quiz.questions[1]!.id]: { state: 'OPENED', openedAt: now },
        },
        participants: { create: { nickname: `Ada-${randomUUID().slice(0, 8)}` } },
      },
      include: { participants: true },
    });
    createdSessionIds.push(session.id);
    await prisma.vote.create({
      data: {
        sessionId: session.id,
        participantId: session.participants[0]!.id,
        questionId: quiz.questions[1]!.id,
        round: 1,
        score: 2_000,
        responseTimeMs: 900,
        isCorrect: true,
      },
    });
    const metricBefore = await completedSessionsTotal();

    const blocker = new Client({ connectionString: DATABASE_URL });
    const monitor = new Client({ connectionString: DATABASE_URL });
    await Promise.all([blocker.connect(), monitor.connect()]);
    let blockerTransactionOpen = false;
    try {
      await blocker.query('BEGIN');
      blockerTransactionOpen = true;
      await blocker.query('SELECT 1 FROM "Session" WHERE id = $1 FOR UPDATE', [session.id]);

      const ending = caller.end({ code: session.code });
      await waitForBlockedSessionLocks(monitor, 1);
      const navigating = caller.prevQuestion({ code: session.code });
      await waitForBlockedSessionLocks(monitor, 2);
      await blocker.query('COMMIT');
      blockerTransactionOpen = false;

      const [endResult, prevResult] = await Promise.allSettled([ending, navigating]);
      expect(endResult).toMatchObject({
        status: 'fulfilled',
        value: { status: 'FINISHED' },
      });
      expect(prevResult).toMatchObject({
        status: 'rejected',
        reason: { code: 'BAD_REQUEST' },
      });
    } finally {
      if (blockerTransactionOpen) {
        await blocker.query('ROLLBACK').catch(() => undefined);
      }
      await Promise.all([blocker.end(), monitor.end()]);
    }

    await expect(
      prisma.session.findUnique({
        where: { id: session.id },
        select: { status: true, currentQuestion: true, endedAt: true },
      }),
    ).resolves.toMatchObject({
      status: 'FINISHED',
      currentQuestion: null,
      endedAt: expect.any(Date),
    });
    await expect(completedSessionsTotal()).resolves.toBe(metricBefore + 1);
    await expect(prisma.bonusToken.count({ where: { sessionId: session.id } })).resolves.toBe(1);
  });
});
