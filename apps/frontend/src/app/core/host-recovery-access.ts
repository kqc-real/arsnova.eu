import type { HostRecoveryCardDTO } from '@arsnova/shared-types';

const HOST_BROWSER_CAPABILITY_PREFIX = 'arsnova-host-browser-capability';
const HOST_RECOVERY_CANDIDATE_PREFIX = 'arsnova-host-recovery-candidate';
const HOST_RECOVERY_CARD_PREFIX = 'arsnova-host-recovery-card';
const HOST_RECOVERY_PENDING_CARD_PREFIX = 'arsnova-host-recovery-pending-card';
const HOST_RECOVERY_EXCHANGE_PREFIX = 'arsnova-host-recovery-exchange';
const HOST_RECOVERY_PENDING_ACTIVATION_PREFIX = 'arsnova-host-recovery-pending-activation';
const HOST_RECOVERY_RESUME_PREFIX = 'arsnova-host-recovery-resume';
const LAST_HOSTED_SESSION_KEY = 'arsnova-last-hosted-session';

export type HostRecoverySourceKind = 'RECOVERY' | 'ADMIN_HANDOFF';
export type HostRecoveryResumePhase = 'prepared' | 'activation_unconfirmed' | 'activated';

export type HostRecoveryResumeRecord = {
  supportId: string;
  code: string;
  sourceKind: HostRecoverySourceKind;
  phase: HostRecoveryResumePhase;
  pendingExpiresAt: string;
  exchangeId: string;
  newCardSavedConfirmed: boolean;
};

export type PreparedHostRecovery = {
  code: string;
  browserCapability: string;
  recoveryCard: HostRecoveryCardDTO;
  pendingExpiresAt: string;
};

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function normalizeSupportId(supportId: string): string {
  return supportId.trim().toUpperCase();
}

function canUseLocalStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

function canUseSessionStorage(): boolean {
  return typeof sessionStorage !== 'undefined';
}

