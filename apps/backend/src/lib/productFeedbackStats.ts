/**
 * ProductFeedback Admin-Aggregation (Story 12.1).
 * Feine Segmente nur bei count >= PRODUCT_FEEDBACK_ADMIN_MIN_SEGMENT.
 */
import {
  PRODUCT_FEEDBACK_ADMIN_MIN_SEGMENT,
  type AdminProductFeedbackStatsDTO,
  type AdminProductFeedbackStatsInput,
} from '@arsnova/shared-types';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';

function toBuckets(
  rows: Array<{ key: string | null; count: number }>,
  minCount = 0,
): Array<{ key: string; count: number }> {
  return rows
    .filter((r) => r.key !== null && r.count >= minCount)
    .map((r) => ({ key: r.key as string, count: r.count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export async function buildProductFeedbackAdminStats(
  input: AdminProductFeedbackStatsInput,
): Promise<AdminProductFeedbackStatsDTO> {
  const where: Prisma.ProductFeedbackWhereInput = {
    source: 'POST_SESSION',
    ...(input.surveyKey ? { surveyKey: input.surveyKey } : {}),
    ...(input.role ? { role: input.role } : {}),
    ...(input.from || input.to
      ? {
          createdAt: {
            ...(input.from ? { gte: new Date(input.from) } : {}),
            ...(input.to ? { lte: new Date(input.to) } : {}),
          },
        }
      : {}),
  };

  const [
    totals,
    byPrimaryAnswer,
    byArea,
    bySurveyKey,
    byLocale,
    bySessionSizeClass,
    byDeviceClass,
    fineRows,
  ] = await Promise.all([
    prisma.productFeedback.count({ where }),
    prisma.productFeedback.groupBy({
      by: ['primaryAnswer'],
      where,
      _count: { _all: true },
    }),
    prisma.productFeedback.groupBy({
      by: ['area'],
      where,
      _count: { _all: true },
    }),
    prisma.productFeedback.groupBy({
      by: ['surveyKey'],
      where,
      _count: { _all: true },
    }),
    prisma.productFeedback.groupBy({
      by: ['locale'],
      where,
      _count: { _all: true },
    }),
    prisma.productFeedback.groupBy({
      by: ['sessionSizeClass'],
      where,
      _count: { _all: true },
    }),
    prisma.productFeedback.groupBy({
      by: ['deviceClass'],
      where,
      _count: { _all: true },
    }),
    prisma.productFeedback.groupBy({
      by: ['surveyKey', 'primaryAnswer'],
      where,
      _count: { _all: true },
    }),
  ]);

  const bySurveyAndPrimary = fineRows
    .map((r) => ({
      surveyKey: r.surveyKey,
      primaryAnswer: r.primaryAnswer,
      count: r._count._all,
    }))
    .filter((r) => r.count >= PRODUCT_FEEDBACK_ADMIN_MIN_SEGMENT)
    .sort((a, b) => b.count - a.count);

  return {
    totals,
    byPrimaryAnswer: toBuckets(
      byPrimaryAnswer.map((r) => ({ key: r.primaryAnswer, count: r._count._all })),
    ),
    byArea: toBuckets(byArea.map((r) => ({ key: r.area, count: r._count._all }))),
    bySurveyKey: toBuckets(bySurveyKey.map((r) => ({ key: r.surveyKey, count: r._count._all }))),
    byLocale: toBuckets(
      byLocale.map((r) => ({ key: r.locale, count: r._count._all })),
      PRODUCT_FEEDBACK_ADMIN_MIN_SEGMENT,
    ),
    bySessionSizeClass: toBuckets(
      bySessionSizeClass.map((r) => ({ key: r.sessionSizeClass, count: r._count._all })),
      PRODUCT_FEEDBACK_ADMIN_MIN_SEGMENT,
    ),
    byDeviceClass: toBuckets(
      byDeviceClass.map((r) => ({ key: r.deviceClass, count: r._count._all })),
      PRODUCT_FEEDBACK_ADMIN_MIN_SEGMENT,
    ),
    bySurveyAndPrimary,
    // Historische Einladungszahlen werden nicht dauerhaft in PG gespeichert.
    invitationsIssued: null,
    invitationCompletionRate: null,
  };
}
