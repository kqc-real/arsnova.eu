import { describe, expect, it } from 'vitest';
import { formatLocaleCount, formatLocaleNumber, formatLocaleScore } from './locale-number.util';

describe('formatLocaleScore', () => {
  it('formatiert Punkte mit lokaler Tausendertrennung', () => {
    expect(formatLocaleScore(8832, 'de')).toBe('8.832');
    expect(formatLocaleScore(8832.5, 'de', { maximumFractionDigits: 1 })).toBe('8.832,5');
  });
});

describe('formatLocaleNumber', () => {
  it('kann Tausendertrennung deaktivieren', () => {
    expect(formatLocaleNumber(1789, 'de', { useGrouping: false })).toBe('1789');
  });
});

describe('formatLocaleCount', () => {
  it('behält Tausendertrennung für große Zählwerte', () => {
    expect(formatLocaleCount(8832, 'de')).toBe('8.832');
  });
});
