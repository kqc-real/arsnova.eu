import { getRedis } from '../redis';
import { logger } from './logger';

const BUCKET_SECONDS = 10;
const WINDOW_SECONDS = 60;
const WINDOW_BUCKETS = WINDOW_SECONDS / BUCKET_SECONDS;
const BUCKET_TTL_SECONDS = WINDOW_SECONDS * 2;

const COUNTDOWN_ZSET_KEY = 'load:countdown:sessions';
const COUNTDOWN_ACTIVE_WINDOW_MS = 6 * 60 * 1000;
const COUNTDOWN_ZSET_TTL_SECONDS = 10 * 60;

let recordWarned = false;
let readWarned = false;

type LoadCounterName = 'votes' | 'sessionTransitions';

export interface LoadSignals {
  votesLastMinute: number;
  sessionTransitionsLastMinute: number;
  activeCountdownSessions: number;
}

function currentBucket(nowMs: number): number {
  return Math.floor(nowMs / (BUCKET_SECONDS * 1000));
}

function counterBucketKey(counter: LoadCounterName, bucket: number): string {
  return `load:metric:${counter}:${bucket}`;
}

function parseRedisInteger(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

async function incrementCounter(
  counter: LoadCounterName,
  nowMs: number = Date.now(),
): Promise<void> {
  if (process.env['NODE_ENV'] === 'test') return;
  try {
    const redis = getRedis();
    const key = counterBucketKey(counter, currentBucket(nowMs));
    await redis.multi().incr(key).expire(key, BUCKET_TTL_SECONDS).exec();
  } catch (err) {
    if (!recordWarned) {
      recordWarned = true;
      logger.warn('loadSignal.record: Redis nicht erreichbar, Aktivität wird nicht gezählt.', err);
    }
  }
}

export function recordVoteActivity(nowMs?: number): Promise<void> {
  return incrementCounter('votes', nowMs);
}

export function recordSessionTransitionActivity(nowMs?: number): Promise<void> {
  return incrementCounter('sessionTransitions', nowMs);
}

export async function markCountdownSessionActive(
  sessionId: string,
  nowMs: number = Date.now(),
): Promise<void> {
  if (process.env['NODE_ENV'] === 'test') return;
  if (!sessionId) return;
  try {
    const cutoff = nowMs - COUNTDOWN_ACTIVE_WINDOW_MS;
    const redis = getRedis();
    await redis
      .multi()
      .zadd(COUNTDOWN_ZSET_KEY, nowMs, sessionId)
      .zremrangebyscore(COUNTDOWN_ZSET_KEY, 0, cutoff)
      .expire(COUNTDOWN_ZSET_KEY, COUNTDOWN_ZSET_TTL_SECONDS)
      .exec();
  } catch (err) {
    if (!recordWarned) {
      recordWarned = true;
      logger.warn('loadSignal.countdown: Redis nicht erreichbar, Countdown-Signal entfällt.', err);
    }
  }
}

export async function readLoadSignals(nowMs: number = Date.now()): Promise<LoadSignals> {
  if (process.env['NODE_ENV'] === 'test') {
    return {
      votesLastMinute: 0,
      sessionTransitionsLastMinute: 0,
      activeCountdownSessions: 0,
    };
  }

  try {
    const redis = getRedis();
    const bucket = currentBucket(nowMs);
    const multi = redis.multi();

    for (let offset = 0; offset < WINDOW_BUCKETS; offset++) {
      const bucketId = bucket - offset;
      multi.get(counterBucketKey('votes', bucketId));
      multi.get(counterBucketKey('sessionTransitions', bucketId));
    }

    const cutoff = nowMs - COUNTDOWN_ACTIVE_WINDOW_MS;
    multi.zremrangebyscore(COUNTDOWN_ZSET_KEY, 0, cutoff);
    multi.zcount(COUNTDOWN_ZSET_KEY, cutoff, '+inf');

    const execResult = await multi.exec();
    if (!execResult) {
      return { votesLastMinute: 0, sessionTransitionsLastMinute: 0, activeCountdownSessions: 0 };
    }

    let votesLastMinute = 0;
    let sessionTransitionsLastMinute = 0;

    for (let offset = 0; offset < WINDOW_BUCKETS; offset++) {
      const voteTuple = execResult[offset * 2];
      const transitionTuple = execResult[offset * 2 + 1];
      votesLastMinute += parseRedisInteger(voteTuple?.[1]);
      sessionTransitionsLastMinute += parseRedisInteger(transitionTuple?.[1]);
    }

    const activeCountdownTuple = execResult[WINDOW_BUCKETS * 2 + 1];
    const activeCountdownSessions = parseRedisInteger(activeCountdownTuple?.[1]);

    return {
      votesLastMinute,
      sessionTransitionsLastMinute,
      activeCountdownSessions,
    };
  } catch (err) {
    if (!readWarned) {
      readWarned = true;
      logger.warn(
        'loadSignal.read: Redis nicht erreichbar, Dynamik-Signale werden auf 0 gesetzt.',
        err,
      );
    }
    return {
      votesLastMinute: 0,
      sessionTransitionsLastMinute: 0,
      activeCountdownSessions: 0,
    };
  }
}
