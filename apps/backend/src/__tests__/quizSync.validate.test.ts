import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';

const {
  authorizeYjsRoomUpgradeMock,
  checkYjsShareRegisterRateMock,
  checkYjsShareRotateRateMock,
  checkYjsShareValidateRateMock,
  createYjsShareMock,
  rotateYjsShareMock,
} = vi.hoisted(() => ({
  authorizeYjsRoomUpgradeMock: vi.fn(),
  createYjsShareMock: vi.fn(),
  rotateYjsShareMock: vi.fn(),
  checkYjsShareRegisterRateMock: vi.fn(),
  checkYjsShareRotateRateMock: vi.fn(),
  checkYjsShareValidateRateMock: vi.fn(),
}));

vi.mock('../lib/yjsShareToken', () => ({
  authorizeYjsRoomUpgrade: authorizeYjsRoomUpgradeMock,
  createYjsShare: createYjsShareMock,
  rotateYjsShare: rotateYjsShareMock,
}));

vi.mock('../lib/rateLimit', () => ({
  checkYjsShareRegisterRate: checkYjsShareRegisterRateMock,
  checkYjsShareRotateRate: checkYjsShareRotateRateMock,
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
    createYjsShareMock.mockReset();
    rotateYjsShareMock.mockReset();
    checkYjsShareRegisterRateMock.mockReset();
    checkYjsShareRotateRateMock.mockReset();
    checkYjsShareValidateRateMock.mockReset();
    checkYjsShareRegisterRateMock.mockResolvedValue({
      allowed: true,
      remaining: 99,
      retryAfterSeconds: 0,
    });
    checkYjsShareRotateRateMock.mockResolvedValue({
      allowed: true,
      remaining: 99,
      retryAfterSeconds: 0,
    });
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

  trpcDodIt(
    {
      procedure: 'quizSync.validateShare',
      case: 'happy',
      mode: 'direct',
      title: 'meldet gültige und endgültig abgelehnte Tokens ohne Ablehnungsgrund',
    },
    async () => {
      const caller = quizSyncRouter.createCaller({ req: undefined });
      authorizeYjsRoomUpgradeMock.mockResolvedValueOnce({ ok: true, generation: 2 });
      await expect(caller.validateShare(input)).resolves.toEqual({ valid: true });

      authorizeYjsRoomUpgradeMock.mockResolvedValueOnce({
        ok: false,
        reason: 'stale_generation',
      });
      await expect(caller.validateShare(input)).resolves.toEqual({ valid: false });
    },
  );

  trpcDodIt(
    {
      procedure: 'quizSync.validateShare',
      case: 'error',
      mode: 'direct',
      contract: 'SERVICE_UNAVAILABLE',
      title: 'stuft einen ausgefallenen Autorisierungsspeicher nicht als ungültigen Token ein',
    },
    async () => {
      authorizeYjsRoomUpgradeMock.mockRejectedValueOnce(new Error('redis unavailable'));
      const caller = quizSyncRouter.createCaller({ req: undefined });

      await expect(caller.validateShare(input)).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      });
    },
  );

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

  trpcDodIt(
    {
      procedure: 'quizSync.createShare',
      case: 'happy',
      mode: 'direct',
      title: 'registriert eine neue Share-Freigabe mit einer lokalen Rotations-Capability',
    },
    async () => {
      const caller = quizSyncRouter.createCaller({ req: undefined });
      const rotationCapability = 'a'.repeat(64);
      const shareToken = `v1.11111111-1111-4111-8111-111111111111.1.${'b'.repeat(43)}`;
      createYjsShareMock.mockResolvedValue({
        roomId: '11111111-1111-4111-8111-111111111111',
        shareToken,
        generation: 1,
      });

      await expect(caller.createShare({ rotationCapability })).resolves.toEqual({
        roomId: '11111111-1111-4111-8111-111111111111',
        shareToken,
        generation: 1,
      });
      expect(createYjsShareMock).toHaveBeenCalledWith({ rotationCapability });
    },
  );

  trpcDodIt(
    {
      procedure: 'quizSync.createShare',
      case: 'error',
      mode: 'direct',
      contract: 'TOO_MANY_REQUESTS',
      title: 'lehnt eine neue Share-Freigabe am Register-Rate-Limit ab',
    },
    async () => {
      const caller = quizSyncRouter.createCaller({ req: undefined });
      checkYjsShareRegisterRateMock.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        retryAfterSeconds: 30,
      });

      await expect(
        caller.createShare({ rotationCapability: 'a'.repeat(64) }),
      ).rejects.toMatchObject({
        code: 'TOO_MANY_REQUESTS',
        cause: { retryAfterSeconds: 30 },
      });
      expect(createYjsShareMock).not.toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'quizSync.rotateShare',
      case: 'happy',
      mode: 'direct',
      title: 'rotiert einen Share-Link mit der Capability des Ursprungsgeräts',
    },
    async () => {
      const caller = quizSyncRouter.createCaller({ req: undefined });
      const input = {
        roomId: '11111111-1111-4111-8111-111111111111',
        rotationCapability: 'a'.repeat(64),
      };
      const shareToken = `v1.11111111-1111-4111-8111-111111111111.2.${'c'.repeat(43)}`;
      rotateYjsShareMock.mockResolvedValue({ shareToken, generation: 2 });

      await expect(caller.rotateShare(input)).resolves.toEqual({ shareToken, generation: 2 });
      expect(rotateYjsShareMock).toHaveBeenCalledWith(input);
    },
  );

  trpcDodIt(
    {
      procedure: 'quizSync.rotateShare',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'lehnt eine Link-Rotation mit nicht passender Capability ab',
    },
    async () => {
      const caller = quizSyncRouter.createCaller({ req: undefined });
      rotateYjsShareMock.mockRejectedValueOnce(new Error('CAPABILITY_MISMATCH'));

      await expect(
        caller.rotateShare({
          roomId: '11111111-1111-4111-8111-111111111111',
          rotationCapability: 'a'.repeat(64),
        }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    },
  );
});
