/**
 * Cache für Host-Wortwolkenanalysen (Story 1.14b, Phase 6).
 *
 * Der frühere persistente Text-Token-Cache ist deaktiviert, weil seine Werte
 * display/surfaceLookup und damit potenziell Teilnehmertext enthalten. Der
 * Memory-Cache bleibt ausschließlich für explizit injizierte lokale Tests.
 * Snapshot-Cache: komplette Analyse nach unveränderlicher Session-ID + Modus +
 * Metrik + Normalization + Analyseversion + snapshotHash.
 *
 * Redis ist flüchtig mit TTL. Analyse-Lese-/Schreibfehler sind fail-open: Analyse
 * läuft ohne Cache weiter. Snapshot-Write und Session-Purge sind serverseitig
 * atomar über einen sessiongebundenen Index plus Purge-Fence koordiniert.
 * Die Session-Purge-Eviction ist fail-closed, damit bereits gecachte
 * Mitgliedstexte nicht bis zum TTL erhalten bleiben.
 * Rohtexte stehen nicht im Redis-Schlüssel.
 */
import {
  AnalyzeWordCloudOutputSchema,
  isTransientWordCloudNormalizationFallback,
  WORD_CLOUD_NORMALIZATION_ANALYSIS_VERSION,
  type AnalyzeWordCloudInput,
  type AnalyzeWordCloudOutput,
} from '@arsnova/shared-types';
import { randomUUID } from 'node:crypto';
import type Redis from 'ioredis';
import { getRedis } from '../redis';
import { logger } from './logger';
import { resolveNlpSidecarConfig } from './nlpSidecarConfig';
import {
  QaSemanticTopicSnapshotSchema,
  type QaSemanticTopicSnapshot,
} from './qaSemanticTopicSnapshot';
import type { WordCloudRawToken } from './wordCloudAnalysis';
import { buildWordCloudSnapshotHash } from './wordCloudNormalization';
import {
  isWordCloudSemanticEnabled,
  resolveWordCloudEncoderCacheTtlSeconds,
} from './wordCloudSemanticConfig';

const TEXT_KEY_PREFIX = 'nlp:wc:text';
const LEGACY_SNAPSHOT_KEY_PREFIX = 'nlp:wc:snap';
const SNAPSHOT_KEY_PREFIX = 'nlp:wc:snapshot:v2';
const SNAPSHOT_PURGE_DURABILITY_PREFIX = 'nlp:wc:purge-durability:v1';
const LEGACY_SNAPSHOT_PURGE_SCAN_COUNT = 500;
const ROLLOUT_CACHE_PURGE_PATTERNS = ['nlp:wc:snap*', `${TEXT_KEY_PREFIX}:*`] as const;
const SNAPSHOT_INDEX_TTL_GRACE_SECONDS = 5 * 60;
const SNAPSHOT_INDEX_MAX_ENTRIES = 2_048;
const SNAPSHOT_PURGE_AOF_TIMEOUT_MS = 5_000;
const SNAPSHOT_PURGE_MARKER_TTL_SECONDS = 5 * 60;
export const WORD_CLOUD_SNAPSHOT_PURGE_BATCH_SIZE = 25;
export const WORD_CLOUD_SNAPSHOT_PURGE_FENCE_TTL_SECONDS = 24 * 60 * 60;

const WRITE_INDEXED_SNAPSHOT_LUA = `
-- wordcloud_snapshot_write_v2
if redis.call('EXISTS', KEYS[3]) == 1 then
  return 0
end
if redis.call('SISMEMBER', KEYS[2], KEYS[1]) == 0
  and redis.call('SCARD', KEYS[2]) >= tonumber(ARGV[4]) then
  return -1
end
redis.call('SADD', KEYS[2], KEYS[1])
local desired_index_ttl = tonumber(ARGV[3])
local current_index_ttl = redis.call('TTL', KEYS[2])
if current_index_ttl < desired_index_ttl then
  redis.call('EXPIRE', KEYS[2], desired_index_ttl)
end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
return 1
`;

