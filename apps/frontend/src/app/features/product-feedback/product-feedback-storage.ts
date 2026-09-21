/**
 * Client-seitiger Zustand für ProductFeedback (Cooldown, Abwahl, Offline-Postausgang).
 * Kein geräteübergreifendes Profil — nur localStorage.
 */
import {
  PRODUCT_FEEDBACK_INVITE_TTL_SECONDS,
  type ProductFeedbackDeviceClass,
  type ProductFeedbackInAppSubmitInput,
  type ProductFeedbackRole,
  type ProductFeedbackSubmitInput,
  type ProductFeedbackSurveyDTO,
} from '@arsnova/shared-types';

const COOLDOWN_PREFIX = 'productFeedback:cooldown:v1:';
const SUPPRESS_PREFIX = 'productFeedback:suppress:v1:';
const OUTBOX_KEY = 'productFeedback:outbox:v1';
const PENDING_HOST_KEY = 'productFeedback:pendingHost:v1';
const PARTICIPANT_CLAIM_PREFIX = 'productFeedback:participantClaim:v1:';
const CLAIMED_INVITE_PREFIX = 'productFeedback:claimedInvite:v1:';
const CLAIMED_INVITE_MAX_AGE_MS = PRODUCT_FEEDBACK_INVITE_TTL_SECONDS * 1000;

export const PRODUCT_FEEDBACK_PARTICIPANT_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
export const PRODUCT_FEEDBACK_HOST_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
export const PRODUCT_FEEDBACK_OUTBOX_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type ProductFeedbackOutboxItem = {
  id: string;
  kind: 'submit' | 'followUp' | 'inAppSubmit' | 'inAppFollowUp';
  payload: Record<string, unknown>;
  createdAt: number;
};

export type PendingHostInvite = {
  sessionCode: string;
  storedAt: number;
};

export type ClaimedProductFeedbackInvite = {
  inviteToken: string;
  survey: ProductFeedbackSurveyDTO;
  storedAt: number;
};

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

function canUseSessionStorage(): boolean {
  return typeof sessionStorage !== 'undefined';
}

function claimedInviteKey(sessionCode: string, role: ProductFeedbackRole): string {
  return `${CLAIMED_INVITE_PREFIX}${role}:${sessionCode.trim().toUpperCase()}`;
}

export function isProductFeedbackSuppressed(surveyKey: string): boolean {
  if (!canUseStorage()) return false;
  return localStorage.getItem(`${SUPPRESS_PREFIX}${surveyKey}`) === '1';
}

export function suppressProductFeedbackSurvey(surveyKey: string): void {
  if (!canUseStorage()) return;
  localStorage.setItem(`${SUPPRESS_PREFIX}${surveyKey}`, '1');
}

export function isProductFeedbackInCooldown(scope: string, cooldownMs: number): boolean {
  if (!canUseStorage()) return false;
  const raw = localStorage.getItem(`${COOLDOWN_PREFIX}${scope}`);
  if (!raw) return false;
  const at = Number(raw);
  if (!Number.isFinite(at)) return false;
  return Date.now() - at < cooldownMs;
}

export function markProductFeedbackCooldown(scope: string): void {
  if (!canUseStorage()) return;
  localStorage.setItem(`${COOLDOWN_PREFIX}${scope}`, String(Date.now()));
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

export function storeProductFeedbackParticipantClaimToken(
  sessionCode: string,
  token: string | null | undefined,
): void {
  if (!canUseStorage() || !token) return;
  localStorage.setItem(`${PARTICIPANT_CLAIM_PREFIX}${sessionCode.trim().toUpperCase()}`, token);
}

export function getProductFeedbackParticipantClaimToken(sessionCode: string): string | undefined {
  if (!canUseStorage()) return undefined;
  return (
    localStorage.getItem(`${PARTICIPANT_CLAIM_PREFIX}${sessionCode.trim().toUpperCase()}`) ??
    undefined
  );
}

/** Tab-lokaler Invite nach dem ersten Claim, damit Reload die Karte nicht verliert. */
export function storeClaimedProductFeedbackInvite(
  sessionCode: string,
  role: ProductFeedbackRole,
  invite: { inviteToken: string; survey: ProductFeedbackSurveyDTO },
): void {
  if (!canUseSessionStorage() || !invite.inviteToken || !invite.survey) return;
  const payload: ClaimedProductFeedbackInvite = {
    inviteToken: invite.inviteToken,
    survey: invite.survey,
    storedAt: Date.now(),
  };
  sessionStorage.setItem(claimedInviteKey(sessionCode, role), JSON.stringify(payload));
}

export function peekClaimedProductFeedbackInvite(
  sessionCode: string,
  role: ProductFeedbackRole,
): ClaimedProductFeedbackInvite | null {
  if (!canUseSessionStorage()) return null;
  const raw = sessionStorage.getItem(claimedInviteKey(sessionCode, role));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ClaimedProductFeedbackInvite;
    if (!parsed.inviteToken || !parsed.survey || !Number.isFinite(parsed.storedAt)) {
      sessionStorage.removeItem(claimedInviteKey(sessionCode, role));
      return null;
    }
    if (Date.now() - parsed.storedAt > CLAIMED_INVITE_MAX_AGE_MS) {
      sessionStorage.removeItem(claimedInviteKey(sessionCode, role));
      return null;
    }
    return parsed;
  } catch {
    sessionStorage.removeItem(claimedInviteKey(sessionCode, role));
    return null;
  }
}

