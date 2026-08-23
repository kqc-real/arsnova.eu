import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  openPresenterViewWindow,
  presenterViewPath,
  presenterViewWindowName,
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

    expect(open).toHaveBeenCalledWith(
      presenterViewPath('xy9k2p'),
      presenterViewWindowName('xy9k2p'),
    );
    expect(opened).toBeTruthy();
  });

  it('nutzt einen session-spezifischen Fensternamen', () => {
    expect(presenterViewWindowName('abc123')).toBe('arsnova-presenter-ABC123');
    expect(presenterViewWindowName('abc123')).not.toBe(presenterViewWindowName('xyz789'));
  });

  it('gibt null zurück, wenn kein Window vorhanden ist', () => {
    expect(openPresenterViewWindow(null, 'ABC123')).toBeNull();
  });
});
