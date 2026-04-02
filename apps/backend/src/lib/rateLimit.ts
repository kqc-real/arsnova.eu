/**
 * Rate-Limiting mit Redis (Story 0.5).
 * Sliding-Window; Limits über Umgebungsvariablen konfigurierbar.
 */
import { getRedis } from '../redis';

const PREFIX = 'rl:';

/** Vollständiger Redis-Schlüssel (wie `checkSlidingWindow`) — für Logs bei 429. */
export function redisKeyMotdGetCurrent(ip: string): string {
  return `${PREFIX}motd:getCurrent:${ip}`;
}
export function redisKeyMotdListArchive(ip: string): string {
  return `${PREFIX}motd:listArchive:${ip}`;
}
export function redisKeyMotdRecordInteraction(ip: string): string {
  return `${PREFIX}motd:recordInteraction:${ip}`;
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
} as const;

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
