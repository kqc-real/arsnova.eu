import type {
  MotdArchiveItemDTO,
  MotdArchiveReadCursor,
  MotdArchiveReadItem,
} from '@arsnova/shared-types';

function safeTime(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Sortierung fürs UI: antichronologisch (neueste zuerst) nach Veröffentlichungsdatum (`startsAt`).
 * Fallback: `id` DESC (identisch zur Backend-Pagination).
 */
export function sortMotdArchiveItemsNewFirst(items: MotdArchiveItemDTO[]): MotdArchiveItemDTO[] {
  return [...items].sort((a, b) => {
    const sa = safeTime(a.startsAt);
    const sb = safeTime(b.startsAt);
    if (sb !== sa) return sb - sa;
    if (b.id !== a.id) return b.id < a.id ? -1 : 1;
    if (b.contentVersion !== a.contentVersion) return b.contentVersion - a.contentVersion;
    return 0;
  });
}

export function motdArchiveReadCursorForItem(item: MotdArchiveItemDTO): MotdArchiveReadCursor {
  return {
    startsAtIso: item.startsAt,
    motdId: item.id,
    contentVersion: item.contentVersion,
  };
}

/** Positiv, wenn `a` in der Archivsortierung neuer als `b` ist. */
export function compareMotdArchiveReadCursors(
  a: MotdArchiveReadCursor,
  b: MotdArchiveReadCursor,
): number {
  const startsAtDifference = safeTime(a.startsAtIso) - safeTime(b.startsAtIso);
  if (startsAtDifference !== 0) return startsAtDifference;
  if (a.motdId !== b.motdId) return a.motdId > b.motdId ? 1 : -1;
  return a.contentVersion - b.contentVersion;
}

export function newestMotdArchiveReadCursor(
  items: MotdArchiveItemDTO[],
): MotdArchiveReadCursor | null {
  return items.reduce<MotdArchiveReadCursor | null>((newest, item) => {
    const cursor = motdArchiveReadCursorForItem(item);
    return newest === null || compareMotdArchiveReadCursors(cursor, newest) > 0 ? cursor : newest;
  }, null);
}

export function isMotdArchiveItemNewerThanCursor(
  item: MotdArchiveItemDTO,
  cursor: MotdArchiveReadCursor,
): boolean {
  return compareMotdArchiveReadCursors(motdArchiveReadCursorForItem(item), cursor) > 0;
}

export function isMotdArchiveItemIndividuallyRead(
  item: Pick<MotdArchiveItemDTO, 'id' | 'contentVersion'>,
  readItems: ReadonlyArray<MotdArchiveReadItem>,
): boolean {
  return readItems.some(
    (read) => read.motdId === item.id && read.contentVersion >= item.contentVersion,
  );
}

export function isMotdArchiveItemUnread(
  item: MotdArchiveItemDTO,
  seen: MotdArchiveReadCursor | undefined,
  readItems: ReadonlyArray<MotdArchiveReadItem>,
): boolean {
  if (seen && !isMotdArchiveItemNewerThanCursor(item, seen)) {
    return false;
  }
  return !isMotdArchiveItemIndividuallyRead(item, readItems);
}

export function countMotdArchiveUnreadItems(
  items: MotdArchiveItemDTO[],
  seen: MotdArchiveReadCursor | undefined,
  readItems: ReadonlyArray<MotdArchiveReadItem>,
): number {
  return items.reduce(
    (count, item) => count + (isMotdArchiveItemUnread(item, seen, readItems) ? 1 : 0),
    0,
  );
}