const PURGE_INDEXED_SNAPSHOTS_LUA = `
-- wordcloud_snapshot_purge_v2
redis.call('SET', KEYS[2], '1', 'EX', ARGV[1])
local expected_count = tonumber(ARGV[2])
if redis.call('SCARD', KEYS[1]) ~= expected_count then
  return {0, 0}
end
for index = 3, #KEYS do
  if redis.call('SISMEMBER', KEYS[1], KEYS[index]) == 0 then
    return {0, 0}
  end
end
local deleted = 0
for index = 3, #KEYS do
  deleted = deleted + redis.call('UNLINK', KEYS[index])
end
redis.call('DEL', KEYS[1])
return {1, deleted}
`;

export interface WordCloudSnapshotCacheScope {
  readonly sessionId: string;
}

export interface WordCloudAnalysisCache {
  getText(locale: string, textHash: string): Promise<readonly WordCloudRawToken[] | null>;
  setText(locale: string, textHash: string, tokens: readonly WordCloudRawToken[]): Promise<void>;
  getSnapshot(
    input: AnalyzeWordCloudInput,
    scope?: WordCloudSnapshotCacheScope,
  ): Promise<AnalyzeWordCloudOutput | null>;
  setSnapshot(
    input: AnalyzeWordCloudInput,
    output: AnalyzeWordCloudOutput,
    scope?: WordCloudSnapshotCacheScope,
  ): Promise<void>;
  getLatestQaSemanticTopicSnapshot(
    scope: WordCloudSnapshotCacheScope,
  ): Promise<QaSemanticTopicSnapshot | null>;
  setLatestQaSemanticTopicSnapshot(
    snapshot: QaSemanticTopicSnapshot,
    scope: WordCloudSnapshotCacheScope,
  ): Promise<void>;
}

export function buildWordCloudTextCacheKey(locale: string, textHash: string): string {
  return `${TEXT_KEY_PREFIX}:${locale}:${WORD_CLOUD_NORMALIZATION_ANALYSIS_VERSION}:${textHash}`;
}

function snapshotCacheKeyParts(input: AnalyzeWordCloudInput): readonly string[] {
  const snapshotHash = buildWordCloudSnapshotHash(input);
  return [
    input.sessionCode.toUpperCase(),
    input.mode,
    input.metric,
    input.normalization,
    WORD_CLOUD_NORMALIZATION_ANALYSIS_VERSION,
    input.corpusRevision ?? 'client',
    String(input.maxEntries ?? 'default'),
    String(input.maxNgramLength ?? 1),
    snapshotHash,
  ];
}

function normalizeSnapshotSessionId(sessionId: string): string {
  const normalized = sessionId.trim();
  if (!normalized || normalized.includes('{') || normalized.includes('}')) {
    throw new Error('A valid session ID is required for the word-cloud snapshot cache.');
  }
  return normalized;
}

function snapshotSessionPrefix(sessionId: string): string {
  return `${SNAPSHOT_KEY_PREFIX}:{${normalizeSnapshotSessionId(sessionId)}}`;
}

export function buildWordCloudSnapshotCacheKey(
  input: AnalyzeWordCloudInput,
  scope: WordCloudSnapshotCacheScope,
): string {
  return [snapshotSessionPrefix(scope.sessionId), 'value', ...snapshotCacheKeyParts(input)].join(
    ':',
  );
}

export function buildWordCloudSnapshotIndexKey(sessionId: string): string {
  return `${snapshotSessionPrefix(sessionId)}:index`;
}

export function buildWordCloudSnapshotPurgeFenceKey(sessionId: string): string {
  return `${snapshotSessionPrefix(sessionId)}:purged`;
}

export function buildLatestQaSemanticTopicSnapshotCacheKey(sessionId: string): string {
  return `${snapshotSessionPrefix(sessionId)}:value:latest-qa-semantic`;
}

function requiresWordCloudSnapshotPurgeDurability(): boolean {
  return (
    process.env.NODE_ENV === 'production' || process.env.WORD_CLOUD_PURGE_REQUIRE_DURABILITY === '1'
  );
}