function readJson<T>(storage: Storage, key: string): T | null {
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

function isFutureTimestamp(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed > Date.now();
}

export function createRecoveryExchangeId(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function exchangeStorageKey(binding: string): string {
  return `${HOST_RECOVERY_EXCHANGE_PREFIX}-${binding.trim().toUpperCase()}`;
}

function readStoredExchangeId(binding: string): string | null {
  const key = exchangeStorageKey(binding);
  const fromLocal = canUseLocalStorage()
    ? readJson<{ id?: unknown; expiresAt?: unknown }>(localStorage, key)
    : null;
  if (fromLocal) {
    if (typeof fromLocal.expiresAt === 'string' && !isFutureTimestamp(fromLocal.expiresAt)) {
      localStorage.removeItem(key);
    } else if (typeof fromLocal.id === 'string' && fromLocal.id.trim()) {
      return fromLocal.id;
    }
  }
  if (canUseSessionStorage()) {
    const existing = sessionStorage.getItem(key)?.trim();
    if (existing) return existing;
  }
  return null;
}

export function getOrCreateRecoveryExchangeId(binding: string, expiresAt?: string): string {
  const existing = readStoredExchangeId(binding);
  if (existing) {
    if (expiresAt) persistRecoveryExchangeExpiry(binding, expiresAt);
    return existing;
  }
  const exchangeId = createRecoveryExchangeId();
  persistRecoveryExchangeId(binding, exchangeId, expiresAt);
  return exchangeId;
}

export function persistRecoveryExchangeId(
  binding: string,
  exchangeId: string,
  expiresAt?: string,
): void {
  const key = exchangeStorageKey(binding);
  const payload = JSON.stringify({
    id: exchangeId,
    ...(expiresAt ? { expiresAt } : {}),
  });
  if (canUseLocalStorage()) {
    localStorage.setItem(key, payload);
  }
  if (canUseSessionStorage()) {
    sessionStorage.setItem(key, exchangeId);
  }
}

export function persistRecoveryExchangeExpiry(binding: string, expiresAt: string): void {
  const existing = readStoredExchangeId(binding);
  if (!existing) return;
  persistRecoveryExchangeId(binding, existing, expiresAt);
}

export function clearRecoveryExchangeId(binding: string): void {
  const key = exchangeStorageKey(binding);
  if (canUseLocalStorage()) localStorage.removeItem(key);
  if (canUseSessionStorage()) sessionStorage.removeItem(key);
}

export function stagePendingHostCredentialActivation(
  supportId: string,
  code: string,
  pendingExpiresAt: string,
): void {
  const payload = JSON.stringify({ code: normalizeCode(code), pendingExpiresAt });
  const key = `${HOST_RECOVERY_PENDING_ACTIVATION_PREFIX}-${normalizeSupportId(supportId)}`;
  if (canUseSessionStorage()) {
    sessionStorage.setItem(key, payload);
  }
}

function readPendingActivationMarker(
  supportId: string,
): { code: string; pendingExpiresAt: string } | null {
  const key = `${HOST_RECOVERY_PENDING_ACTIVATION_PREFIX}-${normalizeSupportId(supportId)}`;
  const storages: Storage[] = [];
  if (canUseSessionStorage()) storages.push(sessionStorage);
  if (canUseLocalStorage()) storages.push(localStorage);
  for (const storage of storages) {
    const pending = readJson<{ code?: unknown; pendingExpiresAt?: unknown }>(storage, key);
    if (!pending) continue;
    if (
      typeof pending.code !== 'string' ||
      typeof pending.pendingExpiresAt !== 'string' ||
      !Number.isFinite(Date.parse(pending.pendingExpiresAt))
    ) {
      storage.removeItem(key);
      continue;
    }
    if (!isFutureTimestamp(pending.pendingExpiresAt)) {
      storage.removeItem(key);
      continue;
    }
    return { code: pending.code, pendingExpiresAt: pending.pendingExpiresAt };
  }
  return null;
}

export function getPendingHostCredentialActivation(supportId: string): PreparedHostRecovery | null {
  const resume = getHostRecoveryResume(supportId);
  const marker = readPendingActivationMarker(supportId);
  const pendingExpiresAt = marker?.pendingExpiresAt ?? resume?.pendingExpiresAt;
  const code = marker?.code ?? resume?.code;
  if (!code || !pendingExpiresAt || !isFutureTimestamp(pendingExpiresAt)) {
    return null;
  }
  const browserCapability = getHostRecoveryCandidate(code) ?? getHostBrowserCapability(code);
  const recoveryCard = getPendingHostRecoveryCard(code) ?? getStagedHostRecoveryCard(code);
  if (!browserCapability || !recoveryCard) return null;
  return {
    code: normalizeCode(code),
    browserCapability,
    recoveryCard,
    pendingExpiresAt,
  };
}

export function clearPendingHostCredentialActivation(supportId: string): void {
  const key = `${HOST_RECOVERY_PENDING_ACTIVATION_PREFIX}-${normalizeSupportId(supportId)}`;
  if (canUseSessionStorage()) sessionStorage.removeItem(key);
  if (canUseLocalStorage()) localStorage.removeItem(key);
}

export function getHostBrowserCapability(code: string): string | null {
  if (!canUseLocalStorage()) return null;
  return localStorage.getItem(`${HOST_BROWSER_CAPABILITY_PREFIX}-${normalizeCode(code)}`);
}

export function storeHostBrowserCapability(code: string, capability: string): void {
  if (!canUseLocalStorage()) return;
  // Persistente Host-Browser-Capability laut #408; der Server speichert nur Hashes.
  localStorage.setItem(
    `${HOST_BROWSER_CAPABILITY_PREFIX}-${normalizeCode(code)}`,
    // codeql[js/clear-text-storage-of-sensitive-data] -- Persistenz ist der explizite Browser-Besitzfaktor aus #408.
    capability.trim(),
  );
  rememberHostedSession(code);
}

export function rememberHostedSession(code: string): void {
  if (!canUseLocalStorage()) return;
  localStorage.setItem(
    LAST_HOSTED_SESSION_KEY,
    JSON.stringify({ code: normalizeCode(code), usedAt: Date.now() }),
  );
}

export function getLastHostedSessionCode(): string | null {
  if (!canUseLocalStorage()) return null;
  const stored = readJson<{ code?: unknown }>(localStorage, LAST_HOSTED_SESSION_KEY);
  return typeof stored?.code === 'string' && stored.code.trim() ? normalizeCode(stored.code) : null;
}

export function clearHostBrowserCapability(code: string): void {
  if (!canUseLocalStorage()) return;
  localStorage.removeItem(`${HOST_BROWSER_CAPABILITY_PREFIX}-${normalizeCode(code)}`);
}

export function clearLastHostedSessionIfMatches(code: string): void {
  if (getLastHostedSessionCode() !== normalizeCode(code) || !canUseLocalStorage()) return;
  localStorage.removeItem(LAST_HOSTED_SESSION_KEY);
}

/** Entfernt den lokalen Host-Schnellzugang; die Session selbst bleibt bestehen. */
export function forgetHostedSessionOnThisDevice(code: string): void {
  const normalized = normalizeCode(code);
  const resume = findHostRecoveryResumeByCode(normalized);
  clearHostBrowserCapability(normalized);
  clearHostRecoveryCandidate(normalized);
  clearStagedHostRecoveryCard(normalized);
  clearPendingHostRecoveryCard(normalized);
  clearRecoveryExchangeId(normalized);
  clearLastHostedSessionIfMatches(normalized);
  if (!resume) {
    return;
  }
  clearPreparedHostRecoverySecrets(resume.supportId);
  clearHostRecoveryResume(resume.supportId);
  clearRecoveryExchangeId(resume.supportId);
  clearPendingHostCredentialActivation(resume.supportId);
}

export function getHostRecoveryCandidate(code: string): string | null {
  if (!canUseLocalStorage()) return null;
  const stored = readJson<{ capability?: unknown }>(
    localStorage,
    `${HOST_RECOVERY_CANDIDATE_PREFIX}-${normalizeCode(code)}`,
  );
  return stored && typeof stored.capability === 'string' ? stored.capability : null;
}

export function storeHostRecoveryCandidate(code: string, capability: string): void {
  if (!canUseLocalStorage()) return;
  localStorage.setItem(
    `${HOST_RECOVERY_CANDIDATE_PREFIX}-${normalizeCode(code)}`,
    JSON.stringify({ capability: capability.trim() }),
  );
}

export function clearHostRecoveryCandidate(code: string): void {
  if (!canUseLocalStorage()) return;
  localStorage.removeItem(`${HOST_RECOVERY_CANDIDATE_PREFIX}-${normalizeCode(code)}`);
}

export function stageHostRecoveryCard(code: string, card: HostRecoveryCardDTO): void {
  if (!canUseSessionStorage()) return;
  sessionStorage.setItem(
    `${HOST_RECOVERY_CARD_PREFIX}-${normalizeCode(code)}`,
    JSON.stringify(card),
  );
}

export function getStagedHostRecoveryCard(code: string): HostRecoveryCardDTO | null {
  if (!canUseSessionStorage()) return null;
  const key = `${HOST_RECOVERY_CARD_PREFIX}-${normalizeCode(code)}`;
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<HostRecoveryCardDTO>;
    return typeof parsed.supportId === 'string' && typeof parsed.recoveryCode === 'string'
      ? { supportId: parsed.supportId, recoveryCode: parsed.recoveryCode }
      : null;
  } catch {
    return null;
  }
}

export function clearStagedHostRecoveryCard(code: string): void {
  if (!canUseSessionStorage()) return;
  sessionStorage.removeItem(`${HOST_RECOVERY_CARD_PREFIX}-${normalizeCode(code)}`);
}

function parseRecoveryCard(value: unknown): HostRecoveryCardDTO | null {
  if (!value || typeof value !== 'object') return null;
  const parsed = value as Partial<HostRecoveryCardDTO>;
  return typeof parsed.supportId === 'string' && typeof parsed.recoveryCode === 'string'
    ? { supportId: parsed.supportId, recoveryCode: parsed.recoveryCode }
    : null;
}

export function getPendingHostRecoveryCard(code: string): HostRecoveryCardDTO | null {
  if (!canUseLocalStorage()) return null;
  const stored = readJson<{ card?: unknown; expiresAt?: unknown }>(
    localStorage,
    `${HOST_RECOVERY_PENDING_CARD_PREFIX}-${normalizeCode(code)}`,
  );
  if (!stored) return null;
  if (typeof stored.expiresAt === 'string' && !isFutureTimestamp(stored.expiresAt)) {
    clearPendingHostRecoveryCard(code);
    return null;
  }
  return parseRecoveryCard(stored.card);
}

export function storePendingHostRecoveryCard(
  code: string,
  card: HostRecoveryCardDTO,
  expiresAt: string,
): void {
  if (!canUseLocalStorage()) return;
  localStorage.setItem(
    `${HOST_RECOVERY_PENDING_CARD_PREFIX}-${normalizeCode(code)}`,
    JSON.stringify({ card, expiresAt }),
  );
}

export function clearPendingHostRecoveryCard(code: string): void {
  if (!canUseLocalStorage()) return;
  localStorage.removeItem(`${HOST_RECOVERY_PENDING_CARD_PREFIX}-${normalizeCode(code)}`);
}

export function persistInitialHostRecovery(params: {
  code: string;
  browserCapability?: string;
  recoveryCard?: HostRecoveryCardDTO;
}): void {
  if (params.browserCapability) {
    storeHostBrowserCapability(params.code, params.browserCapability);
  }
  if (params.recoveryCard) {
    stageHostRecoveryCard(params.code, params.recoveryCard);
  }
}

function resumeKey(supportId: string): string {
  return `${HOST_RECOVERY_RESUME_PREFIX}-${normalizeSupportId(supportId)}`;
}

export function getHostRecoveryResume(supportId: string): HostRecoveryResumeRecord | null {
  if (!canUseLocalStorage()) return null;
  const stored = readJson<Partial<HostRecoveryResumeRecord>>(localStorage, resumeKey(supportId));
  if (
    !stored ||
    typeof stored.supportId !== 'string' ||
    typeof stored.code !== 'string' ||
    (stored.sourceKind !== 'RECOVERY' && stored.sourceKind !== 'ADMIN_HANDOFF') ||
    (stored.phase !== 'prepared' &&
      stored.phase !== 'activation_unconfirmed' &&
      stored.phase !== 'activated') ||
    typeof stored.pendingExpiresAt !== 'string' ||
    typeof stored.exchangeId !== 'string'
  ) {
    if (stored) localStorage.removeItem(resumeKey(supportId));
    return null;
  }
  return {
    supportId: normalizeSupportId(stored.supportId),
    code: normalizeCode(stored.code),
    sourceKind: stored.sourceKind,
    phase: stored.phase,
    pendingExpiresAt: stored.pendingExpiresAt,
    exchangeId: stored.exchangeId,
    newCardSavedConfirmed: stored.newCardSavedConfirmed === true,
  };
}

export function listHostRecoveryResumes(): HostRecoveryResumeRecord[] {
  if (!canUseLocalStorage()) return [];
  const records: HostRecoveryResumeRecord[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(`${HOST_RECOVERY_RESUME_PREFIX}-`)) continue;
    const supportId = key.slice(`${HOST_RECOVERY_RESUME_PREFIX}-`.length);
    const record = getHostRecoveryResume(supportId);
    if (record) records.push(record);
  }
  return records;
}

