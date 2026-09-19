import { describe, expect, it } from 'vitest';
import { SessionDeadlineController } from './session-deadline';

describe('SessionDeadlineController', () => {
  it('schließt anhand von serverNow plus monoton verstrichener Zeit ohne Terminalevent', () => {
    let monotonicNow = 100;
    const deadline = new SessionDeadlineController({ monotonicNow: () => monotonicNow });
    expect(
      deadline.applySnapshot({
        status: 'ACTIVE',
        serverNow: '2026-09-15T08:00:00.000Z',
        expiresAt: '2026-09-15T08:00:05.000Z',
        sessionLifecycleRevision: 3,
      }),
    ).toBe(true);

    monotonicNow += 4_999;
    expect(deadline.isExpired()).toBe(false);
    monotonicNow += 1;
    expect(deadline.isExpired()).toBe(true);
  });

  it('verwirft ältere Revisionen und abweichende Fristen derselben Revision', () => {
    const deadline = new SessionDeadlineController({ monotonicNow: () => 0 });
    deadline.applySnapshot({
      status: 'ACTIVE',
      serverNow: '2026-09-15T08:00:00.000Z',
      expiresAt: '2026-09-15T09:00:00.000Z',
      sessionLifecycleRevision: 4,
    });
    expect(
      deadline.applySnapshot({
        status: 'ACTIVE',
        serverNow: '2026-09-15T08:01:00.000Z',
        expiresAt: '2026-09-15T10:00:00.000Z',
        sessionLifecycleRevision: 4,
      }),
    ).toBe(false);
    expect(
      deadline.applySnapshot({
        status: 'ACTIVE',
        serverNow: '2026-09-15T08:01:00.000Z',
        expiresAt: '2026-09-15T11:00:00.000Z',
        sessionLifecycleRevision: 2,
      }),
    ).toBe(false);
    expect(deadline.currentExpiresAt()).toBe('2026-09-15T09:00:00.000Z');
  });

  it('lässt verspätete Snapshots die fortgeschriebene Serverzeit nicht zurückdrehen', () => {
    let monotonicNow = 0;
    const deadline = new SessionDeadlineController({ monotonicNow: () => monotonicNow });
    deadline.applySnapshot({
      status: 'ACTIVE',
      serverNow: '2026-09-15T08:00:00.000Z',
      expiresAt: '2026-09-15T08:00:10.000Z',
      sessionLifecycleRevision: 4,
    });
    monotonicNow = 5_000;

    expect(
      deadline.applySnapshot({
        status: 'ACTIVE',
        serverNow: '2026-09-15T08:00:01.000Z',
        expiresAt: '2026-09-15T08:00:10.000Z',
        sessionLifecycleRevision: 4,
      }),
    ).toBe(true);
    expect(deadline.remainingMs()).toBe(5_000);
  });

  it('verwirft einen verspäteten aktiven Snapshot am bereits erreichten Deadlinepunkt', () => {
    let monotonicNow = 0;
    const deadline = new SessionDeadlineController({ monotonicNow: () => monotonicNow });
    deadline.applySnapshot({
      status: 'ACTIVE',
      serverNow: '2026-09-15T08:00:00.000Z',
      expiresAt: '2026-09-15T08:00:01.000Z',
      sessionLifecycleRevision: 4,
    });
    monotonicNow = 1_000;

    expect(
      deadline.applySnapshot({
        status: 'ACTIVE',
        serverNow: '2026-09-15T08:00:00.500Z',
        expiresAt: '2026-09-15T08:00:01.000Z',
        sessionLifecycleRevision: 4,
      }),
    ).toBe(false);
    expect(deadline.isExpired()).toBe(true);
  });

  it('öffnet nach lokalem Ende nur mit höherer aktiver Revision wieder', () => {
    let monotonicNow = 0;
    const deadline = new SessionDeadlineController({ monotonicNow: () => monotonicNow });
    deadline.applySnapshot({
      status: 'ACTIVE',
      serverNow: '2026-09-15T08:00:00.000Z',
      expiresAt: '2026-09-15T08:00:01.000Z',
      sessionLifecycleRevision: 7,
    });
    monotonicNow = 1_000;
    expect(deadline.isExpired()).toBe(true);

    expect(
      deadline.applySnapshot({
        status: 'ACTIVE',
        serverNow: '2026-09-15T08:00:01.000Z',
        expiresAt: '2026-09-15T08:00:01.000Z',
        sessionLifecycleRevision: 7,
      }),
    ).toBe(false);
    expect(deadline.isExpired()).toBe(true);

    expect(
      deadline.applySnapshot({
        status: 'ACTIVE',
        serverNow: '2026-09-15T08:00:01.000Z',
        expiresAt: '2026-09-15T09:00:00.000Z',
        sessionLifecycleRevision: 8,
      }),
    ).toBe(true);
    expect(deadline.isExpired()).toBe(false);
  });

  it('ignoriert unvollständige Legacy-Snapshots im Rolling Deployment', () => {
    const deadline = new SessionDeadlineController();
    expect(deadline.applySnapshot({ status: 'ACTIVE' })).toBe(false);
    expect(deadline.isExpired()).toBe(false);
  });

  it('latched Quiz-FINISHED bei offenem Q&A nicht und übernimmt ACTIVE derselben Revision', () => {
    const deadline = new SessionDeadlineController({ monotonicNow: () => 0 });
    expect(
      deadline.applySnapshot({
        status: 'FINISHED',
        serverNow: '2026-09-19T08:00:00.000Z',
        expiresAt: '2026-09-20T08:00:00.000Z',
        sessionLifecycleRevision: 4,
        channels: {
          qa: {
            enabled: true,
            open: true,
            state: 'OPEN',
            closesAt: '2026-09-20T08:00:00.000Z',
          },
        },
      }),
    ).toBe(true);
    expect(deadline.isExpired()).toBe(false);

    expect(
      deadline.applySnapshot({
        status: 'ACTIVE',
        serverNow: '2026-09-19T08:00:01.000Z',
        expiresAt: '2026-09-20T08:00:00.000Z',
        sessionLifecycleRevision: 4,
        qaClosesAt: '2026-09-20T08:00:00.000Z',
      }),
    ).toBe(true);
    expect(deadline.isExpired()).toBe(false);
  });

  it('behält die Fristsperre nach Quiz-FINISHED ohne offenen Q&A-Kanal', () => {
    const deadline = new SessionDeadlineController({ monotonicNow: () => 0 });
    expect(
      deadline.applySnapshot({
        status: 'FINISHED',
        serverNow: '2026-09-19T08:00:00.000Z',
        expiresAt: '2026-09-20T08:00:00.000Z',
        sessionLifecycleRevision: 4,
      }),
    ).toBe(true);
    expect(deadline.isExpired()).toBe(true);

    expect(
      deadline.applySnapshot({
        status: 'ACTIVE',
        serverNow: '2026-09-19T08:00:01.000Z',
        expiresAt: '2026-09-20T08:00:00.000Z',
        sessionLifecycleRevision: 4,
      }),
    ).toBe(false);
    expect(deadline.isExpired()).toBe(true);
  });

  it('sperrt nach echtem expiresAt trotz offenem Q&A und verwirft dieselbe Revision', () => {
    let monotonicNow = 0;
    const deadline = new SessionDeadlineController({ monotonicNow: () => monotonicNow });
    expect(
      deadline.applySnapshot({
        status: 'FINISHED',
        serverNow: '2026-09-19T08:00:00.000Z',
        expiresAt: '2026-09-19T08:00:01.000Z',
        sessionLifecycleRevision: 4,
        channels: {
          qa: {
            enabled: true,
            open: true,
            state: 'OPEN',
            closesAt: '2026-09-20T08:00:00.000Z',
          },
        },
      }),
    ).toBe(true);
    expect(deadline.isExpired()).toBe(false);

    monotonicNow = 1_000;
    expect(deadline.isExpired()).toBe(true);
    expect(
      deadline.applySnapshot({
        status: 'ACTIVE',
        serverNow: '2026-09-19T08:00:00.500Z',
        expiresAt: '2026-09-19T08:00:01.000Z',
        sessionLifecycleRevision: 4,
        qaClosesAt: '2026-09-20T08:00:00.000Z',
      }),
    ).toBe(false);
    expect(deadline.isExpired()).toBe(true);
  });
});
