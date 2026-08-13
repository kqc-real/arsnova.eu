/**
 * Browser-Persistenz für MOTD (Epic 10): Dismiss-Versionen und einmalige Interaktionen pro Build.
 */
import type { MotdArchiveReadCursor } from '@arsnova/shared-types';

export const MOTD_LOCAL_STORAGE_KEY = 'arsnova-motd-v2';

/**
 * Einmalig Overlay nach Locale-Reload von der **Startseite** unterdrücken
 * (Sprachwähler → Vollreload), damit nicht sofort die nächstpriore MOTD den Fokus stiehlt.
 */
export const MOTD_SUPPRESS_OVERLAY_AFTER_RELOAD_KEY = 'arsnova-motd-suppress-overlay-once';

export type MotdClientStorageV1 = {
  /** motdId → zuletzt bestätigte contentVersion (Overlay nicht mehr zeigen) */
  dismissed: Record<string, number>;
  /** Schlüssel `${motdId}:${contentVersion}:${kind}` */
  interactions: Record<string, true>;
  /** Globaler Lesecursor in der publikationsbasierten Archivsortierung (Epic 10). */
  archiveSeenUpToCursor?: MotdArchiveReadCursor;
};

const empty = (): MotdClientStorageV1 => ({ dismissed: {}, interactions: {} });

const MOTD_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isMotdArchiveReadCursor(value: unknown): value is MotdArchiveReadCursor {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const cursor = value as Record<string, unknown>;
  return (
    typeof cursor.startsAtIso === 'string' &&
    Number.isFinite(Date.parse(cursor.startsAtIso)) &&
    typeof cursor.motdId === 'string' &&
    MOTD_UUID_PATTERN.test(cursor.motdId) &&
    typeof cursor.contentVersion === 'number' &&
    Number.isInteger(cursor.contentVersion) &&
    cursor.contentVersion >= 1
  );
}

export function readMotdClientStorage(): MotdClientStorageV1 {
  if (typeof localStorage === 'undefined') return empty();
  try {
    const raw = localStorage.getItem(MOTD_LOCAL_STORAGE_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return empty();
    const o = parsed as Record<string, unknown>;
    const dismissed =
      o.dismissed && typeof o.dismissed === 'object' && !Array.isArray(o.dismissed)
        ? (o.dismissed as Record<string, number>)
        : {};
    const interactions =
      o.interactions && typeof o.interactions === 'object' && !Array.isArray(o.interactions)
        ? (o.interactions as Record<string, true>)
        : {};
    const cursorRaw = o.archiveSeenUpToCursor;
    const archiveSeenUpToCursor = isMotdArchiveReadCursor(cursorRaw) ? cursorRaw : undefined;
    return {
      dismissed,
      interactions,
      ...(archiveSeenUpToCursor ? { archiveSeenUpToCursor } : {}),
    };
  } catch {
    return empty();
  }
}

export function writeMotdClientStorage(data: MotdClientStorageV1): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(MOTD_LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

export function isMotdDismissedForVersion(motdId: string, contentVersion: number): boolean {
  const v = readMotdClientStorage().dismissed[motdId];
  return typeof v === 'number' && v >= contentVersion;
}

export function markMotdDismissed(motdId: string, contentVersion: number): void {
  const cur = readMotdClientStorage();
  const prev = cur.dismissed[motdId] ?? 0;
  cur.dismissed[motdId] = Math.max(prev, contentVersion);
  writeMotdClientStorage(cur);
}

/** Vor Locale-Vollreload setzen; `consumeMotdOverlayReloadSuppress` liest und löscht. */
export function markMotdOverlayReloadSuppress(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(MOTD_SUPPRESS_OVERLAY_AFTER_RELOAD_KEY, '1');
  } catch {
    /* ignore quota / private mode */
  }
}

/** @returns true wenn Overlay nach Reload einmalig unterdrückt werden soll. */
export function consumeMotdOverlayReloadSuppress(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    if (sessionStorage.getItem(MOTD_SUPPRESS_OVERLAY_AFTER_RELOAD_KEY) !== '1') {
      return false;
    }
    sessionStorage.removeItem(MOTD_SUPPRESS_OVERLAY_AFTER_RELOAD_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Für `motd.getCurrent` / `getHeaderState`: lokal dismissierte Overlay-MOTDs (nächste Priorität). */
export function motdDismissedPairsForApi(): { motdId: string; contentVersion: number }[] {
  const dismissed = readMotdClientStorage().dismissed;
  return Object.entries(dismissed).map(([motdId, contentVersion]) => ({
    motdId,
    contentVersion,
  }));
}

export function interactionStorageKey(
  motdId: string,
  contentVersion: number,
  kind: string,
): string {
  return `${motdId}:${contentVersion}:${kind}`;
}

export function hasMotdInteractionRecorded(
  motdId: string,
  contentVersion: number,
  kind: string,
): boolean {
  const key = interactionStorageKey(motdId, contentVersion, kind);
  return !!readMotdClientStorage().interactions[key];
}

export function markMotdInteractionRecorded(
  motdId: string,
  contentVersion: number,
  kind: string,
): void {
  const cur = readMotdClientStorage();
  cur.interactions[interactionStorageKey(motdId, contentVersion, kind)] = true;
  writeMotdClientStorage(cur);
}

/** Entfernt lokale Daumen-hoch/runter-Markierung (Toggle / Wechsel). */
export function clearMotdThumbInteractionKeys(motdId: string, contentVersion: number): void {
  const cur = readMotdClientStorage();
  delete cur.interactions[interactionStorageKey(motdId, contentVersion, 'THUMB_UP')];
  delete cur.interactions[interactionStorageKey(motdId, contentVersion, 'THUMB_DOWN')];
  writeMotdClientStorage(cur);
}

export function getMotdArchiveSeenUpToCursor(): MotdArchiveReadCursor | undefined {
  return readMotdClientStorage().archiveSeenUpToCursor;
}

export function setMotdArchiveSeenUpToCursor(cursor: MotdArchiveReadCursor): void {
  const cur = readMotdClientStorage();
  cur.archiveSeenUpToCursor = cursor;
  writeMotdClientStorage(cur);
}
