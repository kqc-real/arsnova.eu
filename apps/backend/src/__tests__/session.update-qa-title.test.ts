import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';

const { prismaMock, hostAuthMocks } = vi.hoisted(() => ({
  prismaMock: {
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
const CODE = 'ABC123';

describe('session.updateQaTitle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostAuthMocks.extractHostTokenMock.mockReturnValue('host-token-123');
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
  });

  trpcDodIt(
    {
      procedure: 'session.updateQaTitle',
      case: 'happy',
      mode: 'direct',
      title: 'setzt qaTitle bei Quiz-Session mit Q&A-Kanal',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        type: 'QUIZ',
        qaEnabled: true,
      });
      prismaMock.session.update.mockResolvedValue({
        qaTitle: 'Diskussion',
        title: null,
      });

      const result = await caller.updateQaTitle({ code: CODE, qaTitle: 'Diskussion' });

      expect(result).toEqual({ qaTitle: 'Diskussion', title: null });
      expect(prismaMock.session.update).toHaveBeenCalledWith({
        where: { id: SESSION_ID },
        data: { qaTitle: 'Diskussion' },
        select: { qaTitle: true, title: true },
      });
    },
  );

  it('synchronisiert title bei reiner Q_AND_A-Session', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      type: 'Q_AND_A',
      qaEnabled: false,
    });
    prismaMock.session.update.mockResolvedValue({
      qaTitle: 'Fragerunde',
      title: 'Fragerunde',
    });

    await caller.updateQaTitle({ code: CODE, qaTitle: 'Fragerunde' });

    expect(prismaMock.session.update).toHaveBeenCalledWith({
      where: { id: SESSION_ID },
      data: { qaTitle: 'Fragerunde', title: 'Fragerunde' },
      select: { qaTitle: true, title: true },
    });
  });

  it('leert Titel wenn qaTitle leer', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      qaEnabled: true,
    });
    prismaMock.session.update.mockResolvedValue({
      qaTitle: null,
      title: null,
    });

    await caller.updateQaTitle({ code: CODE, qaTitle: '   ' });

    expect(prismaMock.session.update).toHaveBeenCalledWith({
      where: { id: SESSION_ID },
      data: { qaTitle: null },
      select: { qaTitle: true, title: true },
    });
  });

  trpcDodIt(
    {
      procedure: 'session.updateQaTitle',
      case: 'error',
      mode: 'direct',
      contract: 'BAD_REQUEST',
      title: 'lehnt ab wenn Q&A nicht aktiv',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        type: 'QUIZ',
        qaEnabled: false,
      });

      await expect(caller.updateQaTitle({ code: CODE, qaTitle: 'X' })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
      expect(prismaMock.session.update).not.toHaveBeenCalled();
    },
  );
});
