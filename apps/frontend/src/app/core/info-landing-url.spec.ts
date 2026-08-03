import { describe, expect, it } from 'vitest';
import { INFO_LANDING_ANCHORS, infoLandingUrl, type InfoLandingTheme } from './info-landing-url';
import { SUPPORTED_LOCALES } from './locale-from-path';

describe('infoLandingUrl', () => {
  it('baut immer einen Locale-Pfad und nie nur die Domainwurzel', () => {
    expect(infoLandingUrl(null, 'de')).toBe('https://info.arsnova.eu/de/');
    expect(infoLandingUrl(INFO_LANDING_ANCHORS.features, 'en')).toBe(
      'https://info.arsnova.eu/en/#features',
    );
    expect(infoLandingUrl(INFO_LANDING_ANCHORS.workflow, 'fr')).toBe(
      'https://info.arsnova.eu/fr/#workflow',
    );
    expect(infoLandingUrl(INFO_LANDING_ANCHORS.qaWall, 'it')).toBe(
      'https://info.arsnova.eu/it/#qa-wall',
    );
    expect(infoLandingUrl(INFO_LANDING_ANCHORS.confidence, 'es')).toBe(
      'https://info.arsnova.eu/es/#confidence',
    );
  });

  it('setzt theme als Query vor dem Hash für alle erlaubten Werte', () => {
    const themes: InfoLandingTheme[] = ['system', 'light', 'dark'];
    for (const theme of themes) {
      expect(infoLandingUrl(INFO_LANDING_ANCHORS.features, 'de', theme)).toBe(
        `https://info.arsnova.eu/de/?theme=${theme}#features`,
      );
      expect(infoLandingUrl(null, 'en', theme)).toBe(`https://info.arsnova.eu/en/?theme=${theme}`);
    }
  });

  it('hält Locale-Pfad und kanonische Anker mit Theme für alle fünf Sprachen', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(infoLandingUrl(INFO_LANDING_ANCHORS.workflow, locale, 'dark')).toBe(
        `https://info.arsnova.eu/${locale}/?theme=dark#workflow`,
      );
      expect(infoLandingUrl(INFO_LANDING_ANCHORS.features, locale, 'light')).toBe(
        `https://info.arsnova.eu/${locale}/?theme=light#features`,
      );
      expect(infoLandingUrl(INFO_LANDING_ANCHORS.accessibility, locale, 'system')).toBe(
        `https://info.arsnova.eu/${locale}/?theme=system#accessibility`,
      );
    }
  });

  it('ignoriert ungültige Theme-Werte und lässt den Query weg', () => {
    expect(infoLandingUrl(INFO_LANDING_ANCHORS.features, 'de', undefined)).toBe(
      'https://info.arsnova.eu/de/#features',
    );
    expect(infoLandingUrl(INFO_LANDING_ANCHORS.features, 'de', 'serious' as InfoLandingTheme)).toBe(
      'https://info.arsnova.eu/de/#features',
    );
    expect(
      infoLandingUrl(INFO_LANDING_ANCHORS.features, 'de', 'spielerisch' as InfoLandingTheme),
    ).toBe('https://info.arsnova.eu/de/#features');
  });
});
