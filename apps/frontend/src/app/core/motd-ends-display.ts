/// <reference types="@angular/localize" />

/** Ab diesem Endjahr (UTC) gilt die Meldung als „ohne konkretes Ende“ in der UI (technisch weit in der Zukunft). */
export const MOTD_LONG_RUNNING_END_UTC_YEAR = 2090;

export type MotdEndDisplayMode = 'archive' | 'admin';

/**
 * Zeigt `endsAt` menschenlesbar; sehr späte Enden (Willkommens-MOTD) als kurzer Text statt „31.12.2099“.
 */
export function formatMotdEndsAtForDisplay(
  iso: string,
  intlLocale: string,
  mode: MotdEndDisplayMode,
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso.length >= 16 ? iso.slice(0, 16) : iso;
  }
  if (d.getUTCFullYear() >= MOTD_LONG_RUNNING_END_UTC_YEAR) {
    return $localize`:@@motd.archiveDateLongRunning:Fortlaufend`;
  }
  if (mode === 'archive') {
    return new Intl.DateTimeFormat(intlLocale, { dateStyle: 'medium' }).format(d);
  }
  return new Intl.DateTimeFormat(intlLocale, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}
