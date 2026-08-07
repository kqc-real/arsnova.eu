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

  it('erzeugt spezifisches SVG-Smiley für primäre Stimmungsemojis', () => {
    expect(formatReportBarLabelHtml('😢 Gerade etwas überfordert', escape)).toContain(
      'report-emoji-svg-wrap',
    );
    expect(formatReportBarLabelHtml('😡 Genervt', escape)).toContain('report-bar-emoji-svg');
  });

  it('hält verschiedene Stimmungsemojis visuell unterscheidbar', () => {
    const happy = formatReportBarLabelHtml('😄 Sehr gut', escape);
    const grinning = formatReportBarLabelHtml('😀 Grinsend', escape);

    expect(happy).toContain('report-emoji-svg-wrap');
    expect(grinning).toContain('report-emoji-glyph--unmapped');
    expect(happy).not.toEqual(grinning);
  });

  it('lässt reinen Text unverändert', () => {
    expect(formatReportBarLabelHtml('Echtes Foto', escape)).toBe('Echtes Foto');
  });

  it('rendert nur Emoji ohne Text mit SVG, Glyph und schriftunabhängigem Fallback', () => {
    const html = formatReportBarLabelHtml('😄', escape);
    expect(html).toContain('class="report-bar-leading-emoji"');
    expect(html).toContain('class="report-emoji-svg-wrap"');
    expect(html).toContain('class="report-emoji-text-fallback"');
    expect(html).toContain('[Stimmung: Sehr gut]');
    expect(html).not.toContain('report-bar-label-text');
  });

  it('bewahrt die Identität von nicht gemappten Emojis als sichtbare Glyphen', () => {
    const htmlDog = formatReportBarLabelHtml('🐶 Hund', escape);
    const htmlCat = formatReportBarLabelHtml('🐱 Katze', escape);

    expect(htmlDog).toContain('report-emoji-glyph--unmapped');
    expect(htmlDog).toContain('🐶');
    expect(htmlCat).toContain('report-emoji-glyph--unmapped');
    expect(htmlCat).toContain('🐱');
    expect(htmlDog).not.toEqual(htmlCat);
  });
});
