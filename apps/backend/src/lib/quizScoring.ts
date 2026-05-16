import {
  DIFFICULTY_MULTIPLIER,
  MAX_BASE_POINTS,
  STREAK_MULTIPLIER,
  STREAK_MULTIPLIER_MAX,
  evaluateShortAnswer,
  type Difficulty,
  type QuestionType,
  type ShortAnswerEvaluationMode,
  type ToleranceLevel,
} from '@arsnova/shared-types';

const SCORED_QUESTION_TYPES: QuestionType[] = ['MULTIPLE_CHOICE', 'SINGLE_CHOICE', 'SHORT_TEXT'];

/**
 * Streak-Multiplikator basierend auf der aktuellen Serie (Story 5.5).
 * 0/1 = ×1.0, 2 = ×1.1, 3 = ×1.2, 4 = ×1.3, 5+ = ×1.5.
 */
export function getStreakMultiplier(streakCount: number): number {
  return STREAK_MULTIPLIER[streakCount] ?? STREAK_MULTIPLIER_MAX;
}

/**
 * FREETEXT/SURVEY/RATING unterbrechen den Streak nicht (Story 5.5).
 */
export function questionAffectsStreak(type: QuestionType): boolean {
  return SCORED_QUESTION_TYPES.includes(type);
}

/**
 * Bewertbare Fragetypen zählen in Leaderboard-Metriken wie totalQuestions (Story 1.2b / 4.1).
 */
export function questionCountsTowardsTotalQuestions(type: QuestionType): boolean {
  return SCORED_QUESTION_TYPES.includes(type);
}

interface CalculateVoteScoreInput {
  type: QuestionType;
  difficulty: Difficulty;
  selectedAnswerIds: string[];
  correctAnswerIds: string[];
  freeText?: string | null;
  correctShortTextAnswers?: string[];
  shortTextMaxLength?: number | null;
  shortTextCaseSensitive?: boolean;
  shortTextEvaluationMode?: ShortAnswerEvaluationMode;
  shortTextToleranceLevel?: ToleranceLevel;
  shortTextAllowPartialCredit?: boolean;
  shortTextTrimWhitespace?: boolean;
  shortTextNormalizeWhitespace?: boolean;
  responseTimeMs?: number | null;
  timerDurationMs?: number | null;
}

export function isExactCorrectSelection(
  selectedAnswerIds: string[],
  correctAnswerIds: string[],
): boolean {
  const selected = new Set(selectedAnswerIds);
  const correct = new Set(correctAnswerIds);
  return selected.size === correct.size && [...selected].every((id) => correct.has(id));
}

/**
 * Punkte für eine abgegebene Antwort (Story 4.1).
 * Formel: difficultyMultiplier × timeBonus.
 * TimeBonus = maxPoints × (1 − responseTime / timerDuration).
 * Fallback ohne Timer: maxPoints × difficultyMultiplier (kein Zeitbonus).
 * Nicht-wertbare Typen (SURVEY, FREETEXT, RATING) geben immer 0 zurück.
 */
export function calculateVoteScore(input: CalculateVoteScoreInput): number {
  if (!questionCountsTowardsTotalQuestions(input.type)) {
    return 0;
  }

  let basePoints = MAX_BASE_POINTS;

  if (input.type === 'SHORT_TEXT') {
    const shortTextEvaluation = evaluateShortAnswer({
      modelAnswers: input.correctShortTextAnswers ?? [],
      studentAnswer: input.freeText ?? '',
      maxPoints: MAX_BASE_POINTS,
      maxLength: input.shortTextMaxLength,
      settings: {
        caseSensitive: input.shortTextCaseSensitive,
        evaluationMode: input.shortTextEvaluationMode,
        toleranceLevel: input.shortTextToleranceLevel,
        allowPartialCredit: input.shortTextAllowPartialCredit,
        trimWhitespace: input.shortTextTrimWhitespace,
        normalizeWhitespace: input.shortTextNormalizeWhitespace,
      },
    });

    if (shortTextEvaluation.points <= 0) {
      return 0;
    }
    basePoints = shortTextEvaluation.points;
  } else if (!isExactCorrectSelection(input.selectedAnswerIds, input.correctAnswerIds)) {
    return 0;
  }

  const multiplier = DIFFICULTY_MULTIPLIER[input.difficulty];

  if (
    input.timerDurationMs &&
    input.timerDurationMs > 0 &&
    input.responseTimeMs !== null &&
    input.responseTimeMs !== undefined
  ) {
    const timeFraction = Math.max(0, 1 - input.responseTimeMs / input.timerDurationMs);
    return Math.round(multiplier * basePoints * timeFraction);
  }

  return Math.round(basePoints * multiplier);
}
