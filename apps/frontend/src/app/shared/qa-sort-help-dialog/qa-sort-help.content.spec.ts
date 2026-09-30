import { describe, expect, it } from 'vitest';
import { QA_SORT_HELP_COPY, resolveQaSortHelpLocale } from './qa-sort-help.content';

describe('qa-sort-help.content', () => {
  it('resolves locale base tags', () => {
    expect(resolveQaSortHelpLocale('de')).toBe('de');
    expect(resolveQaSortHelpLocale('en-US')).toBe('en');
    expect(resolveQaSortHelpLocale('fr_FR')).toBe('fr');
    expect(resolveQaSortHelpLocale('pt')).toBe('de');
  });

  it('provides all five locales for BEST and CONTROVERSIAL', () => {
    for (const kind of ['BEST', 'CONTROVERSIAL'] as const) {
      for (const locale of ['de', 'en', 'fr', 'es', 'it'] as const) {
        const copy = QA_SORT_HELP_COPY[kind][locale];
        expect(copy.title.length).toBeGreaterThan(0);
        expect(copy.markdown.length).toBeGreaterThan(80);
      }
    }
  });

  it('completes Italian CONTROVERSIAL plain-language section', () => {
    expect(QA_SORT_HELP_COPY.CONTROVERSIAL.it.markdown).toContain('In parole semplici');
    expect(QA_SORT_HELP_COPY.CONTROVERSIAL.it.markdown).toContain('10 favorevoli, 10 contrari');
  });
});
