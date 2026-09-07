import { beforeEach, describe, expect, it, vi } from 'vitest';

type MemoryEntry = { value: string; expiresAt?: number };

function createMemoryRedis() {
  const store = new Map<string, MemoryEntry>();
  const alive = (entry: MemoryEntry | undefined): entry is MemoryEntry => {
    if (!entry) return false;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) return false;
    return true;
  };
  const client = {
    async get(key: string) {
      const entry = store.get(key);
      if (!alive(entry)) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key: string, value: string, ...args: Array<string | number>) {
      let ttl: number | undefined;
      let nx = false;
      for (let index = 0; index < args.length; index += 1) {
        if (args[index] === 'EX') ttl = Number(args[index + 1]);
        if (args[index] === 'NX') nx = true;
      }
      const existing = store.get(key);
      if (nx && alive(existing)) return null;
      store.set(key, {
        value,
        expiresAt: ttl ? Date.now() + ttl * 1000 : undefined,
      });
      return 'OK';
    },
    async del(...keys: string[]) {
      let removed = 0;
      for (const key of keys) {
        if (store.delete(key)) removed += 1;
      }
      return removed;
    },
    async eval(_script: string, _numKeys: number, key: string, owner: string) {
      const current = await client.get(key);
      if (current === owner) return client.del(key);
      return 0;
    },
    store,
  };
  return client;
}

const memoryRedis = createMemoryRedis();

vi.mock('../redis', () => ({
  getRedis: () => memoryRedis,
}));

import {
  createHostPairingLockOwnerToken,
  hostPairingLockKey,
  releaseHostPairingLockIfOwned,
  withHostPairingSessionLock,
} from './hostPairingLock';

describe('hostPairingLock', () => {
  beforeEach(() => {
    memoryRedis.store.clear();
  });

  it('vergibt je Acquisition ein eigenes Owner-Token', () => {
    expect(createHostPairingLockOwnerToken()).not.toBe(createHostPairingLockOwnerToken());
    expect(createHostPairingLockOwnerToken()).toMatch(/^[0-9a-f]{32}$/);
  });

  it('löscht den Lock eines anderen Owners nicht', async () => {
    const key = hostPairingLockKey('ABC123');
    await memoryRedis.set(key, 'owner-b', 'EX', 10, 'NX');
    expect(await releaseHostPairingLockIfOwned('ABC123', 'owner-a')).toBe(0);
    expect(await memoryRedis.get(key)).toBe('owner-b');
  });

  it('gibt nur den eigenen Lock frei, nachdem ein späterer Owner übernommen hat', async () => {
    const key = hostPairingLockKey('ABC123');
    let releaseOwnerA: ((value: void) => void) | undefined;
    const holdA = new Promise<void>((resolve) => {
      releaseOwnerA = resolve;
    });

    const first = withHostPairingSessionLock(
      'ABC123',
      async () => {
        await holdA;
        return 'a';
      },
      () => {
        throw new Error('busy-a');
      },
    );

    await vi.waitFor(async () => {
      expect(await memoryRedis.get(key)).toMatch(/^[0-9a-f]{32}$/);
    });
    const ownerA = (await memoryRedis.get(key))!;
    memoryRedis.store.delete(key);
    await memoryRedis.set(key, 'owner-b', 'EX', 10, 'NX');

    releaseOwnerA?.();
    await expect(first).resolves.toBe('a');
    expect(await memoryRedis.get(key)).toBe('owner-b');
    expect(await releaseHostPairingLockIfOwned('ABC123', ownerA)).toBe(0);
    expect(await memoryRedis.get(key)).toBe('owner-b');
  });
});
