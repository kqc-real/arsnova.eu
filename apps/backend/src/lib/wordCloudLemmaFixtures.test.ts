import { describe, expect, it, vi } from 'vitest';
import type { AnalyzeWordCloudInput } from '@arsnova/shared-types';
import {
  WORD_CLOUD_MAX_ANALYZE_ITEMS,
  WORD_CLOUD_MAX_ITEM_TEXT_CHARS,
} from '@arsnova/shared-types';
import { analyzeWordCloudSnapshot } from '../routers/wordCloud';
import { createMemoryWordCloudAnalysisCache } from './wordCloudAnalysisCache';
import { WORD_CLOUD_LEMMA_FIXTURES } from './wordCloudLemmaFixtures';

describe('wordCloud lemma fixtures (Story 1.14b)', () => {
  it.each(WORD_CLOUD_LEMMA_FIXTURES)(
    '$id buendelt erwartete Formen und trennt key/label',
    async (fixture) => {
      const sidecar = vi.fn(async () => ({
        locale: fixture.locale,
        modelId: fixture.locale === 'de' ? 'de_core_news_sm@3.8.0' : 'en_core_web_sm@3.8.0',
        items: fixture.sidecarItems,
      }));
      const input = {
        sessionCode: 'ABC123',
        mode: 'LEXICAL',
        locale: fixture.locale,
        metric: 'TOP',
        normalization: 'LEMMA',
        items: fixture.items,
      } as const satisfies AnalyzeWordCloudInput;

      const result = await analyzeWordCloudSnapshot(input, {
        cache: createMemoryWordCloudAnalysisCache(),
        sidecar,
        env: { NLP_ENABLED: 'true' },
      });

      expect(sidecar).toHaveBeenCalledOnce();
      expect(result.normalizationApplied).toBe('LEMMA');
      expect(result.fallbackUsed).toBe(false);
      const keys = result.entries.map((entry) => entry.key);
      expect(keys).toEqual(expect.arrayContaining([...fixture.expectedKeys]));
      for (const unexpected of fixture.unexpectedKeys ?? []) {
        expect(keys).not.toContain(unexpected);
      }
      for (const [key, label] of Object.entries(fixture.expectedLabels ?? {})) {
        expect(result.entries.find((entry) => entry.key === key)?.label).toBe(label);
      }
    },
  );

  it('begrenzt Item-Text und Snapshot-Groesse im Vertrag', () => {
    expect(WORD_CLOUD_MAX_ITEM_TEXT_CHARS).toBe(4000);
    expect(WORD_CLOUD_MAX_ANALYZE_ITEMS).toBe(500);
  });
});
