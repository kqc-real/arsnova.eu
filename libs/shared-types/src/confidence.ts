/**
 * Story 1.2i: Sicherheitsgrad / Confidence Slider – Konstanten und Aggregation.
 */

export const CONFIDENCE_SCALE_MIN = 1;
export const CONFIDENCE_SCALE_MAX = 5;
export const CONFIDENCE_LOW_MAX = 2;
export const CONFIDENCE_HIGH_MIN = 4;

export const CONFIDENCE_ELIGIBLE_QUESTION_TYPES = [
  'MULTIPLE_CHOICE',
  'SINGLE_CHOICE',
  'SHORT_TEXT',
  'NUMERIC_ESTIMATE',
] as const;

export type ConfidenceEligibleQuestionType = (typeof CONFIDENCE_ELIGIBLE_QUESTION_TYPES)[number];

export type ConfidenceTier = 'low' | 'mid' | 'high';

export type ConfidenceDistribution = Record<'1' | '2' | '3' | '4' | '5', number>;

export interface ConfidenceCrossTab {
  correctHigh: number;
  correctMid: number;
  correctLow: number;
  incorrectHigh: number;
  incorrectMid: number;
  incorrectLow: number;
}

export interface ConfidenceWrongOptionCount {
  answerId: string;
  text: string;
  count: number;
}

export interface ConfidenceVoteRecord {
  confidenceValue: number | null | undefined;
  isCorrect: boolean | null | undefined;
  selectedAnswerIds?: string[];
}

export interface ConfidenceAnswerOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface BuildConfidenceResultInput {
  votes: ConfidenceVoteRecord[];
  answerOptions?: ConfidenceAnswerOption[];
}

export interface ConfidenceResult {
  distribution: ConfidenceDistribution;
  crossTab: ConfidenceCrossTab;
  highConfidenceWrongCount: number;
  highConfidenceWrongOptions?: ConfidenceWrongOptionCount[];
}

export function questionSupportsConfidence(type: string): boolean {
  return (CONFIDENCE_ELIGIBLE_QUESTION_TYPES as readonly string[]).includes(type);
}

export function isConfidenceScaleValue(value: number): boolean {
  return Number.isInteger(value) && value >= CONFIDENCE_SCALE_MIN && value <= CONFIDENCE_SCALE_MAX;
}

export function classifyConfidenceTier(value: number): ConfidenceTier {
  if (value <= CONFIDENCE_LOW_MAX) {
    return 'low';
  }
  if (value >= CONFIDENCE_HIGH_MIN) {
    return 'high';
  }
  return 'mid';
}

function createEmptyConfidenceDistribution(): ConfidenceDistribution {
  return { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
}

function createEmptyConfidenceCrossTab(): ConfidenceCrossTab {
  return {
    correctHigh: 0,
    correctMid: 0,
    correctLow: 0,
    incorrectHigh: 0,
    incorrectMid: 0,
    incorrectLow: 0,
  };
}

function incrementCrossTab(
  crossTab: ConfidenceCrossTab,
  isCorrect: boolean,
  tier: ConfidenceTier,
): void {
  if (isCorrect) {
    if (tier === 'high') crossTab.correctHigh += 1;
    else if (tier === 'mid') crossTab.correctMid += 1;
    else crossTab.correctLow += 1;
    return;
  }

  if (tier === 'high') crossTab.incorrectHigh += 1;
  else if (tier === 'mid') crossTab.incorrectMid += 1;
  else crossTab.incorrectLow += 1;
}

export function buildConfidenceResult(input: BuildConfidenceResultInput): ConfidenceResult | null {
  const votesWithConfidence = input.votes.filter(
    (vote): vote is ConfidenceVoteRecord & { confidenceValue: number } =>
      isConfidenceScaleValue(vote.confidenceValue ?? Number.NaN),
  );

  if (votesWithConfidence.length === 0) {
    return null;
  }

  const distribution = createEmptyConfidenceDistribution();
  const crossTab = createEmptyConfidenceCrossTab();
  const wrongOptionCounts = new Map<string, { text: string; count: number }>();

  for (const vote of votesWithConfidence) {
    const confidenceValue = vote.confidenceValue;
    const key = String(confidenceValue) as keyof ConfidenceDistribution;
    distribution[key] += 1;

    const tier = classifyConfidenceTier(confidenceValue);
    const isCorrect = vote.isCorrect === true;
    incrementCrossTab(crossTab, isCorrect, tier);

    if (!isCorrect && tier === 'high' && vote.selectedAnswerIds?.length) {
      for (const answerId of vote.selectedAnswerIds) {
        const option = input.answerOptions?.find((entry) => entry.id === answerId);
        if (!option || option.isCorrect) {
          continue;
        }
        const current = wrongOptionCounts.get(answerId) ?? { text: option.text, count: 0 };
        current.count += 1;
        wrongOptionCounts.set(answerId, current);
      }
    }
  }

  const highConfidenceWrongOptions =
    wrongOptionCounts.size > 0
      ? [...wrongOptionCounts.entries()]
          .map(([answerId, entry]) => ({
            answerId,
            text: entry.text,
            count: entry.count,
          }))
          .sort((left, right) => right.count - left.count || left.text.localeCompare(right.text))
      : undefined;

  return {
    distribution,
    crossTab,
    highConfidenceWrongCount: crossTab.incorrectHigh,
    ...(highConfidenceWrongOptions ? { highConfidenceWrongOptions } : {}),
  };
}
