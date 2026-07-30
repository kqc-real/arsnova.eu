import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  consumeContentPageFocusReturn,
  contentPageFocusReturnForPath,
  dismissContentPage,
  isContentOverlayPath,
  markContentPageFocusReturn,
  prepareContentPageDismiss,
  rememberNonOverlayPath,
  shouldDeferContentPageEscape,
} from './content-page-nav';
import { consumeMotdOverlayReloadSuppress } from '../core/motd-storage';
import { localizePath } from '../core/locale-router';

describe('content-page-nav', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('erkennt Hilfe-, Legal- und News-Archiv-Routen inkl. Locale-Präfix', () => {
    expect(isContentOverlayPath('/help')).toBe(true);
    expect(isContentOverlayPath('/de/help')).toBe(true);
    expect(isContentOverlayPath('/en/legal/imprint')).toBe(true);
    expect(isContentOverlayPath('/fr/news-archive')).toBe(true);
    expect(isContentOverlayPath('/')).toBe(false);
    expect(isContentOverlayPath('/de/quiz')).toBe(false);
  });

  it('ordnet Content-Pages den Footer-Fokus-Zielen zu', () => {
    expect(contentPageFocusReturnForPath('/de/help')).toBe('footer-help');
    expect(contentPageFocusReturnForPath('/en/legal/privacy')).toBe('footer-privacy');
    expect(contentPageFocusReturnForPath('/news-archive')).toBe('footer-news-archive');
    expect(contentPageFocusReturnForPath('/quiz')).toBeNull();
  });

  it('unterdrückt MOTD nur bei Rückkehr zur Startseite, nicht zu Quiz', () => {
    rememberNonOverlayPath('/de/quiz');
    prepareContentPageDismiss('/de/help');

    expect(consumeMotdOverlayReloadSuppress()).toBe(false);
    expect(consumeContentPageFocusReturn()).toBe('footer-help');

    rememberNonOverlayPath('/de/');
    prepareContentPageDismiss('/de/legal/imprint');

    expect(consumeMotdOverlayReloadSuppress()).toBe(true);
    expect(consumeContentPageFocusReturn()).toBe('footer-imprint');
  });

  it('unterdrückt MOTD beim expliziten Home-Fallback (Direktaufruf)', () => {
    rememberNonOverlayPath('/de/quiz');
    prepareContentPageDismiss('/de/help', { navigatingToHome: true });

    expect(consumeMotdOverlayReloadSuppress()).toBe(true);
  });

  it('persistiert Fokus-Ziel über mark/consume', () => {
    markContentPageFocusReturn('footer-help');
    expect(consumeContentPageFocusReturn()).toBe('footer-help');
    expect(consumeContentPageFocusReturn()).toBeNull();
  });

  it('nutzt location.back wenn History Einträge hat', () => {
    const location = { back: vi.fn() };
    const router = { navigateByUrl: vi.fn() };
    const lengthDesc = Object.getOwnPropertyDescriptor(window.history, 'length');
    Object.defineProperty(window.history, 'length', { configurable: true, value: 3 });

    dismissContentPage(location as never, router as never);

    expect(location.back).toHaveBeenCalledOnce();
    expect(router.navigateByUrl).not.toHaveBeenCalled();

    if (lengthDesc) {
      Object.defineProperty(window.history, 'length', lengthDesc);
    }
  });

  it('navigiert bei Direktaufruf zur lokalisierten Startseite ohne Footer-Fokus-Marker', () => {
    const location = { back: vi.fn() };
    const router = { navigateByUrl: vi.fn() };
    const lengthDesc = Object.getOwnPropertyDescriptor(window.history, 'length');
    Object.defineProperty(window.history, 'length', { configurable: true, value: 1 });
    markContentPageFocusReturn('footer-help');
    consumeContentPageFocusReturn();

    dismissContentPage(location as never, router as never);

    expect(location.back).not.toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith(localizePath('/'));
    expect(consumeContentPageFocusReturn()).toBeNull();

    if (lengthDesc) {
      Object.defineProperty(window.history, 'length', lengthDesc);
    }
  });

  it('erkennt offene MatDialogs als Escape-Deferral', () => {
    expect(shouldDeferContentPageEscape({ openDialogs: [] } as never)).toBe(false);
    expect(shouldDeferContentPageEscape({ openDialogs: [{}] } as never)).toBe(true);
  });
});
