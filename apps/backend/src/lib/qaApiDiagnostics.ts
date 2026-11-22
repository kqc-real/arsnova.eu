import { randomUUID } from 'node:crypto';
import { getRedis } from '../redis';
import { logger } from './logger';

export type QaApiClass =
  | 'JOIN_REJOIN'
  | 'VOTE'
  | 'PARTICIPANT_QUERY'
  | 'QA_PAGE'
  | 'QA_SUBMIT'
  | 'QA_RATING'
  | 'QA_MODERATION'
  | 'QA_ANALYSIS';

export type QaApiClassDiagnostic = {
  samples: number;
  successes: number;
  expectedRejections: number;
  technicalErrors: number;
  p95Ms: number | null;
  p99Ms: number | null;
  expectedRejectionP95Ms: number | null;
  expectedRejectionP99Ms: number | null;
  limitRejections: number;
  deadlineRejections: number;
};

export type QaApiDiagnosticsSnapshot = Record<QaApiClass, QaApiClassDiagnostic>;

type QaApiSample = {
  recordedAtMs: number;
  durationMs: number;
  outcome: 'SUCCESS' | 'EXPECTED_REJECTION' | 'TECHNICAL_ERROR';
  rejection: 'LIMIT' | 'DEADLINE' | 'OTHER' | null;
};

const MAX_SAMPLES_PER_CLASS = 1_000;
export const QA_API_DIAGNOSTICS_WINDOW_MS = 15 * 60_000;
const QA_DIAG_BUCKET_SECONDS = 60;
const QA_DIAG_WINDOW_BUCKETS = QA_API_DIAGNOSTICS_WINDOW_MS / (QA_DIAG_BUCKET_SECONDS * 1_000);
const QA_DIAG_BUCKET_TTL_SECONDS = 20 * 60;
const QA_DIAG_FLUSH_INTERVAL_MS = 5_000;
const QA_DIAG_FLUSH_ID_TTL_SECONDS = 30 * 60;
const QA_DIAG_BUCKET_KEY_PREFIX = 'qa:diag:v1:';
const QA_DIAG_FLUSH_KEY_PREFIX = 'qa:diag:flush:v1:';

/**
 * Feingranulare Latenzstufen inklusive exakter Stützpunkte auf den
 * öffentlichen Kernaktions-Grenzen (250/300/350/400 ms).
 */
export const QA_DIAG_LATENCY_BUCKETS_MS = [
  5, 10, 15, 25, 35, 50, 75, 100, 150, 200, 250, 300, 350, 400, 500, 750, 1_000, 1_500, 2_000,
  3_000, 5_000, 10_000, 30_000,
] as const;
const QA_DIAG_LATENCY_INF = 'inf';
const QA_DIAG_LATENCY_OVERFLOW_MS = 30_001;

export const QA_DIAG_FLUSH_APPLY_LUA = `
local flushKey = KEYS[1]
local flushTtl = tonumber(ARGV[1])
if redis.call('SET', flushKey, '1', 'NX', 'EX', flushTtl) == false then
  return 0
end
local i = 2
while i <= #ARGV do
  local hashKey = ARGV[i]
  local field = ARGV[i + 1]
  local delta = tonumber(ARGV[i + 2])
  local ttl = tonumber(ARGV[i + 3])
  redis.call('HINCRBY', hashKey, field, delta)
  redis.call('EXPIRE', hashKey, ttl)
  i = i + 4
end
return 1
`;

const samples = new Map<QaApiClass, QaApiSample[]>();
const pendingClusterBuckets = new Map<number, Map<string, number>>();
let failedClusterFlush: {
  flushId: string;
  batch: Array<{ bucket: number; fields: Map<string, number> }>;
} | null = null;
let flushTimer: NodeJS.Timeout | null = null;
let flushInFlight: Promise<void> | null = null;
let stopping = false;
let flushWarned = false;
let readWarned = false;

const PATH_CLASSES: Readonly<Record<string, QaApiClass>> = {
  'session.join': 'JOIN_REJOIN',
  'vote.submit': 'VOTE',
  'session.getParticipantSummary': 'PARTICIPANT_QUERY',
  'session.searchParticipants': 'PARTICIPANT_QUERY',
  'session.checkParticipantNickname': 'PARTICIPANT_QUERY',
  'session.heartbeatParticipantPresence': 'PARTICIPANT_QUERY',
  'qa.list': 'QA_PAGE',
  'qa.presentProjection': 'QA_PAGE',
  'qa.submit': 'QA_SUBMIT',
  'qa.upvote': 'QA_RATING',
  'qa.vote': 'QA_RATING',
  'qa.moderate': 'QA_MODERATION',
  'qa.deleteOwn': 'QA_MODERATION',
  'session.toggleQaModeration': 'QA_MODERATION',
  'wordCloud.analyzeQa': 'QA_ANALYSIS',
};

