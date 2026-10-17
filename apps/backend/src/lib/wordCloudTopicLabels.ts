/**
 * Kurze Themennamen nach dem Encoder-Lauf.
 * Der Schritt hält die Session-Queue nicht: der Aufrufer startet ihn erst,
 * nachdem `analyzeSemanticWordCloudSnapshot` das Slot freigegeben hat.
 */
import { createHash } from 'node:crypto';
import {
  OPEN_WEIGHT_LLM_MAX_REQUEST_BYTES,
  type AnalyzeWordCloudInput,
  type AnalyzeWordCloudOutput,
  type OpenWeightLlmTopicLabelBatchItem,
  type OpenWeightLlmTopicLabelBatchOutput,
  type OpenWeightLlmTopicLabelBatchRequest,
  type OpenWeightLlmTopicLabelOutput,
  type OpenWeightLlmTopicLabelRequest,
  type WordCloudAnalysisEntryDTO,
  type WordCloudLabelOrigin,
  type WordCloudLabelSettlement,
} from '@arsnova/shared-types';
import {
  isOpenWeightLlmEnabled,
  OPEN_WEIGHT_LLM_LABEL_TIMEOUT_DEFAULT_MS,
  OPEN_WEIGHT_LLM_MODEL_ID,
  OPEN_WEIGHT_LLM_MODEL_VERSION,
  resolveOpenWeightLlmLabelTimeoutMs,
} from './openWeightLlmConfig';
import {
  runOpenWeightLlmTopicLabel,
  runOpenWeightLlmTopicLabelBatch,
  type OpenWeightLlmFailureResult,
  type OpenWeightLlmLiveResult,
  type OpenWeightLlmTelemetry,
} from './openWeightLlmClient';
import { analyzeSemanticWordCloudSnapshot } from './wordCloudSemanticAnalyze';
import type { WordCloudNormalizationMeta } from './wordCloudNormalization';

/**
 * Untergrenze für den Namensschritt. Produktion mit CPU-llama.cpp braucht
 * darüber hinaus das konfigurierte `OPEN_WEIGHT_LLM_LABEL_TIMEOUT_MS` pro
 * Kandidat — sonst endet der Schritt nach dem Encoder-Lauf bei Mitgliedstexten.
 */
export const WORD_CLOUD_TOPIC_LABEL_PHASE_BUDGET_MS = 8_000;
/** Harte Obergrenze, damit die Host-Wartezeit im Hörsaal nicht ungebunden wächst. */
export const WORD_CLOUD_TOPIC_LABEL_PHASE_BUDGET_CAP_MS = 120_000;
const TOPIC_LABEL_MAX_CANDIDATES = 12;
/**
 * Repräsentative Obergrenze pro Cluster: hält CPU-Prefill kurz und vermeidet,
 * dass lange UUID-Listen in `sourceIds` das 96-Token-Ausgabebudget sprengen.
 */
export const TOPIC_LABEL_MAX_SOURCES_PER_CLUSTER = 6;
const TOPIC_LABEL_MAX_SOURCE_TEXT_CHARS = 240;
const TOPIC_LABEL_COMPACT_ID_MAX_LENGTH = 20;
const TOPIC_LABEL_CACHE_TTL_MS = 30 * 60_000;
const TOPIC_LABEL_CACHE_MAX_ENTRIES = 512;
const TOPIC_LABEL_LOCALES = new Set(['de', 'en']);
const TRANSIENT_REASONS = new Set([
  'busy',
  'timeout',
  'aborted',
  'circuit_open',
  'unavailable',
  'misconfigured',
]);

export type TopicLabelCaller = (
  request: OpenWeightLlmTopicLabelRequest,
  fallback: OpenWeightLlmTopicLabelOutput,
  options: { readonly signal?: AbortSignal },
) => Promise<OpenWeightLlmLiveResult<OpenWeightLlmTopicLabelOutput>>;

export type TopicLabelBatchCaller = (
  request: OpenWeightLlmTopicLabelBatchRequest,
  options: { readonly signal?: AbortSignal },
) => Promise<
  | {
      readonly status: 'completed';
      readonly output: OpenWeightLlmTopicLabelBatchOutput;
      readonly telemetry: OpenWeightLlmTelemetry;
    }
  | OpenWeightLlmFailureResult
>;

type LabelOptions = {
  readonly sessionId?: string;
  readonly signal?: AbortSignal;
  readonly now?: () => number;
  readonly label?: TopicLabelCaller;
  readonly labelBatch?: TopicLabelBatchCaller;
  readonly useProcessLabelCache?: boolean;
  readonly env?: NodeJS.ProcessEnv;
};

