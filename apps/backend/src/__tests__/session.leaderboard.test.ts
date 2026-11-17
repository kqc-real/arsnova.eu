import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TRPCError } from '@trpc/server';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';

const { prismaMock, invalidSessionCodeMock } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
    },
    vote: {
      findMany: vi.fn(),
    },
  },
  invalidSessionCodeMock: vi.fn(),
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/invalidSessionCode', () => ({
  rejectInvalidSessionCode: invalidSessionCodeMock,
}));

import { resetSessionRankingCacheForTests } from '../lib/sessionRankingCache';
import { sessionRouter } from '../routers/session';

const caller = sessionRouter.createCaller({ req: undefined });

describe('session.getLeaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSessionRankingCacheForTests();
    invalidSessionCodeMock.mockRejectedValue(new TRPCError({ code: 'NOT_FOUND' }));
  });

  trpcDodIt(
    {
      procedure: 'session.getLeaderboard',
      case: 'happy',
      mode: 'direct',
      title: 'zaehlt bei MULTIPLE_CHOICE nur vollständig korrekt beantwortete Fragen als "Richtig"',
    },
    async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: 'sess-1',
        quiz: {
          showLeaderboard: true,
          questions: [{ type: 'MULTIPLE_CHOICE' }],
        },
        participants: [
          { id: 'p1', nickname: 'Ada' },
          {
            id: 'p2',
            nickname: 'Bob',
            team: { name: ':apple: Team Apfel', color: '#1E88E5' },
          },
        ],
      });
      prismaMock.vote.findMany.mockResolvedValue([
        {
          participantId: 'p1',
          questionId: 'q1',
          round: 1,
          score: 2000,
          responseTimeMs: 1000,
          question: {
            type: 'MULTIPLE_CHOICE',
            answers: [
              { id: 'a1', isCorrect: true },
              { id: 'a2', isCorrect: true },
              { id: 'a3', isCorrect: false },
            ],
          },
          selectedAnswers: [{ answerOptionId: 'a1' }, { answerOptionId: 'a2' }],
        },
        {
          participantId: 'p2',
          questionId: 'q1',
          round: 1,
          score: 0,
          responseTimeMs: 1200,
          question: {
            type: 'MULTIPLE_CHOICE',
            answers: [
              { id: 'a1', isCorrect: true },
              { id: 'a2', isCorrect: true },
              { id: 'a3', isCorrect: false },
            ],
          },
          selectedAnswers: [{ answerOptionId: 'a1' }],
        },
      ]);

      const result = await caller.getLeaderboard({ code: 'ABC123' });

      expect(result).toEqual([
        expect.objectContaining({
          nickname: 'Ada',
          correctCount: 1,
          totalQuestions: 1,
        }),
      ]);
    },
  );

  it('nutzt nur Antwortzeiten von positiv bewerteten Antworten als Tiebreaker', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      quiz: {
        showLeaderboard: true,
        questions: [{ type: 'SINGLE_CHOICE' }, { type: 'SURVEY' }],
      },
      participants: [
        { id: 'p1', nickname: 'Ada' },
        {
          id: 'p2',
          nickname: 'Bob',
          team: { name: ':apple: Team Apfel', color: '#1E88E5' },
        },
      ],
    });
    prismaMock.vote.findMany.mockResolvedValue([
      {
        participantId: 'p1',
        questionId: 'q1',
        round: 1,
        score: 2000,
        responseTimeMs: 5000,
        question: {
          type: 'SINGLE_CHOICE',
          answers: [
            { id: 'a1', isCorrect: true },
            { id: 'a2', isCorrect: false },
          ],
        },
        selectedAnswers: [{ answerOptionId: 'a1' }],
      },
      {
        participantId: 'p1',
        questionId: 'q2',
        round: 1,
        score: 0,
        responseTimeMs: 120_000,
        question: {
          type: 'SURVEY',
          answers: [
            { id: 's1', isCorrect: false },
            { id: 's2', isCorrect: false },
          ],
        },
        selectedAnswers: [{ answerOptionId: 's1' }],
      },
      {
        participantId: 'p2',
        questionId: 'q1',
        round: 1,
        score: 2000,
        responseTimeMs: 6000,
        question: {
          type: 'SINGLE_CHOICE',
          answers: [
            { id: 'a1', isCorrect: true },
            { id: 'a2', isCorrect: false },
          ],
        },
        selectedAnswers: [{ answerOptionId: 'a1' }],
      },
    ]);

    const result = await caller.getLeaderboard({ code: 'ABC123' });

    expect(result).toEqual([
      expect.objectContaining({
        rank: 1,
        nickname: 'Ada',
        totalScore: 2000,
        totalResponseTimeMs: 5000,
      }),
      expect.objectContaining({
        rank: 2,
        nickname: 'Bob',
        totalScore: 2000,
        totalResponseTimeMs: 6000,
        teamName: ':apple: Team Apfel',
        teamColor: '#1E88E5',
      }),
    ]);
  });

  it('ersetzt bei Runde 2 die Runde-1-Wertung und ignoriert Runde-2-Antwortzeiten', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      quiz: {
        showLeaderboard: true,
        questions: [{ type: 'SINGLE_CHOICE' }, { type: 'SINGLE_CHOICE' }],
      },
      participants: [
        { id: 'p1', nickname: 'Ada' },
        { id: 'p2', nickname: 'Bob' },
      ],
    });
    prismaMock.vote.findMany.mockResolvedValue([
      {
        participantId: 'p1',
        questionId: 'q1',
        round: 1,
        score: 1000,
        responseTimeMs: 5000,
        question: {
          type: 'SINGLE_CHOICE',
          answers: [
            { id: 'q1-a1', isCorrect: true },
            { id: 'q1-a2', isCorrect: false },
          ],
        },
        selectedAnswers: [{ answerOptionId: 'q1-a1' }],
      },
      {
        participantId: 'p2',
        questionId: 'q1',
        round: 1,
        score: 1000,
        responseTimeMs: 6000,
        question: {
          type: 'SINGLE_CHOICE',
          answers: [
            { id: 'q1-a1', isCorrect: true },
            { id: 'q1-a2', isCorrect: false },
          ],
        },
        selectedAnswers: [{ answerOptionId: 'q1-a1' }],
      },
      {
        participantId: 'p1',
        questionId: 'q2',
        round: 1,
        score: 0,
        responseTimeMs: 100,
        question: {
          type: 'SINGLE_CHOICE',
          answers: [
            { id: 'q2-a1', isCorrect: true },
            { id: 'q2-a2', isCorrect: false },
          ],
        },
        selectedAnswers: [{ answerOptionId: 'q2-a2' }],
      },
      {
        participantId: 'p2',
        questionId: 'q2',
        round: 1,
        score: 1900,
        responseTimeMs: 100,
        question: {
          type: 'SINGLE_CHOICE',
          answers: [
            { id: 'q2-a1', isCorrect: true },
            { id: 'q2-a2', isCorrect: false },
          ],
        },
        selectedAnswers: [{ answerOptionId: 'q2-a1' }],
      },
      {
        participantId: 'p1',
        questionId: 'q2',
        round: 2,
        score: 2000,
        responseTimeMs: 120_000,
        question: {
          type: 'SINGLE_CHOICE',
          answers: [
            { id: 'q2-a1', isCorrect: true },
            { id: 'q2-a2', isCorrect: false },
          ],
        },
        selectedAnswers: [{ answerOptionId: 'q2-a1' }],
      },
      {
        participantId: 'p2',
        questionId: 'q2',
        round: 2,
        score: 2000,
        responseTimeMs: 500,
        question: {
          type: 'SINGLE_CHOICE',
          answers: [
            { id: 'q2-a1', isCorrect: true },
            { id: 'q2-a2', isCorrect: false },
          ],
        },
        selectedAnswers: [{ answerOptionId: 'q2-a1' }],
      },
    ]);

    const result = await caller.getLeaderboard({ code: 'ABC123' });

    expect(result).toEqual([
      expect.objectContaining({
        rank: 1,
        nickname: 'Ada',
        totalScore: 3000,
        correctCount: 2,
        totalQuestions: 2,
        totalResponseTimeMs: 5000,
      }),
      expect.objectContaining({
        rank: 2,
        nickname: 'Bob',
        totalScore: 3000,
        correctCount: 2,
        totalQuestions: 2,
        totalResponseTimeMs: 6000,
      }),
    ]);
  });

  it.each([
    {
      title: 'zählt eine exakte Kurzantwort auch ohne Punkte',
      modelAnswer: 'Berlin',
      freeText: 'berlin',
      config: {},
      score: 0,
      correctCount: 1,
    },
    {
      title: 'zählt einen Tippfehler bei Teilpunkten nicht',
      modelAnswer: 'Berlin',
      freeText: 'Berln',
      config: { shortTextToleranceLevel: 'medium', shortTextAllowPartialCredit: true },
      score: 215,
      correctCount: 0,
    },
    {
      title: 'zählt einen Tippfehler, wenn die Toleranz ihn voll akzeptiert',
      modelAnswer: 'Berlin',
      freeText: 'Berln',
      config: { shortTextToleranceLevel: 'medium', shortTextAllowPartialCredit: false },
      score: 215,
      correctCount: 1,
    },
    {
      title: 'bewertet einen tolerierten Altdaten-Treffer ohne gespeicherte Korrektheit',
      modelAnswer: 'Berlin',
      freeText: 'Berln',
      config: { shortTextToleranceLevel: 'medium', shortTextAllowPartialCredit: false },
      isCorrect: null,
      score: 0,
      correctCount: 1,
    },
    {
      title: 'zählt einen Treffer mit fehlender Pflichteinheit nicht',
      modelAnswer: '10 m',
      freeText: '10',
      config: {
        shortTextEvaluationKind: 'numeric_unit',
        numericUnitFamily: 'length',
        numericRequireUnit: true,
      },
      score: 500,
      correctCount: 0,
    },
    {
      title: 'zählt eine numerische Kurzantwort innerhalb der Toleranz',
      modelAnswer: '10',
      freeText: '11',
      config: {
        shortTextEvaluationKind: 'numeric',
        numericToleranceMode: 'absolute',
        numericAbsoluteTolerance: 1,
      },
      score: 700,
      correctCount: 1,
    },
  ])(
    '$title im Leaderboard',
    async ({ modelAnswer, freeText, config, score, correctCount, isCorrect = true }) => {
      prismaMock.session.findUnique.mockResolvedValue({
        id: 'sess-1',
        quiz: {
          showLeaderboard: true,
          questions: [{ id: 'q1', order: 0, type: 'SHORT_TEXT' }],
        },
        participants: [{ id: 'p1', nickname: 'Ada' }],
      });
      const vote = {
        participantId: 'p1',
        questionId: 'q1',
        isCorrect,
        responseTimeMs: 1800,
        question: {
          type: 'SHORT_TEXT',
          ...config,
          answers: [{ id: 'a1', text: modelAnswer, isCorrect: true }],
        },
        selectedAnswers: [],
      };
      prismaMock.vote.findMany.mockResolvedValue([
        { ...vote, round: 1, score: 1000, freeText: modelAnswer },
        { ...vote, round: 2, score, freeText },
      ]);

      const result = await caller.getLeaderboard({ code: 'ABC123' });

      expect(result).toEqual([
        expect.objectContaining({
          nickname: 'Ada',
          totalScore: score,
          correctCount,
          totalQuestions: 1,
        }),
      ]);
    },
  );

  it('zaehlt positive NUMERIC_ESTIMATE-Scores als richtige Antworten im Leaderboard', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      quiz: {
        showLeaderboard: true,
        questions: [{ type: 'NUMERIC_ESTIMATE' }],
      },
      participants: [{ id: 'p1', nickname: 'Ada' }],
    });
    prismaMock.vote.findMany.mockResolvedValue([
      {
        participantId: 'p1',
        questionId: 'q1',
        round: 1,
        score: 1000,
        responseTimeMs: 1800,
        question: {
          type: 'NUMERIC_ESTIMATE',
          answers: [],
        },
        selectedAnswers: [],
      },
    ]);

    const result = await caller.getLeaderboard({ code: 'ABC123' });

    expect(result).toEqual([
      expect.objectContaining({
        nickname: 'Ada',
        totalScore: 1000,
        correctCount: 1,
        totalQuestions: 1,
      }),
    ]);
  });
});

trpcDodIt(
  {
    procedure: 'session.getLeaderboard',
    case: 'error',
    mode: 'direct',
    contract: 'NOT_FOUND',
    title: 'leitet einen unbekannten Code ueber den Reconnect-Enumerationsschutz',
  },
  async () => {
    vi.clearAllMocks();
    prismaMock.session.findUnique.mockResolvedValue(null);
    invalidSessionCodeMock.mockRejectedValue(new TRPCError({ code: 'NOT_FOUND' }));

    await expect(caller.getLeaderboard({ code: 'BAD999' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(invalidSessionCodeMock).toHaveBeenCalledWith(undefined, 'BAD999', 'pollReconnect');
  },
);
