import { describe, expect, it } from 'vitest';
import { getSessionResultsReportLabelsDe } from './labels-locale.util';
import { renderQaSectionHtml } from './session-results-report-layout.util';

describe('begrenzter Q&A-PDF-Export', () => {
  it('weist einen gerankten Teilausschnitt aus und leitet daraus keine Vollbestandsanalyse ab', () => {
    const questions = Array.from({ length: 500 }, (_, index) => ({
      order: index + 1,
      text: `Frage ${index + 1}`,
      status: 'ACTIVE' as const,
      upvoteCount: 500 - index,
    }));

    const html = renderQaSectionHtml(questions, getSessionResultsReportLabelsDe(), 'de-DE', 25_000);

    expect(html).toContain(
      'Gezeigt werden die 500 höchstplatzierten von 25.000 exportierbaren Fragen.',
    );
    expect(html).not.toContain('report-followup');
    expect((html.match(/<tr>/gu) ?? []).length).toBe(501);
  });
});
