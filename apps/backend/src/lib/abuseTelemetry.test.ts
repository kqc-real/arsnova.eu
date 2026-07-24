import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getRedis: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('../redis', () => ({
  getRedis: mocks.getRedis,
}));

vi.mock('./logger', () => ({
  logger: {
    warn: mocks.warn,
  },
}));

import {
  readAbuseSignals,
  recordRateLimitRejection,
  recordSessionCreateCompleted,
} from './abuseTelemetry';

function createMulti(execResult: unknown = []) {
  return {
    incr: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    get: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue(execResult),
  };
}

describe('abuseTelemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'development');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('schreibt Create-Erfolge und 429-Kategorien in kurzlebige Redis-Buckets', async () => {
    const multi = createMulti();
    mocks.getRedis.mockReturnValue({ multi: () => multi });

    await recordSessionCreateCompleted(25_000);
    await recordRateLimitRejection('vote', 25_000);

    expect(multi.incr).toHaveBeenNthCalledWith(1, 'security:metric:sessionCreateCompleted:2');
    expect(multi.incr).toHaveBeenNthCalledWith(2, 'security:metric:rateLimit429:vote:2');
    expect(multi.expire).toHaveBeenCalledWith('security:metric:sessionCreateCompleted:2', 120);
  });

  it('aggregiert Create- und 429-Signale über eine Minute', async () => {
    const values = Array.from({ length: 42 }, () => [null, '0']);
    // Reihenfolge je Bucket: create, sessionCreate, sessionCode, vote, pdf, motd, other.
    values[0] = [null, '3'];
    values[1] = [null, '2'];
    values[3] = [null, '4'];
    values[35] = [null, '1'];
    values[39] = [null, '5'];
    const multi = createMulti(values);
    mocks.getRedis.mockReturnValue({ multi: () => multi });

    await expect(readAbuseSignals(60_000)).resolves.toEqual({
      sessionCreatesLastMinute: 4,
      rateLimit429LastMinute: 11,
      rateLimit429ByCategoryLastMinute: {
        sessionCreate: 2,
        sessionCode: 0,
        vote: 4,
        pdf: 5,
        motd: 0,
        other: 0,
      },
    });
    expect(multi.get).toHaveBeenCalledTimes(42);
  });

  it('degradiert bei Redis-Ausfall ohne Request- oder Health-Pfade zu werfen', async () => {
    mocks.getRedis.mockImplementation(() => {
      throw new Error('redis unavailable');
    });

    await expect(recordRateLimitRejection('other', 0)).resolves.toBeUndefined();
    await expect(readAbuseSignals(0)).resolves.toEqual({
      sessionCreatesLastMinute: 0,
      rateLimit429LastMinute: 0,
      rateLimit429ByCategoryLastMinute: {
        sessionCreate: 0,
        sessionCode: 0,
        vote: 0,
        pdf: 0,
        motd: 0,
        other: 0,
      },
    });
  });
});
