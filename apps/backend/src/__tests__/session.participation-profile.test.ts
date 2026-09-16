import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';

const { prismaMock, hostAuthMocks } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $executeRaw: vi.fn().mockResolvedValue(1),
    $transaction: vi.fn(),
  },
  hostAuthMocks: {
    extractHostTokenMock: vi.fn(),
    extractHostTokenFromConnectionParamsMock: vi.fn(() => null as string | null),
    isHostSessionTokenValidMock: vi.fn(),
  },
}));

vi.mock('../db', () => ({ prisma: prismaMock }));
vi.mock('../lib/rateLimit', () => ({ checkSessionCreateRate: vi.fn() }));
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

const storedProfile = {
  onboardingProfileConfigured: true,
  onboardingNicknameTheme: 'KINDERGARTEN',
  onboardingAllowCustomNicknames: false,
  onboardingAnonymousMode: false,
  onboardingTeamMode: true,
  onboardingTeamCount: 2,
  onboardingTeamAssignment: 'AUTO',
  onboardingTeamNames: ['Apfel', 'Birne'],
  quiz: null,
};

describe('sessionweites Teilnahmeprofil', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostAuthMocks.extractHostTokenMock.mockReturnValue('host-token');
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      fn(prismaMock),
    );
    prismaMock.$executeRaw.mockResolvedValue(1);
  });

  trpcDodIt(
    {
      procedure: 'session.getParticipationProfileForHost',
      case: 'happy',
      mode: 'direct',
      title: 'liefert den dokumentierten Legacy-Default vor dem ersten Beitritt',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        onboardingProfileConfigured: false,
        onboardingNicknameTheme: null,
        onboardingAllowCustomNicknames: null,
        onboardingAnonymousMode: null,
        onboardingTeamMode: null,
        onboardingTeamCount: null,
        onboardingTeamAssignment: null,
        onboardingTeamNames: null,
        quiz: null,
        firstParticipantJoinedAt: null,
      });

      await expect(caller.getParticipationProfileForHost({ code: 'abc123' })).resolves.toEqual({
        identityMode: 'PRESET_PSEUDONYM',
        nicknameTheme: 'KINDERGARTEN',
        allowCustomNicknames: false,
        anonymousMode: false,
        firstParticipantJoinedAt: null,
        configurationAllowed: true,
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.getParticipationProfileForHost',
      case: 'error',
      mode: 'direct',
      contract: 'NOT_FOUND',
      title: 'weist das Teilnahmeprofil für eine unbekannte Session zurück',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue(null);
      await expect(caller.getParticipationProfileForHost({ code: 'abc123' })).rejects.toMatchObject(
        { code: 'NOT_FOUND' },
      );
    },
  );

  trpcDodIt(
    {
      procedure: 'session.configureParticipationProfile',
      case: 'happy',
      mode: 'direct',
      title: 'ändert vor dem ersten Join nur Identitätsfelder und erhält Teamzuweisungen',
    },
    async () => {
      const activeSession = {
        ...storedProfile,
        id: SESSION_ID,
        status: 'LOBBY',
        expiresAt: new Date(Date.now() + 60_000),
        endedAt: null,
        qaEnabled: true,
        firstParticipantJoinedAt: null,
      };
      prismaMock.session.findUnique
        .mockResolvedValueOnce({ id: SESSION_ID })
        .mockResolvedValueOnce(activeSession);
      prismaMock.session.update.mockResolvedValue({
        ...storedProfile,
        onboardingNicknameTheme: 'MIDDLE_SCHOOL',
        onboardingAllowCustomNicknames: true,
        onboardingAnonymousMode: false,
        firstParticipantJoinedAt: null,
      });

      const result = await caller.configureParticipationProfile({
        code: 'abc123',
        identityMode: 'CUSTOM_NICKNAME',
        nicknameTheme: 'MIDDLE_SCHOOL',
      });

      expect(prismaMock.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SESSION_ID },
          data: {
            onboardingProfileConfigured: true,
            onboardingNicknameTheme: 'MIDDLE_SCHOOL',
            onboardingAllowCustomNicknames: true,
            onboardingAnonymousMode: false,
          },
        }),
      );
      expect(result).toMatchObject({
        identityMode: 'CUSTOM_NICKNAME',
        nicknameTheme: 'MIDDLE_SCHOOL',
        configurationAllowed: true,
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.configureParticipationProfile',
      case: 'error',
      mode: 'direct',
      contract: 'CONFLICT',
      title: 'weist einen direkten Änderungsversuch nach dem ersten Join serverseitig ab',
    },
    async () => {
      prismaMock.session.findUnique
        .mockResolvedValueOnce({ id: SESSION_ID })
        .mockResolvedValueOnce({
          ...storedProfile,
          id: SESSION_ID,
          status: 'LOBBY',
          expiresAt: new Date(Date.now() + 60_000),
          endedAt: null,
          qaEnabled: true,
          firstParticipantJoinedAt: new Date('2026-09-15T08:00:00.000Z'),
        });

      await expect(
        caller.configureParticipationProfile({
          code: 'abc123',
          identityMode: 'ANONYMOUS',
          nicknameTheme: 'HIGH_SCHOOL',
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(prismaMock.session.update).not.toHaveBeenCalled();
    },
  );

  it('weist die Konfiguration einer effektiv abgelaufenen Session fail-closed ab', async () => {
    prismaMock.session.findUnique.mockResolvedValueOnce({ id: SESSION_ID }).mockResolvedValueOnce({
      ...storedProfile,
      id: SESSION_ID,
      status: 'LOBBY',
      expiresAt: new Date(Date.now() - 1),
      endedAt: null,
      qaEnabled: true,
      firstParticipantJoinedAt: null,
    });

    await expect(
      caller.configureParticipationProfile({
        code: 'abc123',
        identityMode: 'ANONYMOUS',
        nicknameTheme: 'HIGH_SCHOOL',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(prismaMock.session.update).not.toHaveBeenCalled();
  });
});
