import { QA_CONTROVERSY_MIN_VOTES } from '@arsnova/shared-types';

export type QaControversyBadgeKind = 'controversial' | 'insufficient' | 'onesided';

/** Sichtbares Umstritten-Label — unabhängig davon, ob die Frage in CONTROVERSIAL mit einsortiert wird. */
export function isQaControversialLabel(input: {
  readonly controversyScore: number;
  readonly voteCount: number;
}): boolean {
  const score = Number.isFinite(input.controversyScore) ? input.controversyScore : 0;
  const votes = Number.isFinite(input.voteCount) ? input.voteCount : 0;
  return score > 0.5 && votes >= QA_CONTROVERSY_MIN_VOTES;
}

export function isQaControversyInsufficientVotes(voteCount: number): boolean {
  const votes = Number.isFinite(voteCount) ? voteCount : 0;
  return votes < QA_CONTROVERSY_MIN_VOTES;
}

/** Badge-Art für Host/Vote — immer genau eine der drei Kennzeichnungen. */
export function resolveQaControversyBadgeKind(input: {
  readonly isControversial: boolean;
  readonly controversyInsufficientVotes: boolean;
}): QaControversyBadgeKind {
  if (input.isControversial) {
    return 'controversial';
  }
  if (input.controversyInsufficientVotes) {
    return 'insufficient';
  }
  return 'onesided';
}
