import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  toWordCloudSemanticSourceId,
  WORD_CLOUD_SEMANTIC_ANALYSIS_VERSION,
  type AnalyzeWordCloudInput,
} from '@arsnova/shared-types';
import {
  createMemoryWordCloudAnalysisCache,
  shouldCacheWordCloudSnapshot,
} from './wordCloudAnalysisCache';
import { analyzeWordCloudSnapshot } from '../routers/wordCloud';
import {
  geometricEmbeddingForSeedText,
  WORD_CLOUD_SEMANTIC_DE_SEED,
  WORD_CLOUD_SEMANTIC_FREETEXT_DE_SEED,
  WORD_CLOUD_SEMANTIC_FREETEXT_EN_SEED,
  WORD_CLOUD_SEMANTIC_FREETEXT_FAMILY_IDS,
} from './wordCloudSemanticFixtures';
import {
  analyzeSemanticWordCloudSnapshot,
  invalidateWordCloudSemanticSession,
  resetWordCloudSemanticAnalyzeForTests,
} from './wordCloudSemanticAnalyze';
import { WordCloudEncoderError } from './wordCloudEncoderClient';
import type { WordCloudSemanticConfig } from './wordCloudSemanticConfig';
import { resolveWordCloudNormalizationMeta } from './wordCloudNormalization';

const enabledConfig: WordCloudSemanticConfig = {
  enabled: true,
  socketPath: '/tmp/missing-encoder.sock',
  inferenceUrl: 'http://127.0.0.1:8790/embed',
  inferenceToken: null,
  timeoutMs: 8000,
  cacheTtlSeconds: 1800,
};
const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const REUSED_CODE_SESSION_ID = '22222222-2222-4222-8222-222222222222';

const items = WORD_CLOUD_SEMANTIC_DE_SEED.map((item, index) => ({
  id: `11111111-1111-4111-8111-11111111111${index}`,
  text: item.text,
  weight: 4 - Math.min(index, 3),
}));

function freetextItems(seed: readonly { id: string; text: string }[]) {
  return seed.map((item) => ({ ...item, weight: 1 }));
}