interface RedisDurabilityContext {
  readonly clientId: string;
  readonly serverRunId: string;
}

async function readRedisClientId(redis: Redis): Promise<string> {
  const clientId = String(await redis.call('CLIENT', 'ID'));
  if (!/^[1-9]\d*$/.test(clientId)) {
    throw new Error('WORD_CLOUD_PURGE_DURABILITY_UNAVAILABLE');
  }
  return clientId;
}

async function readRedisServerRunId(redis: Redis): Promise<string> {
  const info = String(await redis.call('INFO', 'server'));
  const runId = info.match(/(?:^|\r?\n)run_id:([0-9a-f]{40})(?:\r?\n|$)/i)?.[1];
  if (!runId) {
    throw new Error('WORD_CLOUD_PURGE_DURABILITY_UNAVAILABLE');
  }
  return runId.toLowerCase();
}

async function readRedisDurabilityContext(redis: Redis): Promise<RedisDurabilityContext> {
  const clientId = await readRedisClientId(redis);
  const serverRunId = await readRedisServerRunId(redis);
  const verifiedClientId = await readRedisClientId(redis);
  if (verifiedClientId !== clientId) {
    throw new Error('WORD_CLOUD_PURGE_DURABILITY_UNAVAILABLE');
  }
  return { clientId, serverRunId };
}

function sameRedisDurabilityContext(
  left: RedisDurabilityContext,
  right: RedisDurabilityContext,
): boolean {
  return left.clientId === right.clientId && left.serverRunId === right.serverRunId;
}

async function beginWordCloudSnapshotPurgeDurability(
  redis: Redis,
): Promise<RedisDurabilityContext | null> {
  return requiresWordCloudSnapshotPurgeDurability() ? readRedisDurabilityContext(redis) : null;
}

async function awaitWordCloudSnapshotPurgeDurability(
  redis: Redis,
  expectedContext: RedisDurabilityContext | null,
): Promise<void> {
  if (expectedContext === null) return;
  // CLIENT ID alone can be reused after a Redis restart. Pair it with the
  // server run_id and verify a stable connection around each INFO read.
  const contextBeforeMarker = await readRedisDurabilityContext(redis);
  if (!sameRedisDurabilityContext(contextBeforeMarker, expectedContext)) {
    throw new Error('WORD_CLOUD_PURGE_DURABILITY_UNAVAILABLE');
  }
  const markerId = randomUUID();
  // The marker contains no session material. On this plain Redis connection it
  // is ordered globally after the preceding EVAL/UNLINK commands, so WAITAOF
  // covers the complete purge even when a retry found nothing to delete.
  await redis.set(
    `${SNAPSHOT_PURGE_DURABILITY_PREFIX}:${markerId}`,
    randomUUID(),
    'EX',
    SNAPSHOT_PURGE_MARKER_TTL_SECONDS,
  );
  const result = (await redis.call('WAITAOF', 1, 0, SNAPSHOT_PURGE_AOF_TIMEOUT_MS)) as unknown;
  const contextAfterWait = await readRedisDurabilityContext(redis);
  const confirmed =
    Array.isArray(result) &&
    Number(result[0]) >= 1 &&
    sameRedisDurabilityContext(contextAfterWait, expectedContext);
  if (!confirmed) {
    throw new Error('WORD_CLOUD_PURGE_DURABILITY_UNAVAILABLE');
  }
}

/**
 * Setzt die Purge-Fence und entfernt alle indizierten Snapshot-Ergebnisse einer
 * Session in derselben Redis-Operation. Fehler werden absichtlich
 * weitergereicht: Der erste Purge-Pass muss vor dem fachlichen Session-Delete
 * erfolgreich sein.
 */
