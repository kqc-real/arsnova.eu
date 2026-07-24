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
  flushPdfTelemetry,
  readPdfSignals,
  recordPdfJobOutcome,
  resetPdfTelemetryForTests,
} from './pdfTelemetry';

function createMulti(execResult: unknown = []) {
  return {
    incrby: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    get: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue(execResult),
  };
}

describe('pdfTelemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'development');
    resetPdfTelemetryForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('schreibt aggregierte PDF-Ergebnisse per INCRBY in kurzlebige Redis-Buckets', async () => {
    const multi = createMulti();
    mocks.getRedis.mockReturnValue({ multi: () => multi });

    recordPdfJobOutcome('rejected', 25_000);
    recordPdfJobOutcome('rejected', 25_000);
    expect(mocks.getRedis).not.toHaveBeenCalled();
    await flushPdfTelemetry();

    expect(multi.incrby).toHaveBeenCalledWith('pdf:metric:rejected:2', 2);
    expect(multi.expire).toHaveBeenCalledWith('pdf:metric:rejected:2', 120);
    expect(multi.exec).toHaveBeenCalledOnce();
  });

  it('begrenzt 20.000 PDF-Ablehnungen auf einen Redis-Flush', async () => {
    vi.useFakeTimers();
    const multi = createMulti();
    mocks.getRedis.mockReturnValue({ multi: () => multi });

    for (let index = 0; index < 20_000; index += 1) {
      recordPdfJobOutcome('rejected', 25_000);
    }

    expect(mocks.getRedis).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(mocks.getRedis).toHaveBeenCalledOnce();
    expect(multi.incrby).toHaveBeenCalledOnce();
    expect(multi.incrby).toHaveBeenCalledWith('pdf:metric:rejected:2', 20_000);
    expect(multi.exec).toHaveBeenCalledOnce();
  });

  it('startet bei langsamem Redis keine parallelen Flushes und hält Pending-Arbeit bounded', async () => {
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

    recordPdfJobOutcome('rejected', 0);
    await vi.advanceTimersByTimeAsync(5_000);
    for (let bucket = 1; bucket <= 1_000; bucket += 1) {
      recordPdfJobOutcome('rejected', bucket * 10_000);
      recordPdfJobOutcome('failed', bucket * 10_000);
      recordPdfJobOutcome('completed', bucket * 10_000);
    }
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.getRedis).toHaveBeenCalledOnce();

    resolveFirstFlush([]);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(mocks.getRedis).toHaveBeenCalledTimes(2);
    expect(secondMulti.incrby.mock.calls.length).toBeLessThanOrEqual(21);
    expect(secondMulti.exec).toHaveBeenCalledOnce();
  });

  it('aggregiert inklusive des vollständigen Rand-Buckets der letzten Minute', async () => {
    const values = Array.from({ length: 21 }, () => [null, '0']);
    values[0] = [null, '3'];
    values[1] = [null, '1'];
    values[2] = [null, '2'];
    // Bei now=60s liegt ein erst 55s altes Ereignis im zusätzlichen Bucket 0.
    values[18] = [null, '4'];
    values[19] = [null, '2'];
    values[20] = [null, '1'];
    const multi = createMulti(values);
    mocks.getRedis.mockReturnValue({ multi: () => multi });

    await expect(readPdfSignals(60_000)).resolves.toEqual({
      completedLastMinute: 7,
      failedLastMinute: 3,
      rejectedLastMinute: 3,
    });
    expect(multi.get).toHaveBeenCalledTimes(21);
  });

  it('degradiert bei Redis-Ausfall ohne PDF- oder Health-Pfade zu werfen', async () => {
    mocks.getRedis.mockImplementation(() => {
      throw new Error('redis unavailable');
    });

    recordPdfJobOutcome('completed', 0);
    await expect(flushPdfTelemetry()).resolves.toBeUndefined();
    await expect(readPdfSignals(0)).resolves.toEqual({
      completedLastMinute: 0,
      failedLastMinute: 0,
      rejectedLastMinute: 0,
    });
  });
});
