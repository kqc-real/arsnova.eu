import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { redisMocks } = vi.hoisted(() => {
  const state = {
    messageHandler: null as ((channel: string, message: string) => void) | null,
    store: new Map<string, string>(),
    indexes: new Map<string, Set<string>>(),
    clientIds: [] as number[],
    runIds: [] as string[],
    waitAofResults: [] as Array<[number, number]>,
  };
  const subscriber = {
    on: vi.fn((event: string, handler: (channel: string, message: string) => void) => {
      if (event === 'message') state.messageHandler = handler;
      return subscriber;
    }),
    subscribe: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue('OK'),
  };
  const primary = {
    publish: vi.fn().mockResolvedValue(2),
    duplicate: vi.fn(() => subscriber),
    scan: vi.fn(async (_cursor: string, _match: string, pattern: string) => {
      const literalPrefix = pattern.slice(0, -1);
      return ['0', [...state.store.keys()].filter((key) => key.startsWith(literalPrefix))] as const;
    }),
    unlink: vi.fn(async (...keys: string[]) => {
      let deleted = 0;
      for (const key of keys) {
        if (state.store.delete(key)) deleted += 1;
      }
      return deleted;
    }),
    get: vi.fn(async (key: string) => state.store.get(key) ?? null),
    del: vi.fn(async (...keys: string[]) => {
      let deleted = 0;
      for (const key of keys) {
        if (state.store.delete(key)) deleted += 1;
      }
      return deleted;
    }),
    mget: vi.fn(async (...keys: string[]) => keys.map((key) => state.store.get(key) ?? null)),
    set: vi.fn(async (key: string, value: string, ...args: Array<string | number>) => {
      if (args.includes('NX') && state.store.has(key)) return null;
      state.store.set(key, value);
      return 'OK';
    }),
    call: vi.fn(async (command: string, ...args: Array<string | number>) => {
      if (command === 'CLIENT' && args[0] === 'ID') {
        return state.clientIds.shift() ?? 41;
      }
      if (command === 'INFO' && args[0] === 'server') {
        return `# Server\r\nrun_id:${state.runIds.shift() ?? 'a'.repeat(40)}\r\n`;
      }
      if (command === 'WAITAOF') {
        return state.waitAofResults.shift() ?? [1, 0];
      }
      throw new Error(`unexpected Redis command: ${command}`);
    }),
    smembers: vi.fn(async (key: string) => [...(state.indexes.get(key) ?? [])]),
    eval: vi.fn(async (script: string, keyCount: number, ...parameters: Array<string | number>) => {
      if (script.includes('host_pairing_raw_cas_delete_v1')) {
        const keys = parameters.slice(0, keyCount).map(String);
        const expected = parameters.slice(keyCount).map(String);
        let deleted = 0;
        for (let index = 0; index < keys.length; index += 1) {
          if (state.store.get(keys[index]!) === expected[index]) {
            if (state.store.delete(keys[index]!)) deleted += 1;
          }
        }
        return deleted;
      }
      if (script.includes('redis.call("get", KEYS[1]) == ARGV[1]')) {
        const key = String(parameters[0]);
        const owner = String(parameters[keyCount]);
        if (state.store.get(key) !== owner) return 0;
        return state.store.delete(key) ? 1 : 0;
      }
      if (script.includes('session_runtime_data_purge_v1')) {
        const keys = parameters.slice(0, keyCount).map(String);
        const [fenceKey, presenceKey] = keys;
        if (!fenceKey || !presenceKey) throw new Error('invalid runtime-data purge keys');
        state.store.set(fenceKey, '1');
        return state.store.delete(presenceKey) ? 1 : 0;
      }
      if (script.includes('product_feedback_purge_indexed_artifacts_v2')) {
        const keys = parameters.slice(0, keyCount).map(String);
        const args = parameters.slice(keyCount).map(String);
        const [indexKey, fenceKey, metaKey, ...artifactKeys] = keys;
        if (!indexKey || !fenceKey || !metaKey) {
          throw new Error('invalid product-feedback purge keys');
        }
        state.store.set(fenceKey, '1');
        const index = state.indexes.get(indexKey) ?? new Set<string>();
        if (index.size !== Number(args[1])) return [0, 0];
        if (!artifactKeys.every((key) => index.has(key))) return [0, 0];
        let deleted = state.store.delete(metaKey) ? 1 : 0;
        for (const key of artifactKeys) {
          const raw = state.store.get(key);
          if (raw) {
            const payload = JSON.parse(raw) as { sessionId?: string };
            if (payload.sessionId !== args[2]) return [-1, 0];
          }
          if (state.store.delete(key)) deleted += 1;
        }
        state.indexes.delete(indexKey);
        return [1, deleted];
      }
      if (script.includes('product_feedback_purge_legacy_artifacts_v2')) {
        return 0;
      }
      if (script.includes('quick_feedback_session_purge_v1')) {
        const keys = parameters.slice(0, keyCount).map(String);
        const fenceKey = keys[6];
        if (!fenceKey) throw new Error('invalid quick-feedback purge keys');
        state.store.set(fenceKey, '1');
        return [1, 0];
      }
      if (!script.includes('wordcloud_snapshot_purge_v2')) {
        throw new Error('unexpected Lua script');
      }
      const keys = parameters.slice(0, keyCount).map(String);
      const args = parameters.slice(keyCount).map(String);
      const [indexKey, fenceKey, ...valueKeys] = keys;
      if (!indexKey || !fenceKey) throw new Error('invalid purge keys');
      state.store.set(fenceKey, '1');
      const index = state.indexes.get(indexKey) ?? new Set<string>();
      if (index.size !== Number(args[1])) return [0, 0];
      if (!valueKeys.every((key) => index.has(key))) return [0, 0];
      let deleted = 0;
      for (const key of valueKeys) {
        if (state.store.delete(key)) deleted += 1;
      }
      state.indexes.delete(indexKey);
      return [1, deleted];
    }),
  };
  return {
    redisMocks: {
      state,
      subscriber,
      primary,
    },
  };
});

