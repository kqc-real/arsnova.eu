import { z } from 'zod';
import {
  CONFIDENCE_SCALE_MAX,
  CONFIDENCE_SCALE_MIN,
  questionSupportsConfidence,
} from './confidence';

// ---------------------------------------------------------------------------
// Enums – müssen mit Prisma-Schema synchron bleiben
// ---------------------------------------------------------------------------

export const QuestionTypeEnum = z.enum([
  'MULTIPLE_CHOICE',
  'SINGLE_CHOICE',
  'FREETEXT',
  'SHORT_TEXT',
  'SURVEY',
  'RATING',
  'NUMERIC_ESTIMATE',
]);
export type QuestionType = z.infer<typeof QuestionTypeEnum>;

/** Toleranzmodus für numerische Schätzfragen (Story 1.2d). */
export const NumericEstimateToleranceModeEnum = z.enum(['ABSOLUTE_INTERVAL', 'RELATIVE_PERCENT']);
export type NumericEstimateToleranceMode = z.infer<typeof NumericEstimateToleranceModeEnum>;
export const NUMERIC_ESTIMATE_DEFAULT_TOLERANCE_MODE: NumericEstimateToleranceMode =
  'ABSOLUTE_INTERVAL';

/** Eingabetyp für numerische Schätzfragen (Story 1.2d). */
export const NumericInputTypeEnum = z.enum(['INTEGER', 'DECIMAL']);
export type NumericInputType = z.infer<typeof NumericInputTypeEnum>;

export const SessionStatusEnum = z.enum([
  'LOBBY',
  'QUESTION_OPEN',
  'ACTIVE',
  'PAUSED',
  'RESULTS',
  'DISCUSSION',
  'FINISHED',
]);
export type SessionStatus = z.infer<typeof SessionStatusEnum>;

export const DifficultyEnum = z.enum(['EASY', 'MEDIUM', 'HARD']);
export type Difficulty = z.infer<typeof DifficultyEnum>;

export const TIMER_DIFFICULTY_SCALE_FACTORS: Record<Difficulty, number> = {
  EASY: 1,
  MEDIUM: 1.5,
  HARD: 2,
};

export const NicknameThemeEnum = z.enum([
  'NOBEL_LAUREATES',
  'KINDERGARTEN',
  'PRIMARY_SCHOOL',
  'MIDDLE_SCHOOL',
  'HIGH_SCHOOL',
]);
export type NicknameTheme = z.infer<typeof NicknameThemeEnum>;

export const TeamAssignmentEnum = z.enum(['AUTO', 'MANUAL']);
export type TeamAssignment = z.infer<typeof TeamAssignmentEnum>;

export const TeamNamesSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(8)
  .superRefine((names, ctx) => {
    const seen = new Set<string>();
    for (const [index, name] of names.entries()) {
      const normalized = name.trim().toLocaleLowerCase();
      if (seen.has(normalized)) {
        ctx.addIssue({
          code: 'custom',
          path: [index],
          message: 'Team-Namen müssen eindeutig sein.',
        });
      }
      seen.add(normalized);
    }
  });
export type TeamNames = z.infer<typeof TeamNamesSchema>;

export const QaQuestionStatusEnum = z.enum(['PENDING', 'ACTIVE', 'PINNED', 'ARCHIVED', 'DELETED']);
export type QaQuestionStatus = z.infer<typeof QaQuestionStatusEnum>;

export const QaQuestionSortModeEnum = z.enum(['TOP', 'BEST', 'CONTROVERSIAL']);
export type QaQuestionSortMode = z.infer<typeof QaQuestionSortModeEnum>;

export const SessionTypeEnum = z.enum(['QUIZ', 'Q_AND_A']);
export type SessionType = z.infer<typeof SessionTypeEnum>;

/** Quiz-Presets für Schnellkonfiguration (Story 1.11) */
export const QuizPresetEnum = z.enum(['PLAYFUL', 'SERIOUS']);
export type QuizPreset = z.infer<typeof QuizPresetEnum>;

/** Multiplikatoren für die Punkteberechnung pro Schwierigkeitsgrad */
export const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = {
  EASY: 1,
  MEDIUM: 2,
  HARD: 3,
};

/** Maximale Basispunkte pro Frage (vor Multiplikator) */
export const MAX_BASE_POINTS = 1000;

/** Standard- und Obergrenzen für bewertbare Kurzantworten (Story 1.2e). */
export const SHORT_TEXT_DEFAULT_MAX_LENGTH = 120;
export const SHORT_TEXT_MAX_LENGTH_LIMIT = 500;

export const ShortAnswerEvaluationModeEnum = z.enum(['exact', 'hamming', 'levenshtein', 'auto']);
export type ShortAnswerEvaluationMode = z.infer<typeof ShortAnswerEvaluationModeEnum>;

export const ToleranceLevelEnum = z.enum(['none', 'low', 'medium', 'high']);
export type ToleranceLevel = z.infer<typeof ToleranceLevelEnum>;

export const ShortTextEvaluationKindEnum = z.enum(['text', 'numeric', 'numeric_unit']);
export type ShortTextEvaluationKind = z.infer<typeof ShortTextEvaluationKindEnum>;

export const NumericInputKindEnum = z.enum(['integer', 'decimal']);
export type NumericInputKind = z.infer<typeof NumericInputKindEnum>;

export const NumericToleranceModeEnum = z.enum(['exact', 'absolute', 'relative']);
export type NumericToleranceMode = z.infer<typeof NumericToleranceModeEnum>;
export const QuestionNumericToleranceModeSchema = z.union([
  NumericToleranceModeEnum,
  NumericEstimateToleranceModeEnum,
]);
export type QuestionNumericToleranceMode = z.infer<typeof QuestionNumericToleranceModeSchema>;

export const NumericUnitFamilyEnum = z.enum(['none', 'length', 'mass', 'time', 'volume']);
export type NumericUnitFamily = z.infer<typeof NumericUnitFamilyEnum>;

export const SHORT_TEXT_DEFAULT_EVALUATION_MODE: ShortAnswerEvaluationMode = 'auto';
export const SHORT_TEXT_DEFAULT_TOLERANCE_LEVEL: ToleranceLevel = 'low';
export const SHORT_TEXT_DEFAULT_EVALUATION_KIND: ShortTextEvaluationKind = 'text';
export const SHORT_TEXT_TOLERANCE_THRESHOLDS: Record<ToleranceLevel, number> = {
  none: 0,
  low: 0.1,
  medium: 0.2,
  high: 0.3,
};
export const NUMERIC_DEFAULT_INPUT_KIND: NumericInputKind = 'decimal';
export const NUMERIC_DEFAULT_TOLERANCE_MODE: NumericToleranceMode = 'exact';
export const NUMERIC_DEFAULT_UNIT_FAMILY: NumericUnitFamily = 'none';

type ShortTextNormalizationOptions = {
  caseSensitive?: boolean;
  maxLength?: number | null;
  trimWhitespace?: boolean;
  normalizeWhitespace?: boolean;
};

export type ShortTextEvaluationOptions = ShortTextNormalizationOptions & {
  evaluationMode?: ShortAnswerEvaluationMode;
  toleranceLevel?: ToleranceLevel;
  allowPartialCredit?: boolean;
};

export type NumericEvaluationOptions = {
  inputKind?: NumericInputKind;
  toleranceMode?: NumericToleranceMode;
  absoluteTolerance?: number | null;
  relativeTolerancePercent?: number | null;
  unitFamily?: NumericUnitFamily;
  requireUnit?: boolean;
  acceptEquivalentUnits?: boolean;
};

export type NumericQuestionEvaluationOptions = {
  numericInputKind?: NumericInputKind | null;
  numericToleranceMode?: NumericToleranceMode | null;
  numericAbsoluteTolerance?: number | null;
  numericRelativeTolerancePercent?: number | null;
  numericUnitFamily?: NumericUnitFamily | null;
  numericRequireUnit?: boolean | null;
  numericAcceptEquivalentUnits?: boolean | null;
};

export const ShortAnswerEvaluationSettingsSchema = z.object({
  evaluationMode: ShortAnswerEvaluationModeEnum.default(SHORT_TEXT_DEFAULT_EVALUATION_MODE),
  toleranceLevel: ToleranceLevelEnum.default(SHORT_TEXT_DEFAULT_TOLERANCE_LEVEL),
  allowPartialCredit: z.boolean().default(true),
  caseSensitive: z.boolean().default(false),
  trimWhitespace: z.boolean().default(true),
  normalizeWhitespace: z.boolean().default(true),
});
export type ShortAnswerEvaluationSettings = z.infer<typeof ShortAnswerEvaluationSettingsSchema>;

export const DEFAULT_SHORT_ANSWER_EVALUATION_SETTINGS: ShortAnswerEvaluationSettings = {
  evaluationMode: SHORT_TEXT_DEFAULT_EVALUATION_MODE,
  toleranceLevel: SHORT_TEXT_DEFAULT_TOLERANCE_LEVEL,
  allowPartialCredit: true,
  caseSensitive: false,
  trimWhitespace: true,
  normalizeWhitespace: true,
};

export const NumericEvaluationSettingsSchema = z.object({
  inputKind: NumericInputKindEnum.default(NUMERIC_DEFAULT_INPUT_KIND),
  toleranceMode: NumericToleranceModeEnum.default(NUMERIC_DEFAULT_TOLERANCE_MODE),
  absoluteTolerance: z.number().min(0).nullable().default(null),
  relativeTolerancePercent: z.number().min(0).nullable().default(null),
  unitFamily: NumericUnitFamilyEnum.default(NUMERIC_DEFAULT_UNIT_FAMILY),
  requireUnit: z.boolean().default(false),
  acceptEquivalentUnits: z.boolean().default(true),
});
export type NumericEvaluationSettings = z.infer<typeof NumericEvaluationSettingsSchema>;

export const DEFAULT_NUMERIC_EVALUATION_SETTINGS: NumericEvaluationSettings = {
  inputKind: NUMERIC_DEFAULT_INPUT_KIND,
  toleranceMode: NUMERIC_DEFAULT_TOLERANCE_MODE,
  absoluteTolerance: null,
  relativeTolerancePercent: null,
  unitFamily: NUMERIC_DEFAULT_UNIT_FAMILY,
  requireUnit: false,
  acceptEquivalentUnits: true,
};

type NumericUnitStatus =
  | 'not_applicable'
  | 'exact'
  | 'equivalent'
  | 'missing_optional'
  | 'missing_required'
  | 'equivalent_not_accepted'
  | 'wrong_family'
  | 'unsupported';
type NumericFeedbackCategory =
  'exact_match' | 'within_tolerance' | 'unit_partial' | 'invalid_input' | 'no_match';

export interface EvaluateNumericAnswerInput {
  modelAnswers: string[];
  studentAnswer: string;
  maxPoints: number;
  settings?: NumericEvaluationOptions | null;
}

export interface EvaluateNumericAnswerResult {
  points: number;
  maxPoints: number;
  matchedModelAnswer: string | null;
  parsedStudentValue: number | null;
  parsedStudentUnit: string | null;
  parsedReferenceValue: number | null;
  parsedReferenceUnit: string | null;
  acceptedRange: { min: number; max: number } | null;
  distance: number | null;
  normalizedDistance: number | null;
  unitStatus: NumericUnitStatus;
  feedbackCategory: NumericFeedbackCategory;
  explanation: string;
}

type ShortAnswerEvaluationMethod =
  'exact' | 'hamming' | 'levenshtein' | 'damerau_levenshtein' | 'none';
type ShortAnswerFeedbackCategory = 'exact_match' | 'minor_typo' | 'partial_match' | 'no_match';

export interface EvaluateShortAnswerInput {
  modelAnswers: string[];
  studentAnswer: string;
  maxPoints: number;
  settings?: ShortTextEvaluationOptions | null;
  maxLength?: number | null;
}

export interface EvaluateShortAnswerResult {
  points: number;
  maxPoints: number;
  matchedModelAnswer: string | null;
  distance: number | null;
  normalizedDistance: number | null;
  similarity: number | null;
  evaluationMethod: ShortAnswerEvaluationMethod;
  feedbackCategory: ShortAnswerFeedbackCategory;
  explanation: string;
}

const SHORT_TEXT_DISTANCE_BANDS = [
  { maxDistance: 0.1, minRatio: 0.9, maxRatio: 1.0 },
  { maxDistance: 0.2, minRatio: 0.7, maxRatio: 0.8 },
  { maxDistance: 0.3, minRatio: 0.4, maxRatio: 0.6 },
] as const;

const SHORT_TEXT_EVALUATION_METHOD_PRIORITY: Record<ShortAnswerEvaluationMethod, number> = {
  exact: 0,
  hamming: 1,
  levenshtein: 2,
  damerau_levenshtein: 3,
  none: 4,
};

export function resolveShortAnswerEvaluationSettings(
  options?: ShortTextEvaluationOptions | null,
): ShortAnswerEvaluationSettings {
  return {
    evaluationMode: options?.evaluationMode ?? SHORT_TEXT_DEFAULT_EVALUATION_MODE,
    toleranceLevel: options?.toleranceLevel ?? SHORT_TEXT_DEFAULT_TOLERANCE_LEVEL,
    allowPartialCredit: options?.allowPartialCredit ?? true,
    caseSensitive: options?.caseSensitive ?? false,
    trimWhitespace: options?.trimWhitespace ?? true,
    normalizeWhitespace: options?.normalizeWhitespace ?? true,
  };
}

export function resolveShortTextEvaluationKind(
  kind?: ShortTextEvaluationKind | null,
): ShortTextEvaluationKind {
  return kind ?? SHORT_TEXT_DEFAULT_EVALUATION_KIND;
}

export function usesNumericShortTextEvaluation(kind?: ShortTextEvaluationKind | null): boolean {
  return resolveShortTextEvaluationKind(kind) !== 'text';
}

export function usesShortTextUnitEvaluation(kind?: ShortTextEvaluationKind | null): boolean {
  return resolveShortTextEvaluationKind(kind) === 'numeric_unit';
}

export function resolveNumericEvaluationSettings(
  options?: NumericEvaluationOptions | null,
): NumericEvaluationSettings {
  return {
    inputKind: options?.inputKind ?? NUMERIC_DEFAULT_INPUT_KIND,
    toleranceMode: options?.toleranceMode ?? NUMERIC_DEFAULT_TOLERANCE_MODE,
    absoluteTolerance: options?.absoluteTolerance ?? null,
    relativeTolerancePercent: options?.relativeTolerancePercent ?? null,
    unitFamily: options?.unitFamily ?? NUMERIC_DEFAULT_UNIT_FAMILY,
    requireUnit: options?.requireUnit ?? false,
    acceptEquivalentUnits: options?.acceptEquivalentUnits ?? true,
  };
}

export function resolveNumericQuestionEvaluationSettings(
  options?: NumericQuestionEvaluationOptions | null,
): NumericEvaluationSettings {
  return resolveNumericEvaluationSettings({
    inputKind: options?.numericInputKind ?? undefined,
    toleranceMode: options?.numericToleranceMode ?? undefined,
    absoluteTolerance: options?.numericAbsoluteTolerance ?? undefined,
    relativeTolerancePercent: options?.numericRelativeTolerancePercent ?? undefined,
    unitFamily: options?.numericUnitFamily ?? undefined,
    requireUnit: options?.numericRequireUnit ?? undefined,
    acceptEquivalentUnits: options?.numericAcceptEquivalentUnits ?? undefined,
  });
}

export function isNumericToleranceMode(value: unknown): value is NumericToleranceMode {
  return NumericToleranceModeEnum.safeParse(value).success;
}

export function isNumericEstimateToleranceMode(
  value: unknown,
): value is NumericEstimateToleranceMode {
  return NumericEstimateToleranceModeEnum.safeParse(value).success;
}

export function resolveNumericEstimateToleranceMode(
  mode?: QuestionNumericToleranceMode | string | null,
): NumericEstimateToleranceMode {
  return isNumericEstimateToleranceMode(mode) ? mode : NUMERIC_ESTIMATE_DEFAULT_TOLERANCE_MODE;
}

export function resolveShortTextMaxLength(maxLength: number | null | undefined): number {
  if (typeof maxLength !== 'number' || !Number.isFinite(maxLength) || maxLength < 1) {
    return SHORT_TEXT_DEFAULT_MAX_LENGTH;
  }

  return Math.min(Math.trunc(maxLength), SHORT_TEXT_MAX_LENGTH_LIMIT);
}

export function normalizeShortTextValue(
  value: string,
  options?: ShortTextNormalizationOptions,
): string {
  const trimWhitespace = options?.trimWhitespace ?? true;
  const normalizeWhitespace = options?.normalizeWhitespace ?? true;

  let normalizedValue = trimWhitespace ? value.trim() : value;
  if (normalizeWhitespace) {
    normalizedValue = normalizedValue.replace(/\s+/g, ' ');
  }

  if (!normalizedValue.trim()) {
    return '';
  }

  return options?.caseSensitive ? normalizedValue : normalizedValue.toLowerCase();
}

export function calculateHammingDistance(
  modelAnswer: string,
  studentAnswer: string,
): number | null {
  if (modelAnswer.length !== studentAnswer.length) {
    return null;
  }

  let distance = 0;
  for (let index = 0; index < modelAnswer.length; index += 1) {
    if (modelAnswer[index] !== studentAnswer[index]) {
      distance += 1;
    }
  }

  return distance;
}

export function calculateLevenshteinDistance(modelAnswer: string, studentAnswer: string): number {
  if (modelAnswer === studentAnswer) {
    return 0;
  }
  if (!modelAnswer.length) {
    return studentAnswer.length;
  }
  if (!studentAnswer.length) {
    return modelAnswer.length;
  }

  const previousRow = Array.from({ length: studentAnswer.length + 1 }, (_, index) => index);

  for (let modelIndex = 0; modelIndex < modelAnswer.length; modelIndex += 1) {
    let previousDiagonal = previousRow[0];
    previousRow[0] = modelIndex + 1;

    for (let studentIndex = 0; studentIndex < studentAnswer.length; studentIndex += 1) {
      const originalValue = previousRow[studentIndex + 1];
      const substitutionCost = modelAnswer[modelIndex] === studentAnswer[studentIndex] ? 0 : 1;

      previousRow[studentIndex + 1] = Math.min(
        previousRow[studentIndex + 1] + 1,
        previousRow[studentIndex] + 1,
        previousDiagonal + substitutionCost,
      );

      previousDiagonal = originalValue;
    }
  }

  return previousRow[studentAnswer.length];
}

export function calculateDamerauLevenshteinDistance(
  modelAnswer: string,
  studentAnswer: string,
): number {
  if (modelAnswer === studentAnswer) {
    return 0;
  }
  if (!modelAnswer.length) {
    return studentAnswer.length;
  }
  if (!studentAnswer.length) {
    return modelAnswer.length;
  }

  const matrix = Array.from({ length: modelAnswer.length + 1 }, () =>
    Array<number>(studentAnswer.length + 1).fill(0),
  );

  for (let modelIndex = 0; modelIndex <= modelAnswer.length; modelIndex += 1) {
    matrix[modelIndex]![0] = modelIndex;
  }
  for (let studentIndex = 0; studentIndex <= studentAnswer.length; studentIndex += 1) {
    matrix[0]![studentIndex] = studentIndex;
  }

  for (let modelIndex = 1; modelIndex <= modelAnswer.length; modelIndex += 1) {
    for (let studentIndex = 1; studentIndex <= studentAnswer.length; studentIndex += 1) {
      const substitutionCost =
        modelAnswer[modelIndex - 1] === studentAnswer[studentIndex - 1] ? 0 : 1;

      matrix[modelIndex]![studentIndex] = Math.min(
        matrix[modelIndex - 1]![studentIndex]! + 1,
        matrix[modelIndex]![studentIndex - 1]! + 1,
        matrix[modelIndex - 1]![studentIndex - 1]! + substitutionCost,
      );

      if (
        modelIndex > 1 &&
        studentIndex > 1 &&
        modelAnswer[modelIndex - 1] === studentAnswer[studentIndex - 2] &&
        modelAnswer[modelIndex - 2] === studentAnswer[studentIndex - 1]
      ) {
        matrix[modelIndex]![studentIndex] = Math.min(
          matrix[modelIndex]![studentIndex]!,
          matrix[modelIndex - 2]![studentIndex - 2]! + 1,
        );
      }
    }
  }

  return matrix[modelAnswer.length]![studentAnswer.length]!;
}

function createZeroShortAnswerResult(maxPoints: number): EvaluateShortAnswerResult {
  return {
    points: 0,
    maxPoints,
    matchedModelAnswer: null,
    distance: null,
    normalizedDistance: null,
    similarity: null,
    evaluationMethod: 'none',
    feedbackCategory: 'no_match',
    explanation: 'No model answer matched within the configured tolerance.',
  };
}

function resolveShortAnswerEvaluationMethods(
  modelAnswer: string,
  studentAnswer: string,
  evaluationMode: ShortAnswerEvaluationMode,
): ShortAnswerEvaluationMethod[] {
  // Stable pipeline: exact matches on explicit variants win first, then mode-specific
  // distance methods run in deterministic priority order.
  if (modelAnswer === studentAnswer) {
    return ['exact'];
  }

  switch (evaluationMode) {
    case 'exact':
      return ['exact'];
    case 'hamming':
      return modelAnswer.length === studentAnswer.length
        ? ['hamming', 'damerau_levenshtein']
        : ['none'];
    case 'levenshtein':
      return ['levenshtein', 'damerau_levenshtein'];
    case 'auto':
      return modelAnswer.length === studentAnswer.length
        ? ['hamming', 'damerau_levenshtein', 'levenshtein']
        : ['levenshtein', 'damerau_levenshtein'];
  }
}

function resolveShortAnswerDistance(
  modelAnswer: string,
  studentAnswer: string,
  evaluationMethod: ShortAnswerEvaluationMethod,
): { distance: number | null; normalizedDistance: number | null } {
  switch (evaluationMethod) {
    case 'exact': {
      const distance = modelAnswer === studentAnswer ? 0 : 1;
      return { distance, normalizedDistance: distance };
    }
    case 'hamming': {
      const distance = calculateHammingDistance(modelAnswer, studentAnswer);
      return {
        distance,
        normalizedDistance: distance === null ? null : distance / Math.max(modelAnswer.length, 1),
      };
    }
    case 'levenshtein': {
      const distance = calculateLevenshteinDistance(modelAnswer, studentAnswer);
      return {
        distance,
        normalizedDistance: distance / Math.max(modelAnswer.length, studentAnswer.length, 1),
      };
    }
    case 'damerau_levenshtein': {
      const distance = calculateDamerauLevenshteinDistance(modelAnswer, studentAnswer);
      return {
        distance,
        normalizedDistance: distance / Math.max(modelAnswer.length, studentAnswer.length, 1),
      };
    }
    case 'none':
      return { distance: null, normalizedDistance: null };
  }
}

