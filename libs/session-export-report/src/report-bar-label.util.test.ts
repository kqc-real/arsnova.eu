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

  it('hält verschiedene Stimmungsemojis visuell unterscheidbar und schriftunabhängig', () => {
    const happy = formatReportBarLabelHtml('😄 Sehr gut', escape);
    const grinning = formatReportBarLabelHtml('😀 Grinsend', escape);

    expect(happy).toContain('report-emoji-svg-wrap');
    expect(grinning).toContain('report-emoji-svg-wrap');
    expect(happy).not.toEqual(grinning);
  });

  it('lokalisiert PDF/UA Fallback-Labels in allen 5 unterstützten Sprachen (de, en, fr, es, it)', () => {
    expect(formatReportBarLabelHtml('😄', escape, 'de')).toContain('[Stimmung: Sehr gut]');
    expect(formatReportBarLabelHtml('😄', escape, 'en')).toContain('[Mood: Very good]');
    expect(formatReportBarLabelHtml('😄', escape, 'fr')).toContain('[Humeur : Très bien]');
    expect(formatReportBarLabelHtml('😄', escape, 'es')).toContain('[Estado: Muy bien]');
    expect(formatReportBarLabelHtml('😄', escape, 'it')).toContain('[Umore: Molto bene]');

    expect(formatReportBarLabelHtml('👍', escape, 'en')).toContain('[Choice: Yes]');
    expect(formatReportBarLabelHtml('👍', escape, 'es')).toContain('[Opción: Sí]');
    expect(formatReportBarLabelHtml('👍', escape, 'it')).toContain('[Scelta: Sì]');

    expect(formatReportBarLabelHtml('🐶', escape, 'en')).toContain('[Option]');
    expect(formatReportBarLabelHtml('🐶', escape, 'es')).toContain('[Opción]');
    expect(formatReportBarLabelHtml('🐶', escape, 'it')).toContain('[Opzione]');
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

  it('bewahrt die Identität von nicht gemappten Emojis mit SVG-Bullet und lokalisiertem Text-Fallback', () => {
    const htmlDog = formatReportBarLabelHtml('🐶 Hund', escape, 'en');
    const htmlCat = formatReportBarLabelHtml('🐱 Katze', escape, 'en');

    expect(htmlDog).toContain('report-bar-bullet-svg');
    expect(htmlDog).toContain('🐶');
    expect(htmlDog).toContain('[Option]');
    expect(htmlCat).toContain('report-bar-bullet-svg');
    expect(htmlCat).toContain('🐱');
    expect(htmlDog).not.toEqual(htmlCat);
  });
});
