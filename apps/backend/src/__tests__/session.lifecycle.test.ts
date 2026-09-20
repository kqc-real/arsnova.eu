import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';

const { prismaMock, hostAuthMocks } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  },
  hostAuthMocks: {
    extractHostToken: vi.fn(),
    extractHostTokenFromConnectionParams: vi.fn(() => null as string | null),
    isHostSessionTokenValid: vi.fn(),
    isOriginalHostSessionToken: vi.fn(),
  },
}));

vi.mock('../db', () => ({ prisma: prismaMock }));
vi.mock('../redis', () => ({
  getRedis: () => ({
    get: vi.fn(async () => null),
    set: vi.fn(async () => 'OK'),
  }),
}));
vi.mock('../lib/hostAuth', async () => {
  const { buildHostAuthTestMock } = await import('./lib/hostAuth-vitest-mock');
  return buildHostAuthTestMock(hostAuthMocks);
});
vi.mock('../lib/hostPairing', () => ({
  invalidateHostPairingForSession: vi.fn(),
  findPairedHostByToken: vi.fn(async () => null),
}));

import { sessionRouter, resetSessionReadCachesForTests } from '../routers/session';

const caller = sessionRouter.createCaller({ req: {} as never });
const originalMaxSessionDuration = process.env['MAX_SESSION_DURATION'];
const createdAt = new Date('2026-09-15T06:00:00.000Z');
const expiresAt = new Date('2026-09-16T06:00:00.000Z');
const qaClosesAt = new Date('2026-09-16T06:00:00.000Z');

function lifecycleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    status: 'ACTIVE',
    createdAt,
    expiresAt,
    endedAt: null,
    qaEnabled: true,
    qaClosesAt,
    firstParticipantJoinedAt: null,
    timeZone: 'Europe/Berlin',
    sessionLifecycleRevision: 2,
    ...overrides,
  };
}

function qaConfigurationRow(overrides: Record<string, unknown> = {}) {
  return {
    ...lifecycleRow({
      qaEnabled: false,
      qaClosesAt: null,
    }),
    type: 'QUIZ',
    quizId: '11111111-1111-4111-8111-111111111111',
    qaOpen: false,
    qaTitle: null,
    qaModerationMode: false,
    title: 'Seminar',
    moderationMode: false,
    quickFeedbackEnabled: false,
    quickFeedbackOpen: false,
    preferredChannel: 'quiz',
    onboardingNicknameTheme: 'HIGH_SCHOOL',
    onboardingAllowCustomNicknames: true,
    onboardingAnonymousMode: false,
    ...overrides,
  };
}

