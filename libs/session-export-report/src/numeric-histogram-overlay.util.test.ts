import { describe, expect, it } from 'vitest';
import { getSessionResultsReportLabelsDe } from './labels-de';
import {
  renderNumericHistogramBandCaption,
  renderNumericHistogramOverlayElements,
  renderNumericInBandSummaryHtml,
} from './numeric-histogram-overlay.util';

describe('numeric-histogram-overlay', () => {
  const labels = getSessionResultsReportLabelsDe();
  const context = {
    numericReferenceValue: 1789,
    numericTolerancePercent: 10,
    numericToleranceMode: 'RELATIVE_PERCENT',
    numericInputType: 'INTEGER' as const,
    numericDecimalPlaces: 0,
    questionTextShort: 'Jahr der Französischen Revolution',
  };

  const bins = [
    { from: 1700, to: 1750, count: 2, inBand: false },
    { from: 1750, to: 1800, count: 18, inBand: true },
    { from: 1800, to: 1850, count: 3, inBand: false },
  ];

  it('rendert Toleranzband und Referenzlinie im Histogramm', () => {
    const html = renderNumericHistogramOverlayElements(bins, context);
    expect(html).toContain('report-hist-band');
    expect(html).toContain('report-hist-reference');
    expect(html).toContain('left:');
  });

  it('rendert Beschriftung mit akzeptiertem Bereich und Referenz', () => {
    const caption = renderNumericHistogramBandCaption(context, labels, 'de');
    expect(caption).toContain('Akzeptierter Bereich');
    expect(caption).toContain('Referenz');
    expect(caption).toContain('1789');
  });

  it('beschriftet den akzeptierten Bereich als Bildunterschrift', () => {
    const caption = renderNumericHistogramBandCaption(context, labels, 'de');
    expect(caption).toContain('report-numeric-band-caption');
  });

  it('stellt den Anteil im akzeptierten Bereich als Hauptbotschaft dar', () => {
    const summary = renderNumericInBandSummaryHtml(
      { n: 30, inBandCount: 30 },
      {
        numericReferenceValue: 3.14,
        numericTolerancePercent: null,
        numericToleranceMode: 'ABSOLUTE_INTERVAL',
        numericIntervalLeft: 3.1,
        numericIntervalRight: 3.2,
        numericInputType: 'DECIMAL',
        numericDecimalPlaces: 2,
        questionTextShort: 'π',
      },
      labels,
      'de',
    );
    expect(summary).toContain('report-numeric-primary');
    expect(summary).toContain('30 von 30 Antworten lagen im akzeptierten Bereich');
    expect(summary).toContain('3,10–3,20');
  });
});
