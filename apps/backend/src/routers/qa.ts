import { TRPCError } from '@trpc/server';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  GetQaQuestionsInputSchema,
  ModerateQaQuestionInputSchema,
  QaQuestionDTOSchema,
  QaQuestionsListDTOSchema,
  QaVoteInputSchema,
  QaVoteOutputSchema,
  SubmitQaQuestionInputSchema,
  ToggleQaModerationInputSchema,
  ToggleQaUpvoteOutputSchema,
  UpvoteQaQuestionInputSchema,
} from '@arsnova/shared-types';
import { assertHostSessionAccessFromContext } from '../lib/hostAuth';
import { prisma } from '../db';
import { hostProcedure, publicProcedure, router } from '../trpc';

const QA_SUBSCRIPTION_POLL_MS = 1000;
const QA_PARTICIPANT_COUNT_CACHE_MS = 5000;
const QA_WILSON_Z = 1.96;
const QA_WILSON_Z_SQUARED = QA_WILSON_Z * QA_WILSON_Z;
const PARTICIPANT_VISIBLE_QA_STATUSES = ['ACTIVE', 'PINNED', 'ARCHIVED'] as const;

type QaQuestionVoteRecord = {
  participantId?: string;
  direction?: string | null;
};

type QaQuestionRecord = {
  id: string;
  text: string;
  upvoteCount: number;
  status: 'PENDING' | 'ACTIVE' | 'PINNED' | 'ARCHIVED' | 'DELETED';
  createdAt: Date;
  participantId: string;
  upvotes?: QaQuestionVoteRecord[];
};

type QaQuestionVoteAggregates = {
  positiveVoteCount: number;
  negativeVoteCount: number;
};

type QaQuestionVoteStats = {
  score: number;
  positiveVoteCount?: number;
  negativeVoteCount?: number;
  voteCount?: number;
  bestScore?: number;
  controversyScore?: number;
  isControversial?: boolean;
};

type QaQuestionSortMode = z.infer<typeof GetQaQuestionsInputSchema>['sort'];

type DecoratedQaQuestion = {
  question: QaQuestionRecord;
  voteStats: QaQuestionVoteStats;
};

/** Schreibende Q&A-Aktionen nach Session-Ende blockieren (Missbrauchsschutz). */
function assertQaSessionOpenForParticipants(sessionStatus: string | null | undefined): void {
  if (sessionStatus === 'FINISHED') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Die Session ist beendet. Fragen und Bewertungen sind nicht mehr möglich.',
    });
  }
}

function isQaEnabled(session: { type: string; qaEnabled?: boolean | null }): boolean {
  return session.type === 'Q_AND_A' || session.qaEnabled === true;
}

function isQaOpenForParticipants(session: {
  type: string;
  qaEnabled?: boolean | null;
  qaOpen?: boolean | null;
}): boolean {
  return isQaEnabled(session) && session.qaOpen !== false;
}

function normalizeQaSortMode(moderatorView: boolean | undefined, sortMode: QaQuestionSortMode) {
  return moderatorView ? sortMode : 'TOP';
}

function computeWilsonBestScore(positiveVoteCount: number, negativeVoteCount: number): number {
  const voteCount = positiveVoteCount + negativeVoteCount;
  if (voteCount <= 0) {
    return 0;
  }

  const observedPositiveRate = positiveVoteCount / voteCount;
  const denominator = 1 + QA_WILSON_Z_SQUARED / voteCount;
  const center = observedPositiveRate + QA_WILSON_Z_SQUARED / (2 * voteCount);
  const margin =
    QA_WILSON_Z *
    Math.sqrt(
      (observedPositiveRate * (1 - observedPositiveRate)) / voteCount +
        QA_WILSON_Z_SQUARED / (4 * voteCount * voteCount),
    );

  return Math.max(0, Math.min(1, (center - margin) / denominator));
}