const ALL_API_CLASSES: readonly QaApiClass[] = (Object.values(PATH_CLASSES) as QaApiClass[]).filter(
  (value, index, all) => all.indexOf(value) === index,
);

const EXPECTED_ERROR_CODES = new Set([
  'BAD_REQUEST',
  'CONFLICT',
  'FORBIDDEN',
  'NOT_FOUND',
  'PRECONDITION_FAILED',
  'TOO_MANY_REQUESTS',
  'UNAUTHORIZED',
]);

function percentile(values: readonly number[], quantile: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)] ?? null;
}

function rejectionKind(message: string | undefined): QaApiSample['rejection'] {
  const normalized = message?.toLocaleLowerCase('de-DE') ?? '';
  if (normalized.includes('limit') || normalized.includes('kontingent')) return 'LIMIT';
  if (
    normalized.includes('frist') ||
    normalized.includes('abgelaufen') ||
    normalized.includes('geschlossen') ||
    normalized.includes('beendet')
  ) {
    return 'DEADLINE';
  }
  return 'OTHER';
}

function minuteBucket(nowMs: number): number {
  return Math.floor(nowMs / (QA_DIAG_BUCKET_SECONDS * 1_000));
}

function bucketKey(bucket: number): string {
  return `${QA_DIAG_BUCKET_KEY_PREFIX}${bucket}`;
}

function latencyBucketLabel(durationMs: number): string {
  for (const bound of QA_DIAG_LATENCY_BUCKETS_MS) {
    if (durationMs <= bound) return String(bound);
  }
  return QA_DIAG_LATENCY_INF;
}

function incrementPendingField(bucket: number, field: string, delta = 1): void {
  let fields = pendingClusterBuckets.get(bucket);
  if (!fields) {
    if (pendingClusterBuckets.size >= QA_DIAG_WINDOW_BUCKETS) {
      pendingClusterBuckets.delete(Math.min(...pendingClusterBuckets.keys()));
    }
    fields = new Map<string, number>();
    pendingClusterBuckets.set(bucket, fields);
  }
  fields.set(field, (fields.get(field) ?? 0) + delta);
}

function scheduleClusterFlush(): void {
  if (
    stopping ||
    flushTimer ||
    flushInFlight ||
    (pendingClusterBuckets.size === 0 && !failedClusterFlush) ||
    process.env['NODE_ENV'] === 'test'
  ) {
    return;
  }
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushQaApiDiagnostics();
  }, QA_DIAG_FLUSH_INTERVAL_MS);
  flushTimer.unref();
}

async function applyClusterFlushBatch(
  flushId: string,
  batch: Array<{ bucket: number; fields: Map<string, number> }>,
): Promise<void> {
  if (batch.length === 0) return;
  const args: string[] = [String(QA_DIAG_FLUSH_ID_TTL_SECONDS)];
  for (const { bucket, fields } of batch) {
    const key = bucketKey(bucket);
    for (const [field, delta] of fields) {
      if (delta <= 0) continue;
      args.push(key, field, String(delta), String(QA_DIAG_BUCKET_TTL_SECONDS));
    }
  }
  if (args.length <= 1) return;
  const redis = getRedis();
  await redis.eval(QA_DIAG_FLUSH_APPLY_LUA, 1, `${QA_DIAG_FLUSH_KEY_PREFIX}${flushId}`, ...args);
}

export function flushQaApiDiagnostics(): Promise<void> {
  if (flushInFlight) return flushInFlight;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  const request = (async () => {
    if (failedClusterFlush) {
      const retry = failedClusterFlush;
      failedClusterFlush = null;
      try {
        await applyClusterFlushBatch(retry.flushId, retry.batch);
      } catch (error) {
        failedClusterFlush = retry;
        if (!flushWarned) {
          flushWarned = true;
          logger.warn(
            'qaApiDiagnostics.flush: Redis nicht erreichbar, Diagnose-Batch wird erneut versucht.',
            error,
          );
        }
        return;
      }
    }

    if (pendingClusterBuckets.size === 0) return;
    const batch = Array.from(pendingClusterBuckets, ([bucket, fields]) => ({
      bucket,
      fields: new Map(fields),
    }));
    pendingClusterBuckets.clear();
    const flushId = randomUUID();
    try {
      await applyClusterFlushBatch(flushId, batch);
      flushWarned = false;
    } catch (error) {
      failedClusterFlush = { flushId, batch };
      if (!flushWarned) {
        flushWarned = true;
        logger.warn(
          'qaApiDiagnostics.flush: Redis nicht erreichbar, Diagnose-Batch wird gepuffert.',
          error,
        );
      }
    }
  })().finally(() => {
    flushInFlight = null;
    if (!stopping && (pendingClusterBuckets.size > 0 || failedClusterFlush)) {
      scheduleClusterFlush();
    }
  });

  flushInFlight = request;
  return request;
}