function createShortAnswerExplanation(result: {
  points: number;
  maxPoints: number;
  evaluationMethod: ShortAnswerEvaluationMethod;
  feedbackCategory: ShortAnswerFeedbackCategory;
  normalizedDistance: number | null;
}): string {
  if (result.feedbackCategory === 'no_match') {
    switch (result.evaluationMethod) {
      case 'exact':
        return 'No exact match after normalization.';
      case 'none':
        return 'Configured comparison could not be applied to this answer length.';
      default:
        return 'Closest match stayed outside the configured tolerance.';
    }
  }

  if (result.normalizedDistance === 0) {
    return 'Exact match after normalization.';
  }

  const awardsFullPoints = result.points >= result.maxPoints && result.maxPoints > 0;
  switch (result.evaluationMethod) {
    case 'hamming':
      return awardsFullPoints
        ? 'Accepted minor same-length character difference within tolerance.'
        : 'Partial credit for a minor same-length character difference.';
    case 'levenshtein':
      return awardsFullPoints
        ? 'Accepted missing or additional character within tolerance.'
        : 'Partial credit for a missing or additional character.';
    case 'damerau_levenshtein':
      return awardsFullPoints
        ? 'Accepted adjacent transposition within tolerance.'
        : 'Partial credit for an adjacent transposition.';
    case 'exact':
      return 'Exact match after normalization.';
    case 'none':
      return 'No supported comparison was available.';
  }
}

function isBetterShortAnswerResult(
  candidate: EvaluateShortAnswerResult,
  current: EvaluateShortAnswerResult,
): boolean {
  if (candidate.points !== current.points) {
    return candidate.points > current.points;
  }

  const candidateDistance = candidate.normalizedDistance ?? Number.POSITIVE_INFINITY;
  const currentDistance = current.normalizedDistance ?? Number.POSITIVE_INFINITY;
  if (candidateDistance !== currentDistance) {
    return candidateDistance < currentDistance;
  }

  return (
    SHORT_TEXT_EVALUATION_METHOD_PRIORITY[candidate.evaluationMethod] <
    SHORT_TEXT_EVALUATION_METHOD_PRIORITY[current.evaluationMethod]
  );
}

function calculateShortAnswerPoints(
  maxPoints: number,
  normalizedDistance: number,
  threshold: number,
  allowPartialCredit: boolean,
): number {
  if (maxPoints <= 0) {
    return 0;
  }

  if (normalizedDistance === 0) {
    return Math.round(maxPoints);
  }

  if (normalizedDistance > threshold) {
    return 0;
  }

  if (!allowPartialCredit) {
    return Math.round(maxPoints);
  }

  const band = SHORT_TEXT_DISTANCE_BANDS.find(
    (candidate) => normalizedDistance <= candidate.maxDistance,
  );
  if (!band) {
    return 0;
  }

  const lowerBand = SHORT_TEXT_DISTANCE_BANDS[SHORT_TEXT_DISTANCE_BANDS.indexOf(band) - 1] ?? null;
  const lowerDistance = lowerBand?.maxDistance ?? 0;
  const progress =
    band.maxDistance === lowerDistance
      ? 1
      : (normalizedDistance - lowerDistance) / (band.maxDistance - lowerDistance);
  const ratio = band.maxRatio - (band.maxRatio - band.minRatio) * progress;

  return Math.max(0, Math.min(Math.round(maxPoints * ratio), Math.round(maxPoints)));
}

export function evaluateShortAnswer(input: EvaluateShortAnswerInput): EvaluateShortAnswerResult {
  const maxPoints = Math.max(0, input.maxPoints);
  const settings = resolveShortAnswerEvaluationSettings(input.settings);
  const normalizationOptions: ShortTextNormalizationOptions = {
    caseSensitive: settings.caseSensitive,
    maxLength: input.maxLength,
    trimWhitespace: settings.trimWhitespace,
    normalizeWhitespace: settings.normalizeWhitespace,
  };
  const normalizedStudentAnswer = normalizeShortTextValue(
    input.studentAnswer,
    normalizationOptions,
  );

  if (!normalizedStudentAnswer) {
    return createZeroShortAnswerResult(maxPoints);
  }

  const maxLength =
    typeof input.maxLength === 'number' ? resolveShortTextMaxLength(input.maxLength) : null;
  if (maxLength !== null && normalizedStudentAnswer.length > maxLength) {
    return createZeroShortAnswerResult(maxPoints);
  }

  let bestResult = createZeroShortAnswerResult(maxPoints);

  for (const modelAnswer of input.modelAnswers) {
    const normalizedModelAnswer = normalizeShortTextValue(modelAnswer, normalizationOptions);
    if (!normalizedModelAnswer) {
      continue;
    }

    const evaluationMethods = resolveShortAnswerEvaluationMethods(
      normalizedModelAnswer,
      normalizedStudentAnswer,
      settings.evaluationMode,
    );

    for (const evaluationMethod of evaluationMethods) {
      const { distance, normalizedDistance } = resolveShortAnswerDistance(
        normalizedModelAnswer,
        normalizedStudentAnswer,
        evaluationMethod,
      );

      if (normalizedDistance === null) {
        continue;
      }

      const threshold =
        evaluationMethod === 'exact' ? 0 : SHORT_TEXT_TOLERANCE_THRESHOLDS[settings.toleranceLevel];
      const similarity = Math.max(0, 1 - normalizedDistance);
      const points = calculateShortAnswerPoints(
        maxPoints,
        normalizedDistance,
        threshold,
        settings.allowPartialCredit,
      );
      const feedbackCategory: ShortAnswerFeedbackCategory =
        points <= 0
          ? 'no_match'
          : normalizedDistance === 0
            ? 'exact_match'
            : normalizedDistance <= 0.1
              ? 'minor_typo'
              : 'partial_match';

      const result: EvaluateShortAnswerResult = {
        points,
        maxPoints,
        matchedModelAnswer: modelAnswer,
        distance,
        normalizedDistance,
        similarity,
        evaluationMethod,
        feedbackCategory,
        explanation: createShortAnswerExplanation({
          points,
          maxPoints,
          evaluationMethod,
          feedbackCategory,
          normalizedDistance,
        }),
      };

      if (isBetterShortAnswerResult(result, bestResult)) {
        bestResult = result;
      }
    }
  }

  return bestResult;
}

export function isShortTextCorrect(
  value: string,
  solutions: readonly string[],
  options?: ShortTextEvaluationOptions,
): boolean {
  return (
    evaluateShortAnswer({
      modelAnswers: [...solutions],
      studentAnswer: value,
      maxPoints: 1,
      maxLength: options?.maxLength,
      settings: options,
    }).points > 0
  );
}

type ParsedNumericAnswer = {
  normalizedInput: string;
  value: number;
  unit: string | null;
  unitFamily: NumericUnitFamily | null;
  factor: number | null;
};

const NUMERIC_UNIT_FACTORS: Record<Exclude<NumericUnitFamily, 'none'>, Record<string, number>> = {
  length: {
    mm: 0.001,
    cm: 0.01,
    m: 1,
    km: 1000,
  },
  mass: {
    mg: 0.001,
    g: 1,
    kg: 1000,
    t: 1_000_000,
  },
  time: {
    ms: 0.001,
    s: 1,
    min: 60,
    h: 3600,
  },
  volume: {
    ml: 0.001,
    l: 1,
  },
};

const NUMERIC_UNIT_STATUS_PRIORITY: Record<NumericUnitStatus, number> = {
  not_applicable: 0,
  exact: 0,
  equivalent: 1,
  missing_optional: 2,
  missing_required: 3,
  equivalent_not_accepted: 4,
  wrong_family: 5,
  unsupported: 6,
};

const NUMERIC_UNIT_PARTIAL_CREDIT_RATIO = 0.5;
const NUMERIC_INPUT_REGEX = /^([+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+))(?:\s*([a-zA-Z]+))?$/;

function getNumericUnitFamilyForUnit(unit: string): Exclude<NumericUnitFamily, 'none'> | null {
  for (const [family, units] of Object.entries(NUMERIC_UNIT_FACTORS)) {
    if (unit in units) {
      return family as Exclude<NumericUnitFamily, 'none'>;
    }
  }

  return null;
}

function parseNumericAnswer(
  input: string,
  settings: NumericEvaluationSettings,
): ParsedNumericAnswer | null {
  const normalizedInput = input.trim().replace(/\s+/g, ' ');
  if (!normalizedInput) {
    return null;
  }

  const match = NUMERIC_INPUT_REGEX.exec(normalizedInput);
  if (!match) {
    return null;
  }

  const numericPart = match[1]?.replace(',', '.');
  if (!numericPart) {
    return null;
  }

  const value = Number(numericPart);
  if (!Number.isFinite(value)) {
    return null;
  }
  if (settings.inputKind === 'integer' && !Number.isInteger(value)) {
    return null;
  }

  const unit = match[2]?.toLowerCase() ?? null;
  if (!unit) {
    return {
      normalizedInput,
      value,
      unit: null,
      unitFamily: null,
      factor: null,
    };
  }

  const unitFamily = getNumericUnitFamilyForUnit(unit);
  if (!unitFamily) {
    return {
      normalizedInput,
      value,
      unit,
      unitFamily: null,
      factor: null,
    };
  }

  return {
    normalizedInput,
    value,
    unit,
    unitFamily,
    factor: NUMERIC_UNIT_FACTORS[unitFamily][unit],
  };
}

function resolveNumericAcceptedRange(
  referenceValue: number,
  settings: NumericEvaluationSettings,
): { min: number; max: number } {
  switch (settings.toleranceMode) {
    case 'absolute': {
      const tolerance = settings.absoluteTolerance ?? 0;
      return { min: referenceValue - tolerance, max: referenceValue + tolerance };
    }
    case 'relative': {
      const tolerance = Math.abs(referenceValue) * ((settings.relativeTolerancePercent ?? 0) / 100);
      return { min: referenceValue - tolerance, max: referenceValue + tolerance };
    }
    case 'exact':
      return { min: referenceValue, max: referenceValue };
  }
}

function createZeroNumericAnswerResult(
  maxPoints: number,
  overrides?: Partial<
    Pick<EvaluateNumericAnswerResult, 'feedbackCategory' | 'explanation' | 'unitStatus'>
  >,
): EvaluateNumericAnswerResult {
  return {
    points: 0,
    maxPoints,
    matchedModelAnswer: null,
    parsedStudentValue: null,
    parsedStudentUnit: null,
    parsedReferenceValue: null,
    parsedReferenceUnit: null,
    acceptedRange: null,
    distance: null,
    normalizedDistance: null,
    unitStatus: overrides?.unitStatus ?? 'not_applicable',
    feedbackCategory: overrides?.feedbackCategory ?? 'no_match',
    explanation:
      overrides?.explanation ?? 'No numeric model answer matched within the configured tolerance.',
  };
}

function createNumericEvaluationExplanation(input: {
  points: number;
  maxPoints: number;
  unitStatus: NumericUnitStatus;
  toleranceMode: NumericToleranceMode;
  normalizedDistance: number | null;
}): string {
  if (input.points <= 0) {
    return input.toleranceMode === 'exact'
      ? 'Numeric value did not exactly match any configured solution.'
      : 'Numeric value stayed outside the configured tolerance.';
  }

  if (input.points < input.maxPoints) {
    switch (input.unitStatus) {
      case 'missing_required':
        return 'Numeric value matched, but the required unit was missing.';
      case 'equivalent_not_accepted':
        return 'Numeric value matched after conversion, but only the configured unit is accepted.';
      case 'wrong_family':
        return 'Numeric value matched, but the unit belongs to a different quantity family.';
      case 'unsupported':
        return 'Numeric value matched, but the submitted unit is outside the supported unit set.';
      default:
        return 'Numeric value matched, but the unit handling prevented full credit.';
    }
  }

  if (input.unitStatus === 'equivalent') {
    return 'Numeric value matched after converting an equivalent unit.';
  }
  if (input.normalizedDistance === 0) {
    return 'Exact numeric match.';
  }

  return 'Numeric value matched within the configured tolerance.';
}

function isBetterNumericAnswerResult(
  candidate: EvaluateNumericAnswerResult,
  current: EvaluateNumericAnswerResult,
): boolean {
  if (candidate.points !== current.points) {
    return candidate.points > current.points;
  }

  const candidateStatusPriority = NUMERIC_UNIT_STATUS_PRIORITY[candidate.unitStatus];
  const currentStatusPriority = NUMERIC_UNIT_STATUS_PRIORITY[current.unitStatus];
  if (candidateStatusPriority !== currentStatusPriority) {
    return candidateStatusPriority < currentStatusPriority;
  }

  const candidateDistance = candidate.normalizedDistance ?? Number.POSITIVE_INFINITY;
  const currentDistance = current.normalizedDistance ?? Number.POSITIVE_INFINITY;
  return candidateDistance < currentDistance;
}

export function evaluateNumericAnswer(
  input: EvaluateNumericAnswerInput,
): EvaluateNumericAnswerResult {
  const maxPoints = Math.max(0, input.maxPoints);
  const settings = resolveNumericEvaluationSettings(input.settings);
  const student = parseNumericAnswer(input.studentAnswer, settings);

  if (!student) {
    return createZeroNumericAnswerResult(maxPoints, {
      feedbackCategory: 'invalid_input',
      explanation: 'Submitted answer is not a supported numeric value.',
    });
  }

  let bestResult = createZeroNumericAnswerResult(maxPoints, {
    parsedStudentValue: undefined,
  } as never);

  for (const modelAnswer of input.modelAnswers) {
    const reference = parseNumericAnswer(modelAnswer, settings);
    if (!reference) {
      continue;
    }

    const unitMode = settings.unitFamily !== 'none';
    let comparisonStudentValue = student.value;
    let comparisonReferenceValue = reference.value;
    let unitStatus: NumericUnitStatus = unitMode ? 'exact' : 'not_applicable';

    if (unitMode) {
      if (!reference.unit || reference.unitFamily !== settings.unitFamily || !reference.factor) {
        continue;
      }

      if (!student.unit) {
        unitStatus = settings.requireUnit ? 'missing_required' : 'missing_optional';
      } else if (student.unitFamily === settings.unitFamily && student.factor) {
        comparisonStudentValue = student.value * student.factor;
        comparisonReferenceValue = reference.value * reference.factor;

        if (student.unit === reference.unit) {
          unitStatus = 'exact';
        } else {
          unitStatus = settings.acceptEquivalentUnits ? 'equivalent' : 'equivalent_not_accepted';
        }
      } else if (student.unitFamily === null) {
        unitStatus = 'unsupported';
      } else {
        unitStatus = 'wrong_family';
      }
    }

    const acceptedRange = resolveNumericAcceptedRange(comparisonReferenceValue, settings);
    const numericMatch =
      comparisonStudentValue >= acceptedRange.min && comparisonStudentValue <= acceptedRange.max;
    if (!numericMatch) {
      continue;
    }

    const distance = Math.abs(comparisonStudentValue - comparisonReferenceValue);
    const normalizedDistance = distance / Math.max(Math.abs(comparisonReferenceValue), 1);
    const awardsFullPoints =
      unitStatus === 'not_applicable' ||
      unitStatus === 'exact' ||
      unitStatus === 'equivalent' ||
      unitStatus === 'missing_optional';
    const points = awardsFullPoints
      ? Math.round(maxPoints)
      : Math.round(maxPoints * NUMERIC_UNIT_PARTIAL_CREDIT_RATIO);
    const feedbackCategory: NumericFeedbackCategory =
      points <= 0
        ? 'no_match'
        : points < maxPoints
          ? 'unit_partial'
          : normalizedDistance === 0
            ? 'exact_match'
            : 'within_tolerance';

    const result: EvaluateNumericAnswerResult = {
      points,
      maxPoints,
      matchedModelAnswer: modelAnswer,
      parsedStudentValue: student.value,
      parsedStudentUnit: student.unit,
      parsedReferenceValue: reference.value,
      parsedReferenceUnit: reference.unit,
      acceptedRange,
      distance,
      normalizedDistance,
      unitStatus,
      feedbackCategory,
      explanation: createNumericEvaluationExplanation({
        points,
        maxPoints,
        unitStatus,
        toleranceMode: settings.toleranceMode,
        normalizedDistance,
      }),
    };

    if (isBetterNumericAnswerResult(result, bestResult)) {
      bestResult = result;
    }
  }

  if (bestResult.matchedModelAnswer) {
    return bestResult;
  }

  return createZeroNumericAnswerResult(maxPoints, {
    parsedStudentValue: undefined,
  } as never);
}

/** Streak-Multiplikatoren für aufeinanderfolgende richtige Antworten (Story 5.5) */
export const STREAK_MULTIPLIER: Record<number, number> = {
  0: 1.0,
  1: 1.0,
  2: 1.1,
  3: 1.2,
  4: 1.3,
};
/** Ab 5+ Streak gilt dieser Maximal-Multiplikator */
export const STREAK_MULTIPLIER_MAX = 1.5;

/** Verfügbare Emoji-Reaktionen (Story 5.8) */
export const EMOJI_REACTIONS = ['👏', '🎉', '😮', '😂', '😢'] as const;
export type EmojiReaction = (typeof EMOJI_REACTIONS)[number];

// ---------------------------------------------------------------------------
// Defaults – zentrale Konstanten für Quiz-Einstellungen
// ---------------------------------------------------------------------------
export const DEFAULT_TEAM_COUNT = 2;
export const DEFAULT_BONUS_TOKEN_COUNT = 3;
export const DEFAULT_TIMER_SECONDS = 60;

export function scaleTimerByDifficulty(
  timerSeconds: number | null | undefined,
  difficulty: Difficulty,
  enabled = true,
): number | null {
  if (typeof timerSeconds !== 'number' || timerSeconds <= 0) {
    return null;
  }
  if (!enabled) {
    return timerSeconds;
  }
  const factor = (TIMER_DIFFICULTY_SCALE_FACTORS as Record<string, number>)[difficulty] ?? 1;
  return Math.ceil(timerSeconds * factor);
}

export function resolveEffectiveQuestionTimer(
  questionTimer: number | null | undefined,
  defaultTimer: number | null | undefined,
  difficulty: Difficulty,
  scaleByDifficulty = true,
): number | null {
  // Ein explizit pro Frage gesetzter Timer ist bereits die finale Host-Entscheidung
  // und darf nicht mehr durch die Schwierigkeits-Skalierung verändert werden.
  if (typeof questionTimer === 'number' && questionTimer > 0) {
    return questionTimer;
  }

  if (typeof defaultTimer === 'number' && defaultTimer > 0) {
    return scaleTimerByDifficulty(defaultTimer, difficulty, scaleByDifficulty);
  }

  return null;
}

/** Obergrenze Motivbild-URL (typische Bild-URLs; lange signierte CDN-Links bleiben i. d. R. darunter). */
export const MOTIF_IMAGE_URL_MAX_LENGTH = 1024;

/**
 * Optionales Quiz-Motivbild (Host, Quiz-Kanal): HTTPS-URL oder root-relativer Pfad
 * (z. B. `/assets/demo/bild.svg` für gebündelte Angular-Assets).
 */
export const MotifImageUrlSchema = z
  .string()
  .max(MOTIF_IMAGE_URL_MAX_LENGTH)
  .superRefine((val, ctx) => {
    if (val.startsWith('/')) {
      if (val.startsWith('//') || val.includes('..') || val.includes('\\') || /\s/.test(val)) {
        ctx.addIssue({ code: 'custom', message: 'Ungültiger relativer Bildpfad.' });
        return;
      }
      if (!/^\/[a-zA-Z0-9/_\-.%+]+$/.test(val)) {
        ctx.addIssue({ code: 'custom', message: 'Ungültiger relativer Bildpfad.' });
      }
      return;
    }
    try {
      const u = new URL(val);
      if (u.protocol !== 'https:') {
        ctx.addIssue({
          code: 'custom',
          message: 'Nur HTTPS-URLs sind erlaubt.',
        });
      }
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Ungültige Bild-URL.' });
    }
  });

/** Leerstring / null / undefined → null; sonst gültige HTTPS-URL. */
export const QuizMotifImageUrlInputSchema = z
  .union([z.literal(''), MotifImageUrlSchema, z.null()])
  .optional()
  .transform((v) => (v === '' || v === undefined ? null : v));

// ---------------------------------------------------------------------------
// Quiz-Schemas (Zod) – werden in Backend (Validierung) & Frontend (Forms) genutzt
// ---------------------------------------------------------------------------

/** Schema für die Erstellung eines neuen Quizzes */
export const CreateQuizInputSchema = z.object({
  name: z.string().min(1, { error: 'Quiz-Name darf nicht leer sein' }).max(200),
  description: z.string().max(5000).optional(),
  motifImageUrl: QuizMotifImageUrlInputSchema,
  showLeaderboard: z.boolean().optional().default(true),
  allowCustomNicknames: z.boolean().optional().default(false),
  defaultTimer: z.number().int().min(5).max(300).nullable().optional(),
  timerScaleByDifficulty: z.boolean().optional().default(true),
  enableSoundEffects: z.boolean().optional().default(true),
  enableRewardEffects: z.boolean().optional().default(true),
  enableMotivationMessages: z.boolean().optional().default(true),
  enableEmojiReactions: z.boolean().optional().default(true),
  showQuestionTypeIndicators: z.boolean().optional().default(true),
  anonymousMode: z.boolean().optional().default(false),
  teamMode: z.boolean().optional().default(false),
  teamCount: z.number().int().min(2).max(8).optional().default(DEFAULT_TEAM_COUNT),
  teamAssignment: TeamAssignmentEnum.optional().default('AUTO'),
  teamNames: TeamNamesSchema.optional().default([]),
  backgroundMusic: z.string().max(50).nullable().optional().default(null),
  nicknameTheme: NicknameThemeEnum.optional().default('HIGH_SCHOOL'),
  bonusTokenCount: z.number().int().min(1).max(50).nullable().optional().default(null), // Story 4.6
  readingPhaseEnabled: z.boolean().optional().default(true),
  preset: QuizPresetEnum.optional().default('PLAYFUL'),
});
export type CreateQuizInput = z.infer<typeof CreateQuizInputSchema>;

