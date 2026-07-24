const STORAGE_KEY = 'arsnova-anonymous-client-id';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let inMemoryClientId: string | null = null;

function createUuid(): string {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi) {
    throw new Error('Sichere Browser-Zufallsquelle ist nicht verfügbar.');
  }
  if (typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Browserweite, zufällige UUID für Missbrauchsdrosselung. Sie enthält keine
 * PII und ist ausdrücklich kein Authentifizierungs- oder Besitznachweis.
 */
export function getAnonymousClientId(): string {
  if (inMemoryClientId) return inMemoryClientId;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && UUID_PATTERN.test(stored)) {
      inMemoryClientId = stored;
      return stored;
    }
  } catch {
    // Storage kann in privaten/gesperrten Browserkontexten nicht verfügbar sein.
  }

  inMemoryClientId = createUuid();
  try {
    localStorage.setItem(STORAGE_KEY, inMemoryClientId);
  } catch {
    // Die UUID bleibt für die Lebensdauer dieses Tabs stabil.
  }
  return inMemoryClientId;
}

export function resetAnonymousClientIdForTests(): void {
  inMemoryClientId = null;
}
