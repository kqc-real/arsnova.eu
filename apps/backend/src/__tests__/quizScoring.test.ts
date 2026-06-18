import { describe, expect, it } from 'vitest';
import { evaluateNumericAnswer, evaluateShortAnswer } from '@arsnova/shared-types';
import {
  calculateNumericEstimateScoreRatio,
  calculateVoteScore,
  getStreakMultiplier,
  isExactCorrectSelection,
  questionAffectsStreak,
  questionCountsTowardsTotalQuestions,
} from '../lib/quizScoring';

describe('quizScoring', () => {
  it('zählt bewertbare Fragetypen zu totalQuestions', () => {
    expect(questionCountsTowardsTotalQuestions('MULTIPLE_CHOICE')).toBe(true);
    expect(questionCountsTowardsTotalQuestions('SINGLE_CHOICE')).toBe(true);
    expect(questionCountsTowardsTotalQuestions('SHORT_TEXT')).toBe(true);
    expect(questionCountsTowardsTotalQuestions('FREETEXT')).toBe(false);
    expect(questionCountsTowardsTotalQuestions('SURVEY')).toBe(false);
    expect(questionCountsTowardsTotalQuestions('RATING')).toBe(false);
  });

  it('gibt bei nicht-wertbaren Fragetypen immer 0 Punkte zurück', () => {
    expect(
      calculateVoteScore({
        type: 'FREETEXT',
        difficulty: 'MEDIUM',
        selectedAnswerIds: [],
        correctAnswerIds: [],
      }),
    ).toBe(0);
    expect(
      calculateVoteScore({
        type: 'SURVEY',
        difficulty: 'MEDIUM',
        selectedAnswerIds: ['a'],
        correctAnswerIds: [],
      }),
    ).toBe(0);
    expect(
      calculateVoteScore({
        type: 'RATING',
        difficulty: 'MEDIUM',
        selectedAnswerIds: [],
        correctAnswerIds: [],
      }),
    ).toBe(0);
  });

  it('gibt Punkte nur bei exakt korrekter Auswahl', () => {
    expect(
      calculateVoteScore({
        type: 'SINGLE_CHOICE',
        difficulty: 'MEDIUM',
        selectedAnswerIds: ['a1'],
        correctAnswerIds: ['a1'],
      }),
    ).toBe(2000);

    expect(
      calculateVoteScore({
        type: 'MULTIPLE_CHOICE',
        difficulty: 'HARD',
        selectedAnswerIds: ['a1', 'a2'],
        correctAnswerIds: ['a1', 'a2'],
      }),
    ).toBe(3000);

    expect(
      calculateVoteScore({
        type: 'MULTIPLE_CHOICE',
        difficulty: 'HARD',
        selectedAnswerIds: ['a1'],
        correctAnswerIds: ['a1', 'a2'],
      }),
    ).toBe(0);
  });

  it('skaliert NUMERIC_ESTIMATE-Punkte nach Abstand zum Referenzwert', () => {
    const baseInput = {
      type: 'NUMERIC_ESTIMATE' as const,
      difficulty: 'MEDIUM' as const,
      selectedAnswerIds: [],
      correctAnswerIds: [],
      numericEstimateReferenceValue: 1789,
      numericEstimateToleranceBand: { left: 1700, right: 1900 },
    };

    const exact = calculateVoteScore({
      ...baseInput,
      numericEstimateValue: 1789,
    });
    const close = calculateVoteScore({
      ...baseInput,
      numericEstimateValue: 1790,
    });
    const far = calculateVoteScore({
      ...baseInput,
      numericEstimateValue: 1850,
    });
    const edge = calculateVoteScore({
      ...baseInput,
      numericEstimateValue: 1900,
    });
    const outside = calculateVoteScore({
      ...baseInput,
      numericEstimateValue: 1901,
    });

    expect(exact).toBe(2000);
    expect(close).toBe(1998);
    expect(far).toBe(1456);
    expect(close).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(edge);
    expect(edge).toBe(200);
    expect(outside).toBe(0);
  });

  it('erhaelt bei NUMERIC_ESTIMATE gleicher Zeit die Reihenfolge nach Genauigkeit', () => {
    const baseInput = {
      type: 'NUMERIC_ESTIMATE' as const,
      difficulty: 'MEDIUM' as const,
      selectedAnswerIds: [],
      correctAnswerIds: [],
      numericEstimateReferenceValue: 1789,
      numericEstimateToleranceBand: { left: 1700, right: 1900 },
      responseTimeMs: 5_000,
      timerDurationMs: 10_000,
    };

    const exact = calculateVoteScore({
      ...baseInput,
      numericEstimateValue: 1789,
    });
    const close = calculateVoteScore({
      ...baseInput,
      numericEstimateValue: 1790,
    });

    expect(exact).toBe(1000);
    expect(close).toBe(999);
    expect(close).toBeLessThan(exact);
    expect(close).toBeGreaterThan(0);
  });

  it('behaelt bei angenommener NUMERIC_ESTIMATE am Timerende Mindestpunkte', () => {
    const baseInput = {
      type: 'NUMERIC_ESTIMATE' as const,
      difficulty: 'MEDIUM' as const,
      selectedAnswerIds: [],
      correctAnswerIds: [],
      numericEstimateReferenceValue: 3.14,
      numericEstimateToleranceBand: { left: 2.83, right: 3.45 },
      responseTimeMs: 10_000,
      timerDurationMs: 10_000,
    };

    const exact = calculateVoteScore({
      ...baseInput,
      numericEstimateValue: 3.14,
    });
    const inBand = calculateVoteScore({
      ...baseInput,
      numericEstimateValue: 3.4,
    });
    const outside = calculateVoteScore({
      ...baseInput,
      numericEstimateValue: 3.5,
    });

    expect(exact).toBe(200);
    expect(inBand).toBeGreaterThan(0);
    expect(inBand).toBeLessThan(exact);
    expect(outside).toBe(0);
  });

  it('normalisiert NUMERIC_ESTIMATE-Abstaende je Seite des Toleranzbands', () => {
    expect(
      calculateNumericEstimateScoreRatio({
        value: 1700,
        referenceValue: 1789,
        toleranceBand: { left: 1700, right: 1900 },
      }),
    ).toBeCloseTo(0.1);
    expect(
      calculateNumericEstimateScoreRatio({
        value: 1900,
        referenceValue: 1789,
        toleranceBand: { left: 1700, right: 1900 },
      }),
    ).toBeCloseTo(0.1);
    expect(
      calculateNumericEstimateScoreRatio({
        value: 1790,
        referenceValue: 1789,
        toleranceBand: { left: 1700, right: 1900 },
      }),
    ).toBeCloseTo(0.999);
    expect(
      calculateNumericEstimateScoreRatio({
        value: 1789,
        referenceValue: 1789,
        toleranceBand: { left: 1700, right: 1900 },
      }),
    ).toBe(1);
  });

  it('bewertet SHORT_TEXT nach gemeinsamer Normalisierung', () => {
    expect(
      calculateVoteScore({
        type: 'SHORT_TEXT',
        difficulty: 'MEDIUM',
        selectedAnswerIds: [],
        correctAnswerIds: [],
        freeText: '  Ada   Lovelace ',
        correctShortTextAnswers: ['ada lovelace'],
        shortTextCaseSensitive: false,
      }),
    ).toBe(2000);

    expect(
      calculateVoteScore({
        type: 'SHORT_TEXT',
        difficulty: 'MEDIUM',
        selectedAnswerIds: [],
        correctAnswerIds: [],
        freeText: 'Ada',
        correctShortTextAnswers: ['ada'],
        shortTextCaseSensitive: true,
      }),
    ).toBe(0);
  });

  it('vergibt Teilpunkte fuer kleine Tippfehler bei SHORT_TEXT', () => {
    const score = calculateVoteScore({
      type: 'SHORT_TEXT',
      difficulty: 'MEDIUM',
      selectedAnswerIds: [],
      correctAnswerIds: [],
      freeText: 'Photoyynthese',
      correctShortTextAnswers: ['Photosynthese'],
      shortTextCaseSensitive: false,
      shortTextEvaluationMode: 'hamming',
      shortTextToleranceLevel: 'low',
      shortTextAllowPartialCredit: true,
    });

    expect(score).toBeGreaterThan(1800);
    expect(score).toBeLessThan(2000);
  });

  it('gibt bei deaktivierten Teilpunkten trotz Tippfehlern die volle Punktzahl innerhalb der Toleranz', () => {
    expect(
      calculateVoteScore({
        type: 'SHORT_TEXT',
        difficulty: 'MEDIUM',
        selectedAnswerIds: [],
        correctAnswerIds: [],
        freeText: 'Photosynthesee',
        correctShortTextAnswers: ['Photosynthese'],
        shortTextCaseSensitive: false,
        shortTextEvaluationMode: 'levenshtein',
        shortTextToleranceLevel: 'low',
        shortTextAllowPartialCredit: false,
      }),
    ).toBe(2000);
  });

  it('bewertet numerische Kurzantworten ueber geparste Zahlen statt Zeichenähnlichkeit', () => {
    expect(
      calculateVoteScore({
        type: 'SHORT_TEXT',
        difficulty: 'MEDIUM',
        selectedAnswerIds: [],
        correctAnswerIds: [],
        freeText: '12.5',
        correctShortTextAnswers: ['12,5'],
        shortTextEvaluationKind: 'numeric',
        numericToleranceMode: 'exact',
      }),
    ).toBe(2000);
  });

  it('akzeptiert absolute und relative Toleranzen für numerische Kurzantworten', () => {
    expect(
      calculateVoteScore({
        type: 'SHORT_TEXT',
        difficulty: 'MEDIUM',
        selectedAnswerIds: [],
        correctAnswerIds: [],
        freeText: '10.4',
        correctShortTextAnswers: ['10'],
        shortTextEvaluationKind: 'numeric',
        numericToleranceMode: 'absolute',
        numericAbsoluteTolerance: 0.5,
      }),
    ).toBe(2000);

    expect(
      calculateVoteScore({
        type: 'SHORT_TEXT',
        difficulty: 'MEDIUM',
        selectedAnswerIds: [],
        correctAnswerIds: [],
        freeText: '109',
        correctShortTextAnswers: ['100'],
        shortTextEvaluationKind: 'numeric',
        numericToleranceMode: 'relative',
        numericRelativeTolerancePercent: 10,
      }),
    ).toBe(2000);
  });

  it('vergibt bei korrektem Zahlenwert aber fehlender Pflicht-Einheit Teilpunkte', () => {
    expect(
      calculateVoteScore({
        type: 'SHORT_TEXT',
        difficulty: 'MEDIUM',
        selectedAnswerIds: [],
        correctAnswerIds: [],
        freeText: '2',
        correctShortTextAnswers: ['2 m'],
        shortTextEvaluationKind: 'numeric_unit',
        numericToleranceMode: 'exact',
        numericUnitFamily: 'length',
        numericRequireUnit: true,
        numericAcceptEquivalentUnits: true,
      }),
    ).toBe(1000);
  });

  it('erkennt äquivalente Einheiten im numerischen Einheitenmodus', () => {
    const result = evaluateNumericAnswer({
      modelAnswers: ['2 m'],
      studentAnswer: '200 cm',
      maxPoints: 100,
      settings: {
        toleranceMode: 'exact',
        unitFamily: 'length',
        requireUnit: true,
        acceptEquivalentUnits: true,
      },
    });

    expect(result.points).toBe(100);
    expect(result.unitStatus).toBe('equivalent');
    expect(result.explanation).toContain('converting an equivalent unit');
  });

  it('erkennt benachbarte Buchstabendreher deterministisch im Auto-Modus', () => {
    const result = evaluateShortAnswer({
      modelAnswers: ['Photosynthese'],
      studentAnswer: 'Photosynthees',
      maxPoints: 100,
      settings: {
        evaluationMode: 'auto',
        toleranceLevel: 'low',
        allowPartialCredit: true,
      },
    });

    expect(result.points).toBeGreaterThan(0);
    expect(result.evaluationMethod).toBe('damerau_levenshtein');
    expect(result.feedbackCategory).toBe('minor_typo');
    expect(result.explanation).toContain('transposition');
  });

  it('bevorzugt exakte Varianten vor fuzzy Treffern auf andere Musterloesungen', () => {
    const result = evaluateShortAnswer({
      modelAnswers: ['Photosynthese', 'Photsosynthese'],
      studentAnswer: 'Photsosynthese',
      maxPoints: 100,
      settings: {
        evaluationMode: 'auto',
        toleranceLevel: 'low',
        allowPartialCredit: true,
      },
    });

    expect(result.points).toBe(100);
    expect(result.evaluationMethod).toBe('exact');
    expect(result.matchedModelAnswer).toBe('Photsosynthese');
    expect(result.explanation).toContain('Exact match');
  });

  it('nutzt bei gleichem Abstand eine stabile Methoden-Prioritaet', () => {
    const result = evaluateShortAnswer({
      modelAnswers: ['Paris'],
      studentAnswer: 'Parix',
      maxPoints: 100,
      settings: {
        evaluationMode: 'auto',
        toleranceLevel: 'medium',
        allowPartialCredit: true,
      },
    });

    expect(result.evaluationMethod).toBe('hamming');
    expect(result.explanation).toContain('same-length');
  });

  it('erkennt vollständig korrekte Auswahl auch bei gleicher Reihenfolge-unabhängiger Menge', () => {
    expect(isExactCorrectSelection(['a2', 'a1'], ['a1', 'a2'])).toBe(true);
    expect(isExactCorrectSelection(['a1'], ['a1', 'a2'])).toBe(false);
    expect(isExactCorrectSelection(['a1', 'a3'], ['a1', 'a2'])).toBe(false);
  });

  describe('getStreakMultiplier (Story 5.5)', () => {
    it('gibt ×1.0 für Streak 0 und 1', () => {
      expect(getStreakMultiplier(0)).toBe(1.0);
      expect(getStreakMultiplier(1)).toBe(1.0);
    });

    it('gibt steigende Multiplikatoren für 2-4', () => {
      expect(getStreakMultiplier(2)).toBe(1.1);
      expect(getStreakMultiplier(3)).toBe(1.2);
      expect(getStreakMultiplier(4)).toBe(1.3);
    });

    it('gibt ×1.5 für 5+ Streak', () => {
      expect(getStreakMultiplier(5)).toBe(1.5);
      expect(getStreakMultiplier(10)).toBe(1.5);
      expect(getStreakMultiplier(99)).toBe(1.5);
    });
  });

  describe('questionAffectsStreak (Story 5.5)', () => {
    it('SC, MC und SHORT_TEXT beeinflussen den Streak', () => {
      expect(questionAffectsStreak('SINGLE_CHOICE')).toBe(true);
      expect(questionAffectsStreak('MULTIPLE_CHOICE')).toBe(true);
      expect(questionAffectsStreak('SHORT_TEXT')).toBe(true);
    });

    it('FREETEXT, SURVEY und RATING unterbrechen den Streak nicht', () => {
      expect(questionAffectsStreak('FREETEXT')).toBe(false);
      expect(questionAffectsStreak('SURVEY')).toBe(false);
      expect(questionAffectsStreak('RATING')).toBe(false);
    });
  });
});
