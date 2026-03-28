/// <reference types="@angular/localize" />

/** Ab diesem Endjahr (UTC) gilt die Meldung als „ohne konkretes Ende“ in der UI (technisch weit in der Zukunft). */
export const MOTD_LONG_RUNNING_END_UTC_YEAR = 2090;

export type MotdEndDisplayMode = 'archive' | 'admin';

/**
 * Admin-Liste / Formular: ein ISO-Zeitpunkt als kurzes Datum + Uhrzeit (App-Locale).
 */
export function formatMotdAdminDateTimeForDisplay(iso: string, intlLocale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso.length >= 16 ? iso.slice(0, 16) : iso;
  }
  return new Intl.DateTimeFormat(intlLocale, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

/**
 * Datumszeile im News-Archiv: `startsAt` (Veröffentlichung), ohne „Fortlaufend“-Sonderlogik.
 */
export function formatMotdArchiveStartsAtForDisplay(iso: string, intlLocale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso.length >= 16 ? iso.slice(0, 16) : iso;
  }
  return new Intl.DateTimeFormat(intlLocale, { dateStyle: 'medium' }).format(d);
}

/**
 * Zeigt `endsAt` menschenlesbar; sehr späte Enden (Willkommens-MOTD) im Admin als „Fortlaufend“
 * statt „31.12.2099“. Im News-Archiv entfällt die Zeile (redundant zum Inhalt).
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
    if (mode === 'archive') {
      return '';
    }
    return $localize`:@@motd.archiveDateLongRunning:Fortlaufend`;
  }
  if (mode === 'archive') {
    return new Intl.DateTimeFormat(intlLocale, { dateStyle: 'medium' }).format(d);
  }
  return formatMotdAdminDateTimeForDisplay(iso, intlLocale);
}
