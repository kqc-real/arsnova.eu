import { setTimeout as wait } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import {
  QA_SUMMARY_RESULT_V2_CONTRACT_VERSION,
  QA_SUMMARY_V2_SCHEMA_VERSION,
  QaSummaryExecutionV2Schema,
  QaSummaryResultV2Schema,
  type AppLocale,
  type QaSummaryContextPreviewDTO,
  type QaSummaryFallbackReason,
  type QaSummaryResultV2,
  type QaSummaryRuntimeV2DTO,
} from '@arsnova/shared-types';
import type { HostTokenContext } from './hostAuth';
import { logger } from './logger';
import {
  createQaSummaryFallback,
  prepareFreshModerationSummaryContext,
  resolveQaSummaryAdapterPlan,
  type PreparedModerationSummaryContext,
  type QaSummaryAdapterPlan,
} from './moderationSummaryContext';
import { createExtractiveQaSummaryOutput } from './qaSummaryExtractive';
import { resolveQaSummaryConfig, type QaSummaryConfig } from './qaSummaryConfig';
import { runPreparedQaSummary, type QaSummaryPreparedRun } from './qaSummaryRuntimeAdapter';
import {
  clearLocalSummaryState,
  compareAndSetSummaryState,
  invalidateSummaryState,
  readSummaryState,
  resetLocalSummaryStates,
  summaryStateUnavailable,
  type SessionSummaryState,
  type SummaryStateRecord,
} from './qaSummaryStateStore';
import { bindQaSummaryModelOutputV2, createPendingQaSummaryResultV2 } from './qaSummaryValidateV2';
import { registerSessionPurgeInvalidator } from './sessionPurgeInvalidation';

export type QaSummaryContextPreparer = (input: {
  readonly sessionId: string;
  readonly locale: AppLocale;
  readonly access: HostTokenContext;
}) => Promise<PreparedModerationSummaryContext>;

export type QaSummaryV2Processor = (
  prepared: PreparedModerationSummaryContext,
  options: { readonly signal: AbortSignal },
) => Promise<QaSummaryPreparedRun>;

type EphemeralHostAccess = { hostToken?: string };

type QueueJob = {
  readonly sessionId: string;
  readonly locale: AppLocale;
  readonly generation: string;
  readonly access: EphemeralHostAccess;
};

type QueueHooks = {
  prepare: QaSummaryContextPreparer;
  processor: QaSummaryV2Processor;
  config: () => QaSummaryConfig;
  plan: () => QaSummaryAdapterPlan;
  now: () => number;
  schedule: (fn: () => void) => void;
};

const queue: QueueJob[] = [];
const pendingTimers: ReturnType<typeof setImmediate>[] = [];
const invalidatedSessions = new Map<string, number>();
const activeJobs = new Map<string, { generation: string; controller: AbortController }>();
const SUMMARY_INVALIDATION_MS = 60_000;
const SUMMARY_PENDING_CONTEXT_MARGIN_MS = 30_000;
const SUMMARY_STATE_MAX_ATTEMPTS = 3;
const SUMMARY_MAX_PRIORITY_RETRIES = 2;
const SUMMARY_MAX_PRIORITY_ADMISSION_RETRIES = 16;
const SUMMARY_PRIORITY_RETRY_DELAY_MS = 125;
let running = 0;
let reserving = 0;

const queueMetrics = {
  completed: 0,
  failed: 0,
  timeouts: 0,
  cacheHits: 0,
  queueRejected: 0,
  lastLatencyMs: null as number | null,
};