vi.mock('../redis', () => ({
  getRedis: () => redisMocks.primary,
}));

import {
  parseSessionPurgeInvalidation,
  publishSessionPurgeInvalidation,
  publishSessionPurgeInvalidations,
  registerSessionPurgeInvalidator,
  resetSessionPurgeInvalidationForTests,
  SESSION_PURGE_INVALIDATION_CHANNEL,
  startSessionPurgeInvalidationSubscriber,
  stopSessionPurgeInvalidationSubscriber,
} from './sessionPurgeInvalidation';
import {
  buildWordCloudSnapshotIndexKey,
  buildWordCloudSnapshotPurgeFenceKey,
  resetWordCloudAnalysisCacheMigrationForTests,
} from './wordCloudAnalysisCache';

describe('session purge invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMocks.state.messageHandler = null;
    redisMocks.state.store.clear();
    redisMocks.state.indexes.clear();
    redisMocks.state.clientIds.length = 0;
    redisMocks.state.runIds.length = 0;
    redisMocks.state.waitAofResults.length = 0;
    resetWordCloudAnalysisCacheMigrationForTests();
    resetSessionPurgeInvalidationForTests();
  });

  afterEach(async () => {
    await stopSessionPurgeInvalidationSubscriber();
    vi.unstubAllEnvs();
  });

  it('invalidiert lokal und veröffentlicht normalisierte Purge-Signale', async () => {
    const invalidator = vi.fn();
    registerSessionPurgeInvalidator(invalidator);

    await publishSessionPurgeInvalidation({
      sessionId: ' session-1 ',
      sessionCode: 'abc123',
    });

    expect(invalidator).toHaveBeenCalledWith({
      sessionId: 'session-1',
      sessionCode: 'ABC123',
    });
    expect(redisMocks.primary.publish).toHaveBeenCalledWith(
      SESSION_PURGE_INVALIDATION_CHANNEL,
      JSON.stringify({ sessionId: 'session-1', sessionCode: 'ABC123' }),
    );
  });

  it('abonniert genau einmal und verteilt valide Replica-Signale', async () => {
    const invalidator = vi.fn();
    registerSessionPurgeInvalidator(invalidator);

    await Promise.all([
      startSessionPurgeInvalidationSubscriber(),
      startSessionPurgeInvalidationSubscriber(),
    ]);
    redisMocks.state.messageHandler?.(
      SESSION_PURGE_INVALIDATION_CHANNEL,
      JSON.stringify({ sessionId: 'session-2', sessionCode: 'def456' }),
    );
    await vi.waitFor(() => expect(invalidator).toHaveBeenCalledTimes(1));

    expect(redisMocks.primary.duplicate).toHaveBeenCalledTimes(1);
    expect(redisMocks.subscriber.subscribe).toHaveBeenCalledWith(
      SESSION_PURGE_INVALIDATION_CHANNEL,
    );
    expect(invalidator).toHaveBeenCalledWith({
      sessionId: 'session-2',
      sessionCode: 'DEF456',
    });
  });

  it('setzt die sessionId-Fence, entfernt indizierte Snapshots und purgt idempotent', async () => {
    const sessionId = '11111111-1111-4111-8111-111111111111';
    const otherSessionId = '22222222-2222-4222-8222-222222222222';
    const targetKey = `nlp:wc:snapshot:v2:{${sessionId}}:value:raw-answer`;
    const otherSessionKey = `nlp:wc:snapshot:v2:{${otherSessionId}}:value:other`;
    redisMocks.state.store.set(targetKey, '{"members":[{"text":"private answer"}]}');
    redisMocks.state.store.set(otherSessionKey, '{"members":[{"text":"other answer"}]}');
    redisMocks.state.indexes.set(buildWordCloudSnapshotIndexKey(sessionId), new Set([targetKey]));
    redisMocks.state.indexes.set(
      buildWordCloudSnapshotIndexKey(otherSessionId),
      new Set([otherSessionKey]),
    );

    const event = { sessionId, sessionCode: 'abc123' };
    await publishSessionPurgeInvalidation(event);
    await publishSessionPurgeInvalidation(event);

    expect(redisMocks.state.store.has(targetKey)).toBe(false);
    expect(redisMocks.state.store.has(otherSessionKey)).toBe(true);
    expect(redisMocks.state.store.has(buildWordCloudSnapshotPurgeFenceKey(sessionId))).toBe(true);
    expect(redisMocks.primary.scan).toHaveBeenCalledTimes(17);
    expect(
      redisMocks.primary.scan.mock.calls.filter(([, , pattern]) => pattern === 'nlp:wc:snap:*'),
    ).toHaveLength(1);
    expect(redisMocks.primary.publish).toHaveBeenCalledTimes(2);
  });

  it('bricht den ersten Purge vor dem Fan-out ab, wenn eine persistente Eviction fehlschlägt', async () => {
    redisMocks.primary.eval.mockRejectedValueOnce(new Error('Redis down'));

    await expect(
      publishSessionPurgeInvalidation({ sessionId: 'session-1', sessionCode: 'ABC123' }),
    ).rejects.toThrow('Redis down');

    expect(redisMocks.primary.publish).not.toHaveBeenCalled();
  });

  it('bricht vor dem DB-Delete ab, wenn Redis den lokalen AOF-Fsync nicht bestätigt', async () => {
    vi.stubEnv('WORD_CLOUD_PURGE_REQUIRE_DURABILITY', '1');
    redisMocks.state.waitAofResults.push([1, 0], [0, 0]);

    await expect(
      publishSessionPurgeInvalidation({ sessionId: 'session-1', sessionCode: 'ABC123' }),
    ).rejects.toThrow('WORD_CLOUD_PURGE_DURABILITY_UNAVAILABLE');

    expect(redisMocks.primary.call.mock.calls.filter(([command]) => command === 'WAITAOF')).toEqual(
      [
        ['WAITAOF', 1, 0, 5_000],
        ['WAITAOF', 1, 0, 5_000],
      ],
    );
    expect(redisMocks.state.store.has(buildWordCloudSnapshotPurgeFenceKey('session-1'))).toBe(true);
    expect(redisMocks.primary.publish).not.toHaveBeenCalled();
  });

  it('führt den globalen Legacy-Sweep bei einem Bulk-Purge nicht pro Session aus', async () => {
    const events = Array.from({ length: 100 }, (_, index) => ({
      sessionId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      sessionCode: `S${String(index).padStart(5, '0')}`,
    }));

    await publishSessionPurgeInvalidations(events);

    // Ein gemeinsamer Readiness-Scan, acht ProductFeedback-Legacy-Scans,
    // zwanzig Host-Pairing-Scans (je fünf Präfixe in vier 25er-Chunks) und
    // ein globaler Word-Cloud-Legacy-Sweep.
    expect(redisMocks.primary.scan).toHaveBeenCalledTimes(30);
    expect(
      redisMocks.primary.scan.mock.calls.filter(([, , pattern]) => pattern === 'nlp:wc:snap:*'),
    ).toHaveLength(1);
    expect(redisMocks.primary.eval).toHaveBeenCalledTimes(600);
    expect(redisMocks.primary.publish).toHaveBeenCalledTimes(100);
  });

  it('bestätigt einen großen Bulk-Purge nur einmal pro begrenztem Chunk', async () => {
    vi.stubEnv('WORD_CLOUD_PURGE_REQUIRE_DURABILITY', '1');
    const events = Array.from({ length: 57 }, (_, index) => ({
      sessionId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      sessionCode: `S${String(index).padStart(5, '0')}`,
    }));

    await publishSessionPurgeInvalidations(events);

    expect(redisMocks.primary.eval).toHaveBeenCalledTimes(342);
    // Einmal Runtime-v1-Sweep plus drei Snapshot-Chunks (25 + 25 + 7).
    expect(
      redisMocks.primary.call.mock.calls.filter(([command]) => command === 'WAITAOF'),
    ).toHaveLength(4);
    expect(redisMocks.primary.publish).toHaveBeenCalledTimes(57);
  });

  it('wartet bei einem Fan-out-Fehler auf den vollständigen aktuellen Chunk', async () => {
    let releaseSecond!: () => void;
    const secondMayFinish = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    let secondFinished = false;
    registerSessionPurgeInvalidator(async ({ sessionId }) => {
      if (sessionId === 'session-1') throw new Error('local invalidation failed');
      await secondMayFinish;
      secondFinished = true;
    });

    let observedSettled = false;
    const observed = publishSessionPurgeInvalidations([
      { sessionId: 'session-1', sessionCode: 'ABC123' },
      { sessionId: 'session-2', sessionCode: 'DEF456' },
    ])
      .then(
        () => null,
        (error: unknown) => error,
      )
      .finally(() => {
        observedSettled = true;
      });
    await Promise.resolve();
    await Promise.resolve();
    expect(observedSettled).toBe(false);
    expect(secondFinished).toBe(false);

    releaseSecond();
    await expect(observed).resolves.toMatchObject({ message: 'local invalidation failed' });
    expect(secondFinished).toBe(true);
    expect(redisMocks.primary.eval).toHaveBeenCalledTimes(8);
    expect(redisMocks.primary.publish).not.toHaveBeenCalled();
  });

  it('wartet innerhalb eines Events auf alle lokalen Invalidatoren', async () => {
    let releaseSecond!: () => void;
    const secondMayFinish = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    let secondFinished = false;
    registerSessionPurgeInvalidator(() => {
      throw new Error('first invalidator failed');
    });
    registerSessionPurgeInvalidator(async () => {
      await secondMayFinish;
      secondFinished = true;
    });

    let observedSettled = false;
    const observed = publishSessionPurgeInvalidation({
      sessionId: 'session-1',
      sessionCode: 'ABC123',
    })
      .then(
        () => null,
        (error: unknown) => error,
      )
      .finally(() => {
        observedSettled = true;
      });
    await Promise.resolve();
    await Promise.resolve();
    expect(observedSettled).toBe(false);

    releaseSecond();
    await expect(observed).resolves.toMatchObject({ message: 'first invalidator failed' });
    expect(secondFinished).toBe(true);
    expect(redisMocks.primary.eval).toHaveBeenCalledTimes(4);
  });

  it('behält nach einem Fehler im zweiten Pass die vorher gesetzte Fence', async () => {
    const event = {
      sessionId: '11111111-1111-4111-8111-111111111111',
      sessionCode: 'ABC123',
    };
    await publishSessionPurgeInvalidation(event);
    redisMocks.primary.eval.mockRejectedValueOnce(new Error('Redis temporarily unavailable'));

    await expect(publishSessionPurgeInvalidation(event)).rejects.toThrow(
      'Redis temporarily unavailable',
    );

    expect(redisMocks.state.store.has(buildWordCloudSnapshotPurgeFenceKey(event.sessionId))).toBe(
      true,
    );
    expect(redisMocks.primary.publish).toHaveBeenCalledOnce();
  });

  it('verwirft unvollständige oder ungültige Nachrichten', () => {
    expect(parseSessionPurgeInvalidation('{}')).toBeNull();
    expect(parseSessionPurgeInvalidation('kein-json')).toBeNull();
    expect(
      parseSessionPurgeInvalidation(
        JSON.stringify({ sessionId: 'session-3', sessionCode: ' ghi789 ' }),
      ),
    ).toEqual({ sessionId: 'session-3', sessionCode: 'GHI789' });
  });
});
