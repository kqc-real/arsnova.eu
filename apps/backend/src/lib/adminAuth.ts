import { randomBytes, timingSafeEqual } from 'crypto';
import type { IncomingMessage } from 'http';
import { TRPCError } from '@trpc/server';
import { getRedis } from '../redis';

const ADMIN_SESSION_PREFIX = 'admin:session:';
const DEFAULT_ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8; // 8h

function getAdminSecret(): string {
  const secret = process.env['ADMIN_SECRET']?.trim();
  if (!secret) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Admin-Authentifizierung ist nicht konfiguriert.',
    });
  }
  return secret;
}

function parseTtlSeconds(): number {
  const raw = process.env['ADMIN_SESSION_TTL_SECONDS'];
  if (!raw) return DEFAULT_ADMIN_SESSION_TTL_SECONDS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 60) {
    return DEFAULT_ADMIN_SESSION_TTL_SECONDS;
  }
  return parsed;
}

export function extractAdminToken(req?: IncomingMessage): string | null {
  if (!req) return null;

  const direct = req.headers['x-admin-token'];
  if (typeof direct === 'string' && direct.trim().length > 0) {
    return direct.trim();
  }

  const authHeader = req.headers['authorization'];
  if (typeof authHeader !== 'string') return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return null;
  return match[1].trim();
}

export function verifyAdminSecret(candidateSecret: string): boolean {
  const configuredSecret = getAdminSecret();
  const configured = Buffer.from(configuredSecret, 'utf8');
  const candidate = Buffer.from(candidateSecret.trim(), 'utf8');

  if (configured.length !== candidate.length) {
    return false;
  }
  return timingSafeEqual(configured, candidate);
}

export async function createAdminSessionToken(): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const ttlSeconds = parseTtlSeconds();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  const redis = getRedis();
  await redis.set(`${ADMIN_SESSION_PREFIX}${token}`, 'admin', 'EX', ttlSeconds);

  return { token, expiresAt };
}

export async function isAdminSessionTokenValid(token: string): Promise<boolean> {
  if (!token) return false;
  const redis = getRedis();
  const value = await redis.get(`${ADMIN_SESSION_PREFIX}${token}`);
  return value === 'admin';
}

export async function invalidateAdminSessionToken(token: string): Promise<void> {
  if (!token) return;
  const redis = getRedis();
  await redis.del(`${ADMIN_SESSION_PREFIX}${token}`);
}
