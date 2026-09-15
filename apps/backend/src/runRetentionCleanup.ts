/**
 * Operator-Gate nach einem Datenbank-Restore und vor Traffic-Freigabe.
 *
 * Führt alle TTL-Cleanups aus, leert den Session-Purge in bounded Batches und
 * beendet sich ungleich null, solange ein überfälliger Sessionkern verbleibt.
 */
import './load-env';
import { SESSION_POST_PROCESSING_HOURS } from '@arsnova/shared-types';
import { Prisma } from '@prisma/client';
import { disconnectDatabase, prisma } from './db';
import { cleanupExpiredFinishedSessions, runAllCleanups } from './lib/sessionCleanup';
import { logger } from './lib/logger';
import { closeRedis } from './redis';

async function countOverdueSessionPurges(): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS count
    FROM "Session"
    WHERE status = 'FINISHED'
      AND "endedAt" IS NOT NULL
      AND "endedAt" + (${SESSION_POST_PROCESSING_HOURS} * INTERVAL '1 hour')
        <= timezone('UTC', clock_timestamp())
      AND (
        "legalHoldUntil" IS NULL
        OR "legalHoldUntil" <= timezone('UTC', clock_timestamp())
      )
  `);
  return Number(rows[0]?.count ?? 0n);
}

async function main(): Promise<void> {
  await runAllCleanups();
  while ((await cleanupExpiredFinishedSessions()) > 0) {
    // Bounded weiterarbeiten, bis kein vollständiger Batch mehr übrig ist.
  }
  const overdue = await countOverdueSessionPurges();
  if (overdue > 0) {
    throw new Error(
      `${overdue} überfällige Session-Purge(s) verblieben; Traffic-Freigabe abgebrochen.`,
    );
  }
  logger.info('Retention-Cleanup vollständig; keine überfälligen Sessionkerne verblieben.');
}

main()
  .catch((error: unknown) => {
    logger.error('Retention-Cleanup fehlgeschlagen:', (error as Error).message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([closeRedis(), disconnectDatabase()]);
  });
