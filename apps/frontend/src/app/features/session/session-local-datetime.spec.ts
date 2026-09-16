import { describe, expect, it } from 'vitest';
import {
  addCalendarDays,
  isoToSessionLocalDateTime,
  maxSelectableCalendarDays,
  sessionLocalDateTimeToIso,
} from './session-local-datetime';

describe('session-local-datetime', () => {
  it('rechnet Kalendertage über den Beginn der Sommerzeit', () => {
    expect(addCalendarDays('2026-03-28T11:00:00.000Z', 1, 'Europe/Berlin')).toBe(
      '2026-03-29T10:00:00Z',
    );
  });

  it('rechnet Kalendertage über das Ende der Sommerzeit', () => {
    expect(addCalendarDays('2026-10-24T10:00:00.000Z', 1, 'Europe/Berlin')).toBe(
      '2026-10-25T11:00:00Z',
    );
  });

  it('bietet kurz nach Erstellung weiter die volle 14-Tage-Obergrenze ab createdAt', () => {
    expect(
      maxSelectableCalendarDays(
        '2026-03-24T12:00:00.000Z',
        '2026-04-07T12:00:00.000Z',
        'Europe/Berlin',
      ),
    ).toBe(14);
  });

  it('bietet nicht 14 Tage, wenn der Bezugspunkt später als createdAt liegt', () => {
    expect(
      maxSelectableCalendarDays(
        '2026-01-01T13:00:00.000Z',
        '2026-01-15T12:00:00.000Z',
        'Europe/Berlin',
      ),
    ).toBe(13);
  });

  it('liefert 0, wenn kein voller Kalendertag mehr zulässig ist', () => {
    expect(
      maxSelectableCalendarDays(
        '2026-04-07T11:30:00.000Z',
        '2026-04-07T12:00:00.000Z',
        'Europe/Berlin',
      ),
    ).toBe(0);
  });

  it('rundet datetime-local in der Sessionzeitzone um', () => {
    const local = isoToSessionLocalDateTime('2026-09-16T04:00:00.000Z', 'Europe/Berlin');
    expect(local).toBe('2026-09-16T06:00');
    expect(sessionLocalDateTimeToIso(local, 'Europe/Berlin')).toBe('2026-09-16T04:00:00Z');
  });
});
