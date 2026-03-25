import { afterEach, describe, expect, it } from 'vitest';
import {
  getEffectiveLocale,
  getLocaleFromBaseHref,
  getLocaleFromPath,
  localeIdToSupported,
  resolveAssetUrlFromBase,
} from './locale-from-path';

describe('locale-from-path', () => {
  afterEach(() => {
    document.querySelectorAll('base').forEach((el) => el.remove());
    window.history.pushState({}, '', '/');
  });

  describe('getLocaleFromBaseHref', () => {
    it('liefert null für / oder fehlendes base', () => {
      expect(getLocaleFromBaseHref()).toBeNull();
      const base = document.createElement('base');
      base.setAttribute('href', '/');
      document.head.prepend(base);
      expect(getLocaleFromBaseHref()).toBeNull();
    });

    it('erkennt /en/', () => {
      const base = document.createElement('base');
      base.setAttribute('href', '/en/');
      document.head.prepend(base);
      expect(getLocaleFromBaseHref()).toBe('en');
    });

    it('erkennt /de ohne trailing slash', () => {
      const base = document.createElement('base');
      base.setAttribute('href', '/de');
      document.head.prepend(base);
      expect(getLocaleFromBaseHref()).toBe('de');
    });
  });

  describe('getEffectiveLocale', () => {
    it('bevorzugt base href wenn pathname kein Locale-Segment hat', () => {
      window.history.pushState({}, '', '/legal/imprint');
      const base = document.createElement('base');
      base.setAttribute('href', '/en/');
      document.head.prepend(base);
      expect(getLocaleFromPath()).toBeNull();
      expect(getEffectiveLocale()).toBe('en');
    });

    it('nutzt Pfad-Segment wenn base neutral', () => {
      const base = document.createElement('base');
      base.setAttribute('href', '/');
      document.head.prepend(base);
      window.history.pushState({}, '', '/fr/help');
      expect(getEffectiveLocale()).toBe('fr');
    });

    it('bevorzugt Pfad vor base href (Toolbar-Sprachwechsel trotz localize-base /en/)', () => {
      const base = document.createElement('base');
      base.setAttribute('href', '/en/');
      document.head.prepend(base);
      window.history.pushState({}, '', '/de/quiz');
      expect(getLocaleFromBaseHref()).toBe('en');
      expect(getLocaleFromPath()).toBe('de');
      expect(getEffectiveLocale()).toBe('de');
    });

    it('nutzt Fallback wenn weder base noch Pfad', () => {
      const base = document.createElement('base');
      base.setAttribute('href', '/');
      document.head.prepend(base);
      window.history.pushState({}, '', '/legal/imprint');
      expect(getEffectiveLocale('it')).toBe('it');
    });

    it('nutzt localeIdToSupported wenn Base und Pfad fehlen', () => {
      const base = document.createElement('base');
      base.setAttribute('href', '/');
      document.head.prepend(base);
      window.history.pushState({}, '', '/legal/imprint');
      expect(getEffectiveLocale(localeIdToSupported('en-US'))).toBe('en');
    });
  });

  describe('resolveAssetUrlFromBase', () => {
    it('hängt assets an base href /en/', () => {
      const base = document.createElement('base');
      base.setAttribute('href', '/en/');
      document.head.prepend(base);
      expect(resolveAssetUrlFromBase('assets/legal/imprint.en.md')).toBe(
        `${window.location.origin}/en/assets/legal/imprint.en.md`,
      );
    });
  });

  describe('localeIdToSupported', () => {
    it('normalisiert en-US', () => {
      expect(localeIdToSupported('en-US')).toBe('en');
    });
  });
});
