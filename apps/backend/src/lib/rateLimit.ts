/**
 * Rate-Limiting mit Redis (Story 0.5).
 * Sliding-Window; Limits über Umgebungsvariablen konfigurierbar.
 */
import { getRedis } from '../redis';
import {
  PUBLIC_CREATE_WINDOW_SECONDS,
  QUIZ_UPLOAD_ACCEPTED_GLOBAL_PER_WINDOW_DEFAULT,
  QUIZ_UPLOAD_ACCEPTED_PER_IP_PER_WINDOW_DEFAULT,
  QUIZ_UPLOAD_ATTEMPT_GLOBAL_PER_WINDOW_DEFAULT,
  QUIZ_UPLOAD_ATTEMPT_PER_IP_PER_WINDOW_DEFAULT,
  QUIZ_UPLOAD_GLOBAL_BYTES_PER_WINDOW_DEFAULT,
  QUIZ_UPLOAD_GLOBAL_COMPLEXITY_PER_WINDOW_DEFAULT,
} from './publicCreateCapacity';

const PREFIX = 'rl:';

function positiveIntegerEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function boundedPositiveIntegerEnv(name: string, fallback: number, maximum: number): number {
  return Math.min(positiveIntegerEnv(name, fallback), maximum);
}

export const RATE_LIMIT_ENV = {
  sessionCodeAttempts: Number(process.env['RATE_LIMIT_SESSION_CODE_ATTEMPTS']) || 5,
  sessionCodeWindowMinutes: Number(process.env['RATE_LIMIT_SESSION_CODE_WINDOW_MINUTES']) || 5,
  sessionCodeLockoutSeconds: Number(process.env['RATE_LIMIT_SESSION_CODE_LOCKOUT_SECONDS']) || 60,
  voteRequestsPerSecond: Number(process.env['RATE_LIMIT_VOTE_REQUESTS_PER_SECOND']) || 1,
  sessionCreatePerHour: Number(process.env['RATE_LIMIT_SESSION_CREATE_PER_HOUR']) || 10,
  /** MOTD öffentliche API (Epic 10): Anfragen pro IP pro Minute (`getCurrent` + `getHeaderState` teilen sich das Limit) */
  motdGetCurrentPerMinute: Number(process.env['RATE_LIMIT_MOTD_GET_CURRENT_PER_MINUTE']) || 600,
  motdListArchivePerMinute: Number(process.env['RATE_LIMIT_MOTD_LIST_ARCHIVE_PER_MINUTE']) || 60,
  motdRecordInteractionPerMinute:
    Number(process.env['RATE_LIMIT_MOTD_RECORD_INTERACTION_PER_MINUTE']) || 40,
  quizUploadAttemptPerIpPerHour: boundedPositiveIntegerEnv(
    'RATE_LIMIT_QUIZ_UPLOAD_ATTEMPT_PER_IP_PER_HOUR',
    QUIZ_UPLOAD_ATTEMPT_PER_IP_PER_WINDOW_DEFAULT,
    QUIZ_UPLOAD_ATTEMPT_PER_IP_PER_WINDOW_DEFAULT,
  ),
  quizUploadAttemptGlobalPerHour: boundedPositiveIntegerEnv(
    'RATE_LIMIT_QUIZ_UPLOAD_ATTEMPT_GLOBAL_PER_HOUR',
    QUIZ_UPLOAD_ATTEMPT_GLOBAL_PER_WINDOW_DEFAULT,
    QUIZ_UPLOAD_ATTEMPT_GLOBAL_PER_WINDOW_DEFAULT,
  ),
  quizUploadPerIpPerHour: boundedPositiveIntegerEnv(
    'RATE_LIMIT_QUIZ_UPLOAD_PER_IP_PER_HOUR',
    QUIZ_UPLOAD_ACCEPTED_PER_IP_PER_WINDOW_DEFAULT,
    QUIZ_UPLOAD_ACCEPTED_PER_IP_PER_WINDOW_DEFAULT,
  ),
  quizUploadGlobalPerHour: boundedPositiveIntegerEnv(
    'RATE_LIMIT_QUIZ_UPLOAD_GLOBAL_PER_HOUR',
    QUIZ_UPLOAD_ACCEPTED_GLOBAL_PER_WINDOW_DEFAULT,
    QUIZ_UPLOAD_ACCEPTED_GLOBAL_PER_WINDOW_DEFAULT,
  ),
  quizUploadGlobalBytesPerHour: boundedPositiveIntegerEnv(
    'RATE_LIMIT_QUIZ_UPLOAD_GLOBAL_BYTES_PER_HOUR',
    QUIZ_UPLOAD_GLOBAL_BYTES_PER_WINDOW_DEFAULT,
    QUIZ_UPLOAD_GLOBAL_BYTES_PER_WINDOW_DEFAULT,
  ),
  quizUploadGlobalComplexityPerHour: boundedPositiveIntegerEnv(
    'RATE_LIMIT_QUIZ_UPLOAD_GLOBAL_COMPLEXITY_PER_HOUR',
    QUIZ_UPLOAD_GLOBAL_COMPLEXITY_PER_WINDOW_DEFAULT,
    QUIZ_UPLOAD_GLOBAL_COMPLEXITY_PER_WINDOW_DEFAULT,
  ),
  quickFeedbackStandalonePerIpPerHour: positiveIntegerEnv(
    'RATE_LIMIT_QUICK_FEEDBACK_STANDALONE_PER_IP_PER_HOUR',
    600,
  ),
  quickFeedbackStandaloneGlobalPerHour: positiveIntegerEnv(
    'RATE_LIMIT_QUICK_FEEDBACK_STANDALONE_GLOBAL_PER_HOUR',
    3000,
  ),
  quickFeedbackSessionPerMinute: positiveIntegerEnv(
    'RATE_LIMIT_QUICK_FEEDBACK_SESSION_PER_MINUTE',
    120,
  ),
} as const;

