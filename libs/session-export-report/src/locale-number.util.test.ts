import { describe, expect, it } from 'vitest';
import {
  formatLocaleColon,
  formatLocaleConjunctionList,
  formatLocaleCount,
  formatLocaleDisjunctionList,
  formatLocaleNumber,
  formatLocalePercentShare,
  formatLocalePercentShareFromCounts,
  formatLocalePercentUnit,
  formatLocalePercentValue,
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
    expect(formatLocalePercentShareFromCounts(8, 30, 'en')).toBe('about 27%');
    expect(formatLocalePercentShareFromCounts(8, 30, 'fr')).toBe('environ 27 %');
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

  it('setzt kein Leerzeichen vor % im Englischen', () => {
    expect(formatLocalePercentUnit('en')).toBe('%');
    expect(formatLocalePercentUnit('de')).toBe(' %');
    expect(formatLocalePercentValue(40, 'en')).toBe('40%');
    expect(formatLocalePercentValue(83.3, 'en', { maximumFractionDigits: 1 })).toBe('83.3%');
    expect(formatLocalePercentValue(40, 'de')).toBe('40 %');
  });
});

describe('formatLocaleConjunctionList', () => {
  it('setzt im Englischen ein Oxford-and', () => {
    expect(formatLocaleConjunctionList(['7', '3', '6'], 'en')).toBe('7, 3, and 6');
    expect(formatLocaleConjunctionList(['7', '3', '6'], 'de')).toBe('7, 3 und 6');
  });
});

describe('formatLocaleDisjunctionList', () => {
  it('setzt im Englischen or', () => {
    expect(formatLocaleDisjunctionList(['Question 1 (Survey)', 'Question 9 (Rating)'], 'en')).toBe(
      'Question 1 (Survey) or Question 9 (Rating)',
    );
  });
});

describe('formatLocaleColon', () => {
  it('setzt im Französischen ein geschütztes Leerzeichen (NBSP) vor dem Doppelpunkt', () => {
    expect(formatLocaleColon('fr')).toBe('\u00A0:');
    expect(formatLocaleColon('en')).toBe(':');
    expect(formatLocaleColon('de')).toBe(':');
  });
});
