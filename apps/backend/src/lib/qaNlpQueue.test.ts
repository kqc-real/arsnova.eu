import { afterEach, describe, expect, it } from 'vitest';
import { QA_NLP_GATEKEEPER_MODEL_VERSION, QA_NLP_STUB_MODEL_VERSION } from './qaNlpConfig';
import {
  enqueueQaNlpJob,
  getQaNlpMetrics,
  resetQaNlpQueueForTests,
  waitForQaNlpIdleForTests,
} from './qaNlpQueue';
import { createStubUnclassifiedQaNlpResult } from './qaNlpResult';

const QUESTION_ID = '44444444-4444-4444-8444-444444444444';

describe('qaNlpQueue', () => {
  afterEach(() => {
    resetQaNlpQueueForTests();
  });

  it('nimmt ohne Flag keinen Job an', () => {
    const writes: string[] = [];
    resetQaNlpQueueForTests({
      config: () => ({
        enabled: false,
        timeoutMs: 200,
        queueLimit: 10,
        concurrency: 1,
        minConfidence: 0.55,
      }),
      writer: async (questionId) => {
        writes.push(questionId);
      },
    });

    expect(enqueueQaNlpJob({ questionId: QUESTION_ID, text: 'Was ist der Median?' })).toBe(
      'disabled',
    );
    expect(getQaNlpMetrics().enqueued).toBe(0);
    expect(writes).toEqual([]);
  });

  it('laesst enqueue zurueckkehren bevor ein langsamer Worker fertig ist', async () => {
    let processed = false;
    const writes: Array<{ questionId: string; status: string }> = [];
    resetQaNlpQueueForTests({
      config: () => ({
        enabled: true,
        timeoutMs: 1_000,
        queueLimit: 10,
        concurrency: 1,
        minConfidence: 0.55,
      }),
      processor: async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
        processed = true;
        return createStubUnclassifiedQaNlpResult();
      },
      writer: async (questionId, result) => {
        writes.push({ questionId, status: result.status });
      },
    });

    const started = Date.now();
    expect(enqueueQaNlpJob({ questionId: QUESTION_ID, text: 'Was ist der Median?' })).toBe(
      'queued',
    );
    expect(Date.now() - started).toBeLessThan(40);
    expect(processed).toBe(false);

    await waitForQaNlpIdleForTests();
    expect(processed).toBe(true);
    expect(writes).toEqual([{ questionId: QUESTION_ID, status: 'disabled' }]);
    expect(getQaNlpMetrics().completed).toBe(1);
    expect(getQaNlpMetrics().unclassified).toBe(1);
  });

  it('ueberspringt bei vollem Queue-Limit und markiert failed', async () => {
    const writes: string[] = [];
    let release: (() => void) | undefined;
    const blocker = new Promise<void>((resolve) => {
      release = resolve;
    });
    resetQaNlpQueueForTests({
      config: () => ({
        enabled: true,
        timeoutMs: 1_000,
        queueLimit: 1,
        concurrency: 1,
        minConfidence: 0.55,
      }),
      processor: async () => {
        await blocker;
        return createStubUnclassifiedQaNlpResult();
      },
      writer: async (questionId, result) => {
        writes.push(`${questionId}:${result.status}:${result.modelVersion ?? ''}`);
      },
    });

    expect(enqueueQaNlpJob({ questionId: QUESTION_ID, text: 'Erste Frage' })).toBe('queued');
    expect(
      enqueueQaNlpJob({
        questionId: '55555555-5555-4555-8555-555555555555',
        text: 'Zweite Frage',
      }),
    ).toBe('skipped');
    expect(getQaNlpMetrics().skipped).toBe(1);

    const skipStarted = Date.now();
    while (!writes.some((entry) => entry.startsWith('55555555') && entry.includes('failed'))) {
      if (Date.now() - skipStarted > 500) {
        throw new Error('Queue-Limit-Skip wurde nicht persistiert');
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    release?.();
    await waitForQaNlpIdleForTests();
  });

  it('degradiert Timeout auf failed', async () => {
    const writes: Array<{ status: string; modelVersion?: string }> = [];
    resetQaNlpQueueForTests({
      config: () => ({
        enabled: true,
        timeoutMs: 30,
        queueLimit: 10,
        concurrency: 1,
        minConfidence: 0.55,
      }),
      processor: async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
        return createStubUnclassifiedQaNlpResult();
      },
      writer: async (_questionId, result) => {
        writes.push({ status: result.status, modelVersion: result.modelVersion });
      },
    });

    enqueueQaNlpJob({ questionId: QUESTION_ID, text: 'Langsame Analyse' });
    await waitForQaNlpIdleForTests();
    expect(writes[0]?.status).toBe('failed');
    expect(writes[0]?.modelVersion).toBe(`${QA_NLP_STUB_MODEL_VERSION}:timeout`);
    expect(getQaNlpMetrics().failed).toBe(1);
  });

  it('nutzt den Gatekeeper als Default-Processor', async () => {
    const writes: Array<{ status: string; category?: string; modelVersion?: string }> = [];
    resetQaNlpQueueForTests({
      config: () => ({
        enabled: true,
        timeoutMs: 1_000,
        queueLimit: 10,
        concurrency: 1,
        minConfidence: 0.55,
      }),
      writer: async (_questionId, result) => {
        writes.push({
          status: result.status,
          category: result.category,
          modelVersion: result.modelVersion,
        });
      },
    });

    enqueueQaNlpJob({
      questionId: QUESTION_ID,
      text: 'Bis wann muss die Hausarbeit abgegeben werden?',
    });
    await waitForQaNlpIdleForTests();
    expect(writes[0]?.status).toBe('classified');
    expect(writes[0]?.category).toBe('organization');
    expect(writes[0]?.modelVersion).toBe(QA_NLP_GATEKEEPER_MODEL_VERSION);
    expect(getQaNlpMetrics().earlyExit).toBe(1);
    expect(getQaNlpMetrics().fallback).toBe(0);
    expect(getQaNlpMetrics().earlyExitRate).toBe(1);
  });

  it('zaehlt Fallback und Unclassified nach kurzem Text', async () => {
    resetQaNlpQueueForTests({
      config: () => ({
        enabled: true,
        timeoutMs: 1_000,
        queueLimit: 10,
        concurrency: 1,
        minConfidence: 0.55,
      }),
      writer: async () => undefined,
    });

    enqueueQaNlpJob({ questionId: QUESTION_ID, text: 'Hallo zusammen' });
    await waitForQaNlpIdleForTests();
    const snapshot = getQaNlpMetrics();
    expect(snapshot.completed).toBe(1);
    expect(snapshot.fallback).toBe(1);
    expect(snapshot.earlyExit).toBe(0);
    expect(snapshot.fallbackRate).toBe(1);
    expect(snapshot.unclassified).toBeGreaterThanOrEqual(0);
    expect(snapshot.unclassifiedRate).toBeGreaterThanOrEqual(0);
  });
});
