import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';

const { prismaMock, hostAuthMocks } = vi.hoisted(() => ({
  prismaMock: {
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
    session: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  hostAuthMocks: {
    extractHostTokenMock: vi.fn(),
    extractHostTokenFromConnectionParamsMock: vi.fn(() => null as string | null),
    isHostSessionTokenValidMock: vi.fn(),
  },
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/rateLimit', () => ({
  checkSessionCreateRate: vi.fn(),
}));

vi.mock('../lib/hostAuth', async () => {
  const { buildHostAuthTestMock } = await import('./lib/hostAuth-vitest-mock');
  return buildHostAuthTestMock({
    extractHostToken: hostAuthMocks.extractHostTokenMock,
    extractHostTokenFromConnectionParams: hostAuthMocks.extractHostTokenFromConnectionParamsMock,
    isHostSessionTokenValid: hostAuthMocks.isHostSessionTokenValidMock,
  });
});

import { sessionRouter } from '../routers/session';

const caller = sessionRouter.createCaller({ req: {} as never });
const SESSION_ID = '6a8edced-5f8f-4cfa-9176-454fac9570ad';

describe('session.startQa (Story 8.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostAuthMocks.extractHostTokenMock.mockReturnValue('host-token-123');
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
    prismaMock.$executeRaw.mockResolvedValue(1);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      fn(prismaMock),
    );
    prismaMock.session.update.mockResolvedValue({
      id: SESSION_ID,
      status: 'ACTIVE',
    });
  });

  trpcDodIt(
    {
      procedure: 'session.startQa',
      case: 'happy',
      mode: 'direct',
      title: 'startet eine Q&A-Session aus der Lobby in ACTIVE',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        type: 'Q_AND_A',
        quizId: null,
        status: 'LOBBY',
        qaEnabled: true,
        qaOpen: true,
      });

      const result = await caller.startQa({ code: 'abc123' });

      expect(result.status).toBe('ACTIVE');
      expect(result.currentQuestion).toBeNull();
      expect(result.currentRound).toBe(1);
      expect(result.activeAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(prismaMock.session.findUnique).toHaveBeenNthCalledWith(1, {
        where: { code: 'ABC123' },
        select: { id: true },
      });
      expect(prismaMock.session.findUnique).toHaveBeenNthCalledWith(2, {
        where: { id: SESSION_ID },
        select: {
          id: true,
          status: true,
          type: true,
          quizId: true,
          qaEnabled: true,
          qaOpen: true,
        },
      });
      expect(prismaMock.session.update).toHaveBeenCalledWith({
        where: { id: SESSION_ID },
        data: expect.objectContaining({ status: 'ACTIVE' }),
      });
    },
  );

  it('lässt Quiz-Sessions mit Fragen-Kanal in der Lobby (Beitrittsphase fürs Quiz bleibt)', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      quizId: '11111111-1111-4111-8111-111111111111',
      status: 'LOBBY',
      qaEnabled: true,
      qaOpen: true,
    });

    const result = await caller.startQa({ code: 'ABC123' });

    expect(result.status).toBe('LOBBY');
    expect(result.currentQuestion).toBeNull();
    expect(result.currentRound).toBe(1);
    expect(prismaMock.session.update).not.toHaveBeenCalled();
  });

  it('startet eine quizlose Quiz-Session mit Q&A-Kanal in ACTIVE', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      quizId: null,
      status: 'LOBBY',
      qaEnabled: true,
      qaOpen: true,
    });

    const result = await caller.startQa({ code: 'ABC123' });

    expect(result.status).toBe('ACTIVE');
    expect(result.currentQuestion).toBeNull();
    expect(result.currentRound).toBe(1);
    expect(prismaMock.session.update).toHaveBeenCalledWith({
      where: { id: SESSION_ID },
      data: expect.objectContaining({ status: 'ACTIVE' }),
    });
  });

  trpcDodIt(
    {
      procedure: 'session.startQa',
      case: 'error',
      mode: 'direct',
      contract: 'BAD_REQUEST',
      title: 'lehnt den Start außerhalb der Lobby ab',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        type: 'Q_AND_A',
        quizId: null,
        status: 'ACTIVE',
        qaEnabled: true,
        qaOpen: true,
      });

      await expect(caller.startQa({ code: 'ABC123' })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: 'Q&A-Session kann nur aus Status LOBBY gestartet werden. Aktuell: ACTIVE.',
      });

      expect(prismaMock.session.update).not.toHaveBeenCalled();
    },
  );

  it('öffnet eine unter der Sperre bereits beendete Q&A-Session nicht erneut', async () => {
    prismaMock.session.findUnique.mockResolvedValueOnce({ id: SESSION_ID }).mockResolvedValueOnce({
      id: SESSION_ID,
      type: 'Q_AND_A',
      quizId: null,
      status: 'FINISHED',
      qaEnabled: true,
      qaOpen: true,
    });

    await expect(caller.startQa({ code: 'ABC123' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Q&A-Session kann nur aus Status LOBBY gestartet werden. Aktuell: FINISHED.',
    });
    expect(prismaMock.$executeRaw).toHaveBeenCalledOnce();
    expect(prismaMock.session.update).not.toHaveBeenCalled();
  });
});
