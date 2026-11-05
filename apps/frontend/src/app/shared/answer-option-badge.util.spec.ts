import { describe, expect, it } from 'vitest';
import {
  answerOptionColor,
  answerOptionShape,
  answerOptionShapeKind,
  showQuestionTypeIndicator,
} from './answer-option-badge.util';

describe('answer-option-badge.util', () => {
  it('verwendet stabile Badge-Farben', () => {
    expect(answerOptionColor(0)).toBe('#1565c0');
    expect(answerOptionColor(8)).toBe('#1565c0');
  });

  it('macht Single-Choice mit Kreisen und Multiple-Choice mit Quadraten erkennbar', () => {
    expect(answerOptionShape(0, 'SINGLE_CHOICE', true)).toBe('○');
    expect(answerOptionShape(3, 'SINGLE_CHOICE', true)).toBe('○');
    expect(answerOptionShape(0, 'MULTIPLE_CHOICE', true)).toBe('□');
    expect(answerOptionShape(3, 'MULTIPLE_CHOICE', true)).toBe('□');
    expect(answerOptionShapeKind(0, 'SINGLE_CHOICE', true)).toBe('circle');
    expect(answerOptionShapeKind(0, 'MULTIPLE_CHOICE', true)).toBe('square');
  });

  it('laesst Umfragen und deaktivierte Indikatoren bei gemischten Formen', () => {
    expect(answerOptionShape(0, 'SURVEY', true)).toBe('△');
    expect(answerOptionShape(1, 'SURVEY', true)).toBe('○');
    expect(answerOptionShape(0, 'SINGLE_CHOICE', false)).toBe('△');
    expect(answerOptionShape(1, 'MULTIPLE_CHOICE', false)).toBe('○');
  });

  it('gibt ab der fuenften Antwort eine eigene Figur', () => {
    expect(answerOptionShapeKind(4, 'SURVEY')).toBe('star');
    expect(answerOptionShapeKind(5, 'SURVEY')).toBe('hexagon');
    expect(answerOptionShapeKind(6, 'SURVEY')).toBe('plus');
    expect(answerOptionShapeKind(7, 'SURVEY')).toBe('heart');
    expect(answerOptionShape(6, 'SURVEY')).toBe('✚');
    expect(answerOptionShape(7, 'SURVEY')).toBe('♡');
    const kinds = [0, 1, 2, 3, 4, 5, 6, 7].map((index) => answerOptionShapeKind(index, 'SURVEY'));
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it('wertet nur explizit false als ausgeblendet', () => {
    expect(showQuestionTypeIndicator(undefined)).toBe(true);
    expect(showQuestionTypeIndicator(true)).toBe(true);
    expect(showQuestionTypeIndicator(false)).toBe(false);
  });
});
