import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  eval: vi.fn(),
  get: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('../redis', () => ({
  getRedis: () => ({ eval: mocks.eval, get: mocks.get }),
}));

vi.mock('./logger', () => ({
  logger: { warn: mocks.warn },
}));

import {
  checkInvalidSessionCodeFailure,
  readSessionCodeGlobalSoftCapUtilization,
  resetSessionCodeProtectionForTests,
  SESSION_CODE_PROTECTION_LIMITS,
  sessionCodeDelaySnapshot,
  waitForInvalidSessionCodeDelay,
} from './sessionCodeProtection';

const CLIENT_A = '11111111-1111-4111-8111-111111111111';
const CLIENT_B = '22222222-2222-4222-8222-222222222222';

describe('Session-Code-Fehlbudgets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.eval.mockResolvedValue([1, 0, 1, 0]);
    mocks.get.mockResolvedValue('0');
  });

  it('nutzt großzügige, statisch begrenzte Defaults für 500er-NAT', () => {
    expect(SESSION_CODE_PROTECTION_LIMITS).toEqual({
      windowSeconds: 60,
      clientFailuresPerWindow: 5,
      codeSoftCapPerWindow: 600,
      globalSoftCapPerWindow: 5_000,
      delayBaseMs: 100,
      delayMaxMs: 1_500,
      maxConcurrentDelays: 100,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    resetSessionCodeProtectionForTests();
  });

  it('kombiniert Client-, Code- und Globalbudget in genau einem Lua-Aufruf', async () => {
    await checkInvalidSessionCodeFailure(CLIENT_A, 'ABC123');

    expect(mocks.eval).toHaveBeenCalledOnce();
    const [script, keyCount, globalKey, clientKey, codeKey] = mocks.eval.mock.calls[0]!;
    expect(script).toContain("redis.call('INCR', globalKey)");
    expect(script).toContain("redis.call('INCR', clientKey)");
    expect(script).toContain("redis.call('INCR', codeKey)");
    expect(keyCount).toBe(3);
    expect(globalKey).toBe('security:session-code:w60-f5:global');
    expect(clientKey).toMatch(/^security:session-code:w60-f5:client:[0-9a-f]{64}$/);
    expect(codeKey).toMatch(/^security:session-code:w60-f5:code:[0-9a-f]{64}$/);
    expect(JSON.stringify(mocks.eval.mock.calls[0])).not.toContain(CLIENT_A);
    expect(JSON.stringify(mocks.eval.mock.calls[0])).not.toContain('203.0.113.');
    expect(mocks.eval.mock.calls[0]!.at(-1)).toBe('1');
  });

  it('überspringt den Client-Cap für gecachte Legacy-Clients ohne neue Client-Keys', async () => {
    await checkInvalidSessionCodeFailure(undefined, 'ABC123');

    const call = mocks.eval.mock.calls[0]!;
    expect(call[3]).toBe('security:session-code:w60-f5:client:legacy-compat');
    expect(call.at(-1)).toBe('0');
    expect(String(call[0])).toContain(
      "if hasClientId then clientCount = redis.call('INCR', clientKey) end",
    );
  });

  it('trennt zwei Clients unabhängig von einer gemeinsamen IP', async () => {
    await Promise.all([
      checkInvalidSessionCodeFailure(CLIENT_A, 'ABC123'),
      checkInvalidSessionCodeFailure(CLIENT_B, 'ABC123'),
    ]);

    const first = mocks.eval.mock.calls[0]!;
    const second = mocks.eval.mock.calls[1]!;
    expect(first[3]).not.toBe(second[3]);
    expect(first[4]).toBe(second[4]);
  });

  it('gibt ausschließlich beim ausgeschöpften Clientbudget eine 429-Entscheidung zurück', async () => {
    mocks.eval.mockResolvedValue([0, 0, 27, 41]);

    await expect(checkInvalidSessionCodeFailure(CLIENT_A, 'ABC123')).resolves.toEqual({
      allowed: false,
      delayMs: 0,
      globalUtilizationPercent: 27,
      retryAfterSeconds: 41,
    });
  });

  it('liefert progressive, begrenzte Soft-Cap-Verzögerung ohne Hard-Lock', async () => {
    mocks.eval.mockResolvedValue([1, 825, 92, 0]);

    await expect(checkInvalidSessionCodeFailure(CLIENT_A, 'ABC123')).resolves.toEqual({
      allowed: true,
      delayMs: 825,
      globalUtilizationPercent: 92,
    });
  });

  it('begrenzt gleichzeitig wartende Soft-Cap-Requests pro Prozess', async () => {
    vi.useFakeTimers();
    const waiting = Array.from({ length: SESSION_CODE_PROTECTION_LIMITS.maxConcurrentDelays }, () =>
      waitForInvalidSessionCodeDelay(1_500),
    );

    expect(sessionCodeDelaySnapshot()).toEqual({
      active: SESSION_CODE_PROTECTION_LIMITS.maxConcurrentDelays,
      maximum: SESSION_CODE_PROTECTION_LIMITS.maxConcurrentDelays,
    });
    await expect(waitForInvalidSessionCodeDelay(1_500)).resolves.toBe(false);

    await vi.runAllTimersAsync();
    await expect(Promise.all(waiting)).resolves.toEqual(
      Array.from({ length: SESSION_CODE_PROTECTION_LIMITS.maxConcurrentDelays }, () => true),
    );
    expect(sessionCodeDelaySnapshot().active).toBe(0);
  });

  it('versioniert Redis-Buckets nach Fenster/Limit und begrenzt TTL im Lua-Skript', async () => {
    await checkInvalidSessionCodeFailure(CLIENT_A, 'ABC123');

    const script = String(mocks.eval.mock.calls[0]![0]);
    expect(script).toContain('if retryAfter > windowSeconds then retryAfter = windowSeconds end');
    expect(script).toContain('ensureWindowExpiry(globalKey)');
  });

  it('begrenzt Key-Kardinalität nach ausgeschöpftem Globalbudget im Lua-Pfad', async () => {
    await checkInvalidSessionCodeFailure(CLIENT_A, 'ABC123');

    const script = String(mocks.eval.mock.calls[0]![0]);
    const globalGuard = script.indexOf('if globalCount >= globalSoftCap then');
    const firstIncrement = script.indexOf("redis.call('INCR', globalKey)");
    expect(globalGuard).toBeGreaterThanOrEqual(0);
    expect(firstIncrement).toBeGreaterThan(globalGuard);
    expect(script).toContain('return {1, delayMaxMs, 100, 0}');
  });

  it('bucht parallele Fehlversuche jeweils atomar in einem einzelnen Eval', async () => {
    let globalCount = 0;
    mocks.eval.mockImplementation(async () => {
      globalCount += 1;
      return [1, 0, Math.floor((globalCount * 100) / 5_000), 0];
    });

    await Promise.all(
      Array.from({ length: 200 }, (_, index) =>
        checkInvalidSessionCodeFailure(
          `${String(index).padStart(8, '0')}-0000-4000-8000-000000000000`,
          'ABC123',
        ),
      ),
    );

    expect(mocks.eval).toHaveBeenCalledTimes(200);
    expect(globalCount).toBe(200);
  });

  it('liest die globale Soft-Cap-Auslastung bounded und degradiert bei Redis-Ausfall', async () => {
    mocks.get.mockResolvedValue(String(SESSION_CODE_PROTECTION_LIMITS.globalSoftCapPerWindow / 2));
    await expect(readSessionCodeGlobalSoftCapUtilization()).resolves.toBe(50);

    mocks.get.mockRejectedValue(new Error('redis unavailable'));
    await expect(readSessionCodeGlobalSoftCapUtilization()).resolves.toBe(0);
  });
});
