import { EMOJI_REACTIONS } from '@arsnova/shared-types';
import { TRPCError } from '@trpc/server';
import { getRedis } from '../redis';
import {
  buildSessionEmojiReactionsKey,
  buildSessionRuntimeDataPurgeFenceKey,
  SESSION_EPHEMERAL_STATE_TTL_SECONDS,
} from './sessionRuntimeDataPurge';
import { isSessionPubSubEnabled } from './sessionStatusPubSub';

type ReactionScope = { sessionId: string; questionId: string; round: number };

const localReactions = new Map<string, Map<string, string>>();

const REPLACE_EMOJI_REACTION = `
-- session_emoji_replace_v1
if redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
local scope = ARGV[1]
local participantField = scope .. ':participant:' .. ARGV[2]
local emoji = ARGV[3]
local previous = redis.call('HGET', KEYS[1], participantField)
if previous ~= emoji then
  if previous then
    redis.call('HINCRBY', KEYS[1], scope .. ':count:' .. previous, -1)
  else
    redis.call('HINCRBY', KEYS[1], scope .. ':total', 1)
  end
  redis.call('HINCRBY', KEYS[1], scope .. ':count:' .. emoji, 1)
  redis.call('HSET', KEYS[1], participantField, emoji)
end
redis.call('EXPIRE', KEYS[1], ARGV[4])
return 1
`;

function roundKey({ questionId, round }: ReactionScope): string {
  return `${questionId}:r${round}`;
}

function localKey(scope: ReactionScope): string {
  return `${scope.sessionId}:${roundKey(scope)}`;
}

function unavailable(cause?: unknown): TRPCError {
  return new TRPCError({
    code: 'SERVICE_UNAVAILABLE',
    message: 'Emoji-Reaktionen sind vorübergehend nicht verfügbar.',
    cause,
  });
}

export function emptyEmojiReactions(): { reactions: Record<string, number>; total: number } {
  return { reactions: Object.fromEntries(EMOJI_REACTIONS.map((emoji) => [emoji, 0])), total: 0 };
}

export async function recordSessionEmojiReaction(
  scope: ReactionScope,
  participantId: string,
  emoji: (typeof EMOJI_REACTIONS)[number],
): Promise<void> {
  if (!isSessionPubSubEnabled()) {
    const key = localKey(scope);
    const reactions = localReactions.get(key) ?? new Map();
    reactions.set(participantId, emoji);
    localReactions.set(key, reactions);
    return;
  }
  let updated: unknown;
  try {
    updated = await getRedis().eval(
      REPLACE_EMOJI_REACTION,
      2,
      buildSessionEmojiReactionsKey(scope.sessionId),
      buildSessionRuntimeDataPurgeFenceKey(scope.sessionId),
      roundKey(scope),
      participantId,
      emoji,
      SESSION_EPHEMERAL_STATE_TTL_SECONDS,
    );
  } catch (cause) {
    throw unavailable(cause);
  }
  if (updated === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
  if (updated !== 1) throw unavailable();
}

export async function readSessionEmojiReactions(
  scope: ReactionScope,
): Promise<ReturnType<typeof emptyEmojiReactions>> {
  const result = emptyEmojiReactions();
  if (!isSessionPubSubEnabled()) {
    const reactions = localReactions.get(localKey(scope));
    if (!reactions) return result;
    for (const emoji of reactions.values()) {
      if (emoji in result.reactions) result.reactions[emoji]++;
    }
    return { ...result, total: reactions.size };
  }
  try {
    const prefix = roundKey(scope);
    const [total, ...counts] = await getRedis().hmget(
      buildSessionEmojiReactionsKey(scope.sessionId),
      `${prefix}:total`,
      ...EMOJI_REACTIONS.map((emoji) => `${prefix}:count:${emoji}`),
    );
    return {
      total: Number(total),
      reactions: Object.fromEntries(EMOJI_REACTIONS.map((emoji, i) => [emoji, Number(counts[i])])),
    };
  } catch (cause) {
    throw unavailable(cause);
  }
}

export function clearLocalSessionEmojiReactions(sessionId?: string): void {
  if (sessionId === undefined) localReactions.clear();
  else {
    for (const key of localReactions.keys()) {
      if (key.startsWith(`${sessionId}:`)) localReactions.delete(key);
    }
  }
}

export function clearLocalQuestionEmojiReactions(scope: ReactionScope): void {
  localReactions.delete(localKey(scope));
}
