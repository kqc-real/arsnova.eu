import { afterEach, describe, expect, it } from 'vitest';
import {
  getBrowserLanguagePreference,
  getEffectiveLocale,
  getHomeLanguagePreference,
  getLocaleFromBaseHref,
  getLocaleFromPath,
  HOME_LANGUAGE_LOCAL_STORAGE_KEY,
  getPreferredJoinLocale,
  localeIdToSupported,
  parseLeadingLocaleFromPathOrUrl,
  resolveAssetUrlFromBase,
} from './locale-from-path';

describe('locale-from-path', () => {
  afterEach(() => {
    document.querySelectorAll('base').forEach((el) => el.remove());
    window.history.pushState({}, '', '/');
    localStorage.removeItem(HOME_LANGUAGE_LOCAL_STORAGE_KEY);
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

  describe('parseLeadingLocaleFromPathOrUrl', () => {
    it('erkennt Locale in Router-URL', () => {
      expect(parseLeadingLocaleFromPathOrUrl('/it/help')).toBe('it');
      expect(parseLeadingLocaleFromPathOrUrl('fr/quiz')).toBe('fr');
    });
  });

  describe('getHomeLanguagePreference', () => {
    it('liest gespeicherte Toolbar-Sprache', () => {
      localStorage.setItem(HOME_LANGUAGE_LOCAL_STORAGE_KEY, 'es');
      expect(getHomeLanguagePreference()).toBe('es');
      localStorage.removeItem(HOME_LANGUAGE_LOCAL_STORAGE_KEY);
      expect(getHomeLanguagePreference()).toBeNull();
    });
  });

  describe('getBrowserLanguagePreference', () => {
    it('normalisiert navigator.languages auf unterstützte Locale', () => {
      const originalLanguages = navigator.languages;
      const originalLanguage = navigator.language;
      Object.defineProperty(navigator, 'languages', {
        configurable: true,
        value: ['fr-FR', 'en-US'],
      });
      Object.defineProperty(navigator, 'language', {
        configurable: true,
        value: 'fr-FR',
      });

      try {
        expect(getBrowserLanguagePreference()).toBe('fr');
      } finally {
        Object.defineProperty(navigator, 'languages', {
          configurable: true,
          value: originalLanguages,
        });
        Object.defineProperty(navigator, 'language', {
          configurable: true,
          value: originalLanguage,
        });
      }
    });
  });

  describe('getPreferredJoinLocale', () => {
    it('bevorzugt gespeicherte Sprache vor Browser-Sprache', () => {
      const originalLanguages = navigator.languages;
      const originalLanguage = navigator.language;
      Object.defineProperty(navigator, 'languages', {
        configurable: true,
        value: ['fr-FR', 'en-US'],
      });
      Object.defineProperty(navigator, 'language', {
        configurable: true,
        value: 'fr-FR',
      });
      localStorage.setItem(HOME_LANGUAGE_LOCAL_STORAGE_KEY, 'it');

      try {
        expect(getPreferredJoinLocale()).toBe('it');
      } finally {
        Object.defineProperty(navigator, 'languages', {
          configurable: true,
          value: originalLanguages,
        });
        Object.defineProperty(navigator, 'language', {
          configurable: true,
          value: originalLanguage,
        });
      }
    });

    it('fällt auf Browser-Sprache zurück, wenn nichts gespeichert ist', () => {
      const originalLanguages = navigator.languages;
      const originalLanguage = navigator.language;
      Object.defineProperty(navigator, 'languages', {
        configurable: true,
        value: ['es-ES', 'en-US'],
      });
      Object.defineProperty(navigator, 'language', {
        configurable: true,
        value: 'es-ES',
      });

      try {
        expect(getPreferredJoinLocale()).toBe('es');
      } finally {
        Object.defineProperty(navigator, 'languages', {
          configurable: true,
          value: originalLanguages,
        });
        Object.defineProperty(navigator, 'language', {
          configurable: true,
          value: originalLanguage,
        });
      }
    });
  });
});
