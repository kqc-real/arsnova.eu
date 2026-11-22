import { beforeEach, describe, expect, it, vi } from 'vitest';

const redisMock = {
  eval: vi.fn(),
};

vi.mock('../redis', () => ({
  getRedis: vi.fn(() => redisMock),
}));

vi.mock('../lib/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

import { awaitJoinAdmissionSlot, resetJoinAdmissionWarningForTests } from '../lib/joinAdmission';

describe('joinAdmission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetJoinAdmissionWarningForTests();
  });

  it('laesst den Join sofort passieren, wenn ein Slot frei ist', async () => {
    redisMock.eval.mockResolvedValue([1, 0, 1]);

    const result = await awaitJoinAdmissionSlot('session-1');

    expect(redisMock.eval).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ delayedMs: 0, attempts: 1 });
  });

  it('konfiguriert 500 Burst-Slots und 125 nachgefüllte Slots pro Sekunde im Session-Bucket', async () => {
    redisMock.eval.mockResolvedValue([1, 0]);

    await awaitJoinAdmissionSlot('session-1', { now: () => 123 });

    expect(redisMock.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'join:admission:v2:session:session-1',
      '123',
      '1000',
      '125',
      '5000',
      '500',
    );
  });

  it('wartet kurz und versucht es erneut, wenn die Join-Welle gerade voll ist', async () => {
    redisMock.eval.mockResolvedValueOnce([0, 300, 75]).mockResolvedValueOnce([1, 0, 50]);
    const sleepMock = vi.fn().mockResolvedValue(undefined);

    const result = await awaitJoinAdmissionSlot('session-1', {
      random: () => 0,
      sleep: sleepMock,
    });

    expect(sleepMock).toHaveBeenCalledWith(300);
    expect(redisMock.eval).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ delayedMs: 300, attempts: 2 });
  });

  it('faellt ohne Blockade auf direkten Join zurueck, wenn Redis nicht erreichbar ist', async () => {
    redisMock.eval.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await awaitJoinAdmissionSlot('session-1');

    expect(result).toEqual({ delayedMs: 0, attempts: 1 });
  });
});
