import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  emitQaQuestionsSignal,
  getQaQuestionsSignalVersion,
  qaSubscriptionWaitMs,
  resetQaQuestionsSignalsForTests,
  waitForQaQuestionsSignal,
} from './qaQuestionsSignal';

describe('qaQuestionsSignal', () => {
  afterEach(() => {
    resetQaQuestionsSignalsForTests();
  });

  it('weckt wartende Subscriber sofort bei immediate', async () => {
    const started = waitForQaQuestionsSignal('session-1', 0, 15_000);
    emitQaQuestionsSignal('session-1', { immediate: true });
    await expect(started).resolves.toBeUndefined();
    expect(getQaQuestionsSignalVersion('session-1')).toBe(1);
  });

  it('bündelt aufeinanderfolgende Vote-Signale', async () => {
    vi.useFakeTimers();
    emitQaQuestionsSignal('session-2');
    emitQaQuestionsSignal('session-2');
    expect(getQaQuestionsSignalVersion('session-2')).toBe(0);
    await vi.advanceTimersByTimeAsync(150);
    expect(getQaQuestionsSignalVersion('session-2')).toBe(1);
    vi.useRealTimers();
  });

  it('begrenzt die Wartezeit auf die Q&A-Frist', () => {
    expect(
      qaSubscriptionWaitMs(
        '2026-09-17T14:30:00.000Z',
        15_000,
        Date.parse('2026-09-17T14:29:50.000Z'),
      ),
    ).toBe(10_000);
    expect(
      qaSubscriptionWaitMs(
        '2026-09-17T14:30:00.000Z',
        15_000,
        Date.parse('2026-09-17T14:31:00.000Z'),
      ),
    ).toBe(1);
  });
});
