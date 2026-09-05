import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  enqueueProductFeedbackOutbox,
  flushProductFeedbackOutbox,
  isProductFeedbackInCooldown,
  loadProductFeedbackOutbox,
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

  it('flusht Outbox und behält fehlgeschlagene Einträge', async () => {
    enqueueProductFeedbackOutbox({
      id: 'ok-1',
      kind: 'submit',
      payload: { a: 1 },
      createdAt: Date.now(),
    });
    enqueueProductFeedbackOutbox({
      id: 'fail-1',
      kind: 'followUp',
      payload: { b: 2 },
      createdAt: Date.now(),
    });
    const submit = vi.fn().mockResolvedValue({ ok: true });
    const followUp = vi.fn().mockRejectedValue(new Error('offline'));
    await flushProductFeedbackOutbox({ submit, followUp });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(followUp).toHaveBeenCalledTimes(1);
    const left = loadProductFeedbackOutbox();
    expect(left).toHaveLength(1);
    expect(left[0]?.id).toBe('fail-1');
  });
});
