import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';

const { prismaMock, hostAuthMocks } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    quiz: {
      findUnique: vi.fn(),
    },
    team: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    participant: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    vote: {
      count: vi.fn(),
    },
    $transaction: vi.fn(),
    $executeRaw: vi.fn().mockResolvedValue(1),
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
const QUIZ_ID = '11111111-1111-4111-8111-111111111111';
const TEAM_A = '22222222-2222-4222-8222-222222222222';
const TEAM_B = '33333333-3333-4333-8333-333333333333';

describe('session.attachQuizToSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostAuthMocks.extractHostTokenMock.mockReturnValue('host-token-123');
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
    prismaMock.team.createMany.mockResolvedValue({ count: 2 });
    prismaMock.team.findMany.mockResolvedValue([
      { id: TEAM_A, name: 'Team A', color: '#1E88E5', _count: { participants: 0 } },
      { id: TEAM_B, name: 'Team B', color: '#43A047', _count: { participants: 0 } },
    ]);
    prismaMock.participant.findMany.mockResolvedValue([]);
    prismaMock.vote.count.mockResolvedValue(0);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      fn(prismaMock),
    );
  });

  trpcDodIt(
    {
      procedure: 'session.attachQuizToSession',
      case: 'happy',
      mode: 'direct',
      title: 'hängt ein Quiz an eine laufende Quiz-Session ohne Quiz an',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        type: 'QUIZ',
        status: 'LOBBY',
        currentQuestion: null,
        quizId: null,
        qaEnabled: true,
        qaOpen: true,
        qaTitle: 'Fragen',
        qaModerationMode: true,
        title: null,
        moderationMode: false,
        quickFeedbackEnabled: true,
        quickFeedbackOpen: true,
        onboardingProfileConfigured: true,
        onboardingAllowCustomNicknames: false,
        onboardingAnonymousMode: false,
        onboardingTeamMode: false,
        onboardingTeamCount: null,
        onboardingTeamAssignment: 'AUTO',
        onboardingTeamNames: [],
        onboardingNicknameTheme: 'HIGH_SCHOOL',
        firstParticipantJoinedAt: new Date('2026-09-15T08:00:00.000Z'),
        _count: { participants: 3 },
      });
      prismaMock.quiz.findUnique.mockResolvedValue({
        id: QUIZ_ID,
        nicknameTheme: 'KINDERGARTEN',
        allowCustomNicknames: true,
        anonymousMode: true,
        teamMode: false,
        teamCount: null,
        teamAssignment: 'AUTO',
        teamNames: [],
      });
      prismaMock.session.update.mockResolvedValue({
        id: SESSION_ID,
        type: 'QUIZ',
        quizId: QUIZ_ID,
        qaEnabled: true,
        qaOpen: true,
        qaTitle: 'Fragen',
        qaModerationMode: true,
        title: null,
        moderationMode: false,
        quickFeedbackEnabled: true,
        quickFeedbackOpen: true,
      });

      const result = await caller.attachQuizToSession({ code: 'abc123', quizId: QUIZ_ID });

      expect(prismaMock.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SESSION_ID },
          data: {
            type: 'QUIZ',
            quizId: QUIZ_ID,
            currentQuestion: null,
            currentRound: 1,
            answerDisplayOrder: Prisma.JsonNull,
            onboardingProfileConfigured: true,
            onboardingAllowCustomNicknames: false,
            onboardingAnonymousMode: false,
            onboardingTeamMode: false,
            onboardingTeamCount: null,
            onboardingTeamAssignment: 'AUTO',
            onboardingTeamNames: [],
            onboardingNicknameTheme: 'HIGH_SCHOOL',
          },
          select: expect.any(Object),
        }),
      );
      expect(result.quiz.enabled).toBe(true);
      expect(result.qa.enabled).toBe(true);
      expect(result.quickFeedback.enabled).toBe(true);
      expect(prismaMock.participant.update).not.toHaveBeenCalled();
    },
  );

  it('weist bestehende Teilnehmende bei AUTO-Teammodus nachträglich Teams zu', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      status: 'LOBBY',
      currentQuestion: null,
      quizId: null,
      qaEnabled: false,
      qaOpen: false,
      qaTitle: null,
      qaModerationMode: false,
      title: null,
      moderationMode: false,
      quickFeedbackEnabled: true,
      quickFeedbackOpen: true,
      onboardingProfileConfigured: true,
      onboardingAllowCustomNicknames: false,
      onboardingAnonymousMode: false,
      onboardingTeamMode: true,
      onboardingTeamCount: 2,
      onboardingTeamAssignment: 'AUTO',
      onboardingTeamNames: ['Rot', 'Blau'],
      onboardingNicknameTheme: 'HIGH_SCHOOL',
      firstParticipantJoinedAt: new Date('2026-09-15T08:00:00.000Z'),
      _count: { participants: 3 },
    });
    prismaMock.quiz.findUnique.mockResolvedValue({
      id: QUIZ_ID,
      nicknameTheme: 'HIGH_SCHOOL',
      allowCustomNicknames: false,
      anonymousMode: false,
      teamMode: true,
      teamCount: 2,
      teamAssignment: 'AUTO',
      teamNames: ['Rot', 'Blau'],
    });
    prismaMock.session.update.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      quizId: QUIZ_ID,
      qaEnabled: false,
      qaOpen: false,
      qaTitle: null,
      qaModerationMode: false,
      title: null,
      moderationMode: false,
      quickFeedbackEnabled: true,
      quickFeedbackOpen: true,
    });
    prismaMock.participant.findMany.mockResolvedValue([
      { id: 'p-1', teamId: null },
      { id: 'p-2', teamId: null },
      { id: 'p-3', teamId: null },
    ]);

    await caller.attachQuizToSession({ code: 'ABC123', quizId: QUIZ_ID });

    expect(prismaMock.participant.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'p-1' },
      data: { teamId: TEAM_A },
    });
    expect(prismaMock.participant.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'p-2' },
      data: { teamId: TEAM_B },
    });
    expect(prismaMock.participant.update).toHaveBeenNthCalledWith(3, {
      where: { id: 'p-3' },
      data: { teamId: TEAM_A },
    });
  });

  trpcDodIt(
    {
      procedure: 'session.attachQuizToSession',
      case: 'error',
      mode: 'direct',
      contract: 'BAD_REQUEST',
      title: 'lehnt Team-Quiz mit manueller Teamwahl ab, wenn bereits Teilnehmende verbunden sind',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: SESSION_ID,
        type: 'QUIZ',
        status: 'LOBBY',
        currentQuestion: null,
        quizId: null,
        qaEnabled: false,
        qaOpen: false,
        qaTitle: null,
        qaModerationMode: false,
        title: null,
        moderationMode: false,
        quickFeedbackEnabled: false,
        quickFeedbackOpen: false,
        onboardingProfileConfigured: false,
        onboardingAllowCustomNicknames: null,
        onboardingAnonymousMode: null,
        onboardingTeamMode: null,
        onboardingTeamCount: null,
        onboardingTeamAssignment: null,
        onboardingTeamNames: [],
        onboardingNicknameTheme: null,
        firstParticipantJoinedAt: new Date('2026-09-15T08:00:00.000Z'),
        _count: { participants: 2 },
      });
      prismaMock.quiz.findUnique.mockResolvedValue({
        id: QUIZ_ID,
        nicknameTheme: 'HIGH_SCHOOL',
        allowCustomNicknames: false,
        anonymousMode: false,
        teamMode: true,
        teamCount: 2,
        teamAssignment: 'MANUAL',
        teamNames: ['Rot', 'Blau'],
      });

      await expect(
        caller.attachQuizToSession({ code: 'ABC123', quizId: QUIZ_ID }),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: 'Dieses Quiz passt nicht zur Teamsituation der laufenden Session.',
      });

      expect(prismaMock.session.update).not.toHaveBeenCalled();
    },
  );

  it('konvertiert eine alte Q_AND_A-Session beim Anhängen in eine QUIZ-Session', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      type: 'Q_AND_A',
      status: 'ACTIVE',
      currentQuestion: null,
      quizId: null,
      qaEnabled: true,
      qaOpen: true,
      qaTitle: 'Fragen',
      qaModerationMode: true,
      title: 'Fragen',
      moderationMode: true,
      quickFeedbackEnabled: false,
      quickFeedbackOpen: false,
      onboardingProfileConfigured: false,
      onboardingAllowCustomNicknames: null,
      onboardingAnonymousMode: null,
      onboardingTeamMode: null,
      onboardingTeamCount: null,
      onboardingTeamAssignment: null,
      onboardingTeamNames: [],
      onboardingNicknameTheme: null,
      firstParticipantJoinedAt: null,
      _count: { participants: 0 },
    });
    prismaMock.quiz.findUnique.mockResolvedValue({
      id: QUIZ_ID,
      nicknameTheme: 'HIGH_SCHOOL',
      allowCustomNicknames: false,
      anonymousMode: false,
      teamMode: false,
      teamCount: null,
      teamAssignment: 'AUTO',
      teamNames: [],
    });
    prismaMock.session.update.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      quizId: QUIZ_ID,
      qaEnabled: true,
      qaOpen: true,
      qaTitle: 'Fragen',
      qaModerationMode: true,
      title: 'Fragen',
      moderationMode: true,
      quickFeedbackEnabled: false,
      quickFeedbackOpen: false,
    });

    const result = await caller.attachQuizToSession({ code: 'ABC123', quizId: QUIZ_ID });

    expect(prismaMock.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SESSION_ID },
        data: expect.objectContaining({ type: 'QUIZ', quizId: QUIZ_ID }),
      }),
    );
    expect(result.quiz.enabled).toBe(true);
    expect(result.qa.enabled).toBe(true);
  });

  it('lehnt Quizwechsel nach der ersten gestarteten Frage ab', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      status: 'LOBBY',
      currentQuestion: 0,
      quizId: '99999999-9999-4999-8999-999999999999',
      qaEnabled: true,
      qaOpen: true,
      qaTitle: 'Fragen',
      qaModerationMode: true,
      title: null,
      moderationMode: false,
      quickFeedbackEnabled: false,
      quickFeedbackOpen: false,
      onboardingProfileConfigured: true,
      onboardingAllowCustomNicknames: false,
      onboardingAnonymousMode: false,
      onboardingTeamMode: false,
      onboardingTeamCount: null,
      onboardingTeamAssignment: 'AUTO',
      onboardingTeamNames: [],
      onboardingNicknameTheme: 'HIGH_SCHOOL',
      firstParticipantJoinedAt: null,
      _count: { participants: 0 },
    });

    await expect(
      caller.attachQuizToSession({ code: 'ABC123', quizId: QUIZ_ID }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Das aktuelle Quiz kann nur vor der ersten gestarteten Frage gewechselt werden.',
    });

    expect(prismaMock.session.update).not.toHaveBeenCalled();
  });

  it('hängt das Showcase-Demo-Quiz vor dem ersten Join an eine teamlose Session an', async () => {
    const { DEMO_QUIZ_HISTORY_SCOPE_ID } = await import('@arsnova/shared-types');
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      status: 'LOBBY',
      currentQuestion: null,
      quizId: null,
      qaEnabled: true,
      qaOpen: true,
      qaTitle: 'Fragen',
      qaModerationMode: true,
      title: null,
      moderationMode: false,
      quickFeedbackEnabled: false,
      quickFeedbackOpen: false,
      onboardingProfileConfigured: true,
      onboardingAllowCustomNicknames: false,
      onboardingAnonymousMode: false,
      onboardingTeamMode: false,
      onboardingTeamCount: null,
      onboardingTeamAssignment: 'AUTO',
      onboardingTeamNames: [],
      onboardingNicknameTheme: 'HIGH_SCHOOL',
      firstParticipantJoinedAt: null,
      _count: { participants: 0 },
    });
    prismaMock.quiz.findUnique.mockResolvedValue({
      id: QUIZ_ID,
      historyScopeId: DEMO_QUIZ_HISTORY_SCOPE_ID,
      nicknameTheme: 'KINDERGARTEN',
      allowCustomNicknames: false,
      anonymousMode: false,
      teamMode: true,
      teamCount: 2,
      teamAssignment: 'AUTO',
      teamNames: ['Team 🍎', 'Team 🍐'],
    });
    prismaMock.team.findMany.mockResolvedValue([
      { id: TEAM_A, name: 'Team 🍎', color: '#1E88E5', _count: { participants: 0 } },
      { id: TEAM_B, name: 'Team 🍐', color: '#43A047', _count: { participants: 0 } },
    ]);
    prismaMock.participant.findMany.mockResolvedValue([]);
    prismaMock.session.update.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      quizId: QUIZ_ID,
      qaEnabled: true,
      qaOpen: true,
      qaTitle: 'Fragen',
      qaModerationMode: true,
      title: null,
      moderationMode: false,
      quickFeedbackEnabled: false,
      quickFeedbackOpen: false,
    });

    await caller.attachQuizToSession({ code: 'ABC123', quizId: QUIZ_ID });

    expect(prismaMock.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quizId: QUIZ_ID,
          onboardingTeamMode: true,
          onboardingTeamCount: 2,
          onboardingTeamNames: ['Team 🍎', 'Team 🍐'],
          onboardingNicknameTheme: 'HIGH_SCHOOL',
        }),
      }),
    );
    expect(prismaMock.participant.update).not.toHaveBeenCalled();
  });

  it('hängt das Showcase-Demo-Quiz nach dem ersten Join an eine gestartete Q&A-Session an', async () => {
    const { DEMO_QUIZ_HISTORY_SCOPE_ID } = await import('@arsnova/shared-types');
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      status: 'ACTIVE',
      currentQuestion: null,
      quizId: null,
      qaEnabled: true,
      qaOpen: true,
      qaTitle: 'Fragen',
      qaModerationMode: true,
      title: null,
      moderationMode: false,
      quickFeedbackEnabled: false,
      quickFeedbackOpen: false,
      onboardingProfileConfigured: true,
      onboardingAllowCustomNicknames: false,
      onboardingAnonymousMode: false,
      onboardingTeamMode: false,
      onboardingTeamCount: null,
      onboardingTeamAssignment: 'AUTO',
      onboardingTeamNames: [],
      onboardingNicknameTheme: 'HIGH_SCHOOL',
      firstParticipantJoinedAt: new Date('2026-09-19T05:50:00.000Z'),
      _count: { participants: 1 },
    });
    prismaMock.quiz.findUnique.mockResolvedValue({
      id: QUIZ_ID,
      historyScopeId: DEMO_QUIZ_HISTORY_SCOPE_ID,
      nicknameTheme: 'KINDERGARTEN',
      allowCustomNicknames: false,
      anonymousMode: false,
      teamMode: true,
      teamCount: 2,
      teamAssignment: 'AUTO',
      teamNames: ['Team 🍎', 'Team 🍐'],
    });
    prismaMock.team.findMany.mockResolvedValue([
      { id: TEAM_A, name: 'Team 🍎', color: '#1E88E5', _count: { participants: 0 } },
      { id: TEAM_B, name: 'Team 🍐', color: '#43A047', _count: { participants: 0 } },
    ]);
    prismaMock.participant.findMany.mockResolvedValue([{ id: 'p-1', teamId: null }]);
    prismaMock.session.update.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      quizId: QUIZ_ID,
      qaEnabled: true,
      qaOpen: true,
      qaTitle: 'Fragen',
      qaModerationMode: true,
      title: null,
      moderationMode: false,
      quickFeedbackEnabled: false,
      quickFeedbackOpen: false,
    });

    const result = await caller.attachQuizToSession({ code: '8AL3JF', quizId: QUIZ_ID });

    expect(prismaMock.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quizId: QUIZ_ID,
          onboardingTeamMode: true,
          onboardingTeamCount: 2,
          onboardingTeamNames: ['Team 🍎', 'Team 🍐'],
          onboardingNicknameTheme: 'HIGH_SCHOOL',
        }),
      }),
    );
    expect(prismaMock.participant.update).toHaveBeenCalledWith({
      where: { id: 'p-1' },
      data: { teamId: TEAM_A },
    });
    expect(result.quiz.enabled).toBe(true);
    expect(result.qa.enabled).toBe(true);
  });

  it('verträgt vor dem ersten Join eine konkurrierende Team-Anlage', async () => {
    const { DEMO_QUIZ_HISTORY_SCOPE_ID } = await import('@arsnova/shared-types');
    const { Prisma } = await import('@prisma/client');
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      status: 'LOBBY',
      currentQuestion: null,
      quizId: null,
      qaEnabled: true,
      qaOpen: true,
      qaTitle: 'Fragen',
      qaModerationMode: true,
      title: null,
      moderationMode: false,
      quickFeedbackEnabled: false,
      quickFeedbackOpen: false,
      onboardingProfileConfigured: true,
      onboardingAllowCustomNicknames: false,
      onboardingAnonymousMode: false,
      onboardingTeamMode: false,
      onboardingTeamCount: null,
      onboardingTeamAssignment: 'AUTO',
      onboardingTeamNames: [],
      onboardingNicknameTheme: 'HIGH_SCHOOL',
      firstParticipantJoinedAt: null,
      _count: { participants: 0 },
    });
    prismaMock.quiz.findUnique.mockResolvedValue({
      id: QUIZ_ID,
      historyScopeId: DEMO_QUIZ_HISTORY_SCOPE_ID,
      nicknameTheme: 'KINDERGARTEN',
      allowCustomNicknames: false,
      anonymousMode: false,
      teamMode: true,
      teamCount: 2,
      teamAssignment: 'AUTO',
      teamNames: ['Team 🍎', 'Team 🍐'],
    });
    prismaMock.team.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { id: TEAM_A, name: 'Team 🍎', color: '#1E88E5', _count: { participants: 0 } },
      { id: TEAM_B, name: 'Team 🍐', color: '#43A047', _count: { participants: 0 } },
    ]);
    prismaMock.team.createMany.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    prismaMock.participant.findMany.mockResolvedValue([]);
    prismaMock.session.update.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      quizId: QUIZ_ID,
      qaEnabled: true,
      qaOpen: true,
      qaTitle: 'Fragen',
      qaModerationMode: true,
      title: null,
      moderationMode: false,
      quickFeedbackEnabled: false,
      quickFeedbackOpen: false,
    });

    await caller.attachQuizToSession({ code: 'ABC123', quizId: QUIZ_ID });

    expect(prismaMock.team.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
    expect(prismaMock.participant.update).not.toHaveBeenCalled();
  });

  it('lehnt ein gewöhnliches Team-Quiz an teamlosen Sessions mit Teilnehmenden weiter ab', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      status: 'LOBBY',
      currentQuestion: null,
      quizId: null,
      qaEnabled: true,
      qaOpen: true,
      qaTitle: 'Fragen',
      qaModerationMode: true,
      title: null,
      moderationMode: false,
      quickFeedbackEnabled: false,
      quickFeedbackOpen: false,
      onboardingProfileConfigured: true,
      onboardingAllowCustomNicknames: false,
      onboardingAnonymousMode: false,
      onboardingTeamMode: false,
      onboardingTeamCount: null,
      onboardingTeamAssignment: 'AUTO',
      onboardingTeamNames: [],
      onboardingNicknameTheme: 'HIGH_SCHOOL',
      firstParticipantJoinedAt: new Date('2026-09-15T08:00:00.000Z'),
      _count: { participants: 2 },
    });
    prismaMock.quiz.findUnique.mockResolvedValue({
      id: QUIZ_ID,
      historyScopeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      nicknameTheme: 'KINDERGARTEN',
      allowCustomNicknames: false,
      anonymousMode: false,
      teamMode: true,
      teamCount: 2,
      teamAssignment: 'AUTO',
      teamNames: ['Team 🍎', 'Team 🍐'],
    });

    await expect(
      caller.attachQuizToSession({ code: 'ABC123', quizId: QUIZ_ID }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Dieses Quiz passt nicht zur Teamsituation der laufenden Session.',
    });
    expect(prismaMock.session.update).not.toHaveBeenCalled();
  });

  it('hängt nach Quiz-FINISHED ein neues Quiz an, solange Q&A offen ist', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      status: 'FINISHED',
      currentQuestion: null,
      quizId: 'old-quiz',
      qaEnabled: true,
      qaOpen: true,
      qaClosesAt: new Date('2099-01-01T00:00:00.000Z'),
      endedAt: new Date('2026-09-19T06:00:00.000Z'),
      expiresAt: new Date('2099-01-02T00:00:00.000Z'),
      qaTitle: 'Fragen',
      qaModerationMode: true,
      title: null,
      moderationMode: false,
      quickFeedbackEnabled: false,
      quickFeedbackOpen: false,
      onboardingProfileConfigured: true,
      onboardingAllowCustomNicknames: false,
      onboardingAnonymousMode: false,
      onboardingTeamMode: false,
      onboardingTeamCount: null,
      onboardingTeamAssignment: 'AUTO',
      onboardingTeamNames: [],
      onboardingNicknameTheme: 'HIGH_SCHOOL',
      firstParticipantJoinedAt: new Date('2026-09-15T08:00:00.000Z'),
      _count: { participants: 4 },
    });
    prismaMock.vote.count.mockResolvedValue(12);
    prismaMock.quiz.findUnique.mockResolvedValue({
      id: QUIZ_ID,
      nicknameTheme: 'HIGH_SCHOOL',
      allowCustomNicknames: false,
      anonymousMode: false,
      teamMode: false,
      teamCount: null,
      teamAssignment: 'AUTO',
      teamNames: [],
    });
    prismaMock.session.update.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      quizId: QUIZ_ID,
      qaEnabled: true,
      qaOpen: true,
      qaTitle: 'Fragen',
      qaModerationMode: true,
      title: null,
      moderationMode: false,
      quickFeedbackEnabled: false,
      quickFeedbackOpen: false,
    });

    const result = await caller.attachQuizToSession({ code: 'ABC123', quizId: QUIZ_ID });

    expect(prismaMock.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quizId: QUIZ_ID,
          status: 'LOBBY',
          endedAt: null,
          quizStarted: false,
        }),
      }),
    );
    expect(result.quiz.enabled).toBe(true);
  });

  it('wechselt das Quiz in der wiedereröffneten Lobby trotz vorhandener Stimmen', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      status: 'LOBBY',
      currentQuestion: null,
      quizId: 'old-quiz',
      qaEnabled: true,
      qaOpen: true,
      qaClosesAt: new Date('2099-01-01T00:00:00.000Z'),
      endedAt: null,
      expiresAt: new Date('2099-01-02T00:00:00.000Z'),
      qaTitle: 'Fragen',
      qaModerationMode: true,
      title: null,
      moderationMode: false,
      quickFeedbackEnabled: true,
      quickFeedbackOpen: true,
      onboardingProfileConfigured: true,
      onboardingAllowCustomNicknames: false,
      onboardingAnonymousMode: false,
      onboardingTeamMode: false,
      onboardingTeamCount: null,
      onboardingTeamAssignment: 'AUTO',
      onboardingTeamNames: [],
      onboardingNicknameTheme: 'HIGH_SCHOOL',
      firstParticipantJoinedAt: new Date('2026-09-15T08:00:00.000Z'),
      _count: { participants: 4 },
    });
    prismaMock.vote.count.mockResolvedValue(12);
    prismaMock.quiz.findUnique.mockResolvedValue({
      id: QUIZ_ID,
      nicknameTheme: 'HIGH_SCHOOL',
      allowCustomNicknames: false,
      anonymousMode: false,
      teamMode: false,
      teamCount: null,
      teamAssignment: 'AUTO',
      teamNames: [],
    });
    prismaMock.session.update.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      quizId: QUIZ_ID,
      qaEnabled: true,
      qaOpen: true,
      qaTitle: 'Fragen',
      qaModerationMode: true,
      title: null,
      moderationMode: false,
      quickFeedbackEnabled: true,
      quickFeedbackOpen: true,
    });

    await caller.attachQuizToSession({ code: 'ABC123', quizId: QUIZ_ID });

    expect(prismaMock.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quizId: QUIZ_ID,
          currentQuestion: null,
        }),
      }),
    );
  });

  it('lehnt Attach nach Quiz-FINISHED ab, wenn Q&A geschlossen ist', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      type: 'QUIZ',
      status: 'FINISHED',
      currentQuestion: null,
      quizId: 'old-quiz',
      qaEnabled: true,
      qaOpen: false,
      qaClosesAt: new Date('2026-09-19T06:00:00.000Z'),
      endedAt: new Date('2026-09-19T06:00:00.000Z'),
      expiresAt: new Date('2099-01-02T00:00:00.000Z'),
      firstParticipantJoinedAt: new Date('2026-09-15T08:00:00.000Z'),
      _count: { participants: 4 },
    });

    await expect(
      caller.attachQuizToSession({ code: 'ABC123', quizId: QUIZ_ID }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Beendete Sessions können nicht mehr verändert werden.',
    });
    expect(prismaMock.session.update).not.toHaveBeenCalled();
  });
});
