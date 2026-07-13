import { describe, expect, it } from 'vitest';
import {
  formatLocaleCount,
  formatLocaleNumber,
  formatLocalePercent,
  formatLocaleBadgeCount,
} from './locale-number.util';

describe('locale-number util', () => {
  it('formatiert Ganzzahlen locale-spezifisch', () => {
    expect(formatLocaleCount(2126, 'de')).toBe('2.126');
    expect(formatLocaleCount(2126, 'en')).toBe('2,126');
    expect(formatLocaleCount(98, 'de')).toBe('98');
  });

  it('faellt bei ungueltigen Werten auf 0 zurueck', () => {
    expect(formatLocaleCount(Number.NaN, 'de')).toBe('0');
    expect(formatLocaleCount(Number.POSITIVE_INFINITY, 'en')).toBe('0');
  });

  it('formatiert Dezimalzahlen mit konfigurierbaren Nachkommastellen', () => {
    expect(
      formatLocaleNumber(4.25, 'de', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    ).toBe('4,3');
    expect(
      formatLocaleNumber(4.25, 'en', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    ).toBe('4.3');
  });

  it('formatiert Prozentwerte', () => {
    expect(formatLocalePercent(33.3, 'de', 1)).toBe('33,3');
    expect(formatLocalePercent(50, 'en', 0)).toBe('50');
  });

  it('formatiert Badge-Zaehler mit Obergrenze', () => {
    expect(formatLocaleBadgeCount(5, 'de')).toBe('5');
    expect(formatLocaleBadgeCount(120, 'de')).toBe('99+');
    expect(formatLocaleBadgeCount(1_500, 'en')).toBe('99+');
  });
});
