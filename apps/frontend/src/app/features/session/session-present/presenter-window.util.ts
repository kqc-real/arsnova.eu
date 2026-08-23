import { localizePath } from '../../../core/locale-router';

export const PRESENTER_VIEW_WINDOW_NAME = 'arsnova-presenter';

export function presenterViewPath(sessionCode: string): string {
  return localizePath(`/session/${sessionCode.trim().toUpperCase()}/present`);
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
  return win.open(presenterViewPath(sessionCode), PRESENTER_VIEW_WINDOW_NAME);
}
