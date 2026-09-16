import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  markQaPresenceGap,
  markQaPresenceObservation,
  readQaTelemetry,
  recordQaQuestionAccepted,
  recordQaRatingChanged,
  resetQaTelemetryForTests,
} from './qaTelemetry';

type TransactionMock = {
  incr: ReturnType<typeof vi.fn>;
  expire: ReturnType<typeof vi.fn>;
  exec: ReturnType<typeof vi.fn>;
};

function createMemoryRedis() {
  const values = new Map<string, string>();
  const transactions: TransactionMock[] = [];
  const redis = {
    set: vi.fn(async (key: string, value: string, ...args: unknown[]) => {
      if (args.includes('NX') && values.has(key)) {
        return null;
      }
      values.set(key, value);
      return 'OK';
    }),
    get: vi.fn(async (key: string) => values.get(key) ?? null),
    mget: vi.fn(async (...keys: string[]) => keys.map((key) => values.get(key) ?? null)),
    multi: vi.fn(() => {
      const increments: string[] = [];
      const transaction: TransactionMock = {
        incr: vi.fn(),
        expire: vi.fn(),
        exec: vi.fn(),
      };
      transaction.incr.mockImplementation((key: string) => {
        increments.push(key);
        return transaction;
      });
      transaction.expire.mockImplementation(() => transaction);
      transaction.exec.mockImplementation(async () => {
        for (const key of increments) {
          const current = Number.parseInt(values.get(key) ?? '0', 10);
          values.set(key, String((Number.isFinite(current) ? current : 0) + 1));
        }
        return [];
      });
      transactions.push(transaction);
      return transaction;
    }),
  };
  return { redis, transactions, values };
}

describe('qaTelemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRedis.mockReset();
    resetQaTelemetryForTests();
  });

  it('nutzt atomare Redis-INCRs in gemeinsamen 1-Sekunden-Buckets', async () => {
    const { redis, transactions, values } = createMemoryRedis();
    mocks.getRedis.mockReturnValue(redis);

    await Promise.all([
      recordQaQuestionAccepted('question-a', 12_001),
      recordQaQuestionAccepted('question-b', 12_999),
      recordQaRatingChanged('rating-a', 13_000),
    ]);

    expect(values.get('qa:telemetry:questions:12')).toBe('2');
    expect(values.get('qa:telemetry:ratings:13')).toBe('1');
    const incrementedKeys = transactions.flatMap((transaction) =>
      transaction.incr.mock.calls.map(([key]) => key),
    );
    expect(incrementedKeys.filter((key) => key === 'qa:telemetry:questions:12')).toHaveLength(2);
    expect(incrementedKeys.filter((key) => key === 'qa:telemetry:ratings:13')).toHaveLength(1);
    for (const transaction of transactions) {
      expect(transaction.expire).toHaveBeenCalledWith(transaction.incr.mock.calls[0]?.[0], 150);
      expect(transaction.exec).toHaveBeenCalledOnce();
    }
    expect(redis.set).toHaveBeenCalledWith(
      'qa:telemetry:dedup:questions:question-a',
      '1',
      'EX',
      180,
      'NX',
    );
  });

  it('liefert Minutenmetriken erst nach 60 Sekunden Warm-up', async () => {
    const { redis } = createMemoryRedis();
    mocks.getRedis.mockReturnValue(redis);

    await expect(readQaTelemetry(10_000)).resolves.toMatchObject({
      questionsLastMinute: null,
      ratingsLastMinute: null,
      minuteStatus: 'WARMING_UP',
    });
    await recordQaQuestionAccepted('question-a', 69_500);
    await recordQaRatingChanged('rating-a', 69_800);

    await expect(readQaTelemetry(69_999)).resolves.toMatchObject({
      questionsLastMinute: null,
      ratingsLastMinute: null,
      minuteStatus: 'WARMING_UP',
    });
    await expect(readQaTelemetry(70_000)).resolves.toEqual({
      questionsLastMinute: 1,
      ratingsLastMinute: 1,
      minuteStatus: 'AVAILABLE',
      presenceStatus: 'WARMING_UP',
    });
  });

  it('dedupliziert Fragenereignisse Redis-weit anhand der Frage-ID', async () => {
    const { redis, values } = createMemoryRedis();
    mocks.getRedis.mockReturnValue(redis);

    await readQaTelemetry(40_000);
    await recordQaQuestionAccepted('question-a', 43_100);
    await recordQaQuestionAccepted('question-a', 44_100);
    await recordQaQuestionAccepted('question-b', 44_200);

    await expect(readQaTelemetry(100_000)).resolves.toMatchObject({
      questionsLastMinute: 2,
      minuteStatus: 'AVAILABLE',
    });
    expect(redis.multi).toHaveBeenCalledTimes(2);
    expect(values.get('qa:telemetry:questions:43')).toBe('1');
    expect(values.get('qa:telemetry:questions:44')).toBe('1');
    expect(
      redis.set.mock.calls.filter(([key]) => key === 'qa:telemetry:dedup:questions:question-a'),
    ).toHaveLength(2);
  });

  it('liefert bei Redis-Fehlern null und UNAVAILABLE statt zu werfen', async () => {
    mocks.getRedis.mockImplementation(() => {
      throw new Error('redis unavailable');
    });

    await expect(recordQaQuestionAccepted('question-a', 10_000)).resolves.toBeUndefined();
    await expect(readQaTelemetry(10_000)).resolves.toEqual({
      questionsLastMinute: null,
      ratingsLastMinute: null,
      minuteStatus: 'UNAVAILABLE',
      presenceStatus: 'UNAVAILABLE',
    });
  });

  it('gibt Presence erst nach 180 Sekunden frei und startet nach einer Lücke neu', async () => {
    const { redis, values } = createMemoryRedis();
    mocks.getRedis.mockReturnValue(redis);

    await markQaPresenceObservation(10_000);

    await expect(readQaTelemetry(189_999)).resolves.toMatchObject({
      presenceStatus: 'WARMING_UP',
    });
    await expect(readQaTelemetry(190_000)).resolves.toMatchObject({
      presenceStatus: 'AVAILABLE',
    });

    markQaPresenceGap();
    await markQaPresenceObservation(200_000);
    expect(values.get('qa:telemetry:presence:observed-since')).toBe('200000');
    await expect(readQaTelemetry(379_999)).resolves.toMatchObject({
      presenceStatus: 'WARMING_UP',
    });
    await expect(readQaTelemetry(380_000)).resolves.toMatchObject({
      presenceStatus: 'AVAILABLE',
    });
  });

  it('setzt nach einer bekannten Lücke nur den betroffenen Warm-up neu', async () => {
    const { redis } = createMemoryRedis();
    mocks.getRedis.mockReturnValue(redis);
    await readQaTelemetry(10_000);

    await expect(readQaTelemetry(190_000)).resolves.toMatchObject({
      minuteStatus: 'AVAILABLE',
      presenceStatus: 'AVAILABLE',
    });

    markQaPresenceGap();
    await markQaPresenceObservation(200_000);
    await expect(readQaTelemetry(210_000)).resolves.toMatchObject({
      minuteStatus: 'AVAILABLE',
      presenceStatus: 'WARMING_UP',
    });
  });
});
