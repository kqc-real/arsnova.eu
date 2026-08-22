import {
  isQaSummaryKeepableResultStatus,
  QA_SUMMARY_MIN_VISIBLE_QUESTIONS,
  type AppLocale,
  type QaSummaryModelOutput,
  type QaSummaryResult,
  type QaSummaryRuntimeDTO,
} from '@arsnova/shared-types';
import { prisma } from '../db';
import { logger } from './logger';
import { runQaSummaryInference } from './qaSummaryAdapter';
import { resolveQaSummaryConfig, type QaSummaryConfig } from './qaSummaryConfig';
import {
  assertQaSummarySnapshotMinimized,
  buildQaSummaryAnalysisSnapshot,
  hashQaSummarySnapshot,
  selectQaSummarySnapshotQuestions,
  type QaSummaryAnalysisSnapshot,
} from './qaSummarySnapshot';
import {
  bindQaSummaryModelOutput,
  createFailedQaSummaryResult,
  createPendingQaSummaryResult,
  createUncertainQaSummaryResult,
} from './qaSummaryValidate';

export type QaSummaryProcessor = (
  snapshot: QaSummaryAnalysisSnapshot,
  snapshotHash: string,
) => Promise<QaSummaryModelOutput>;

export type QaSummarySnapshotLoader = (
  sessionId: string,
  locale: AppLocale,
  maxSources: number,
) => Promise<QaSummaryAnalysisSnapshot>;

type SessionSummaryState = {
  result: QaSummaryResult;
  inflight: boolean;
  lastFinishedAt: number | null;
  expiresAt: number;
};

type QueueJob = {
  readonly sessionId: string;
  readonly locale: AppLocale;
};

type QueueHooks = {
  processor: QaSummaryProcessor;
  loadSnapshot: QaSummarySnapshotLoader;
  config: () => QaSummaryConfig;
  now: () => number;
  schedule: (fn: () => void) => void;
};

const states = new Map<string, SessionSummaryState>();
const queue: QueueJob[] = [];
const pendingTimers: ReturnType<typeof setImmediate>[] = [];
let running = 0;

const defaultLoadSnapshot: QaSummarySnapshotLoader = async (sessionId, locale, maxSources) => {
  const candidates = await prisma.qaQuestion.findMany({
    where: {
      sessionId,
      status: { in: ['PENDING', 'ACTIVE', 'PINNED'] },
    },
    select: {
      id: true,
      text: true,
      status: true,
      upvoteCount: true,
      createdAt: true,
      nlpStatus: true,
    },
  });
  return buildQaSummaryAnalysisSnapshot({
    locale,
    questions: selectQaSummarySnapshotQuestions(candidates, maxSources),
    maxSources,
  });
};

