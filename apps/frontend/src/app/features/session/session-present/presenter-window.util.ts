import { localizePath, resolveLocalizedAppUrl } from '../../../core/locale-router';
import { getHostToken, normalizeHostSessionCode } from '../../../core/host-session-token';
import { tryAutoRequestDocumentFullscreen } from '../../../core/document-fullscreen.util';

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

/** Schreibt den aktuellen Host-Token origin-weit, bevor der Presenter-Tab öffnet. */
export type PresenterHostTokenPersister = {
  /** `true`, wenn der Token in IndexedDB landete. */
  persistCurrentHostToken(sessionCode: string): Promise<boolean>;
};

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
 * und ignorieren benannte Fenster oft.
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
 * Bildschirmfüllende Popup-Features.
 *
 * Chromium verbraucht die User-Geste bei `window.open` — danach scheitert
 * `requestFullscreen` im Kindfenster. Deshalb: Fläche sofort maximieren und
 * zusätzlich `fullscreen` (Chrome mit window-management) mitschicken.
 */
export function presenterWindowOpenFeatures(win: Window): string {
  const screen = win.screen;
  const width = Math.max(
    1,
    Math.floor(Number(screen?.availWidth || screen?.width || win.innerWidth) || 1280),
  );
  const height = Math.max(
    1,
    Math.floor(Number(screen?.availHeight || screen?.height || win.innerHeight) || 720),
  );
  const left = Math.floor(
    Number((screen as (Screen & { availLeft?: number }) | null)?.availLeft) || 0,
  );
  const top = Math.floor(
    Number((screen as (Screen & { availTop?: number }) | null)?.availTop) || 0,
  );
  return [
    'popup=yes',
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    'fullscreen',
  ].join(',');
}

function copyHostTokenToOpenedSessionStorage(storage: Storage, sessionCode: string): boolean {
  const token = getHostToken(sessionCode);
  if (!token) {
    return false;
  }
  try {
    storage.setItem(`arsnova-host-token:${normalizeHostSessionCode(sessionCode)}`, token);
    return true;
  } catch {
    return false;
  }
}

function isPresenterLocation(opened: Window, sessionCode: string): boolean {
  try {
    const code = normalizeHostSessionCode(sessionCode);
    return opened.location.pathname.includes(`/session/${code}/present`);
  } catch {
    return false;
  }
}

/**
 * Best-effort Vollbild im Kindfenster. Nach `window.open` oft blockiert —
 * Present-Seite zeigt dann einen expliziten Gate-Button.
 */
function tryEnterPresenterFullscreen(opened: Window): void {
  try {
    const doc = opened.document;
    if (doc) {
      tryAutoRequestDocumentFullscreen(doc);
    }
  } catch {
    // Cross-origin / restricted document.
  }
}

/**
 * Öffnet die Presenter-Ansicht aus dem Host-Tab.
 *
 * - Bestehendes Desktop-Fenster auf `/present` nur fokussieren (kein Reload → kein Home-/Reconnect-Flash).
 * - Sonst synchron `about:blank` öffnen (User-Geste + alte Startseite sofort weg), Token persistieren,
 *   danach auf `/present` navigieren.
 * - Fenster bildschirmfüllend (+ `fullscreen`-Feature, wo der Browser es erlaubt).
 */
export async function openPresenterViewWindow(
  win: Window | null | undefined,
  sessionCode: string,
  tokenStorage: PresenterHostTokenPersister,
): Promise<Window | null> {
  if (!win) {
    return null;
  }

  const touch = shouldOpenPresenterInUnnamedTab(win);
  const target = touch ? '_blank' : presenterViewWindowName(sessionCode);
  const url = presenterViewUrl(sessionCode);
  const features = presenterWindowOpenFeatures(win);

  if (!touch) {
    try {
      const existing = win.open('', target);
      if (
        existing &&
        !existing.closed &&
        existing !== win &&
        isPresenterLocation(existing, sessionCode)
      ) {
        existing.focus();
        try {
          existing.moveTo?.(0, 0);
          existing.resizeTo?.(
            Math.floor(win.screen?.availWidth || win.innerWidth || 1280),
            Math.floor(win.screen?.availHeight || win.innerHeight || 720),
          );
        } catch {
          // moveTo/resizeTo oft gesperrt.
        }
        tryEnterPresenterFullscreen(existing);
        try {
          copyHostTokenToOpenedSessionStorage(existing.sessionStorage, sessionCode);
        } catch {
          // Restricted sessionStorage: IndexedDB-Fallback bleibt.
        }
        void tokenStorage.persistCurrentHostToken(sessionCode);
        return existing;
      }
    } catch {
      // Handle gesperrt: neuer Blank-Pfad.
    }
  }

  // Synchron im Klick-Kontext: leert ggf. alte Home-/PWA-Shell im benannten Fenster.
  const opened = win.open('about:blank', target, features);
  if (!opened || opened.closed) {
    await tokenStorage.persistCurrentHostToken(sessionCode);
    return null;
  }
  if (opened === win) {
    tryEnterPresenterFullscreen(opened);
    await tokenStorage.persistCurrentHostToken(sessionCode);
    try {
      win.location.assign(url);
    } catch {
      // Same-tab-Navigation gesperrt.
    }
    return opened;
  }

  tryEnterPresenterFullscreen(opened);

  // Persist vor der Present-Navigation, damit der Guard IndexedDB schon vorfindet.
  const persisted = await tokenStorage.persistCurrentHostToken(sessionCode);
  let copied = false;
  try {
    // Auch auf Touch versuchen: same-origin about:blank erlaubt oft Schreibzugriff,
    // auch wenn der Browser sessionStorage beim Open nicht klont.
    copied = copyHostTokenToOpenedSessionStorage(opened.sessionStorage, sessionCode);
  } catch {
    // Quota/Restricted: nur IndexedDB zählt dann.
  }

  if (!persisted && !copied) {
    // Ohne Token landet der Present-Guard auf Join — Blank-Tab wieder schließen.
    try {
      opened.close();
    } catch {
      // Ignore.
    }
    return null;
  }

  try {
    opened.location.replace(url);
  } catch {
    // iOS kann den Handle sperren; IndexedDB und manuelles Öffnen bleiben.
  }
  try {
    opened.focus();
  } catch {
    // Fokus optional.
  }
  tryEnterPresenterFullscreen(opened);
  return opened;
}
