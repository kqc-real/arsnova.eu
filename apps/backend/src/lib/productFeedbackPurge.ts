import { TRPCError } from '@trpc/server';
import type { Prisma } from '@prisma/client';
import type { AdminProductFeedbackPurgePreviewInput } from '@arsnova/shared-types';

/** Lokales Tagesende kann UTC-seitig vorauseilen; 48h fängt TZ ab, blockt aber 2099. */
export const PRODUCT_FEEDBACK_PURGE_UNTIL_MAX_AHEAD_MS = 48 * 60 * 60 * 1000;

export function assertProductFeedbackPurgeUntil(until: string, now = Date.now()): void {
  const cutoff = new Date(until);
  if (
    Number.isNaN(cutoff.getTime()) ||
    cutoff.getTime() > now + PRODUCT_FEEDBACK_PURGE_UNTIL_MAX_AHEAD_MS
  ) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Das Datum darf nicht in der Zukunft liegen.',
    });
  }
}

export function productFeedbackPurgeWhere(
  input: AdminProductFeedbackPurgePreviewInput,
): Prisma.ProductFeedbackWhereInput {
  if (input.scope === 'ALL') return {};
  return { createdAt: { lte: new Date(input.until) } };
}

/** Einladungszähler für denselben Zeitraum wie die gelöschten Rückmeldungen. */
export function productFeedbackInviteLedgerPurgeWhere(
  input: AdminProductFeedbackPurgePreviewInput,
): Prisma.ProductFeedbackInviteLedgerWhereInput {
  if (input.scope === 'ALL') return {};
  return { day: { lte: new Date(input.until) } };
}
