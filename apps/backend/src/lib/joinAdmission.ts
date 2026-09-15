import { getRedis } from '../redis';
import { logger } from './logger';

const JOIN_ADMISSION_WINDOW_MS = 1_000;
const JOIN_ADMISSION_LIMIT_PER_WINDOW = 125;
const JOIN_ADMISSION_TTL_MS = 5_000;
const JOIN_ADMISSION_MIN_DELAY_MS = 40;
const JOIN_ADMISSION_MAX_DELAY_MS = 1_200;
const JOIN_ADMISSION_KEY_PREFIX = 'join:admission:v2:session:';

const JOIN_ADMISSION_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local ttlMs = tonumber(ARGV[4])
local state = redis.call('HMGET', key, 'tokens', 'refilledAt')
local tokens = tonumber(state[1]) or limit
local refilledAt = tonumber(state[2]) or now
local elapsedMs = math.max(0, now - refilledAt)

tokens = math.min(limit, tokens + (elapsedMs * limit / windowMs))
if tokens >= 1 then
  tokens = tokens - 1
  redis.call('HSET', key, 'tokens', tokens, 'refilledAt', now)
  redis.call('PEXPIRE', key, ttlMs)
  return {1, 0}
end

local retryAfterMs = math.ceil((1 - tokens) * windowMs / limit)
redis.call('HSET', key, 'tokens', tokens, 'refilledAt', now)
redis.call('PEXPIRE', key, ttlMs)
return {0, retryAfterMs}
`;

let warnedUnavailable = false;

function parseRedisNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function joinAdmissionKey(sessionId: string): string {
  return `${JOIN_ADMISSION_KEY_PREFIX}${sessionId}`;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryAcquireJoinAdmissionSlot(
  sessionId: string,
  nowMs: number,
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  try {
    const redis = getRedis();
    const raw = await redis.eval(
      JOIN_ADMISSION_LUA,
      1,
      joinAdmissionKey(sessionId),
      nowMs.toString(),
      JOIN_ADMISSION_WINDOW_MS.toString(),
      JOIN_ADMISSION_LIMIT_PER_WINDOW.toString(),
      JOIN_ADMISSION_TTL_MS.toString(),
    );

    const tuple = Array.isArray(raw) ? raw : [];
    return {
      allowed: parseRedisNumber(tuple[0]) === 1,
      retryAfterMs: parseRedisNumber(tuple[1]),
    };
  } catch (err) {
    if (!warnedUnavailable) {
      warnedUnavailable = true;
      logger.warn(
        'joinAdmission: Redis nicht erreichbar, Join-Wellen werden nicht aktiv geglaettet.',
        err,
      );
    }
    return { allowed: true, retryAfterMs: 0 };
  }
}

export async function awaitJoinAdmissionSlot(
  sessionId: string,
  options?: {
    now?: () => number;
    random?: () => number;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<{ delayedMs: number; attempts: number }> {
  if (!sessionId) {
    return { delayedMs: 0, attempts: 0 };
  }

  const now = options?.now ?? Date.now;
  const random = options?.random ?? Math.random;
  const wait = options?.sleep ?? sleep;

  let delayedMs = 0;
  let attempts = 0;

  while (true) {
    attempts += 1;
    const slot = await tryAcquireJoinAdmissionSlot(sessionId, now());
    if (slot.allowed) {
      return { delayedMs, attempts };
    }

    const jitterMs = Math.floor(random() * 120);
    const waitMs = Math.max(
      JOIN_ADMISSION_MIN_DELAY_MS,
      Math.min(JOIN_ADMISSION_MAX_DELAY_MS, slot.retryAfterMs + jitterMs),
    );
    delayedMs += waitMs;
    await wait(waitMs);
  }
}

export function resetJoinAdmissionWarningForTests(): void {
  warnedUnavailable = false;
}