type CachedClusterTopicLabel = {
  readonly label: string;
  readonly expiresAt: number;
};

const clusterTopicLabelCache = new Map<string, CachedClusterTopicLabel>();
const sessionLabelAbortControllers = new Map<string, AbortController>();

function sessionLabelCachePrefix(sessionId?: string, sessionCode = ''): string {
  const trimmedSessionId = sessionId?.trim();
  if (trimmedSessionId && trimmedSessionId.length > 0) {
    return `session:${trimmedSessionId}`;
  }
  return `unscoped:${sessionCode.trim().toUpperCase()}`;
}

function getOrCreateSessionLabelSignal(sessionId?: string): AbortSignal | undefined {
  const trimmedSessionId = sessionId?.trim();
  if (!trimmedSessionId) {
    return undefined;
  }
  const key = sessionLabelCachePrefix(trimmedSessionId);
  let controller = sessionLabelAbortControllers.get(key);
  if (!controller || controller.signal.aborted) {
    controller = new AbortController();
    sessionLabelAbortControllers.set(key, controller);
  }
  return controller.signal;
}

function purgeExpiredClusterTopicLabels(nowMs: number): void {
  for (const [key, entry] of clusterTopicLabelCache.entries()) {
    if (entry.expiresAt <= nowMs) {
      clusterTopicLabelCache.delete(key);
    }
  }
}

export function invalidateWordCloudTopicLabelSession(sessionId: string, nowMs = Date.now()): void {
  purgeExpiredClusterTopicLabels(nowMs);
  const scopeKey = sessionLabelCachePrefix(sessionId);
  const controller = sessionLabelAbortControllers.get(scopeKey);
  if (controller) {
    controller.abort();
    sessionLabelAbortControllers.delete(scopeKey);
  }
  const prefix = `${scopeKey}:`;
  for (const key of clusterTopicLabelCache.keys()) {
    if (key.startsWith(prefix)) {
      clusterTopicLabelCache.delete(key);
    }
  }
}

export function resetWordCloudTopicLabelCacheForTests(): void {
  clusterTopicLabelCache.clear();
  for (const controller of sessionLabelAbortControllers.values()) {
    controller.abort();
  }
  sessionLabelAbortControllers.clear();
}

function buildClusterTopicLabelCacheKey(
  scopePrefix: string,
  locale: string,
  sources: readonly { readonly id: string; readonly text: string }[],
): string {
  const digest = createHash('sha256')
    .update(
      JSON.stringify({
        model: OPEN_WEIGHT_LLM_MODEL_ID,
        version: OPEN_WEIGHT_LLM_MODEL_VERSION,
        locale,
        sources,
      }),
      'utf8',
    )
    .digest('hex');
  return `${scopePrefix}:${digest}`;
}

function readCachedClusterTopicLabel(key: string, nowMs: number): string | null {
  purgeExpiredClusterTopicLabels(nowMs);
  const hit = clusterTopicLabelCache.get(key);
  if (!hit) return null;
  return hit.label;
}

function writeCachedClusterTopicLabel(key: string, label: string, nowMs: number): void {
  purgeExpiredClusterTopicLabels(nowMs);
  if (
    !clusterTopicLabelCache.has(key) &&
    clusterTopicLabelCache.size >= TOPIC_LABEL_CACHE_MAX_ENTRIES
  ) {
    const oldestKey = clusterTopicLabelCache.keys().next().value;
    if (oldestKey !== undefined) {
      clusterTopicLabelCache.delete(oldestKey);
    }
  }
  clusterTopicLabelCache.set(key, {
    label,
    expiresAt: nowMs + TOPIC_LABEL_CACHE_TTL_MS,
  });
}

function normalizeComparable(value: string): string {
  return value.trim().toLocaleLowerCase('de');
}

function wordCount(label: string): number {
  return label
    .trim()
    .split(/\s+/u)
    .filter((part) => part.length > 0).length;
}

function requestByteLength(
  request: OpenWeightLlmTopicLabelRequest | OpenWeightLlmTopicLabelBatchRequest,
): number {
  return new TextEncoder().encode(JSON.stringify(request)).byteLength;
}

