const PARTICIPANT_CAPABILITY_PREFIX = 'arsnova-participant-capability';
const JOIN_ATTEMPT_PREFIX = 'arsnova-join-attempt';
const JOIN_ATTEMPT_MAX_AGE_MS = 10 * 60 * 1000;

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function createCsprngCapability(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

export function getParticipantCapability(code: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(`${PARTICIPANT_CAPABILITY_PREFIX}-${normalizeCode(code)}`);
}

export function storeParticipantCapability(code: string, capability: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(
    `${PARTICIPANT_CAPABILITY_PREFIX}-${normalizeCode(code)}`,
    capability.trim(),
  );
}

export function clearParticipantCapability(code: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(`${PARTICIPANT_CAPABILITY_PREFIX}-${normalizeCode(code)}`);
}

export function getOrCreateJoinIdempotencyKey(code: string, now: number = Date.now()): string {
  const key = `${JOIN_ATTEMPT_PREFIX}-${normalizeCode(code)}`;
  if (typeof sessionStorage !== 'undefined') {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { value?: unknown; createdAt?: unknown };
        if (
          typeof parsed.value === 'string' &&
          typeof parsed.createdAt === 'number' &&
          now - parsed.createdAt >= 0 &&
          now - parsed.createdAt < JOIN_ATTEMPT_MAX_AGE_MS
        ) {
          return parsed.value;
        }
      } catch {
        // Ein beschädigter lokaler Versuch ist kein Berechtigungsnachweis.
      }
    }
  }
  const value = createCsprngCapability();
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(key, JSON.stringify({ value, createdAt: now }));
  }
  return value;
}

export function clearJoinIdempotencyKey(code: string): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(`${JOIN_ATTEMPT_PREFIX}-${normalizeCode(code)}`);
}
