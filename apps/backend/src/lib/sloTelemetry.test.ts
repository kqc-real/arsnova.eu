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

import { isTrackedLiveProcedure, readSloSignals, recordLiveRequestTelemetry } from './sloTelemetry';

function createMulti(execResult: unknown = []) {
  return {
    incr: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    get: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue(execResult),
  };
}

describe('sloTelemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'development');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('klassifiziert nur relevante Live-Prozeduren als getrackt', () => {
    expect(isTrackedLiveProcedure('vote.submit')).toBe(true);
    expect(isTrackedLiveProcedure('session.join')).toBe(true);
    expect(isTrackedLiveProcedure('health.stats')).toBe(false);
    expect(isTrackedLiveProcedure('session.onStatusChanged')).toBe(false);
  });

  it('schreibt Total-, Latenz- und SLO-Fehlerzaehler atomar in einen Redis-Bucket', async () => {
    const multi = createMulti();
    mocks.getRedis.mockReturnValue({ multi: () => multi });

    await recordLiveRequestTelemetry({
      durationMs: 742,
      errorCode: 'INTERNAL_SERVER_ERROR',
      nowMs: 25_000,
    });

    expect(multi.incr).toHaveBeenCalledWith('slo:metric:total:2');
    expect(multi.incr).toHaveBeenCalledWith('slo:metric:latency:2:800');
    expect(multi.incr).toHaveBeenCalledWith('slo:metric:error:2');
    expect(multi.expire).toHaveBeenCalledTimes(3);
    expect(multi.exec).toHaveBeenCalledOnce();
  });

  it('zaehlt fachliche Fehler nicht als SLO-Infrastrukturfehler', async () => {
    const multi = createMulti();
    mocks.getRedis.mockReturnValue({ multi: () => multi });

    await recordLiveRequestTelemetry({
      durationMs: 120,
      errorCode: 'BAD_REQUEST',
      nowMs: 10_000,
    });

    expect(multi.incr).toHaveBeenCalledTimes(2);
    expect(multi.incr).not.toHaveBeenCalledWith('slo:metric:error:1');
  });

  it('aggregiert sechs Buckets zu Fehlerquote, p95 und p99', async () => {
    const labelsPerBucket = 14;
    const values = Array.from({ length: labelsPerBucket * 6 }, () => [null, '0']);

    // Neuester Bucket: 100 Requests, davon 1 Fehler; 95 <= 800 ms, 4 <= 1500 ms, 1 > 10 s.
    values[0] = [null, '100'];
    values[1] = [null, '1'];
    values[2 + 4] = [null, '95']; // Label 800
    values[2 + 6] = [null, '4']; // Label 1500
    values[2 + 11] = [null, '1']; // Label inf

    const multi = createMulti(values);
    mocks.getRedis.mockReturnValue({ multi: () => multi });

    const result = await readSloSignals(60_000);

    expect(result).toEqual({
      totalRequestsLastMinute: 100,
      errorRatePercentLastMinute: 1,
      p95LatencyMsLastMinute: 800,
      p99LatencyMsLastMinute: 1500,
    });
    expect(multi.get).toHaveBeenCalledTimes(labelsPerBucket * 6);
  });

  it('degradiert bei Redis-Ausfall ohne den Live-Pfad zu werfen', async () => {
    mocks.getRedis.mockImplementation(() => {
      throw new Error('redis unavailable');
    });

    await expect(
      recordLiveRequestTelemetry({ durationMs: 100, nowMs: 0 }),
    ).resolves.toBeUndefined();
    await expect(readSloSignals(0)).resolves.toEqual({
      totalRequestsLastMinute: 0,
      errorRatePercentLastMinute: 0,
      p95LatencyMsLastMinute: 0,
      p99LatencyMsLastMinute: 0,
    });
  });
});
