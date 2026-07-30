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
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(CONTENT_PAGE_FOCUS_RETURN_KEY, target);
  } catch {
    /* ignore quota / private mode */
  }
}

export function consumeContentPageFocusReturn(): ContentPageFocusReturn | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CONTENT_PAGE_FOCUS_RETURN_KEY);
    sessionStorage.removeItem(CONTENT_PAGE_FOCUS_RETURN_KEY);
    if (
      raw === 'footer-help' ||
      raw === 'footer-news-archive' ||
      raw === 'footer-imprint' ||
      raw === 'footer-privacy' ||
      raw === 'footer-accessibility'
    ) {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

/** CSS-Selektor für den Footer-Link zum gespeicherten Fokus-Ziel. */
export function contentPageFocusReturnSelector(target: ContentPageFocusReturn): string {
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

/**
 * Side-Effects vor dem Schließen.
 * MOTD-Suppress nur, wenn die Content-Page von der Startseite aus geöffnet wurde
 * (oder wir explizit zur Startseite navigieren) — nicht bei Rückkehr zu Quiz etc.
 */
export function prepareContentPageDismiss(
  pathname: string,
  options?: { navigatingToHome?: boolean },
): void {
  const focusReturn = contentPageFocusReturnForPath(pathname);
  if (focusReturn) {
    markContentPageFocusReturn(focusReturn);
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
 */
export function dismissContentPage(location: Location, router: Router): void {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  if (typeof window !== 'undefined' && window.history.length > 1) {
    prepareContentPageDismiss(pathname);
    location.back();
    return;
  }
  prepareContentPageDismiss(pathname, { navigatingToHome: true });
  void router.navigateByUrl(localizePath('/'));
}
