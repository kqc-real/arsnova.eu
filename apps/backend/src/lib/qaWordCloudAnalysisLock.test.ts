import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRedis = vi.hoisted(() => vi.fn());
vi.mock('../redis', () => ({ getRedis }));

import { acquireQaWordCloudAnalysisLock } from './qaWordCloudAnalysisLock';

describe('qaWordCloudAnalysisLock', () => {
  beforeEach(() => vi.clearAllMocks());

  it('belegt instanzübergreifend per NX und gibt nur die eigene Lease frei', async () => {
    const redis = {
      set: vi.fn().mockResolvedValue('OK'),
      eval: vi.fn().mockResolvedValue(1),
    };
    getRedis.mockReturnValue(redis);

    const release = await acquireQaWordCloudAnalysisLock(' abC123 ');
    expect(release).not.toBeNull();
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^qa:word-cloud:analysis:v1:[0-9a-f]{24}$/u),
      expect.stringMatching(/^[0-9a-f]{32}$/u),
      'EX',
      120,
      'NX',
    );
    expect(redis.set.mock.calls[0]?.[0]).not.toContain('ABC123');

    await release?.();
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("get"'),
      1,
      redis.set.mock.calls[0]?.[0],
      redis.set.mock.calls[0]?.[1],
    );
  });

  it('meldet eine bereits laufende Analyse ohne Release-Funktion', async () => {
    getRedis.mockReturnValue({
      set: vi.fn().mockResolvedValue(null),
      eval: vi.fn(),
    });

    await expect(acquireQaWordCloudAnalysisLock('ABC123')).resolves.toBeNull();
  });
});
