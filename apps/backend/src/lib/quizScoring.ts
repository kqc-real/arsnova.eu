import {
  DIFFICULTY_MULTIPLIER,
  MAX_BASE_POINTS,
  STREAK_MULTIPLIER,
  STREAK_MULTIPLIER_MAX,
  evaluateNumericAnswer,
  evaluateShortAnswer,
  resolveShortTextEvaluationKind,
  usesNumericShortTextEvaluation,
  type Difficulty,
  type NumericInputKind,
  type NumericToleranceMode,
  type NumericUnitFamily,
  type QuestionType,
  type ShortTextEvaluationKind,
  type ShortAnswerEvaluationMode,
  type ToleranceLevel,
} from '@arsnova/shared-types';

export const SCORED_QUESTION_TYPES = [
  'MULTIPLE_CHOICE',
  'SINGLE_CHOICE',
  'SHORT_TEXT',
  'NUMERIC_ESTIMATE',
] as const satisfies readonly QuestionType[];

const NUMERIC_ESTIMATE_MIN_IN_BAND_SCORE_RATIO = 0.1;
const NUMERIC_ESTIMATE_MAX_NEAR_MISS_SCORE_RATIO = (MAX_BASE_POINTS - 1) / MAX_BASE_POINTS;
const NUMERIC_ESTIMATE_MIN_ACCEPTED_TIME_SCORE_RATIO = 0.1;

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
  return (SCORED_QUESTION_TYPES as readonly QuestionType[]).includes(type);
}

/**
 * Bewertbare Fragetypen zählen in Leaderboard-Metriken wie totalQuestions (Story 1.2b / 4.1).
 */
export function questionCountsTowardsTotalQuestions(type: QuestionType): boolean {
  return (SCORED_QUESTION_TYPES as readonly QuestionType[]).includes(type);
}

interface CalculateVoteScoreInput {
  type: QuestionType;
  difficulty: Difficulty;
  selectedAnswerIds: string[];
  correctAnswerIds: string[];
  freeText?: string | null;
  correctShortTextAnswers?: string[];
  shortTextEvaluationKind?: ShortTextEvaluationKind;
  shortTextMaxLength?: number | null;
  shortTextCaseSensitive?: boolean;
  shortTextEvaluationMode?: ShortAnswerEvaluationMode;
  shortTextToleranceLevel?: ToleranceLevel;
  shortTextAllowPartialCredit?: boolean;
  shortTextTrimWhitespace?: boolean;
  shortTextNormalizeWhitespace?: boolean;
  numericInputKind?: NumericInputKind;
  numericToleranceMode?: NumericToleranceMode;
  numericAbsoluteTolerance?: number | null;
  numericRelativeTolerancePercent?: number | null;
  numericUnitFamily?: NumericUnitFamily;
  numericRequireUnit?: boolean;
  numericAcceptEquivalentUnits?: boolean;
  responseTimeMs?: number | null;
  timerDurationMs?: number | null;
  /** Überschreibt die Korrektheitsprüfung (z.B. für NUMERIC_ESTIMATE, wo keine answerIds existieren). */
  isCorrectOverride?: boolean;
  numericEstimateValue?: number | null;
  numericEstimateReferenceValue?: number | null;
  numericEstimateToleranceBand?: { left: number; right: number } | null;
}

