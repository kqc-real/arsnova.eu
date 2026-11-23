import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MemoryEntry = { value: string; expiresAt?: number };

const { memoryRedis } = vi.hoisted(() => {
  const store = new Map<string, MemoryEntry>();
  const alive = (entry: MemoryEntry | undefined): entry is MemoryEntry =>
    Boolean(entry && (!entry.expiresAt || entry.expiresAt > Date.now()));
  return {
    memoryRedis: {
      store,
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
        if (nx && alive(store.get(key))) return null;
        store.set(key, {
          value,
          expiresAt: ttl ? Date.now() + ttl * 1000 : undefined,
        });
        return 'OK';
      },
      async del(...keys: string[]) {
        let deleted = 0;
        for (const key of keys) {
          if (store.delete(key)) deleted += 1;
        }
        return deleted;
      },
      async eval(_script: string, keyCount: number, ...args: Array<string | number>) {
        const keys = args.slice(0, keyCount).map(String);
        const argv = args.slice(keyCount).map(String);
        const [capabilityKey, reservationKey, operationKey] = keys;
        const [expectedRaw, ttlRaw] = argv;
        const capabilityEntry = capabilityKey ? store.get(capabilityKey) : undefined;
        if (!alive(capabilityEntry) || capabilityEntry.value !== expectedRaw) return 0;
        const reservationEntry = reservationKey ? store.get(reservationKey) : undefined;
        if (alive(reservationEntry) || !reservationKey) return 0;
        if (operationKey && alive(store.get(operationKey))) return 0;
        store.set(reservationKey, {
          value: '1',
          expiresAt: Date.now() + Number(ttlRaw) * 1000,
        });
        if (operationKey) {
          store.set(operationKey, { value: '1', expiresAt: Date.now() + Number(ttlRaw) * 1000 });
        }
        store.delete(capabilityKey!);
        return 1;
      },
    },
  };
});

vi.mock('../redis', () => ({ getRedis: () => memoryRedis }));

import {
  finalizeLearningObjectiveDerivationCapability,
  issueLearningObjectiveDerivationCapability,
  reserveLearningObjectiveDerivationCapability,
} from './learningObjectiveDerivationCapability';

const OPERATION_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_OPERATION_ID = '22222222-2222-4222-8222-222222222222';
const QUIZ_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_QUIZ_ID = '44444444-4444-4444-8444-444444444444';
const binding = {
  schemaVersion: 1 as const,
  operationId: OPERATION_ID,
  quizId: QUIZ_ID,
  expectedBundleRevision: 7,
};

