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
  classifySloErrorCode,
  computeThroughputFromBuckets,
  flushSloTelemetry,
  isTrackedLiveProcedure,
  percentileFromHistogram,
  readSloSignals,
  recordLiveRequestTelemetry,
  resetSloTelemetryForTests,
  CORE_ACTION_GROUPS,
  DEFINED_CORE_PROCEDURES,
  LATENCY_BUCKETS_MS,
} from './sloTelemetry';

function createRedis(overrides: { eval?: ReturnType<typeof vi.fn>; multi?: unknown } = {}) {
  return {
    eval: overrides.eval ?? vi.fn().mockResolvedValue(1),
    multi: overrides.multi ?? (() => createMulti()),
  };
}

function createMulti(execResult: unknown = []) {
  const multi = {
    incr: vi.fn().mockReturnThis(),
    incrby: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    get: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue(execResult),
  };
  return multi;
}

describe('sloTelemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSloTelemetryForTests();
    vi.stubEnv('NODE_ENV', 'development');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetSloTelemetryForTests();
  });

  it('klassifiziert nur Allowlist-Kernaktionen und schließt Statuspolling aus', () => {
    expect(isTrackedLiveProcedure('vote.submit')).toBe(true);
    expect(isTrackedLiveProcedure('session.join')).toBe(true);
    expect(isTrackedLiveProcedure('qa.list')).toBe(true);
    expect(isTrackedLiveProcedure('qa.submit')).toBe(true);
    expect(isTrackedLiveProcedure('qa.upvote')).toBe(true);
    expect(isTrackedLiveProcedure('qa.vote')).toBe(true);
    expect(isTrackedLiveProcedure('session.skipQuestion')).toBe(true);
    expect(isTrackedLiveProcedure('health.stats')).toBe(false);
    expect(isTrackedLiveProcedure('health.footerBundle')).toBe(false);
    expect(isTrackedLiveProcedure('session.getInfo')).toBe(false);
    expect(isTrackedLiveProcedure('session.onStatusChanged')).toBe(false);
    expect(CORE_ACTION_GROUPS.opsReporting).toEqual([]);
    expect(DEFINED_CORE_PROCEDURES).not.toContain('session.getInfo');
  });

  it('trennt Fehlerklassen server / rateLimit / client', () => {
    expect(classifySloErrorCode('INTERNAL_SERVER_ERROR')).toBe('server');
    expect(classifySloErrorCode('TOO_MANY_REQUESTS')).toBe('rateLimit');
    expect(classifySloErrorCode('BAD_REQUEST')).toBe('client');
    expect(classifySloErrorCode('FORBIDDEN')).toBe('client');
    expect(classifySloErrorCode(undefined)).toBeNull();
  });

  it('berechnet RPS-Durchschnitt und Spitze für ein vollständiges 60s-Fenster', () => {
    // 6 Buckets à 10 s: 100, 50, 80, 40, 60, 30 → Summe 360 / 60 = 6 RPS; Peak 100/10 = 10
    const result = computeThroughputFromBuckets([100, 50, 80, 40, 60, 30], 60);
    expect(result).toEqual({ avgRps: 6, peakRps: 10, sampleSize: 360 });
  });

  it('teilt im unvollständigen Anlauffenster nicht pauschal durch 60', () => {
    // Nur 20 s beobachtet, 40 Requests → 2 RPS (nicht 40/60)
    const result = computeThroughputFromBuckets([25, 15, 0, 0, 0, 0], 20);
    expect(result.avgRps).toBe(2);
    expect(result.peakRps).toBe(2.5);
    expect(result.sampleSize).toBe(40);
  });

  it('berechnet p95/p99 aus Histogramm-Buckets', () => {
    const counts = new Map<string, number>([
      ['800', 95],
      ['1500', 4],
      ['inf', 1],
    ]);
    expect(percentileFromHistogram(100, counts, 0.95)).toBe(800);
    expect(percentileFromHistogram(100, counts, 0.99)).toBe(1500);
    expect(percentileFromHistogram(0, counts, 0.95)).toBe(0);
  });

  it('schreibt gebündelt nach Redis und zählt Fehlerklassen getrennt', async () => {
    const evalMock = vi.fn().mockResolvedValue(1);
    mocks.getRedis.mockReturnValue(createRedis({ eval: evalMock }));

    await recordLiveRequestTelemetry({
      durationMs: 742,
      errorCode: 'INTERNAL_SERVER_ERROR',
      groupId: 'quizFeedback',
      nowMs: 25_000,
    });
    await recordLiveRequestTelemetry({
      durationMs: 120,
      errorCode: 'TOO_MANY_REQUESTS',
      groupId: 'sessionJoin',
      nowMs: 25_000,
    });
    await recordLiveRequestTelemetry({
      durationMs: 90,
      errorCode: 'BAD_REQUEST',
      groupId: 'qa',
      nowMs: 25_000,
    });
    await flushSloTelemetry();

    expect(evalMock).toHaveBeenCalledOnce();
    const args = evalMock.mock.calls[0]!;
    expect(String(args[0])).toContain('flushKey');
    expect(args[1]).toBe(1);
    expect(String(args[2])).toMatch(/^slo:flush:/);
    const flat = args.slice(3).map(String);
    expect(flat).toContain('slo:metric:total:2');
    expect(flat).toContain('3');
    expect(flat).toContain('slo:metric:error:server:2');
    expect(flat).toContain('slo:metric:error:rateLimit:2');
    expect(flat).toContain('slo:metric:error:client:2');
    expect(flat).toContain('slo:metric:latency:2:800');
    expect(flat).toContain('slo:metric:group:quizFeedback:2');
    expect(flat).toContain('slo:metric:group:sessionJoin:2');
    expect(flat).toContain('slo:metric:group:qa:2');
  });

  it('legt bei Flush-Fehler den Batch mit gleicher Flush-ID zurück', async () => {
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(20_000);
    const evalMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('redis down'))
      .mockResolvedValueOnce(1);
    mocks.getRedis.mockReturnValue(createRedis({ eval: evalMock }));

    try {
      await recordLiveRequestTelemetry({ durationMs: 100, nowMs: 10_000, groupId: 'qa' });
      await flushSloTelemetry();
      await flushSloTelemetry();

      expect(evalMock).toHaveBeenCalledTimes(2);
      expect(evalMock.mock.calls[0]![2]).toBe(evalMock.mock.calls[1]![2]);
      expect(evalMock.mock.calls[0]!.slice(3)).toEqual(evalMock.mock.calls[1]!.slice(3));
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it('zählt nicht doppelt wenn Redis angewendet hat aber der Client einen Fehler sieht', async () => {
    const appliedFlushKeys = new Set<string>();
    let incrTotal = 0;
    const evalMock = vi.fn(
      async (_script: string, _n: number, flushKey: string, ...args: string[]) => {
        if (appliedFlushKeys.has(flushKey)) return 0;
        appliedFlushKeys.add(flushKey);
        for (let i = 0; i < args.length; i++) {
          if (args[i] === 'INCRBY' && args[i + 1] === 'slo:metric:total:1') {
            incrTotal += Number(args[i + 2] ?? 0);
          }
        }
        // Erste Bestätigung geht verloren — serverseitig bereits angewendet.
        if (appliedFlushKeys.size === 1) {
          throw new Error('connection reset after apply');
        }
        return 1;
      },
    );
    mocks.getRedis.mockReturnValue(createRedis({ eval: evalMock }));

    await recordLiveRequestTelemetry({ durationMs: 100, nowMs: 10_000, groupId: 'qa' });
    await flushSloTelemetry();
    await flushSloTelemetry();

    expect(incrTotal).toBe(1);
    expect(evalMock).toHaveBeenCalledTimes(2);
    await expect(evalMock.mock.results[1]?.value).resolves.toBe(0);
  });

  it('aggregiert Buckets zu Durchschnitt, Spitze, Fehlerklassen und p95/p99', async () => {
    const labels = [...LATENCY_BUCKETS_MS.map(String), 'inf'];
    const groupIds = Object.keys(CORE_ACTION_GROUPS);
    const perBucket = 1 + 3 + 1 + labels.length + groupIds.length; // total + 3 classes + legacy + latency + groups
    const values: Array<[null, string]> = Array.from({ length: 1 + perBucket * 6 }, () => [
      null,
      '0',
    ]);

    // Epoch: Fenster vollständig (älter als 60 s)
    values[0] = [null, String(60_000 - 70_000)];

    // Neuester Bucket (offset 0): 100 Requests
    let cursor = 1;
    values[cursor++] = [null, '100']; // total
    values[cursor++] = [null, '1']; // server
    values[cursor++] = [null, '0']; // rateLimit
    values[cursor++] = [null, '2']; // client
    values[cursor++] = [null, '0']; // legacy
    values[cursor + 4] = [null, '95']; // label 800
    values[cursor + 6] = [null, '4']; // label 1500
    values[cursor + 11] = [null, '1']; // inf
    cursor += labels.length;
    values[cursor + groupIds.indexOf('qa')] = [null, '40'];

    const multi = createMulti(values);
    mocks.getRedis.mockReturnValue({ multi: () => multi });

    const result = await readSloSignals(60_000);

    expect(result.available).toBe(true);
    expect(result.measurementState).toBe('AVAILABLE');
    expect(result.windowComplete).toBe(true);
    expect(result.totalRequestsLastMinute).toBe(100);
    expect(result.errorRatePercentLastMinute).toBe(1); // nur server+rateLimit
    expect(result.errorClasses).toEqual({ server: 1, rateLimit: 0, client: 2 });
    expect(result.p95LatencyMsLastMinute).toBe(800);
    expect(result.p99LatencyMsLastMinute).toBe(1500);
    expect(result.avgRps).toBeCloseTo(100 / 60, 5);
    expect(result.peakRps).toBe(10);
    expect(result.latencyIncludesFailedRequests).toBe(true);
    expect(result.insufficientLatencySample).toBe(false);
    expect(result.groups.find((g) => g.id === 'qa')?.requestsLastMinute).toBe(40);
    expect(result.lastSuccessfulReadAt).toBeTruthy();
  });

  it('markiert unvollständiges Anlauffenster als WARMING_UP und nutzt beobachtete Zeit', async () => {
    const labels = [...LATENCY_BUCKETS_MS.map(String), 'inf'];
    const groupIds = Object.keys(CORE_ACTION_GROUPS);
    const perBucket = 1 + 3 + 1 + labels.length + groupIds.length;
    const values: Array<[null, string]> = Array.from({ length: 1 + perBucket * 6 }, () => [
      null,
      '0',
    ]);
    // Epoch vor 20 s
    values[0] = [null, String(60_000 - 20_000)];
    values[1] = [null, '40']; // total im aktuellen Bucket

    const multi = createMulti(values);
    mocks.getRedis.mockReturnValue({ multi: () => multi });

    const result = await readSloSignals(60_000);
    expect(result.measurementState).toBe('WARMING_UP');
    expect(result.windowComplete).toBe(false);
    expect(result.observedWindowSeconds).toBe(20);
    expect(result.avgRps).toBe(2);
    expect(result.insufficientLatencySample).toBe(false); // 40 >= 20
  });

  it('liefert bei Redis-Ausfall UNAVAILABLE statt 0 als gesunden Zustand', async () => {
    mocks.getRedis.mockImplementation(() => {
      throw new Error('redis unavailable');
    });

    await expect(
      recordLiveRequestTelemetry({ durationMs: 100, nowMs: 0 }),
    ).resolves.toBeUndefined();
    const result = await readSloSignals(0);
    expect(result.available).toBe(false);
    expect(result.measurementState).toBe('UNAVAILABLE');
    expect(result.avgRps).toBeNull();
    expect(result.peakRps).toBeNull();
    expect(result.lastSuccessfulReadAt).toBeNull();
  });

  it('verwendet keine hochkardinalen Gruppenlabels', () => {
    for (const groupId of Object.keys(CORE_ACTION_GROUPS)) {
      expect(groupId).toMatch(/^(sessionJoin|quizFeedback|qa|presenter|opsReporting)$/);
    }
    for (const path of DEFINED_CORE_PROCEDURES) {
      expect(path).not.toMatch(/[A-Z0-9]{4,}/); // keine Sessioncodes
      expect(path.includes('/')).toBe(false);
    }
  });
});