function resolveQaControversyThreshold(participantCount: number): number {
  return Math.max(1, 0.1 * Math.max(0, participantCount));
}

function computeControversyScore(
  positiveVoteCount: number,
  negativeVoteCount: number,
  participantCount: number,
): number {
  const voteCount = positiveVoteCount + negativeVoteCount;
  if (voteCount <= 0) {
    return 0;
  }

  const denominator = voteCount + resolveQaControversyThreshold(participantCount);
  if (denominator <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(1, (2 * Math.min(positiveVoteCount, negativeVoteCount)) / denominator),
  );
}

function createQaVoteStats(
  question: QaQuestionRecord,
  includeVoteMetrics: boolean,
  participantCountForControversy?: number,
  voteAggregates?: QaQuestionVoteAggregates,
): QaQuestionVoteStats {
  if (!includeVoteMetrics) {
    return { score: question.upvoteCount };
  }

  const positiveVoteCount =
    voteAggregates?.positiveVoteCount ??
    (question.upvotes ?? []).filter((vote) => vote.direction !== 'DOWN').length;
  const negativeVoteCount =
    voteAggregates?.negativeVoteCount ??
    (question.upvotes ?? []).filter((vote) => vote.direction === 'DOWN').length;
  const voteCount = positiveVoteCount + negativeVoteCount;
  const score = voteAggregates ? positiveVoteCount - negativeVoteCount : question.upvoteCount;
  const bestScore = computeWilsonBestScore(positiveVoteCount, negativeVoteCount);
  const controversyScore =
    typeof participantCountForControversy === 'number'
      ? computeControversyScore(
          positiveVoteCount,
          negativeVoteCount,
          participantCountForControversy,
        )
      : undefined;
  const controversyThreshold =
    typeof participantCountForControversy === 'number'
      ? resolveQaControversyThreshold(participantCountForControversy)
      : undefined;

  return {
    score,
    positiveVoteCount,
    negativeVoteCount,
    voteCount,
    bestScore,
    controversyScore,
    isControversial:
      controversyScore !== undefined &&
      controversyThreshold !== undefined &&
      controversyScore > 0.5 &&
      voteCount >= controversyThreshold,
  };
}

function sortQuestions(
  questions: DecoratedQaQuestion[],
  sortMode: QaQuestionSortMode,
  includeVoteMetrics: boolean,
): DecoratedQaQuestion[] {
  return [...questions].sort((left, right) => {
    const statusDiff =
      statusSortBucket(left.question.status, includeVoteMetrics) -
      statusSortBucket(right.question.status, includeVoteMetrics);
    if (statusDiff !== 0) {
      return statusDiff;
    }

    if (sortMode === 'BEST') {
      const bestScoreDiff = (right.voteStats.bestScore ?? 0) - (left.voteStats.bestScore ?? 0);
      if (bestScoreDiff !== 0) {
        return bestScoreDiff;
      }

      const positiveVoteDiff =
        (right.voteStats.positiveVoteCount ?? 0) - (left.voteStats.positiveVoteCount ?? 0);
      if (positiveVoteDiff !== 0) {
        return positiveVoteDiff;
      }
    }

    if (sortMode === 'CONTROVERSIAL') {
      const controversyScoreDiff =
        (right.voteStats.controversyScore ?? 0) - (left.voteStats.controversyScore ?? 0);
      if (controversyScoreDiff !== 0) {
        return controversyScoreDiff;
      }

      const positiveVoteDiff =
        (right.voteStats.positiveVoteCount ?? 0) - (left.voteStats.positiveVoteCount ?? 0);
      if (positiveVoteDiff !== 0) {
        return positiveVoteDiff;
      }
    }

    if (right.voteStats.score !== left.voteStats.score) {
      return right.voteStats.score - left.voteStats.score;
    }

    const statusTieDiff =
      statusTieOrder(left.question.status) - statusTieOrder(right.question.status);
    if (statusTieDiff !== 0) {
      return statusTieDiff;
    }

    const createdAtDiff = left.question.createdAt.getTime() - right.question.createdAt.getTime();
    if (createdAtDiff !== 0) {
      return createdAtDiff;
    }

    return left.question.id.localeCompare(right.question.id);
  });
}

