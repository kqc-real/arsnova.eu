import { getRedis } from '../redis';
import { logger } from './logger';

const BUCKET_SECONDS = 10;
const WINDOW_SECONDS = 60;
const WINDOW_BUCKETS = WINDOW_SECONDS / BUCKET_SECONDS;
const BUCKET_TTL_SECONDS = WINDOW_SECONDS * 2;

const LATENCY_BUCKETS_MS = [100, 200, 300, 500, 800, 1000, 1500, 2000, 3000, 5000, 10000] as const;
const LATENCY_BUCKET_INF = 'inf';

let recordWarned = false;
let readWarned = false;

export interface SloSignals {
  totalRequestsLastMinute: number;
  errorRatePercentLastMinute: number;
  p95LatencyMsLastMinute: number;
  p99LatencyMsLastMinute: number;
}

export function isTrackedLiveProcedure(path: string): boolean {
  return (
    path === 'vote.submit' ||
    path === 'quickFeedback.vote' ||
    path === 'session.join' ||
    path === 'session.startQa' ||
    path === 'session.nextQuestion' ||
    path === 'session.revealAnswers' ||
    path === 'session.revealResults' ||
    path === 'session.startDiscussion' ||
    path === 'session.startSecondRound' ||
    path === 'session.getInfo'
  );
}

function currentBucket(nowMs: number): number {
  return Math.floor(nowMs / (BUCKET_SECONDS * 1000));
}

function latencyBucketLabel(durationMs: number): string {
  for (const upperBound of LATENCY_BUCKETS_MS) {
    if (durationMs <= upperBound) return String(upperBound);
  }
  return LATENCY_BUCKET_INF;
}

function totalKey(bucket: number): string {
  return `slo:metric:total:${bucket}`;
}

function errorKey(bucket: number): string {
  return `slo:metric:error:${bucket}`;
}

function latencyKey(bucket: number, label: string): string {
  return `slo:metric:latency:${bucket}:${label}`;
}

function parseRedisInteger(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function isSloErrorCode(errorCode: string | undefined): boolean {
  return errorCode === 'TOO_MANY_REQUESTS' || errorCode === 'INTERNAL_SERVER_ERROR';
}

export async function recordLiveRequestTelemetry(input: {
  durationMs: number;
  errorCode?: string;
  nowMs?: number;
}): Promise<void> {
  if (process.env['NODE_ENV'] === 'test') return;
  const nowMs = input.nowMs ?? Date.now();
  const durationMs = Math.max(0, Math.round(input.durationMs));
  const bucket = currentBucket(nowMs);
  const bucketLabel = latencyBucketLabel(durationMs);

  try {
    const redis = getRedis();
    const multi = redis.multi();
    multi.incr(totalKey(bucket));
    multi.expire(totalKey(bucket), BUCKET_TTL_SECONDS);
    multi.incr(latencyKey(bucket, bucketLabel));
    multi.expire(latencyKey(bucket, bucketLabel), BUCKET_TTL_SECONDS);
    if (isSloErrorCode(input.errorCode)) {
      multi.incr(errorKey(bucket));
      multi.expire(errorKey(bucket), BUCKET_TTL_SECONDS);
    }
    await multi.exec();
  } catch (err) {
    if (!recordWarned) {
      recordWarned = true;
      logger.warn(
        'sloTelemetry.record: Redis nicht erreichbar, SLO-Telemetrie wird übersprungen.',
        err,
      );
    }
  }
}

function percentileFromHistogram(
  totalCount: number,
  countsByLabel: Map<string, number>,
  percentile: number,
): number {
  if (totalCount <= 0) return 0;
  const threshold = Math.ceil(totalCount * percentile);
  let cumulative = 0;
  for (const upperBound of LATENCY_BUCKETS_MS) {
    const label = String(upperBound);
    cumulative += countsByLabel.get(label) ?? 0;
    if (cumulative >= threshold) return upperBound;
  }
  return 12000;
}

export async function readSloSignals(nowMs: number = Date.now()): Promise<SloSignals> {
  if (process.env['NODE_ENV'] === 'test') {
    return {
      totalRequestsLastMinute: 0,
      errorRatePercentLastMinute: 0,
      p95LatencyMsLastMinute: 0,
      p99LatencyMsLastMinute: 0,
    };
  }

  try {
    const redis = getRedis();
    const bucket = currentBucket(nowMs);
    const multi = redis.multi();
    const labels = [...LATENCY_BUCKETS_MS.map(String), LATENCY_BUCKET_INF];

    for (let offset = 0; offset < WINDOW_BUCKETS; offset++) {
      const bucketId = bucket - offset;
      multi.get(totalKey(bucketId));
      multi.get(errorKey(bucketId));
      for (const label of labels) {
        multi.get(latencyKey(bucketId, label));
      }
    }

    const execResult = await multi.exec();
    if (!execResult) {
      return {
        totalRequestsLastMinute: 0,
        errorRatePercentLastMinute: 0,
        p95LatencyMsLastMinute: 0,
        p99LatencyMsLastMinute: 0,
      };
    }

    let cursor = 0;
    let totalRequestsLastMinute = 0;
    let totalErrorsLastMinute = 0;
    const latencyCounts = new Map<string, number>();

    for (let offset = 0; offset < WINDOW_BUCKETS; offset++) {
      totalRequestsLastMinute += parseRedisInteger(execResult[cursor++]?.[1]);
      totalErrorsLastMinute += parseRedisInteger(execResult[cursor++]?.[1]);
      for (const label of labels) {
        const existing = latencyCounts.get(label) ?? 0;
        latencyCounts.set(label, existing + parseRedisInteger(execResult[cursor++]?.[1]));
      }
    }

    const errorRatePercentLastMinute =
      totalRequestsLastMinute > 0 ? (totalErrorsLastMinute / totalRequestsLastMinute) * 100 : 0;

    return {
      totalRequestsLastMinute,
      errorRatePercentLastMinute,
      p95LatencyMsLastMinute: percentileFromHistogram(totalRequestsLastMinute, latencyCounts, 0.95),
      p99LatencyMsLastMinute: percentileFromHistogram(totalRequestsLastMinute, latencyCounts, 0.99),
    };
  } catch (err) {
    if (!readWarned) {
      readWarned = true;
      logger.warn(
        'sloTelemetry.read: Redis nicht erreichbar, SLO-Signale werden auf 0 gesetzt.',
        err,
      );
    }
    return {
      totalRequestsLastMinute: 0,
      errorRatePercentLastMinute: 0,
      p95LatencyMsLastMinute: 0,
      p99LatencyMsLastMinute: 0,
    };
  }
}
