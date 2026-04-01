import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import type { AppLocale, MotdArchiveItemDTO } from '@arsnova/shared-types';
import { trpc } from '../../core/trpc.client';
import { resolveMotdAssetOrigin } from '../../core/motd-asset-origin';
import { getMotdArchiveSeenUpToEndsAtIso, motdDismissedPairsForApi } from '../../core/motd-storage';
import { buildMotdArchiveItemDisplay } from '../../shared/motd-archive-render.util';

export type NewsArchiveInitialModel = {
  items: MotdArchiveItemDTO[];
  nextCursor: string | null;
  archiveMaxEndsAtIso: string | null;
  archiveUnreadCount: number;
  errorMessage: string | null;
  titleById: Record<string, string>;
  htmlById: Record<string, SafeHtml>;
};

/**
 * Erste Archiv-Seite + Header-State (Resolver + SSR/Prerender: blockiert bis die Daten da sind).
 */
export async function loadNewsArchivePageModel(
  locale: AppLocale,
  sanitizer: DomSanitizer,
  fallbackTitle: string,
  loadErrorMessage: string,
): Promise<NewsArchiveInitialModel> {
  const seen = getMotdArchiveSeenUpToEndsAtIso();
  const dismissed = motdDismissedPairsForApi();
  const headerInput = {
    locale,
    ...(seen ? { archiveSeenUpToEndsAtIso: seen } : {}),
    ...(dismissed.length ? { overlayDismissedUpTo: dismissed } : {}),
  };

  const [stateResult, listResult] = await Promise.allSettled([
    trpc.motd.getHeaderState.query(headerInput),
    trpc.motd.listArchive.query({ locale, pageSize: 30 }),
  ]);

  let archiveMaxEndsAtIso: string | null = null;
  let archiveUnreadCount = 0;
  const headerOk = stateResult.status === 'fulfilled';

  if (headerOk) {
    const s = stateResult.value;
    archiveMaxEndsAtIso = s.archiveMaxEndsAtIso;
    archiveUnreadCount = s.archiveUnreadCount;
  }

  let items: MotdArchiveItemDTO[] = [];
  let nextCursor: string | null = null;
  let errorMessage: string | null = null;
  const titleById: Record<string, string> = {};
  const htmlById: Record<string, SafeHtml> = {};

  if (listResult.status === 'fulfilled') {
    const first = listResult.value;
    items = first.items;
    nextCursor = first.nextCursor;
    for (const it of first.items) {
      const { title, html } = buildMotdArchiveItemDisplay(it, sanitizer, fallbackTitle, {
        assetOrigin: resolveMotdAssetOrigin(),
      });
      titleById[it.id] = title;
      htmlById[it.id] = html;
    }
  } else {
    const e = listResult.reason;
    errorMessage =
      e &&
      typeof e === 'object' &&
      'message' in e &&
      typeof (e as { message: string }).message === 'string'
        ? (e as { message: string }).message
        : loadErrorMessage;
  }

  /* Wie Dialog `reconcileArchiveReadSignals`: fehlendes Server-Maximum aus geladener Seite. */
  const maxFromPage =
    items.length === 0
      ? null
      : items.reduce((best, it) => (it.endsAt > best ? it.endsAt : best), items[0]!.endsAt);
  if (!archiveMaxEndsAtIso && maxFromPage) {
    archiveMaxEndsAtIso = maxFromPage;
  }

  if (!headerOk) {
    if (items.length > 0) {
      const seenAgain = getMotdArchiveSeenUpToEndsAtIso();
      archiveUnreadCount = seenAgain
        ? items.filter((it) => it.endsAt > seenAgain).length
        : items.length;
    } else {
      archiveUnreadCount = 0;
    }
  }

  return {
    items,
    nextCursor,
    archiveMaxEndsAtIso,
    archiveUnreadCount,
    errorMessage,
    titleById,
    htmlById,
  };
}