function statusSortBucket(status: QaQuestionRecord['status'], includeVoteMetrics: boolean): number {
  if (includeVoteMetrics) {
    switch (status) {
      case 'PINNED':
      case 'ACTIVE':
        return 0;
      case 'PENDING':
        return 1;
      case 'ARCHIVED':
        return 2;
      case 'DELETED':
        return 3;
    }
  }

  switch (status) {
    case 'PINNED':
      return 0;
    case 'ACTIVE':
      return 1;
    case 'PENDING':
      return 2;
    case 'ARCHIVED':
      return 3;
    case 'DELETED':
      return 4;
  }
}

function statusTieOrder(status: QaQuestionRecord['status']): number {
  switch (status) {
    case 'PINNED':
      return 0;
    case 'ACTIVE':
      return 1;
    case 'PENDING':
      return 2;
    case 'ARCHIVED':
      return 3;
    case 'DELETED':
      return 4;
  }
}

function mapQaQuestion(
  question: QaQuestionRecord,
  participantId?: string,
  voteStats?: QaQuestionVoteStats,
  includeVoteMetrics = false,
) {
  const myUpvote = participantId
    ? (question.upvotes ?? []).find((v) => v.participantId === participantId)
    : undefined;
  return QaQuestionDTOSchema.parse({
    id: question.id,
    text: question.text,
    upvoteCount: question.upvoteCount,
    ...(includeVoteMetrics
      ? {
          score: voteStats?.score ?? question.upvoteCount,
        }
      : {}),
    ...(includeVoteMetrics && voteStats?.positiveVoteCount !== undefined
      ? { positiveVoteCount: voteStats.positiveVoteCount }
      : {}),
    ...(includeVoteMetrics && voteStats?.negativeVoteCount !== undefined
      ? { negativeVoteCount: voteStats.negativeVoteCount }
      : {}),
    ...(includeVoteMetrics && voteStats?.voteCount !== undefined
      ? { voteCount: voteStats.voteCount }
      : {}),
    ...(includeVoteMetrics && voteStats?.bestScore !== undefined
      ? { bestScore: voteStats.bestScore }
      : {}),
    ...(includeVoteMetrics && voteStats?.controversyScore !== undefined
      ? { controversyScore: voteStats.controversyScore }
      : {}),
    ...(includeVoteMetrics && voteStats?.isControversial !== undefined
      ? { isControversial: voteStats.isControversial }
      : {}),
    status: question.status,
    createdAt: question.createdAt.toISOString(),
    myVote: myUpvote ? (myUpvote.direction === 'DOWN' ? 'DOWN' : 'UP') : null,
    isOwn: !!participantId && question.participantId === participantId,
    hasUpvoted: !!myUpvote && myUpvote.direction !== 'DOWN',
  });
}

function buildQaQuestionListPayload(
  questions: QaQuestionRecord[],
  participantId: string | undefined,
  sortMode: QaQuestionSortMode,
  includeVoteMetrics: boolean,
  participantCountForControversy?: number,
  voteAggregatesByQuestionId: ReadonlyMap<string, QaQuestionVoteAggregates> = new Map(),
) {
  const decoratedQuestions = questions.map((question) => ({
    question,
    voteStats: createQaVoteStats(
      question,
      includeVoteMetrics,
      participantCountForControversy,
      voteAggregatesByQuestionId.get(question.id),
    ),
  }));

  return sortQuestions(decoratedQuestions, sortMode, includeVoteMetrics).map(
    ({ question, voteStats }) =>
      mapQaQuestion(question, participantId, voteStats, includeVoteMetrics),
  );
}

