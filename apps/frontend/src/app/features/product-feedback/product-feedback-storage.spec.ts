import { afterEach, describe, expect, it } from 'vitest';
import {
  isProductFeedbackInCooldown,
  markProductFeedbackCooldown,
  rememberPendingHostInvite,
  consumePendingHostInvite,
  suppressProductFeedbackSurvey,
  isProductFeedbackSuppressed,
} from './product-feedback-storage';

describe('product-feedback-storage', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('merkt Cooldown und Suppress lokal', () => {
    expect(isProductFeedbackInCooldown('POST_SESSION_EASE_HOST_V1', 1000)).toBe(false);
    markProductFeedbackCooldown('POST_SESSION_EASE_HOST_V1');
    expect(isProductFeedbackInCooldown('POST_SESSION_EASE_HOST_V1', 60_000)).toBe(true);
    suppressProductFeedbackSurvey('POST_SESSION_VALUE_HOST_V1');
    expect(isProductFeedbackSuppressed('POST_SESSION_VALUE_HOST_V1')).toBe(true);
  });

  it('konsumiert Pending-Host-Invite einmalig', () => {
    rememberPendingHostInvite('abc123');
    const first = consumePendingHostInvite();
    expect(first?.sessionCode).toBe('ABC123');
    expect(consumePendingHostInvite()).toBeNull();
  });
});