/** Session-weites Onboarding-Profil (Join-/Team-/Pseudonym-Regeln, getrennt vom Visual Preset). */
export const SessionOnboardingProfileInputSchema = z.object({
  allowCustomNicknames: z.boolean().optional(),
  anonymousMode: z.boolean().optional(),
  teamMode: z.boolean().optional(),
  teamCount: z.number().int().min(2).max(8).nullable().optional(),
  teamAssignment: TeamAssignmentEnum.optional(),
  teamNames: TeamNamesSchema.optional(),
  nicknameTheme: NicknameThemeEnum.optional(),
});
export type SessionOnboardingProfileInput = z.infer<typeof SessionOnboardingProfileInputSchema>;

/** Schema für eine einzelne Antwortoption beim Hinzufügen/Bearbeiten */
export const AnswerOptionInputSchema = z.object({
  text: z.string().min(1, { error: 'Antworttext darf nicht leer sein' }).max(500),
  isCorrect: z.boolean(),
});
export type AnswerOptionInput = z.infer<typeof AnswerOptionInputSchema>;

/** Schema für das Hinzufügen/Bearbeiten einer Frage (Story 1.2a, 1.2b, 1.3) */
export const AddQuestionInputSchema = z
  .object({
    text: z.string().min(1, { error: 'Fragenstamm darf nicht leer sein' }).max(2000),
    type: QuestionTypeEnum,
    timer: z.number().int().min(5).max(300).nullable().optional(),
    difficulty: DifficultyEnum.optional().default('MEDIUM'),
    order: z.number().int().min(0),
    // Bei SHORT_TEXT werden hier die gültigen Musterlösungen/Varianten gespeichert.
    answers: z.array(AnswerOptionInputSchema).max(10),
    skipReadingPhase: z.boolean().optional(),
    ratingMin: z.number().int().min(0).max(10).optional(), // Nur bei RATING
    ratingMax: z.number().int().min(1).max(10).optional(), // Nur bei RATING
    ratingLabelMin: z.string().max(50).optional(), // Nur bei RATING
    ratingLabelMax: z.string().max(50).optional(), // Nur bei RATING
    shortTextEvaluationKind: ShortTextEvaluationKindEnum.optional(),
    shortTextMaxLength: z.number().int().min(1).max(SHORT_TEXT_MAX_LENGTH_LIMIT).optional(),
    shortTextCaseSensitive: z.boolean().optional(),
    shortTextEvaluationMode: ShortAnswerEvaluationModeEnum.optional(),
    shortTextToleranceLevel: ToleranceLevelEnum.optional(),
    shortTextAllowPartialCredit: z.boolean().optional(),
    shortTextTrimWhitespace: z.boolean().optional(),
    shortTextNormalizeWhitespace: z.boolean().optional(),
    numericInputKind: NumericInputKindEnum.optional(),
    numericToleranceMode: QuestionNumericToleranceModeSchema.optional(),
    numericAbsoluteTolerance: z.number().min(0).optional(),
    numericRelativeTolerancePercent: z.number().min(0).optional(),
    numericUnitFamily: NumericUnitFamilyEnum.optional(),
    numericRequireUnit: z.boolean().optional(),
    numericAcceptEquivalentUnits: z.boolean().optional(),
    // Story 1.2d: Numerische Schätzfrage
    numericReferenceValue: z.number().optional(),
    numericTolerancePercent: z.number().min(0).max(100).optional(),
    numericIntervalLeft: z.number().optional(),
    numericIntervalRight: z.number().optional(),
    numericInputType: NumericInputTypeEnum.optional(),
    numericDecimalPlaces: z.number().int().min(0).max(10).optional(),
    numericMin: z.number().optional(),
    numericMax: z.number().optional(),
    numericTwoRounds: z.boolean().optional(),
    // Story 1.2i: Optionaler Sicherheitsgrad für bewertbare Fragetypen
    confidenceEnabled: z.boolean().optional(),
    confidenceLabelLow: z.string().max(50).optional(),
    confidenceLabelHigh: z.string().max(50).optional(),
  })
  .superRefine((value, ctx) => {
    const hasConfidenceConfig =
      value.confidenceEnabled === true ||
      value.confidenceLabelLow !== undefined ||
      value.confidenceLabelHigh !== undefined;

    if (!questionSupportsConfidence(value.type) && hasConfidenceConfig) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confidenceEnabled'],
        message: 'Selbsteinschätzung ist nur für bewertbare Fragetypen erlaubt.',
      });
    }

    const hasShortTextConfig =
      value.shortTextEvaluationKind !== undefined ||
      value.shortTextMaxLength !== undefined ||
      value.shortTextCaseSensitive !== undefined ||
      value.shortTextEvaluationMode !== undefined ||
      value.shortTextToleranceLevel !== undefined ||
      value.shortTextAllowPartialCredit !== undefined ||
      value.shortTextTrimWhitespace !== undefined ||
      value.shortTextNormalizeWhitespace !== undefined;
    const hasShortTextNumericConfig =
      value.numericInputKind !== undefined ||
      value.numericAbsoluteTolerance !== undefined ||
      value.numericRelativeTolerancePercent !== undefined ||
      value.numericUnitFamily !== undefined ||
      value.numericRequireUnit !== undefined ||
      value.numericAcceptEquivalentUnits !== undefined;
    const hasNumericEstimateConfig =
      value.numericReferenceValue !== undefined ||
      value.numericTolerancePercent !== undefined ||
      value.numericIntervalLeft !== undefined ||
      value.numericIntervalRight !== undefined ||
      value.numericInputType !== undefined ||
      value.numericDecimalPlaces !== undefined ||
      value.numericMin !== undefined ||
      value.numericMax !== undefined ||
      value.numericTwoRounds !== undefined;
    const hasNumericToleranceMode = value.numericToleranceMode !== undefined;

    if (value.type === 'NUMERIC_ESTIMATE') {
      if (hasShortTextConfig || hasShortTextNumericConfig) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['shortTextMaxLength'],
          message: 'Kurzantwort-Konfiguration ist nur für SHORT_TEXT erlaubt.',
        });
      }

      if (hasNumericToleranceMode && !isNumericEstimateToleranceMode(value.numericToleranceMode)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['numericToleranceMode'],
          message: 'Schätzfragen benötigen einen passenden Toleranzmodus.',
        });
      }

      if (value.answers.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['answers'],
          message: 'Numerische Schätzfragen verwenden keine Antwortoptionen.',
        });
      }

      const estimateToleranceMode = resolveNumericEstimateToleranceMode(value.numericToleranceMode);
      if (estimateToleranceMode === 'RELATIVE_PERCENT') {
        if (value.numericReferenceValue === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['numericReferenceValue'],
            message: 'Relative Schätzfragen benötigen einen Referenzwert.',
          });
        } else if (value.numericReferenceValue === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['numericReferenceValue'],
            message: 'Relative Schätzfragen benötigen einen Referenzwert ungleich 0.',
          });
        }

        if (value.numericTolerancePercent === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['numericTolerancePercent'],
            message: 'Relative Schätzfragen benötigen eine Prozenttoleranz.',
          });
        }
      } else {
        if (value.numericIntervalLeft === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['numericIntervalLeft'],
            message: 'Absolute Schätzfragen benötigen eine linke Intervallgrenze.',
          });
        }

        if (value.numericIntervalRight === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['numericIntervalRight'],
            message: 'Absolute Schätzfragen benötigen eine rechte Intervallgrenze.',
          });
        }

        if (
          value.numericIntervalLeft !== undefined &&
          value.numericIntervalRight !== undefined &&
          value.numericIntervalLeft >= value.numericIntervalRight
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['numericIntervalRight'],
            message: 'Die rechte Intervallgrenze muss größer als die linke sein.',
          });
        }
      }

      if (
        value.numericMin !== undefined &&
        value.numericMax !== undefined &&
        value.numericMin > value.numericMax
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['numericMax'],
          message: 'Der Maximalwert muss größer oder gleich dem Minimalwert sein.',
        });
      }

      return;
    }

    if (value.type !== 'SHORT_TEXT') {
      if (
        hasShortTextConfig ||
        hasShortTextNumericConfig ||
        hasNumericToleranceMode ||
        hasNumericEstimateConfig
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['shortTextMaxLength'],
          message:
            'Kurzantwort- und Schätzfragen-Konfiguration ist für diesen Fragetyp nicht erlaubt.',
        });
      }
      return;
    }

    if (hasNumericEstimateConfig) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['numericReferenceValue'],
        message: 'Schätzfragen-Konfiguration ist nur für NUMERIC_ESTIMATE erlaubt.',
      });
    }

    if (hasNumericToleranceMode && !isNumericToleranceMode(value.numericToleranceMode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['numericToleranceMode'],
        message: 'SHORT_TEXT-Numerik benötigt einen passenden Toleranzmodus.',
      });
    }

    if (value.answers.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['answers'],
        message: 'Kurzantwort-Fragen benötigen mindestens eine Musterlösung.',
      });
    }

    const evaluationKind = resolveShortTextEvaluationKind(value.shortTextEvaluationKind);
    if (usesNumericShortTextEvaluation(evaluationKind)) {
      const numericSettings = resolveNumericQuestionEvaluationSettings({
        numericInputKind: value.numericInputKind,
        numericToleranceMode: isNumericToleranceMode(value.numericToleranceMode)
          ? value.numericToleranceMode
          : undefined,
        numericAbsoluteTolerance: value.numericAbsoluteTolerance,
        numericRelativeTolerancePercent: value.numericRelativeTolerancePercent,
        numericUnitFamily: value.numericUnitFamily,
        numericRequireUnit: value.numericRequireUnit,
        numericAcceptEquivalentUnits: value.numericAcceptEquivalentUnits,
      });

      if (
        numericSettings.toleranceMode === 'absolute' &&
        value.numericAbsoluteTolerance === undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['numericAbsoluteTolerance'],
          message: 'Absolute Toleranz benötigt einen Zahlenwert.',
        });
      }

      if (
        numericSettings.toleranceMode === 'relative' &&
        value.numericRelativeTolerancePercent === undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['numericRelativeTolerancePercent'],
          message: 'Relative Toleranz benötigt einen Prozentwert.',
        });
      }

      if (usesShortTextUnitEvaluation(evaluationKind) && numericSettings.unitFamily === 'none') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['numericUnitFamily'],
          message: 'Einheitenbewertung benötigt eine unterstützte Einheitenfamilie.',
        });
      }

      const seenNumericSolutions = new Set<string>();
      for (const [index, answer] of value.answers.entries()) {
        if (!answer.isCorrect) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['answers', index, 'isCorrect'],
            message: 'Kurzantwort-Musterlösungen müssen als gültige Lösung markiert sein.',
          });
        }

        const parsedAnswer = parseNumericAnswer(answer.text, numericSettings);
        if (!parsedAnswer) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['answers', index, 'text'],
            message: 'Musterlösungen müssen in diesem Modus als unterstützte Zahl parsebar sein.',
          });
          continue;
        }

        if (usesShortTextUnitEvaluation(evaluationKind)) {
          if (!parsedAnswer.unit) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['answers', index, 'text'],
              message:
                'Bei Einheitenbewertung muss jede Musterlösung eine unterstützte Einheit enthalten.',
            });
            continue;
          }

          if (parsedAnswer.unitFamily !== numericSettings.unitFamily || !parsedAnswer.factor) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['answers', index, 'text'],
              message: 'Die Einheit der Musterlösung passt nicht zur gewählten Einheitenfamilie.',
            });
            continue;
          }
        }

        const canonicalKey =
          usesShortTextUnitEvaluation(evaluationKind) && parsedAnswer.factor
            ? `${parsedAnswer.value * parsedAnswer.factor}|${parsedAnswer.unitFamily}`
            : `${parsedAnswer.value}`;
        if (seenNumericSolutions.has(canonicalKey)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['answers', index, 'text'],
            message: 'Musterlösungen müssen nach numerischer Normalisierung eindeutig sein.',
          });
        }
        seenNumericSolutions.add(canonicalKey);
      }

      return;
    }

    const maxLength = resolveShortTextMaxLength(value.shortTextMaxLength);
    const seenSolutions = new Set<string>();
    for (const [index, answer] of value.answers.entries()) {
      if (!answer.isCorrect) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['answers', index, 'isCorrect'],
          message: 'Kurzantwort-Musterlösungen müssen als gültige Lösung markiert sein.',
        });
      }

      const normalizedAnswer = normalizeShortTextValue(answer.text, {
        caseSensitive: value.shortTextCaseSensitive,
        trimWhitespace: value.shortTextTrimWhitespace,
        normalizeWhitespace: value.shortTextNormalizeWhitespace,
      });

      if (!normalizedAnswer) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['answers', index, 'text'],
          message: 'Kurzantwort-Musterlösungen dürfen nicht leer sein.',
        });
      }

      if (normalizedAnswer.length > maxLength) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['answers', index, 'text'],
          message:
            'Kurzantwort-Musterlösungen dürfen die maximale Antwortlänge nicht überschreiten.',
        });
      }

      if (seenSolutions.has(normalizedAnswer)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['answers', index, 'text'],
          message: 'Kurzantwort-Musterlösungen müssen nach Normalisierung eindeutig sein.',
        });
      }
      seenSolutions.add(normalizedAnswer);
    }
  });
export type AddQuestionInput = z.infer<typeof AddQuestionInputSchema>;

/** Schema für den Quiz-Upload beim Live-Schalten (Story 2.1a) */
export const QuizUploadInputSchema = z.object({
  historyScopeId: z.uuid().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  /** Wie CreateQuiz: Leerstring/undefined → null (vermeidet Upload-Fehler bei leerem Feld). */
  motifImageUrl: QuizMotifImageUrlInputSchema,
  showLeaderboard: z.boolean(),
  allowCustomNicknames: z.boolean(),
  defaultTimer: z.number().int().min(5).max(300).nullable().optional(),
  timerScaleByDifficulty: z.boolean().optional(),
  enableSoundEffects: z.boolean(),
  enableRewardEffects: z.boolean(),
  enableMotivationMessages: z.boolean(),
  enableEmojiReactions: z.boolean(),
  showQuestionTypeIndicators: z.boolean().optional(),
  anonymousMode: z.boolean(),
  teamMode: z.boolean(),
  teamCount: z.number().int().min(2).max(8).nullable().optional(),
  teamAssignment: TeamAssignmentEnum.optional(),
  teamNames: TeamNamesSchema.optional(),
  backgroundMusic: z.string().max(50).nullable().optional(),
  nicknameTheme: NicknameThemeEnum,
  bonusTokenCount: z.number().int().min(1).max(50).nullable().optional(), // Story 4.6
  readingPhaseEnabled: z.boolean().optional(),
  preset: QuizPresetEnum.optional(),
  questions: z
    .array(AddQuestionInputSchema)
    .min(1, { error: 'Mindestens eine Frage erforderlich' }),
});
export type QuizUploadInput = z.input<typeof QuizUploadInputSchema>;

/** Output: Antwort auf quiz.upload (Story 2.1a). */
export const QuizUploadOutputSchema = z.object({
  quizId: z.string().uuid(),
});
export type QuizUploadOutput = z.infer<typeof QuizUploadOutputSchema>;

const LEGACY_QUIZ_HISTORY_ACCESS_PROOF_REGEX = /^[a-f0-9]{64}$/;
export const QuizHistoryAccessProofSchema = z
  .string()
  .refine(
    (value) =>
      z.uuid().safeParse(value).success || LEGACY_QUIZ_HISTORY_ACCESS_PROOF_REGEX.test(value),
    {
      message: 'Ungültiger Quiz-Historie-Zugriff.',
    },
  );
export type QuizHistoryAccessProof = z.infer<typeof QuizHistoryAccessProofSchema>;

type QuizHistoryAccessMaterial = {
  name: string;
  description: string | null;
  motifImageUrl: string | null;
  showLeaderboard: boolean;
  allowCustomNicknames: boolean;
  defaultTimer: number | null;
  timerScaleByDifficulty: boolean;
  enableSoundEffects: boolean;
  enableRewardEffects: boolean;
  enableMotivationMessages: boolean;
  enableEmojiReactions: boolean;
  anonymousMode: boolean;
  teamMode: boolean;
  teamCount: number | null;
  teamAssignment: TeamAssignment;
  teamNames: string[];
  backgroundMusic: string | null;
  nicknameTheme: NicknameTheme;
  bonusTokenCount: number | null;
  readingPhaseEnabled: boolean;
  preset: QuizPreset;
  questions: Array<{
    text: string;
    type: QuestionType;
    timer: number | null;
    difficulty: Difficulty;
    order: number;
    skipReadingPhase: boolean;
    ratingMin: number | null;
    ratingMax: number | null;
    ratingLabelMin: string | null;
    ratingLabelMax: string | null;
    shortTextEvaluationKind: ShortTextEvaluationKind;
    shortTextMaxLength: number | null;
    shortTextCaseSensitive: boolean;
    shortTextEvaluationMode: ShortAnswerEvaluationMode;
    shortTextToleranceLevel: ToleranceLevel;
    shortTextAllowPartialCredit: boolean;
    shortTextTrimWhitespace: boolean;
    shortTextNormalizeWhitespace: boolean;
    numericInputKind: NumericInputKind;
    numericToleranceMode: QuestionNumericToleranceMode;
    numericAbsoluteTolerance: number | null;
    numericRelativeTolerancePercent: number | null;
    numericUnitFamily: NumericUnitFamily;
    numericRequireUnit: boolean;
    numericAcceptEquivalentUnits: boolean;
    numericReferenceValue: number | null;
    numericTolerancePercent: number | null;
    numericIntervalLeft: number | null;
    numericIntervalRight: number | null;
    numericInputType: NumericInputType | null;
    numericDecimalPlaces: number | null;
    numericMin: number | null;
    numericMax: number | null;
    numericTwoRounds: boolean;
    confidenceEnabled: boolean;
    confidenceLabelLow: string | null;
    confidenceLabelHigh: string | null;
    answers: Array<{
      text: string;
      isCorrect: boolean;
    }>;
  }>;
};

function compareQuizHistoryStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function buildQuizHistoryAccessMaterial(input: QuizUploadInput): QuizHistoryAccessMaterial {
  const parsed = QuizUploadInputSchema.parse(input);

  return {
    name: parsed.name,
    description: parsed.description ?? null,
    motifImageUrl: parsed.motifImageUrl ?? null,
    showLeaderboard: parsed.showLeaderboard,
    allowCustomNicknames: parsed.allowCustomNicknames,
    defaultTimer: parsed.defaultTimer ?? null,
    timerScaleByDifficulty: parsed.timerScaleByDifficulty ?? true,
    enableSoundEffects: parsed.enableSoundEffects,
    enableRewardEffects: parsed.enableRewardEffects,
    enableMotivationMessages: parsed.enableMotivationMessages,
    enableEmojiReactions: parsed.enableEmojiReactions,
    anonymousMode: parsed.anonymousMode,
    teamMode: parsed.teamMode,
    teamCount: parsed.teamCount ?? null,
    teamAssignment: parsed.teamAssignment ?? 'AUTO',
    teamNames: [...(parsed.teamNames ?? [])],
    backgroundMusic: parsed.backgroundMusic ?? null,
    nicknameTheme: parsed.nicknameTheme,
    bonusTokenCount: parsed.bonusTokenCount ?? null,
    readingPhaseEnabled: parsed.readingPhaseEnabled ?? true,
    preset: parsed.preset ?? 'PLAYFUL',
    questions: [...parsed.questions]
      .sort((left, right) => left.order - right.order)
      .map((question) => ({
        text: question.text,
        type: question.type,
        timer: question.timer ?? null,
        difficulty: question.difficulty,
        order: question.order,
        skipReadingPhase: question.skipReadingPhase ?? false,
        ratingMin: question.ratingMin ?? null,
        ratingMax: question.ratingMax ?? null,
        ratingLabelMin: question.ratingLabelMin ?? null,
        ratingLabelMax: question.ratingLabelMax ?? null,
        shortTextEvaluationKind:
          question.type === 'SHORT_TEXT'
            ? resolveShortTextEvaluationKind(question.shortTextEvaluationKind)
            : SHORT_TEXT_DEFAULT_EVALUATION_KIND,
        shortTextMaxLength:
          question.type === 'SHORT_TEXT'
            ? resolveShortTextMaxLength(question.shortTextMaxLength)
            : null,
        shortTextCaseSensitive:
          question.type === 'SHORT_TEXT' ? (question.shortTextCaseSensitive ?? false) : false,
        shortTextEvaluationMode:
          question.type === 'SHORT_TEXT'
            ? (question.shortTextEvaluationMode ?? SHORT_TEXT_DEFAULT_EVALUATION_MODE)
            : SHORT_TEXT_DEFAULT_EVALUATION_MODE,
        shortTextToleranceLevel:
          question.type === 'SHORT_TEXT'
            ? (question.shortTextToleranceLevel ?? SHORT_TEXT_DEFAULT_TOLERANCE_LEVEL)
            : SHORT_TEXT_DEFAULT_TOLERANCE_LEVEL,
        shortTextAllowPartialCredit:
          question.type === 'SHORT_TEXT' ? (question.shortTextAllowPartialCredit ?? true) : true,
        shortTextTrimWhitespace:
          question.type === 'SHORT_TEXT' ? (question.shortTextTrimWhitespace ?? true) : true,
        shortTextNormalizeWhitespace:
          question.type === 'SHORT_TEXT' ? (question.shortTextNormalizeWhitespace ?? true) : true,
        numericInputKind:
          question.type === 'SHORT_TEXT'
            ? (question.numericInputKind ?? NUMERIC_DEFAULT_INPUT_KIND)
            : NUMERIC_DEFAULT_INPUT_KIND,
        numericToleranceMode:
          question.type === 'NUMERIC_ESTIMATE'
            ? resolveNumericEstimateToleranceMode(question.numericToleranceMode)
            : question.type === 'SHORT_TEXT' &&
                isNumericToleranceMode(question.numericToleranceMode)
              ? question.numericToleranceMode
              : NUMERIC_DEFAULT_TOLERANCE_MODE,
        numericAbsoluteTolerance:
          question.type === 'SHORT_TEXT' ? (question.numericAbsoluteTolerance ?? null) : null,
        numericRelativeTolerancePercent:
          question.type === 'SHORT_TEXT'
            ? (question.numericRelativeTolerancePercent ?? null)
            : null,
        numericUnitFamily:
          question.type === 'SHORT_TEXT'
            ? (question.numericUnitFamily ?? NUMERIC_DEFAULT_UNIT_FAMILY)
            : NUMERIC_DEFAULT_UNIT_FAMILY,
        numericRequireUnit:
          question.type === 'SHORT_TEXT' ? (question.numericRequireUnit ?? false) : false,
        numericAcceptEquivalentUnits:
          question.type === 'SHORT_TEXT' ? (question.numericAcceptEquivalentUnits ?? true) : true,
        numericReferenceValue:
          question.type === 'NUMERIC_ESTIMATE' ? (question.numericReferenceValue ?? null) : null,
        numericTolerancePercent:
          question.type === 'NUMERIC_ESTIMATE' ? (question.numericTolerancePercent ?? null) : null,
        numericIntervalLeft:
          question.type === 'NUMERIC_ESTIMATE' ? (question.numericIntervalLeft ?? null) : null,
        numericIntervalRight:
          question.type === 'NUMERIC_ESTIMATE' ? (question.numericIntervalRight ?? null) : null,
        numericInputType:
          question.type === 'NUMERIC_ESTIMATE' ? (question.numericInputType ?? 'DECIMAL') : null,
        numericDecimalPlaces:
          question.type === 'NUMERIC_ESTIMATE' ? (question.numericDecimalPlaces ?? null) : null,
        numericMin: question.type === 'NUMERIC_ESTIMATE' ? (question.numericMin ?? null) : null,
        numericMax: question.type === 'NUMERIC_ESTIMATE' ? (question.numericMax ?? null) : null,
        numericTwoRounds:
          question.type === 'NUMERIC_ESTIMATE' ? (question.numericTwoRounds ?? false) : false,
        confidenceEnabled:
          questionSupportsConfidence(question.type) && (question.confidenceEnabled ?? false),
        confidenceLabelLow:
          questionSupportsConfidence(question.type) && (question.confidenceEnabled ?? false)
            ? (question.confidenceLabelLow ?? null)
            : null,
        confidenceLabelHigh:
          questionSupportsConfidence(question.type) && (question.confidenceEnabled ?? false)
            ? (question.confidenceLabelHigh ?? null)
            : null,
        answers: [...question.answers]
          .map((answer) => ({ text: answer.text, isCorrect: answer.isCorrect }))
          .sort(
            (left, right) =>
              compareQuizHistoryStrings(left.text, right.text) ||
              Number(left.isCorrect) - Number(right.isCorrect),
          ),
      })),
  };
}

