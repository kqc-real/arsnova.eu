import { describe, expect, it } from 'vitest';
import { formatReportBarLabelHtml } from './report-bar-label.util';

const escape = (value: string) => value;

describe('formatReportBarLabelHtml', () => {
  it('trennt führendes Emoji vom Antworttext', () => {
    expect(formatReportBarLabelHtml('😄 Bereit loszulegen', escape)).toBe(
      '<span class="report-bar-leading-emoji">😄</span><span class="report-bar-label-text">Bereit loszulegen</span>',
    );
    expect(formatReportBarLabelHtml('😭 Gerade etwas überfordert', escape)).toContain(
      'report-bar-label-text',
    );
  });

  it('lässt reinen Text unverändert', () => {
    expect(formatReportBarLabelHtml('Echtes Foto', escape)).toBe('Echtes Foto');
  });

  it('rendert nur Emoji ohne Text', () => {
    expect(formatReportBarLabelHtml('😄', escape)).toBe(
      '<span class="report-bar-leading-emoji">😄</span>',
    );
  });
});