export function findUnambiguousHostRecoveryResume(): HostRecoveryResumeRecord | null {
  const records = listHostRecoveryResumes().filter((record) => {
    if (record.phase === 'activated') return false;
    if (record.phase === 'activation_unconfirmed') return true;
    return isFutureTimestamp(record.pendingExpiresAt) || !!getHostRecoveryCandidate(record.code);
  });
  return records.length === 1 ? records[0] : null;
}

export function getStoredHostCapabilities(code: string): {
  active: string | null;
  candidate: string | null;
} {
  return {
    active: getHostBrowserCapability(code),
    candidate: getHostRecoveryCandidate(code),
  };
}

export function hasStoredHostCapabilities(): boolean {
  if (!canUseLocalStorage()) return false;
  const capabilityPrefix = `${HOST_BROWSER_CAPABILITY_PREFIX}-`;
  const candidatePrefix = `${HOST_RECOVERY_CANDIDATE_PREFIX}-`;
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key) continue;
    if (key.startsWith(capabilityPrefix) && localStorage.getItem(key)?.trim()) {
      return true;
    }
    if (key.startsWith(candidatePrefix)) {
      const code = key.slice(candidatePrefix.length);
      if (getHostRecoveryCandidate(code)?.trim()) return true;
    }
  }
  return false;
}

