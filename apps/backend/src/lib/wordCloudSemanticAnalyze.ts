/**
 * Host-Themenpfad fuer Q&A und Freitext: Snapshot → Hash → Encoder → Cluster → Zod.
 * Höchstens ein Inflight-Job pro Session; Circuit Breaker bei Encoder-Fehlern.
 */
import { createHash } from 'node:crypto';
import {
  AnalyzeWordCloudOutputSchema,
  fromWordCloudSemanticSourceId,
  isWordCloudPhraseAnalysisVariant,
  isWordCloudSemanticLocale,
  toWordCloudSemanticSourceId,
  WORD_CLOUD_SEMANTIC_ANALYSIS_VERSION,
  WORD_CLOUD_SEMANTIC_MIN_CLUSTER_SIZE,
  WORD_CLOUD_SEMANTIC_MODEL_ID,
  type AnalyzeWordCloudInput,
  type AnalyzeWordCloudOutput,
  type WordCloudClusterStatus,
} from '@arsnova/shared-types';
import {
  buildLexicalWordCloudEntries,
  buildThemeWordCloudAnalysis,
  toWordCloudAnalysisSourceText,
} from './wordCloudAnalysis';
import type { WordCloudNormalizationMeta } from './wordCloudNormalization';
import { registerSessionPurgeInvalidator } from './sessionPurgeInvalidation';
import {
  embedWithWordCloudEncoder,
  WordCloudEncoderError,
  type WordCloudEncoderResponse,
} from './wordCloudEncoderClient';
import {
  WORD_CLOUD_ENCODER_CIRCUIT_FAILURE_THRESHOLD,
  WORD_CLOUD_ENCODER_CIRCUIT_OPEN_MS,
  resolveWordCloudSemanticConfig,
  type WordCloudSemanticConfig,
} from './wordCloudSemanticConfig';
import {
  clusterWordCloudEmbeddings,
  hasReliableSemanticCluster,
  rankSemanticClusters,
  semanticClustersToEntries,
  type WordCloudEmbedding,
  type WordCloudSemanticCluster,
} from './wordCloudSemanticCluster';
import {
  invalidateWordCloudTopicLabelSession,
  resetWordCloudTopicLabelCacheForTests,
} from './wordCloudTopicLabels';

export type WordCloudSemanticEmbedder = (
  input: AnalyzeWordCloudInput,
  snapshotHash: string,
  config: WordCloudSemanticConfig,
) => Promise<WordCloudEncoderResponse>;

type SemanticHooks = {
  embed: WordCloudSemanticEmbedder;
  config: (env?: NodeJS.ProcessEnv) => WordCloudSemanticConfig;
  now: () => number;
};

type CircuitState = {
  failures: number;
  openedAt: number | null;
};

type SemanticAnalyzeOptions = {
  /** Serverseitig aufgelöste, unveränderliche Session-ID; niemals aus dem Client ableiten. */
  readonly sessionId?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly tokensByItemId?: ReadonlyMap<
    string,
    readonly import('./wordCloudAnalysis').WordCloudRawToken[]
  >;
};

type SessionJob = {
  readonly snapshotHash: string;
  readonly epoch: number;
  readonly input: AnalyzeWordCloudInput;
  readonly meta: WordCloudNormalizationMeta;
  readonly options: SemanticAnalyzeOptions;
  readonly promise: Promise<AnalyzeWordCloudOutput>;
  readonly resolve: (output: AnalyzeWordCloudOutput) => void;
  readonly reject: (reason?: unknown) => void;
};

type SessionJobQueue = {
  // A session owns at most one active and one latest queued snapshot. Newer distinct
  // snapshots coalesce the queued slot instead of building an unbounded encoder queue.
  epoch: number;
  active: SessionJob | null;
  latest: SessionJob | null;
};

function createDefaultHooks(): SemanticHooks {
  return {
    embed: defaultEmbedder,
    config: (env) => resolveWordCloudSemanticConfig(env),
    now: () => Date.now(),
  };
}

type CachedSessionClusters = {
  readonly expiresAt: number;
  readonly modelId: string;
  readonly modelVersion: string;
  readonly rawClusters: readonly WordCloudSemanticCluster[];
};

type CachedItemEmbedding = {
  readonly expiresAt: number;
  readonly modelId: string;
  readonly modelVersion: string;
  readonly vector: readonly number[];
};

