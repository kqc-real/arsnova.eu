/**
 * MOTD — öffentliche Lesepfade (Epic 10).
 */
import { TRPCError } from '@trpc/server';
import type { Prisma } from '@prisma/client';
import type { AppLocale, MotdPublicDTO } from '@arsnova/shared-types';
import {
  MotdGetCurrentInputSchema,
  MotdGetCurrentOutputSchema,
  MotdHeaderStateInputSchema,
  MotdHeaderStateOutputSchema,
  MotdListArchiveInputSchema,
  MotdListArchiveOutputSchema,
  MotdRecordInteractionInputSchema,
  MotdRecordInteractionOutputSchema,
} from '@arsnova/shared-types';
import { prisma } from '../db';
import { localesToMap, resolveMotdMarkdown } from '../lib/motdMarkdown';
import {
  checkMotdGetCurrentRate,
  checkMotdListArchiveRate,
  checkMotdRecordInteractionRate,
} from '../lib/rateLimit';
import { getClientIp, publicProcedure, router } from '../trpc';

/**
 * Obergrenze gleichzeitig aktiver PUBLISHED-MOTDs für die Overlay-Auswahl (Sortierung im Speicher).
 * 32 reicht für übliche Deployments; höhere Werte erhöhen nur DB-Payload ohne Nutzen.
 */
const MOTD_ACTIVE_FETCH_CAP = 32;

/**
 * Feste ID der dauerhaften Willkommens-MOTD (Migration `motd_welcome_message` + `seed-dev-motd.mjs`).
 * Alte Seeds nutzten oft priority 100 — ohne effectiveOverlayPriority würde sie Admin-Meldungen überlagern.
 */
const DEV_SEED_MOTD_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

/** Effektive Priorität: Willkommens-MOTD rangiert unter jeder eigenen Meldung mit priority ≥ 0. */
function effectiveOverlayPriority(id: string, priority: number): number {
  if (id === DEV_SEED_MOTD_ID) return Math.min(priority, 0) - 1;
  return priority;
}

/**
 * Nutzer-Archiv: freigegeben (`visibleInArchive`) und entweder bereits beendet oder
 * aktuell als PUBLISHED im Zeitfenster — damit die Liste nicht leer bleibt, solange die Meldung noch läuft.
 */
function motdArchiveListWhere(now: Date): Prisma.MotdWhereInput {
  return {
    visibleInArchive: true,
    status: { not: 'DRAFT' },
    OR: [
      { endsAt: { lt: now } },
      {
        AND: [{ status: 'PUBLISHED' }, { startsAt: { lte: now } }, { endsAt: { gt: now } }],
      },
    ],
  };
}

async function fetchCurrentMotdDto(locale: AppLocale, at: Date): Promise<MotdPublicDTO | null> {
  const rows = await prisma.motd.findMany({
    where: {
      status: 'PUBLISHED',
      startsAt: { lte: at },
      endsAt: { gt: at },
    },
    take: MOTD_ACTIVE_FETCH_CAP,
    include: { locales: true },
  });
  rows.sort((a, b) => {
    const pa = effectiveOverlayPriority(a.id, a.priority);
    const pb = effectiveOverlayPriority(b.id, b.priority);
    if (pb !== pa) return pb - pa;
    return b.startsAt.getTime() - a.startsAt.getTime();
  });
  for (const row of rows) {
    const map = localesToMap(row.locales);
    const markdown = resolveMotdMarkdown(map, locale);
    if (!markdown.trim()) continue;
    return {
      id: row.id,
      contentVersion: row.contentVersion,
      markdown,
      endsAt: row.endsAt.toISOString(),
    };
  }
  return null;
}

