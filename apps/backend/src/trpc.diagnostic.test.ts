import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getRedis: vi.fn(() => {
    throw new Error('redis unavailable');
  }),
}));

vi.mock('./redis', () => ({
  getRedis: mocks.getRedis,
}));

vi.mock('./lib/sloTelemetry', () => ({
  isTrackedLiveProcedure: vi.fn(() => false),
  recordLiveRequestTelemetry: vi.fn(),
}));

vi.mock('./lib/abuseTelemetry', () => ({
  logRateLimitRejection: vi.fn(),
  recordRateLimitRejection: vi.fn(),
  recordSessionCreateCompleted: vi.fn(),
}));

import { diagnosticProcedure, router } from './trpc';

const testRouter = router({
  securityStats: diagnosticProcedure.query(() => ({ reachable: true as const })),
});

function caller(secret?: string) {
  return testRouter.createCaller({
    req: {
      headers: secret ? { 'x-admin-diagnostic-secret': secret } : {},
    } as never,
  });
}

describe('diagnosticProcedure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('ADMIN_SECRET', 'a-strong-diagnostic-secret-value');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('bleibt mit korrektem Secret unabhängig von Redis erreichbar', async () => {
    await expect(caller('a-strong-diagnostic-secret-value').securityStats()).resolves.toEqual({
      reachable: true,
    });
    expect(mocks.getRedis).not.toHaveBeenCalled();
  });

  it.each([undefined, 'wrong', 'a-strong-diagnostic-secret-value-with-suffix'])(
    'verweigert fehlendes oder falsches Secret',
    async (secret) => {
      await expect(caller(secret).securityStats()).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
      expect(mocks.getRedis).not.toHaveBeenCalled();
    },
  );
});
