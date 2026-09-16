import { Temporal } from '@js-temporal/polyfill';
import { SESSION_HARD_MAX_DURATION_DAYS } from '@arsnova/shared-types';

/** Wandelt den Wert eines datetime-local-Felds in der expliziten Sessionzeitzone um. */
export function sessionLocalDateTimeToIso(localDateTime: string, timeZone: string): string {
  return Temporal.PlainDateTime.from(localDateTime)
    .toZonedDateTime(timeZone, { disambiguation: 'reject' })
    .toInstant()
    .toString();
}

/** ISO-Zeit in den datetime-local-Wert der Sessionzeitzone. */
export function isoToSessionLocalDateTime(iso: string, timeZone: string): string {
  const zoned = Temporal.Instant.from(iso).toZonedDateTimeISO(timeZone);
  const year = String(zoned.year).padStart(4, '0');
  const month = String(zoned.month).padStart(2, '0');
  const day = String(zoned.day).padStart(2, '0');
  const hour = String(zoned.hour).padStart(2, '0');
  const minute = String(zoned.minute).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/** Kalendertage in der Sessionzeitzone, analog zur Backend-Fristberechnung. */
export function addCalendarDays(iso: string, days: number, timeZone: string): string {
  return Temporal.Instant.from(iso)
    .toZonedDateTimeISO(timeZone)
    .add({ days })
    .toInstant()
    .toString();
}

/**
 * Größte ganze Kalendertagzahl ab `startIso`, die `maxExpiresAtIso` nicht überschreitet.
 * 0 bedeutet: kein voller Kalendertag mehr zulässig.
 */
export function maxSelectableCalendarDays(
  startIso: string,
  maxExpiresAtIso: string,
  timeZone: string,
  hardMax = SESSION_HARD_MAX_DURATION_DAYS,
): number {
  const maxExpiresMs = Date.parse(maxExpiresAtIso);
  const startMs = Date.parse(startIso);
  if (!Number.isFinite(maxExpiresMs) || !Number.isFinite(startMs) || maxExpiresMs <= startMs) {
    return 0;
  }
  let allowed = 0;
  for (let days = 1; days <= hardMax; days += 1) {
    const candidateMs = Date.parse(addCalendarDays(startIso, days, timeZone));
    if (!Number.isFinite(candidateMs) || candidateMs > maxExpiresMs || candidateMs <= startMs) {
      break;
    }
    allowed = days;
  }
  return allowed;
}
