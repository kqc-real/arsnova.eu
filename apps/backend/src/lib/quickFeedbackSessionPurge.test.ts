import { beforeEach, describe, expect, it, vi } from 'vitest';

const { redisMock, state } = vi.hoisted(() => {
  const state = {
    values: new Map<string, string>(),
    calls: [] as string[],
    clientIds: [] as number[],
    runIds: [] as string[],
    waitAof: [] as Array<[number, number]>,
    scanPages: [] as Array<readonly [string, string[]]>,
    beforeLegacyEval: null as null | (() => void),
  };
  const redisMock = {
    eval: vi.fn(async (script: string, keyCount: number, ...parameters: string[]) => {
      state.calls.push('EVAL');
      if (script.includes('quick_feedback_legacy_session_bound_rollout_purge_v1')) {
        state.beforeLegacyEval?.();
        state.beforeLegacyEval = null;
        const keys = parameters.slice(0, keyCount);
        const expectedRaw = parameters[keyCount];
        const primaryKey = keys[0]!;
        const raw = state.values.get(primaryKey);
        if (raw === undefined) return [0, 0];
        if (raw !== expectedRaw) return [2, 0];
        let parsed: { sessionBound?: boolean; sessionId?: string };
        try {
          parsed = JSON.parse(raw) as typeof parsed;
        } catch {
          return [-1, 0];
        }
        if (
          !parsed ||
          typeof parsed !== 'object' ||
          parsed.sessionBound !== true ||
          Object.hasOwn(parsed, 'sessionId')
        ) {
          return [0, 0];
        }
        let deleted = 0;
        for (const key of keys) {
          if (state.values.delete(key)) deleted += 1;
        }
        return [1, deleted];
      }
      if (!script.includes('quick_feedback_session_purge_v1')) {
        throw new Error('unexpected script');
      }
      const keys = parameters.slice(0, keyCount);
      const args = parameters.slice(keyCount);
      const [primaryKey, ...secondaryAndFence] = keys;
      const fenceKey = secondaryAndFence.at(-1)!;
      state.values.set(fenceKey, '1');
      const raw = state.values.get(primaryKey!);
      if (!raw) return [1, 0];
      let parsed: { sessionBound?: boolean; sessionId?: string };
      try {
        parsed = JSON.parse(raw) as typeof parsed;
      } catch {
        return [-1, 0];
      }
      if (!parsed || typeof parsed !== 'object' || parsed.sessionBound !== true) return [2, 0];
      if (parsed.sessionId !== undefined && parsed.sessionId !== args[0]) return [3, 0];
      let deleted = 0;
      for (const key of keys.slice(0, 6)) {
        if (state.values.delete(key)) deleted += 1;
      }
      return [1, deleted];
    }),
    scan: vi.fn(async () => {
      state.calls.push('SCAN');
      return (
        state.scanPages.shift() ?? [
          '0',
          [...state.values.keys()].filter((key) => key.startsWith('qf:')),
        ]
      );
    }),
    get: vi.fn(async (key: string) => {
      state.calls.push('GET');
      return state.values.get(key) ?? null;
    }),
    set: vi.fn(async (key: string, value: string) => {
      state.calls.push('SET');
      state.values.set(key, value);
      return 'OK';
    }),
    call: vi.fn(async (command: string, ...args: Array<string | number>) => {
      state.calls.push(command);
      if (command === 'CLIENT' && args[0] === 'ID') return state.clientIds.shift() ?? 41;
      if (command === 'INFO' && args[0] === 'server') {
        return `# Server\r\nrun_id:${state.runIds.shift() ?? 'a'.repeat(40)}\r\n`;
      }
      if (command === 'WAITAOF') return state.waitAof.shift() ?? [1, 0];
      throw new Error(`unexpected Redis command: ${command}`);
    }),
  };
  return { redisMock, state };
});

vi.mock('../redis', () => ({
  getRedis: () => redisMock,
}));

import {
  buildQuickFeedbackSessionPurgeFenceKey,
  evictLegacySessionBoundQuickFeedbackForRollout,
  purgeSessionBoundQuickFeedbackForSessions,
} from './quickFeedbackSessionPurge';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_SESSION_ID = '22222222-2222-4222-8222-222222222222';

