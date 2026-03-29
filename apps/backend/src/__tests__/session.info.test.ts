import { beforeEach, describe, expect, it, vi } from 'vitest';

const QUIZ_ID = 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
    },
    quiz: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/rateLimit', () => ({
  checkSessionCreateRate: vi.fn(),
  isSessionCodeLockedOut: vi.fn(),
  recordFailedSessionCodeAttempt: vi.fn(),
}));

import { sessionRouter } from '../routers/session';

const caller = sessionRouter.createCaller({ req: undefined });

describe('session.getInfo (ADR-0009)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('liefert Kanalinformationen für eine Quiz-Session mit Q&A und Blitz-Feedback', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      title: null,
      quizId: QUIZ_ID,
      qaEnabled: true,
      qaTitle: 'Fragen zur Vorlesung',
      qaModerationMode: true,
      quickFeedbackEnabled: true,
      _count: { participants: 12 },
    });
    prismaMock.quiz.findUnique.mockResolvedValue({
      name: 'Demo Quiz',
      nicknameTheme: 'NOBEL_LAUREATES',
      allowCustomNicknames: true,
      anonymousMode: false,
      showLeaderboard: true,
      enableSoundEffects: true,
      enableRewardEffects: true,
      enableMotivationMessages: true,
      enableEmojiReactions: true,
      readingPhaseEnabled: true,
      defaultTimer: 30,
      backgroundMusic: null,
      teamMode: false,
      teamCount: null,
      teamAssignment: null,
      bonusTokenCount: null,
      preset: 'PLAYFUL',
      motifImageUrl: null,
    });

    const result = await caller.getInfo({ code: 'abc123' });

    expect(typeof result.serverTime).toBe('string');
    expect(Number.isNaN(Date.parse(result.serverTime))).toBe(false);
    expect(result.channels).toEqual({
      quiz: { enabled: true },
      qa: {
        enabled: true,
        title: 'Fragen zur Vorlesung',
        moderationMode: true,
      },
      quickFeedback: { enabled: true },
    });
    expect(result.quizName).toBe('Demo Quiz');
    expect(result.nicknameTheme).toBe('NOBEL_LAUREATES');
  });

  it('liefert nicknameTheme KINDERGARTEN aus dem Quiz (Join-Liste Kita)', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      title: null,
      quizId: QUIZ_ID,
      qaEnabled: false,
      qaTitle: null,
      qaModerationMode: true,
      quickFeedbackEnabled: false,
      _count: { participants: 0 },
    });
    prismaMock.quiz.findUnique.mockResolvedValue({
      name: 'Kita-Quiz',
      nicknameTheme: 'KINDERGARTEN',
      allowCustomNicknames: false,
      anonymousMode: false,
      showLeaderboard: true,
      enableSoundEffects: true,
      enableRewardEffects: true,
      enableMotivationMessages: true,
      enableEmojiReactions: true,
      readingPhaseEnabled: true,
      defaultTimer: 30,
      backgroundMusic: null,
      teamMode: false,
      teamCount: null,
      teamAssignment: null,
      bonusTokenCount: null,
      preset: 'PLAYFUL',
      motifImageUrl: null,
    });

    const result = await caller.getInfo({ code: 'abc123' });

    expect(result.nicknameTheme).toBe('KINDERGARTEN');
    expect(result.allowCustomNicknames).toBe(false);
  });

  it('mappt eine bestehende Q&A-Only-Session kompatibel auf die neuen Kanalinfos', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      code: 'ABC123',
      type: 'Q_AND_A',
      status: 'LOBBY',
      title: 'Offene Fragerunde',
      quizId: null,
      moderationMode: true,
      qaEnabled: true,
      qaTitle: 'Offene Fragerunde',
      qaModerationMode: true,
      quickFeedbackEnabled: false,
      _count: { participants: 3 },
    });

    const result = await caller.getInfo({ code: 'ABC123' });

    expect(typeof result.serverTime).toBe('string');
    expect(Number.isNaN(Date.parse(result.serverTime))).toBe(false);
    expect(result.channels).toEqual({
      quiz: { enabled: false },
      qa: {
        enabled: true,
        title: 'Offene Fragerunde',
        moderationMode: true,
      },
      quickFeedback: { enabled: false },
    });
    expect(result.quizName).toBeNull();
    expect(result.title).toBe('Offene Fragerunde');
  });
});