async function evictWordCloudAnalysisSnapshotsForSessionMutation(
  redis: Redis,
  sessionId: string,
): Promise<number> {
  const indexKey = buildWordCloudSnapshotIndexKey(sessionId);
  const fenceKey = buildWordCloudSnapshotPurgeFenceKey(sessionId);
  const expectedPrefix = `${snapshotSessionPrefix(sessionId)}:value:`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const indexedKeys = await redis.smembers(indexKey);
    if (!indexedKeys.every((key) => key.startsWith(expectedPrefix))) {
      throw new Error('Redis returned a word-cloud snapshot outside the session scope.');
    }
    const result = await redis.eval(
      PURGE_INDEXED_SNAPSHOTS_LUA,
      2 + indexedKeys.length,
      indexKey,
      fenceKey,
      ...indexedKeys,
      String(WORD_CLOUD_SNAPSHOT_PURGE_FENCE_TTL_SECONDS),
      String(indexedKeys.length),
    );
    if (
      Array.isArray(result) &&
      result.length === 2 &&
      Number(result[0]) === 1 &&
      Number.isSafeInteger(Number(result[1])) &&
      Number(result[1]) >= 0
    ) {
      return Number(result[1]);
    }
  }
  throw new Error('Word-cloud snapshot index changed after the purge fence was set.');
}

/**
 * Purgt Session-Snapshots in begrenzten Chunks. Pro Chunk bestätigt eine
 * verbindungs- und Redis-Run-gebundene Barriere sämtliche vorherigen EVALs.
 */
export async function evictWordCloudAnalysisSnapshotsForSessions(
  sessionIds: readonly string[],
): Promise<number> {
  const uniqueSessionIds = [...new Set(sessionIds.map(normalizeSnapshotSessionId))];
  if (uniqueSessionIds.length === 0) return 0;
  const redis = getRedis();
  let deleted = 0;
  for (
    let offset = 0;
    offset < uniqueSessionIds.length;
    offset += WORD_CLOUD_SNAPSHOT_PURGE_BATCH_SIZE
  ) {
    const chunk = uniqueSessionIds.slice(offset, offset + WORD_CLOUD_SNAPSHOT_PURGE_BATCH_SIZE);
    const durabilityContext = await beginWordCloudSnapshotPurgeDurability(redis);
    const results = await Promise.allSettled(
      chunk.map((sessionId) => evictWordCloudAnalysisSnapshotsForSessionMutation(redis, sessionId)),
    );
    const failed = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (failed) throw failed.reason;
    await awaitWordCloudSnapshotPurgeDurability(redis, durabilityContext);
    deleted += results.reduce(
      (sum, result) => sum + (result.status === 'fulfilled' ? result.value : 0),
      0,
    );
  }
  return deleted;
}

export async function evictWordCloudAnalysisSnapshotsForSession(
  sessionId: string,
): Promise<number> {
  return evictWordCloudAnalysisSnapshotsForSessions([sessionId]);
}

let legacySnapshotCleanup: Promise<number> | null = null;
let snapshotWritesDisabledForShutdown = false;

/**
 * Blockiert neue persistente Snapshot-Writes, sobald der Prozess seinen
 * Graceful Shutdown beginnt. Bereits an Redis übergebene Writes werden durch
 * den anschließenden HTTP-Drain vor dem externen Rollout-Sweep abgeschlossen.
 */
export function beginWordCloudAnalysisCacheShutdown(): void {
  snapshotWritesDisabledForShutdown = true;
}

async function scanAndUnlinkWordCloudCache(redis: Redis, pattern: string): Promise<number> {
  let cursor = '0';
  let deleted = 0;
  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      LEGACY_SNAPSHOT_PURGE_SCAN_COUNT,
    );
    cursor = nextCursor;
    if (keys.length > 0) {
      deleted += await redis.unlink(...keys);
    }
  } while (cursor !== '0');
  return deleted;
}

/**
 * Übergang von den vor v2 nicht indizierten `nlp:wc:snap:*`-Schlüsseln.
 * Der globale Legacy-Namespace wird pro Prozess höchstens einmal gescannt;
 * parallele bzw. Bulk-Purges teilen dasselbe Promise. Neue v2-Schlüssel liegen
 * in einem separaten Namespace und werden von diesem Sweep nicht erfasst.
 */
