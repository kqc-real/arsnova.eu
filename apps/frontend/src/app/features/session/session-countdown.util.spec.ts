import { describe, expect, it } from 'vitest';
import { remainingCountdownSeconds, stableCountdownDeadlineMs } from './session-countdown.util';

describe('remainingCountdownSeconds', () => {
  it('nutzt ceil und null nicht unter 0', () => {
    const deadline = 10_000;
    expect(remainingCountdownSeconds(deadline, 1000)).toBe(9);
    expect(remainingCountdownSeconds(deadline, 9001)).toBe(1);
    expect(remainingCountdownSeconds(deadline, 9999)).toBe(1);
    expect(remainingCountdownSeconds(deadline, 10_000)).toBe(0);
    expect(remainingCountdownSeconds(deadline, 11_000)).toBe(0);
  });
});

describe('stableCountdownDeadlineMs', () => {
  it('behält die Deadline beim Polling ohne activeAt', () => {
    const running = stableCountdownDeadlineMs({
      timerSeconds: 30,
      currentDeadlineMs: 80_000,
      currentKey: 'q1:1:30',
      nextKey: 'q1:1:30',
      nowMs: 51_000,
    });
    expect(running).toBe(80_000);
  });

  it('setzt die Deadline aus activeAt, sobald der Server sie liefert', () => {
    const fromServer = stableCountdownDeadlineMs({
      timerSeconds: 30,
      activeAt: new Date(50_000).toISOString(),
      currentDeadlineMs: 80_000,
      currentKey: 'q1:1:30',
      nextKey: 'q1:1:30',
      nowMs: 51_000,
    });
    expect(fromServer).toBe(80_000);
  });

  it('startet bei neuer Frage einen neuen Countdown', () => {
    const nextQuestion = stableCountdownDeadlineMs({
      timerSeconds: 30,
      currentDeadlineMs: 80_000,
      currentKey: 'q1:1:30',
      nextKey: 'q2:1:30',
      nowMs: 51_000,
    });
    expect(nextQuestion).toBe(81_000);
  });
});
