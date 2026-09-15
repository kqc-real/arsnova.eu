import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import type { IncomingMessage } from 'http';
import { TRPCError } from '@trpc/server';
import { SESSION_POST_PROCESSING_HOURS, type HostSessionRole } from '@arsnova/shared-types';
import { prisma } from '../db';
import { getRedis } from '../redis';
import { findPairedHostByToken } from './hostPairing';
import { hashCapability } from './capabilityCrypto';

const HOST_SESSION_PREFIX = 'host:session:';
const HOST_ACCESS_TOKEN_PREFIX = 'host:access:v2:';
const DEFAULT_HOST_SESSION_TTL_SECONDS = 15 * 60;

function normalizeSessionCode(sessionCode: string): string {
  return sessionCode.trim().toUpperCase();
}

function parseTtlSeconds(): number {
  const raw = process.env['HOST_SESSION_TTL_SECONDS'];
  if (!raw) return DEFAULT_HOST_SESSION_TTL_SECONDS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 60) {
    return DEFAULT_HOST_SESSION_TTL_SECONDS;
  }
  return parsed;
}

function buildHostSessionKey(sessionCode: string): string {
  return `${HOST_SESSION_PREFIX}${normalizeSessionCode(sessionCode)}`;
}

function buildHostAccessTokenKey(tokenHash: string): string {
  return `${HOST_ACCESS_TOKEN_PREFIX}${tokenHash}`;
}

export function hashHostSessionToken(token: string): string {
  return createHash('sha256').update(token.trim(), 'utf8').digest('hex');
}

export type HostSessionAccess = {
  token: string;
  role: HostSessionRole;
  tokenId?: string;
};

type StoredHostAccessToken = {
  sessionCode: string;
  credentialVersion: number;
  expiresAt: string;
};

export type IssuedHostAccessToken = {
  token: string;
  expiresAt: string;
};

export function extractHostToken(req?: IncomingMessage): string | null {
  if (!req) return null;

  const direct = req.headers['x-host-token'];
  if (typeof direct === 'string' && direct.trim().length > 0) {
    return direct.trim();
  }

  const authHeader = req.headers['authorization'];
  if (typeof authHeader !== 'string') return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return null;
  return match[1].trim();
}

function readConnectionParam(connectionParams: unknown, key: string): string | null {
  if (!connectionParams || typeof connectionParams !== 'object') {
    return null;
  }

  const raw = (connectionParams as Record<string, unknown>)[key];
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }

  return raw.trim();
}

export function extractHostTokenFromConnectionParams(connectionParams: unknown): string | null {
  const direct = readConnectionParam(connectionParams, 'x-host-token');
  if (direct) {
    return direct;
  }

  const authorization = readConnectionParam(connectionParams, 'authorization');
  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    return null;
  }

  return match[1].trim();
}

/** Kontext für Host-Token (HTTP-Upgrade und/oder tRPC-WS-connectionParams). */
export type HostTokenContext = {
  hostToken?: string;
  req?: IncomingMessage;
  connectionParams?: unknown;
};

export function extractHostTokenFromContext(ctx: HostTokenContext): string | null {
  if (typeof ctx.hostToken === 'string' && ctx.hostToken.trim().length > 0) {
    return ctx.hostToken.trim();
  }

  return extractHostToken(ctx.req) ?? extractHostTokenFromConnectionParams(ctx.connectionParams);
}

export async function createHostSessionToken(sessionCode: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const ttlSeconds = parseTtlSeconds();
  const redis = getRedis();
  await redis.set(buildHostSessionKey(sessionCode), hashHostSessionToken(token), 'EX', ttlSeconds);
  return token;
}

export async function createCredentialBoundHostToken(params: {
  sessionCode: string;
  credentialVersion: number;
}): Promise<IssuedHostAccessToken> {
  const code = normalizeSessionCode(params.sessionCode);
  const session = await prisma.session.findUnique({
    where: { code },
    select: {
      hostCredentialVersion: true,
      status: true,
      endedAt: true,
      expiresAt: true,
    },
  });
  const activeCredential =
    session && session.hostCredentialVersion === params.credentialVersion
      ? await prisma.hostCredential.findFirst({
          where: {
            session: { code },
            generation: params.credentialVersion,
            status: 'ACTIVE',
          },
          select: { id: true },
        })
      : null;
  if (!session || !activeCredential) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Host-Zugang ungültig oder abgelaufen.',
    });
  }
  const now = new Date();
  const canonicalEnd = session.endedAt ?? session.expiresAt;
  const accessBoundary = new Date(
    canonicalEnd.getTime() + SESSION_POST_PROCESSING_HOURS * 60 * 60 * 1000,
  );
  if (accessBoundary <= now) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Host-Zugang ungültig oder abgelaufen.',
    });
  }
  const expiresAt = new Date(
    Math.min(now.getTime() + parseTtlSeconds() * 1000, accessBoundary.getTime()),
  );
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashHostSessionToken(token);
  const ttlSeconds = Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000));
  const redis = getRedis();
  await Promise.all([
    redis.set(
      buildHostAccessTokenKey(tokenHash),
      JSON.stringify({
        sessionCode: code,
        credentialVersion: params.credentialVersion,
        expiresAt: expiresAt.toISOString(),
      } satisfies StoredHostAccessToken),
      'EX',
      ttlSeconds,
    ),
    // Rolling-/Rollback-Bridge für Images vor dem Credential-Modell.
    redis.set(buildHostSessionKey(code), tokenHash, 'EX', ttlSeconds),
  ]);
  return { token, expiresAt: expiresAt.toISOString() };
}

