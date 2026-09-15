import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TRPCError } from '@trpc/server';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';

const { prismaMock, hostAuthMocks, participantAuthMocks, presenceMocks, invalidSessionCodeMock } =
  vi.hoisted(() => ({
    prismaMock: {
      session: {
        findUnique: vi.fn(),
      },
      participant: {
        count: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      $executeRaw: vi.fn(),
      $transaction: vi.fn(),
    },
    hostAuthMocks: {
      extractHostTokenMock: vi.fn(),
      extractHostTokenFromConnectionParamsMock: vi.fn(() => null as string | null),
      isHostSessionTokenValidMock: vi.fn(),
      isOriginalHostSessionTokenMock: vi.fn(),
    },
    participantAuthMocks: {
      assertParticipantCapability: vi.fn(),
    },
    presenceMocks: {
      getActiveParticipantCountForSession: vi.fn(),
      getActiveParticipantIdsForSession: vi.fn(),
      removeParticipantPresence: vi.fn(),
      touchParticipantPresence: vi.fn(),
    },
    invalidSessionCodeMock: vi.fn(),
  }));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/presence', () => ({
  getActiveParticipantCountForSession: presenceMocks.getActiveParticipantCountForSession,
  getActiveParticipantIdsForSession: presenceMocks.getActiveParticipantIdsForSession,
  removeParticipantPresence: presenceMocks.removeParticipantPresence,
  touchParticipantPresence: presenceMocks.touchParticipantPresence,
}));

vi.mock('../lib/invalidSessionCode', () => ({
  rejectInvalidSessionCode: invalidSessionCodeMock,
}));

vi.mock('../lib/hostAuth', async () => {
  const { buildHostAuthTestMock } = await import('./lib/hostAuth-vitest-mock');
  return buildHostAuthTestMock({
    extractHostToken: hostAuthMocks.extractHostTokenMock,
    extractHostTokenFromConnectionParams: hostAuthMocks.extractHostTokenFromConnectionParamsMock,
    isHostSessionTokenValid: hostAuthMocks.isHostSessionTokenValidMock,
    isOriginalHostSessionToken: hostAuthMocks.isOriginalHostSessionTokenMock,
  });
});

vi.mock('../lib/participantAuth', () => ({
  assertParticipantCapability: participantAuthMocks.assertParticipantCapability,
}));

import {
  invalidateJoinCachesForCode,
  resetParticipantNicknameCacheForTests,
  resetSessionReadCachesForTests,
  sessionRouter,
} from '../routers/session';

const caller = sessionRouter.createCaller({ req: undefined });
const hostCaller = sessionRouter.createCaller({ req: {} as never });
const SESSION_ID = '6a8edced-5f8f-4cfa-9176-454fac9570ad';
const PARTICIPANT_ID = '11111111-1111-4111-8111-111111111111';

function buildParticipantRow(index: number) {
  return {
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    nickname: `Person ${index + 1}`,
    teamId: null,
    team: null,
    joinedAt: new Date(Date.parse('2026-09-15T10:00:00.000Z') - index * 1_000),
  };
}

