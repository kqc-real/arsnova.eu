import { getRedis } from '../redis';
import { logger } from './logger';

const QA_MINUTE_WINDOW_SECONDS = 60;
const QA_PRESENCE_WINDOW_SECONDS = 180;
const QA_BUCKET_TTL_SECONDS = 150;
const QA_DEDUP_TTL_SECONDS = 180;
const MINUTE_OBSERVED_SINCE_KEY = 'qa:telemetry:minute:observed-since';
const PRESENCE_OBSERVED_SINCE_KEY = 'qa:telemetry:presence:observed-since';

type QaCounter = 'questions' | 'ratings';
export type QaLiveMetricStatus = 'AVAILABLE' | 'WARMING_UP' | 'UNAVAILABLE';

export interface QaTelemetrySnapshot {
  questionsLastMinute: number | null;
  ratingsLastMinute: number | null;
  minuteStatus: QaLiveMetricStatus;
  presenceStatus: QaLiveMetricStatus;
}

let minuteGapObserved = false;
let presenceGapObserved = false;
let recordWarned = false;
let readWarned = false;

function bucketKey(counter: QaCounter, second: number): string {
  return `qa:telemetry:${counter}:${second}`;
}

function parseInteger(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

async function ensureObservedSince(key: string, nowMs: number, reset: boolean): Promise<number> {
  const redis = getRedis();
  if (reset) {
    await redis.set(key, String(nowMs));
    return nowMs;
  }
  await redis.set(key, String(nowMs), 'NX');
  return parseInteger(await redis.get(key)) || nowMs;
}

async function recordCounter(
  counter: QaCounter,
  eventId: string,
  nowMs: number = Date.now(),
): Promise<void> {
  if (!eventId) return;
  try {
    const redis = getRedis();
    const dedupKey = `qa:telemetry:dedup:${counter}:${eventId}`;
    const accepted = await redis.set(dedupKey, '1', 'EX', QA_DEDUP_TTL_SECONDS, 'NX');
    if (accepted !== 'OK') return;

    await ensureObservedSince(MINUTE_OBSERVED_SINCE_KEY, nowMs, minuteGapObserved);
    minuteGapObserved = false;
    const second = Math.floor(nowMs / 1000);
    await redis
      .multi()
      .incr(bucketKey(counter, second))
      .expire(bucketKey(counter, second), QA_BUCKET_TTL_SECONDS)
      .exec();
  } catch (error) {
    minuteGapObserved = true;
    if (!recordWarned) {
      recordWarned = true;
      logger.warn('qaTelemetry.record: Redis-Telemetrie nicht verfügbar', error);
    }
  }
}

export function recordQaQuestionAccepted(questionId: string, nowMs?: number): Promise<void> {
  return recordCounter('questions', questionId, nowMs);
}

export function recordQaRatingChanged(mutationId: string, nowMs?: number): Promise<void> {
  return recordCounter('ratings', mutationId, nowMs);
}

/** Wird aus dem Presence-Pfad aufgerufen; IDs und Sessionbezug werden nie gespeichert. */
export async function markQaPresenceObservation(nowMs: number = Date.now()): Promise<void> {
  try {
    await ensureObservedSince(PRESENCE_OBSERVED_SINCE_KEY, nowMs, presenceGapObserved);
    presenceGapObserved = false;
  } catch {
    presenceGapObserved = true;
  }
}

export function markQaPresenceGap(): void {
  presenceGapObserved = true;
}

export async function readQaTelemetry(nowMs: number = Date.now()): Promise<QaTelemetrySnapshot> {
  try {
    const redis = getRedis();
    const [minuteObservedSince, presenceObservedSince] = await Promise.all([
      ensureObservedSince(MINUTE_OBSERVED_SINCE_KEY, nowMs, minuteGapObserved),
      ensureObservedSince(PRESENCE_OBSERVED_SINCE_KEY, nowMs, presenceGapObserved),
    ]);
    minuteGapObserved = false;
    presenceGapObserved = false;

    const currentSecond = Math.floor(nowMs / 1000);
    const keys: string[] = [];
    for (let offset = 0; offset < QA_MINUTE_WINDOW_SECONDS; offset += 1) {
      const second = currentSecond - offset;
      keys.push(bucketKey('questions', second), bucketKey('ratings', second));
    }
    const values = keys.length > 0 ? await redis.mget(...keys) : [];
    let questions = 0;
    let ratings = 0;
    for (let offset = 0; offset < QA_MINUTE_WINDOW_SECONDS; offset += 1) {
      questions += parseInteger(values[offset * 2]);
      ratings += parseInteger(values[offset * 2 + 1]);
    }

    const minuteReady = nowMs - minuteObservedSince >= QA_MINUTE_WINDOW_SECONDS * 1000;
    const presenceReady = nowMs - presenceObservedSince >= QA_PRESENCE_WINDOW_SECONDS * 1000;
    return {
      questionsLastMinute: minuteReady ? questions : null,
      ratingsLastMinute: minuteReady ? ratings : null,
      minuteStatus: minuteReady ? 'AVAILABLE' : 'WARMING_UP',
      presenceStatus: presenceReady ? 'AVAILABLE' : 'WARMING_UP',
    };
  } catch (error) {
    minuteGapObserved = true;
    presenceGapObserved = true;
    if (!readWarned) {
      readWarned = true;
      logger.warn('qaTelemetry.read: Redis-Telemetrie nicht verfügbar', error);
    }
    return {
      questionsLastMinute: null,
      ratingsLastMinute: null,
      minuteStatus: 'UNAVAILABLE',
      presenceStatus: 'UNAVAILABLE',
    };
  }
}

export function resetQaTelemetryForTests(): void {
  minuteGapObserved = false;
  presenceGapObserved = false;
  recordWarned = false;
  readWarned = false;
}
