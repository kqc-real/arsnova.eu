/**
 * ProductFeedback Invite-Ausstellung nach Session-Ende (Story 12.1).
 *
 * Host-sichtbare Finish-Pfade (`session.end` / Finish via next/skip) awaiten die
 * Ausstellung, damit claimInvite nicht gegen noch fehlende Slots race't.
 * Fehler werden geloggt und werfen nicht — Finish wird nicht zurückgerollt.
 * Stale-Cleanup bleibt fire-and-forget.
 */
import { logger } from './logger';
import { createInviteTokensForSession } from './productFeedbackTokens';

/**
 * Fire-and-forget Wrapper (z. B. Stale-Cleanup).
 */
export function issueProductFeedbackInvitesAfterFinish(sessionId: string): void {
  void issueProductFeedbackInvitesAfterFinishAwait(sessionId);
}

/**
 * Awaitable Variante für Finish-Pfade und Tests.
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
