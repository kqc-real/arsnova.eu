import { getRedis } from '../redis';
import { logger } from './logger';

const BUCKET_SECONDS = 10;
const WINDOW_SECONDS = 60;
// Zusätzlicher Rand-Bucket: kein <60s altes Ereignis fällt am Bucket-Rand heraus.
const WINDOW_BUCKETS = WINDOW_SECONDS / BUCKET_SECONDS + 1;
const BUCKET_TTL_SECONDS = WINDOW_SECONDS * 2;
const FLUSH_INTERVAL_MS = 5_000;
const MAX_COUNTER_VALUE = Number.MAX_SAFE_INTEGER;

type PdfCounterName = 'completed' | 'failed' | 'rejected';

export type PdfSignals = {
  completedLastMinute: number;
  failedLastMinute: number;
  rejectedLastMinute: number;
};

let recordWarned = false;
let readWarned = false;
let flushTimer: NodeJS.Timeout | null = null;
let flushInFlight: Promise<void> | null = null;
let stopping = false;
const pendingBuckets = new Map<number, Map<PdfCounterName, number>>();

function currentBucket(nowMs: number): number {
  return Math.floor(nowMs / (BUCKET_SECONDS * 1000));
}

function counterBucketKey(counter: PdfCounterName, bucket: number): string {
  return `pdf:metric:${counter}:${bucket}`;
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
    void flushPdfTelemetry();
  }, FLUSH_INTERVAL_MS);
  flushTimer.unref();
}

export function recordPdfJobOutcome(outcome: PdfCounterName, nowMs: number = Date.now()): void {
  if (process.env['NODE_ENV'] === 'test' || stopping) return;

  const bucket = currentBucket(nowMs);
  let counters = pendingBuckets.get(bucket);
  if (!counters) {
    if (pendingBuckets.size >= WINDOW_BUCKETS) {
      pendingBuckets.delete(Math.min(...pendingBuckets.keys()));
    }
    counters = new Map();
    pendingBuckets.set(bucket, counters);
  }
  counters.set(outcome, Math.min(MAX_COUNTER_VALUE, (counters.get(outcome) ?? 0) + 1));
  scheduleFlush();
}

/** Ein einzelner, bounded INCRBY-/EXPIRE-Flush; keine parallelen Redis-Pipelines. */
export function flushPdfTelemetry(): Promise<void> {
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
        logger.warn('pdfTelemetry.flush: Redis nicht erreichbar, PDF-Metrik entfällt.', error);
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

export function resetPdfTelemetryForTests(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  flushInFlight = null;
  stopping = false;
  pendingBuckets.clear();
  recordWarned = false;
  readWarned = false;
}

/** Best-effort-Drain für SIGTERM/SIGINT; blockiert den Shutdown nicht unbegrenzt. */
export async function shutdownPdfTelemetry(timeoutMs: number = 1_000): Promise<void> {
  stopping = true;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;

  let timedOut = false;
  let timeout: NodeJS.Timeout | undefined;
  const drain = (async () => {
    if (flushInFlight) await flushInFlight;
    if (!timedOut && pendingBuckets.size > 0) await flushPdfTelemetry();
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

export async function readPdfSignals(nowMs: number = Date.now()): Promise<PdfSignals> {
  if (process.env['NODE_ENV'] === 'test') {
    return { completedLastMinute: 0, failedLastMinute: 0, rejectedLastMinute: 0 };
  }

  try {
    const bucket = currentBucket(nowMs);
    const multi = getRedis().multi();
    const counters: PdfCounterName[] = ['completed', 'failed', 'rejected'];

    for (let offset = 0; offset < WINDOW_BUCKETS; offset++) {
      for (const counter of counters) {
        multi.get(counterBucketKey(counter, bucket - offset));
      }
    }

    const result = await multi.exec();
    if (!result) {
      return { completedLastMinute: 0, failedLastMinute: 0, rejectedLastMinute: 0 };
    }

    const signals: PdfSignals = {
      completedLastMinute: 0,
      failedLastMinute: 0,
      rejectedLastMinute: 0,
    };
    for (let offset = 0; offset < WINDOW_BUCKETS; offset++) {
      const cursor = offset * counters.length;
      signals.completedLastMinute += parseRedisInteger(result[cursor]?.[1]);
      signals.failedLastMinute += parseRedisInteger(result[cursor + 1]?.[1]);
      signals.rejectedLastMinute += parseRedisInteger(result[cursor + 2]?.[1]);
    }
    return signals;
  } catch (error) {
    if (!readWarned) {
      readWarned = true;
      logger.warn('pdfTelemetry.read: Redis nicht erreichbar, PDF-Metriken werden 0.', error);
    }
    return { completedLastMinute: 0, failedLastMinute: 0, rejectedLastMinute: 0 };
  }
}
