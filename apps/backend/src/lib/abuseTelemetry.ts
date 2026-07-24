import { getRedis } from '../redis';
import { logger } from './logger';

const BUCKET_SECONDS = 10;
const WINDOW_SECONDS = 60;
// Ein zusätzlicher Rand-Bucket verhindert, dass Ereignisse unter 60 Sekunden
// am Bucket-Anfang verschwinden. Die Anzeige überzählt dadurch konservativ um
// höchstens einen 10-Sekunden-Bucket, statt Security-Schwellen zu unterschätzen.
const WINDOW_BUCKETS = WINDOW_SECONDS / BUCKET_SECONDS + 1;
const BUCKET_TTL_SECONDS = WINDOW_SECONDS * 2;
const RATE_LIMIT_LOG_INTERVAL_MS = 10_000;

export type RateLimitCategory = 'sessionCreate' | 'sessionCode' | 'vote' | 'pdf' | 'motd' | 'other';

type AbuseCounterName = 'sessionCreateCompleted' | `rateLimit429:${RateLimitCategory}`;

export type AbuseSignals = {
  sessionCreatesLastMinute: number;
  rateLimit429LastMinute: number;
  rateLimit429ByCategoryLastMinute: Record<RateLimitCategory, number>;
};

const RATE_LIMIT_CATEGORIES: RateLimitCategory[] = [
  'sessionCreate',
  'sessionCode',
  'vote',
  'pdf',
  'motd',
  'other',
];

let recordWarned = false;
let readWarned = false;
const rateLimitLogStates = new Map<
  RateLimitCategory,
  { lastLoggedAtMs: number; suppressedSinceLastLog: number }
>();

function currentBucket(nowMs: number): number {
  return Math.floor(nowMs / (BUCKET_SECONDS * 1000));
}

function counterBucketKey(counter: AbuseCounterName, bucket: number): string {
  return `security:metric:${counter}:${bucket}`;
}

function parseRedisInteger(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

async function recordCounter(counter: AbuseCounterName, nowMs: number): Promise<void> {
  if (process.env['NODE_ENV'] === 'test') return;
  try {
    const key = counterBucketKey(counter, currentBucket(nowMs));
    await getRedis().multi().incr(key).expire(key, BUCKET_TTL_SECONDS).exec();
  } catch (error) {
    if (!recordWarned) {
      recordWarned = true;
      logger.warn(
        'abuseTelemetry.record: Redis nicht erreichbar, Security-Metrik entfällt.',
        error,
      );
    }
  }
}

export function recordSessionCreateCompleted(nowMs: number = Date.now()): Promise<void> {
  return recordCounter('sessionCreateCompleted', nowMs);
}

export function recordRateLimitRejection(
  category: RateLimitCategory,
  nowMs: number = Date.now(),
): Promise<void> {
  return recordCounter(`rateLimit429:${category}`, nowMs);
}

export function logRateLimitRejection(
  details: {
    path: string;
    category: RateLimitCategory;
    clientIp: string;
    ipSource: string;
  },
  nowMs: number = Date.now(),
): void {
  const previous = rateLimitLogStates.get(details.category);
  if (previous && nowMs - previous.lastLoggedAtMs < RATE_LIMIT_LOG_INTERVAL_MS) {
    previous.suppressedSinceLastLog += 1;
    return;
  }

  logger.warn('rate_limit_429', {
    ...details,
    suppressedSinceLastLog: previous?.suppressedSinceLastLog ?? 0,
  });
  rateLimitLogStates.set(details.category, {
    lastLoggedAtMs: nowMs,
    suppressedSinceLastLog: 0,
  });
}

export function resetAbuseTelemetryForTests(): void {
  rateLimitLogStates.clear();
}

export async function readAbuseSignals(nowMs: number = Date.now()): Promise<AbuseSignals> {
  const emptyByCategory = Object.fromEntries(
    RATE_LIMIT_CATEGORIES.map((category) => [category, 0]),
  ) as Record<RateLimitCategory, number>;
  const empty: AbuseSignals = {
    sessionCreatesLastMinute: 0,
    rateLimit429LastMinute: 0,
    rateLimit429ByCategoryLastMinute: emptyByCategory,
  };
  if (process.env['NODE_ENV'] === 'test') return empty;

  try {
    const bucket = currentBucket(nowMs);
    const counters: AbuseCounterName[] = [
      'sessionCreateCompleted',
      ...RATE_LIMIT_CATEGORIES.map((category): AbuseCounterName => `rateLimit429:${category}`),
    ];
    const multi = getRedis().multi();
    for (let offset = 0; offset < WINDOW_BUCKETS; offset++) {
      for (const counter of counters) {
        multi.get(counterBucketKey(counter, bucket - offset));
      }
    }

    const result = await multi.exec();
    if (!result) return empty;

    const signals: AbuseSignals = {
      sessionCreatesLastMinute: 0,
      rateLimit429LastMinute: 0,
      rateLimit429ByCategoryLastMinute: { ...emptyByCategory },
    };
    for (let offset = 0; offset < WINDOW_BUCKETS; offset++) {
      const cursor = offset * counters.length;
      signals.sessionCreatesLastMinute += parseRedisInteger(result[cursor]?.[1]);
      RATE_LIMIT_CATEGORIES.forEach((category, categoryIndex) => {
        const count = parseRedisInteger(result[cursor + categoryIndex + 1]?.[1]);
        signals.rateLimit429ByCategoryLastMinute[category] += count;
        signals.rateLimit429LastMinute += count;
      });
    }
    return signals;
  } catch (error) {
    if (!readWarned) {
      readWarned = true;
      logger.warn(
        'abuseTelemetry.read: Redis nicht erreichbar, Security-Metriken werden 0.',
        error,
      );
    }
    return empty;
  }
}
