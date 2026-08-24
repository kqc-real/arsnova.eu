const HOST_TOKEN_STORAGE_PREFIX = 'arsnova-host-token:';
const HOST_TOKEN_HANDOFF_KEY = 'arsnova-host-token-handoff';
const HOST_TOKEN_HANDOFF_TTL_MS = 30_000;
const hostTokens = new Map<string, string>();
let hostTokensLoaded = false;

type HostTokenHandoff = {
  code: string;
  token: string;
  expiresAt: number;
};

function isBrowser(): boolean {
  return globalThis.window !== undefined;
}

export function normalizeHostSessionCode(sessionCode: string): string {
  return sessionCode.trim().toUpperCase();
}

function getHostTokenStorageKey(sessionCode: string): string {
  return `${HOST_TOKEN_STORAGE_PREFIX}${normalizeHostSessionCode(sessionCode)}`;
}

function readHostTokenHandoff(): HostTokenHandoff | null {
  if (!isBrowser()) {
    return null;
  }
  let raw: string | null;
  try {
    raw = globalThis.window.localStorage.getItem(HOST_TOKEN_HANDOFF_KEY);
  } catch {
    return null;
  }
  if (!raw) {
    return null;
  }
  try {
    globalThis.window.localStorage.removeItem(HOST_TOKEN_HANDOFF_KEY);
  } catch {
    // Private mode: still try to parse the in-memory snapshot.
  }
  try {
    const parsed = JSON.parse(raw) as Partial<HostTokenHandoff>;
    if (
      typeof parsed.code !== 'string' ||
      typeof parsed.token !== 'string' ||
      typeof parsed.expiresAt !== 'number' ||
      !parsed.code.trim() ||
      !parsed.token.trim() ||
      parsed.expiresAt < Date.now()
    ) {
      return null;
    }
    return {
      code: normalizeHostSessionCode(parsed.code),
      token: parsed.token.trim(),
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

function consumeHostTokenHandoff(): string | null {
  const handoff = readHostTokenHandoff();
  if (!handoff) {
    return null;
  }
  setHostToken(handoff.code, handoff.token);
  return handoff.code;
}

export function takeHostTokenHandoffSessionCode(): string | null {
  return consumeHostTokenHandoff();
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
  const normalizedSessionCode = normalizeHostSessionCode(sessionCode);
  const existing = hostTokens.get(normalizedSessionCode);
  if (existing) {
    return existing;
  }
  consumeHostTokenHandoff();
  return hostTokens.get(normalizedSessionCode) ?? null;
}

export function hasHostToken(sessionCode: string): boolean {
  return getHostToken(sessionCode) !== null;
}

export function hasAnyHostToken(): boolean {
  loadHostTokensFromSessionStorage();
  return hostTokens.size > 0;
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

/** Kurzlebige Token-Übergabe in denselben Origin, weil Tablets sessionStorage nicht in den neuen Tab klonen. */
export function stageHostTokenHandoff(sessionCode: string): void {
  if (!isBrowser()) {
    return;
  }
  const token = getHostToken(sessionCode);
  if (!token) {
    return;
  }
  const payload: HostTokenHandoff = {
    code: normalizeHostSessionCode(sessionCode),
    token,
    expiresAt: Date.now() + HOST_TOKEN_HANDOFF_TTL_MS,
  };
  try {
    globalThis.window.localStorage.setItem(HOST_TOKEN_HANDOFF_KEY, JSON.stringify(payload));
  } catch {
    // Private mode / quota: Presenter versucht danach den direkten sessionStorage-Copy.
  }
}

export function copyHostTokenToSessionStorage(storage: Storage, sessionCode: string): boolean {
  const token = getHostToken(sessionCode);
  if (!token) {
    return false;
  }
  try {
    storage.setItem(getHostTokenStorageKey(sessionCode), token);
    return true;
  } catch {
    return false;
  }
}