export function evictLegacyWordCloudAnalysisSnapshots(): Promise<number> {
  if (legacySnapshotCleanup) {
    return legacySnapshotCleanup;
  }
  legacySnapshotCleanup = (async () => {
    const redis = getRedis();
    const durabilityClientId = await beginWordCloudSnapshotPurgeDurability(redis);
    const deleted = await scanAndUnlinkWordCloudCache(redis, `${LEGACY_SNAPSHOT_KEY_PREFIX}:*`);
    await awaitWordCloudSnapshotPurgeDurability(redis, durabilityClientId);
    return deleted;
  })().catch((error: unknown) => {
    legacySnapshotCleanup = null;
    throw error;
  });
  return legacySnapshotCleanup;
}

/**
 * Rollout-only: Nach dem Drain des einzigen alten App-Writers werden v1 und
 * sämtliche v2-Snapshot-Artefakte global entfernt. Dieser Cold-Start-Sweep darf
 * nie aus einem laufenden Runtime-Purge aufgerufen werden.
 */
export async function evictAllWordCloudAnalysisCacheForRollout(): Promise<number> {
  const redis = getRedis();
  const durabilityContext = await beginWordCloudSnapshotPurgeDurability(redis);
  let deleted = 0;
  for (const pattern of ROLLOUT_CACHE_PURGE_PATTERNS) {
    deleted += await scanAndUnlinkWordCloudCache(redis, pattern);
  }
  await awaitWordCloudSnapshotPurgeDurability(redis, durabilityContext);
  return deleted;
}

export function resetWordCloudAnalysisCacheMigrationForTests(): void {
  legacySnapshotCleanup = null;
  snapshotWritesDisabledForShutdown = false;
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
  const latestQaSemanticTopicSnapshots = new Map<
    string,
    { expiresAt: number; snapshot: QaSemanticTopicSnapshot }
  >();
  const ttlMs = ttlSeconds * 1000;
  const memorySnapshotKey = (input: AnalyzeWordCloudInput) =>
    [input.sessionCode.trim().toUpperCase(), ...snapshotCacheKeyParts(input)].join(':');

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
      const key = memorySnapshotKey(input);
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
      snapshots.set(memorySnapshotKey(input), {
        expiresAt: Date.now() + snapshotTtlSeconds(input, ttlSeconds) * 1000,
        output,
      });
    },
    async getLatestQaSemanticTopicSnapshot(scope) {
      const key = normalizeSnapshotSessionId(scope.sessionId);
      const entry = latestQaSemanticTopicSnapshots.get(key);
      if (!entry || entry.expiresAt <= Date.now()) {
        if (entry) latestQaSemanticTopicSnapshots.delete(key);
        return null;
      }
      if (!isWordCloudSemanticEnabled()) {
        return null;
      }
      return entry.snapshot;
    },
    async setLatestQaSemanticTopicSnapshot(snapshot, scope) {
      const parsed = QaSemanticTopicSnapshotSchema.safeParse(snapshot);
      if (!parsed.success) {
        return;
      }
      latestQaSemanticTopicSnapshots.set(normalizeSnapshotSessionId(scope.sessionId), {
        expiresAt: Date.now() + resolveWordCloudEncoderCacheTtlSeconds() * 1000,
        snapshot: parsed.data,
      });
    },
    clear() {
      texts.clear();
      snapshots.clear();
      latestQaSemanticTopicSnapshots.clear();
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
    async getLatestQaSemanticTopicSnapshot() {
      return null;
    },
    async setLatestQaSemanticTopicSnapshot() {},
  };
}

