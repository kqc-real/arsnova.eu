import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  consumeContentPageFocusReturn,
  contentPageFocusReturnForPath,
  dismissContentPage,
  isContentOverlayPath,
  markContentPageFocusReturn,
  prepareContentPageDismiss,
} from './content-page-nav';
import { consumeMotdOverlayReloadSuppress } from '../core/motd-storage';

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

  it('unterdrückt MOTD und merkt Footer-Fokus beim Schließen', () => {
    prepareContentPageDismiss('/de/legal/imprint');

    expect(consumeMotdOverlayReloadSuppress()).toBe(true);
    expect(consumeContentPageFocusReturn()).toBe('footer-imprint');
    expect(consumeContentPageFocusReturn()).toBeNull();
  });

  it('persistiert Fokus-Ziel über mark/consume', () => {
    markContentPageFocusReturn('footer-help');
    expect(consumeContentPageFocusReturn()).toBe('footer-help');
    expect(consumeContentPageFocusReturn()).toBeNull();
  });

  it('nutzt location.back wenn History Einträge hat', () => {
    const location = { back: vi.fn() };
    const router = { navigate: vi.fn() };
    const lengthDesc = Object.getOwnPropertyDescriptor(window.history, 'length');
    Object.defineProperty(window.history, 'length', { configurable: true, value: 3 });

    dismissContentPage(location as never, router as never);

    expect(location.back).toHaveBeenCalledOnce();
    expect(router.navigate).not.toHaveBeenCalled();

    if (lengthDesc) {
      Object.defineProperty(window.history, 'length', lengthDesc);
    }
  });

  it('navigiert zur Startseite wenn keine sinnvolle History existiert', () => {
    const location = { back: vi.fn() };
    const router = { navigate: vi.fn() };
    const lengthDesc = Object.getOwnPropertyDescriptor(window.history, 'length');
    Object.defineProperty(window.history, 'length', { configurable: true, value: 1 });

    dismissContentPage(location as never, router as never);

    expect(location.back).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalled();

    if (lengthDesc) {
      Object.defineProperty(window.history, 'length', lengthDesc);
    }
  });
});
