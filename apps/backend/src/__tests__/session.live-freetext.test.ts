import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQuizHistoryAccessProof } from '@arsnova/shared-types';

const { prismaMock, extractHostTokenMock, isHostSessionTokenValidMock } = vi.hoisted(() => ({
  prismaMock: {
    quiz: {
      findMany: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    vote: {
      findMany: vi.fn(),
    },
  },
  extractHostTokenMock: vi.fn(),
  isHostSessionTokenValidMock: vi.fn(),
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/hostAuth', () => ({
  extractHostToken: extractHostTokenMock,
  isHostSessionTokenValid: isHostSessionTokenValidMock,
}));

import { sessionRouter } from '../routers/session';

const caller = sessionRouter.createCaller({ req: {} as never });
const wsCaller = sessionRouter.createCaller({
  req: undefined,
  connectionParams: { 'x-host-token': 'host-token-123' },
});
const SESSION_ID = '6a8edced-5f8f-4cfa-9176-454fac9570ad';
const QUESTION_ID = '7ed3cc25-3179-4a91-9dc3-acc00971fb46';
const ACTIVE_QUIZ_ID = '11111111-1111-4111-8111-111111111111';
const INACTIVE_QUIZ_ID = '22222222-2222-4222-8222-222222222222';
const QUIZ_INPUT = {
  name: 'Chemie',
  description: undefined,
  motifImageUrl: null,
  showLeaderboard: true,
  allowCustomNicknames: true,
  defaultTimer: null,
  enableSoundEffects: true,
  enableRewardEffects: true,
  enableMotivationMessages: true,
  enableEmojiReactions: true,
  anonymousMode: false,
  teamMode: false,
  teamCount: undefined,
  teamAssignment: 'AUTO' as const,
  teamNames: [],
  backgroundMusic: undefined,
  nicknameTheme: 'NOBEL_LAUREATES' as const,
  bonusTokenCount: 3,
  readingPhaseEnabled: true,
  preset: 'PLAYFUL' as const,
  questions: [
    {
      text: 'Was ist Wasser?',
      type: 'SINGLE_CHOICE' as const,
      timer: null,
      difficulty: 'EASY' as const,
      order: 0,
      ratingMin: undefined,
      ratingMax: undefined,
      ratingLabelMin: undefined,
      ratingLabelMax: undefined,
      answers: [
        { text: 'H2O', isCorrect: true },
        { text: 'CO2', isCorrect: false },
      ],
    },
  ],
};

describe('session.getLiveFreetext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    extractHostTokenMock.mockReturnValue('host-token-123');
    isHostSessionTokenValidMock.mockResolvedValue(true);
  });

  it('liefert Freitextantworten der aktuell aktiven FREETEXT-Frage', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      currentQuestion: 1,
      quiz: {
        questions: [
          {
            id: QUESTION_ID,
            order: 1,
            type: 'FREETEXT',
            text: 'Was war heute hilfreich?',
          },
        ],
      },
    });
    prismaMock.vote.findMany.mockResolvedValue([
      { freeText: ' Klare Struktur ' },
      { freeText: 'Mehr Praxisbeispiele' },
      { freeText: '   ' },
    ]);

    const result = await caller.getLiveFreetext({ code: 'ABC123' });

    expect(result.sessionId).toBe(SESSION_ID);
    expect(result.questionId).toBe(QUESTION_ID);
    expect(result.questionType).toBe('FREETEXT');
    expect(result.responses).toEqual(['Klare Struktur', 'Mehr Praxisbeispiele']);
    expect(prismaMock.vote.findMany).toHaveBeenCalledTimes(1);
  });

  it('gibt bei nicht-FREITEXT-Fragen leere Antworten zurück', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      currentQuestion: 0,
      quiz: {
        questions: [
          {
            id: QUESTION_ID,
            order: 0,
            type: 'SINGLE_CHOICE',
            text: 'Welche Antwort stimmt?',
          },
        ],
      },
    });

    const result = await caller.getLiveFreetext({ code: 'ABC123' });

    expect(result.questionType).toBe('SINGLE_CHOICE');
    expect(result.responses).toEqual([]);
    expect(prismaMock.vote.findMany).not.toHaveBeenCalled();
  });

  it('akzeptiert Host-Tokens aus WebSocket-Connection-Params', async () => {
    extractHostTokenMock.mockReturnValue(null);
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      currentQuestion: 1,
      quiz: {
        questions: [
          {
            id: QUESTION_ID,
            order: 1,
            type: 'FREETEXT',
            text: 'Was war heute hilfreich?',
          },
        ],
      },
    });
    prismaMock.vote.findMany.mockResolvedValue([{ freeText: ' Live ueber WS ' }]);

    const result = await wsCaller.getLiveFreetext({ code: 'ABC123' });

    expect(result.responses).toEqual(['Live ueber WS']);
    expect(isHostSessionTokenValidMock).toHaveBeenCalledWith('ABC123', 'host-token-123');
  });
});

describe('session.getActiveQuizIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('liefert nur authorisierte Quiz-IDs von laufenden Sessions', async () => {
    const accessProof = await createQuizHistoryAccessProof(QUIZ_INPUT);
    prismaMock.quiz.findMany.mockResolvedValue([
      {
        id: ACTIVE_QUIZ_ID,
        ...QUIZ_INPUT,
        description: null,
        teamCount: null,
        backgroundMusic: null,
        questions: QUIZ_INPUT.questions.map((question) => ({
          ...question,
          ratingMin: null,
          ratingMax: null,
          ratingLabelMin: null,
          ratingLabelMax: null,
        })),
      },
    ]);
    prismaMock.session.findMany.mockResolvedValue([{ quizId: ACTIVE_QUIZ_ID }]);

    const result = await caller.getActiveQuizIds([
      { quizId: ACTIVE_QUIZ_ID, accessProof },
      {
        quizId: INACTIVE_QUIZ_ID,
        accessProof: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
    ]);

    expect(result).toEqual([ACTIVE_QUIZ_ID]);
    expect(prismaMock.session.findMany).toHaveBeenCalledWith({
      where: {
        status: { not: 'FINISHED' },
        quizId: { in: [ACTIVE_QUIZ_ID] },
      },
      select: { quizId: true },
      distinct: ['quizId'],
    });
  });
});

describe('session.getFreetextSessionExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    extractHostTokenMock.mockReturnValue('host-token-123');
    isHostSessionTokenValidMock.mockResolvedValue(true);
  });

  it('aggregiert Freitextantworten pro Frage für Session-Export', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: 'ABC123',
      quiz: {
        questions: [
          { id: QUESTION_ID, order: 0, text: 'Feedback?' },
          { id: '7b90667d-d4ef-4dce-bf09-76eeb91a5efd', order: 1, text: 'Was verbessern?' },
        ],
      },
    });
    prismaMock.vote.findMany.mockResolvedValue([
      { questionId: QUESTION_ID, freeText: ' Klar ' },
      { questionId: QUESTION_ID, freeText: 'Klar' },
      { questionId: '7b90667d-d4ef-4dce-bf09-76eeb91a5efd', freeText: 'Mehr Beispiele' },
    ]);

    const result = await caller.getFreetextSessionExport({ code: 'ABC123' });

    expect(result.sessionId).toBe(SESSION_ID);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]?.aggregates[0]).toEqual({ text: 'Klar', count: 2 });
    expect(result.entries[1]?.aggregates[0]).toEqual({ text: 'Mehr Beispiele', count: 1 });
  });
});
