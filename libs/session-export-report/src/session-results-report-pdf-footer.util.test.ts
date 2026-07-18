import { describe, expect, it } from 'vitest';
import { getSessionResultsReportLabelsDe } from './labels-de';
import {
  buildSessionResultsPdfFooterTemplate,
  buildSessionResultsPlaywrightPdfOptions,
  buildSessionResultsPrintPageFooterCss,
  displayQuizNameForPdfHeader,
} from './session-results-report-pdf-footer.util';

describe('session-results-report-pdf-footer', () => {
  it('baut Playwright-Footer mit Seitenzahlen-Platzhaltern', () => {
    const footer = buildSessionResultsPdfFooterTemplate(getSessionResultsReportLabelsDe());
    expect(footer).toContain('class="pageNumber"');
    expect(footer).toContain('class="totalPages"');
    expect(footer).toContain('Seite');
  });

  it('baut lokalisiertes @page-CSS für Browser-Druck', () => {
    const css = buildSessionResultsPrintPageFooterCss(getSessionResultsReportLabelsDe());
    expect(css).toContain('@bottom-center');
    expect(css).toContain('counter(page)');
    expect(css).toContain('counter(pages)');
    expect(css).toContain('Seite');
  });

  it('liefert Playwright-PDF-Optionen mit Footer und Tagging', () => {
    const options = buildSessionResultsPlaywrightPdfOptions(getSessionResultsReportLabelsDe(), {
      quizName: 'Demo Quiz',
      sessionCode: 'ABC123',
    });
    expect(options.displayHeaderFooter).toBe(true);
    expect(options.footerTemplate).toContain('pageNumber');
    expect(options.headerTemplate).toContain('Demo Quiz');
    expect(options.margin.bottom).toBe('20mm');
    expect(options.tagged).toBe(true);
    expect(options.outline).toBe(true);
  });

  it('entfernt Millisekunden-Timestamps aus der Kopfzeilen-Quizbezeichnung', () => {
    expect(displayQuizNameForPdfHeader('Praxis-Showcase · Didaktik-Demo 1784290777950')).toBe(
      'Praxis-Showcase',
    );
    expect(displayQuizNameForPdfHeader('Quiz 1784290777950123')).toBe('Quiz');
    expect(displayQuizNameForPdfHeader('Praxis-Showcase · Didaktik-Demo')).toBe(
      'Praxis-Showcase · Didaktik-Demo',
    );
  });
});
