/** Minuten:Sekunden bis Ablauf; Sekunden müssen nicht herunterzählen. */
export function formatHostPairingRemainingClock(
  expiresAt: string | null | undefined,
  nowMs: number,
): string | null {
  if (!expiresAt) return null;
  const parsed = Date.parse(expiresAt);
  if (!Number.isFinite(parsed)) return null;
  const totalSec = Math.max(0, Math.ceil((parsed - nowMs) / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
