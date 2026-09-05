import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';
import { TRPCError } from '@trpc/server';

const SESSION_ID = '6a8edced-5f8f-4cfa-9176-454fac9570ad';
const PARTICIPANT_ID = '11111111-1111-4111-8111-111111111111';
const TEAM_ID = '22222222-2222-4222-8222-222222222222';
const CLIENT_ID = '33333333-3333-4333-8333-333333333333';

const {
  prismaMock,
  rateLimitMocks,
  invalidSessionCodeMocks,
  statsMocks,
  presenceMocks,
  joinAdmissionMocks,
} = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
    },
    participant: {
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    team: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
    $executeRaw: vi.fn().mockResolvedValue(1),
  },
  rateLimitMocks: {
    checkSessionCreateRate: vi.fn(),
  },
  invalidSessionCodeMocks: {
    rejectInvalidSessionCode: vi.fn(),
  },
  statsMocks: {
    updateMaxParticipantsSingleSession: vi.fn(),
    updateDailyMaxParticipants: vi.fn(),
  },
  presenceMocks: {
    touchParticipantPresence: vi.fn(),
  },
  joinAdmissionMocks: {
    awaitJoinAdmissionSlot: vi.fn(),
  },
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/rateLimit', () => ({
  checkSessionCreateRate: rateLimitMocks.checkSessionCreateRate,
}));

vi.mock('../lib/invalidSessionCode', () => ({
  rejectInvalidSessionCode: invalidSessionCodeMocks.rejectInvalidSessionCode,
}));

vi.mock('../lib/abuseTelemetry', () => ({
  logRateLimitRejection: vi.fn(),
  recordRateLimitRejection: vi.fn(),
  recordSessionCreateCompleted: vi.fn(),
}));

vi.mock('../lib/platformStatistic', () => ({
  updateMaxParticipantsSingleSession: statsMocks.updateMaxParticipantsSingleSession,
  updateDailyMaxParticipants: statsMocks.updateDailyMaxParticipants,
}));

vi.mock('../lib/presence', () => ({
  touchParticipantPresence: presenceMocks.touchParticipantPresence,
}));

vi.mock('../lib/joinAdmission', () => ({
  awaitJoinAdmissionSlot: joinAdmissionMocks.awaitJoinAdmissionSlot,
}));

import { sessionRouter } from '../routers/session';

const caller = sessionRouter.createCaller({ req: undefined });
const sameIpCaller = sessionRouter.createCaller({
  req: { socket: { remoteAddress: '203.0.113.50' } } as never,
});

function buildSession() {
  return {
    id: SESSION_ID,
    code: 'ABC123',
    type: 'QUIZ',
    status: 'LOBBY',
    title: null,
    quizId: '33333333-3333-4333-8333-333333333333',
    qaEnabled: false,
    qaOpen: false,
    qaTitle: null,
    qaModerationMode: false,
    quickFeedbackEnabled: false,
    quickFeedbackOpen: false,
    onboardingProfileConfigured: false,
    onboardingNicknameTheme: null,
    onboardingAllowCustomNicknames: null,
    onboardingAnonymousMode: null,
    onboardingTeamMode: null,
    onboardingTeamCount: null,
    onboardingTeamAssignment: null,
    onboardingTeamNames: null,
    quiz: {
      name: 'Test-Quiz',
      nicknameTheme: 'HIGH_SCHOOL',
      allowCustomNicknames: false,
      anonymousMode: false,
      teamMode: false,
      teamCount: null,
      teamAssignment: 'AUTO',
      teamNames: [],
      motifImageUrl: null,
      motifImageCredit: null,
    },
    _count: { participants: 3 },
  };
}