describe('session absolute lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-15T07:00:00.000Z'));
    resetSessionReadCachesForTests();
    hostAuthMocks.extractHostToken.mockReturnValue('host-token');
    hostAuthMocks.isHostSessionTokenValid.mockResolvedValue(true);
    hostAuthMocks.isOriginalHostSessionToken.mockResolvedValue(true);
    process.env['MAX_SESSION_DURATION'] = 'P14D';
    prismaMock.$executeRaw.mockResolvedValue(1);
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalMaxSessionDuration === undefined) {
      delete process.env['MAX_SESSION_DURATION'];
    } else {
      process.env['MAX_SESSION_DURATION'] = originalMaxSessionDuration;
    }
  });

  trpcDodIt(
    {
      procedure: 'session.getLifecycleForHost',
      case: 'happy',
      mode: 'direct',
      title: 'liefert gekoppelt gelesene Fristen, aber keine globale Verlängerungsberechtigung',
    },
    async () => {
      hostAuthMocks.isOriginalHostSessionToken.mockResolvedValue(false);
      prismaMock.session.findUnique.mockResolvedValue(lifecycleRow());

      await expect(caller.getLifecycleForHost({ code: 'ABC123' })).resolves.toMatchObject({
        status: 'ACTIVE',
        expiresAt: expiresAt.toISOString(),
        qaClosesAt: qaClosesAt.toISOString(),
        originalHost: false,
        extensionAllowed: false,
        configurationAllowed: true,
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.getLifecycleForHost',
      case: 'error',
      mode: 'direct',
      contract: 'NOT_FOUND',
      title: 'weist Lifecycle-Lesen für eine unbekannte Session zurück',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue(null);
      await expect(caller.getLifecycleForHost({ code: 'ABC123' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.previewExpiration',
      case: 'error',
      mode: 'direct',
      contract: 'FORBIDDEN',
      title: 'weist die globale Vorschau eines gekoppelten Hosts serverseitig zurück',
    },
    async () => {
      hostAuthMocks.isOriginalHostSessionToken.mockResolvedValue(false);

      await expect(
        caller.previewExpiration({
          code: 'ABC123',
          purpose: 'GLOBAL_EXTENSION',
          selection: { kind: 'QUICK', amount: 'ONE_HOUR' },
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(prismaMock.session.findUnique).not.toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'session.previewExpiration',
      case: 'happy',
      mode: 'direct',
      title: 'bestätigt eine Schnellwahl ab bisherigem expiresAt und isoliert qaClosesAt',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue(lifecycleRow());

      await expect(
        caller.previewExpiration({
          code: 'ABC123',
          purpose: 'GLOBAL_EXTENSION',
          selection: { kind: 'QUICK', amount: 'ONE_HOUR' },
        }),
      ).resolves.toMatchObject({
        expectedLifecycleRevision: 2,
        oldExpiresAt: '2026-09-16T06:00:00.000Z',
        newExpiresAt: '2026-09-16T07:00:00.000Z',
        qaClosesAt: '2026-09-16T06:00:00.000Z',
      });
    },
  );

  it('weist Vergangenheit und Betreiberobergrenze auch bei direkter Vorschau zurück', async () => {
    prismaMock.session.findUnique.mockResolvedValue(lifecycleRow());

    await expect(
      caller.previewExpiration({
        code: 'ABC123',
        purpose: 'INITIAL_CONFIGURATION',
        selection: { kind: 'ABSOLUTE', expiresAt: '2026-09-15T06:59:59Z' },
        timeZone: 'Europe/Berlin',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      caller.previewExpiration({
        code: 'ABC123',
        purpose: 'INITIAL_CONFIGURATION',
        selection: { kind: 'ABSOLUTE', expiresAt: '2026-09-30T06:00:00Z' },
        timeZone: 'Europe/Berlin',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  trpcDodIt(
    {
      procedure: 'session.changeExpiration',
      case: 'happy',
      mode: 'direct',
      title: 'speichert die globale Anfangsfrist und lässt eine Q&A-Frist unverändert',
    },
    async () => {
      const configuredExpiresAt = new Date('2026-09-22T06:00:00.000Z');
      prismaMock.session.findUnique
        .mockResolvedValueOnce({ id: 'session-1' })
        .mockResolvedValueOnce(lifecycleRow());
      prismaMock.session.update.mockResolvedValue(
        lifecycleRow({
          expiresAt: configuredExpiresAt,
          timeZone: 'Europe/Berlin',
          sessionLifecycleRevision: 3,
        }),
      );

      await expect(
        caller.changeExpiration({
          code: 'ABC123',
          purpose: 'INITIAL_CONFIGURATION',
          selection: { kind: 'DURATION_DAYS', days: 7 },
          timeZone: 'Europe/Berlin',
          expectedLifecycleRevision: 2,
          confirmedExpiresAt: configuredExpiresAt.toISOString(),
        }),
      ).resolves.toMatchObject({
        expiresAt: configuredExpiresAt.toISOString(),
        qaClosesAt: qaClosesAt.toISOString(),
        sessionLifecycleRevision: 3,
      });
      expect(prismaMock.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            expiresAt: configuredExpiresAt,
            sessionLifecycleRevision: { increment: 1 },
            timeZone: 'Europe/Berlin',
          },
        }),
      );
    },
  );

  trpcDodIt(
    {
      procedure: 'session.changeExpiration',
      case: 'error',
      mode: 'direct',
      contract: 'CONFLICT',
      title: 'verwirft eine bestätigte Änderung nach konkurrierender Revision',
    },
    async () => {
      prismaMock.session.findUnique
        .mockResolvedValueOnce({ id: 'session-1' })
        .mockResolvedValueOnce(lifecycleRow({ sessionLifecycleRevision: 3 }));

      await expect(
        caller.changeExpiration({
          code: 'ABC123',
          purpose: 'GLOBAL_EXTENSION',
          selection: { kind: 'QUICK', amount: 'ONE_HOUR' },
          expectedLifecycleRevision: 2,
          confirmedExpiresAt: '2026-09-16T07:00:00.000Z',
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(prismaMock.session.update).not.toHaveBeenCalled();
    },
  );

  it('ändert bei warnungsbasierter Verlängerung ausschließlich die globale Frist', async () => {
    prismaMock.session.findUnique
      .mockResolvedValueOnce({ id: 'session-1' })
      .mockResolvedValueOnce(lifecycleRow());
    prismaMock.session.update.mockResolvedValue(
      lifecycleRow({
        expiresAt: new Date('2026-09-16T07:00:00.000Z'),
        sessionLifecycleRevision: 3,
      }),
    );

    await expect(
      caller.changeExpiration({
        code: 'ABC123',
        purpose: 'GLOBAL_EXTENSION',
        selection: { kind: 'QUICK', amount: 'ONE_HOUR' },
        expectedLifecycleRevision: 2,
        confirmedExpiresAt: '2026-09-16T07:00:00.000Z',
      }),
    ).resolves.toMatchObject({
      expiresAt: '2026-09-16T07:00:00.000Z',
      qaClosesAt: '2026-09-16T06:00:00.000Z',
      sessionLifecycleRevision: 3,
    });
    expect(prismaMock.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          expiresAt: new Date('2026-09-16T07:00:00.000Z'),
          sessionLifecycleRevision: { increment: 1 },
        },
      }),
    );
  });

  it('sperrt die Anfangskonfiguration dauerhaft nach dem ersten Beitritt', async () => {
    prismaMock.session.findUnique.mockResolvedValue(
      lifecycleRow({ firstParticipantJoinedAt: new Date('2026-09-15T06:30:00.000Z') }),
    );

    await expect(
      caller.previewExpiration({
        code: 'ABC123',
        purpose: 'INITIAL_CONFIGURATION',
        selection: { kind: 'DURATION_DAYS', days: 7 },
        timeZone: 'Europe/Berlin',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  trpcDodIt(
    {
      procedure: 'session.previewQaConfiguration',
      case: 'happy',
      mode: 'direct',
      title: 'berechnet eine Q&A-Kalendertagsfrist serverseitig und weist die Verlängerung aus',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue(qaConfigurationRow());

      await expect(
        caller.previewQaConfiguration({
          code: 'ABC123',
          mode: 'INITIAL',
          selection: { kind: 'DURATION_DAYS', days: 1 },
        }),
      ).resolves.toMatchObject({
        expectedLifecycleRevision: 2,
        oldQaClosesAt: null,
        newQaClosesAt: '2026-09-16T07:00:00.000Z',
        oldExpiresAt: '2026-09-16T06:00:00.000Z',
        newExpiresAt: '2026-09-16T07:00:00.000Z',
        requiresSessionExtension: true,
        originalHost: true,
        timeZone: 'Europe/Berlin',
        serverNow: '2026-09-15T07:00:00.000Z',
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.previewQaConfiguration',
      case: 'error',
      mode: 'direct',
      contract: 'NOT_FOUND',
      title: 'weist die Q&A-Vorschau für eine unbekannte Session zurück',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue(null);
      await expect(
        caller.previewQaConfiguration({
          code: 'ABC123',
          mode: 'INITIAL',
          selection: { kind: 'DURATION_DAYS', days: 1 },
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.configureQaChannel',
      case: 'happy',
      mode: 'direct',
      title: 'bindet die Q&A-Bestätigung an Vorschauzeit und Revision und setzt den Kanal atomar',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue(qaConfigurationRow());
      prismaMock.session.update.mockResolvedValue(
        qaConfigurationRow({
          qaEnabled: true,
          qaOpen: true,
          qaClosesAt: new Date('2026-09-16T07:00:00.000Z'),
          expiresAt: new Date('2026-09-16T07:00:00.000Z'),
          qaTitle: 'Prüfungsfragen',
          qaModerationMode: true,
          preferredChannel: 'qa',
          sessionLifecycleRevision: 3,
        }),
      );

      await expect(
        caller.configureQaChannel({
          code: 'ABC123',
          mode: 'INITIAL',
          selection: { kind: 'DURATION_DAYS', days: 1 },
          expectedLifecycleRevision: 2,
          previewServerNow: '2026-09-15T07:00:00.000Z',
          confirmedQaClosesAt: '2026-09-16T07:00:00.000Z',
          confirmedExpiresAt: '2026-09-16T07:00:00.000Z',
          confirmSessionExtension: true,
          qaTitle: 'Prüfungsfragen',
          moderationMode: true,
          participationProfile: {
            identityMode: 'PRESET_PSEUDONYM',
            nicknameTheme: 'HIGH_SCHOOL',
          },
        }),
      ).resolves.toMatchObject({
        preferredChannel: 'qa',
        qaClosesAt: '2026-09-16T07:00:00.000Z',
        expiresAt: '2026-09-16T07:00:00.000Z',
        sessionLifecycleRevision: 3,
      });
      expect(prismaMock.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            qaEnabled: true,
            qaOpen: true,
            qaClosesAt: new Date('2026-09-16T07:00:00.000Z'),
            expiresAt: new Date('2026-09-16T07:00:00.000Z'),
            preferredChannel: 'qa',
            sessionLifecycleRevision: { increment: 1 },
            onboardingAllowCustomNicknames: false,
            onboardingAnonymousMode: false,
          }),
        }),
      );
    },
  );

  it('öffnet Q&A nach Quiz-FINISHED, wenn noch keine Frist eingerichtet war', async () => {
    const finished = qaConfigurationRow({
      status: 'FINISHED',
      endedAt: new Date('2026-09-15T06:30:00.000Z'),
    });
    prismaMock.session.findUnique.mockResolvedValue(finished);
    prismaMock.session.update.mockResolvedValue({
      ...finished,
      status: 'LOBBY',
      endedAt: null,
      qaEnabled: true,
      qaOpen: true,
      qaClosesAt: new Date('2026-09-16T07:00:00.000Z'),
      expiresAt: new Date('2026-09-16T07:00:00.000Z'),
      preferredChannel: 'qa',
      sessionLifecycleRevision: 3,
    });

    await expect(
      caller.configureQaChannel({
        code: 'ABC123',
        mode: 'INITIAL',
        selection: { kind: 'DURATION_DAYS', days: 1 },
        expectedLifecycleRevision: 2,
        previewServerNow: '2026-09-15T07:00:00.000Z',
        confirmedQaClosesAt: '2026-09-16T07:00:00.000Z',
        confirmedExpiresAt: '2026-09-16T07:00:00.000Z',
        confirmSessionExtension: true,
        moderationMode: true,
      }),
    ).resolves.toMatchObject({
      preferredChannel: 'qa',
      qaClosesAt: '2026-09-16T07:00:00.000Z',
    });
    expect(prismaMock.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          qaEnabled: true,
          status: 'LOBBY',
          endedAt: null,
        }),
      }),
    );
  });

  trpcDodIt(
    {
      procedure: 'session.configureQaChannel',
      case: 'error',
      mode: 'direct',
      contract: 'FORBIDDEN',
      title: 'verweigert einem gekoppelten Host eine Q&A-Frist mit globaler Verlängerung',
    },
    async () => {
      hostAuthMocks.isOriginalHostSessionToken.mockResolvedValue(false);
      prismaMock.session.findUnique.mockResolvedValue(qaConfigurationRow());

      await expect(
        caller.configureQaChannel({
          code: 'ABC123',
          mode: 'INITIAL',
          selection: { kind: 'DURATION_DAYS', days: 1 },
          expectedLifecycleRevision: 2,
          previewServerNow: '2026-09-15T07:00:00.000Z',
          confirmedQaClosesAt: '2026-09-16T07:00:00.000Z',
          confirmedExpiresAt: '2026-09-16T07:00:00.000Z',
          confirmSessionExtension: true,
          moderationMode: true,
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(prismaMock.session.update).not.toHaveBeenCalled();
    },
  );

  it('verwirft eine abgelaufene Q&A-Vorschau', async () => {
    prismaMock.session.findUnique.mockResolvedValue(qaConfigurationRow());

    await expect(
      caller.configureQaChannel({
        code: 'ABC123',
        mode: 'INITIAL',
        selection: { kind: 'DURATION_DAYS', days: 1 },
        expectedLifecycleRevision: 2,
        previewServerNow: '2026-09-15T06:40:00.000Z',
        confirmedQaClosesAt: '2026-09-16T06:40:00.000Z',
        confirmedExpiresAt: '2026-09-16T06:40:00.000Z',
        confirmSessionExtension: true,
        moderationMode: true,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prismaMock.session.update).not.toHaveBeenCalled();
  });

  it('bewahrt bei REPLAN ohne Wiederöffnen den geschlossenen Kanal', async () => {
    const closed = qaConfigurationRow({
      qaEnabled: true,
      qaOpen: false,
      qaClosesAt: new Date('2026-09-16T04:00:00.000Z'),
      qaTitle: 'Alte Fragenwand',
      qaModerationMode: false,
      preferredChannel: 'qa',
    });
    prismaMock.session.findUnique.mockResolvedValue(closed);
    prismaMock.session.update.mockResolvedValue({
      ...closed,
      qaTitle: 'Nur Titel',
      sessionLifecycleRevision: 3,
    });

    await caller.configureQaChannel({
      code: 'ABC123',
      mode: 'REPLAN',
      selection: { kind: 'ABSOLUTE', closesAt: '2026-09-16T04:00:00.000Z' },
      expectedLifecycleRevision: 2,
      previewServerNow: '2026-09-15T07:00:00.000Z',
      confirmedQaClosesAt: '2026-09-16T04:00:00.000Z',
      confirmedExpiresAt: '2026-09-16T06:00:00.000Z',
      confirmSessionExtension: false,
      reopenQa: false,
      qaTitle: 'Nur Titel',
      moderationMode: false,
    });

    expect(prismaMock.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          qaOpen: false,
          qaModerationMode: false,
          qaClosesAt: new Date('2026-09-16T04:00:00.000Z'),
          qaTitle: 'Nur Titel',
        }),
      }),
    );
  });

  it('lässt eine abgelaufene Q&A-Frist bei reiner Titeländerung unverändert', async () => {
    const expired = qaConfigurationRow({
      qaEnabled: true,
      qaOpen: false,
      qaClosesAt: new Date('2026-09-15T06:30:00.123Z'),
      expiresAt: new Date('2026-09-16T06:00:00.000Z'),
      qaTitle: 'Alte Fragenwand',
      qaModerationMode: false,
      preferredChannel: 'qa',
    });
    prismaMock.session.findUnique.mockResolvedValue(expired);
    prismaMock.session.update.mockResolvedValue({
      ...expired,
      qaTitle: 'Nur Titel',
      sessionLifecycleRevision: 3,
    });

    await expect(
      caller.previewQaConfiguration({
        code: 'ABC123',
        mode: 'REPLAN',
        selection: { kind: 'ABSOLUTE', closesAt: '2026-09-15T06:30:00.123Z' },
      }),
    ).resolves.toMatchObject({
      newQaClosesAt: '2026-09-15T06:30:00.123Z',
      newExpiresAt: '2026-09-16T06:00:00.000Z',
      requiresSessionExtension: false,
    });

    await caller.configureQaChannel({
      code: 'ABC123',
      mode: 'REPLAN',
      selection: { kind: 'ABSOLUTE', closesAt: '2026-09-15T06:30:00.123Z' },
      expectedLifecycleRevision: 2,
      previewServerNow: '2026-09-15T07:00:00.000Z',
      confirmedQaClosesAt: '2026-09-15T06:30:00.123Z',
      confirmedExpiresAt: '2026-09-16T06:00:00.000Z',
      confirmSessionExtension: false,
      reopenQa: false,
      qaTitle: 'Nur Titel',
      moderationMode: true,
    });

    expect(prismaMock.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          qaOpen: false,
          qaClosesAt: new Date('2026-09-15T06:30:00.123Z'),
          qaTitle: 'Nur Titel',
          qaModerationMode: true,
        }),
      }),
    );
    expect(prismaMock.session.update.mock.calls[0]?.[0].data.expiresAt).toBeUndefined();
  });

  it('lehnt eine veraltete Q&A-Konfigurationsrevision ab', async () => {
    const expired = qaConfigurationRow({
      qaEnabled: true,
      qaOpen: false,
      qaClosesAt: new Date('2026-09-15T06:30:00.123Z'),
      expiresAt: new Date('2026-09-16T06:00:00.000Z'),
      qaTitle: 'Alte Fragenwand',
      preferredChannel: 'qa',
      sessionLifecycleRevision: 3,
    });
    prismaMock.session.findUnique.mockResolvedValue(expired);

    await expect(
      caller.configureQaChannel({
        code: 'ABC123',
        mode: 'REPLAN',
        selection: { kind: 'ABSOLUTE', closesAt: '2026-09-15T06:30:00.123Z' },
        expectedLifecycleRevision: 2,
        previewServerNow: '2026-09-15T07:00:00.000Z',
        confirmedQaClosesAt: '2026-09-15T06:30:00.123Z',
        confirmedExpiresAt: '2026-09-16T06:00:00.000Z',
        confirmSessionExtension: false,
        reopenQa: false,
        qaTitle: 'Nur Titel',
        moderationMode: false,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prismaMock.session.update).not.toHaveBeenCalled();
  });

  it('lehnt Wiederöffnen mit unveränderter abgelaufener Frist ab', async () => {
    const expired = qaConfigurationRow({
      qaEnabled: true,
      qaOpen: false,
      qaClosesAt: new Date('2026-09-15T06:30:00.123Z'),
      expiresAt: new Date('2026-09-16T06:00:00.000Z'),
      qaTitle: 'Alte Fragenwand',
      preferredChannel: 'qa',
    });
    prismaMock.session.findUnique.mockResolvedValue(expired);

    await expect(
      caller.previewQaConfiguration({
        code: 'ABC123',
        mode: 'REPLAN',
        reopenQa: true,
        selection: { kind: 'ABSOLUTE', closesAt: '2026-09-15T06:30:00.123Z' },
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    await expect(
      caller.configureQaChannel({
        code: 'ABC123',
        mode: 'REPLAN',
        selection: { kind: 'ABSOLUTE', closesAt: '2026-09-15T06:30:00.123Z' },
        expectedLifecycleRevision: 2,
        previewServerNow: '2026-09-15T07:00:00.000Z',
        confirmedQaClosesAt: '2026-09-15T06:30:00.123Z',
        confirmedExpiresAt: '2026-09-16T06:00:00.000Z',
        confirmSessionExtension: false,
        reopenQa: true,
        qaTitle: 'Alte Fragenwand',
        moderationMode: false,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(prismaMock.session.update).not.toHaveBeenCalled();
  });

  it('öffnet mit gültiger zukünftiger Frist und liefert OPEN', async () => {
    const expired = qaConfigurationRow({
      qaEnabled: true,
      qaOpen: false,
      qaClosesAt: new Date('2026-09-15T06:30:00.123Z'),
      expiresAt: new Date('2026-09-16T06:00:00.000Z'),
      qaTitle: 'Alte Fragenwand',
      preferredChannel: 'qa',
    });
    const reopenedAt = new Date('2026-09-16T04:00:00.000Z');
    prismaMock.session.findUnique.mockResolvedValue(expired);
    prismaMock.session.update.mockResolvedValue({
      ...expired,
      qaOpen: true,
      qaClosesAt: reopenedAt,
      sessionLifecycleRevision: 3,
    });

    await expect(
      caller.configureQaChannel({
        code: 'ABC123',
        mode: 'REPLAN',
        selection: { kind: 'ABSOLUTE', closesAt: '2026-09-16T04:00:00.000Z' },
        expectedLifecycleRevision: 2,
        previewServerNow: '2026-09-15T07:00:00.000Z',
        confirmedQaClosesAt: '2026-09-16T04:00:00.000Z',
        confirmedExpiresAt: '2026-09-16T06:00:00.000Z',
        confirmSessionExtension: false,
        reopenQa: true,
        qaTitle: 'Alte Fragenwand',
        moderationMode: false,
      }),
    ).resolves.toMatchObject({
      qaClosesAt: '2026-09-16T04:00:00.000Z',
      channels: expect.objectContaining({
        qa: expect.objectContaining({ open: true, state: 'OPEN' }),
      }),
    });
  });

  it('lehnt Wiederöffnen ab, wenn die Frist zwischen Vorschau und Bestätigung abläuft', async () => {
    const closingSoon = qaConfigurationRow({
      qaEnabled: true,
      qaOpen: false,
      qaClosesAt: new Date('2026-09-15T07:00:00.000Z'),
      expiresAt: new Date('2026-09-16T06:00:00.000Z'),
      preferredChannel: 'qa',
    });
    prismaMock.session.findUnique.mockResolvedValue(closingSoon);

    await expect(
      caller.configureQaChannel({
        code: 'ABC123',
        mode: 'REPLAN',
        selection: { kind: 'ABSOLUTE', closesAt: '2026-09-15T07:00:00.000Z' },
        expectedLifecycleRevision: 2,
        previewServerNow: '2026-09-15T06:59:00.000Z',
        confirmedQaClosesAt: '2026-09-15T07:00:00.000Z',
        confirmedExpiresAt: '2026-09-16T06:00:00.000Z',
        confirmSessionExtension: false,
        reopenQa: true,
        moderationMode: false,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(prismaMock.session.update).not.toHaveBeenCalled();
  });

  it('öffnet einen geschlossenen Kanal nur nach ausdrücklichem Wiederöffnen', async () => {
    const closed = qaConfigurationRow({
      qaEnabled: true,
      qaOpen: false,
      qaClosesAt: new Date('2026-09-16T04:00:00.000Z'),
      qaTitle: 'Alte Fragenwand',
      qaModerationMode: false,
      preferredChannel: 'qa',
    });
    prismaMock.session.findUnique.mockResolvedValue(closed);
    prismaMock.session.update.mockResolvedValue({
      ...closed,
      qaOpen: true,
      sessionLifecycleRevision: 3,
    });

    await caller.configureQaChannel({
      code: 'ABC123',
      mode: 'REPLAN',
      selection: { kind: 'ABSOLUTE', closesAt: '2026-09-16T04:00:00.000Z' },
      expectedLifecycleRevision: 2,
      previewServerNow: '2026-09-15T07:00:00.000Z',
      confirmedQaClosesAt: '2026-09-16T04:00:00.000Z',
      confirmedExpiresAt: '2026-09-16T06:00:00.000Z',
      confirmSessionExtension: false,
      reopenQa: true,
      qaTitle: 'Alte Fragenwand',
      moderationMode: false,
    });

    expect(prismaMock.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ qaOpen: true }),
      }),
    );
  });
});