function orderedMembers(entry: WordCloudAnalysisEntryDTO) {
  const central = normalizeComparable(entry.label);
  return [...entry.members].sort((left, right) => {
    const leftCentral = normalizeComparable(left.text) === central ? 0 : 1;
    const rightCentral = normalizeComparable(right.text) === central ? 0 : 1;
    if (leftCentral !== rightCentral) return leftCentral - rightCentral;
    if (left.text.length !== right.text.length) return left.text.length - right.text.length;
    return left.sourceId.localeCompare(right.sourceId);
  });
}

function compactTopicLabelSourceId(rawId: string, index: number): string {
  const trimmed = rawId.trim().slice(0, 80);
  if (trimmed.length <= TOPIC_LABEL_COMPACT_ID_MAX_LENGTH) {
    return trimmed;
  }
  return trimmed.startsWith('qa') ? `qa-${index + 1}` : `s${index + 1}`;
}

function packRequest(
  entry: WordCloudAnalysisEntryDTO,
  locale: AnalyzeWordCloudOutput['locale'],
  snapshotHash: string,
): OpenWeightLlmTopicLabelRequest | null {
  const members = orderedMembers(entry).slice(0, TOPIC_LABEL_MAX_SOURCES_PER_CLUSTER);
  const sources = members.map((member, index) => ({
    id: compactTopicLabelSourceId(member.sourceId, index),
    text: member.text.trim().slice(0, TOPIC_LABEL_MAX_SOURCE_TEXT_CHARS),
  }));
  // Konstante clusterId hält den JSON-Präfix vor `sources` über alle Cluster
  // identisch, damit llama.cpp Systemprompt + JSON-Header im KV-Cache behält.
  const clusterId = entry.key === 'echo' ? `${snapshotHash.slice(0, 16)}:echo` : 'cluster';
  let kept = sources;
  while (kept.length >= 2) {
    const request: OpenWeightLlmTopicLabelRequest = {
      schemaVersion: 1,
      taskType: 'topic_label',
      locale,
      clusterId,
      sources: kept,
    };
    if (requestByteLength(request) <= OPEN_WEIGHT_LLM_MAX_REQUEST_BYTES) {
      return request;
    }
    kept = kept.slice(0, -1);
  }
  return null;
}

function acceptLabel(label: string, sources: readonly { readonly text: string }[]): boolean {
  const trimmed = label.trim();
  if (trimmed.length === 0 || trimmed.length > 80) return false;
  if (/[\r\n]/u.test(trimmed)) return false;
  if (wordCount(trimmed) > 6) return false;
  const comparable = normalizeComparable(trimmed);
  return sources.every((source) => normalizeComparable(source.text) !== comparable);
}

function withOrigin(
  entry: WordCloudAnalysisEntryDTO,
  origin: WordCloudLabelOrigin,
  label = entry.label,
): WordCloudAnalysisEntryDTO {
  return {
    ...entry,
    label,
    basisLabel: label,
    labelOrigin: origin,
  };
}

function runtimeEnabled(env: NodeJS.ProcessEnv): boolean {
  return isOpenWeightLlmEnabled(env['OPEN_WEIGHT_LLM_ENABLED']);
}

function labelTimeoutMs(env: NodeJS.ProcessEnv): number {
  try {
    return resolveOpenWeightLlmLabelTimeoutMs(env['OPEN_WEIGHT_LLM_LABEL_TIMEOUT_MS']);
  } catch {
    return OPEN_WEIGHT_LLM_LABEL_TIMEOUT_DEFAULT_MS;
  }
}

/** Wanduhr für alle Kandidaten: mind. ein voller Label-Timeout, höchstens Cap. */
export function resolveTopicLabelPhaseBudgetMs(
  env: NodeJS.ProcessEnv,
  candidateCount: number,
): number {
  const perCall = labelTimeoutMs(env);
  const n = Math.max(1, Math.min(Math.floor(candidateCount), TOPIC_LABEL_MAX_CANDIDATES));
  return Math.min(
    Math.max(WORD_CLOUD_TOPIC_LABEL_PHASE_BUDGET_MS, perCall * n),
    WORD_CLOUD_TOPIC_LABEL_PHASE_BUDGET_CAP_MS,
  );
}

type PendingBatchClusterCandidate = {
  readonly entryIndex: number;
  readonly entry: WordCloudAnalysisEntryDTO;
  readonly request: OpenWeightLlmTopicLabelRequest;
  readonly labelCacheKey: string;
};

