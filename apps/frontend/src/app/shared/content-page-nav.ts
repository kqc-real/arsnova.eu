import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { isAppHomeRouterUrl, localizePath } from '../core/locale-router';
import { markMotdOverlayReloadSuppress } from '../core/motd-storage';

/**
 * Hilfe, Legal und News-Archiv: overlay-artige Content-Pages mit Backdrop/Zurück.
 * Auf diesen Routen sollen App-Chrome (Toolbar/Footer) nicht per Tab erreichbar sein.
 */
export function isContentOverlayPath(pathname: string): boolean {
  const normalized =
    (pathname.startsWith('/') ? pathname : `/${pathname}`).replace(
      /^\/(?:de|en|fr|it|es)(?=\/|$)/,
      '',
    ) || '/';
  return (
    normalized === '/help' ||
    normalized.startsWith('/help/') ||
    normalized === '/news-archive' ||
    normalized.startsWith('/news-archive/') ||
    normalized.startsWith('/legal/')
  );
}

export type ContentPageFocusReturn =
  | 'footer-help'
  | 'footer-news-archive'
  | 'footer-imprint'
  | 'footer-privacy'
  | 'footer-accessibility';

export const CONTENT_PAGE_FOCUS_RETURN_KEY = 'arsnova-content-page-focus-return';
export const LAST_NON_OVERLAY_PATH_KEY = 'arsnova-last-non-overlay-path';

/**
 * Nur In-Memory für die aktuelle Dismiss-Navigation.
 * sessionStorage allein würde nach Reload/Locale-Redirect den Initialfokus stehlen.
 */
let pendingFocusReturn: ContentPageFocusReturn | null = null;

/** Merkt die letzte Nicht-Overlay-Route (für MOTD-Suppress nur bei Rückkehr zur Home). */
export function rememberNonOverlayPath(pathname: string): void {
  if (typeof sessionStorage === 'undefined') return;
  if (isContentOverlayPath(pathname)) return;
  try {
    sessionStorage.setItem(LAST_NON_OVERLAY_PATH_KEY, pathname);
  } catch {
    /* ignore */
  }
}

export function readLastNonOverlayPath(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    return sessionStorage.getItem(LAST_NON_OVERLAY_PATH_KEY);
  } catch {
    return null;
  }
}

/** Footer-Link, der nach Schließen der Content-Page wieder Fokus bekommen soll. */
export function contentPageFocusReturnForPath(pathname: string): ContentPageFocusReturn | null {
  const normalized =
    (pathname.startsWith('/') ? pathname : `/${pathname}`).replace(
      /^\/(?:de|en|fr|it|es)(?=\/|$)/,
      '',
    ) || '/';
  if (normalized === '/help' || normalized.startsWith('/help/')) return 'footer-help';
  if (normalized === '/news-archive' || normalized.startsWith('/news-archive/')) {
    return 'footer-news-archive';
  }
  if (normalized.startsWith('/legal/imprint')) return 'footer-imprint';
  if (normalized.startsWith('/legal/privacy')) return 'footer-privacy';
  if (normalized.startsWith('/legal/accessibility')) return 'footer-accessibility';
  return null;
}

export function markContentPageFocusReturn(target: ContentPageFocusReturn): void {
  pendingFocusReturn = target;
}

export function peekContentPageFocusReturn(): ContentPageFocusReturn | null {
  return pendingFocusReturn;
}

export function consumeContentPageFocusReturn(): ContentPageFocusReturn | null {
  const value = pendingFocusReturn;
  pendingFocusReturn = null;
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(CONTENT_PAGE_FOCUS_RETURN_KEY);
    } catch {
      /* ignore */
    }
  }
  return value;
}

/** App-Start / Initial-Navigation: keine Footer-Fokus-Rückkehr. */
export function clearStaleContentPageFocusReturn(): void {
  pendingFocusReturn = null;
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(CONTENT_PAGE_FOCUS_RETURN_KEY);
  } catch {
    /* ignore */
  }
}

/** CSS-Selektor für den Footer-Link zum gespeicherten Fokus-Ziel. */
export function contentPageFocusReturnSelector(target: ContentPageFocusReturn): string {
  switch (target) {
    case 'footer-help':
      return 'a[data-footer-focus="footer-help"]';
    case 'footer-news-archive':
      return 'a[data-footer-focus="footer-news-archive"]';
    case 'footer-imprint':
      return 'a[data-footer-focus="footer-imprint"]';
    case 'footer-privacy':
      return 'a[data-footer-focus="footer-privacy"]';
    case 'footer-accessibility':
      return 'a[data-footer-focus="footer-accessibility"]';
  }
}

