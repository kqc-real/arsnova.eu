import type { HostRecoveryCardDTO } from '@arsnova/shared-types';

const HOST_BROWSER_CAPABILITY_PREFIX = 'arsnova-host-browser-capability';
const HOST_RECOVERY_CARD_PREFIX = 'arsnova-host-recovery-card';
const HOST_RECOVERY_EXCHANGE_PREFIX = 'arsnova-host-recovery-exchange';

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
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

export function getOrCreateRecoveryExchangeId(binding: string): string {
  const normalizedBinding = binding.trim().toUpperCase();
  const key = `${HOST_RECOVERY_EXCHANGE_PREFIX}-${normalizedBinding}`;
  if (typeof sessionStorage !== 'undefined') {
    const existing = sessionStorage.getItem(key)?.trim();
    if (existing) return existing;
  }
  const exchangeId = createRecoveryExchangeId();
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(key, exchangeId);
  }
  return exchangeId;
}

export function clearRecoveryExchangeId(binding: string): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(`${HOST_RECOVERY_EXCHANGE_PREFIX}-${binding.trim().toUpperCase()}`);
}

export function getHostBrowserCapability(code: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(`${HOST_BROWSER_CAPABILITY_PREFIX}-${normalizeCode(code)}`);
}

export function storeHostBrowserCapability(code: string, capability: string): void {
  if (typeof localStorage === 'undefined') return;
  // Persistente Host-Browser-Capability laut #408; der Server speichert nur Hashes.
  // codeql[js/clear-text-storage-of-sensitive-data]
  localStorage.setItem(
    `${HOST_BROWSER_CAPABILITY_PREFIX}-${normalizeCode(code)}`,
    capability.trim(),
  );
}

export function clearHostBrowserCapability(code: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(`${HOST_BROWSER_CAPABILITY_PREFIX}-${normalizeCode(code)}`);
}

export function stageHostRecoveryCard(code: string, card: HostRecoveryCardDTO): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(
    `${HOST_RECOVERY_CARD_PREFIX}-${normalizeCode(code)}`,
    JSON.stringify(card),
  );
}

export function getStagedHostRecoveryCard(code: string): HostRecoveryCardDTO | null {
  if (typeof sessionStorage === 'undefined') return null;
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
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(`${HOST_RECOVERY_CARD_PREFIX}-${normalizeCode(code)}`);
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
