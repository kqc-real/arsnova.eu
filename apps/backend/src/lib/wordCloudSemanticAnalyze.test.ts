import { afterEach, describe, expect, it } from 'vitest';
import {
  toWordCloudSemanticSourceId,
  WORD_CLOUD_SEMANTIC_ANALYSIS_VERSION,
} from '@arsnova/shared-types';
import { createMemoryWordCloudAnalysisCache } from './wordCloudAnalysisCache';
import { analyzeWordCloudSnapshot } from '../routers/wordCloud';
import {
  geometricEmbeddingForSeedText,
  WORD_CLOUD_SEMANTIC_DE_SEED,
} from './wordCloudSemanticFixtures';
import { resetWordCloudSemanticAnalyzeForTests } from './wordCloudSemanticAnalyze';
import { WordCloudEncoderError } from './wordCloudEncoderClient';
import type { WordCloudSemanticConfig } from './wordCloudSemanticConfig';

const enabledConfig: WordCloudSemanticConfig = {
  enabled: true,
  socketPath: '/tmp/missing-encoder.sock',
  inferenceUrl: 'http://127.0.0.1:8790/embed',
  inferenceToken: null,
  timeoutMs: 8000,
  cacheTtlSeconds: 1800,
};

const items = WORD_CLOUD_SEMANTIC_DE_SEED.map((item, index) => ({
  id: `11111111-1111-4111-8111-11111111111${index}`,
  text: item.text,
  weight: 4 - Math.min(index, 3),
}));

