import { describe, expect, it } from 'vitest';
import {
  formatLocaleCount,
  formatLocaleNumber,
  formatLocalePercentShare,
  formatLocalePercentShareFromCounts,
  formatLocaleScore,
  percentShareNeedsApproximation,
  percentValueNeedsApproximation,
} from './locale-number.util';

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

describe('formatLocalePercentShare', () => {
  it('setzt ca. nur bei gerundeten Anteilen, nie bei 0 % oder 100 %', () => {
    expect(percentShareNeedsApproximation(0, 30)).toBe(false);
    expect(percentShareNeedsApproximation(30, 30)).toBe(false);
    expect(percentShareNeedsApproximation(8, 30)).toBe(true);
    expect(percentShareNeedsApproximation(15, 30)).toBe(false);

    expect(formatLocalePercentShareFromCounts(0, 30, 'de')).toBe('0 %');
    expect(formatLocalePercentShareFromCounts(30, 30, 'de')).toBe('100 %');
    expect(formatLocalePercentShareFromCounts(8, 30, 'de')).toBe('ca. 27 %');
    expect(formatLocalePercentShareFromCounts(8, 30, 'de', { sentenceCase: true })).toBe(
      'Ca. 27 %',
    );
    expect(formatLocalePercentShareFromCounts(8, 30, 'en')).toBe('approx. 27%');
  });

  it('erkennt gerundete Prozentwerte ohne Zähler/Nenner', () => {
    expect(percentValueNeedsApproximation(0)).toBe(false);
    expect(percentValueNeedsApproximation(100)).toBe(false);
    expect(percentValueNeedsApproximation(90)).toBe(false);
    expect(percentValueNeedsApproximation(26.7)).toBe(true);
    expect(formatLocalePercentShare(26.7, 'de', { approximate: true })).toBe('ca. 27 %');
    expect(formatLocalePercentShare(0, 'de', { approximate: true })).toBe('0 %');
    expect(formatLocalePercentShare(100, 'de', { approximate: true })).toBe('100 %');
  });
});