export function serializeQuizHistoryAccessMaterial(input: QuizUploadInput): string {
  return JSON.stringify(buildQuizHistoryAccessMaterial(input));
}

async function sha256Hex(input: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto API nicht verfügbar.');
  }

  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createLegacyQuizHistoryAccessProof(
  input: QuizUploadInput,
): Promise<QuizHistoryAccessProof> {
  return QuizHistoryAccessProofSchema.parse(
    await sha256Hex(serializeQuizHistoryAccessMaterial(input)),
  );
}

export async function createQuizHistoryAccessProof(
  input: QuizUploadInput,
): Promise<QuizHistoryAccessProof> {
  const parsed = QuizUploadInputSchema.parse(input);
  if (parsed.historyScopeId) {
    return QuizHistoryAccessProofSchema.parse(parsed.historyScopeId);
  }
  return createLegacyQuizHistoryAccessProof(parsed);
}

// ---------------------------------------------------------------------------
// Session-Schemas (Story 2.1–2.3)
// ---------------------------------------------------------------------------

/** Input: Eine neue Live-Session starten */
export const CreateSessionInputSchema = z
  .object({
    type: SessionTypeEnum.optional().default('QUIZ'), // Story 8.1: Quiz oder Q&A
    quizId: z.uuid().optional(), // Pflicht bei Quiz-Session, optional bei kanalbasiertem Q&A/Blitzlicht
    startQuestionIndex: z.number().int().min(0).optional(), // Optionaler 0-basierter Startpunkt für Quiz-Sessions
    title: z.string().trim().max(200).optional(), // Story 8.1: Titel für Q&A-Runde
    moderationMode: z.boolean().optional().default(true), // Story 8.4 / Q&A: Vorab-Moderation (Default an)
    qaEnabled: z.boolean().optional().default(false), // ADR-0009: Q&A-Kanal in Quiz-Session
    qaTitle: z.string().trim().max(200).optional(), // ADR-0009: Titel des Q&A-Tabs
    qaModerationMode: z.boolean().optional().default(true), // ADR-0009: Q&A-Vorab-Moderation (Default an)
    quickFeedbackEnabled: z.boolean().optional().default(false), // ADR-0009: Blitz-Feedback-Kanal
    ...SessionOnboardingProfileInputSchema.shape,
  })
  .superRefine((value, ctx) => {
    const isQuizlessChannelSession =
      value.type === 'QUIZ' &&
      !value.quizId &&
      (value.qaEnabled === true || value.quickFeedbackEnabled === true);

    if (value.type === 'QUIZ' && !value.quizId && !isQuizlessChannelSession) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['quizId'],
        message: 'Für Quiz-Sessions ist eine quizId erforderlich.',
      });
    }

    if (value.type === 'Q_AND_A' && value.quizId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['quizId'],
        message: 'Q&A-Sessions dürfen keine quizId enthalten.',
      });
    }

    if ((value.startQuestionIndex ?? 0) > 0 && !value.quizId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['startQuestionIndex'],
        message: 'Eine Startfrage ist nur für Quiz-Sessions mit quizId möglich.',
      });
    }
  });
export type CreateSessionInput = z.infer<typeof CreateSessionInputSchema>;

/** Output: Antwort auf session.create (Story 2.1a). */
export const CreateSessionOutputSchema = z.object({
  sessionId: z.uuid(),
  code: z.string().length(6),
  status: SessionStatusEnum,
  quizName: z.string().nullable(),
  hostToken: z.string().min(1),
});
export type CreateSessionOutput = z.infer<typeof CreateSessionOutputSchema>;

/** Input: Session-Info abfragen (z. B. vor Beitritt) */
export const GetSessionInfoInputSchema = z.object({
  code: z.string().length(6, { error: 'Session-Code muss 6 Zeichen lang sein' }),
});
export type GetSessionInfoInput = z.infer<typeof GetSessionInfoInputSchema>;

/** Input: Nächste Frage steuern (optional inkl. Überspringen der zuletzt gezeigten Ergebnisfrage). */
export const NextQuestionInputSchema = GetSessionInfoInputSchema.extend({
  /** Nur für den Rücksprung-Fall: überspringt genau die bereits gezeigte Ergebnisfrage. */
  skipCurrentResultQuestion: z.boolean().optional(),
});
export type NextQuestionInput = z.infer<typeof NextQuestionInputSchema>;

/** Input: Aktuelle Frage für Teilnehmende inkl. optionalem Presence-/Ready-Kontext. */
export const GetCurrentQuestionForStudentInputSchema = GetSessionInfoInputSchema.extend({
  participantId: z.uuid().optional(),
});
export type GetCurrentQuestionForStudentInput = z.infer<
  typeof GetCurrentQuestionForStudentInputSchema
>;

/** Input: Ein Quiz an eine laufende Quiz-Session anhängen. */
export const AttachQuizToSessionInputSchema = GetSessionInfoInputSchema.extend({
  quizId: z.uuid(),
});
export type AttachQuizToSessionInput = z.infer<typeof AttachQuizToSessionInputSchema>;

/** Input: Q&A-Kanaltitel zur Laufzeit setzen (Host, ADR-0009). */
export const UpdateSessionQaTitleInputSchema = z.object({
  code: z.string().length(6),
  /** Leer oder weglassen → in der DB null (Anzeige-Default im Client). */
  qaTitle: z.string().trim().max(200).optional(),
});
export type UpdateSessionQaTitleInput = z.infer<typeof UpdateSessionQaTitleInputSchema>;

export const UpdateSessionQaTitleOutputSchema = z.object({
  qaTitle: z.string().nullable(),
  title: z.string().nullable(),
});
export type UpdateSessionQaTitleOutput = z.infer<typeof UpdateSessionQaTitleOutputSchema>;

export const SessionLiveChannelSchema = z.enum(['quiz', 'qa', 'quickFeedback']);
export type SessionLiveChannel = z.infer<typeof SessionLiveChannelSchema>;

/** Output: Status-Update nach nextQuestion / revealAnswers / revealResults (Story 2.3, 3.5). */
export const SessionStatusUpdateSchema = z.object({
  status: SessionStatusEnum,
  currentQuestion: z.number().int().min(0).nullable(),
  /** Server-Zeitstempel bei Wechsel zu ACTIVE (ISO-8601). Für Countdown-Synchronisation (Story 3.5). */
  activeAt: z.string().optional(),
  /** Effektiver Timer der aktiven Frage nach Default- und Difficulty-Regeln. */
  timer: z.number().nullable().optional(),
  /** Server-Zeitstempel des Status-Snapshots (ISO-8601) zur Uhrensynchronisation. */
  serverTime: z.string().optional(),
  /** Aktuelle Runde bei Peer Instruction (Story 2.7), 1 oder 2. */
  currentRound: z.number().int().min(1).max(2).optional(),
  /** Kanalzustand für Live-Umschaltung auf Vote-Clients. */
  channels: z.lazy(() => SessionChannelsDTOSchema).optional(),
  preferredChannel: SessionLiveChannelSchema.optional(),
});
export type SessionStatusUpdate = z.infer<typeof SessionStatusUpdateSchema>;

/** Fortschritt der Bereitschaftsbestätigungen in der Lesephase. */
export const ReadingReadyStatusDTOSchema = z.object({
  connectedCount: z.number().int().min(0),
  readyCount: z.number().int().min(0),
  allConnectedReady: z.boolean(),
  participantReady: z.boolean().optional(),
});
export type ReadingReadyStatusDTO = z.infer<typeof ReadingReadyStatusDTOSchema>;

/** Input: Teilnehmende bestätigen ihre Bereitschaft in der Lesephase. */
export const ConfirmReadingReadyInputSchema = z.object({
  code: z.string().length(6),
  participantId: z.uuid(),
  questionId: z.uuid(),
});
export type ConfirmReadingReadyInput = z.infer<typeof ConfirmReadingReadyInputSchema>;

/** Output: Bestätigung der Lesephase inkl. aktualisiertem Fortschritt. */
export const ConfirmReadingReadyOutputSchema = ReadingReadyStatusDTOSchema;
export type ConfirmReadingReadyOutput = z.infer<typeof ConfirmReadingReadyOutputSchema>;

/** DTO: Stimmenverteilung einer Runde pro Antwortoption (Story 2.7 Peer Instruction). */
export const RoundDistributionEntrySchema = z.object({
  id: z.uuid(),
  text: z.string(),
  isCorrect: z.boolean(),
  voteCount: z.number().int(),
  votePercentage: z.number().int(),
});
export type RoundDistributionEntry = z.infer<typeof RoundDistributionEntrySchema>;

/** DTO: Einzelne Wählerwanderung (von Option X nach Option Y). */
export const VoterMigrationEntrySchema = z.object({
  from: z.string(),
  to: z.string(),
  count: z.number().int(),
});
export type VoterMigrationEntry = z.infer<typeof VoterMigrationEntrySchema>;

/** DTO: Meinungswechsel-Metriken bei Peer Instruction (Story 2.7). */
export const OpinionShiftSchema = z.object({
  bothRoundsCount: z.number().int(),
  changedCount: z.number().int(),
  changedPercentage: z.number().int(),
  wrongToCorrectCount: z.number().int().optional(),
  correctToWrongCount: z.number().int().optional(),
  migrations: z.array(VoterMigrationEntrySchema).optional(),
});
export type OpinionShift = z.infer<typeof OpinionShiftSchema>;

/** DTO: Vorher/Nachher-Vergleich bei Peer Instruction (Story 2.7). */
export const RoundComparisonDTOSchema = z.object({
  round1Total: z.number().int(),
  round2Total: z.number().int(),
  round1Distribution: z.array(RoundDistributionEntrySchema),
  round2Distribution: z.array(RoundDistributionEntrySchema),
  round1CorrectCount: z.number().int().optional(),
  round2CorrectCount: z.number().int().optional(),
  opinionShift: OpinionShiftSchema.optional(),
});
export type RoundComparisonDTO = z.infer<typeof RoundComparisonDTOSchema>;

/**
 * DTO: Didaktische Empfehlung fuer eine zweite Abstimmungsrunde nach Peer Instruction.
 * Server: nur wenn Anteil vollstaendig korrekter Stimmen (Runde 1, SC/MC) zwischen 35 % und 70 % liegt.
 */
export const PeerInstructionSuggestionDTOSchema = z.object({
  suggested: z.boolean(),
  reason: z.enum(['CORRECTNESS_WINDOW']),
});
export type PeerInstructionSuggestionDTO = z.infer<typeof PeerInstructionSuggestionDTOSchema>;

// ---------------------------------------------------------------------------
// Numerische Schätzfrage – Statistik-DTOs (Story 1.2d)
// ---------------------------------------------------------------------------

/** Ein Bin im Histogramm für numerische Schätzfragen. */
export const NumericHistogramBinSchema = z.object({
  from: z.number(),
  to: z.number(),
  count: z.number().int(),
  inBand: z.boolean(),
});
export type NumericHistogramBin = z.infer<typeof NumericHistogramBinSchema>;

/** Statistische Kennzahlen einer Abstimmungsrunde für NUMERIC_ESTIMATE. */
export const NumericStatsDTOSchema = z.object({
  n: z.number().int(),
  mean: z.number().nullable(),
  median: z.number().nullable(),
  stdDev: z.number().nullable(),
  q1: z.number().nullable(),
  q3: z.number().nullable(),
  iqr: z.number().nullable(),
  min: z.number().nullable(),
  max: z.number().nullable(),
  inBandCount: z.number().int(),
  inBandPercent: z.number().nullable(),
  meanAbsoluteError: z.number().nullable(),
  meanRelativeError: z.number().nullable(),
});
export type NumericStatsDTO = z.infer<typeof NumericStatsDTOSchema>;

/** Paarweiser Vergleich Runde 1 → Runde 2 (gleiche Person) für NUMERIC_ESTIMATE. */
export const NumericPairedAnalysisDTOSchema = z.object({
  pairedCount: z.number().int(),
  closerCount: z.number().int(),
  fartherCount: z.number().int(),
  unchangedCount: z.number().int(),
});
export type NumericPairedAnalysisDTO = z.infer<typeof NumericPairedAnalysisDTOSchema>;

/** Zwei-Runden-Vergleich für NUMERIC_ESTIMATE (analog RoundComparisonDTO für SC/MC). */
export const NumericRoundComparisonDTOSchema = z.object({
  round1Stats: NumericStatsDTOSchema,
  round2Stats: NumericStatsDTOSchema,
  round1Histogram: z.array(NumericHistogramBinSchema),
  round2Histogram: z.array(NumericHistogramBinSchema),
  meanDelta: z.number().nullable().optional(),
  medianDelta: z.number().nullable().optional(),
  inBandPercentDelta: z.number().nullable().optional(),
  deltaHistogram: z.array(NumericHistogramBinSchema).optional(),
  pairedAnalysis: NumericPairedAnalysisDTOSchema.optional(),
});
export type NumericRoundComparisonDTO = z.infer<typeof NumericRoundComparisonDTOSchema>;

// ---------------------------------------------------------------------------
// Confidence-Ergebnis (Story 1.2i)
// ---------------------------------------------------------------------------

export const ConfidenceDistributionSchema = z.object({
  '1': z.number().int().min(0),
  '2': z.number().int().min(0),
  '3': z.number().int().min(0),
  '4': z.number().int().min(0),
  '5': z.number().int().min(0),
});
export type ConfidenceDistributionDTO = z.infer<typeof ConfidenceDistributionSchema>;

export const ConfidenceCrossTabSchema = z.object({
  correctHigh: z.number().int().min(0),
  correctMid: z.number().int().min(0),
  correctLow: z.number().int().min(0),
  incorrectHigh: z.number().int().min(0),
  incorrectMid: z.number().int().min(0),
  incorrectLow: z.number().int().min(0),
});
export type ConfidenceCrossTabDTO = z.infer<typeof ConfidenceCrossTabSchema>;

export const ConfidenceWrongOptionCountSchema = z.object({
  answerId: z.uuid(),
  text: z.string(),
  count: z.number().int().min(1),
});
export type ConfidenceWrongOptionCountDTO = z.infer<typeof ConfidenceWrongOptionCountSchema>;

/** DTO: Aggregierte Sicherheitsgrad-Auswertung nach Ergebnisfreigabe */
export const ConfidenceResultDTOSchema = z.object({
  distribution: ConfidenceDistributionSchema,
  crossTab: ConfidenceCrossTabSchema,
  highConfidenceWrongCount: z.number().int().min(0),
  highConfidenceWrongOptions: z.array(ConfidenceWrongOptionCountSchema).optional(),
});
export type ConfidenceResultDTO = z.infer<typeof ConfidenceResultDTOSchema>;

export const ConfidenceQuestionSummaryDTOSchema = z.object({
  questionOrder: z.number().int().min(0),
  questionTextShort: z.string(),
  questionType: QuestionTypeEnum,
  responseCount: z.number().int().min(1),
  result: ConfidenceResultDTOSchema,
});
export type ConfidenceQuestionSummaryDTO = z.infer<typeof ConfidenceQuestionSummaryDTOSchema>;

export const SessionConfidenceSummaryDTOSchema = z.object({
  responseCount: z.number().int().min(1),
  includedQuestionCount: z.number().int().min(1),
  suppressedQuestionCount: z.number().int().min(0),
  priorityQuestionCount: z.number().int().min(0),
  distribution: ConfidenceDistributionSchema,
  crossTab: ConfidenceCrossTabSchema,
  highConfidenceWrongCount: z.number().int().min(0),
  questions: z.array(ConfidenceQuestionSummaryDTOSchema),
});
export type SessionConfidenceSummaryDTO = z.infer<typeof SessionConfidenceSummaryDTOSchema>;

/** Aggregierte Confidence-Auswertung einer beendeten Quiz-Session (Story 1.2i). */
export const GetSessionConfidenceSummaryOutputSchema = SessionConfidenceSummaryDTOSchema.nullable();
export type GetSessionConfidenceSummaryOutput = z.infer<
  typeof GetSessionConfidenceSummaryOutputSchema
>;

/** DTO: Aktuelle Frage für Host-Ansicht (Story 2.3, 3.5) – Text + Antwortoptionen inkl. isCorrect + Timer. */
export const HostCurrentQuestionDTOSchema = z.object({
  questionId: z.string().uuid(),
  order: z.number().int().min(0),
  /** Gesamtanzahl Fragen im Quiz (für Host-Button „Nächste Frage“ vs. „Session beenden“). */
  totalQuestions: z.number().int().min(1).optional(),
  text: z.string(),
  type: QuestionTypeEnum,
  difficulty: DifficultyEnum,
  showQuestionTypeIndicators: z.boolean().optional().default(true),
  timer: z.number().nullable().optional(),
  answers: z.array(
    z.object({
      id: z.uuid(),
      text: z.string(),
      isCorrect: z.boolean(),
    }),
  ),
  ratingMin: z.number().nullable().optional(),
  ratingMax: z.number().nullable().optional(),
  ratingLabelMin: z.string().nullable().optional(),
  ratingLabelMax: z.string().nullable().optional(),
  shortTextEvaluationKind: ShortTextEvaluationKindEnum.optional(),
  shortTextMaxLength: z
    .number()
    .int()
    .min(1)
    .max(SHORT_TEXT_MAX_LENGTH_LIMIT)
    .nullable()
    .optional(),
  shortTextCaseSensitive: z.boolean().optional(),
  shortTextEvaluationMode: ShortAnswerEvaluationModeEnum.optional(),
  shortTextToleranceLevel: ToleranceLevelEnum.optional(),
  shortTextAllowPartialCredit: z.boolean().optional(),
  shortTextTrimWhitespace: z.boolean().optional(),
  shortTextNormalizeWhitespace: z.boolean().optional(),
  numericInputKind: NumericInputKindEnum.optional(),
  numericToleranceMode: QuestionNumericToleranceModeSchema.optional(),
  numericAbsoluteTolerance: z.number().nullable().optional(),
  numericRelativeTolerancePercent: z.number().nullable().optional(),
  numericUnitFamily: NumericUnitFamilyEnum.optional(),
  numericRequireUnit: z.boolean().optional(),
  numericAcceptEquivalentUnits: z.boolean().optional(),
  confidenceEnabled: z.boolean().optional(),
  confidenceLabelLow: z.string().nullable().optional(),
  confidenceLabelHigh: z.string().nullable().optional(),
  ratingAvg: z.number().nullable().optional(),
  ratingCount: z.number().int().optional(),
  ratingDistribution: z.record(z.string(), z.number()).optional(),
  freeTextResponses: z.array(z.string()).optional(),
  incorrectFreeTextResponses: z.array(z.string()).optional(),
  voteDistribution: z
    .array(
      z.object({
        id: z.uuid(),
        text: z.string(),
        isCorrect: z.boolean(),
        voteCount: z.number().int(),
        votePercentage: z.number().int(),
      }),
    )
    .optional(),
  totalVotes: z.number().int().optional(),
  correctVoterCount: z.number().int().optional(),
  incorrectVoterCount: z.number().int().optional(),
  peerInstructionSuggestion: PeerInstructionSuggestionDTOSchema.optional(),
  currentRound: z.number().int().min(1).max(2).optional(),
  roundComparison: RoundComparisonDTOSchema.optional(),
  // Story 1.2d: Numerische Schätzfrage – Konfiguration (für Host sichtbar)
  numericReferenceValue: z.number().nullable().optional(),
  numericTolerancePercent: z.number().nullable().optional(),
  numericIntervalLeft: z.number().nullable().optional(),
  numericIntervalRight: z.number().nullable().optional(),
  numericInputType: NumericInputTypeEnum.optional(),
  numericDecimalPlaces: z.number().int().nullable().optional(),
  numericMin: z.number().nullable().optional(),
  numericMax: z.number().nullable().optional(),
  numericTwoRounds: z.boolean().optional(),
  // Story 1.2d: Statistik & Histogramm (nach Ergebnisfreigabe)
  numericHistogram: z.array(NumericHistogramBinSchema).optional(),
  numericStats: NumericStatsDTOSchema.optional(),
  numericRoundComparison: NumericRoundComparisonDTOSchema.optional(),
  confidenceResult: ConfidenceResultDTOSchema.optional(),
});
export type HostCurrentQuestionDTO = z.infer<typeof HostCurrentQuestionDTOSchema>;

