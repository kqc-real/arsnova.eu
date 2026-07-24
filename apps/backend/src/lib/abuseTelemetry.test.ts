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
  flushAbuseTelemetry,
  logRateLimitRejection,
  logSessionCodeSoftCapDelay,
  readAbuseSignals,
  recordRateLimitRejection,
  recordSessionCodeFailure,
  recordSessionCodeSoftCapDelay,
  recordSessionCreateCompleted,
  resetAbuseTelemetryForTests,
} from './abuseTelemetry';

function createMulti(execResult: unknown = []) {
  return {
    incrby: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    get: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue(execResult),
  };
}

describe('abuseTelemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'development');
    resetAbuseTelemetryForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('schreibt aggregierte Create-, Session-Code- und 429-Signale per INCRBY in Redis', async () => {
    const multi = createMulti();
    mocks.getRedis.mockReturnValue({ multi: () => multi });

    recordSessionCreateCompleted(25_000);
    recordSessionCodeFailure(25_000);
    recordSessionCodeSoftCapDelay(25_000);
    recordRateLimitRejection('vote', 25_000);
    recordRateLimitRejection('vote', 25_000);
    expect(mocks.getRedis).not.toHaveBeenCalled();
    await flushAbuseTelemetry();

    expect(multi.incrby).toHaveBeenNthCalledWith(1, 'security:metric:sessionCreateCompleted:2', 1);
    expect(multi.incrby).toHaveBeenNthCalledWith(2, 'security:metric:sessionCodeFailure:2', 1);
    expect(multi.incrby).toHaveBeenNthCalledWith(3, 'security:metric:sessionCodeSoftCapDelay:2', 1);
    expect(multi.incrby).toHaveBeenNthCalledWith(4, 'security:metric:rateLimit429:vote:2', 2);
    expect(multi.expire).toHaveBeenCalledWith('security:metric:sessionCreateCompleted:2', 120);
    expect(multi.exec).toHaveBeenCalledOnce();
  });

  it('begrenzt 40.000 inklusive Public-Create-429-Events auf einen Redis-Flush', async () => {
    vi.useFakeTimers();
    const multi = createMulti();
    mocks.getRedis.mockReturnValue({ multi: () => multi });

    for (let index = 0; index < 10_000; index += 1) {
      recordRateLimitRejection('pdf', 25_000);
      recordRateLimitRejection('motd', 25_000);
      recordRateLimitRejection('quizUpload', 25_000);
      recordRateLimitRejection('quickFeedback', 25_000);
    }

    expect(mocks.getRedis).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(4_999);
    expect(mocks.getRedis).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(mocks.getRedis).toHaveBeenCalledOnce();
    expect(multi.incrby).toHaveBeenCalledTimes(4);
    expect(multi.incrby).toHaveBeenCalledWith('security:metric:rateLimit429:pdf:2', 10_000);
    expect(multi.incrby).toHaveBeenCalledWith('security:metric:rateLimit429:motd:2', 10_000);
    expect(multi.incrby).toHaveBeenCalledWith('security:metric:rateLimit429:quizUpload:2', 10_000);
    expect(multi.incrby).toHaveBeenCalledWith(
      'security:metric:rateLimit429:quickFeedback:2',
      10_000,
    );
    expect(multi.exec).toHaveBeenCalledOnce();
  });

  it('startet bei langsamem Redis keine parallelen Flushes und hält Pending-Arbeit konstant', async () => {
    vi.useFakeTimers();
    let resolveFirstFlush!: (value: unknown) => void;
    const firstMulti = createMulti();
    firstMulti.exec.mockReturnValue(
      new Promise((resolve) => {
        resolveFirstFlush = resolve;
      }),
    );
    const secondMulti = createMulti();
    mocks.getRedis
      .mockReturnValueOnce({ multi: () => firstMulti })
      .mockReturnValueOnce({ multi: () => secondMulti });

    for (let index = 0; index < 10_000; index += 1) {
      recordRateLimitRejection('other', 0);
    }
    await vi.advanceTimersByTimeAsync(5_000);
    expect(mocks.getRedis).toHaveBeenCalledOnce();

    for (let bucket = 1; bucket <= 1_000; bucket += 1) {
      for (let event = 0; event < 10; event += 1) {
        recordRateLimitRejection('vote', bucket * 10_000);
      }
    }
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.getRedis).toHaveBeenCalledOnce();

    resolveFirstFlush([]);
    await vi.advanceTimersByTimeAsync(5_000);

    expect(mocks.getRedis).toHaveBeenCalledTimes(2);
    expect(secondMulti.incrby.mock.calls.length).toBeLessThanOrEqual(7);
    expect(secondMulti.exec).toHaveBeenCalledOnce();
  });

  it('aggregiert inklusive des vollständigen Rand-Buckets der letzten Minute', async () => {
    const values = Array.from({ length: 77 }, () => [null, '0']);
    // Reihenfolge je Bucket: create, codeFailure, softCapDelay, sessionCreate, quizUpload,
    // quickFeedback, sessionCode, vote, pdf, motd, other.
    values[0] = [null, '3'];
    values[1] = [null, '7'];
    values[2] = [null, '2'];
    values[4] = [null, '2'];
    values[8] = [null, '4'];
    values[60] = [null, '1'];
    values[69] = [null, '5'];
    // Bei now=60s liegt ein erst 55s altes Ereignis im zusätzlichen Bucket 0.
    values[72] = [null, '2'];
    const multi = createMulti(values);
    mocks.getRedis.mockReturnValue({ multi: () => multi });

    await expect(readAbuseSignals(60_000)).resolves.toEqual({
      sessionCreatesLastMinute: 6,
      sessionCodeFailuresLastMinute: 7,
      sessionCodeSoftCapDelaysLastMinute: 2,
      rateLimit429LastMinute: 11,
      rateLimit429ByCategoryLastMinute: {
        adminLogin: 0,
        sessionCreate: 2,
        quizUpload: 0,
        quickFeedback: 0,
        sessionCode: 0,
        vote: 4,
        pdf: 5,
        motd: 0,
        other: 0,
      },
    });
    expect(multi.get).toHaveBeenCalledTimes(84);
  });

  it('begrenzt 429-Logs je Kategorie und meldet unterdrückte Ereignisse gesammelt', () => {
    const details = {
      path: 'vote.submit',
      category: 'vote' as const,
      ipSource: 'socket',
    };

    logRateLimitRejection(details, 1_000);
    logRateLimitRejection(details, 2_000);
    logRateLimitRejection(details, 3_000);
    logRateLimitRejection(details, 11_000);

    expect(mocks.warn).toHaveBeenCalledTimes(2);
    expect(mocks.warn).toHaveBeenNthCalledWith(1, 'rate_limit_429', {
      ...details,
      suppressedSinceLastLog: 0,
    });
    expect(mocks.warn).toHaveBeenNthCalledWith(2, 'rate_limit_429', {
      ...details,
      suppressedSinceLastLog: 2,
    });
    expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain('203.0.113.5');
  });

  it('loggt Soft-Cap-Delays gesampelt und ohne IDs, Codes oder IPs', () => {
    logSessionCodeSoftCapDelay({ delayMs: 500, globalUtilizationPercent: 90 }, 1_000);
    logSessionCodeSoftCapDelay({ delayMs: 600, globalUtilizationPercent: 91 }, 2_000);
    logSessionCodeSoftCapDelay({ delayMs: 700, globalUtilizationPercent: 92 }, 11_000);

    expect(mocks.warn).toHaveBeenCalledTimes(2);
    expect(mocks.warn).toHaveBeenLastCalledWith('session_code_soft_cap_delay', {
      delayMs: 700,
      globalUtilizationPercent: 92,
      suppressedSinceLastLog: 1,
    });
    expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain('ABC123');
    expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain('203.0.113.');
  });

  it('begrenzt 40.000 inklusive Public-Create-Ereignissen auf vier gesampelte Logs', () => {
    for (let index = 0; index < 10_000; index += 1) {
      logRateLimitRejection(
        { path: 'motd.getCurrent', category: 'motd', ipSource: 'express-req-ip' },
        1_000,
      );
      logRateLimitRejection(
        { path: 'session.getSessionExportPdf', category: 'pdf', ipSource: 'socket' },
        1_000,
      );
      logRateLimitRejection(
        { path: 'quiz.upload', category: 'quizUpload', ipSource: 'express-req-ip' },
        1_000,
      );
      logRateLimitRejection(
        {
          path: 'quickFeedback.create',
          category: 'quickFeedback',
          ipSource: 'express-req-ip',
        },
        1_000,
      );
    }

    expect(mocks.warn).toHaveBeenCalledTimes(4);
    expect(mocks.warn).toHaveBeenCalledWith(
      'rate_limit_429',
      expect.objectContaining({ category: 'motd' }),
    );
    expect(mocks.warn).toHaveBeenCalledWith(
      'rate_limit_429',
      expect.objectContaining({ category: 'pdf' }),
    );
    expect(mocks.warn).toHaveBeenCalledWith(
      'rate_limit_429',
      expect.objectContaining({ category: 'quizUpload' }),
    );
    expect(mocks.warn).toHaveBeenCalledWith(
      'rate_limit_429',
      expect.objectContaining({ category: 'quickFeedback' }),
    );
  });

  it('degradiert bei Redis-Ausfall ohne Request- oder Health-Pfade zu werfen', async () => {
    mocks.getRedis.mockImplementation(() => {
      throw new Error('redis unavailable');
    });

    recordRateLimitRejection('other', 0);
    await expect(flushAbuseTelemetry()).resolves.toBeUndefined();
    await expect(readAbuseSignals(0)).resolves.toEqual({
      sessionCreatesLastMinute: 0,
      sessionCodeFailuresLastMinute: 0,
      sessionCodeSoftCapDelaysLastMinute: 0,
      rateLimit429LastMinute: 0,
      rateLimit429ByCategoryLastMinute: {
        adminLogin: 0,
        sessionCreate: 0,
        quizUpload: 0,
        quickFeedback: 0,
        sessionCode: 0,
        vote: 0,
        pdf: 0,
        motd: 0,
        other: 0,
      },
    });
  });
});
