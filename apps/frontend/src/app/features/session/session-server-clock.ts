/**
 * Schätzt die Serverzeit aus ISO-Stempeln in API-Antworten (getInfo, Join, Status-Subscription),
 * um Geräte-Uhrenfehler beim Countdown auszugleichen.
 * Sanfte Glättung reduziert Jitter durch Netzwerklaufzeit.
 */
const SMOOTH_PREVIOUS = 0.75;

let offsetMs = 0;
let hasSample = false;

export function recordServerTimeIso(iso: string, localReceiveMs = Date.now()): void {
  const serverMs = Date.parse(iso);
  if (Number.isNaN(serverMs)) return;
  const sampleOffset = serverMs - localReceiveMs;
  if (!hasSample) {
    offsetMs = sampleOffset;
    hasSample = true;
    return;
  }
  offsetMs = SMOOTH_PREVIOUS * offsetMs + (1 - SMOOTH_PREVIOUS) * sampleOffset;
}

/** Für Tests oder Session-Wechsel (optional). */
export function resetServerClockSkew(): void {
  offsetMs = 0;
  hasSample = false;
}

export function getSkewAdjustedNow(): number {
  return Date.now() + (hasSample ? offsetMs : 0);
}