export async function shutdownQaApiDiagnostics(): Promise<void> {
  stopping = true;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (process.env['NODE_ENV'] === 'test') return;
  await flushQaApiDiagnostics();
}

function pruneLocalSamples(list: QaApiSample[], nowMs: number): QaApiSample[] {
  const cutoff = nowMs - QA_API_DIAGNOSTICS_WINDOW_MS;
  let dropCount = 0;
  while (dropCount < list.length && list[dropCount]!.recordedAtMs < cutoff) {
    dropCount += 1;
  }
  if (dropCount > 0) {
    list.splice(0, dropCount);
  }
  return list;
}

export function recordQaApiDiagnostic(input: {
  path: string;
  durationMs: number;
  errorCode?: string;
  errorMessage?: string;
  nowMs?: number;
}): void {
  const apiClass = PATH_CLASSES[input.path];
  if (!apiClass) return;
  const nowMs = input.nowMs ?? Date.now();
  const durationMs = Math.max(0, Math.round(input.durationMs));
  const outcome =
    input.errorCode === undefined
      ? 'SUCCESS'
      : EXPECTED_ERROR_CODES.has(input.errorCode)
        ? 'EXPECTED_REJECTION'
        : 'TECHNICAL_ERROR';
  const rejection = outcome === 'EXPECTED_REJECTION' ? rejectionKind(input.errorMessage) : null;

  const list = pruneLocalSamples(samples.get(apiClass) ?? [], nowMs);
  list.push({
    recordedAtMs: nowMs,
    durationMs,
    outcome,
    rejection,
  });
  if (list.length > MAX_SAMPLES_PER_CLASS) {
    list.splice(0, list.length - MAX_SAMPLES_PER_CLASS);
  }
  samples.set(apiClass, list);

  const bucket = minuteBucket(nowMs);
  const latLabel = latencyBucketLabel(durationMs);
  incrementPendingField(bucket, `${apiClass}:samples`);
  incrementPendingField(bucket, `${apiClass}:lat:${latLabel}`);
  if (outcome === 'SUCCESS') {
    incrementPendingField(bucket, `${apiClass}:successes`);
  } else if (outcome === 'EXPECTED_REJECTION') {
    incrementPendingField(bucket, `${apiClass}:expectedRejections`);
    incrementPendingField(bucket, `${apiClass}:rejlat:${latLabel}`);
    if (rejection === 'LIMIT') {
      incrementPendingField(bucket, `${apiClass}:limitRejections`);
    } else if (rejection === 'DEADLINE') {
      incrementPendingField(bucket, `${apiClass}:deadlineRejections`);
    }
  } else {
    incrementPendingField(bucket, `${apiClass}:technicalErrors`);
  }
  scheduleClusterFlush();
}

export function snapshotQaApiDiagnostics(nowMs: number = Date.now()): QaApiDiagnosticsSnapshot {
  return Object.fromEntries(
    ALL_API_CLASSES.map((apiClass) => {
      const current = pruneLocalSamples(samples.get(apiClass) ?? [], nowMs);
      const successful = current.filter((sample) => sample.outcome === 'SUCCESS');
      const rejected = current.filter((sample) => sample.outcome === 'EXPECTED_REJECTION');
      const technicalErrors = current.filter(
        (sample) => sample.outcome === 'TECHNICAL_ERROR',
      ).length;
      return [
        apiClass,
        {
          samples: current.length,
          successes: successful.length,
          expectedRejections: rejected.length,
          technicalErrors,
          p95Ms: percentile(
            current.map((sample) => sample.durationMs),
            0.95,
          ),
          p99Ms: percentile(
            current.map((sample) => sample.durationMs),
            0.99,
          ),
          expectedRejectionP95Ms: percentile(
            rejected.map((sample) => sample.durationMs),
            0.95,
          ),
          expectedRejectionP99Ms: percentile(
            rejected.map((sample) => sample.durationMs),
            0.99,
          ),
          limitRejections: rejected.filter((sample) => sample.rejection === 'LIMIT').length,
          deadlineRejections: rejected.filter((sample) => sample.rejection === 'DEADLINE').length,
        },
      ];
    }),
  ) as QaApiDiagnosticsSnapshot;
}

