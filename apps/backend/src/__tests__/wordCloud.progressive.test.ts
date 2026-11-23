import { afterEach, describe, expect, it, vi } from 'vitest';
import { type AnalyzeWordCloudInput } from '@arsnova/shared-types';
import { analyzeWordCloudSnapshot } from '../routers/wordCloud';
import type { applyWordCloudTopicLabels } from '../lib/wordCloudTopicLabels';
import type { analyzeSemanticWordCloudSnapshot } from '../lib/wordCloudSemanticAnalyze';
import { createMemoryWordCloudAnalysisCache } from '../lib/wordCloudAnalysisCache';

const lease = vi.hoisted(() => ({ held: false }));
vi.mock('../lib/redisLease', () => ({
  acquireRedisLease: async () => {
    if (lease.held) return null;
    lease.held = true;
    return {
      release: async () => {
        lease.held = false;
      },
    };
  },
}));
vi.mock('../redis', () => ({
  getRedis: () => ({ exists: async () => Number(lease.held) }),
}));

const env = {
  OPEN_WEIGHT_LLM_ENABLED: 'true',
  OPEN_WEIGHT_LLM_SHARED_SLOT_ENABLED: 'true',
  OPEN_WEIGHT_LLM_PRIORITY_HANDOFF_ENABLED: 'true',
};
const request: AnalyzeWordCloudInput = {
  sessionCode: 'ABC123',
  mode: 'SEMANTIC',
  channel: 'FREETEXT',
  locale: 'de',
  metric: 'TOP',
  normalization: 'NONE',
  topicLabels: 'preview',
  items: [
    { id: 'a', text: 'Lineare Regression im Projekt', weight: 1 },
    { id: 'b', text: 'Wo hilft lineare Regression?', weight: 1 },
  ],
};

function fixture() {
  const encode = vi.fn<typeof analyzeSemanticWordCloudSnapshot>(async (input, meta) => ({
    ...meta,
    mode: 'SEMANTIC',
    status: 'ready',
    fallbackUsed: false,
    locale: input.locale,
    metric: input.metric,
    generatedAt: new Date().toISOString(),
    modelVersion: 'test',
    entries: [
      {
        key: 'regression',
        label: 'Lineare Regression im Projekt',
        basisLabel: 'Lineare Regression im Projekt',
        count: 2,
        confidence: 1,
        variants: [],
        members: input.items.map((item) => ({ ...item, sourceId: item.id })),
      },
    ],
  }));
  return {
    env,
    encode,
    cache: createMemoryWordCloudAnalysisCache(),
    cacheScope: { sessionId: 'test-session' },
  };
}

describe('getrennte Cluster- und Labelphase', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    lease.held = false;
  });

  it('liefert Cluster vor Inferenz, bündelt Anfragen und nutzt das gemeinsame Ergebnis', async () => {
    vi.stubEnv('WORD_CLOUD_SEMANTIC_ENABLED', 'true');
    const options = fixture();
    const base = await analyzeWordCloudSnapshot(request, options);
    expect(base.topicLabelsPending).toBe(true);
    expect(base.entries[0]?.labelOrigin).toBe('extractive');
    const requestLabels = { ...request, topicLabels: { snapshotHash: base.snapshotHash } };
    let complete = () => {};
    const finish = new Promise<void>((resolve) => {
      complete = resolve;
    });
    const labelTopics = vi.fn<typeof applyWordCloudTopicLabels>(async (_input, result) => {
      await finish;
      return {
        ...result,
        labelSettlement: 'complete',
        entries: result.entries.map((entry) => ({
          ...entry,
          label: 'Statistische Vorhersage',
          labelOrigin: 'model',
        })),
      };
    });
    const first = analyzeWordCloudSnapshot(requestLabels, { ...options, labelTopics });
    await vi.waitFor(() => expect(labelTopics).toHaveBeenCalledOnce());
    const concurrent = analyzeWordCloudSnapshot(requestLabels, { ...options, labelTopics });
    complete();
    const results = await Promise.all([first, concurrent]);
    expect(results.map((item) => item.entries[0]?.label)).toEqual([
      'Statistische Vorhersage',
      'Statistische Vorhersage',
    ]);
    expect(labelTopics).toHaveBeenCalledOnce();
    expect(options.encode).toHaveBeenCalledOnce();
  });

  it('verwirft Korpuswechsel und Rechteverlust vor der Label-Inferenz', async () => {
    vi.stubEnv('WORD_CLOUD_SEMANTIC_ENABLED', 'true');
    const options = fixture();
    const base = await analyzeWordCloudSnapshot(request, options);
    const requestLabels = { ...request, topicLabels: { snapshotHash: base.snapshotHash } };
    const labelTopics = vi.fn();
    await expect(
      analyzeWordCloudSnapshot(
        { ...requestLabels, items: request.items.slice(0, 1) },
        { ...options, labelTopics },
      ),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    await expect(
      analyzeWordCloudSnapshot(requestLabels, {
        ...options,
        labelTopics,
        isCurrent: async () => false,
      }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(labelTopics).not.toHaveBeenCalled();
  });
});
