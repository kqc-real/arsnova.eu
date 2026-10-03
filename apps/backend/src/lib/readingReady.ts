import { getRedis } from '../redis';
import {
  buildReadingReadyKey,
  buildSessionRuntimeDataPurgeFenceKey,
} from './sessionRuntimeDataPurge';

const READING_READY_TTL_SECONDS = 6 * 60 * 60;

const MARK_PARTICIPANT_READING_READY_LUA = `
-- participant_reading_ready_mark_v2
if redis.call('EXISTS', KEYS[2]) == 1 then
  return 0
end
redis.call('SADD', KEYS[1], ARGV[1])
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
return 1
`;

export async function markParticipantReadingReady(
  sessionId: string,
  questionId: string,
  participantId: string,
): Promise<void> {
  const redis = getRedis();
  const result = Number(
    await redis.eval(
      MARK_PARTICIPANT_READING_READY_LUA,
      2,
      buildReadingReadyKey(sessionId, questionId),
      buildSessionRuntimeDataPurgeFenceKey(sessionId),
      participantId,
      String(READING_READY_TTL_SECONDS),
    ),
  );
  if (result !== 0 && result !== 1) {
    throw new Error('PARTICIPANT_READING_READY_WRITE_FAILED');
  }
}

export async function getReadingReadyParticipantIds(
  sessionId: string,
  questionId: string,
): Promise<Set<string>> {
  const redis = getRedis();
  const ids = await redis.smembers(buildReadingReadyKey(sessionId, questionId));
  return new Set(ids.filter((id) => typeof id === 'string' && id.length > 0));
}

export async function clearReadingReady(sessionId: string, questionId: string): Promise<void> {
  const redis = getRedis();
  await redis.del(buildReadingReadyKey(sessionId, questionId));
}
