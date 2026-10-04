import { describe, expect, it } from 'vitest';

import { MODERATION_COMPASS_RULES_VERSION as BarrelRulesVersion } from './index.js';
import {
  MODERATION_COMPASS_RULES_VERSION,
  MODERATION_COMPASS_RULE_THRESHOLDS,
  collectModerationFeedbackDecision,
  collectModerationQuizFacts,
  isModerationCompassTopicSupported,
  planModerationCompass,
  resolveModerationCompassAnalysisMode,
  selectFrictionQuestionSourceIds,
  selectModerationCompassTopicSourceIds,
  selectPendingModerationQuestionSourceIds,
} from './moderation-compass-rules.js';

describe('moderation compass shared rules', () => {
  it('exports one canonical rule version and explicit thresholds', () => {
    expect(BarrelRulesVersion).toBe('moderation-compass-rules-v1');
    expect(MODERATION_COMPASS_RULES_VERSION).toBe(BarrelRulesVersion);
    expect(MODERATION_COMPASS_RULE_THRESHOLDS.quiz.maximumFactsPerQuestion).toBe(6);
    expect(MODERATION_COMPASS_RULE_THRESHOLDS.feedback.majorityMinimumShare).toBe(0.6);
  });

  it('preserves the existing quiz-fact order and six-fact cap', () => {
    const facts = collectModerationQuizFacts({
      totalVotes: 30,
      correctVoterCount: 8,
      incorrectVoterCount: 22,
      voteDistribution: [
        { text: '4', isCorrect: true, voteCount: 8 },
        { text: '5', isCorrect: false, voteCount: 18 },
      ],
      numericReferenceValue: 100,
      numericIntervalLeft: 90,
      numericIntervalRight: 110,
      numericStats: { n: 30, median: 70, stdDev: 40, inBandPercent: 20 },
      numericHistogram: [
        { from: 40, to: 60, count: 12, inBand: false },
        { from: 90, to: 110, count: 4, inBand: true },
      ],
      numericRoundComparison: {
        inBandPercentDelta: -12,
        pairedAnalysis: { fartherCount: 18, closerCount: 4 },
      },
      matchingStats: {
        totalVotes: 20,
        fullyCorrectCount: 2,
        commonConfusions: [{ left: 'IaaS', wrongRight: 'SaaS', count: 9 }],
      },
      orderingStats: {
        totalVotes: 20,
        fullyCorrectCount: 3,
        commonSwaps: [{ itemAText: 'Schritt 2', itemBText: 'Schritt 3', count: 7 }],
      },
      categorizationStats: {
        totalVotes: 20,
        fullyCorrectCount: 4,
        commonMisclassifications: [{ itemText: 'Dropbox', wrongCategoryName: 'IaaS', count: 8 }],
      },
      roundComparison: { round1CorrectCount: 10, round2CorrectCount: 8 },
      freeTextResponses: ['Bitte langsamer', 'Bitte langsamer'],
    });

    expect(facts.map(({ type }) => type)).toEqual([
      'wrong-majority',
      'in-band',
      'histogram-peak-out',
      'numeric-round-worse',
      'numeric-round-farther',
      'matching-confusion',
    ]);
  });

  it('keeps strict and inclusive numeric boundaries unchanged', () => {
    expect(
      collectModerationQuizFacts({
        totalVotes: 10,
        correctVoterCount: 5,
        incorrectVoterCount: 5,
        numericStats: { n: 8, median: 1.1, stdDev: 1.5, inBandPercent: 50 },
        numericReferenceValue: 1,
        numericIntervalLeft: 0,
        numericIntervalRight: 2,
        numericRoundComparison: {
          inBandPercentDelta: -5,
          pairedAnalysis: { fartherCount: 1, closerCount: 1 },
        },
      }).map(({ type }) => type),
    ).toEqual(['numeric-round-worse', 'numeric-median']);

    expect(
      collectModerationQuizFacts({
        numericStats: { n: 8, median: 1, stdDev: 1.5001, inBandPercent: 49.9 },
        numericReferenceValue: 1,
        numericIntervalLeft: 0,
        numericIntervalRight: 2,
        numericRoundComparison: {
          inBandPercentDelta: -4.999,
          pairedAnalysis: { fartherCount: 2, closerCount: 1 },
        },
      }).map(({ type }) => type),
    ).toEqual(['in-band', 'numeric-round-farther', 'numeric-spread']);
  });

  it('uses the overall histogram peak, minimum sample and inclusive 30 percent share', () => {
    expect(
      collectModerationQuizFacts({
        numericStats: { n: 10, inBandPercent: 50 },
        numericHistogram: [
          { from: 0, to: 1, count: 3, inBand: false },
          { from: 1, to: 2, count: 3, inBand: true },
          { from: 2, to: 3, count: 2, inBand: false },
          { from: 3, to: 4, count: 2, inBand: false },
        ],
      }),
    ).toContainEqual({ type: 'histogram-peak-out', from: 0, to: 1, share: 30 });

    expect(
      collectModerationQuizFacts({
        numericStats: { n: 8, inBandPercent: 50 },
        numericHistogram: [
          { from: 0, to: 1, count: 3, inBand: true },
          { from: 1, to: 2, count: 3, inBand: false },
          { from: 2, to: 3, count: 2, inBand: false },
        ],
      }).some(({ type }) => type === 'histogram-peak-out'),
    ).toBe(false);
    expect(
      collectModerationQuizFacts({
        numericStats: { n: 7, inBandPercent: 50 },
        numericHistogram: [
          { from: 0, to: 1, count: 2, inBand: false },
          { from: 1, to: 2, count: 5, inBand: true },
        ],
      }).some(({ type }) => type === 'histogram-peak-out'),
    ).toBe(false);

    expect(
      collectModerationQuizFacts({
        numericStats: { n: 10, median: 1, stdDev: 0, inBandPercent: null },
        numericHistogram: [{ from: 0, to: 2, count: 10, inBand: false }],
      }).some(({ type }) => type === 'histogram-peak-out'),
    ).toBe(false);
  });

  it('separates survey, rating and repeated-text rules', () => {
    expect(
      collectModerationQuizFacts({
        type: 'SURVEY',
        totalVotes: 10,
        voteDistribution: [
          { text: 'A', isCorrect: false, voteCount: 6 },
          { text: 'B', isCorrect: false, voteCount: 4 },
        ],
      }),
    ).toEqual([{ type: 'survey-top', option: 'A', share: 60 }]);

    expect(
      collectModerationQuizFacts({
        type: 'RATING',
        ratingAvg: 2.5,
        ratingCount: 3,
        freeTextResponses: ['  Bitte   langsamer  ', 'Bitte langsamer'],
      }),
    ).toEqual([
      { type: 'rating-low', avg: 2.5 },
      { type: 'freetext-repeat', text: 'Bitte langsamer', count: 2 },
    ]);
    expect(collectModerationQuizFacts({ type: 'RATING', ratingAvg: 2.5, ratingCount: 2 })).toEqual(
      [],
    );
    expect(
      collectModerationQuizFacts({
        type: 'FREETEXT',
        freeTextResponses: ['1234567', '1234567', '12345678', '12345678'],
      }),
    ).toEqual([{ type: 'freetext-repeat', text: '12345678', count: 2 }]);
  });

  it('derives non-tempo feedback with the existing precedence and boundaries', () => {
    expect(
      collectModerationFeedbackDecision({
        type: 'STARS',
        totalVotes: 4,
        distribution: { '1': 2, '4': 2 },
      }),
    ).toMatchObject({
      variant: 'feedback',
      tone: 'caution',
      trigger: { type: 'rating-low', average: 2.5 },
      ruleScore: 1,
    });
    expect(
      collectModerationFeedbackDecision({
        type: 'MOOD',
        totalVotes: 10,
        distribution: { POSITIVE: 5, NEGATIVE: 3, NEUTRAL: 2 },
      }),
    ).toMatchObject({ trigger: { type: 'split' } });
    expect(
      collectModerationFeedbackDecision({
        type: 'YESNO',
        totalVotes: 10,
        distribution: { NO: 6, YES: 4 },
      }),
    ).toMatchObject({ trigger: { type: 'negative-majority', key: 'NO', share: 0.6 } });
    expect(
      collectModerationFeedbackDecision({
        type: 'YESNO',
        totalVotes: 10,
        distribution: { YES: 6, NO: 4 },
      }),
    ).toBeNull();
    expect(
      collectModerationFeedbackDecision({
        type: 'MOOD',
        totalVotes: 2,
        distribution: { NEGATIVE: 2 },
      }),
    ).toBeNull();
  });

  it('maps only the canonical server tempo trend without reimplementing its thresholds', () => {
    const decision = (
      status: 'NEUTRAL' | 'FOLLOWING' | 'TOO_FAST' | 'TOO_SLOW' | 'HETEROGENEOUS' | 'LOST',
    ) =>
      collectModerationFeedbackDecision({
        type: 'TEMPO',
        totalVotes: 0,
        distribution: {},
        tempoTrend: { status },
      });

    expect(decision('NEUTRAL')).toBeNull();
    expect(decision('FOLLOWING')).toMatchObject({ tone: 'good' });
    expect(decision('TOO_FAST')).toMatchObject({ tone: 'caution' });
    expect(decision('TOO_SLOW')).toMatchObject({ tone: 'caution' });
    expect(decision('HETEROGENEOUS')).toMatchObject({ tone: 'caution' });
    expect(decision('LOST')).toMatchObject({ tone: 'alert' });
  });

  it('sorts pending questions by the active ranking and friction by authoritative label', () => {
    const questions = [
      {
        sourceId: 'qa-question:b',
        status: 'PENDING' as const,
        score: 8,
        bestScore: 0.2,
        controversyScore: 0.55,
        isControversial: true,
      },
      {
        sourceId: 'qa-question:a',
        status: 'PENDING' as const,
        score: 1,
        bestScore: 0.8,
        controversyScore: 0.82,
        isControversial: true,
      },
      {
        sourceId: 'qa-question:c',
        status: 'ACTIVE' as const,
        controversyScore: 0.99,
      },
      {
        sourceId: 'qa-question:d',
        status: 'ARCHIVED' as const,
        controversyScore: 1,
        isControversial: true,
      },
      {
        sourceId: 'qa-question:e',
        status: 'ACTIVE' as const,
        controversyScore: 0.7,
        isControversial: true,
      },
    ];

    expect(selectPendingModerationQuestionSourceIds(questions, 'TOP')).toEqual([
      'qa-question:b',
      'qa-question:a',
    ]);
    expect(selectPendingModerationQuestionSourceIds(questions, 'BEST')).toEqual([
      'qa-question:a',
      'qa-question:b',
    ]);
    expect(selectFrictionQuestionSourceIds(questions)).toEqual(['qa-question:e']);
  });

  it('mixes supported topic sources deterministically and adds weight only while space remains', () => {
    expect(isModerationCompassTopicSupported({ documentFrequency: 1, sourceCount: 1 })).toBe(false);
    expect(isModerationCompassTopicSupported({ documentFrequency: 2, sourceCount: 1 })).toBe(true);
    expect(
      selectModerationCompassTopicSourceIds({
        classified: [{ sourceId: 'nlp-1' }],
        qaTerms: [
          { sourceId: 'qa-ignored', documentFrequency: 1, sourceCount: 1 },
          { sourceId: 'qa-1', documentFrequency: 2, sourceCount: 1 },
          { sourceId: 'qa-2', documentFrequency: 3, sourceCount: 3 },
        ],
        freetextTerms: [{ sourceId: 'free-1', documentFrequency: 1, sourceCount: 2 }],
        extras: [{ sourceId: 'extra-1' }],
        topicWeight: { sourceId: 'weight' },
      }),
    ).toEqual(['nlp-1', 'qa-1', 'free-1', 'extra-1', 'qa-2']);
    expect(
      selectModerationCompassTopicSourceIds({
        classified: [],
        qaTerms: [{ sourceId: 'qa-1', documentFrequency: 2, sourceCount: 1 }],
        freetextTerms: [],
        extras: [],
        topicWeight: { sourceId: 'weight' },
      }),
    ).toEqual(['qa-1', 'weight']);
  });

  it('drops blank sources after the per-channel cap without losing privileged source ordering', () => {
    expect(
      selectModerationCompassTopicSourceIds({
        classified: [{ sourceId: 'classified', dedupeKey: 'duplicate' }],
        qaTerms: [
          { sourceId: '', documentFrequency: 2, sourceCount: 2 },
          { sourceId: 'qa-1', dedupeKey: 'qa', documentFrequency: 2, sourceCount: 2 },
          { sourceId: 'qa-2', dedupeKey: 'qa', documentFrequency: 2, sourceCount: 2 },
          { sourceId: 'qa-3', documentFrequency: 2, sourceCount: 2 },
          { sourceId: 'qa-4', documentFrequency: 2, sourceCount: 2 },
          { sourceId: 'qa-6-not-backfilled', documentFrequency: 2, sourceCount: 2 },
        ],
        freetextTerms: [
          {
            sourceId: 'free-1',
            dedupeKey: 'duplicate',
            documentFrequency: 2,
            sourceCount: 2,
          },
          { sourceId: 'free-2', documentFrequency: 2, sourceCount: 2 },
        ],
        extras: [{ sourceId: ' ' }, { sourceId: 'extra-1' }],
      }),
    ).toEqual(['classified', 'qa-1', 'extra-1', 'qa-3', 'qa-4', 'free-2']);
  });

  it('plans opaque sources with the canonical card order, allocation and alert priority', () => {
    const plan = planModerationCompass({
      topicSourceIds: ['topic-1'],
      pendingQuestionSourceIds: Array.from({ length: 7 }, (_, index) => `pending-${index}`),
      frictionQuestionSourceIds: ['friction-1'],
      quizResultSourceIds: ['quiz-1', 'quiz-2', 'quiz-3'],
      quizInsightKind: 'survey',
      feedback: {
        sourceId: 'feedback-1',
        variant: 'tempo',
        tone: 'alert',
      },
    });

    expect(plan.rulesVersion).toBe(MODERATION_COMPASS_RULES_VERSION);
    expect(plan.cards.map(({ kind }) => kind)).toEqual([
      'tempo',
      'friction',
      'clarification',
      'topics',
    ]);
    expect(plan.cards.find(({ kind }) => kind === 'clarification')?.sourceIds).toEqual([
      'quiz-1',
      'quiz-2',
      'pending-0',
      'pending-1',
      'pending-2',
      'pending-3',
      'pending-4',
      'pending-5',
    ]);
    expect(plan.recommendation).toEqual({
      reason: 'tempo',
      preferredCardKind: 'tempo',
      attachToCard: true,
    });
    expect(plan.cards[0]).toMatchObject({ tone: 'alert', nextStepReason: 'tempo' });
  });

  it('keeps neutral tempo cards without inventing a feedback diagnosis', () => {
    const plan = planModerationCompass({
      topicSourceIds: [],
      pendingQuestionSourceIds: [],
      frictionQuestionSourceIds: [],
      quizResultSourceIds: [],
      feedback: { sourceId: 'tempo-1', tone: 'neutral', variant: 'tempo' },
    });

    expect(plan.cards).toEqual([{ kind: 'tempo', tone: 'neutral', sourceIds: ['tempo-1'] }]);
    expect(plan.recommendation).toBeNull();
  });

  it.each([
    {
      name: 'quiz before caution feedback',
      input: {
        topicSourceIds: ['topic'],
        pendingQuestionSourceIds: ['pending'],
        frictionQuestionSourceIds: ['friction'],
        quizResultSourceIds: ['quiz'],
        feedback: {
          sourceId: 'feedback',
          variant: 'feedback' as const,
          tone: 'caution' as const,
        },
      },
      reason: 'quiz-confusion',
    },
    {
      name: 'caution feedback before pending',
      input: {
        topicSourceIds: ['topic'],
        pendingQuestionSourceIds: ['pending'],
        frictionQuestionSourceIds: ['friction'],
        quizResultSourceIds: [],
        feedback: {
          sourceId: 'feedback',
          variant: 'feedback' as const,
          tone: 'caution' as const,
        },
      },
      reason: 'feedback',
    },
    {
      name: 'pending before friction',
      input: {
        topicSourceIds: ['topic'],
        pendingQuestionSourceIds: ['pending'],
        frictionQuestionSourceIds: ['friction'],
        quizResultSourceIds: [],
      },
      reason: 'pending-qa',
    },
    {
      name: 'friction before topics',
      input: {
        topicSourceIds: ['topic'],
        pendingQuestionSourceIds: [],
        frictionQuestionSourceIds: ['friction'],
        quizResultSourceIds: [],
      },
      reason: 'controversy',
    },
  ])('preserves priority: $name', ({ input, reason }) => {
    expect(planModerationCompass(input).recommendation?.reason).toBe(reason);
  });

  it('keeps a structured recommendation while suppressing a tautological single-card label', () => {
    const pending = planModerationCompass({
      topicSourceIds: [],
      pendingQuestionSourceIds: ['pending'],
      frictionQuestionSourceIds: [],
      quizResultSourceIds: [],
    });
    expect(pending.recommendation).toEqual({
      reason: 'pending-qa',
      preferredCardKind: 'clarification',
      attachToCard: false,
    });
    expect(pending.cards[0]?.nextStepReason).toBeUndefined();

    const quiz = planModerationCompass({
      topicSourceIds: [],
      pendingQuestionSourceIds: [],
      frictionQuestionSourceIds: [],
      quizResultSourceIds: ['quiz'],
    });
    expect(quiz.recommendation?.attachToCard).toBe(true);
    expect(quiz.cards[0]?.nextStepReason).toBe('quiz-confusion');
  });

  it('does not mutate planner inputs and handles an empty snapshot', () => {
    const topicSourceIds = ['topic'];
    const pendingQuestionSourceIds = ['pending'];
    const before = {
      topicSourceIds: [...topicSourceIds],
      pendingQuestionSourceIds: [...pendingQuestionSourceIds],
    };
    planModerationCompass({
      topicSourceIds,
      pendingQuestionSourceIds,
      frictionQuestionSourceIds: [],
      quizResultSourceIds: [],
    });
    expect({ topicSourceIds, pendingQuestionSourceIds }).toEqual(before);
    expect(
      planModerationCompass({
        topicSourceIds: [],
        pendingQuestionSourceIds: [],
        frictionQuestionSourceIds: [],
        quizResultSourceIds: [],
      }),
    ).toEqual({
      rulesVersion: MODERATION_COMPASS_RULES_VERSION,
      cards: [],
      recommendation: null,
    });
  });

  it('keeps classified ahead of uncertain in mixed NLP states', () => {
    expect(
      resolveModerationCompassAnalysisMode({
        enabled: true,
        statuses: ['uncertain', 'classified'],
      }),
    ).toBe('classified');
    expect(
      resolveModerationCompassAnalysisMode({ enabled: true, statuses: ['failed', 'classified'] }),
    ).toBe('failed');
    expect(
      resolveModerationCompassAnalysisMode({ enabled: true, statuses: ['pending', 'failed'] }),
    ).toBe('pending');
  });
});
