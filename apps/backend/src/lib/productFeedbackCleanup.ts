/**
 * ProductFeedback Retention-Cleanup (Story 12.1).
 * Freitext max. 90 Tage; strukturierte Datensätze max. ~13 Monate.
 */
import {
  PRODUCT_FEEDBACK_MESSAGE_RETENTION_DAYS,
  PRODUCT_FEEDBACK_STRUCTURED_RETENTION_DAYS,
} from '@arsnova/shared-types';
import { prisma } from '../db';
import { logger } from './logger';

const PRODUCT_FEEDBACK_INVITE_JOB_RETENTION_DAYS = 7;

/** Löscht Freitext nach Retention; setzt messageClearedAt. */
export async function cleanupProductFeedbackMessages(): Promise<number> {
  const cutoff = new Date(
    Date.now() - PRODUCT_FEEDBACK_MESSAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const result = await prisma.productFeedback.updateMany({
    where: {
      message: { not: null },
      messageClearedAt: null,
      createdAt: { lt: cutoff },
    },
    data: {
      message: null,
      messageClearedAt: new Date(),
    },
  });
  if (result.count > 0) {
    logger.info(
      `ProductFeedback-Message-Cleanup: ${result.count} Freitext(e) älter als ` +
        `${PRODUCT_FEEDBACK_MESSAGE_RETENTION_DAYS} Tage entfernt.`,
    );
  }
  return result.count;
}

/** Löscht strukturierte Datensätze nach ~13 Monaten. */
export async function cleanupProductFeedbackRecords(): Promise<number> {
  const cutoff = new Date(
    Date.now() - PRODUCT_FEEDBACK_STRUCTURED_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const result = await prisma.productFeedback.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  if (result.count > 0) {
    logger.info(
      `ProductFeedback-Record-Cleanup: ${result.count} Datensatz/Datensätze älter als ` +
        `${PRODUCT_FEEDBACK_STRUCTURED_RETENTION_DAYS} Tage gelöscht.`,
    );
  }
  return result.count;
}

/** Entfernt erledigte oder endgültig fehlgeschlagene Invite-Jobs samt Sessionbezug. */
export async function cleanupProductFeedbackInviteJobs(): Promise<number> {
  const cutoff = new Date(
    Date.now() - PRODUCT_FEEDBACK_INVITE_JOB_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const result = await prisma.productFeedbackInviteJob.deleteMany({
    where: {
      createdAt: { lt: cutoff },
      OR: [{ completedAt: { not: null } }, { attempts: { gte: 8 } }],
    },
  });
  if (result.count > 0) {
    logger.info(`ProductFeedback-Invite-Job-Cleanup: ${result.count} Job(s) entfernt.`);
  }
  return result.count;
}
