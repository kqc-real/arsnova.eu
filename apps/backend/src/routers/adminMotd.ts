/**
 * Admin — MOTD & Vorlagen (Epic 10).
 */
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import type { MotdLocaleBodies } from '@arsnova/shared-types';
import {
  AdminMotdCreateInputSchema,
  AdminMotdDetailDTOSchema,
  AdminMotdIdInputSchema,
  AdminMotdListOutputSchema,
  AdminMotdListItemDTOSchema,
  AdminMotdTemplateCreateInputSchema,
  AdminMotdTemplateDTOSchema,
  AdminMotdTemplateListOutputSchema,
  AdminMotdTemplateUpdateInputSchema,
  AdminMotdUpdateInputSchema,
  MotdLocaleBodiesSchema,
} from '@arsnova/shared-types';
import { createHash } from 'crypto';
import { prisma } from '../db';
import { adminProcedure, router } from '../trpc';

const APP_LOCALES = ['de', 'en', 'fr', 'es', 'it'] as const;

function shortAdminId(token: string | undefined): string | null {
  if (!token) return null;
  return createHash('sha256').update(token, 'utf8').digest('hex').slice(0, 24);
}

async function logMotdAudit(
  action:
    | 'MOTD_CREATE'
    | 'MOTD_UPDATE'
    | 'MOTD_DELETE'
    | 'MOTD_PUBLISH'
    | 'MOTD_ARCHIVE_VISIBILITY'
    | 'MOTD_TEMPLATE_CREATE'
    | 'MOTD_TEMPLATE_UPDATE'
    | 'MOTD_TEMPLATE_DELETE',
  motdId: string,
  adminToken: string | undefined,
  metadata?: Record<string, unknown>,
) {
  await prisma.motdAuditLog.create({
    data: {
      action,
      motdId,
      adminIdentifier: shortAdminId(adminToken),
      metadataJson: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

function rowsToBodies(rows: Array<{ locale: string; markdown: string }>): MotdLocaleBodies {
  const raw: Record<string, string> = { de: '', en: '', fr: '', es: '', it: '' };
  for (const r of rows) {
    if (r.locale in raw) raw[r.locale] = r.markdown;
  }
  return MotdLocaleBodiesSchema.parse(raw);
}

async function replaceMotdLocales(motdId: string, bodies: MotdLocaleBodies) {
  await prisma.motdLocale.deleteMany({ where: { motdId } });
  const data = APP_LOCALES.filter((loc) => bodies[loc].trim().length > 0).map((locale) => ({
    motdId,
    locale,
    markdown: bodies[locale],
  }));
  if (data.length > 0) {
    await prisma.motdLocale.createMany({ data });
  }
}

function toTemplateDto(t: {
  id: string;
  name: string;
  description: string | null;
  markdownDe: string;
  markdownEn: string;
  markdownFr: string;
  markdownEs: string;
  markdownIt: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return AdminMotdTemplateDTOSchema.parse({
    id: t.id,
    name: t.name,
    description: t.description,
    markdownDe: t.markdownDe,
    markdownEn: t.markdownEn,
    markdownFr: t.markdownFr,
    markdownEs: t.markdownEs,
    markdownIt: t.markdownIt,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  });
}

function interactionStatsDto(
  row:
    | {
        ackCount: number;
        thumbUp: number;
        thumbDown: number;
        dismissClose: number;
        dismissSwipe: number;
      }
    | null
    | undefined,
) {
  if (!row) {
    return { ackCount: 0, thumbUp: 0, thumbDown: 0, dismissClose: 0, dismissSwipe: 0 };
  }
  return {
    ackCount: row.ackCount,
    thumbUp: row.thumbUp,
    thumbDown: row.thumbDown,
    dismissClose: row.dismissClose,
    dismissSwipe: row.dismissSwipe,
  };
}

function toMotdListItem(m: {
  id: string;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  priority: number;
  startsAt: Date;
  endsAt: Date;
  visibleInArchive: boolean;
  contentVersion: number;
  templateId: string | null;
  updatedAt: Date;
  interaction: {
    ackCount: number;
    thumbUp: number;
    thumbDown: number;
    dismissClose: number;
    dismissSwipe: number;
  } | null;
}) {
  return AdminMotdListItemDTOSchema.parse({
    id: m.id,
    status: m.status,
    priority: m.priority,
    startsAt: m.startsAt.toISOString(),
    endsAt: m.endsAt.toISOString(),
    visibleInArchive: m.visibleInArchive,
    contentVersion: m.contentVersion,
    templateId: m.templateId,
    updatedAt: m.updatedAt.toISOString(),
    interaction: interactionStatsDto(m.interaction),
  });
}

export const adminMotdRouter = router({
  templateList: adminProcedure.output(AdminMotdTemplateListOutputSchema).query(async () => {
    const rows = await prisma.motdTemplate.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      updatedAt: t.updatedAt.toISOString(),
    }));
  }),

  templateGet: adminProcedure
    .input(AdminMotdIdInputSchema)
    .output(AdminMotdTemplateDTOSchema)
    .query(async ({ input }) => {
      const t = await prisma.motdTemplate.findUnique({ where: { id: input.id } });
      if (!t) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vorlage nicht gefunden.' });
      return toTemplateDto(t);
    }),

  templateCreate: adminProcedure
    .input(AdminMotdTemplateCreateInputSchema)
    .output(AdminMotdTemplateDTOSchema)
    .mutation(async ({ ctx, input }) => {
      const t = await prisma.motdTemplate.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          markdownDe: input.markdownDe,
          markdownEn: input.markdownEn,
          markdownFr: input.markdownFr,
          markdownEs: input.markdownEs,
          markdownIt: input.markdownIt,
        },
      });
      await logMotdAudit('MOTD_TEMPLATE_CREATE', t.id, ctx.adminToken, { templateName: t.name });
      return toTemplateDto(t);
    }),

  templateUpdate: adminProcedure
    .input(AdminMotdTemplateUpdateInputSchema)
    .output(AdminMotdTemplateDTOSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.motdTemplate.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vorlage nicht gefunden.' });
      const t = await prisma.motdTemplate.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.markdownDe !== undefined ? { markdownDe: input.markdownDe } : {}),
          ...(input.markdownEn !== undefined ? { markdownEn: input.markdownEn } : {}),
          ...(input.markdownFr !== undefined ? { markdownFr: input.markdownFr } : {}),
          ...(input.markdownEs !== undefined ? { markdownEs: input.markdownEs } : {}),
          ...(input.markdownIt !== undefined ? { markdownIt: input.markdownIt } : {}),
        },
      });
      await logMotdAudit('MOTD_TEMPLATE_UPDATE', t.id, ctx.adminToken);
      return toTemplateDto(t);
    }),

  templateDelete: adminProcedure
    .input(AdminMotdIdInputSchema)
    .output(z.void())
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.motdTemplate.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vorlage nicht gefunden.' });
      await prisma.motdTemplate.delete({ where: { id: input.id } });
      await logMotdAudit('MOTD_TEMPLATE_DELETE', input.id, ctx.adminToken);
      return undefined;
    }),

  motdList: adminProcedure.output(AdminMotdListOutputSchema).query(async () => {
    const rows = await prisma.motd.findMany({
      orderBy: [{ updatedAt: 'desc' }],
      include: { interaction: true },
    });
    return rows.map(toMotdListItem);
  }),

  motdGet: adminProcedure
    .input(AdminMotdIdInputSchema)
    .output(AdminMotdDetailDTOSchema)
    .query(async ({ input }) => {
      const m = await prisma.motd.findUnique({
        where: { id: input.id },
        include: { locales: true, interaction: true },
      });
      if (!m) throw new TRPCError({ code: 'NOT_FOUND', message: 'MOTD nicht gefunden.' });
      return AdminMotdDetailDTOSchema.parse({
        id: m.id,
        status: m.status,
        priority: m.priority,
        startsAt: m.startsAt.toISOString(),
        endsAt: m.endsAt.toISOString(),
        visibleInArchive: m.visibleInArchive,
        contentVersion: m.contentVersion,
        templateId: m.templateId,
        locales: rowsToBodies(m.locales),
        interaction: interactionStatsDto(m.interaction),
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      });
    }),

  motdCreate: adminProcedure
    .input(AdminMotdCreateInputSchema)
    .output(AdminMotdDetailDTOSchema)
    .mutation(async ({ ctx, input }) => {
      const startsAt = new Date(input.startsAt);
      const endsAt = new Date(input.endsAt);
      if (!(endsAt.getTime() > startsAt.getTime())) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'endsAt muss nach startsAt liegen.' });
      }
      if (input.templateId) {
        const tpl = await prisma.motdTemplate.findUnique({ where: { id: input.templateId } });
        if (!tpl) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Vorlage nicht gefunden.' });
      }
      const m = await prisma.motd.create({
        data: {
          status: input.status,
          priority: input.priority,
          startsAt,
          endsAt,
          visibleInArchive: input.visibleInArchive,
          contentVersion: 1,
          templateId: input.templateId ?? null,
        },
      });
      await replaceMotdLocales(m.id, input.locales);
      await logMotdAudit('MOTD_CREATE', m.id, ctx.adminToken, { status: input.status });
      if (input.status === 'PUBLISHED') {
        await logMotdAudit('MOTD_PUBLISH', m.id, ctx.adminToken);
      }
      const full = await prisma.motd.findUniqueOrThrow({
        where: { id: m.id },
        include: { locales: true, interaction: true },
      });
      return AdminMotdDetailDTOSchema.parse({
        id: full.id,
        status: full.status,
        priority: full.priority,
        startsAt: full.startsAt.toISOString(),
        endsAt: full.endsAt.toISOString(),
        visibleInArchive: full.visibleInArchive,
        contentVersion: full.contentVersion,
        templateId: full.templateId,
        locales: rowsToBodies(full.locales),
        interaction: interactionStatsDto(full.interaction),
        createdAt: full.createdAt.toISOString(),
        updatedAt: full.updatedAt.toISOString(),
      });
    }),

  motdUpdate: adminProcedure
    .input(AdminMotdUpdateInputSchema)
    .output(AdminMotdDetailDTOSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.motd.findUnique({
        where: { id: input.id },
        include: { locales: true },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'MOTD nicht gefunden.' });

      let startsAt = existing.startsAt;
      let endsAt = existing.endsAt;
      if (input.startsAt !== undefined) startsAt = new Date(input.startsAt);
      if (input.endsAt !== undefined) endsAt = new Date(input.endsAt);
      if (!(endsAt.getTime() > startsAt.getTime())) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'endsAt muss nach startsAt liegen.' });
      }

      if (input.templateId !== undefined && input.templateId !== null) {
        const tpl = await prisma.motdTemplate.findUnique({ where: { id: input.templateId } });
        if (!tpl) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Vorlage nicht gefunden.' });
      }

      let contentVersion = existing.contentVersion;
      const nextLocales = input.locales;
      const oldBodies = rowsToBodies(existing.locales);
      const localeChanged =
        nextLocales !== undefined && APP_LOCALES.some((loc) => oldBodies[loc] !== nextLocales[loc]);
      const scheduleChanged =
        startsAt.getTime() !== existing.startsAt.getTime() ||
        endsAt.getTime() !== existing.endsAt.getTime();
      const priorityChanged = input.priority !== undefined && input.priority !== existing.priority;
      if (localeChanged || scheduleChanged || priorityChanged) {
        contentVersion = existing.contentVersion + 1;
      }

      const prevPublished = existing.status === 'PUBLISHED';
      const nextStatus = input.status ?? existing.status;
      const nextArchive = input.visibleInArchive ?? existing.visibleInArchive;

      const m = await prisma.motd.update({
        where: { id: input.id },
        data: {
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.priority !== undefined ? { priority: input.priority } : {}),
          startsAt,
          endsAt,
          ...(input.visibleInArchive !== undefined
            ? { visibleInArchive: input.visibleInArchive }
            : {}),
          ...(input.templateId !== undefined ? { templateId: input.templateId } : {}),
          contentVersion,
        },
      });

      if (nextLocales !== undefined) {
        await replaceMotdLocales(m.id, nextLocales);
      }

      await logMotdAudit('MOTD_UPDATE', m.id, ctx.adminToken);
      if (!prevPublished && nextStatus === 'PUBLISHED') {
        await logMotdAudit('MOTD_PUBLISH', m.id, ctx.adminToken);
      }
      if (input.visibleInArchive !== undefined && nextArchive !== existing.visibleInArchive) {
        await logMotdAudit('MOTD_ARCHIVE_VISIBILITY', m.id, ctx.adminToken, {
          visibleInArchive: nextArchive,
        });
      }

      const full = await prisma.motd.findUniqueOrThrow({
        where: { id: m.id },
        include: { locales: true, interaction: true },
      });
      return AdminMotdDetailDTOSchema.parse({
        id: full.id,
        status: full.status,
        priority: full.priority,
        startsAt: full.startsAt.toISOString(),
        endsAt: full.endsAt.toISOString(),
        visibleInArchive: full.visibleInArchive,
        contentVersion: full.contentVersion,
        templateId: full.templateId,
        locales: rowsToBodies(full.locales),
        interaction: interactionStatsDto(full.interaction),
        createdAt: full.createdAt.toISOString(),
        updatedAt: full.updatedAt.toISOString(),
      });
    }),

  motdDelete: adminProcedure
    .input(AdminMotdIdInputSchema)
    .output(z.void())
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.motd.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'MOTD nicht gefunden.' });
      await prisma.motd.delete({ where: { id: input.id } });
      await logMotdAudit('MOTD_DELETE', input.id, ctx.adminToken);
      return undefined;
    }),
});