/** DTO: Leichter Live-Fortschritt fuer die Host-Ansicht waehrend ACTIVE. */
export const HostVoteProgressDTOSchema = z.object({
  questionId: z.string().uuid(),
  questionOrder: z.number().int().min(0),
  round: z.number().int().min(1).max(2),
  totalVotes: z.number().int().min(0),
  correctVoterCount: z.number().int().min(0).optional(),
  incorrectVoterCount: z.number().int().min(0).optional(),
  peerInstructionSuggestion: PeerInstructionSuggestionDTOSchema.optional(),
});
export type HostVoteProgressDTO = z.infer<typeof HostVoteProgressDTOSchema>;

/** Input: Einer Session beitreten (Story 3.1) */
export const JoinSessionInputSchema = z.object({
  code: z.string().length(6, { error: 'Session-Code muss 6 Zeichen lang sein' }),
  nickname: z.string().min(1).max(30),
  teamId: z.uuid().optional(),
  rejoinToken: z.uuid().optional(),
});
export type JoinSessionInput = z.infer<typeof JoinSessionInputSchema>;

// ---------------------------------------------------------------------------
// Vote-Schemas (Story 3.3)
// ---------------------------------------------------------------------------

/** Input: Abstimmung abgeben */
export const SubmitVoteInputSchema = z.object({
  sessionId: z.uuid(),
  participantId: z.uuid(),
  questionId: z.uuid(),
  answerIds: z.array(z.uuid()).optional(), // MC: mehrere, SC: eine, FREETEXT/RATING: keine
  freeText: z.string().max(SHORT_TEXT_MAX_LENGTH_LIMIT).optional(),
  ratingValue: z.number().int().min(0).max(10).optional(), // Nur bei RATING
  numericValue: z.number().optional(), // Story 1.2d: Numerische Schätzfrage
  responseTimeMs: z.number().int().min(0).optional(), // Antwortzeit in ms
  round: z.number().int().min(1).max(2).optional().default(1), // Story 2.7: Peer Instruction Runde
  confidenceValue: z.number().int().min(CONFIDENCE_SCALE_MIN).max(CONFIDENCE_SCALE_MAX).optional(), // Story 1.2i
});
export type SubmitVoteInput = z.infer<typeof SubmitVoteInputSchema>;

/** Output: Antwort auf vote.submit (Story 3.3b). */
export const SubmitVoteOutputSchema = z.object({
  voteId: z.uuid(),
});
export type SubmitVoteOutput = z.infer<typeof SubmitVoteOutputSchema>;

// ---------------------------------------------------------------------------
// DTOs – Sichere Antwort-Objekte für den Client (Data-Stripping!)
// ---------------------------------------------------------------------------

/**
 * DTO: Antwort-Option OHNE isCorrect (Story 2.4 / Security).
 * WIRD an Studenten gesendet – enthält bewusst kein `isCorrect`!
 * .strict() sorgt dafür, dass Payloads mit isCorrect die Validierung fehlschlagen (nicht nur strippen).
 */
export const AnswerOptionStudentDTOSchema = z
  .object({
    id: z.uuid(),
    text: z.string(),
  })
  .strict();
export type AnswerOptionStudentDTO = z.infer<typeof AnswerOptionStudentDTOSchema>;

/**
 * DTO: Antwort-Option MIT isCorrect (Story 3.4 / Ergebnis-Phase).
 * Wird erst NACH Auflösung durch den Dozenten (Status RESULTS) gesendet!
 */
export const AnswerOptionRevealedDTOSchema = z.object({
  id: z.uuid(),
  text: z.string(),
  isCorrect: z.boolean(),
  voteCount: z.number(), // Anzahl Votes für diese Option
  votePercentage: z.number(), // Prozentualer Anteil (0–100)
});
export type AnswerOptionRevealedDTO = z.infer<typeof AnswerOptionRevealedDTOSchema>;

/** DTO: Frage mit aufgelösten Ergebnissen (Story 3.4, 4.4) */
export const QuestionRevealedDTOSchema = z.object({
  id: z.uuid(),
  text: z.string(),
  type: QuestionTypeEnum,
  difficulty: DifficultyEnum,
  showQuestionTypeIndicators: z.boolean().optional().default(true),
  order: z.number(),
  /** Gesamtanzahl Fragen (für Client-Hinweis „Letzte Frage”). */
  totalQuestions: z.number().int().min(1).optional(),
  answers: z.array(AnswerOptionRevealedDTOSchema),
  freeTextResponses: z.array(z.string()).optional(), // Nur bei FREETEXT-Fragen
  incorrectFreeTextResponses: z.array(z.string()).optional(),
  shortTextEvaluationKind: ShortTextEvaluationKindEnum.optional(),
  shortTextMaxLength: z
    .number()
    .int()
    .min(1)
    .max(SHORT_TEXT_MAX_LENGTH_LIMIT)
    .nullable()
    .optional(),
  shortTextCaseSensitive: z.boolean().optional(),
  shortTextEvaluationMode: ShortAnswerEvaluationModeEnum.optional(),
  shortTextToleranceLevel: ToleranceLevelEnum.optional(),
  shortTextAllowPartialCredit: z.boolean().optional(),
  shortTextTrimWhitespace: z.boolean().optional(),
  shortTextNormalizeWhitespace: z.boolean().optional(),
  numericInputKind: NumericInputKindEnum.optional(),
  numericRequireUnit: z.boolean().optional(),
  numericAcceptEquivalentUnits: z.boolean().optional(),
  numericAbsoluteTolerance: z.number().nullable().optional(),
  numericRelativeTolerancePercent: z.number().nullable().optional(),
  numericUnitFamily: NumericUnitFamilyEnum.optional(),
  correctVoterCount: z.number().int().optional(),
  incorrectVoterCount: z.number().int().optional(),
  totalVotes: z.number(),
  // Story 1.2d: Numerische Schätzfrage – aufgelöste Konfiguration + Statistik
  numericToleranceMode: QuestionNumericToleranceModeSchema.optional(),
  numericReferenceValue: z.number().nullable().optional(),
  numericTolerancePercent: z.number().nullable().optional(),
  numericIntervalLeft: z.number().nullable().optional(),
  numericIntervalRight: z.number().nullable().optional(),
  numericInputType: NumericInputTypeEnum.optional(),
  numericDecimalPlaces: z.number().int().nullable().optional(),
  numericTwoRounds: z.boolean().optional(),
  currentRound: z.number().int().min(1).max(2).optional(),
  numericStats: NumericStatsDTOSchema.optional(),
  numericHistogram: z.array(NumericHistogramBinSchema).optional(),
  confidenceEnabled: z.boolean().optional(),
  confidenceLabelLow: z.string().nullable().optional(),
  confidenceLabelHigh: z.string().nullable().optional(),
  confidenceResult: ConfidenceResultDTOSchema.optional(),
});
export type QuestionRevealedDTO = z.infer<typeof QuestionRevealedDTOSchema>;

/** DTO: Frage für Studenten (ohne Lösung). activeAt = Server-Zeitpunkt bei ACTIVE-Wechsel (Countdown-Sync, Story 3.5). Optional participantCount/totalVotes für Anzeige „Alle haben abgestimmt” und Countdown-Ausblendung. */
export const QuestionStudentDTOSchema = z.object({
  id: z.uuid(),
  text: z.string(),
  type: QuestionTypeEnum,
  timer: z.number().nullable(),
  difficulty: DifficultyEnum,
  showQuestionTypeIndicators: z.boolean().optional().default(true),
  order: z.number(),
  /** Gesamtanzahl Fragen (für Client-Hinweis „Letzte Frage”). */
  totalQuestions: z.number().int().min(1).optional(),
  answers: z.array(AnswerOptionStudentDTOSchema),
  activeAt: z.string().optional(),
  ratingMin: z.number().nullable().optional(),
  ratingMax: z.number().nullable().optional(),
  ratingLabelMin: z.string().nullable().optional(),
  ratingLabelMax: z.string().nullable().optional(),
  shortTextEvaluationKind: ShortTextEvaluationKindEnum.optional(),
  shortTextMaxLength: z
    .number()
    .int()
    .min(1)
    .max(SHORT_TEXT_MAX_LENGTH_LIMIT)
    .nullable()
    .optional(),
  shortTextCaseSensitive: z.boolean().optional(),
  shortTextEvaluationMode: ShortAnswerEvaluationModeEnum.optional(),
  shortTextToleranceLevel: ToleranceLevelEnum.optional(),
  shortTextAllowPartialCredit: z.boolean().optional(),
  shortTextTrimWhitespace: z.boolean().optional(),
  shortTextNormalizeWhitespace: z.boolean().optional(),
  numericInputKind: NumericInputKindEnum.optional(),
  numericToleranceMode: NumericToleranceModeEnum.optional(),
  numericAbsoluteTolerance: z.number().nullable().optional(),
  numericRelativeTolerancePercent: z.number().nullable().optional(),
  numericUnitFamily: NumericUnitFamilyEnum.optional(),
  numericRequireUnit: z.boolean().optional(),
  numericAcceptEquivalentUnits: z.boolean().optional(),
  participantCount: z.number().int().min(0).optional(),
  totalVotes: z.number().int().min(0).optional(),
  currentRound: z.number().int().min(1).max(2).optional(),
  // Story 1.2d: Numerische Schätzfrage – nur Eingabe-Konfiguration (KEINE Toleranz/Lösung!)
  numericInputType: NumericInputTypeEnum.optional(),
  numericDecimalPlaces: z.number().int().nullable().optional(),
  numericMin: z.number().nullable().optional(),
  numericMax: z.number().nullable().optional(),
  numericTwoRounds: z.boolean().optional(),
  confidenceEnabled: z.boolean().optional(),
  confidenceLabelLow: z.string().nullable().optional(),
  confidenceLabelHigh: z.string().nullable().optional(),
});
export type QuestionStudentDTO = z.infer<typeof QuestionStudentDTOSchema>;

/**
 * DTO: Frage in der Lesephase – NUR Fragenstamm, KEINE Antwortoptionen (Story 2.6).
 * Wird im Status QUESTION_OPEN an alle Clients gesendet.
 * Der Dozent gibt erst danach die Antworten frei (→ ACTIVE + QuestionStudentDTO).
 */
export const QuestionPreviewDTOSchema = z.object({
  id: z.uuid(),
  text: z.string(),
  type: QuestionTypeEnum,
  difficulty: DifficultyEnum,
  showQuestionTypeIndicators: z.boolean().optional().default(true),
  order: z.number(),
  /** Gesamtanzahl Fragen (für Client-Hinweis „Letzte Frage“). */
  totalQuestions: z.number().int().min(1).optional(),
  ratingMin: z.number().nullable().optional(), // Nur bei RATING
  ratingMax: z.number().nullable().optional(), // Nur bei RATING
  ratingLabelMin: z.string().nullable().optional(), // Nur bei RATING
  ratingLabelMax: z.string().nullable().optional(), // Nur bei RATING
  shortTextEvaluationKind: ShortTextEvaluationKindEnum.optional(),
  shortTextMaxLength: z
    .number()
    .int()
    .min(1)
    .max(SHORT_TEXT_MAX_LENGTH_LIMIT)
    .nullable()
    .optional(),
  shortTextCaseSensitive: z.boolean().optional(),
  shortTextEvaluationMode: ShortAnswerEvaluationModeEnum.optional(),
  shortTextToleranceLevel: ToleranceLevelEnum.optional(),
  shortTextAllowPartialCredit: z.boolean().optional(),
  shortTextTrimWhitespace: z.boolean().optional(),
  shortTextNormalizeWhitespace: z.boolean().optional(),
  numericInputKind: NumericInputKindEnum.optional(),
  numericToleranceMode: NumericToleranceModeEnum.optional(),
  numericAbsoluteTolerance: z.number().nullable().optional(),
  numericRelativeTolerancePercent: z.number().nullable().optional(),
  numericUnitFamily: NumericUnitFamilyEnum.optional(),
  numericRequireUnit: z.boolean().optional(),
  numericAcceptEquivalentUnits: z.boolean().optional(),
  participantReady: z.boolean().optional(),
  // Story 1.2d: Numerische Schätzfrage – nur Eingabe-Konfiguration (KEINE Toleranz/Lösung!)
  numericInputType: NumericInputTypeEnum.optional(),
  numericDecimalPlaces: z.number().int().nullable().optional(),
  numericMin: z.number().nullable().optional(),
  numericMax: z.number().nullable().optional(),
  confidenceEnabled: z.boolean().optional(),
  confidenceLabelLow: z.string().nullable().optional(),
  confidenceLabelHigh: z.string().nullable().optional(),
});
export type QuestionPreviewDTO = z.infer<typeof QuestionPreviewDTOSchema>;

/** DTO: Session-Info für den Beitritt (Story 3.1, 3.2). Enthält Nickname-Konfiguration bei QUIZ. */
export const SessionChannelsDTOSchema = z.object({
  quiz: z.object({
    enabled: z.boolean(),
  }),
  qa: z.object({
    enabled: z.boolean(),
    open: z.boolean(),
    title: z.string().nullable(),
    moderationMode: z.boolean(),
  }),
  quickFeedback: z.object({
    enabled: z.boolean(),
    open: z.boolean(),
  }),
});
export type SessionChannelsDTO = z.infer<typeof SessionChannelsDTOSchema>;

/** Output: Kanalstatus nach Zuschalten eines Session-Kanals (Host, ADR-0009). */
export const UpdateSessionChannelsOutputSchema = SessionChannelsDTOSchema;
export type UpdateSessionChannelsOutput = z.infer<typeof UpdateSessionChannelsOutputSchema>;

export const SessionInfoDTOSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  type: SessionTypeEnum,
  status: SessionStatusEnum,
  /**
   * Neutraler Quiz-Fortschritt fuer Reload/Reconnect. Enthält keine Antwort-,
   * Korrektheits- oder Ergebnisdaten.
   */
  currentQuestion: z.number().int().min(0).nullable().optional(),
  /** Aktuelle Abstimmungsrunde, falls der Quiz-Kanal bereits läuft. */
  currentRound: z.number().int().min(1).max(2).optional(),
  /** ISO-8601-Serverzeit bei dieser Antwort (Client-Uhrenoffset für Countdown-Sync). */
  serverTime: z.string(),
  quizName: z.string().nullable(),
  /** Optionales Motivbild (HTTPS-URL), nur Host Quiz-Kanal. */
  quizMotifImageUrl: z.union([MotifImageUrlSchema, z.null()]).optional(),
  title: z.string().nullable().optional(),
  channels: SessionChannelsDTOSchema.optional(), // ADR-0009: Übergangsweise optional für schrittweise Migration
  preferredChannel: SessionLiveChannelSchema.optional(),
  participantCount: z.number(),
  nicknameTheme: NicknameThemeEnum.optional(),
  allowCustomNicknames: z.boolean().optional(),
  anonymousMode: z.boolean().optional(),
  showLeaderboard: z.boolean().optional(),
  enableSoundEffects: z.boolean().optional(),
  enableRewardEffects: z.boolean().optional(),
  enableMotivationMessages: z.boolean().optional(),
  enableEmojiReactions: z.boolean().optional(),
  showQuestionTypeIndicators: z.boolean().optional(),
  readingPhaseEnabled: z.boolean().optional(),
  quizStarted: z.boolean().optional(),
  defaultTimer: z.number().nullable().optional(),
  timerScaleByDifficulty: z.boolean().optional(),
  backgroundMusic: z.string().nullable().optional(),
  teamMode: z.boolean().optional(),
  teamCount: z.number().nullable().optional(),
  teamAssignment: z.string().nullable().optional(),
  teamNames: z.array(z.string()).optional(),
  bonusTokenCount: z.number().nullable().optional(),
});
export type SessionInfoDTO = z.infer<typeof SessionInfoDTOSchema>;

/** Output: Nach Join (Session-Info + eigene Participant-ID für vote.submit). */
export const JoinSessionOutputSchema = SessionInfoDTOSchema.extend({
  participantId: z.uuid(),
  rejoinToken: z.uuid(),
  teamId: z.uuid().nullable().optional(),
  teamName: z.string().nullable().optional(),
});
export type JoinSessionOutput = z.infer<typeof JoinSessionOutputSchema>;

/** Input: Live-Freitextdaten der aktuell aktiven Frage per Session-Code abrufen. */
export const GetLiveFreetextInputSchema = z.object({
  code: z.string().length(6, { error: 'Session-Code muss 6 Zeichen lang sein' }),
});
export type GetLiveFreetextInput = z.infer<typeof GetLiveFreetextInputSchema>;

/** DTO: Live-Freitextdaten für Word-Cloud (Story 1.14). */
export const LiveFreetextDTOSchema = z.object({
  sessionId: z.uuid(),
  questionId: z.uuid().nullable(),
  questionOrder: z.number().nullable(),
  questionType: QuestionTypeEnum.nullable(),
  questionText: z.string().nullable(),
  responses: z.array(z.string()),
  updatedAt: z.string(), // ISO-8601
});
export type LiveFreetextDTO = z.infer<typeof LiveFreetextDTOSchema>;

/** Analyseansicht für Word-Cloud 3.0 – lexikalischer Fallback vs. Themenmodus. */
export const WordCloudAnalysisVariantEnum = z.enum(['LEXICAL', 'THEME']);
export type WordCloudAnalysisVariant = z.infer<typeof WordCloudAnalysisVariantEnum>;

/** Erste 3.0-Stufe: erklärbarer Themenmodus ist für `de` und `en` Pflichtscope. */
export const WordCloudAnalysisLocaleEnum = z.enum(['de', 'en']);
export type WordCloudAnalysisLocale = z.infer<typeof WordCloudAnalysisLocaleEnum>;

/** Gewichtungsbasis für Q&A-Word-Cloud-Analysen. */
export const WordCloudWeightMetricEnum = QaQuestionSortModeEnum;
export type WordCloudWeightMetric = z.infer<typeof WordCloudWeightMetricEnum>;

/** Einzelne Quelldaten für eine Word-Cloud-Analyse. */
export const WordCloudAnalysisSourceItemSchema = z.object({
  id: z.string().trim().min(1),
  text: z.string().trim().min(1),
  weight: z.number().min(0),
});
export type WordCloudAnalysisSourceItem = z.infer<typeof WordCloudAnalysisSourceItemSchema>;

/** Input: Analyseauftrag für Word Cloud 3.0. */
export const AnalyzeWordCloudInputSchema = z.object({
  sessionCode: z.string().length(6, { error: 'Session-Code muss 6 Zeichen lang sein' }),
  mode: WordCloudAnalysisVariantEnum,
  locale: WordCloudAnalysisLocaleEnum,
  metric: WordCloudWeightMetricEnum,
  items: z.array(WordCloudAnalysisSourceItemSchema).max(500),
  maxEntries: z.number().int().min(1).max(100).optional(),
});
export type AnalyzeWordCloudInput = z.infer<typeof AnalyzeWordCloudInputSchema>;

/** Mitglied eines erklärbaren Themenclusters oder lexikalischen Buckets. */
export const WordCloudAnalysisMemberDTOSchema = z.object({
  sourceId: z.string().trim().min(1),
  text: z.string().trim().min(1),
  weight: z.number().min(0),
});
export type WordCloudAnalysisMemberDTO = z.infer<typeof WordCloudAnalysisMemberDTOSchema>;

/** Ein analysierter Word-Cloud-Eintrag inklusive Erklärbarkeitsdaten. */
export const WordCloudAnalysisEntryDTOSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  count: z.number().min(0),
  basisLabel: z.string().trim().min(1).nullable(),
  members: z.array(WordCloudAnalysisMemberDTOSchema).min(1),
  variants: z.array(z.string().trim().min(1)),
  confidence: z.number().min(0).max(1).nullable(),
});
export type WordCloudAnalysisEntryDTO = z.infer<typeof WordCloudAnalysisEntryDTOSchema>;

/** Output: Erklärbares Ergebnis einer Word-Cloud-Analyse. */
export const WordCloudAnalysisResultDTOSchema = z.object({
  mode: WordCloudAnalysisVariantEnum,
  locale: WordCloudAnalysisLocaleEnum,
  metric: WordCloudWeightMetricEnum,
  generatedAt: z.string(), // ISO-8601
  fallbackUsed: z.boolean(),
  entries: z.array(WordCloudAnalysisEntryDTOSchema),
});
export type WordCloudAnalysisResultDTO = z.infer<typeof WordCloudAnalysisResultDTOSchema>;

/** Output: Antwort auf einen zukünftigen `wordCloud.analyze`-Pfad. */
export const AnalyzeWordCloudOutputSchema = WordCloudAnalysisResultDTOSchema;
export type AnalyzeWordCloudOutput = z.infer<typeof AnalyzeWordCloudOutputSchema>;

/** DTO: Live-Zustand authorisierter Quiz-Kopien (Story 1.10). */
export const ActiveQuizLiveStateDTOSchema = z.object({
  quizId: z.uuid(),
  /** Aktuell verbundene Personen inkl. Host/Dozent:in. */
  participantCountIncludingHost: z.number().int().min(1),
});
export type ActiveQuizLiveStateDTO = z.infer<typeof ActiveQuizLiveStateDTOSchema>;

export const ActiveQuizLiveStatesDTOSchema = z.array(ActiveQuizLiveStateDTOSchema);
export type ActiveQuizLiveStatesDTO = z.infer<typeof ActiveQuizLiveStatesDTOSchema>;

export const ActiveQuizLookupEntrySchema = z.object({
  quizId: z.uuid(),
  accessProof: QuizHistoryAccessProofSchema,
});
export type ActiveQuizLookupEntry = z.infer<typeof ActiveQuizLookupEntrySchema>;