function packBatchRequests(
  locale: 'de' | 'en',
  candidates: readonly PendingBatchClusterCandidate[],
): Array<{
  readonly batchRequest: OpenWeightLlmTopicLabelBatchRequest;
  readonly byClusterId: ReadonlyMap<string, PendingBatchClusterCandidate>;
}> {
  const batches: Array<{
    readonly batchRequest: OpenWeightLlmTopicLabelBatchRequest;
    readonly byClusterId: ReadonlyMap<string, PendingBatchClusterCandidate>;
  }> = [];
  let index = 0;

  while (index < candidates.length) {
    const items: OpenWeightLlmTopicLabelBatchItem[] = [];
    const byClusterId = new Map<string, PendingBatchClusterCandidate>();

    while (index < candidates.length && items.length < TOPIC_LABEL_MAX_CANDIDATES) {
      const candidate = candidates[index]!;
      const clusterId = `c${items.length + 1}`;
      const nextItem: OpenWeightLlmTopicLabelBatchItem = {
        clusterId,
        sources: candidate.request.sources,
      };
      const trial: OpenWeightLlmTopicLabelBatchRequest = {
        schemaVersion: 2,
        taskType: 'topic_label',
        locale,
        clusters: [...items, nextItem],
      };
      if (requestByteLength(trial) <= OPEN_WEIGHT_LLM_MAX_REQUEST_BYTES) {
        items.push(nextItem);
        byClusterId.set(clusterId, candidate);
        index += 1;
        continue;
      }
      // Falls selbst der erste Kandidat mit 6 Quellen > 2.500 Bytes wäre, Quellen schrittweise kürzen.
      if (items.length === 0) {
        let kept = candidate.request.sources.slice(0, -1);
        let fitted = false;
        while (kept.length >= 2) {
          const shrunkItem: OpenWeightLlmTopicLabelBatchItem = { clusterId, sources: kept };
          const shrunkTrial: OpenWeightLlmTopicLabelBatchRequest = {
            schemaVersion: 2,
            taskType: 'topic_label',
            locale,
            clusters: [shrunkItem],
          };
          if (requestByteLength(shrunkTrial) <= OPEN_WEIGHT_LLM_MAX_REQUEST_BYTES) {
            items.push(shrunkItem);
            byClusterId.set(clusterId, candidate);
            index += 1;
            fitted = true;
            break;
          }
          kept = kept.slice(0, -1);
        }
        if (!fitted) {
          index += 1;
        }
      }
      break;
    }

    if (items.length > 0) {
      batches.push({
        batchRequest: {
          schemaVersion: 2,
          taskType: 'topic_label',
          locale,
          clusters: items,
        },
        byClusterId,
      });
    }
  }

  return batches;
}

