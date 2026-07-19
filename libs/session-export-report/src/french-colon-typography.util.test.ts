import { describe, expect, it } from 'vitest';
import {
  applyFrenchColonTypography,
  applyFrenchColonTypographyToHtml,
  applyFrenchColonTypographyToLabels,
} from './french-colon-typography.util';

describe('applyFrenchColonTypography', () => {
  it('setzt NBSP vor Doppelpunkten und normalisiert vorhandene Leerzeichen', () => {
    expect(applyFrenchColonTypography('Réponses correctes:')).toBe('Réponses correctes\u00A0:');
    expect(applyFrenchColonTypography('Plage acceptée :')).toBe('Plage acceptée\u00A0:');
    expect(applyFrenchColonTypography('Référence\u202F:')).toBe('Référence\u00A0:');
    expect(applyFrenchColonTypography('conceptions erronées:')).toBe('conceptions erronées\u00A0:');
  });

  it('lässt URLs, Uhrzeiten und Code unverändert', () => {
    expect(applyFrenchColonTypography('siehe https://arsnova.eu/docs: tip')).toBe(
      'siehe https://arsnova.eu/docs: tip',
    );
    expect(applyFrenchColonTypography('Ende um 8:41')).toBe('Ende um 8:41');
    expect(applyFrenchColonTypography('Pfad C:\\Temp\\x')).toBe('Pfad C:\\Temp\\x');
    expect(applyFrenchColonTypography('code `ratio:1` und Text:')).toBe(
      'code `ratio:1` und Text\u00A0:',
    );
  });

  it('lässt Emoji-Shortcodes unverändert', () => {
    expect(applyFrenchColonTypography(':smile: Prêt·e')).toBe(':smile: Prêt·e');
    expect(applyFrenchColonTypography('Stimmung :smile: und Hinweis:')).toBe(
      'Stimmung :smile: und Hinweis\u00A0:',
    );
  });
});

describe('applyFrenchColonTypographyToHtml', () => {
  it('ändert nur Textknoten, nicht Attribute oder style/code', () => {
    const html =
      '<p style="color:red">Réponses correctes:</p><code>a:b</code><a href="https://x.test/a:b">Link:</a>';
    expect(applyFrenchColonTypographyToHtml(html)).toBe(
      '<p style="color:red">Réponses correctes\u00A0:</p><code>a:b</code><a href="https://x.test/a:b">Link\u00A0:</a>',
    );
  });
});

describe('applyFrenchColonTypographyToLabels', () => {
  it('wandelt String-Labels um', () => {
    expect(
      applyFrenchColonTypographyToLabels({
        a: 'notions clés:',
        b: 3,
      }),
    ).toEqual({
      a: 'notions clés\u00A0:',
      b: 3,
    });
  });
});
