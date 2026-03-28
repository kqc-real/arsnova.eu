/**
 * Browser-Persistenz für MOTD (Epic 10): Dismiss-Versionen und einmalige Interaktionen pro Build.
 */
export const MOTD_LOCAL_STORAGE_KEY = 'arsnova-motd-v1';

export type MotdClientStorageV1 = {
  /** motdId → zuletzt bestätigte contentVersion (Overlay nicht mehr zeigen) */
  dismissed: Record<string, number>;
  /** Schlüssel `${motdId}:${contentVersion}:${kind}` */
  interactions: Record<string, true>;
  /**
   * Globales Archiv-Wasserzeichen: MOTDs mit `endsAt` später als dieser ISO-Zeitpunkt
   * gelten in der Toolbar als ungelesen (Epic 10).
   */
  archiveSeenUpToEndsAtIso?: string;
};

const empty = (): MotdClientStorageV1 => ({ dismissed: {}, interactions: {} });

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
    const archiveSeenUpToEndsAtIso =
      typeof o.archiveSeenUpToEndsAtIso === 'string' && o.archiveSeenUpToEndsAtIso.length > 0
        ? o.archiveSeenUpToEndsAtIso
        : undefined;
    return {
      dismissed,
      interactions,
      ...(archiveSeenUpToEndsAtIso ? { archiveSeenUpToEndsAtIso } : {}),
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

export function getMotdArchiveSeenUpToEndsAtIso(): string | undefined {
  const v = readMotdClientStorage().archiveSeenUpToEndsAtIso;
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export function setMotdArchiveSeenUpToEndsAtIso(iso: string): void {
  const cur = readMotdClientStorage();
  cur.archiveSeenUpToEndsAtIso = iso;
  writeMotdClientStorage(cur);
}
