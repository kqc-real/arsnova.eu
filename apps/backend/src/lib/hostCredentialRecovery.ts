import { randomUUID } from 'node:crypto';
import type {
  AdminResetSessionHostAccessInput,
  AdminResetSessionHostAccessOutput,
  HostCredentialExchangeDTO,
  HostCredentialExchangeSource,
  HostRecoveryCardDTO,
} from '@arsnova/shared-types';
import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { prisma } from '../db';
import {
  createHostSupportId,
  createOpaqueCapability,
  decryptCapabilityEnvelope,
  encryptCapabilityEnvelope,
  hashCapability,
  hashCapabilityIndex,
} from './capabilityCrypto';
import {
  createCredentialBoundHostToken,
  hashHostSessionToken,
  invalidateHostSessionToken,
  isBrowserHostCapabilityValid,
} from './hostAuth';
import { invalidateHostPairingForSession } from './hostPairing';
import { buildSessionRetentionTimeline } from './sessionLifecycle';

export const HOST_CREDENTIAL_EXCHANGE_MS = 15 * 60 * 1000;

type InitialHostCredentialMaterial = {
  browserCapability: string;
  recoveryCard: HostRecoveryCardDTO;
  credentialData: {
    hostCredentialVersion: number;
    hostSupportId: string;
    hostCredentials: {
      create: {
        generation: number;
        status: 'ACTIVE';
        browserCapabilityHash: string;
        recoveryCodeHash: string;
        activatedAt: Date;
      };
    };
  };
};

function publicRecoveryError(): TRPCError {
  return new TRPCError({
    code: 'UNAUTHORIZED',
    message: 'Wiederherstellung nicht möglich oder abgelaufen.',
  });
}

function exchangeAad(sessionId: string, exchangeIdHash: string): string {
  return `host-credential-exchange:v1:${sessionId}:${exchangeIdHash}`;
}

export function createInitialHostCredentialMaterial(
  now: Date = new Date(),
): InitialHostCredentialMaterial {
  const browserCapability = createOpaqueCapability();
  const recoveryCode = createOpaqueCapability();
  const supportId = createHostSupportId();
  return {
    browserCapability,
    recoveryCard: { supportId, recoveryCode },
    credentialData: {
      hostCredentialVersion: 1,
      hostSupportId: supportId,
      hostCredentials: {
        create: {
          generation: 1,
          status: 'ACTIVE',
          browserCapabilityHash: hashCapability(browserCapability),
          recoveryCodeHash: hashCapability(recoveryCode),
          activatedAt: now,
        },
      },
    },
  };
}

export async function issueHostTokenFromBrowserCapability(params: {
  code: string;
  browserCapability: string;
}): Promise<{
  code: string;
  hostToken: string;
  hostTokenExpiresAt: string;
  role: 'ORIGINAL_HOST';
}> {
  const valid = await isBrowserHostCapabilityValid(params.code, params.browserCapability);
  if (!valid) {
    throw publicRecoveryError();
  }
  const session = await prisma.session.findUnique({
    where: { code: params.code.toUpperCase() },
    select: {
      status: true,
      endedAt: true,
      expiresAt: true,
      legalHoldUntil: true,
    },
  });
  if (!session) {
    throw publicRecoveryError();
  }
  const now = new Date();
  const retention = buildSessionRetentionTimeline(session, now);
  if (retention.postProcessingEndsAt && now >= retention.postProcessingEndsAt) {
    throw publicRecoveryError();
  }
  const issued = await createCredentialBoundHostToken({
    sessionCode: params.code,
    credentialVersion: valid.generation,
  });
  return {
    code: params.code.toUpperCase(),
    hostToken: issued.token,
    hostTokenExpiresAt: issued.expiresAt,
    role: 'ORIGINAL_HOST',
  };
}

