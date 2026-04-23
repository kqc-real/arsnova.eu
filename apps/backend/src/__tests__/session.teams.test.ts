import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, isSessionCodeLockedOutMock, recordFailedSessionCodeAttemptMock } = vi.hoisted(
  () => ({
    prismaMock: {
      session: {
        findUnique: vi.fn(),
      },
      team: {
        findMany: vi.fn(),
        createMany: vi.fn(),
      },
      participant: {
        create: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
      },
      vote: {
        findMany: vi.fn(),
      },
      $executeRaw: vi.fn().mockResolvedValue(1),
    },
    isSessionCodeLockedOutMock: vi.fn(),
    recordFailedSessionCodeAttemptMock: vi.fn(),
  }),
);

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/rateLimit', () => ({
  isSessionCodeLockedOut: isSessionCodeLockedOutMock,
  recordFailedSessionCodeAttempt: recordFailedSessionCodeAttemptMock,
  checkSessionCreateRate: vi.fn(),
}));

import { sessionRouter } from '../routers/session';

const caller = sessionRouter.createCaller({ req: undefined });
const SESSION_ID = '6a8edced-5f8f-4cfa-9176-454fac9570ad';
const TEAM_A_ID = '11111111-1111-4111-8111-111111111111';
const TEAM_B_ID = '22222222-2222-4222-8222-222222222222';
const PARTICIPANT_ID = '33333333-3333-4333-8333-333333333333';

