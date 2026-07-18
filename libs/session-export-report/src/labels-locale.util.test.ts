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
    expect(getSessionResultsReportLabelsFr().coverTitle).toBe('Analyse pédagogique du quiz');
    expect(getSessionResultsReportLabelsEs().coverTitle).toBe(
      'Análisis pedagógico del cuestionario',
    );
    expect(getSessionResultsReportLabelsIt().coverTitle).toBe('Analisi didattica del quiz');
    expect(getSessionResultsReportLabelsForLocale('fr-FR').tableOfContentsTitle).toBe('Contenu');
  });

  it('behält DE/EN getrennt', () => {
    expect(getSessionResultsReportLabelsDe().coverTitle).toBe('Didaktische Quiz-Auswertung');
    expect(getSessionResultsReportLabelsEn().coverTitle).toBe('Quiz Insights for Teaching');
    expect(getSessionResultsReportLabelsDe().documentTitle).toBe('Didaktische Quiz-Auswertung');
    expect(getSessionResultsReportLabelsEn().documentTitle).toBe('Quiz Insights for Teaching');
  });

  it('lokalisiert neue Cover-/Fragen-Labels auch in FR/ES/IT', () => {
    const de = getSessionResultsReportLabelsDe();
    for (const labels of [
      getSessionResultsReportLabelsFr(),
      getSessionResultsReportLabelsEs(),
      getSessionResultsReportLabelsIt(),
    ]) {
      expect(labels.questionsLead).not.toBe(de.questionsLead);
      expect(labels.backToOverview).not.toBe(de.backToOverview);
      expect(labels.lowSuccessRateHintTemplate).not.toBe(de.lowSuccessRateHintTemplate);
      expect(labels.coverSummaryRiskNote).not.toBe(de.coverSummaryRiskNote);
    }
    expect(getSessionResultsReportLabelsFr().backToOverview).toBe('↑ Retour à l’aperçu');
    expect(getSessionResultsReportLabelsEs().backToOverview).toBe('↑ Volver al resumen');
    expect(getSessionResultsReportLabelsIt().backToOverview).toBe('↑ Torna alla panoramica');
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
