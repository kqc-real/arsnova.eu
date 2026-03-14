/**
 * Automatisches Cleanup für verwaiste Sessions (Story 4.2),
 * Session-Purge nach Retention-Fenster (Epic 9) und
 * abgelaufene Bonus-Tokens (Story 4.6).
 */
import { prisma } from '../db';
import { logger } from './logger';

const STALE_SESSION_HOURS = 24;
const FINISHED_SESSION_RETENTION_HOURS = 24;
const BONUS_TOKEN_RETENTION_DAYS = 90;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1h

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

export async function cleanupStaleSessions(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_SESSION_HOURS * 60 * 60 * 1000);
  const now = new Date();

  const result = await prisma.session.updateMany({
    where: {
      status: { not: 'FINISHED' },
      startedAt: { lt: cutoff },
    },
    data: {
      status: 'FINISHED',
      endedAt: now,
      statusChangedAt: now,
      currentQuestion: null,
      currentRound: 1,
    },
  });

  if (result.count > 0) {
    logger.info(`Session-Cleanup: ${result.count} verwaiste Session(s) nach ${STALE_SESSION_HOURS}h beendet.`);
  }

  return result.count;
}

export async function cleanupExpiredBonusTokens(): Promise<number> {
  const cutoff = new Date(Date.now() - BONUS_TOKEN_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const result = await prisma.bonusToken.deleteMany({
    where: { generatedAt: { lt: cutoff } },
  });

  if (result.count > 0) {
    logger.info(`BonusToken-Cleanup: ${result.count} Token(s) älter als ${BONUS_TOKEN_RETENTION_DAYS} Tage gelöscht.`);
  }

  return result.count;
}

export async function cleanupExpiredFinishedSessions(): Promise<number> {
  const now = new Date();
  const cutoff = new Date(Date.now() - FINISHED_SESSION_RETENTION_HOURS * 60 * 60 * 1000);

  const sessionsToPurge = await prisma.session.findMany({
    where: {
      status: 'FINISHED',
      endedAt: { not: null, lt: cutoff },
      OR: [
        { legalHoldUntil: null },
        { legalHoldUntil: { lte: now } },
      ],
    },
    select: {
      id: true,
      quizId: true,
    },
  });

  if (sessionsToPurge.length === 0) {
    return 0;
  }

  const sessionIds = sessionsToPurge.map((entry) => entry.id);
  const quizIds = [...new Set(
    sessionsToPurge
      .map((entry) => entry.quizId)
      .filter((id): id is string => typeof id === 'string'),
  )];

  const deletedSessions = await prisma.session.deleteMany({
    where: { id: { in: sessionIds } },
  });

  if (quizIds.length > 0) {
    const orphanQuizIds = await prisma.quiz.findMany({
      where: {
        id: { in: quizIds },
        sessions: { none: {} },
      },
      select: { id: true },
    });

    if (orphanQuizIds.length > 0) {
      await prisma.quiz.deleteMany({
        where: { id: { in: orphanQuizIds.map((entry) => entry.id) } },
      });
    }
  }

  if (deletedSessions.count > 0) {
    logger.info(
      `Session-Purge: ${deletedSessions.count} beendete Session(s) älter als `
      + `${FINISHED_SESSION_RETENTION_HOURS}h gelöscht (ohne aktiven Legal Hold).`,
    );
  }

  return deletedSessions.count;
}

async function runAllCleanups(): Promise<void> {
  await cleanupStaleSessions().catch((err) => {
    logger.warn('Session-Cleanup fehlgeschlagen:', (err as Error).message);
  });
  await cleanupExpiredFinishedSessions().catch((err) => {
    logger.warn('Session-Purge fehlgeschlagen:', (err as Error).message);
  });
  await cleanupExpiredBonusTokens().catch((err) => {
    logger.warn('BonusToken-Cleanup fehlgeschlagen:', (err as Error).message);
  });
}

export function startSessionCleanupScheduler(): void {
  if (cleanupTimer) return;
  runAllCleanups();
  cleanupTimer = setInterval(runAllCleanups, CLEANUP_INTERVAL_MS);
  logger.info(`Cleanup-Scheduler gestartet (alle ${CLEANUP_INTERVAL_MS / 60000} Min).`);
}

export function stopSessionCleanupScheduler(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