describe('session.join', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidSessionCodeMocks.rejectInvalidSessionCode.mockRejectedValue(
      new TRPCError({
        code: 'NOT_FOUND',
        message: 'Session nicht gefunden.',
      }),
    );
    joinAdmissionMocks.awaitJoinAdmissionSlot.mockResolvedValue({ delayedMs: 0, attempts: 1 });
    prismaMock.session.findUnique.mockResolvedValue(buildSession());
    prismaMock.participant.count.mockResolvedValue(3);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      fn(prismaMock),
    );
  });

  it('verwendet einen bestehenden Teilnehmer per rejoinToken erneut', async () => {
    prismaMock.participant.findFirst.mockResolvedValue({
      id: PARTICIPANT_ID,
      teamId: TEAM_ID,
      team: { name: 'Team A' },
      timerAccommodation: 'DEFAULT',
    });

    const result = await caller.join({
      code: 'abc123',
      nickname: 'Ada',
      anonymousClientId: CLIENT_ID,
      rejoinToken: PARTICIPANT_ID,
    });

    expect(prismaMock.participant.findFirst).toHaveBeenCalledWith({
      where: {
        id: PARTICIPANT_ID,
        sessionId: SESSION_ID,
      },
      select: {
        id: true,
        teamId: true,
        timerAccommodation: true,
        team: {
          select: {
            name: true,
          },
        },
      },
    });
    expect(prismaMock.participant.create).not.toHaveBeenCalled();
    expect(joinAdmissionMocks.awaitJoinAdmissionSlot).not.toHaveBeenCalled();
    expect(result.participantId).toBe(PARTICIPANT_ID);
    expect(result.rejoinToken).toBe(PARTICIPANT_ID);
    expect(result.teamId).toBe(TEAM_ID);
    expect(result.teamName).toBe('Team A');
    expect(presenceMocks.touchParticipantPresence).toHaveBeenCalledWith(SESSION_ID, PARTICIPANT_ID);
  });

  trpcDodIt(
    {
      procedure: 'session.join',
      case: 'happy',
      mode: 'direct',
      title: 'legt ohne rejoinToken einen neuen Teilnehmer an und gibt dessen Token zurück',
    },
    async () => {
      prismaMock.participant.create.mockResolvedValue({
        id: PARTICIPANT_ID,
      });
      prismaMock.participant.count.mockResolvedValue(4);

      const result = await caller.join({
        code: 'ABC123',
        nickname: '  Ada Lovelace  ',
        anonymousClientId: CLIENT_ID,
      });

      expect(prismaMock.participant.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.participant.create).toHaveBeenCalledWith({
        data: {
          sessionId: SESSION_ID,
          nickname: 'Ada Lovelace',
          teamId: undefined,
        },
      });
      expect(joinAdmissionMocks.awaitJoinAdmissionSlot).toHaveBeenCalledWith(SESSION_ID);
      expect(result.participantId).toBe(PARTICIPANT_ID);
      expect(result.rejoinToken).toBe(PARTICIPANT_ID);
      expect(result.participantCount).toBe(4);
      expect(statsMocks.updateMaxParticipantsSingleSession).toHaveBeenCalledWith(4);
      expect(statsMocks.updateDailyMaxParticipants).toHaveBeenCalledWith(4);
    },
  );

  it('weist nach Create ein AUTO-Team zu, wenn Attach parallel Teams aktiviert hat', async () => {
    const TEAM_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const TEAM_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    prismaMock.participant.create.mockResolvedValue({
      id: PARTICIPANT_ID,
    });
    prismaMock.participant.count.mockResolvedValue(1);
    prismaMock.session.findUnique.mockResolvedValueOnce(buildSession()).mockResolvedValueOnce({
      ...buildSession(),
      onboardingProfileConfigured: true,
      onboardingTeamMode: true,
      onboardingTeamCount: 2,
      onboardingTeamAssignment: 'AUTO',
      onboardingTeamNames: ['Team 🍎', 'Team 🍐'],
      onboardingNicknameTheme: 'HIGH_SCHOOL',
      quiz: {
        ...buildSession().quiz,
        teamMode: true,
        teamCount: 2,
        teamAssignment: 'AUTO',
        teamNames: ['Team 🍎', 'Team 🍐'],
      },
      _count: { participants: 1 },
    });
    prismaMock.team.findMany.mockResolvedValue([
      { id: TEAM_A, name: 'Team 🍎', color: '#1E88E5', _count: { participants: 0 } },
      { id: TEAM_B, name: 'Team 🍐', color: '#43A047', _count: { participants: 0 } },
    ]);

    const result = await caller.join({
      code: 'ABC123',
      nickname: 'Late Joiner',
      anonymousClientId: CLIENT_ID,
    });

    expect(prismaMock.participant.create).toHaveBeenCalledWith({
      data: {
        sessionId: SESSION_ID,
        nickname: 'Late Joiner',
        teamId: undefined,
      },
    });
    expect(prismaMock.participant.update).toHaveBeenCalledWith({
      where: { id: PARTICIPANT_ID },
      data: { teamId: TEAM_A },
    });
    expect(result.teamId).toBe(TEAM_A);
    expect(result.teamName).toBe('Team 🍎');
    expect(result.teamMode).toBe(true);
  });

  it('lässt Rejoins auch bei ausgefallenem oder ausgeschöpftem Globalbudget unverzögert', async () => {
    invalidSessionCodeMocks.rejectInvalidSessionCode.mockRejectedValue(
      new Error('global budget unavailable'),
    );
    prismaMock.participant.findFirst.mockResolvedValue({
      id: PARTICIPANT_ID,
      teamId: null,
      team: null,
      timerAccommodation: 'DEFAULT',
    });

    await caller.join({
      code: 'ABC123',
      nickname: 'Ada',
      anonymousClientId: CLIENT_ID,
      rejoinToken: PARTICIPANT_ID,
    });

    expect(invalidSessionCodeMocks.rejectInvalidSessionCode).not.toHaveBeenCalled();
    expect(joinAdmissionMocks.awaitJoinAdmissionSlot).not.toHaveBeenCalled();
  });

  it('wendet den Client-Cap ausschließlich auf nicht existente Codes an', async () => {
    prismaMock.session.findUnique.mockResolvedValue(null);
    invalidSessionCodeMocks.rejectInvalidSessionCode.mockRejectedValue(
      new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Zu viele Fehlversuche.',
      }),
    );

    await expect(
      caller.join({
        code: 'ZZZ999',
        nickname: 'Ada',
        anonymousClientId: CLIENT_ID,
      }),
    ).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });

    expect(invalidSessionCodeMocks.rejectInvalidSessionCode).toHaveBeenCalledWith(
      CLIENT_ID,
      'ZZZ999',
      'join',
    );
  });

  it('akzeptiert gecachte Legacy-Clients ohne anonymousClientId mit Code-/Globalbudget', async () => {
    prismaMock.session.findUnique.mockResolvedValue(null);

    await expect(
      caller.join({
        code: 'ZZZ999',
        nickname: 'Ada',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    expect(invalidSessionCodeMocks.rejectInvalidSessionCode).toHaveBeenCalledWith(
      undefined,
      'ZZZ999',
      'join',
    );
  });

  trpcDodIt(
    {
      procedure: 'session.join',
      case: 'error',
      mode: 'direct',
      contract: 'NOT_FOUND',
      title: 'delegiert ungültige Codes an den zentralen Fehlerpfad',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue(null);

      await expect(
        caller.join({
          code: 'ZZZ999',
          nickname: 'Ada',
          anonymousClientId: CLIENT_ID,
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });

      expect(invalidSessionCodeMocks.rejectInvalidSessionCode).toHaveBeenCalledWith(
        CLIENT_ID,
        'ZZZ999',
        'join',
      );
    },
  );

  it('lässt 500 gültige Join-Inputs aus demselben Netz ohne Fehlbudget durch', async () => {
    prismaMock.participant.create.mockResolvedValue({ id: PARTICIPANT_ID });
    prismaMock.participant.count.mockResolvedValue(500);

    await Promise.all(
      Array.from({ length: 500 }, (_, index) =>
        sameIpCaller.join({
          code: 'ABC123',
          nickname: `TN ${index}`.slice(0, 30),
          anonymousClientId: `${String(index).padStart(8, '0')}-0000-4000-8000-000000000000`,
        }),
      ),
    );

    expect(invalidSessionCodeMocks.rejectInvalidSessionCode).not.toHaveBeenCalled();
    expect(prismaMock.participant.create).toHaveBeenCalledTimes(500);
  });
});
