import { getRedis } from '../redis';
import { logger } from './logger';

const BUCKET_SECONDS = 10;
const WINDOW_SECONDS = 60;
// Ein zusätzlicher Rand-Bucket verhindert, dass Ereignisse unter 60 Sekunden
// am Bucket-Anfang verschwinden. Die Anzeige überzählt dadurch konservativ um
// höchstens einen 10-Sekunden-Bucket, statt Security-Schwellen zu unterschätzen.
const WINDOW_BUCKETS = WINDOW_SECONDS / BUCKET_SECONDS + 1;
const BUCKET_TTL_SECONDS = WINDOW_SECONDS * 2;
const FLUSH_INTERVAL_MS = 5_000;
const RATE_LIMIT_LOG_INTERVAL_MS = 10_000;
const MAX_COUNTER_VALUE = Number.MAX_SAFE_INTEGER;

export type RateLimitCategory =
  | 'adminLogin'
  | 'sessionCreate'
  | 'quizUpload'
  | 'quickFeedback'
  | 'sessionCode'
  | 'vote'
  | 'pdf'
  | 'motd'
  | 'other';

type AbuseCounterName =
  | 'sessionCreateCompleted'
  | 'sessionCodeFailure'
  | 'sessionCodeSoftCapDelay'
  | `rateLimit429:${RateLimitCategory}`;

export type AbuseSignals = {
  sessionCreatesLastMinute: number;
  sessionCodeFailuresLastMinute: number;
  sessionCodeSoftCapDelaysLastMinute: number;
  rateLimit429LastMinute: number;
  rateLimit429ByCategoryLastMinute: Record<RateLimitCategory, number>;
};

const RATE_LIMIT_CATEGORIES: RateLimitCategory[] = [
  'adminLogin',
  'sessionCreate',
  'quizUpload',
  'quickFeedback',
  'sessionCode',
  'vote',
  'pdf',
  'motd',
  'other',
];

let recordWarned = false;
let readWarned = false;
let flushTimer: NodeJS.Timeout | null = null;
let flushInFlight: Promise<void> | null = null;
let stopping = false;
const pendingBuckets = new Map<number, Map<AbuseCounterName, number>>();
const rateLimitLogStates = new Map<
  RateLimitCategory,
  { lastLoggedAtMs: number; suppressedSinceLastLog: number }
>();
let sessionCodeSoftCapLogState: { lastLoggedAtMs: number; suppressedSinceLastLog: number } | null =
  null;

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

function scheduleFlush(): void {
  if (
    stopping ||
    flushTimer ||
    flushInFlight ||
    pendingBuckets.size === 0 ||
    process.env['NODE_ENV'] === 'test'
  ) {
    return;
  }

  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushAbuseTelemetry();
  }, FLUSH_INTERVAL_MS);
  flushTimer.unref();
}

function recordCounter(counter: AbuseCounterName, nowMs: number): void {
  if (process.env['NODE_ENV'] === 'test' || stopping) return;

  const bucket = currentBucket(nowMs);
  let counters = pendingBuckets.get(bucket);
  if (!counters) {
    if (pendingBuckets.size >= WINDOW_BUCKETS) {
      const oldestBucket = Math.min(...pendingBuckets.keys());
      pendingBuckets.delete(oldestBucket);
    }
    counters = new Map();
    pendingBuckets.set(bucket, counters);
  }
  counters.set(counter, Math.min(MAX_COUNTER_VALUE, (counters.get(counter) ?? 0) + 1));
  scheduleFlush();
}

export function recordSessionCreateCompleted(nowMs: number = Date.now()): void {
  recordCounter('sessionCreateCompleted', nowMs);
}

export function recordSessionCodeFailure(nowMs: number = Date.now()): void {
  recordCounter('sessionCodeFailure', nowMs);
}

export function recordSessionCodeSoftCapDelay(nowMs: number = Date.now()): void {
  recordCounter('sessionCodeSoftCapDelay', nowMs);
}

export function recordRateLimitRejection(
  category: RateLimitCategory,
  nowMs: number = Date.now(),
): void {
  recordCounter(`rateLimit429:${category}`, nowMs);
}

/**
 * Schreibt höchstens WINDOW_BUCKETS × Counter in genau einer Redis-Pipeline.
 * Während eines langsamen Flushs wird kein paralleler Flush gestartet.
 */