const MAX_CACHED_CLUSTER_ENTRIES = 64;
const MAX_CACHED_ITEM_EMBEDDINGS = 4_096;
let hooks: SemanticHooks = createDefaultHooks();
const circuit: CircuitState = { failures: 0, openedAt: null };
const jobs = new Map<string, SessionJobQueue>();
const sessionClustersCache = new Map<string, CachedSessionClusters>();
const sessionItemEmbeddingsCache = new Map<string, CachedItemEmbedding>();

function purgeExpiredSessionClusters(nowMs: number): void {
  for (const [key, entry] of sessionClustersCache.entries()) {
    if (entry.expiresAt <= nowMs) {
      sessionClustersCache.delete(key);
    }
  }
  for (const [key, entry] of sessionItemEmbeddingsCache.entries()) {
    if (entry.expiresAt <= nowMs) {
      sessionItemEmbeddingsCache.delete(key);
    }
  }
}

function sessionJobKey(sessionId: string): string {
  return `session:${sessionId.trim()}`;
}

function unscopedJobKey(sessionCode: string): string {
  // Reine Library-/Testaufrufe ohne serverseitigen Cache-Scope bleiben getrennt
  // von produktiven, unveränderlich per sessionId gebundenen Queues.
  return `unscoped:${sessionCode.trim().toUpperCase()}`;
}

function buildWeightAgnosticCorpusKey(sessionKey: string, input: AnalyzeWordCloudInput): string {
  const hash = createHash('sha256')
    .update(
      JSON.stringify({
        locale: input.locale,
        channel: input.channel ?? null,
        items: [...input.items]
          .map((item) => ({ id: item.id, text: item.text }))
          .sort((left, right) => left.id.localeCompare(right.id)),
      }),
      'utf8',
    )
    .digest('hex');
  return `${sessionKey}:${hash}`;
}

function buildSessionItemEmbeddingKey(
  sessionKey: string,
  locale: string,
  sourceText: string,
): string {
  const hash = createHash('sha256')
    .update(JSON.stringify({ locale, text: sourceText }), 'utf8')
    .digest('hex');
  return `${sessionKey}:${hash}`;
}

export function invalidateWordCloudSemanticSession(sessionId: string): void {
  const now = hooks.now();
  purgeExpiredSessionClusters(now);
  invalidateWordCloudTopicLabelSession(sessionId, now);
  const sessionKey = sessionJobKey(sessionId);
  for (const key of sessionClustersCache.keys()) {
    if (key.startsWith(`${sessionKey}:`)) {
      sessionClustersCache.delete(key);
    }
  }
  for (const key of sessionItemEmbeddingsCache.keys()) {
    if (key.startsWith(`${sessionKey}:`)) {
      sessionItemEmbeddingsCache.delete(key);
    }
  }
  const queue = jobs.get(sessionKey);
  if (!queue) {
    return;
  }
  queue.epoch += 1;
  if (queue.latest) {
    queue.latest.resolve(buildQueueFallback(queue.latest));
    queue.latest = null;
  }
  if (!queue.active && jobs.get(sessionKey) === queue) {
    jobs.delete(sessionKey);
  }
}

registerSessionPurgeInvalidator((event) => invalidateWordCloudSemanticSession(event.sessionId));

export function resetWordCloudSemanticAnalyzeForTests(overrides?: Partial<SemanticHooks>): void {
  hooks = {
    ...createDefaultHooks(),
    ...overrides,
  };
  circuit.failures = 0;
  circuit.openedAt = null;
  sessionClustersCache.clear();
  sessionItemEmbeddingsCache.clear();
  resetWordCloudTopicLabelCacheForTests();
  for (const queue of jobs.values()) {
    queue.epoch += 1;
    if (queue.latest) {
      queue.latest.resolve(buildQueueFallback(queue.latest));
      queue.latest = null;
    }
  }
  jobs.clear();
}

function defaultEmbedder(
  input: AnalyzeWordCloudInput,
  snapshotHash: string,
  config: WordCloudSemanticConfig,
): Promise<WordCloudEncoderResponse> {
  return embedWithWordCloudEncoder(
    {
      locale: isWordCloudSemanticLocale(input.locale) ? input.locale : 'de',
      snapshotHash,
      items: input.items
        .map((item) => {
          const text = toWordCloudAnalysisSourceText(item.text);
          if (!text) {
            return null;
          }
          return {
            id: toWordCloudSemanticSourceId(item.id),
            text,
          };
        })
        .filter((item): item is { id: string; text: string } => item !== null),
    },
    config,
  );
}

