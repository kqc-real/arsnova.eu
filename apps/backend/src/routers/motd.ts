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
import { logger } from '../lib/logger';
import { pickLocaleFromAcceptLanguage } from '../lib/pick-locale-from-accept-language';
import { localesToMap, resolveMotdMarkdown } from '../lib/motdMarkdown';
import {
  RATE_LIMIT_ENV,
  checkMotdGetCurrentRate,
  checkMotdListArchiveRate,
  checkMotdRecordInteractionRate,
  shouldBypassMotdGetCurrentRate,
} from '../lib/rateLimit';
import { publicProcedure, resolveClientIp, router, type Context } from '../trpc';

/**
 * Obergrenze gleichzeitig aktiver PUBLISHED-MOTDs für die Overlay-Auswahl (Sortierung im Speicher).
 * 32 reicht für übliche Deployments; höhere Werte erhöhen nur DB-Payload ohne Nutzen.
 */
const MOTD_ACTIVE_FETCH_CAP = 32;

const MOTD_GET_CURRENT_LOCALES: AppLocale[] = ['de', 'en', 'fr', 'it', 'es'];

function resolveMotdLocale(explicit: AppLocale | undefined, ctx: Context): AppLocale {
  return (
    explicit ??
    (pickLocaleFromAcceptLanguage(
      ctx.req?.headers['accept-language'],
      MOTD_GET_CURRENT_LOCALES,
      'de',
    ) as AppLocale)
  );
}

/**
 * Feste ID der dauerhaften Willkommens-MOTD (Migration `motd_welcome_message` + `seed-dev-motd.mjs`).
 * Alte Seeds nutzten oft priority 100 — ohne Sonderlogik würde die Sortierung inkonsistent wirken.
 */
const DEV_SEED_MOTD_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

/**
 * Solange die Willkommens-MOTD (aktuelle Version) nicht per Client als erledigt gemeldet ist,
 * soll sie vor allen anderen aktiven Overlays erscheinen (Onboarding).
 * Danach: niedrigste effektive Priorität, damit Betriebsmeldungen nicht dauerhaft „hinter“ ihr stehen bleiben.
 */
// Admin-UI erlaubt priority bis 1_000_000. Der Boost muss darüber liegen, damit Welcome garantiert
// auch vor sehr hoch priorisierten „Betriebsmeldungen“ erscheint (solange nicht dismissed).
const WELCOME_FIRST_OVERLAY_PRIORITY_BOOST = 2_000_000;

