import { describe, expect, it } from 'vitest';
import { QA_SEARCH_MIN_LENGTH, normalizeQaSearchQuery } from './qa-search.util';

describe('normalizeQaSearchQuery', () => {
  it('startet die Suche erst ab der Mindestlänge', () => {
    expect(QA_SEARCH_MIN_LENGTH).toBe(2);
    expect(normalizeQaSearchQuery('')).toBe('');
    expect(normalizeQaSearchQuery(' ')).toBe('');
    expect(normalizeQaSearchQuery('a')).toBe('');
    expect(normalizeQaSearchQuery(' a ')).toBe('');
    expect(normalizeQaSearchQuery('ab')).toBe('ab');
    expect(normalizeQaSearchQuery('  klausur  ')).toBe('klausur');
  });
});
