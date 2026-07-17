/**
 * Story 1.2i: Sicherheitsgrad / Confidence Slider – Konstanten und Aggregation.
 */

export const CONFIDENCE_SCALE_MIN = 1;
export const CONFIDENCE_SCALE_MAX = 5;
export const CONFIDENCE_LOW_MAX = 2;
export const CONFIDENCE_HIGH_MIN = 4;
export const CONFIDENCE_SUMMARY_MIN_RESPONSES = 5;

export const CONFIDENCE_ELIGIBLE_QUESTION_TYPES = [
  'MULTIPLE_CHOICE',
  'SINGLE_CHOICE',
  'SHORT_TEXT',
  'NUMERIC_ESTIMATE',
] as const;

export type ConfidenceEligibleQuestionType = (typeof CONFIDENCE_ELIGIBLE_QUESTION_TYPES)[number];

export type EffectiveAggregationRound = 1 | 2;

export interface EffectiveAggregationRoundInfo {
  effectiveRound: EffectiveAggregationRound;
  round1Count: number;
  round2Count: number;
}

/** Effective-Vote-Regel (ADR-0028): Runde 2 ersetzt Runde 1, sobald Runde-2-Votes existieren. */
export function resolveEffectiveAggregationRound(
  votes: ReadonlyArray<{ round?: number | null }>,
): EffectiveAggregationRoundInfo {
  let round1Count = 0;
  let round2Count = 0;
  for (const vote of votes) {
    const round = vote.round ?? 1;
    if (round === 2) {
      round2Count += 1;
    } else {
      round1Count += 1;
    }
  }
  return {
    effectiveRound: round2Count > 0 ? 2 : 1,
    round1Count,
    round2Count,
  };
}

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
  /** Bei MC: richtige Optionen, die bei selbstsicher falschen Antworten ausgelassen wurden. */
  highConfidenceOmittedCorrectOptions?: ConfidenceWrongOptionCount[];
}

export interface ConfidenceQuestionSummary {
  questionOrder: number;
  questionTextShort: string;
  questionType: ConfidenceEligibleQuestionType;
  responseCount: number;
  result: ConfidenceResult;
}

export interface SessionConfidenceSummary {
  responseCount: number;
  includedQuestionCount: number;
  suppressedQuestionCount: number;
  /** Fragen mit mindestens einer falschen Antwort bei hoher Sicherheit. */
  signalQuestionCount?: number;
  /** Fragen oberhalb der Schwelle für eine empfohlene Nachbesprechung. */
  priorityQuestionCount: number;
  distribution: ConfidenceDistribution;
  crossTab: ConfidenceCrossTab;
  highConfidenceWrongCount: number;
  questions: ConfidenceQuestionSummary[];
}

export interface BuildSessionConfidenceSummaryInput {
  questions: Array<{
    questionOrder: number;
    questionTextShort: string;
    questionType: ConfidenceEligibleQuestionType;
    result: ConfidenceResult | null | undefined;
  }>;
  minResponses?: number;
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
  const omittedCorrectCounts = new Map<string, { text: string; count: number }>();

