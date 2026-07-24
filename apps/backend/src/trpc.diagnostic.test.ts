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
import { DIAGNOSTIC_AUTH_FAILURE_LIMIT, resetDiagnosticAuthForTests } from './lib/diagnosticAuth';

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
    resetDiagnosticAuthForTests();
    vi.stubEnv('ADMIN_SECRET', 'admin-secret-that-must-never-authorize-diagnostics');
    vi.stubEnv('ADMIN_DIAGNOSTIC_SECRET', 'separate-diagnostic-secret-with-strong-entropy');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('bleibt mit korrektem Secret unabhängig von Redis erreichbar', async () => {
    await expect(
      caller('separate-diagnostic-secret-with-strong-entropy').securityStats(),
    ).resolves.toEqual({
      reachable: true,
    });
    expect(mocks.getRedis).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    'wrong',
    'admin-secret-that-must-never-authorize-diagnostics',
    'separate-diagnostic-secret-with-strong-entropy-suffix',
  ])('verweigert fehlendes, falsches oder das Admin-Secret', async (secret) => {
    await expect(caller(secret).securityStats()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(mocks.getRedis).not.toHaveBeenCalled();
  });

  it.each([
    ['', 'separate-diagnostic-secret-with-strong-entropy'],
    ['too-short', 'too-short'],
    [
      'admin-secret-that-must-never-authorize-diagnostics',
      'admin-secret-that-must-never-authorize-diagnostics',
    ],
  ])(
    'schließt bei fehlender, schwacher oder wiederverwendeter Konfiguration',
    async (configured, candidate) => {
      vi.stubEnv('ADMIN_DIAGNOSTIC_SECRET', configured);
      await expect(caller(candidate).securityStats()).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    },
  );

  it('begrenzt Fehlversuche bounded, lässt das korrekte Secret aber weiter durch', async () => {
    for (let index = 0; index < DIAGNOSTIC_AUTH_FAILURE_LIMIT; index += 1) {
      await expect(caller(`wrong-${index}`).securityStats()).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    }
    await expect(caller('wrong-over-limit').securityStats()).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });
    await expect(
      caller('separate-diagnostic-secret-with-strong-entropy').securityStats(),
    ).resolves.toEqual({ reachable: true });
    expect(mocks.getRedis).not.toHaveBeenCalled();
  });
});
