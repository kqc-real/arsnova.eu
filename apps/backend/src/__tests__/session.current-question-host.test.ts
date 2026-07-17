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

import {
  buildHostCurrentQuestionSubscriptionKey,
  resetVoteAggregationCachesForTests,
  sessionRouter,
} from '../routers/session';

const caller = sessionRouter.createCaller({ req: {} as never });
const CODE = 'ABC123';

describe('session.getCurrentQuestionForHost (Story 2.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostAuthMocks.extractHostTokenMock.mockReturnValue('host-token-123');
    hostAuthMocks.extractHostTokenFromConnectionParamsMock.mockReturnValue(null);
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(true);
    resetVoteAggregationCachesForTests();
    prismaMock.vote.findMany.mockResolvedValue([]);
    prismaMock.vote.count.mockResolvedValue(0);
  });

  it('liefert aktuelle Frage mit Antwortoptionen und isCorrect', async () => {
    const a1Id = 'aaaaaaaa-1111-4111-8111-111111111111';
    const a2Id = 'bbbbbbbb-2222-4222-8222-222222222222';
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      quiz: {
        questions: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            order: 0,
            text: 'Was ist 2+2?',
            type: 'SINGLE_CHOICE',
            difficulty: 'MEDIUM',
            answers: [
              { id: a1Id, text: '3', isCorrect: false },
              { id: a2Id, text: '4', isCorrect: true },
            ],
          },
        ],
      },
      currentQuestion: 0,
    });

    const result = await caller.getCurrentQuestionForHost({ code: CODE });

    expect(result).not.toBeNull();
    expect(result!.order).toBe(0);
    expect(result!.text).toBe('Was ist 2+2?');
    expect(result!.type).toBe('SINGLE_CHOICE');
    expect(result!.answers).toHaveLength(2);
    expect(result!.answers[0]).toEqual({ id: a1Id, text: '3', isCorrect: false });
    expect(result!.answers[1]).toEqual({ id: a2Id, text: '4', isCorrect: true });
  });

  it('skaliert den Host-Timer nach Schwierigkeitsgrad, wenn die Quiz-Option aktiv ist', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      status: 'ACTIVE',
      currentQuestion: 0,
      currentRound: 1,
      answerDisplayOrder: null,
      quiz: {
        defaultTimer: 40,
        timerScaleByDifficulty: true,
        preset: 'PLAYFUL',
        questions: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            order: 0,
            text: 'Transferfrage',
            type: 'SINGLE_CHOICE',
            difficulty: 'HARD',
            timer: null,
            ratingMin: null,
            ratingMax: null,
            ratingLabelMin: null,
            ratingLabelMax: null,
            answers: [
              { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: true },
              { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: false },
            ],
          },
        ],
      },
    });

    const result = await caller.getCurrentQuestionForHost({ code: CODE });

    expect(result).not.toBeNull();
    expect(result!.timer).toBe(80);
  });

  it('laesst einen expliziten Frage-Timer im Host unveraendert', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      status: 'ACTIVE',
      currentQuestion: 0,
      currentRound: 1,
      answerDisplayOrder: null,
      quiz: {
        defaultTimer: 40,
        timerScaleByDifficulty: true,
        preset: 'PLAYFUL',
        questions: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            order: 0,
            text: 'Transferfrage',
            type: 'SINGLE_CHOICE',
            difficulty: 'HARD',
            timer: 30,
            ratingMin: null,
            ratingMax: null,
            ratingLabelMin: null,
            ratingLabelMax: null,
            answers: [
              { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: true },
              { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: false },
            ],
          },
        ],
      },
    });

    const result = await caller.getCurrentQuestionForHost({ code: CODE });

    expect(result).not.toBeNull();
    expect(result!.timer).toBe(30);
  });

  it('liefert in Peer-Instruction-Runde 2 keinen Host-Timer mehr', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      status: 'ACTIVE',
      currentQuestion: 0,
      currentRound: 2,
      answerDisplayOrder: null,
      quiz: {
        defaultTimer: 40,
        timerScaleByDifficulty: true,
        preset: 'PLAYFUL',
        questions: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            order: 0,
            text: 'Transferfrage',
            type: 'SINGLE_CHOICE',
            difficulty: 'HARD',
            timer: 30,
            ratingMin: null,
            ratingMax: null,
            ratingLabelMin: null,
            ratingLabelMax: null,
            answers: [
              { id: 'aaaaaaaa-1111-4111-8111-111111111111', text: 'A', isCorrect: true },
              { id: 'bbbbbbbb-2222-4222-8222-222222222222', text: 'B', isCorrect: false },
            ],
          },
        ],
      },
    });

    const result = await caller.getCurrentQuestionForHost({ code: CODE });

    expect(result).not.toBeNull();
    expect(result!.timer).toBeNull();
  });

  it('liefert in aktiver Runde 1 nur Stimmenzahl plus Peer-Instruction-Empfehlung ohne Verteilung', async () => {
    const wrongId = 'aaaaaaaa-1111-4111-8111-111111111111';
    const correctId = 'bbbbbbbb-2222-4222-8222-222222222222';
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      status: 'ACTIVE',
      currentQuestion: 0,
      currentRound: 1,
      answerDisplayOrder: null,
      quiz: {
        defaultTimer: null,
        preset: 'SERIOUS',
        questions: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            order: 0,
            text: 'Was ist 2+2?',
            type: 'SINGLE_CHOICE',
            difficulty: 'MEDIUM',
            timer: null,
            ratingMin: null,
            ratingMax: null,
            ratingLabelMin: null,
            ratingLabelMax: null,
            answers: [
              { id: wrongId, text: '3', isCorrect: false },
              { id: correctId, text: '4', isCorrect: true },
            ],
          },
        ],
      },
    });
    prismaMock.vote.findMany.mockResolvedValue([
      { selectedAnswers: [{ answerOptionId: correctId }] },
      { selectedAnswers: [{ answerOptionId: correctId }] },
      { selectedAnswers: [{ answerOptionId: wrongId }] },
      { selectedAnswers: [{ answerOptionId: wrongId }] },
    ]);

    const result = await caller.getCurrentQuestionForHost({ code: CODE });

    expect(result).not.toBeNull();
    expect(result!.totalVotes).toBe(4);
    expect(result!.peerInstructionSuggestion).toEqual({
      suggested: true,
      reason: 'CORRECTNESS_WINDOW',
    });
    expect(result!.voteDistribution).toBeUndefined();
    expect(result!.correctVoterCount).toBeUndefined();
  });

  it('zaehlt aktive NUMERIC_ESTIMATE-Stimmen ohne Werte fuer Histogramme zu laden', async () => {
    const questionId = 'cccccccc-3333-4333-8333-333333333333';
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      status: 'ACTIVE',
      currentQuestion: 0,
      currentRound: 1,
      answerDisplayOrder: null,
      quiz: {
        defaultTimer: null,
        preset: 'SERIOUS',
        questions: [
          {
            id: questionId,
            order: 0,
            text: 'Schaetze den Messwert.',
            type: 'NUMERIC_ESTIMATE',
            difficulty: 'MEDIUM',
            timer: null,
            numericToleranceMode: 'ABSOLUTE_INTERVAL',
            numericReferenceValue: 100,
            numericTolerancePercent: null,
            numericIntervalLeft: 95,
            numericIntervalRight: 105,
            numericInputType: 'DECIMAL',
            numericDecimalPlaces: 1,
            numericMin: 0,
            numericMax: 200,
            numericTwoRounds: true,
            answers: [],
          },
        ],
      },
    });
    prismaMock.vote.count.mockResolvedValueOnce(4);

    const result = await caller.getCurrentQuestionForHost({ code: CODE });

    expect(result).toMatchObject({
      type: 'NUMERIC_ESTIMATE',
      totalVotes: 4,
    });
    expect(result?.peerInstructionSuggestion).toBeUndefined();
    expect(result?.numericStats).toBeUndefined();
    expect(result?.numericHistogram).toBeUndefined();
    expect(prismaMock.vote.findMany).not.toHaveBeenCalled();
    expect(prismaMock.vote.count).toHaveBeenCalledTimes(1);
    expect(prismaMock.vote.count).toHaveBeenNthCalledWith(1, {
      where: {
        sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
        questionId,
        round: 1,
      },
    });
  });

  it('liefert aktiven NUMERIC_ESTIMATE-Fortschritt ohne Rohwerte oder Histogramme zu laden', async () => {
    const questionId = 'cccccccc-3333-4333-8333-333333333333';
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      code: CODE,
      status: 'ACTIVE',
      currentQuestion: 0,
      currentRound: 1,
      quiz: {
        questions: [
          {
            id: questionId,
            order: 0,
            type: 'NUMERIC_ESTIMATE',
            answers: [],
          },
        ],
      },
    });
    prismaMock.vote.count.mockResolvedValueOnce(17);

    const result = await caller.getHostVoteProgress({ code: CODE });

    expect(result).toEqual({
      questionId,
      questionOrder: 0,
      round: 1,
      totalVotes: 17,
    });
    expect(prismaMock.vote.findMany).not.toHaveBeenCalled();
  });

  it('liefert Choice-Fortschritt mit Peer-Instruction-Signal ohne Vote-Verteilung', async () => {
    const questionId = '11111111-1111-4111-8111-111111111111';
    const correctId = 'aaaaaaaa-1111-4111-8111-111111111111';
    const wrongId = 'bbbbbbbb-2222-4222-8222-222222222222';
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      code: CODE,
      status: 'ACTIVE',
      currentQuestion: 0,
      currentRound: 1,
      quiz: {
        questions: [
          {
            id: questionId,
            order: 0,
            type: 'SINGLE_CHOICE',
            answers: [
              { id: correctId, text: '4', isCorrect: true },
              { id: wrongId, text: '3', isCorrect: false },
            ],
          },
        ],
      },
    });
    prismaMock.vote.findMany.mockResolvedValue([
      { selectedAnswers: [{ answerOptionId: correctId }] },
      { selectedAnswers: [{ answerOptionId: correctId }] },
      { selectedAnswers: [{ answerOptionId: wrongId }] },
      { selectedAnswers: [{ answerOptionId: wrongId }] },
    ]);

    const result = await caller.getHostVoteProgress({ code: CODE });

    expect(result).toEqual({
      questionId,
      questionOrder: 0,
      round: 1,
      totalVotes: 4,
      correctVoterCount: 2,
      incorrectVoterCount: 2,
      peerInstructionSuggestion: {
        suggested: true,
        reason: 'CORRECTNESS_WINDOW',
      },
    });
  });

  it('ignoriert reine ACTIVE-Fortschrittswerte im Host-Current-Question-Subscription-Key', () => {
    const basePayload = {
      questionId: 'cccccccc-3333-4333-8333-333333333333',
      order: 0,
      totalQuestions: 1,
      text: 'In welchem Jahr begann die Franzoesische Revolution?',
      type: 'NUMERIC_ESTIMATE' as const,
      difficulty: 'MEDIUM' as const,
      showQuestionTypeIndicators: true,
      timer: null,
      answers: [],
      currentRound: 1,
      numericToleranceMode: 'ABSOLUTE_INTERVAL' as const,
      numericReferenceValue: 1789,
      numericTolerancePercent: null,
      numericIntervalLeft: 1700,
      numericIntervalRight: 1900,
      numericInputType: 'INTEGER' as const,
      numericDecimalPlaces: 0,
      numericMin: 1500,
      numericMax: 2000,
      numericTwoRounds: false,
    };

    expect(
      buildHostCurrentQuestionSubscriptionKey({
        status: 'ACTIVE',
        payload: { ...basePayload, totalVotes: 0 },
      }),
    ).toBe(
      buildHostCurrentQuestionSubscriptionKey({
        status: 'ACTIVE',
        payload: { ...basePayload, totalVotes: 600 },
      }),
    );
  });

  it('behaelt Ergebnisdaten im Host-Current-Question-Subscription-Key', () => {
    const basePayload = {
      questionId: 'cccccccc-3333-4333-8333-333333333333',
      order: 0,
      totalQuestions: 1,
      text: 'In welchem Jahr begann die Franzoesische Revolution?',
      type: 'NUMERIC_ESTIMATE' as const,
      difficulty: 'MEDIUM' as const,
      showQuestionTypeIndicators: true,
      timer: null,
      answers: [],
      currentRound: 1,
      numericToleranceMode: 'ABSOLUTE_INTERVAL' as const,
      numericReferenceValue: 1789,
      numericTolerancePercent: null,
      numericIntervalLeft: 1700,
      numericIntervalRight: 1900,
      numericInputType: 'INTEGER' as const,
      numericDecimalPlaces: 0,
      numericMin: 1500,
      numericMax: 2000,
      numericTwoRounds: false,
    };

    expect(
      buildHostCurrentQuestionSubscriptionKey({
        status: 'RESULTS',
        payload: { ...basePayload, totalVotes: 0 },
      }),
    ).not.toBe(
      buildHostCurrentQuestionSubscriptionKey({
        status: 'RESULTS',
        payload: {
          ...basePayload,
          totalVotes: 600,
          numericStats: {
            n: 600,
            mean: 1789,
            median: 1789,
            stdDev: 0,
            min: 1789,
            max: 1789,
            q1: 1789,
            q3: 1789,
            iqr: 0,
            inBandCount: 600,
            inBandPercent: 100,
            meanAbsoluteError: 0,
            meanRelativeError: 0,
          },
        },
      }),
    );
  });

  it('ignoriert unpassende absolute Referenzwerte fuer Host-Statistiken', async () => {
    const questionId = 'cccccccc-3333-4333-8333-333333333333';
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      status: 'RESULTS',
      currentQuestion: 0,
      currentRound: 1,
      answerDisplayOrder: null,
      quiz: {
        defaultTimer: null,
        timerScaleByDifficulty: true,
        showQuestionTypeIndicators: true,
        preset: 'SERIOUS',
        questions: [
          {
            id: questionId,
            order: 0,
            text: 'In welchem Jahr war die Revolution?',
            type: 'NUMERIC_ESTIMATE',
            difficulty: 'MEDIUM',
            timer: null,
            numericToleranceMode: 'ABSOLUTE_INTERVAL',
            numericReferenceValue: -1,
            numericTolerancePercent: null,
            numericIntervalLeft: 1700,
            numericIntervalRight: 1800,
            numericInputType: 'INTEGER',
            numericDecimalPlaces: null,
            numericMin: null,
            numericMax: null,
            numericTwoRounds: false,
            answers: [],
          },
        ],
      },
    });
    prismaMock.vote.findMany.mockResolvedValue([{ numericValue: 1789 }]);

    const result = await caller.getCurrentQuestionForHost({ code: CODE });

    expect(result).toMatchObject({
      type: 'NUMERIC_ESTIMATE',
      totalVotes: 1,
      numericReferenceValue: null,
      numericStats: {
        n: 1,
        mean: 1789,
        median: 1789,
        inBandCount: 1,
        inBandPercent: 100,
        meanAbsoluteError: null,
        meanRelativeError: null,
      },
    });
    expect(result?.numericHistogram).toHaveLength(10);
    const histogramEdges = result?.numericHistogram?.flatMap((bin) => [bin.from, bin.to]) ?? [];
    expect(histogramEdges).toContain(1700);
    expect(histogramEdges).toContain(1800);
    const nonEmptyBins = result?.numericHistogram?.filter((bin) => bin.count > 0) ?? [];
    expect(nonEmptyBins).toHaveLength(1);
    expect(nonEmptyBins[0]).toMatchObject({ count: 1 });
    expect(nonEmptyBins[0]!.from).toBeLessThanOrEqual(1789);
    expect(nonEmptyBins[0]!.to).toBeGreaterThanOrEqual(1789);
  });

  it('berechnet Runde-2-Schaetzfragen-Ergebnisse und Vergleich aus einer gemeinsamen Vote-Abfrage', async () => {
    const questionId = 'cccccccc-3333-4333-8333-333333333333';
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      status: 'RESULTS',
      currentQuestion: 0,
      currentRound: 2,
      answerDisplayOrder: null,
      quiz: {
        defaultTimer: null,
        timerScaleByDifficulty: true,
        showQuestionTypeIndicators: true,
        preset: 'SERIOUS',
        questions: [
          {
            id: questionId,
            order: 0,
            text: 'In welchem Jahr war die Revolution?',
            type: 'NUMERIC_ESTIMATE',
            difficulty: 'MEDIUM',
            timer: null,
            numericToleranceMode: 'ABSOLUTE_INTERVAL',
            numericReferenceValue: 1789,
            numericTolerancePercent: null,
            numericIntervalLeft: 1700,
            numericIntervalRight: 1800,
            numericInputType: 'INTEGER',
            numericDecimalPlaces: null,
            numericMin: null,
            numericMax: null,
            numericTwoRounds: true,
            answers: [],
          },
        ],
      },
    });
    prismaMock.vote.findMany.mockResolvedValue([
      { participantId: 'p1', round: 1, numericValue: 1770 },
      { participantId: 'p2', round: 1, numericValue: 1810 },
      { participantId: 'p1', round: 2, numericValue: 1789 },
      { participantId: 'p2', round: 2, numericValue: 1790 },
    ]);

    const result = await caller.getCurrentQuestionForHost({ code: CODE });

    expect(result).toMatchObject({
      type: 'NUMERIC_ESTIMATE',
      totalVotes: 2,
      numericStats: expect.objectContaining({
        n: 2,
        mean: 1789.5,
        inBandPercent: 100,
      }),
      numericRoundComparison: expect.objectContaining({
        pairedAnalysis: {
          pairedCount: 2,
          closerCount: 2,
          fartherCount: 0,
          unchangedCount: 0,
        },
      }),
    });
    expect(prismaMock.vote.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.vote.findMany).toHaveBeenCalledWith({
      where: {
        sessionId: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
        questionId,
        round: { in: [1, 2] },
      },
      select: { participantId: true, round: true, numericValue: true },
    });
  });

  it('liefert keine Peer-Instruction-Empfehlung wenn Anteil vollstaendig korrekter Stimmen unter 35 %', async () => {
    const wrongId = 'aaaaaaaa-1111-4111-8111-111111111111';
    const correctId = 'bbbbbbbb-2222-4222-8222-222222222222';
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      status: 'ACTIVE',
      currentQuestion: 0,
      currentRound: 1,
      answerDisplayOrder: null,
      quiz: {
        defaultTimer: null,
        preset: 'SERIOUS',
        questions: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            order: 0,
            text: 'Was ist 2+2?',
            type: 'SINGLE_CHOICE',
            difficulty: 'MEDIUM',
            timer: null,
            ratingMin: null,
            ratingMax: null,
            ratingLabelMin: null,
            ratingLabelMax: null,
            answers: [
              { id: wrongId, text: '3', isCorrect: false },
              { id: correctId, text: '4', isCorrect: true },
            ],
          },
        ],
      },
    });
    prismaMock.vote.findMany.mockResolvedValue([
      { selectedAnswers: [{ answerOptionId: correctId }] },
      { selectedAnswers: [{ answerOptionId: wrongId }] },
      { selectedAnswers: [{ answerOptionId: wrongId }] },
      { selectedAnswers: [{ answerOptionId: wrongId }] },
    ]);

    const result = await caller.getCurrentQuestionForHost({ code: CODE });

    expect(result).not.toBeNull();
    expect(result!.totalVotes).toBe(4);
    expect(result!.peerInstructionSuggestion).toBeUndefined();
  });

  it('liefert null wenn keine Session', async () => {
    prismaMock.session.findUnique.mockResolvedValue(null);

    const result = await caller.getCurrentQuestionForHost({ code: 'NONEXI' });

    expect(result).toBeNull();
  });

  it('liefert null wenn currentQuestion null (noch in Lobby)', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      currentQuestion: null,
      quiz: {
        questions: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            order: 0,
            text: 'Frage',
            type: 'SINGLE_CHOICE',
            difficulty: 'MEDIUM',
            answers: [],
          },
        ],
      },
    });

    const result = await caller.getCurrentQuestionForHost({ code: CODE });

    expect(result).toBeNull();
  });

  it('liefert null wenn kein Quiz (Q&A-Session)', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      currentQuestion: 0,
      quiz: null,
    });

    const result = await caller.getCurrentQuestionForHost({ code: CODE });

    expect(result).toBeNull();
  });

  it('aggregiert SHORT_TEXT-Ergebnisse mit richtigen und falschen Antworten', async () => {
    const solutionId = 'aaaaaaaa-1111-4111-8111-111111111111';
    const aliasId = 'bbbbbbbb-2222-4222-8222-222222222222';
    prismaMock.session.findUnique.mockResolvedValue({
      id: '6a8edced-5f8f-4cfa-9176-454fac9570ad',
      code: CODE,
      status: 'RESULTS',
      currentQuestion: 0,
      currentRound: 1,
      answerDisplayOrder: null,
      quiz: {
        defaultTimer: null,
        timerScaleByDifficulty: true,
        showQuestionTypeIndicators: true,
        preset: 'SERIOUS',
        questions: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            order: 0,
            text: 'Wer schrieb den ersten Algorithmus?',
            type: 'SHORT_TEXT',
            difficulty: 'MEDIUM',
            timer: null,
            ratingMin: null,
            ratingMax: null,
            ratingLabelMin: null,
            ratingLabelMax: null,
            shortTextMaxLength: 40,
            shortTextCaseSensitive: false,
            answers: [
              { id: solutionId, text: 'Ada Lovelace', isCorrect: true },
              { id: aliasId, text: 'Ada', isCorrect: true },
            ],
          },
        ],
      },
    });
    prismaMock.vote.findMany.mockResolvedValue([
      { freeText: ' ada   lovelace ' },
      { freeText: 'Grace Hopper' },
      { freeText: 'Ada' },
    ]);

    const result = await caller.getCurrentQuestionForHost({ code: CODE });

    expect(result).toMatchObject({
      type: 'SHORT_TEXT',
      totalVotes: 3,
      correctVoterCount: 2,
      incorrectVoterCount: 1,
      shortTextMaxLength: 40,
      shortTextCaseSensitive: false,
      incorrectFreeTextResponses: ['Grace Hopper'],
    });
    expect(result?.voteDistribution).toEqual([
      {
        id: solutionId,
        text: 'Ada Lovelace',
        isCorrect: true,
        voteCount: 1,
        votePercentage: 33,
      },
      {
        id: aliasId,
        text: 'Ada',
        isCorrect: true,
        voteCount: 1,
        votePercentage: 33,
      },
    ]);
  });

  it('lehnt die Host-Abfrage ohne gültigen Token ab', async () => {
    hostAuthMocks.isHostSessionTokenValidMock.mockResolvedValue(false);

    await expect(caller.getCurrentQuestionForHost({ code: CODE })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Host-Session ungültig oder abgelaufen.',
    });
  });
});
