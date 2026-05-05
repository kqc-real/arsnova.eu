import { describe, expect, it } from 'vitest';
import {
  calculateVoteScore,
  getStreakMultiplier,
  isExactCorrectSelection,
  questionAffectsStreak,
  questionCountsTowardsTotalQuestions,
} from '../lib/quizScoring';

describe('quizScoring', () => {
  it('zählt nur MC/SC zu totalQuestions', () => {
    expect(questionCountsTowardsTotalQuestions('MULTIPLE_CHOICE')).toBe(true);
    expect(questionCountsTowardsTotalQuestions('SINGLE_CHOICE')).toBe(true);
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
    it('SC und MC beeinflussen den Streak', () => {
      expect(questionAffectsStreak('SINGLE_CHOICE')).toBe(true);
      expect(questionAffectsStreak('MULTIPLE_CHOICE')).toBe(true);
    });

    it('FREETEXT, SURVEY und RATING unterbrechen den Streak nicht', () => {
      expect(questionAffectsStreak('FREETEXT')).toBe(false);
      expect(questionAffectsStreak('SURVEY')).toBe(false);
      expect(questionAffectsStreak('RATING')).toBe(false);
    });
  });
});
