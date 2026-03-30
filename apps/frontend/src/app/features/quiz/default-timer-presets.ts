/** Vorgaben für „Sekunden pro Frage“ (Schema min 5, max 300). */
export const QUIZ_DEFAULT_TIMER_PRESET_SECONDS: readonly number[] = [
  5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 300,
];

export function mergeTimerPresetOptions(current: number | null): number[] {
  const base = [...QUIZ_DEFAULT_TIMER_PRESET_SECONDS];
  if (
    typeof current === 'number' &&
    Number.isFinite(current) &&
    current >= 5 &&
    current <= 300 &&
    !base.includes(current)
  ) {
    base.push(current);
    base.sort((a, b) => a - b);
  }
  return base;
}
