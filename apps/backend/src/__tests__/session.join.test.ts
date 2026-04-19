import { beforeEach, describe, expect, it, vi } from 'vitest';

const SESSION_ID = '6a8edced-5f8f-4cfa-9176-454fac9570ad';
const PARTICIPANT_ID = '11111111-1111-4111-8111-111111111111';
const TEAM_ID = '22222222-2222-4222-8222-222222222222';

const { prismaMock, rateLimitMocks, statsMocks, presenceMocks } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
    },
    participant: {
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
  },
  rateLimitMocks: {
    checkSessionCreateRate: vi.fn(),
    isSessionCodeLockedOut: vi.fn(),
    recordFailedSessionCodeAttempt: vi.fn(),
  },
  statsMocks: {
    updateMaxParticipantsSingleSession: vi.fn(),
  },
  presenceMocks: {
    touchParticipantPresence: vi.fn(),
  },
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/rateLimit', () => ({
  checkSessionCreateRate: rateLimitMocks.checkSessionCreateRate,
  isSessionCodeLockedOut: rateLimitMocks.isSessionCodeLockedOut,
  recordFailedSessionCodeAttempt: rateLimitMocks.recordFailedSessionCodeAttempt,
}));

vi.mock('../lib/platformStatistic', () => ({
  updateMaxParticipantsSingleSession: statsMocks.updateMaxParticipantsSingleSession,
}));

vi.mock('../lib/presence', () => ({
  touchParticipantPresence: presenceMocks.touchParticipantPresence,
}));

import { sessionRouter } from '../routers/session';

const caller = sessionRouter.createCaller({ req: undefined });

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
    },
    _count: { participants: 3 },
  };
}

describe('session.join', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitMocks.isSessionCodeLockedOut.mockResolvedValue({ locked: false });
    prismaMock.session.findUnique.mockResolvedValue(buildSession());
    prismaMock.participant.count.mockResolvedValue(3);
  });

  it('verwendet einen bestehenden Teilnehmer per rejoinToken erneut', async () => {
    prismaMock.participant.findFirst.mockResolvedValue({
      id: PARTICIPANT_ID,
      teamId: TEAM_ID,
      team: { name: 'Team A' },
    });

    const result = await caller.join({
      code: 'abc123',
      nickname: 'Ada',
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
        team: {
          select: {
            name: true,
          },
        },
      },
    });
    expect(prismaMock.participant.create).not.toHaveBeenCalled();
    expect(result.participantId).toBe(PARTICIPANT_ID);
    expect(result.rejoinToken).toBe(PARTICIPANT_ID);
    expect(result.teamId).toBe(TEAM_ID);
    expect(result.teamName).toBe('Team A');
    expect(presenceMocks.touchParticipantPresence).toHaveBeenCalledWith(SESSION_ID, PARTICIPANT_ID);
  });

  it('legt ohne rejoinToken einen neuen Teilnehmer an und gibt dessen Token zurück', async () => {
    prismaMock.participant.create.mockResolvedValue({
      id: PARTICIPANT_ID,
    });
    prismaMock.participant.count.mockResolvedValue(4);

    const result = await caller.join({
      code: 'ABC123',
      nickname: '  Ada Lovelace  ',
    });

    expect(prismaMock.participant.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.participant.create).toHaveBeenCalledWith({
      data: {
        sessionId: SESSION_ID,
        nickname: 'Ada Lovelace',
        teamId: undefined,
      },
    });
    expect(result.participantId).toBe(PARTICIPANT_ID);
    expect(result.rejoinToken).toBe(PARTICIPANT_ID);
    expect(result.participantCount).toBe(4);
    expect(statsMocks.updateMaxParticipantsSingleSession).toHaveBeenCalledWith(4);
  });
});
