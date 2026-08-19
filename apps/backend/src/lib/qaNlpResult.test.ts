import { describe, expect, it } from 'vitest';
import {
  createFailedQaNlpResult,
  createStubUnclassifiedQaNlpResult,
  mapStoredQaNlpResult,
  toQaNlpPersistFields,
} from './qaNlpResult';

describe('qaNlpResult mapping', () => {
  it('mappt persistierte Host-Felder auf den DTO-Vertrag', () => {
    const parsed = mapStoredQaNlpResult({
      nlpStatus: 'CLASSIFIED',
      nlpCategory: 'ORGANIZATION',
      nlpConfidence: 0.42,
      nlpModelVersion: 'gatekeeper-v1',
      nlpAnalyzedAt: new Date('2026-08-19T11:00:00.000Z'),
    });
    expect(parsed).toEqual({
      status: 'classified',
      category: 'organization',
      confidence: 0.42,
      modelVersion: 'gatekeeper-v1',
      analyzedAt: '2026-08-19T11:00:00.000Z',
    });
  });

  it('degradiert classified ohne Kategorie auf failed', () => {
    expect(
      mapStoredQaNlpResult({
        nlpStatus: 'CLASSIFIED',
        nlpCategory: null,
      }).status,
    ).toBe('failed');
  });

  it('degradiert Timeout und Queue-Limit auf failed', () => {
    expect(createFailedQaNlpResult('timeout').status).toBe('failed');
    expect(createFailedQaNlpResult('queue-limit').modelVersion).toBe('stub:queue-limit');
  });

  it('schreibt Stub-Ergebnisse ohne Kategorie zurueck', () => {
    const result = createStubUnclassifiedQaNlpResult(new Date('2026-08-19T11:01:00.000Z'));
    expect(toQaNlpPersistFields(result)).toEqual({
      nlpStatus: 'DISABLED',
      nlpCategory: null,
      nlpConfidence: null,
      nlpModelVersion: 'stub',
      nlpAnalyzedAt: new Date('2026-08-19T11:01:00.000Z'),
    });
  });
});
