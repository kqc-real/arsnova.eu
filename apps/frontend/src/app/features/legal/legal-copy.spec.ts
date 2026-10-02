import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const legalDir = join(dirname(fileURLToPath(import.meta.url)), '../../../assets/legal');
const locales = ['de', 'en', 'fr', 'es', 'it'] as const;

function readLegal(slug: string, locale: (typeof locales)[number]): string {
  return readFileSync(join(legalDir, `${slug}.${locale}.md`), 'utf8');
}

describe('Footer-Rechtstexte', () => {
  it('hält das Impressum in allen Sprachen inhaltlich vollständig', () => {
    for (const locale of locales) {
      const copy = readLegal('imprint', locale);
      expect(copy.match(/^## /gm)).toHaveLength(7);
      expect(copy).toMatch(/IU (?:Internationale Hochschule|International University)/);
      expect(copy).toContain('https://arsnova.eu');
      expect(copy).toContain('https://www.iu-dualesstudium.de');
      expect(copy).toContain('mailto:klaus.quibeldey-cirkel@iu.org');
      expect(copy).toContain('Hetzner Online GmbH');
      expect(copy).toContain('DDG');
      expect(copy).toContain('MStV');
    }
  });

  it('verwendet in Datenschutz und Barrierefreiheit die informelle Anrede', () => {
    const german = `${readLegal('privacy', 'de')}\n${readLegal('accessibility', 'de')}`;
    const french = `${readLegal('privacy', 'fr')}\n${readLegal('accessibility', 'fr')}`;
    const spanish = `${readLegal('privacy', 'es')}\n${readLegal('accessibility', 'es')}`;

    expect(german).not.toMatch(/\b(?:Sie|Ihnen|Ihre[mnrs]?)\b/);
    expect(french).not.toMatch(/\b(?:vous|votre|vos)\b/i);
    expect(spanish).not.toMatch(
      /\b(?:usted|ustedes)\b|por usted|Sus derechos|pedirle|Su navegador|su institución|su quiz/,
    );
  });

  it('nennt die Zeitoptionen so wie die Oberfläche', () => {
    expect(readLegal('accessibility', 'de')).toContain('**Ohne Frist:**');
    expect(readLegal('accessibility', 'en')).toContain('**No deadline:**');
    expect(readLegal('accessibility', 'fr')).toContain('**Sans délai :**');
    expect(readLegal('accessibility', 'es')).toContain('**Sin plazo:**');
    expect(readLegal('accessibility', 'it')).toContain('**Senza scadenza:**');
  });

  it('verwendet die festgelegten Anführungszeichen', () => {
    expect(readLegal('privacy', 'de')).not.toMatch(/[„“]/);
    expect(readLegal('privacy', 'de')).toContain('»arsnova.eu verbessern«');
    expect(readLegal('privacy', 'fr')).not.toMatch(/« | »/);
    expect(readLegal('privacy', 'fr')).toContain('« Améliorer arsnova.eu »');
    expect(readLegal('privacy', 'es')).not.toMatch(/« | »/);
    expect(readLegal('privacy', 'it')).not.toMatch(/« | »/);
  });

  it('enthält keine unbelegte jährliche TÜV-Aussage', () => {
    for (const locale of locales) {
      expect(readLegal('privacy', locale)).not.toMatch(/TÜV|TUV|Rheinland/);
    }
  });
});
