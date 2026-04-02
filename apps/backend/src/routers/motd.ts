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
  redisKeyMotdGetCurrent,
  redisKeyMotdListArchive,
  redisKeyMotdRecordInteraction,
  shouldBypassMotdGetCurrentRate,
} from '../lib/rateLimit';
import { publicProcedure, resolveClientIp, router, type Context } from '../trpc';
import type { ResolvedClientIp } from '../trpc';

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
const WELCOME_FIRST_OVERLAY_PRIORITY_BOOST = 1_000_000;

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
    return b.startsAt.getTime() - a.startsAt.getTime();
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

/** Belegt bei jedem MOTD-429: welche IP, welcher Redis-Schlüssel, welches Limit — ohne Raten. */
function logMotdRateLimit429(
  procedure: 'getCurrent' | 'getHeaderState' | 'listArchive' | 'recordInteraction',
  resolved: ResolvedClientIp,
  redisKey: string,
  limitPerMinute: number,
  retryAfterSeconds: number | undefined,
): void {
  logger.warn('motd:rate_limit_429', {
    event: 'motd_rate_limit_429',
    procedure,
    clientIp: resolved.ip,
    ipSource: resolved.source,
    limitPerMinute,
    redisKey,
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
            resolved,
            redisKeyMotdGetCurrent(ip),
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
   * Archivliste (nur `visibleInArchive`, nicht DRAFT); sortiert nach `endsAt` absteigend.
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
          resolved,
          redisKeyMotdListArchive(ip),
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
            resolved,
            redisKeyMotdGetCurrent(ip),
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
      const archiveWhere = motdArchiveListWhere(now);
      const seenRaw = input.archiveSeenUpToEndsAtIso;
      const seen = seenRaw && !Number.isNaN(new Date(seenRaw).getTime()) ? new Date(seenRaw) : null;

      const dismissed = input.overlayDismissedUpTo;
      const results = seen
        ? await Promise.all([
            fetchCurrentMotdDto(locale, now, dismissed),
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
            fetchCurrentMotdDto(locale, now, dismissed),
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
      const resolved = resolveClientIp(ctx.req);
      const ip = resolved.ip;
      const limit = await checkMotdRecordInteractionRate(ip);
      if (!limit.allowed) {
        logMotdRateLimit429(
          'recordInteraction',
          resolved,
          redisKeyMotdRecordInteraction(ip),
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
