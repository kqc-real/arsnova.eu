import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
    },
    vote: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

import { sessionRouter } from '../routers/session';

const caller = sessionRouter.createCaller({ req: undefined });

describe('session.getPersonalScorecard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  trpcDodIt(
    {
      procedure: 'session.getPersonalScorecard',
      case: 'happy',
      mode: 'direct',
      title: 'wertet positive SHORT_TEXT-Punkte in der persoenlichen Scorecard als korrekt',
    },
    async () => {
      const participantId = '11111111-1111-4111-8111-111111111111';
      const otherParticipantId = '22222222-2222-4222-8222-222222222222';
      const questionId = '33333333-3333-4333-8333-333333333333';

      prismaMock.session.findUnique.mockResolvedValue({
        id: 'sess-1',
        status: 'RESULTS',
        quiz: {
          questions: [
            {
              id: questionId,
              type: 'SHORT_TEXT',
              answers: [{ id: '44444444-4444-4444-8444-444444444444', isCorrect: true }],
            },
          ],
        },
        participants: [{ id: participantId }, { id: otherParticipantId }],
      });
      prismaMock.vote.findUnique.mockResolvedValue({
        score: 215,
        streakCount: 2,
        streakBonus: 1.1,
        selectedAnswers: [],
      });
      prismaMock.vote.findMany.mockResolvedValue([
        { participantId, questionId, round: 1, score: 215, responseTimeMs: 1200 },
        {
          participantId: otherParticipantId,
          questionId,
          round: 1,
          score: 180,
          responseTimeMs: 1400,
        },
      ]);

      const result = await caller.getPersonalScorecard({
        code: 'ABC123',
        participantId,
        questionIndex: 0,
        round: 1,
      });

      expect(result).toEqual(
        expect.objectContaining({
          wasCorrect: true,
          questionScore: 215,
        }),
      );
    },
  );

  it('wertet positive NUMERIC_ESTIMATE-Punkte in der persoenlichen Scorecard als korrekt', async () => {
    const participantId = '11111111-1111-4111-8111-111111111111';
    const otherParticipantId = '22222222-2222-4222-8222-222222222222';
    const questionId = '33333333-3333-4333-8333-333333333333';

    prismaMock.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      status: 'RESULTS',
      quiz: {
        questions: [
          {
            id: questionId,
            type: 'NUMERIC_ESTIMATE',
            answers: [],
          },
        ],
      },
      participants: [{ id: participantId }, { id: otherParticipantId }],
    });
    prismaMock.vote.findUnique.mockResolvedValue({
      score: 1000,
      streakCount: 1,
      streakBonus: 1,
      selectedAnswers: [],
    });
    prismaMock.vote.findMany.mockResolvedValue([
      { participantId, questionId, round: 1, score: 1000, responseTimeMs: 1200 },
      { participantId: otherParticipantId, questionId, round: 1, score: 0, responseTimeMs: 1400 },
    ]);

    const result = await caller.getPersonalScorecard({
      code: 'ABC123',
      participantId,
      questionIndex: 0,
      round: 1,
    });

    expect(result).toEqual(
      expect.objectContaining({
        wasCorrect: true,
        correctAnswerIds: undefined,
        questionScore: 1000,
      }),
    );
  });

  it('nutzt gespeicherte fachliche Korrektheit auch bei 0 Punkten', async () => {
    const participantId = '11111111-1111-4111-8111-111111111111';
    const questionId = '33333333-3333-4333-8333-333333333333';

    prismaMock.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      status: 'RESULTS',
      quiz: {
        questions: [
          {
            id: questionId,
            type: 'SHORT_TEXT',
            answers: [{ id: '44444444-4444-4444-8444-444444444444', isCorrect: true }],
          },
        ],
      },
      participants: [{ id: participantId }],
    });
    prismaMock.vote.findUnique.mockResolvedValue({
      score: 0,
      isCorrect: true,
      streakCount: 1,
      streakBonus: 1,
      selectedAnswers: [],
    });
    prismaMock.vote.findMany.mockResolvedValue([
      { participantId, questionId, round: 1, score: 0, responseTimeMs: 10_000 },
    ]);

    const result = await caller.getPersonalScorecard({
      code: 'ABC123',
      participantId,
      questionIndex: 0,
      round: 1,
    });

    expect(result).toEqual(
      expect.objectContaining({
        wasCorrect: true,
        questionScore: 0,
      }),
    );
  });

  it('liefert die eigene persistierte strukturierte Antwort für einen RESULTS-Reload', async () => {
    const participantId = '11111111-1111-4111-8111-111111111111';
    const questionId = '33333333-3333-4333-8333-333333333333';
    const orderingSequence = ['step-c', 'step-a', 'step-b'];

    prismaMock.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      status: 'RESULTS',
      quiz: {
        questions: [
          {
            id: questionId,
            type: 'ORDERING',
            answers: [],
          },
        ],
      },
      participants: [{ id: participantId }],
    });
    prismaMock.vote.findUnique.mockResolvedValue({
      score: 0,
      isCorrect: false,
      streakCount: 0,
      streakBonus: 1,
      selectedAnswers: [],
      matchingSelections: null,
      orderingSequence,
      categorizationSelections: null,
    });
    prismaMock.vote.findMany.mockResolvedValue([
      { participantId, questionId, round: 1, score: 0, responseTimeMs: 1200 },
    ]);

    const result = await caller.getPersonalScorecard({
      code: 'ABC123',
      participantId,
      questionIndex: 0,
      round: 1,
    });

    expect(result).toEqual(
      expect.objectContaining({
        wasCorrect: false,
        orderingSequence,
        matchingSelections: undefined,
        categorizationSelections: undefined,
      }),
    );
  });

  it('nutzt fuer die Rangliste Runde 2 als Ersatz und ignoriert dort Antwortzeiten', async () => {
    const participantId = '11111111-1111-4111-8111-111111111111';
    const otherParticipantId = '22222222-2222-4222-8222-222222222222';
    const questionOneId = '33333333-3333-4333-8333-333333333333';
    const questionTwoId = '44444444-4444-4444-8444-444444444444';

    prismaMock.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      status: 'RESULTS',
      quiz: {
        questions: [
          {
            id: questionOneId,
            type: 'SINGLE_CHOICE',
            answers: [
              { id: '55555555-5555-4555-8555-555555555555', isCorrect: true },
              { id: '66666666-6666-4666-8666-666666666666', isCorrect: false },
            ],
          },
          {
            id: questionTwoId,
            type: 'SINGLE_CHOICE',
            answers: [
              { id: '77777777-7777-4777-8777-777777777777', isCorrect: true },
              { id: '88888888-8888-4888-8888-888888888888', isCorrect: false },
            ],
          },
        ],
      },
      participants: [{ id: participantId }, { id: otherParticipantId }],
    });
    prismaMock.vote.findUnique.mockResolvedValue({
      score: 2000,
      streakCount: 2,
      streakBonus: 1,
      selectedAnswers: [{ answerOptionId: '77777777-7777-4777-8777-777777777777' }],
    });
    prismaMock.vote.findMany
      .mockResolvedValueOnce([
        { participantId, questionId: questionOneId, round: 1, score: 1000, responseTimeMs: 5000 },
        {
          participantId: otherParticipantId,
          questionId: questionOneId,
          round: 1,
          score: 1000,
          responseTimeMs: 6000,
        },
        { participantId, questionId: questionTwoId, round: 1, score: 0, responseTimeMs: 100 },
        {
          participantId: otherParticipantId,
          questionId: questionTwoId,
          round: 1,
          score: 1900,
          responseTimeMs: 100,
        },
        {
          participantId,
          questionId: questionTwoId,
          round: 2,
          score: 2000,
          responseTimeMs: 120_000,
        },
        {
          participantId: otherParticipantId,
          questionId: questionTwoId,
          round: 2,
          score: 2000,
          responseTimeMs: 500,
        },
      ])
      .mockResolvedValueOnce([
        { participantId, questionId: questionOneId, round: 1, score: 1000, responseTimeMs: 5000 },
        {
          participantId: otherParticipantId,
          questionId: questionOneId,
          round: 1,
          score: 1000,
          responseTimeMs: 6000,
        },
      ]);

    const result = await caller.getPersonalScorecard({
      code: 'ABC123',
      participantId,
      questionIndex: 1,
      round: 2,
    });

    expect(result).toEqual(
      expect.objectContaining({
        wasCorrect: true,
        questionScore: 2000,
        totalScore: 3000,
        currentRank: 1,
        previousRank: 1,
        rankChange: 0,
      }),
    );
  });
});

trpcDodIt(
  {
    procedure: 'session.getPersonalScorecard',
    case: 'error',
    mode: 'direct',
    contract: 'NOT_FOUND',
    title: 'lehnt eine gueltige Anfrage ohne Quiz-Frage ab',
  },
  async () => {
    vi.clearAllMocks();
    prismaMock.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      status: 'RESULTS',
      quiz: { questions: [] },
      participants: [],
    });

    await expect(
      caller.getPersonalScorecard({
        code: 'ABC123',
        participantId: '11111111-1111-4111-8111-111111111111',
        questionIndex: 0,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(prismaMock.vote.findUnique).not.toHaveBeenCalled();
  },
);
