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

import { readPdfSignals, recordPdfJobOutcome } from './pdfTelemetry';

function createMulti(execResult: unknown = []) {
  return {
    incr: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    get: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue(execResult),
  };
}

describe('pdfTelemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'development');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('schreibt PDF-Ergebnisse in kurzlebige Redis-Buckets', async () => {
    const multi = createMulti();
    mocks.getRedis.mockReturnValue({ multi: () => multi });

    await recordPdfJobOutcome('rejected', 25_000);

    expect(multi.incr).toHaveBeenCalledWith('pdf:metric:rejected:2');
    expect(multi.expire).toHaveBeenCalledWith('pdf:metric:rejected:2', 120);
    expect(multi.exec).toHaveBeenCalledOnce();
  });

  it('aggregiert abgeschlossene, fehlgeschlagene und abgelehnte Jobs über eine Minute', async () => {
    const values = Array.from({ length: 18 }, () => [null, '0']);
    values[0] = [null, '3'];
    values[1] = [null, '1'];
    values[2] = [null, '2'];
    values[15] = [null, '4'];
    values[16] = [null, '2'];
    values[17] = [null, '1'];
    const multi = createMulti(values);
    mocks.getRedis.mockReturnValue({ multi: () => multi });

    await expect(readPdfSignals(60_000)).resolves.toEqual({
      completedLastMinute: 7,
      failedLastMinute: 3,
      rejectedLastMinute: 3,
    });
    expect(multi.get).toHaveBeenCalledTimes(18);
  });

  it('degradiert bei Redis-Ausfall ohne PDF- oder Health-Pfade zu werfen', async () => {
    mocks.getRedis.mockImplementation(() => {
      throw new Error('redis unavailable');
    });

    await expect(recordPdfJobOutcome('completed', 0)).resolves.toBeUndefined();
    await expect(readPdfSignals(0)).resolves.toEqual({
      completedLastMinute: 0,
      failedLastMinute: 0,
      rejectedLastMinute: 0,
    });
  });
});