function isCircuitOpen(now: number): boolean {
  if (circuit.openedAt === null) {
    return false;
  }
  if (now - circuit.openedAt >= WORD_CLOUD_ENCODER_CIRCUIT_OPEN_MS) {
    return false;
  }
  return true;
}

function recordCircuitSuccess(): void {
  circuit.failures = 0;
  circuit.openedAt = null;
}

function recordCircuitFailure(now: number): void {
  circuit.failures += 1;
  if (circuit.failures >= WORD_CLOUD_ENCODER_CIRCUIT_FAILURE_THRESHOLD) {
    circuit.openedAt = now;
  }
}

export function buildLexicalSemanticFallbackEntries(
  input: AnalyzeWordCloudInput,
  tokensByItemId?: ReadonlyMap<string, readonly import('./wordCloudAnalysis').WordCloudRawToken[]>,
): AnalyzeWordCloudOutput['entries'] {
  if (isWordCloudPhraseAnalysisVariant(input.mode)) {
    const analysis = buildThemeWordCloudAnalysis(input);
    if (analysis.usedThemeAnchors && analysis.entries.length > 0) {
      return analysis.entries;
    }
  }
  return buildLexicalWordCloudEntries(
    input.items,
    input.locale,
    input.maxEntries,
    tokensByItemId,
    1,
  );
}

export function buildSemanticAnalysisOutput(input: {
  readonly request: AnalyzeWordCloudInput;
  readonly entries: AnalyzeWordCloudOutput['entries'];
  readonly meta: WordCloudNormalizationMeta;
  readonly status: WordCloudClusterStatus;
  readonly fallbackUsed: boolean;
  readonly modelVersion: string | null;
  readonly modelId?: string | null;
  readonly encoderCalled?: boolean;
}): AnalyzeWordCloudOutput {
  const output = AnalyzeWordCloudOutputSchema.parse({
    mode: input.request.mode,
    locale: input.request.locale,
    metric: input.request.metric,
    generatedAt: new Date(hooks.now()).toISOString(),
    fallbackUsed: input.fallbackUsed,
    status: input.status,
    modelVersion: input.modelVersion,
    entries: input.entries,
    ...input.meta,
    analysisVersion: WORD_CLOUD_SEMANTIC_ANALYSIS_VERSION,
    modelId: input.modelId ?? (input.modelVersion ? WORD_CLOUD_SEMANTIC_MODEL_ID : null),
  });
  return Object.assign(output, {
    encoderCalled: input.encoderCalled ?? Boolean(input.modelVersion),
  });
}

function embeddingsFromEncoder(
  input: AnalyzeWordCloudInput,
  response: WordCloudEncoderResponse,
): WordCloudEmbedding[] {
  const textById = new Map(input.items.map((item) => [item.id, item.text]));
  return response.items.map((item) => {
    const originalId = fromWordCloudSemanticSourceId(item.id);
    return {
      id: originalId,
      text: textById.get(originalId) ?? '',
      vector: item.embedding,
    };
  });
}

function writeSessionItemEmbedding(key: string, entry: CachedItemEmbedding): void {
  if (
    !sessionItemEmbeddingsCache.has(key) &&
    sessionItemEmbeddingsCache.size >= MAX_CACHED_ITEM_EMBEDDINGS
  ) {
    const oldestKey = sessionItemEmbeddingsCache.keys().next().value;
    if (oldestKey !== undefined) {
      sessionItemEmbeddingsCache.delete(oldestKey);
    }
  }
  sessionItemEmbeddingsCache.set(key, entry);
}

