import { beforeEach, describe, expect, it, vi } from 'vitest';

const { qaTelemetryMocks, redisMock, state } = vi.hoisted(() => {
  const state = {
    values: new Map<string, string>(),
    events: [] as string[],
    scanPages: [] as Array<[string, string[]]>,
    clientIds: [] as number[],
    runIds: [] as string[],
    waitAof: [] as Array<[number, number]>,
  };
  const redisMock = {
    eval: vi.fn(async (script: string, keyCount: number, ...parameters: string[]) => {
      const keys = parameters.slice(0, keyCount);
      const args = parameters.slice(keyCount);
      if (script.includes('session_runtime_data_purge_v1')) {
        state.events.push('EVAL purge');
        const [fenceKey, presenceKey] = keys;
        state.values.set(fenceKey!, '1');
        return state.values.delete(presenceKey!) ? 1 : 0;
      }
      if (script.includes('participant_presence_touch_v2')) {
        state.events.push('EVAL presence');
        const [presenceKey, fenceKey] = keys;
        if (state.values.has(fenceKey!)) return 0;
        state.values.set(presenceKey!, args[1]!);
        return 1;
      }
      if (script.includes('participant_reading_ready_mark_v2')) {
        state.events.push('EVAL reading-ready');
        const [readingReadyKey, fenceKey] = keys;
        if (state.values.has(fenceKey!)) return 0;
        state.values.set(readingReadyKey!, args[0]!);
        return 1;
      }
      throw new Error('unexpected script');
    }),
    scan: vi.fn(async (_cursor: string, _match: string, pattern: string) => {
      state.events.push(`SCAN ${pattern}`);
      const nextPage = state.scanPages.shift();
      if (nextPage) return nextPage;
      const prefix = pattern.slice(0, -1);
      return ['0', [...state.values.keys()].filter((key) => key.startsWith(prefix))] as [
        string,
        string[],
      ];
    }),
    unlink: vi.fn(async (...keys: string[]) => {
      state.events.push(`UNLINK ${keys.length}`);
      let deleted = 0;
      for (const key of keys) {
        if (state.values.delete(key)) deleted += 1;
      }
      return deleted;
    }),
    set: vi.fn(async (key: string, value: string) => {
      state.events.push('SET marker');
      state.values.set(key, value);
      return 'OK';
    }),
    call: vi.fn(async (command: string, ...args: Array<string | number>) => {
      state.events.push(command);
      if (command === 'CLIENT' && args[0] === 'ID') return state.clientIds.shift() ?? 41;
      if (command === 'INFO' && args[0] === 'server') {
        return `# Server\r\nrun_id:${state.runIds.shift() ?? 'a'.repeat(40)}\r\n`;
      }
      if (command === 'WAITAOF') return state.waitAof.shift() ?? [1, 0];
      throw new Error(`unexpected Redis command: ${command}`);
    }),
    zrem: vi.fn(async () => 0),
    smembers: vi.fn(async (key: string) => {
      const value = state.values.get(key);
      return value ? [value] : [];
    }),
    del: vi.fn(async (key: string) => (state.values.delete(key) ? 1 : 0)),
  };
  const qaTelemetryMocks = {
    markQaPresenceGap: vi.fn(),
    markQaPresenceObservation: vi.fn(async () => undefined),
  };
  return { qaTelemetryMocks, redisMock, state };
});

vi.mock('../redis', () => ({
  getRedis: () => redisMock,
}));
vi.mock('./logger', () => ({ logger: { warn: vi.fn() } }));
vi.mock('./qaTelemetry', () => qaTelemetryMocks);

import { touchParticipantPresence } from './presence';
import { markParticipantReadingReady } from './readingReady';
import {
  buildReadingReadyKey,
  buildSessionPresenceKey,
  buildSessionRuntimeDataPurgeFenceKey,
  purgeSessionRuntimeDataForSessions,
  SESSION_RUNTIME_DATA_PURGE_BATCH_SIZE,
  SESSION_RUNTIME_DATA_PURGE_FENCE_TTL_SECONDS,
} from './sessionRuntimeDataPurge';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_SESSION_ID = '22222222-2222-4222-8222-222222222222';
const QUESTION_ID = '33333333-3333-4333-8333-333333333333';
const PARTICIPANT_ID = '44444444-4444-4444-8444-444444444444';

