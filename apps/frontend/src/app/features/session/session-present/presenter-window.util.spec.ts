import { afterEach, describe, expect, it, vi } from 'vitest';
import { setHostToken } from '../../../core/host-session-token';
import {
  isPresenterViewOffered,
  openPresenterViewWindow,
  PRESENTER_VIEW_OFFERED_MEDIA,
  presenterViewPath,
  presenterViewWindowName,
  shouldOpenPresenterInUnnamedTab,
} from './presenter-window.util';

function persistMock() {
  return { persistCurrentHostToken: vi.fn(async () => undefined) };
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

  it('öffnet die Presenter-Ansicht in einem benannten Fenster', async () => {
    const replace = vi.fn();
    const opened = {
      closed: false,
      location: { replace },
      sessionStorage: window.sessionStorage,
    };
    const open = vi.fn(() => opened);
    const win = {
      open,
      navigator: { maxTouchPoints: 0 },
      matchMedia: () => ({ matches: false }),
    } as unknown as Window;
    const tokenStorage = persistMock();

    const result = await openPresenterViewWindow(win, 'xy9k2p', tokenStorage);

    expect(tokenStorage.persistCurrentHostToken).toHaveBeenCalledWith('xy9k2p');
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining('/session/XY9K2P/present'),
      presenterViewWindowName('xy9k2p'),
    );
    expect(replace).toHaveBeenCalled();
    expect(result).toBe(opened);
  });

  it('öffnet auf Touch-Geräten _blank direkt auf /present und kopiert kein sessionStorage', async () => {
    setHostToken('XY9K2P', 'host-token-xyz');
    const replace = vi.fn();
    const openedStorage = { setItem: vi.fn() };
    const opened = {
      closed: false,
      location: { replace },
      sessionStorage: openedStorage,
    };
    const open = vi.fn(() => opened);
    const win = {
      open,
      navigator: { maxTouchPoints: 5 },
      matchMedia: () => ({ matches: true }),
    } as unknown as Window;
    const callOrder: string[] = [];
    const tokenStorage = {
      persistCurrentHostToken: vi.fn(async () => {
        callOrder.push('persist');
      }),
    };
    open.mockImplementation(() => {
      callOrder.push('open');
      return opened;
    });

    await openPresenterViewWindow(win, 'xy9k2p', tokenStorage);

    expect(tokenStorage.persistCurrentHostToken).toHaveBeenCalledWith('xy9k2p');
    expect(callOrder).toEqual(['persist', 'open']);
    expect(open).toHaveBeenCalledWith(expect.stringContaining('/session/XY9K2P/present'), '_blank');
    expect(openedStorage.setItem).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalled();
    expect(window.localStorage.getItem('arsnova-host-token-handoff')).toBeNull();
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
      location: { replace: vi.fn() },
      sessionStorage: { setItem: vi.fn() },
    };
    const win = {
      open: vi.fn(() => opened),
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
