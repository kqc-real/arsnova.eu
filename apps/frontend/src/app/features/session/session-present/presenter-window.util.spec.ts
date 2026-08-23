import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PRESENTER_VIEW_WINDOW_NAME,
  openPresenterViewWindow,
  presenterViewPath,
} from './presenter-window.util';

describe('presenter-window.util', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('baut den Presenter-Pfad aus dem Session-Code', () => {
    expect(presenterViewPath('abc123')).toContain('/session/ABC123/present');
  });

  it('öffnet die Presenter-Ansicht in einem benannten Fenster', () => {
    const open = vi.fn(() => ({ closed: false }) as Window);
    const win = { open } as unknown as Window;

    const opened = openPresenterViewWindow(win, 'xy9k2p');

    expect(open).toHaveBeenCalledWith(presenterViewPath('xy9k2p'), PRESENTER_VIEW_WINDOW_NAME);
    expect(opened).toBeTruthy();
  });

  it('gibt null zurück, wenn kein Window vorhanden ist', () => {
    expect(openPresenterViewWindow(null, 'ABC123')).toBeNull();
  });
});