export async function applyWordCloudTopicLabels(
  input: AnalyzeWordCloudInput,
  output: AnalyzeWordCloudOutput,
  options: LabelOptions = {},
): Promise<AnalyzeWordCloudOutput> {
  if (
    output.mode !== 'SEMANTIC' ||
    output.fallbackUsed ||
    (output.status !== 'ready' && output.status !== 'uncertain') ||
    (input.channel !== 'QA' && input.channel !== 'FREETEXT') ||
    !TOPIC_LABEL_LOCALES.has(output.locale)
  ) {
    return output;
  }

  const env = options.env ?? process.env;
  if (!runtimeEnabled(env)) {
    return {
      ...output,
      labelSettlement: 'disabled',
      labelModelId: null,
      labelModelVersion: null,
      entries: output.entries.map((entry) => withOrigin(entry, 'extractive')),
    };
  }

  const now = options.now ?? Date.now;
  const label = options.label ?? runOpenWeightLlmTopicLabel;
  const labelBatch =
    options.labelBatch ?? (options.label ? undefined : runOpenWeightLlmTopicLabelBatch);
  const startedAt = now();
  const perCallCap = labelTimeoutMs(env);
  const candidateCount = output.entries.filter((entry) => entry.members.length >= 2).length;
  const phaseBudgetMs = resolveTopicLabelPhaseBudgetMs(env, candidateCount);
  const sessionSignal = getOrCreateSessionLabelSignal(options.sessionId);
  const externalSignals = [options.signal, sessionSignal].filter(
    (sig): sig is AbortSignal => sig !== undefined,
  );
  const callerSignal =
    externalSignals.length === 0
      ? undefined
      : externalSignals.length === 1
        ? externalSignals[0]
        : AbortSignal.any(externalSignals);
  const useProcessLabelCache =
    (!options.label && !options.labelBatch) || options.useProcessLabelCache === true;
  const scopePrefix = sessionLabelCachePrefix(options.sessionId, input.sessionCode);
  let transient = false;
  let acceptedModelLabel = false;

  // Schneller Batch-Pfad (Standard, sobald ≥ 2 unbenannte Cluster vorliegen und kein Einzel-Mock übergeben wurde):
  // fasst bis zu 12 Cluster in einem einzigen LLM-Call (<= 2.500 UTF-8-Bytes) zusammen.
  if (labelBatch && (output.locale === 'de' || output.locale === 'en')) {
    const resolvedEntries: Array<WordCloudAnalysisEntryDTO | null> = output.entries.map(() => null);
    const pendingCandidates: PendingBatchClusterCandidate[] = [];

    for (let i = 0; i < output.entries.length; i += 1) {
      const entry = output.entries[i]!;
      if (entry.members.length < 2) {
        resolvedEntries[i] = withOrigin(entry, 'extractive');
        continue;
      }
      const request = packRequest(entry, output.locale, output.snapshotHash);
      if (!request) {
        resolvedEntries[i] = withOrigin(entry, 'extractive');
        continue;
      }
      const labelCacheKey = useProcessLabelCache
        ? buildClusterTopicLabelCacheKey(scopePrefix, output.locale, request.sources)
        : '';
      if (useProcessLabelCache) {
        const cachedLabel = readCachedClusterTopicLabel(labelCacheKey, now());
        if (cachedLabel !== null && acceptLabel(cachedLabel, request.sources)) {
          acceptedModelLabel = true;
          resolvedEntries[i] = withOrigin(entry, 'model', cachedLabel);
          continue;
        }
      }
      pendingCandidates.push({ entryIndex: i, entry, request, labelCacheKey });
    }

    if (pendingCandidates.length === 0) {
      return {
        ...output,
        labelSettlement: 'complete',
        labelModelId: acceptedModelLabel ? OPEN_WEIGHT_LLM_MODEL_ID : null,
        labelModelVersion: acceptedModelLabel ? OPEN_WEIGHT_LLM_MODEL_VERSION : null,
        entries: resolvedEntries.map(
          (entry, idx) => entry ?? withOrigin(output.entries[idx]!, 'extractive'),
        ),
      };
    }

    if (pendingCandidates.length >= 2) {
      const batches = packBatchRequests(output.locale, pendingCandidates);
      let previousBatchAbortedOrTimedOut = false;

      for (const batch of batches) {
        if (callerSignal?.aborted) {
          transient = true;
          break;
        }
        if (previousBatchAbortedOrTimedOut) {
          await new Promise((resolve) => setTimeout(resolve, 1_500));
          previousBatchAbortedOrTimedOut = false;
          if (callerSignal?.aborted) {
            transient = true;
            break;
          }
        }
        const remaining = phaseBudgetMs - (now() - startedAt);
        if (remaining < 50) {
          transient = true;
          break;
        }
        const batchCapMs = Math.min(
          remaining,
          Math.max(
            perCallCap,
            Math.min(phaseBudgetMs, perCallCap * batch.batchRequest.clusters.length),
          ),
        );
        const timeoutSignal = AbortSignal.timeout(batchCapMs);
        const callSignal = callerSignal
          ? AbortSignal.any([timeoutSignal, callerSignal])
          : timeoutSignal;
        const batchResult = await labelBatch(batch.batchRequest, { signal: callSignal });
        if (batchResult.status === 'completed' && !sessionSignal?.aborted) {
          for (const item of batchResult.output.labels) {
            const candidate = batch.byClusterId.get(item.clusterId);
            if (!candidate || resolvedEntries[candidate.entryIndex] !== null) {
              continue;
            }
            if (acceptLabel(item.label, candidate.request.sources)) {
              const cleanLabel = item.label.trim();
              if (useProcessLabelCache) {
                writeCachedClusterTopicLabel(candidate.labelCacheKey, cleanLabel, now());
              }
              acceptedModelLabel = true;
              resolvedEntries[candidate.entryIndex] = withOrigin(
                candidate.entry,
                'model',
                cleanLabel,
              );
            }
          }
          continue;
        }
        if (batchResult.status !== 'completed') {
          previousBatchAbortedOrTimedOut =
            batchResult.status === 'aborted' || batchResult.status === 'timeout';
          if (TRANSIENT_REASONS.has(batchResult.status)) {
            transient = true;
          }
        }
      }

      const finalEntries = output.entries.map(
        (entry, idx) => resolvedEntries[idx] ?? withOrigin(entry, 'extractive'),
      );
      return {
        ...output,
        labelSettlement: transient ? 'transient' : 'complete',
        labelModelId: acceptedModelLabel ? OPEN_WEIGHT_LLM_MODEL_ID : null,
        labelModelVersion: acceptedModelLabel ? OPEN_WEIGHT_LLM_MODEL_VERSION : null,
        entries: finalEntries,
      };
    }
  }

  const entries: WordCloudAnalysisEntryDTO[] = [];

  let previousAbortedOrTimedOut = false;
  for (const entry of output.entries) {
    if (entry.members.length < 2) {
      entries.push(withOrigin(entry, 'extractive'));
      continue;
    }
    if (callerSignal?.aborted) {
      transient = true;
      entries.push(withOrigin(entry, 'extractive'));
      continue;
    }
    if (previousAbortedOrTimedOut) {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      previousAbortedOrTimedOut = false;
      if (callerSignal?.aborted) {
        transient = true;
        entries.push(withOrigin(entry, 'extractive'));
        continue;
      }
    }
    const request = packRequest(entry, output.locale, output.snapshotHash);
    if (!request) {
      entries.push(withOrigin(entry, 'extractive'));
      continue;
    }
    const useProcessLabelCache = !options.label || options.useProcessLabelCache === true;
    const scopePrefix = sessionLabelCachePrefix(options.sessionId, input.sessionCode);
    const labelCacheKey = useProcessLabelCache
      ? buildClusterTopicLabelCacheKey(scopePrefix, output.locale, request.sources)
      : '';
    if (useProcessLabelCache) {
      const cachedLabel = readCachedClusterTopicLabel(labelCacheKey, now());
      if (cachedLabel !== null && acceptLabel(cachedLabel, request.sources)) {
        acceptedModelLabel = true;
        entries.push(withOrigin(entry, 'model', cachedLabel));
        continue;
      }
    }
    const remaining = phaseBudgetMs - (now() - startedAt);
    if (remaining < 50) {
      transient = true;
      entries.push(withOrigin(entry, 'extractive'));
      continue;
    }
    const fallback: OpenWeightLlmTopicLabelOutput = {
      schemaVersion: 1,
      taskType: 'topic_label',
      label: entry.label.slice(0, 120),
      sourceIds: request.sources.slice(0, 8).map((source) => source.id),
    };
    const timeoutSignal = AbortSignal.timeout(Math.min(perCallCap, remaining));
    const callSignal = callerSignal
      ? AbortSignal.any([timeoutSignal, callerSignal])
      : timeoutSignal;
    const result = await label(request, fallback, {
      signal: callSignal,
    });
    if (result.status === 'fallback') {
      previousAbortedOrTimedOut = result.reason === 'aborted' || result.reason === 'timeout';
    }
    if (
      !sessionSignal?.aborted &&
      result.status === 'completed' &&
      acceptLabel(result.output.label, request.sources)
    ) {
      const cleanLabel = result.output.label.trim();
      if (useProcessLabelCache) {
        writeCachedClusterTopicLabel(labelCacheKey, cleanLabel, now());
      }
      acceptedModelLabel = true;
      entries.push(withOrigin(entry, 'model', cleanLabel));
      continue;
    }
    if (result.status === 'fallback' && TRANSIENT_REASONS.has(result.reason)) {
      transient = true;
    }
    entries.push(withOrigin(entry, 'extractive'));
  }

  const labelSettlement: WordCloudLabelSettlement = transient ? 'transient' : 'complete';
  return {
    ...output,
    labelSettlement,
    labelModelId: acceptedModelLabel ? OPEN_WEIGHT_LLM_MODEL_ID : null,
    labelModelVersion: acceptedModelLabel ? OPEN_WEIGHT_LLM_MODEL_VERSION : null,
    entries,
  };
}

export async function labelSemanticWordCloudSnapshot(
  input: AnalyzeWordCloudInput,
  meta: WordCloudNormalizationMeta,
  options: LabelOptions & {
    readonly sessionId?: string;
    readonly tokensByItemId?: ReadonlyMap<
      string,
      readonly import('./wordCloudAnalysis').WordCloudRawToken[]
    >;
  } = {},
): Promise<AnalyzeWordCloudOutput> {
  const encoded: AnalyzeWordCloudOutput & { readonly encoderCalled?: boolean } =
    await analyzeSemanticWordCloudSnapshot(input, meta, options);
  const labeled = await applyWordCloudTopicLabels(input, encoded, options);
  return Object.assign(labeled, {
    encoderCalled: encoded.encoderCalled ?? Boolean(encoded.modelVersion),
  });
}
