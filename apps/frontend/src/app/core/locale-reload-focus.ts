/**
 * Fokus-Ziel nach Locale-Vollreload (Sprachwähler), sessionStorage-basiert.
 */
import { isAppHomeRouterUrl } from './locale-router';
import { markMotdOverlayReloadSuppress } from './motd-storage';

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

/**
 * Side-Effects nur bei Sprachwechsel **von der Startseite**:
 * MOTD-Overlay einmal unterdrücken + Fokus auf „Code eingeben“.
 * Unterseiten dürfen keinen später auf Home wirksamen MOTD-Marker setzen.
 */
export function markHomeLocaleReloadSideEffects(pathname: string): void {
  if (!isAppHomeRouterUrl(pathname)) {
    return;
  }
  markMotdOverlayReloadSuppress();
  markLocaleReloadFocus('home-code-enter');
}
