import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';
import { TRPCError } from '@trpc/server';

const QUIZ_ID = 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee';

const { prismaMock, invalidSessionCodeMock } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
    },
    quiz: {
      findUnique: vi.fn(),
    },
  },
  invalidSessionCodeMock: vi.fn(),
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/rateLimit', () => ({
  checkSessionCreateRate: vi.fn(),
}));

vi.mock('../lib/invalidSessionCode', () => ({
  rejectInvalidSessionCode: invalidSessionCodeMock,
}));

import { sessionRouter, resetSessionReadCachesForTests } from '../routers/session';

const caller = sessionRouter.createCaller({ req: undefined });

describe('session.getInfo (ADR-0009)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSessionReadCachesForTests();
    invalidSessionCodeMock.mockRejectedValue(new TRPCError({ code: 'NOT_FOUND' }));
  });

  it('bucht einen fehlgeschlagenen Join-Lookup im zentralen Enumerationsschutz', async () => {
    prismaMock.session.findUnique.mockResolvedValue(null);

    await expect(
      caller.getInfo({
        code: 'BAD999',
        anonymousClientId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    expect(invalidSessionCodeMock).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      'BAD999',
      'lookup',
    );
  });

  trpcDodIt(
    {
      procedure: 'session.getInfoForReconnect',
      case: 'error',
      mode: 'direct',
      contract: 'NOT_FOUND',
      title: 'klassifiziert einen unbekannten Code als Poll/Reconnect',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue(null);

      await expect(
        caller.getInfoForReconnect({
          code: 'BAD999',
          anonymousClientId: '11111111-1111-4111-8111-111111111111',
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });

      expect(invalidSessionCodeMock).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
        'BAD999',
        'pollReconnect',
      );
    },
  );

  trpcDodIt(
    {
      procedure: 'session.getInfoForReconnect',
      case: 'happy',
      mode: 'direct',
      title: 'liefert Kanalinformationen fuer eine bestehende Q&A-Session beim Reconnect',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
        code: 'ABC123',
        type: 'Q_AND_A',
        status: 'LOBBY',
        title: 'Offene Fragerunde',
        quizId: null,
        moderationMode: true,
        qaEnabled: true,
        qaOpen: true,
        qaTitle: 'Offene Fragerunde',
        qaModerationMode: true,
        quickFeedbackEnabled: false,
        quickFeedbackOpen: false,
        _count: { participants: 3 },
      });

      const result = await caller.getInfoForReconnect({ code: 'ABC123' });

      expect(result).toMatchObject({
        code: 'ABC123',
        channels: {
          qa: { enabled: true, open: true, title: 'Offene Fragerunde' },
          quickFeedback: { enabled: false, open: false },
        },
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.getInfo',
      case: 'happy',
      mode: 'direct',
      title: 'liefert Kanalinformationen für eine Quiz-Session mit Q&A und Blitz-Feedback',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
        code: 'ABC123',
        type: 'QUIZ',
        status: 'LOBBY',
        title: null,
        quizId: QUIZ_ID,
        quizStarted: true,
        qaEnabled: true,
        qaOpen: true,
        qaTitle: 'Fragen zur Vorlesung',
        qaModerationMode: true,
        quickFeedbackEnabled: true,
        quickFeedbackOpen: true,
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
        motifImageCredit: null,
      });

      const result = await caller.getInfo({ code: 'abc123' });

      expect(typeof result.serverTime).toBe('string');
      expect(Number.isNaN(Date.parse(result.serverTime))).toBe(false);
      expect(result.channels).toEqual({
        quiz: { enabled: true },
        qa: {
          enabled: true,
          open: true,
          title: 'Fragen zur Vorlesung',
          moderationMode: true,
        },
        quickFeedback: { enabled: true, open: true },
      });
      expect(result.quizStarted).toBe(true);
      expect(result.quizName).toBe('Demo Quiz');
      expect(result.nicknameTheme).toBe('NOBEL_LAUREATES');
    },
  );

  it('liefert nicknameTheme KINDERGARTEN aus dem Quiz (Join-Liste Kita)', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      title: null,
      quizId: QUIZ_ID,
      qaEnabled: false,
      qaOpen: false,
      qaTitle: null,
      qaModerationMode: true,
      quickFeedbackEnabled: false,
      quickFeedbackOpen: false,
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
      motifImageCredit: null,
    });

    const result = await caller.getInfo({ code: 'abc123' });

    expect(result.nicknameTheme).toBe('KINDERGARTEN');
    expect(result.allowCustomNicknames).toBe(false);
  });

  it('schaltet den Quiz-Kanal aus bei QUIZ-Session ohne quizId (nur Blitzlicht)', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      code: 'ONLYQF',
      type: 'QUIZ',
      status: 'LOBBY',
      title: null,
      quizId: null,
      qaEnabled: false,
      qaOpen: false,
      qaTitle: null,
      qaModerationMode: true,
      quickFeedbackEnabled: true,
      quickFeedbackOpen: true,
      _count: { participants: 0 },
    });
    prismaMock.quiz.findUnique.mockResolvedValue(null);

    const result = await caller.getInfo({ code: 'onlyqf' });

    expect(result.channels).toEqual({
      quiz: { enabled: false },
      qa: {
        enabled: false,
        open: false,
        title: null,
        moderationMode: false,
      },
      quickFeedback: { enabled: true, open: true },
    });
    expect(result.quizName).toBeNull();
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
      qaOpen: true,
      qaTitle: 'Offene Fragerunde',
      qaModerationMode: true,
      quickFeedbackEnabled: false,
      quickFeedbackOpen: false,
      _count: { participants: 3 },
    });

    const result = await caller.getInfo({ code: 'ABC123' });

    expect(typeof result.serverTime).toBe('string');
    expect(Number.isNaN(Date.parse(result.serverTime))).toBe(false);
    expect(result.channels).toEqual({
      quiz: { enabled: false },
      qa: {
        enabled: true,
        open: true,
        title: 'Offene Fragerunde',
        moderationMode: true,
      },
      quickFeedback: { enabled: false, open: false },
    });
    expect(result.quizName).toBeNull();
    expect(result.title).toBe('Offene Fragerunde');
    expect(result.allowCustomNicknames).toBe(false);
    expect(result.nicknameTheme).toBe('KINDERGARTEN');
    expect(result.teamMode).toBe(false);
  });

  it('liefert den laufenden Quiz-Fortschritt fuer aktive Sessions', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      code: 'ABC123',
      type: 'QUIZ',
      status: 'ACTIVE',
      title: null,
      quizId: QUIZ_ID,
      currentQuestion: 7,
      currentRound: 1,
      quizStarted: true,
      qaEnabled: false,
      qaOpen: false,
      qaTitle: null,
      qaModerationMode: true,
      quickFeedbackEnabled: false,
      quickFeedbackOpen: false,
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
      motifImageCredit: null,
      teamNames: [],
    });

    const result = await caller.getInfo({ code: 'abc123' });

    expect(result.status).toBe('ACTIVE');
    expect(result.currentQuestion).toBe(7);
    expect(result.currentRound).toBe(1);
  });

  it('nutzt kurzzeitig einen Cache fuer wiederholte getInfo-Abfragen derselben Session', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      code: 'ABC123',
      type: 'QUIZ',
      status: 'LOBBY',
      title: null,
      quizId: QUIZ_ID,
      qaEnabled: false,
      qaOpen: false,
      qaTitle: null,
      qaModerationMode: true,
      quickFeedbackEnabled: false,
      quickFeedbackOpen: false,
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
      motifImageCredit: null,
      teamNames: [],
    });

    const first = await caller.getInfo({ code: 'ABC123' });
    const second = await caller.getInfo({ code: 'ABC123' });

    expect(first.code).toBe('ABC123');
    expect(second.code).toBe('ABC123');
    expect(prismaMock.session.findUnique).toHaveBeenCalledTimes(1);
    expect(prismaMock.quiz.findUnique).toHaveBeenCalledTimes(1);
  });
});

trpcDodIt(
  {
    procedure: 'session.getInfo',
    case: 'error',
    mode: 'direct',
    contract: 'NOT_FOUND',
    title: 'leitet unbekannte Codes ueber den Lookup-Enumerationsschutz',
  },
  async () => {
    vi.clearAllMocks();
    resetSessionReadCachesForTests();
    prismaMock.session.findUnique.mockResolvedValue(null);
    invalidSessionCodeMock.mockRejectedValue(new TRPCError({ code: 'NOT_FOUND' }));

    await expect(caller.getInfo({ code: 'BAD999' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(invalidSessionCodeMock).toHaveBeenCalledWith(undefined, 'BAD999', 'lookup');
  },
);
