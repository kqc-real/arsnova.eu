import type { IncomingMessage } from 'node:http';
import { TRPCError } from '@trpc/server';
import { prisma } from '../db';
import { hashCapability } from './capabilityCrypto';

export type ParticipantTokenContext = {
  req?: IncomingMessage;
  connectionParams?: unknown;
};

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
  const participant = await prisma.participant.findFirst({
    where: {
      id: params.participantId,
      sessionId: params.sessionId,
      rejoinCapabilityHash: hashCapability(capability),
    },
    select: { id: true },
  });
  if (!participant) {
    throw participantAccessDenied();
  }
}
