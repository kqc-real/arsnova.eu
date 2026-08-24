const HOST_TOKEN_STORAGE_PREFIX = 'arsnova-host-token:';
const hostTokens = new Map<string, string>();
let hostTokensLoaded = false;

function isBrowser(): boolean {
  return globalThis.window !== undefined;
}

export function normalizeHostSessionCode(sessionCode: string): string {
  return sessionCode.trim().toUpperCase();
}

function getHostTokenStorageKey(sessionCode: string): string {
  return `${HOST_TOKEN_STORAGE_PREFIX}${normalizeHostSessionCode(sessionCode)}`;
}

function loadHostTokensFromSessionStorage(): void {
  if (!isBrowser() || hostTokensLoaded) {
    return;
  }

  for (let index = 0; index < globalThis.window.sessionStorage.length; index++) {
    const key = globalThis.window.sessionStorage.key(index);
    if (!key?.startsWith(HOST_TOKEN_STORAGE_PREFIX)) {
      continue;
    }

    const sessionCode = key.slice(HOST_TOKEN_STORAGE_PREFIX.length).trim().toUpperCase();
    const token = globalThis.window.sessionStorage.getItem(key)?.trim();
    if (sessionCode && token) {
      hostTokens.set(sessionCode, token);
    }
  }

  hostTokensLoaded = true;
}

export function getHostToken(sessionCode: string): string | null {
  loadHostTokensFromSessionStorage();
  return hostTokens.get(normalizeHostSessionCode(sessionCode)) ?? null;
}

export function hasHostToken(sessionCode: string): boolean {
  return getHostToken(sessionCode) !== null;
}

export function getSessionEntryCommands(sessionCode: string): string[] {
  const normalizedSessionCode = normalizeHostSessionCode(sessionCode);
  return hasHostToken(normalizedSessionCode)
    ? ['session', normalizedSessionCode, 'host']
    : ['join', normalizedSessionCode];
}

export function setHostToken(sessionCode: string, token: string | null): void {
  const normalizedSessionCode = normalizeHostSessionCode(sessionCode);
  const normalizedToken = token?.trim() || null;

  hostTokensLoaded = true;
  if (normalizedToken) {
    hostTokens.set(normalizedSessionCode, normalizedToken);
  } else {
    hostTokens.delete(normalizedSessionCode);
  }

  if (!isBrowser()) return;
  if (normalizedToken) {
    globalThis.window.sessionStorage.setItem(
      getHostTokenStorageKey(normalizedSessionCode),
      normalizedToken,
    );
  } else {
    globalThis.window.sessionStorage.removeItem(getHostTokenStorageKey(normalizedSessionCode));
  }
}

export function clearHostToken(sessionCode: string): void {
  setHostToken(sessionCode, null);
}
