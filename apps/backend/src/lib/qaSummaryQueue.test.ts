import { afterEach, describe, expect, it } from 'vitest';
import { qaSummaryQuestionSourceId, type QaSummaryModelOutput } from '@arsnova/shared-types';
import {
  getQaSummaryRuntime,
  requestQaSummary,
  resetQaSummaryQueueForTests,
  waitForQaSummaryIdleForTests,
} from './qaSummaryQueue';
import { buildQaSummaryAnalysisSnapshot } from './qaSummarySnapshot';
import type { QaSummaryConfig } from './qaSummaryConfig';

const SESSION_ID = '6a8edced-5f8f-4cfa-9176-454fac9570ad';
const QUESTION_IDS = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
] as const;
const SOURCE_ID = qaSummaryQuestionSourceId(QUESTION_IDS[0]);

function testConfig(overrides: Partial<QaSummaryConfig> = {}): QaSummaryConfig {
  return {
    enabled: true,
    timeoutMs: 200,
    queueLimit: 8,
    concurrency: 1,
    cooldownMs: 30_000,
    ttlMs: 1_800_000,
    maxSources: 20,
    inferenceUrl: 'http://inference:8080/summary',
    inferenceToken: null,
    ...overrides,
  };
}

const snapshot = buildQaSummaryAnalysisSnapshot({
  locale: 'de',
  questions: QUESTION_IDS.map((id, index) => ({
    id,
    text: `Offene Frage ${index + 1}?`,
  })),
  maxSources: 20,
});

const twoQuestionSnapshot = buildQaSummaryAnalysisSnapshot({
  locale: 'de',
  questions: QUESTION_IDS.slice(0, 2).map((id, index) => ({
    id,
    text: `Offene Frage ${index + 1}?`,
  })),
  maxSources: 20,
});

