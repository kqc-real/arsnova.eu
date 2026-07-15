import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  prismaMock,
  isSessionCodeLockedOutMock,
  recordFailedSessionCodeAttemptMock,
  hostAuthMocks,
  joinAdmissionMocks,
} = vi.hoisted(() => ({
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
    qaQuestion: {
      findMany: vi.fn(),
    },
    $executeRaw: vi.fn().mockResolvedValue(1),
  },
  isSessionCodeLockedOutMock: vi.fn(),
  recordFailedSessionCodeAttemptMock: vi.fn(),
  hostAuthMocks: {
    extractHostTokenMock: vi.fn(),
    extractHostTokenFromConnectionParamsMock: vi.fn(() => null as string | null),
    isHostSessionTokenValidMock: vi.fn(),
  },
  joinAdmissionMocks: {
    awaitJoinAdmissionSlot: vi.fn(),
  },
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/rateLimit', () => ({
  isSessionCodeLockedOut: isSessionCodeLockedOutMock,
  recordFailedSessionCodeAttempt: recordFailedSessionCodeAttemptMock,
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

vi.mock('../lib/joinAdmission', () => ({
  awaitJoinAdmissionSlot: joinAdmissionMocks.awaitJoinAdmissionSlot,
}));

import { sessionRouter } from '../routers/session';

const caller = sessionRouter.createCaller({ req: undefined });
const hostCaller = sessionRouter.createCaller({ req: {} as never });
const SESSION_ID = '6a8edced-5f8f-4cfa-9176-454fac9570ad';
const TEAM_A_ID = '11111111-1111-4111-8111-111111111111';
const TEAM_B_ID = '22222222-2222-4222-8222-222222222222';
const PARTICIPANT_ID = '33333333-3333-4333-8333-333333333333';

describe('session team mode (Story 7.1)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    isSessionCodeLockedOutMock.mockResolvedValue({ locked: false, retryAfterSeconds: 0 });
    recordFailedSessionCodeAttemptMock.mockResolvedValue({ locked: false, retryAfterSeconds: 0 });
    joinAdmissionMocks.awaitJoinAdmissionSlot.mockResolvedValue({ delayedMs: 0, attempts: 1 });
    hostAuthMocks.extractHostTokenMock.mockReturnValue('host-token-123');
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
    prismaMock.$executeRaw.mockResolvedValue(1);
    prismaMock.qaQuestion.findMany.mockResolvedValue([]);
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
    expect(joinAdmissionMocks.awaitJoinAdmissionSlot).toHaveBeenCalledWith(SESSION_ID);
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
    expect(joinAdmissionMocks.awaitJoinAdmissionSlot).toHaveBeenCalledWith(SESSION_ID);
    expect(result.teamId).toBe(TEAM_A_ID);
    expect(result.teamName).toBe('Team A');
  });

  it('liefert harmonisierte Team-Scores als sichtbaren Durchschnitt auch fuer groessere Teams', async () => {
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
      { participantId: 'p1', questionId: 'q1', round: 1, score: 2800 },
      { participantId: 'p2', questionId: 'q1', round: 1, score: 2735.34 },
      { participantId: 'p3', questionId: 'q1', round: 1, score: 2500 },
    ]);

    const result = await caller.getTeamLeaderboard({ code: 'ABC123' });

    expect(result).toEqual([
      {
        rank: 1,
        teamName: 'Team A',
        teamColor: '#1E88E5',
        totalScore: 2767.7,
        memberCount: 2,
        averageScore: 2767.7,
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

  it('nutzt Antwortzeiten nur von beitragenden Team-Votes als Gleichstand-Tiebreaker', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      quiz: { teamMode: true, teamCount: 2, teamNames: [] },
    });
    prismaMock.team.findMany.mockResolvedValue([
      { id: TEAM_A_ID, name: 'Zeta', color: '#1E88E5', _count: { participants: 1 } },
      { id: TEAM_B_ID, name: 'Alpha', color: '#43A047', _count: { participants: 1 } },
    ]);
    prismaMock.participant.findMany.mockResolvedValue([
      { id: 'p1', teamId: TEAM_A_ID },
      { id: 'p2', teamId: TEAM_B_ID },
    ]);
    prismaMock.vote.findMany.mockResolvedValue([
      { participantId: 'p1', questionId: 'q1', round: 1, score: 1000, responseTimeMs: 6000 },
      { participantId: 'p1', questionId: 'q2', round: 1, score: 0, responseTimeMs: 120_000 },
      { participantId: 'p2', questionId: 'q1', round: 1, score: 1000, responseTimeMs: 7000 },
    ]);

    const result = await caller.getTeamLeaderboard({ code: 'ABC123' });

    expect(result).toEqual([
      {
        rank: 1,
        teamName: 'Zeta',
        teamColor: '#1E88E5',
        totalScore: 1000,
        memberCount: 1,
        averageScore: 1000,
      },
      {
        rank: 2,
        teamName: 'Alpha',
        teamColor: '#43A047',
        totalScore: 1000,
        memberCount: 1,
        averageScore: 1000,
      },
    ]);
  });

  it('wertet Runde 2 im Team-Leaderboard ohne Antwortzeit-Tiebreaker', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      quiz: { teamMode: true, teamCount: 2, teamNames: [] },
    });
    prismaMock.team.findMany.mockResolvedValue([
      { id: TEAM_A_ID, name: 'Zeta', color: '#1E88E5', _count: { participants: 1 } },
      { id: TEAM_B_ID, name: 'Alpha', color: '#43A047', _count: { participants: 1 } },
    ]);
    prismaMock.participant.findMany.mockResolvedValue([
      { id: 'p1', teamId: TEAM_A_ID },
      { id: 'p2', teamId: TEAM_B_ID },
    ]);
    prismaMock.vote.findMany.mockResolvedValue([
      { participantId: 'p1', questionId: 'q1', round: 1, score: 1000, responseTimeMs: 5000 },
      { participantId: 'p2', questionId: 'q1', round: 1, score: 1000, responseTimeMs: 6000 },
      { participantId: 'p1', questionId: 'q2', round: 1, score: 0, responseTimeMs: 100 },
      { participantId: 'p2', questionId: 'q2', round: 1, score: 1900, responseTimeMs: 100 },
      { participantId: 'p1', questionId: 'q2', round: 2, score: 2000, responseTimeMs: 120_000 },
      { participantId: 'p2', questionId: 'q2', round: 2, score: 2000, responseTimeMs: 500 },
    ]);

    const result = await caller.getTeamLeaderboard({ code: 'ABC123' });

    expect(result).toEqual([
      {
        rank: 1,
        teamName: 'Zeta',
        teamColor: '#1E88E5',
        totalScore: 3000,
        memberCount: 1,
        averageScore: 3000,
      },
      {
        rank: 2,
        teamName: 'Alpha',
        teamColor: '#43A047',
        totalScore: 3000,
        memberCount: 1,
        averageScore: 3000,
      },
    ]);
  });

  it('liefert Team-Wertung auch im Session-Export nach Sessionende', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: 'ABC123',
      status: 'FINISHED',
      type: 'QUIZ',
      endedAt: new Date('2026-04-23T08:00:00.000Z'),
      quiz: {
        name: 'Team-Quiz',
        teamMode: true,
        teamCount: 2,
        teamNames: ['Rot', 'Blau'],
        questions: [],
      },
      votes: [],
      bonusTokens: [],
      participants: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
    });
    prismaMock.team.findMany.mockResolvedValue([
      { id: TEAM_A_ID, name: 'Rot', color: '#1E88E5', _count: { participants: 2 } },
      { id: TEAM_B_ID, name: 'Blau', color: '#43A047', _count: { participants: 1 } },
    ]);
    prismaMock.participant.findMany.mockResolvedValue([
      { id: 'p1', teamId: TEAM_A_ID },
      { id: 'p2', teamId: TEAM_A_ID },
      { id: 'p3', teamId: TEAM_B_ID },
    ]);
    prismaMock.vote.findMany.mockResolvedValue([
      { participantId: 'p1', questionId: 'q1', round: 1, score: 400 },
      { participantId: 'p2', questionId: 'q1', round: 1, score: 600 },
      { participantId: 'p3', questionId: 'q1', round: 1, score: 700 },
    ]);

    const result = await hostCaller.getExportData({ code: 'ABC123' });

    expect(result.teamMode).toBe(true);
    expect(result.teamLeaderboard).toEqual([
      {
        rank: 1,
        teamName: 'Blau',
        teamColor: '#43A047',
        totalScore: 700,
        memberCount: 1,
        averageScore: 700,
      },
      {
        rank: 2,
        teamName: 'Rot',
        teamColor: '#1E88E5',
        totalScore: 500,
        memberCount: 2,
        averageScore: 500,
      },
    ]);
  });

  it('exportiert SHORT_TEXT-Ergebnisse getrennt von offenem Freitext', async () => {
    const shortTextQuestionId = '44444444-4444-4444-8444-444444444444';
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: 'ABC123',
      status: 'FINISHED',
      type: 'QUIZ',
      endedAt: new Date('2026-04-23T08:00:00.000Z'),
      quiz: {
        name: 'Kurzantwort-Quiz',
        teamMode: false,
        teamCount: null,
        teamNames: [],
        questions: [
          {
            id: shortTextQuestionId,
            order: 0,
            text: 'Wer schrieb den ersten Algorithmus?',
            type: 'SHORT_TEXT',
            shortTextMaxLength: 40,
            shortTextCaseSensitive: false,
            answers: [
              { id: 'a1', text: 'Ada Lovelace', isCorrect: true },
              { id: 'a2', text: 'Ada', isCorrect: true },
            ],
          },
        ],
      },
      votes: [
        {
          questionId: shortTextQuestionId,
          freeText: 'Ada Lovelace',
          selectedAnswers: [],
          score: 2000,
        },
        { questionId: shortTextQuestionId, freeText: 'Ada', selectedAnswers: [], score: 2000 },
        {
          questionId: shortTextQuestionId,
          freeText: 'Grace Hopper',
          selectedAnswers: [],
          score: 0,
        },
      ],
      bonusTokens: [],
      participants: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
    });

    const result = await hostCaller.getExportData({ code: 'ABC123' });

    expect(result.questions[0]).toMatchObject({
      type: 'SHORT_TEXT',
      participantCount: 3,
      shortTextSolutions: ['Ada Lovelace', 'Ada'],
      correctCount: 2,
      incorrectCount: 1,
      shortTextIncorrectAggregates: [{ text: 'Grace Hopper', count: 1 }],
    });
    expect(result.questions[0]?.freetextAggregates).toBeUndefined();
  });

  it('exportiert aggregierte NUMERIC_ESTIMATE-Statistiken und Rundenvergleich', async () => {
    const questionId = '55555555-5555-4555-8555-555555555555';
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: 'ABC123',
      status: 'FINISHED',
      type: 'QUIZ',
      endedAt: new Date('2026-04-23T08:00:00.000Z'),
      quiz: {
        name: 'Schätzfragen-Quiz',
        teamMode: false,
        teamCount: null,
        teamNames: [],
        questions: [
          {
            id: questionId,
            order: 0,
            text: 'Wie viele Personen sind im Raum?',
            type: 'NUMERIC_ESTIMATE',
            numericToleranceMode: 'RELATIVE_PERCENT',
            numericReferenceValue: 100,
            numericTolerancePercent: 10,
            numericIntervalLeft: null,
            numericIntervalRight: null,
            answers: [],
          },
        ],
      },
      votes: [
        {
          participantId: 'p1',
          questionId,
          round: 1,
          numericValue: 90,
          selectedAnswers: [],
          score: 1000,
        },
        {
          participantId: 'p2',
          questionId,
          round: 1,
          numericValue: 130,
          selectedAnswers: [],
          score: 0,
        },
        {
          participantId: 'p1',
          questionId,
          round: 2,
          numericValue: 105,
          selectedAnswers: [],
          score: 1000,
        },
        {
          participantId: 'p2',
          questionId,
          round: 2,
          numericValue: 115,
          selectedAnswers: [],
          score: 0,
        },
      ],
      bonusTokens: [],
      participants: [{ id: 'p1' }, { id: 'p2' }],
    });

    const result = await hostCaller.getExportData({ code: 'ABC123' });

    expect(result.questions[0]).toMatchObject({
      type: 'NUMERIC_ESTIMATE',
      numericStats: expect.objectContaining({
        n: 2,
        mean: 110,
        inBandPercent: 50,
      }),
      numericRoundComparison: expect.objectContaining({
        meanDelta: 0,
        medianDelta: 0,
        inBandPercentDelta: 0,
        pairedAnalysis: {
          pairedCount: 2,
          closerCount: 2,
          fartherCount: 0,
          unchangedCount: 0,
        },
      }),
    });
    expect(result.questions[0]?.numericRoundComparison?.deltaHistogram?.length).toBeGreaterThan(0);
  });

  it('nutzt den Referenzwert fuer Paaranalyse auch bei absolutem Schaetzfragen-Intervall', async () => {
    const questionId = '66666666-6666-4666-8666-666666666666';
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: 'DEF456',
      status: 'FINISHED',
      type: 'QUIZ',
      endedAt: new Date('2026-04-23T08:30:00.000Z'),
      quiz: {
        name: 'Schätzfragen-Quiz',
        teamMode: false,
        teamCount: null,
        teamNames: [],
        questions: [
          {
            id: questionId,
            order: 0,
            text: 'Schätze den Messwert der Kalibrierprobe.',
            type: 'NUMERIC_ESTIMATE',
            numericToleranceMode: 'ABSOLUTE_INTERVAL',
            numericReferenceValue: 100,
            numericTolerancePercent: null,
            numericIntervalLeft: 95,
            numericIntervalRight: 105,
            answers: [],
          },
        ],
      },
      votes: [
        {
          participantId: 'p1',
          questionId,
          round: 1,
          numericValue: 98.2,
          selectedAnswers: [],
          score: 1000,
        },
        {
          participantId: 'p2',
          questionId,
          round: 1,
          numericValue: 120,
          selectedAnswers: [],
          score: 0,
        },
        {
          participantId: 'p3',
          questionId,
          round: 1,
          numericValue: 102.4,
          selectedAnswers: [],
          score: 1000,
        },
        {
          participantId: 'p1',
          questionId,
          round: 2,
          numericValue: 101.1,
          selectedAnswers: [],
          score: 1000,
        },
        {
          participantId: 'p2',
          questionId,
          round: 2,
          numericValue: 104.8,
          selectedAnswers: [],
          score: 1000,
        },
        {
          participantId: 'p3',
          questionId,
          round: 2,
          numericValue: 99.9,
          selectedAnswers: [],
          score: 1000,
        },
      ],
      bonusTokens: [],
      participants: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
    });

    const result = await hostCaller.getExportData({ code: 'DEF456' });

    expect(result.questions[0]?.numericRoundComparison).toMatchObject({
      inBandPercentDelta: 33.3333,
      pairedAnalysis: {
        pairedCount: 3,
        closerCount: 3,
        fartherCount: 0,
        unchangedCount: 0,
      },
    });
  });
});
