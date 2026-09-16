import { describe, expect, it } from 'vitest';
import {
  computeExtendedSessionExpiration,
  computeInitialSessionExpiration,
  computeSessionQaClosesAt,
  getMaxSessionDurationMs,
  SESSION_HARD_MAX_DURATION_MS,
  SESSION_OPERATOR_DEFAULT_MAX_DURATION_MS,
} from './sessionLifecycle';

describe('sessionLifecycle controlled clock', () => {
  const now = new Date('2026-03-20T10:00:00.000Z');

  it('verwendet ohne Auswahl exakt 24 Stunden ab createdAt', () => {
    const createdAt = new Date('2026-03-20T10:00:00.000Z');
    expect(
      computeInitialSessionExpiration({
        createdAt,
        now,
        timeZone: 'Europe/Berlin',
      }).toISOString(),
    ).toBe('2026-03-21T10:00:00.000Z');
  });

  it('rechnet Kalendertage über den Beginn der Sommerzeit in der Sessionzeitzone', () => {
    const createdAt = new Date('2026-03-28T11:00:00.000Z'); // 12:00 CET
    expect(
      computeInitialSessionExpiration({
        createdAt,
        now,
        timeZone: 'Europe/Berlin',
        selection: { kind: 'DURATION_DAYS', days: 1 },
      }).toISOString(),
    ).toBe('2026-03-29T10:00:00.000Z'); // 12:00 CEST
  });

  it('bewahrt eine unveränderte abgelaufene Q&A-Frist', () => {
    const stored = new Date('2026-03-20T09:00:00.123Z');
    expect(
      computeSessionQaClosesAt({
        createdAt: new Date('2026-03-19T10:00:00.000Z'),
        currentExpiresAt: new Date('2026-03-21T10:00:00.000Z'),
        openedAt: now,
        timeZone: 'Europe/Berlin',
        selection: { kind: 'ABSOLUTE', closesAt: stored.toISOString() },
        allowUnchangedPastClosesAt: stored,
      }).toISOString(),
    ).toBe('2026-03-20T09:00:00.123Z');
  });

  it('lehnt eine neue abgelaufene Q&A-Frist weiter ab', () => {
    expect(() =>
      computeSessionQaClosesAt({
        createdAt: new Date('2026-03-19T10:00:00.000Z'),
        currentExpiresAt: new Date('2026-03-21T10:00:00.000Z'),
        openedAt: now,
        timeZone: 'Europe/Berlin',
        selection: { kind: 'ABSOLUTE', closesAt: '2026-03-20T09:00:00.000Z' },
        allowUnchangedPastClosesAt: new Date('2026-03-20T08:00:00.000Z'),
      }),
    ).toThrow(/Zukunft/);
  });

  it('rechnet Q&A-Kalendertage ab dem Öffnungszeitpunkt über die Sommerzeit', () => {
    expect(
      computeSessionQaClosesAt({
        createdAt: new Date('2026-03-20T10:00:00.000Z'),
        currentExpiresAt: new Date('2026-04-03T10:00:00.000Z'),
        openedAt: new Date('2026-03-28T11:00:00.000Z'),
        timeZone: 'Europe/Berlin',
        selection: { kind: 'DURATION_DAYS', days: 1 },
      }).toISOString(),
    ).toBe('2026-03-29T10:00:00.000Z');
  });

  it('rechnet Kalendertage über das Ende der Sommerzeit ab bisherigem expiresAt', () => {
    const createdAt = new Date('2026-10-20T10:00:00.000Z');
    const currentExpiresAt = new Date('2026-10-24T10:00:00.000Z'); // 12:00 CEST
    expect(
      computeExtendedSessionExpiration({
        createdAt,
        currentExpiresAt,
        now: new Date('2026-10-24T09:00:00.000Z'),
        timeZone: 'Europe/Berlin',
        selection: { kind: 'QUICK', amount: 'ONE_DAY' },
      }).toISOString(),
    ).toBe('2026-10-25T11:00:00.000Z'); // 12:00 CET
  });

  it('round-tript bei absoluter Auswahl genau denselben UTC-Zeitpunkt', () => {
    const expiresAt = computeExtendedSessionExpiration({
      createdAt: new Date('2026-03-20T10:00:00.000Z'),
      currentExpiresAt: new Date('2026-03-21T10:00:00.000Z'),
      now,
      timeZone: 'Europe/Berlin',
      selection: { kind: 'ABSOLUTE', expiresAt: '2026-03-25T18:30:00+02:00' },
    });
    expect(expiresAt.toISOString()).toBe('2026-03-25T16:30:00.000Z');
  });

  it('lehnt Vergangenheit, unbekannte Zeitzonen und Obergrenzenüberschreitungen ab', () => {
    const createdAt = new Date('2026-03-20T10:00:00.000Z');
    expect(() =>
      computeInitialSessionExpiration({
        createdAt,
        now,
        timeZone: 'Europe/Berlin',
        selection: { kind: 'ABSOLUTE', expiresAt: '2026-03-20T09:59:59Z' },
      }),
    ).toThrow('Zukunft');
    expect(() =>
      computeInitialSessionExpiration({
        createdAt,
        now,
        timeZone: 'Not/A_Time_Zone',
      }),
    ).toThrow('Zeitzone');
    expect(() =>
      computeInitialSessionExpiration({
        createdAt,
        now,
        timeZone: 'UTC',
        selection: { kind: 'ABSOLUTE', expiresAt: '2026-04-04T10:00:00.001Z' },
      }),
    ).toThrow('maximal');
  });

  it('verwendet 14 Tage Betreiberdefault und erzwingt 24h bis 30 Tage', () => {
    expect(getMaxSessionDurationMs(undefined)).toBe(SESSION_OPERATOR_DEFAULT_MAX_DURATION_MS);
    expect(getMaxSessionDurationMs('PT24H')).toBe(24 * 60 * 60 * 1000);
    expect(getMaxSessionDurationMs('14d')).toBe(14 * 24 * 60 * 60 * 1000);
    expect(getMaxSessionDurationMs('P30D')).toBe(SESSION_HARD_MAX_DURATION_MS);
    expect(getMaxSessionDurationMs('23h')).toBe(SESSION_OPERATOR_DEFAULT_MAX_DURATION_MS);
    expect(getMaxSessionDurationMs('31d')).toBe(SESSION_OPERATOR_DEFAULT_MAX_DURATION_MS);
    expect(getMaxSessionDurationMs('garbage')).toBe(SESSION_OPERATOR_DEFAULT_MAX_DURATION_MS);
  });
});