export async function cleanupExpiredHostCredentialMaterial(now: Date = new Date()): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const expired = await tx.hostCredentialExchange.findMany({
      where: { expiresAt: { lte: now } },
      select: {
        id: true,
        targetCredentialId: true,
      },
    });
    if (expired.length > 0) {
      await tx.hostCredentialExchange.deleteMany({
        where: { id: { in: expired.map((entry) => entry.id) } },
      });
      await tx.hostCredential.deleteMany({
        where: {
          id: { in: expired.map((entry) => entry.targetCredentialId) },
          status: 'PENDING',
        },
      });
    }
    await tx.hostAdminHandoff.deleteMany({
      where: {
        expiresAt: { lte: now },
        exchange: null,
      },
    });
  });
}

type PreparedExchangeSource = {
  type: 'RECOVERY' | 'ADMIN_HANDOFF' | 'LEGACY_HOST_TOKEN';
  secretHash: string;
  sourceCredentialId: string | null;
  adminHandoffId: string | null;
  targetGeneration: number;
};

function exchangeSourceIdentity(
  source: HostCredentialExchangeSource | { kind: 'LEGACY_HOST_TOKEN'; hostToken: string },
): Pick<PreparedExchangeSource, 'type' | 'secretHash'> {
  if (source.kind === 'RECOVERY') {
    return { type: 'RECOVERY', secretHash: hashCapability(source.recoveryCode) };
  }
  if (source.kind === 'ADMIN_HANDOFF') {
    return { type: 'ADMIN_HANDOFF', secretHash: hashCapability(source.handoffCapability) };
  }
  return { type: 'LEGACY_HOST_TOKEN', secretHash: hashHostSessionToken(source.hostToken) };
}

async function resolveExchangeSource(params: {
  tx: Prisma.TransactionClient;
  session: {
    id: string;
    code: string;
    hostCredentialVersion: number;
  };
  source: HostCredentialExchangeSource | { kind: 'LEGACY_HOST_TOKEN'; hostToken: string };
  now: Date;
}): Promise<PreparedExchangeSource | null> {
  if (params.source.kind === 'RECOVERY') {
    const secretHash = hashCapability(params.source.recoveryCode);
    const credential = await params.tx.hostCredential.findFirst({
      where: {
        sessionId: params.session.id,
        generation: params.session.hostCredentialVersion,
        status: 'ACTIVE',
        recoveryCodeHash: secretHash,
      },
      select: { id: true },
    });
    return credential
      ? {
          type: 'RECOVERY',
          secretHash,
          sourceCredentialId: credential.id,
          adminHandoffId: null,
          targetGeneration: params.session.hostCredentialVersion + 1,
        }
      : null;
  }
  if (params.source.kind === 'ADMIN_HANDOFF') {
    const secretHash = hashCapability(params.source.handoffCapability);
    const handoff = await params.tx.hostAdminHandoff.findFirst({
      where: {
        sessionId: params.session.id,
        capabilityHash: secretHash,
        consumedAt: null,
        expiresAt: { gt: params.now },
        targetGeneration: params.session.hostCredentialVersion,
      },
      select: { id: true, targetGeneration: true },
    });
    return handoff
      ? {
          type: 'ADMIN_HANDOFF',
          secretHash,
          sourceCredentialId: null,
          adminHandoffId: handoff.id,
          targetGeneration: handoff.targetGeneration,
        }
      : null;
  }
  if (params.session.hostCredentialVersion !== 0) {
    return null;
  }
  return {
    type: 'LEGACY_HOST_TOKEN',
    secretHash: hashHostSessionToken(params.source.hostToken),
    sourceCredentialId: null,
    adminHandoffId: null,
    targetGeneration: 1,
  };
}

