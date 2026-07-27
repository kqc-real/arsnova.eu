import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  wait: vi.fn(),
  recordFailure: vi.fn(),
  recordDelay: vi.fn(),
  logDelay: vi.fn(),
}));

vi.mock('./sessionCodeProtection', () => ({
  checkInvalidSessionCodeFailure: mocks.check,
  waitForInvalidSessionCodeDelay: mocks.wait,
}));

vi.mock('./abuseTelemetry', () => ({
  recordSessionCodeFailure: mocks.recordFailure,
  recordSessionCodeSoftCapDelay: mocks.recordDelay,
  logSessionCodeSoftCapDelay: mocks.logDelay,
}));

import { rejectInvalidSessionCode } from './invalidSessionCode';

describe('zentraler Fehlerpfad für Session-Code-Orakel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.check.mockResolvedValue({
      allowed: true,
      delayMs: 0,
      globalUtilizationPercent: 10,
    });
    mocks.wait.mockResolvedValue(true);
  });

  it('bucht jeden ungültigen Code und endet ohne Druck mit NOT_FOUND', async () => {
    await expect(rejectInvalidSessionCode('client-id', 'ABC123', 'join')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    expect(mocks.recordFailure).toHaveBeenCalledWith('join');
    expect(mocks.check).toHaveBeenCalledWith('client-id', 'ABC123');
    expect(mocks.wait).not.toHaveBeenCalled();
  });

  it('gibt die Client-Cap-Entscheidung als 429 weiter', async () => {
    mocks.check.mockResolvedValue({
      allowed: false,
      delayMs: 0,
      globalUtilizationPercent: 20,
      retryAfterSeconds: 42,
    });

    await expect(rejectInvalidSessionCode('client-id', 'ABC123')).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
      cause: { retryAfterSeconds: 42 },
    });
  });

  it('zeichnet einen angenommenen Soft-Cap-Delay aggregiert auf', async () => {
    mocks.check.mockResolvedValue({
      allowed: true,
      delayMs: 500,
      globalUtilizationPercent: 90,
    });

    await expect(rejectInvalidSessionCode('client-id', 'ABC123', 'lookup')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    expect(mocks.wait).toHaveBeenCalledWith(500);
    expect(mocks.recordDelay).toHaveBeenCalledWith('lookup');
    expect(mocks.logDelay).toHaveBeenCalledWith({
      delayMs: 500,
      globalUtilizationPercent: 90,
      source: 'lookup',
    });
  });

  it('weist nur den ungültigen Request mit 429 ab, wenn die Delay-Slots voll sind', async () => {
    mocks.check.mockResolvedValue({
      allowed: true,
      delayMs: 1_500,
      globalUtilizationPercent: 100,
    });
    mocks.wait.mockResolvedValue(false);

    await expect(rejectInvalidSessionCode('client-id', 'ABC123')).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
      cause: { retryAfterSeconds: 1 },
    });

    expect(mocks.recordDelay).not.toHaveBeenCalled();
    expect(mocks.logDelay).not.toHaveBeenCalled();
  });
});
