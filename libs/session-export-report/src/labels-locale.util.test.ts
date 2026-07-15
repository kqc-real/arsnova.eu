import { describe, expect, it } from 'vitest';
import {
  getSessionResultsReportLabelsDe,
  getSessionResultsReportLabelsEn,
  getSessionResultsReportLabelsEs,
  getSessionResultsReportLabelsFr,
  getSessionResultsReportLabelsIt,
  getSessionResultsReportLabelsForLocale,
} from './labels-locale.util';
import { REPORT_COVER_LOGO_SVG } from './report-cover-logo';

describe('labels-locale', () => {
  it('liefert FR/ES/IT statt EN-Fallback', () => {
    expect(getSessionResultsReportLabelsFr().coverTitle).toBe('Rapport de résultats');
    expect(getSessionResultsReportLabelsEs().coverTitle).toBe('Informe de resultados');
    expect(getSessionResultsReportLabelsIt().coverTitle).toBe('Rapporto sui risultati');
    expect(getSessionResultsReportLabelsForLocale('fr-FR').tableOfContentsTitle).toBe('Contenu');
  });

  it('behält DE/EN getrennt', () => {
    expect(getSessionResultsReportLabelsDe().coverTitle).toBe('Ergebnisbericht');
    expect(getSessionResultsReportLabelsEn().coverTitle).toBe('Results report');
  });
});

describe('report-cover-logo', () => {
  it('entspricht dem Toolbar-Marken-Icon (EU-Stern, nicht PWA-Icon)', () => {
    expect(REPORT_COVER_LOGO_SVG).toContain('report-cover-logo-svg');
    expect(REPORT_COVER_LOGO_SVG).toContain('#002395');
    expect(REPORT_COVER_LOGO_SVG).toContain('#ffcc00');
    expect(REPORT_COVER_LOGO_SVG).not.toContain('>ars</text>');
    expect(REPORT_COVER_LOGO_SVG).not.toContain('>nova</text>');
  });
});
