import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  enqueueProductFeedbackOutbox,
  flushProductFeedbackOutbox,
  installProductFeedbackOutboxOnlineRetry,
  isProductFeedbackInCooldown,
  loadProductFeedbackOutbox,
  markProductFeedbackCooldown,
  rememberPendingHostInvite,
  consumePendingHostInvite,
  suppressProductFeedbackSurvey,
  isProductFeedbackSuppressed,
  removeProductFeedbackOutboxItem,
} from './product-feedback-storage';

describe('product-feedback-storage', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('merkt Cooldown und Suppress lokal', () => {
    expect(isProductFeedbackInCooldown('POST_SESSION_V1:HOST', 1000)).toBe(false);
    markProductFeedbackCooldown('POST_SESSION_V1:HOST');
    expect(isProductFeedbackInCooldown('POST_SESSION_V1:HOST', 60_000)).toBe(true);
    expect(isProductFeedbackInCooldown('POST_SESSION_VALUE_HOST_V1', 60_000)).toBe(false);
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

  it('flusht IN_APP-Submit und Follow-up über getrennte Sender', async () => {
    enqueueProductFeedbackOutbox({
      id: 'in-app-submit',
      kind: 'inAppSubmit',
      payload: { idempotencyKey: 'same-key' },
      createdAt: Date.now(),
    });
    enqueueProductFeedbackOutbox({
      id: 'in-app-follow-up',
      kind: 'inAppFollowUp',
      payload: { idempotencyKey: 'follow-up-key' },
      createdAt: Date.now(),
    });
    const inAppSubmit = vi.fn().mockResolvedValue({ ok: true });
    const inAppFollowUp = vi.fn().mockResolvedValue({ ok: true });

    await flushProductFeedbackOutbox({
      submit: vi.fn(),
      followUp: vi.fn(),
      inAppSubmit,
      inAppFollowUp,
    });

    expect(inAppSubmit).toHaveBeenCalledWith({ idempotencyKey: 'same-key' });
    expect(inAppFollowUp).toHaveBeenCalledWith({ idempotencyKey: 'follow-up-key' });
    expect(loadProductFeedbackOutbox()).toEqual([]);
  });

  it('dedupliziert nach Id und erlaubt gerätelokales Löschen', () => {
    enqueueProductFeedbackOutbox({
      id: 'same',
      kind: 'inAppSubmit',
      payload: { attempt: 1 },
      createdAt: Date.now(),
    });
    enqueueProductFeedbackOutbox({
      id: 'same',
      kind: 'inAppSubmit',
      payload: { attempt: 2 },
      createdAt: Date.now(),
    });
    expect(loadProductFeedbackOutbox()).toHaveLength(1);
    expect(loadProductFeedbackOutbox()[0]?.payload).toEqual({ attempt: 2 });
    removeProductFeedbackOutboxItem('same');
    expect(loadProductFeedbackOutbox()).toEqual([]);
  });

  it('sendet die Outbox beim Installieren und bei späterem Online-Event erneut', async () => {
    enqueueProductFeedbackOutbox({
      id: 'startup-1',
      kind: 'submit',
      payload: { a: 1 },
      createdAt: Date.now(),
    });
    const submit = vi.fn().mockResolvedValue({ ok: true });
    const remove = installProductFeedbackOutboxOnlineRetry({
      submit,
      followUp: vi.fn(),
    });
    await vi.waitFor(() => expect(submit).toHaveBeenCalledOnce());
    expect(loadProductFeedbackOutbox()).toEqual([]);

    enqueueProductFeedbackOutbox({
      id: 'reconnect-1',
      kind: 'submit',
      payload: { a: 2 },
      createdAt: Date.now(),
    });
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
    expect(loadProductFeedbackOutbox()).toEqual([]);
    remove();
  });

  it('verwirft fachlich endgültig abgelehnte Outbox-Einträge', async () => {
    enqueueProductFeedbackOutbox({
      id: 'expired-1',
      kind: 'submit',
      payload: {},
      createdAt: Date.now(),
    });
    await flushProductFeedbackOutbox({
      submit: vi.fn().mockRejectedValue({ data: { code: 'NOT_FOUND' } }),
      followUp: vi.fn(),
    });
    expect(loadProductFeedbackOutbox()).toEqual([]);
  });
});

it('entfernt abgelaufene Outbox-Einträge aus localStorage', () => {
  const old = Date.now() - 8 * 24 * 60 * 60 * 1000;
  localStorage.setItem(
    'productFeedback:outbox:v1',
    JSON.stringify([
      { id: 'aged', kind: 'submit', payload: {}, createdAt: old },
      { id: 'fresh', kind: 'submit', payload: {}, createdAt: Date.now() },
    ]),
  );
  const left = loadProductFeedbackOutbox();
  expect(left).toHaveLength(1);
  expect(left[0]?.id).toBe('fresh');
  const raw = JSON.parse(localStorage.getItem('productFeedback:outbox:v1')!);
  expect(raw).toHaveLength(1);
  expect(raw[0]?.id).toBe('fresh');
});
