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
  AdminProductFeedbackMutationOutputSchema,
  AdminProductFeedbackPublishIssueInputSchema,
  AdminProductFeedbackPublishIssueOutputSchema,
  AdminProductFeedbackStatsDTOSchema,
  AdminProductFeedbackStatsInputSchema,
  AdminProductFeedbackTriageStatsDTOSchema,
  AdminProductFeedbackTriageStatsInputSchema,
  AdminProductFeedbackUpdateTriageInputSchema,
  type AdminProductFeedbackDetail,
  type AdminProductFeedbackIssueDraftOutput,
  type AdminProductFeedbackListItem,
} from '@arsnova/shared-types';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import {
  buildProductFeedbackAdminStats,
  buildProductFeedbackTriageStats,
} from '../lib/productFeedbackStats';
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
  const labels: Record<string, string> = {
    NOT_WORKING: 'Funktioniert nicht',
    UNCLEAR: 'Unklar',
    MISSING_FEATURE: 'Fehlende Funktion',
    PRAISE: 'Positives Feedback',
    EASY: 'Leicht',
    MINOR_FRICTION: 'Mit kleinen Hürden',
    HARD: 'Schwierig',
    YES: 'Ja',
    PARTIAL: 'Teilweise',
    NO: 'Nein',
    HOST: 'Host',
    PARTICIPANT: 'Teilnehmende',
    GENERAL: 'Allgemein',
    POST_SESSION: 'Nach der Session',
    IN_APP: 'In der App',
    CONTINUED: 'Weiterarbeit war möglich',
    RETRIED: 'Erneuter Versuch war nötig',
    BLOCKED: 'Aufgabe konnte nicht abgeschlossen werden',
    JOIN: 'Sessionbeitritt',
    ORIENTATION: 'Orientierung',
    ANSWER: 'Antwortabgabe',
    QA_OR_QUICKFEEDBACK: 'Q&A oder Blitzlicht',
    RESULTS: 'Ergebnisse',
    TECH: 'Technik oder Verbindung',
    ACCESSIBILITY: 'Barrierefreiheit',
    OTHER: 'Anderer Bereich',
    PREPARE_QUIZ: 'Quizvorbereitung',
    START_SESSION: 'Sessionstart',
    INVITE: 'Einladung',
    LIVE_CONTROL: 'Live-Steuerung',
    PDF_EXPORT: 'PDF oder Export',
    QUIZ_OR_ANSWER: 'Quizfrage oder Antwort',
    QA: 'Q&A',
    QUICK_FEEDBACK: 'Blitzlicht',
    RESULTS_OR_SCORE: 'Ergebnis oder Punkte',
    DISPLAY_OR_ACCESSIBILITY: 'Darstellung oder Barrierefreiheit',
    TECH_OR_CONNECTION: 'Technik oder Verbindung',
    QUIZ_LIBRARY_OR_EDITOR: 'Quiz-Sammlung oder Editor',
    SESSION_START_OR_INVITE: 'Sessionstart und Einladung',
    PDF_OR_EXPORT: 'PDF oder Export',
    HOME_OR_ORIENTATION: 'Start und Orientierung',
    HELP: 'Hilfe',
    HOME: 'Startseite',
    QUIZ_LIBRARY: 'Quiz-Sammlung',
    QUIZ_EDITOR: 'Quiz-Editor',
    SESSION_JOIN: 'Sessionbeitritt',
    SESSION_VOTE: 'Teilnahme',
    SESSION_HOST: 'Sessionsteuerung',
    SESSION_RESULTS: 'Ergebnisse',
    PHONE: 'Smartphone',
    TABLET: 'Tablet',
    DESKTOP: 'Computer',
    UNKNOWN: 'Nicht erkannt',
  };
  const label = (value: string | null) => (value ? (labels[value] ?? value) : null);
  const signal = label(row.feedbackKind ?? row.primaryAnswer) ?? 'Allgemeine Rückmeldung';
  const area = label(row.area) ?? row.area;
  const title = `[Feedback] ${signal} – ${area}`.slice(0, 160);
  const lines = [
    '## Anonymisierte Rückmeldung',
    '',
    `- Art: ${signal}`,
    `- Bereich: ${area}`,
    `- Perspektive: ${label(row.role)}`,
    `- Quelle: ${label(row.source)}`,
    row.impact ? `- Auswirkung: ${label(row.impact)}` : null,
    row.appVersion ? `- App-Version: ${row.appVersion}` : null,
    row.routeGroup ? `- App-Bereich: ${label(row.routeGroup)}` : null,
    row.deviceClass ? `- Gerät: ${label(row.deviceClass)}` : null,
    '',
    '_Der freiwillige Originaltext ist aus Datenschutzgründen nicht enthalten._',
  ].filter((line): line is string => line !== null);
  return { title, body: lines.join('\n') };
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

export const adminProductFeedbackRouter = router({
  getStats: adminProcedure
    .input(AdminProductFeedbackStatsInputSchema)
    .output(AdminProductFeedbackStatsDTOSchema)
    .query(async ({ input }) => buildProductFeedbackAdminStats(input)),

  getTriageStats: adminProcedure
    .input(AdminProductFeedbackTriageStatsInputSchema)
    .output(AdminProductFeedbackTriageStatsDTOSchema)
    .query(async ({ input }) => buildProductFeedbackTriageStats(input)),

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
      const draft = buildIssueDraft(row);
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
});
