/**
 * Kontroversitäts-Schwelle T und Badge-Regel (Story 8.6 / controversy-score.md).
 *
 * Sortierung nutzt den ControversyScore inkl. T im Nenner für alle Fragen.
 * Badges:
 * - „Umstritten“: Score > 0,5 und p+n ≥ T
 * - „Zu wenige Stimmen“: p+n < T (noch kein belastbares Signal)
 * - „Einseitig“: p+n ≥ T, aber nicht umstritten (klare oder schwach geteilte Tendenz)
 */

export type QaControversyBadgeKind = 'controversial' | 'insufficient' | 'onesided';

/** Mindeststimmenzahl T = max(1, ceil(0,1 · P)). */
export function resolveQaControversyThreshold(participantCount: number): number {
  const count = Number.isFinite(participantCount) ? Math.max(0, participantCount) : 0;
  return Math.max(1, Math.ceil(count * 0.1));
}

/** Sichtbares Umstritten-Label — unabhängig davon, ob die Frage in CONTROVERSIAL mit einsortiert wird. */
export function isQaControversialLabel(input: {
  readonly controversyScore: number;
  readonly voteCount: number;
  readonly controversyThreshold: number;
}): boolean {
  const score = Number.isFinite(input.controversyScore) ? input.controversyScore : 0;
  const votes = Number.isFinite(input.voteCount) ? input.voteCount : 0;
  const threshold = Math.max(1, input.controversyThreshold);
  return score > 0.5 && votes >= threshold;
}

/**
 * Kein belastbares Kontroversitäts-Signal: Stimmen unter der Raumschwelle T.
 * Sortierung bleibt davon unberührt.
 */
export function isQaControversyInsufficientVotes(input: {
  readonly voteCount: number;
  readonly controversyThreshold: number;
  readonly isControversial: boolean;
}): boolean {
  if (input.isControversial) {
    return false;
  }
  const votes = Number.isFinite(input.voteCount) ? input.voteCount : 0;
  const threshold = Math.max(1, input.controversyThreshold);
  return votes < threshold;
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
