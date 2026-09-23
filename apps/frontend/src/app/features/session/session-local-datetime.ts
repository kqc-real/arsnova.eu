import { Temporal } from '@js-temporal/polyfill';
import { SESSION_HARD_MAX_DURATION_DAYS } from '@arsnova/shared-types';

/** Wandelt den Wert eines datetime-local-Felds in der expliziten Sessionzeitzone um. */
export function sessionLocalDateTimeToIso(localDateTime: string, timeZone: string): string {
  return Temporal.PlainDateTime.from(localDateTime)
    .toZonedDateTime(timeZone, { disambiguation: 'reject' })
    .toInstant()
    .toString();
}

/** Kalendertag `YYYY-MM-DD` aus einem Session-Lokalwert `YYYY-MM-DDTHH:mm`. */
export function sessionLocalDatePart(localDateTime: string): string {
  return localDateTime.slice(0, 10);
}

/** Uhrzeit `HH:mm` aus einem Session-Lokalwert `YYYY-MM-DDTHH:mm`. */
export function sessionLocalTimePart(localDateTime: string): string {
  return localDateTime.slice(11, 16);
}

/**
 * Material-Datepicker-Datum aus einem Session-Kalendertag.
 * Nutzt lokale Mitternacht des Browsers nur als Kalenderzelle, nicht als Instant.
 */
export function sessionLocalDayToCalendarDate(ymd: string): Date {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Session-Kalendertag `YYYY-MM-DD` aus einem Material-Datepicker-Datum. */
export function calendarDateToSessionLocalDay(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Kombiniert Datepicker-Tag und Uhrzeit zum Session-Lokalwert. */
export function combineSessionLocalDateAndTime(
  date: Date | null | undefined,
  time: string,
): string {
  if (!date || !/^\d{2}:\d{2}$/.test(time)) {
    return '';
  }
  return `${calendarDateToSessionLocalDay(date)}T${time}`;
}

/** Prüft, ob der Session-Lokalwert im inklusiven min/max-Fenster liegt. */
export function isSessionLocalDateTimeWithinBounds(
  localDateTime: string,
  minLocal: string,
  maxLocal: string,
): boolean {
  return localDateTime >= minLocal && localDateTime <= maxLocal;
}

/**
 * CSS-Klassen für Material-Kalenderzellen: grün = wählbar, rot = blockiert,
 * selected = bisherige Auswahl (Vorrang vor grün).
 */
export function sessionDeadlineDateClass(
  minLocal: string,
  maxLocal: string,
  selectedLocal: string | null | undefined,
): (date: Date, view: string) => string {
  const minDay = sessionLocalDatePart(minLocal);
  const maxDay = sessionLocalDatePart(maxLocal);
  const selectedDay = selectedLocal ? sessionLocalDatePart(selectedLocal) : null;
  return (date: Date, view: string): string => {
    if (view !== 'month') {
      return '';
    }
    const day = calendarDateToSessionLocalDay(date);
    if (selectedDay && day === selectedDay) {
      return 'session-deadline-day--selected';
    }
    if (day >= minDay && day <= maxDay) {
      return 'session-deadline-day--allowed';
    }
    return 'session-deadline-day--blocked';
  };
}

/** Späteren der beiden ISO-Zeitpunkte, für die exklusive Picker-Untergrenze. */
export function laterIsoTimestamp(leftIso: string, rightIso: string): string {
  return Temporal.Instant.from(leftIso).epochMilliseconds >=
    Temporal.Instant.from(rightIso).epochMilliseconds
    ? leftIso
    : rightIso;
}

/**
 * Native `datetime-local`-Grenzen in der Sessionzeitzone.
 * `min` ist die nächste volle Minute nach `minExclusiveIso` (Server: muss danach liegen),
 * `max` ist `maxInclusiveIso` einschließlich.
 */
export function sessionDateTimeLocalBounds(
  minExclusiveIso: string,
  maxInclusiveIso: string,
  timeZone: string,
): { min: string; max: string } {
  const minLocal = isoToSessionLocalDateTime(
    Temporal.Instant.from(minExclusiveIso).add({ minutes: 1 }).toString(),
    timeZone,
  );
  const maxLocal = isoToSessionLocalDateTime(maxInclusiveIso, timeZone);
  return { min: minLocal, max: maxLocal };
}

/** Öffnet den nativen Datepicker; fehlende Unterstützung oder Doppelklick bleiben still. */
export function openSessionDateTimePicker(input: HTMLInputElement): void {
  try {
    input.showPicker();
  } catch {
    /* schon offen, kein User-Gesture, iOS-Safari ohne showPicker */
  }
}

/**
 * Native min/max-Gültigkeit. Chromium blendet unerlaubte Räder aus;
 * WebKit/iOS erlaubt sie oft sichtbar und scheitert erst hier.
 */
export function reportSessionDateTimePickerValidity(input: HTMLInputElement): boolean {
  if (input.checkValidity()) {
    return true;
  }
  input.reportValidity();
  return false;
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
