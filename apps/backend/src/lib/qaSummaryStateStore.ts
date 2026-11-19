import { randomUUID } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { QaSummaryResultV2Schema } from '@arsnova/shared-types';
import Redis from 'ioredis';
import { z } from 'zod';

const StateSchema = z.strictObject({
  result: QaSummaryResultV2Schema,
  generation: z.uuid(),
  lastFinishedAt: z.number().nullable(),
  expiresAt: z.number(),
});

export type SessionSummaryState = z.infer<typeof StateSchema>;
export type SummaryStateRecord = {
  readonly revision: string;
  readonly state: SessionSummaryState | null;
};

const KEY_PREFIX = 'qa:summary:state:v1:';
const WRITE_STATE = `
-- qa_summary_state_compare_and_set_v1
if (redis.call('HGET', KEYS[1], 'revision') or '') ~= ARGV[1] then return 0 end
redis.call('HSET', KEYS[1], 'revision', ARGV[2], 'state', ARGV[3])
redis.call('PEXPIRE', KEYS[1], ARGV[4])
return 1
`;
const INVALIDATE_STATE = `
-- qa_summary_state_invalidate_v1
local ttl = tonumber(ARGV[2])
if redis.call('HGET', KEYS[1], 'state') == '' then
  ttl = math.max(ttl, redis.call('PTTL', KEYS[1]))
end
redis.call('HSET', KEYS[1], 'revision', ARGV[1], 'state', '')
redis.call('PEXPIRE', KEYS[1], ttl)
return 1
`;

const localStates = new Map<string, SummaryStateRecord>();
let client: Redis | null = null;
let initialConnect: Promise<void> | null = null;

export function summaryStateUnavailable(cause?: unknown): TRPCError {
  return new TRPCError({
    code: 'SERVICE_UNAVAILABLE',
    message: 'Die Moderationszusammenfassung ist vorübergehend nicht verfügbar.',
    cause,
  });
}

async function getStateRedis(url: string): Promise<Redis> {
  if (!client) {
    client = new Redis(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      autoResendUnfulfilledCommands: false,
      connectTimeout: 1_000,
      commandTimeout: 1_500,
      maxRetriesPerRequest: 0,
      retryStrategy: (attempt) => Math.min(attempt * 200, 2_000),
    });
    initialConnect = client.connect().finally(() => {
      initialConnect = null;
    });
  }
  if (initialConnect) await initialConnect;
  return client;
}

export async function readSummaryState(
  sessionId: string,
  now: number,
): Promise<SummaryStateRecord | null> {
  const url = process.env['QA_SUMMARY_STATE_REDIS_URL']?.trim();
  if (!url) {
    const record = localStates.get(sessionId);
    if (
      record?.state &&
      record.state.result.status !== 'pending' &&
      record.state.expiresAt <= now
    ) {
      localStates.delete(sessionId);
      return null;
    }
    return record ?? null;
  }
  try {
    const redis = await getStateRedis(url);
    const [revision, value] = await redis.hmget(KEY_PREFIX + sessionId, 'revision', 'state');
    if (!revision && value === null) return null;
    if (!revision || typeof value !== 'string') throw new Error('Invalid Q&A summary state');
    return { revision, state: value === '' ? null : StateSchema.parse(JSON.parse(value)) };
  } catch (cause) {
    throw summaryStateUnavailable(cause);
  }
}

export async function compareAndSetSummaryState(
  sessionId: string,
  previous: SummaryStateRecord | null,
  state: SessionSummaryState,
  now: number,
): Promise<SummaryStateRecord | null> {
  const record = { revision: randomUUID(), state };
  const url = process.env['QA_SUMMARY_STATE_REDIS_URL']?.trim();
  if (!url) {
    if (localStates.get(sessionId)?.revision !== previous?.revision) return null;
    localStates.set(sessionId, record);
    return record;
  }
  try {
    const redis = await getStateRedis(url);
    const written = await redis.eval(
      WRITE_STATE,
      1,
      KEY_PREFIX + sessionId,
      previous?.revision ?? '',
      record.revision,
      JSON.stringify(state),
      Math.max(1, state.expiresAt - now),
    );
    return written === 1 ? record : null;
  } catch (cause) {
    throw summaryStateUnavailable(cause);
  }
}

export async function invalidateSummaryState(sessionId: string, fenceMs: number): Promise<void> {
  localStates.delete(sessionId);
  const url = process.env['QA_SUMMARY_STATE_REDIS_URL']?.trim();
  if (!url) return;
  try {
    const redis = await getStateRedis(url);
    await redis.eval(INVALIDATE_STATE, 1, KEY_PREFIX + sessionId, randomUUID(), fenceMs);
  } catch (cause) {
    throw summaryStateUnavailable(cause);
  }
}

export function resetLocalSummaryStates(): void {
  localStates.clear();
}

export function clearLocalSummaryState(sessionId: string): void {
  localStates.delete(sessionId);
}

export function closeQaSummaryStateRedis(): void {
  client?.disconnect();
  client = null;
  initialConnect = null;
}
