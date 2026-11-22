import { randomUUID } from 'node:crypto';
import { Prisma, type Session } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { prisma } from '../db';
import { assertSessionEffectivelyActive } from './sessionLifecycle';

export const VOTE_TRANSACTION_MAX_WAIT_MS = 10_000;
export const VOTE_TRANSACTION_TIMEOUT_MS = 15_000;

const BATCH_WINDOW_MS = 5;
const BATCH_SIZE = 128;

type VoteScope = {
  sessionId: string;
  questionId: string;
  questionOrder: number;
  round: number;
  acceptsLateVote: boolean;
};
type ChoiceVote = Pick<
  Prisma.VoteCreateManyInput,
  | 'participantId'
  | 'responseTimeMs'
  | 'score'
  | 'isCorrect'
  | 'streakCount'
  | 'streakBonus'
  | 'confidenceValue'
>;
type StoredVote = { id: string; created: boolean };
type PendingVote = {
  scope: VoteScope;
  row: ChoiceVote & { id: string };
  answers: readonly string[];
  resolve: (vote: StoredVote | null) => void;
  reject: (error: unknown) => void;
};
let pendingVotes: PendingVote[] | undefined;

export async function requireOpenVoteSession(tx: Prisma.TransactionClient, scope: VoteScope) {
  await tx.$executeRaw`SELECT 1 FROM "Session" WHERE id = ${scope.sessionId} FOR SHARE`;
  const session = await tx.session.findUnique({
    where: { id: scope.sessionId },
    select: {
      status: true,
      endedAt: true,
      expiresAt: true,
      currentQuestion: true,
      currentRound: true,
    },
  });
  assertOpenVoteSession(session, scope);
}

type VoteSession = Pick<
  Session,
  'status' | 'endedAt' | 'expiresAt' | 'currentQuestion' | 'currentRound'
>;

function assertOpenVoteSession(session: VoteSession | null, scope: VoteScope): void {
  if (session) assertSessionEffectivelyActive(session, new Date());
  const acceptsVote =
    session?.status === 'ACTIVE' ||
    (scope.acceptsLateVote && (session?.status === 'RESULTS' || session?.status === 'DISCUSSION'));
  if (
    !session ||
    !acceptsVote ||
    session.currentQuestion !== scope.questionOrder ||
    session.currentRound !== scope.round
  ) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Die Frage ist nicht mehr aktiv.' });
  }
}

function voteIdentity({ sessionId, questionId, round }: VoteScope, participantId: string) {
  return { sessionId, questionId, round, participantId };
}

type VoteIdentity = ReturnType<typeof voteIdentity>;
function identityKey(vote: VoteIdentity): string {
  return `${vote.sessionId}:${vote.questionId}:${vote.round}:${vote.participantId}`;
}

async function storeBatch(batch: readonly PendingVote[]) {
  return prisma.$transaction(
    async (tx) => {
      const sessionIds = [...new Set(batch.map(({ scope }) => scope.sessionId))];
      // Ein konkurrierender Hostwechsel blockiert nur die zugehörigen Stimmen.
      // Ausgelassene Session-Zeilen gehen zurück in den sperrenden Einzelpfad.
      const sessions = await tx.$queryRaw<Array<VoteSession & { id: string }>>`
      SELECT id, status, "endedAt", "expiresAt", "currentQuestion", "currentRound"
      FROM "Session"
      WHERE id IN (${Prisma.join(sessionIds)})
      ORDER BY id
      FOR SHARE SKIP LOCKED
    `;
      const sessionsById = new Map(sessions.map((session) => [session.id, session]));
      const result = new Map<PendingVote, StoredVote | TRPCError>();
      const active = batch.filter((entry) => {
        const session = sessionsById.get(entry.scope.sessionId);
        if (!session) return false;
        try {
          assertOpenVoteSession(session, entry.scope);
          return true;
        } catch (error) {
          if (!(error instanceof TRPCError)) throw error;
          result.set(entry, error);
          return false;
        }
      });
      if (active.length === 0) return result;

      // Eine einheitliche Reihenfolge verhindert Lock-Inversion bei Replays auf zwei Apps.
      const rows = active.map(({ row, scope }) => ({
        ...row,
        ...voteIdentity(scope, row.participantId),
      }));
      rows.sort((a, b) => identityKey(a).localeCompare(identityKey(b)));
      const created = await tx.vote.createManyAndReturn({
        data: rows,
        skipDuplicates: true,
        select: { id: true, participantId: true, sessionId: true, questionId: true, round: true },
      });
      const newIds = new Set(created.map(({ id }) => id));
      const answers = active.flatMap(({ row, answers }) =>
        newIds.has(row.id)
          ? answers.map((answerOptionId) => ({ voteId: row.id, answerOptionId }))
          : [],
      );
      if (answers.length > 0) await tx.voteAnswer.createMany({ data: answers });
      const outbox = created.flatMap(({ id, sessionId, round }) =>
        round === 1
          ? [
              {
                kind: 'QUIZ_ANSWER',
                sessionId,
                idempotencyKey: `quiz:${id}`,
              },
            ]
          : [],
      );
      if (outbox.length > 0) await tx.usageStatisticOutbox.createMany({ data: outbox });

      const byIdentity = new Map(created.map((vote) => [identityKey(vote), vote.id]));
      const missing = active
        .map(({ scope, row }) => voteIdentity(scope, row.participantId))
        .filter((identity) => !byIdentity.has(identityKey(identity)));
      if (missing.length > 0) {
        const existing = await tx.vote.findMany({
          where: { OR: missing },
          select: { id: true, participantId: true, sessionId: true, questionId: true, round: true },
        });
        for (const vote of existing) byIdentity.set(identityKey(vote), vote.id);
      }
      for (const entry of active) {
        const id = byIdentity.get(identityKey(voteIdentity(entry.scope, entry.row.participantId)));
        if (id) result.set(entry, { id, created: id === entry.row.id });
      }
      return result;
    },
    { maxWait: VOTE_TRANSACTION_MAX_WAIT_MS, timeout: VOTE_TRANSACTION_TIMEOUT_MS },
  );
}

