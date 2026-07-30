import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  LOCALE_RELOAD_FOCUS_KEY,
  consumeLocaleReloadFocus,
  markHomeLocaleReloadSideEffects,
  markLocaleReloadFocus,
} from './locale-reload-focus';
import { MOTD_SUPPRESS_OVERLAY_AFTER_RELOAD_KEY } from './motd-storage';

describe('locale-reload-focus', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('speichert und konsumiert home-code-enter einmalig', () => {
    expect(consumeLocaleReloadFocus()).toBeNull();
    markLocaleReloadFocus('home-code-enter');
    expect(sessionStorage.getItem(LOCALE_RELOAD_FOCUS_KEY)).toBe('home-code-enter');
    expect(consumeLocaleReloadFocus('home-code-enter')).toBe('home-code-enter');
    expect(consumeLocaleReloadFocus()).toBeNull();
  });

  it('setzt MOTD- und Fokus-Marker nur bei Sprachwechsel von der Startseite', () => {
    markHomeLocaleReloadSideEffects('/de/help');
    expect(sessionStorage.getItem(MOTD_SUPPRESS_OVERLAY_AFTER_RELOAD_KEY)).toBeNull();
    expect(sessionStorage.getItem(LOCALE_RELOAD_FOCUS_KEY)).toBeNull();

    markHomeLocaleReloadSideEffects('/de/');
    expect(sessionStorage.getItem(MOTD_SUPPRESS_OVERLAY_AFTER_RELOAD_KEY)).toBe('1');
    expect(sessionStorage.getItem(LOCALE_RELOAD_FOCUS_KEY)).toBe('home-code-enter');
  });
});
