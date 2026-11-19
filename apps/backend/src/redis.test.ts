import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redisMocks = vi.hoisted(() => {
  const instances: RedisMock[] = [];

  class RedisMock {
    readonly on = vi.fn(() => this);
    readonly quit = vi.fn().mockResolvedValue('OK');

    constructor(
      _url: string,
      readonly options: {
        retryStrategy: (times: number) => number | null;
        maxRetriesPerRequest: number;
      },
    ) {
      instances.push(this);
    }
  }

  return { instances, RedisMock };
});

vi.mock('ioredis', () => ({ default: redisMocks.RedisMock }));
vi.mock('./lib/logger', () => ({ logger: { warn: vi.fn() } }));

describe('Redis connection lifecycle', () => {
  beforeEach(() => {
    vi.resetModules();
    redisMocks.instances.length = 0;
  });

  afterEach(() => vi.unstubAllEnvs());

  it('begrenzt standardmäßig die Wiederverbindung auf drei Versuche', async () => {
    vi.stubEnv('REDIS_RECONNECT_CONTINUOUS', undefined);
    const { getRedis } = await import('./redis');
    getRedis();
    expect(redisMocks.instances[0]?.options.retryStrategy(3)).toBe(600);
    expect(redisMocks.instances[0]?.options.retryStrategy(4)).toBeNull();
  });

  it('verbindet sich im Staging nach längeren Ausfällen mit begrenztem Backoff wieder', async () => {
    vi.stubEnv('REDIS_RECONNECT_CONTINUOUS', 'true');
    const { getRedis } = await import('./redis');
    getRedis();
    expect(redisMocks.instances[0]?.options.retryStrategy(4)).toBe(800);
    expect(redisMocks.instances[0]?.options.retryStrategy(100)).toBe(2_000);
    expect(redisMocks.instances[0]?.options.maxRetriesPerRequest).toBe(3);
  });

  it('öffnet nach Drain-Beginn und Verbindungsschluss keinen neuen Client', async () => {
    const { beginRedisShutdown, closeRedis, getRedis } = await import('./redis');
    const initial = getRedis();
    beginRedisShutdown();
    await closeRedis();

    expect(initial).toBe(redisMocks.instances[0]);
    expect(redisMocks.instances[0]?.quit).toHaveBeenCalledOnce();
    expect(() => getRedis()).toThrow('REDIS_SHUTTING_DOWN');
    expect(redisMocks.instances).toHaveLength(1);
  });
});
