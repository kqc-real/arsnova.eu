import { beforeEach, describe, expect, it, vi } from 'vitest';

const redisMocks = vi.hoisted(() => {
  const instances: RedisMock[] = [];

  class RedisMock {
    readonly on = vi.fn(() => this);
    readonly quit = vi.fn().mockResolvedValue('OK');

    constructor() {
      instances.push(this);
    }
  }

  return { instances, RedisMock };
});

vi.mock('ioredis', () => ({ default: redisMocks.RedisMock }));
vi.mock('./lib/logger', () => ({ logger: { warn: vi.fn() } }));

import { beginRedisShutdown, closeRedis, getRedis } from './redis';

describe('Redis shutdown lifecycle', () => {
  beforeEach(() => {
    redisMocks.instances.length = 0;
  });

  it('öffnet nach Drain-Beginn und Verbindungsschluss keinen neuen Client', async () => {
    const initial = getRedis();
    beginRedisShutdown();
    await closeRedis();

    expect(initial).toBe(redisMocks.instances[0]);
    expect(redisMocks.instances[0]?.quit).toHaveBeenCalledOnce();
    expect(() => getRedis()).toThrow('REDIS_SHUTTING_DOWN');
    expect(redisMocks.instances).toHaveLength(1);
  });
});
