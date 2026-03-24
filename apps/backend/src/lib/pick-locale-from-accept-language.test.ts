import { describe, expect, it } from 'vitest';
import { pickLocaleFromAcceptLanguage } from './pick-locale-from-accept-language';

const available = ['de', 'en', 'fr', 'it', 'es'] as const;

describe('pickLocaleFromAcceptLanguage', () => {
  it('nutzt die höchste q und passt Region an', () => {
    expect(pickLocaleFromAcceptLanguage('en-AU,en;q=0.9,de;q=0.8', available, 'de')).toBe('en');
  });

  it('bevorzugt de vor de-CH wenn explizit gelistet', () => {
    expect(pickLocaleFromAcceptLanguage('de-CH,fr;q=0.5', available, 'de')).toBe('de');
  });

  it('respektiert Reihenfolge bei gleicher q=1', () => {
    expect(pickLocaleFromAcceptLanguage('de,en', available, 'de')).toBe('de');
    expect(pickLocaleFromAcceptLanguage('en,de', available, 'de')).toBe('en');
  });

  it('fällt auf fallback bei unbekannter Sprache', () => {
    expect(pickLocaleFromAcceptLanguage('pt-BR,zh-CN', available, 'de')).toBe('de');
  });

  it('bei fehlendem Header: fallback', () => {
    expect(pickLocaleFromAcceptLanguage(undefined, available, 'de')).toBe('de');
    expect(pickLocaleFromAcceptLanguage('', available, 'de')).toBe('de');
  });
});
