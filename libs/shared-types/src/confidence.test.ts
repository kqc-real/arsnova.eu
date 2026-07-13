import { describe, expect, it } from 'vitest';
import {
  buildConfidenceResult,
  classifyConfidenceTier,
  isConfidenceScaleValue,
  questionSupportsConfidence,
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
});
