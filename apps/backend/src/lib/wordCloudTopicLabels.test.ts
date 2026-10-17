import { afterEach, describe, expect, it } from 'vitest';
import type {
  AnalyzeWordCloudOutput,
  OpenWeightLlmTopicLabelOutput,
  WordCloudAnalysisEntryDTO,
} from '@arsnova/shared-types';
import {
  invalidateWordCloudSemanticSession,
  resetWordCloudSemanticAnalyzeForTests,
} from './wordCloudSemanticAnalyze';
import { geometricEmbeddingForSeedText } from './wordCloudSemanticFixtures';
import { resolveWordCloudNormalizationMeta } from './wordCloudNormalization';
import {
  applyWordCloudTopicLabels,
  labelSemanticWordCloudSnapshot,
  resetWordCloudTopicLabelCacheForTests,
  resolveTopicLabelPhaseBudgetMs,
  WORD_CLOUD_TOPIC_LABEL_PHASE_BUDGET_CAP_MS,
  WORD_CLOUD_TOPIC_LABEL_PHASE_BUDGET_MS,
  type TopicLabelCaller,
} from './wordCloudTopicLabels';

const enabledEnv = {
  OPEN_WEIGHT_LLM_ENABLED: 'true',
  OPEN_WEIGHT_LLM_URL: 'http://127.0.0.1:8080',
  OPEN_WEIGHT_LLM_TOKEN: 'a'.repeat(32),
} as NodeJS.ProcessEnv;

function entry(label: string, members: readonly string[]): WordCloudAnalysisEntryDTO {
  return {
    key: `semantic-${label}`,
    label,
    count: members.length,
    basisLabel: label,
    confidence: 0.9,
    variants: [...members],
    members: members.map((text, index) => ({
      sourceId: `response-${index}`,
      text,
      weight: 1,
    })),
  };
}

function output(entries: WordCloudAnalysisEntryDTO[]): AnalyzeWordCloudOutput {
  return {
    mode: 'SEMANTIC',
    locale: 'de',
    metric: 'TOP',
    generatedAt: '2026-10-13T12:00:00.000Z',
    fallbackUsed: false,
    status: 'ready',
    modelVersion: 'encoder',
    modelId: 'intfloat/multilingual-e5-small',
    normalization: 'NONE',
    normalizationApplied: 'NONE',
    normalizationFallbackUsed: false,
    normalizationFallbackReason: null,
    fallbackLocale: 'de',
    analysisVersion: '1.14c.2',
    snapshotHash: 'a'.repeat(64),
    entries,
  };
}

const input = {
  sessionCode: 'ABC123',
  mode: 'SEMANTIC' as const,
  locale: 'de' as const,
  metric: 'TOP' as const,
  channel: 'FREETEXT' as const,
  normalization: 'NONE' as const,
  items: [],
};

function labeler(impl: TopicLabelCaller): TopicLabelCaller {
  return impl;
}

describe('resolveTopicLabelPhaseBudgetMs', () => {
  it('gibt jedem Kandidaten mindestens den konfigurierten Label-Timeout', () => {
    expect(resolveTopicLabelPhaseBudgetMs(enabledEnv, 1)).toBe(30_000);
    expect(resolveTopicLabelPhaseBudgetMs(enabledEnv, 3)).toBe(90_000);
    expect(resolveTopicLabelPhaseBudgetMs(enabledEnv, 20)).toBe(
      WORD_CLOUD_TOPIC_LABEL_PHASE_BUDGET_CAP_MS,
    );
    expect(
      resolveTopicLabelPhaseBudgetMs(
        { ...enabledEnv, OPEN_WEIGHT_LLM_LABEL_TIMEOUT_MS: '2000' },
        1,
      ),
    ).toBe(WORD_CLOUD_TOPIC_LABEL_PHASE_BUDGET_MS);
  });
});