function effectiveOverlayPriority(
  id: string,
  priority: number,
  welcomeNotYetDismissed: boolean,
): number {
  if (id === DEV_SEED_MOTD_ID) {
    if (welcomeNotYetDismissed) return WELCOME_FIRST_OVERLAY_PRIORITY_BOOST + priority;
    return Math.min(priority, 0) - 1;
  }
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

type OverlayDismissedPair = { motdId: string; contentVersion: number };
type ArchiveLocalizedRow = {
  id: string;
  contentVersion: number;
  startsAt: Date;
  endsAt: Date;
  locales: Array<{ locale: string; markdown: string }>;
};

function mergeOverlayDismissedMap(
  pairs: OverlayDismissedPair[] | undefined,
): Map<string, number> | null {
  if (!pairs?.length) return null;
  const m = new Map<string, number>();
  for (const p of pairs) {
    const cur = m.get(p.motdId) ?? 0;
    if (p.contentVersion > cur) m.set(p.motdId, p.contentVersion);
  }
  return m;
}

function isMotdSkippedByClientDismiss(
  id: string,
  contentVersion: number,
  dismissed: Map<string, number> | null,
): boolean {
  const v = dismissed?.get(id);
  return typeof v === 'number' && v >= contentVersion;
}

async function fetchCurrentMotdDto(
  locale: AppLocale,
  at: Date,
  overlayDismissedUpTo?: OverlayDismissedPair[],
): Promise<MotdPublicDTO | null> {
  const dismissedMap = mergeOverlayDismissedMap(overlayDismissedUpTo);
  const rows = await prisma.motd.findMany({
    where: {
      status: 'PUBLISHED',
      startsAt: { lte: at },
      endsAt: { gt: at },
    },
    take: MOTD_ACTIVE_FETCH_CAP,
    include: { locales: true },
  });
  const welcomeRow = rows.find((r) => r.id === DEV_SEED_MOTD_ID);
  const welcomeNotYetDismissed =
    welcomeRow !== undefined &&
    !isMotdSkippedByClientDismiss(welcomeRow.id, welcomeRow.contentVersion, dismissedMap);
  rows.sort((a, b) => {
    const pa = effectiveOverlayPriority(a.id, a.priority, welcomeNotYetDismissed);
    const pb = effectiveOverlayPriority(b.id, b.priority, welcomeNotYetDismissed);
    if (pb !== pa) return pb - pa;
    const ds = b.startsAt.getTime() - a.startsAt.getTime();
    if (ds !== 0) return ds;
    // Stabiler Tiebreaker bei identischer Priorität und identischem Start:
    // DB-Reihenfolge ist nicht garantiert, daher nach id absteigend.
    if (b.id !== a.id) return b.id < a.id ? -1 : 1;
    return 0;
  });
  for (const row of rows) {
    if (isMotdSkippedByClientDismiss(row.id, row.contentVersion, dismissedMap)) continue;
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

function mapArchiveRowsForLocale(rows: ArchiveLocalizedRow[], locale: AppLocale) {
  return rows
    .map((m) => {
      const map = localesToMap(m.locales);
      const markdown = resolveMotdMarkdown(map, locale);
      if (!markdown.trim()) return null;
      return {
        id: m.id,
        contentVersion: m.contentVersion,
        markdown,
        startsAt: m.startsAt.toISOString(),
        endsAt: m.endsAt.toISOString(),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

async function fetchArchiveHeaderStats(locale: AppLocale, now: Date, seen: Date | null) {
  const rows = await prisma.motd.findMany({
    where: motdArchiveListWhere(now),
    select: {
      id: true,
      contentVersion: true,
      startsAt: true,
      endsAt: true,
      locales: true,
    },
    orderBy: [{ endsAt: 'desc' }, { id: 'desc' }],
  });
  const visible = mapArchiveRowsForLocale(rows, locale);
  const archiveCount = visible.length;
  const archiveMaxEndsAtIso = visible[0]?.endsAt ?? null;
  const archiveUnreadCount =
    seen === null
      ? archiveCount
      : visible.reduce((count, item) => count + (new Date(item.endsAt) > seen ? 1 : 0), 0);
  return {
    archiveCount,
    archiveMaxEndsAtIso,
    archiveUnreadCount,
  };
}

/** Datenschutzarme Diagnose eines MOTD-429 ohne Client-IP oder IP-haltigen Redis-Schlüssel. */
function logMotdRateLimit429(
  procedure: 'getCurrent' | 'getHeaderState' | 'listArchive' | 'recordInteraction',
  ipSource: string,
  limitPerMinute: number,
  retryAfterSeconds: number | undefined,
): void {
  logger.warn('motd:rate_limit_429', {
    event: 'motd_rate_limit_429',
    procedure,
    ipSource,
    limitPerMinute,
    retryAfterSeconds: retryAfterSeconds ?? null,
  });
}

export const motdRouter = router({
  /**
   * Liefert höchstens eine aktive Overlay-MOTD (PUBLISHED, Zeitfenster).
   * Reihenfolge: ungelesene Willkommens-MOTD zuerst; sonst `priority` DESC, dann `startsAt` DESC.
   * Rate-Limit: gleicher Schlüssel wie `getHeaderState` (`checkMotdGetCurrentRate`).
   */
  getCurrent: publicProcedure
    .input(MotdGetCurrentInputSchema)
    .output(MotdGetCurrentOutputSchema)
    .query(async ({ ctx, input }) => {
      const resolved = resolveClientIp(ctx.req);
      const ip = resolved.ip;
      if (!shouldBypassMotdGetCurrentRate(ip)) {
        const limit = await checkMotdGetCurrentRate(ip);
        if (!limit.allowed) {
          logMotdRateLimit429(
            'getCurrent',
            resolved.source,
            RATE_LIMIT_ENV.motdGetCurrentPerMinute,
            limit.retryAfterSeconds,
          );
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: 'Zu viele Anfragen. Bitte kurz warten.',
            cause: { retryAfterSeconds: limit.retryAfterSeconds },
          });
        }
      }
      const locale = resolveMotdLocale(input.locale, ctx);
      const motd = await fetchCurrentMotdDto(locale, new Date(), input.overlayDismissedUpTo);
      return { motd };
    }),

  /**
   * Archivliste (nur `visibleInArchive`, nicht DRAFT); sortiert nach `startsAt` absteigend
   * (Anzeige im Client nutzt `startsAt` als Veröffentlichungsdatum).
   * Optional `cursor` (letzte MOTD-`id` der vorherigen Seite) für Pagination.
   */
  listArchive: publicProcedure
    .input(MotdListArchiveInputSchema)
    .output(MotdListArchiveOutputSchema)
    .query(async ({ ctx, input }) => {
      const resolved = resolveClientIp(ctx.req);
      const ip = resolved.ip;
      const limit = await checkMotdListArchiveRate(ip);
      if (!limit.allowed) {
        logMotdRateLimit429(
          'listArchive',
          resolved.source,
          RATE_LIMIT_ENV.motdListArchivePerMinute,
          limit.retryAfterSeconds,
        );
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Zu viele Anfragen. Bitte kurz warten.',
          cause: { retryAfterSeconds: limit.retryAfterSeconds },
        });
      }
      const now = new Date();
      const take = input.pageSize;
      const locale = resolveMotdLocale(input.locale, ctx);

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
                  { startsAt: { lt: c.startsAt } },
                  { AND: [{ startsAt: c.startsAt }, { id: { lt: c.id } }] },
                ],
              },
            ],
          };
        }
      }

      const motds = await prisma.motd.findMany({
        where,
        orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
        take: take + 1,
        include: { locales: true },
      });

      const page = motds.slice(0, take);
      const hasMore = motds.length > take;
      const nextCursor = hasMore ? (page.at(-1)?.id ?? null) : null;

      const items = mapArchiveRowsForLocale(page, locale);

      return { items, nextCursor };
    }),

  /**
   * Toolbar/Header: aktives Overlay?, Archiv-Anzahl, `archiveMaxEndsAtIso`, ungelesen relativ zu `archiveSeenUpToEndsAtIso`.
   */
  getHeaderState: publicProcedure
    .input(MotdHeaderStateInputSchema)
    .output(MotdHeaderStateOutputSchema)
    .query(async ({ ctx, input }) => {
      const resolved = resolveClientIp(ctx.req);
      const ip = resolved.ip;
      if (!shouldBypassMotdGetCurrentRate(ip)) {
        const limit = await checkMotdGetCurrentRate(ip);
        if (!limit.allowed) {
          logMotdRateLimit429(
            'getHeaderState',
            resolved.source,
            RATE_LIMIT_ENV.motdGetCurrentPerMinute,
            limit.retryAfterSeconds,
          );
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: 'Zu viele Anfragen. Bitte kurz warten.',
            cause: { retryAfterSeconds: limit.retryAfterSeconds },
          });
        }
      }
      const now = new Date();
      const locale = resolveMotdLocale(input.locale, ctx);
      const seenRaw = input.archiveSeenUpToEndsAtIso;
      const seen = seenRaw && !Number.isNaN(new Date(seenRaw).getTime()) ? new Date(seenRaw) : null;

      const dismissed = input.overlayDismissedUpTo;
      const [motd, archiveStats] = await Promise.all([
        fetchCurrentMotdDto(locale, now, dismissed),
        fetchArchiveHeaderStats(locale, now, seen),
      ]);

      const { archiveCount, archiveMaxEndsAtIso, archiveUnreadCount } = archiveStats;

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
      const resolved = resolveClientIp(ctx.req);
      const ip = resolved.ip;
      const limit = await checkMotdRecordInteractionRate(ip);
      if (!limit.allowed) {
        logMotdRateLimit429(
          'recordInteraction',
          resolved.source,
          RATE_LIMIT_ENV.motdRecordInteractionPerMinute,
          limit.retryAfterSeconds,
        );
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Zu viele Anfragen. Bitte kurz warten.',
          cause: { retryAfterSeconds: limit.retryAfterSeconds },
        });
      }

      const motd = await prisma.motd.findUnique({ where: { id: input.motdId } });
      if (motd?.contentVersion !== input.contentVersion) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'MOTD nicht gefunden.' });
      }

      const base = {
        motdId: input.motdId,
        contentVersion: input.contentVersion,
        ackCount: 0,
        thumbUp: 0,
        thumbDown: 0,
        dismissClose: 0,
        dismissSwipe: 0,
      };
      const where = {
        motdId_contentVersion: {
          motdId: input.motdId,
          contentVersion: input.contentVersion,
        },
      };
      const inc = { increment: 1 };
      switch (input.kind) {
        case 'ACK':
          await prisma.motdInteractionCounter.upsert({
            where,
            create: { ...base, ackCount: 1 },
            update: { ackCount: inc },
          });
          break;
        case 'THUMB_UP':
          await prisma.motdInteractionCounter.upsert({
            where,
            create: { ...base, thumbUp: 1 },
            update: { thumbUp: inc },
          });
          break;
        case 'THUMB_DOWN':
          await prisma.motdInteractionCounter.upsert({
            where,
            create: { ...base, thumbDown: 1 },
            update: { thumbDown: inc },
          });
          break;
        case 'THUMB_UP_REVOKE': {
          const row = await prisma.motdInteractionCounter.findUnique({
            where,
          });
          if (row && row.thumbUp > 0) {
            await prisma.motdInteractionCounter.update({
              where,
              data: { thumbUp: row.thumbUp - 1 },
            });
          }
          break;
        }
        case 'THUMB_DOWN_REVOKE': {
          const row = await prisma.motdInteractionCounter.findUnique({
            where,
          });
          if (row && row.thumbDown > 0) {
            await prisma.motdInteractionCounter.update({
              where,
              data: { thumbDown: row.thumbDown - 1 },
            });
          }
          break;
        }
        case 'THUMB_SWITCH_UP_TO_DOWN':
          await prisma.$transaction(async (tx) => {
            const row = await tx.motdInteractionCounter.findUnique({
              where,
            });
            if (!row) {
              await tx.motdInteractionCounter.create({
                data: { ...base, thumbDown: 1 },
              });
              return;
            }
            await tx.motdInteractionCounter.update({
              where,
              data: {
                thumbUp: Math.max(0, row.thumbUp - 1),
                thumbDown: { increment: 1 },
              },
            });
          });
          break;
        case 'THUMB_SWITCH_DOWN_TO_UP':
          await prisma.$transaction(async (tx) => {
            const row = await tx.motdInteractionCounter.findUnique({
              where,
            });
            if (!row) {
              await tx.motdInteractionCounter.create({
                data: { ...base, thumbUp: 1 },
              });
              return;
            }
            await tx.motdInteractionCounter.update({
              where,
              data: {
                thumbDown: Math.max(0, row.thumbDown - 1),
                thumbUp: { increment: 1 },
              },
            });
          });
          break;
        case 'DISMISS_CLOSE':
          await prisma.motdInteractionCounter.upsert({
            where,
            create: { ...base, dismissClose: 1 },
            update: { dismissClose: inc },
          });
          break;
        case 'DISMISS_SWIPE':
          await prisma.motdInteractionCounter.upsert({
            where,
            create: { ...base, dismissSwipe: 1 },
            update: { dismissSwipe: inc },
          });
          break;
      }

      return { ok: true as const };
    }),
});