async function resolveIncrementalEmbeddings(
  sessionKey: string,
  input: AnalyzeWordCloudInput,
  snapshotHash: string,
  config: WordCloudSemanticConfig,
  nowMs: number,
  canCache: () => boolean,
): Promise<{
  readonly embeddings: WordCloudEmbedding[];
  readonly modelId: string;
  readonly modelVersion: string;
  readonly encoderCalled: boolean;
}> {
  const useItemCache = true;
  const cachedVectorsById = new Map<string, CachedItemEmbedding>();
  const missingItems: AnalyzeWordCloudInput['items'][number][] = [];
  const seenMissingTexts = new Set<string>();
  const sourceTextById = new Map<string, string>();

  for (const item of input.items) {
    const sourceText = toWordCloudAnalysisSourceText(item.text);
    if (!sourceText) {
      continue;
    }
    sourceTextById.set(item.id, sourceText);
    if (useItemCache) {
      const itemKey = buildSessionItemEmbeddingKey(sessionKey, input.locale, sourceText);
      const cachedItem = sessionItemEmbeddingsCache.get(itemKey);
      if (cachedItem && cachedItem.expiresAt > nowMs) {
        cachedVectorsById.set(item.id, cachedItem);
        continue;
      }
      if (cachedItem) {
        sessionItemEmbeddingsCache.delete(itemKey);
      }
    }
    if (!seenMissingTexts.has(sourceText)) {
      seenMissingTexts.add(sourceText);
      missingItems.push(item);
    }
  }

  const freshByText = new Map<string, readonly number[]>();
  let modelId: string | null = null;
  let modelVersion: string | null = null;
  let encoderCalled = false;

  if (missingItems.length > 0) {
    encoderCalled = true;
    const partialInput: AnalyzeWordCloudInput =
      missingItems.length === input.items.length ? input : { ...input, items: missingItems };
    const response = await hooks.embed(partialInput, snapshotHash, config);
    recordCircuitSuccess();
    modelId = response.modelId;
    modelVersion = response.modelVersion;
    const freshById = new Map(
      response.items.map((entry) => [fromWordCloudSemanticSourceId(entry.id), entry.embedding]),
    );

    const expiresAt = hooks.now() + config.cacheTtlSeconds * 1_000;
    for (const item of missingItems) {
      const vector = freshById.get(item.id);
      const sourceText = sourceTextById.get(item.id);
      if (!vector || !sourceText) {
        continue;
      }
      freshByText.set(sourceText, vector);
      if (canCache()) {
        const itemKey = buildSessionItemEmbeddingKey(sessionKey, input.locale, sourceText);
        writeSessionItemEmbedding(itemKey, {
          expiresAt,
          modelId: response.modelId,
          modelVersion: response.modelVersion,
          vector,
        });
      }
    }
  }

  // Falls sich die Modell-Version gegenüber gecachten Einzel-Embeddings geändert hat,
  // einmalig den vollen Batch anfordern, damit keine gemischten Vektorräume geclustert werden.
  if (
    modelVersion !== null &&
    cachedVectorsById.size > 0 &&
    Array.from(cachedVectorsById.values()).some((entry) => entry.modelVersion !== modelVersion)
  ) {
    const fullResponse = await hooks.embed(input, snapshotHash, config);
    recordCircuitSuccess();
    if (canCache()) {
      const expiresAt = hooks.now() + config.cacheTtlSeconds * 1_000;
      for (const entry of fullResponse.items) {
        const originalId = fromWordCloudSemanticSourceId(entry.id);
        const sourceText = sourceTextById.get(originalId);
        if (!sourceText) continue;
        const itemKey = buildSessionItemEmbeddingKey(sessionKey, input.locale, sourceText);
        writeSessionItemEmbedding(itemKey, {
          expiresAt,
          modelId: fullResponse.modelId,
          modelVersion: fullResponse.modelVersion,
          vector: entry.embedding,
        });
      }
    }
    return {
      embeddings: embeddingsFromEncoder(input, fullResponse),
      modelId: fullResponse.modelId,
      modelVersion: fullResponse.modelVersion,
      encoderCalled: true,
    };
  }

  const firstCached = cachedVectorsById.values().next().value;
  const resolvedModelId = modelId ?? firstCached?.modelId ?? WORD_CLOUD_SEMANTIC_MODEL_ID;
  const resolvedModelVersion = modelVersion ?? firstCached?.modelVersion ?? '';

  const embeddings: WordCloudEmbedding[] = [];
  for (const item of input.items) {
    const sourceText = sourceTextById.get(item.id);
    const vector =
      (sourceText ? freshByText.get(sourceText) : undefined) ??
      cachedVectorsById.get(item.id)?.vector;
    if (!vector) {
      continue;
    }
    embeddings.push({
      id: item.id,
      text: item.text,
      vector,
    });
  }

  return {
    embeddings,
    modelId: resolvedModelId,
    modelVersion: resolvedModelVersion,
    encoderCalled,
  };
}

