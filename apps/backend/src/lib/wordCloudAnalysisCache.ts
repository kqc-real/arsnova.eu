/**
 * Zwei Cache-Ebenen für Host-Wortwolkenanalysen (Story 1.14b, Phase 6).
 *
 * Text-Cache: spaCy-Tokens nach locale + Text-Hash + Analyseversion.
 * Snapshot-Cache: komplette Analyse nach Session + Modus + Metrik + Normalization + Analyseversion + snapshotHash.
 *
 * Redis ist flüchtig mit TTL. Fehler sind fail-open: Analyse läuft ohne Cache weiter.
 * Rohtexte stehen nicht im Redis-Schlüssel.
 */
import {
  AnalyzeWordCloudOutputSchema,
  isTransientWordCloudNormalizationFallback,
  WORD_CLOUD_NORMALIZATION_ANALYSIS_VERSION,
  type AnalyzeWordCloudInput,
  type AnalyzeWordCloudOutput,
} from '@arsnova/shared-types';
import { getRedis } from '../redis';
import { logger } from './logger';
import { resolveNlpSidecarConfig } from './nlpSidecarConfig';
import type { WordCloudRawToken } from './wordCloudAnalysis';
import { buildWordCloudSnapshotHash } from './wordCloudNormalization';
import {
  isWordCloudSemanticEnabled,
  resolveWordCloudEncoderCacheTtlSeconds,
} from './wordCloudSemanticConfig';

const TEXT_KEY_PREFIX = 'nlp:wc:text';
const SNAPSHOT_KEY_PREFIX = 'nlp:wc:snap';

export interface WordCloudCachedTextTokens {
  readonly tokens: readonly WordCloudRawToken[];
}

export interface WordCloudAnalysisCache {
  getText(locale: string, textHash: string): Promise<readonly WordCloudRawToken[] | null>;
  setText(locale: string, textHash: string, tokens: readonly WordCloudRawToken[]): Promise<void>;
  getSnapshot(input: AnalyzeWordCloudInput): Promise<AnalyzeWordCloudOutput | null>;
  setSnapshot(input: AnalyzeWordCloudInput, output: AnalyzeWordCloudOutput): Promise<void>;
}

export function buildWordCloudTextCacheKey(locale: string, textHash: string): string {
  return `${TEXT_KEY_PREFIX}:${locale}:${WORD_CLOUD_NORMALIZATION_ANALYSIS_VERSION}:${textHash}`;
}

export function buildWordCloudSnapshotCacheKey(input: AnalyzeWordCloudInput): string {
  const snapshotHash = buildWordCloudSnapshotHash(input);
  return [
    SNAPSHOT_KEY_PREFIX,
    input.sessionCode.toUpperCase(),
    input.mode,
    input.metric,
    input.normalization,
    WORD_CLOUD_NORMALIZATION_ANALYSIS_VERSION,
    String(input.maxEntries ?? 'default'),
    String(input.maxNgramLength ?? 1),
    snapshotHash,
  ].join(':');
}

export function shouldCacheWordCloudSnapshot(output: AnalyzeWordCloudOutput): boolean {
  const reason = output.normalizationFallbackReason;
  if (isTransientWordCloudNormalizationFallback(reason)) {
    return false;
  }
  // Kill-Switch ist Prozesskonfiguration, kein Snapshot-Inhalt. Sonst bleibt
  // „Glättung nicht verfügbar“ nach NLP_ENABLED=true bis zum TTL sichtbar.
  if (reason === 'NLP_DISABLED') {
    return false;
  }
  if (output.mode === 'SEMANTIC') {
    return output.status === 'ready' || output.status === 'uncertain';
  }
  return true;
}

function snapshotTtlSeconds(input: AnalyzeWordCloudInput, lexicalTtlSeconds: number): number {
  if (input.mode === 'SEMANTIC') {
    return resolveWordCloudEncoderCacheTtlSeconds();
  }
  return lexicalTtlSeconds;
}

function shouldServeCachedWordCloudSnapshot(input: AnalyzeWordCloudInput): boolean {
  // Kill-Switch ist Prozesskonfiguration, kein Snapshot-Inhalt.
  // Sonst bleiben ready/uncertain nach Rollback auf false bis zum TTL sichtbar.
  if (input.mode === 'SEMANTIC' && !isWordCloudSemanticEnabled()) {
    return false;
  }
  return true;
}

