import { localizePath } from '../../../core/locale-router';

export function presenterViewPath(sessionCode: string): string {
  return localizePath(`/session/${sessionCode.trim().toUpperCase()}/present`);
}

/** Eigener Window-Name pro Session, damit ein offenes Presenter-Fenster nicht Token/Kontext einer anderen Session wiederverwendet. */
export function presenterViewWindowName(sessionCode: string): string {
  return `arsnova-presenter-${sessionCode.trim().toUpperCase()}`;
}

/**
 * Öffnet die Presenter-Ansicht aus dem Host-Tab.
 * `window.open` vom Host-Tab übernimmt `sessionStorage` (Host-Token) in den neuen Tab.
 * Ein manuell eingegebener zweiter Tab hat das Token nicht.
 */
export function openPresenterViewWindow(
  win: Window | null | undefined,
  sessionCode: string,
): Window | null {
  if (!win) {
    return null;
  }
  return win.open(presenterViewPath(sessionCode), presenterViewWindowName(sessionCode));
}
