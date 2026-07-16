import { describe, expect, it } from 'vitest';
import {
  buildConfidenceResult,
  buildSessionConfidenceSummary,
  classifyConfidenceTier,
  isConfidenceScaleValue,
  questionSupportsConfidence,
  resolveEffectiveAggregationRound,
  selectConfidencePriorityQuestions,
} from './confidence.js';

describe('confidence helpers (Story 1.2i)', () => {
  it('erkennt bewertbare Fragetypen für Sicherheitsgrad', () => {
    expect(questionSupportsConfidence('SINGLE_CHOICE')).toBe(true);
    expect(questionSupportsConfidence('RATING')).toBe(false);
    expect(questionSupportsConfidence('FREETEXT')).toBe(false);
  });

  it('klassifiziert Skalenwerte in niedrig, mittel und hoch', () => {
    expect(classifyConfidenceTier(1)).toBe('low');
    expect(classifyConfidenceTier(2)).toBe('low');
    expect(classifyConfidenceTier(3)).toBe('mid');
    expect(classifyConfidenceTier(4)).toBe('high');
    expect(classifyConfidenceTier(5)).toBe('high');
  });

  it('löst die effektive Aggregationsrunde nach Effective-Vote-Regel auf', () => {
    expect(resolveEffectiveAggregationRound([])).toEqual({
      effectiveRound: 1,
      round1Count: 0,
      round2Count: 0,
    });
    expect(resolveEffectiveAggregationRound([{ round: 1 }, { round: 1 }])).toEqual({
      effectiveRound: 1,
      round1Count: 2,
      round2Count: 0,
    });
    expect(
      resolveEffectiveAggregationRound([{ round: 1 }, { round: 2 }, { round: 2 }, { round: null }]),
    ).toEqual({
      effectiveRound: 2,
      round1Count: 2,
      round2Count: 2,
    });
  });

  it('validiert nur ganzzahlige Werte zwischen 1 und 5', () => {
    expect(isConfidenceScaleValue(1)).toBe(true);
    expect(isConfidenceScaleValue(5)).toBe(true);
    expect(isConfidenceScaleValue(0)).toBe(false);
    expect(isConfidenceScaleValue(3.5)).toBe(false);
  });

  it('aggregiert Verteilung und Kreuztabelle', () => {
    const result = buildConfidenceResult({
      votes: [
        { confidenceValue: 5, isCorrect: true },
        { confidenceValue: 4, isCorrect: false },
        { confidenceValue: 2, isCorrect: false },
        { confidenceValue: 3, isCorrect: true },
      ],
    });

    expect(result).toEqual({
      distribution: { '1': 0, '2': 1, '3': 1, '4': 1, '5': 1 },
      crossTab: {
        correctHigh: 1,
        correctMid: 1,
        correctLow: 0,
        incorrectHigh: 1,
        incorrectMid: 0,
        incorrectLow: 1,
      },
      highConfidenceWrongCount: 1,
    });
  });

  it('zählt selbstsicher falsche Antwortoptionen bei Auswahlfragen', () => {
    const result = buildConfidenceResult({
      votes: [
        {
          confidenceValue: 5,
          isCorrect: false,
          selectedAnswerIds: ['wrong-a'],
        },
        {
          confidenceValue: 4,
          isCorrect: false,
          selectedAnswerIds: ['wrong-a', 'wrong-b'],
        },
      ],
      answerOptions: [
        { id: 'wrong-a', text: 'A', isCorrect: false },
        { id: 'wrong-b', text: 'B', isCorrect: false },
        { id: 'right', text: 'C', isCorrect: true },
      ],
    });

    expect(result?.highConfidenceWrongCount).toBe(2);
    expect(result?.highConfidenceWrongOptions).toEqual([
      { answerId: 'wrong-a', text: 'A', count: 2 },
      { answerId: 'wrong-b', text: 'B', count: 1 },
    ]);
  });

  it('liefert null ohne gültige Confidence-Werte', () => {
    expect(
      buildConfidenceResult({
        votes: [{ confidenceValue: null, isCorrect: true }],
      }),
    ).toBeNull();
  });

  it('aggregiert eine datenschutzkonforme Session-Zusammenfassung und priorisiert Fehlkonzepte', () => {
    const risky = buildConfidenceResult({
      votes: [
        { confidenceValue: 5, isCorrect: false },
        { confidenceValue: 4, isCorrect: false },
        { confidenceValue: 4, isCorrect: false },
        { confidenceValue: 5, isCorrect: true },
        { confidenceValue: 3, isCorrect: true },
      ],
    });
    const secure = buildConfidenceResult({
      votes: [
        { confidenceValue: 5, isCorrect: true },
        { confidenceValue: 5, isCorrect: true },
        { confidenceValue: 4, isCorrect: true },
        { confidenceValue: 2, isCorrect: true },
        { confidenceValue: 1, isCorrect: false },
      ],
    });
    const suppressed = buildConfidenceResult({
      votes: [
        { confidenceValue: 5, isCorrect: false },
        { confidenceValue: 5, isCorrect: false },
      ],
    });

    const result = buildSessionConfidenceSummary({
      questions: [
        {
          questionOrder: 0,
          questionTextShort: 'Sicher',
          questionType: 'SINGLE_CHOICE',
          result: secure,
        },
        {
          questionOrder: 1,
          questionTextShort: 'Riskant',
          questionType: 'MULTIPLE_CHOICE',
          result: risky,
        },
        {
          questionOrder: 2,
          questionTextShort: 'Zu klein',
          questionType: 'SHORT_TEXT',
          result: suppressed,
        },
      ],
    });

    expect(result).toMatchObject({
      responseCount: 10,
      includedQuestionCount: 2,
      suppressedQuestionCount: 1,
      priorityQuestionCount: 1,
      highConfidenceWrongCount: 3,
      questions: [
        { questionOrder: 1, responseCount: 5 },
        { questionOrder: 0, responseCount: 5 },
      ],
    });
    expect(result?.crossTab).toEqual({
      correctHigh: 4,
      correctMid: 1,
      correctLow: 1,
      incorrectHigh: 3,
      incorrectMid: 0,
      incorrectLow: 1,
    });
  });

  it('listet in der Prioritätenauswahl nur Fragen mit Fehlkonzept-Risiko', () => {
    const withRisk = buildConfidenceResult({
      votes: [
        { confidenceValue: 5, isCorrect: false },
        { confidenceValue: 5, isCorrect: false },
        { confidenceValue: 5, isCorrect: false },
        { confidenceValue: 5, isCorrect: false },
        { confidenceValue: 5, isCorrect: true },
      ],
    });
    const withoutRisk = buildConfidenceResult({
      votes: [
        { confidenceValue: 5, isCorrect: true },
        { confidenceValue: 5, isCorrect: true },
        { confidenceValue: 4, isCorrect: true },
        { confidenceValue: 2, isCorrect: false },
        { confidenceValue: 1, isCorrect: false },
      ],
    });
    const summary = buildSessionConfidenceSummary({
      questions: [
        {
          questionOrder: 0,
          questionTextShort: 'Sicher falsch',
          questionType: 'SINGLE_CHOICE',
          result: withRisk,
        },
        {
          questionOrder: 1,
          questionTextShort: 'Ohne Fehlkonzept',
          questionType: 'SINGLE_CHOICE',
          result: withoutRisk,
        },
        {
          questionOrder: 2,
          questionTextShort: 'Auch sicher falsch',
          questionType: 'MULTIPLE_CHOICE',
          result: withRisk,
        },
      ],
    });

    expect(summary?.priorityQuestionCount).toBe(2);
    expect(selectConfidencePriorityQuestions(summary?.questions ?? [], 3)).toEqual([
      expect.objectContaining({ questionOrder: 0 }),
      expect.objectContaining({ questionOrder: 2 }),
    ]);
  });

  it('liefert ohne Frage oberhalb der Datenschutzschwelle keine Session-Zusammenfassung', () => {
    const result = buildConfidenceResult({
      votes: [
        { confidenceValue: 5, isCorrect: false },
        { confidenceValue: 4, isCorrect: true },
      ],
    });

    expect(
      buildSessionConfidenceSummary({
        questions: [
          {
            questionOrder: 0,
            questionTextShort: 'Kleine Gruppe',
            questionType: 'SINGLE_CHOICE',
            result,
          },
        ],
      }),
    ).toBeNull();
  });
});