export function clearClaimedProductFeedbackInvite(
  sessionCode: string,
  role: ProductFeedbackRole,
): void {
  if (!canUseSessionStorage()) return;
  sessionStorage.removeItem(claimedInviteKey(sessionCode, role));
}

export function loadProductFeedbackOutbox(): ProductFeedbackOutboxItem[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw) as ProductFeedbackOutboxItem[];
    const now = Date.now();
    const fresh = items.filter((i) => now - i.createdAt < PRODUCT_FEEDBACK_OUTBOX_MAX_AGE_MS);
    // Abgelaufene Einträge aus localStorage entfernen (nicht nur aus dem Rückgabewert).
    if (fresh.length !== items.length) {
      saveProductFeedbackOutbox(fresh);
    }
    return fresh;
  } catch {
    return [];
  }
}

export function saveProductFeedbackOutbox(items: ProductFeedbackOutboxItem[]): void {
  if (!canUseStorage()) return;
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
}

export function enqueueProductFeedbackOutbox(item: ProductFeedbackOutboxItem): void {
  const items = loadProductFeedbackOutbox().filter((existing) => existing.id !== item.id);
  items.push(item);
  saveProductFeedbackOutbox(items);
}

export function removeProductFeedbackOutboxItem(id: string): void {
  saveProductFeedbackOutbox(loadProductFeedbackOutbox().filter((i) => i.id !== id));
}

export type ProductFeedbackOutboxSender = {
  submit: (payload: Record<string, unknown>) => Promise<unknown>;
  followUp: (payload: Record<string, unknown>) => Promise<unknown>;
  inAppSubmit?: (payload: Record<string, unknown>) => Promise<unknown>;
  inAppFollowUp?: (payload: Record<string, unknown>) => Promise<unknown>;
};

/** Nur echte Netzwerk-/Serverfehler bleiben retryfähig; fachliche Ablehnungen nicht. */
export function isRetriableProductFeedbackError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return true;
  const anyErr = err as {
    data?: { code?: string };
    shape?: { data?: { code?: string } };
    message?: string;
  };
  const code = anyErr.data?.code ?? anyErr.shape?.data?.code;
  if (
    code === 'BAD_REQUEST' ||
    code === 'UNAUTHORIZED' ||
    code === 'FORBIDDEN' ||
    code === 'NOT_FOUND' ||
    code === 'CONFLICT' ||
    code === 'PRECONDITION_FAILED' ||
    code === 'TOO_MANY_REQUESTS'
  ) {
    return false;
  }
  const message = String(anyErr.message ?? '').toLowerCase();
  return (
    !code ||
    code === 'INTERNAL_SERVER_ERROR' ||
    code === 'TIMEOUT' ||
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('timeout')
  );
}

/** Sendet vorgemerkte Payloads erneut; erfolgreiche Einträge werden entfernt. */
export async function flushProductFeedbackOutbox(
  sender: ProductFeedbackOutboxSender,
): Promise<void> {
  const items = loadProductFeedbackOutbox();
  if (items.length === 0) return;
  const remaining: ProductFeedbackOutboxItem[] = [];
  for (const item of items) {
    try {
      switch (item.kind) {
        case 'submit':
          await sender.submit(item.payload);
          break;
        case 'followUp':
          await sender.followUp(item.payload);
          break;
        case 'inAppSubmit':
          if (!sender.inAppSubmit) throw new Error('IN_APP submit sender fehlt.');
          await sender.inAppSubmit(item.payload);
          break;
        case 'inAppFollowUp':
          if (!sender.inAppFollowUp) throw new Error('IN_APP follow-up sender fehlt.');
          await sender.inAppFollowUp(item.payload);
          break;
      }
    } catch (error) {
      if (isRetriableProductFeedbackError(error)) remaining.push(item);
    }
  }
  saveProductFeedbackOutbox(remaining);
}

/** Globaler Reconnect-Hook; Rückgabe entfernt den Listener wieder. */
export function installProductFeedbackOutboxOnlineRetry(
  sender: ProductFeedbackOutboxSender,
): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const flush = () => {
    void flushProductFeedbackOutbox(sender);
  };
  window.addEventListener('online', flush);
  flush();
  return () => window.removeEventListener('online', flush);
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

export type { ProductFeedbackInAppSubmitInput, ProductFeedbackSubmitInput };
