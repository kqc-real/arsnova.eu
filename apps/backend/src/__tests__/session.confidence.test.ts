import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, hostAuthMocks } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findUnique: vi.fn(),
    },
    vote: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    participant: {
      findFirst: vi.fn(),
    },
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

vi.mock('../lib/hostAuth', async () => {
  const { buildHostAuthTestMock } = await import('./lib/hostAuth-vitest-mock');
  return buildHostAuthTestMock({
    extractHostToken: hostAuthMocks.extractHostTokenMock,
    extractHostTokenFromConnectionParams: hostAuthMocks.extractHostTokenFromConnectionParamsMock,
    isHostSessionTokenValid: hostAuthMocks.isHostSessionTokenValidMock,
  });
});

import { resetVoteAggregationCachesForTests, sessionRouter } from '../routers/session';

const caller = sessionRouter.createCaller({ req: {} as never });
const hostCaller = sessionRouter.createCaller({ req: {} as never });
const CODE = 'ABC123';
const QUESTION_ID = '11111111-1111-4111-8111-111111111111';
const RIGHT_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const WRONG_ID = 'bbbbbbbb-2222-4222-8222-222222222222';

function buildConfidenceScQuestion(overrides: Record<string, unknown> = {}) {
  return {
    id: QUESTION_ID,
    order: 0,
    text: 'Was ist 2+2?',
    type: 'SINGLE_CHOICE',
    difficulty: 'MEDIUM',
    timer: null,
    ratingMin: null,
    ratingMax: null,
    ratingLabelMin: null,
    ratingLabelMax: null,
    shortTextEvaluationKind: 'text',
    shortTextMaxLength: null,
    shortTextCaseSensitive: false,
    shortTextEvaluationMode: 'auto',
    shortTextToleranceLevel: 'low',
    shortTextAllowPartialCredit: true,
    shortTextTrimWhitespace: true,
    shortTextNormalizeWhitespace: true,
    numericInputKind: null,
    numericToleranceMode: null,
    numericAbsoluteTolerance: null,
    numericRelativeTolerancePercent: null,
    numericUnitFamily: null,
    numericRequireUnit: false,
    numericAcceptEquivalentUnits: true,
    skipReadingPhase: false,
    numericReferenceValue: null,
    numericTolerancePercent: null,
    numericIntervalLeft: null,
    numericIntervalRight: null,
    numericInputType: null,
    numericDecimalPlaces: null,
    numericMin: null,
    numericMax: null,
    numericTwoRounds: false,
    confidenceEnabled: true,
    confidenceLabelLow: 'Geraten',
    confidenceLabelHigh: 'Sehr sicher',
    answers: [
      { id: RIGHT_ID, text: '4', isCorrect: true },
      { id: WRONG_ID, text: '5', isCorrect: false },
    ],
    ...overrides,
  };
}

function buildSession(status: string, questionOverrides: Record<string, unknown> = {}) {
  return {
    id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
    code: CODE,
    status,
    currentQuestion: 0,
    currentRound: 1,
    answerDisplayOrder: null,
    activeQuestionStartedAt: new Date('2026-07-13T12:00:00.000Z'),
    statusChangedAt: new Date('2026-07-13T12:00:00.000Z'),
    quiz: {
      defaultTimer: null,
      timerScaleByDifficulty: true,
      showQuestionTypeIndicators: true,
      preset: 'SERIOUS',
      questions: [buildConfidenceScQuestion(questionOverrides)],
    },
    _count: { participants: 3 },
  };
}

