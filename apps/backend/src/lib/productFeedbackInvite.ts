/**
 * ProductFeedback Invite-Ausstellung nach Session-Ende (Story 12.1).
 *
 * Best-effort nach erfolgreichem FINISHED-Commit: Fehler werden geloggt und
 * werfen nicht, damit session.end / nextQuestion / Cleanup niemals wegen
 * Produktfeedback zurückgerollt werden.
 */
import { logger } from './logger';
import { createInviteTokensForSession } from './productFeedbackTokens';

/**
 * Fire-and-forget Wrapper für Session-Finish-Pfade.
 */
export function issueProductFeedbackInvitesAfterFinish(sessionId: string): void {
  void issueProductFeedbackInvitesAfterFinishAwait(sessionId);
}

/**
 * Awaitable Variante für Tests und gezielte Aufrufe.
 */
export async function issueProductFeedbackInvitesAfterFinishAwait(
  sessionId: string,
): Promise<{ participantInvites: number; hostInvite: boolean }> {
  try {
    return await createInviteTokensForSession(sessionId);
  } catch (err) {
    logger.warn('ProductFeedback-Invite-Ausstellung fehlgeschlagen:', (err as Error).message);
    return { participantInvites: 0, hostInvite: false };
  }
}