function createDefaultHooks(): QueueHooks {
  return {
    prepare: prepareFreshModerationSummaryContext,
    processor: (prepared, options) => runPreparedQaSummary(prepared, options),
    config: () => resolveQaSummaryConfig(),
    plan: () => resolveQaSummaryAdapterPlan(),
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

function clearEphemeralAccess(job: QueueJob): void {
  job.access.hostToken = undefined;
}

function cloneMinimalHostAccess(access: HostTokenContext): EphemeralHostAccess {
  const hostToken = access.hostToken?.trim();
  if (!hostToken) {
    throw new Error('Q&A-Summary-Queue benötigt einen bereits validierten Host-Token.');
  }
  return { hostToken };
}

function isSessionInvalidated(sessionId: string): boolean {
  const invalidatedUntil = invalidatedSessions.get(sessionId);
  if (invalidatedUntil === undefined) return false;
  if (invalidatedUntil <= Date.now()) {
    invalidatedSessions.delete(sessionId);
    return false;
  }
  return true;
}

function invalidateQaSummaryLocally(sessionId: string): void {
  invalidatedSessions.set(sessionId, Date.now() + SUMMARY_INVALIDATION_MS);
  clearLocalSummaryState(sessionId);
  activeJobs.get(sessionId)?.controller.abort(new Error('QA_SUMMARY_PURGED'));
  activeJobs.delete(sessionId);
  for (let index = queue.length - 1; index >= 0; index -= 1) {
    const job = queue[index];
    if (job?.sessionId !== sessionId) continue;
    clearEphemeralAccess(job);
    queue.splice(index, 1);
  }
}

export async function invalidateQaSummaryForSession(sessionId: string): Promise<void> {
  invalidateQaSummaryLocally(sessionId);
  await invalidateSummaryState(sessionId, SUMMARY_INVALIDATION_MS);
}

registerSessionPurgeInvalidator((event) => invalidateQaSummaryLocally(event.sessionId));

function toRuntime(result: QaSummaryResultV2 | null): QaSummaryRuntimeV2DTO {
  const config = hooks.config();
  const plan = hooks.plan();
  return {
    schemaVersion: QA_SUMMARY_V2_SCHEMA_VERSION,
    enabled: config.enabled,
    inferenceConfigured: plan.inferenceConfigured,
    capabilities: plan.capabilities,
    result,
  };
}

function hasMinimumSummaryCorpus(prepared: PreparedModerationSummaryContext): boolean {
  const questions = prepared.request.promptContext.context.questions;
  return questions.state === 'available' && questions.corpus.eligible >= 3;
}

function extractiveExecution(
  reason: QaSummaryFallbackReason,
  attemptedMode: 'full-context' | 'legacy-text' | null,
  retry: 'manual' | 'not-applicable' = 'manual',
) {
  return QaSummaryExecutionV2Schema.parse({
    attemptedMode,
    effectiveMode: 'extractive',
    fallback: createQaSummaryFallback('extractive', reason, retry),
  });
}

function bindExtractiveResult(
  prepared: PreparedModerationSummaryContext,
  reason: QaSummaryFallbackReason,
  analyzedAt: string,
  attemptedMode: 'full-context' | 'legacy-text' | null = prepared.plan.selectedMode,
  retry: 'manual' | 'not-applicable' = 'manual',
): QaSummaryResultV2 {
  return bindQaSummaryModelOutputV2({
    output: createExtractiveQaSummaryOutput(prepared.request.promptContext),
    prepared,
    execution: extractiveExecution(reason, attemptedMode, retry),
    analyzedAt,
  });
}

function createUnavailableResult(input: {
  readonly pending: QaSummaryResultV2;
  readonly reason: QaSummaryFallbackReason;
  readonly analyzedAt: string;
}): QaSummaryResultV2 {
  return QaSummaryResultV2Schema.parse({
    schemaVersion: QA_SUMMARY_V2_SCHEMA_VERSION,
    contractVersion: QA_SUMMARY_RESULT_V2_CONTRACT_VERSION,
    status: 'failed',
    statements: [],
    suggestedNextSteps: [],
    limitations: ['Die Zusammenfassung ist gerade nicht verfügbar.'],
    sources: [],
    modelVersion: `fallback:${input.reason}`,
    analyzedAt: input.analyzedAt,
    snapshotHash: input.pending.snapshotHash,
    locale: input.pending.locale,
    execution: {
      attemptedMode: null,
      effectiveMode: 'rule-based',
      fallback: createQaSummaryFallback('rule-based', input.reason),
    },
  });
}

function tooFewQuestionsResult(
  prepared: PreparedModerationSummaryContext,
  analyzedAt: string,
): QaSummaryResultV2 {
  const context = prepared.request.promptContext;
  return QaSummaryResultV2Schema.parse({
    schemaVersion: QA_SUMMARY_V2_SCHEMA_VERSION,
    contractVersion: QA_SUMMARY_RESULT_V2_CONTRACT_VERSION,
    status: 'uncertain',
    statements: [],
    suggestedNextSteps: [],
    limitations: ['Es gibt noch zu wenige sichtbare Fragen für eine Zusammenfassung.'],
    sources: [],
    analyzedAt,
    snapshotHash: context.snapshotHash,
    locale: context.context.locale,
    execution: {
      attemptedMode: null,
      effectiveMode: 'rule-based',
      fallback: createQaSummaryFallback('rule-based', 'context_unavailable'),
    },
  });
}

function summarizeQaSummaryCatch(error: unknown): { errorName: string; errorMessage: string } {
  if (!(error instanceof Error)) return { errorName: 'unknown', errorMessage: 'non-error' };
  return {
    errorName: error.name.slice(0, 40),
    errorMessage: error.message.replace(/\s+/g, ' ').slice(0, 160),
  };
}

function fallbackReasonForError(error: unknown): QaSummaryFallbackReason {
  if (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    ((error as { code?: unknown }).code === 'UNAUTHORIZED' ||
      (error as { code?: unknown }).code === 'FORBIDDEN')
  ) {
    return 'permission_changed';
  }
  return 'context_unavailable';
}

async function runWithQueueTimeout(input: {
  readonly job: QueueJob;
  readonly prepared: PreparedModerationSummaryContext;
  readonly timeoutMs: number;
}): Promise<
  | { status: 'completed'; run: QaSummaryPreparedRun }
  | { status: 'timeout' }
  | { status: 'superseded' }
> {
  const controller = new AbortController();
  activeJobs.set(input.job.sessionId, { generation: input.job.generation, controller });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<{ status: 'timeout' }>((resolve) => {
    timer = setTimeout(() => {
      controller.abort(new Error('QA_SUMMARY_TIMEOUT'));
      resolve({ status: 'timeout' });
    }, input.timeoutMs);
  });
  const processWithRetries = async () => {
    const { signal } = controller;
    let run = await hooks.processor(input.prepared, { signal });
    if (run.interruptedByPriority) {
      let interruptions = 1;
      for (
        let attempt = 1;
        !signal.aborted &&
        interruptions <= SUMMARY_MAX_PRIORITY_RETRIES &&
        attempt <= SUMMARY_MAX_PRIORITY_ADMISSION_RETRIES &&
        (run.interruptedByPriority || run.execution.fallback?.reason === 'busy');
        attempt += 1
      ) {
        await wait(SUMMARY_PRIORITY_RETRY_DELAY_MS, undefined, { signal }).catch(() => undefined);
        if (signal.aborted || !(await readRunningJob(input.job))) {
          return { status: 'superseded' as const };
        }
        const fresh = await hooks.prepare({
          sessionId: input.job.sessionId,
          locale: input.job.locale,
          access: input.job.access,
        });
        if (
          fresh.request.promptContext.snapshotHash !==
          input.prepared.request.promptContext.snapshotHash
        ) {
          return { status: 'completed' as const, run };
        }
        if (signal.aborted || !(await readRunningJob(input.job))) {
          return { status: 'superseded' as const };
        }
        logger.info('llm:priority_retry', { taskType: 'qa_summary', retry: attempt });
        run = await hooks.processor(fresh, { signal });
        if (run.interruptedByPriority) interruptions += 1;
      }
    }
    return { status: 'completed' as const, run };
  };
  try {
    return await Promise.race([processWithRetries(), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
    const active = activeJobs.get(input.job.sessionId);
    if (active?.generation === input.job.generation) activeJobs.delete(input.job.sessionId);
  }
}

type RunningSummaryRecord = SummaryStateRecord & { state: SessionSummaryState };

async function readRunningJob(job: QueueJob): Promise<RunningSummaryRecord | null> {
  if (isSessionInvalidated(job.sessionId)) return null;
  const record = await readSummaryState(job.sessionId, hooks.now());
  if (record?.state?.result.status !== 'pending' || record.state.generation !== job.generation) {
    return null;
  }
  return { revision: record.revision, state: record.state };
}

function finishedState(
  result: QaSummaryResultV2,
  generation: string,
  now: number,
  config: QaSummaryConfig,
): SessionSummaryState {
  return { result, generation, lastFinishedAt: now, expiresAt: now + config.ttlMs };
}

async function finishJob(job: QueueJob, result: QaSummaryResultV2, config: QaSummaryConfig) {
  const record = await readRunningJob(job);
  if (!record) return false;
  const now = hooks.now();
  return Boolean(
    await compareAndSetSummaryState(
      job.sessionId,
      record,
      finishedState(result, job.generation, now, config),
      now,
    ),
  );
}

async function processJob(job: QueueJob): Promise<void> {
  const started = hooks.now();
  const config = hooks.config();
  try {
    const record = await readRunningJob(job);
    if (!record) return;
    const preparedBefore = await hooks.prepare({
      sessionId: job.sessionId,
      locale: job.locale,
      access: job.access,
    });
    if (isSessionInvalidated(job.sessionId)) return;

    if (!hasMinimumSummaryCorpus(preparedBefore)) {
      if (
        await finishJob(
          job,
          tooFewQuestionsResult(preparedBefore, new Date(hooks.now()).toISOString()),
          config,
        )
      ) {
        queueMetrics.completed += 1;
        queueMetrics.lastLatencyMs = hooks.now() - started;
      }
      return;
    }

    const now = hooks.now();
    const pending = await compareAndSetSummaryState(
      job.sessionId,
      record,
      {
        ...record.state,
        result: createPendingQaSummaryResultV2(preparedBefore),
        expiresAt: now + config.timeoutMs + SUMMARY_PENDING_CONTEXT_MARGIN_MS,
      },
      now,
    );
    if (!pending || isSessionInvalidated(job.sessionId)) return;

    const run = await runWithQueueTimeout({
      job,
      prepared: preparedBefore,
      timeoutMs: config.timeoutMs,
    });
    if (run.status === 'superseded' || !(await readRunningJob(job))) return;

    const preparedAfter = await hooks.prepare({
      sessionId: job.sessionId,
      locale: job.locale,
      access: job.access,
    });
    const analyzedAt = new Date(hooks.now()).toISOString();
    const sourceChanged =
      preparedAfter.request.promptContext.snapshotHash !==
      preparedBefore.request.promptContext.snapshotHash;
    const result = sourceChanged
      ? bindExtractiveResult(preparedAfter, 'source_changed', analyzedAt)
      : run.status === 'timeout'
        ? bindExtractiveResult(preparedAfter, 'timeout', analyzedAt)
        : bindQaSummaryModelOutputV2({
            output: run.run.output,
            prepared: preparedAfter,
            execution: run.run.execution,
            analyzedAt,
          });

    if (!(await finishJob(job, result, config))) return;
    logger.info('qa_summary:completed', {
      status: result.status,
      effectiveMode: result.execution.effectiveMode,
      fallbackReason: result.execution.fallback?.reason ?? null,
      latencyMs: hooks.now() - started,
    });
    queueMetrics.completed += 1;
    queueMetrics.lastLatencyMs = hooks.now() - started;
    if (run.status === 'timeout') queueMetrics.timeouts += 1;
  } catch (error) {
    const fallbackReason = fallbackReasonForError(error);
    try {
      const record = await readRunningJob(job);
      if (record) {
        const now = hooks.now();
        const result = createUnavailableResult({
          pending: record.state.result,
          reason: fallbackReason,
          analyzedAt: new Date(now).toISOString(),
        });
        await compareAndSetSummaryState(
          job.sessionId,
          record,
          finishedState(result, job.generation, now, config),
          now,
        );
      }
    } catch {
      logger.warn('qa_summary:state_unavailable');
    }
    logger.warn('qa_summary:failed', {
      reason: fallbackReason,
      latencyMs: hooks.now() - started,
      ...summarizeQaSummaryCatch(error),
    });
    queueMetrics.failed += 1;
  } finally {
    clearEphemeralAccess(job);
    running -= 1;
    pump();
  }
}

function pump(): void {
  const config = hooks.config();
  while (running < config.concurrency && queue.length > 0) {
    const job = queue.shift();
    if (!job) break;
    running += 1;
    hooks.schedule(() => void processJob(job));
  }
}

export async function getQaSummaryRuntime(sessionId: string): Promise<QaSummaryRuntimeV2DTO> {
  const record = await readSummaryState(sessionId, hooks.now());
  return toRuntime(record?.state?.result ?? null);
}

export async function getQaSummaryRuntimeFresh(
  sessionId: string,
  access: HostTokenContext,
): Promise<QaSummaryRuntimeV2DTO> {
  if (!hooks.config().enabled) return toRuntime(null);
  for (let attempt = 0; attempt < SUMMARY_STATE_MAX_ATTEMPTS; attempt++) {
    const record = await readSummaryState(sessionId, hooks.now());
    if (!record?.state || record.state.result.status === 'pending') {
      return toRuntime(record?.state?.result ?? null);
    }
    const current = record.state;

    const prepared = await hooks.prepare({ sessionId, locale: current.result.locale, access });
    const now = hooks.now();
    const latest = await readSummaryState(sessionId, now);
    if (latest?.revision !== record.revision) continue;
    if (prepared.request.promptContext.snapshotHash === current.result.snapshotHash) {
      return toRuntime(current.result);
    }

    const result = bindExtractiveResult(prepared, 'source_changed', new Date(now).toISOString());
    const written = await compareAndSetSummaryState(
      sessionId,
      record,
      finishedState(result, current.generation, now, hooks.config()),
      now,
    );
    if (written) {
      logger.info('qa_summary:stale_on_read', {
        fallbackReason: 'source_changed',
        previousMode: current.result.execution.effectiveMode,
        sourceCount: result.sources.length,
      });
      return toRuntime(result);
    }
  }
  throw summaryStateUnavailable();
}

export async function getQaSummaryContextPreview(
  sessionId: string,
  locale: AppLocale,
  access: HostTokenContext,
): Promise<QaSummaryContextPreviewDTO> {
  return (await hooks.prepare({ sessionId, locale, access })).preview;
}

export function getQaSummaryQueueMetrics() {
  return { queueLength: queue.length, running, ...queueMetrics };
}

export async function requestQaSummary(
  sessionId: string,
  locale: AppLocale,
  access: HostTokenContext,
): Promise<QaSummaryRuntimeV2DTO> {
  const config = hooks.config();
  if (!config.enabled) return toRuntime(null);

  const existing = await readSummaryState(sessionId, hooks.now());
  if (isSessionInvalidated(sessionId) || (existing && !existing.state)) return toRuntime(null);
  if (existing?.state?.result.status === 'pending') return toRuntime(existing.state.result);

  const prepared = await hooks.prepare({ sessionId, locale, access });
  const snapshotHash = prepared.request.promptContext.snapshotHash;

  for (let attempt = 0; attempt < SUMMARY_STATE_MAX_ATTEMPTS; attempt++) {
    // Context preparation can overlap another replica's request or a purge.
    const now = hooks.now();
    const record = await readSummaryState(sessionId, now);
    const current = record?.state;
    if (isSessionInvalidated(sessionId) || (record && !current)) return toRuntime(null);
    if (current?.result.status === 'pending') return toRuntime(current.result);
    const generation = randomUUID();

    if (!hasMinimumSummaryCorpus(prepared)) {
      if (
        current?.result.snapshotHash === snapshotHash &&
        (current.result.status === 'ready' || current.result.status === 'uncertain')
      ) {
        return toRuntime(current.result);
      }
      const result = tooFewQuestionsResult(prepared, new Date(now).toISOString());
      if (
        await compareAndSetSummaryState(
          sessionId,
          record,
          finishedState(result, generation, now, config),
          now,
        )
      )
        return toRuntime(result);
      continue;
    }

    if (
      current &&
      current.lastFinishedAt !== null &&
      now - current.lastFinishedAt < config.cooldownMs &&
      current.result.snapshotHash === snapshotHash &&
      current.result.status !== 'failed' &&
      !(
        (current.result.execution.effectiveMode === 'extractive' ||
          current.result.execution.effectiveMode === 'rule-based') &&
        current.result.execution.fallback?.retry === 'manual'
      )
    ) {
      queueMetrics.cacheHits += 1;
      return toRuntime(current.result);
    }

    const depth = queue.length + running + reserving;
    if (depth >= config.queueLimit) {
      const result = bindExtractiveResult(prepared, 'queue_full', new Date(now).toISOString());
      if (
        await compareAndSetSummaryState(
          sessionId,
          record,
          finishedState(result, generation, now, config),
          now,
        )
      ) {
        queueMetrics.queueRejected += 1;
        logger.warn('qa_summary:skipped', { reason: 'queue-full' });
        return toRuntime(result);
      }
      continue;
    }

    const job = { sessionId, locale, generation, access: cloneMinimalHostAccess(access) };
    const result = createPendingQaSummaryResultV2(prepared);
    reserving += 1;
    let written: SummaryStateRecord | null;
    try {
      written = await compareAndSetSummaryState(
        sessionId,
        record,
        {
          result,
          generation,
          lastFinishedAt: current?.lastFinishedAt ?? null,
          expiresAt:
            now +
            Math.ceil((depth + 1) / config.concurrency) *
              (config.timeoutMs + SUMMARY_PENDING_CONTEXT_MARGIN_MS),
        },
        now,
      );
    } catch (error) {
      clearEphemeralAccess(job);
      throw error;
    } finally {
      reserving -= 1;
    }
    if (written && !isSessionInvalidated(sessionId)) {
      queue.push(job);
      pump();
      return toRuntime(result);
    }
    clearEphemeralAccess(job);
  }
  throw summaryStateUnavailable();
}

export function resetQaSummaryQueueForTests(overrides?: Partial<QueueHooks>): void {
  for (const timer of pendingTimers.splice(0)) clearImmediate(timer);
  for (const job of queue.splice(0)) clearEphemeralAccess(job);
  for (const { controller } of activeJobs.values()) {
    controller.abort(new Error('QA_SUMMARY_TEST_RESET'));
  }
  activeJobs.clear();
  running = 0;
  reserving = 0;
  resetLocalSummaryStates();
  invalidatedSessions.clear();
  queueMetrics.completed = 0;
  queueMetrics.failed = 0;
  queueMetrics.timeouts = 0;
  queueMetrics.cacheHits = 0;
  queueMetrics.queueRejected = 0;
  queueMetrics.lastLatencyMs = null;
  hooks = { ...createDefaultHooks(), ...overrides };
}

export async function waitForQaSummaryIdleForTests(timeoutMs = 1_000): Promise<void> {
  const started = Date.now();
  while (queue.length > 0 || running > 0 || reserving > 0 || pendingTimers.length > 0) {
    if (Date.now() - started > timeoutMs) {
      throw new Error('Q&A-Summary-Queue wurde nicht leer');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