export function flushAbuseTelemetry(): Promise<void> {
  if (flushInFlight) return flushInFlight;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  const batch = Array.from(pendingBuckets, ([bucket, counters]) =>
    Array.from(counters, ([counter, count]) => ({ bucket, counter, count })),
  ).flat();
  pendingBuckets.clear();
  if (batch.length === 0) return Promise.resolve();

  const request = (async () => {
    try {
      const multi = getRedis().multi();
      for (const entry of batch) {
        const key = counterBucketKey(entry.counter, entry.bucket);
        multi.incrby(key, entry.count).expire(key, BUCKET_TTL_SECONDS);
      }
      await multi.exec();
    } catch (error) {
      if (!recordWarned) {
        recordWarned = true;
        logger.warn(
          'abuseTelemetry.flush: Redis nicht erreichbar, aggregierte Security-Metrik entfällt.',
          error,
        );
      }
    }
  })();

  flushInFlight = request;
  void request.finally(() => {
    if (flushInFlight === request) {
      flushInFlight = null;
      scheduleFlush();
    }
  });
  return request;
}

export function logRateLimitRejection(
  details: {
    path: string;
    category: RateLimitCategory;
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
    path: details.path,
    category: details.category,
    ipSource: details.ipSource,
    suppressedSinceLastLog: previous?.suppressedSinceLastLog ?? 0,
  });
  rateLimitLogStates.set(details.category, {
    lastLoggedAtMs: nowMs,
    suppressedSinceLastLog: 0,
  });
}

export function logSessionCodeSoftCapDelay(
  details: { delayMs: number; globalUtilizationPercent: number },
  nowMs: number = Date.now(),
): void {
  if (
    sessionCodeSoftCapLogState &&
    nowMs - sessionCodeSoftCapLogState.lastLoggedAtMs < RATE_LIMIT_LOG_INTERVAL_MS
  ) {
    sessionCodeSoftCapLogState.suppressedSinceLastLog += 1;
    return;
  }
  logger.warn('session_code_soft_cap_delay', {
    delayMs: details.delayMs,
    globalUtilizationPercent: details.globalUtilizationPercent,
    suppressedSinceLastLog: sessionCodeSoftCapLogState?.suppressedSinceLastLog ?? 0,
  });
  sessionCodeSoftCapLogState = { lastLoggedAtMs: nowMs, suppressedSinceLastLog: 0 };
}

export function resetAbuseTelemetryForTests(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  flushInFlight = null;
  stopping = false;
  pendingBuckets.clear();
  rateLimitLogStates.clear();
  sessionCodeSoftCapLogState = null;
  recordWarned = false;
  readWarned = false;
}

/** Best-effort-Drain für SIGTERM/SIGINT; blockiert den Shutdown nicht unbegrenzt. */
export async function shutdownAbuseTelemetry(timeoutMs: number = 1_000): Promise<void> {
  stopping = true;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;

  let timedOut = false;
  let timeout: NodeJS.Timeout | undefined;
  const drain = (async () => {
    if (flushInFlight) await flushInFlight;
    if (!timedOut && pendingBuckets.size > 0) await flushAbuseTelemetry();
  })();
  await Promise.race([
    drain,
    new Promise<void>((resolve) => {
      timeout = setTimeout(
        () => {
          timedOut = true;
          resolve();
        },
        Math.max(0, timeoutMs),
      );
    }),
  ]);
  if (timeout) clearTimeout(timeout);
  pendingBuckets.clear();
}

export async function readAbuseSignals(nowMs: number = Date.now()): Promise<AbuseSignals> {
  const emptyByCategory = Object.fromEntries(
    RATE_LIMIT_CATEGORIES.map((category) => [category, 0]),
  ) as Record<RateLimitCategory, number>;
  const empty: AbuseSignals = {
    sessionCreatesLastMinute: 0,
    sessionCodeFailuresLastMinute: 0,
    sessionCodeSoftCapDelaysLastMinute: 0,
    rateLimit429LastMinute: 0,
    rateLimit429ByCategoryLastMinute: emptyByCategory,
  };
  if (process.env['NODE_ENV'] === 'test') return empty;

  try {
    const bucket = currentBucket(nowMs);
    const counters: AbuseCounterName[] = [
      'sessionCreateCompleted',
      'sessionCodeFailure',
      'sessionCodeSoftCapDelay',
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
      sessionCodeFailuresLastMinute: 0,
      sessionCodeSoftCapDelaysLastMinute: 0,
      rateLimit429LastMinute: 0,
      rateLimit429ByCategoryLastMinute: { ...emptyByCategory },
    };
    for (let offset = 0; offset < WINDOW_BUCKETS; offset++) {
      const cursor = offset * counters.length;
      signals.sessionCreatesLastMinute += parseRedisInteger(result[cursor]?.[1]);
      signals.sessionCodeFailuresLastMinute += parseRedisInteger(result[cursor + 1]?.[1]);
      signals.sessionCodeSoftCapDelaysLastMinute += parseRedisInteger(result[cursor + 2]?.[1]);
      RATE_LIMIT_CATEGORIES.forEach((category, categoryIndex) => {
        const count = parseRedisInteger(result[cursor + categoryIndex + 3]?.[1]);
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
