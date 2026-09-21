import { describe, expect, it, vi } from 'vitest';
import {
  addCalendarDays,
  isoToSessionLocalDateTime,
  laterIsoTimestamp,
  maxSelectableCalendarDays,
  openSessionDateTimePicker,
  reportSessionDateTimePickerValidity,
  sessionDateTimeLocalBounds,
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

  it('lehnt eine mehrdeutige lokale Uhrzeit in der doppelten Stunde ab', () => {
    expect(() => sessionLocalDateTimeToIso('2026-10-25T02:30', 'Europe/Berlin')).toThrow();
  });

  it('begrenzt den Datepicker auf die nächste Minute bis zur Obergrenze', () => {
    expect(
      sessionDateTimeLocalBounds(
        '2026-03-25T11:30:00.000Z',
        '2026-04-07T12:00:00.000Z',
        'Europe/Berlin',
      ),
    ).toEqual({
      min: '2026-03-25T12:31',
      max: '2026-04-07T14:00',
    });
  });

  it('nimmt für die Untergrenze den späteren von Sessionende und Serverzeit', () => {
    expect(laterIsoTimestamp('2026-03-25T12:00:00.000Z', '2026-03-25T11:30:00.000Z')).toBe(
      '2026-03-25T12:00:00.000Z',
    );
    expect(
      sessionDateTimeLocalBounds(
        laterIsoTimestamp('2026-03-25T12:00:00.000Z', '2026-03-25T11:30:00.000Z'),
        '2026-04-07T12:00:00.000Z',
        'Europe/Berlin',
      ),
    ).toEqual({
      min: '2026-03-25T13:01',
      max: '2026-04-07T14:00',
    });
  });

  it('öffnet den nativen Datepicker und schluckt fehlende Unterstützung', () => {
    const showPicker = vi.fn();
    openSessionDateTimePicker({ showPicker } as unknown as HTMLInputElement);
    expect(showPicker).toHaveBeenCalledTimes(1);

    openSessionDateTimePicker({
      showPicker: () => {
        throw new Error('already open');
      },
    } as unknown as HTMLInputElement);
  });

  it('lehnt Werte außerhalb von min/max auch ohne Picker-UI ab', () => {
    const reportValidity = vi.fn();
    expect(
      reportSessionDateTimePickerValidity({
        checkValidity: () => true,
        reportValidity,
      } as unknown as HTMLInputElement),
    ).toBe(true);
    expect(reportValidity).not.toHaveBeenCalled();
    expect(
      reportSessionDateTimePickerValidity({
        checkValidity: () => false,
        reportValidity,
      } as unknown as HTMLInputElement),
    ).toBe(false);
    expect(reportValidity).toHaveBeenCalledTimes(1);
  });

  it('rundet datetime-local in der Sessionzeitzone um', () => {
    const local = isoToSessionLocalDateTime('2026-09-16T04:00:00.000Z', 'Europe/Berlin');
    expect(local).toBe('2026-09-16T06:00');
    expect(sessionLocalDateTimeToIso(local, 'Europe/Berlin')).toBe('2026-09-16T04:00:00Z');
  });
});
