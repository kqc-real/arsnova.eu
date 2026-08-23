import { getSkewAdjustedNow } from './session-server-clock';

/**
 * Verbleibende Countdown-Sekunden bis zur Server-Deadline.
 * Host und Vote nutzen dieselbe Formel, damit Beamer und Handys dieselbe Zahl zeigen.
 * `ceil`: volle Sekunde zählt noch, bis die Deadline wirklich erreicht ist (kein Round-Drift zwischen Clients).
 * Standard-`now` nutzt den aus getInfo/Health kalibrierten Offset (siehe `recordServerTimeSample`).
 */
export function remainingCountdownSeconds(
  deadlineMs: number,
  nowMs: number = getSkewAdjustedNow(),
): number {
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}

/**
 * Stabile Beamer-/Host-Deadline: Polling ohne `activeAt` darf einen laufenden
 * Countdown nicht auf die volle Timerlänge zurücksetzen (sonst 30-29-30-29).
 */
export function stableCountdownDeadlineMs(input: {
  timerSeconds: number;
  activeAt?: string | null;
  currentDeadlineMs: number | null;
  currentKey: string | null;
  nextKey: string;
  nowMs?: number;
}): number {
  const nowMs = input.nowMs ?? Date.now();
  const fromActiveAt = input.activeAt ? Date.parse(input.activeAt) : Number.NaN;
  if (Number.isFinite(fromActiveAt)) {
    return fromActiveAt + input.timerSeconds * 1000;
  }
  if (input.currentDeadlineMs !== null && input.currentKey === input.nextKey) {
    return input.currentDeadlineMs;
  }
  return nowMs + input.timerSeconds * 1000;
}
