import { randomBytes, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import {
  createOpaqueCapability,
  decryptCapabilityEnvelope,
  encryptCapabilityEnvelope,
  hashCapability,
  hashCapabilityIndex,
} from './capabilityCrypto';
import { hashToken as hashProductFeedbackToken } from './productFeedbackTokens';

export const PARTICIPANT_JOIN_REPLAY_MS = 10 * 60 * 1000;

export async function expireParticipantJoinReplayEnvelopes(
  tx: Prisma.TransactionClient,
  now: Date = new Date(),
): Promise<number> {
  const expired = await tx.participantJoinReplay.updateMany({
    where: {
      expiresAt: { lte: now },
      encryptedEnvelope: { not: null },
    },
    data: { encryptedEnvelope: null },
  });
  return expired.count;
}

type JoinProfile = {
  allowCustomNicknames: boolean;
  anonymousMode: boolean;
};

type ParticipantJoinEnvelope = {
  rejoinCapability: string;
  productFeedbackClaimToken: string | null;
};

export type PreparedParticipantJoin = {
  participantId: string;
  participantNumber: number;
  nickname: string;
  teamId: string | null;
  teamName: string | null;
  timerAccommodation: string;
  rejoinCapability: string;
  productFeedbackClaimToken: string | null;
  rejoined: boolean;
};

function replayAad(sessionId: string, idempotencyKeyHash: string): string {
  return `participant-join:v1:${sessionId}:${idempotencyKeyHash}`;
}

function expiredReplayError(): TRPCError {
  return new TRPCError({
    code: 'CONFLICT',
    message: 'Dieser Beitrittsversuch ist abgelaufen. Bitte starte den Beitritt erneut.',
  });
}

function deletedReplayError(): TRPCError {
  return new TRPCError({
    code: 'CONFLICT',
    message: 'Dieser Beitrittsversuch kann nicht erneut verwendet werden.',
  });
}

function conflictNicknameError(): TRPCError {
  return new TRPCError({
    code: 'CONFLICT',
    message: 'Dieser Nickname ist in dieser Session bereits vergeben.',
  });
}

function appendParticipantNumber(nickname: string, participantNumber: number): string {
  const suffix = ` ${participantNumber}`;
  const maxBaseLength = Math.max(1, 30 - suffix.length);
  return `${nickname.slice(0, maxBaseLength).trimEnd()}${suffix}`;
}

function anonymousNickname(requestedNickname: string, participantNumber: number): string {
  const stem = requestedNickname.replace(/\s+\d+$/, '').trim() || 'Teilnehmende';
  return appendParticipantNumber(stem, participantNumber);
}

async function databaseNow(tx: Prisma.TransactionClient): Promise<Date> {
  const rows = await tx.$queryRaw<Array<{ now: Date }>>`
    SELECT timezone('UTC', clock_timestamp()) AS now
  `;
  return rows[0]?.now ?? new Date();
}

async function replayPreparedJoin(params: {
  tx: Prisma.TransactionClient;
  sessionId: string;
  idempotencyKeyHash: string;
  now: Date;
}): Promise<PreparedParticipantJoin | null> {
  const replay = await params.tx.participantJoinReplay.findUnique({
    where: {
      sessionId_idempotencyKeyHash: {
        sessionId: params.sessionId,
        idempotencyKeyHash: params.idempotencyKeyHash,
      },
    },
    include: {
      participant: {
        select: {
          id: true,
          participantNumber: true,
          nickname: true,
          teamId: true,
          timerAccommodation: true,
          team: { select: { name: true } },
        },
      },
    },
  });
  if (!replay) {
    return null;
  }
  if (replay.expiresAt <= params.now || !replay.encryptedEnvelope) {
    throw expiredReplayError();
  }
  if (!replay.participant || replay.participant.participantNumber === null) {
    throw deletedReplayError();
  }
  const envelope = decryptCapabilityEnvelope<ParticipantJoinEnvelope>(
    replay.encryptedEnvelope,
    replayAad(params.sessionId, params.idempotencyKeyHash),
  );
  return {
    participantId: replay.participant.id,
    participantNumber: replay.participant.participantNumber,
    nickname: replay.participant.nickname,
    teamId: replay.participant.teamId,
    teamName: replay.participant.team?.name ?? null,
    timerAccommodation: replay.participant.timerAccommodation,
    rejoinCapability: envelope.rejoinCapability,
    productFeedbackClaimToken: envelope.productFeedbackClaimToken,
    rejoined: true,
  };
}

export async function prepareParticipantJoin(params: {
  tx: Prisma.TransactionClient;
  sessionId: string;
  requestedNickname: string;
  assignedTeamId?: string;
  autoTeamIds?: readonly string[];
  requireAssignedTeamForNew?: boolean;
  profile: JoinProfile;
  rejoinCapability?: string;
  /** Browserweite Client-UUID; bindet max. eine Teilnahme pro Session. */
  anonymousClientId?: string;
  joinIdempotencyKey: string;
  productFeedbackClaimToken?: string;
}): Promise<PreparedParticipantJoin> {
  await params.tx
    .$executeRaw`SELECT arsnova_lock_session_for_participant_join(${params.sessionId})`;
  const now = await databaseNow(params.tx);
  const idempotencyKeyHash = hashCapabilityIndex(
    params.joinIdempotencyKey,
    `participant-join:${params.sessionId}`,
  );
  const replay = await replayPreparedJoin({
    tx: params.tx,
    sessionId: params.sessionId,
    idempotencyKeyHash,
    now,
  });
  if (replay) {
    return replay;
  }

  const anonymousClientIdHash = params.anonymousClientId
    ? hashCapability(params.anonymousClientId)
    : null;

  type ExistingRow = {
    id: string;
    participantNumber: number | null;
    nickname: string;
    teamId: string | null;
    timerAccommodation: string;
    productFeedbackClaimTokenHash: string | null;
    team: { name: string } | null;
  };

  const existingSelect = {
    id: true,
    participantNumber: true,
    nickname: true,
    teamId: true,
    timerAccommodation: true,
    productFeedbackClaimTokenHash: true,
    team: { select: { name: true } },
  } as const;

  async function bindAnonymousClientHash(participantId: string): Promise<void> {
    if (!anonymousClientIdHash) {
      return;
    }
    await params.tx.participant.updateMany({
      where: {
        sessionId: params.sessionId,
        anonymousClientIdHash,
        NOT: { id: participantId },
      },
      data: { anonymousClientIdHash: null },
    });
    await params.tx.participant.update({
      where: { id: participantId },
      data: { anonymousClientIdHash },
    });
  }

  async function finishRejoin(args: {
    existing: ExistingRow;
    rejoinCapability: string;
    rotateCapability: boolean;
  }): Promise<PreparedParticipantJoin> {
    const { existing } = args;
    if (existing.participantNumber === null || existing.participantNumber === undefined) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Teilnahme ohne Nummer kann nicht wiederverwendet werden.',
      });
    }
    let rejoinCapability = args.rejoinCapability;
    if (args.rotateCapability) {
      rejoinCapability = createOpaqueCapability();
      await params.tx.participant.update({
        where: { id: existing.id },
        data: { rejoinCapabilityHash: hashCapability(rejoinCapability) },
      });
    }
    await bindAnonymousClientHash(existing.id);
    const productFeedbackClaimToken =
      params.productFeedbackClaimToken &&
      existing.productFeedbackClaimTokenHash ===
        hashProductFeedbackToken(params.productFeedbackClaimToken)
        ? params.productFeedbackClaimToken
        : null;
    const envelope: ParticipantJoinEnvelope = {
      rejoinCapability,
      productFeedbackClaimToken,
    };
    await params.tx.participantJoinReplay.create({
      data: {
        id: randomUUID(),
        sessionId: params.sessionId,
        participantId: existing.id,
        idempotencyKeyHash,
        encryptedEnvelope: encryptCapabilityEnvelope(
          envelope,
          replayAad(params.sessionId, idempotencyKeyHash),
        ),
        createdAt: now,
        expiresAt: new Date(now.getTime() + PARTICIPANT_JOIN_REPLAY_MS),
      },
    });
    return {
      participantId: existing.id,
      participantNumber: existing.participantNumber,
      nickname: existing.nickname,
      teamId: existing.teamId,
      teamName: existing.team?.name ?? null,
      timerAccommodation: existing.timerAccommodation,
      rejoinCapability,
      productFeedbackClaimToken,
      rejoined: true,
    };
  }

  if (params.rejoinCapability) {
    const existing = await params.tx.participant.findFirst({
      where: {
        sessionId: params.sessionId,
        rejoinCapabilityHash: hashCapability(params.rejoinCapability),
      },
      select: existingSelect,
    });
    if (existing) {
      return finishRejoin({
        existing,
        rejoinCapability: params.rejoinCapability,
        rotateCapability: false,
      });
    }
  }

  if (anonymousClientIdHash) {
    const byClient = await params.tx.participant.findFirst({
      where: {
        sessionId: params.sessionId,
        anonymousClientIdHash,
      },
      select: existingSelect,
    });
    if (byClient) {
      // Gleiches Gerät: immer dieselbe Teilnahme — Nickname-Wechsel legt keine Zweitstimme an.
      return finishRejoin({
        existing: byClient,
        rejoinCapability: '',
        rotateCapability: true,
      });
    }
  }

  const allocation = await params.tx.session.update({
    where: { id: params.sessionId },
    data: { nextParticipantNumber: { increment: 1 } },
    select: { nextParticipantNumber: true },
  });
  const participantNumber = allocation.nextParticipantNumber;
  if (params.requireAssignedTeamForNew && !params.assignedTeamId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Bitte wähle ein Team aus.' });
  }
  const assignedTeamId =
    params.assignedTeamId ??
    (params.autoTeamIds && params.autoTeamIds.length > 0
      ? params.autoTeamIds[(participantNumber - 1) % params.autoTeamIds.length]
      : undefined);
  let nickname = params.requestedNickname.trim().slice(0, 30);
  if (params.profile.anonymousMode) {
    nickname = anonymousNickname(nickname, participantNumber);
  } else if (!params.profile.allowCustomNicknames) {
    const presetNickname = nickname.replace(/\s+\d+$/, '').trim() || 'Teilnehmende';
    nickname = appendParticipantNumber(presetNickname, participantNumber);
  }

  const rejoinCapability = createOpaqueCapability();
  const productFeedbackClaimToken = randomBytes(32).toString('base64url');
  try {
    const participant = await params.tx.participant.create({
      data: {
        sessionId: params.sessionId,
        participantNumber,
        nickname,
        teamId: assignedTeamId,
        rejoinCapabilityHash: hashCapability(rejoinCapability),
        productFeedbackClaimTokenHash: hashProductFeedbackToken(productFeedbackClaimToken),
        ...(anonymousClientIdHash ? { anonymousClientIdHash } : {}),
      },
      select: {
        id: true,
        participantNumber: true,
        nickname: true,
        teamId: true,
        timerAccommodation: true,
        team: { select: { name: true } },
      },
    });
    const envelope: ParticipantJoinEnvelope = {
      rejoinCapability,
      productFeedbackClaimToken,
    };
    await params.tx.participantJoinReplay.create({
      data: {
        id: randomUUID(),
        sessionId: params.sessionId,
        participantId: participant.id,
        idempotencyKeyHash,
        encryptedEnvelope: encryptCapabilityEnvelope(
          envelope,
          replayAad(params.sessionId, idempotencyKeyHash),
        ),
        createdAt: now,
        expiresAt: new Date(now.getTime() + PARTICIPANT_JOIN_REPLAY_MS),
      },
    });
    return {
      participantId: participant.id,
      participantNumber,
      nickname: participant.nickname,
      teamId: participant.teamId,
      teamName: participant.team?.name ?? null,
      timerAccommodation: participant.timerAccommodation,
      rejoinCapability,
      productFeedbackClaimToken,
      rejoined: false,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = error.meta?.['target'];
      const targets = Array.isArray(target)
        ? target.map(String)
        : typeof target === 'string'
          ? [target]
          : [];
      if (
        anonymousClientIdHash &&
        targets.some((entry) => entry.includes('anonymousClientIdHash'))
      ) {
        const raced = await params.tx.participant.findFirst({
          where: { sessionId: params.sessionId, anonymousClientIdHash },
          select: existingSelect,
        });
        if (raced) {
          return finishRejoin({
            existing: raced,
            rejoinCapability: '',
            rotateCapability: true,
          });
        }
      }
      throw conflictNicknameError();
    }
    throw error;
  }
}