async function runSemanticEncoderJob(
  sessionKey: string,
  input: AnalyzeWordCloudInput,
  meta: WordCloudNormalizationMeta,
  tokensByItemId:
    ReadonlyMap<string, readonly import('./wordCloudAnalysis').WordCloudRawToken[]> | undefined,
  env: NodeJS.ProcessEnv,
  canCacheClusters: () => boolean,
): Promise<AnalyzeWordCloudOutput> {
  const fallbackEntries = buildLexicalSemanticFallbackEntries(input, tokensByItemId);
  const config = hooks.config(env);
  const now = hooks.now();

  if (!config.enabled) {
    return buildSemanticAnalysisOutput({
      request: input,
      entries: fallbackEntries,
      meta,
      status: 'disabled',
      fallbackUsed: true,
      modelVersion: null,
      modelId: null,
    });
  }
  if (!isWordCloudSemanticLocale(input.locale)) {
    return buildSemanticAnalysisOutput({
      request: input,
      entries: fallbackEntries,
      meta,
      status: 'fallback',
      fallbackUsed: true,
      modelVersion: null,
      modelId: null,
    });
  }
  if (input.items.length === 0) {
    return buildSemanticAnalysisOutput({
      request: input,
      entries: [],
      meta,
      status: 'ready',
      fallbackUsed: false,
      modelVersion: null,
      modelId: null,
    });
  }
  if (input.items.length < WORD_CLOUD_SEMANTIC_MIN_CLUSTER_SIZE) {
    return buildSemanticAnalysisOutput({
      request: input,
      entries: fallbackEntries,
      meta,
      status: 'fallback',
      fallbackUsed: true,
      modelVersion: null,
      modelId: null,
    });
  }

  purgeExpiredSessionClusters(now);
  const corpusKey = buildWeightAgnosticCorpusKey(sessionKey, input);
  const cachedClusters = input.refresh === true ? undefined : sessionClustersCache.get(corpusKey);
  if (cachedClusters && cachedClusters.expiresAt > now) {
    const clusters = rankSemanticClusters(cachedClusters.rawClusters, input.items);
    if (!hasReliableSemanticCluster(clusters)) {
      return buildSemanticAnalysisOutput({
        request: input,
        entries: fallbackEntries,
        meta,
        status: 'fallback',
        fallbackUsed: true,
        modelVersion: cachedClusters.modelVersion,
        modelId: cachedClusters.modelId,
        encoderCalled: false,
      });
    }
    const entries = semanticClustersToEntries(clusters, input.items);
    const uncertain = clusters.every((cluster) => cluster.confidence < 0.85);
    return buildSemanticAnalysisOutput({
      request: input,
      entries,
      meta,
      status: uncertain ? 'uncertain' : 'ready',
      fallbackUsed: false,
      modelVersion: cachedClusters.modelVersion,
      modelId: cachedClusters.modelId,
      encoderCalled: false,
    });
  }
  if (cachedClusters) {
    sessionClustersCache.delete(corpusKey);
  }

  if (isCircuitOpen(now)) {
    return buildSemanticAnalysisOutput({
      request: input,
      entries: fallbackEntries,
      meta,
      status: 'failed',
      fallbackUsed: true,
      modelVersion: null,
      modelId: null,
    });
  }

  try {
    const resolved = await resolveIncrementalEmbeddings(
      sessionKey,
      input,
      meta.snapshotHash,
      config,
      now,
      canCacheClusters,
    );
    const rawClusters = clusterWordCloudEmbeddings(resolved.embeddings);
    if (canCacheClusters()) {
      purgeExpiredSessionClusters(hooks.now());
      if (
        !sessionClustersCache.has(corpusKey) &&
        sessionClustersCache.size >= MAX_CACHED_CLUSTER_ENTRIES
      ) {
        const oldestKey = sessionClustersCache.keys().next().value;
        if (oldestKey !== undefined) {
          sessionClustersCache.delete(oldestKey);
        }
      }
      sessionClustersCache.set(corpusKey, {
        expiresAt: hooks.now() + config.cacheTtlSeconds * 1_000,
        modelId: resolved.modelId,
        modelVersion: resolved.modelVersion,
        rawClusters,
      });
    }
    const clusters = rankSemanticClusters(rawClusters, input.items);
    if (!hasReliableSemanticCluster(clusters)) {
      return buildSemanticAnalysisOutput({
        request: input,
        entries: fallbackEntries,
        meta,
        status: 'fallback',
        fallbackUsed: true,
        modelVersion: resolved.modelVersion,
        modelId: resolved.modelId,
        encoderCalled: resolved.encoderCalled,
      });
    }
    const entries = semanticClustersToEntries(clusters, input.items);
    const uncertain = clusters.every((cluster) => cluster.confidence < 0.85);
    return buildSemanticAnalysisOutput({
      request: input,
      entries,
      meta,
      status: uncertain ? 'uncertain' : 'ready',
      fallbackUsed: false,
      modelVersion: resolved.modelVersion,
      modelId: resolved.modelId,
      encoderCalled: resolved.encoderCalled,
    });
  } catch (error) {
    recordCircuitFailure(now);
    const status: WordCloudClusterStatus =
      error instanceof WordCloudEncoderError && error.code === 'TIMEOUT' ? 'failed' : 'failed';
    return buildSemanticAnalysisOutput({
      request: input,
      entries: fallbackEntries,
      meta,
      status,
      fallbackUsed: true,
      modelVersion: null,
      modelId: null,
    });
  }
}