const FIXED_WINDOW_BUDGET_SCRIPT = `
local keyCount = #KEYS
local windowSeconds = tonumber(ARGV[(keyCount * 2) + 1])

for index = 1, keyCount do
  local current = tonumber(redis.call('GET', KEYS[index])) or 0
  local limit = tonumber(ARGV[(index * 2) - 1])
  local cost = tonumber(ARGV[index * 2])
  if current + cost > limit then
    local ttl = redis.call('TTL', KEYS[index])
    if ttl < 1 then
      ttl = windowSeconds
    end
    return { 0, index, ttl }
  end
end

local minimumRemaining = nil
for index = 1, keyCount do
  local limit = tonumber(ARGV[(index * 2) - 1])
  local cost = tonumber(ARGV[index * 2])
  local previous = tonumber(redis.call('GET', KEYS[index])) or 0
  local count = redis.call('INCRBY', KEYS[index], cost)
  if previous == 0 then
    redis.call('EXPIRE', KEYS[index], windowSeconds)
  end
  local remaining = limit - count
  if minimumRemaining == nil or remaining < minimumRemaining then
    minimumRemaining = remaining
  end
end

return { 1, minimumRemaining or 0, 0 }
`;

type FixedWindowBudget = { key: string; limit: number; cost?: number };

/**
 * Prüft mehrere feste Budgets atomar. Erst wenn alle Budgets frei sind,
 * werden alle Zähler erhöht. Das verhindert TOCTOU-Bypässe und erzeugt bei
 * ausgeschöpftem Globalbudget keine weiteren angreiferkontrollierten IP-Keys.
 */
export async function checkFixedWindowBudgets(
  budgets: readonly FixedWindowBudget[],
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds?: number }> {
  if (budgets.length === 0) {
    return { allowed: true, remaining: 0 };
  }
  if (
    budgets.some(
      (budget) =>
        !Number.isSafeInteger(budget.limit) ||
        budget.limit <= 0 ||
        !Number.isSafeInteger(budget.cost ?? 1) ||
        (budget.cost ?? 1) <= 0,
    )
  ) {
    throw new Error('Ungültiges Public-Create-Budget.');
  }

  const redis = getRedis();
  const result = (await redis.eval(
    FIXED_WINDOW_BUDGET_SCRIPT,
    budgets.length,
    ...budgets.map((budget) => `${PREFIX}${budget.key}`),
    ...budgets.flatMap((budget) => [String(budget.limit), String(budget.cost ?? 1)]),
    String(windowSeconds),
  )) as unknown;
  if (!Array.isArray(result) || result.length < 3) {
    throw new Error('Unerwartete Redis-Antwort beim Public-Create-Rate-Limit.');
  }

  const allowed = Number(result[0]) === 1;
  if (allowed) {
    return { allowed: true, remaining: Math.max(0, Number(result[1]) || 0) };
  }
  return {
    allowed: false,
    remaining: 0,
    retryAfterSeconds: Math.max(1, Number(result[2]) || windowSeconds),
  };
}

function isLoopbackIp(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost';
}

