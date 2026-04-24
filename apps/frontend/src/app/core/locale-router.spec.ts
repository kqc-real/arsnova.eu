import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocaleFromPath } from './locale-from-path';
import {
  isAppHomeRouterUrl,
  localizeCommands,
  localizePath,
  resolveLocalizedAppUrl,
} from './locale-router';

vi.mock('./locale-from-path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./locale-from-path')>();
  return {
    ...actual,
    getLocaleFromPath: vi.fn(actual.getLocaleFromPath),
  };
});

describe('locale-router', () => {
  afterEach(() => {
    document.querySelectorAll('base').forEach((el) => el.remove());
  });

  describe('isAppHomeRouterUrl (Toolbar showHomeLink)', () => {
    it('erkennt Startseite ohne und mit Locale-Präfix', () => {
      expect(isAppHomeRouterUrl('/')).toBe(true);
      expect(isAppHomeRouterUrl('/de')).toBe(true);
      expect(isAppHomeRouterUrl('/de/')).toBe(true);
      expect(isAppHomeRouterUrl('/en')).toBe(true);
      expect(isAppHomeRouterUrl('/fr/')).toBe(true);
    });

    it('ignoriert Query und Hash', () => {
      expect(isAppHomeRouterUrl('/?tab=1')).toBe(true);
      expect(isAppHomeRouterUrl('/de#section')).toBe(true);
      expect(isAppHomeRouterUrl('/de/quiz?x=1')).toBe(false);
    });

    it('keine Startseite bei echten Unterpfaden', () => {
      expect(isAppHomeRouterUrl('/quiz')).toBe(false);
      expect(isAppHomeRouterUrl('/de/quiz')).toBe(false);
      expect(isAppHomeRouterUrl('/legal/imprint')).toBe(false);
    });
  });

  describe('mit <base href="/de/"> (localized Production)', () => {
    beforeEach(() => {
      const base = document.createElement('base');
      base.setAttribute('href', '/de/');
      document.head.prepend(base);
      vi.mocked(getLocaleFromPath).mockReturnValue('de');
    });

    it('localizePath: kein doppeltes Locale-Segment', () => {
      expect(localizePath('/legal/privacy')).toBe('/legal/privacy');
      expect(localizePath('/')).toBe('/');
    });

    it('localizePath: entfernt führendes Locale falls vorhanden', () => {
      expect(localizePath('/de/legal/privacy')).toBe('/legal/privacy');
    });

    it('resolveLocalizedAppUrl: baut absolute URLs unter dem localized base href', () => {
      expect(resolveLocalizedAppUrl('/join/ABC123')).toBe(
        `${window.location.origin}/de/join/ABC123`,
      );
    });

    it('localizeCommands: kein prepend von de', () => {
      expect(localizeCommands(['quiz', 'abc'])).toEqual(['quiz', 'abc']);
    });

    it('localizeCommands: entfernt führendes Locale-Segment', () => {
      expect(localizeCommands(['de', 'quiz', 'abc'])).toEqual(['quiz', 'abc']);
    });
  });

  describe('mit <base href="/"> (Dev)', () => {
    beforeEach(() => {
      const base = document.createElement('base');
      base.setAttribute('href', '/');
      document.head.prepend(base);
      vi.mocked(getLocaleFromPath).mockReturnValue('de');
    });

    it('localizePath: Locale voranstellen', () => {
      expect(localizePath('/legal/privacy')).toBe('/de/legal/privacy');
      expect(localizePath('/')).toBe('/de');
    });

    it('resolveLocalizedAppUrl: baut absolute URLs mit Locale-Präfix im Pfad', () => {
      expect(resolveLocalizedAppUrl('/join/ABC123')).toBe(
        `${window.location.origin}/de/join/ABC123`,
      );
    });

    it('localizeCommands: Locale voranstellen', () => {
      expect(localizeCommands(['quiz', 'x'])).toEqual(['de', 'quiz', 'x']);
    });
  });
});
