/** Admin — ProductFeedback-Statistik und Triage (Epic 12). */
import { createHash } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import {
  AdminProductFeedbackByIdInputSchema,
  AdminProductFeedbackDetailSchema,
  AdminProductFeedbackIssueDraftOutputSchema,
  AdminProductFeedbackLinkDuplicateInputSchema,
  AdminProductFeedbackLinkIssueInputSchema,
  AdminProductFeedbackListInputSchema,
  AdminProductFeedbackListOutputSchema,
  AdminProductFeedbackLlmExportInputSchema,
  AdminProductFeedbackLlmExportOutputSchema,
  AdminProductFeedbackMutationOutputSchema,
  AdminProductFeedbackPurgeInputSchema,
  AdminProductFeedbackPurgeOutputSchema,
  AdminProductFeedbackPurgePreviewInputSchema,
  AdminProductFeedbackPurgePreviewOutputSchema,
  AdminProductFeedbackPublishIssueInputSchema,
  AdminProductFeedbackPublishIssueOutputSchema,
  AdminProductFeedbackStatsDTOSchema,
  AdminProductFeedbackStatsInputSchema,
  AdminProductFeedbackTriageStatsDTOSchema,
  AdminProductFeedbackTriageStatsInputSchema,
  AdminProductFeedbackUpdateTriageInputSchema,
  PRODUCT_FEEDBACK_LLM_EXPORT_MAX_SCAN,
  PRODUCT_FEEDBACK_PURGE_CONFIRMATION,
  type AdminProductFeedbackDetail,
  type AdminProductFeedbackIssueDraftOutput,
  type AdminProductFeedbackListItem,
  type AdminProductFeedbackLlmExportInput,
} from '@arsnova/shared-types';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { getRedis } from '../redis';
import {
  buildProductFeedbackAdminStats,
  buildProductFeedbackTriageStats,
} from '../lib/productFeedbackStats';
import { productFeedbackLabel } from '../lib/productFeedbackLabels';
import {
  buildProductFeedbackLlmExport,
  type ProductFeedbackLlmExportRow,
} from '../lib/productFeedbackLlmExport';
import { productFeedbackPurgeWhere } from '../lib/productFeedbackPurge';
import { adminProcedure, router } from '../trpc';

type FeedbackRow = Prisma.ProductFeedbackGetPayload<{
  include: { _count: { select: { duplicates: true } } };
}>;

function adminIdentifier(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex').slice(0, 16);
}

