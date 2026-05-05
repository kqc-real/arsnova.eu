import { getRedis } from '../redis';

const READING_READY_TTL_SECONDS = 6 * 60 * 60;

function readingReadyKey(sessionId: string, questionId: string): string {
  return `reading-ready:${sessionId}:${questionId}`;
}

export async function markParticipantReadingReady(
  sessionId: string,
  questionId: string,
  participantId: string,
): Promise<void> {
  const redis = getRedis();
  await redis
    .multi()
    .sadd(readingReadyKey(sessionId, questionId), participantId)
    .expire(readingReadyKey(sessionId, questionId), READING_READY_TTL_SECONDS)
    .exec();
}

export async function getReadingReadyParticipantIds(
  sessionId: string,
  questionId: string,
): Promise<Set<string>> {
  const redis = getRedis();
  const ids = await redis.smembers(readingReadyKey(sessionId, questionId));
  return new Set(ids.filter((id) => typeof id === 'string' && id.length > 0));
}

export async function clearReadingReady(sessionId: string, questionId: string): Promise<void> {
  const redis = getRedis();
  await redis.del(readingReadyKey(sessionId, questionId));
}