function createSessionJob(
  input: AnalyzeWordCloudInput,
  meta: WordCloudNormalizationMeta,
  options: SemanticAnalyzeOptions,
  epoch: number,
): SessionJob {
  let resolve!: (output: AnalyzeWordCloudOutput) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<AnalyzeWordCloudOutput>((next, fail) => {
    resolve = next;
    reject = fail;
  });
  return {
    snapshotHash: meta.snapshotHash,
    epoch,
    input,
    meta,
    options,
    promise,
    resolve,
    reject,
  };
}

function buildQueueFallback(job: SessionJob): AnalyzeWordCloudOutput {
  return buildSemanticAnalysisOutput({
    request: job.input,
    entries: buildLexicalSemanticFallbackEntries(job.input, job.options.tokensByItemId),
    meta: job.meta,
    status: 'fallback',
    fallbackUsed: true,
    modelVersion: null,
    modelId: null,
  });
}

function finishSessionJob(sessionKey: string, queue: SessionJobQueue, job: SessionJob): void {
  if (queue.active !== job) {
    return;
  }
  queue.active = null;

  const latest = queue.latest;
  queue.latest = null;
  if (latest) {
    if (latest.epoch === queue.epoch) {
      startSessionJob(sessionKey, queue, latest);
      return;
    }
    latest.resolve(buildQueueFallback(latest));
  }

  if (jobs.get(sessionKey) === queue) {
    jobs.delete(sessionKey);
  }
}

function startSessionJob(sessionKey: string, queue: SessionJobQueue, job: SessionJob): void {
  queue.active = job;
  const execution = (async () => {
    if (job.epoch !== queue.epoch) {
      return buildQueueFallback(job);
    }
    const output = await runSemanticEncoderJob(
      sessionKey,
      job.input,
      job.meta,
      job.options.tokensByItemId,
      job.options.env ?? process.env,
      () => job.epoch === queue.epoch,
    );
    return job.epoch === queue.epoch ? output : buildQueueFallback(job);
  })();

  void execution.then(job.resolve, job.reject).then(() => finishSessionJob(sessionKey, queue, job));
}

export async function analyzeSemanticWordCloudSnapshot(
  input: AnalyzeWordCloudInput,
  meta: WordCloudNormalizationMeta,
  options: SemanticAnalyzeOptions = {},
): Promise<AnalyzeWordCloudOutput> {
  const sessionKey = options.sessionId
    ? sessionJobKey(options.sessionId)
    : unscopedJobKey(input.sessionCode);
  let queue = jobs.get(sessionKey);
  if (!queue) {
    queue = {
      epoch: 0,
      active: null,
      latest: null,
    };
    jobs.set(sessionKey, queue);
  }

  if (queue.active?.epoch === queue.epoch && queue.active.snapshotHash === meta.snapshotHash) {
    return queue.active.promise;
  }
  if (queue.latest?.epoch === queue.epoch && queue.latest.snapshotHash === meta.snapshotHash) {
    return queue.latest.promise;
  }

  const job = createSessionJob(input, meta, options, queue.epoch);
  if (!queue.active) {
    startSessionJob(sessionKey, queue, job);
    return job.promise;
  }

  if (queue.latest) {
    queue.latest.resolve(buildQueueFallback(queue.latest));
  }
  queue.latest = job;
  return job.promise;
}
