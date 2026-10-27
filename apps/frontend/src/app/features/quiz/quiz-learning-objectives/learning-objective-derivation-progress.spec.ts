import { describe, expect, it } from 'vitest';
import {
  derivationGroupScaleTicks,
  derivationProgressPercent,
  emptyLearningObjectiveDerivationProgress,
  estimateRemainingDerivationMinutes,
  estimateRemainingDerivationMs,
  splitDerivationDuration,
} from './learning-objective-derivation-progress';

describe('learning-objective derivation progress helpers', () => {
  it('maps completed groups to a bounded percent', () => {
    expect(derivationProgressPercent(null)).toBe(0);
    expect(derivationProgressPercent(emptyLearningObjectiveDerivationProgress())).toBe(0);
    expect(
      derivationProgressPercent({
        completedGroups: 1,
        totalGroups: 4,
        elapsedMs: 1_000,
        promptTokens: 10,
        completionTokens: 2,
        queuedObjectives: 0,
      }),
    ).toBe(25);
    expect(
      derivationProgressPercent({
        completedGroups: 5,
        totalGroups: 4,
        elapsedMs: 1_000,
        promptTokens: 10,
        completionTokens: 2,
        queuedObjectives: 0,
      }),
    ).toBe(100);
  });

  it('builds a numeric scale for known question groups', () => {
    expect(derivationGroupScaleTicks(null)).toEqual([]);
    expect(derivationGroupScaleTicks(emptyLearningObjectiveDerivationProgress())).toEqual([]);
    expect(
      derivationGroupScaleTicks({
        completedGroups: 2,
        totalGroups: 4,
        elapsedMs: 1_000,
        promptTokens: 10,
        completionTokens: 2,
        queuedObjectives: 0,
      }),
    ).toEqual([
      { value: 0, percent: 0, current: false },
      { value: 1, percent: 25, current: false },
      { value: 2, percent: 50, current: true },
      { value: 3, percent: 75, current: false },
      { value: 4, percent: 100, current: false },
    ]);
    expect(
      derivationGroupScaleTicks({
        completedGroups: 4,
        totalGroups: 12,
        elapsedMs: 1_000,
        promptTokens: 10,
        completionTokens: 2,
        queuedObjectives: 0,
      }),
    ).toEqual([
      { value: 0, percent: 0, current: false },
      { value: 4, percent: (4 / 12) * 100, current: true },
      { value: 12, percent: 100, current: false },
    ]);
  });

  it('estimates remaining time only after at least one group finished', () => {
    expect(estimateRemainingDerivationMs(null)).toBeNull();
    expect(
      estimateRemainingDerivationMs({
        completedGroups: 0,
        totalGroups: 4,
        elapsedMs: 40_000,
        promptTokens: 0,
        completionTokens: 0,
        queuedObjectives: 0,
      }),
    ).toBeNull();
    expect(
      estimateRemainingDerivationMs({
        completedGroups: 4,
        totalGroups: 4,
        elapsedMs: 120_000,
        promptTokens: 10,
        completionTokens: 2,
        queuedObjectives: 0,
      }),
    ).toBeNull();
    expect(
      estimateRemainingDerivationMs({
        completedGroups: 1,
        totalGroups: 3,
        elapsedMs: 45_000,
        promptTokens: 10,
        completionTokens: 2,
        queuedObjectives: 0,
      }),
    ).toBe(90_000);
    expect(estimateRemainingDerivationMinutes(20_000)).toBe(0);
    expect(estimateRemainingDerivationMinutes(90_000)).toBe(2);
    expect(estimateRemainingDerivationMinutes(null)).toBeNull();
  });

  it('splits elapsed time into minutes and seconds', () => {
    expect(splitDerivationDuration(0)).toEqual({ minutes: 0, seconds: 0 });
    expect(splitDerivationDuration(45_400)).toEqual({ minutes: 0, seconds: 45 });
    expect(splitDerivationDuration(125_400)).toEqual({ minutes: 2, seconds: 5 });
  });
});
