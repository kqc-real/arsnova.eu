import type { LearningObjectiveDerivationProgress } from '@arsnova/shared-types';

export const LEARNING_OBJECTIVE_DERIVATION_PROGRESS_POLL_MS = 2_000;

export function emptyLearningObjectiveDerivationProgress(): LearningObjectiveDerivationProgress {
  return {
    completedGroups: 0,
    totalGroups: 0,
    elapsedMs: 0,
    promptTokens: 0,
    completionTokens: 0,
    queuedObjectives: 0,
  };
}

export function derivationProgressPercent(
  progress: LearningObjectiveDerivationProgress | null,
): number {
  if (!progress || progress.totalGroups <= 0) return 0;
  return Math.min(100, Math.round((progress.completedGroups / progress.totalGroups) * 100));
}

const MAX_VISIBLE_GROUP_SCALE_TICKS = 8;

export function derivationGroupScaleTicks(
  progress: LearningObjectiveDerivationProgress | null,
): readonly { value: number; percent: number; current: boolean }[] {
  if (!progress || progress.totalGroups <= 0) return [];
  const total = progress.totalGroups;
  const completed = Math.min(Math.max(progress.completedGroups, 0), total);
  const values = new Set<number>();
  if (total <= MAX_VISIBLE_GROUP_SCALE_TICKS) {
    for (let value = 0; value <= total; value += 1) values.add(value);
  } else {
    values.add(0);
    values.add(completed);
    values.add(total);
  }
  return [...values]
    .sort((left, right) => left - right)
    .map((value) => ({
      value,
      percent: (value / total) * 100,
      current: value === completed,
    }));
}

export function splitDerivationDuration(elapsedMs: number): {
  minutes: number;
  seconds: number;
} {
  const totalSeconds = Math.max(0, Math.round(elapsedMs / 1000));
  return {
    minutes: Math.floor(totalSeconds / 60),
    seconds: totalSeconds % 60,
  };
}

export function estimateRemainingDerivationMs(
  progress: LearningObjectiveDerivationProgress | null,
): number | null {
  if (!progress) return null;
  if (progress.completedGroups <= 0 || progress.totalGroups <= progress.completedGroups) {
    return null;
  }
  if (progress.elapsedMs < 1_000) return null;
  const remainingGroups = progress.totalGroups - progress.completedGroups;
  return Math.round((progress.elapsedMs / progress.completedGroups) * remainingGroups);
}

/** Nearest whole minute; `0` means under a minute. */
export function estimateRemainingDerivationMinutes(remainingMs: number | null): number | null {
  if (remainingMs === null) return null;
  if (remainingMs < 45_000) return 0;
  return Math.max(1, Math.round(remainingMs / 60_000));
}
