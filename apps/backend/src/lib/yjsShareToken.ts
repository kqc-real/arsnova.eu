/**
 * Signierte Yjs-Share-Tokens + minimale Redis-Metadaten (ADR-0033 / W3.4).
 *
 * Token-Format: v1.<roomUuid>.<generation>.<hmacBase64url>
 * Query-Transport: ?s=<token> (nie in App-/Access-Logs ausgeben).
 */
import { createHmac, createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { getRedis } from '../redis';

export const YJS_SHARE_TOKEN_VERSION = 1 as const;
export const YJS_SHARE_QUERY_PARAM = 's';
export const DEFAULT_YJS_SHARE_LEGACY_UUID_CUTOFF_AT = '2026-10-01T00:00:00.000Z';
/** Langlebige Share-Metadaten; bei Erstellung/Rotation erneuert. */
export const YJS_SHARE_METADATA_TTL_SECONDS = 63_072_000; // 730 Tage
export const YJS_SHARE_GLOBAL_KEY_HARD_CAP = 100_000;

const ROOM_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROTATION_CAPABILITY_RE = /^[a-f0-9]{64}$/i;
const TOKEN_RE =
  /^v1\.([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([1-9][0-9]{0,9})\.([A-Za-z0-9_-]{43})$/i;

const REDIS_KEY_PREFIX = 'yjs:share:v1:';
const REDIS_EXPIRY_INDEX_KEY = 'yjs:share:v1:_expires';

const CREATE_SHARE_SCRIPT = `
local key = KEYS[1]
local expiryIndexKey = KEYS[2]
local capabilityHash = ARGV[1]
local ttl = tonumber(ARGV[2])
local hardCap = tonumber(ARGV[3])
local nowMs = tonumber(ARGV[4])
local expiresAtMs = tonumber(ARGV[5])
if redis.call('EXISTS', key) == 1 then
  return {0, 'ROOM_COLLISION'}
end
redis.call('ZREMRANGEBYSCORE', expiryIndexKey, '-inf', nowMs)
if redis.call('ZCARD', expiryIndexKey) >= hardCap then
  return {0, 'GLOBAL_CAP'}
end
redis.call('HSET', key, 'generation', '1', 'rotationCapabilityHash', capabilityHash)
redis.call('EXPIRE', key, ttl)
redis.call('ZADD', expiryIndexKey, expiresAtMs, key)
return {1, 'CREATED', 1}
`;

const ROTATE_SHARE_SCRIPT = `
local key = KEYS[1]
local expiryIndexKey = KEYS[2]
local capabilityHash = ARGV[1]
local ttl = tonumber(ARGV[2])
local expiresAtMs = tonumber(ARGV[3])
if redis.call('EXISTS', key) == 0 then
  return {0, 'NOT_REGISTERED'}
end
local existingHash = redis.call('HGET', key, 'rotationCapabilityHash')
local generation = tonumber(redis.call('HGET', key, 'generation') or '0')
if existingHash == false or existingHash == nil or generation < 1 then
  return {0, 'CORRUPT'}
end
if existingHash ~= capabilityHash then
  return {0, 'CAPABILITY_MISMATCH'}
end
local nextGeneration = generation + 1
redis.call('HSET', key, 'generation', tostring(nextGeneration))
redis.call('EXPIRE', key, ttl)
redis.call('ZADD', expiryIndexKey, expiresAtMs, key)
return {1, 'OK', nextGeneration}
`;

export type YjsShareMetadata = {
  generation: number;
  rotationCapabilityHash: string;
};

export type YjsShareRotationEvent = {
  roomId: string;
  generation: number;
};

const rotationListeners = new Set<(event: YjsShareRotationEvent) => void>();

/** Prozesslokaler Bus: Router und Yjs-Relay laufen im selben Backend-Prozess. */
export function onYjsShareRotated(listener: (event: YjsShareRotationEvent) => void): () => void {
  rotationListeners.add(listener);
  return () => rotationListeners.delete(listener);
}

function notifyYjsShareRotated(event: YjsShareRotationEvent): void {
  for (const listener of rotationListeners) listener(event);
}

function base64Url(buffer: Buffer): string {
  return buffer.toString('base64url');
}

export function resolveYjsShareSigningKey(
  env: NodeJS.ProcessEnv = process.env,
): { key: Buffer; source: 'YJS_SHARE_TOKEN_SECRET' | 'JWT_SECRET' } | null {
  const dedicated = env.YJS_SHARE_TOKEN_SECRET?.trim();
  if (dedicated && Buffer.byteLength(dedicated, 'utf8') >= 32) {
    return { key: Buffer.from(dedicated, 'utf8'), source: 'YJS_SHARE_TOKEN_SECRET' };
  }
  const jwt = env.JWT_SECRET?.trim();
  if (jwt && Buffer.byteLength(jwt, 'utf8') >= 32) {
    return {
      key: createHash('sha256').update(`yjs-share-v1:${jwt}`, 'utf8').digest(),
      source: 'JWT_SECRET',
    };
  }
  return null;
}

/**
 * Produktion: ohne starkes Secret hart fehlschlagen.
 * Dev/Test: deterministischer Fallback nur wenn NODE_ENV !== production.
 */
export function assertYjsShareTokenSecretConfigured(env: NodeJS.ProcessEnv = process.env): void {
  if (resolveYjsShareSigningKey(env)) return;
  if (env.NODE_ENV === 'production') {
    throw new Error(
      'YJS_SHARE_TOKEN_SECRET oder JWT_SECRET (≥32 UTF-8-Bytes) ist in Produktion erforderlich.',
    );
  }
}

function getSigningKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const resolved = resolveYjsShareSigningKey(env);
  if (resolved) return resolved.key;
  if (env.NODE_ENV === 'production') {
    throw new Error(
      'YJS_SHARE_TOKEN_SECRET oder JWT_SECRET (≥32 UTF-8-Bytes) ist in Produktion erforderlich.',
    );
  }
  return createHash('sha256').update('yjs-share-dev-fallback-not-for-production', 'utf8').digest();
}

export function normalizeYjsRoomUuid(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  return ROOM_UUID_RE.test(trimmed) ? trimmed : null;
}

export function isYjsRotationCapability(value: string): boolean {
  return ROTATION_CAPABILITY_RE.test(value.trim());
}

export function hashYjsRotationCapability(capability: string): string {
  return createHash('sha256').update(capability.trim().toLowerCase(), 'utf8').digest('hex');
}

export function createYjsRotationCapability(): string {
  return randomBytes(32).toString('hex');
}

export function getYjsShareLegacyUuidCutoffAt(env: NodeJS.ProcessEnv = process.env): Date {
  const raw = env.YJS_SHARE_LEGACY_UUID_CUTOFF_AT?.trim();
  if (raw) {
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return new Date(parsed);
  }
  return new Date(DEFAULT_YJS_SHARE_LEGACY_UUID_CUTOFF_AT);
}

export function isYjsShareLegacyUuidCutoffReached(
  now: Date = new Date(),
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return now.getTime() >= getYjsShareLegacyUuidCutoffAt(env).getTime();
}

function signingPayload(roomId: string, generation: number): string {
  return `v1|${roomId}|${generation}`;
}

export function signYjsShareToken(
  roomId: string,
  generation: number,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const normalized = normalizeYjsRoomUuid(roomId);
  if (!normalized) {
    throw new Error('Ungültige Raum-UUID für Share-Token.');
  }
  if (!Number.isInteger(generation) || generation < 1) {
    throw new Error('Ungültige Share-Generation.');
  }
  const mac = createHmac('sha256', getSigningKey(env))
    .update(signingPayload(normalized, generation), 'utf8')
    .digest();
  return `v1.${normalized}.${generation}.${base64Url(mac)}`;
}

export function verifyYjsShareTokenSignature(
  token: string,
  env: NodeJS.ProcessEnv = process.env,
): { roomId: string; generation: number } | null {
  const match = TOKEN_RE.exec(token.trim());
  if (!match) return null;
  const roomId = match[1]!.toLowerCase();
  const generation = Number(match[2]);
  const providedMac = Buffer.from(match[3]!, 'base64url');
  if (!Number.isInteger(generation) || generation < 1 || providedMac.length !== 32) {
    return null;
  }
  const expectedMac = createHmac('sha256', getSigningKey(env))
    .update(signingPayload(roomId, generation), 'utf8')
    .digest();
  if (providedMac.length !== expectedMac.length || !timingSafeEqual(providedMac, expectedMac)) {
    return null;
  }
  return { roomId, generation };
}

function redisKey(roomId: string): string {
  return `${REDIS_KEY_PREFIX}${roomId}`;
}

export async function readYjsShareMetadata(roomId: string): Promise<YjsShareMetadata | null> {
  const normalized = normalizeYjsRoomUuid(roomId);
  if (!normalized) return null;
  const redis = getRedis();
  const raw = await redis.hgetall(redisKey(normalized));
  if (!raw || !raw.generation || !raw.rotationCapabilityHash) return null;
  const generation = Number(raw.generation);
  if (!Number.isInteger(generation) || generation < 1) return null;
  if (!/^[a-f0-9]{64}$/.test(raw.rotationCapabilityHash)) return null;
  return { generation, rotationCapabilityHash: raw.rotationCapabilityHash };
}

/**
 * Erstellt ausschließlich einen serverseitig gewählten neuen Raum. Eine alte
 * UUID kann deshalb nie per First-Writer als tokenisierter Raum übernommen werden.
 */
export async function createYjsShare(input: {
  rotationCapability: string;
}): Promise<{ roomId: string; shareToken: string; generation: number }> {
  if (!isYjsRotationCapability(input.rotationCapability)) {
    throw new Error('INVALID_CAPABILITY');
  }
  const capabilityHash = hashYjsRotationCapability(input.rotationCapability);
  const redis = getRedis();
  const nowMs = Date.now();
  const expiresAtMs = nowMs + YJS_SHARE_METADATA_TTL_SECONDS * 1000;

  // UUID-Kollisionen sind praktisch ausgeschlossen; begrenztes Retry hält den
  // Vertrag trotzdem korrekt, ohne einen existierenden Raum zu überschreiben.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const roomId = randomUUID();
    const result = (await redis.eval(
      CREATE_SHARE_SCRIPT,
      2,
      redisKey(roomId),
      REDIS_EXPIRY_INDEX_KEY,
      capabilityHash,
      String(YJS_SHARE_METADATA_TTL_SECONDS),
      String(YJS_SHARE_GLOBAL_KEY_HARD_CAP),
      String(nowMs),
      String(expiresAtMs),
    )) as [number, string, number?];

    if (result?.[0] === 1) {
      const generation = Number(result[2]);
      return {
        roomId,
        shareToken: signYjsShareToken(roomId, generation),
        generation,
      };
    }
    if (result?.[1] !== 'ROOM_COLLISION') {
      throw new Error(result?.[1] ?? 'UNKNOWN');
    }
  }
  throw new Error('ROOM_COLLISION');
}

export async function rotateYjsShare(input: {
  roomId: string;
  rotationCapability: string;
}): Promise<{ shareToken: string; generation: number }> {
  const roomId = normalizeYjsRoomUuid(input.roomId);
  if (!roomId) {
    throw new Error('INVALID_ROOM');
  }
  if (!isYjsRotationCapability(input.rotationCapability)) {
    throw new Error('INVALID_CAPABILITY');
  }
  const capabilityHash = hashYjsRotationCapability(input.rotationCapability);
  const redis = getRedis();
  const expiresAtMs = Date.now() + YJS_SHARE_METADATA_TTL_SECONDS * 1000;
  const result = (await redis.eval(
    ROTATE_SHARE_SCRIPT,
    2,
    redisKey(roomId),
    REDIS_EXPIRY_INDEX_KEY,
    capabilityHash,
    String(YJS_SHARE_METADATA_TTL_SECONDS),
    String(expiresAtMs),
  )) as [number, string, number?];

  if (!result || result[0] !== 1) {
    throw new Error(result?.[1] ?? 'UNKNOWN');
  }
  const generation = Number(result[2]);
  notifyYjsShareRotated({ roomId, generation });
  return {
    shareToken: signYjsShareToken(roomId, generation),
    generation,
  };
}

/**
 * Prüft Upgrade-Auth: gültiges Share-Token mit aktueller Generation, oder
 * während des Grace-Fensters UUID-only ohne Query. Legacy-Upgrades schreiben
 * bewusst keinerlei Redis-Zustand.
 */
export async function authorizeYjsRoomUpgrade(input: {
  roomId: string;
  shareToken: string | null;
  now?: Date;
  env?: NodeJS.ProcessEnv;
}): Promise<
  | { ok: true; generation: number | null }
  | {
      ok: false;
      reason: 'legacy_cutoff' | 'token_required' | 'invalid_token' | 'stale_generation';
    }
> {
  const env = input.env ?? process.env;
  const roomId = normalizeYjsRoomUuid(input.roomId.replace(/^quiz-library-room-/i, ''));
  if (!roomId) {
    return { ok: false, reason: 'invalid_token' };
  }

  if (!input.shareToken) {
    if (isYjsShareLegacyUuidCutoffReached(input.now, env)) {
      return { ok: false, reason: 'legacy_cutoff' };
    }
    // Bereits tokenisierte Räume akzeptieren kein UUID-only mehr.
    const metadata = await readYjsShareMetadata(roomId);
    if (metadata) {
      return { ok: false, reason: 'token_required' };
    }
    return { ok: true, generation: null };
  }

  const verified = verifyYjsShareTokenSignature(input.shareToken, env);
  if (!verified || verified.roomId !== roomId) {
    return { ok: false, reason: 'invalid_token' };
  }

  const metadata = await readYjsShareMetadata(roomId);
  if (!metadata) {
    return { ok: false, reason: 'invalid_token' };
  }
  if (verified.generation !== metadata.generation) {
    return { ok: false, reason: 'stale_generation' };
  }
  return { ok: true, generation: verified.generation };
}
