import { describe, expect, it, vi } from 'vitest';
import {
  isPresenterViewOffered,
  PRESENTER_VIEW_OFFERED_MEDIA,
  sessionPresentationPath,
  SessionPresentationState,
} from './presenter-navigation';

describe('Navigation zwischen Host und Presenter', () => {
  it('verwendet dieselbe Session für beide Routen', () => {
    expect(sessionPresentationPath('abc123', 'present')).toContain('/session/ABC123/present');
    expect(sessionPresentationPath('abc123', 'host')).toContain('/session/ABC123/host');
  });

  it('merkt den zuletzt benutzten Host-Kanal nur für die passende Session', () => {
    const state = new SessionPresentationState();
    const preferences = {
      channel: 'qa',
    } as const;
    state.rememberHostView('abc123', preferences);
    state.markStarted('abc123');
    expect(state.hasStarted('ABC123')).toBe(true);
    expect(state.hostView('ABC123')).toEqual(preferences);
    expect(state.hasStarted('XYZ789')).toBe(false);
    expect(state.hostView('XYZ789')).toBeUndefined();
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
