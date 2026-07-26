/**
 * Signierte Yjs-Share-Tokens + minimale Redis-Metadaten (ADR-0033 / W3.4).
 *
 * Token-Format: v1.<roomUuid>.<generation>.<hmacBase64url>
 * Query-Transport: ?s=<token> (nie in App-Logs ausgeben).
 */
import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { getRedis } from '../redis';

export const YJS_SHARE_TOKEN_VERSION = 1 as const;
export const YJS_SHARE_QUERY_PARAM = 's';
export const DEFAULT_YJS_SHARE_LEGACY_UUID_CUTOFF_AT = '2026-10-01T00:00:00.000Z';

const ROOM_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROTATION_CAPABILITY_RE = /^[a-f0-9]{64}$/i;
const TOKEN_RE =
  /^v1\.([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([1-9][0-9]{0,9})\.([A-Za-z0-9_-]{43})$/i;

const REDIS_KEY_PREFIX = 'yjs:share:v1:';

export type YjsShareMetadata = {
  generation: number;
  rotationCapabilityHash: string;
};

function base64Url(buffer: Buffer): string {
  return buffer.toString('base64url');
}

function getSigningKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const dedicated = env.YJS_SHARE_TOKEN_SECRET?.trim();
  if (dedicated && Buffer.byteLength(dedicated, 'utf8') >= 32) {
    return Buffer.from(dedicated, 'utf8');
  }
  const jwt = env.JWT_SECRET?.trim();
  if (jwt && Buffer.byteLength(jwt, 'utf8') >= 32) {
    return createHash('sha256').update(`yjs-share-v1:${jwt}`, 'utf8').digest();
  }
  // Dev/test fallback — production must set YJS_SHARE_TOKEN_SECRET or JWT_SECRET.
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

export async function registerYjsShare(input: {
  roomId: string;
  rotationCapability: string;
}): Promise<{ shareToken: string; generation: number; created: boolean }> {
  const roomId = normalizeYjsRoomUuid(input.roomId);
  if (!roomId) {
    throw new Error('INVALID_ROOM');
  }
  if (!isYjsRotationCapability(input.rotationCapability)) {
    throw new Error('INVALID_CAPABILITY');
  }
  const capabilityHash = hashYjsRotationCapability(input.rotationCapability);
  const existing = await readYjsShareMetadata(roomId);
  if (existing) {
    if (existing.rotationCapabilityHash !== capabilityHash) {
      throw new Error('CAPABILITY_MISMATCH');
    }
    return {
      shareToken: signYjsShareToken(roomId, existing.generation),
      generation: existing.generation,
      created: false,
    };
  }

  const redis = getRedis();
  const created = await redis.hsetnx(redisKey(roomId), 'generation', '1');
  if (created === 1) {
    await redis.hset(redisKey(roomId), 'rotationCapabilityHash', capabilityHash);
    return {
      shareToken: signYjsShareToken(roomId, 1),
      generation: 1,
      created: true,
    };
  }

  // Parallel register — re-read winner.
  const raced = await readYjsShareMetadata(roomId);
  if (!raced || raced.rotationCapabilityHash !== capabilityHash) {
    throw new Error('CAPABILITY_MISMATCH');
  }
  return {
    shareToken: signYjsShareToken(roomId, raced.generation),
    generation: raced.generation,
    created: false,
  };
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
  const existing = await readYjsShareMetadata(roomId);
  if (!existing) {
    throw new Error('NOT_REGISTERED');
  }
  if (existing.rotationCapabilityHash !== capabilityHash) {
    throw new Error('CAPABILITY_MISMATCH');
  }
  const nextGeneration = existing.generation + 1;
  const redis = getRedis();
  await redis.hset(redisKey(roomId), 'generation', String(nextGeneration));
  return {
    shareToken: signYjsShareToken(roomId, nextGeneration),
    generation: nextGeneration,
  };
}

/**
 * Prüft Upgrade-Auth: gültiges Share-Token mit aktueller Generation, oder
 * während des Grace-Fensters UUID-only ohne Query.
 */
export async function authorizeYjsRoomUpgrade(input: {
  roomId: string;
  shareToken: string | null;
  now?: Date;
  env?: NodeJS.ProcessEnv;
}): Promise<
  | { ok: true }
  | { ok: false; reason: 'legacy_cutoff' | 'token_required' | 'invalid_token' | 'stale_generation' }
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
    return { ok: true };
  }

  const verified = verifyYjsShareTokenSignature(input.shareToken, env);
  if (!verified || verified.roomId !== roomId) {
    return { ok: false, reason: 'invalid_token' };
  }

  const metadata = await readYjsShareMetadata(roomId);
  if (!metadata) {
    // Signatur gültig, aber Share nie registriert — kein Connect ohne Metadaten.
    return { ok: false, reason: 'invalid_token' };
  }
  if (verified.generation !== metadata.generation) {
    return { ok: false, reason: 'stale_generation' };
  }
  return { ok: true };
}
