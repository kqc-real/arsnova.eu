import { afterEach, describe, expect, it, vi } from 'vitest';
import { setHostToken } from '../../../core/host-session-token';
import {
  isPresenterViewOffered,
  openPresenterViewWindow,
  PRESENTER_VIEW_OFFERED_MEDIA,
  presenterViewPath,
  presenterViewWindowName,
  presenterWindowOpenFeatures,
  shouldOpenPresenterInUnnamedTab,
} from './presenter-window.util';

function persistMock(result = true) {
  return { persistCurrentHostToken: vi.fn(async () => result) };
}

describe('presenter-window.util', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it('baut den Presenter-Pfad aus dem Session-Code', () => {
    expect(presenterViewPath('abc123')).toContain('/session/ABC123/present');
  });

  it('öffnet die Presenter-Ansicht über about:blank und navigiert danach zu /present', async () => {
    const replace = vi.fn();
    const requestFullscreen = vi.fn(() => Promise.resolve());
    const opened = {
      closed: false,
      location: { pathname: 'blank', replace },
      sessionStorage: window.sessionStorage,
      focus: vi.fn(),
      document: {
        documentElement: { requestFullscreen },
        fullscreenEnabled: true,
        fullscreenElement: null,
      },
    };
    const open = vi.fn(() => opened);
    const win = {
      open,
      navigator: { maxTouchPoints: 0 },
      matchMedia: () => ({ matches: false }),
      screen: { availWidth: 1920, availHeight: 1080, availLeft: 0, availTop: 0 },
      innerWidth: 1280,
      innerHeight: 800,
    } as unknown as Window;
    const tokenStorage = persistMock();

    const result = await openPresenterViewWindow(win, 'xy9k2p', tokenStorage);

    expect(open).toHaveBeenCalledWith('', presenterViewWindowName('xy9k2p'));
    expect(open).toHaveBeenCalledWith(
      'about:blank',
      presenterViewWindowName('xy9k2p'),
      expect.stringContaining('fullscreen'),
    );
    expect(open.mock.calls[1]?.[2]).toContain('width=1920');
    expect(open.mock.calls[1]?.[2]).toContain('height=1080');
    expect(tokenStorage.persistCurrentHostToken).toHaveBeenCalledWith('xy9k2p');
    expect(replace).toHaveBeenCalledWith(expect.stringContaining('/session/XY9K2P/present'));
    expect(result).toBe(opened);
  });

  it('fokussiert ein bereits offenes Presenter-Fenster ohne Reload', async () => {
    const replace = vi.fn();
    const focus = vi.fn();
    const requestFullscreen = vi.fn(() => Promise.resolve());
    const existing = {
      closed: false,
      location: { pathname: '/session/XY9K2P/present', replace },
      sessionStorage: { setItem: vi.fn() },
      focus,
      document: {
        documentElement: { requestFullscreen },
        fullscreenEnabled: true,
        fullscreenElement: null,
      },
    };
    const open = vi.fn(() => existing);
    const win = {
      open,
      navigator: { maxTouchPoints: 0 },
      matchMedia: () => ({ matches: false }),
    } as unknown as Window;
    setHostToken('XY9K2P', 'host-token-xyz');
    const tokenStorage = persistMock();

    const result = await openPresenterViewWindow(win, 'xy9k2p', tokenStorage);

    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith('', presenterViewWindowName('xy9k2p'));
    expect(replace).not.toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
    expect(requestFullscreen).toHaveBeenCalled();
    expect(existing.sessionStorage.setItem).toHaveBeenCalled();
    expect(result).toBe(existing);
  });

  it('öffnet auf Touch-Geräten zuerst about:blank, persistiert, dann /present', async () => {
    setHostToken('XY9K2P', 'host-token-xyz');
    const replace = vi.fn();
    const openedStorage = { setItem: vi.fn() };
    const opened = {
      closed: false,
      location: { pathname: 'blank', replace },
      sessionStorage: openedStorage,
      focus: vi.fn(),
      close: vi.fn(),
    };
    const callOrder: string[] = [];
    const open = vi.fn(() => {
      callOrder.push('open');
      return opened;
    });
    const win = {
      open,
      navigator: { maxTouchPoints: 5 },
      matchMedia: () => ({ matches: true }),
      screen: { availWidth: 1024, availHeight: 768, availLeft: 0, availTop: 0 },
      innerWidth: 1024,
      innerHeight: 768,
    } as unknown as Window;
    const tokenStorage = {
      persistCurrentHostToken: vi.fn(async () => {
        callOrder.push('persist');
        return true;
      }),
    };

    await openPresenterViewWindow(win, 'xy9k2p', tokenStorage);

    expect(open).toHaveBeenCalledWith(
      'about:blank',
      '_blank',
      expect.stringContaining('fullscreen'),
    );
    expect(callOrder).toEqual(['open', 'persist']);
    expect(replace).toHaveBeenCalledWith(expect.stringContaining('/session/XY9K2P/present'));
    expect(opened.close).not.toHaveBeenCalled();
  });

  it('bricht auf Touch ab wenn IndexedDB und sessionStorage-Handoff scheitern', async () => {
    setHostToken('XY9K2P', 'host-token-xyz');
    const replace = vi.fn();
    const close = vi.fn();
    const opened = {
      closed: false,
      location: { pathname: 'blank', replace },
      sessionStorage: {
        setItem: vi.fn(() => {
          throw new Error('quota');
        }),
      },
      focus: vi.fn(),
      close,
    };
    const win = {
      open: vi.fn(() => opened),
      navigator: { maxTouchPoints: 5 },
      matchMedia: () => ({ matches: true }),
    } as unknown as Window;

    const result = await openPresenterViewWindow(win, 'xy9k2p', persistMock(false));

    expect(result).toBeNull();
    expect(close).toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('schreibt den Token auch dann nach IndexedDB, wenn das Popup blockiert wird', async () => {
    const tokenStorage = persistMock();
    const win = {
      open: vi.fn(() => null),
      navigator: { maxTouchPoints: 5 },
      matchMedia: () => ({ matches: true }),
    } as unknown as Window;

    expect(await openPresenterViewWindow(win, 'xy9k2p', tokenStorage)).toBeNull();
    expect(tokenStorage.persistCurrentHostToken).toHaveBeenCalledWith('xy9k2p');
  });

  it('legt auf Desktop kein localStorage-Handoff an', async () => {
    setHostToken('XY9K2P', 'host-token-xyz');
    const opened = {
      closed: false,
      location: { pathname: 'blank', replace: vi.fn() },
      sessionStorage: { setItem: vi.fn() },
      focus: vi.fn(),
    };
    const win = {
      open: vi.fn((url: string) => {
        if (url === '') {
          return {
            closed: false,
            location: { pathname: '/', replace: vi.fn() },
            sessionStorage: { setItem: vi.fn() },
            focus: vi.fn(),
          };
        }
        return opened;
      }),
      navigator: { maxTouchPoints: 0 },
      matchMedia: () => ({ matches: false }),
    } as unknown as Window;

    await openPresenterViewWindow(win, 'xy9k2p', persistMock());

    expect(window.localStorage.getItem('arsnova-host-token-handoff')).toBeNull();
    expect(opened.sessionStorage.setItem).toHaveBeenCalled();
  });

  it('erkennt Touch-Geraete fuer unbenannte Presenter-Tabs', () => {
    expect(
      shouldOpenPresenterInUnnamedTab({
        navigator: { maxTouchPoints: 5 },
        matchMedia: () => ({ matches: false }),
      } as unknown as Window),
    ).toBe(true);
    expect(
      shouldOpenPresenterInUnnamedTab({
        navigator: { maxTouchPoints: 0 },
        matchMedia: () => ({ matches: false }),
      } as unknown as Window),
    ).toBe(false);
  });

  it('nutzt einen session-spezifischen Fensternamen', () => {
    expect(presenterViewWindowName('abc123')).toBe('arsnova-presenter-ABC123');
    expect(presenterViewWindowName('abc123')).not.toBe(presenterViewWindowName('xyz789'));
  });

  it('gibt null zurück, wenn kein Window vorhanden ist', async () => {
    expect(await openPresenterViewWindow(null, 'ABC123', persistMock())).toBeNull();
  });

  it('baut bildschirmfüllende Popup-Features inkl. fullscreen', () => {
    const win = {
      screen: { availWidth: 1600, availHeight: 900, availLeft: 10, availTop: 20 },
      innerWidth: 1200,
      innerHeight: 800,
    } as unknown as Window;
    const features = presenterWindowOpenFeatures(win);
    expect(features).toContain('width=1600');
    expect(features).toContain('height=900');
    expect(features).toContain('left=10');
    expect(features).toContain('top=20');
    expect(features).toContain('fullscreen');
    expect(features).toContain('popup=yes');
  });

  it('bietet die Presenter-Ansicht ohne matchMedia als Desktop an', () => {
    expect(isPresenterViewOffered(null)).toBe(true);
    expect(isPresenterViewOffered({} as Window)).toBe(true);
  });

  it('bietet die Presenter-Ansicht ab Tablet-Breite an', () => {
    const matchMedia = vi.fn((query: string) => ({
      matches: query === PRESENTER_VIEW_OFFERED_MEDIA,
    }));
    const win = { matchMedia } as unknown as Window;

    expect(isPresenterViewOffered(win)).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith(PRESENTER_VIEW_OFFERED_MEDIA);
  });

  it('bietet die Presenter-Ansicht auf schmalem Smartphone-Viewport nicht an', () => {
    const win = {
      matchMedia: vi.fn(() => ({ matches: false })),
    } as unknown as Window;

    expect(isPresenterViewOffered(win)).toBe(false);
  });
});