export const GetActiveQuizIdsInputSchema = z.array(ActiveQuizLookupEntrySchema).max(200);
export type GetActiveQuizIdsInput = z.infer<typeof GetActiveQuizIdsInputSchema>;

/** DTO: Teilnehmer-Info (Story 2.2 Lobby). */
export const ParticipantDTOSchema = z.object({
  id: z.uuid(),
  nickname: z.string(),
  teamId: z.uuid().nullable().optional(),
  teamName: z.string().nullable().optional(),
});
export type ParticipantDTO = z.infer<typeof ParticipantDTOSchema>;

/** Payload: Teilnehmerliste einer Session (Story 2.2 – getParticipants / onParticipantJoined). */
export const SessionParticipantsPayloadSchema = z.object({
  participants: z.array(ParticipantDTOSchema),
  participantCount: z.number(),
  connectedCount: z.number().int().min(0).optional(),
  readingReady: ReadingReadyStatusDTOSchema.optional(),
});
export type SessionParticipantsPayload = z.infer<typeof SessionParticipantsPayloadSchema>;

/** Öffentliche Minimaldaten für Nickname-Kollisionen beim Join. */
export const SessionParticipantNicknamesPayloadSchema = z.object({
  nicknames: z.array(z.string()),
  participantCount: z.number(),
});
export type SessionParticipantNicknamesPayload = z.infer<
  typeof SessionParticipantNicknamesPayloadSchema
>;

/** Öffentlicher Zugriff auf den eigenen Teilnehmerdatensatz. */
export const GetSessionParticipantInputSchema = z.object({
  code: z.string().length(6),
  participantId: z.uuid(),
});
export type GetSessionParticipantInput = z.infer<typeof GetSessionParticipantInputSchema>;

/** DTO: Team-Info für Join/Lobby (Story 7.1). */
export const TeamDTOSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  color: z.string().nullable(),
  memberCount: z.number().int(),
});
export type TeamDTO = z.infer<typeof TeamDTOSchema>;

/** Payload: verfügbare Teams einer Session (Story 7.1). */
export const SessionTeamsPayloadSchema = z.object({
  teams: z.array(TeamDTOSchema),
  teamCount: z.number().int(),
});
export type SessionTeamsPayload = z.infer<typeof SessionTeamsPayloadSchema>;

/** DTO: Leaderboard-Eintrag (Story 4.1) */
export const LeaderboardEntryDTOSchema = z.object({
  rank: z.number(),
  nickname: z.string(),
  totalScore: z.number(), // Gesamtpunkte (Schwierigkeit × Zeitbonus)
  correctCount: z.number(), // Anzahl richtiger Antworten
  totalQuestions: z.number(), // Gesamtanzahl Fragen
  totalResponseTimeMs: z.number(), // Gesamtantwortzeit positiv bewerteter Antworten in ms (Tiebreaker)
  teamName: z.string().nullable().optional(), // Teamzuordnung im Teammodus
  teamColor: z.string().nullable().optional(), // Teamfarbe für kompakte Badges
});
export type LeaderboardEntryDTO = z.infer<typeof LeaderboardEntryDTOSchema>;

/** DTO: Persönliche Scorecard nach jeder Frage (Story 5.6) */
export const PersonalScorecardDTOSchema = z.object({
  questionOrder: z.number(), // Frage-Nr. (1-basiert)
  totalQuestions: z.number(), // Gesamtanzahl Fragen im Quiz
  wasCorrect: z.boolean().nullable(), // null bei SURVEY/FREETEXT
  correctAnswerIds: z.array(z.uuid()).optional(), // Korrekte Antwort-IDs (bei Falsch)
  questionScore: z.number(), // Punkte für diese Frage (inkl. Streak)
  baseScore: z.number(), // Punkte vor Streak-Multiplikator
  streakCount: z.number(), // Aktuelle Serie
  streakMultiplier: z.number(), // Angewandter Streak-Faktor
  currentRank: z.number(), // Aktueller Rang
  previousRank: z.number().nullable(), // Rang nach vorheriger Frage (null bei 1. Frage)
  rankChange: z.number(), // Differenz (positiv = aufgestiegen)
  totalScore: z.number(), // Gesamtpunktzahl bisher
  bonusToken: z.string().nullable().optional(), // Story 4.6: Token-Code (nur für Top-X, sonst null)
});
export type PersonalScorecardDTO = z.infer<typeof PersonalScorecardDTOSchema>;

/** DTO: Team-Leaderboard-Eintrag (Story 7.1) */
export const TeamLeaderboardEntryDTOSchema = z.object({
  rank: z.number(),
  teamName: z.string(),
  teamColor: z.string().nullable(),
  totalScore: z.number(), // Harmonisierte Team-Punkte (Gesamtpunkte / Teamgröße)
  memberCount: z.number(),
  averageScore: z.number(), // Durchschnitt pro Mitglied (derzeit identisch zu totalScore)
});
export type TeamLeaderboardEntryDTO = z.infer<typeof TeamLeaderboardEntryDTOSchema>;

/** Input: Emoji-Reaktion senden (Story 5.8). `round`: Peer Instruction – eigener Speicher pro Runde. */
export const SendEmojiReactionInputSchema = z.object({
  sessionId: z.uuid(),
  questionId: z.uuid(),
  participantId: z.uuid(),
  emoji: z.enum(EMOJI_REACTIONS),
  round: z.number().int().min(1).max(2).optional().default(1),
});
export type SendEmojiReactionInput = z.infer<typeof SendEmojiReactionInputSchema>;

// ---------------------------------------------------------------------------
// Health-Check & Server-Status
// ---------------------------------------------------------------------------

/** Health-Check Response (Story 0.1: optional Redis-Status) */
export const HealthCheckResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string(),
  version: z.string(),
  redis: z.enum(['ok', 'unavailable']).optional(),
});

export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

export const DailyHighscoreEntrySchema = z.object({
  /** UTC-Tag als ISO-8601 Datum (`YYYY-MM-DD`). */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Tagesrekord der größten einzelnen Session dieses UTC-Tags. */
  count: z.number().int().min(0),
  /** ISO-8601: UTC-Zeitpunkt, als sich der Tagesrekord zuletzt erhöht hat; bei aufgefüllten Lückentagen null. */
  updatedAt: z.string().datetime().nullable(),
});
export type DailyHighscoreEntry = z.infer<typeof DailyHighscoreEntrySchema>;

/** Deskriptive Statistik über alle täglichen Highscores im betrachteten Zeitraum. */
export const DailyHighscoresStatisticsSchema = z.object({
  /** Median der Tagesrekorde. */
  median: z.number().int().min(0),
  /** Standardabweichung der Tagesrekorde. */
  standardDeviation: z.number().min(0),
  /** Maximum der Tagesrekorde im Zeitraum. */
  max: z.number().int().min(0),
});
export type DailyHighscoresStatistics = z.infer<typeof DailyHighscoresStatisticsSchema>;

/** DTO: Server-Auslastung für die Startseite (Story 0.4) */
export const ServerStatsDTOSchema = z.object({
  /** Alle noch nicht beendeten Sessions. */
  openSessions: z.number(),
  /** Offene Sessions mit mindestens 5 aktiven Teilnehmenden in den letzten 3 Minuten. */
  activeSessions: z.number(),
  /** Aktive Teilnahmen über laufende Sessions (letzte 3 Minuten Redis-Presence). */
  totalParticipants: z.number(),
  /** Abstimmungen der letzten Minute über alle offenen Sessions. */
  votesLastMinute: z.number(),
  /** Statuswechsel der letzten Minute über alle offenen Sessions. */
  sessionTransitionsLastMinute: z.number(),
  /** Sessions mit aktivem Countdown im aktuellen Zeitfenster. */
  activeCountdownSessions: z.number(),
  /** Kumulativ: Anzahl Session-Zeilen mit Status FINISHED (lebenslang in dieser DB). */
  completedSessions: z.number(),
  activeBlitzRounds: z.number(),
  /** Höchste je in einer Session registrierte Teilnehmerzahl (Joins, plattformweit). */
  maxParticipantsSingleSession: z.number().int().min(0),
  /** Verlauf der Session-Tagesrekorde der letzten 100 UTC-Tage in chronologischer Reihenfolge. */
  dailyHighscores: z.array(DailyHighscoreEntrySchema).length(100),
  /** Deskriptive Statistik über die täglichen Highscores. */
  dailyHighscoresStatistics: DailyHighscoresStatisticsSchema,
  /** ISO-8601: Serverzeitpunkt, als sich der Rekord zuletzt erhöhte (`PlatformStatistic.updatedAt`), sonst null — nicht Session-Start/-Ende. */
  maxParticipantsStatisticUpdatedAt: z.string().datetime().nullable(),
  /** Betriebsstatus (SLO-nah) für den Footer. */
  serviceStatus: z.enum(['stable', 'limited', 'critical']),
  /** Lastindikator für Diagnose im Detaildialog. */
  loadStatus: z.enum(['healthy', 'busy', 'overloaded']),
});

export type ServerStatsDTO = z.infer<typeof ServerStatsDTOSchema>;

/** Schlanke Footer-Antwort für den grünen Punkt im App-Footer. */
export const FooterStatusDTOSchema = z.object({
  /** Betriebsstatus (SLO-nah) für den Footer. */
  serviceStatus: z.enum(['stable', 'limited', 'critical']),
  /** Lastindikator für die Einfärbung bzw. Diagnose. */
  loadStatus: z.enum(['healthy', 'busy', 'overloaded']),
});

export type FooterStatusDTO = z.infer<typeof FooterStatusDTOSchema>;

/** Ein HTTP-Roundtrip für App-Footer: Check + Stats parallel auf dem Server (kürzere kritische Netzwerk-Kette). */
export const HealthFooterBundleSchema = z.object({
  check: HealthCheckResponseSchema,
  stats: FooterStatusDTOSchema,
});
export type HealthFooterBundle = z.infer<typeof HealthFooterBundleSchema>;

/** Event der health.ping-Subscription (Story 0.2) */
export const HealthPingEventSchema = z.object({
  heartbeat: z.string(), // ISO-8601
});
export type HealthPingEvent = z.infer<typeof HealthPingEventSchema>;

// ---------------------------------------------------------------------------
// Quiz-Export / Import (Story 1.8, 1.9)
// ---------------------------------------------------------------------------

/** Aktuelle Export-Schema-Version */
export const QUIZ_EXPORT_VERSION = 1;

/** Schema für eine exportierte Antwortoption */
const ExportedAnswerOptionSchema = z.object({
  text: z.string(),
  isCorrect: z.boolean(),
});

/** Schema für eine exportierte Frage */
const ExportedQuestionSchema = z.object({
  text: z.string(),
  type: QuestionTypeEnum,
  timer: z.number().nullable().optional(),
  difficulty: DifficultyEnum,
  order: z.number(),
  answers: z.array(ExportedAnswerOptionSchema),
  skipReadingPhase: z.boolean().optional(),
  ratingMin: z.number().nullable().optional(), // Nur bei RATING
  ratingMax: z.number().nullable().optional(), // Nur bei RATING
  ratingLabelMin: z.string().nullable().optional(), // Nur bei RATING
  ratingLabelMax: z.string().nullable().optional(), // Nur bei RATING
  shortTextEvaluationKind: ShortTextEvaluationKindEnum.optional(),
  shortTextMaxLength: z
    .number()
    .int()
    .min(1)
    .max(SHORT_TEXT_MAX_LENGTH_LIMIT)
    .nullable()
    .optional(),
  shortTextCaseSensitive: z.boolean().optional(),
  shortTextEvaluationMode: ShortAnswerEvaluationModeEnum.optional(),
  shortTextToleranceLevel: ToleranceLevelEnum.optional(),
  shortTextAllowPartialCredit: z.boolean().optional(),
  shortTextTrimWhitespace: z.boolean().optional(),
  shortTextNormalizeWhitespace: z.boolean().optional(),
  numericInputKind: NumericInputKindEnum.optional(),
  numericToleranceMode: QuestionNumericToleranceModeSchema.optional(),
  numericAbsoluteTolerance: z.number().nullable().optional(),
  numericRelativeTolerancePercent: z.number().nullable().optional(),
  numericUnitFamily: NumericUnitFamilyEnum.optional(),
  numericRequireUnit: z.boolean().optional(),
  numericAcceptEquivalentUnits: z.boolean().optional(),
  numericReferenceValue: z.number().nullable().optional(),
  numericTolerancePercent: z.number().nullable().optional(),
  numericIntervalLeft: z.number().nullable().optional(),
  numericIntervalRight: z.number().nullable().optional(),
  numericInputType: NumericInputTypeEnum.optional(),
  numericDecimalPlaces: z.number().int().nullable().optional(),
  numericMin: z.number().nullable().optional(),
  numericMax: z.number().nullable().optional(),
  numericTwoRounds: z.boolean().optional(),
  confidenceEnabled: z.boolean().optional(),
  confidenceLabelLow: z.string().nullable().optional(),
  confidenceLabelHigh: z.string().nullable().optional(),
  /** false = in lokaler Bibliothek behalten, aber nicht in Live/Vorschau */
  enabled: z.boolean().optional().default(true),
});

/** Schema für das gesamte Quiz-Export-Format */
export const QuizExportSchema = z.object({
  exportVersion: z.number().int().min(1),
  exportedAt: z.string(), // ISO-8601 Timestamp
  quiz: z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    motifImageUrl: z.union([MotifImageUrlSchema, z.null()]).optional(),
    showLeaderboard: z.boolean(),
    allowCustomNicknames: z.boolean(),
    defaultTimer: z.number().int().min(5).max(300).nullable().optional(),
    timerScaleByDifficulty: z.boolean().optional(),
    enableSoundEffects: z.boolean(),
    enableRewardEffects: z.boolean(),
    enableMotivationMessages: z.boolean(),
    enableEmojiReactions: z.boolean(),
    showQuestionTypeIndicators: z.boolean().optional(),
    anonymousMode: z.boolean(),
    teamMode: z.boolean(),
    teamCount: z.number().int().min(2).max(8).nullable().optional(),
    teamAssignment: TeamAssignmentEnum.optional(),
    teamNames: TeamNamesSchema.optional(),
    backgroundMusic: z.string().max(50).nullable().optional(),
    nicknameTheme: NicknameThemeEnum,
    bonusTokenCount: z.number().int().min(1).max(50).nullable().optional(), // Story 4.6
    readingPhaseEnabled: z.boolean().optional(), // Story 2.6: Lesephase
    questions: z.array(ExportedQuestionSchema).min(1),
  }),
});
export type QuizExport = z.infer<typeof QuizExportSchema>;

/**
 * Alias für Import-Validierung (Story 1.9a).
 * Import und Export nutzen bewusst dasselbe JSON-Format.
 */
export const QuizImportSchema = QuizExportSchema;
export type QuizImport = z.infer<typeof QuizImportSchema>;

// ---------------------------------------------------------------------------
// Rating-Ergebnis (Story 1.2c)
// ---------------------------------------------------------------------------

/** DTO: Aggregiertes Rating-Ergebnis für eine Skala-Frage */
export const RatingResultDTOSchema = z.object({
  questionId: z.uuid(),
  ratingMin: z.number(),
  ratingMax: z.number(),
  ratingLabelMin: z.string().nullable(),
  ratingLabelMax: z.string().nullable(),
  distribution: z.record(z.string(), z.number()), // { "1": 5, "2": 12, ... }
  average: z.number(),
  standardDeviation: z.number(),
  totalVotes: z.number(),
});
export type RatingResultDTO = z.infer<typeof RatingResultDTOSchema>;

// ---------------------------------------------------------------------------
// Bonus-Token (Story 4.6)
// ---------------------------------------------------------------------------

/** DTO: Einzelner Bonus-Token-Eintrag in der Dozenten-Liste */
export const BonusTokenEntryDTOSchema = z.object({
  token: z.string(), // z.B. "BNS-A3F7-K2M9"
  nickname: z.string(), // Pseudonym (Snapshot)
  quizName: z.string(), // Quiz-Name (Snapshot)
  totalScore: z.number(), // Erreichte Gesamtpunktzahl
  rank: z.number(), // Platzierung (1-basiert)
  generatedAt: z.string(), // ISO-8601 Timestamp
});
export type BonusTokenEntryDTO = z.infer<typeof BonusTokenEntryDTOSchema>;

/** DTO: Vollständige Bonus-Token-Liste für den Dozenten */
export const BonusTokenListDTOSchema = z.object({
  sessionCode: z.string(),
  quizName: z.string(),
  tokens: z.array(BonusTokenEntryDTOSchema),
});
export type BonusTokenListDTO = z.infer<typeof BonusTokenListDTOSchema>;

/** Bonus-Token-Liste inkl. Session-Zeitstempel (Quiz-Sammlung, nicht Live-Host) */
export const BonusTokenListWithSessionMetaDTOSchema = BonusTokenListDTOSchema.extend({
  endedAt: z.string().nullable(),
});
export type BonusTokenListWithSessionMetaDTO = z.infer<
  typeof BonusTokenListWithSessionMetaDTOSchema
>;

export const GetBonusTokensForQuizInputSchema = z.object({
  quizId: z.string().uuid(),
  accessProof: QuizHistoryAccessProofSchema,
});
export type GetBonusTokensForQuizInput = z.infer<typeof GetBonusTokensForQuizInputSchema>;

export const BindQuizHistoryScopeInputSchema = z.object({
  quizId: z.string().uuid(),
  accessProof: QuizHistoryAccessProofSchema,
  historyScopeId: z.string().uuid(),
});
export type BindQuizHistoryScopeInput = z.infer<typeof BindQuizHistoryScopeInputSchema>;

export const BindQuizHistoryScopeOutputSchema = z.object({
  accessProof: QuizHistoryAccessProofSchema,
});
export type BindQuizHistoryScopeOutput = z.infer<typeof BindQuizHistoryScopeOutputSchema>;

export const BonusTokensForQuizOutputSchema = z.object({
  sessions: z.array(BonusTokenListWithSessionMetaDTOSchema),
});
export type BonusTokensForQuizOutput = z.infer<typeof BonusTokensForQuizOutputSchema>;

export const QuizCollectionHistoryAvailabilityDTOSchema = z.object({
  quizId: z.string().uuid(),
  hasBonusTokens: z.boolean(),
  hasLastSessionFeedback: z.boolean(),
  hasLastSessionAnalysis: z.boolean(),
});
export type QuizCollectionHistoryAvailabilityDTO = z.infer<
  typeof QuizCollectionHistoryAvailabilityDTOSchema
>;

export const GetQuizCollectionHistoryAvailabilityInputSchema = z
  .array(GetBonusTokensForQuizInputSchema)
  .max(100);
export type GetQuizCollectionHistoryAvailabilityInput = z.infer<
  typeof GetQuizCollectionHistoryAvailabilityInputSchema
>;

export const GetQuizCollectionHistoryAvailabilityOutputSchema = z.array(
  QuizCollectionHistoryAvailabilityDTOSchema,
);
export type GetQuizCollectionHistoryAvailabilityOutput = z.infer<
  typeof GetQuizCollectionHistoryAvailabilityOutputSchema
>;

export const VerifyBonusTokenForQuizInputSchema = z.object({
  quizId: z.string().uuid(),
  accessProof: QuizHistoryAccessProofSchema,
  bonusCode: z
    .string()
    .trim()
    .min(4)
    .max(32)
    .regex(/^[A-Za-z0-9-]+$/),
});
export type VerifyBonusTokenForQuizInput = z.infer<typeof VerifyBonusTokenForQuizInputSchema>;

export const VerifyBonusTokenForQuizOutputSchema = z.discriminatedUnion('valid', [
  z.object({
    valid: z.literal(true),
    sessionCode: z.string(),
    nickname: z.string(),
    rank: z.number().int().min(1),
    totalScore: z.number(),
  }),
  z.object({
    valid: z.literal(false),
  }),
]);
export type VerifyBonusTokenForQuizOutput = z.infer<typeof VerifyBonusTokenForQuizOutputSchema>;

export const DeleteBonusTokenForQuizInputSchema = z.object({
  quizId: z.string().uuid(),
  accessProof: QuizHistoryAccessProofSchema,
  bonusCode: z
    .string()
    .trim()
    .regex(/^BNS-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/),
});
export type DeleteBonusTokenForQuizInput = z.infer<typeof DeleteBonusTokenForQuizInputSchema>;

export const DeleteBonusTokenForQuizOutputSchema = z.object({
  deleted: z.boolean(),
});
export type DeleteBonusTokenForQuizOutput = z.infer<typeof DeleteBonusTokenForQuizOutputSchema>;

// ---------------------------------------------------------------------------
// Ergebnis-Export für Dozenten (Story 4.7) – nur aggregierte/anonyme Daten
// ---------------------------------------------------------------------------

/** Input: Export-Daten für eine beendete Session abrufen (nur Dozent, Session FINISHED) */
export const GetExportDataInputSchema = z.object({
  code: z.string().length(6, { error: 'Session-Code muss 6 Zeichen lang sein' }),
});
export type GetExportDataInput = z.infer<typeof GetExportDataInputSchema>;

/** Input: Session-Ergebnisbericht als PDF (optional mit UI-Locale). */
export const GetSessionExportPdfInputSchema = GetExportDataInputSchema.extend({
  localeId: z.string().min(2).max(10).optional(),
});
export type GetSessionExportPdfInput = z.infer<typeof GetSessionExportPdfInputSchema>;

/** Verteilung einer Antwortoption (MC/SC) für Export */
export const OptionDistributionEntrySchema = z.object({
  text: z.string(),
  count: z.number(),
  percentage: z.number().optional(),
  isCorrect: z.boolean().optional(),
});
export type OptionDistributionEntry = z.infer<typeof OptionDistributionEntrySchema>;

/** Aggregierte Freitext-Antwort (Begriff + Häufigkeit) für Export */
export const FreetextAggregateEntrySchema = z.object({
  text: z.string(),
  count: z.number(),
});
export type FreetextAggregateEntry = z.infer<typeof FreetextAggregateEntrySchema>;

/** Aggregierte Session-Freitextdaten für Export (Story 1.14). */
export const FreetextSessionExportEntrySchema = z.object({
  questionId: z.uuid(),
  questionOrder: z.number(),
  questionText: z.string(),
  aggregates: z.array(FreetextAggregateEntrySchema),
});
export type FreetextSessionExportEntry = z.infer<typeof FreetextSessionExportEntrySchema>;

