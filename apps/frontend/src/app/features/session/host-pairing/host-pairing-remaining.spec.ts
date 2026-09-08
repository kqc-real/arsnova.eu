import { describe, expect, it } from 'vitest';
import {
  HOST_PAIRING_REMAINING_TICK_MS,
  formatHostPairingRemainingClock,
} from './host-pairing-remaining';

describe('formatHostPairingRemainingClock', () => {
  it('tickt in der UI einmal pro Sekunde', () => {
    expect(HOST_PAIRING_REMAINING_TICK_MS).toBe(1000);
  });

  it('formatiert die Restzeit als Minuten:Sekunden', () => {
    const now = Date.parse('2026-09-07T14:00:00.000Z');
    expect(formatHostPairingRemainingClock('2026-09-07T14:04:32.000Z', now)).toBe('4:32');
  });

  it('bleibt bei abgelaufenem Zeitpunkt bei 0:00', () => {
    const now = Date.parse('2026-09-07T14:10:00.000Z');
    expect(formatHostPairingRemainingClock('2026-09-07T14:00:00.000Z', now)).toBe('0:00');
  });

  it('liefert null ohne gültigen Zeitpunkt', () => {
    expect(formatHostPairingRemainingClock(null, Date.now())).toBeNull();
    expect(formatHostPairingRemainingClock('kein-datum', Date.now())).toBeNull();
  });
});