async function resolveCredentialBoundHostToken(
  sessionCode: string,
  token: string,
): Promise<HostSessionAccess | null> {
  const raw = await getRedis().get(buildHostAccessTokenKey(hashHostSessionToken(token)));
  if (!raw) return null;
  let stored: StoredHostAccessToken;
  try {
    stored = JSON.parse(raw) as StoredHostAccessToken;
  } catch {
    return null;
  }
  const code = normalizeSessionCode(sessionCode);
  if (
    stored.sessionCode !== code ||
    !Number.isInteger(stored.credentialVersion) ||
    Date.parse(stored.expiresAt) <= Date.now()
  ) {
    return null;
  }
  const credential = await prisma.hostCredential.findFirst({
    where: {
      session: {
        code,
        hostCredentialVersion: stored.credentialVersion,
      },
      generation: stored.credentialVersion,
      status: 'ACTIVE',
    },
    select: { id: true },
  });
  return credential ? { token, role: 'ORIGINAL_HOST' } : null;
}

async function isOriginalHostTokenHashValid(sessionCode: string, token: string): Promise<boolean> {
  if (!token) return false;

  const redis = getRedis();
  const storedHash = await redis.get(buildHostSessionKey(sessionCode));
  if (!storedHash) return false;
  const session = await prisma.session.findUnique({
    where: { code: normalizeSessionCode(sessionCode) },
    select: { hostCredentialVersion: true },
  });
  if (!session || (session.hostCredentialVersion ?? 0) !== 0) {
    return false;
  }

  const configured = Buffer.from(storedHash, 'utf8');
  const candidate = Buffer.from(hashHostSessionToken(token), 'utf8');
  if (configured.length !== candidate.length) {
    return false;
  }
  return timingSafeEqual(configured, candidate);
}

export async function resolveHostSessionAccess(
  sessionCode: string,
  token: string,
): Promise<HostSessionAccess | null> {
  if (!token) return null;
  const credentialBound = await resolveCredentialBoundHostToken(sessionCode, token);
  if (credentialBound) {
    return credentialBound;
  }
  if (await isOriginalHostTokenHashValid(sessionCode, token)) {
    return { token, role: 'ORIGINAL_HOST' };
  }
  const paired = await findPairedHostByToken(sessionCode, token);
  if (!paired) return null;
  return { token, role: paired.role, tokenId: paired.tokenId };
}

export async function isHostSessionTokenValid(
  sessionCode: string,
  token: string,
): Promise<boolean> {
  return (await resolveHostSessionAccess(sessionCode, token)) !== null;
}

export async function isOriginalHostSessionToken(
  sessionCode: string,
  token: string,
): Promise<boolean> {
  return (await resolveHostSessionAccess(sessionCode, token))?.role === 'ORIGINAL_HOST';
}

export async function assertHostSessionAccessFromContext(
  ctx: HostTokenContext,
  sessionCode: string,
): Promise<string> {
  const token = extractHostTokenFromContext(ctx);
  if (!token) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Host-Authentifizierung erforderlich.' });
  }

  const valid = await isHostSessionTokenValid(sessionCode, token);
  if (!valid) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Host-Session ungültig oder abgelaufen.',
    });
  }

  return token;
}

export async function invalidateHostSessionToken(sessionCode: string): Promise<void> {
  const redis = getRedis();
  await redis.del(buildHostSessionKey(sessionCode));
}

export async function isBrowserHostCapabilityValid(
  sessionCode: string,
  browserCapability: string,
): Promise<{ generation: number } | null> {
  if (!browserCapability) return null;
  const credential = await prisma.hostCredential.findFirst({
    where: {
      session: {
        code: normalizeSessionCode(sessionCode),
      },
      browserCapabilityHash: hashCapability(browserCapability),
      status: 'ACTIVE',
    },
    select: { generation: true, session: { select: { hostCredentialVersion: true } } },
  });
  if (!credential || credential.generation !== credential.session.hostCredentialVersion) {
    return null;
  }
  return { generation: credential.generation };
}

export async function assertHostSessionAccess(
  req: IncomingMessage | undefined,
  sessionCode: string,
  connectionParams?: unknown,
): Promise<string> {
  return assertHostSessionAccessFromContext({ req, connectionParams }, sessionCode);
}
