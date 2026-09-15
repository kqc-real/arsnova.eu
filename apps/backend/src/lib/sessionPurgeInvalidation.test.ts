import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { redisMocks } = vi.hoisted(() => {
  const state = {
    messageHandler: null as ((channel: string, message: string) => void) | null,
  };
  const subscriber = {
    on: vi.fn((event: string, handler: (channel: string, message: string) => void) => {
      if (event === 'message') state.messageHandler = handler;
      return subscriber;
    }),
    subscribe: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue('OK'),
  };
  return {
    redisMocks: {
      state,
      subscriber,
      primary: {
        publish: vi.fn().mockResolvedValue(2),
        duplicate: vi.fn(() => subscriber),
      },
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
