/**
 * Automatisches Cleanup für verwaiste Sessions (Story 4.2),
 * Session-Purge nach Retention-Fenster (Epic 9) und
 * abgelaufene Bonus-Tokens (Story 4.6).
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { logger } from './logger';
import { incrementCompletedSessionsTotal } from './platformStatistic';
import {
  ORPHAN_QUIZ_CLEANUP_BATCH_SIZE,
  ORPHAN_QUIZ_CLEANUP_MAX_BATCHES,
  ORPHAN_QUIZ_MAX_SESSIONLESS_PER_HISTORY_SCOPE,
  ORPHAN_QUIZ_UPLOAD_GRACE_HOURS,
} from './publicCreateCapacity';

const STALE_SESSION_HOURS = 24;
const FINISHED_SESSION_RETENTION_HOURS = 24;
const BONUS_TOKEN_RETENTION_DAYS = 90;
const SESSION_FEEDBACK_RETENTION_DAYS = 90;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1h

export {
  ORPHAN_QUIZ_CLEANUP_BATCH_SIZE,
  ORPHAN_QUIZ_CLEANUP_MAX_BATCHES,
  ORPHAN_QUIZ_MAX_SESSIONLESS_PER_HISTORY_SCOPE,
  ORPHAN_QUIZ_UPLOAD_GRACE_HOURS,
} from './publicCreateCapacity';

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
 * Löscht sessionlose Uploadkopien nach der Grace Period.
 *
 * Geschützt bleiben nur Quizzes mit eigener Sessionrelation. Ein History-Scope-
 * Anker (irgendeine Geschwisterkopie mit Session) schützt höchstens
 * {@link ORPHAN_QUIZ_MAX_SESSIONLESS_PER_HISTORY_SCOPE} neueste sessionlose
 * Kopien desselben Scopes — ältere Geschwister werden bounded mitgelöscht.
 * Scopes ohne jede Session sowie Uploads ohne historyScopeId werden nach der
 * Grace Period vollständig bereinigt.
 *
 * Die Bedingungen werden beim Delete erneut und in einer serialisierbaren
 * Transaktion geprüft, damit ein paralleles session.create/attachQuiz nicht
 * zwischen Auswahl und Löschung verloren geht.
 */
export async function cleanupOrphanQuizUploads(): Promise<number> {
  const cutoff = new Date(Date.now() - ORPHAN_QUIZ_UPLOAD_GRACE_HOURS * 60 * 60 * 1000);
  let deletedCount = 0;

  for (let batch = 0; batch < ORPHAN_QUIZ_CLEANUP_MAX_BATCHES; batch += 1) {
    const result = await prisma.$transaction(
      async (tx) => {
        const deleted = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          WITH candidates AS (
            SELECT candidate."id"
            FROM "Quiz" AS candidate
            WHERE candidate."createdAt" < ${cutoff}
              AND NOT EXISTS (
                SELECT 1
                FROM "Session" AS own_session
                WHERE own_session."quizId" = candidate."id"
              )
              AND (
                candidate."historyScopeId" IS NULL
                OR NOT EXISTS (
                  SELECT 1
                  FROM "Quiz" AS scoped_quiz
                  INNER JOIN "Session" AS scoped_session
                    ON scoped_session."quizId" = scoped_quiz."id"
                  WHERE scoped_quiz."historyScopeId" = candidate."historyScopeId"
                )
                OR (
                  SELECT COUNT(*)::int
                  FROM (
                    SELECT 1
                    FROM "Quiz" AS newer_sessionless
                    WHERE newer_sessionless."historyScopeId" = candidate."historyScopeId"
                      AND NOT EXISTS (
                        SELECT 1
                        FROM "Session" AS newer_session
                        WHERE newer_session."quizId" = newer_sessionless."id"
                      )
                      AND (
                        newer_sessionless."createdAt" > candidate."createdAt"
                        OR (
                          newer_sessionless."createdAt" = candidate."createdAt"
                          AND newer_sessionless."id" > candidate."id"
                        )
                      )
                    LIMIT ${ORPHAN_QUIZ_MAX_SESSIONLESS_PER_HISTORY_SCOPE}
                  ) AS bounded_newer
                ) >= ${ORPHAN_QUIZ_MAX_SESSIONLESS_PER_HISTORY_SCOPE}
              )
            ORDER BY candidate."createdAt" ASC, candidate."id" ASC
            LIMIT ${ORPHAN_QUIZ_CLEANUP_BATCH_SIZE}
            FOR UPDATE OF candidate SKIP LOCKED
          )
          DELETE FROM "Quiz" AS target
          USING candidates
          WHERE target."id" = candidates."id"
            AND target."createdAt" < ${cutoff}
            AND NOT EXISTS (
              SELECT 1
              FROM "Session" AS own_session
              WHERE own_session."quizId" = target."id"
            )
            AND (
              target."historyScopeId" IS NULL
              OR NOT EXISTS (
                SELECT 1
                FROM "Quiz" AS scoped_quiz
                INNER JOIN "Session" AS scoped_session
                  ON scoped_session."quizId" = scoped_quiz."id"
                WHERE scoped_quiz."historyScopeId" = target."historyScopeId"
              )
              OR (
                SELECT COUNT(*)::int
                FROM (
                  SELECT 1
                  FROM "Quiz" AS newer_sessionless
                  WHERE newer_sessionless."historyScopeId" = target."historyScopeId"
                    AND NOT EXISTS (
                      SELECT 1
                      FROM "Session" AS newer_session
                      WHERE newer_session."quizId" = newer_sessionless."id"
                    )
                    AND (
                      newer_sessionless."createdAt" > target."createdAt"
                      OR (
                        newer_sessionless."createdAt" = target."createdAt"
                        AND newer_sessionless."id" > target."id"
                      )
                    )
                  LIMIT ${ORPHAN_QUIZ_MAX_SESSIONLESS_PER_HISTORY_SCOPE}
                ) AS bounded_newer
              ) >= ${ORPHAN_QUIZ_MAX_SESSIONLESS_PER_HISTORY_SCOPE}
            )
          RETURNING target."id"
        `);
        return { count: deleted.length };
      },
      // Eine konkurrierende Session-Bindung erzeugt einen Serialisierungskonflikt
      // statt die neue Session über Quiz.onDelete=Cascade mitzulöschen.
      { isolationLevel: 'Serializable' },
    );

    deletedCount += result.count;
    if (result.count < ORPHAN_QUIZ_CLEANUP_BATCH_SIZE) {
      break;
    }
  }

  if (deletedCount > 0) {
    logger.info(
      `Quiz-Upload-Cleanup: ${deletedCount} verwaiste Upload(s) nach ` +
        `${ORPHAN_QUIZ_UPLOAD_GRACE_HOURS}h Grace Period gelöscht.`,
    );
  }
  return deletedCount;
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
