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

describe('presenter-window.util', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it('baut den Presenter-Pfad aus dem Session-Code', () => {
    expect(presenterViewPath('abc123')).toContain('/session/ABC123/present');
  });

  it('öffnet die Presenter-Ansicht in einem benannten Fenster', () => {
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

    const result = openPresenterViewWindow(win, 'xy9k2p');

    expect(open).toHaveBeenCalledWith(
      expect.stringContaining('/session/XY9K2P/present'),
      presenterViewWindowName('xy9k2p'),
    );
    expect(replace).toHaveBeenCalled();
    expect(result).toBe(opened);
  });

  it('öffnet auf Touch-Geräten _blank und uebergibt das Host-Token nur per Handoff', () => {
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

    openPresenterViewWindow(win, 'xy9k2p');

    expect(open).toHaveBeenCalledWith(expect.not.stringContaining('/session/'), '_blank');
    expect(window.localStorage.getItem('arsnova-host-token-handoff')).toContain('host-token-xyz');
    expect(openedStorage.setItem).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalled();
  });

  it('entfernt das Touch-Handoff wenn das Popup blockiert wird', () => {
    setHostToken('XY9K2P', 'host-token-xyz');
    const win = {
      open: vi.fn(() => null),
      navigator: { maxTouchPoints: 5 },
      matchMedia: () => ({ matches: true }),
    } as unknown as Window;

    expect(openPresenterViewWindow(win, 'xy9k2p')).toBeNull();
    expect(window.localStorage.getItem('arsnova-host-token-handoff')).toBeNull();
  });

  it('legt auf Desktop kein Handoff in localStorage', () => {
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

    openPresenterViewWindow(win, 'xy9k2p');

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

  it('gibt null zurück, wenn kein Window vorhanden ist', () => {
    expect(openPresenterViewWindow(null, 'ABC123')).toBeNull();
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
