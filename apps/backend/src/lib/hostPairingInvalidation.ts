/**
 * Prozess-lokale Waiter plus Redis-Pub/Sub, damit ein Widerruf auf Replica A
 * Host-Subscriptions auf Replica B sofort beendet — Tokenprüfung bleibt Fallback.
 */
export const PAIRED_HOST_INVALIDATION_CHANNEL = 'host:pairing:v1:invalidate';

export type PairedHostInvalidationMessage = {
  sessionCode: string;
  tokenHash: string;
};

export type PairedHostInvalidationHub = {
  notify(sessionCode: string, tokenHash: string): void;
  subscribe(sessionCode: string, tokenHash: string, onInvalidate: () => void): () => void;
  reset(): void;
};

function invalidationKey(sessionCode: string, tokenHash: string): string {
  return `${sessionCode.trim().toUpperCase()}:${tokenHash}`;
}

export function parsePairedHostInvalidationMessage(
  message: string,
): PairedHostInvalidationMessage | null {
  try {
    const parsed = JSON.parse(message) as PairedHostInvalidationMessage;
    if (
      typeof parsed?.sessionCode !== 'string' ||
      parsed.sessionCode.trim().length === 0 ||
      typeof parsed.tokenHash !== 'string' ||
      parsed.tokenHash.length === 0
    ) {
      return null;
    }
    return {
      sessionCode: parsed.sessionCode.trim().toUpperCase(),
      tokenHash: parsed.tokenHash,
    };
  } catch {
    return null;
  }
}

export function createPairedHostInvalidationHub(deps: {
  publish: (channel: string, message: string) => Promise<unknown> | unknown;
  ensureSubscribe?: (onMessage: (message: string) => void) => void;
}): PairedHostInvalidationHub {
  const waiters = new Map<string, Set<() => void>>();
  let subscribeStarted = false;

  function wake(sessionCode: string, tokenHash: string): void {
    const key = invalidationKey(sessionCode, tokenHash);
    const current = waiters.get(key);
    if (!current) return;
    for (const resolve of current) resolve();
    waiters.delete(key);
  }

  function handleMessage(message: string): void {
    const parsed = parsePairedHostInvalidationMessage(message);
    if (!parsed) return;
    wake(parsed.sessionCode, parsed.tokenHash);
  }

  return {
    notify(sessionCode, tokenHash) {
      wake(sessionCode, tokenHash);
      void Promise.resolve(
        deps.publish(
          PAIRED_HOST_INVALIDATION_CHANNEL,
          JSON.stringify({
            sessionCode: sessionCode.trim().toUpperCase(),
            tokenHash,
          } satisfies PairedHostInvalidationMessage),
        ),
      ).catch(() => undefined);
    },
    subscribe(sessionCode, tokenHash, onInvalidate) {
      if (!subscribeStarted) {
        subscribeStarted = true;
        deps.ensureSubscribe?.(handleMessage);
      }
      const key = invalidationKey(sessionCode, tokenHash);
      const current = waiters.get(key) ?? new Set<() => void>();
      current.add(onInvalidate);
      waiters.set(key, current);
      return () => {
        const remaining = waiters.get(key);
        if (!remaining) return;
        remaining.delete(onInvalidate);
        if (remaining.size === 0) waiters.delete(key);
      };
    },
    reset() {
      waiters.clear();
    },
  };
}
