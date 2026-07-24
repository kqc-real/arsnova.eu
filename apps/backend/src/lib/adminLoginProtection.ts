import { TRPCError } from '@trpc/server';
import { getRedis } from '../redis';

const KEY_PREFIX = 'security:admin-login:';

function boundedPositiveIntegerEnv(name: string, fallback: number, maximum: number): number {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? Math.min(value, maximum) : fallback;
}

const configuredDelayMaxMs = boundedPositiveIntegerEnv(
  'RATE_LIMIT_ADMIN_LOGIN_DELAY_MAX_MS',
  2_000,
  5_000,
);

export const ADMIN_LOGIN_PROTECTION_LIMITS = {
  windowSeconds: boundedPositiveIntegerEnv('RATE_LIMIT_ADMIN_LOGIN_WINDOW_SECONDS', 60, 3_600),
  globalFailuresPerWindow: boundedPositiveIntegerEnv(
    'RATE_LIMIT_ADMIN_LOGIN_GLOBAL_FAILURES_PER_WINDOW',
    60,
    1_000,
  ),
  delayBaseMs: Math.min(
    boundedPositiveIntegerEnv('RATE_LIMIT_ADMIN_LOGIN_DELAY_BASE_MS', 100, 1_000),
    configuredDelayMaxMs,
  ),
  delayMaxMs: configuredDelayMaxMs,
  maxConcurrentDelays: boundedPositiveIntegerEnv(
    'RATE_LIMIT_ADMIN_LOGIN_MAX_CONCURRENT_DELAYS',
    25,
    200,
  ),
} as const;

const ADMIN_LOGIN_FAILURE_LUA = `
local key = KEYS[1]
local failureLimit = tonumber(ARGV[1])
local windowSeconds = tonumber(ARGV[2])
local delayBaseMs = tonumber(ARGV[3])
local delayMaxMs = tonumber(ARGV[4])

local current = tonumber(redis.call('GET', key)) or 0
if current >= failureLimit then
  local retryAfter = redis.call('TTL', key)
  if retryAfter < 1 then retryAfter = windowSeconds end
  return { 0, 0, retryAfter }
end

local count = redis.call('INCR', key)
if count == 1 then redis.call('EXPIRE', key, windowSeconds) end

local exponent = math.min(count - 1, 16)
local delayMs = math.min(delayMaxMs, math.floor(delayBaseMs * (2 ^ exponent)))
return { 1, delayMs, 0 }
`;

export type AdminLoginFailureDecision = {
  allowed: boolean;
  delayMs: number;
  retryAfterSeconds?: number;
};

function parseRedisNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export async function checkAdminLoginFailure(): Promise<AdminLoginFailureDecision> {
  const limits = ADMIN_LOGIN_PROTECTION_LIMITS;
  const raw = await getRedis().eval(
    ADMIN_LOGIN_FAILURE_LUA,
    1,
    `${KEY_PREFIX}global-failures`,
    String(limits.globalFailuresPerWindow),
    String(limits.windowSeconds),
    String(limits.delayBaseMs),
    String(limits.delayMaxMs),
  );
  if (!Array.isArray(raw) || raw.length < 3) {
    throw new Error('Unerwartete Redis-Antwort beim Admin-Login-Schutz.');
  }

  const allowed = parseRedisNumber(raw[0]) === 1;
  if (!allowed) {
    return {
      allowed: false,
      delayMs: 0,
      retryAfterSeconds: Math.max(
        1,
        parseRedisNumber(raw[2]) || ADMIN_LOGIN_PROTECTION_LIMITS.windowSeconds,
      ),
    };
  }
  return {
    allowed: true,
    delayMs: Math.min(limits.delayMaxMs, Math.max(0, parseRedisNumber(raw[1]))),
  };
}

let activeDelayedRequests = 0;

export async function waitForInvalidAdminLoginDelay(delayMs: number): Promise<boolean> {
  if (delayMs <= 0) return true;
  if (activeDelayedRequests >= ADMIN_LOGIN_PROTECTION_LIMITS.maxConcurrentDelays) return false;

  activeDelayedRequests += 1;
  try {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return true;
  } finally {
    activeDelayedRequests -= 1;
  }
}

export async function rejectInvalidAdminLogin(): Promise<never> {
  const decision = await checkAdminLoginFailure();
  if (!decision.allowed) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Zu viele fehlgeschlagene Admin-Logins. Bitte später erneut versuchen.',
      cause: { retryAfterSeconds: decision.retryAfterSeconds },
    });
  }

  const delayed = await waitForInvalidAdminLoginDelay(decision.delayMs);
  if (!delayed) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Zu viele gleichzeitige Admin-Login-Versuche.',
      cause: { retryAfterSeconds: 1 },
    });
  }

  throw new TRPCError({
    code: 'UNAUTHORIZED',
    message: 'Ungültige Admin-Zugangsdaten.',
  });
}

export function resetAdminLoginProtectionForTests(): void {
  activeDelayedRequests = 0;
}
