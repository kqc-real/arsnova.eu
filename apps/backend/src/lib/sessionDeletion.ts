import { Prisma } from '@prisma/client';
import { prisma } from '../db';

const SESSION_DELETION_MAX_TRANSACTION_ATTEMPTS = 3;

function isSerializableWriteConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

/**
 * Session- und Parent-Quiz-Löschungen teilen sich eine SERIALIZABLE-Grenze.
 * PostgreSQL-/Prisma-Schreibkonflikte werden bounded wiederholt; andere Fehler
 * werden unverändert weitergereicht.
 */
export async function runSerializableSessionDeletion<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= SESSION_DELETION_MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        !isSerializableWriteConflict(error) ||
        attempt === SESSION_DELETION_MAX_TRANSACTION_ATTEMPTS
      ) {
        throw error;
      }
    }
  }
  throw new Error('Unreachable session-deletion retry state.');
}

export type LockedSessionDeletionTarget = {
  id: string;
  code: string;
  quizId: string | null;
};

/**
 * Sperrt die zu löschenden Sessionzeilen in derselben Reihenfolge wie andere
 * Session-Mutationen. Die aktuellen Parent-IDs müssen innerhalb jedes
 * SERIALIZABLE-Versuchs gelesen werden, damit ein Retry keinen vor der
 * Transaktion ermittelten Quizbezug weiterverwendet.
 */
export async function lockSessionDeletionTargets(
  tx: Prisma.TransactionClient,
  sessionIds: readonly string[],
): Promise<readonly LockedSessionDeletionTarget[]> {
  const uniqueSessionIds = [...new Set(sessionIds)].sort();
  if (uniqueSessionIds.length === 0) return [];

  return tx.$queryRaw<LockedSessionDeletionTarget[]>(Prisma.sql`
    /* arsnova-session-deletion-target-lock */
    SELECT target."id", target."code", target."quizId"
    FROM "Session" AS target
    WHERE target."id" IN (${Prisma.join(uniqueSessionIds)})
    ORDER BY target."id" ASC
    FOR UPDATE OF target
  `);
}

/**
 * Koordiniert FK-lose, sessionbezogene Writer mit dem Purge. Gewinnt der
 * Writer die Sessionzeilensperre, sieht und bereinigt der nachfolgende Purge
 * seinen Datensatz. Gewinnt der Purge, darf der Writer keinen neuen Rohbezug
 * auf die bereits gelöschte Session anlegen.
 */
export async function runSessionBoundWrite<T>(
  sessionId: string,
  operation: (tx: Prisma.TransactionClient, target: LockedSessionDeletionTarget) => Promise<T>,
): Promise<T | null> {
  return prisma.$transaction(async (tx) => {
    const [target] = await lockSessionDeletionTargets(tx, [sessionId]);
    if (!target) return null;
    // Das absichtliche No-op-UPDATE erzeugt eine neue MVCC-Tupelversion. Ein
    // bereits auf dem Lock wartender SERIALIZABLE-Purge muss dadurch mit
    // P2034 neu starten und sieht danach den FK-losen Writer-Datensatz.
    await tx.$executeRaw(Prisma.sql`
      UPDATE "Session"
      SET "statusChangedAt" = "statusChangedAt"
      WHERE "id" = ${target.id}
    `);
    return operation(tx, target);
  });
}

/**
 * Sperrt nach den Ziel-Sessions deren aktuelle Parent-Quizze deterministisch
 * vor dem Delete. Ein paralleles session.create/attachQuiz muss dadurch
 * entweder vor der Sperre committen und wird vom anschließenden
 * Orphan-Prädikat gesehen, oder wartet und scheitert, falls das Parent-Quiz in
 * derselben Transaktion entfernt wurde.
 */
export async function lockSessionDeletionQuizParents(
  tx: Prisma.TransactionClient,
  quizIds: readonly (string | null | undefined)[],
): Promise<readonly string[]> {
  const uniqueQuizIds = [...new Set(quizIds.filter((id): id is string => Boolean(id)))].sort();
  if (uniqueQuizIds.length === 0) return uniqueQuizIds;

  await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT parent."id"
    FROM "Quiz" AS parent
    WHERE parent."id" IN (${Prisma.join(uniqueQuizIds)})
    ORDER BY parent."id" ASC
    FOR UPDATE OF parent
  `);
  return uniqueQuizIds;
}
