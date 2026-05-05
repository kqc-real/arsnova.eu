import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, hostAuthMocks } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
    },
    participant: {
      findFirst: vi.fn(),
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

const caller = sessionRouter.createCaller({ req: undefined });
const hostCaller = sessionRouter.createCaller({ req: {} as never });
const SESSION_ID = '6a8edced-5f8f-4cfa-9176-454fac9570ad';

describe('session participant access (Story 2.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostAuthMocks.extractHostTokenMock.mockReturnValue('host-token-123');
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
  });

  it('liefert Teilnehmerliste und -anzahl für gültigen Code nur für Hosts', async () => {
    const p1Id = '11111111-1111-4111-8111-111111111111';
    const p2Id = '22222222-2222-4222-8222-222222222222';
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: 'ABC123',
      participants: [
        { id: p1Id, nickname: 'Marie Curie' },
        { id: p2Id, nickname: 'Albert Einstein' },
      ],
    });

    const result = await hostCaller.getParticipants({ code: 'ABC123' });

    expect(result.participantCount).toBe(2);
    expect(result.participants).toHaveLength(2);
    expect(result.participants[0]).toEqual({
      id: p1Id,
      nickname: 'Marie Curie',
      teamId: null,
      teamName: null,
    });
    expect(result.participants[1]).toEqual({
      id: p2Id,
      nickname: 'Albert Einstein',
      teamId: null,
      teamName: null,
    });
    expect(prismaMock.session.findUnique).toHaveBeenCalledWith({
      where: { code: 'ABC123' },
      select: {
        id: true,
        status: true,
        currentQuestion: true,
        participants: {
          orderBy: { joinedAt: 'asc' },
          select: {
            id: true,
            nickname: true,
            teamId: true,
            team: { select: { name: true } },
          },
        },
        quiz: {
          select: {
            questions: {
              orderBy: { order: 'asc' },
              select: { id: true },
            },
          },
        },
      },
    });
  });

  it('liefert leere Liste wenn keine Teilnehmer', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: 'XYZ789',
      participants: [],
    });

    const result = await hostCaller.getParticipants({ code: 'XYZ789' });

    expect(result.participantCount).toBe(0);
    expect(result.participants).toEqual([]);
  });

  it('wirft NOT_FOUND bei unbekanntem Code', async () => {
    prismaMock.session.findUnique.mockResolvedValue(null);

    await expect(hostCaller.getParticipants({ code: 'NONEXI' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Session nicht gefunden.',
    });
  });

  it('liefert öffentlich nur Nicknames für Join-Kollisionen', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: 'ABC123',
      participants: [{ nickname: 'Marie Curie' }, { nickname: 'Ada Lovelace' }],
    });

    const result = await caller.getParticipantNicknames({ code: 'ABC123' });

    expect(result).toEqual({
      nicknames: ['Marie Curie', 'Ada Lovelace'],
      participantCount: 2,
    });
  });

  it('liefert öffentlich nur den eigenen Teilnehmerdatensatz', async () => {
    const participantId = '11111111-1111-4111-8111-111111111111';
    prismaMock.session.findUnique.mockResolvedValue({ id: SESSION_ID });
    prismaMock.participant.findFirst.mockResolvedValue({
      id: participantId,
      nickname: 'Ada Lovelace',
      teamId: '22222222-2222-4222-8222-222222222222',
      team: { name: 'Rot' },
    });

    const result = await caller.getParticipantSelf({ code: 'ABC123', participantId });

    expect(prismaMock.participant.findFirst).toHaveBeenCalledWith({
      where: { id: participantId, sessionId: SESSION_ID },
      select: {
        id: true,
        nickname: true,
        teamId: true,
        team: { select: { name: true } },
      },
    });
    expect(result).toEqual({
      id: participantId,
      nickname: 'Ada Lovelace',
      teamId: '22222222-2222-4222-8222-222222222222',
      teamName: 'Rot',
    });
  });

  it('lehnt die Host-Teilnehmerliste ohne Host-Token ab', async () => {
    hostAuthMocks.extractHostTokenMock.mockReturnValue(null);

    await expect(hostCaller.getParticipants({ code: 'ABC123' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Host-Authentifizierung erforderlich.',
    });

    expect(prismaMock.session.findUnique).not.toHaveBeenCalled();
  });

  it('liefert die Teilnehmer-Subscription nur mit Host-Rechten', async () => {
    const p1Id = '11111111-1111-4111-8111-111111111111';
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: 'ABC123',
      participants: [
        {
          id: p1Id,
          nickname: 'Marie Curie',
          teamId: null,
          team: null,
        },
      ],
    });

    const stream = await hostCaller.onParticipantJoined({ code: 'ABC123' });
    const iterator = stream[Symbol.asyncIterator]();
    const { value } = await iterator.next();

    expect(value).toEqual({
      participantCount: 1,
      participants: [
        {
          id: p1Id,
          nickname: 'Marie Curie',
          teamId: null,
          teamName: null,
        },
      ],
    });

    await iterator.return?.(undefined);
  });

  it('lehnt die Teilnehmer-Subscription ohne Host-Token ab', async () => {
    hostAuthMocks.extractHostTokenMock.mockReturnValue(null);

    await expect(hostCaller.onParticipantJoined({ code: 'ABC123' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Host-Authentifizierung erforderlich.',
    });

    expect(prismaMock.session.findUnique).not.toHaveBeenCalled();
  });
});
