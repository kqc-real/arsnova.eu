import { describe, expect, it } from 'vitest';
import { getSessionResultsReportLabelsDe } from './labels-de';
import {
  renderNumericHistogramBandCaption,
  renderNumericHistogramOverlayElements,
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

  it('rendert Beschriftung mit Toleranzband und Referenz', () => {
    const caption = renderNumericHistogramBandCaption(context, labels, 'de');
    expect(caption).toContain('Toleranzband');
    expect(caption).toContain('Referenz');
    expect(caption).toContain('1789');
  });
});
