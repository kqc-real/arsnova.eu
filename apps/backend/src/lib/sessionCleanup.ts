/**
 * Automatisches Cleanup für verwaiste Sessions (Story 4.2),
 * Session-Purge nach Retention-Fenster (Epic 9) und
 * abgelaufene Bonus-Tokens (Story 4.6).
 */
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { SESSION_POST_PROCESSING_HOURS } from '@arsnova/shared-types';
import { prisma } from '../db';
import { logger } from './logger';
import { invalidateHostSessionToken } from './hostAuth';
import { invalidateHostPairingForSession } from './hostPairing';
import { publishSessionPurgeInvalidation } from './sessionPurgeInvalidation';
import { incrementCompletedSessionsTotal } from './platformStatistic';
import {
  issueProductFeedbackInvitesAfterFinish,
  retryPendingProductFeedbackInviteJobs,
} from './productFeedbackInvite';
import {
  cleanupProductFeedbackInviteJobs,
  cleanupProductFeedbackMessages,
  cleanupProductFeedbackRecords,
} from './productFeedbackCleanup';
import {
  ORPHAN_QUIZ_CLEANUP_BATCH_SIZE,
  ORPHAN_QUIZ_CLEANUP_MAX_BATCHES,
  ORPHAN_QUIZ_MAX_SESSIONLESS_PER_HISTORY_SCOPE,
  ORPHAN_QUIZ_UPLOAD_GRACE_HOURS,
} from './publicCreateCapacity';
import { cleanupExpiredHostCredentialMaterial } from './hostCredentialRecovery';
import { expireParticipantJoinReplayEnvelopes } from './participantJoin';

const BONUS_TOKEN_RETENTION_DAYS = 90;
const SESSION_FEEDBACK_RETENTION_DAYS = 90;
const ADMIN_AUDIT_RETENTION_DAYS = 365;
const SESSION_PURGE_BATCH_SIZE = 100;
const CLEANUP_INTERVAL_MS = 60 * 1000;

export {
  ORPHAN_QUIZ_CLEANUP_BATCH_SIZE,
  ORPHAN_QUIZ_CLEANUP_MAX_BATCHES,
  ORPHAN_QUIZ_MAX_SESSIONLESS_PER_HISTORY_SCOPE,
  ORPHAN_QUIZ_UPLOAD_GRACE_HOURS,
} from './publicCreateCapacity';

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