function toListItem(row: FeedbackRow): AdminProductFeedbackListItem {
  return {
    id: row.id,
    source: row.source,
    role: row.role,
    kind: row.feedbackKind as AdminProductFeedbackListItem['kind'],
    primaryAnswer: row.primaryAnswer,
    area: row.area,
    impact: row.impact as AdminProductFeedbackListItem['impact'],
    locale: row.locale as AdminProductFeedbackListItem['locale'],
    appVersion: row.appVersion,
    routeGroup: row.routeGroup as AdminProductFeedbackListItem['routeGroup'],
    status: row.triageStatus,
    quarantineStatus: row.quarantineStatus,
    duplicateOfId: row.duplicateOfId,
    duplicateCount: row._count.duplicates,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDetail(row: FeedbackRow): AdminProductFeedbackDetail {
  return {
    ...toListItem(row),
    message: row.message,
    sessionPhase: row.sessionPhase as AdminProductFeedbackDetail['sessionPhase'],
    activeChannel: row.activeChannel as AdminProductFeedbackDetail['activeChannel'],
    deviceClass: row.deviceClass as AdminProductFeedbackDetail['deviceClass'],
    browserFamily: row.browserFamily as AdminProductFeedbackDetail['browserFamily'],
    browserMajorVersion: row.browserMajorVersion,
    osFamily: row.osFamily as AdminProductFeedbackDetail['osFamily'],
    onlineState: row.onlineState as AdminProductFeedbackDetail['onlineState'],
    errorRequestId: row.errorRequestId,
    githubIssueNumber: row.githubIssueNumber,
    githubIssueUrl: row.githubIssueUrl,
    resolvedInVersion: row.resolvedInVersion,
    publicResolutionUrl: row.publicResolutionUrl,
  };
}

function buildIssueDraft(row: FeedbackRow): AdminProductFeedbackIssueDraftOutput {
  const signal =
    productFeedbackLabel(row.feedbackKind ?? row.primaryAnswer) ?? 'Allgemeine Rückmeldung';
  const area = productFeedbackLabel(row.area) ?? row.area;
  const title = `[Feedback] ${signal} – ${area}`.slice(0, 160);
  const lines = [
    '## Anonymisierte Rückmeldung',
    '',
    `- Art: ${signal}`,
    `- Bereich: ${area}`,
    `- Perspektive: ${productFeedbackLabel(row.role)}`,
    `- Quelle: ${productFeedbackLabel(row.source)}`,
    row.impact ? `- Auswirkung: ${productFeedbackLabel(row.impact)}` : null,
    row.appVersion ? `- App-Version: ${row.appVersion}` : null,
    row.routeGroup ? `- App-Bereich: ${productFeedbackLabel(row.routeGroup)}` : null,
    row.deviceClass ? `- Gerät: ${productFeedbackLabel(row.deviceClass)}` : null,
    '',
    '_Der freiwillige Originaltext ist aus Datenschutzgründen nicht enthalten._',
  ].filter((line): line is string => line !== null);
  return { title, body: lines.join('\n') };
}

const GITHUB_PUBLISH_LOCK_PREFIX = 'productFeedback:githubPublish:v1:';
const GITHUB_PUBLISH_LOCK_TTL_SECONDS = 120;

async function reserveGithubPublish(id: string): Promise<boolean> {
  return (
    (await getRedis().set(
      `${GITHUB_PUBLISH_LOCK_PREFIX}${id}`,
      '1',
      'EX',
      GITHUB_PUBLISH_LOCK_TTL_SECONDS,
      'NX',
    )) === 'OK'
  );
}

async function releaseGithubPublish(id: string): Promise<void> {
  await getRedis().del(`${GITHUB_PUBLISH_LOCK_PREFIX}${id}`);
}

function publishedIssueFromRow(row: FeedbackRow): { issueNumber: number; issueUrl: string } | null {
  if (
    typeof row.githubIssueNumber === 'number' &&
    Number.isSafeInteger(row.githubIssueNumber) &&
    row.githubIssueNumber > 0 &&
    typeof row.githubIssueUrl === 'string' &&
    row.githubIssueUrl.startsWith('https://github.com/')
  ) {
    return { issueNumber: row.githubIssueNumber, issueUrl: row.githubIssueUrl };
  }
  return null;
}

async function getFeedbackRow(id: string): Promise<FeedbackRow> {
  const row = await prisma.productFeedback.findUnique({
    where: { id },
    include: { _count: { select: { duplicates: true } } },
  });
  if (!row) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Rückmeldung nicht gefunden.' });
  }
  return row;
}

function buildAdminFeedbackWhere(
  input: Pick<
    AdminProductFeedbackLlmExportInput,
    | 'from'
    | 'to'
    | 'source'
    | 'role'
    | 'kind'
    | 'area'
    | 'impact'
    | 'appVersion'
    | 'locale'
    | 'status'
    | 'excludeDiscarded'
  >,
): Prisma.ProductFeedbackWhereInput {
  if (input.excludeDiscarded && input.status === 'DISCARDED') {
    return { id: { in: [] } };
  }
  return {
    duplicateOfId: null,
    ...(input.from || input.to
      ? {
          createdAt: {
            ...(input.from ? { gte: new Date(input.from) } : {}),
            ...(input.to ? { lte: new Date(input.to) } : {}),
          },
        }
      : {}),
    ...(input.source ? { source: input.source } : {}),
    ...(input.role ? { role: input.role } : {}),
    ...(input.kind ? { feedbackKind: input.kind } : {}),
    ...(input.area ? { area: input.area } : {}),
    ...(input.impact ? { impact: input.impact } : {}),
    ...(input.appVersion ? { appVersion: input.appVersion } : {}),
    ...(input.locale ? { locale: input.locale } : {}),
    ...(input.status
      ? { triageStatus: input.status }
      : input.excludeDiscarded
        ? { triageStatus: { not: 'DISCARDED' } }
        : {}),
  };
}

function toLlmExportRow(row: FeedbackRow): ProductFeedbackLlmExportRow {
  return {
    id: row.id,
    createdAt: row.createdAt,
    duplicateOfId: row.duplicateOfId,
    duplicateCount: row._count.duplicates,
    source: row.source,
    role: row.role,
    kind: row.feedbackKind,
    primaryAnswer: row.primaryAnswer,
    area: row.area,
    impact: row.impact,
    locale: row.locale,
    deviceClass: row.deviceClass,
    sessionPhase: row.sessionPhase,
    activeChannel: row.activeChannel,
    appVersion: row.appVersion,
    message: row.message,
    quarantineStatus: row.quarantineStatus,
    triageStatus: row.triageStatus,
  };
}

export const adminProductFeedbackRouter = router({
  getStats: adminProcedure
    .input(AdminProductFeedbackStatsInputSchema)
    .output(AdminProductFeedbackStatsDTOSchema)
    .query(async ({ input }) => buildProductFeedbackAdminStats(input)),

  getTriageStats: adminProcedure
    .input(AdminProductFeedbackTriageStatsInputSchema)
    .output(AdminProductFeedbackTriageStatsDTOSchema)
    .query(async ({ input }) => buildProductFeedbackTriageStats(input)),

  exportForLlm: adminProcedure
    .input(AdminProductFeedbackLlmExportInputSchema)
    .output(AdminProductFeedbackLlmExportOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const where = buildAdminFeedbackWhere(input);
      const [rows, canonicalTotal, stats, triage] = await Promise.all([
        prisma.productFeedback.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: PRODUCT_FEEDBACK_LLM_EXPORT_MAX_SCAN,
          include: { _count: { select: { duplicates: true } } },
        }),
        prisma.productFeedback.count({ where }),
        buildProductFeedbackAdminStats(
          {
            ...(input.from ? { from: input.from } : {}),
            ...(input.to ? { to: input.to } : {}),
            ...(input.role ? { role: input.role } : {}),
          },
          where,
        ),
        buildProductFeedbackTriageStats(
          {
            ...(input.from ? { from: input.from } : {}),
            ...(input.to ? { to: input.to } : {}),
            ...(input.appVersion ? { appVersion: input.appVersion } : {}),
          },
          where,
        ),
      ]);
      const output = buildProductFeedbackLlmExport({
        rows: rows.map(toLlmExportRow),
        stats,
        triage,
        input,
        canonicalTotal,
      });
      await prisma.productFeedbackExportLog.create({
        data: {
          adminIdentifier: adminIdentifier(ctx.adminToken),
          includeMessages: output.includeMessages,
          excludeDiscarded: input.excludeDiscarded,
          caseCount: output.caseCount,
          clusterCount: output.clusterCount,
          messageCount: output.messageCount,
          truncated: output.truncated,
          filterJson: JSON.stringify({
            from: input.from ?? null,
            to: input.to ?? null,
            source: input.source ?? null,
            role: input.role ?? null,
            kind: input.kind ?? null,
            area: input.area ?? null,
            impact: input.impact ?? null,
            appVersion: input.appVersion ?? null,
            locale: input.locale ?? null,
            status: input.status ?? null,
            includeMessages: input.includeMessages,
            excludeDiscarded: input.excludeDiscarded,
          }).slice(0, 1000),
        },
      });
      return output;
    }),

  /** Paginierte Inbox; optionale Freitexte werden erst im Detail geladen. */
  list: adminProcedure
    .input(AdminProductFeedbackListInputSchema)
    .output(AdminProductFeedbackListOutputSchema)
    .query(async ({ input }) => {
      const where: Prisma.ProductFeedbackWhereInput = {
        ...(input.from || input.to
          ? {
              createdAt: {
                ...(input.from ? { gte: new Date(input.from) } : {}),
                ...(input.to ? { lte: new Date(input.to) } : {}),
              },
            }
          : {}),
        ...(input.source ? { source: input.source } : {}),
        ...(input.role ? { role: input.role } : {}),
        ...(input.kind ? { feedbackKind: input.kind } : {}),
        ...(input.area ? { area: input.area } : {}),
        ...(input.impact ? { impact: input.impact } : {}),
        ...(input.appVersion ? { appVersion: input.appVersion } : {}),
        ...(input.locale ? { locale: input.locale } : {}),
        ...(input.status ? { triageStatus: input.status } : {}),
      };
      const rows = await prisma.productFeedback.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: { _count: { select: { duplicates: true } } },
      });
      const hasMore = rows.length > input.limit;
      const page = hasMore ? rows.slice(0, input.limit) : rows;
      return {
        items: page.map(toListItem),
        nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
      };
    }),

  getDetail: adminProcedure
    .input(AdminProductFeedbackByIdInputSchema)
    .output(AdminProductFeedbackDetailSchema)
    .query(async ({ input }) => toDetail(await getFeedbackRow(input.id))),

  updateTriage: adminProcedure
    .input(AdminProductFeedbackUpdateTriageInputSchema)
    .output(AdminProductFeedbackMutationOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const current = await getFeedbackRow(input.id);
      await prisma.$transaction([
        prisma.productFeedback.update({
          where: { id: input.id },
          data: {
            triageStatus: input.status,
            ...(input.resolvedInVersion !== undefined
              ? { resolvedInVersion: input.resolvedInVersion }
              : {}),
            ...(input.publicResolutionUrl !== undefined
              ? { publicResolutionUrl: input.publicResolutionUrl }
              : {}),
          },
        }),
        prisma.productFeedbackAuditLog.create({
          data: {
            productFeedbackId: input.id,
            action:
              input.resolvedInVersion !== undefined || input.publicResolutionUrl !== undefined
                ? 'RESOLUTION_LINKED'
                : 'STATUS_CHANGED',
            adminIdentifier: adminIdentifier(ctx.adminToken),
            fromStatus: current.triageStatus,
            toStatus: input.status,
          },
        }),
      ]);
      return { ok: true };
    }),

  linkDuplicate: adminProcedure
    .input(AdminProductFeedbackLinkDuplicateInputSchema)
    .output(AdminProductFeedbackMutationOutputSchema)
    .mutation(async ({ input, ctx }) => {
      if (input.duplicateOfId) {
        const target = await getFeedbackRow(input.duplicateOfId);
        if (target.duplicateOfId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Duplikate müssen direkt auf einen Hauptdatensatz verweisen.',
          });
        }
      }
      await prisma.$transaction([
        prisma.productFeedback.update({
          where: { id: input.id },
          data: { duplicateOfId: input.duplicateOfId },
        }),
        prisma.productFeedbackAuditLog.create({
          data: {
            productFeedbackId: input.id,
            action: 'DUPLICATE_LINKED',
            adminIdentifier: adminIdentifier(ctx.adminToken),
            relatedFeedbackId: input.duplicateOfId,
          },
        }),
      ]);
      return { ok: true };
    }),

  createIssueDraft: adminProcedure
    .input(AdminProductFeedbackByIdInputSchema)
    .output(AdminProductFeedbackIssueDraftOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const row = await getFeedbackRow(input.id);
      const draft = buildIssueDraft(row);
      await prisma.productFeedbackAuditLog.create({
        data: {
          productFeedbackId: input.id,
          action: 'ISSUE_DRAFTED',
          adminIdentifier: adminIdentifier(ctx.adminToken),
        },
      });
      return draft;
    }),

  linkIssue: adminProcedure
    .input(AdminProductFeedbackLinkIssueInputSchema)
    .output(AdminProductFeedbackMutationOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const url = new URL(input.issueUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'github.com') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Es sind ausschließlich HTTPS-Links zu GitHub-Issues zulässig.',
        });
      }
      await prisma.$transaction([
        prisma.productFeedback.update({
          where: { id: input.id },
          data: { githubIssueNumber: input.issueNumber, githubIssueUrl: input.issueUrl },
        }),
        prisma.productFeedbackAuditLog.create({
          data: {
            productFeedbackId: input.id,
            action: 'ISSUE_LINKED',
            adminIdentifier: adminIdentifier(ctx.adminToken),
            issueNumber: input.issueNumber,
          },
        }),
      ]);
      return { ok: true };
    }),

  publishIssue: adminProcedure
    .input(AdminProductFeedbackPublishIssueInputSchema)
    .output(AdminProductFeedbackPublishIssueOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const repository = process.env['PRODUCT_FEEDBACK_GITHUB_REPOSITORY']?.trim();
      const token = process.env['PRODUCT_FEEDBACK_GITHUB_TOKEN']?.trim();
      if (!repository || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || !token) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'GitHub-Veröffentlichung ist nicht konfiguriert.',
        });
      }
      const row = await getFeedbackRow(input.id);
      const alreadyPublished = publishedIssueFromRow(row);
      if (alreadyPublished) return alreadyPublished;
      const reserved = await reserveGithubPublish(input.id);
      if (!reserved) {
        const latest = publishedIssueFromRow(await getFeedbackRow(input.id));
        if (latest) return latest;
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Die Veröffentlichung läuft bereits.',
        });
      }
      const draft = buildIssueDraft(row);
      try {
        const response = await fetch(`https://api.github.com/repos/${repository}/issues`, {
          method: 'POST',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: JSON.stringify(draft),
        });
        if (!response.ok) {
          throw new TRPCError({
            code: 'BAD_GATEWAY',
            message: 'GitHub-Issue konnte nicht veröffentlicht werden.',
          });
        }
        const published = (await response.json()) as { number?: number; html_url?: string };
        if (
          !Number.isSafeInteger(published.number) ||
          typeof published.html_url !== 'string' ||
          !published.html_url.startsWith('https://github.com/')
        ) {
          throw new TRPCError({
            code: 'BAD_GATEWAY',
            message: 'GitHub hat eine ungültige Issue-Antwort geliefert.',
          });
        }
        const issueNumber = published.number as number;
        const issueUrl = published.html_url;
        await prisma.$transaction([
          prisma.productFeedback.update({
            where: { id: input.id },
            data: { githubIssueNumber: issueNumber, githubIssueUrl: issueUrl },
          }),
          prisma.productFeedbackAuditLog.create({
            data: {
              productFeedbackId: input.id,
              action: 'ISSUE_LINKED',
              adminIdentifier: adminIdentifier(ctx.adminToken),
              issueNumber,
            },
          }),
        ]);
        return { issueNumber, issueUrl };
      } finally {
        await releaseGithubPublish(input.id);
      }
    }),

  clearQuarantine: adminProcedure
    .input(AdminProductFeedbackByIdInputSchema)
    .output(AdminProductFeedbackMutationOutputSchema)
    .mutation(async ({ input, ctx }) => {
      await prisma.$transaction([
        prisma.productFeedback.update({
          where: { id: input.id },
          data: { quarantineStatus: 'CLEARED' },
        }),
        prisma.productFeedbackAuditLog.create({
          data: {
            productFeedbackId: input.id,
            action: 'QUARANTINE_CLEARED',
            adminIdentifier: adminIdentifier(ctx.adminToken),
          },
        }),
      ]);
      return { ok: true };
    }),

  delete: adminProcedure
    .input(AdminProductFeedbackByIdInputSchema)
    .output(AdminProductFeedbackMutationOutputSchema)
    .mutation(async ({ input, ctx }) => {
      await getFeedbackRow(input.id);
      await prisma.$transaction([
        prisma.productFeedbackAuditLog.create({
          data: {
            productFeedbackId: input.id,
            action: 'DELETED',
            adminIdentifier: adminIdentifier(ctx.adminToken),
          },
        }),
        prisma.productFeedback.delete({ where: { id: input.id } }),
      ]);
      return { ok: true };
    }),

  countForPurge: adminProcedure
    .input(AdminProductFeedbackPurgePreviewInputSchema)
    .output(AdminProductFeedbackPurgePreviewOutputSchema)
    .query(async ({ input }) => {
      const count = await prisma.productFeedback.count({
        where: productFeedbackPurgeWhere(input),
      });
      return { count, scope: input.scope };
    }),

  purge: adminProcedure
    .input(AdminProductFeedbackPurgeInputSchema)
    .output(AdminProductFeedbackPurgeOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const normalizedConfirmation = input.confirmationText.trim().toUpperCase();
      if (normalizedConfirmation !== PRODUCT_FEEDBACK_PURGE_CONFIRMATION) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Sicherheitsabfrage fehlgeschlagen.',
        });
      }

      const where = productFeedbackPurgeWhere(input);
      return prisma.$transaction(async (tx) => {
        const currentCount = await tx.productFeedback.count({ where });
        if (currentCount !== input.expectedCount) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Die Auswahl hat sich geändert. Bitte neu zählen und erneut bestätigen.',
          });
        }

        const deleted = await tx.productFeedback.deleteMany({ where });
        if (deleted.count !== input.expectedCount) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Die Auswahl hat sich geändert. Bitte neu zählen und erneut bestätigen.',
          });
        }
        await tx.productFeedbackPurgeLog.create({
          data: {
            adminIdentifier: adminIdentifier(ctx.adminToken),
            scope: input.scope,
            untilCreatedAt: input.scope === 'UNTIL' ? new Date(input.until) : null,
            deletedCount: deleted.count,
          },
        });
        return { deletedCount: deleted.count, scope: input.scope };
      });
    }),
});