describe('session participant access (Story 2.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetParticipantNicknameCacheForTests();
    resetSessionReadCachesForTests();
    presenceMocks.getActiveParticipantCountForSession.mockResolvedValue(0);
    presenceMocks.getActiveParticipantIdsForSession.mockResolvedValue(new Set());
    presenceMocks.removeParticipantPresence.mockResolvedValue(undefined);
    presenceMocks.touchParticipantPresence.mockResolvedValue(undefined);
    participantAuthMocks.assertParticipantCapability.mockResolvedValue(undefined);
    prismaMock.participant.count.mockResolvedValue(0);
    prismaMock.participant.findMany.mockResolvedValue([]);
    invalidSessionCodeMock.mockRejectedValue(new TRPCError({ code: 'NOT_FOUND' }));
    hostAuthMocks.extractHostTokenMock.mockReturnValue('host-token-123');
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
    hostAuthMocks.isOriginalHostSessionTokenMock.mockResolvedValue(true);
    prismaMock.$executeRaw.mockResolvedValue(1);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      fn(prismaMock),
    );
  });

  trpcDodIt(
    {
      procedure: 'session.getParticipants',
      case: 'happy',
      mode: 'direct',
      title: 'liefert Teilnehmerliste und -anzahl für gültigen Code nur für Hosts',
    },
    async () => {
      const p1Id = '11111111-1111-4111-8111-111111111111';
      const p2Id = '22222222-2222-4222-8222-222222222222';
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        code: 'ABC123',
        status: 'LOBBY',
        currentQuestion: null,
        participantRevision: 2,
        onboardingAnonymousMode: false,
        _count: { participants: 2 },
        participants: [
          {
            id: p1Id,
            nickname: 'Marie Curie',
            teamId: null,
            team: null,
            joinedAt: new Date('2026-09-15T10:01:00.000Z'),
          },
          {
            id: p2Id,
            nickname: 'Albert Einstein',
            teamId: null,
            team: null,
            joinedAt: new Date('2026-09-15T10:00:00.000Z'),
          },
        ],
        quiz: { questions: [] },
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
          participantRevision: true,
          onboardingAnonymousMode: true,
          _count: { select: { participants: true } },
          participants: {
            orderBy: [{ joinedAt: 'desc' }, { id: 'desc' }],
            take: 20,
            select: {
              id: true,
              nickname: true,
              teamId: true,
              joinedAt: true,
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
    },
  );

  it('liefert leere Liste wenn keine Teilnehmer', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: 'XYZ789',
      status: 'LOBBY',
      currentQuestion: null,
      participantRevision: 0,
      onboardingAnonymousMode: false,
      _count: { participants: 0 },
      participants: [],
      quiz: { questions: [] },
    });

    const result = await hostCaller.getParticipants({ code: 'XYZ789' });

    expect(result).toMatchObject({
      participantCount: 0,
      connectedCount: 0,
    });
    expect(result.participants).toEqual([]);
  });

  trpcDodIt(
    {
      procedure: 'session.getParticipants',
      case: 'error',
      mode: 'direct',
      contract: 'NOT_FOUND',
      title: 'wirft NOT_FOUND bei unbekanntem Code',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue(null);

      await expect(hostCaller.getParticipants({ code: 'NONEXI' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'Session nicht gefunden.',
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.getParticipantNicknames',
      case: 'happy',
      mode: 'direct',
      title: 'liefert öffentlich nur Nicknames für Join-Kollisionen',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        code: 'ABC123',
        onboardingAnonymousMode: false,
        _count: { participants: 2 },
        participants: [{ nickname: 'Marie Curie' }, { nickname: 'Ada Lovelace' }],
      });

      const result = await caller.getParticipantNicknames({ code: 'ABC123' });

      expect(result).toEqual({
        nicknames: ['Marie Curie', 'Ada Lovelace'],
        participantCount: 2,
      });
      expect(prismaMock.session.findUnique).toHaveBeenCalledWith({
        where: { code: 'ABC123' },
        select: {
          onboardingAnonymousMode: true,
          _count: { select: { participants: true } },
          participants: {
            orderBy: [{ joinedAt: 'desc' }, { id: 'desc' }],
            take: 100,
            select: { nickname: true },
          },
        },
      });
    },
  );

  it('nutzt kurzzeitig einen Cache für die öffentliche Nickname-Liste', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: 'ABC123',
      onboardingAnonymousMode: false,
      _count: { participants: 2 },
      participants: [{ nickname: 'Marie Curie' }, { nickname: 'Ada Lovelace' }],
    });

    const first = await caller.getParticipantNicknames({ code: 'ABC123' });
    const second = await caller.getParticipantNicknames({ code: 'ABC123' });

    expect(first).toEqual(second);
    expect(prismaMock.session.findUnique).toHaveBeenCalledTimes(1);
  });

  trpcDodIt(
    {
      procedure: 'session.getParticipantSummary',
      case: 'happy',
      mode: 'direct',
      title:
        'liefert im Host-Summary höchstens 20 jüngste Ankünfte sowie Gesamt-, Presence- und Revisionsstand',
    },
    async () => {
      const recentParticipants = Array.from({ length: 25 }, (_, index) =>
        buildParticipantRow(index),
      );
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        status: 'LOBBY',
        currentQuestion: null,
        participantRevision: 17,
        onboardingAnonymousMode: false,
        _count: { participants: 2_500 },
        participants: recentParticipants,
        quiz: { questions: [] },
      });
      presenceMocks.getActiveParticipantCountForSession.mockResolvedValue(2);

      const result = await hostCaller.getParticipantSummary({ code: 'ABC123' });

      expect(result).toMatchObject({
        participantCount: 2_500,
        connectedCount: 2,
        revision: 17,
      });
      expect(result.recentArrivals).toHaveLength(20);
      expect(presenceMocks.getActiveParticipantIdsForSession).not.toHaveBeenCalled();
      expect(result.recentArrivals[0]).toEqual({
        id: recentParticipants[0].id,
        nickname: recentParticipants[0].nickname,
        teamId: null,
        teamName: null,
        joinedAt: recentParticipants[0].joinedAt.toISOString(),
      });
      expect(result.recentArrivals[19]).toEqual({
        id: recentParticipants[19].id,
        nickname: recentParticipants[19].nickname,
        teamId: null,
        teamName: null,
        joinedAt: recentParticipants[19].joinedAt.toISOString(),
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.getParticipantSummary',
      case: 'error',
      mode: 'direct',
      contract: 'NOT_FOUND',
      title: 'weist den Host-Summary für eine unbekannte Session zurück',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue(null);
      await expect(hostCaller.getParticipantSummary({ code: 'ABC123' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.searchParticipants',
      case: 'happy',
      mode: 'direct',
      title: 'begrenzt eine Teilnehmer-Suchseite samt Cursor auf 100 Einträge',
    },
    async () => {
      const rows = Array.from({ length: 101 }, (_, index) => buildParticipantRow(index));
      prismaMock.session.findUnique
        .mockResolvedValueOnce({ id: SESSION_ID, participantRevision: 23 })
        .mockResolvedValueOnce({ participantRevision: 23 });
      prismaMock.participant.findMany.mockResolvedValue(rows);
      prismaMock.participant.count.mockResolvedValue(2_500);

      const result = await hostCaller.searchParticipants({
        code: 'abc123',
        search: ' Person ',
        pageSize: 100,
      });

      expect(result.participants).toHaveLength(100);
      expect(result).toMatchObject({
        participantCount: 2_500,
        revision: 23,
        nextCursor: expect.any(String),
      });
      expect(prismaMock.participant.findMany).toHaveBeenCalledWith({
        where: {
          sessionId: SESSION_ID,
          nickname: { contains: 'Person', mode: 'insensitive' },
        },
        orderBy: [{ joinedAt: 'desc' }, { id: 'desc' }],
        take: 101,
        select: {
          id: true,
          nickname: true,
          teamId: true,
          joinedAt: true,
          team: { select: { name: true } },
        },
      });
      expect(JSON.parse(Buffer.from(result.nextCursor!, 'base64url').toString('utf8'))).toEqual({
        v: 1,
        revision: 23,
        joinedAt: rows[99].joinedAt.toISOString(),
        id: rows[99].id,
        search: 'Person',
      });
    },
  );

  it('weist Suchseiten über dem Shared-Zod-Limit von 100 vor dem Datenbankzugriff ab', async () => {
    await expect(
      hostCaller.searchParticipants({
        code: 'ABC123',
        pageSize: 101,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(prismaMock.session.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.participant.findMany).not.toHaveBeenCalled();
  });

  trpcDodIt(
    {
      procedure: 'session.searchParticipants',
      case: 'error',
      mode: 'direct',
      contract: 'CONFLICT',
      title: 'weist einen Cursor nach geänderter Teilnehmerrevision als Konflikt ab',
    },
    async () => {
      const rows = [buildParticipantRow(0), buildParticipantRow(1)];
      prismaMock.session.findUnique
        .mockResolvedValueOnce({ id: SESSION_ID, participantRevision: 5 })
        .mockResolvedValueOnce({ participantRevision: 5 })
        .mockResolvedValueOnce({ id: SESSION_ID, participantRevision: 6 });
      prismaMock.participant.findMany.mockResolvedValue(rows);
      prismaMock.participant.count.mockResolvedValue(2);

      const firstPage = await hostCaller.searchParticipants({
        code: 'ABC123',
        pageSize: 1,
      });
      expect(firstPage.nextCursor).toEqual(expect.any(String));

      await expect(
        hostCaller.searchParticipants({
          code: 'ABC123',
          pageSize: 1,
          cursor: firstPage.nextCursor!,
        }),
      ).rejects.toMatchObject({
        code: 'CONFLICT',
        message: 'Die Teilnehmerliste hat sich geändert. Lade sie bitte neu.',
      });
      expect(prismaMock.participant.findMany).toHaveBeenCalledTimes(1);
    },
  );

  it('verwirft eine Suchseite, wenn sich die Teilnehmerrevision während der Abfrage ändert', async () => {
    prismaMock.session.findUnique
      .mockResolvedValueOnce({ id: SESSION_ID, participantRevision: 8 })
      .mockResolvedValueOnce({ participantRevision: 9 });
    prismaMock.participant.findMany.mockResolvedValue([buildParticipantRow(0)]);
    prismaMock.participant.count.mockResolvedValue(1);

    await expect(
      hostCaller.searchParticipants({
        code: 'ABC123',
        pageSize: 50,
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'Die Teilnehmerliste hat sich geändert. Lade sie bitte neu.',
    });
  });

  it('gibt über die Host-Suche im anonymen Modus keine individuellen Einträge aus', async () => {
    const anonymousParticipant = buildParticipantRow(0);
    prismaMock.session.findUnique
      .mockResolvedValueOnce({
        id: SESSION_ID,
        participantRevision: 31,
        onboardingAnonymousMode: true,
      })
      .mockResolvedValueOnce({ participantRevision: 31 });
    prismaMock.participant.findMany.mockResolvedValue([anonymousParticipant]);
    prismaMock.participant.count.mockResolvedValue(1);

    const result = await hostCaller.searchParticipants({
      code: 'ABC123',
      pageSize: 50,
    });

    expect(result).toEqual({
      participants: [],
      participantCount: 1,
      revision: 31,
      nextCursor: null,
    });
  });

  trpcDodIt(
    {
      procedure: 'session.checkParticipantNickname',
      case: 'happy',
      mode: 'direct',
      title: 'prüft einen frei gewählten Nickname punktuell und case-insensitiv',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        onboardingAnonymousMode: false,
        onboardingAllowCustomNicknames: true,
      });
      prismaMock.participant.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: PARTICIPANT_ID });

      await expect(
        caller.checkParticipantNickname({
          code: 'abc123',
          nickname: ' Marie Curie ',
        }),
      ).resolves.toEqual({ available: true });
      await expect(
        caller.checkParticipantNickname({
          code: 'ABC123',
          nickname: 'Marie Curie',
        }),
      ).resolves.toEqual({ available: false });

      expect(prismaMock.session.findUnique).toHaveBeenCalledTimes(2);
      expect(prismaMock.session.findUnique).toHaveBeenLastCalledWith({
        where: { code: 'ABC123' },
        select: {
          id: true,
          onboardingAnonymousMode: true,
          onboardingAllowCustomNicknames: true,
        },
      });
      expect(prismaMock.participant.findFirst).toHaveBeenCalledTimes(2);
      expect(prismaMock.participant.findFirst).toHaveBeenLastCalledWith({
        where: {
          sessionId: SESSION_ID,
          nickname: { equals: 'Marie Curie', mode: 'insensitive' },
        },
        select: { id: true },
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.checkParticipantNickname',
      case: 'error',
      mode: 'direct',
      contract: 'NOT_FOUND',
      title: 'weist die Nickname-Prüfung für eine unbekannte Session zurück',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue(null);
      invalidSessionCodeMock.mockRejectedValue(new TRPCError({ code: 'NOT_FOUND' }));

      await expect(
        caller.checkParticipantNickname({
          code: 'ABC123',
          nickname: 'Marie Curie',
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    },
  );

  it('überspringt die Nickname-Bestandsabfrage im anonymen Modus', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      onboardingAnonymousMode: true,
      onboardingAllowCustomNicknames: false,
    });

    await expect(
      caller.checkParticipantNickname({
        code: 'ABC123',
        nickname: 'Nicht relevant',
      }),
    ).resolves.toEqual({ available: true });
    expect(prismaMock.participant.findFirst).not.toHaveBeenCalled();
  });

  trpcDodIt(
    {
      procedure: 'session.heartbeatParticipantPresence',
      case: 'happy',
      mode: 'direct',
      title: 'erneuert Participant-Presence erst nach erfolgreicher Capability-Prüfung',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({ id: SESSION_ID });

      const result = await caller.heartbeatParticipantPresence({
        code: 'abc123',
        participantId: PARTICIPANT_ID,
      });

      expect(participantAuthMocks.assertParticipantCapability).toHaveBeenCalledWith({
        ctx: { req: undefined },
        sessionId: SESSION_ID,
        participantId: PARTICIPANT_ID,
      });
      expect(presenceMocks.touchParticipantPresence).toHaveBeenCalledWith(
        SESSION_ID,
        PARTICIPANT_ID,
      );
      expect(
        participantAuthMocks.assertParticipantCapability.mock.invocationCallOrder[0],
      ).toBeLessThan(presenceMocks.touchParticipantPresence.mock.invocationCallOrder[0]);
      expect(result.connected).toBe(true);
      expect(Number.isNaN(Date.parse(result.serverNow))).toBe(false);
    },
  );

  trpcDodIt(
    {
      procedure: 'session.heartbeatParticipantPresence',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'erneuert ohne gültige Participant-Capability keine Presence',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({ id: SESSION_ID });
      participantAuthMocks.assertParticipantCapability.mockRejectedValueOnce(
        new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Teilnahme-Berechtigung erforderlich.',
        }),
      );

      await expect(
        caller.heartbeatParticipantPresence({
          code: 'ABC123',
          participantId: PARTICIPANT_ID,
        }),
      ).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Teilnahme-Berechtigung erforderlich.',
      });
      expect(presenceMocks.touchParticipantPresence).not.toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'session.getParticipantSelf',
      case: 'happy',
      mode: 'direct',
      title: 'liefert öffentlich nur den eigenen Teilnehmerdatensatz',
    },
    async () => {
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
    },
  );

  trpcDodIt(
    {
      procedure: 'session.setTimerAccommodation',
      case: 'happy',
      mode: 'direct',
      title: 'setzt die persönliche Timer-Anpassung nur für die eigene Teilnahme',
    },
    async () => {
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
    },
  );

  trpcDodIt(
    {
      procedure: 'session.setTimerAccommodation',
      case: 'happy',
      mode: 'direct',
      title: 'erzwingt DEFAULT, wenn Persönliche Zeit am Quiz aus ist',
    },
    async () => {
      const participantId = '11111111-1111-4111-8111-111111111111';
      prismaMock.participant.findFirst.mockResolvedValue({
        id: participantId,
        sessionId: SESSION_ID,
        session: { quiz: { enableTimerAccommodation: false } },
      });
      prismaMock.participant.update.mockResolvedValue({
        id: participantId,
        timerAccommodation: 'DEFAULT',
      });

      await expect(
        caller.setTimerAccommodation({
          code: 'ABC123',
          participantId,
          accommodation: 'OFF',
        }),
      ).resolves.toEqual({ timerAccommodation: 'DEFAULT' });

      expect(prismaMock.participant.update).toHaveBeenCalledWith({
        where: { id: participantId },
        data: { timerAccommodation: 'DEFAULT' },
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.markParticipantOffline',
      case: 'happy',
      mode: 'direct',
      title: 'entfernt beim Verlassen nur die Online-Presence des Teilnehmers',
    },
    async () => {
      const participantId = '11111111-1111-4111-8111-111111111111';
      prismaMock.participant.findFirst.mockResolvedValue({
        sessionId: SESSION_ID,
      });

      await expect(
        caller.markParticipantOffline({ code: 'ABC123', participantId }),
      ).resolves.toEqual({ ok: true });

      expect(prismaMock.participant.findFirst).toHaveBeenCalledWith({
        where: {
          id: participantId,
          session: { code: 'ABC123' },
        },
        select: { sessionId: true },
      });
      expect(presenceMocks.removeParticipantPresence).toHaveBeenCalledWith(
        SESSION_ID,
        participantId,
      );
    },
  );

  it('lehnt die Host-Teilnehmerliste ohne Host-Token ab', async () => {
    hostAuthMocks.extractHostTokenMock.mockReturnValue(null);

    await expect(hostCaller.getParticipants({ code: 'ABC123' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Host-Authentifizierung erforderlich.',
    });

    expect(prismaMock.session.findUnique).not.toHaveBeenCalled();
  });

  it('liefert die begrenzte Teilnehmer-Summary-Subscription nur mit Host-Rechten', async () => {
    const p1Id = '11111111-1111-4111-8111-111111111111';
    const joinedAt = new Date('2026-09-15T10:00:00.000Z');
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: 'ABC123',
      status: 'LOBBY',
      currentQuestion: null,
      participantRevision: 1,
      onboardingAnonymousMode: false,
      _count: { participants: 1 },
      participants: [
        {
          id: p1Id,
          nickname: 'Marie Curie',
          teamId: null,
          team: null,
          joinedAt,
        },
      ],
      quiz: { questions: [] },
    });

    const stream = await hostCaller.onParticipantJoined({ code: 'ABC123' });
    const iterator = stream[Symbol.asyncIterator]();
    const { value } = await iterator.next();

    expect(value).toEqual({
      connectedCount: 0,
      participantCount: 1,
      revision: 1,
      recentArrivals: [
        {
          id: p1Id,
          nickname: 'Marie Curie',
          teamId: null,
          teamName: null,
          joinedAt: joinedAt.toISOString(),
        },
      ],
    });

    await iterator.return?.(undefined);
  });

  it('pusht in der Teilnehmer-Subscription nach Join-Signal ohne Polling-Schleife ein neues Payload', async () => {
    const p1Id = '11111111-1111-4111-8111-111111111111';
    const p2Id = '22222222-2222-4222-8222-222222222222';
    const p1JoinedAt = new Date('2026-09-15T10:00:00.000Z');
    const p2JoinedAt = new Date('2026-09-15T10:01:00.000Z');
    prismaMock.session.findUnique
      .mockResolvedValueOnce({
        id: SESSION_ID,
        code: 'ABC123',
        status: 'LOBBY',
        currentQuestion: null,
        participantRevision: 1,
        onboardingAnonymousMode: false,
        _count: { participants: 1 },
        quiz: { questions: [] },
        participants: [
          {
            id: p1Id,
            nickname: 'Marie Curie',
            teamId: null,
            team: null,
            joinedAt: p1JoinedAt,
          },
        ],
      })
      .mockResolvedValueOnce({
        id: SESSION_ID,
        code: 'ABC123',
        status: 'LOBBY',
        currentQuestion: null,
        participantRevision: 2,
        onboardingAnonymousMode: false,
        _count: { participants: 2 },
        quiz: { questions: [] },
        participants: [
          {
            id: p2Id,
            nickname: 'Albert Einstein',
            teamId: null,
            team: null,
            joinedAt: p2JoinedAt,
          },
          {
            id: p1Id,
            nickname: 'Marie Curie',
            teamId: null,
            team: null,
            joinedAt: p1JoinedAt,
          },
        ],
      });

    const stream = await hostCaller.onParticipantJoined({ code: 'ABC123' });
    const iterator = stream[Symbol.asyncIterator]();

    const first = await iterator.next();
    expect(first.value).toEqual({
      connectedCount: 0,
      participantCount: 1,
      revision: 1,
      recentArrivals: [
        {
          id: p1Id,
          nickname: 'Marie Curie',
          teamId: null,
          teamName: null,
          joinedAt: p1JoinedAt.toISOString(),
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
      revision: 2,
      recentArrivals: [
        {
          id: p2Id,
          nickname: 'Albert Einstein',
          teamId: null,
          teamName: null,
          joinedAt: p2JoinedAt.toISOString(),
        },
        {
          id: p1Id,
          nickname: 'Marie Curie',
          teamId: null,
          teamName: null,
          joinedAt: p1JoinedAt.toISOString(),
        },
      ],
    });
    expect(prismaMock.session.findUnique).toHaveBeenCalledTimes(2);

    await iterator.return?.(undefined);
  });

  it('beendet die Host-Teilnehmer-Subscription nach Widerruf eines Paired-Host-Tokens', async () => {
    const { hashHostPairingSecret, notifyPairedHostTokenInvalidated } =
      await import('../lib/hostPairing');
    hostAuthMocks.isOriginalHostSessionTokenMock.mockResolvedValue(false);
    const p1Id = '11111111-1111-4111-8111-111111111111';
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: 'ABC123',
      status: 'LOBBY',
      currentQuestion: null,
      participantRevision: 1,
      onboardingAnonymousMode: false,
      _count: { participants: 1 },
      participants: [
        {
          id: p1Id,
          nickname: 'Marie Curie',
          teamId: null,
          team: null,
          joinedAt: new Date('2026-09-15T10:00:00.000Z'),
        },
      ],
      quiz: { questions: [] },
    });

    const stream = await hostCaller.onParticipantJoined({ code: 'ABC123' });
    const iterator = stream[Symbol.asyncIterator]();
    await iterator.next();
    const pending = iterator.next();
    await new Promise((resolve) => setTimeout(resolve, 20));
    notifyPairedHostTokenInvalidated('ABC123', hashHostPairingSecret('host-token-123'));
    await expect(pending).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Die Host-Verbindung wurde beendet.',
    });
  });

  it('stellt nach ungültigem Token keine Host-Subscription mehr her', async () => {
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(false);

    await expect(hostCaller.onParticipantJoined({ code: 'ABC123' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Host-Session ungültig oder abgelaufen.',
    });
    expect(prismaMock.session.findUnique).not.toHaveBeenCalled();
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

trpcDodIt(
  {
    procedure: 'session.getParticipantNicknames',
    case: 'error',
    mode: 'direct',
    contract: 'NOT_FOUND',
    title: 'leitet einen unbekannten Code ueber den Lookup-Enumerationsschutz',
  },
  async () => {
    vi.clearAllMocks();
    resetParticipantNicknameCacheForTests();
    prismaMock.session.findUnique.mockResolvedValue(null);
    invalidSessionCodeMock.mockRejectedValue(new TRPCError({ code: 'NOT_FOUND' }));

    await expect(caller.getParticipantNicknames({ code: 'BAD999' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(invalidSessionCodeMock).toHaveBeenCalledWith(undefined, 'BAD999', 'lookup');
  },
);

trpcDodIt(
  {
    procedure: 'session.getParticipantSelf',
    case: 'error',
    mode: 'direct',
    contract: 'NOT_FOUND',
    title: 'leitet einen unbekannten Code ueber den Reconnect-Enumerationsschutz',
  },
  async () => {
    vi.clearAllMocks();
    prismaMock.session.findUnique.mockResolvedValue(null);
    invalidSessionCodeMock.mockRejectedValue(new TRPCError({ code: 'NOT_FOUND' }));

    await expect(
      caller.getParticipantSelf({
        code: 'BAD999',
        participantId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(invalidSessionCodeMock).toHaveBeenCalledWith(undefined, 'BAD999', 'pollReconnect');
  },
);

trpcDodIt(
  {
    procedure: 'session.markParticipantOffline',
    case: 'error',
    mode: 'direct',
    contract: 'VALIDATION',
    title: 'weist einen syntaktisch ungueltigen Session-Code vor dem idempotenten Resolver ab',
  },
  async () => {
    vi.clearAllMocks();

    await expect(
      caller.markParticipantOffline({
        code: 'BAD',
        participantId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(prismaMock.participant.findFirst).not.toHaveBeenCalled();
  },
);

trpcDodIt(
  {
    procedure: 'session.setTimerAccommodation',
    case: 'error',
    mode: 'direct',
    contract: 'NOT_FOUND',
    title: 'lehnt eine Teilnahme ab, die nicht zur angegebenen Session gehört',
  },
  async () => {
    vi.clearAllMocks();
    prismaMock.participant.findFirst.mockResolvedValue(null);

    await expect(
      caller.setTimerAccommodation({
        code: 'ABC123',
        participantId: '11111111-1111-4111-8111-111111111111',
        accommodation: 'OFF',
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  },
);
