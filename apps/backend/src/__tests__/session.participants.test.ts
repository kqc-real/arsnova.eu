import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, hostAuthMocks, presenceMocks } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
    },
    participant: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  },
  hostAuthMocks: {
    extractHostTokenMock: vi.fn(),
    extractHostTokenFromConnectionParamsMock: vi.fn(() => null as string | null),
    isHostSessionTokenValidMock: vi.fn(),
  },
  presenceMocks: {
    getActiveParticipantCountForSession: vi.fn(),
    removeParticipantPresence: vi.fn(),
  },
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/presence', () => ({
  getActiveParticipantCountForSession: presenceMocks.getActiveParticipantCountForSession,
  getActiveParticipantIdsForSession: vi.fn(),
  removeParticipantPresence: presenceMocks.removeParticipantPresence,
  touchParticipantPresence: vi.fn(),
}));

vi.mock('../lib/hostAuth', async () => {
  const { buildHostAuthTestMock } = await import('./lib/hostAuth-vitest-mock');
  return buildHostAuthTestMock({
    extractHostToken: hostAuthMocks.extractHostTokenMock,
    extractHostTokenFromConnectionParams: hostAuthMocks.extractHostTokenFromConnectionParamsMock,
    isHostSessionTokenValid: hostAuthMocks.isHostSessionTokenValidMock,
  });
});

import {
  invalidateJoinCachesForCode,
  resetParticipantNicknameCacheForTests,
  resetSessionReadCachesForTests,
  sessionRouter,
} from '../routers/session';

const caller = sessionRouter.createCaller({ req: undefined });
const hostCaller = sessionRouter.createCaller({ req: {} as never });
const SESSION_ID = '6a8edced-5f8f-4cfa-9176-454fac9570ad';

describe('session participant access (Story 2.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetParticipantNicknameCacheForTests();
    resetSessionReadCachesForTests();
    presenceMocks.getActiveParticipantCountForSession.mockResolvedValue(0);
    presenceMocks.removeParticipantPresence.mockResolvedValue(undefined);
    hostAuthMocks.extractHostTokenMock.mockReturnValue('host-token-123');
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
    prismaMock.$executeRaw.mockResolvedValue(1);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      fn(prismaMock),
    );
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

    expect(result).toMatchObject({
      participantCount: 2,
      connectedCount: 0,
    });
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

    expect(result).toMatchObject({
      participantCount: 0,
      connectedCount: 0,
    });
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

  it('nutzt kurzzeitig einen Cache für die öffentliche Nickname-Liste', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: 'ABC123',
      participants: [{ nickname: 'Marie Curie' }, { nickname: 'Ada Lovelace' }],
    });

    const first = await caller.getParticipantNicknames({ code: 'ABC123' });
    const second = await caller.getParticipantNicknames({ code: 'ABC123' });

    expect(first).toEqual(second);
    expect(prismaMock.session.findUnique).toHaveBeenCalledTimes(1);
  });

  it('liefert öffentlich nur den eigenen Teilnehmerdatensatz', async () => {
    const participantId = '11111111-1111-4111-8111-111111111111';
    prismaMock.session.findUnique.mockResolvedValue({ id: SESSION_ID });
    prismaMock.participant.findFirst.mockResolvedValue({
      id: participantId,
      nickname: 'Ada Lovelace',
      teamId: '22222222-2222-4222-8222-222222222222',
      timerAccommodation: 'EXTENDED',
      team: { name: 'Rot' },
    });

    const result = await caller.getParticipantSelf({ code: 'ABC123', participantId });

    expect(prismaMock.participant.findFirst).toHaveBeenCalledWith({
      where: { id: participantId, sessionId: SESSION_ID },
      select: {
        id: true,
        nickname: true,
        teamId: true,
        timerAccommodation: true,
        team: { select: { name: true } },
      },
    });
    expect(result).toEqual({
      id: participantId,
      nickname: 'Ada Lovelace',
      teamId: '22222222-2222-4222-8222-222222222222',
      teamName: 'Rot',
      timerAccommodation: 'EXTENDED',
    });
  });

  it('setzt die persönliche Timer-Anpassung nur für die eigene Teilnahme', async () => {
    const participantId = '11111111-1111-4111-8111-111111111111';
    prismaMock.participant.findFirst.mockResolvedValue({
      id: participantId,
      sessionId: SESSION_ID,
    });
    prismaMock.participant.update.mockResolvedValue({
      id: participantId,
      timerAccommodation: 'OFF',
    });

    await expect(
      caller.setTimerAccommodation({
        code: 'ABC123',
        participantId,
        accommodation: 'OFF',
      }),
    ).resolves.toEqual({ timerAccommodation: 'OFF' });

    expect(prismaMock.participant.update).toHaveBeenCalledWith({
      where: { id: participantId },
      data: { timerAccommodation: 'OFF' },
    });
  });

  it('entfernt beim Verlassen nur die Online-Presence des Teilnehmers', async () => {
    const participantId = '11111111-1111-4111-8111-111111111111';
    prismaMock.participant.findFirst.mockResolvedValue({
      sessionId: SESSION_ID,
    });

    await expect(caller.markParticipantOffline({ code: 'ABC123', participantId })).resolves.toEqual(
      { ok: true },
    );

    expect(prismaMock.participant.findFirst).toHaveBeenCalledWith({
      where: {
        id: participantId,
        session: { code: 'ABC123' },
      },
      select: { sessionId: true },
    });
    expect(presenceMocks.removeParticipantPresence).toHaveBeenCalledWith(SESSION_ID, participantId);
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
      connectedCount: 0,
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

  it('pusht in der Teilnehmer-Subscription nach Join-Signal ohne Polling-Schleife ein neues Payload', async () => {
    const p1Id = '11111111-1111-4111-8111-111111111111';
    const p2Id = '22222222-2222-4222-8222-222222222222';
    prismaMock.session.findUnique
      .mockResolvedValueOnce({
        id: SESSION_ID,
        code: 'ABC123',
        status: 'LOBBY',
        currentQuestion: null,
        quiz: { questions: [] },
        participants: [
          {
            id: p1Id,
            nickname: 'Marie Curie',
            teamId: null,
            team: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        id: SESSION_ID,
        code: 'ABC123',
        status: 'LOBBY',
        currentQuestion: null,
        quiz: { questions: [] },
        participants: [
          {
            id: p1Id,
            nickname: 'Marie Curie',
            teamId: null,
            team: null,
          },
          {
            id: p2Id,
            nickname: 'Albert Einstein',
            teamId: null,
            team: null,
          },
        ],
      });

    const stream = await hostCaller.onParticipantJoined({ code: 'ABC123' });
    const iterator = stream[Symbol.asyncIterator]();

    const first = await iterator.next();
    expect(first.value).toEqual({
      connectedCount: 0,
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

    const secondPromise = iterator.next();
    await Promise.resolve();
    invalidateJoinCachesForCode('ABC123');
    const second = await secondPromise;

    expect(second.value).toEqual({
      connectedCount: 0,
      participantCount: 2,
      participants: [
        {
          id: p1Id,
          nickname: 'Marie Curie',
          teamId: null,
          teamName: null,
        },
        {
          id: p2Id,
          nickname: 'Albert Einstein',
          teamId: null,
          teamName: null,
        },
      ],
    });
    expect(prismaMock.session.findUnique).toHaveBeenCalledTimes(2);

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