describe('applyWordCloudTopicLabels', () => {
  afterEach(() => {
    resetWordCloudSemanticAnalyzeForTests();
    resetWordCloudTopicLabelCacheForTests();
  });

  it('lässt bei ausgeschalteter Runtime den Mitgliedstext stehen', async () => {
    const result = await applyWordCloudTopicLabels(
      input,
      output([entry('ich bin müde heute', ['ich bin müde heute', 'irgendwie erschöpft'])]),
      { env: { OPEN_WEIGHT_LLM_ENABLED: 'false' } },
    );
    expect(result.labelSettlement).toBe('disabled');
    expect(result.entries[0]?.label).toBe('ich bin müde heute');
    expect(result.entries[0]?.labelOrigin).toBe('extractive');
  });

  it('übernimmt einen kurzen Namen und verwirft ein Echo', async () => {
    const calls: string[] = [];
    const label = labeler(async (request) => {
      calls.push(request.sources[0]?.text ?? '');
      const echoed = request.clusterId.endsWith('echo');
      return {
        status: 'completed',
        output: {
          schemaVersion: 1,
          taskType: 'topic_label',
          label: echoed ? request.sources[0]!.text : 'Erschöpfung',
          sourceIds: [request.sources[0]!.id],
        },
        telemetry: {
          taskType: 'topic_label',
          elapsedMs: 1,
          model: null,
          promptTokens: null,
          completionTokens: null,
        },
      };
    });
    const result = await applyWordCloudTopicLabels(
      input,
      output([
        entry('ich bin müde heute', ['ich bin müde heute', 'irgendwie erschöpft']),
        {
          ...entry('Kopiere mich', ['Kopiere mich', 'noch ein Satz']),
          key: 'echo',
        },
      ]),
      { env: enabledEnv, label },
    );
    expect(calls).toHaveLength(2);
    expect(result.entries[0]).toMatchObject({
      label: 'Erschöpfung',
      basisLabel: 'Erschöpfung',
      labelOrigin: 'model',
      members: [{ text: 'ich bin müde heute' }, { text: 'irgendwie erschöpft' }],
    });
    expect(result.entries[1]?.label).toBe('Kopiere mich');
    expect(result.entries[1]?.labelOrigin).toBe('extractive');
    expect(result.labelSettlement).toBe('complete');
    expect(result.labelModelId).toContain('Qwen3-4B-Instruct-2507');
  });

  it('behandelt einen belegten Slot als vorübergehend und blockiert den zweiten Kanal nicht', async () => {
    let releaseQa: (() => void) | undefined;
    const qaStarted = new Promise<void>((resolve) => {
      releaseQa = resolve;
    });
    const label = labeler(async (request) => {
      if (request.sources.some((source) => source.text.includes('Frage'))) {
        await qaStarted;
      }
      if (request.sources.some((source) => source.text.includes('müde'))) {
        return {
          status: 'fallback',
          reason: 'busy',
          output: {
            schemaVersion: 1,
            taskType: 'topic_label',
            label: request.sources[0]!.text.slice(0, 120),
            sourceIds: [request.sources[0]!.id],
          },
        };
      }
      return {
        status: 'completed',
        output: {
          schemaVersion: 1,
          taskType: 'topic_label',
          label: 'lineare Funktionen',
          sourceIds: [request.sources[0]!.id],
        },
        telemetry: {
          taskType: 'topic_label',
          elapsedMs: 1,
          model: null,
          promptTokens: null,
          completionTokens: null,
        },
      };
    });
    const qa = applyWordCloudTopicLabels(
      { ...input, channel: 'QA' },
      output([
        entry('Was ist eine Frage zur Steigung?', [
          'Was ist eine Frage zur Steigung?',
          'Bestimme die Gerade',
        ]),
      ]),
      { env: enabledEnv, label },
    );
    const freetext = await applyWordCloudTopicLabels(
      input,
      output([entry('ich bin müde heute', ['ich bin müde heute', 'irgendwie erschöpft'])]),
      { env: enabledEnv, label },
    );
    expect(freetext.labelSettlement).toBe('transient');
    expect(freetext.entries[0]?.label).toBe('ich bin müde heute');
    releaseQa?.();
    const qaResult = await qa;
    expect(qaResult.entries[0]?.label).toBe('lineare Funktionen');
  });

  it('lässt den Freitext-Encoder nicht hinter dem Q&A-Namensbudget warten', async () => {
    resetWordCloudSemanticAnalyzeForTests({
      config: () => ({
        enabled: true,
        socketPath: '/tmp/missing-encoder.sock',
        inferenceUrl: 'http://127.0.0.1:8790/embed',
        inferenceToken: null,
        timeoutMs: 8000,
        cacheTtlSeconds: 60,
      }),
      embed: async (request) => ({
        modelId: 'intfloat/multilingual-e5-small',
        modelVersion: 'test',
        items: request.items.map((item) => ({
          id: item.id.startsWith('qa-question:') ? item.id : `qa-question:${item.id}`,
          embedding: geometricEmbeddingForSeedText(item.text),
        })),
      }),
    });
    let releaseLabel: (() => void) | undefined;
    const labelGate = new Promise<void>((resolve) => {
      releaseLabel = resolve;
    });
    const label: TopicLabelCaller = async (request) => {
      if (request.locale === 'de' && request.sources[0]?.id.startsWith('qa')) {
        await labelGate;
      }
      const fallback: OpenWeightLlmTopicLabelOutput = {
        schemaVersion: 1,
        taskType: 'topic_label',
        label: 'Thema',
        sourceIds: [request.sources[0]!.id],
      };
      return { status: 'fallback', reason: 'busy', output: fallback };
    };
    const meta = resolveWordCloudNormalizationMeta({
      sessionCode: 'ABC123',
      mode: 'SEMANTIC',
      locale: 'de',
      metric: 'TOP',
      normalization: 'NONE',
      items: [
        { id: 'qa-1', text: 'Was ist die Steigung?', weight: 1 },
        { id: 'qa-2', text: 'Wie bestimmt man die Steigung?', weight: 1 },
      ],
    });
    const qaInput = {
      sessionCode: 'ABC123',
      mode: 'SEMANTIC' as const,
      locale: 'de' as const,
      metric: 'TOP' as const,
      channel: 'QA' as const,
      normalization: 'NONE' as const,
      items: [
        { id: 'qa-1', text: 'Was ist die Steigung?', weight: 1 },
        { id: 'qa-2', text: 'Wie bestimmt man die Steigung?', weight: 1 },
      ],
    };
    const freeInput = {
      ...qaInput,
      channel: 'FREETEXT' as const,
      items: [
        { id: 'response-0', text: 'ich bin müde', weight: 1 },
        { id: 'response-1', text: 'heute erschöpft', weight: 1 },
      ],
    };
    const qaPromise = labelSemanticWordCloudSnapshot(qaInput, meta, {
      sessionId: '11111111-1111-4111-8111-111111111111',
      env: enabledEnv,
      label,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const freeMeta = resolveWordCloudNormalizationMeta(freeInput);
    const started = Date.now();
    const freeResult = await labelSemanticWordCloudSnapshot(freeInput, freeMeta, {
      sessionId: '11111111-1111-4111-8111-111111111111',
      env: enabledEnv,
      label,
    });
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(freeResult.entries.length).toBeGreaterThan(0);
    releaseLabel?.();
    await qaPromise;
  });

  it('nutzt das erweiterte Phasenbudget für langsame Modellnamen', async () => {
    let calls = 0;
    const label = labeler(async (request) => {
      calls += 1;
      return {
        status: 'completed',
        output: {
          schemaVersion: 1,
          taskType: 'topic_label',
          label: calls === 1 ? 'lineare Funktionen' : 'Ableitung',
          sourceIds: [request.sources[0]!.id],
        },
        telemetry: {
          taskType: 'topic_label',
          elapsedMs: 12_000,
          model: null,
          promptTokens: null,
          completionTokens: null,
        },
      };
    });
    let clock = 0;
    const result = await applyWordCloudTopicLabels(
      input,
      output([
        entry('Was ist die Steigung einer Geraden?', [
          'Was ist die Steigung einer Geraden?',
          'Wie bestimmt man die Steigung?',
        ]),
        entry('Was ist eine Ableitung?', [
          'Was ist eine Ableitung?',
          'Nenne die Ableitung von x^2',
        ]),
      ]),
      {
        env: enabledEnv,
        label,
        now: () => {
          const current = clock;
          // Zwei langsame Aufrufe: unter dem alten 8s-Budget wäre der zweite extractive.
          clock += 12_000;
          return current;
        },
      },
    );
    expect(calls).toBe(2);
    expect(result.entries[0]?.label).toBe('lineare Funktionen');
    expect(result.entries[1]?.label).toBe('Ableitung');
    expect(result.entries.every((entry) => entry.labelOrigin === 'model')).toBe(true);
    expect(result.labelSettlement).toBe('complete');
  });

  it('verwirft einen überlangen Namen', async () => {
    const label = labeler(async (request) => ({
      status: 'completed',
      output: {
        schemaVersion: 1,
        taskType: 'topic_label',
        label: 'eins zwei drei vier fünf sechs sieben',
        sourceIds: [request.sources[0]!.id],
      },
      telemetry: {
        taskType: 'topic_label',
        elapsedMs: 1,
        model: null,
        promptTokens: null,
        completionTokens: null,
      },
    }));
    const result = await applyWordCloudTopicLabels(
      input,
      output([entry('Kurzer Satz hier', ['Kurzer Satz hier', 'Noch ein Satz'])]),
      { env: enabledEnv, label },
    );
    expect(result.entries[0]?.label).toBe('Kurzer Satz hier');
    expect(result.labelSettlement).toBe('complete');
    expect(result.labelModelId).toBeNull();
  });

  it('begrenzt Cluster-Quellen auf 6 und komprimiert lange UUID-SourceIds für das 96-Token-Budget', async () => {
    let capturedRequest: Parameters<TopicLabelCaller>[0] | undefined;
    const label = labeler(async (request) => {
      capturedRequest = request;
      return {
        status: 'completed',
        output: {
          schemaVersion: 1,
          taskType: 'topic_label',
          label: 'Klausurtermine',
          sourceIds: request.sources.slice(0, 2).map((source) => source.id),
        },
        telemetry: {
          taskType: 'topic_label',
          elapsedMs: 1,
          model: null,
          promptTokens: null,
          completionTokens: null,
        },
      };
    });
    const manyUuidMembers: WordCloudAnalysisEntryDTO = {
      key: 'semantic-uuid-cluster',
      label: 'Wann ist die Klausur?',
      count: 10,
      basisLabel: 'Wann ist die Klausur?',
      confidence: 0.9,
      variants: [],
      members: Array.from({ length: 10 }, (_, index) => ({
        sourceId: `0199e3a4-7b2c-7d8e-9f10-1a2b3c4d5e${String(index).padStart(2, '0')}`,
        text: `Frage ${index + 1} zur Klausurorganisation`,
        weight: 1,
      })),
    };
    const result = await applyWordCloudTopicLabels(input, output([manyUuidMembers]), {
      env: enabledEnv,
      label,
    });
    expect(capturedRequest?.sources).toHaveLength(6);
    expect(capturedRequest?.sources.map((source) => source.id)).toEqual([
      's1',
      's2',
      's3',
      's4',
      's5',
      's6',
    ]);
    expect(result.entries[0]?.label).toBe('Klausurtermine');
    expect(result.entries[0]?.labelOrigin).toBe('model');
    expect(result.entries[0]?.members[0]?.sourceId).toBe('0199e3a4-7b2c-7d8e-9f10-1a2b3c4d5e00');
  });

  it('cacht bereits benannte Cluster im Default-Labeler über Sortierwechsel und Transienten hinweg', async () => {
    resetWordCloudSemanticAnalyzeForTests();
    const clusterEntry = entry('Was ist die Steigung?', [
      'Was ist die Steigung?',
      'Wie bestimmt man die Steigung?',
    ]);
    let llmCalls = 0;
    const label = labeler(async (request) => {
      llmCalls += 1;
      expect(request.clusterId).toBe('cluster');
      return {
        status: 'completed',
        output: {
          schemaVersion: 1,
          taskType: 'topic_label',
          label: 'Steigung linearer Funktionen',
          sourceIds: [request.sources[0]!.id],
        },
        telemetry: {
          taskType: 'topic_label',
          elapsedMs: 1,
          model: null,
          promptTokens: null,
          completionTokens: null,
        },
      };
    });
    const first = await applyWordCloudTopicLabels(input, output([clusterEntry]), {
      env: enabledEnv,
      label,
      useProcessLabelCache: true,
    });
    const second = await applyWordCloudTopicLabels(input, output([clusterEntry]), {
      env: enabledEnv,
      label,
      useProcessLabelCache: true,
    });
    expect(llmCalls).toBe(1);
    expect(first.entries[0]?.label).toBe('Steigung linearer Funktionen');
    expect(second.entries[0]?.label).toBe('Steigung linearer Funktionen');
    expect(second.entries[0]?.labelOrigin).toBe('model');
    expect(second.labelSettlement).toBe('complete');
  });

  it('isoliert den Prozess-Label-Cache strikt nach sessionId und räumt beim Session-Purge sowie nach Ablauf auf', async () => {
    resetWordCloudSemanticAnalyzeForTests();
    const clusterEntry = entry('Was ist die Steigung?', [
      'Was ist die Steigung?',
      'Wie bestimmt man die Steigung?',
    ]);
    let llmCalls = 0;
    const label = labeler(async (request) => {
      llmCalls += 1;
      return {
        status: 'completed',
        output: {
          schemaVersion: 1,
          taskType: 'topic_label',
          label: `Thema Lauf ${llmCalls}`,
          sourceIds: [request.sources[0]!.id],
        },
        telemetry: {
          taskType: 'topic_label',
          elapsedMs: 1,
          model: null,
          promptTokens: null,
          completionTokens: null,
        },
      };
    });

    const sessionA = '11111111-1111-4111-8111-111111111111';
    const sessionB = '22222222-2222-4222-8222-222222222222';

    const firstA = await applyWordCloudTopicLabels(input, output([clusterEntry]), {
      sessionId: sessionA,
      env: enabledEnv,
      label,
      useProcessLabelCache: true,
    });
    const firstB = await applyWordCloudTopicLabels(input, output([clusterEntry]), {
      sessionId: sessionB,
      env: enabledEnv,
      label,
      useProcessLabelCache: true,
    });
    expect(llmCalls).toBe(2);
    expect(firstA.entries[0]?.label).toBe('Thema Lauf 1');
    expect(firstB.entries[0]?.label).toBe('Thema Lauf 2');

    invalidateWordCloudSemanticSession(sessionA);

    const afterPurgeB = await applyWordCloudTopicLabels(input, output([clusterEntry]), {
      sessionId: sessionB,
      env: enabledEnv,
      label,
      useProcessLabelCache: true,
    });
    const afterPurgeA = await applyWordCloudTopicLabels(input, output([clusterEntry]), {
      sessionId: sessionA,
      env: enabledEnv,
      label,
      useProcessLabelCache: true,
    });
    expect(llmCalls).toBe(3);
    expect(afterPurgeB.entries[0]?.label).toBe('Thema Lauf 2');
    expect(afterPurgeA.entries[0]?.label).toBe('Thema Lauf 3');
  });
});