describe('qaSummaryQueue', () => {
  afterEach(() => {
    resetQaSummaryQueueForTests();
  });

  it('nimmt ohne Flag keinen Job an', async () => {
    let processed = 0;
    resetQaSummaryQueueForTests({
      config: () => testConfig({ enabled: false }),
      processor: async () => {
        processed += 1;
        return {
          status: 'ready',
          statements: [],
          suggestedNextSteps: [],
          limitations: [],
        };
      },
    });

    const runtime = await requestQaSummary(SESSION_ID, 'de');
    expect(runtime.enabled).toBe(false);
    expect(runtime.result).toBeNull();
    expect(processed).toBe(0);
  });

  it('startet on demand und liefert nach der Inferenz ein gebundenes Ergebnis', async () => {
    resetQaSummaryQueueForTests({
      config: () => testConfig(),
      loadSnapshot: async () => snapshot,
      processor: async (): Promise<QaSummaryModelOutput> => ({
        status: 'ready',
        statements: [{ text: 'Es gibt eine Klausurfrage.', sourceIds: [SOURCE_ID] }],
        suggestedNextSteps: [],
        limitations: [],
        modelVersion: 'stub',
      }),
    });

    const pending = await requestQaSummary(SESSION_ID, 'de');
    expect(pending.result?.status).toBe('pending');
    await waitForQaSummaryIdleForTests();
    expect(getQaSummaryRuntime(SESSION_ID).result).toMatchObject({
      status: 'ready',
      statements: [{ text: 'Es gibt eine Klausurfrage.', sourceIds: [SOURCE_ID] }],
    });
  });

  it('hält denselben Snapshot in der Cooldown-Zeit und startet keinen zweiten Job', async () => {
    let processed = 0;
    resetQaSummaryQueueForTests({
      config: () => testConfig(),
      loadSnapshot: async () => snapshot,
      processor: async () => {
        processed += 1;
        return {
          status: 'ready',
          statements: [{ text: 'Es gibt eine Klausurfrage.', sourceIds: [SOURCE_ID] }],
          suggestedNextSteps: [],
          limitations: [],
        };
      },
    });

    await requestQaSummary(SESSION_ID, 'de');
    await waitForQaSummaryIdleForTests();
    await requestQaSummary(SESSION_ID, 'de');
    await waitForQaSummaryIdleForTests();
    expect(processed).toBe(1);
  });

  it('wird bei Timeout failed, ohne die Queue zu blockieren', async () => {
    resetQaSummaryQueueForTests({
      config: () => testConfig({ timeoutMs: 20 }),
      loadSnapshot: async () => snapshot,
      processor: async () =>
        new Promise(() => {
          /* never */
        }),
    });

    await requestQaSummary(SESSION_ID, 'de');
    await waitForQaSummaryIdleForTests();
    expect(getQaSummaryRuntime(SESSION_ID).result?.status).toBe('failed');
    expect(getQaSummaryRuntime(SESSION_ID).result?.modelVersion).toBe('stub:timeout');
  });

  it('lässt nach einem Timeout sofort einen neuen Versuch zu', async () => {
    let processed = 0;
    resetQaSummaryQueueForTests({
      config: () => testConfig({ timeoutMs: 20 }),
      loadSnapshot: async () => snapshot,
      processor: async () => {
        processed += 1;
        if (processed === 1) {
          return new Promise(() => {
            /* first attempt hangs */
          });
        }
        return {
          status: 'ready',
          statements: [{ text: 'Es gibt eine Klausurfrage.', sourceIds: [SOURCE_ID] }],
          suggestedNextSteps: [],
          limitations: [],
        };
      },
    });

    await requestQaSummary(SESSION_ID, 'de');
    await waitForQaSummaryIdleForTests();
    expect(getQaSummaryRuntime(SESSION_ID).result?.status).toBe('failed');

    await requestQaSummary(SESSION_ID, 'de');
    await waitForQaSummaryIdleForTests();
    expect(processed).toBe(2);
    expect(getQaSummaryRuntime(SESSION_ID).result?.status).toBe('ready');
  });

  it('wird bei Processor-Fehler failed, ohne die Queue zu blockieren', async () => {
    resetQaSummaryQueueForTests({
      config: () => testConfig(),
      loadSnapshot: async () => snapshot,
      processor: async () => {
        throw new Error('read ECONNRESET');
      },
    });

    await requestQaSummary(SESSION_ID, 'de');
    await waitForQaSummaryIdleForTests();
    expect(getQaSummaryRuntime(SESSION_ID).result?.status).toBe('failed');
    expect(getQaSummaryRuntime(SESSION_ID).result?.modelVersion).toBe('stub:error');
  });

  it('ruft ohne drei sichtbare Fragen keine Inferenz auf', async () => {
    let processed = 0;
    resetQaSummaryQueueForTests({
      config: () => testConfig(),
      loadSnapshot: async () => twoQuestionSnapshot,
      processor: async () => {
        processed += 1;
        return {
          status: 'ready',
          statements: [{ text: 'Sollte nicht entstehen.', sourceIds: [SOURCE_ID] }],
          suggestedNextSteps: [],
          limitations: [],
        };
      },
    });

    const runtime = await requestQaSummary(SESSION_ID, 'de');
    await waitForQaSummaryIdleForTests();
    expect(processed).toBe(0);
    expect(runtime.result?.status).toBe('uncertain');
    expect(runtime.result?.limitations).toContain(
      'Es gibt noch zu wenige sichtbare Fragen für eine Zusammenfassung.',
    );
  });

  it('überschreibt ein ready-Ergebnis nicht wenn die Fragenzahl unter die Schwelle fällt', async () => {
    let allowTooFew = false;
    resetQaSummaryQueueForTests({
      config: () => testConfig(),
      loadSnapshot: async () => (allowTooFew ? twoQuestionSnapshot : snapshot),
      processor: async (): Promise<QaSummaryModelOutput> => ({
        status: 'ready',
        statements: [{ text: 'Es gibt eine Klausurfrage.', sourceIds: [SOURCE_ID] }],
        suggestedNextSteps: [],
        limitations: [],
        modelVersion: 'stub',
      }),
    });

    await requestQaSummary(SESSION_ID, 'de');
    await waitForQaSummaryIdleForTests();
    expect(getQaSummaryRuntime(SESSION_ID).result?.status).toBe('ready');

    allowTooFew = true;
    const kept = await requestQaSummary(SESSION_ID, 'de');
    await waitForQaSummaryIdleForTests();
    expect(kept.result?.status).toBe('ready');
    expect(kept.result?.statements[0]?.text).toBe('Es gibt eine Klausurfrage.');
  });
});