export function createMemoryWordCloudAnalysisCache(
  ttlSeconds = resolveNlpSidecarConfig().cacheTtlSeconds,
): WordCloudAnalysisCache & { clear(): void } {
  const texts = new Map<string, { expiresAt: number; tokens: readonly WordCloudRawToken[] }>();
  const snapshots = new Map<string, { expiresAt: number; output: AnalyzeWordCloudOutput }>();
  const ttlMs = ttlSeconds * 1000;

  return {
    async getText(locale, textHash) {
      const key = buildWordCloudTextCacheKey(locale, textHash);
      const entry = texts.get(key);
      if (!entry || entry.expiresAt <= Date.now()) {
        if (entry) texts.delete(key);
        return null;
      }
      return entry.tokens;
    },
    async setText(locale, textHash, tokens) {
      texts.set(buildWordCloudTextCacheKey(locale, textHash), {
        expiresAt: Date.now() + ttlMs,
        tokens,
      });
    },
    async getSnapshot(input) {
      const key = buildWordCloudSnapshotCacheKey(input);
      const entry = snapshots.get(key);
      if (!entry || entry.expiresAt <= Date.now()) {
        if (entry) snapshots.delete(key);
        return null;
      }
      if (!shouldServeCachedWordCloudSnapshot(input)) {
        return null;
      }
      return entry.output;
    },
    async setSnapshot(input, output) {
      if (!shouldCacheWordCloudSnapshot(output)) {
        return;
      }
      snapshots.set(buildWordCloudSnapshotCacheKey(input), {
        expiresAt: Date.now() + snapshotTtlSeconds(input, ttlSeconds) * 1000,
        output,
      });
    },
    clear() {
      texts.clear();
      snapshots.clear();
    },
  };
}

export function createNoopWordCloudAnalysisCache(): WordCloudAnalysisCache {
  return {
    async getText() {
      return null;
    },
    async setText() {},
    async getSnapshot() {
      return null;
    },
    async setSnapshot() {},
  };
}

export function createRedisWordCloudAnalysisCache(
  ttlSeconds = resolveNlpSidecarConfig().cacheTtlSeconds,
): WordCloudAnalysisCache {
  return {
    async getText(locale, textHash) {
      try {
        const raw = await getRedis().get(buildWordCloudTextCacheKey(locale, textHash));
        if (!raw) return null;
        return parseCachedTextTokens(raw);
      } catch {
        return null;
      }
    },
    async setText(locale, textHash, tokens) {
      try {
        await getRedis().set(
          buildWordCloudTextCacheKey(locale, textHash),
          JSON.stringify({ tokens } satisfies WordCloudCachedTextTokens),
          'EX',
          ttlSeconds,
        );
      } catch (error) {
        logger.warn('wordcloud:text_cache_write_failed', {
          reason: error instanceof Error ? error.name : 'unknown',
        });
      }
    },
    async getSnapshot(input) {
      try {
        const raw = await getRedis().get(buildWordCloudSnapshotCacheKey(input));
        if (!raw) return null;
        const parsed = AnalyzeWordCloudOutputSchema.safeParse(JSON.parse(raw));
        if (!parsed.success || !shouldServeCachedWordCloudSnapshot(input)) {
          return null;
        }
        return parsed.data;
      } catch {
        return null;
      }
    },
    async setSnapshot(input, output) {
      if (!shouldCacheWordCloudSnapshot(output)) {
        return;
      }
      try {
        await getRedis().set(
          buildWordCloudSnapshotCacheKey(input),
          JSON.stringify(output),
          'EX',
          snapshotTtlSeconds(input, ttlSeconds),
        );
      } catch (error) {
        logger.warn('wordcloud:snapshot_cache_write_failed', {
          reason: error instanceof Error ? error.name : 'unknown',
        });
      }
    },
  };
}

const noopCache = createNoopWordCloudAnalysisCache();
let redisCache: WordCloudAnalysisCache | undefined;

export function getWordCloudAnalysisCache(): WordCloudAnalysisCache {
  if (process.env['NODE_ENV'] === 'test') {
    return noopCache;
  }
  redisCache ??= createRedisWordCloudAnalysisCache();
  return redisCache;
}

function parseCachedTextTokens(raw: string): readonly WordCloudRawToken[] | null {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || !('tokens' in parsed)) {
    return null;
  }
  const { tokens } = parsed as WordCloudCachedTextTokens;
  if (!Array.isArray(tokens) || !tokens.every(isWordCloudRawToken)) {
    return null;
  }
  return tokens;
}

function isWordCloudRawToken(value: unknown): value is WordCloudRawToken {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as WordCloudRawToken).display === 'string' &&
    typeof (value as WordCloudRawToken).lookup === 'string' &&
    ((value as WordCloudRawToken).pos === undefined ||
      typeof (value as WordCloudRawToken).pos === 'string')
  );
}