  for (const vote of votesWithConfidence) {
    const confidenceValue = vote.confidenceValue;
    const key = String(confidenceValue) as keyof ConfidenceDistribution;
    distribution[key] += 1;

    const tier = classifyConfidenceTier(confidenceValue);
    const isCorrect = vote.isCorrect === true;
    incrementCrossTab(crossTab, isCorrect, tier);

    if (!isCorrect && tier === 'high') {
      const selected = new Set(vote.selectedAnswerIds ?? []);
      if (selected.size > 0) {
        for (const answerId of selected) {
          const option = input.answerOptions?.find((entry) => entry.id === answerId);
          if (!option || option.isCorrect) {
            continue;
          }
          const current = wrongOptionCounts.get(answerId) ?? { text: option.text, count: 0 };
          current.count += 1;
          wrongOptionCounts.set(answerId, current);
        }
      }
      if (input.answerOptions?.length) {
        for (const option of input.answerOptions) {
          if (!option.isCorrect || selected.has(option.id)) {
            continue;
          }
          const current = omittedCorrectCounts.get(option.id) ?? { text: option.text, count: 0 };
          current.count += 1;
          omittedCorrectCounts.set(option.id, current);
        }
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

  const highConfidenceOmittedCorrectOptions =
    omittedCorrectCounts.size > 0
      ? [...omittedCorrectCounts.entries()]
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
    ...(highConfidenceOmittedCorrectOptions ? { highConfidenceOmittedCorrectOptions } : {}),
  };
}

export function confidenceResultResponseCount(result: ConfidenceResult): number {
  return Object.values(result.distribution).reduce((sum, count) => sum + count, 0);
}

function addConfidenceResult(target: ConfidenceResult, source: ConfidenceResult): void {
  for (const value of ['1', '2', '3', '4', '5'] as const) {
    target.distribution[value] += source.distribution[value];
  }
  for (const key of Object.keys(target.crossTab) as Array<keyof ConfidenceCrossTab>) {
    target.crossTab[key] += source.crossTab[key];
  }
  target.highConfidenceWrongCount += source.highConfidenceWrongCount;
}

function incorrectCount(result: ConfidenceResult): number {
  return (
    result.crossTab.incorrectHigh + result.crossTab.incorrectMid + result.crossTab.incorrectLow
  );
}

export function hasConfidenceMisconceptionRisk(
  question: Pick<ConfidenceQuestionSummary, 'result'>,
): boolean {
  return question.result.crossTab.incorrectHigh > 0;
}

export const CONFIDENCE_DEBRIEF_MIN_RESPONSES = 2;
export const CONFIDENCE_DEBRIEF_MIN_SHARE = 0.1;

/** Robuste Schwelle: mindestens zwei Personen und mindestens zehn Prozent der Antworten. */
export function isConfidenceDebriefRecommended(
  question: Pick<ConfidenceQuestionSummary, 'result' | 'responseCount'>,
): boolean {
  const incorrectHigh = question.result.crossTab.incorrectHigh;
  return (
    incorrectHigh >= CONFIDENCE_DEBRIEF_MIN_RESPONSES &&
    question.responseCount > 0 &&
    incorrectHigh / question.responseCount >= CONFIDENCE_DEBRIEF_MIN_SHARE
  );
}

/** Top-N Fragen mit Nachbesprechungsempfehlung (bereits nach Priorität sortiert erwartet). */
export function selectConfidencePriorityQuestions<
  T extends Pick<ConfidenceQuestionSummary, 'result' | 'responseCount'>,
>(questions: readonly T[], limit = 3): T[] {
  return questions.filter(isConfidenceDebriefRecommended).slice(0, Math.max(0, limit));
}

export function buildSessionConfidenceSummary(
  input: BuildSessionConfidenceSummaryInput,
): SessionConfidenceSummary | null {
  const minResponses = Math.max(
    1,
    Math.floor(input.minResponses ?? CONFIDENCE_SUMMARY_MIN_RESPONSES),
  );
  const aggregate: ConfidenceResult = {
    distribution: createEmptyConfidenceDistribution(),
    crossTab: createEmptyConfidenceCrossTab(),
    highConfidenceWrongCount: 0,
  };
  const questions: ConfidenceQuestionSummary[] = [];
  let suppressedQuestionCount = 0;

  for (const question of input.questions) {
    if (!question.result) continue;
    const responseCount = confidenceResultResponseCount(question.result);
    if (responseCount < minResponses) {
      suppressedQuestionCount += 1;
      continue;
    }
    addConfidenceResult(aggregate, question.result);
    questions.push({
      questionOrder: question.questionOrder,
      questionTextShort: question.questionTextShort,
      questionType: question.questionType,
      responseCount,
      result: question.result,
    });
  }

  if (questions.length === 0) return null;

  questions.sort((left, right) => {
    const highWrongDifference =
      right.result.crossTab.incorrectHigh / right.responseCount -
      left.result.crossTab.incorrectHigh / left.responseCount;
    if (highWrongDifference !== 0) return highWrongDifference;
    const incorrectDifference =
      incorrectCount(right.result) / right.responseCount -
      incorrectCount(left.result) / left.responseCount;
    if (incorrectDifference !== 0) return incorrectDifference;
    return right.responseCount - left.responseCount || left.questionOrder - right.questionOrder;
  });

  return {
    responseCount: confidenceResultResponseCount(aggregate),
    includedQuestionCount: questions.length,
    suppressedQuestionCount,
    signalQuestionCount: questions.filter(hasConfidenceMisconceptionRisk).length,
    priorityQuestionCount: questions.filter(isConfidenceDebriefRecommended).length,
    distribution: aggregate.distribution,
    crossTab: aggregate.crossTab,
    highConfidenceWrongCount: aggregate.highConfidenceWrongCount,
    questions,
  };
}