export const motdRouter = router({
  /**
   * Liefert höchstens eine aktive Overlay-MOTD (PUBLISHED, Zeitfenster, Priorität).
   * Rate-Limit: gleicher Schlüssel wie `getHeaderState` (`checkMotdGetCurrentRate`).
   */
  getCurrent: publicProcedure
    .input(MotdGetCurrentInputSchema)
    .output(MotdGetCurrentOutputSchema)
    .query(async ({ ctx, input }) => {
      const ip = getClientIp(ctx);
      const limit = await checkMotdGetCurrentRate(ip);
      if (!limit.allowed) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Zu viele Anfragen. Bitte kurz warten.',
          cause: { retryAfterSeconds: limit.retryAfterSeconds },
        });
      }
      const motd = await fetchCurrentMotdDto(input.locale, new Date());
      return { motd };
    }),

  /**
   * Archivliste (nur `visibleInArchive`, nicht DRAFT); sortiert nach `endsAt` absteigend.
   * Optional `cursor` (letzte MOTD-`id` der vorherigen Seite) für Pagination.
   */
  listArchive: publicProcedure
    .input(MotdListArchiveInputSchema)
    .output(MotdListArchiveOutputSchema)
    .query(async ({ ctx, input }) => {
      const ip = getClientIp(ctx);
      const limit = await checkMotdListArchiveRate(ip);
      if (!limit.allowed) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Zu viele Anfragen. Bitte kurz warten.',
          cause: { retryAfterSeconds: limit.retryAfterSeconds },
        });
      }
      const now = new Date();
      const take = input.pageSize;

      const baseWhere = motdArchiveListWhere(now);

      let where: Prisma.MotdWhereInput = baseWhere;
      if (input.cursor) {
        const c = await prisma.motd.findUnique({ where: { id: input.cursor } });
        if (c) {
          where = {
            AND: [
              baseWhere,
              {
                OR: [
                  { endsAt: { lt: c.endsAt } },
                  { AND: [{ endsAt: c.endsAt }, { id: { lt: c.id } }] },
                ],
              },
            ],
          };
        }
      }

      const motds = await prisma.motd.findMany({
        where,
        orderBy: [{ endsAt: 'desc' }, { id: 'desc' }],
        take: take + 1,
        include: { locales: true },
      });

      const page = motds.slice(0, take);
      const hasMore = motds.length > take;
      const nextCursor = hasMore && page.length > 0 ? page[page.length - 1]!.id : null;

      const items = page
        .map((m) => {
          const map = localesToMap(m.locales);
          const markdown = resolveMotdMarkdown(map, input.locale);
          if (!markdown.trim()) return null;
          return {
            id: m.id,
            contentVersion: m.contentVersion,
            markdown,
            endsAt: m.endsAt.toISOString(),
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      return { items, nextCursor };
    }),

  /**
   * Toolbar/Header: aktives Overlay?, Archiv-Anzahl, `archiveMaxEndsAtIso`, ungelesen relativ zu `archiveSeenUpToEndsAtIso`.
   */
  getHeaderState: publicProcedure
    .input(MotdHeaderStateInputSchema)
    .output(MotdHeaderStateOutputSchema)
    .query(async ({ ctx, input }) => {
      const ip = getClientIp(ctx);
      const limit = await checkMotdGetCurrentRate(ip);
      if (!limit.allowed) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Zu viele Anfragen. Bitte kurz warten.',
          cause: { retryAfterSeconds: limit.retryAfterSeconds },
        });
      }
      const now = new Date();
      const archiveWhere = motdArchiveListWhere(now);
      const seenRaw = input.archiveSeenUpToEndsAtIso;
      const seen = seenRaw && !Number.isNaN(new Date(seenRaw).getTime()) ? new Date(seenRaw) : null;

      const results = seen
        ? await Promise.all([
            fetchCurrentMotdDto(input.locale, now),
            prisma.motd.count({ where: archiveWhere }),
            prisma.motd.aggregate({
              where: archiveWhere,
              _max: { endsAt: true },
            }),
            prisma.motd.count({
              where: { AND: [archiveWhere, { endsAt: { gt: seen } }] },
            }),
          ])
        : await Promise.all([
            fetchCurrentMotdDto(input.locale, now),
            prisma.motd.count({ where: archiveWhere }),
            prisma.motd.aggregate({
              where: archiveWhere,
              _max: { endsAt: true },
            }),
          ]);

      const motd = results[0];
      const archiveCount = results[1];
      const agg = results[2];
      const archiveMaxEndsAtIso = agg._max.endsAt?.toISOString() ?? null;
      const archiveUnreadCount = seen ? results[3]! : archiveCount;

      return {
        hasActiveOverlay: motd !== null,
        hasArchiveEntries: archiveCount > 0,
        archiveCount,
        archiveMaxEndsAtIso,
        archiveUnreadCount,
      };
    }),

  /**
   * Aggregiert Nutzerinteraktionen (ACK, Daumen, Dismiss-Typen); streng rate-limited, keine PII.
   */
  recordInteraction: publicProcedure
    .input(MotdRecordInteractionInputSchema)
    .output(MotdRecordInteractionOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const ip = getClientIp(ctx);
      const limit = await checkMotdRecordInteractionRate(ip);
      if (!limit.allowed) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Zu viele Anfragen. Bitte kurz warten.',
          cause: { retryAfterSeconds: limit.retryAfterSeconds },
        });
      }

      const motd = await prisma.motd.findUnique({ where: { id: input.motdId } });
      if (!motd || motd.contentVersion !== input.contentVersion) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'MOTD nicht gefunden.' });
      }

      const base = {
        motdId: input.motdId,
        ackCount: 0,
        thumbUp: 0,
        thumbDown: 0,
        dismissClose: 0,
        dismissSwipe: 0,
      };
      const inc = { increment: 1 };
      switch (input.kind) {
        case 'ACK':
          await prisma.motdInteractionCounter.upsert({
            where: { motdId: input.motdId },
            create: { ...base, ackCount: 1 },
            update: { ackCount: inc },
          });
          break;
        case 'THUMB_UP':
          await prisma.motdInteractionCounter.upsert({
            where: { motdId: input.motdId },
            create: { ...base, thumbUp: 1 },
            update: { thumbUp: inc },
          });
          break;
        case 'THUMB_DOWN':
          await prisma.motdInteractionCounter.upsert({
            where: { motdId: input.motdId },
            create: { ...base, thumbDown: 1 },
            update: { thumbDown: inc },
          });
          break;
        case 'DISMISS_CLOSE':
          await prisma.motdInteractionCounter.upsert({
            where: { motdId: input.motdId },
            create: { ...base, dismissClose: 1 },
            update: { dismissClose: inc },
          });
          break;
        case 'DISMISS_SWIPE':
          await prisma.motdInteractionCounter.upsert({
            where: { motdId: input.motdId },
            create: { ...base, dismissSwipe: 1 },
            update: { dismissSwipe: inc },
          });
          break;
      }

      return { ok: true as const };
    }),
});
