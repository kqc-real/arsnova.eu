import { describe, expect, it } from 'vitest';
import type { AnalyzeWordCloudInput } from '@arsnova/shared-types';
import {
  buildWordCloudSnapshotHash,
  hashWordCloudText,
  resolveWordCloudNormalizationMeta,
} from './wordCloudNormalization';

const baseInput = {
  sessionCode: 'ABC123',
  mode: 'LEXICAL',
  locale: 'de',
  metric: 'TOP',
  normalization: 'NONE',
  items: [
    { id: 'bbbb', text: 'zweite Antwort', weight: 1 },
    { id: 'aaaa', text: 'erste Antwort', weight: 2 },
  ],
} as const satisfies AnalyzeWordCloudInput;

describe('wordCloudNormalization', () => {
  it('bildet einen stabilen Snapshot-Hash unabhaengig von der Item-Reihenfolge', () => {
    const reversed: AnalyzeWordCloudInput = {
      ...baseInput,
      items: [...baseInput.items].reverse(),
    };
    expect(buildWordCloudSnapshotHash(reversed)).toBe(buildWordCloudSnapshotHash(baseInput));
  });

  it('aendert den Hash bei anderem Text oder Normalisierungsmodus', () => {
    const changedText: AnalyzeWordCloudInput = {
      ...baseInput,
      items: [{ ...baseInput.items[0]!, text: 'geaendert' }, baseInput.items[1]!],
    };
    const lemmaRequested: AnalyzeWordCloudInput = {
      ...baseInput,
      normalization: 'LEMMA',
    };
    expect(buildWordCloudSnapshotHash(changedText)).not.toBe(buildWordCloudSnapshotHash(baseInput));
    expect(buildWordCloudSnapshotHash(lemmaRequested)).not.toBe(
      buildWordCloudSnapshotHash(baseInput),
    );
  });

  it('hasht Rohtexte stabil und ohne Klartext im Digest', () => {
    expect(hashWordCloudText('Häuser')).toMatch(/^[a-f0-9]{64}$/);
    expect(hashWordCloudText('Häuser')).toBe(hashWordCloudText('Häuser'));
    expect(hashWordCloudText('Häuser')).not.toBe(hashWordCloudText('Haus'));
  });

  it('wendet ohne bestaetigten Sidecar kein Lemma an, auch wenn NLP_ENABLED gesetzt ist', () => {
    const lemmaInput: AnalyzeWordCloudInput = {
      ...baseInput,
      normalization: 'LEMMA',
    };
    expect(
      resolveWordCloudNormalizationMeta(lemmaInput, {
        NLP_ENABLED: 'true',
      }),
    ).toMatchObject({
      normalization: 'LEMMA',
      normalizationApplied: 'NONE',
      normalizationFallbackUsed: true,
      normalizationFallbackReason: 'SIDECAR_UNAVAILABLE',
      fallbackLocale: 'de',
      analysisVersion: '1.14b.1',
      modelId: null,
    });
    expect(
      resolveWordCloudNormalizationMeta(lemmaInput, {
        NLP_ENABLED: 'false',
      }).normalizationFallbackReason,
    ).toBe('NLP_DISABLED');
  });
});