export function listStoredHostBrowserCapabilityCodes(): string[] {
  if (!canUseLocalStorage()) return [];
  const prefix = `${HOST_BROWSER_CAPABILITY_PREFIX}-`;
  const codes: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(prefix) || !localStorage.getItem(key)?.trim()) continue;
    codes.push(key.slice(prefix.length));
  }
  return codes;
}

export function findPreferredHostBrowserCapabilityCode(
  preferredCodes: readonly string[] = [],
): string | null {
  const stored = listStoredHostBrowserCapabilityCodes();
  if (stored.length === 0) return null;
  const storedSet = new Set(stored);
  const lastHosted = getLastHostedSessionCode();
  if (lastHosted && storedSet.has(lastHosted)) {
    return lastHosted;
  }
  for (const code of preferredCodes) {
    const normalized = normalizeCode(code);
    if (storedSet.has(normalized)) return normalized;
  }
  return stored.length === 1 ? (stored[0] ?? null) : null;
}

export function getUsableHostCapability(code: string): string | null {
  const { active, candidate } = getStoredHostCapabilities(code);
  return candidate ?? active;
}

export function persistHostRecoveryResume(record: HostRecoveryResumeRecord): void {
  if (!canUseLocalStorage()) {
    throw new Error('localStorage unavailable');
  }
  localStorage.setItem(resumeKey(record.supportId), JSON.stringify(record));
}

