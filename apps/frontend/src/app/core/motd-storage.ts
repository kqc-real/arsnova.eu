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

/**
 * Erster Besuch der Startseite auf einem Handy/Tablet: Overlay erst ab dem
 * nächsten Besuch. Reload in derselben Sitzung bleibt unterdrückt.
 */
export const MOTD_MOBILE_HOME_SEEN_KEY = 'arsnova-motd-mobile-home-seen';
export const MOTD_MOBILE_FIRST_HOME_SESSION_KEY = 'arsnova-motd-mobile-first-home-session';

/**
 * Nach dem ersten Overlay-Angebot in dieser Browsersitzung kein weiteres
 * Auto-Overlay (Reload, Rückkehr zur Startseite). Badge und Archiv bleiben.
 */
export const MOTD_OVERLAY_OFFERED_SESSION_KEY = 'arsnova-motd-overlay-offered-session';

export type MotdClientStorageV1 = {
  /** motdId → zuletzt bestätigte contentVersion (diese Version nicht mehr als Overlay) */
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

/** Merkt, dass in dieser Sitzung bereits ein Auto-Overlay angeboten wurde. */
export function markMotdOverlayOfferedThisSession(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(MOTD_OVERLAY_OFFERED_SESSION_KEY, '1');
  } catch {
    /* ignore quota / private mode */
  }
}

export function hasMotdOverlayBeenOfferedThisSession(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    return sessionStorage.getItem(MOTD_OVERLAY_OFFERED_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Nach dem Dismiss einer MOTD keine *andere* MOTD mehr automatisch öffnen.
 * Eine höhere `contentVersion` derselben ID darf weiter unterbrechen (ADR-0018).
 */
export function shouldSkipQueuedMotdAutoOverlay(motdId: string): boolean {
  const dismissed = readMotdClientStorage().dismissed;
  const dismissedIds = Object.keys(dismissed);
  if (dismissedIds.length === 0) return false;
  return !Object.prototype.hasOwnProperty.call(dismissed, motdId);
}

/** Handy-Layout oder grober Primärzeiger: typischer Teilnehmer-Einstieg. */
export function isMobileHomeMotdContext(): boolean {
  if (typeof matchMedia !== 'function') return false;
  try {
    return matchMedia('(max-width: 599px)').matches || matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

/**
 * Unterdrückt das Startseiten-Overlay beim ersten mobilen Besuch (und Reloads
 * derselben Sitzung). Desktop bleibt unverändert. Das Archiv-Icon in der Toolbar
 * ist nicht betroffen.
 */
export function shouldSuppressMotdOverlayOnMobileFirstHomeVisit(): boolean {
  if (typeof localStorage === 'undefined' || typeof sessionStorage === 'undefined') {
    return false;
  }
  if (!isMobileHomeMotdContext()) return false;
  try {
    const seen = localStorage.getItem(MOTD_MOBILE_HOME_SEEN_KEY) === '1';
    const firstSession = sessionStorage.getItem(MOTD_MOBILE_FIRST_HOME_SESSION_KEY) === '1';
    if (!seen) {
      localStorage.setItem(MOTD_MOBILE_HOME_SEEN_KEY, '1');
      sessionStorage.setItem(MOTD_MOBILE_FIRST_HOME_SESSION_KEY, '1');
      return true;
    }
    return firstSession;
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