async function flushVotes(pending: PendingVote[]): Promise<void> {
  while (pending.length > 0) {
    const batch = pending.splice(0, BATCH_SIZE);
    try {
      const stored = await storeBatch(batch);
      for (const entry of batch) {
        const result = stored.get(entry);
        if (result instanceof TRPCError) entry.reject(result);
        else entry.resolve(result ?? null);
      }
    } catch (error) {
      const foreignKeyError =
        typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2003';
      for (const entry of batch) {
        // Eine parallel entfernte Teilnahme darf gültige Stimmen im selben Batch nicht blockieren.
        if (foreignKeyError) entry.resolve(null);
        else entry.reject(error);
      }
    }
  }
  pendingVotes = undefined;
}

export function persistChoiceVote(
  scope: VoteScope,
  vote: ChoiceVote,
  answers: readonly string[],
): Promise<StoredVote | null> {
  return new Promise((resolve, reject) => {
    const pending = pendingVotes ?? [];
    pending.push({ scope, row: { ...vote, id: randomUUID() }, answers, resolve, reject });
    if (!pendingVotes) {
      pendingVotes = pending;
      setTimeout(() => void flushVotes(pending), BATCH_WINDOW_MS);
    }
  });
}

const voteParticipantSelect = {
  id: true,
  rejoinCapabilityHash: true,
  timerAccommodation: true,
  session: {
    select: {
      id: true,
      code: true,
      quizId: true,
      status: true,
      endedAt: true,
      expiresAt: true,
      currentQuestion: true,
      currentRound: true,
      statusChangedAt: true,
      activeQuestionStartedAt: true,
      questionProgress: true,
    },
  },
} satisfies Prisma.ParticipantSelect;

type VoteParticipant = Prisma.ParticipantGetPayload<{ select: typeof voteParticipantSelect }>;
type ParticipantLookup = { id: string; sessionId: string; rejoinCapabilityHash?: string };
type PendingLookup = {
  where: ParticipantLookup;
  resolve: (value: Omit<VoteParticipant, 'rejoinCapabilityHash'> | null) => void;
  reject: (error: unknown) => void;
};
let pendingLookups: PendingLookup[] | undefined;

async function flushLookups(pending: PendingLookup[]): Promise<void> {
  while (pending.length > 0) {
    const batch = pending.splice(0, BATCH_SIZE);
    try {
      const rows = await prisma.participant.findMany({
        where: {
          id: { in: [...new Set(batch.map(({ where }) => where.id))] },
          sessionId: { in: [...new Set(batch.map(({ where }) => where.sessionId))] },
        },
        select: voteParticipantSelect,
      });
      const byId = new Map(rows.map((row) => [row.id, row]));
      for (const { where, resolve } of batch) {
        const row = byId.get(where.id);
        if (!row || row.session.id !== where.sessionId) {
          resolve(null);
          continue;
        }
        const { rejoinCapabilityHash, ...participant } = row;
        resolve(
          where.rejoinCapabilityHash === undefined ||
            where.rejoinCapabilityHash === rejoinCapabilityHash
            ? participant
            : null,
        );
      }
    } catch (error) {
      for (const entry of batch) entry.reject(error);
    }
  }
  pendingLookups = undefined;
}

export function loadVoteParticipant(where: ParticipantLookup) {
  return new Promise<Omit<VoteParticipant, 'rejoinCapabilityHash'> | null>((resolve, reject) => {
    const pending = pendingLookups ?? [];
    pending.push({ where, resolve, reject });
    if (!pendingLookups) {
      pendingLookups = pending;
      setTimeout(() => void flushLookups(pending), BATCH_WINDOW_MS);
    }
  });
}
