import type { Prisma } from '@prisma/client';
import {
  ModerationQuestionsSectionSchema,
  ModerationTopicsSectionSchema,
  calculateModerationQaBestScoreV1,
  calculateModerationQaControversyScoreV1,
} from '@arsnova/shared-types';
import { describe, expect, it, vi } from 'vitest';
import type { AuthorizedModerationState } from './moderationQaContext';
import {
  buildCompassContext,
  collectReleasedQuizSignals,
  type ReleasedQuizProjection,
  type ReleasedQuizRow,
} from './moderationTeachingSignals';
import type { QuickFeedbackModerationProjection } from './quickFeedbackModerationSnapshot';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const QUIZ_ID = '22222222-2222-4222-8222-222222222222';
const QUESTION_ID = '33333333-3333-4333-8333-333333333333';
const OPTION_A = '44444444-4444-4444-8444-444444444444';
const OPTION_B = '55555555-5555-4555-8555-555555555555';

function state(overrides: Partial<AuthorizedModerationState> = {}): AuthorizedModerationState {
  return {
    id: SESSION_ID,
    code: 'ABC123',
    type: 'QUIZ',
    status: 'RESULTS',
    currentQuestion: 0,
    currentRound: 2,
    questionProgress: {
      [QUESTION_ID]: {
        state: 'COMPLETED',
        openedAt: '2026-10-04T09:00:00.000Z',
        completedAt: '2026-10-04T09:05:00.000Z',
      },
    },
    questionProgressComplete: true,
    quizId: QUIZ_ID,
    endedAt: null,
    expiresAt: new Date('2026-10-05T10:00:00.000Z'),
    qaEnabled: false,
    qaOpen: false,
    qaClosesAt: null,
    quickFeedbackEnabled: true,
    quickFeedbackOpen: true,
    participantCount: 3,
    sessionLifecycleRevision: 1,
    qaRankingRevision: 0,
    participantRevision: 3,
    learningContextRevision: 4,
    learningContextConfigured: true,
    activeSortMode: 'BEST',
    authorizedAt: new Date('2026-10-04T10:00:00.000Z'),
    ...overrides,
  };
}

function row(overrides: Partial<ReleasedQuizRow> = {}): ReleasedQuizRow {
  return {
    questionId: QUESTION_ID,
    text: 'Which explanation is best?',
    type: 'MULTIPLE_CHOICE',
    order: 0,
    ratingMin: null,
    ratingMax: null,
    numericToleranceMode: null,
    numericReferenceValue: null,
    numericTolerancePercent: null,
    numericIntervalLeft: null,
    numericIntervalRight: null,
    matchingPairs: null,
    orderingItems: null,
    categories: null,
    categorizationItems: null,
    participantCount: 3n,
    scopeCount: 1n,
    effectiveRound: 2n,
    effectiveResponseCount: 2n,
    correctCount: 0n,
    incorrectCount: 2n,
    unansweredCount: 0n,
    round1ResponseCount: 3n,
    round1CorrectCount: 2n,
    round1IncorrectCount: 1n,
    round2ResponseCount: 2n,
    round2CorrectCount: 0n,
    round2IncorrectCount: 2n,
    options: [
      { id: OPTION_A, text: 'First', isCorrect: false, count: 2 },
      { id: OPTION_B, text: 'Second', isCorrect: true, count: 0 },
    ],
    ratingValueCount: 0n,
    ratingBuckets: [],
    numericValueCount: 0n,
    numericValues: [],
    round1NumericValueCount: 0n,
    round1NumericValues: [],
    round2NumericValueCount: 0n,
    round2NumericValues: [],
    numericPairCount: 0n,
    numericPairs: [],
    factVotes: [],
    ...overrides,
  };
}

function txWithRows(rows: readonly ReleasedQuizRow[]) {
  return { $queryRaw: vi.fn().mockResolvedValue(rows) } as unknown as Prisma.TransactionClient;
}

function noFeedback(): QuickFeedbackModerationProjection {
  return {
    feedback: { state: 'unavailable', reason: 'no-data' },
    sources: [],
    limitations: [],
    revision: { state: 'unavailable', reason: 'no-data' },
    fingerprint: 'feedback:missing',
    ruleInput: null,
  };
}

