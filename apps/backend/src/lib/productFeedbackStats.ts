/**
 * ProductFeedback Admin-Aggregation (Stories 12.1 und 12.2).
 * Feine Segmente nur bei count >= PRODUCT_FEEDBACK_ADMIN_MIN_SEGMENT.
 */
import {
  PRODUCT_FEEDBACK_ADMIN_MIN_SEGMENT,
  type AdminProductFeedbackStatsDTO,
  type AdminProductFeedbackStatsInput,
  type AdminProductFeedbackTriageStatsDTO,
  type AdminProductFeedbackTriageStatsInput,
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

  const ledgerWhere: Prisma.ProductFeedbackInviteLedgerWhereInput = {
    ...(input.role ? { role: input.role } : {}),
    ...(input.from || input.to
      ? {
          day: {
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
    byPositiveArea,
    byHurdleArea,
    bySurveyKey,
    byLocale,
    bySessionSizeClass,
    byDeviceClass,
    fineRows,
    byRole,
    bySurveyVersion,
    byAppVersion,
    bySessionKind,
    featureRows,
    inviteAgg,
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
      by: ['area'],
      where: { ...where, primaryAnswer: { in: ['EASY', 'YES'] } },
      _count: { _all: true },
    }),
    prisma.productFeedback.groupBy({
      by: ['area'],
      where: {
        ...where,
        primaryAnswer: { in: ['MINOR_FRICTION', 'HARD', 'PARTIAL', 'NO'] },
      },
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
    prisma.productFeedback.groupBy({
      by: ['role'],
      where,
      _count: { _all: true },
    }),
    prisma.productFeedback.groupBy({
      by: ['surveyVersion'],
      where,
      _count: { _all: true },
    }),
    prisma.productFeedback.groupBy({
      by: ['appVersion'],
      where,
      _count: { _all: true },
    }),
    prisma.productFeedback.groupBy({
      by: ['sessionKind'],
      where,
      _count: { _all: true },
    }),
    prisma.productFeedback.findMany({
      where,
      select: { featureAreas: true },
    }),
    prisma.productFeedbackInviteLedger.aggregate({
      where: ledgerWhere,
      _sum: { count: true },
    }),
  ]);

  const bySurveyAndPrimary = fineRows
    .filter(
      (
        row,
      ): row is typeof row & {
        surveyKey: string;
        primaryAnswer: string;
      } => row.surveyKey !== null && row.primaryAnswer !== null,
    )
    .map((r) => ({
      surveyKey: r.surveyKey,
      primaryAnswer: r.primaryAnswer,
      count: r._count._all,
    }))
    .filter((r) => r.count >= PRODUCT_FEEDBACK_ADMIN_MIN_SEGMENT)
    .sort((a, b) => b.count - a.count);

  const invitationsIssued = inviteAgg._sum.count ?? 0;
  const invitationCompletionRate =
    invitationsIssued > 0 ? Math.min(1, totals / invitationsIssued) : null;
  const featureAreaCounts = new Map<string, number>();
  for (const row of featureRows) {
    if (!Array.isArray(row.featureAreas)) continue;
    for (const value of row.featureAreas) {
      if (typeof value !== 'string') continue;
      featureAreaCounts.set(value, (featureAreaCounts.get(value) ?? 0) + 1);
    }
  }
  const minSegment = PRODUCT_FEEDBACK_ADMIN_MIN_SEGMENT;

  return {
    totals,
    byPrimaryAnswer: toBuckets(
      byPrimaryAnswer.map((r) => ({ key: r.primaryAnswer, count: r._count._all })),
      minSegment,
    ),
    byArea: toBuckets(
      byArea.map((r) => ({ key: r.area, count: r._count._all })),
      minSegment,
    ),
    byPositiveArea: toBuckets(
      byPositiveArea.map((r) => ({ key: r.area, count: r._count._all })),
      minSegment,
    ),
    byHurdleArea: toBuckets(
      byHurdleArea.map((r) => ({ key: r.area, count: r._count._all })),
      minSegment,
    ),
    bySurveyKey: toBuckets(
      bySurveyKey.map((r) => ({ key: r.surveyKey, count: r._count._all })),
      minSegment,
    ),
    byLocale: toBuckets(
      byLocale.map((r) => ({ key: r.locale, count: r._count._all })),
      minSegment,
    ),
    bySessionSizeClass: toBuckets(
      bySessionSizeClass.map((r) => ({ key: r.sessionSizeClass, count: r._count._all })),
      minSegment,
    ),
    byDeviceClass: toBuckets(
      byDeviceClass.map((r) => ({ key: r.deviceClass, count: r._count._all })),
      minSegment,
    ),
    bySessionKind: toBuckets(
      bySessionKind.map((r) => ({ key: r.sessionKind, count: r._count._all })),
      minSegment,
    ),
    byFeatureArea: toBuckets(
      [...featureAreaCounts].map(([key, count]) => ({ key, count })),
      minSegment,
    ),
    bySurveyAndPrimary,
    byRole: toBuckets(
      byRole.map((r) => ({ key: r.role, count: r._count._all })),
      minSegment,
    ),
    bySurveyVersion: toBuckets(
      bySurveyVersion.map((r) => ({ key: String(r.surveyVersion), count: r._count._all })),
      minSegment,
    ),
    byAppVersion: toBuckets(
      byAppVersion.map((r) => ({ key: r.appVersion, count: r._count._all })),
      minSegment,
    ),
    invitationsIssued,
    invitationCompletionRate,
  };
}

export async function buildProductFeedbackTriageStats(
  input: AdminProductFeedbackTriageStatsInput,
): Promise<AdminProductFeedbackTriageStatsDTO> {
  const where: Prisma.ProductFeedbackWhereInput = {
    source: 'IN_APP',
    ...(input.appVersion ? { appVersion: input.appVersion } : {}),
    ...(input.from || input.to
      ? {
          createdAt: {
            ...(input.from ? { gte: new Date(input.from) } : {}),
            ...(input.to ? { lte: new Date(input.to) } : {}),
          },
        }
      : {}),
  };
  const [totals, blocking, byKind, byArea, byStatus, byAppVersion] = await Promise.all([
    prisma.productFeedback.count({ where }),
    prisma.productFeedback.count({ where: { ...where, impact: 'BLOCKED' } }),
    prisma.productFeedback.groupBy({
      by: ['feedbackKind'],
      where,
      _count: { _all: true },
    }),
    prisma.productFeedback.groupBy({
      by: ['area'],
      where,
      _count: { _all: true },
    }),
    prisma.productFeedback.groupBy({
      by: ['triageStatus'],
      where,
      _count: { _all: true },
    }),
    prisma.productFeedback.groupBy({
      by: ['appVersion'],
      where,
      _count: { _all: true },
    }),
  ]);
  return {
    totals,
    blocking,
    byKind: toBuckets(byKind.map((row) => ({ key: row.feedbackKind, count: row._count._all }))),
    byArea: toBuckets(byArea.map((row) => ({ key: row.area, count: row._count._all }))),
    byStatus: toBuckets(byStatus.map((row) => ({ key: row.triageStatus, count: row._count._all }))),
    byAppVersion: toBuckets(
      byAppVersion.map((row) => ({ key: row.appVersion, count: row._count._all })),
      PRODUCT_FEEDBACK_ADMIN_MIN_SEGMENT,
    ),
  };
}