/**
 * Lokaler Dev-Bypass für Session-Erstellung:
 * Auf localhost darf das Limit in Nicht-Produktionsumgebungen standardmäßig übersprungen werden.
 * Über RATE_LIMIT_SESSION_CREATE_BYPASS_LOCALHOST=true|false kann das Verhalten explizit gesetzt werden.
 */
export function shouldBypassSessionCreateRate(ip: string): boolean {
  const override = process.env['RATE_LIMIT_SESSION_CREATE_BYPASS_LOCALHOST'];
  if (override === 'true') {
    return isLoopbackIp(ip);
  }
  if (override === 'false') {
    return false;
  }
  return process.env['NODE_ENV'] !== 'production' && isLoopbackIp(ip);
}

/**
 * MOTD `getCurrent` / `getHeaderState`: gleicher Bypass wie Session-Create (Prerender/Dev von 127.0.0.1
 * sonst schnell 429 trotz „keiner Last“ — viele Anfragen teilen eine Loopback-IP).
 * `RATE_LIMIT_MOTD_GET_CURRENT_BYPASS_LOCALHOST=true|false` überschreibt.
 */
export function shouldBypassMotdGetCurrentRate(ip: string): boolean {
  const override = process.env['RATE_LIMIT_MOTD_GET_CURRENT_BYPASS_LOCALHOST'];
  if (override === 'true') {
    return isLoopbackIp(ip);
  }
  if (override === 'false') {
    return false;
  }
  return process.env['NODE_ENV'] !== 'production' && isLoopbackIp(ip);
}

/**
 * Prüft Sliding-Window für einen Key: Anzahl Aufrufe in den letzten windowSeconds Sekunden.
 * Gibt { allowed, remaining, retryAfterSeconds } zurück.
 * Bei Lockout: keyLockout wird gesetzt (z. B. "lockout:sessioncode:ip").
 */
export async function checkSlidingWindow(
  key: string,
  limit: number,
  windowSeconds: number,
  lockoutKey?: string,
  lockoutSeconds?: number,
): Promise<{
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
}> {
  const redis = getRedis();
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  const redisKey = `${PREFIX}${key}`;

  if (lockoutKey && lockoutSeconds) {
    const locked = await redis.get(`${PREFIX}lockout:${lockoutKey}`);
    if (locked === '1') {
      const ttl = await redis.ttl(`${PREFIX}lockout:${lockoutKey}`);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: ttl > 0 ? ttl : lockoutSeconds,
      };
    }
  }

  await redis.zremrangebyscore(redisKey, 0, windowStart);
  const count = await redis.zcard(redisKey);

  if (count >= limit) {
    if (lockoutKey && lockoutSeconds) {
      await redis.setex(`${PREFIX}lockout:${lockoutKey}`, lockoutSeconds, '1');
    }
    const oldest = await redis.zrange(redisKey, 0, 0, 'WITHSCORES');
    const retryAfter = oldest.length
      ? Math.ceil((Number(oldest[1]) + windowSeconds * 1000 - now) / 1000)
      : windowSeconds;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, retryAfter),
    };
  }

  await redis.zadd(redisKey, now, `${now}:${Math.random()}`);
  await redis.expire(redisKey, windowSeconds + 1);

  return {
    allowed: true,
    remaining: limit - count - 1,
  };
}

/**
 * Prüft, ob IP nach zu vielen Fehlversuchen gesperrt ist (Story 0.5).
 */
export async function isSessionCodeLockedOut(ip: string): Promise<{
  locked: boolean;
  retryAfterSeconds?: number;
}> {
  const redis = getRedis();
  const locked = await redis.get(`${PREFIX}lockout:${ip}`);
  if (locked !== '1') return { locked: false };
  const ttl = await redis.ttl(`${PREFIX}lockout:${ip}`);
  return {
    locked: true,
    retryAfterSeconds: ttl > 0 ? ttl : RATE_LIMIT_ENV.sessionCodeLockoutSeconds,
  };
}

/**
 * Zeichnet einen Fehlversuch beim Session-Code auf; setzt Lockout bei Überschreitung (Story 0.5).
 * Nur aufrufen, wenn der eingegebene Code ungültig war.
 */
export async function recordFailedSessionCodeAttempt(ip: string): Promise<{
  locked: boolean;
  retryAfterSeconds?: number;
}> {
  const result = await checkSlidingWindow(
    `sessioncode:${ip}`,
    RATE_LIMIT_ENV.sessionCodeAttempts,
    RATE_LIMIT_ENV.sessionCodeWindowMinutes * 60,
    ip,
    RATE_LIMIT_ENV.sessionCodeLockoutSeconds,
  );
  return {
    locked: !result.allowed,
    retryAfterSeconds: result.retryAfterSeconds,
  };
}

