import { createHash } from 'node:crypto';
import { getRedis } from '../redis';
import { logger } from './logger';

const KEY_PREFIX = 'security:session-code:';
const SOFT_CAP_START_PERCENT = 80;

function boundedPositiveIntegerEnv(name: string, maximum: number): number {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? Math.min(value, maximum) : maximum;
}

const configuredDelayMaxMs = boundedPositiveIntegerEnv(
  'RATE_LIMIT_SESSION_CODE_DELAY_MAX_MS',
  1_500,
);

export const SESSION_CODE_PROTECTION_LIMITS = {
  windowSeconds: boundedPositiveIntegerEnv('RATE_LIMIT_SESSION_CODE_WINDOW_SECONDS', 300),
  clientFailuresPerWindow: boundedPositiveIntegerEnv(
    'RATE_LIMIT_SESSION_CODE_CLIENT_FAILURES_PER_WINDOW',
    20,
  ),
  codeSoftCapPerWindow: boundedPositiveIntegerEnv(
    'RATE_LIMIT_SESSION_CODE_CODE_SOFT_CAP_PER_WINDOW',
    600,
  ),
  globalSoftCapPerWindow: boundedPositiveIntegerEnv(
    'RATE_LIMIT_SESSION_CODE_GLOBAL_SOFT_CAP_PER_WINDOW',
    5_000,
  ),
  delayBaseMs: Math.min(
    boundedPositiveIntegerEnv('RATE_LIMIT_SESSION_CODE_DELAY_BASE_MS', 100),
    configuredDelayMaxMs,
  ),
  delayMaxMs: configuredDelayMaxMs,
} as const;

const SESSION_CODE_FAILURE_LUA = `
local globalKey = KEYS[1]
local clientKey = KEYS[2]
local codeKey = KEYS[3]
local clientLimit = tonumber(ARGV[1])
local codeSoftCap = tonumber(ARGV[2])
local globalSoftCap = tonumber(ARGV[3])
local windowSeconds = tonumber(ARGV[4])
local delayBaseMs = tonumber(ARGV[5])
local delayMaxMs = tonumber(ARGV[6])
local softCapStartPercent = tonumber(ARGV[7])
local hasClientId = ARGV[8] == '1'

local globalCount = tonumber(redis.call('GET', globalKey)) or 0
local clientCount = 0

if hasClientId then
  clientCount = tonumber(redis.call('GET', clientKey)) or 0
  if clientCount >= clientLimit then
    local retryAfter = redis.call('TTL', clientKey)
    if retryAfter < 1 then retryAfter = windowSeconds end
    local utilization = math.min(100, math.floor((globalCount * 100) / globalSoftCap))
    return {0, 0, utilization, retryAfter}
  end
end

-- Sobald das globale Budget voll ist, werden keine angreiferkontrollierten
-- Client-/Code-Keys mehr erzeugt. Der ungültige Request erhält nur den
-- maximalen Soft-Cap-Delay; gültige Joins rufen dieses Skript nie auf.
if globalCount >= globalSoftCap then
  return {1, delayMaxMs, 100, 0}
end

local codeCount = tonumber(redis.call('GET', codeKey)) or 0
globalCount = redis.call('INCR', globalKey)
if hasClientId then clientCount = redis.call('INCR', clientKey) end
codeCount = redis.call('INCR', codeKey)

if globalCount == 1 then redis.call('EXPIRE', globalKey, windowSeconds) end
if hasClientId and clientCount == 1 then redis.call('EXPIRE', clientKey, windowSeconds) end
if codeCount == 1 then redis.call('EXPIRE', codeKey, windowSeconds) end

local globalUtilization = math.min(100, math.floor((globalCount * 100) / globalSoftCap))
local codeUtilization = math.min(100, math.floor((codeCount * 100) / codeSoftCap))
local pressure = math.max(globalUtilization, codeUtilization)
local delayMs = 0
if pressure >= softCapStartPercent then
  local range = math.max(1, 100 - softCapStartPercent)
  local progress = math.min(range, pressure - softCapStartPercent)
  delayMs = math.floor(delayBaseMs + ((delayMaxMs - delayBaseMs) * progress / range))
end

return {1, math.max(0, math.min(delayMaxMs, delayMs)), globalUtilization, 0}
`;

export type SessionCodeFailureDecision = {
  allowed: boolean;
  delayMs: number;
  globalUtilizationPercent: number;
  retryAfterSeconds?: number;
};

function stableHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function parseRedisNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function globalKey(): string {
  return `${KEY_PREFIX}global`;
}

export async function checkInvalidSessionCodeFailure(
  anonymousClientId: string | undefined,
  normalizedCode: string,
): Promise<SessionCodeFailureDecision> {
  const limits = SESSION_CODE_PROTECTION_LIMITS;
  const hasClientId = anonymousClientId !== undefined;
  const raw = await getRedis().eval(
    SESSION_CODE_FAILURE_LUA,
    3,
    globalKey(),
    hasClientId
      ? `${KEY_PREFIX}client:${stableHash(anonymousClientId)}`
      : `${KEY_PREFIX}client:legacy-compat`,
    `${KEY_PREFIX}code:${stableHash(normalizedCode)}`,
    String(limits.clientFailuresPerWindow),
    String(limits.codeSoftCapPerWindow),
    String(limits.globalSoftCapPerWindow),
    String(limits.windowSeconds),
    String(limits.delayBaseMs),
    String(limits.delayMaxMs),
    String(SOFT_CAP_START_PERCENT),
    hasClientId ? '1' : '0',
  );
  if (!Array.isArray(raw) || raw.length < 4) {
    throw new Error('Unerwartete Redis-Antwort beim Session-Code-Schutz.');
  }

  const allowed = parseRedisNumber(raw[0]) === 1;
  return {
    allowed,
    delayMs: allowed ? Math.min(limits.delayMaxMs, Math.max(0, parseRedisNumber(raw[1]))) : 0,
    globalUtilizationPercent: Math.min(100, Math.max(0, parseRedisNumber(raw[2]))),
    ...(allowed
      ? {}
      : {
          retryAfterSeconds: Math.max(
            1,
            parseRedisNumber(raw[3]) || SESSION_CODE_PROTECTION_LIMITS.windowSeconds,
          ),
        }),
  };
}

let utilizationReadWarned = false;

export async function readSessionCodeGlobalSoftCapUtilization(): Promise<number> {
  try {
    const current = parseRedisNumber(await getRedis().get(globalKey()));
    return Math.min(
      100,
      Math.max(
        0,
        Math.floor((current * 100) / SESSION_CODE_PROTECTION_LIMITS.globalSoftCapPerWindow),
      ),
    );
  } catch (error) {
    if (!utilizationReadWarned) {
      utilizationReadWarned = true;
      logger.warn('sessionCodeProtection.read: Redis nicht erreichbar, Auslastung wird 0.', error);
    }
    return 0;
  }
}

export function resetSessionCodeProtectionForTests(): void {
  utilizationReadWarned = false;
}
