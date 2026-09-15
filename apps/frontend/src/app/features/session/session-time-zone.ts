import { Temporal } from '@js-temporal/polyfill';

export function resolveBrowserSessionTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Wandelt den Wert eines datetime-local-Felds in der expliziten Sessionzeitzone um. */
export function sessionLocalDateTimeToIso(localDateTime: string, timeZone: string): string {
  return Temporal.PlainDateTime.from(localDateTime)
    .toZonedDateTime(timeZone, { disambiguation: 'reject' })
    .toInstant()
    .toString();
}
