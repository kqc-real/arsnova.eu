import { describe, expect, it } from 'vitest';
import { calculateQaControversyScore } from '@arsnova/shared-types';
import {
  isQaControversialLabel,
  isQaControversyInsufficientVotes,
  resolveQaControversyBadgeKind,
} from './qaControversy';

describe('qaControversy', () => {
  it.each([
    [0, 0, 0, true, false],
    [10, 0, 0, false, false],
    [1, 1, 1 / 3, true, false],
    [2, 2, 0.5, true, false],
    [3, 2, 4 / 9, true, false],
    [3, 3, 0.6, false, true],
    [5, 1, 0.2, false, false],
    [10, 10, 20 / 24, false, true],
  ])(
    'berechnet %i dafür und %i dagegen für Rangliste und Label',
    (positive, negative, expectedScore, insufficient, controversial) => {
      const voteCount = positive + negative;
      const controversyScore = calculateQaControversyScore({ positive, negative });
      expect(controversyScore).toBe(expectedScore);
      expect(isQaControversyInsufficientVotes(voteCount)).toBe(insufficient);
      expect(isQaControversialLabel({ controversyScore, voteCount })).toBe(controversial);
    },
  );

  it('ordnet Badge-Arten Umstritten / Zu wenige Stimmen / Einseitig zu', () => {
    expect(
      resolveQaControversyBadgeKind({
        isControversial: true,
        controversyInsufficientVotes: false,
      }),
    ).toBe('controversial');
    expect(
      resolveQaControversyBadgeKind({
        isControversial: false,
        controversyInsufficientVotes: true,
      }),
    ).toBe('insufficient');
    expect(
      resolveQaControversyBadgeKind({
        isControversial: false,
        controversyInsufficientVotes: false,
      }),
    ).toBe('onesided');
  });
});
