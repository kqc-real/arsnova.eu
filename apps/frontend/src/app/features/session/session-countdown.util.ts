import { getSkewAdjustedNow } from './session-server-clock';

/**
 * Verbleibende Countdown-Sekunden bis zur Server-Deadline.
 * Host und Vote nutzen dieselbe Formel, damit Beamer und Handys dieselbe Zahl zeigen.
 * `ceil`: volle Sekunde zählt noch, bis die Deadline wirklich erreicht ist (kein Round-Drift zwischen Clients).
 * Standard-`now` nutzt den aus getInfo/Health kalibrierten Offset (siehe `recordServerTimeIso`).
 */
export function remainingCountdownSeconds(
  deadlineMs: number,
  nowMs: number = getSkewAdjustedNow(),
): number {
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}