function buildQaQuestionWhere(
  sessionId: string,
  moderatorView: boolean | undefined,
  participantId: string | undefined,
): Prisma.QaQuestionWhereInput {
  return {
    sessionId,
    ...(moderatorView
      ? {}
      : participantId
        ? {
            OR: [
              { status: { in: [...PARTICIPANT_VISIBLE_QA_STATUSES] } },
              { status: 'PENDING' as const, participantId },
            ],
          }
        : { status: { not: 'DELETED' as const } }),
  };
}

async function getVoteAggregatesByQuestionId(
  questionIds: readonly string[],
): Promise<Map<string, QaQuestionVoteAggregates>> {
  if (questionIds.length === 0) {
    return new Map();
  }

  const groupedVotes = await prisma.qaUpvote.groupBy({
    by: ['qaQuestionId', 'direction'],
    where: { qaQuestionId: { in: [...questionIds] } },
    _count: { _all: true },
  });
  const aggregates = new Map<string, QaQuestionVoteAggregates>();

  for (const row of groupedVotes) {
    const current = aggregates.get(row.qaQuestionId) ?? {
      positiveVoteCount: 0,
      negativeVoteCount: 0,
    };
    if (row.direction === 'DOWN') {
      current.negativeVoteCount += row._count._all;
    } else {
      current.positiveVoteCount += row._count._all;
    }
    aggregates.set(row.qaQuestionId, current);
  }

  return aggregates;
}

async function buildQaQuestionPayloadFromDb(
  sessionId: string,
  participantId: string | undefined,
  moderatorView: boolean | undefined,
  sortMode: QaQuestionSortMode,
  participantCountForControversy?: number,
) {
  const questions = await prisma.qaQuestion.findMany({
    where: buildQaQuestionWhere(sessionId, moderatorView, participantId),
    include: {
      upvotes: moderatorView
        ? false
        : participantId
          ? {
              where: { participantId },
              select: { participantId: true, direction: true },
            }
          : false,
    },
  });
  const voteAggregatesByQuestionId =
    moderatorView === true
      ? await getVoteAggregatesByQuestionId(questions.map((question) => question.id))
      : new Map<string, QaQuestionVoteAggregates>();

  return buildQaQuestionListPayload(
    questions,
    participantId,
    sortMode,
    moderatorView === true,
    participantCountForControversy,
    voteAggregatesByQuestionId,
  );
}

async function getQaQuestionsRevisionKey(
  sessionId: string,
  moderatorView: boolean | undefined,
  participantId: string | undefined,
  participantCountForControversy?: number,
): Promise<string> {
  const revision = await prisma.qaQuestion.aggregate({
    where: buildQaQuestionWhere(sessionId, moderatorView, participantId),
    _count: { _all: true },
    _max: { updatedAt: true },
    _sum: { upvoteCount: true },
  });

  const count =
    typeof revision._count === 'object' && revision._count !== null
      ? (revision._count._all ?? 0)
      : 0;

  return [
    count,
    revision._max?.updatedAt?.getTime() ?? 0,
    revision._sum?.upvoteCount ?? 0,
    participantCountForControversy ?? '',
  ].join(':');
}