export const FreetextSessionExportDTOSchema = z.object({
  sessionId: z.uuid(),
  sessionCode: z.string(),
  exportedAt: z.string(),
  entries: z.array(FreetextSessionExportEntrySchema),
});
export type FreetextSessionExportDTO = z.infer<typeof FreetextSessionExportDTOSchema>;

/** Ein Eintrag pro Frage im Session-Export (aggregiert, keine Nicknames) */
export const QuestionExportEntrySchema = z.object({
  questionOrder: z.number(),
  questionTextShort: z.string(), // z. B. erste 100 Zeichen des Fragenstamms
  /** Vollständiger Fragentext (Markdown) für PDF/Report. */
  questionTextFull: z.string().optional(),
  type: QuestionTypeEnum,
  participantCount: z.number(), // Anzahl abgegebener Votes für diese Frage
  optionDistribution: z.array(OptionDistributionEntrySchema).optional(), // MC/SC
  freetextAggregates: z.array(FreetextAggregateEntrySchema).optional(), // FREETEXT
  shortTextSolutions: z.array(z.string()).optional(), // SHORT_TEXT
  shortTextIncorrectAggregates: z.array(FreetextAggregateEntrySchema).optional(), // SHORT_TEXT
  correctCount: z.number().optional(), // SHORT_TEXT
  incorrectCount: z.number().optional(), // SHORT_TEXT
  ratingDistribution: z.record(z.string(), z.number()).optional(), // RATING: "1" -> 5, "2" -> 12
  ratingAverage: z.number().optional(),
  ratingStandardDeviation: z.number().optional(),
  numericStats: NumericStatsDTOSchema.optional(),
  numericHistogram: z.array(NumericHistogramBinSchema).optional(),
  numericRoundComparison: NumericRoundComparisonDTOSchema.optional(),
  numericReferenceValue: z.number().nullable().optional(),
  numericTolerancePercent: z.number().nullable().optional(),
  numericIntervalLeft: z.number().nullable().optional(),
  numericIntervalRight: z.number().nullable().optional(),
  numericToleranceMode: z.string().nullable().optional(),
  numericInputType: z.enum(['INTEGER', 'DECIMAL']).nullable().optional(),
  numericDecimalPlaces: z.number().int().nullable().optional(),
  confidenceResult: ConfidenceResultDTOSchema.optional(),
  /** Aggregationsrunde für Verteilung, Selbsteinschätzung und Punkte (Effective-Vote-Regel). */
  aggregationRound: z.union([z.literal(1), z.literal(2)]).optional(),
  /** Stimmen in Runde 1; gesetzt, wenn Runde-2-Votes existieren. */
  round1ParticipantCount: z.number().int().optional(),
  /** Stimmen in Runde 2; gesetzt, wenn Runde-2-Votes existieren. */
  round2ParticipantCount: z.number().int().optional(),
  /** MC/SC-Verteilung Runde 1 (Peer Instruction), wenn Runde-2-Votes existieren. */
  round1OptionDistribution: z.array(OptionDistributionEntrySchema).optional(),
  averageScore: z.number().optional(), // Durchschnittspunkte (wenn gescored)
});
export type QuestionExportEntry = z.infer<typeof QuestionExportEntrySchema>;

/** Aggregierte Q&A-Frage für Session-Export (ohne Nicknames). */
export const QaExportEntrySchema = z.object({
  order: z.number().int(),
  text: z.string(),
  status: QaQuestionStatusEnum,
  upvoteCount: z.number().int(),
  positiveVoteCount: z.number().int().optional(),
  negativeVoteCount: z.number().int().optional(),
  voteCount: z.number().int().optional(),
  isControversial: z.boolean().optional(),
});
export type QaExportEntry = z.infer<typeof QaExportEntrySchema>;

/** Aggregierte Session-Bewertung (Story 4.8) — für Export und Host-Abschluss. */
export const SessionFeedbackSummarySchema = z.object({
  totalResponses: z.number(),
  overallAverage: z.number(),
  overallDistribution: z.record(z.string(), z.number()),
  questionQualityAverage: z.number().nullable(),
  questionQualityDistribution: z.record(z.string(), z.number()).nullable(),
  wouldRepeatYes: z.number(),
  wouldRepeatNo: z.number(),
});
export type SessionFeedbackSummary = z.infer<typeof SessionFeedbackSummarySchema>;

/** DTO: Vollständiger Session-Export für Dozenten (CSV/PDF-Generierung) – DSGVO-konform, nur aggregiert */
export const SessionExportDTOSchema = z.object({
  sessionId: z.uuid(),
  sessionCode: z.string(),
  quizName: z.string(),
  finishedAt: z.string(), // ISO-8601
  participantCount: z.number(),
  teamMode: z.boolean(),
  questions: z.array(QuestionExportEntrySchema),
  confidenceSummary: SessionConfidenceSummaryDTOSchema.optional(),
  feedbackSummary: SessionFeedbackSummarySchema.optional(),
  teamLeaderboard: z.array(TeamLeaderboardEntryDTOSchema).optional(),
  bonusTokens: z.array(BonusTokenEntryDTOSchema).optional(), // optional einbeziehen (Pseudonyme)
  qaQuestions: z.array(QaExportEntrySchema).optional(),
});
export type SessionExportDTO = z.infer<typeof SessionExportDTOSchema>;

/** Output: Session-Ergebnisbericht als PDF (Base64 für Download). */
export const SessionExportPdfOutputSchema = z.object({
  fileName: z.string(),
  mimeType: z.literal('application/pdf'),
  contentBase64: z.string(),
});
export type SessionExportPdfOutput = z.infer<typeof SessionExportPdfOutputSchema>;

// ---------------------------------------------------------------------------
// Admin (Epic 9)
// ---------------------------------------------------------------------------

/** Input: Admin-Login per Shared Secret. */
export const AdminLoginInputSchema = z.object({
  secret: z.string().trim().min(1).max(512),
});
export type AdminLoginInput = z.infer<typeof AdminLoginInputSchema>;

/** Output: Admin-Login erfolgreich, Token mit Ablaufzeit. */
export const AdminLoginOutputSchema = z.object({
  token: z.string().min(32),
  expiresAt: z.string(), // ISO-8601
});
export type AdminLoginOutput = z.infer<typeof AdminLoginOutputSchema>;

/** Input: Session-Lookup im Admin-Bereich über 6-stelligen Code. */
export const AdminSessionLookupInputSchema = z.object({
  code: z.string().trim().length(6),
});
export type AdminSessionLookupInput = z.infer<typeof AdminSessionLookupInputSchema>;

/** Input: Admin-Sessionliste mit optionalen Filtern und Pagination. */
export const AdminListSessionsInputSchema = z.object({
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(25),
  status: SessionStatusEnum.optional(),
  type: SessionTypeEnum.optional(),
  code: z.string().trim().length(6).optional(),
});
export type AdminListSessionsInput = z.infer<typeof AdminListSessionsInputSchema>;

/** Input: Admin-Sessiondetail via Session-ID. */
export const AdminGetSessionDetailInputSchema = z.object({
  sessionId: z.uuid(),
});
export type AdminGetSessionDetailInput = z.infer<typeof AdminGetSessionDetailInputSchema>;

/** Recherchefenster laut Epic 9 (A/B/C). */
export const AdminRetentionWindowEnum = z.enum(['RUNNING', 'POST_SESSION_24H', 'PURGED']);
export type AdminRetentionWindow = z.infer<typeof AdminRetentionWindowEnum>;

/** Retention-Status inkl. optionalem Legal Hold. */
export const AdminRetentionStateDTOSchema = z.object({
  window: AdminRetentionWindowEnum,
  legalHoldUntil: z.string().nullable().optional(),
  legalHoldReason: z.string().nullable().optional(),
});
export type AdminRetentionStateDTO = z.infer<typeof AdminRetentionStateDTOSchema>;

/** Kompakter Admin-Listeneintrag für Sessions. */
export const AdminSessionSummaryDTOSchema = z.object({
  sessionId: z.uuid(),
  sessionCode: z.string().length(6),
  type: SessionTypeEnum,
  status: SessionStatusEnum,
  quizName: z.string().nullable(),
  participantCount: z.number().int().min(0),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  lastActivityAt: z.string(),
  retention: AdminRetentionStateDTOSchema,
});
export type AdminSessionSummaryDTO = z.infer<typeof AdminSessionSummaryDTOSchema>;

