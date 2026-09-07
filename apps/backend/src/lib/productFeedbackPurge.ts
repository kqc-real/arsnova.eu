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

const MS_PER_UTC_DAY = 24 * 60 * 60 * 1000;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Einladungszähler (UTC-Tagesbucket) nur löschen, wenn der ganze UTC-Tag
 * innerhalb von `until` liegt. Teilweise überdeckte Buckets bleiben, damit die
 * Abschlussquote nicht durch zu weit gelöschte Nenner verfälscht wird.
 */
export function productFeedbackInviteLedgerPurgeWhere(
  input: AdminProductFeedbackPurgePreviewInput,
): Prisma.ProductFeedbackInviteLedgerWhereInput {
  if (input.scope === 'ALL') return {};
  const until = new Date(input.until);
  const untilDayStart = startOfUtcDay(until);
  const untilDayEndMs = untilDayStart.getTime() + MS_PER_UTC_DAY - 1;
  if (until.getTime() >= untilDayEndMs) {
    return { day: { lte: untilDayStart } };
  }
  return { day: { lt: untilDayStart } };
}