async function prepareExchange(params: {
  supportId?: string;
  code?: string;
  recoveryExchangeId: string;
  source: HostCredentialExchangeSource | { kind: 'LEGACY_HOST_TOKEN'; hostToken: string };
}): Promise<HostCredentialExchangeDTO> {
  await cleanupExpiredHostCredentialMaterial();
  const result = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "Session"
      WHERE ${
        params.supportId
          ? Prisma.sql`"hostSupportId" = ${params.supportId}`
          : Prisma.sql`"code" = ${params.code?.toUpperCase() ?? ''}`
      }
      FOR UPDATE
    `);
    if (!locked[0]) return null;
    const session = await tx.session.findUnique({
      where: { id: locked[0].id },
      select: {
        id: true,
        code: true,
        hostSupportId: true,
        hostCredentialVersion: true,
        status: true,
        endedAt: true,
        expiresAt: true,
        legalHoldUntil: true,
      },
    });
    if (!session) return null;
    const now = new Date();
    const retention = buildSessionRetentionTimeline(session, now);
    if (retention.postProcessingEndsAt && now >= retention.postProcessingEndsAt) {
      return null;
    }
    const exchangeIdHash = hashCapabilityIndex(
      params.recoveryExchangeId,
      `host-recovery:${session.id}`,
    );
    const sourceIdentity = exchangeSourceIdentity(params.source);
    const current = await tx.hostCredentialExchange.findUnique({
      where: { sessionId: session.id },
    });
    if (current) {
      if (
        current.expiresAt > now &&
        current.sourceType === sourceIdentity.type &&
        current.sourceSecretHash === sourceIdentity.secretHash &&
        current.exchangeIdHash === exchangeIdHash
      ) {
        return decryptCapabilityEnvelope<HostCredentialExchangeDTO>(
          current.encryptedEnvelope,
          exchangeAad(session.id, exchangeIdHash),
        );
      }
      return null;
    }
    const source = await resolveExchangeSource({
      tx,
      session,
      source: params.source,
      now,
    });
    if (!source) return null;

    const supportId = session.hostSupportId ?? createHostSupportId();
    if (!session.hostSupportId) {
      await tx.session.update({
        where: { id: session.id },
        data: { hostSupportId: supportId },
      });
    }
    const browserCapability = createOpaqueCapability();
    const recoveryCode = createOpaqueCapability();
    const pendingExpiresAt = new Date(now.getTime() + HOST_CREDENTIAL_EXCHANGE_MS);
    const target = await tx.hostCredential.create({
      data: {
        sessionId: session.id,
        generation: source.targetGeneration,
        status: 'PENDING',
        browserCapabilityHash: hashCapability(browserCapability),
        recoveryCodeHash: hashCapability(recoveryCode),
      },
      select: { id: true },
    });
    const envelope: HostCredentialExchangeDTO = {
      code: session.code,
      browserCapability,
      recoveryCard: { supportId, recoveryCode },
      pendingExpiresAt: pendingExpiresAt.toISOString(),
    };
    await tx.hostCredentialExchange.create({
      data: {
        id: randomUUID(),
        sessionId: session.id,
        sourceType: source.type,
        sourceCredentialId: source.sourceCredentialId,
        adminHandoffId: source.adminHandoffId,
        sourceSecretHash: source.secretHash,
        exchangeIdHash,
        targetCredentialId: target.id,
        encryptedEnvelope: encryptCapabilityEnvelope(
          envelope,
          exchangeAad(session.id, exchangeIdHash),
        ),
        createdAt: now,
        expiresAt: pendingExpiresAt,
      },
    });
    if (source.adminHandoffId) {
      await tx.hostAdminHandoff.update({
        where: { id: source.adminHandoffId },
        data: { consumedAt: now },
      });
    }
    return envelope;
  });
  if (!result) {
    throw publicRecoveryError();
  }
  return result;
}

export function prepareHostCredentialExchange(params: {
  supportId: string;
  recoveryExchangeId: string;
  source: HostCredentialExchangeSource;
}): Promise<HostCredentialExchangeDTO> {
  return prepareExchange(params);
}

export function prepareLegacyHostCredentialBootstrap(params: {
  code: string;
  recoveryExchangeId: string;
  hostToken: string;
}): Promise<HostCredentialExchangeDTO> {
  return prepareExchange({
    code: params.code,
    recoveryExchangeId: params.recoveryExchangeId,
    source: { kind: 'LEGACY_HOST_TOKEN', hostToken: params.hostToken },
  });
}

export async function activateHostCredential(params: {
  supportId: string;
  browserCapability: string;
}): Promise<{ code: string; generation: number }> {
  await cleanupExpiredHostCredentialMaterial();
  const activated = await prisma.$transaction(async (tx) => {
    const credential = await tx.hostCredential.findUnique({
      where: { browserCapabilityHash: hashCapability(params.browserCapability) },
      include: {
        session: {
          select: {
            id: true,
            code: true,
            hostSupportId: true,
            hostCredentialVersion: true,
            endedAt: true,
            expiresAt: true,
            legalHoldUntil: true,
          },
        },
        targetExchange: true,
      },
    });
    if (!credential || credential.session.hostSupportId !== params.supportId) {
      return null;
    }
    const now = new Date();
    const retention = buildSessionRetentionTimeline(credential.session, now);
    if (retention.postProcessingEndsAt && now >= retention.postProcessingEndsAt) {
      return null;
    }
    if (
      credential.status === 'ACTIVE' &&
      credential.generation === credential.session.hostCredentialVersion
    ) {
      return { code: credential.session.code, generation: credential.generation };
    }
    const exchange = credential.targetExchange;
    if (!exchange || exchange.expiresAt <= now || credential.status !== 'PENDING') {
      return null;
    }
    await tx.hostCredential.updateMany({
      where: {
        sessionId: credential.session.id,
        status: 'ACTIVE',
      },
      data: { status: 'REVOKED', revokedAt: now },
    });
    await tx.hostCredential.update({
      where: { id: credential.id },
      data: { status: 'ACTIVE', activatedAt: now },
    });
    await tx.session.update({
      where: { id: credential.session.id },
      data: { hostCredentialVersion: credential.generation },
    });
    await tx.hostCredentialExchange.delete({ where: { id: exchange.id } });
    if (exchange.adminHandoffId) {
      await tx.hostAdminHandoff.delete({ where: { id: exchange.adminHandoffId } });
    }
    return { code: credential.session.code, generation: credential.generation };
  });
  if (!activated) {
    throw publicRecoveryError();
  }
  await Promise.all([
    invalidateHostSessionToken(activated.code),
    invalidateHostPairingForSession(activated.code),
  ]);
  return activated;
}

function adminHandoffEnvelopeAad(sessionId: string, operationId: string): string {
  return `admin-handoff:${sessionId}:${operationId}`;
}

export async function resetSessionHostAccess(params: {
  input: AdminResetSessionHostAccessInput;
  adminIdentifier: string;
}): Promise<AdminResetSessionHostAccessOutput> {
  const result = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "Session"
      WHERE ${
        params.input.code
          ? Prisma.sql`"code" = ${params.input.code.toUpperCase()}`
          : Prisma.sql`"hostSupportId" = ${params.input.supportId ?? ''}`
      }
      FOR UPDATE
    `);
    if (!locked[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
    }
    const session = await tx.session.findUnique({
      where: { id: locked[0].id },
      select: {
        id: true,
        code: true,
        hostSupportId: true,
        hostCredentialVersion: true,
        status: true,
        endedAt: true,
        expiresAt: true,
        legalHoldUntil: true,
      },
    });
    if (!session) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
    }
    const now = new Date();
    const retention = buildSessionRetentionTimeline(session, now);
    if (retention.postProcessingEndsAt && now >= retention.postProcessingEndsAt) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Der Host-Zugang kann nach Ende der Nachbereitung nicht zurückgesetzt werden.',
      });
    }

    const existingByOperation = await tx.hostAdminHandoff.findUnique({
      where: { operationId: params.input.operationId },
      select: {
        sessionId: true,
        encryptedEnvelope: true,
      },
    });
    if (existingByOperation) {
      if (existingByOperation.sessionId !== session.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Die Operations-ID gehört zu einer anderen Session.',
        });
      }
      if (existingByOperation.encryptedEnvelope) {
        try {
          return decryptCapabilityEnvelope<AdminResetSessionHostAccessOutput>(
            existingByOperation.encryptedEnvelope,
            adminHandoffEnvelopeAad(session.id, params.input.operationId),
          );
        } catch {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message:
              'Der gespeicherte Übergabecode kann nicht gelesen werden. Bestätige einen neuen Reset, um ihn zu ersetzen.',
          });
        }
      }
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message:
          'Der vorherige Übergabecode ist nicht mehr abrufbar. Bestätige einen neuen Reset, um ihn zu ersetzen.',
      });
    }

    const otherOpen = await tx.hostAdminHandoff.findFirst({
      where: {
        sessionId: session.id,
        operationId: { not: params.input.operationId },
        expiresAt: { gt: now },
      },
      select: { id: true },
    });
    if (otherOpen && params.input.confirmNewReset !== true) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message:
          'Ein Übergabecode für diese Session existiert bereits. Bestätige einen neuen Reset, um ihn zu ersetzen.',
      });
    }

    const handoffCapability = createOpaqueCapability();
    const revokedCredentialVersion = session.hostCredentialVersion;
    const targetGeneration = revokedCredentialVersion + 1;
    const supportId = session.hostSupportId ?? createHostSupportId();

    const existingExchange = await tx.hostCredentialExchange.findUnique({
      where: { sessionId: session.id },
      select: { id: true, targetCredentialId: true },
    });
    if (existingExchange) {
      await tx.hostCredentialExchange.delete({ where: { id: existingExchange.id } });
      await tx.hostCredential.deleteMany({
        where: { id: existingExchange.targetCredentialId, status: 'PENDING' },
      });
    }
    await tx.hostAdminHandoff.deleteMany({ where: { sessionId: session.id } });
    await tx.hostCredential.updateMany({
      where: { sessionId: session.id, status: { in: ['ACTIVE', 'PENDING'] } },
      data: { status: 'REVOKED', revokedAt: now },
    });
    await tx.session.update({
      where: { id: session.id },
      data: {
        hostCredentialVersion: targetGeneration,
        hostSupportId: supportId,
      },
    });
    const expiresAt = new Date(now.getTime() + HOST_CREDENTIAL_EXCHANGE_MS);
    const output: AdminResetSessionHostAccessOutput = {
      sessionId: session.id,
      code: session.code,
      supportId,
      handoffCapability,
      expiresAt: expiresAt.toISOString(),
      revokedCredentialVersion,
    };
    await tx.hostAdminHandoff.create({
      data: {
        sessionId: session.id,
        operationId: params.input.operationId,
        capabilityHash: hashCapability(handoffCapability),
        encryptedEnvelope: encryptCapabilityEnvelope(
          output,
          adminHandoffEnvelopeAad(session.id, params.input.operationId),
        ),
        targetGeneration,
        createdAt: now,
        expiresAt,
      },
    });
    await tx.adminAuditLog.create({
      data: {
        action: 'HOST_ACCESS_RESET',
        sessionId: session.id,
        sessionCode: session.code,
        adminIdentifier: params.adminIdentifier,
        reason: JSON.stringify({
          reason: params.input.reason,
          evidenceCategory: params.input.evidenceCategory,
          requesterIdentityVerificationReference:
            params.input.requesterIdentityVerificationReference,
          sessionAuthorizationEvidenceReference: params.input.sessionAuthorizationEvidenceReference,
          supportCaseReference: params.input.supportCaseReference,
          operationId: params.input.operationId,
          revokedCredentialVersion,
        }),
      },
    });
    return output;
  });
  return result;
}
