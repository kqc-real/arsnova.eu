import { localizePath, resolveLocalizedAppUrl } from '../../../core/locale-router';
import { normalizeHostSessionCode } from '../../../core/host-session-token';
import {
  copyHostTokenToSessionStorage,
  clearHostTokenHandoff,
  stageHostTokenHandoff,
} from '../../../core/host-session-token-handoff';

/**
 * Presenter ab Tablet, nicht auf Smartphones.
 *
 * CSS-Viewports (Layout-px, inkl. Browser-Chrome, Stand 2025/26):
 * - Smartphone-Landscape: oft 700–932 × 320–430 (Höhe < 500).
 * - 8–11"-Tablets Hochformat: 712–834 (Galaxy Tab S4 712, iPad mini 744, iPad/Air 11" 820–834).
 * - 11–13"-Tablets Querformat: 1133–1210 × 712–834 (Tab S4 1138×712, iPad mini 1133×744, iPad Air 1180×820).
 * - 12–14"-Tablets: 1024–1451 × 800–1024 (iPad 13" 1366×1024, Tab S10+ ca. 1400×876).
 * - Beamer/Desktop: typisch ≥1280×720, 1080p = 1920×1080 — nicht die Tablet-Norm.
 *
 * 600px Breite deckt 7–8"-Tablets im Hochformat; 500px Höhe schließt Phone-Landscape aus.
 * HDMI ist im Browser nicht erkennbar.
 */
export const PRESENTER_VIEW_OFFERED_MEDIA = '(min-width: 600px) and (min-height: 500px)';

/**
 * Presenter/Beamer auf Tablets und Desktop anbieten, nicht auf schmalen Smartphones.
 * Ohne `matchMedia` (Tests/SSR) gilt angeboten, damit Hydration und Host-Tests stabil bleiben.
 */
export function isPresenterViewOffered(win: Window | null | undefined): boolean {
  if (!win || typeof win.matchMedia !== 'function') {
    return true;
  }
  try {
    return win.matchMedia(PRESENTER_VIEW_OFFERED_MEDIA).matches;
  } catch {
    return true;
  }
}

export function presenterViewPath(sessionCode: string): string {
  return localizePath(`/session/${normalizeHostSessionCode(sessionCode)}/present`);
}

export function presenterViewUrl(sessionCode: string): string {
  return resolveLocalizedAppUrl(`/session/${normalizeHostSessionCode(sessionCode)}/present`);
}

/** Eigener Window-Name pro Session, damit ein offenes Presenter-Fenster nicht Token/Kontext einer anderen Session wiederverwendet. */
export function presenterViewWindowName(sessionCode: string): string {
  return `arsnova-presenter-${normalizeHostSessionCode(sessionCode)}`;
}

/**
 * Tablets (iPadOS, Chrome/Android) klonen sessionStorage bei `window.open` nicht
 * und ignorieren benannte Fenster oft: der neue Tab bleibt auf der Startseite.
 */
export function shouldOpenPresenterInUnnamedTab(win: Window | null | undefined): boolean {
  if (!win) {
    return false;
  }
  try {
    if (typeof win.navigator?.maxTouchPoints === 'number' && win.navigator.maxTouchPoints > 1) {
      return true;
    }
    return typeof win.matchMedia === 'function' && win.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

/**
 * Öffnet die Presenter-Ansicht aus dem Host-Tab.
 * Desktop kopiert sessionStorage in das benannte Fenster.
 * Tablets bekommen `_blank` auf die Startseite und nur das kurzlebige
 * localStorage-Handoff — ein direkter sessionStorage-Copy würde Home
 * `hostTabHasToken()` wahr machen und die Weiterleitung nach /present verhindern.
 */
export function openPresenterViewWindow(
  win: Window | null | undefined,
  sessionCode: string,
): Window | null {
  if (!win) {
    return null;
  }

  const touch = shouldOpenPresenterInUnnamedTab(win);
  if (touch) {
    stageHostTokenHandoff(sessionCode);
  }
  const url = touch ? resolveLocalizedAppUrl('/') : presenterViewUrl(sessionCode);
  const target = touch ? '_blank' : presenterViewWindowName(sessionCode);
  const opened = win.open(url, target);
  if (!opened || opened.closed) {
    if (touch) {
      clearHostTokenHandoff();
    }
    return null;
  }
  if (opened === win) {
    return opened;
  }

  try {
    opened.location.replace(url);
  } catch {
    // iOS kann den Handle sperren; Handoff und die ursprüngliche open-URL bleiben.
  }
  if (!touch) {
    try {
      copyHostTokenToSessionStorage(opened.sessionStorage, sessionCode);
    } catch {
      // Cross-origin oder fehlendes sessionStorage: Desktop öffnet /present direkt.
    }
  }
  return opened;
}
