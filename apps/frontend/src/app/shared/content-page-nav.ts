import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { localizeCommands } from '../core/locale-router';
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
 * Side-Effects vor dem Schließen: MOTD auf dem nächsten Home-Besuch einmal
 * unterdrücken (sonst startet die Prioritätskette sofort neu) und Footer-Fokus merken.
 */
export function prepareContentPageDismiss(pathname: string): void {
  const focusReturn = contentPageFocusReturnForPath(pathname);
  if (!focusReturn) return;
  markMotdOverlayReloadSuppress();
  markContentPageFocusReturn(focusReturn);
}

/**
 * Schließt eine Content-Page: History zurück, sonst Startseite (kein Verlassen der App).
 */
export function dismissContentPage(location: Location, router: Router): void {
  if (typeof window !== 'undefined') {
    prepareContentPageDismiss(window.location.pathname);
  }
  if (typeof window !== 'undefined' && window.history.length > 1) {
    location.back();
    return;
  }
  void router.navigate(localizeCommands([]));
}