export const qaRouter = router({
  list: publicProcedure
    .input(GetQaQuestionsInputSchema)
    .output(QaQuestionsListDTOSchema)
    .query(async ({ input, ctx }) => {
      const sortMode = normalizeQaSortMode(input.moderatorView, input.sort);
      const session = await prisma.session.findUnique({
        where: { id: input.sessionId },
        select: {
          id: true,
          code: true,
          type: true,
          qaEnabled: true,
          qaOpen: true,
          qaModerationMode: true,
        },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      if (!isQaEnabled(session)) {
        return [];
      }
      if (input.moderatorView) {
        await assertHostSessionAccessFromContext(ctx, session.code);
      } else if (!isQaOpenForParticipants(session)) {
        return [];
      }

      const participantCountForControversy =
        input.moderatorView && sortMode === 'CONTROVERSIAL'
          ? await prisma.participant.count({
              where: { sessionId: session.id },
            })
          : undefined;

      return buildQaQuestionPayloadFromDb(
        session.id,
        input.participantId,
        input.moderatorView,
        sortMode,
        participantCountForControversy,
      );
    }),

  moderate: hostProcedure
    .input(ModerateQaQuestionInputSchema)
    .output(QaQuestionDTOSchema)
    .mutation(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.sessionCode.toUpperCase() },
        select: {
          id: true,
          type: true,
          qaEnabled: true,
          status: true,
        },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      if (!isQaEnabled(session)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Fragen sind in dieser Session nicht aktiviert.',
        });
      }
      assertQaSessionOpenForParticipants(session.status);

      const question = await prisma.qaQuestion.findUnique({
        where: { id: input.questionId },
        select: {
          id: true,
          sessionId: true,
          text: true,
          upvoteCount: true,
          status: true,
          createdAt: true,
        },
      });
      if (!question || question.sessionId !== session.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Frage nicht gefunden.' });
      }

      if (input.action === 'DELETE') {
        await prisma.qaQuestion.delete({ where: { id: question.id } });
        return QaQuestionDTOSchema.parse({
          id: question.id,
          text: question.text,
          upvoteCount: question.upvoteCount,
          status: 'DELETED',
          createdAt: question.createdAt.toISOString(),
          myVote: null,
          isOwn: false,
          hasUpvoted: false,
        });
      }

      let nextStatus = question.status;
      switch (input.action) {
        case 'APPROVE':
        case 'UNPIN':
          nextStatus = 'ACTIVE';
          break;
        case 'PIN':
          nextStatus = 'PINNED';
          break;
        case 'ARCHIVE':
          nextStatus = 'ARCHIVED';
          break;
      }

      if (question.status === 'DELETED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Gelöschte Fragen können nicht weiter moderiert werden.',
        });
      }

      await prisma.qaQuestion.update({
        where: { id: question.id },
        data: { status: nextStatus },
      });

      const updated = await prisma.qaQuestion.findUnique({
        where: { id: question.id },
        select: {
          id: true,
          text: true,
          upvoteCount: true,
          status: true,
          createdAt: true,
          participantId: true,
        },
      });
      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Frage nicht gefunden.' });
      }

      return mapQaQuestion(updated);
    }),

  submit: publicProcedure
    .input(SubmitQaQuestionInputSchema)
    .output(QaQuestionDTOSchema)
    .mutation(async ({ input }) => {
      const participant = await prisma.participant.findUnique({
        where: { id: input.participantId },
        include: {
          session: {
            select: {
              id: true,
              type: true,
              qaEnabled: true,
              qaOpen: true,
              qaModerationMode: true,
              moderationMode: true,
              status: true,
            },
          },
        },
      });
      if (!participant || participant.sessionId !== input.sessionId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Teilnahme zur Session nicht gefunden.',
        });
      }

      const session = participant.session;
      if (!isQaEnabled(session)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Fragen sind in dieser Session nicht aktiviert.',
        });
      }
      if (!isQaOpenForParticipants(session)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Der Q&A-Kanal ist aktuell geschlossen.',
        });
      }
      assertQaSessionOpenForParticipants(session.status);

      const existingCount = await prisma.qaQuestion.count({
        where: {
          sessionId: input.sessionId,
          participantId: input.participantId,
        },
      });
      if (existingCount >= 3) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Du kannst pro Session maximal 3 Fragen einreichen.',
        });
      }

      const question = await prisma.qaQuestion.create({
        data: {
          sessionId: input.sessionId,
          participantId: input.participantId,
          text: input.text.trim(),
          status: session.qaModerationMode || session.moderationMode ? 'PENDING' : 'ACTIVE',
        },
        include: {
          upvotes: {
            where: { participantId: input.participantId },
            select: { participantId: true, direction: true },
          },
        },
      });

      return mapQaQuestion(question, input.participantId);
    }),

  deleteOwn: publicProcedure
    .input(UpvoteQaQuestionInputSchema)
    .output(z.object({ deleted: z.boolean() }))
    .mutation(async ({ input }) => {
      const question = await prisma.qaQuestion.findUnique({
        where: { id: input.questionId },
        select: { id: true, participantId: true, status: true, sessionId: true },
      });
      if (!question || question.status === 'DELETED') {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Frage nicht gefunden.' });
      }
      if (question.participantId !== input.participantId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Du kannst nur deine eigenen Fragen löschen.',
        });
      }
      const delSession = await prisma.session.findUnique({
        where: { id: question.sessionId },
        select: { type: true, qaEnabled: true, qaOpen: true, status: true },
      });
      if (delSession && !isQaOpenForParticipants(delSession)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Der Q&A-Kanal ist aktuell geschlossen.',
        });
      }
      assertQaSessionOpenForParticipants(delSession?.status);
      await prisma.qaQuestion.update({
        where: { id: input.questionId },
        data: { status: 'DELETED' },
      });
      return { deleted: true };
    }),

  upvote: publicProcedure
    .input(UpvoteQaQuestionInputSchema)
    .output(ToggleQaUpvoteOutputSchema)
    .mutation(async ({ input }) => {
      const question = await prisma.qaQuestion.findUnique({
        where: { id: input.questionId },
        include: {
          session: {
            select: {
              id: true,
              type: true,
              qaEnabled: true,
              qaOpen: true,
              status: true,
            },
          },
        },
      });
      if (!question || question.status === 'DELETED') {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Frage nicht gefunden.' });
      }
      if (!isQaEnabled(question.session)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Fragen sind in dieser Session nicht aktiviert.',
        });
      }
      if (!isQaOpenForParticipants(question.session)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Der Q&A-Kanal ist aktuell geschlossen.',
        });
      }
      assertQaSessionOpenForParticipants(question.session.status);
      if (!['ACTIVE', 'PINNED', 'ARCHIVED'].includes(question.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Diese Frage kann aktuell nicht bewertet werden.',
        });
      }
      if (question.participantId === input.participantId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Du kannst deine eigene Frage nicht bewerten.',
        });
      }

      const participant = await prisma.participant.findUnique({
        where: { id: input.participantId },
        select: { id: true, sessionId: true },
      });
      if (!participant || participant.sessionId !== question.sessionId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Teilnahme zur Session nicht gefunden.',
        });
      }

      const existing = await prisma.qaUpvote.findUnique({
        where: {
          qaQuestionId_participantId: {
            qaQuestionId: input.questionId,
            participantId: input.participantId,
          },
        },
      });

      if (existing && existing.direction === 'DOWN') {
        await prisma.$transaction([
          prisma.qaUpvote.update({
            where: { id: existing.id },
            data: { direction: 'UP' },
          }),
          prisma.qaQuestion.update({
            where: { id: input.questionId },
            data: { upvoteCount: { increment: 2 } },
          }),
        ]);

        const updated = await prisma.qaQuestion.findUnique({
          where: { id: input.questionId },
          select: { upvoteCount: true },
        });

        return {
          questionId: input.questionId,
          upvoted: true,
          upvoteCount: updated?.upvoteCount ?? question.upvoteCount + 2,
        };
      }

      if (existing) {
        await prisma.$transaction([
          prisma.qaUpvote.delete({ where: { id: existing.id } }),
          prisma.qaQuestion.update({
            where: { id: input.questionId },
            data: { upvoteCount: { decrement: 1 } },
          }),
        ]);

        const updated = await prisma.qaQuestion.findUnique({
          where: { id: input.questionId },
          select: { upvoteCount: true },
        });

        return {
          questionId: input.questionId,
          upvoted: false,
          upvoteCount: updated?.upvoteCount ?? Math.max(0, question.upvoteCount - 1),
        };
      }

      await prisma.$transaction([
        prisma.qaUpvote.create({
          data: {
            qaQuestionId: input.questionId,
            participantId: input.participantId,
          },
        }),
        prisma.qaQuestion.update({
          where: { id: input.questionId },
          data: { upvoteCount: { increment: 1 } },
        }),
      ]);

      const updated = await prisma.qaQuestion.findUnique({
        where: { id: input.questionId },
        select: { upvoteCount: true },
      });

      return {
        questionId: input.questionId,
        upvoted: true,
        upvoteCount: updated?.upvoteCount ?? question.upvoteCount + 1,
      };
    }),

  vote: publicProcedure
    .input(QaVoteInputSchema)
    .output(QaVoteOutputSchema)
    .mutation(async ({ input }) => {
      const question = await prisma.qaQuestion.findUnique({
        where: { id: input.questionId },
        include: {
          session: {
            select: { id: true, type: true, qaEnabled: true, qaOpen: true, status: true },
          },
        },
      });
      if (!question || question.status === 'DELETED') {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Frage nicht gefunden.' });
      }
      if (!isQaEnabled(question.session)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Fragen sind in dieser Session nicht aktiviert.',
        });
      }
      if (!isQaOpenForParticipants(question.session)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Der Q&A-Kanal ist aktuell geschlossen.',
        });
      }
      assertQaSessionOpenForParticipants(question.session.status);
      if (!['ACTIVE', 'PINNED', 'ARCHIVED'].includes(question.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Diese Frage kann aktuell nicht bewertet werden.',
        });
      }
      if (question.participantId === input.participantId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Du kannst deine eigene Frage nicht bewerten.',
        });
      }

      const participant = await prisma.participant.findUnique({
        where: { id: input.participantId },
        select: { id: true, sessionId: true },
      });
      if (!participant || participant.sessionId !== question.sessionId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Teilnahme zur Session nicht gefunden.',
        });
      }

      const existing = await prisma.qaUpvote.findUnique({
        where: {
          qaQuestionId_participantId: {
            qaQuestionId: input.questionId,
            participantId: input.participantId,
          },
        },
      });

      if (existing && existing.direction === input.direction) {
        // Same direction again → toggle off
        const delta = existing.direction === 'UP' ? -1 : 1;
        await prisma.$transaction([
          prisma.qaUpvote.delete({ where: { id: existing.id } }),
          prisma.qaQuestion.update({
            where: { id: input.questionId },
            data: { upvoteCount: { increment: delta } },
          }),
        ]);
        const updated = await prisma.qaQuestion.findUnique({
          where: { id: input.questionId },
          select: { upvoteCount: true },
        });
        return {
          questionId: input.questionId,
          myVote: null,
          upvoteCount: updated?.upvoteCount ?? question.upvoteCount + delta,
        };
      }

      if (existing) {
        // Switch direction: old was UP→DOWN or DOWN→UP, delta is ±2
        const delta = input.direction === 'UP' ? 2 : -2;
        await prisma.$transaction([
          prisma.qaUpvote.update({
            where: { id: existing.id },
            data: { direction: input.direction },
          }),
          prisma.qaQuestion.update({
            where: { id: input.questionId },
            data: { upvoteCount: { increment: delta } },
          }),
        ]);
        const updated = await prisma.qaQuestion.findUnique({
          where: { id: input.questionId },
          select: { upvoteCount: true },
        });
        return {
          questionId: input.questionId,
          myVote: input.direction,
          upvoteCount: updated?.upvoteCount ?? question.upvoteCount + delta,
        };
      }

      // New vote
      const delta = input.direction === 'UP' ? 1 : -1;
      await prisma.$transaction([
        prisma.qaUpvote.create({
          data: {
            qaQuestionId: input.questionId,
            participantId: input.participantId,
            direction: input.direction,
          },
        }),
        prisma.qaQuestion.update({
          where: { id: input.questionId },
          data: { upvoteCount: { increment: delta } },
        }),
      ]);
      const updated = await prisma.qaQuestion.findUnique({
        where: { id: input.questionId },
        select: { upvoteCount: true },
      });
      return {
        questionId: input.questionId,
        myVote: input.direction,
        upvoteCount: updated?.upvoteCount ?? question.upvoteCount + delta,
      };
    }),

  toggleModeration: hostProcedure
    .input(ToggleQaModerationInputSchema)
    .output(z.object({ enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      const session = await prisma.session.findFirst({
        where: { code: input.sessionCode.toUpperCase() },
        select: { id: true, status: true },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      assertQaSessionOpenForParticipants(session.status);
      const updated = await prisma.session.update({
        where: { id: session.id },
        data: { qaModerationMode: input.enabled },
        select: { qaModerationMode: true },
      });
      return { enabled: updated.qaModerationMode };
    }),

  onQuestionsUpdated: publicProcedure
    .input(GetQaQuestionsInputSchema)
    .subscription(async function* ({ input, ctx }) {
      let lastJson = '';
      let lastRevisionKey = '';
      let cachedParticipantCountForControversy: number | undefined;
      let participantCountCacheExpiresAt = 0;
      const sortMode = normalizeQaSortMode(input.moderatorView, input.sort);

      const gateSession = await prisma.session.findUnique({
        where: { id: input.sessionId },
        select: { id: true, code: true, type: true, qaEnabled: true, qaOpen: true },
      });
      if (!gateSession) {
        return;
      }
      if (!isQaEnabled(gateSession)) {
        yield [];
        return;
      }
      if (input.moderatorView) {
        await assertHostSessionAccessFromContext(ctx, gateSession.code);
      } else if (!isQaOpenForParticipants(gateSession)) {
        yield [];
        return;
      }

      while (true) {
        const session = await prisma.session.findUnique({
          where: { id: input.sessionId },
          select: { id: true, type: true, qaEnabled: true, qaOpen: true },
        });
        if (!session) {
          return;
        }

        if (!isQaEnabled(session)) {
          yield [];
          return;
        }
        if (!input.moderatorView && !isQaOpenForParticipants(session)) {
          yield [];
          return;
        }

        let participantCountForControversy: number | undefined;
        if (input.moderatorView && sortMode === 'CONTROVERSIAL') {
          const now = Date.now();
          if (
            cachedParticipantCountForControversy === undefined ||
            now >= participantCountCacheExpiresAt
          ) {
            cachedParticipantCountForControversy = await prisma.participant.count({
              where: { sessionId: input.sessionId },
            });
            participantCountCacheExpiresAt = now + QA_PARTICIPANT_COUNT_CACHE_MS;
          }
          participantCountForControversy = cachedParticipantCountForControversy;
        }

        const revisionKey = await getQaQuestionsRevisionKey(
          input.sessionId,
          input.moderatorView,
          input.participantId,
          participantCountForControversy,
        );
        if (revisionKey === lastRevisionKey) {
          await new Promise((resolve) => setTimeout(resolve, QA_SUBSCRIPTION_POLL_MS));
          continue;
        }
        lastRevisionKey = revisionKey;

        const payload = await buildQaQuestionPayloadFromDb(
          input.sessionId,
          input.participantId,
          input.moderatorView,
          sortMode,
          participantCountForControversy,
        );
        const json = JSON.stringify(payload);
        if (json !== lastJson) {
          lastJson = json;
          yield payload;
        }

        await new Promise((resolve) => setTimeout(resolve, QA_SUBSCRIPTION_POLL_MS));
      }
    }),
});