export async function cleanupStaleSessions(): Promise<number> {
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      WITH candidates AS (
        SELECT candidate."id"
        FROM "Session" AS candidate
        WHERE candidate."endedAt" IS NULL
          AND candidate."status" <> 'FINISHED'
          AND candidate."expiresAt" <= timezone('UTC', clock_timestamp())
        ORDER BY candidate."expiresAt" ASC, candidate."id" ASC
        LIMIT 200
        FOR UPDATE OF candidate SKIP LOCKED
      )
      UPDATE "Session" AS target
      SET
        "status" = 'FINISHED',
        "endedAt" = target."expiresAt",
        "statusChangedAt" = target."expiresAt",
        "currentQuestion" = NULL,
        "currentRound" = 1
      FROM candidates
      WHERE target."id" = candidates."id"
        AND target."endedAt" IS NULL
        AND target."status" <> 'FINISHED'
        AND target."expiresAt" <= timezone('UTC', clock_timestamp())
      RETURNING target."id"
    `);
    if (updated.length > 0) {
      await tx.productFeedbackInviteJob.createMany({
        data: updated.map(({ id: sessionId }) => ({ sessionId })),
        skipDuplicates: true,
      });
    }
    return updated;
  });

  if (result.length > 0) {
    await incrementCompletedSessionsTotal(result.length);
    logger.info(`Session-Cleanup: ${result.length} Session(s) an ihrer absoluten Frist beendet.`);
    for (const { id } of result) {
      void issueProductFeedbackInvitesAfterFinish(id);
    }
  }

  return result.length;
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
    where: { createdAt: { lt: cutoff } },
  });

  if (result.count > 0) {
    logger.info(
      `SessionFeedback-Cleanup: ${result.count} Bewertung(en) älter als ` +
        `${SESSION_FEEDBACK_RETENTION_DAYS} Tage gelöscht.`,
    );
  }

  return result.count;
}

export async function cleanupExpiredAdminAuditLogs(): Promise<number> {
  const cutoff = new Date(Date.now() - ADMIN_AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const result = await prisma.adminAuditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  if (result.count > 0) {
    logger.info(
      `AdminAudit-Cleanup: ${result.count} Nachweis(e) älter als ` +
        `${ADMIN_AUDIT_RETENTION_DAYS} Tage gelöscht.`,
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
  const sessionsToPurge = await prisma.$queryRaw<
    Array<{ id: string; code: string; quizId: string | null }>
  >(Prisma.sql`
    SELECT candidate."id", candidate."code", candidate."quizId"
    FROM "Session" AS candidate
    WHERE candidate."status" = 'FINISHED'
      AND candidate."endedAt" IS NOT NULL
      AND candidate."endedAt" + (${SESSION_POST_PROCESSING_HOURS} * INTERVAL '1 hour')
        <= timezone('UTC', clock_timestamp())
      AND (
        candidate."legalHoldUntil" IS NULL
        OR candidate."legalHoldUntil" <= timezone('UTC', clock_timestamp())
      )
    ORDER BY candidate."endedAt" ASC, candidate."id" ASC
    LIMIT ${SESSION_PURGE_BATCH_SIZE}
  `);
  if (sessionsToPurge.length === 0) {
    return 0;
  }

  // Ab postProcessingEndsAt gewähren weder Legal Hold noch getrennte
  // Bonus-/Feedback-Retention regulären Hostzugriff. Redis-Credentials werden
  // deshalb vor dem Core-Purge entwertet; ein Fehler lässt die Session für
  // einen späteren, sichtbaren Retry bestehen.
  const invalidated = await Promise.all(
    sessionsToPurge.map(async (session) => {
      try {
        await invalidateHostSessionToken(session.code);
        await invalidateHostPairingForSession(session.code);
        await publishSessionPurgeInvalidation({
          sessionId: session.id,
          sessionCode: session.code,
        });
        return session;
      } catch (error) {
        logger.warn(
          `Session-Purge für ${session.id} verzögert: Credential-/Runtime-Cleanup fehlgeschlagen:`,
          (error as Error).message,
        );
        return null;
      }
    }),
  );
  const ready = invalidated.filter(
    (session): session is (typeof sessionsToPurge)[number] => session !== null,
  );
  if (ready.length === 0) {
    return 0;
  }

  const deletedSessions = await prisma.$transaction(
    async (tx) => {
      const readyIds = ready.map((session) => session.id);
      const locked = await tx.$queryRaw<
        Array<{ id: string; code: string; quizId: string | null }>
      >(Prisma.sql`
        SELECT candidate."id", candidate."code", candidate."quizId"
        FROM "Session" AS candidate
        WHERE candidate."id" IN (${Prisma.join(readyIds)})
          AND candidate."status" = 'FINISHED'
          AND candidate."endedAt" IS NOT NULL
          AND candidate."endedAt" + (${SESSION_POST_PROCESSING_HOURS} * INTERVAL '1 hour')
            <= timezone('UTC', clock_timestamp())
          AND (
            candidate."legalHoldUntil" IS NULL
            OR candidate."legalHoldUntil" <= timezone('UTC', clock_timestamp())
          )
        ORDER BY candidate."endedAt" ASC, candidate."id" ASC
        FOR UPDATE OF candidate SKIP LOCKED
      `);
      if (locked.length === 0) {
        return [];
      }

      for (const session of locked) {
        await tx.adminAuditLog.updateMany({
          where: {
            OR: [{ sessionId: session.id }, { sessionCode: session.code }],
          },
          data: {
            sessionId: null,
            sessionCode: null,
            sessionReferenceHash: createHash('sha256')
              .update(`arsnova-session-audit:${session.id}`)
              .digest('hex'),
          },
        });
      }
      await tx.productFeedbackInviteJob.deleteMany({
        where: { sessionId: { in: locked.map((session) => session.id) } },
      });

      const deleted = await tx.$queryRaw<
        Array<{ id: string; code: string; quizId: string | null }>
      >(Prisma.sql`
        DELETE FROM "Session" AS target
        WHERE target."id" IN (${Prisma.join(locked.map((session) => session.id))})
          AND target."status" = 'FINISHED'
          AND target."endedAt" IS NOT NULL
          AND target."endedAt" + (${SESSION_POST_PROCESSING_HOURS} * INTERVAL '1 hour')
            <= timezone('UTC', clock_timestamp())
          AND (
            target."legalHoldUntil" IS NULL
            OR target."legalHoldUntil" <= timezone('UTC', clock_timestamp())
          )
        RETURNING target."id", target."code", target."quizId"
      `);

      const quizIds = [
        ...new Set(
          deleted
            .map((session) => session.quizId)
            .filter((quizId): quizId is string => quizId !== null),
        ),
      ];
      if (quizIds.length > 0) {
        await tx.quiz.deleteMany({
          where: {
            id: { in: quizIds },
            sessions: { none: {} },
          },
        });
      }
      return deleted;
    },
    { isolationLevel: 'Serializable' },
  );

  if (deletedSessions.length > 0) {
    await Promise.all(
      deletedSessions.map((session) =>
        publishSessionPurgeInvalidation({
          sessionId: session.id,
          sessionCode: session.code,
        }).catch((error: unknown) => {
          logger.warn(
            `Session-Purge-Nachinvalidierung für ${session.id} fehlgeschlagen:`,
            (error as Error).message,
          );
        }),
      ),
    );
    logger.info(
      `Session-Purge: ${deletedSessions.length} beendete Session(s) nach ` +
        `${SESSION_POST_PROCESSING_HOURS}h Nachbereitung gelöscht (ohne aktiven Legal Hold).`,
    );
  }
  return deletedSessions.length;
}

export async function runAllCleanups(): Promise<void> {
  await cleanupExpiredHostCredentialMaterial().catch((err) => {
    logger.warn('Host-Credential-Cleanup fehlgeschlagen:', (err as Error).message);
  });
  await prisma
    .$transaction((tx) => expireParticipantJoinReplayEnvelopes(tx))
    .catch((err) => {
      logger.warn('Participant-Join-Replay-Cleanup fehlgeschlagen:', (err as Error).message);
    });
  await cleanupStaleSessions().catch((err) => {
    logger.warn('Session-Cleanup fehlgeschlagen:', (err as Error).message);
  });
  await cleanupExpiredBonusTokens().catch((err) => {
    logger.warn('BonusToken-Cleanup fehlgeschlagen:', (err as Error).message);
  });
  await cleanupExpiredSessionFeedback().catch((err) => {
    logger.warn('SessionFeedback-Cleanup fehlgeschlagen:', (err as Error).message);
  });
  await cleanupExpiredAdminAuditLogs().catch((err) => {
    logger.warn('AdminAudit-Cleanup fehlgeschlagen:', (err as Error).message);
  });
  await retryPendingProductFeedbackInviteJobs().catch((err) => {
    logger.warn('ProductFeedback-Invite-Job-Retry fehlgeschlagen:', (err as Error).message);
  });
  await cleanupProductFeedbackMessages().catch((err) => {
    logger.warn('ProductFeedback-Message-Cleanup fehlgeschlagen:', (err as Error).message);
  });
  await cleanupProductFeedbackRecords().catch((err) => {
    logger.warn('ProductFeedback-Cleanup fehlgeschlagen:', (err as Error).message);
  });
  await cleanupProductFeedbackInviteJobs().catch((err) => {
    logger.warn('ProductFeedback-Invite-Job-Cleanup fehlgeschlagen:', (err as Error).message);
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
