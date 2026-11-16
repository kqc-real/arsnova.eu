import { describe, expect, it } from 'vitest';
import { advanceQuickFeedbackLockVersion } from './quickFeedbackLockVersion';

describe('advanceQuickFeedbackLockVersion', () => {
  it('migriert einen alten Stand implizit und erhöht danach monoton', () => {
    const state: { lockVersion?: number } = {};

    expect(advanceQuickFeedbackLockVersion(state)).toBe(1);
    expect(state.lockVersion).toBe(1);
    expect(advanceQuickFeedbackLockVersion(state)).toBe(2);
    expect(state.lockVersion).toBe(2);
  });

  it('setzt einen vorhandenen Stand fort', () => {
    const state = { lockVersion: 7 };

    expect(advanceQuickFeedbackLockVersion(state)).toBe(8);
    expect(state.lockVersion).toBe(8);
  });
});
