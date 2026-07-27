import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authorizeYjsRoomUpgradeMock, checkYjsShareValidateRateMock } = vi.hoisted(() => ({
  authorizeYjsRoomUpgradeMock: vi.fn(),
  checkYjsShareValidateRateMock: vi.fn(),
}));

vi.mock('../lib/yjsShareToken', () => ({
  authorizeYjsRoomUpgrade: authorizeYjsRoomUpgradeMock,
  createYjsShare: vi.fn(),
  rotateYjsShare: vi.fn(),
}));

vi.mock('../lib/rateLimit', () => ({
  checkYjsShareRegisterRate: vi.fn(),
  checkYjsShareRotateRate: vi.fn(),
  checkYjsShareValidateRate: checkYjsShareValidateRateMock,
}));

import { quizSyncRouter } from '../routers/quizSync';

describe('quizSync.validateShare', () => {
  const input = {
    roomId: '11111111-1111-4111-8111-111111111111',
    shareToken: `v1.11111111-1111-4111-8111-111111111111.1.${'a'.repeat(43)}`,
  };

  beforeEach(() => {
    authorizeYjsRoomUpgradeMock.mockReset();
    checkYjsShareValidateRateMock.mockReset();
    checkYjsShareValidateRateMock.mockResolvedValue({
      allowed: true,
      remaining: 1_999,
      retryAfterSeconds: 0,
    });
  });

  it('überträgt Share-Tokens ausschließlich als Mutation im Request-Body', () => {
    const procedure = quizSyncRouter._def.procedures['validateShare'] as unknown as {
      _def: { type: string };
    };
    expect(procedure._def.type).toBe('mutation');
  });

  it('meldet gültige und endgültig abgelehnte Tokens ohne Ablehnungsgrund', async () => {
    const caller = quizSyncRouter.createCaller({ req: undefined });
    authorizeYjsRoomUpgradeMock.mockResolvedValueOnce({ ok: true, generation: 2 });
    await expect(caller.validateShare(input)).resolves.toEqual({ valid: true });

    authorizeYjsRoomUpgradeMock.mockResolvedValueOnce({
      ok: false,
      reason: 'stale_generation',
    });
    await expect(caller.validateShare(input)).resolves.toEqual({ valid: false });
  });

  it('stuft einen ausgefallenen Autorisierungsspeicher nicht als ungültigen Token ein', async () => {
    authorizeYjsRoomUpgradeMock.mockRejectedValueOnce(new Error('redis unavailable'));
    const caller = quizSyncRouter.createCaller({ req: undefined });

    await expect(caller.validateShare(input)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    });
  });

  it('begrenzt die öffentliche Token-Prüfung vor der Autorisierung', async () => {
    checkYjsShareValidateRateMock.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 30,
    });
    const caller = quizSyncRouter.createCaller({ req: undefined });

    await expect(caller.validateShare(input)).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
      cause: { retryAfterSeconds: 30 },
    });
    expect(authorizeYjsRoomUpgradeMock).not.toHaveBeenCalled();
  });
});
