/**
 * ProductFeedback Invite-Ausstellung nach Session-Ende (Story 12.1).
 *
 * Finish-Pfade schreiben zuerst einen PG-Job (überlebt Crash nach FINISHED),
 * awaiten die Ausstellung und markieren den Job erledigt. Fehler werden geloggt
 * und werfen nicht — Finish wird nicht zurückgerollt. Stale-Cleanup bleibt
 * fire-and-forget; offene Jobs werden periodisch nachgezogen.
 */
import { prisma } from '../db';
import { logger } from './logger';
import { createInviteTokensForSession } from './productFeedbackTokens';

export async function enqueueProductFeedbackInviteJob(sessionId: string): Promise<void> {
  await prisma.productFeedbackInviteJob.upsert({
    where: { sessionId },
    create: { sessionId },
    update: {},
  });
}

export async function completeProductFeedbackInviteJob(sessionId: string): Promise<void> {
  await prisma.productFeedbackInviteJob.updateMany({
    where: { sessionId, completedAt: null },
    data: { completedAt: new Date() },
  });
}

export async function failProductFeedbackInviteJob(
  sessionId: string,
  message: string,
): Promise<void> {
  await prisma.productFeedbackInviteJob.updateMany({
    where: { sessionId, completedAt: null },
    data: {
      attempts: { increment: 1 },
      lastError: message.slice(0, 500),
    },
  });
}

/** Fire-and-forget Wrapper (z. B. Stale-Cleanup). */
export function issueProductFeedbackInvitesAfterFinish(sessionId: string): void {
  void issueProductFeedbackInvitesAfterFinishAwait(sessionId);
}

/** Awaitable Variante für Finish-Pfade und Tests. */
export async function issueProductFeedbackInvitesAfterFinishAwait(
  sessionId: string,
): Promise<{ participantInvites: number; hostInvite: boolean }> {
  try {
    await enqueueProductFeedbackInviteJob(sessionId);
    const result = await createInviteTokensForSession(sessionId);
    await completeProductFeedbackInviteJob(sessionId);
    return result;
  } catch (err) {
    const message = (err as Error).message;
    logger.warn('ProductFeedback-Invite-Ausstellung fehlgeschlagen:', message);
    await failProductFeedbackInviteJob(sessionId, message).catch(() => undefined);
    return { participantInvites: 0, hostInvite: false };
  }
}

/** Offene Jobs nach Crash/Fehler erneut ausstellen (Cleanup-Tick). */
export async function retryPendingProductFeedbackInviteJobs(limit = 25): Promise<number> {
  const pending = await prisma.productFeedbackInviteJob.findMany({
    where: { completedAt: null, attempts: { lt: 8 } },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { sessionId: true },
  });
  let done = 0;
  for (const job of pending) {
    const result = await issueProductFeedbackInvitesAfterFinishAwait(job.sessionId);
    if (result.participantInvites > 0 || result.hostInvite) done += 1;
  }
  return done;
}
