import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  LOCALE_RELOAD_FOCUS_KEY,
  consumeLocaleReloadFocus,
  markLocaleReloadFocus,
} from './locale-reload-focus';

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
});
