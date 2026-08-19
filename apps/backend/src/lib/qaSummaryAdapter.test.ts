import { afterEach, describe, expect, it, vi } from 'vitest';
import { qaSummaryQuestionSourceId } from '@arsnova/shared-types';
import { resetQaSummaryAdapterForTests, runQaSummaryInference } from './qaSummaryAdapter';
import { buildQaSummaryAnalysisSnapshot } from './qaSummarySnapshot';

const QUESTION_ID = '11111111-1111-4111-8111-111111111111';
const SOURCE_ID = qaSummaryQuestionSourceId(QUESTION_ID);

const snapshot = buildQaSummaryAnalysisSnapshot({
  locale: 'de',
  questions: [{ id: QUESTION_ID, text: 'Kommt Kapitel 4 in der Klausur vor?' }],
  maxSources: 20,
});

describe('qaSummaryAdapter', () => {
  afterEach(() => {
    resetQaSummaryAdapterForTests();
  });

  it('ruft ohne URL keinen Cloud-Fallback auf', async () => {
    const fetchMock = vi.fn();
    resetQaSummaryAdapterForTests({
      fetch: fetchMock,
      config: () => ({
        enabled: true,
        timeoutMs: 1000,
        queueLimit: 8,
        concurrency: 1,
        cooldownMs: 30_000,
        ttlMs: 1_800_000,
        maxSources: 20,
        inferenceUrl: null,
        inferenceToken: null,
      }),
    });

    await expect(runQaSummaryInference(snapshot, 'f'.repeat(64))).resolves.toMatchObject({
      status: 'failed',
      modelVersion: 'stub:unconfigured',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('blockiert SaaS-Hosts auch wenn die URL gesetzt ist', async () => {
    const fetchMock = vi.fn();
    resetQaSummaryAdapterForTests({
      fetch: fetchMock,
      config: () => ({
        enabled: true,
        timeoutMs: 1000,
        queueLimit: 8,
        concurrency: 1,
        cooldownMs: 30_000,
        ttlMs: 1_800_000,
        maxSources: 20,
        inferenceUrl: 'https://api.openai.com/v1/chat/completions',
        inferenceToken: 'secret',
      }),
    });

    await expect(runQaSummaryInference(snapshot, 'f'.repeat(64))).resolves.toMatchObject({
      status: 'failed',
      modelVersion: 'stub:saas-blocked',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('parst eine gültige private Modellantwort', async () => {
    const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
      expect(_url).toBe('http://inference:8080/summary');
      const payload = JSON.parse(init.body) as { sources: { id: string }[] };
      expect(payload.sources[0]?.id).toBe(SOURCE_ID);
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            status: 'ready',
            statements: [{ text: 'Es gibt eine Klausurfrage.', sourceIds: [SOURCE_ID] }],
            suggestedNextSteps: [],
            limitations: [],
            modelVersion: 'private-llm-test',
          }),
      };
    });
    resetQaSummaryAdapterForTests({
      fetch: fetchMock,
      config: () => ({
        enabled: true,
        timeoutMs: 1000,
        queueLimit: 8,
        concurrency: 1,
        cooldownMs: 30_000,
        ttlMs: 1_800_000,
        maxSources: 20,
        inferenceUrl: 'http://inference:8080/summary',
        inferenceToken: 'token-1',
      }),
    });

    await expect(runQaSummaryInference(snapshot, 'f'.repeat(64))).resolves.toMatchObject({
      status: 'ready',
      modelVersion: 'private-llm-test',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('verwirft eine injizierte ungültige JSON-Antwort', async () => {
    resetQaSummaryAdapterForTests({
      fetch: async () => ({
        ok: true,
        status: 200,
        text: async () => '{"status":"ready","statements":"not-an-array"}',
      }),
      config: () => ({
        enabled: true,
        timeoutMs: 1000,
        queueLimit: 8,
        concurrency: 1,
        cooldownMs: 30_000,
        ttlMs: 1_800_000,
        maxSources: 20,
        inferenceUrl: 'http://inference:8080/summary',
        inferenceToken: null,
      }),
    });

    await expect(runQaSummaryInference(snapshot, 'f'.repeat(64))).resolves.toMatchObject({
      status: 'failed',
      modelVersion: 'stub:invalid-output',
    });
  });
});
