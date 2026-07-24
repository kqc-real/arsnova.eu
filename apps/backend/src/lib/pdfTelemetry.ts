import { getRedis } from '../redis';
import { logger } from './logger';

const BUCKET_SECONDS = 10;
const WINDOW_SECONDS = 60;
const WINDOW_BUCKETS = WINDOW_SECONDS / BUCKET_SECONDS;
const BUCKET_TTL_SECONDS = WINDOW_SECONDS * 2;

type PdfCounterName = 'completed' | 'failed' | 'rejected';

export type PdfSignals = {
  completedLastMinute: number;
  failedLastMinute: number;
  rejectedLastMinute: number;
};

let recordWarned = false;
let readWarned = false;

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

export async function recordPdfJobOutcome(
  outcome: PdfCounterName,
  nowMs: number = Date.now(),
): Promise<void> {
  if (process.env['NODE_ENV'] === 'test') return;
  try {
    const key = counterBucketKey(outcome, currentBucket(nowMs));
    await getRedis().multi().incr(key).expire(key, BUCKET_TTL_SECONDS).exec();
  } catch (error) {
    if (!recordWarned) {
      recordWarned = true;
      logger.warn('pdfTelemetry.record: Redis nicht erreichbar, PDF-Metrik entfällt.', error);
    }
  }
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
