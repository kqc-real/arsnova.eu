import { TRPCError } from '@trpc/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redisMock = vi.hoisted(() => ({
  eval: vi.fn(),
}));

vi.mock('../redis', () => ({
  getRedis: () => redisMock,
}));

import {
  ADMIN_LOGIN_PROTECTION_LIMITS,
  checkAdminLoginFailure,
  rejectInvalidAdminLogin,
  resetAdminLoginProtectionForTests,
  waitForInvalidAdminLoginDelay,
} from './adminLoginProtection';

describe('progressiver Admin-Login-Schutz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.eval.mockResolvedValue([1, 100, 0]);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetAdminLoginProtectionForTests();
  });

  it('nutzt ein einziges globales Fehlbudget ohne IP-Schlüssel', async () => {
    await expect(checkAdminLoginFailure()).resolves.toEqual({
      allowed: true,
      delayMs: 100,
    });

    expect(redisMock.eval).toHaveBeenCalledOnce();
    expect(redisMock.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('INCR', key)"),
      1,
      'security:admin-login:global-failures',
      '60',
      '60',
      '100',
      '2000',
    );
    expect(JSON.stringify(redisMock.eval.mock.calls[0])).not.toContain('ip:');
  });

  it('übernimmt progressive Verzögerungen begrenzt aus Redis', async () => {
    redisMock.eval.mockResolvedValue([1, 1_600, 0]);

    await expect(checkAdminLoginFailure()).resolves.toEqual({
      allowed: true,
      delayMs: 1_600,
    });
  });

  it('liefert nach ausgeschöpftem Globalbudget eine Wartezeit', async () => {
    redisMock.eval.mockResolvedValue([0, 0, 37]);

    await expect(checkAdminLoginFailure()).resolves.toEqual({
      allowed: false,
      delayMs: 0,
      retryAfterSeconds: 37,
    });
    await expect(rejectInvalidAdminLogin()).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
      cause: { retryAfterSeconds: 37 },
    });
  });

  it('verzögert ungültige Zugangsdaten vor der einheitlichen Ablehnung', async () => {
    vi.useFakeTimers();
    redisMock.eval.mockResolvedValue([1, 400, 0]);

    const rejection = rejectInvalidAdminLogin();
    await vi.advanceTimersByTimeAsync(399);
    let settled = false;
    void rejection.catch(() => {
      settled = true;
    });
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(rejection).rejects.toEqual(
      expect.objectContaining<Partial<TRPCError>>({
        code: 'UNAUTHORIZED',
        message: 'Ungültige Admin-Zugangsdaten.',
      }),
    );
  });

  it('begrenzt gleichzeitig wartende Fehlversuche pro Prozess', async () => {
    vi.useFakeTimers();
    const waiting = Array.from({ length: ADMIN_LOGIN_PROTECTION_LIMITS.maxConcurrentDelays }, () =>
      waitForInvalidAdminLoginDelay(2_000),
    );

    await expect(waitForInvalidAdminLoginDelay(2_000)).resolves.toBe(false);
    await vi.runAllTimersAsync();
    await expect(Promise.all(waiting)).resolves.toEqual(
      Array.from({ length: ADMIN_LOGIN_PROTECTION_LIMITS.maxConcurrentDelays }, () => true),
    );
  });
});
