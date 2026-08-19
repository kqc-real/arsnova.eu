import type { QaNlpResult } from '@arsnova/shared-types';
import { prisma } from '../db';
import { logger } from './logger';
import { resolveQaNlpConfig, type QaNlpConfig } from './qaNlpConfig';
import { createFailedQaNlpResult, toQaNlpPersistFields } from './qaNlpResult';
import {
  assertQaNlpSnapshotMinimized,
  buildQaNlpAnalysisSnapshot,
  type QaNlpAnalysisSnapshot,
} from './qaNlpSnapshot';
import { runStubQaNlpClassifier } from './qaNlpWorker';

export type QaNlpJob = {
  readonly questionId: string;
  readonly text: string;
};

export type QaNlpEnqueueResult = 'disabled' | 'queued' | 'skipped';

export type QaNlpProcessor = (snapshot: QaNlpAnalysisSnapshot) => Promise<QaNlpResult>;

export type QaNlpResultWriter = (questionId: string, result: QaNlpResult) => Promise<void>;

export type QaNlpMetrics = {
  queueLength: number;
  running: number;
  enqueued: number;
  skipped: number;
  completed: number;
  failed: number;
  unclassified: number;
  lastLatencyMs: number | null;
};

type QueueHooks = {
  processor: QaNlpProcessor;
  writer: QaNlpResultWriter;
  config: () => QaNlpConfig;
  now: () => number;
  schedule: (fn: () => void) => void;
};

const defaultWriter: QaNlpResultWriter = async (questionId, result) => {
  await prisma.qaQuestion.update({
    where: { id: questionId },
    data: toQaNlpPersistFields(result),
  });
};

const metrics: QaNlpMetrics = {
  queueLength: 0,
  running: 0,
  enqueued: 0,
  skipped: 0,
  completed: 0,
  failed: 0,
  unclassified: 0,
  lastLatencyMs: null,
};

const queue: QaNlpJob[] = [];
const pendingTimers: ReturnType<typeof setImmediate>[] = [];
let hooks: QueueHooks = createDefaultHooks();

function createDefaultHooks(): QueueHooks {
  return {
    processor: runStubQaNlpClassifier,
    writer: defaultWriter,
    config: () => resolveQaNlpConfig(),
    now: () => Date.now(),
    schedule: (fn) => {
      const timer = setImmediate(() => {
        const index = pendingTimers.indexOf(timer);
        if (index >= 0) pendingTimers.splice(index, 1);
        fn();
      });
      pendingTimers.push(timer);
    },
  };
}

function syncQueueLength(): void {
  metrics.queueLength = queue.length;
}

async function persistResult(questionId: string, result: QaNlpResult): Promise<void> {
  try {
    await hooks.writer(questionId, result);
  } catch (error) {
    logger.warn('qa_nlp:persist_failed', {
      questionId,
      status: result.status,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('QA_NLP_TIMEOUT'));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function processJob(job: QaNlpJob): Promise<void> {
  const started = hooks.now();
  const config = hooks.config();
  const snapshot = buildQaNlpAnalysisSnapshot(job.text);
  try {
    assertQaNlpSnapshotMinimized(snapshot);
    const result = await withTimeout(hooks.processor(snapshot), config.timeoutMs);
    await persistResult(job.questionId, result);
    metrics.completed += 1;
    if (
      result.status === 'disabled' ||
      result.status === 'failed' ||
      result.category === undefined
    ) {
      metrics.unclassified += 1;
    }
    logger.info('qa_nlp:completed', {
      status: result.status,
      latencyMs: hooks.now() - started,
      queueLength: queue.length,
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.message === 'QA_NLP_TIMEOUT';
    await persistResult(job.questionId, createFailedQaNlpResult(timedOut ? 'timeout' : 'error'));
    metrics.failed += 1;
    metrics.unclassified += 1;
    logger.warn('qa_nlp:failed', {
      reason: timedOut ? 'timeout' : 'error',
      latencyMs: hooks.now() - started,
      queueLength: queue.length,
    });
  } finally {
    metrics.running -= 1;
    metrics.lastLatencyMs = hooks.now() - started;
    syncQueueLength();
    pump();
  }
}

function pump(): void {
  const config = hooks.config();
  while (metrics.running < config.concurrency && queue.length > 0) {
    const job = queue.shift();
    if (!job) {
      break;
    }
    metrics.running += 1;
    syncQueueLength();
    hooks.schedule(() => {
      void processJob(job);
    });
  }
}

/**
 * Plant die Analyse nach erfolgreicher Persistenz. Wartet nicht auf Inferenz.
 */
export function enqueueQaNlpJob(job: QaNlpJob): QaNlpEnqueueResult {
  const config = hooks.config();
  if (!config.enabled) {
    return 'disabled';
  }
  if (queue.length + metrics.running >= config.queueLimit) {
    metrics.skipped += 1;
    hooks.schedule(() => {
      void persistResult(job.questionId, createFailedQaNlpResult('queue-limit'));
    });
    logger.warn('qa_nlp:skipped', {
      reason: 'queue-limit',
      queueLength: queue.length,
      running: metrics.running,
      limit: config.queueLimit,
    });
    return 'skipped';
  }
  queue.push(job);
  metrics.enqueued += 1;
  syncQueueLength();
  pump();
  return 'queued';
}

export function getQaNlpMetrics(): QaNlpMetrics {
  return { ...metrics, queueLength: queue.length };
}

export function resetQaNlpQueueForTests(overrides?: Partial<QueueHooks>): void {
  for (const timer of pendingTimers.splice(0)) {
    clearImmediate(timer);
  }
  queue.splice(0, queue.length);
  metrics.queueLength = 0;
  metrics.running = 0;
  metrics.enqueued = 0;
  metrics.skipped = 0;
  metrics.completed = 0;
  metrics.failed = 0;
  metrics.unclassified = 0;
  metrics.lastLatencyMs = null;
  hooks = {
    ...createDefaultHooks(),
    ...overrides,
  };
}

export async function waitForQaNlpIdleForTests(timeoutMs = 1_000): Promise<void> {
  const started = Date.now();
  while (queue.length > 0 || metrics.running > 0 || pendingTimers.length > 0) {
    if (Date.now() - started > timeoutMs) {
      throw new Error('Q&A-NLP-Queue wurde nicht leer');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