export function isExactCorrectSelection(
  selectedAnswerIds: string[],
  correctAnswerIds: string[],
): boolean {
  const selected = new Set(selectedAnswerIds);
  const correct = new Set(correctAnswerIds);
  return selected.size === correct.size && [...selected].every((id) => correct.has(id));
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function calculateNumericEstimateScoreRatio(input: {
  value?: number | null;
  referenceValue?: number | null;
  toleranceBand?: { left: number; right: number } | null;
}): number | null {
  const value = input.value;
  const referenceValue = input.referenceValue;
  const band = input.toleranceBand;
  if (
    value === null ||
    value === undefined ||
    referenceValue === null ||
    referenceValue === undefined ||
    band === null ||
    band === undefined ||
    !Number.isFinite(value) ||
    !Number.isFinite(referenceValue) ||
    !Number.isFinite(band.left) ||
    !Number.isFinite(band.right) ||
    band.left >= band.right
  ) {
    return null;
  }

  if (value < band.left || value > band.right) {
    return 0;
  }

  const distance = Math.abs(value - referenceValue);
  if (distance === 0) {
    return 1;
  }

  const sideLimit = value < referenceValue ? band.left : band.right;
  const maxDistanceOnSide = Math.abs(referenceValue - sideLimit);
  if (maxDistanceOnSide <= 0) {
    return 0;
  }

  const normalizedDistance = clamp01(distance / maxDistanceOnSide);
  const nearnessRatio = 1 - normalizedDistance ** 2;
  const scoreRatio =
    NUMERIC_ESTIMATE_MIN_IN_BAND_SCORE_RATIO +
    (1 - NUMERIC_ESTIMATE_MIN_IN_BAND_SCORE_RATIO) * nearnessRatio;
  return Math.min(scoreRatio, NUMERIC_ESTIMATE_MAX_NEAR_MISS_SCORE_RATIO);
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
    const evaluationKind = resolveShortTextEvaluationKind(input.shortTextEvaluationKind);
    const shortTextEvaluation = usesNumericShortTextEvaluation(evaluationKind)
      ? evaluateNumericAnswer({
          modelAnswers: input.correctShortTextAnswers ?? [],
          studentAnswer: input.freeText ?? '',
          maxPoints: MAX_BASE_POINTS,
          settings: {
            inputKind: input.numericInputKind,
            toleranceMode: input.numericToleranceMode,
            absoluteTolerance: input.numericAbsoluteTolerance,
            relativeTolerancePercent: input.numericRelativeTolerancePercent,
            unitFamily: evaluationKind === 'numeric_unit' ? input.numericUnitFamily : 'none',
            requireUnit: evaluationKind === 'numeric_unit' ? input.numericRequireUnit : false,
            acceptEquivalentUnits:
              evaluationKind === 'numeric_unit' ? input.numericAcceptEquivalentUnits : true,
          },
        })
      : evaluateShortAnswer({
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
  } else if (input.type === 'NUMERIC_ESTIMATE') {
    const scoreRatio = calculateNumericEstimateScoreRatio({
      value: input.numericEstimateValue,
      referenceValue: input.numericEstimateReferenceValue,
      toleranceBand: input.numericEstimateToleranceBand,
    });
    if (scoreRatio !== null) {
      if (scoreRatio <= 0) {
        return 0;
      }
      basePoints = Math.round(MAX_BASE_POINTS * scoreRatio);
    } else {
      const isCorrect =
        input.isCorrectOverride !== undefined
          ? input.isCorrectOverride
          : isExactCorrectSelection(input.selectedAnswerIds, input.correctAnswerIds);
      if (!isCorrect) {
        return 0;
      }
    }
  } else {
    const isCorrect =
      input.isCorrectOverride !== undefined
        ? input.isCorrectOverride
        : isExactCorrectSelection(input.selectedAnswerIds, input.correctAnswerIds);
    if (!isCorrect) {
      return 0;
    }
  }

  const multiplier = DIFFICULTY_MULTIPLIER[input.difficulty];

  if (
    input.timerDurationMs &&
    input.timerDurationMs > 0 &&
    input.responseTimeMs !== null &&
    input.responseTimeMs !== undefined
  ) {
    const rawTimeFraction = Math.max(0, 1 - input.responseTimeMs / input.timerDurationMs);
    const timeFraction =
      input.type === 'NUMERIC_ESTIMATE'
        ? Math.max(rawTimeFraction, NUMERIC_ESTIMATE_MIN_ACCEPTED_TIME_SCORE_RATIO)
        : rawTimeFraction;
    return Math.round(multiplier * basePoints * timeFraction);
  }

  return Math.round(basePoints * multiplier);
}