describe('collectReleasedQuizSignals', () => {
  it('uses only explicit COMPLETED progress states', async () => {
    const tx = txWithRows([row()]);
    const progress = {
      [QUESTION_ID]: {
        state: 'OPENED',
        openedAt: '2026-10-04T09:00:00.000Z',
      },
      '66666666-6666-4666-8666-666666666666': {
        state: 'SKIPPED',
        openedAt: '2026-10-04T09:01:00.000Z',
        skippedAt: '2026-10-04T09:02:00.000Z',
      },
    };

    const result = await collectReleasedQuizSignals({
      tx,
      state: state({ questionProgress: progress }),
    });

    expect(result.releasedResults.state).toBe('not-released');
    expect(tx.$queryRaw as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
    expect(result.sources).toEqual([]);
  });

  it('applies whole-question round-2 replacement and keeps complete zero buckets', async () => {
    const tx = txWithRows([row()]);
    const result = await collectReleasedQuizSignals({ tx, state: state() });

    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(result.releasedResults.state).toBe('available');
    const answer = result.sources.find(
      (source) =>
        source.kind === 'quiz-result-aggregate' &&
        source.aggregation.rule === 'answer-distribution',
    );
    expect(answer).toMatchObject({
      population: { eligible: 3, included: 2 },
      aggregation: {
        responseCount: 2,
        selectionCount: 2,
        buckets: [
          { optionId: `answer-option:${OPTION_A}`, count: 2 },
          { optionId: `answer-option:${OPTION_B}`, count: 0 },
        ],
      },
    });
    const correctness = result.sources.find(
      (source) =>
        source.kind === 'quiz-result-aggregate' &&
        source.aggregation.rule === 'correctness-summary',
    );
    expect(correctness).toMatchObject({
      aggregation: {
        correct: 0,
        incorrect: 2,
        unanswered: 0,
        roundComparison: {
          round1: { responseCount: 3, correct: 2, incorrect: 1 },
          round2: { responseCount: 2, correct: 0, incorrect: 2 },
        },
      },
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('participantId');
    expect(serialized).not.toContain('nickname');
    expect(serialized).not.toContain('isCorrect');
    expect(serialized).not.toContain('rank');
    expect(serialized).not.toContain('bonus');
  });

  it('keeps a completed supported question available with zero measured responses', async () => {
    const result = await collectReleasedQuizSignals({
      tx: txWithRows([
        row({
          effectiveRound: 1n,
          effectiveResponseCount: 0n,
          correctCount: 0n,
          incorrectCount: 0n,
          round1ResponseCount: 0n,
          round1CorrectCount: 0n,
          round1IncorrectCount: 0n,
          round2ResponseCount: 0n,
          round2CorrectCount: 0n,
          round2IncorrectCount: 0n,
          options: [
            { id: OPTION_A, text: 'First', isCorrect: false, count: 0 },
            { id: OPTION_B, text: 'Second', isCorrect: true, count: 0 },
          ],
        }),
      ]),
      state: state(),
    });

    expect(result.releasedResults.state).toBe('available');
    expect(result.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'quiz-result-aggregate',
          population: expect.objectContaining({ included: 0 }),
        }),
      ]),
    );
    expect(result.insights.every((insight) => insight.facts.length === 0)).toBe(true);
  });

  it('omits an invalid legacy correctness comparison when round 2 has no scored response', async () => {
    const result = await collectReleasedQuizSignals({
      tx: txWithRows([
        row({
          effectiveRound: 2n,
          effectiveResponseCount: 1n,
          correctCount: 0n,
          incorrectCount: 0n,
          unansweredCount: 1n,
          round1ResponseCount: 2n,
          round1CorrectCount: 1n,
          round1IncorrectCount: 1n,
          round2ResponseCount: 0n,
          round2CorrectCount: 0n,
          round2IncorrectCount: 0n,
          options: [
            { id: OPTION_A, text: 'First', isCorrect: false, count: 1 },
            { id: OPTION_B, text: 'Second', isCorrect: true, count: 0 },
          ],
        }),
      ]),
      state: state(),
    });

    const correctness = result.sources.find(
      (source) =>
        source.kind === 'quiz-result-aggregate' &&
        source.aggregation.rule === 'correctness-summary',
    );
    expect(correctness).toMatchObject({
      aggregation: { correct: 0, incorrect: 0, unanswered: 1 },
    });
    expect(correctness).not.toHaveProperty('aggregation.roundComparison');
  });

  it('preserves strictly increasing histogram edges for an ultra-narrow expected band', async () => {
    const result = await collectReleasedQuizSignals({
      tx: txWithRows([
        row({
          type: 'NUMERIC_ESTIMATE',
          numericToleranceMode: 'ABSOLUTE_INTERVAL',
          numericIntervalLeft: 0.00001,
          numericIntervalRight: 0.00002,
          effectiveRound: 1n,
          effectiveResponseCount: 1n,
          correctCount: 0n,
          incorrectCount: 0n,
          unansweredCount: 1n,
          numericValueCount: 1n,
          numericValues: [0],
          round1NumericValueCount: 1n,
          round1NumericValues: [0],
          round2NumericValues: [],
          options: [],
        }),
      ]),
      state: state(),
    });

    const numeric = result.sources.find(
      (source) =>
        source.kind === 'quiz-result-aggregate' && source.aggregation.rule === 'numeric-summary',
    );
    if (!numeric || numeric.kind !== 'quiz-result-aggregate') {
      throw new Error('missing numeric aggregate');
    }
    if (numeric.aggregation.rule !== 'numeric-summary') throw new Error('wrong aggregate');
    const histogram = numeric.aggregation.histogram;
    if (!histogram) throw new Error('missing numeric histogram');
    expect(histogram).toHaveLength(10);
    expect(histogram.every((bucket) => bucket.from < bucket.to)).toBe(true);
    expect(histogram.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(1);
  });

  it('keeps exact-match numeric summaries without inventing a zero-width histogram', async () => {
    const values = [100, 100, 101];
    const result = await collectReleasedQuizSignals({
      tx: txWithRows([
        row({
          type: 'NUMERIC_ESTIMATE',
          participantCount: 3n,
          numericToleranceMode: 'RELATIVE_PERCENT',
          numericReferenceValue: 100,
          numericTolerancePercent: 0,
          effectiveRound: 1n,
          effectiveResponseCount: 3n,
          correctCount: 0n,
          incorrectCount: 0n,
          unansweredCount: 3n,
          numericValueCount: 3n,
          numericValues: values,
          round1NumericValueCount: 3n,
          round1NumericValues: values,
          round2NumericValues: [],
          options: [],
        }),
      ]),
      state: state({ participantCount: 3 }),
    });

    const numeric = result.sources.find(
      (source) =>
        source.kind === 'quiz-result-aggregate' && source.aggregation.rule === 'numeric-summary',
    );
    if (!numeric || numeric.kind !== 'quiz-result-aggregate') {
      throw new Error('missing numeric aggregate');
    }
    if (numeric.aggregation.rule !== 'numeric-summary') throw new Error('wrong aggregate');
    expect(numeric.aggregation).toMatchObject({
      responseCount: 3,
      inBandCount: 2,
      inBandPercent: (2 / 3) * 100,
    });
    expect(numeric.aggregation).not.toHaveProperty('histogram');
    expect(result.insights[0]?.facts.map(({ kind }) => kind)).not.toContain('histogram-peak-out');
  });

  it('preserves the existing numeric-spread rule from contract-serialized evidence', async () => {
    const values = [-10, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 10];
    const result = await collectReleasedQuizSignals({
      tx: txWithRows([
        row({
          type: 'NUMERIC_ESTIMATE',
          participantCount: 8n,
          numericToleranceMode: 'ABSOLUTE_INTERVAL',
          numericIntervalLeft: 0,
          numericIntervalRight: 1,
          effectiveRound: 1n,
          effectiveResponseCount: 8n,
          correctCount: 0n,
          incorrectCount: 0n,
          unansweredCount: 8n,
          numericValueCount: 8n,
          numericValues: values,
          round1NumericValueCount: 8n,
          round1NumericValues: values,
          round2NumericValues: [],
          options: [],
        }),
      ]),
      state: state({ participantCount: 8 }),
    });

    const numericInsight = result.insights[0];
    expect(numericInsight?.facts.map(({ kind }) => kind)).toContain('numeric-spread');
    const compass = buildCompassContext({ released: result, feedback: noFeedback() });
    expect(compass.compass).toMatchObject({
      state: 'available',
      signals: [
        expect.objectContaining({
          signal: 'result-pattern',
          reason: expect.stringContaining('broadly dispersed'),
        }),
      ],
    });
    expect(JSON.stringify(compass)).not.toContain('referenceValue');
  });

  it('keeps responses on the inclusive upper tolerance edge inside the histogram band', async () => {
    const values = Array(8).fill(1);
    const result = await collectReleasedQuizSignals({
      tx: txWithRows([
        row({
          type: 'NUMERIC_ESTIMATE',
          participantCount: 8n,
          numericToleranceMode: 'ABSOLUTE_INTERVAL',
          numericIntervalLeft: 0,
          numericIntervalRight: 1,
          effectiveRound: 1n,
          effectiveResponseCount: 8n,
          correctCount: 0n,
          incorrectCount: 0n,
          unansweredCount: 8n,
          numericValueCount: 8n,
          numericValues: values,
          round1NumericValueCount: 8n,
          round1NumericValues: values,
          options: [],
        }),
      ]),
      state: state({ participantCount: 8 }),
    });

    const numeric = result.sources.find(
      (source) =>
        source.kind === 'quiz-result-aggregate' && source.aggregation.rule === 'numeric-summary',
    );
    if (!numeric || numeric.kind !== 'quiz-result-aggregate') throw new Error('missing aggregate');
    if (numeric.aggregation.rule !== 'numeric-summary') throw new Error('wrong aggregate');
    const histogram = numeric.aggregation.histogram;
    if (!histogram) throw new Error('missing numeric histogram');
    expect(numeric.aggregation.inBandPercent).toBe(100);
    expect(
      histogram.filter((bucket) => bucket.inBand).reduce((sum, bucket) => sum + bucket.count, 0),
    ).toBe(8);
    expect(result.insights[0]?.facts.map(({ kind }) => kind)).not.toContain('histogram-peak-out');
  });

  it('derives wrong-option parity internally without serializing solution flags', async () => {
    const result = await collectReleasedQuizSignals({ tx: txWithRows([row()]), state: state() });

    expect(result.insights[0]?.facts.map(({ kind }) => kind)).toContain('wrong-option');
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('isCorrect');
    expect(serialized).not.toContain('authoritative released evaluation found A');
  });

  it('derives numeric-median parity without serializing the reference value', async () => {
    const result = await collectReleasedQuizSignals({
      tx: txWithRows([
        row({
          type: 'NUMERIC_ESTIMATE',
          participantCount: 2n,
          numericToleranceMode: 'RELATIVE_PERCENT',
          numericReferenceValue: 100,
          numericTolerancePercent: 10,
          effectiveRound: 1n,
          effectiveResponseCount: 2n,
          correctCount: 0n,
          incorrectCount: 0n,
          unansweredCount: 2n,
          numericValueCount: 2n,
          numericValues: [60, 60],
          round1NumericValueCount: 2n,
          round1NumericValues: [60, 60],
          round2NumericValues: [],
          options: [],
        }),
      ]),
      state: state({ participantCount: 2 }),
    });

    expect(result.insights[0]?.facts.map(({ kind }) => kind)).toContain('numeric-median');
    expect(JSON.stringify(result)).not.toContain('numericReferenceValue');
    expect(JSON.stringify(result)).not.toContain('"reference":100');
  });

  it('derives matching-confusion parity from bounded identity-free selections', async () => {
    const secretLeft = 'LEFT_DETAIL_MUST_NOT_SERIALIZE';
    const secretRight = 'RIGHT_DETAIL_MUST_NOT_SERIALIZE';
    const result = await collectReleasedQuizSignals({
      tx: txWithRows([
        row({
          type: 'MATCHING',
          matchingPairs: [
            { leftId: 'left-1', left: secretLeft, rightId: 'right-1', right: 'Correct one' },
            { leftId: 'left-2', left: 'Second', rightId: 'right-2', right: secretRight },
          ],
          options: [],
          factVotes: [
            {
              matchingSelections: [
                { leftId: 'left-1', rightId: 'right-2' },
                { leftId: 'left-2', rightId: 'right-1' },
              ],
            },
            {
              matchingSelections: [
                { leftId: 'left-1', rightId: 'right-2' },
                { leftId: 'left-2', rightId: 'right-1' },
              ],
            },
          ],
        }),
      ]),
      state: state(),
    });

    expect(result.insights[0]?.facts.map(({ kind }) => kind)).toContain('matching-confusion');
    expect(JSON.stringify(result)).not.toContain(secretLeft);
    expect(JSON.stringify(result)).not.toContain(secretRight);
  });

  it('derives ordering-swap parity from bounded identity-free sequences', async () => {
    const result = await collectReleasedQuizSignals({
      tx: txWithRows([
        row({
          type: 'ORDERING',
          orderingItems: [
            { id: 'item-a', text: 'ORDER_A_MUST_NOT_SERIALIZE' },
            { id: 'item-b', text: 'ORDER_B_MUST_NOT_SERIALIZE' },
            { id: 'item-c', text: 'Third' },
          ],
          options: [],
          factVotes: [
            { orderingSequence: ['item-b', 'item-a', 'item-c'] },
            { orderingSequence: ['item-b', 'item-a', 'item-c'] },
          ],
        }),
      ]),
      state: state(),
    });

    expect(result.insights[0]?.facts.map(({ kind }) => kind)).toContain('ordering-swap');
    expect(JSON.stringify(result)).not.toContain('ORDER_A_MUST_NOT_SERIALIZE');
    expect(JSON.stringify(result)).not.toContain('ORDER_B_MUST_NOT_SERIALIZE');
  });

  it('derives categorization-miss parity from bounded identity-free selections', async () => {
    const result = await collectReleasedQuizSignals({
      tx: txWithRows([
        row({
          type: 'CATEGORIZATION',
          categories: [
            { id: 'category-a', name: 'CATEGORY_A_MUST_NOT_SERIALIZE' },
            { id: 'category-b', name: 'CATEGORY_B_MUST_NOT_SERIALIZE' },
          ],
          categorizationItems: [
            {
              id: 'category-item',
              text: 'ITEM_DETAIL_MUST_NOT_SERIALIZE',
              correctCategoryId: 'category-a',
            },
          ],
          options: [],
          factVotes: [
            {
              categorizationSelections: [{ itemId: 'category-item', categoryId: 'category-b' }],
            },
            {
              categorizationSelections: [{ itemId: 'category-item', categoryId: 'category-b' }],
            },
          ],
        }),
      ]),
      state: state(),
    });

    expect(result.insights[0]?.facts.map(({ kind }) => kind)).toContain('categorization-miss');
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('CATEGORY_A_MUST_NOT_SERIALIZE');
    expect(serialized).not.toContain('CATEGORY_B_MUST_NOT_SERIALIZE');
    expect(serialized).not.toContain('ITEM_DETAIL_MUST_NOT_SERIALIZE');
  });

  it.each(['FREETEXT', 'SHORT_TEXT'] as const)(
    'publishes only count-based repeated patterns for %s and keeps text internal',
    async (type) => {
      const secret = 'REPEATED_RESPONSE_MUST_NOT_SERIALIZE';
      const result = await collectReleasedQuizSignals({
        tx: txWithRows([
          row({
            type,
            participantCount: 2n,
            effectiveRound: 1n,
            effectiveResponseCount: 2n,
            correctCount: 0n,
            incorrectCount: 0n,
            unansweredCount: 2n,
            round1ResponseCount: 0n,
            round1CorrectCount: 0n,
            round1IncorrectCount: 0n,
            round2ResponseCount: 0n,
            round2CorrectCount: 0n,
            round2IncorrectCount: 0n,
            options: [],
            factVotes: [{ freeText: `  ${secret}  ` }, { freeText: secret }],
          }),
        ]),
        state: state({ participantCount: 2 }),
      });

      const pattern = result.sources.find(
        (source) =>
          source.kind === 'quiz-result-aggregate' &&
          source.aggregation.rule === 'freetext-pattern-summary',
      );
      expect(pattern).toMatchObject({
        population: { eligible: 2, included: 2 },
        aggregation: { responseCount: 2, repeatedPatterns: [{ count: 2 }] },
      });
      expect(result.insights[0]?.facts.map(({ kind }) => kind)).toContain('freetext-repeat');
      expect(JSON.stringify(result)).not.toContain(secret);
    },
  );

  it('keeps a valid multi-select survey aggregate and its survey fact', async () => {
    const result = await collectReleasedQuizSignals({
      tx: txWithRows([
        row({
          type: 'SURVEY',
          effectiveRound: 1n,
          effectiveResponseCount: 1n,
          correctCount: 0n,
          incorrectCount: 0n,
          unansweredCount: 1n,
          round1ResponseCount: 0n,
          round1CorrectCount: 0n,
          round1IncorrectCount: 0n,
          round2ResponseCount: 0n,
          round2CorrectCount: 0n,
          round2IncorrectCount: 0n,
          options: [
            { id: OPTION_A, text: 'First', isCorrect: false, count: 1 },
            { id: OPTION_B, text: 'Second', isCorrect: false, count: 1 },
          ],
        }),
      ]),
      state: state(),
    });

    expect(result.releasedResults.state).toBe('available');
    expect(result.insights[0]?.facts.map(({ kind }) => kind)).toContain('survey-top');
    expect(result.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'quiz-result-aggregate',
          aggregation: expect.objectContaining({
            rule: 'answer-distribution',
            responseCount: 1,
            selectionCount: 2,
          }),
        }),
      ]),
    );
  });

  it('keeps extreme finite numeric responses finite and contract-serializable', async () => {
    const result = await collectReleasedQuizSignals({
      tx: txWithRows([
        row({
          type: 'NUMERIC_ESTIMATE',
          participantCount: 2n,
          effectiveRound: 1n,
          effectiveResponseCount: 2n,
          correctCount: 0n,
          incorrectCount: 0n,
          unansweredCount: 2n,
          numericValueCount: 2n,
          numericValues: [-1e305, 1e305],
          round1NumericValueCount: 2n,
          round1NumericValues: [-1e305, 1e305],
          round2NumericValues: [],
          options: [],
        }),
      ]),
      state: state({ participantCount: 2 }),
    });

    const numeric = result.sources.find(
      (source) =>
        source.kind === 'quiz-result-aggregate' && source.aggregation.rule === 'numeric-summary',
    );
    if (!numeric || numeric.kind !== 'quiz-result-aggregate') throw new Error('missing aggregate');
    if (numeric.aggregation.rule !== 'numeric-summary') throw new Error('wrong aggregate');
    const histogram = numeric.aggregation.histogram;
    if (!histogram) throw new Error('missing numeric histogram');
    expect(Number.isFinite(numeric.aggregation.median ?? Number.NaN)).toBe(true);
    expect(Number.isFinite(numeric.aggregation.standardDeviation ?? Number.NaN)).toBe(true);
    expect(
      histogram.every((bucket) => Number.isFinite(bucket.from) && Number.isFinite(bucket.to)),
    ).toBe(true);
  });

  it('serializes the exact rating mean but feeds the one-decimal parity value to rules', async () => {
    const result = await collectReleasedQuizSignals({
      tx: txWithRows([
        row({
          type: 'RATING',
          participantCount: 50n,
          effectiveRound: 1n,
          effectiveResponseCount: 50n,
          ratingMin: 1,
          ratingMax: 5,
          ratingValueCount: 50n,
          ratingBuckets: [
            { value: 2, count: 23 },
            { value: 3, count: 27 },
          ],
          options: [],
          correctCount: 0n,
          incorrectCount: 0n,
          unansweredCount: 50n,
          round1ResponseCount: 0n,
          round1CorrectCount: 0n,
          round1IncorrectCount: 0n,
          round2ResponseCount: 0n,
          round2CorrectCount: 0n,
          round2IncorrectCount: 0n,
        }),
      ]),
      state: state({ participantCount: 50 }),
    });
    const rating = result.sources.find(
      (source) =>
        source.kind === 'quiz-result-aggregate' && source.aggregation.rule === 'rating-summary',
    );
    expect(rating).toMatchObject({ aggregation: { mean: 2.54, responseCount: 50 } });

    const compass = buildCompassContext({ released: result, feedback: noFeedback() });
    expect(compass.compass).toMatchObject({
      state: 'available',
      signals: [expect.objectContaining({ signal: 'result-pattern', value: 1 })],
    });
  });

  it('keeps duplicate 200-code-unit answer labels unique by reserving suffix space', async () => {
    const duplicate = 'x'.repeat(200);
    const result = await collectReleasedQuizSignals({
      tx: txWithRows([
        row({
          options: [
            { id: OPTION_A, text: duplicate, isCorrect: false, count: 1 },
            { id: OPTION_B, text: duplicate, isCorrect: true, count: 1 },
          ],
        }),
      ]),
      state: state(),
    });
    const source = result.sources.find(
      (candidate) =>
        candidate.kind === 'quiz-result-aggregate' &&
        candidate.aggregation.rule === 'answer-distribution',
    );
    if (!source || source.kind !== 'quiz-result-aggregate') throw new Error('missing aggregate');
    if (source.aggregation.rule !== 'answer-distribution') throw new Error('wrong aggregate');
    const labels = source.aggregation.buckets.map((bucket) => bucket.label);
    expect(new Set(labels).size).toBe(2);
    expect(labels.every((label) => label.length <= 200)).toBe(true);
  });

  it('reports unresolved progress IDs and safely omits over-bound numeric evidence', async () => {
    const unresolvedId = '77777777-7777-4777-8777-777777777777';
    const progress = {
      ...(state().questionProgress as Record<string, unknown>),
      [unresolvedId]: {
        state: 'COMPLETED',
        openedAt: '2026-10-04T09:00:00.000Z',
        completedAt: '2026-10-04T09:05:00.000Z',
      },
    };
    const result = await collectReleasedQuizSignals({
      tx: txWithRows([
        row({
          type: 'NUMERIC_ESTIMATE',
          scopeCount: 1n,
          participantCount: 501n,
          options: [],
          effectiveRound: 1n,
          effectiveResponseCount: 501n,
          correctCount: 0n,
          incorrectCount: 0n,
          unansweredCount: 501n,
          round1ResponseCount: 0n,
          round1CorrectCount: 0n,
          round1IncorrectCount: 0n,
          round2ResponseCount: 0n,
          round2CorrectCount: 0n,
          round2IncorrectCount: 0n,
          numericValueCount: 501n,
          numericValues: Array(500).fill(1),
          round1NumericValueCount: 501n,
          round1NumericValues: Array(500).fill(1),
        }),
      ]),
      state: state({ questionProgress: progress, participantCount: 501 }),
    });

    expect(result.releasedResults).toEqual({ state: 'unavailable', reason: 'not-supported' });
    expect(result.limitations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'source-redacted' }),
        expect.objectContaining({ code: 'budget-truncated' }),
      ]),
    );
    expect(result.limitations).not.toContainEqual(
      expect.objectContaining({ code: 'module-unavailable' }),
    );
  });

  it('reports the fixed query bound when more than 50 completed questions resolve', async () => {
    const result = await collectReleasedQuizSignals({
      tx: txWithRows([row({ scopeCount: 51n })]),
      state: state(),
    });
    expect(result.limitations).toContainEqual(
      expect.objectContaining({ code: 'budget-truncated', section: 'released-results' }),
    );
  });
});

