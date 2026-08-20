/**
 * Host-Q&A-Themenpfad Stufe 1: Snapshot → Hash → Encoder → Cluster → Zod.
 * Höchstens ein Inflight-Job pro Session; Circuit Breaker bei Encoder-Fehlern.
 */
import {
  AnalyzeWordCloudOutputSchema,
  fromWordCloudSemanticSourceId,
  isWordCloudPhraseAnalysisVariant,
  isWordCloudSemanticLocale,
  toWordCloudSemanticSourceId,
  WORD_CLOUD_SEMANTIC_ANALYSIS_VERSION,
  WORD_CLOUD_SEMANTIC_MODEL_ID,
  type AnalyzeWordCloudInput,
  type AnalyzeWordCloudOutput,
  type WordCloudClusterStatus,
} from '@arsnova/shared-types';
import { buildLexicalWordCloudEntries, buildThemeWordCloudAnalysis } from './wordCloudAnalysis';
import type { WordCloudNormalizationMeta } from './wordCloudNormalization';
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

type SessionJob = {
  snapshotHash: string;
  promise: Promise<AnalyzeWordCloudOutput>;
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
const jobs = new Map<string, SessionJob>();

export function resetWordCloudSemanticAnalyzeForTests(overrides?: Partial<SemanticHooks>): void {
  hooks = {
    ...createDefaultHooks(),
    ...overrides,
  };
  circuit.failures = 0;
  circuit.openedAt = null;
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
      items: input.items.map((item) => ({
        id: toWordCloudSemanticSourceId(item.id),
        text: item.text,
      })),
    },
    config,
  );
}

function isFreetextChannel(input: AnalyzeWordCloudInput): boolean {
  if (input.channel === 'FREETEXT') {
    return true;
  }
  if (input.channel === 'QA') {
    return false;
  }
  return input.items.some((item) => /^response-\d+$/u.test(item.id));
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
  if (isFreetextChannel(input) || !isWordCloudSemanticLocale(input.locale)) {
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
        status: 'uncertain',
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

export async function analyzeSemanticWordCloudSnapshot(
  input: AnalyzeWordCloudInput,
  meta: WordCloudNormalizationMeta,
  options: {
    readonly env?: NodeJS.ProcessEnv;
    readonly tokensByItemId?: ReadonlyMap<
      string,
      readonly import('./wordCloudAnalysis').WordCloudRawToken[]
    >;
  } = {},
): Promise<AnalyzeWordCloudOutput> {
  const sessionKey = input.sessionCode.toUpperCase();
  const existing = jobs.get(sessionKey);
  if (existing) {
    if (existing.snapshotHash === meta.snapshotHash) {
      return existing.promise;
    }
    return buildSemanticAnalysisOutput({
      request: input,
      entries: buildLexicalSemanticFallbackEntries(input, options.tokensByItemId),
      meta,
      status: 'pending',
      fallbackUsed: true,
      modelVersion: null,
      modelId: null,
    });
  }

  const promise = runSemanticEncoderJob(
    input,
    meta,
    options.tokensByItemId,
    options.env ?? process.env,
  ).finally(() => {
    const active = jobs.get(sessionKey);
    if (active?.promise === promise) {
      jobs.delete(sessionKey);
    }
  });
  jobs.set(sessionKey, { snapshotHash: meta.snapshotHash, promise });
  return promise;
}