function deferred(): { readonly promise: Promise<void>; readonly resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function runSemanticDirect(input: AnalyzeWordCloudInput, sessionId = SESSION_ID) {
  return analyzeSemanticWordCloudSnapshot(input, resolveWordCloudNormalizationMeta(input), {
    sessionId,
  });
}

function qaSemanticInput(sessionCode = 'ABC123'): AnalyzeWordCloudInput {
  return {
    sessionCode,
    mode: 'SEMANTIC',
    locale: 'de',
    metric: 'BEST',
    channel: 'QA',
    normalization: 'NONE',
    items,
  };
}

function freetextSemanticInput(
  seed: readonly { id: string; text: string }[],
  locale: 'de' | 'en',
  sessionCode = 'ABC123',
): AnalyzeWordCloudInput {
  return {
    sessionCode,
    mode: 'SEMANTIC',
    locale,
    metric: 'TOP',
    channel: 'FREETEXT',
    normalization: 'NONE',
    items: freetextItems(seed),
  };
}

async function analyzeFreetextFixture(input: {
  locale: 'de' | 'en';
  sessionCode: string;
  seed: readonly { id: string; text: string }[];
}) {
  resetWordCloudSemanticAnalyzeForTests({
    config: () => enabledConfig,
    embed: async (request) => ({
      modelId: 'intfloat/multilingual-e5-small',
      modelVersion: 'intfloat/multilingual-e5-small@sha256:freetext-fixture',
      items: request.items.map((item) => ({
        id: toWordCloudSemanticSourceId(item.id),
        embedding: geometricEmbeddingForSeedText(item.text),
      })),
    }),
  });

  return analyzeWordCloudSnapshot(
    {
      sessionCode: input.sessionCode,
      mode: 'SEMANTIC',
      locale: input.locale,
      metric: 'TOP',
      channel: 'FREETEXT',
      normalization: 'NONE',
      items: freetextItems(input.seed),
    },
    { cache: createMemoryWordCloudAnalysisCache() },
  );
}

describe('wordCloudSemanticAnalyze', () => {
  afterEach(() => {
    resetWordCloudSemanticAnalyzeForTests();
    vi.unstubAllEnvs();
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

  it('begrenzt viele Folgesnapshots auf active plus latest und dedupliziert beide Slots', async () => {
    const gates = [deferred(), deferred()];
    const calls: string[] = [];
    let active = 0;
    let maxActive = 0;
    resetWordCloudSemanticAnalyzeForTests({
      config: () => enabledConfig,
      embed: async (input) => {
        const index = calls.length;
        calls.push(input.items[0]?.text ?? 'empty');
        active += 1;
        maxActive = Math.max(maxActive, active);
        await gates[index]!.promise;
        active -= 1;
        return {
          modelId: 'intfloat/multilingual-e5-small',
          modelVersion: `intfloat/multilingual-e5-small@sha256:serialized-${index}`,
          items: input.items.map((item) => ({
            id: toWordCloudSemanticSourceId(item.id),
            embedding: geometricEmbeddingForSeedText(item.text),
          })),
        };
      },
    });

    const qaInput = qaSemanticInput();
    const qa = runSemanticDirect(qaInput);
    await vi.waitUntil(() => calls.length === 1);
    const qaDuplicate = runSemanticDirect(qaInput);

    const snapshots = Array.from({ length: 8 }, (_, index) =>
      freetextSemanticInput(
        WORD_CLOUD_SEMANTIC_FREETEXT_DE_SEED.map((item, itemIndex) =>
          itemIndex === 0 ? { ...item, text: `${item.text} Variante ${index}` } : item,
        ),
        'de',
      ),
    );
    const queued = snapshots.map((snapshot) => runSemanticDirect(snapshot));
    const latestDuplicate = runSemanticDirect(snapshots.at(-1)!);

    const replaced = await Promise.all(queued.slice(0, -1));
    expect(calls).toHaveLength(1);
    expect(replaced).toHaveLength(7);
    expect(replaced.every((result) => result.status === 'fallback')).toBe(true);
    expect(replaced.every((result) => result.fallbackUsed)).toBe(true);
    expect(replaced.every((result) => result.modelVersion === null)).toBe(true);
    expect(replaced.every((result) => !shouldCacheWordCloudSnapshot(result))).toBe(true);

    gates[0]!.resolve();
    await vi.waitUntil(() => calls.length === 2);
    expect(active).toBe(1);

    gates[1]!.resolve();
    const [qaResult, qaDuplicateResult, latest, latestDuplicateResult] = await Promise.all([
      qa,
      qaDuplicate,
      queued.at(-1)!,
      latestDuplicate,
    ]);

    expect(calls).toEqual([qaInput.items[0]!.text, snapshots.at(-1)!.items[0]!.text]);
    expect(maxActive).toBe(1);
    expect(qaResult.status).toBe('ready');
    expect(qaDuplicateResult.modelVersion).toBe(qaResult.modelVersion);
    expect(latest.status).toBe('ready');
    expect(latestDuplicateResult.modelVersion).toBe(latest.modelVersion);
  });

  it('arbeitet die Folgewarteschlange auch nach einem Encoderfehler ab', async () => {
    const firstGate = deferred();
    let calls = 0;
    resetWordCloudSemanticAnalyzeForTests({
      config: () => enabledConfig,
      embed: async (input) => {
        calls += 1;
        if (calls === 1) {
          await firstGate.promise;
          throw new WordCloudEncoderError('UNAVAILABLE');
        }
        return {
          modelId: 'intfloat/multilingual-e5-small',
          modelVersion: 'intfloat/multilingual-e5-small@sha256:after-error',
          items: input.items.map((item) => ({
            id: toWordCloudSemanticSourceId(item.id),
            embedding: geometricEmbeddingForSeedText(item.text),
          })),
        };
      },
    });

    const failed = runSemanticDirect(qaSemanticInput());
    await vi.waitUntil(() => calls === 1);
    const queued = runSemanticDirect(
      freetextSemanticInput(WORD_CLOUD_SEMANTIC_FREETEXT_DE_SEED, 'de'),
    );
    await Promise.resolve();
    expect(calls).toBe(1);

    firstGate.resolve();
    const [failedResult, queuedResult] = await Promise.all([failed, queued]);

    expect(calls).toBe(2);
    expect(failedResult.status).toBe('failed');
    expect(queuedResult.status).toBe('ready');
    expect(queuedResult.modelVersion).toBe('intfloat/multilingual-e5-small@sha256:after-error');
  });

  it('verwirft beim Session-Purge aktive Ergebnisse vor dem Cache und serialisiert Ersatzarbeit', async () => {
    vi.stubEnv('WORD_CLOUD_SEMANTIC_ENABLED', 'true');
    const gates = [deferred(), deferred()];
    const calls: string[] = [];
    let active = 0;
    let maxActive = 0;
    resetWordCloudSemanticAnalyzeForTests({
      config: () => enabledConfig,
      embed: async (input) => {
        const index = calls.length;
        calls.push(input.items[0]?.id ?? 'empty');
        active += 1;
        maxActive = Math.max(maxActive, active);
        await gates[index]!.promise;
        active -= 1;
        return {
          modelId: 'intfloat/multilingual-e5-small',
          modelVersion: `intfloat/multilingual-e5-small@sha256:purge-${index}`,
          items: input.items.map((item) => ({
            id: toWordCloudSemanticSourceId(item.id),
            embedding: geometricEmbeddingForSeedText(item.text),
          })),
        };
      },
    });

    const cache = createMemoryWordCloudAnalysisCache();
    const activeInput = qaSemanticInput();
    const activeQa = analyzeWordCloudSnapshot(activeInput, {
      cache,
      cacheScope: { sessionId: SESSION_ID },
    });
    await vi.waitUntil(() => calls.length === 1);
    const freetextInput = freetextSemanticInput(WORD_CLOUD_SEMANTIC_FREETEXT_DE_SEED, 'de');
    const invalidatedFreetext = runSemanticDirect(freetextInput);

    invalidateWordCloudSemanticSession(SESSION_ID);
    const replacementQa = runSemanticDirect(activeInput);
    gates[0]!.resolve();

    await vi.waitUntil(() => calls.length === 2);
    expect(active).toBe(1);
    gates[1]!.resolve();

    const [activeResult, invalidatedResult, replacementResult] = await Promise.all([
      activeQa,
      invalidatedFreetext,
      replacementQa,
    ]);
    expect(calls).toHaveLength(2);
    expect(maxActive).toBe(1);
    expect(activeResult.status).toBe('fallback');
    expect(activeResult.modelVersion).toBeNull();
    expect(shouldCacheWordCloudSnapshot(activeResult)).toBe(false);
    expect(invalidatedResult.status).toBe('fallback');
    expect(invalidatedResult.modelVersion).toBeNull();
    expect(shouldCacheWordCloudSnapshot(invalidatedResult)).toBe(false);
    expect(replacementResult.status).toBe('ready');
    expect(replacementResult.modelVersion).toBe('intfloat/multilingual-e5-small@sha256:purge-1');
    expect(await cache.getSnapshot(activeInput, { sessionId: SESSION_ID })).toBeNull();
  });

  it('laesst einen Job der neuen sessionId bei verspaetetem Purge desselben Codes weiterlaufen', async () => {
    const gates = [deferred(), deferred()];
    const calls: string[] = [];
    resetWordCloudSemanticAnalyzeForTests({
      config: () => enabledConfig,
      embed: async (input) => {
        const index = calls.length;
        calls.push(input.items[0]?.text ?? 'empty');
        await gates[index]!.promise;
        return {
          modelId: 'intfloat/multilingual-e5-small',
          modelVersion: `intfloat/multilingual-e5-small@sha256:reuse-${index}`,
          items: input.items.map((item) => ({
            id: toWordCloudSemanticSourceId(item.id),
            embedding: geometricEmbeddingForSeedText(item.text),
          })),
        };
      },
    });

    const cache = createMemoryWordCloudAnalysisCache();
    const oldSession = analyzeWordCloudSnapshot(qaSemanticInput('ABC123'), {
      cache,
      cacheScope: { sessionId: SESSION_ID },
    });
    await vi.waitUntil(() => calls.length === 1);
    const reusedCodeSession = analyzeWordCloudSnapshot(
      freetextSemanticInput(WORD_CLOUD_SEMANTIC_FREETEXT_DE_SEED, 'de', 'ABC123'),
      {
        cache,
        cacheScope: { sessionId: REUSED_CODE_SESSION_ID },
      },
    );
    await vi.waitUntil(() => calls.length === 2);

    invalidateWordCloudSemanticSession(SESSION_ID);
    gates[0]!.resolve();
    gates[1]!.resolve();

    const [oldResult, reusedCodeResult] = await Promise.all([oldSession, reusedCodeSession]);
    expect(oldResult.status).toBe('fallback');
    expect(oldResult.modelVersion).toBeNull();
    expect(reusedCodeResult.status).toBe('ready');
    expect(reusedCodeResult.modelVersion).toBe('intfloat/multilingual-e5-small@sha256:reuse-1');
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

  it('clustert deutsche Host-Freitextantworten ueber denselben Encoderpfad', async () => {
    const result = await analyzeFreetextFixture({
      locale: 'de',
      sessionCode: 'ABC123',
      seed: WORD_CLOUD_SEMANTIC_FREETEXT_DE_SEED,
    });

    expect(result.status).toBe('ready');
    expect(result.fallbackUsed).toBe(false);
    expect(result.modelVersion).toBe('intfloat/multilingual-e5-small@sha256:freetext-fixture');
    const mood = result.entries.find((entry) =>
      WORD_CLOUD_SEMANTIC_FREETEXT_FAMILY_IDS.de.mood.every((id) =>
        entry.members.some((member) => member.sourceId === id),
      ),
    );
    expect(mood?.members).toHaveLength(3);
    const moodMemberIds = new Set<string>(mood?.members.map((member) => member.sourceId));
    expect(
      WORD_CLOUD_SEMANTIC_FREETEXT_FAMILY_IDS.de.counterexamples.every(
        (id) => !moodMemberIds.has(id),
      ),
    ).toBe(true);
  });

  it('clustert englische Host-Freitextantworten ueber denselben Encoderpfad', async () => {
    const result = await analyzeFreetextFixture({
      locale: 'en',
      sessionCode: 'DEF456',
      seed: WORD_CLOUD_SEMANTIC_FREETEXT_EN_SEED,
    });

    expect(result.status).toBe('ready');
    expect(result.fallbackUsed).toBe(false);
    for (const family of [
      WORD_CLOUD_SEMANTIC_FREETEXT_FAMILY_IDS.en.mood,
      WORD_CLOUD_SEMANTIC_FREETEXT_FAMILY_IDS.en.synonyms,
      WORD_CLOUD_SEMANTIC_FREETEXT_FAMILY_IDS.en.technical,
    ]) {
      expect(
        result.entries.some((entry) =>
          family.every((id) => entry.members.some((member) => member.sourceId === id)),
        ),
      ).toBe(true);
    }
  });

  it('behandelt anonyme response-IDs nicht mehr als Freitext-Encoder-Sperre', async () => {
    let calls = 0;
    resetWordCloudSemanticAnalyzeForTests({
      config: () => enabledConfig,
      embed: async (input) => {
        calls += 1;
        return {
          modelId: 'intfloat/multilingual-e5-small',
          modelVersion: 'intfloat/multilingual-e5-small@sha256:response-id-fixture',
          items: input.items.map((item) => ({
            id: toWordCloudSemanticSourceId(item.id),
            embedding: geometricEmbeddingForSeedText(item.text),
          })),
        };
      },
    });

    const result = await analyzeWordCloudSnapshot({
      sessionCode: 'ABC123',
      mode: 'SEMANTIC',
      locale: 'de',
      metric: 'TOP',
      normalization: 'NONE',
      items: [
        {
          id: 'response-0',
          text: WORD_CLOUD_SEMANTIC_FREETEXT_DE_SEED[0].text,
          weight: 1,
        },
        {
          id: 'response-1',
          text: WORD_CLOUD_SEMANTIC_FREETEXT_DE_SEED[1].text,
          weight: 1,
        },
      ],
    });

    expect(calls).toBe(1);
    expect(result.status).toBe('ready');
    expect(result.fallbackUsed).toBe(false);
  });

  it.each(['de', 'en', 'fr', 'es'] as const)(
    'laesst eine einzelne Freitext-Nonsense-Antwort in %s ohne Encoder als fallback fallen',
    async (locale) => {
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
        locale,
        metric: 'TOP',
        channel: 'FREETEXT',
        normalization: 'NONE',
        items: [{ id: 'response-0', text: 'asdfgh', weight: 1 }],
      });

      expect(result.status).toBe('fallback');
      expect(result.fallbackUsed).toBe(true);
      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.modelVersion).toBeNull();
    },
  );

  it.each(['fr', 'es'] as const)(
    'laesst Freitext in %s kontrolliert lexikalisch fallen',
    async (locale) => {
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
        locale,
        metric: 'TOP',
        channel: 'FREETEXT',
        normalization: 'NONE',
        items: freetextItems(WORD_CLOUD_SEMANTIC_FREETEXT_DE_SEED),
      });

      expect(result.status).toBe('fallback');
      expect(result.fallbackUsed).toBe(true);
      expect(result.modelVersion).toBeNull();
    },
  );
});