/**
 * Session-Code-Eingabe (Story 3.1): Prüft Lockout vor Versuch.
 */
export async function checkSessionCodeAttempt(ip: string): Promise<{
  allowed: boolean;
  retryAfterSeconds?: number;
}> {
  const { locked, retryAfterSeconds } = await isSessionCodeLockedOut(ip);
  if (locked) return { allowed: false, retryAfterSeconds };
  return { allowed: true };
}

/**
 * Vote-Submit (Story 3.3b): 1 Request/Sekunde pro Participant (Token-Bucket-ähnlich).
 */
export async function checkVoteRate(participantId: string): Promise<{
  allowed: boolean;
  retryAfterSeconds?: number;
}> {
  const { allowed, retryAfterSeconds } = await checkSlidingWindow(
    `vote:${participantId}`,
    RATE_LIMIT_ENV.voteRequestsPerSecond,
    1,
  );
  return { allowed, retryAfterSeconds };
}

/**
 * Session-Erstellung (Story 2.1a): 10 Sessions pro IP pro Stunde.
 */
export async function checkSessionCreateRate(ip: string): Promise<{
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
}> {
  return checkSlidingWindow(`sessioncreate:${ip}`, RATE_LIMIT_ENV.sessionCreatePerHour, 3600);
}

export async function checkQuizUploadAttemptRate(ip: string) {
  return checkFixedWindowBudgets(
    [
      {
        key: 'quizUpload:attempt:global',
        limit: RATE_LIMIT_ENV.quizUploadAttemptGlobalPerHour,
      },
      {
        key: `quizUpload:attempt:ip:${ip}`,
        limit: RATE_LIMIT_ENV.quizUploadAttemptPerIpPerHour,
      },
    ],
    PUBLIC_CREATE_WINDOW_SECONDS,
  );
}

export async function checkQuizUploadStorageRate(
  ip: string,
  weight: { payloadBytes: number; complexity: number },
) {
  return checkFixedWindowBudgets(
    [
      { key: 'quizUpload:accepted:global', limit: RATE_LIMIT_ENV.quizUploadGlobalPerHour },
      { key: `quizUpload:accepted:ip:${ip}`, limit: RATE_LIMIT_ENV.quizUploadPerIpPerHour },
      {
        key: 'quizUpload:accepted:bytes:global',
        limit: RATE_LIMIT_ENV.quizUploadGlobalBytesPerHour,
        cost: weight.payloadBytes,
      },
      {
        key: 'quizUpload:accepted:complexity:global',
        limit: RATE_LIMIT_ENV.quizUploadGlobalComplexityPerHour,
        cost: weight.complexity,
      },
    ],
    PUBLIC_CREATE_WINDOW_SECONDS,
  );
}

export async function checkQuickFeedbackStandaloneCreateRate(ip: string) {
  return checkFixedWindowBudgets(
    [
      {
        key: 'quickFeedback:standalone:global',
        limit: RATE_LIMIT_ENV.quickFeedbackStandaloneGlobalPerHour,
      },
      {
        key: `quickFeedback:standalone:ip:${ip}`,
        limit: RATE_LIMIT_ENV.quickFeedbackStandalonePerIpPerHour,
      },
    ],
    3600,
  );
}

export async function checkQuickFeedbackSessionCreateRate(sessionCode: string) {
  return checkFixedWindowBudgets(
    [
      {
        key: `quickFeedback:session:${sessionCode.toUpperCase()}`,
        limit: RATE_LIMIT_ENV.quickFeedbackSessionPerMinute,
      },
    ],
    60,
  );
}

export async function checkMotdGetCurrentRate(ip: string) {
  return checkSlidingWindow(`motd:getCurrent:${ip}`, RATE_LIMIT_ENV.motdGetCurrentPerMinute, 60);
}

export async function checkMotdListArchiveRate(ip: string) {
  return checkSlidingWindow(`motd:listArchive:${ip}`, RATE_LIMIT_ENV.motdListArchivePerMinute, 60);
}

export async function checkMotdRecordInteractionRate(ip: string) {
  return checkSlidingWindow(
    `motd:recordInteraction:${ip}`,
    RATE_LIMIT_ENV.motdRecordInteractionPerMinute,
    60,
  );
}