describe('Confidence-Auswertung (Story 1.2i)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetVoteAggregationCachesForTests();
    hostAuthMocks.extractHostTokenMock.mockReturnValue('host-token-123');
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
    prismaMock.vote.count.mockResolvedValue(0);
    prismaMock.participant.findFirst.mockResolvedValue(null);
  });

  it('liefert Host bei ACTIVE keine Confidence-Aggregate', async () => {
    prismaMock.session.findUnique.mockResolvedValue(buildSession('ACTIVE'));
    prismaMock.vote.findMany.mockResolvedValue([]);

    const result = await caller.getCurrentQuestionForHost({ code: CODE });

    expect(result).toMatchObject({
      confidenceEnabled: true,
      confidenceLabelLow: 'Geraten',
      confidenceLabelHigh: 'Sehr sicher',
      totalVotes: 0,
    });
    expect(result).not.toHaveProperty('confidenceResult');
  });

  it('liefert Host bei RESULTS eine Kreuztabelle Korrektheit x Confidence', async () => {
    prismaMock.session.findUnique.mockResolvedValue(buildSession('RESULTS'));
    prismaMock.vote.findMany.mockImplementation((args: { select?: Record<string, unknown> }) => {
      if (args?.select && 'confidenceValue' in args.select) {
        return Promise.resolve([
          {
            confidenceValue: 5,
            isCorrect: false,
            selectedAnswers: [{ answerOptionId: WRONG_ID }],
          },
          {
            confidenceValue: 1,
            isCorrect: true,
            selectedAnswers: [{ answerOptionId: RIGHT_ID }],
          },
        ]);
      }

      return Promise.resolve([
        { selectedAnswers: [{ answerOptionId: WRONG_ID }] },
        { selectedAnswers: [{ answerOptionId: RIGHT_ID }] },
      ]);
    });

    const result = await caller.getCurrentQuestionForHost({ code: CODE });

    expect(result).toMatchObject({
      totalVotes: 2,
      correctVoterCount: 1,
      confidenceResult: {
        highConfidenceWrongCount: 1,
        crossTab: {
          correctHigh: 0,
          correctLow: 1,
          incorrectHigh: 1,
        },
        highConfidenceWrongOptions: [{ answerId: WRONG_ID, text: '5', count: 1 }],
      },
    });
  });

  it('liefert Teilnehmenden bei ACTIVE nur die Confidence-Konfiguration', async () => {
    prismaMock.session.findUnique.mockResolvedValue(buildSession('ACTIVE'));
    prismaMock.vote.count.mockResolvedValue(1);

    const result = await caller.getCurrentQuestionForStudent({ code: CODE });

    expect(result).toMatchObject({
      confidenceEnabled: true,
      confidenceLabelLow: 'Geraten',
      confidenceLabelHigh: 'Sehr sicher',
      totalVotes: 1,
    });
    expect(result).not.toHaveProperty('confidenceResult');
  });

  it('liefert Teilnehmenden bei RESULTS keine Confidence-Aggregate', async () => {
    prismaMock.session.findUnique.mockResolvedValue(buildSession('RESULTS'));
    prismaMock.vote.findMany.mockResolvedValue([
      {
        freeText: null,
        selectedAnswers: [{ answerOptionId: WRONG_ID }],
        isCorrect: false,
        confidenceValue: 5,
      },
      {
        freeText: null,
        selectedAnswers: [{ answerOptionId: RIGHT_ID }],
        isCorrect: true,
        confidenceValue: 2,
      },
    ]);

    const result = await caller.getCurrentQuestionForStudent({ code: CODE });

    expect(result).toMatchObject({
      confidenceEnabled: true,
      totalVotes: 2,
    });
    expect(result).not.toHaveProperty('confidenceResult');
  });

  it('exportiert confidenceResult für beendete Sessions mit aktiviertem Sicherheitsgrad', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      code: CODE,
      status: 'FINISHED',
      type: 'QUIZ',
      endedAt: new Date('2026-07-13T14:00:00.000Z'),
      answerDisplayOrder: null,
      quiz: {
        name: 'Confidence-Quiz',
        teamMode: false,
        teamCount: null,
        teamNames: [],
        questions: [buildConfidenceScQuestion()],
      },
      votes: [
        {
          questionId: QUESTION_ID,
          round: 1,
          score: 0,
          confidenceValue: 5,
          isCorrect: false,
          selectedAnswers: [
            {
              answerOptionId: WRONG_ID,
              answerOption: { id: WRONG_ID, text: '5', isCorrect: false },
            },
          ],
        },
        {
          questionId: QUESTION_ID,
          round: 1,
          score: 1000,
          confidenceValue: 1,
          isCorrect: true,
          selectedAnswers: [
            {
              answerOptionId: RIGHT_ID,
              answerOption: { id: RIGHT_ID, text: '4', isCorrect: true },
            },
          ],
        },
      ],
      bonusTokens: [],
      participants: [{ id: 'p1' }, { id: 'p2' }],
    });

    const result = await hostCaller.getExportData({ code: CODE });

    expect(result.questions[0]).toMatchObject({
      type: 'SINGLE_CHOICE',
      participantCount: 2,
      confidenceResult: {
        highConfidenceWrongCount: 1,
        crossTab: {
          correctHigh: 0,
          correctLow: 1,
          incorrectHigh: 1,
        },
        highConfidenceWrongOptions: [{ answerId: WRONG_ID, text: '5', count: 1 }],
      },
    });
  });

  it('exportiert confidenceResult aus Runde 2, wenn zweite Runde vorhanden ist', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      code: CODE,
      status: 'FINISHED',
      type: 'QUIZ',
      endedAt: new Date('2026-07-13T14:00:00.000Z'),
      answerDisplayOrder: null,
      quiz: {
        name: 'Confidence-Quiz',
        teamMode: false,
        teamCount: null,
        teamNames: [],
        questions: [buildConfidenceScQuestion({ numericTwoRounds: true })],
      },
      votes: [
        {
          questionId: QUESTION_ID,
          round: 1,
          score: 0,
          confidenceValue: 5,
          isCorrect: false,
          selectedAnswers: [
            {
              answerOptionId: WRONG_ID,
              answerOption: { id: WRONG_ID, text: '5', isCorrect: false },
            },
          ],
        },
        {
          questionId: QUESTION_ID,
          round: 2,
          score: 1000,
          confidenceValue: 2,
          isCorrect: true,
          selectedAnswers: [
            {
              answerOptionId: RIGHT_ID,
              answerOption: { id: RIGHT_ID, text: '4', isCorrect: true },
            },
          ],
        },
      ],
      bonusTokens: [],
      participants: [{ id: 'p1' }],
    });

    const result = await hostCaller.getExportData({ code: CODE });

    expect(result.questions[0]?.confidenceResult).toMatchObject({
      highConfidenceWrongCount: 0,
      crossTab: {
        correctHigh: 0,
        correctLow: 1,
        incorrectHigh: 0,
      },
    });
  });
});