describe('session team mode (Story 7.1)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    isSessionCodeLockedOutMock.mockResolvedValue({ locked: false, retryAfterSeconds: 0 });
    recordFailedSessionCodeAttemptMock.mockResolvedValue({ locked: false, retryAfterSeconds: 0 });
    prismaMock.$executeRaw.mockResolvedValue(1);
  });

  it('liefert Teams einer Session und initialisiert konfigurierte Team-Namen bei Bedarf', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      quiz: { teamMode: true, teamCount: 2, teamNames: ['Rot', 'Blau'] },
    });
    prismaMock.team.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { id: TEAM_A_ID, name: 'Rot', color: '#1E88E5', _count: { participants: 0 } },
      { id: TEAM_B_ID, name: 'Blau', color: '#43A047', _count: { participants: 0 } },
    ]);
    prismaMock.team.createMany.mockResolvedValue({ count: 2 });

    const result = await caller.getTeams({ code: 'ABC123' });

    expect(result.teamCount).toBe(2);
    expect(result.teams.map((team) => team.name)).toEqual(['Rot', 'Blau']);
    expect(prismaMock.team.createMany).toHaveBeenCalledWith({
      data: [
        { sessionId: SESSION_ID, name: 'Rot', color: '#1E88E5' },
        { sessionId: SESSION_ID, name: 'Blau', color: '#43A047' },
      ],
    });
  });

  it('liefert Teams auch für quizlose Sessions mit gespeichertem Onboarding-Profil', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      onboardingProfileConfigured: true,
      onboardingAllowCustomNicknames: false,
      onboardingAnonymousMode: false,
      onboardingTeamMode: true,
      onboardingTeamCount: 2,
      onboardingTeamAssignment: 'MANUAL',
      onboardingTeamNames: ['Rot', 'Blau'],
      onboardingNicknameTheme: 'HIGH_SCHOOL',
    });
    prismaMock.team.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { id: TEAM_A_ID, name: 'Rot', color: '#1E88E5', _count: { participants: 0 } },
      { id: TEAM_B_ID, name: 'Blau', color: '#43A047', _count: { participants: 0 } },
    ]);
    prismaMock.team.createMany.mockResolvedValue({ count: 2 });

    const result = await caller.getTeams({ code: 'ABC123' });

    expect(result.teamCount).toBe(2);
    expect(result.teams.map((team) => team.name)).toEqual(['Rot', 'Blau']);
  });

  it('weist beim AUTO-Join Round-Robin zu (1.→A, 2.→B, 3.→A, …)', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      title: null,
      quiz: {
        name: 'Quiz',
        teamMode: true,
        teamCount: 2,
        teamAssignment: 'AUTO',
        teamNames: [],
      },
      _count: { participants: 2 },
    });
    prismaMock.team.findMany.mockResolvedValue([
      { id: TEAM_A_ID, name: 'Team A', color: '#1E88E5', _count: { participants: 2 } },
      { id: TEAM_B_ID, name: 'Team B', color: '#43A047', _count: { participants: 1 } },
    ]);
    prismaMock.participant.create.mockResolvedValue({ id: PARTICIPANT_ID });
    prismaMock.participant.count.mockResolvedValue(3);

    const result = await caller.join({ code: 'ABC123', nickname: 'Ada', teamId: undefined });

    expect(prismaMock.participant.count).toHaveBeenCalledWith({
      where: { sessionId: SESSION_ID },
    });
    expect(prismaMock.$executeRaw).toHaveBeenCalled();
    expect(prismaMock.participant.create).toHaveBeenCalledWith({
      data: {
        sessionId: SESSION_ID,
        nickname: 'Ada',
        teamId: TEAM_A_ID,
      },
    });
    expect(result.teamId).toBe(TEAM_A_ID);
    expect(result.teamName).toBe('Team A');
  });

  it('übernimmt beim MANUAL-Join das gewählte Team', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      title: null,
      quiz: {
        name: 'Quiz',
        teamMode: true,
        teamCount: 2,
        teamAssignment: 'MANUAL',
        teamNames: [],
      },
      _count: { participants: 0 },
    });
    prismaMock.team.findMany.mockResolvedValue([
      { id: TEAM_A_ID, name: 'Team A', color: '#1E88E5', _count: { participants: 0 } },
      { id: TEAM_B_ID, name: 'Team B', color: '#43A047', _count: { participants: 0 } },
    ]);
    prismaMock.participant.create.mockResolvedValue({ id: PARTICIPANT_ID });
    prismaMock.participant.count.mockResolvedValue(1);

    const result = await caller.join({ code: 'ABC123', nickname: 'Ada', teamId: TEAM_A_ID });

    expect(prismaMock.participant.count).toHaveBeenCalledWith({
      where: { sessionId: SESSION_ID },
    });
    expect(prismaMock.$executeRaw).toHaveBeenCalled();
    expect(prismaMock.participant.create).toHaveBeenCalledWith({
      data: {
        sessionId: SESSION_ID,
        nickname: 'Ada',
        teamId: TEAM_A_ID,
      },
    });
    expect(result.teamId).toBe(TEAM_A_ID);
    expect(result.teamName).toBe('Team A');
  });

  it('rundet harmonisierte Team-Scores auf volle Hunderter ohne Nachkommastellen', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      quiz: { teamMode: true, teamCount: 2, teamNames: [] },
    });
    prismaMock.team.findMany.mockResolvedValue([
      { id: TEAM_A_ID, name: 'Team A', color: '#1E88E5', _count: { participants: 2 } },
      { id: TEAM_B_ID, name: 'Team B', color: '#43A047', _count: { participants: 1 } },
    ]);
    prismaMock.participant.findMany.mockResolvedValue([
      { id: 'p1', teamId: TEAM_A_ID },
      { id: 'p2', teamId: TEAM_A_ID },
      { id: 'p3', teamId: TEAM_B_ID },
    ]);
    prismaMock.vote.findMany.mockResolvedValue([
      { participantId: 'p1', score: 2800 },
      { participantId: 'p2', score: 2735.34 },
      { participantId: 'p3', score: 2500 },
    ]);

    const result = await caller.getTeamLeaderboard({ code: 'ABC123' });

    expect(result).toEqual([
      {
        rank: 1,
        teamName: 'Team A',
        teamColor: '#1E88E5',
        totalScore: 2800,
        memberCount: 2,
        averageScore: 2800,
      },
      {
        rank: 2,
        teamName: 'Team B',
        teamColor: '#43A047',
        totalScore: 2500,
        memberCount: 1,
        averageScore: 2500,
      },
    ]);
  });
});