function createDefaultHooks(): QueueHooks {
  return {
    processor: runQaSummaryInference,
    loadSnapshot: defaultLoadSnapshot,
    config: () => resolveQaSummaryConfig(),
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

let hooks: QueueHooks = createDefaultHooks();

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('QA_SUMMARY_TIMEOUT'));
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

function summarizeQaSummaryCatch(error: unknown): { errorName: string; errorMessage: string } {
  if (!(error instanceof Error)) {
    return { errorName: 'unknown', errorMessage: 'non-error' };
  }
  return {
    errorName: error.name.slice(0, 40),
    errorMessage: error.message.replace(/\s+/g, ' ').slice(0, 160),
  };
}

function inferenceConfigured(config: QaSummaryConfig): boolean {
  return Boolean(config.inferenceUrl);
}

const TOO_FEW_VISIBLE_QUESTIONS_LIMITATION =
  'Es gibt noch zu wenige sichtbare Fragen für eine Zusammenfassung.';

function hasTooFewSummarySources(snapshot: QaSummaryAnalysisSnapshot): boolean {
  return snapshot.sources.length < QA_SUMMARY_MIN_VISIBLE_QUESTIONS;
}

function tooFewSourcesResult(
  snapshot: QaSummaryAnalysisSnapshot,
  snapshotHash: string,
  analyzedAt: string,
): QaSummaryResult {
  return createUncertainQaSummaryResult({
    snapshot,
    snapshotHash,
    analyzedAt,
    limitation: TOO_FEW_VISIBLE_QUESTIONS_LIMITATION,
  });
}

function pruneExpired(sessionId: string, now: number): void {
  const state = states.get(sessionId);
  if (!state) return;
  if (!state.inflight && state.expiresAt <= now) {
    states.delete(sessionId);
  }
}

function toRuntime(sessionId: string): QaSummaryRuntimeDTO {
  const config = hooks.config();
  const now = hooks.now();
  pruneExpired(sessionId, now);
  const state = states.get(sessionId);
  return {
    enabled: config.enabled,
    inferenceConfigured: inferenceConfigured(config),
    result: state?.result ?? null,
  };
}

async function processJob(job: QueueJob): Promise<void> {
  const started = hooks.now();
  const config = hooks.config();
  const state = states.get(job.sessionId);
  try {
    const snapshot = await hooks.loadSnapshot(job.sessionId, job.locale, config.maxSources);
    assertQaSummarySnapshotMinimized(snapshot);
    const snapshotHash = hashQaSummarySnapshot(snapshot);
    const analyzedAt = new Date(hooks.now()).toISOString();

    if (hasTooFewSummarySources(snapshot)) {
      const result = tooFewSourcesResult(snapshot, snapshotHash, analyzedAt);
      states.set(job.sessionId, {
        result,
        inflight: false,
        lastFinishedAt: hooks.now(),
        expiresAt: hooks.now() + config.ttlMs,
      });
      logger.info('qa_summary:uncertain', {
        reason: 'too-few-sources',
        sourceCount: snapshot.sources.length,
        latencyMs: hooks.now() - started,
      });
      return;
    }

    const output = await withTimeout(hooks.processor(snapshot, snapshotHash), config.timeoutMs);
    const result = bindQaSummaryModelOutput({
      output,
      snapshot,
      snapshotHash,
      analyzedAt,
    });
    states.set(job.sessionId, {
      result,
      inflight: false,
      lastFinishedAt: hooks.now(),
      expiresAt: hooks.now() + config.ttlMs,
    });
    logger.info('qa_summary:completed', {
      status: result.status,
      modelVersion: result.modelVersion,
      latencyMs: hooks.now() - started,
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.message === 'QA_SUMMARY_TIMEOUT';
    const snapshot: QaSummaryAnalysisSnapshot = state
      ? {
          locale: state.result.locale,
          sources: state.result.sources.map((source) => ({
            id: source.id,
            kind: source.kind,
            text: source.label,
          })),
        }
      : { locale: job.locale, sources: [] };
    const snapshotHash = state?.result.snapshotHash ?? hashQaSummarySnapshot(snapshot);
    const result = createFailedQaSummaryResult({
      snapshot,
      snapshotHash,
      analyzedAt: new Date(hooks.now()).toISOString(),
      reason: timedOut
        ? 'Die Zusammenfassung hat zu lange gedauert.'
        : 'Die Zusammenfassung ist gerade nicht verfügbar.',
      modelVersion: timedOut ? 'stub:timeout' : 'stub:error',
    });
    states.set(job.sessionId, {
      result,
      inflight: false,
      lastFinishedAt: hooks.now(),
      expiresAt: hooks.now() + config.ttlMs,
    });
    logger.warn('qa_summary:failed', {
      reason: timedOut ? 'timeout' : 'error',
      latencyMs: hooks.now() - started,
      ...summarizeQaSummaryCatch(error),
    });
  } finally {
    running -= 1;
    pump();
  }
}

function pump(): void {
  const config = hooks.config();
  while (running < config.concurrency && queue.length > 0) {
    const job = queue.shift();
    if (!job) {
      break;
    }
    running += 1;
    hooks.schedule(() => {
      void processJob(job);
    });
  }
}

export function getQaSummaryRuntime(sessionId: string): QaSummaryRuntimeDTO {
  return toRuntime(sessionId);
}

export async function requestQaSummary(
  sessionId: string,
  locale: AppLocale,
): Promise<QaSummaryRuntimeDTO> {
  const config = hooks.config();
  const now = hooks.now();
  pruneExpired(sessionId, now);

  if (!config.enabled) {
    return {
      enabled: false,
      inferenceConfigured: inferenceConfigured(config),
      result: null,
    };
  }

  const existing = states.get(sessionId);
  if (existing?.inflight) {
    return toRuntime(sessionId);
  }

  const snapshot = await hooks.loadSnapshot(sessionId, locale, config.maxSources);
  assertQaSummarySnapshotMinimized(snapshot);
  const snapshotHash = hashQaSummarySnapshot(snapshot);

  if (hasTooFewSummarySources(snapshot)) {
    if (isQaSummaryKeepableResultStatus(existing?.result.status)) {
      return toRuntime(sessionId);
    }
    const result = tooFewSourcesResult(snapshot, snapshotHash, new Date(now).toISOString());
    states.set(sessionId, {
      result,
      inflight: false,
      lastFinishedAt: now,
      expiresAt: now + config.ttlMs,
    });
    logger.info('qa_summary:uncertain', {
      reason: 'too-few-sources',
      sourceCount: snapshot.sources.length,
    });
    return toRuntime(sessionId);
  }

  if (
    existing &&
    existing.lastFinishedAt !== null &&
    now - existing.lastFinishedAt < config.cooldownMs &&
    existing.result.snapshotHash === snapshotHash &&
    existing.result.status !== 'failed'
  ) {
    return toRuntime(sessionId);
  }

  if (queue.length + running >= config.queueLimit) {
    const result = createFailedQaSummaryResult({
      snapshot,
      snapshotHash,
      analyzedAt: new Date(now).toISOString(),
      reason: 'Die Zusammenfassung ist gerade nicht verfügbar.',
      modelVersion: 'stub:queue-limit',
    });
    states.set(sessionId, {
      result,
      inflight: false,
      lastFinishedAt: now,
      expiresAt: now + config.ttlMs,
    });
    logger.warn('qa_summary:skipped', { reason: 'queue-limit' });
    return toRuntime(sessionId);
  }

  const pending = createPendingQaSummaryResult({ snapshot, snapshotHash });
  states.set(sessionId, {
    result: pending,
    inflight: true,
    lastFinishedAt: existing?.lastFinishedAt ?? null,
    expiresAt: now + config.ttlMs,
  });
  queue.push({ sessionId, locale });
  pump();
  return toRuntime(sessionId);
}

export function resetQaSummaryQueueForTests(overrides?: Partial<QueueHooks>): void {
  for (const timer of pendingTimers.splice(0)) {
    clearImmediate(timer);
  }
  queue.splice(0, queue.length);
  running = 0;
  states.clear();
  hooks = {
    ...createDefaultHooks(),
    ...overrides,
  };
}

export async function waitForQaSummaryIdleForTests(timeoutMs = 1_000): Promise<void> {
  const started = Date.now();
  while (queue.length > 0 || running > 0 || pendingTimers.length > 0) {
    if (Date.now() - started > timeoutMs) {
      throw new Error('Q&A-Summary-Queue wurde nicht leer');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