/** Session-Liste für Admin mit Pagination-Metadaten. */
export const AdminSessionListDTOSchema = z.object({
  sessions: z.array(AdminSessionSummaryDTOSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});
export type AdminSessionListDTO = z.infer<typeof AdminSessionListDTOSchema>;

/** Vollständige Admin-Detailansicht einer Session (read-only). */
export const AdminSessionDetailDTOSchema = z.object({
  session: AdminSessionSummaryDTOSchema,
  title: z.string().nullable().optional(),
  questions: z
    .array(
      z.object({
        id: z.uuid(),
        order: z.number().int().min(0),
        text: z.string(),
        type: QuestionTypeEnum,
        answers: z.array(
          z.object({
            id: z.uuid(),
            text: z.string(),
            isCorrect: z.boolean(),
          }),
        ),
      }),
    )
    .optional(),
});
export type AdminSessionDetailDTO = z.infer<typeof AdminSessionDetailDTOSchema>;

/** Input: Legal Hold setzen/lösen. */
export const AdminSetLegalHoldInputSchema = z.object({
  sessionId: z.uuid(),
  enabled: z.boolean(),
  reason: z.string().trim().max(1000).optional(),
  holdDays: z.number().int().min(1).max(365).optional(),
});
export type AdminSetLegalHoldInput = z.infer<typeof AdminSetLegalHoldInputSchema>;

/** Input: Session endgültig löschen (Story 9.2). */
export const AdminDeleteSessionInputSchema = z.object({
  sessionId: z.uuid(),
  reason: z.string().trim().max(1000).optional(),
});
export type AdminDeleteSessionInput = z.infer<typeof AdminDeleteSessionInputSchema>;

/** Output: Session-Löschung bestätigt. */
export const AdminDeleteSessionOutputSchema = z.object({
  deleted: z.literal(true),
  sessionId: z.uuid(),
  sessionCode: z.string().length(6),
});
export type AdminDeleteSessionOutput = z.infer<typeof AdminDeleteSessionOutputSchema>;

/** Input: Alle Sessions endgültig löschen (nur mit Sicherheitsphrase). */
export const AdminDeleteAllSessionsInputSchema = z.object({
  confirmationText: z.string().trim().min(1).max(200),
  expectedSessionCount: z.number().int().min(0),
  reason: z.string().trim().max(1000).optional(),
});
export type AdminDeleteAllSessionsInput = z.infer<typeof AdminDeleteAllSessionsInputSchema>;

/** Output: Massenlöschung von Sessions bestätigt. */
export const AdminDeleteAllSessionsOutputSchema = z.object({
  deleted: z.literal(true),
  deletedSessionCount: z.number().int().min(0),
  deletedQuizCount: z.number().int().min(0),
});
export type AdminDeleteAllSessionsOutput = z.infer<typeof AdminDeleteAllSessionsOutputSchema>;

/** Input: Rekord-Teilnehmerzahl zurücksetzen (mit Sicherheitsphrase). */
export const AdminResetMaxParticipantsRecordInputSchema = z.object({
  confirmationText: z.string().trim().min(1).max(200),
});
export type AdminResetMaxParticipantsRecordInput = z.infer<
  typeof AdminResetMaxParticipantsRecordInputSchema
>;

/** Output: Rekord-Teilnehmerzahl wurde zurückgesetzt. */
export const AdminResetMaxParticipantsRecordOutputSchema = z.object({
  reset: z.literal(true),
  previousMaxParticipantsSingleSession: z.number().int().min(0),
  currentMaxParticipantsSingleSession: z.number().int().min(0),
});
export type AdminResetMaxParticipantsRecordOutput = z.infer<
  typeof AdminResetMaxParticipantsRecordOutputSchema
>;

/** Export-Format für Behördenauszug (Story 9.3). */
export const AdminExportFormatEnum = z.enum(['PDF', 'JSON']);
export type AdminExportFormat = z.infer<typeof AdminExportFormatEnum>;

/** Input: Behördenexport anstoßen. */
export const AdminExportInputSchema = z.object({
  sessionId: z.uuid(),
  format: AdminExportFormatEnum.default('PDF'),
  reason: z.string().trim().max(1000).optional(),
  caseReference: z.string().trim().max(200).optional(),
});
export type AdminExportInput = z.infer<typeof AdminExportInputSchema>;

/** Output: Exportdatei als Base64 für Download im Frontend. */
export const AdminExportOutputSchema = z.object({
  exportId: z.uuid(),
  format: AdminExportFormatEnum,
  mimeType: z.string(),
  fileName: z.string(),
  contentBase64: z.string(),
  sha256: z.string().length(64),
  generatedAt: z.string(),
});
export type AdminExportOutput = z.infer<typeof AdminExportOutputSchema>;

/** Audit-Log-Eintrag für Admin-Aktionen. */
export const AdminAuditLogEntryDTOSchema = z.object({
  id: z.uuid(),
  action: z.enum(['SESSION_DELETE', 'EXPORT_FOR_AUTHORITIES']),
  sessionId: z.string(),
  sessionCode: z.string(),
  adminIdentifier: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type AdminAuditLogEntryDTO = z.infer<typeof AdminAuditLogEntryDTOSchema>;

/** Output: Admin-Session gültig. */
export const AdminWhoAmIOutputSchema = z.object({
  authenticated: z.literal(true),
});
export type AdminWhoAmIOutput = z.infer<typeof AdminWhoAmIOutputSchema>;

// ---------------------------------------------------------------------------
// Q&A-Modus (Epic 8)
// ---------------------------------------------------------------------------

/** DTO: Eine Q&A-Frage */
export const QaQuestionDTOSchema = z.object({
  id: z.uuid(),
  text: z.string(),
  upvoteCount: z.number(),
  score: z.number().optional(),
  status: QaQuestionStatusEnum,
  createdAt: z.string(),
  authorNickname: z.string().min(1).max(30).optional(),
  positiveVoteCount: z.number().int().min(0).optional(),
  negativeVoteCount: z.number().int().min(0).optional(),
  voteCount: z.number().int().min(0).optional(),
  bestScore: z.number().min(0).max(1).optional(),
  controversyScore: z.number().min(0).max(1).optional(),
  isControversial: z.boolean().optional(),
  /** 'UP' | 'DOWN' | null — aktueller Vote-Status dieses Teilnehmers */
  myVote: z.enum(['UP', 'DOWN']).nullable(),
  /** true wenn die Frage vom aktuellen Teilnehmer stammt */
  isOwn: z.boolean(),
  /** @deprecated – wird durch myVote ersetzt */
  hasUpvoted: z.boolean(),
});
export type QaQuestionDTO = z.infer<typeof QaQuestionDTOSchema>;

export const QaQuestionsListDTOSchema = z.array(QaQuestionDTOSchema);
export type QaQuestionsListDTO = z.infer<typeof QaQuestionsListDTOSchema>;

export const GetQaQuestionsInputSchema = z.object({
  sessionId: z.uuid(),
  participantId: z.uuid().optional(),
  moderatorView: z.boolean().optional().default(false),
  sort: QaQuestionSortModeEnum.optional().default('TOP'),
});
export type GetQaQuestionsInput = z.infer<typeof GetQaQuestionsInputSchema>;

/** Input: Q&A-Frage einreichen (Story 8.2) */
export const SubmitQaQuestionInputSchema = z.object({
  sessionId: z.uuid(),
  participantId: z.uuid(),
  text: z.string().min(1).max(500),
});
export type SubmitQaQuestionInput = z.infer<typeof SubmitQaQuestionInputSchema>;

/** Input: Q&A-Frage upvoten (Story 8.3) – Legacy */
export const UpvoteQaQuestionInputSchema = z.object({
  questionId: z.uuid(),
  participantId: z.uuid(),
});
export type UpvoteQaQuestionInput = z.infer<typeof UpvoteQaQuestionInputSchema>;

export const ToggleQaUpvoteOutputSchema = z.object({
  questionId: z.uuid(),
  upvoted: z.boolean(),
  upvoteCount: z.number(),
});
export type ToggleQaUpvoteOutput = z.infer<typeof ToggleQaUpvoteOutputSchema>;

/** Input: Q&A-Frage voten (UP / DOWN / toggle-off) */
export const QaVoteInputSchema = z.object({
  questionId: z.uuid(),
  participantId: z.uuid(),
  direction: z.enum(['UP', 'DOWN']),
});
export type QaVoteInput = z.infer<typeof QaVoteInputSchema>;

export const QaVoteOutputSchema = z.object({
  questionId: z.uuid(),
  myVote: z.enum(['UP', 'DOWN']).nullable(),
  upvoteCount: z.number(),
});
export type QaVoteOutput = z.infer<typeof QaVoteOutputSchema>;

/** Input: Q&A-Moderation an/aus toggeln (Host) */
export const ToggleQaModerationInputSchema = z.object({
  sessionCode: z.string().trim().min(6).max(6),
  enabled: z.boolean(),
});
export type ToggleQaModerationInput = z.infer<typeof ToggleQaModerationInputSchema>;

export const ModerateQaQuestionActionEnum = z.enum([
  'APPROVE',
  'PIN',
  'UNPIN',
  'ARCHIVE',
  'DELETE',
]);
export type ModerateQaQuestionAction = z.infer<typeof ModerateQaQuestionActionEnum>;

export const ModerateQaQuestionInputSchema = z.object({
  sessionCode: z.string().trim().min(6).max(6),
  questionId: z.uuid(),
  action: ModerateQaQuestionActionEnum,
});
export type ModerateQaQuestionInput = z.infer<typeof ModerateQaQuestionInputSchema>;

// ---------------------------------------------------------------------------
// SC-Schnellformate (Story 1.12) — clientseitig angewandt
// ---------------------------------------------------------------------------

/** Verfügbare Single-Choice-Schnellformate */
export const ScFormatEnum = z.enum([
  'YES_NO',
  'YES_NO_MAYBE',
  'YES_NO_DONT_KNOW',
  'TRUE_FALSE',
  'ABCD',
]);
export type ScFormat = z.infer<typeof ScFormatEnum>;

/** Vorkonfigurierte Antwortoptionen pro SC-Format (Texte werden bei i18n lokalisiert) */
export const SC_FORMAT_PRESETS: Record<ScFormat, { label: string; answers: string[] }> = {
  YES_NO: { label: 'Ja / Nein', answers: ['Ja', 'Nein'] },
  YES_NO_MAYBE: { label: 'Ja / Nein / Vielleicht', answers: ['Ja', 'Nein', 'Vielleicht'] },
  YES_NO_DONT_KNOW: { label: 'Ja / Nein / Weiß nicht', answers: ['Ja', 'Nein', 'Weiß nicht'] },
  TRUE_FALSE: { label: 'Wahr / Falsch', answers: ['Wahr', 'Falsch'] },
  ABCD: { label: 'A / B / C / D', answers: ['A', 'B', 'C', 'D'] },
};

/** Preset-Konfigurationen (Story 1.11) — clientseitig angewandt */
export const QUIZ_PRESETS: Record<QuizPreset, Partial<CreateQuizInput>> = {
  PLAYFUL: {
    showLeaderboard: true,
    enableSoundEffects: true,
    enableRewardEffects: true,
    enableMotivationMessages: true,
    enableEmojiReactions: true,
    showQuestionTypeIndicators: true,
    anonymousMode: false,
    allowCustomNicknames: false,
    nicknameTheme: 'HIGH_SCHOOL',
    defaultTimer: DEFAULT_TIMER_SECONDS,
    timerScaleByDifficulty: true,
    readingPhaseEnabled: false, // Story 2.6: Schnelles Spieltempo
  },
  SERIOUS: {
    showLeaderboard: false,
    enableSoundEffects: false,
    enableRewardEffects: false,
    enableMotivationMessages: false,
    enableEmojiReactions: false,
    showQuestionTypeIndicators: true,
    /** Pseudonyme aus Themenliste (Oberstufe), nicht reiner Anonym-Modus */
    anonymousMode: false,
    allowCustomNicknames: false,
    nicknameTheme: 'HIGH_SCHOOL',
    defaultTimer: null, // Offene Antwortphase (kein Countdown)
    timerScaleByDifficulty: true,
    readingPhaseEnabled: true, // Story 2.6: Frage zuerst lesen
  },
};

// ---------------------------------------------------------------------------
// Preset-Export / Import (Story 1.15)
// ---------------------------------------------------------------------------

/** Aktuelle Export-Schema-Version für Preset-Dateien */
export const PRESET_EXPORT_VERSION = 1;

export const NameModeEnum = z.enum(['nicknameTheme', 'allowCustomNicknames', 'anonymousMode']);
export type NameMode = z.infer<typeof NameModeEnum>;

export const PresetStorageEntrySchema = z.object({
  options: z.record(z.string(), z.boolean()),
  nameMode: NameModeEnum,
  nicknameThemeValue: NicknameThemeEnum,
  teamCountValue: z.number().int().min(2).max(8),
});
export type PresetStorageEntry = z.infer<typeof PresetStorageEntrySchema>;

export const PresetConfigExportSchema = z.object({
  presetExportVersion: z.number().int().min(1),
  exportedAt: z.string(), // ISO-8601
  activePreset: z.enum(['serious', 'spielerisch']),
  theme: z.enum(['system', 'dark', 'light']),
  presets: z.object({
    serious: PresetStorageEntrySchema,
    spielerisch: PresetStorageEntrySchema,
  }),
});
export type PresetConfigExport = z.infer<typeof PresetConfigExportSchema>;

// ---------------------------------------------------------------------------
// Quick-Feedback (One-Shot-Feedback)
// ---------------------------------------------------------------------------

export const QuickFeedbackTypeEnum = z.enum([
  'MOOD',
  'YESNO',
  'YESNO_BINARY',
  'TRUEFALSE_UNKNOWN',
  'STARS',
  'ABCD',
  'TEMPO',
]);
export type QuickFeedbackType = z.infer<typeof QuickFeedbackTypeEnum>;

export const MoodValueEnum = z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']);
export type MoodValue = z.infer<typeof MoodValueEnum>;

export const AbcdValueEnum = z.enum(['A', 'B', 'C', 'D']);
export type AbcdValue = z.infer<typeof AbcdValueEnum>;

export const YesNoValueEnum = z.enum(['YES', 'NO', 'MAYBE']);
export type YesNoValue = z.infer<typeof YesNoValueEnum>;

export const YesNoBinaryValueEnum = z.enum(['YES', 'NO']);
export type YesNoBinaryValue = z.infer<typeof YesNoBinaryValueEnum>;

export const TrueFalseUnknownValueEnum = z.enum(['TRUE', 'FALSE', 'UNKNOWN']);
export type TrueFalseUnknownValue = z.infer<typeof TrueFalseUnknownValueEnum>;

export const StarsValueEnum = z.enum(['1', '2', '3', '4', '5']);
export type StarsValue = z.infer<typeof StarsValueEnum>;

export const TempoValueEnum = z.enum(['SPEED_UP', 'FOLLOWING', 'SLOW_DOWN', 'LOST']);
export type TempoValue = z.infer<typeof TempoValueEnum>;

export const TempoTrendStatusEnum = z.enum([
  'NEUTRAL',
  'FOLLOWING',
  'TOO_FAST',
  'LOST',
  'TOO_SLOW',
  'HETEROGENEOUS',
]);
export type TempoTrendStatus = z.infer<typeof TempoTrendStatusEnum>;

export const TempoTrendSchema = z.object({
  status: TempoTrendStatusEnum,
  active: z.boolean(),
  activeParticipants: z.number().int().nonnegative(),
  tempoVotes: z.number().int().nonnegative(),
  requiredVotes: z.number().int().nonnegative(),
  windowSeconds: z.number().int().positive(),
  bucketSeconds: z.number().int().positive(),
  /** True when the trend signal is backed by a clear margin or two consistent buckets.
   * False for HETEROGENEOUS that results from a margin fallback (signal still unclear). */
  marginMet: z.boolean().optional(),
});
export type TempoTrend = z.infer<typeof TempoTrendSchema>;

export const CreateQuickFeedbackInputSchema = z.object({
  type: QuickFeedbackTypeEnum,
  sessionCode: z.string().trim().length(6).optional(),
});
export type CreateQuickFeedbackInput = z.infer<typeof CreateQuickFeedbackInputSchema>;

export const UpdateQuickFeedbackTypeInputSchema = z.object({
  sessionCode: z.string().trim().length(6),
  type: QuickFeedbackTypeEnum,
});
export type UpdateQuickFeedbackTypeInput = z.infer<typeof UpdateQuickFeedbackTypeInputSchema>;

export const CreateQuickFeedbackOutputSchema = z.object({
  feedbackId: z.string(),
  sessionCode: z.string(),
  hostToken: z.string().min(1).nullable(),
});
export type CreateQuickFeedbackOutput = z.infer<typeof CreateQuickFeedbackOutputSchema>;

export const QuickFeedbackVoteInputSchema = z.object({
  sessionCode: z.string(),
  voterId: z.string().uuid(),
  value: z.string(),
});
export type QuickFeedbackVoteInput = z.infer<typeof QuickFeedbackVoteInputSchema>;

/** Nur Redis-EXISTS – kein 404, damit Probes (z. B. Home „Letzte Sessions“) keine Konsolen-Fehler erzeugen. */
export const QuickFeedbackIsActiveOutputSchema = z.object({ active: z.boolean() });
export type QuickFeedbackIsActiveOutput = z.infer<typeof QuickFeedbackIsActiveOutputSchema>;

export const QuickFeedbackResultSchema = z.object({
  type: QuickFeedbackTypeEnum,
  locked: z.boolean(),
  totalVotes: z.number(),
  distribution: z.record(z.string(), z.number()),
  currentRound: z.number().int().min(1).max(2).optional(),
  discussion: z.boolean().optional(),
  round1Distribution: z.record(z.string(), z.number()).optional(),
  round1Total: z.number().int().optional(),
  opinionShift: OpinionShiftSchema.optional(),
  tempoTrend: TempoTrendSchema.optional(),
});
export type QuickFeedbackResult = z.infer<typeof QuickFeedbackResultSchema>;

// ─── Session-Bewertung (Story 4.8) ───────────────────────────────────────────

export const SubmitSessionFeedbackInputSchema = z.object({
  code: z.string().length(6),
  participantId: z.string().uuid(),
  overallRating: z.number().int().min(1).max(5),
  questionQualityRating: z.number().int().min(1).max(5).optional(),
  wouldRepeat: z.boolean().optional(),
});
export type SubmitSessionFeedbackInput = z.infer<typeof SubmitSessionFeedbackInputSchema>;

/** Letztes Session-Feedback zu einer Server-Quiz-ID (Quiz-Sammlung; gleicher Scope wie getBonusTokensForQuiz). */
export const GetLastSessionFeedbackForQuizInputSchema = GetBonusTokensForQuizInputSchema;
export type GetLastSessionFeedbackForQuizInput = z.infer<
  typeof GetLastSessionFeedbackForQuizInputSchema
>;

export const LastSessionFeedbackForQuizDTOSchema = z.object({
  endedAt: z.string().nullable(),
  summary: SessionFeedbackSummarySchema,
});
export type LastSessionFeedbackForQuizDTO = z.infer<typeof LastSessionFeedbackForQuizDTOSchema>;

export const LastSessionFeedbackForQuizOutputSchema =
  LastSessionFeedbackForQuizDTOSchema.nullable();
export type LastSessionFeedbackForQuizOutput = z.infer<
  typeof LastSessionFeedbackForQuizOutputSchema
>;

/** Letzte beendete Session eines Quizzes: aggregierte didaktische Auswertung ohne Session-Kennung. */
export const GetLastSessionAnalysisForQuizInputSchema = GetBonusTokensForQuizInputSchema;
export type GetLastSessionAnalysisForQuizInput = z.infer<
  typeof GetLastSessionAnalysisForQuizInputSchema
>;

export const LastSessionAnalysisForQuizDTOSchema = z.object({
  endedAt: z.string().nullable(),
  participantCount: z.number().int().min(0),
  confidenceSummary: SessionConfidenceSummaryDTOSchema.nullable(),
  feedbackSummary: SessionFeedbackSummarySchema.nullable(),
});
export type LastSessionAnalysisForQuizDTO = z.infer<typeof LastSessionAnalysisForQuizDTOSchema>;

export const LastSessionAnalysisForQuizOutputSchema =
  LastSessionAnalysisForQuizDTOSchema.nullable();
export type LastSessionAnalysisForQuizOutput = z.infer<
  typeof LastSessionAnalysisForQuizOutputSchema
>;

/** Input: Export-Daten der zuletzt beendeten Session eines Quizzes (Quiz-Sammlung). */
export const GetLastSessionExportDataForQuizInputSchema = GetBonusTokensForQuizInputSchema;
export type GetLastSessionExportDataForQuizInput = z.infer<
  typeof GetLastSessionExportDataForQuizInputSchema
>;

/** Input: PDF-Export der zuletzt beendeten Session eines Quizzes (Quiz-Sammlung). */
export const GetLastSessionExportPdfForQuizInputSchema = GetBonusTokensForQuizInputSchema.extend({
  localeId: z.string().min(2).max(10).optional(),
});
export type GetLastSessionExportPdfForQuizInput = z.infer<
  typeof GetLastSessionExportPdfForQuizInputSchema
>;

// ─── MOTD / Plattform-Kommunikation (Epic 10) ───────────────────────────────

/** UI-Locales (ADR-0008) — synchron mit Angular-Builds */
export const AppLocaleEnum = z.enum(['de', 'en', 'fr', 'es', 'it']);
export type AppLocale = z.infer<typeof AppLocaleEnum>;

/** Fallback-Kette wenn Übersetzung fehlt: angefragte Locale → de → en → rest */
export const MOTD_LOCALE_FALLBACK_ORDER: AppLocale[] = ['de', 'en', 'fr', 'es', 'it'];

export const MotdStatusEnum = z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']);
export type MotdStatus = z.infer<typeof MotdStatusEnum>;

export const MotdAuditActionEnum = z.enum([
  'MOTD_CREATE',
  'MOTD_UPDATE',
  'MOTD_DELETE',
  'MOTD_PUBLISH',
  'MOTD_ARCHIVE_VISIBILITY',
  'MOTD_TEMPLATE_CREATE',
  'MOTD_TEMPLATE_UPDATE',
  'MOTD_TEMPLATE_DELETE',
]);
export type MotdAuditAction = z.infer<typeof MotdAuditActionEnum>;

export const MotdInteractionKindEnum = z.enum([
  'ACK',
  'THUMB_UP',
  'THUMB_DOWN',
  /** Daumen hoch-Zähler −1 (min. 0); Korrektur nach Fehlklick */
  'THUMB_UP_REVOKE',
  /** Daumen runter-Zähler −1 (min. 0) */
  'THUMB_DOWN_REVOKE',
  /** Von Daumen hoch zu runter wechseln (eine Server-Transaktion) */
  'THUMB_SWITCH_UP_TO_DOWN',
  /** Von Daumen runter zu hoch wechseln */
  'THUMB_SWITCH_DOWN_TO_UP',
  'DISMISS_CLOSE',
  'DISMISS_SWIPE',
]);
export type MotdInteractionKind = z.infer<typeof MotdInteractionKindEnum>;

/** Max. Markdown-Länge pro Sprache (Schutz vor Abuse) */
export const MOTD_MARKDOWN_MAX_LENGTH = 16000;

const motdMarkdownField = z.string().max(MOTD_MARKDOWN_MAX_LENGTH);

export const MotdLocaleBodiesSchema = z.object({
  de: motdMarkdownField.optional().default(''),
  en: motdMarkdownField.optional().default(''),
  fr: motdMarkdownField.optional().default(''),
  es: motdMarkdownField.optional().default(''),
  it: motdMarkdownField.optional().default(''),
});
export type MotdLocaleBodies = z.infer<typeof MotdLocaleBodiesSchema>;

/** Öffentlich: aktive oder Archiv-MOTD (nur aufgelöster Markdown, kein HTML vom Server) */
export const MotdPublicDTOSchema = z.object({
  id: z.uuid(),
  contentVersion: z.number().int().min(1),
  markdown: z.string(),
  endsAt: z.string(),
});
export type MotdPublicDTO = z.infer<typeof MotdPublicDTOSchema>;

/** Lokal als gelesen/dismissed markierte Overlay-MOTD (pro ID max. bestätigte `contentVersion`). */
export const MotdOverlayDismissedPairSchema = z.object({
  motdId: z.string().uuid(),
  contentVersion: z.number().int().min(1),
});
export type MotdOverlayDismissedPair = z.infer<typeof MotdOverlayDismissedPairSchema>;

/**
 * tRPC-HTTP kann ohne Transformer bei Batch/Prefetch ein fehlendes `input` liefern (`undefined`).
 * `locale` ist optional; der Server leitet sie aus `Accept-Language` ab (s. Backend).
 */
const MotdGetCurrentInputPayloadSchema = z.object({
  locale: AppLocaleEnum.optional(),
  overlayDismissedUpTo: z.array(MotdOverlayDismissedPairSchema).max(32).optional(),
});

export const MotdGetCurrentInputSchema = z.preprocess(
  (raw: unknown) => (raw === undefined || raw === null ? {} : raw),
  MotdGetCurrentInputPayloadSchema,
);
export type MotdGetCurrentInput = z.infer<typeof MotdGetCurrentInputPayloadSchema>;

export const MotdGetCurrentOutputSchema = z.object({
  motd: MotdPublicDTOSchema.nullable(),
});
export type MotdGetCurrentOutput = z.infer<typeof MotdGetCurrentOutputSchema>;

const MotdListArchiveInputPayloadSchema = z.object({
  locale: AppLocaleEnum.optional(),
  cursor: z.string().uuid().optional(),
  pageSize: z.number().int().min(1).max(50).default(20),
});

export const MotdListArchiveInputSchema = z.preprocess(
  (raw: unknown) => (raw === undefined || raw === null ? {} : raw),
  MotdListArchiveInputPayloadSchema,
);
export type MotdListArchiveInput = z.infer<typeof MotdListArchiveInputPayloadSchema>;

export const MotdArchiveItemDTOSchema = z.object({
  id: z.uuid(),
  contentVersion: z.number().int().min(1),
  markdown: z.string(),
  /** Veröffentlichungs-/Startzeitpunkt (Anzeige im Archiv). */
  startsAt: z.string(),
  endsAt: z.string(),
});
export type MotdArchiveItemDTO = z.infer<typeof MotdArchiveItemDTOSchema>;

export const MotdListArchiveOutputSchema = z.object({
  items: z.array(MotdArchiveItemDTOSchema),
  nextCursor: z.uuid().nullable(),
});
export type MotdListArchiveOutput = z.infer<typeof MotdListArchiveOutputSchema>;

/** Header: ob Nachrichten-Icon sinnvoll ist */
const MotdHeaderStateInputPayloadSchema = z.object({
  locale: AppLocaleEnum.optional(),
  /** Client-Wasserzeichen: MOTDs mit späterem `endsAt` gelten als ungelesen (globales Archiv). */
  archiveSeenUpToEndsAtIso: z.string().optional(),
  overlayDismissedUpTo: z.array(MotdOverlayDismissedPairSchema).max(32).optional(),
});

export const MotdHeaderStateInputSchema = z.preprocess(
  (raw: unknown) => (raw === undefined || raw === null ? {} : raw),
  MotdHeaderStateInputPayloadSchema,
);
export type MotdHeaderStateInput = z.infer<typeof MotdHeaderStateInputPayloadSchema>;

export const MotdHeaderStateOutputSchema = z.object({
  hasActiveOverlay: z.boolean(),
  hasArchiveEntries: z.boolean(),
  /** Anzahl MOTDs, die ins Nutzer-Archiv zählen (gleiche Filterlogik wie listArchive, ohne leere Markdown-Fallbacks). */
  archiveCount: z.number().int().min(0),
  /** Spätestes Archiv-Ende (ISO); null wenn kein Eintrag. Für „Alles als gelesen“ auf dem Client. */
  archiveMaxEndsAtIso: z.string().nullable(),
  /** Ungelesen relativ zu `archiveSeenUpToEndsAtIso`; ohne gültiges Wasserzeichen = `archiveCount`. */
  archiveUnreadCount: z.number().int().min(0),
});
export type MotdHeaderStateOutput = z.infer<typeof MotdHeaderStateOutputSchema>;

export const MotdRecordInteractionInputSchema = z.object({
  motdId: z.uuid(),
  contentVersion: z.number().int().min(1),
  kind: MotdInteractionKindEnum,
});
export type MotdRecordInteractionInput = z.infer<typeof MotdRecordInteractionInputSchema>;

export const MotdRecordInteractionOutputSchema = z.object({ ok: z.literal(true) });
export type MotdRecordInteractionOutput = z.infer<typeof MotdRecordInteractionOutputSchema>;

// --- Admin: Templates ---

export const AdminMotdTemplateListItemDTOSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  updatedAt: z.string(),
});
export type AdminMotdTemplateListItemDTO = z.infer<typeof AdminMotdTemplateListItemDTOSchema>;

export const AdminMotdTemplateDTOSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  markdownDe: z.string(),
  markdownEn: z.string(),
  markdownFr: z.string(),
  markdownEs: z.string(),
  markdownIt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdminMotdTemplateDTO = z.infer<typeof AdminMotdTemplateDTOSchema>;

export const AdminMotdTemplateCreateInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  markdownDe: motdMarkdownField.optional().default(''),
  markdownEn: motdMarkdownField.optional().default(''),
  markdownFr: motdMarkdownField.optional().default(''),
  markdownEs: motdMarkdownField.optional().default(''),
  markdownIt: motdMarkdownField.optional().default(''),
});
export type AdminMotdTemplateCreateInput = z.infer<typeof AdminMotdTemplateCreateInputSchema>;

export const AdminMotdTemplateUpdateInputSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  markdownDe: motdMarkdownField.optional(),
  markdownEn: motdMarkdownField.optional(),
  markdownFr: motdMarkdownField.optional(),
  markdownEs: motdMarkdownField.optional(),
  markdownIt: motdMarkdownField.optional(),
});
export type AdminMotdTemplateUpdateInput = z.infer<typeof AdminMotdTemplateUpdateInputSchema>;

// --- Admin: MOTDs ---

/** Aggregierte Nutzerreaktionen auf eine MOTD (Epic 10, öffentliches recordInteraction). */
export const AdminMotdInteractionStatsSchema = z.object({
  ackCount: z.number().int().nonnegative(),
  thumbUp: z.number().int().nonnegative(),
  thumbDown: z.number().int().nonnegative(),
  dismissClose: z.number().int().nonnegative(),
  dismissSwipe: z.number().int().nonnegative(),
});
export type AdminMotdInteractionStats = z.infer<typeof AdminMotdInteractionStatsSchema>;

export const AdminMotdListItemDTOSchema = z.object({
  id: z.uuid(),
  status: MotdStatusEnum,
  priority: z.number().int(),
  startsAt: z.string(),
  endsAt: z.string(),
  visibleInArchive: z.boolean(),
  contentVersion: z.number().int(),
  templateId: z.uuid().nullable(),
  updatedAt: z.string(),
  interaction: AdminMotdInteractionStatsSchema,
});
export type AdminMotdListItemDTO = z.infer<typeof AdminMotdListItemDTOSchema>;

export const AdminMotdDetailDTOSchema = z.object({
  id: z.uuid(),
  status: MotdStatusEnum,
  priority: z.number().int(),
  startsAt: z.string(),
  endsAt: z.string(),
  visibleInArchive: z.boolean(),
  contentVersion: z.number().int(),
  templateId: z.uuid().nullable(),
  locales: MotdLocaleBodiesSchema,
  interaction: AdminMotdInteractionStatsSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdminMotdDetailDTO = z.infer<typeof AdminMotdDetailDTOSchema>;

export const AdminMotdCreateInputSchema = z.object({
  status: MotdStatusEnum.default('DRAFT'),
  priority: z.number().int().min(0).max(1_000_000).default(0),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  visibleInArchive: z.boolean().default(false),
  templateId: z.uuid().optional().nullable(),
  locales: MotdLocaleBodiesSchema,
});
export type AdminMotdCreateInput = z.infer<typeof AdminMotdCreateInputSchema>;

export const AdminMotdUpdateInputSchema = z.object({
  id: z.uuid(),
  status: MotdStatusEnum.optional(),
  priority: z.number().int().min(0).max(1_000_000).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  visibleInArchive: z.boolean().optional(),
  templateId: z.uuid().optional().nullable(),
  locales: MotdLocaleBodiesSchema.optional(),
});
export type AdminMotdUpdateInput = z.infer<typeof AdminMotdUpdateInputSchema>;

export const AdminMotdIdInputSchema = z.object({ id: z.uuid() });
export type AdminMotdIdInput = z.infer<typeof AdminMotdIdInputSchema>;

export const AdminMotdTemplateListOutputSchema = z.array(AdminMotdTemplateListItemDTOSchema);
export const AdminMotdListOutputSchema = z.array(AdminMotdListItemDTOSchema);

// ---------------------------------------------------------------------------
// Numerische Schätzfrage – Shared Utility (Story 1.2d)
// ---------------------------------------------------------------------------

/**
 * Berechnet das effektive Toleranzintervall [left, right] für eine NUMERIC_ESTIMATE-Frage.
 * Gibt null zurück, wenn die Konfiguration ungültig ist (V=0 im RELATIVE-Modus, L >= R).
 */
export function resolveNumericTolerance(
  mode: NumericEstimateToleranceMode,
  opts: {
    referenceValue?: number | null;
    tolerancePercent?: number | null;
    intervalLeft?: number | null;
    intervalRight?: number | null;
  },
): { left: number; right: number } | null {
  if (mode === 'RELATIVE_PERCENT') {
    const v = opts.referenceValue;
    const p = opts.tolerancePercent;
    if (v === null || v === undefined || p === null || p === undefined) return null;
    if (v === 0) return null; // Sonderfall: relativer Modus bei V=0 nicht definiert
    const delta = Math.abs(v) * (p / 100);
    const left = Math.min(v - delta, v + delta);
    const right = Math.max(v - delta, v + delta);
    return { left, right };
  }
  // ABSOLUTE_INTERVAL
  const l = opts.intervalLeft;
  const r = opts.intervalRight;
  if (l === null || l === undefined || r === null || r === undefined) return null;
  if (l >= r) return null;
  return { left: l, right: r };
}

/**
 * Prüft, ob ein numerischer Wert höchstens die erlaubte Anzahl Nachkommastellen hat.
 * Bewertet den Zahlenwert selbst, damit Exponentialnotation wie 1e-7 nicht die
 * serverseitige Dezimalstellenbegrenzung umgehen kann.
 */
export function hasAtMostNumericDecimalPlaces(value: number, maxDecimalPlaces: number): boolean {
  if (!Number.isFinite(value)) return false;
  if (!Number.isInteger(maxDecimalPlaces) || maxDecimalPlaces < 0) return false;
  if (Number.isInteger(value)) return true;

  const factor = 10 ** maxDecimalPlaces;
  const scaled = value * factor;
  if (!Number.isFinite(scaled)) return false;
  const nearestInteger = Math.round(scaled);
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled));
  return Math.abs(scaled - nearestInteger) <= tolerance;
}

/**
 * Normalisiert eine numerische Eingabe (Komma → Punkt, Leerzeichen entfernen).
 * Gibt null zurück wenn nicht parsebar oder zu viele Dezimalstellen.
 */
export function parseNumericInput(
  raw: string,
  opts: { inputType: NumericInputType; maxDecimalPlaces?: number | null },
): number | null {
  const normalized = raw.trim().replace(/\s+/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  if (!isFinite(n)) return null;
  if (opts.inputType === 'INTEGER') {
    if (!Number.isInteger(n)) return null;
  } else if (opts.maxDecimalPlaces !== null && opts.maxDecimalPlaces !== undefined) {
    const decimalPart = normalized.includes('.') ? (normalized.split('.')[1] ?? '') : '';
    if (decimalPart.length > opts.maxDecimalPlaces) return null;
  }
  return n;
}

/**
 * Prüft, ob ein numerischer Wert innerhalb des Toleranzintervalls liegt (inklusive Grenzen).
 */
export function isNumericValueInBand(
  value: number,
  band: { left: number; right: number },
): boolean {
  return value >= band.left && value <= band.right;
}