export function createRedisWordCloudAnalysisCache(
  ttlSeconds = resolveNlpSidecarConfig().cacheTtlSeconds,
): WordCloudAnalysisCache {
  return {
    async getText() {
      // Tokenwerte enthalten display/surfaceLookup und damit potenziell
      // Teilnehmertext. Ohne autoritativen Session-Scope wird dieser vormals
      // globale Redis-Cache bewusst nicht mehr gelesen oder beschrieben.
      return null;
    },
    async setText() {
      // Siehe getText: Der Rollout-Sweep entfernt bestehende nlp:wc:text:*
      // nach Writer-Drain; neue Prozesse erzeugen keine solchen Werte mehr.
    },
    async getSnapshot(input, scope) {
      if (!scope) return null;
      try {
        const [fence, raw] = await getRedis().mget(
          buildWordCloudSnapshotPurgeFenceKey(scope.sessionId),
          buildWordCloudSnapshotCacheKey(input, scope),
        );
        if (fence !== null || raw === null) return null;
        const parsed = AnalyzeWordCloudOutputSchema.safeParse(JSON.parse(raw));
        if (!parsed.success || !shouldServeCachedWordCloudSnapshot(input)) {
          return null;
        }
        return parsed.data;
      } catch {
        return null;
      }
    },
    async setSnapshot(input, output, scope) {
      if (snapshotWritesDisabledForShutdown) {
        return;
      }
      if (!shouldCacheWordCloudSnapshot(output)) {
        return;
      }
      if (!scope) {
        logger.warn('wordcloud:snapshot_cache_scope_missing');
        return;
      }
      try {
        const ttl = snapshotTtlSeconds(input, ttlSeconds);
        const result = await getRedis().eval(
          WRITE_INDEXED_SNAPSHOT_LUA,
          3,
          buildWordCloudSnapshotCacheKey(input, scope),
          buildWordCloudSnapshotIndexKey(scope.sessionId),
          buildWordCloudSnapshotPurgeFenceKey(scope.sessionId),
          JSON.stringify(output),
          String(ttl),
          String(ttl + SNAPSHOT_INDEX_TTL_GRACE_SECONDS),
          String(SNAPSHOT_INDEX_MAX_ENTRIES),
        );
        if (Number(result) === -1) {
          logger.warn('wordcloud:snapshot_cache_index_full', {
            maxEntries: SNAPSHOT_INDEX_MAX_ENTRIES,
          });
        }
      } catch (error) {
        logger.warn('wordcloud:snapshot_cache_write_failed', {
          reason: error instanceof Error ? error.name : 'unknown',
        });
      }
    },
    async getLatestQaSemanticTopicSnapshot(scope) {
      try {
        const [fence, raw] = await getRedis().mget(
          buildWordCloudSnapshotPurgeFenceKey(scope.sessionId),
          buildLatestQaSemanticTopicSnapshotCacheKey(scope.sessionId),
        );
        if (fence !== null || raw === null || !isWordCloudSemanticEnabled()) {
          return null;
        }
        const parsed = QaSemanticTopicSnapshotSchema.safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    },
    async setLatestQaSemanticTopicSnapshot(snapshot, scope) {
      if (snapshotWritesDisabledForShutdown) {
        return;
      }
      const parsed = QaSemanticTopicSnapshotSchema.safeParse(snapshot);
      if (!parsed.success) {
        logger.warn('wordcloud:latest_qa_semantic_snapshot_invalid');
        return;
      }
      try {
        const ttl = resolveWordCloudEncoderCacheTtlSeconds();
        const result = await getRedis().eval(
          WRITE_INDEXED_SNAPSHOT_LUA,
          3,
          buildLatestQaSemanticTopicSnapshotCacheKey(scope.sessionId),
          buildWordCloudSnapshotIndexKey(scope.sessionId),
          buildWordCloudSnapshotPurgeFenceKey(scope.sessionId),
          JSON.stringify(parsed.data),
          String(ttl),
          String(ttl + SNAPSHOT_INDEX_TTL_GRACE_SECONDS),
          String(SNAPSHOT_INDEX_MAX_ENTRIES),
        );
        if (Number(result) === -1) {
          logger.warn('wordcloud:snapshot_cache_index_full', {
            maxEntries: SNAPSHOT_INDEX_MAX_ENTRIES,
          });
        }
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
