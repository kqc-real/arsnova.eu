import type { IncomingMessage } from 'node:http';
import { TRPCError } from '@trpc/server';
import { prisma } from '../db';
import { hashCapability } from './capabilityCrypto';

export type ParticipantTokenContext = {
  req?: IncomingMessage;
  connectionParams?: unknown;
};

const PARTICIPANT_CAPABILITY_CACHE_TTL_MS = 60_000;
const PARTICIPANT_CAPABILITY_CACHE_MAX_ENTRIES = 4_096;
const participantCapabilityCache = new Map<string, number>();

export function rememberParticipantCapability(
  sessionId: string,
  participantId: string,
  capability: string,
): void {
  if (!sessionId || !participantId || !capability) {
    return;
  }
  const nowMs = Date.now();
  pruneParticipantCapabilityCache(nowMs);
  const capabilityHash = hashCapability(capability);
  participantCapabilityCache.set(
    `${sessionId}:${participantId}:${capabilityHash}`,
    nowMs + PARTICIPANT_CAPABILITY_CACHE_TTL_MS,
  );
}

function pruneParticipantCapabilityCache(nowMs: number): void {
  for (const [key, expiresAt] of participantCapabilityCache) {
    if (expiresAt <= nowMs) {
      participantCapabilityCache.delete(key);
    }
  }
  while (participantCapabilityCache.size >= PARTICIPANT_CAPABILITY_CACHE_MAX_ENTRIES) {
    const oldestKey = participantCapabilityCache.keys().next().value as string | undefined;
    if (!oldestKey) {
      break;
    }
    participantCapabilityCache.delete(oldestKey);
  }
}

export function invalidateParticipantCapabilitiesForSession(sessionId: string): void {
  const prefix = `${sessionId}:`;
  for (const key of participantCapabilityCache.keys()) {
    if (key.startsWith(prefix)) {
      participantCapabilityCache.delete(key);
    }
  }
}

export function resetParticipantCapabilityCacheForTests(): void {
  participantCapabilityCache.clear();
}

function readConnectionParam(connectionParams: unknown, key: string): string | null {
  if (!connectionParams || typeof connectionParams !== 'object') {
    return null;
  }
  const value = (connectionParams as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function extractParticipantCapability(ctx: ParticipantTokenContext): string | null {
  const header = ctx.req?.headers['x-participant-capability'];
  if (typeof header === 'string' && header.trim().length > 0) {
    return header.trim();
  }
  return readConnectionParam(ctx.connectionParams, 'participantCapability');
}

function participantAccessDenied(): TRPCError {
  return new TRPCError({
    code: 'UNAUTHORIZED',
    message: 'Teilnahme-Nachweis ungültig oder abgelaufen.',
  });
}

export async function assertParticipantCapability(params: {
  ctx: ParticipantTokenContext;
  sessionId: string;
  participantId: string;
}): Promise<void> {
  const capability = extractParticipantCapability(params.ctx);
  if (!capability) {
    throw participantAccessDenied();
  }
  const capabilityHash = hashCapability(capability);
  const cacheKey = `${params.sessionId}:${params.participantId}:${capabilityHash}`;
  const nowMs = Date.now();
  const cachedExpiry = participantCapabilityCache.get(cacheKey);
  if (cachedExpiry !== undefined && cachedExpiry > nowMs) {
    return;
  }
  const participant = await prisma.participant.findFirst({
    where: {
      id: params.participantId,
      sessionId: params.sessionId,
      rejoinCapabilityHash: capabilityHash,
    },
    select: { id: true },
  });
  if (!participant) {
    participantCapabilityCache.delete(cacheKey);
    throw participantAccessDenied();
  }
  pruneParticipantCapabilityCache(nowMs);
  participantCapabilityCache.set(cacheKey, nowMs + PARTICIPANT_CAPABILITY_CACHE_TTL_MS);
}
