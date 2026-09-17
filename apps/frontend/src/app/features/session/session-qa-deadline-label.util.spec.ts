import { describe, expect, it } from 'vitest';
import { resolveQaDeadlineClockParts } from './session-qa-deadline-label.util';

describe('resolveQaDeadlineClockParts', () => {
  const nowMs = Date.parse('2026-09-17T15:30:00.000Z');

  it('liefert null ohne Frist', () => {
    expect(
      resolveQaDeadlineClockParts({
        closesAt: null,
        nowMs,
        localeId: 'de',
        timeZone: 'Europe/Berlin',
      }),
    ).toBeNull();
  });

  it('formatiert offene Fristen mit Stundenrest wie auf Host und Vote', () => {
    const parts = resolveQaDeadlineClockParts({
      closesAt: '2026-09-18T12:30:00.000Z',
      nowMs,
      localeId: 'de',
      timeZone: 'Europe/Berlin',
    });

    expect(parts?.remainingMs).toBe(21 * 60 * 60_000);
    expect(parts?.formatted).toContain('18');
    expect(parts?.formatted).toContain('Sept');
    expect(parts?.relative).toBe('in 21 Stunden');
  });

  it('wechselt unter 90 Minuten auf Minuten', () => {
    const parts = resolveQaDeadlineClockParts({
      closesAt: '2026-09-17T16:05:00.000Z',
      nowMs,
      localeId: 'de',
      timeZone: 'Europe/Berlin',
    });

    expect(parts?.relative).toBe('in 35 Minuten');
  });

  it('wechselt ab 48 Stunden auf Tage', () => {
    const parts = resolveQaDeadlineClockParts({
      closesAt: '2026-09-20T15:30:00.000Z',
      nowMs,
      localeId: 'de',
      timeZone: 'Europe/Berlin',
    });

    expect(parts?.relative).toBe('in 3 Tagen');
  });

  it('markiert abgelaufene Fristen ohne Relativtext', () => {
    const parts = resolveQaDeadlineClockParts({
      closesAt: '2026-09-17T14:00:00.000Z',
      nowMs,
      localeId: 'de',
      timeZone: 'Europe/Berlin',
    });

    expect(parts?.remainingMs).toBeLessThan(0);
    expect(parts?.relative).toBe('');
    expect(parts?.formatted.length).toBeGreaterThan(0);
  });
});
