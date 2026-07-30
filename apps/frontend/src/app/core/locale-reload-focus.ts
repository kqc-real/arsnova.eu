/**
 * Fokus-Ziel nach Locale-Vollreload (Sprachwähler), sessionStorage-basiert.
 */
export const LOCALE_RELOAD_FOCUS_KEY = 'arsnova-locale-reload-focus';

export type LocaleReloadFocusTarget = 'home-code-enter';

/** Vor Locale-Vollreload setzen; Home konsumiert das Ziel nach dem Boot. */
export function markLocaleReloadFocus(target: LocaleReloadFocusTarget): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(LOCALE_RELOAD_FOCUS_KEY, target);
  } catch {
    /* ignore quota / private mode */
  }
}

/** @returns das gespeicherte Ziel oder null; Eintrag wird entfernt. */
export function consumeLocaleReloadFocus(
  expected?: LocaleReloadFocusTarget,
): LocaleReloadFocusTarget | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(LOCALE_RELOAD_FOCUS_KEY);
    sessionStorage.removeItem(LOCALE_RELOAD_FOCUS_KEY);
    if (raw !== 'home-code-enter') {
      return null;
    }
    if (expected && raw !== expected) {
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}
