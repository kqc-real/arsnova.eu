import { getRedis } from '../redis';
import { logger } from './logger';

const PRESENCE_TTL_SECONDS = 180;
const PRESENCE_TTL_MS = PRESENCE_TTL_SECONDS * 1000;
const PRESENCE_KEY_TTL_SECONDS = PRESENCE_TTL_SECONDS + 30;

let touchWarned = false;
let countWarned = false;

function presenceKey(sessionId: string): string {
  return `presence:session:${sessionId}`;
}

export async function touchParticipantPresence(
  sessionId: string,
  participantId: string,
  nowMs: number = Date.now(),
): Promise<void> {
  if (process.env['NODE_ENV'] === 'test') return;
  if (!sessionId || !participantId) return;

  try {
    const cutoff = nowMs - PRESENCE_TTL_MS;
    const redis = getRedis();
    await redis
      .multi()
      .zadd(presenceKey(sessionId), nowMs, participantId)
      .zremrangebyscore(presenceKey(sessionId), 0, cutoff)
      .expire(presenceKey(sessionId), PRESENCE_KEY_TTL_SECONDS)
      .exec();
  } catch (err) {
    if (!touchWarned) {
      touchWarned = true;
      logger.warn(
        'presence.touch: Redis nicht erreichbar, Presence-Update wird übersprungen.',
        err,
      );
    }
  }
}

export async function countActiveParticipantsForSessions(
  sessionIds: readonly string[],
  nowMs: number = Date.now(),
): Promise<number> {
  const counts = await getActiveParticipantCountsForSessions(sessionIds, nowMs);
  let sum = 0;
  for (const count of counts.values()) {
    if (count > 0) {
      sum += count;
    }
  }
  return sum;
}

export async function getActiveParticipantIdsForSession(
  sessionId: string,
  nowMs: number = Date.now(),
): Promise<Set<string>> {
  if (process.env['NODE_ENV'] === 'test') return new Set();
  if (!sessionId) return new Set();

  const cutoff = nowMs - PRESENCE_TTL_MS;
  const redis = getRedis();

  try {
    const key = presenceKey(sessionId);
    await redis.zremrangebyscore(key, 0, cutoff);
    const ids = await redis.zrangebyscore(key, cutoff, '+inf');
    return new Set(ids.filter((id) => typeof id === 'string' && id.length > 0));
  } catch (err) {
    if (!countWarned) {
      countWarned = true;
      logger.warn(
        'presence.list: Redis nicht erreichbar, aktive Teilnahmen können nicht exakt berechnet werden.',
        err,
      );
    }
    return new Set();
  }
}

export async function getActiveParticipantCountsForSessions(
  sessionIds: readonly string[],
  nowMs: number = Date.now(),
): Promise<Map<string, number>> {
  if (process.env['NODE_ENV'] === 'test') return new Map();
  if (sessionIds.length === 0) return new Map();

  const cutoff = nowMs - PRESENCE_TTL_MS;
  const redis = getRedis();
  const multi = redis.multi();
  for (const sessionId of sessionIds) {
    const key = presenceKey(sessionId);
    multi.zremrangebyscore(key, 0, cutoff);
    multi.zcount(key, cutoff, '+inf');
  }

  try {
    const execResult = await multi.exec();
    if (!execResult) return new Map();

    const counts = new Map<string, number>();
    for (let i = 0; i < sessionIds.length; i++) {
      const countTuple = execResult[i * 2 + 1];
      const countResult = countTuple?.[1];
      const count =
        typeof countResult === 'number'
          ? countResult
          : typeof countResult === 'string'
            ? Number.parseInt(countResult, 10)
            : 0;
      counts.set(sessionIds[i]!, Number.isFinite(count) && count > 0 ? count : 0);
    }
    return counts;
  } catch (err) {
    if (!countWarned) {
      countWarned = true;
      logger.warn(
        'presence.count: Redis nicht erreichbar, aktive Teilnahmen können nicht exakt berechnet werden.',
        err,
      );
    }
    return new Map();
  }
}
