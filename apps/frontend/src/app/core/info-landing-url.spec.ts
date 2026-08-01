import { describe, expect, it } from 'vitest';
import { INFO_LANDING_ANCHORS, infoLandingUrl } from './info-landing-url';

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
});
