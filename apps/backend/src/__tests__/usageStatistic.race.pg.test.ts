/**
 * PostgreSQL-Regression für atomare Usage-Schreibpfade (Issue #483 Review).
 *
 * Opt-in: RUN_PG_USAGE_STATISTIC_TESTS=1
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../db';
import { recordUsageQuizAnswer, recordUsageSessionParticipation } from '../lib/usageStatistic';

const RUN_PG = process.env['RUN_PG_USAGE_STATISTIC_TESTS'] === '1';

describe.skipIf(!RUN_PG)('usageStatistic races (PostgreSQL)', () => {
  const sessionIds: string[] = [];
  let dbReady = false;

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
    dbReady = true;
  });

  afterAll(async () => {
    if (!dbReady || sessionIds.length === 0) return;
    await prisma.sessionUsageProjection.deleteMany({
      where: { sessionId: { in: sessionIds } },
    });
  });

  it('zählt parallele Erstteilnahmen derselben Session nur einmal in sessionsUsed', async () => {
    const sessionId = `usage-race-${randomUUID()}`;
    sessionIds.push(sessionId);
    const day = new Date('2026-06-15T00:00:00.000Z');
    const before = await prisma.dailyUsageStatistic.findUnique({
      where: { date: day },
      select: { sessionsUsed: true, sessionParticipations: true, sizeClassXs: true },
    });

    const now = new Date('2026-06-15T12:00:00.000Z');
    await Promise.all([
      recordUsageSessionParticipation(sessionId, now),
      recordUsageSessionParticipation(sessionId, now),
      recordUsageSessionParticipation(sessionId, now),
    ]);

    const projection = await prisma.sessionUsageProjection.findUniqueOrThrow({
      where: { sessionId },
    });
    expect(projection.participationCount).toBe(3);
    expect(projection.functionClass).toBe('JOIN_ONLY');

    const after = await prisma.dailyUsageStatistic.findUniqueOrThrow({
      where: { date: day },
      select: { sessionsUsed: true, sessionParticipations: true, sizeClassXs: true },
    });
    expect(after.sessionsUsed - (before?.sessionsUsed ?? 0)).toBe(1);
    expect(after.sessionParticipations - (before?.sessionParticipations ?? 0)).toBe(3);
    expect(after.sizeClassXs - (before?.sizeClassXs ?? 0)).toBe(1);
  });

  it('hält Projektion und Tagesaggregate bei Quiz-Upgrade atomar konsistent', async () => {
    const sessionId = `usage-atomic-${randomUUID()}`;
    sessionIds.push(sessionId);
    const joinAt = new Date('2026-06-16T10:00:00.000Z');
    const quizAt = new Date('2026-06-16T11:00:00.000Z');
    const day = new Date('2026-06-16T00:00:00.000Z');

    await recordUsageSessionParticipation(sessionId, joinAt);
    const mid = await prisma.dailyUsageStatistic.findUniqueOrThrow({
      where: { date: day },
      select: {
        sessionsUsed: true,
        quizAnswers: true,
        sessionsJoinOnly: true,
        sessionsQuizOnly: true,
      },
    });

    await recordUsageQuizAnswer(sessionId, quizAt);

    const projection = await prisma.sessionUsageProjection.findUniqueOrThrow({
      where: { sessionId },
    });
    expect(projection.functionClass).toBe('QUIZ_ONLY');
    expect(projection.hasQuizInteraction).toBe(true);

    const after = await prisma.dailyUsageStatistic.findUniqueOrThrow({
      where: { date: day },
      select: {
        sessionsUsed: true,
        quizAnswers: true,
        sessionsJoinOnly: true,
        sessionsQuizOnly: true,
      },
    });
    expect(after.sessionsUsed).toBe(mid.sessionsUsed);
    expect(after.quizAnswers - mid.quizAnswers).toBe(1);
    expect(after.sessionsJoinOnly).toBe(mid.sessionsJoinOnly - 1);
    expect(after.sessionsQuizOnly).toBe(mid.sessionsQuizOnly + 1);
  });
});
