import { describe, expect, it } from 'vitest';
import { localesToMap, resolveMotdMarkdown } from './motdMarkdown';

describe('resolveMotdMarkdown', () => {
  it('nutzt angefragte Locale wenn befüllt', () => {
    const m = localesToMap([{ locale: 'de', markdown: 'Hallo' }]);
    expect(resolveMotdMarkdown(m, 'de')).toBe('Hallo');
  });

  it('fällt auf de dann en zurück', () => {
    const m = localesToMap([
      { locale: 'de', markdown: 'Deutsch' },
      { locale: 'en', markdown: 'English' },
    ]);
    expect(resolveMotdMarkdown(m, 'fr')).toBe('Deutsch');
  });

  it('überspringt leere Strings in der Kette', () => {
    const m = localesToMap([
      { locale: 'de', markdown: '   ' },
      { locale: 'en', markdown: 'OK' },
    ]);
    expect(resolveMotdMarkdown(m, 'de')).toBe('OK');
  });
});
