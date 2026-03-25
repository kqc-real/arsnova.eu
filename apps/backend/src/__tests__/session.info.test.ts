import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    session: {
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
      qaEnabled: true,
      qaTitle: 'Fragen zur Vorlesung',
      qaModerationMode: true,
      quickFeedbackEnabled: true,
      quiz: {
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
      },
      _count: { participants: 12 },
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
  });

  it('mappt eine bestehende Q&A-Only-Session kompatibel auf die neuen Kanalinfos', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      code: 'ABC123',
      type: 'Q_AND_A',
      status: 'LOBBY',
      title: 'Offene Fragerunde',
      moderationMode: true,
      qaEnabled: true,
      qaTitle: 'Offene Fragerunde',
      qaModerationMode: true,
      quickFeedbackEnabled: false,
      quiz: null,
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