describe('wordCloudSemanticAnalyze', () => {
  afterEach(() => {
    resetWordCloudSemanticAnalyzeForTests();
  });

  it('clustert Host-Q&A-Themen mit Encoder-Vektoren und versioniert den Digest', async () => {
    resetWordCloudSemanticAnalyzeForTests({
      config: () => enabledConfig,
      embed: async (input) => ({
        modelId: 'intfloat/multilingual-e5-small',
        modelVersion: 'intfloat/multilingual-e5-small@sha256:testdigest',
        items: input.items.map((item) => ({
          id: toWordCloudSemanticSourceId(item.id),
          embedding: geometricEmbeddingForSeedText(item.text),
        })),
      }),
    });

    const result = await analyzeWordCloudSnapshot(
      {
        sessionCode: 'ABC123',
        mode: 'SEMANTIC',
        locale: 'de',
        metric: 'BEST',
        channel: 'QA',
        normalization: 'NONE',
        items,
      },
      { cache: createMemoryWordCloudAnalysisCache() },
    );

    expect(result.status).toBe('ready');
    expect(result.fallbackUsed).toBe(false);
    expect(result.analysisVersion).toBe(WORD_CLOUD_SEMANTIC_ANALYSIS_VERSION);
    expect(result.modelVersion).toBe('intfloat/multilingual-e5-small@sha256:testdigest');
    const klausur = result.entries.find((entry) =>
      entry.members.some((member) => member.text.includes('Klausur')),
    );
    expect(klausur?.members).toHaveLength(3);
    const folien = result.entries.find((entry) =>
      entry.members.some((member) => member.text.includes('Folien')),
    );
    const beamer = result.entries.find((entry) =>
      entry.members.some((member) => member.text.includes('Beamer')),
    );
    expect(folien?.members).toHaveLength(1);
    expect(beamer?.members).toHaveLength(1);
    expect(folien?.key).not.toBe(beamer?.key);
  });

  it('faellt bei Timeout hart auf 2.x und oeffnet den Circuit nach Wiederholungen', async () => {
    let calls = 0;
    resetWordCloudSemanticAnalyzeForTests({
      config: () => enabledConfig,
      embed: async () => {
        calls += 1;
        throw new WordCloudEncoderError('TIMEOUT');
      },
    });

    const input = {
      sessionCode: 'ABC123' as const,
      mode: 'SEMANTIC' as const,
      locale: 'de' as const,
      metric: 'TOP' as const,
      channel: 'QA' as const,
      normalization: 'NONE' as const,
      items,
    };

    const first = await analyzeWordCloudSnapshot(input, {
      cache: createMemoryWordCloudAnalysisCache(),
    });
    expect(first.status).toBe('failed');
    expect(first.fallbackUsed).toBe(true);
    expect(first.entries.length).toBeGreaterThan(0);

    await analyzeWordCloudSnapshot(
      { ...input, sessionCode: 'DEF456' },
      { cache: createMemoryWordCloudAnalysisCache() },
    );
    await analyzeWordCloudSnapshot(
      { ...input, sessionCode: 'GHI789' },
      { cache: createMemoryWordCloudAnalysisCache() },
    );
    const blocked = await analyzeWordCloudSnapshot(
      { ...input, sessionCode: 'JKL012' },
      { cache: createMemoryWordCloudAnalysisCache() },
    );
    expect(blocked.status).toBe('failed');
    expect(calls).toBe(3);
  });

  it('laesst eine einzelne Q&A-Frage ohne Encoder als fallback fallen', async () => {
    const embed = async () => {
      throw new Error('encoder must not run');
    };
    resetWordCloudSemanticAnalyzeForTests({
      config: () => enabledConfig,
      embed,
    });

    const result = await analyzeWordCloudSnapshot({
      sessionCode: 'ABC123',
      mode: 'SEMANTIC',
      locale: 'de',
      metric: 'BEST',
      channel: 'QA',
      normalization: 'NONE',
      items: [{ id: '11111111-1111-4111-8111-111111111111', text: 'asdfgh', weight: 1 }],
    });

    expect(result.status).toBe('fallback');
    expect(result.fallbackUsed).toBe(true);
    expect(result.entries.length).toBeGreaterThan(0);
    expect(result.modelVersion).toBeNull();
  });

  it('laesst nur Singletons nach dem Clustering als fallback fallen', async () => {
    resetWordCloudSemanticAnalyzeForTests({
      config: () => enabledConfig,
      embed: async (input) => ({
        modelId: 'intfloat/multilingual-e5-small',
        modelVersion: 'intfloat/multilingual-e5-small@sha256:testdigest',
        items: input.items.map((item, index) => ({
          id: toWordCloudSemanticSourceId(item.id),
          embedding: [index === 0 ? 1 : 0, index === 1 ? 1 : 0, 0, 0],
        })),
      }),
    });

    const result = await analyzeWordCloudSnapshot({
      sessionCode: 'ABC123',
      mode: 'SEMANTIC',
      locale: 'de',
      metric: 'BEST',
      channel: 'QA',
      normalization: 'NONE',
      items: [
        { id: '11111111-1111-4111-8111-111111111111', text: 'Banane', weight: 1 },
        { id: '22222222-2222-4222-8222-222222222222', text: 'Schraubenzieher', weight: 1 },
      ],
    });

    expect(result.status).toBe('fallback');
    expect(result.fallbackUsed).toBe(true);
    expect(result.entries.length).toBeGreaterThan(0);
  });

  it('laesst Freitext und nicht-de/en lexikalisch fallen', async () => {
    const embed = async () => {
      throw new Error('encoder must not run');
    };
    resetWordCloudSemanticAnalyzeForTests({
      config: () => enabledConfig,
      embed,
    });

    const freetext = await analyzeWordCloudSnapshot({
      sessionCode: 'ABC123',
      mode: 'SEMANTIC',
      locale: 'de',
      metric: 'TOP',
      channel: 'FREETEXT',
      normalization: 'NONE',
      items: [{ id: 'response-0', text: 'Lernen mit Karteikarten', weight: 1 }],
    });
    expect(freetext.status).toBe('fallback');
    expect(freetext.fallbackUsed).toBe(true);

    const french = await analyzeWordCloudSnapshot({
      sessionCode: 'ABC123',
      mode: 'SEMANTIC',
      locale: 'fr',
      metric: 'TOP',
      channel: 'QA',
      normalization: 'NONE',
      items,
    });
    expect(french.status).toBe('fallback');
  });
});