function seedRound(
  code: string,
  binding: { sessionBound: boolean; sessionId?: string } | string,
): void {
  state.values.set(
    `qf:${code}`,
    typeof binding === 'string'
      ? binding
      : JSON.stringify({
          type: 'YESNO',
          locked: false,
          totalVotes: 1,
          distribution: { YES: 1, NO: 0, MAYBE: 0 },
          ...binding,
        }),
  );
  for (const key of [
    `qf:known:${code}`,
    `qf:voters:${code}`,
    `qf:choices:${code}`,
    `qf:choices:r1:${code}`,
    `qf:tempo:buckets:${code}`,
    `qf:host:${code}`,
  ]) {
    state.values.set(key, 'private');
  }
}

describe('session-bound quick-feedback purge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    state.values.clear();
    state.calls.length = 0;
    state.clientIds.length = 0;
    state.runIds.length = 0;
    state.waitAof.length = 0;
    state.scanPages.length = 0;
    state.beforeLegacyEval = null;
  });

  it('setzt die Fence und entfernt genau die sechs sessiongebundenen Daten-Keys', async () => {
    seedRound('ABC123', { sessionBound: true, sessionId: SESSION_ID });

    await expect(
      purgeSessionBoundQuickFeedbackForSessions([{ sessionId: SESSION_ID, sessionCode: 'abc123' }]),
    ).resolves.toBe(6);

    expect([...state.values.keys()].filter((key) => key.startsWith('qf:ABC123'))).toEqual([]);
    expect(state.values.get('qf:host:ABC123')).toBe('private');
    expect(state.values.get(buildQuickFeedbackSessionPurgeFenceKey(SESSION_ID))).toBe('1');
  });

  it('lässt ein Standalone-Blitzlicht desselben Codes unangetastet', async () => {
    seedRound('ABC123', { sessionBound: false });

    await expect(
      purgeSessionBoundQuickFeedbackForSessions([{ sessionId: SESSION_ID, sessionCode: 'ABC123' }]),
    ).resolves.toBe(0);

    expect(state.values.get('qf:ABC123')).toContain('"sessionBound":false');
    expect(state.values.get('qf:voters:ABC123')).toBe('private');
    expect(state.values.get('qf:host:ABC123')).toBe('private');
  });

  it('lässt eine Runde mit anderer autoritativer sessionId unangetastet', async () => {
    seedRound('ABC123', { sessionBound: true, sessionId: OTHER_SESSION_ID });

    await expect(
      purgeSessionBoundQuickFeedbackForSessions([{ sessionId: SESSION_ID, sessionCode: 'ABC123' }]),
    ).resolves.toBe(0);

    expect(state.values.has('qf:ABC123')).toBe(true);
    expect(state.values.has('qf:choices:ABC123')).toBe(true);
  });

  it('bricht bei einem nicht klassifizierbaren Primärwert fail-closed ab', async () => {
    seedRound('ABC123', '{kein-json');

    await expect(
      purgeSessionBoundQuickFeedbackForSessions([{ sessionId: SESSION_ID, sessionCode: 'ABC123' }]),
    ).rejects.toThrow('QUICK_FEEDBACK_SESSION_PURGE_MALFORMED_RECORD');

    expect(state.values.has('qf:ABC123')).toBe(true);
    expect(state.values.get(buildQuickFeedbackSessionPurgeFenceKey(SESSION_ID))).toBe('1');
  });

  it('erfasst den Redis-Kontext vor der Mutation und bestätigt den Chunk per WAITAOF', async () => {
    vi.stubEnv('QUICK_FEEDBACK_PURGE_REQUIRE_DURABILITY', '1');
    seedRound('ABC123', { sessionBound: true, sessionId: SESSION_ID });

    await purgeSessionBoundQuickFeedbackForSessions([
      { sessionId: SESSION_ID, sessionCode: 'ABC123' },
    ]);

    expect(state.calls.indexOf('CLIENT')).toBeLessThan(state.calls.indexOf('EVAL'));
    expect(redisMock.call).toHaveBeenCalledWith('WAITAOF', 1, 0, 5_000);
    expect([...state.values.keys()].some((key) => key.startsWith('qf:purge-durability:v1:'))).toBe(
      true,
    );
  });

  it('bricht ab, wenn WAITAOF den lokalen AOF-Fsync nicht bestätigt', async () => {
    vi.stubEnv('QUICK_FEEDBACK_PURGE_REQUIRE_DURABILITY', '1');
    state.waitAof.push([0, 0]);
    seedRound('ABC123', { sessionBound: true, sessionId: SESSION_ID });

    await expect(
      purgeSessionBoundQuickFeedbackForSessions([{ sessionId: SESSION_ID, sessionCode: 'ABC123' }]),
    ).rejects.toThrow('QUICK_FEEDBACK_PURGE_DURABILITY_UNAVAILABLE');
  });

  it('akzeptiert nach der Mutation keinen gewechselten Redis-Run-Kontext', async () => {
    vi.stubEnv('QUICK_FEEDBACK_PURGE_REQUIRE_DURABILITY', '1');
    state.runIds.push('a'.repeat(40), 'b'.repeat(40));
    seedRound('ABC123', { sessionBound: true, sessionId: SESSION_ID });

    await expect(
      purgeSessionBoundQuickFeedbackForSessions([{ sessionId: SESSION_ID, sessionCode: 'ABC123' }]),
    ).rejects.toThrow('QUICK_FEEDBACK_PURGE_DURABILITY_UNAVAILABLE');

    expect(state.calls.indexOf('INFO')).toBeLessThan(state.calls.indexOf('EVAL'));
    expect(redisMock.call.mock.calls.some(([command]) => command === 'WAITAOF')).toBe(false);
  });

  it('begrenzt Bulk-Purges auf 25 Mutationen pro Durability-Barrier', async () => {
    vi.stubEnv('QUICK_FEEDBACK_PURGE_REQUIRE_DURABILITY', '1');
    const events = Array.from({ length: 57 }, (_, index) => ({
      sessionId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      sessionCode: `S${String(index).padStart(5, '0')}`,
    }));

    await purgeSessionBoundQuickFeedbackForSessions(events);

    expect(redisMock.eval).toHaveBeenCalledTimes(57);
    expect(redisMock.call.mock.calls.filter(([command]) => command === 'WAITAOF')).toHaveLength(3);
  });
});

