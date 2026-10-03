import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { redisMocks } = vi.hoisted(() => {
  const state = {
    messageHandler: null as ((channel: string, message: string) => void) | null,
    store: new Map<string, string>(),
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
  registerSessionPurgeInvalidator,
  resetSessionPurgeInvalidationForTests,
  SESSION_PURGE_INVALIDATION_CHANNEL,
  startSessionPurgeInvalidationSubscriber,
  stopSessionPurgeInvalidationSubscriber,
} from './sessionPurgeInvalidation';

describe('session purge invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMocks.state.messageHandler = null;
    redisMocks.state.store.clear();
    resetSessionPurgeInvalidationForTests();
  });

  afterEach(async () => {
    await stopSessionPurgeInvalidationSubscriber();
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

  it('entfernt fertige Snapshot-Caches vor dem Fan-out und beim zweiten Purge idempotent', async () => {
    const targetKey = 'nlp:wc:snap:ABC123:SEMANTIC:TOP:NONE:1.14d.1:raw-answer';
    const otherSessionKey = 'nlp:wc:snap:DEF456:SEMANTIC:TOP:NONE:1.14d.1:other';
    redisMocks.state.store.set(targetKey, '{"members":[{"text":"private answer"}]}');
    redisMocks.state.store.set(otherSessionKey, '{"members":[{"text":"other answer"}]}');

    const event = { sessionId: 'session-1', sessionCode: 'abc123' };
    await publishSessionPurgeInvalidation(event);
    await publishSessionPurgeInvalidation(event);

    expect(redisMocks.state.store.has(targetKey)).toBe(false);
    expect(redisMocks.state.store.has(otherSessionKey)).toBe(true);
    expect(redisMocks.primary.unlink).toHaveBeenCalledTimes(1);
    expect(redisMocks.primary.publish).toHaveBeenCalledTimes(2);
  });

  it('bricht den ersten Purge vor dem Fan-out ab, wenn die Snapshot-Eviction fehlschlägt', async () => {
    redisMocks.primary.scan.mockRejectedValueOnce(new Error('Redis down'));

    await expect(
      publishSessionPurgeInvalidation({ sessionId: 'session-1', sessionCode: 'ABC123' }),
    ).rejects.toThrow('Redis down');

    expect(redisMocks.primary.publish).not.toHaveBeenCalled();
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
