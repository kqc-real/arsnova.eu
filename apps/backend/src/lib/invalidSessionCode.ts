import { TRPCError } from '@trpc/server';
import {
  logSessionCodeSoftCapDelay,
  recordSessionCodeFailure,
  recordSessionCodeSoftCapDelay,
  type SessionCodeFailureSource,
} from './abuseTelemetry';
import {
  checkInvalidSessionCodeFailure,
  waitForInvalidSessionCodeDelay,
} from './sessionCodeProtection';

/**
 * Gemeinsamer Fehlerpfad für öffentliche Session-Code-Orakel. Der Aufrufer
 * muss zuvor bereits festgestellt haben, dass der Code nicht existiert.
 */
export async function rejectInvalidSessionCode(
  anonymousClientId: string | undefined,
  normalizedCode: string,
  source: SessionCodeFailureSource = 'other',
): Promise<never> {
  recordSessionCodeFailure(source);
  const decision = await checkInvalidSessionCodeFailure(anonymousClientId, normalizedCode);

  if (!decision.allowed) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message:
        'Ungültiger Code. Zu viele Fehlversuche – bitte warten Sie vor dem nächsten Versuch.',
      cause: { retryAfterSeconds: decision.retryAfterSeconds },
    });
  }

  if (decision.delayMs > 0) {
    const delayed = await waitForInvalidSessionCodeDelay(decision.delayMs);
    if (!delayed) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Ungültiger Code. Zu viele gleichzeitige Fehlversuche.',
        cause: { retryAfterSeconds: 1 },
      });
    }
    recordSessionCodeSoftCapDelay(source);
    logSessionCodeSoftCapDelay({
      delayMs: decision.delayMs,
      globalUtilizationPercent: decision.globalUtilizationPercent,
      source,
    });
  }

  throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
}
