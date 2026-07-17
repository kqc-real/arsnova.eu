import { describe, expect, it } from 'vitest';
import { getSessionResultsReportLabelsDe } from './labels-de';
import {
  filterHistogramBinsForDisplay,
  renderConfidenceDistributionBarsHtml,
  renderConfidenceHeatmapHtml,
  renderHistogramHtml,
  renderNumericRoundHistogramsHtml,
  renderOptionBarsHtml,
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
    const labels = getSessionResultsReportLabelsDe();
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
        cellCountNote: labels.heatmapCellCountNote,
        legendToneTitle: labels.heatmapLegendToneTitle,
        legendToneSuccess: labels.heatmapLegendToneSuccess,
        legendToneRisk: labels.heatmapLegendToneRisk,
        legendToneCaution: labels.heatmapLegendToneCaution,
        legendToneNeutral: labels.heatmapLegendToneNeutral,
        legendToneMid: labels.heatmapLegendToneMid,
        legendFrequencyHint: labels.heatmapLegendFrequencyHint,
        compactLegend: labels.heatmapCompactLegend,
      },
      'de',
    );
    expect(heatmap).toContain('report-heatmap');
    expect(heatmap).toContain('report-heat--risk');
    expect(heatmap).toContain('report-heat--mid');
    expect(heatmap).toContain('report-heat--fragile');
    expect(heatmap).toContain('✓ Gefestigt');
    expect(heatmap).toContain('report-heat-symbol');
    expect(heatmap).toContain('⚠');
    expect(heatmap).toContain('M');
    expect(heatmap).not.toContain('14 %');
    expect(heatmap).not.toContain('report-heatmap-legend-scale');
    expect(heatmap).not.toContain('report-heat-mini-fill');

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
    expect(histogram).not.toContain('report-hist-col--in-band');
    expect(histogram).toContain('report-hist-band');
    expect(histogram).not.toContain('report-hist-band-label');
    expect(histogram).toContain('Referenz: 1789');
    expect(histogram).toContain('Akzeptierter Bereich');
    expect(histogram).toContain('1750–1800');
    expect(histogram).not.toContain('1.750');
  });

  it('rendert MC-Fußnote bei Mehrfachauswahl', () => {
    const labels = getSessionResultsReportLabelsDe();
    const html = renderOptionBarsHtml(
      [
        { text: 'A', count: 20, percentage: 40, isCorrect: true },
        { text: 'B', count: 30, percentage: 60, isCorrect: false },
      ],
      labels.optionDistribution,
      { optionCorrect: labels.optionCorrect },
      'de',
      labels.optionDistributionMcNote,
      30,
      labels.optionDistributionValueTemplate,
    );
    expect(html).toContain('report-chart-footnote');
    expect(html).toContain('Mehrfachauswahl');
    expect(html).toContain('67 % · 20 von 30');
    expect(html).toContain('report-correct-marker');
  });

  it('rendert stets alle fünf Bewertungsstufen samt Endpunkten', () => {
    const html = renderStarRatingBarsHtml(
      { '4': 3, '5': 7 },
      'Bewertung',
      'de',
      4.7,
      undefined,
      '1 = sehr unwahrscheinlich · 5 = sehr wahrscheinlich',
    );
    expect(html).toContain('report-bar-fill--rating');
    expect(html).toContain('1 ★');
    expect(html).toContain('2 ★');
    expect(html).toContain('4 ★');
    expect(html).toContain('1 = sehr unwahrscheinlich');
  });

  it('blendet Runde 2 ohne Stimmen und ein konstantes Delta-Histogramm aus', () => {
    const stats = {
      n: 2,
      mean: 10,
      median: 10,
      stdDev: 0,
      q1: 10,
      q3: 10,
      iqr: 0,
      min: 10,
      max: 10,
      inBandCount: 2,
      inBandPercent: 100,
      meanAbsoluteError: 0,
      meanRelativeError: 0,
    };
    const oneRound = renderNumericRoundHistogramsHtml(
      {
        round1Stats: stats,
        round2Stats: { ...stats, n: 0 },
        round1Histogram: [{ from: 10, to: 10, count: 2, inBand: true }],
        round2Histogram: [],
      },
      undefined,
      {
        round1: 'Runde 1',
        round2: 'Runde 2',
        delta: 'Delta',
        identical: 'Beide Runden',
        identicalNote: 'Keine sichtbare Veränderung – beide Verteilungen sind identisch.',
      },
      'de',
    );
    expect(oneRound).toBe('');

    const unchanged = renderNumericRoundHistogramsHtml(
      {
        round1Stats: stats,
        round2Stats: stats,
        round1Histogram: [{ from: 10, to: 10, count: 2, inBand: true }],
        round2Histogram: [{ from: 10, to: 10, count: 2, inBand: true }],
        deltaHistogram: [{ from: 0, to: 0, count: 2, inBand: false }],
        pairedAnalysis: {
          pairedCount: 2,
          closerCount: 0,
          fartherCount: 0,
          unchangedCount: 2,
        },
      },
      undefined,
      {
        round1: 'Runde 1',
        round2: 'Runde 2',
        delta: 'Delta',
        identical: 'Beide Runden',
        identicalNote: 'Keine sichtbare Veränderung – beide Verteilungen sind identisch.',
      },
      'de',
    );
    expect(unchanged).not.toContain('Delta');
    expect(unchanged).toContain('beide Verteilungen sind identisch');
    expect(unchanged.match(/report-histogram-stage/g)).toHaveLength(1);

    const withChange = renderNumericRoundHistogramsHtml(
      {
        round1Stats: stats,
        round2Stats: { ...stats, mean: 9 },
        round1Histogram: [{ from: 8, to: 10, count: 2, inBand: true }],
        round2Histogram: [{ from: 9, to: 11, count: 2, inBand: true }],
        pairedAnalysis: {
          pairedCount: 4,
          closerCount: 2,
          fartherCount: 0,
          unchangedCount: 2,
        },
      },
      undefined,
      {
        round1: 'Runde 1',
        round2: 'Runde 2',
        delta: 'Delta',
      },
      'de',
      undefined,
      getSessionResultsReportLabelsDe(),
    );
    expect(withChange).not.toContain('Delta');
    expect(withChange).toContain('report-peer-change');
    expect(withChange).toContain('Veränderung zum Referenzwert');
  });

  it('zeichnet für eine leere Sicherheitsstufe nur eine Grundlinie', () => {
    const labels = getSessionResultsReportLabelsDe();
    const html = renderConfidenceDistributionBarsHtml(
      {
        distribution: { '1': 0, '2': 2, '3': 3, '4': 4, '5': 5 },
        crossTab: {
          correctHigh: 5,
          correctMid: 3,
          correctLow: 2,
          incorrectHigh: 4,
          incorrectMid: 0,
          incorrectLow: 0,
        },
        highConfidenceWrongCount: 4,
      },
      labels.confidenceDistributionTitle,
      'de',
      labels.confidenceScaleEndpoints,
      labels.confidenceDistributionAxis,
    );
    expect(html).toContain('report-vbar-track--zero');
    expect(html).toContain('Anzahl Antworten');
  });
});