describe('buildCompassContext', () => {
  it('keeps a measured zero-vote feedback aggregate available without inventing a signal', () => {
    const sourceId = 'feedback-aggregate:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const feedback: QuickFeedbackModerationProjection = {
      feedback: { state: 'available', aggregates: [{ sourceId }] },
      sources: [],
      limitations: [],
      revision: { state: 'available', value: 'feedback-zero-v1' },
      fingerprint: 'feedback-zero-v1',
      ruleInput: {
        type: 'STARS',
        totalVotes: 0,
        distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
      },
    };
    const released: ReleasedQuizProjection = {
      releasedResults: { state: 'not-applicable', reason: 'No quiz.' },
      sources: [],
      limitations: [],
      revision: { state: 'not-applicable', reason: 'No quiz.' },
      fingerprint: 'released:not-applicable',
      insights: [],
    };

    const result = buildCompassContext({ released, feedback });

    expect(result.compass).toEqual({
      state: 'available',
      rulesVersion: expect.any(String),
      signals: [],
      primarySignalSourceId: null,
    });
  });

  it('keeps PENDING as moderation state and uses shared quiz-before-feedback priority', () => {
    const questions = ModerationQuestionsSectionSchema.parse({
      state: 'available',
      participantBasis: {
        state: 'available',
        kind: 'session-participant-record-count',
        value: 3,
        calculationVersion: 'qa-ranking-v1',
      },
      corpus: { total: 1, eligible: 1, analyzed: 1, deduplicated: 1, represented: 1 },
      items: [
        {
          sourceId: 'qa-question:88888888-8888-4888-8888-888888888888',
          status: 'PENDING',
          answerState: { state: 'unavailable', reason: 'not-collected' },
          votes: {
            state: 'available',
            positive: 0,
            negative: 0,
            net: 0,
            total: 0,
            bestScore: { state: 'available', value: 0 },
            controversyScore: { state: 'available', value: 0 },
          },
          nlp: { state: 'disabled', reason: 'not collected' },
          topicSourceIds: [],
        },
      ],
    });
    if (questions.state !== 'available') throw new Error('questions unavailable');
    const released: ReleasedQuizProjection = {
      releasedResults: {
        state: 'available',
        aggregates: [{ sourceId: `quiz-result-aggregate:${QUESTION_ID}.correctness` }],
      },
      sources: [],
      limitations: [],
      revision: { state: 'available', value: 'released-v1' },
      fingerprint: 'released-v1',
      insights: [
        {
          questionSourceId: `quiz-question:${QUESTION_ID}`,
          aggregateSourceIds: [`quiz-result-aggregate:${QUESTION_ID}.correctness`],
          kind: 'scorable',
          facts: [
            {
              sourceId: `quiz-result-aggregate:${QUESTION_ID}.correctness`,
              kind: 'wrong-majority',
              reason: 'Incorrect released responses outnumber correct responses (2/3).',
            },
          ],
        },
      ],
    };
    const feedbackSourceId = 'feedback-aggregate:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const feedback: QuickFeedbackModerationProjection = {
      feedback: { state: 'available', aggregates: [{ sourceId: feedbackSourceId }] },
      sources: [],
      limitations: [],
      revision: { state: 'available', value: 'feedback-v1' },
      fingerprint: 'feedback-v1',
      ruleInput: {
        type: 'STARS',
        totalVotes: 4,
        distribution: { '1': 3, '2': 1, '3': 0, '4': 0, '5': 0 },
      },
    };

    const result = buildCompassContext({ released, feedback, questions, activeSortMode: 'BEST' });
    if (result.compass.state !== 'available') throw new Error('compass unavailable');
    expect(result.compass.signals.map((signal) => signal.signal)).toEqual([
      'pending-moderation',
      'result-pattern',
      'feedback-pattern',
    ]);
    const pending = result.compass.signals[0]!;
    expect(pending).toMatchObject({
      signal: 'pending-moderation',
      basis: 'pending-question-count',
      suggestedNextStep: { action: 'review-moderation' },
    });
    expect(JSON.stringify(pending)).not.toContain('learning-gap');
    expect(JSON.stringify(pending)).not.toContain('unanswered');
    expect(result.compass.primarySignalSourceId).toBe(
      result.compass.signals.find((signal) => signal.signal === 'result-pattern')?.sourceId,
    );
  });

  it('represents classified and pinned Q&A as topic-card evidence without semantic topics', () => {
    const pinnedSourceId = 'qa-question:88888888-8888-4888-8888-888888888888';
    const activeSourceId = 'qa-question:99999999-9999-4999-8999-999999999999';
    const questions = ModerationQuestionsSectionSchema.parse({
      state: 'available',
      participantBasis: {
        state: 'available',
        kind: 'session-participant-record-count',
        value: 2,
        calculationVersion: 'qa-ranking-v1',
      },
      corpus: { total: 2, eligible: 2, analyzed: 2, deduplicated: 2, represented: 2 },
      items: [
        {
          sourceId: pinnedSourceId,
          status: 'PINNED',
          answerState: { state: 'unavailable', reason: 'not-collected' },
          votes: {
            state: 'available',
            positive: 0,
            negative: 0,
            net: 0,
            total: 0,
            bestScore: { state: 'available', value: 0 },
            controversyScore: { state: 'available', value: 0 },
          },
          nlp: {
            state: 'classified',
            category: 'content',
            confidence: { value: 0.8, meaning: 'uncalibrated-model-score' },
            modelId: 'qa-nlp-cascade',
            modelVersion: 'v1',
            classifiedAt: '2026-10-04T10:00:00.000Z',
          },
          topicSourceIds: [],
        },
        {
          sourceId: activeSourceId,
          status: 'ACTIVE',
          answerState: { state: 'unavailable', reason: 'not-collected' },
          votes: {
            state: 'available',
            positive: 0,
            negative: 0,
            net: 0,
            total: 0,
            bestScore: { state: 'available', value: 0 },
            controversyScore: { state: 'available', value: 0 },
          },
          nlp: {
            state: 'classified',
            category: 'content',
            confidence: { value: 0.7, meaning: 'uncalibrated-model-score' },
            modelId: 'qa-nlp-cascade',
            modelVersion: 'v1',
            classifiedAt: '2026-10-04T10:00:00.000Z',
          },
          topicSourceIds: [],
        },
      ],
    });
    const released: ReleasedQuizProjection = {
      releasedResults: { state: 'not-applicable', reason: 'No quiz.' },
      sources: [],
      limitations: [],
      revision: { state: 'not-applicable', reason: 'No quiz.' },
      fingerprint: 'released:not-applicable',
      insights: [],
    };

    const result = buildCompassContext({ released, feedback: noFeedback(), questions });
    if (result.compass.state !== 'available') throw new Error('compass unavailable');
    const compass = result.compass;
    expect(compass.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          signal: 'high-frequency',
          basis: 'question-frequency',
          questionSourceIds: [pinnedSourceId, activeSourceId].sort(),
          value: 2,
        }),
        expect.objectContaining({
          signal: 'pinned-question',
          basis: 'pinned-question-count',
          questionSourceIds: [pinnedSourceId],
          value: 1,
        }),
      ]),
    );
    expect(
      compass.signals.find((signal) => signal.sourceId === compass.primarySignalSourceId)?.cardKind,
    ).toBe('topics');
  });

  it('keeps the host-ranked order when selecting at most two pinned topic cues', () => {
    const rankedFirst = 'qa-question:ffffffff-ffff-4fff-8fff-ffffffffffff';
    const rankedSecond = 'qa-question:eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const lexicographicallyFirst = 'qa-question:11111111-1111-4111-8111-111111111111';
    const sourceIds = [rankedFirst, rankedSecond, lexicographicallyFirst];
    const questions = ModerationQuestionsSectionSchema.parse({
      state: 'available',
      participantBasis: {
        state: 'available',
        kind: 'session-participant-record-count',
        value: 1,
        calculationVersion: 'qa-ranking-v1',
      },
      corpus: { total: 3, eligible: 3, analyzed: 3, deduplicated: 3, represented: 3 },
      items: sourceIds.map((sourceId) => ({
        sourceId,
        status: 'PINNED' as const,
        answerState: { state: 'unavailable' as const, reason: 'not-collected' },
        votes: {
          state: 'available' as const,
          positive: 0,
          negative: 0,
          net: 0,
          total: 0,
          bestScore: { state: 'available' as const, value: 0 },
          controversyScore: { state: 'available' as const, value: 0 },
        },
        nlp: { state: 'disabled' as const, reason: 'not-collected' },
        topicSourceIds: [],
      })),
    });
    const released: ReleasedQuizProjection = {
      releasedResults: { state: 'not-applicable', reason: 'No quiz.' },
      sources: [],
      limitations: [],
      revision: { state: 'not-applicable', reason: 'No quiz.' },
      fingerprint: 'released:not-applicable',
      insights: [],
    };

    const result = buildCompassContext({ released, feedback: noFeedback(), questions });
    if (result.compass.state !== 'available') throw new Error('compass unavailable');
    expect(
      result.compass.signals.find((signal) => signal.signal === 'pinned-question'),
    ).toMatchObject({ questionSourceIds: [rankedFirst, rankedSecond], value: 2 });
  });

  it('uses a classified controversial PENDING question only as moderation evidence', () => {
    const pendingSourceId = 'qa-question:77777777-7777-4777-8777-777777777777';
    const questions = ModerationQuestionsSectionSchema.parse({
      state: 'available',
      participantBasis: {
        state: 'available',
        kind: 'session-participant-record-count',
        value: 4,
        calculationVersion: 'qa-ranking-v1',
      },
      corpus: { total: 1, eligible: 1, analyzed: 1, deduplicated: 1, represented: 1 },
      items: [
        {
          sourceId: pendingSourceId,
          status: 'PENDING',
          answerState: { state: 'unavailable', reason: 'not-collected' },
          votes: {
            state: 'available',
            positive: 2,
            negative: 2,
            net: 0,
            total: 4,
            bestScore: {
              state: 'available',
              value: calculateModerationQaBestScoreV1({ positive: 2, negative: 2 }),
            },
            controversyScore: {
              state: 'available',
              value: calculateModerationQaControversyScoreV1({
                positive: 2,
                negative: 2,
                participantBasis: 4,
              }),
            },
          },
          nlp: {
            state: 'classified',
            category: 'content',
            confidence: { value: 0.9, meaning: 'uncalibrated-model-score' },
            modelId: 'qa-nlp-cascade',
            modelVersion: 'v1',
            classifiedAt: '2026-10-04T10:00:00.000Z',
          },
          topicSourceIds: [],
        },
      ],
    });
    const released: ReleasedQuizProjection = {
      releasedResults: { state: 'not-applicable', reason: 'No quiz.' },
      sources: [],
      limitations: [],
      revision: { state: 'not-applicable', reason: 'No quiz.' },
      fingerprint: 'released:not-applicable',
      insights: [],
    };

    const result = buildCompassContext({ released, feedback: noFeedback(), questions });
    if (result.compass.state !== 'available') throw new Error('compass unavailable');
    expect(result.compass.signals).toEqual([
      expect.objectContaining({
        signal: 'pending-moderation',
        questionSourceIds: [pendingSourceId],
        suggestedNextStep: { action: 'review-moderation', rationale: expect.any(String) },
      }),
    ]);
  });

  it('keeps every selected friction question and semantic topic in coherent evidence', () => {
    const firstQuestion = 'qa-question:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const secondQuestion = 'qa-question:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const bestScore = calculateModerationQaBestScoreV1({ positive: 2, negative: 2 });
    const controversyScore = calculateModerationQaControversyScoreV1({
      positive: 2,
      negative: 2,
      participantBasis: 4,
    });
    const questions = ModerationQuestionsSectionSchema.parse({
      state: 'available',
      participantBasis: {
        state: 'available',
        kind: 'session-participant-record-count',
        value: 4,
        calculationVersion: 'qa-ranking-v1',
      },
      corpus: { total: 2, eligible: 2, analyzed: 2, deduplicated: 2, represented: 2 },
      items: [firstQuestion, secondQuestion].map((sourceId, index) => ({
        sourceId,
        status: index === 0 ? 'PINNED' : 'ACTIVE',
        answerState: { state: 'unavailable', reason: 'not-collected' },
        votes: {
          state: 'available',
          positive: 2,
          negative: 2,
          net: 0,
          total: 4,
          bestScore: { state: 'available', value: bestScore },
          controversyScore: { state: 'available', value: controversyScore },
        },
        nlp: { state: 'disabled', reason: 'not collected' },
        topicSourceIds: [],
      })),
    });
    if (questions.state !== 'available') throw new Error('questions unavailable');
    const topicIds = Array.from({ length: 10 }, (_, index) => `semantic-topic:${index + 1}`);
    const topics = ModerationTopicsSectionSchema.parse({
      state: 'available',
      analysisVersion: 'semantic-v1',
      model: { id: 'encoder', version: 'v1' },
      analyzedAt: '2026-10-04T10:00:00.000Z',
      freshness: { state: 'current', analysisRevision: 'questions-v1' },
      corpus: { eligibleQuestions: 2, analyzedQuestions: 2, representedQuestions: 2 },
      items: topicIds.map((sourceId) => ({
        sourceId,
        labelOrigin: { kind: 'manual' },
        labelQuality: { state: 'unavailable', value: null, reason: 'not-collected' },
        clusterConfidence: {
          state: 'available',
          value: 0.8,
          meaning: 'uncalibrated-model-score',
        },
        aggregates: {
          questionCount: 2,
          positiveVotes: 4,
          negativeVotes: 4,
          netVotes: 0,
          totalVotes: 8,
          distinctParticipants: { state: 'unavailable', value: null, reason: 'not-collected' },
        },
        scope: {
          membership: 'analyzed-corpus',
          representedMembers: 'context-represented-corpus',
        },
        memberQuestionSourceIds: [firstQuestion, secondQuestion],
        representedQuestionSourceIds: [firstQuestion, secondQuestion],
        representativeQuestionSourceId: firstQuestion,
      })),
    });
    const released: ReleasedQuizProjection = {
      releasedResults: { state: 'not-applicable', reason: 'No quiz.' },
      sources: [],
      limitations: [],
      revision: { state: 'not-applicable', reason: 'No quiz.' },
      fingerprint: 'released:not-applicable',
      insights: [],
    };

    const result = buildCompassContext({
      released,
      feedback: noFeedback(),
      questions,
      topics,
    });
    if (result.compass.state !== 'available') throw new Error('compass unavailable');
    const friction = result.compass.signals.find((signal) => signal.signal === 'high-controversy');
    const topic = result.compass.signals.find((signal) => signal.signal === 'topic-concentration');
    expect(friction).toMatchObject({
      questionSourceIds: [firstQuestion, secondQuestion],
      evidence: [
        expect.objectContaining({ sourceId: firstQuestion }),
        expect.objectContaining({ sourceId: secondQuestion }),
      ],
    });
    expect(topic?.evidence.map(({ sourceId }) => sourceId)).toEqual(topicIds.slice(0, 5));
    expect(result.compass.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          signal: 'pinned-question',
          questionSourceIds: [firstQuestion],
        }),
      ]),
    );
    const nonControversialQuestions = ModerationQuestionsSectionSchema.parse({
      ...questions,
      items: questions.items.map((question) => ({
        ...question,
        votes: {
          state: 'available',
          positive: 0,
          negative: 0,
          net: 0,
          total: 0,
          bestScore: { state: 'available', value: 0 },
          controversyScore: { state: 'available', value: 0 },
        },
      })),
    });
    const topicOnlyResult = buildCompassContext({
      released,
      feedback: noFeedback(),
      questions: nonControversialQuestions,
      topics,
    });
    const topicOnlyCompass = topicOnlyResult.compass;
    if (topicOnlyCompass.state !== 'available') throw new Error('compass unavailable');
    expect(
      topicOnlyCompass.signals.find(
        (signal) => signal.sourceId === topicOnlyCompass.primarySignalSourceId,
      )?.signal,
    ).toBe('topic-concentration');
  });
});
