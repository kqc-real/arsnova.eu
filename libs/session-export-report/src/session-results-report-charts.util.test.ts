import { describe, expect, it } from 'vitest';
import { getSessionResultsReportLabelsDe } from './labels-de';
import {
  filterHistogramBinsForDisplay,
  renderConfidenceHeatmapHtml,
  renderHistogramHtml,
  renderStarRatingBarsHtml,
} from './session-results-report-charts.util';

describe('session-results-report-charts', () => {
  it('filtert leere Histogramm-Ränder', () => {
    const bins = [
      { from: 0, to: 1, count: 0, inBand: false },
      { from: 1, to: 2, count: 5, inBand: true },
      { from: 2, to: 3, count: 0, inBand: false },
    ];
    expect(filterHistogramBinsForDisplay(bins)).toHaveLength(1);
    expect(filterHistogramBinsForDisplay(bins)[0]?.count).toBe(5);
  });

  it('rendert Heatmap und Histogramm', () => {
    const heatmap = renderConfidenceHeatmapHtml(
      {
        correctHigh: 5,
        correctMid: 2,
        correctLow: 1,
        incorrectHigh: 3,
        incorrectMid: 1,
        incorrectLow: 0,
      },
      {
        title: 'Kreuztabelle',
        rowCorrect: 'Richtig',
        rowIncorrect: 'Falsch',
        tierLow: 'Niedrig',
        tierMid: 'Mittel',
        tierHigh: 'Hoch',
      },
      'de',
    );
    expect(heatmap).toContain('report-heatmap');
    expect(heatmap).toContain('report-heat--risk');

    const histogram = renderHistogramHtml(
      [
        { from: 1750, to: 1800, count: 18, inBand: true },
        { from: 1800, to: 1850, count: 3, inBand: false },
      ],
      'Verteilung',
      'de',
      undefined,
      {
        numericReferenceValue: 1789,
        numericTolerancePercent: 10,
        numericToleranceMode: 'RELATIVE_PERCENT',
        numericInputType: 'INTEGER',
        numericDecimalPlaces: 0,
        questionTextShort: 'Jahr der Revolution',
      },
      getSessionResultsReportLabelsDe(),
    );
    expect(histogram).toContain('report-histogram');
    expect(histogram).toContain('report-hist-col--in-band');
    expect(histogram).toContain('report-hist-band');
    expect(histogram).toContain('Toleranzband');
  });

  it('rendert Sterne-Balken', () => {
    const html = renderStarRatingBarsHtml({ '4': 3, '5': 7 }, 'Bewertung', 'de', 4.7);
    expect(html).toContain('report-bar-fill--rating');
    expect(html).toContain('4 ★');
  });
});