function contentPageFocusReturnHrefSelector(target: ContentPageFocusReturn): string {
  switch (target) {
    case 'footer-help':
      return 'a[href*="/help"]';
    case 'footer-news-archive':
      return 'a[href*="/news-archive"]';
    case 'footer-imprint':
      return 'a[href*="/legal/imprint"]';
    case 'footer-privacy':
      return 'a[href*="/legal/privacy"]';
    case 'footer-accessibility':
      return 'a[href*="/legal/accessibility"]';
  }
}

/** Entfernt inert am App-Chrome, damit Fokus zurück in den Footer kann. */
export function clearAppChromeInert(): void {
  if (typeof document === 'undefined') return;
  const chrome = Array.from(
    document.querySelectorAll<HTMLElement>('footer.app-footer, app-top-toolbar, a.app-skip-link'),
  );
  for (const el of chrome) {
    if (!el.hasAttribute('inert') && !(el as HTMLElement & { inert?: boolean }).inert) {
      continue;
    }
    el.removeAttribute('inert');
    (el as HTMLElement & { inert: boolean }).inert = false;
  }
}

/**
 * Fokus auf den Footer-Link legen (inert am Chrome vorher entfernen).
 * `activeElement` darf auch ein Nachfahre des Links sein (Material-Button).
 */
export function focusFooterContentReturn(target: ContentPageFocusReturn): boolean {
  if (typeof document === 'undefined') return false;
  clearAppChromeInert();
  const footer = document.querySelector<HTMLElement>('footer.app-footer');
  const link =
    footer?.querySelector<HTMLElement>(contentPageFocusReturnSelector(target)) ??
    footer?.querySelector<HTMLElement>(contentPageFocusReturnHrefSelector(target)) ??
    null;
  if (!link) {
    return false;
  }
  try {
    link.focus({ preventScroll: true });
  } catch {
    link.focus();
  }
  const active = document.activeElement;
  return active === link || (active instanceof Node && link.contains(active));
}

/**
 * Side-Effects vor dem Schließen.
 * MOTD-Suppress nur, wenn die Content-Page von der Startseite aus geöffnet wurde
 * (oder wir explizit zur Startseite navigieren) — nicht bei Rückkehr zu Quiz etc.
 * Footer-Fokus-Rückgabe nur, wenn es einen auslösenden Footer-Link gab
 * (`storeFocusReturn`, Standard true) — nicht beim Direktaufruf-Fallback.
 */
export function prepareContentPageDismiss(
  pathname: string,
  options?: { navigatingToHome?: boolean; storeFocusReturn?: boolean },
): void {
  if (options?.storeFocusReturn !== false) {
    const focusReturn = contentPageFocusReturnForPath(pathname);
    if (focusReturn) {
      markContentPageFocusReturn(focusReturn);
    }
  }
  const lastNonOverlay = readLastNonOverlayPath();
  const returningToHome =
    options?.navigatingToHome === true ||
    (lastNonOverlay !== null && isAppHomeRouterUrl(lastNonOverlay));
  if (returningToHome) {
    markMotdOverlayReloadSuppress();
  }
}

/** Escape soll Content-Pages nicht schließen, solange ein MatDialog (z. B. Lightbox) offen ist. */
export function shouldDeferContentPageEscape(dialog: MatDialog): boolean {
  return dialog.openDialogs.length > 0;
}

/**
 * Schließt eine Content-Page: History zurück, sonst lokalisierte Startseite.
 * Beim Direktaufruf (keine History) kein Footer-Fokus-Marker — normale Home-Fokuslogik.
 *
 * Chrome-`inert` hier nicht entfernen: bei Overlay→Overlay (Hilfe→Legal→Zurück)
 * bliebe die Angular-Binding sonst ohne Re-Apply. `focusFooterContentReturn` entfernt
 * inert erst bei tatsächlicher Rückkehr auf eine Nicht-Overlay-Route.
 */
export function dismissContentPage(location: Location, router: Router): void {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  if (typeof window !== 'undefined' && window.history.length > 1) {
    prepareContentPageDismiss(pathname);
    location.back();
    return;
  }
  prepareContentPageDismiss(pathname, {
    navigatingToHome: true,
    storeFocusReturn: false,
  });
  void router.navigateByUrl(localizePath('/'));
}
