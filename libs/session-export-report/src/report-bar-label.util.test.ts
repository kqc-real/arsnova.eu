import { describe, expect, it } from 'vitest';
import { formatReportBarLabelHtml } from './report-bar-label.util';

const escape = (value: string) => value;

describe('formatReportBarLabelHtml', () => {
  it('trennt führendes Emoji vom Antworttext und fügt SVG-Icon sowie verborgenes Glyph ein', () => {
    const html = formatReportBarLabelHtml('😄 Bereit loszulegen', escape);
    expect(html).toContain('class="report-bar-leading-emoji"');
    expect(html).toContain('title="😄"');
    expect(html).toContain('class="report-emoji-svg-wrap"');
    expect(html).toContain('class="report-emoji-glyph"');
    expect(html).toContain('😄');
    expect(html).toContain('<span class="report-bar-label-text">Bereit loszulegen</span>');
  });

  it('erzeugt spezifisches SVG-Smiley für Stimmungsemojis', () => {
    expect(formatReportBarLabelHtml('😭 Gerade etwas überfordert', escape)).toContain(
      'report-emoji-svg-wrap',
    );
    expect(formatReportBarLabelHtml('😡 Genervt', escape)).toContain('report-bar-emoji-svg');
  });

  it('lässt reinen Text unverändert', () => {
    expect(formatReportBarLabelHtml('Echtes Foto', escape)).toBe('Echtes Foto');
  });

  it('rendert nur Emoji ohne Text mit SVG und Glyph', () => {
    const html = formatReportBarLabelHtml('😄', escape);
    expect(html).toContain('class="report-bar-leading-emoji"');
    expect(html).toContain('class="report-emoji-svg-wrap"');
    expect(html).not.toContain('report-bar-label-text');
  });
});