describe('session runtime data purge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('NODE_ENV', 'development');
    state.values.clear();
    state.events.length = 0;
    state.scanPages.length = 0;
    state.clientIds.length = 0;
    state.runIds.length = 0;
    state.waitAof.length = 0;
  });

  it('setzt zuerst die Fence und entfernt Presence sowie alle Readiness-Keys der Session', async () => {
    const presenceKey = buildSessionPresenceKey(SESSION_ID);
    const firstReadingReadyKey = buildReadingReadyKey(SESSION_ID, QUESTION_ID);
    const secondReadingReadyKey = buildReadingReadyKey(
      SESSION_ID,
      '55555555-5555-4555-8555-555555555555',
    );
    const unrelatedKey = buildReadingReadyKey(OTHER_SESSION_ID, QUESTION_ID);
    state.values.set(presenceKey, PARTICIPANT_ID);
    state.values.set(firstReadingReadyKey, PARTICIPANT_ID);
    state.values.set(secondReadingReadyKey, 'another-participant');
    state.values.set(unrelatedKey, 'unrelated-participant');

    await expect(purgeSessionRuntimeDataForSessions([SESSION_ID])).resolves.toBe(3);

    expect(state.events[0]).toBe('EVAL purge');
    expect(state.values.has(presenceKey)).toBe(false);
    expect(state.values.has(firstReadingReadyKey)).toBe(false);
    expect(state.values.has(secondReadingReadyKey)).toBe(false);
    expect(state.values.get(unrelatedKey)).toBe('unrelated-participant');
    expect(state.values.get(buildSessionRuntimeDataPurgeFenceKey(SESSION_ID))).toBe('1');
    expect(SESSION_RUNTIME_DATA_PURGE_FENCE_TTL_SECONDS).toBeGreaterThan(6 * 60 * 60);
  });

  it('blockiert Presence- und Readiness-Late-Writer atomar nach dem Purge', async () => {
    await touchParticipantPresence(SESSION_ID, PARTICIPANT_ID, 1_000_000);
    await markParticipantReadingReady(SESSION_ID, QUESTION_ID, PARTICIPANT_ID);
    expect(state.values.has(buildSessionPresenceKey(SESSION_ID))).toBe(true);
    expect(state.values.has(buildReadingReadyKey(SESSION_ID, QUESTION_ID))).toBe(true);

    await purgeSessionRuntimeDataForSessions([SESSION_ID]);
    await touchParticipantPresence(SESSION_ID, PARTICIPANT_ID, 1_000_001);
    await markParticipantReadingReady(SESSION_ID, QUESTION_ID, PARTICIPANT_ID);

    expect(state.values.has(buildSessionPresenceKey(SESSION_ID))).toBe(false);
    expect(state.values.has(buildReadingReadyKey(SESSION_ID, QUESTION_ID))).toBe(false);
    expect(qaTelemetryMocks.markQaPresenceObservation).toHaveBeenCalledTimes(1);
    expect(redisMock.eval).toHaveBeenCalledWith(
      expect.stringContaining('participant_presence_touch_v2'),
      2,
      buildSessionPresenceKey(SESSION_ID),
      buildSessionRuntimeDataPurgeFenceKey(SESSION_ID),
      '1000000',
      PARTICIPANT_ID,
      '820000',
      '210',
    );
  });

  it('durchläuft alle SCAN-Seiten, bevor die Legacy-Keys gebündelt entfernt werden', async () => {
    const firstKey = buildReadingReadyKey(SESSION_ID, QUESTION_ID);
    const secondKey = buildReadingReadyKey(SESSION_ID, '55555555-5555-4555-8555-555555555555');
    state.values.set(firstKey, PARTICIPANT_ID);
    state.values.set(secondKey, PARTICIPANT_ID);
    state.scanPages.push(['17', [firstKey]], ['0', [secondKey]]);

    await expect(purgeSessionRuntimeDataForSessions([SESSION_ID])).resolves.toBe(2);

    expect(redisMock.scan).toHaveBeenNthCalledWith(
      1,
      '0',
      'MATCH',
      'reading-ready:*',
      'COUNT',
      250,
    );
    expect(redisMock.scan).toHaveBeenNthCalledWith(
      2,
      '17',
      'MATCH',
      'reading-ready:*',
      'COUNT',
      250,
    );
    expect(state.events).toEqual([
      'EVAL purge',
      'SCAN reading-ready:*',
      'SCAN reading-ready:*',
      'UNLINK 2',
    ]);
  });

  it('ignoriert beim gemeinsamen Scan valide Readiness-Keys anderer Sessions', async () => {
    const unrelatedKey = buildReadingReadyKey(OTHER_SESSION_ID, QUESTION_ID);
    state.values.set(unrelatedKey, PARTICIPANT_ID);
    state.scanPages.push(['0', [unrelatedKey]]);

    await expect(purgeSessionRuntimeDataForSessions([SESSION_ID])).resolves.toBe(0);

    expect(redisMock.unlink).not.toHaveBeenCalled();
    expect(state.values.get(unrelatedKey)).toBe(PARTICIPANT_ID);
    expect(state.values.get(buildSessionRuntimeDataPurgeFenceKey(SESSION_ID))).toBe('1');
  });

  it('bricht bei einem Redis-SCAN-Ergebnis außerhalb des Readiness-Namespace fail-closed ab', async () => {
    state.scanPages.push(['0', ['other:key']]);

    await expect(purgeSessionRuntimeDataForSessions([SESSION_ID])).rejects.toThrow(
      'SESSION_RUNTIME_DATA_PURGE_SCAN_INVALID',
    );

    expect(redisMock.unlink).not.toHaveBeenCalled();
  });

  it('weist Session-IDs mit Redis-Glob-Metazeichen vor dem SCAN zurück', async () => {
    await expect(purgeSessionRuntimeDataForSessions(['unsafe*session'])).rejects.toThrow(
      'A valid session ID',
    );
    expect(redisMock.eval).not.toHaveBeenCalled();
    expect(redisMock.scan).not.toHaveBeenCalled();
  });

  it('erfasst den Redis-Kontext vor der Mutation und bestätigt den Chunk per WAITAOF', async () => {
    vi.stubEnv('SESSION_RUNTIME_DATA_PURGE_REQUIRE_DURABILITY', '1');

    await purgeSessionRuntimeDataForSessions([SESSION_ID]);

    expect(state.events.indexOf('CLIENT')).toBeLessThan(state.events.indexOf('EVAL purge'));
    expect(redisMock.call).toHaveBeenCalledWith('WAITAOF', 1, 0, 5_000);
    expect(
      [...state.values.keys()].some((key) =>
        key.startsWith('session:runtime-data:purge-durability:v1:'),
      ),
    ).toBe(true);
  });

  it('bricht bei einem Reconnect zwischen Mutation und Marker fail-closed ab', async () => {
    vi.stubEnv('SESSION_RUNTIME_DATA_PURGE_REQUIRE_DURABILITY', '1');
    state.clientIds.push(41, 41, 42, 42);

    await expect(purgeSessionRuntimeDataForSessions([SESSION_ID])).rejects.toThrow(
      'SESSION_RUNTIME_DATA_PURGE_DURABILITY_UNAVAILABLE',
    );

    expect(redisMock.set).not.toHaveBeenCalled();
    expect(redisMock.call).not.toHaveBeenCalledWith('WAITAOF', 1, 0, 5_000);
  });

  it('bricht bei einem Redis-Neustart zwischen Mutation und Marker fail-closed ab', async () => {
    vi.stubEnv('SESSION_RUNTIME_DATA_PURGE_REQUIRE_DURABILITY', '1');
    state.runIds.push('a'.repeat(40), 'b'.repeat(40));

    await expect(purgeSessionRuntimeDataForSessions([SESSION_ID])).rejects.toThrow(
      'SESSION_RUNTIME_DATA_PURGE_DURABILITY_UNAVAILABLE',
    );

    expect(redisMock.set).not.toHaveBeenCalled();
    expect(redisMock.call).not.toHaveBeenCalledWith('WAITAOF', 1, 0, 5_000);
  });

  it('bricht ab, wenn WAITAOF den lokalen AOF-Fsync nicht bestätigt', async () => {
    vi.stubEnv('SESSION_RUNTIME_DATA_PURGE_REQUIRE_DURABILITY', '1');
    state.waitAof.push([0, 0]);

    await expect(purgeSessionRuntimeDataForSessions([SESSION_ID])).rejects.toThrow(
      'SESSION_RUNTIME_DATA_PURGE_DURABILITY_UNAVAILABLE',
    );
  });

  it('begrenzt Bulk-Purges auf 25 Sessions pro Durability-Barrier', async () => {
    vi.stubEnv('SESSION_RUNTIME_DATA_PURGE_REQUIRE_DURABILITY', '1');
    const sessionIds = Array.from(
      { length: 57 },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    );

    await purgeSessionRuntimeDataForSessions(sessionIds);

    expect(SESSION_RUNTIME_DATA_PURGE_BATCH_SIZE).toBe(25);
    expect(redisMock.eval).toHaveBeenCalledTimes(57);
    expect(redisMock.scan).toHaveBeenCalledTimes(1);
    expect(redisMock.call.mock.calls.filter(([command]) => command === 'WAITAOF')).toHaveLength(3);
    const scanIndex = state.events.indexOf('SCAN reading-ready:*');
    expect(scanIndex).toBeGreaterThan(-1);
    expect(state.events.slice(0, scanIndex).filter((event) => event === 'EVAL purge')).toHaveLength(
      57,
    );
  });
});
