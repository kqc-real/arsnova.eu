/**
 * Host-Themenpfad fuer Q&A und Freitext: Snapshot → Hash → Encoder → Cluster → Zod.
 * Höchstens ein Inflight-Job pro Session; Circuit Breaker bei Encoder-Fehlern.
 */
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
} from './wordCloudSemanticCluster';

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

let hooks: SemanticHooks = createDefaultHooks();
const circuit: CircuitState = { failures: 0, openedAt: null };
const jobs = new Map<string, SessionJobQueue>();

function sessionJobKey(sessionId: string): string {
  return `session:${sessionId.trim()}`;
}

function unscopedJobKey(sessionCode: string): string {
  // Reine Library-/Testaufrufe ohne serverseitigen Cache-Scope bleiben getrennt
  // von produktiven, unveränderlich per sessionId gebundenen Queues.
  return `unscoped:${sessionCode.trim().toUpperCase()}`;
}

export function invalidateWordCloudSemanticSession(sessionId: string): void {
  const sessionKey = sessionJobKey(sessionId);
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
}): AnalyzeWordCloudOutput {
  return AnalyzeWordCloudOutputSchema.parse({
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

async function runSemanticEncoderJob(
  input: AnalyzeWordCloudInput,
  meta: WordCloudNormalizationMeta,
  tokensByItemId:
    ReadonlyMap<string, readonly import('./wordCloudAnalysis').WordCloudRawToken[]> | undefined,
  env: NodeJS.ProcessEnv,
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
    const response = await hooks.embed(input, meta.snapshotHash, config);
    recordCircuitSuccess();
    const clusters = rankSemanticClusters(
      clusterWordCloudEmbeddings(embeddingsFromEncoder(input, response)),
      input.items,
    );
    if (!hasReliableSemanticCluster(clusters)) {
      return buildSemanticAnalysisOutput({
        request: input,
        entries: fallbackEntries,
        meta,
        status: 'fallback',
        fallbackUsed: true,
        modelVersion: response.modelVersion,
        modelId: response.modelId,
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
      modelVersion: response.modelVersion,
      modelId: response.modelId,
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
      job.input,
      job.meta,
      job.options.tokensByItemId,
      job.options.env ?? process.env,
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
