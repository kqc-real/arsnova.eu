import { describe, expect, it } from 'vitest';
import { QA_NLP_FALLBACK_K } from './qaNlpConfig';
import {
  getQaNlpFallbackPrototypes,
  predictQaNlpFallbackKnn,
  qaNlpFallbackAccepts,
} from './qaNlpFallback';

describe('qaNlpFallback', () => {
  it('baut Prototypen aus Train- und Prototype-Split', () => {
    expect(getQaNlpFallbackPrototypes().length).toBeGreaterThan(QA_NLP_FALLBACK_K);
  });

  it('stimmt bei klarer Organisationsfrage mit organization ueberein', () => {
    const prediction = predictQaNlpFallbackKnn('Bis wann muss die Hausarbeit abgegeben werden?');
    expect(prediction.category).toBe('organization');
    expect(qaNlpFallbackAccepts(prediction)).toBe(true);
  });

  it('lehnt leeren oder unaehnlichen Kurztext ab', () => {
    const prediction = predictQaNlpFallbackKnn('xyz');
    expect(qaNlpFallbackAccepts(prediction)).toBe(false);
  });
});
