import { getHostToken, normalizeHostSessionCode, setHostToken } from './host-session-token';

const HOST_TOKEN_HANDOFF_KEY = 'arsnova-host-token-handoff';
const HOST_TOKEN_HANDOFF_TTL_MS = 30_000;

type HostTokenHandoff = {
  code: string;
  token: string;
  expiresAt: number;
};

function isBrowser(): boolean {
  return globalThis.window !== undefined;
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

/** Liest das Handoff einmalig und schreibt es in sessionStorage. */
export function consumeHostTokenHandoff(): string | null {
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

/** True, wenn dieser Tab schon ein Host-Token hat — dann das Handoff nicht verbrauchen. */
export function hostTabHasToken(): boolean {
  if (!isBrowser()) {
    return false;
  }
  try {
    const storage = globalThis.window.sessionStorage;
    for (let index = 0; index < storage.length; index++) {
      if (storage.key(index)?.startsWith('arsnova-host-token:')) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
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
    // Private mode / quota: der Presenter-Tab startet ohne Handoff.
  }
}

export function clearHostTokenHandoff(): void {
  if (!isBrowser()) {
    return;
  }
  try {
    globalThis.window.localStorage.removeItem(HOST_TOKEN_HANDOFF_KEY);
  } catch {
    // Private mode: nichts zu entfernen.
  }
}

export function copyHostTokenToSessionStorage(storage: Storage, sessionCode: string): boolean {
  const token = getHostToken(sessionCode);
  if (!token) {
    return false;
  }
  try {
    storage.setItem(`arsnova-host-token:${normalizeHostSessionCode(sessionCode)}`, token);
    return true;
  } catch {
    return false;
  }
}
