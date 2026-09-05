/**
 * Client-seitiger Zustand für ProductFeedback (Cooldown, Abwahl, Offline-Postausgang).
 * Kein geräteübergreifendes Profil — nur localStorage.
 */
import type { ProductFeedbackDeviceClass, ProductFeedbackSubmitInput } from '@arsnova/shared-types';

const COOLDOWN_PREFIX = 'productFeedback:cooldown:v1:';
const SUPPRESS_PREFIX = 'productFeedback:suppress:v1:';
const OUTBOX_KEY = 'productFeedback:outbox:v1';
const PENDING_HOST_KEY = 'productFeedback:pendingHost:v1';

export const PRODUCT_FEEDBACK_PARTICIPANT_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
export const PRODUCT_FEEDBACK_HOST_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
export const PRODUCT_FEEDBACK_OUTBOX_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type ProductFeedbackOutboxItem = {
  id: string;
  kind: 'submit' | 'followUp';
  payload: Record<string, unknown>;
  createdAt: number;
};

export type PendingHostInvite = {
  sessionCode: string;
  storedAt: number;
};

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

export function isProductFeedbackSuppressed(surveyKey: string): boolean {
  if (!canUseStorage()) return false;
  return localStorage.getItem(`${SUPPRESS_PREFIX}${surveyKey}`) === '1';
}

export function suppressProductFeedbackSurvey(surveyKey: string): void {
  if (!canUseStorage()) return;
  localStorage.setItem(`${SUPPRESS_PREFIX}${surveyKey}`, '1');
}

export function isProductFeedbackInCooldown(surveyKey: string, cooldownMs: number): boolean {
  if (!canUseStorage()) return false;
  if (isProductFeedbackSuppressed(surveyKey)) return true;
  const raw = localStorage.getItem(`${COOLDOWN_PREFIX}${surveyKey}`);
  if (!raw) return false;
  const at = Number(raw);
  if (!Number.isFinite(at)) return false;
  return Date.now() - at < cooldownMs;
}

export function markProductFeedbackCooldown(surveyKey: string): void {
  if (!canUseStorage()) return;
  localStorage.setItem(`${COOLDOWN_PREFIX}${surveyKey}`, String(Date.now()));
}

export function rememberPendingHostInvite(sessionCode: string): void {
  if (!canUseStorage()) return;
  const payload: PendingHostInvite = {
    sessionCode: sessionCode.trim().toUpperCase(),
    storedAt: Date.now(),
  };
  localStorage.setItem(PENDING_HOST_KEY, JSON.stringify(payload));
}

export function consumePendingHostInvite(
  maxAgeMs = PRODUCT_FEEDBACK_HOST_COOLDOWN_MS,
): PendingHostInvite | null {
  if (!canUseStorage()) return null;
  const raw = localStorage.getItem(PENDING_HOST_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingHostInvite;
    if (!parsed.sessionCode || !Number.isFinite(parsed.storedAt)) {
      localStorage.removeItem(PENDING_HOST_KEY);
      return null;
    }
    if (Date.now() - parsed.storedAt > maxAgeMs) {
      localStorage.removeItem(PENDING_HOST_KEY);
      return null;
    }
    localStorage.removeItem(PENDING_HOST_KEY);
    return parsed;
  } catch {
    localStorage.removeItem(PENDING_HOST_KEY);
    return null;
  }
}

export function peekPendingHostInvite(): PendingHostInvite | null {
  if (!canUseStorage()) return null;
  const raw = localStorage.getItem(PENDING_HOST_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingHostInvite;
  } catch {
    return null;
  }
}

export function clearPendingHostInvite(): void {
  if (!canUseStorage()) return;
  localStorage.removeItem(PENDING_HOST_KEY);
}

export function loadProductFeedbackOutbox(): ProductFeedbackOutboxItem[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw) as ProductFeedbackOutboxItem[];
    const now = Date.now();
    return items.filter((i) => now - i.createdAt < PRODUCT_FEEDBACK_OUTBOX_MAX_AGE_MS);
  } catch {
    return [];
  }
}

export function saveProductFeedbackOutbox(items: ProductFeedbackOutboxItem[]): void {
  if (!canUseStorage()) return;
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
}

export function enqueueProductFeedbackOutbox(item: ProductFeedbackOutboxItem): void {
  const items = loadProductFeedbackOutbox();
  items.push(item);
  saveProductFeedbackOutbox(items);
}

export function removeProductFeedbackOutboxItem(id: string): void {
  saveProductFeedbackOutbox(loadProductFeedbackOutbox().filter((i) => i.id !== id));
}

export type ProductFeedbackOutboxSender = {
  submit: (payload: Record<string, unknown>) => Promise<unknown>;
  followUp: (payload: Record<string, unknown>) => Promise<unknown>;
};

/** Sendet vorgemerkte Payloads erneut; erfolgreiche Einträge werden entfernt. */
export async function flushProductFeedbackOutbox(
  sender: ProductFeedbackOutboxSender,
): Promise<void> {
  const items = loadProductFeedbackOutbox();
  if (items.length === 0) return;
  const remaining: ProductFeedbackOutboxItem[] = [];
  for (const item of items) {
    try {
      if (item.kind === 'submit') {
        await sender.submit(item.payload);
      } else {
        await sender.followUp(item.payload);
      }
    } catch {
      remaining.push(item);
    }
  }
  saveProductFeedbackOutbox(remaining);
}

export function detectProductFeedbackDeviceClass(): ProductFeedbackDeviceClass {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'UNKNOWN';
  }
  if (window.matchMedia('(pointer: coarse) and (max-width: 600px)').matches) {
    return 'PHONE';
  }
  if (window.matchMedia('(pointer: coarse) and (max-width: 1024px)').matches) {
    return 'TABLET';
  }
  if (window.matchMedia('(pointer: fine)').matches) {
    return 'DESKTOP';
  }
  return 'UNKNOWN';
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export type { ProductFeedbackSubmitInput };
