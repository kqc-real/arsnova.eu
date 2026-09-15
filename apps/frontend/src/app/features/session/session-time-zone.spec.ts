import { describe, expect, it } from 'vitest';
import { sessionLocalDateTimeToIso } from './session-time-zone';

describe('sessionLocalDateTimeToIso', () => {
  it('normalisiert eine eindeutige lokale Zeit auf denselben UTC-Zeitpunkt', () => {
    expect(sessionLocalDateTimeToIso('2026-03-25T18:30', 'Europe/Berlin')).toBe(
      '2026-03-25T17:30:00Z',
    );
  });

  it('lehnt nicht existente und doppelte DST-Uhrzeiten ab', () => {
    expect(() => sessionLocalDateTimeToIso('2026-03-29T02:30', 'Europe/Berlin')).toThrow();
    expect(() => sessionLocalDateTimeToIso('2026-10-25T02:30', 'Europe/Berlin')).toThrow();
  });
});