function histogramPercentile(
  counts: ReadonlyMap<string, number>,
  prefix: string,
  total: number,
  quantile: number,
): number | null {
  if (total <= 0) return null;
  const target = Math.max(1, Math.ceil(total * quantile));
  let cumulative = 0;
  for (const bound of QA_DIAG_LATENCY_BUCKETS_MS) {
    cumulative += counts.get(`${prefix}${bound}`) ?? 0;
    if (cumulative >= target) return bound;
  }
  cumulative += counts.get(`${prefix}${QA_DIAG_LATENCY_INF}`) ?? 0;
  if (cumulative > 0) return QA_DIAG_LATENCY_OVERFLOW_MS;
  return null;
}

function parseRedisCount(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
  return 0;
}

/**
 * Aggregiert das rollierende 15-Minuten-Diagnosefenster über alle App-Replikate in Redis.
 * Flusht vor dem Lesen ausstehende lokale Samples, sodass keine 5s-Verzögerung entsteht,
 * und fällt bei Redis-Ausfall oder in Standard-Unit-Tests auf `snapshotQaApiDiagnostics()` zurück.
 */
export async function readClusterQaApiDiagnostics(options?: {
  nowMs?: number;
  forceCluster?: boolean;
}): Promise<QaApiDiagnosticsSnapshot> {
  const nowMs = options?.nowMs ?? Date.now();
  const forceCluster = options?.forceCluster === true;
  if (process.env['NODE_ENV'] === 'test' && !forceCluster) {
    return snapshotQaApiDiagnostics(nowMs);
  }

  try {
    if (pendingClusterBuckets.size > 0 || failedClusterFlush) {
      await flushQaApiDiagnostics();
    }
    const current = minuteBucket(nowMs);
    const redis = getRedis();
    const pipeline = redis.multi();
    for (let offset = 0; offset < QA_DIAG_WINDOW_BUCKETS; offset += 1) {
      pipeline.hgetall(bucketKey(current - offset));
    }
    const rawResults = await pipeline.exec();
    if (!rawResults) {
      return snapshotQaApiDiagnostics(nowMs);
    }

    const merged = new Map<string, number>();
    for (const [err, hash] of rawResults) {
      if (err || !hash || typeof hash !== 'object') continue;
      for (const [field, rawVal] of Object.entries(hash as Record<string, unknown>)) {
        const count = parseRedisCount(rawVal);
        if (count > 0) {
          merged.set(field, (merged.get(field) ?? 0) + count);
        }
      }
    }

    readWarned = false;
    return Object.fromEntries(
      ALL_API_CLASSES.map((apiClass) => {
        const totalSamples = merged.get(`${apiClass}:samples`) ?? 0;
        const successes = merged.get(`${apiClass}:successes`) ?? 0;
        const expectedRejections = merged.get(`${apiClass}:expectedRejections`) ?? 0;
        const technicalErrors = merged.get(`${apiClass}:technicalErrors`) ?? 0;
        const limitRejections = merged.get(`${apiClass}:limitRejections`) ?? 0;
        const deadlineRejections = merged.get(`${apiClass}:deadlineRejections`) ?? 0;
        return [
          apiClass,
          {
            samples: totalSamples,
            successes,
            expectedRejections,
            technicalErrors,
            p95Ms: histogramPercentile(merged, `${apiClass}:lat:`, totalSamples, 0.95),
            p99Ms: histogramPercentile(merged, `${apiClass}:lat:`, totalSamples, 0.99),
            expectedRejectionP95Ms: histogramPercentile(
              merged,
              `${apiClass}:rejlat:`,
              expectedRejections,
              0.95,
            ),
            expectedRejectionP99Ms: histogramPercentile(
              merged,
              `${apiClass}:rejlat:`,
              expectedRejections,
              0.99,
            ),
            limitRejections,
            deadlineRejections,
          },
        ];
      }),
    ) as QaApiDiagnosticsSnapshot;
  } catch (error) {
    if (!readWarned) {
      readWarned = true;
      logger.warn(
        'qaApiDiagnostics.readCluster: Redis nicht erreichbar, lokaler Snapshot wird genutzt.',
        error,
      );
    }
    return snapshotQaApiDiagnostics(nowMs);
  }
}

export function resetQaApiDiagnosticsForTests(): void {
  samples.clear();
  pendingClusterBuckets.clear();
  failedClusterFlush = null;
  flushWarned = false;
  readWarned = false;
  stopping = false;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}