describe('legacy quick-feedback rollout cutover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    state.values.clear();
    state.calls.length = 0;
    state.clientIds.length = 0;
    state.runIds.length = 0;
    state.waitAof.length = 0;
    state.scanPages.length = 0;
    state.beforeLegacyEval = null;
  });

  it('entfernt eine Legacy-Sessionrunde atomar und bleibt idempotent', async () => {
    seedRound('LEG123', { sessionBound: true });

    await expect(evictLegacySessionBoundQuickFeedbackForRollout()).resolves.toBe(6);

    expect(state.values.has('qf:LEG123')).toBe(false);
    expect(state.values.has('qf:known:LEG123')).toBe(false);
    expect(state.values.has('qf:voters:LEG123')).toBe(false);
    expect(state.values.has('qf:choices:LEG123')).toBe(false);
    expect(state.values.has('qf:choices:r1:LEG123')).toBe(false);
    expect(state.values.has('qf:tempo:buckets:LEG123')).toBe(false);
    expect(state.values.get('qf:host:LEG123')).toBe('private');

    await expect(evictLegacySessionBoundQuickFeedbackForRollout()).resolves.toBe(0);
  });

  it('lässt neue sessionId-gebundene Runden unangetastet', async () => {
    seedRound('NEW123', { sessionBound: true, sessionId: SESSION_ID });

    await expect(evictLegacySessionBoundQuickFeedbackForRollout()).resolves.toBe(0);

    expect(state.values.has('qf:NEW123')).toBe(true);
    expect(state.values.has('qf:choices:NEW123')).toBe(true);
  });

  it('lässt Standalone-Runden samt Nebenkeys und Host-Token unangetastet', async () => {
    seedRound('STD123', { sessionBound: false });

    await expect(evictLegacySessionBoundQuickFeedbackForRollout()).resolves.toBe(0);

    expect(state.values.has('qf:STD123')).toBe(true);
    expect(state.values.get('qf:voters:STD123')).toBe('private');
    expect(state.values.get('qf:host:STD123')).toBe('private');
  });

  it('ignoriert Nicht-Primärkeys und folgt dem SCAN-Cursor über mehrere Seiten', async () => {
    seedRound('PAG123', { sessionBound: true });
    seedRound('PAG456', { sessionBound: true });
    state.values.set('qf:ABCDE', '{kein-json');
    state.values.set('qf:lower1', '{kein-json');
    state.values.set('qf:ABC123:extra', '{kein-json');
    state.scanPages.push(
      ['17', ['qf:host:PAG123', 'qf:PAG123', 'qf:ABCDE', 'qf:lower1']],
      ['0', ['qf:PAG123', 'qf:PAG456', 'qf:ABC123:extra', 'qf:purge-durability:v1:x']],
    );

    await expect(evictLegacySessionBoundQuickFeedbackForRollout()).resolves.toBe(12);

    expect(redisMock.scan.mock.calls).toEqual([
      ['0', 'MATCH', 'qf:*', 'COUNT', 250],
      ['17', 'MATCH', 'qf:*', 'COUNT', 250],
    ]);
    expect(state.values.get('qf:host:PAG123')).toBe('private');
    expect(state.values.get('qf:ABCDE')).toBe('{kein-json');
    expect(state.values.get('qf:lower1')).toBe('{kein-json');
    expect(state.values.get('qf:ABC123:extra')).toBe('{kein-json');
  });

  it('bricht bei einem malformed exakten Primärwert fail-closed vor der Mutation ab', async () => {
    state.values.set('qf:BAD123', '{kein-json');

    await expect(evictLegacySessionBoundQuickFeedbackForRollout()).rejects.toThrow(
      'QUICK_FEEDBACK_LEGACY_PURGE_MALFORMED_RECORD',
    );

    expect(redisMock.eval).not.toHaveBeenCalled();
    expect(redisMock.call).not.toHaveBeenCalledWith('WAITAOF', 1, 0, 5_000);
    expect(state.values.get('qf:BAD123')).toBe('{kein-json');
  });

  it('bricht bei sessionBound true mit ungültiger sessionId fail-closed ab', async () => {
    state.values.set(
      'qf:BAD456',
      JSON.stringify({
        type: 'YESNO',
        locked: false,
        totalVotes: 0,
        distribution: { YES: 0, NO: 0, MAYBE: 0 },
        sessionBound: true,
        sessionId: null,
      }),
    );

    await expect(evictLegacySessionBoundQuickFeedbackForRollout()).rejects.toThrow(
      'QUICK_FEEDBACK_LEGACY_PURGE_MALFORMED_RECORD',
    );

    expect(redisMock.eval).not.toHaveBeenCalled();
  });

  it('lässt einen zwischen Read und Lua-CAS erneuerten Primärwert vollständig stehen', async () => {
    seedRound('RACE12', { sessionBound: true });
    const replacement = JSON.stringify({ sessionBound: true, sessionId: OTHER_SESSION_ID });
    state.beforeLegacyEval = () => state.values.set('qf:RACE12', replacement);

    await expect(evictLegacySessionBoundQuickFeedbackForRollout()).resolves.toBe(0);

    expect(state.values.get('qf:RACE12')).toBe(replacement);
    expect(state.values.get('qf:voters:RACE12')).toBe('private');
    expect(state.values.get('qf:host:RACE12')).toBe('private');
  });

  it('bestätigt höchstens 25 Legacy-Mutationen pro AOF-Barriere', async () => {
    vi.stubEnv('QUICK_FEEDBACK_PURGE_REQUIRE_DURABILITY', '1');
    for (let index = 0; index < 57; index += 1) {
      seedRound(`L${String(index).padStart(5, '0')}`, { sessionBound: true });
    }

    await expect(evictLegacySessionBoundQuickFeedbackForRollout()).resolves.toBe(57 * 6);

    expect(redisMock.eval).toHaveBeenCalledTimes(57);
    expect(redisMock.call.mock.calls.filter(([command]) => command === 'WAITAOF')).toHaveLength(3);
    expect(state.calls.indexOf('CLIENT')).toBeLessThan(state.calls.indexOf('EVAL'));
  });

  it('bricht den Rollout ab, wenn WAITAOF den Legacy-Cutover nicht bestätigt', async () => {
    vi.stubEnv('QUICK_FEEDBACK_PURGE_REQUIRE_DURABILITY', '1');
    state.waitAof.push([0, 0]);
    seedRound('AOF123', { sessionBound: true });

    await expect(evictLegacySessionBoundQuickFeedbackForRollout()).rejects.toThrow(
      'QUICK_FEEDBACK_PURGE_DURABILITY_UNAVAILABLE',
    );

    expect(redisMock.call).toHaveBeenCalledWith('WAITAOF', 1, 0, 5_000);
  });
});
