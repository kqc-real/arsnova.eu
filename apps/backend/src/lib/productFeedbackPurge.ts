import type { Prisma } from '@prisma/client';
import type { AdminProductFeedbackPurgePreviewInput } from '@arsnova/shared-types';

export function productFeedbackPurgeWhere(
  input: AdminProductFeedbackPurgePreviewInput,
): Prisma.ProductFeedbackWhereInput {
  if (input.scope === 'ALL') return {};
  return { createdAt: { lte: new Date(input.until) } };
}
