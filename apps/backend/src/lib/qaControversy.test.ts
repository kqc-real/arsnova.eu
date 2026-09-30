import { describe, expect, it } from 'vitest';
import {
  isQaControversialLabel,
  isQaControversyInsufficientVotes,
  resolveQaControversyBadgeKind,
  resolveQaControversyThreshold,
} from './qaControversy';

describe('qaControversy', () => {
  it('leitet T als ganze Mindeststimmenzahl aus der Raumgröße ab', () => {
    expect(resolveQaControversyThreshold(0)).toBe(1);
    expect(resolveQaControversyThreshold(9)).toBe(1);
    expect(resolveQaControversyThreshold(10)).toBe(1);
    expect(resolveQaControversyThreshold(11)).toBe(2);
    expect(resolveQaControversyThreshold(100)).toBe(10);
  });

  it('zeigt das Umstritten-Label erst ab Score > 0,5 und p+n ≥ T', () => {
    const T = 10;
    expect(
      isQaControversialLabel({ controversyScore: 0.67, voteCount: 20, controversyThreshold: T }),
    ).toBe(true);
    expect(
      isQaControversialLabel({ controversyScore: 0.29, voteCount: 4, controversyThreshold: T }),
    ).toBe(false);
    expect(
      isQaControversialLabel({ controversyScore: 0.8, voteCount: 4, controversyThreshold: T }),
    ).toBe(false);
    expect(
      isQaControversialLabel({ controversyScore: 0.5, voteCount: 20, controversyThreshold: T }),
    ).toBe(false);
  });

  it('markiert nur Stimmen unter T als unzureichend', () => {
    const T = 10;
    expect(
      isQaControversyInsufficientVotes({
        voteCount: 4,
        controversyThreshold: T,
        isControversial: false,
      }),
    ).toBe(true);
    expect(
      isQaControversyInsufficientVotes({
        voteCount: 0,
        controversyThreshold: T,
        isControversial: false,
      }),
    ).toBe(true);
    expect(
      isQaControversyInsufficientVotes({
        voteCount: 20,
        controversyThreshold: T,
        isControversial: false,
      }),
    ).toBe(false);
    expect(
      isQaControversyInsufficientVotes({
        voteCount: 10,
        controversyThreshold: T,
        isControversial: false,
      }),
    ).toBe(false);
    expect(
      isQaControversyInsufficientVotes({
        voteCount: 20,
        controversyThreshold: T,
        isControversial: true,
      }),
    ).toBe(false);
  });

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
