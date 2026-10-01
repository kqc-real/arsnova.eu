const NORMALIZED_METRIC_WEIGHT_SCALE = 40;

export const QA_WORD_CLOUD_NORMALIZED_WEIGHT_CAP = 28;

export function getWordCloudWeightFromUpvotes(upvoteCount: number): number {
  if (!Number.isFinite(upvoteCount)) {
    return 1;
  }

  const normalized = Math.max(0, Math.round(upvoteCount));
  return 1 + Math.max(0, Math.round(Math.sqrt(normalized)));
}

export function getWordCloudWeightFromNormalizedMetric(metric: number | null | undefined): number {
  if (!Number.isFinite(metric)) {
    return 1;
  }

  const normalized = Math.max(0, Math.min(1, metric ?? 0));
  return 1 + Math.max(0, Math.round(normalized * normalized * NORMALIZED_METRIC_WEIGHT_SCALE));
}

export function getQaWordCloudQuestionWeight(
  question: {
    readonly upvoteCount: number;
    readonly score?: number;
    readonly bestScore?: number;
    readonly controversyScore?: number;
  },
  metric: 'TOP' | 'BEST' | 'CONTROVERSIAL' | 'TIME' | null | undefined,
): number {
  const fallback = getWordCloudWeightFromUpvotes(question.score ?? question.upvoteCount);
  switch (metric) {
    case 'BEST':
      return question.bestScore !== undefined
        ? Math.min(
            QA_WORD_CLOUD_NORMALIZED_WEIGHT_CAP,
            Math.max(1, getWordCloudWeightFromNormalizedMetric(question.bestScore)),
          )
        : fallback;
    case 'CONTROVERSIAL':
      return question.controversyScore !== undefined
        ? Math.min(
            QA_WORD_CLOUD_NORMALIZED_WEIGHT_CAP,
            Math.max(1, getWordCloudWeightFromNormalizedMetric(question.controversyScore)),
          )
        : fallback;
    case 'TIME':
      return 1;
    default:
      return fallback;
  }
}