export function clearHostRecoveryResume(supportId: string): void {
  if (!canUseLocalStorage()) return;
  localStorage.removeItem(resumeKey(supportId));
}

export function persistPreparedHostRecovery(params: {
  supportId: string;
  sourceKind: HostRecoverySourceKind;
  prepared: PreparedHostRecovery;
  exchangeId: string;
}): void {
  const code = normalizeCode(params.prepared.code);
  const supportId = normalizeSupportId(params.supportId);
  storeHostRecoveryCandidate(code, params.prepared.browserCapability);
  storePendingHostRecoveryCard(
    code,
    params.prepared.recoveryCard,
    params.prepared.pendingExpiresAt,
  );
  stageHostRecoveryCard(code, params.prepared.recoveryCard);
  stagePendingHostCredentialActivation(supportId, code, params.prepared.pendingExpiresAt);
  persistRecoveryExchangeId(supportId, params.exchangeId, params.prepared.pendingExpiresAt);
  persistHostRecoveryResume({
    supportId,
    code,
    sourceKind: params.sourceKind,
    phase: 'prepared',
    pendingExpiresAt: params.prepared.pendingExpiresAt,
    exchangeId: params.exchangeId,
    newCardSavedConfirmed: false,
  });
}

export function markHostRecoveryNewCardSaved(supportId: string): void {
  const resume = getHostRecoveryResume(supportId);
  if (!resume) return;
  persistHostRecoveryResume({ ...resume, newCardSavedConfirmed: true });
}

export function markHostRecoveryActivationUnconfirmed(supportId: string): void {
  const resume = getHostRecoveryResume(supportId);
  if (!resume) return;
  persistHostRecoveryResume({ ...resume, phase: 'activation_unconfirmed' });
}

export function promoteHostRecoveryCandidate(code: string, capability?: string): void {
  const nextCapability = capability ?? getHostRecoveryCandidate(code);
  if (!nextCapability) return;
  storeHostBrowserCapability(code, nextCapability);
  clearHostRecoveryCandidate(code);
}

export function markHostRecoveryActivated(supportId: string, capability?: string): void {
  const resume = getHostRecoveryResume(supportId);
  if (resume) {
    const candidate = getHostRecoveryCandidate(resume.code);
    if (capability && candidate && capability !== candidate) {
      return;
    }
    promoteHostRecoveryCandidate(resume.code, capability);
    persistHostRecoveryResume({ ...resume, phase: 'activated' });
  }
  clearPendingHostCredentialActivation(supportId);
  clearRecoveryExchangeId(supportId);
}

export function clearPreparedHostRecoverySecrets(supportId: string): void {
  const resume = getHostRecoveryResume(supportId);
  if (resume) {
    clearHostRecoveryCandidate(resume.code);
    clearPendingHostRecoveryCard(resume.code);
    clearStagedHostRecoveryCard(resume.code);
  }
  clearPendingHostCredentialActivation(supportId);
  clearRecoveryExchangeId(supportId);
}

export function discardExpiredPreparedRecovery(supportId: string): void {
  const resume = getHostRecoveryResume(supportId);
  if (!resume || resume.phase === 'activated' || resume.phase === 'activation_unconfirmed') {
    return;
  }
  if (isFutureTimestamp(resume.pendingExpiresAt)) return;
  clearPreparedHostRecoverySecrets(supportId);
  clearHostRecoveryResume(supportId);
}

export function abandonRejectedHostRecovery(supportId: string): void {
  const resume = getHostRecoveryResume(supportId);
  if (!resume || resume.phase === 'activated') return;
  clearPreparedHostRecoverySecrets(supportId);
  clearHostRecoveryResume(supportId);
}

export function findHostRecoveryResumeByCode(code: string): HostRecoveryResumeRecord | null {
  return listHostRecoveryResumes().find((record) => record.code === normalizeCode(code)) ?? null;
}

export function canActivatePendingCandidate(code: string): boolean {
  return findHostRecoveryResumeByCode(code)?.phase === 'activation_unconfirmed';
}
