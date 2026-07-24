/**
 * Automatisches Cleanup für verwaiste Sessions (Story 4.2),
 * Session-Purge nach Retention-Fenster (Epic 9) und
 * abgelaufene Bonus-Tokens (Story 4.6).
 */
import { prisma } from '../db';
import { logger } from './logger';
import { incrementCompletedSessionsTotal } from './platformStatistic';

const STALE_SESSION_HOURS = 24;
const FINISHED_SESSION_RETENTION_HOURS = 24;
const BONUS_TOKEN_RETENTION_DAYS = 90;
const SESSION_FEEDBACK_RETENTION_DAYS = 90;
export const ORPHAN_QUIZ_UPLOAD_GRACE_HOURS = 24;
export const ORPHAN_QUIZ_CLEANUP_BATCH_SIZE = 100;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1h

const ACTIVE_SESSION_STATUSES = [
  'LOBBY',
  'QUESTION_OPEN',
  'ACTIVE',
  'PAUSED',
  'RESULTS',
  'DISCUSSION',
] as const;

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

export async function cleanupStaleSessions(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_SESSION_HOURS * 60 * 60 * 1000);
  const now = new Date();

  const result = await prisma.session.updateMany({
    where: {
      status: { in: [...ACTIVE_SESSION_STATUSES] },
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
    await incrementCompletedSessionsTotal(result.count);
    logger.info(
      `Session-Cleanup: ${result.count} verwaiste Session(s) nach ${STALE_SESSION_HOURS}h beendet.`,
    );
  }

  return result.count;
}

export async function cleanupExpiredBonusTokens(): Promise<number> {
  const cutoff = new Date(Date.now() - BONUS_TOKEN_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const result = await prisma.bonusToken.deleteMany({
    where: { generatedAt: { lt: cutoff } },
  });

  if (result.count > 0) {
    logger.info(
      `BonusToken-Cleanup: ${result.count} Token(s) älter als ${BONUS_TOKEN_RETENTION_DAYS} Tage gelöscht.`,
    );
  }

  return result.count;
}

export async function cleanupExpiredSessionFeedback(): Promise<number> {
  const cutoff = new Date(Date.now() - SESSION_FEEDBACK_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const result = await prisma.sessionFeedback.deleteMany({
    where: {
      createdAt: { lt: cutoff },
      session: { status: 'FINISHED' },
    },
  });

  if (result.count > 0) {
    logger.info(
      `SessionFeedback-Cleanup: ${result.count} Bewertung(en) älter als ` +
        `${SESSION_FEEDBACK_RETENTION_DAYS} Tage gelöscht.`,
    );
  }

  return result.count;
}

/**
 * Löscht ausschließlich aktuell nicht an Sessions gebundene Uploadkopien.
 * Ein historyScope bleibt erhalten, sobald irgendeine Quizkopie dieses Scopes
 * Session-Historie besitzt. Jede Quizkopie mit eigener Sessionrelation bleibt
 * ebenfalls erhalten.
 * Die Bedingungen werden beim Delete erneut und in einer serialisierbaren
 * Transaktion geprüft, damit ein paralleles session.create/attachQuiz nicht
 * zwischen Auswahl und Löschung verloren geht.
 */
export async function cleanupOrphanQuizUploads(): Promise<number> {
  const cutoff = new Date(Date.now() - ORPHAN_QUIZ_UPLOAD_GRACE_HOURS * 60 * 60 * 1000);
  const result = await prisma.$transaction(
    async (tx) => {
      const candidates = await tx.quiz.findMany({
        where: {
          createdAt: { lt: cutoff },
          sessions: { none: {} },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: ORPHAN_QUIZ_CLEANUP_BATCH_SIZE,
        select: { id: true, historyScopeId: true },
      });

      if (candidates.length === 0) {
        return { count: 0 };
      }

      const candidateScopeIds = [
        ...new Set(
          candidates
            .map((candidate) => candidate.historyScopeId)
            .filter((scopeId): scopeId is string => scopeId !== null),
        ),
      ];
      const protectedScopes =
        candidateScopeIds.length === 0
          ? []
          : await tx.quiz.findMany({
              where: {
                historyScopeId: { in: candidateScopeIds },
                sessions: { some: {} },
              },
              select: { historyScopeId: true },
            });
      const protectedScopeIds = new Set(
        protectedScopes
          .map((quiz) => quiz.historyScopeId)
          .filter((scopeId): scopeId is string => scopeId !== null),
      );
      const deletableIds = candidates
        .filter(
          (candidate) =>
            candidate.historyScopeId === null || !protectedScopeIds.has(candidate.historyScopeId),
        )
        .map((candidate) => candidate.id);
      if (deletableIds.length === 0) {
        return { count: 0 };
      }

      return tx.quiz.deleteMany({
        where: {
          id: { in: deletableIds },
          createdAt: { lt: cutoff },
          sessions: { none: {} },
        },
      });
    },
    // Eine konkurrierende Session-Bindung erzeugt einen Serialisierungskonflikt
    // statt die neue Session über Quiz.onDelete=Cascade mitzulöschen.
    { isolationLevel: 'Serializable' },
  );

  if (result.count > 0) {
    logger.info(
      `Quiz-Upload-Cleanup: ${result.count} verwaiste Upload(s) nach ` +
        `${ORPHAN_QUIZ_UPLOAD_GRACE_HOURS}h Grace Period gelöscht.`,
    );
  }
  return result.count;
}

export async function cleanupExpiredFinishedSessions(): Promise<number> {
  const now = new Date();
  const finishedCutoff = new Date(Date.now() - FINISHED_SESSION_RETENTION_HOURS * 60 * 60 * 1000);
  const bonusRetentionCutoff = new Date(
    Date.now() - BONUS_TOKEN_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const feedbackRetentionCutoff = new Date(
    Date.now() - SESSION_FEEDBACK_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );

  const sessionsToPurge = await prisma.session.findMany({
    where: {
      status: 'FINISHED',
      endedAt: { not: null, lt: finishedCutoff },
      OR: [{ legalHoldUntil: null }, { legalHoldUntil: { lte: now } }],
      bonusTokens: {
        none: {
          generatedAt: { gte: bonusRetentionCutoff },
        },
      },
      sessionFeedbacks: {
        none: {
          createdAt: { gte: feedbackRetentionCutoff },
        },
      },
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
  const quizIds = [
    ...new Set(
      sessionsToPurge
        .map((entry) => entry.quizId)
        .filter((id): id is string => typeof id === 'string'),
    ),
  ];

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
      `Session-Purge: ${deletedSessions.count} beendete Session(s) älter als ` +
        `${FINISHED_SESSION_RETENTION_HOURS}h gelöscht (ohne aktiven Legal Hold).`,
    );
  }

  return deletedSessions.count;
}

async function runAllCleanups(): Promise<void> {
  await cleanupStaleSessions().catch((err) => {
    logger.warn('Session-Cleanup fehlgeschlagen:', (err as Error).message);
  });
  await cleanupExpiredBonusTokens().catch((err) => {
    logger.warn('BonusToken-Cleanup fehlgeschlagen:', (err as Error).message);
  });
  await cleanupExpiredSessionFeedback().catch((err) => {
    logger.warn('SessionFeedback-Cleanup fehlgeschlagen:', (err as Error).message);
  });
  await cleanupOrphanQuizUploads().catch((err) => {
    logger.warn('Quiz-Upload-Cleanup fehlgeschlagen:', (err as Error).message);
  });
  await cleanupExpiredFinishedSessions().catch((err) => {
    logger.warn('Session-Purge fehlgeschlagen:', (err as Error).message);
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