describe('learning-objective derivation capability', () => {
  beforeEach(() => {
    memoryRedis.store.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-05T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('issues a 32-byte opaque bearer while Redis stores only its SHA-256 key', async () => {
    const issued = await issueLearningObjectiveDerivationCapability(binding);

    expect(issued).toMatchObject(binding);
    expect(issued.capability).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(issued.expiresAt).toBe('2026-10-05T10:05:00.000Z');
    const serializedStore = JSON.stringify([...memoryRedis.store]);
    expect(serializedStore).not.toContain(issued.capability);
    expect([...memoryRedis.store.keys()]).toEqual([
      expect.stringMatching(/:capability:v1:[0-9a-f]{64}$/u),
    ]);
  });

  it('accepts only one capability for the same prioritized operation', async () => {
    vi.stubEnv('OPEN_WEIGHT_LLM_SHARED_SLOT_ENABLED', 'true');
    vi.stubEnv('OPEN_WEIGHT_LLM_PRIORITY_HANDOFF_ENABLED', 'true');
    try {
      const first = await issueLearningObjectiveDerivationCapability(binding);
      const second = await issueLearningObjectiveDerivationCapability(binding);
      await expect(reserveLearningObjectiveDerivationCapability(first)).resolves.toBe(true);
      await finalizeLearningObjectiveDerivationCapability(first.capability);
      await expect(reserveLearningObjectiveDerivationCapability(second)).resolves.toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('reserves exactly once atomically and finalize consumes all state', async () => {
    const issued = await issueLearningObjectiveDerivationCapability(binding);
    const expected = { ...binding, capability: issued.capability };

    const reservations = await Promise.all([
      reserveLearningObjectiveDerivationCapability(expected),
      reserveLearningObjectiveDerivationCapability(expected),
    ]);
    expect(reservations.sort()).toEqual([false, true]);
    expect([...memoryRedis.store.keys()]).toEqual([
      expect.stringMatching(/:reservation:v1:[0-9a-f]{64}$/u),
    ]);

    await finalizeLearningObjectiveDerivationCapability(issued.capability);
    expect(memoryRedis.store.size).toBe(0);
    await expect(reserveLearningObjectiveDerivationCapability(expected)).resolves.toBe(false);
  });

  it('rejects cross-quiz, cross-operation, and revision mismatches without consuming the binding', async () => {
    const issued = await issueLearningObjectiveDerivationCapability(binding);

    await expect(
      reserveLearningObjectiveDerivationCapability({
        ...binding,
        quizId: OTHER_QUIZ_ID,
        capability: issued.capability,
      }),
    ).resolves.toBe(false);
    await expect(
      reserveLearningObjectiveDerivationCapability({
        ...binding,
        operationId: OTHER_OPERATION_ID,
        capability: issued.capability,
      }),
    ).resolves.toBe(false);
    await expect(
      reserveLearningObjectiveDerivationCapability({
        ...binding,
        expectedBundleRevision: 8,
        capability: issued.capability,
      }),
    ).resolves.toBe(false);
    await expect(
      reserveLearningObjectiveDerivationCapability({
        ...binding,
        capability: issued.capability,
      }),
    ).resolves.toBe(true);
  });

  it('rejects expired and strictly invalid stored payloads fail closed', async () => {
    const expired = await issueLearningObjectiveDerivationCapability(binding);
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await expect(
      reserveLearningObjectiveDerivationCapability({ ...binding, capability: expired.capability }),
    ).resolves.toBe(false);

    const corrupt = await issueLearningObjectiveDerivationCapability(binding);
    const capabilityEntry = [...memoryRedis.store.entries()].find(([key]) =>
      key.includes(':capability:v1:'),
    );
    expect(capabilityEntry).toBeDefined();
    const [key, entry] = capabilityEntry!;
    memoryRedis.store.set(key, {
      ...entry,
      value: JSON.stringify({ ...JSON.parse(entry.value), unexpected: true }),
    });
    await expect(
      reserveLearningObjectiveDerivationCapability({ ...binding, capability: corrupt.capability }),
    ).resolves.toBe(false);
  });

  it('does not allocate reservation state for an unissued bearer', async () => {
    await expect(
      reserveLearningObjectiveDerivationCapability({
        ...binding,
        capability: 'z'.repeat(43),
      }),
    ).resolves.toBe(false);
    expect(memoryRedis.store.size).toBe(0);
  });

  it('rejects a delayed reader after another request reserved, ran, and finalized', async () => {
    const issued = await issueLearningObjectiveDerivationCapability(binding);
    const expected = { ...binding, capability: issued.capability };
    const originalGet = memoryRedis.get.bind(memoryRedis);
    let releaseDelayedRead: (() => void) | undefined;
    let markPayloadRead: (() => void) | undefined;
    const payloadRead = new Promise<void>((resolve) => {
      markPayloadRead = resolve;
    });
    const delayedRead = new Promise<void>((resolve) => {
      releaseDelayedRead = resolve;
    });
    const getSpy = vi.spyOn(memoryRedis, 'get').mockImplementationOnce(async (key: string) => {
      const snapshot = await originalGet(key);
      markPayloadRead?.();
      await delayedRead;
      return snapshot;
    });

    const delayedReservation = reserveLearningObjectiveDerivationCapability(expected);
    await payloadRead;
    await expect(reserveLearningObjectiveDerivationCapability(expected)).resolves.toBe(true);
    await finalizeLearningObjectiveDerivationCapability(issued.capability);
    releaseDelayedRead?.();

    await expect(delayedReservation).resolves.toBe(false);
    expect(memoryRedis.store.size).toBe(0);
    getSpy.mockRestore();
  });
});
