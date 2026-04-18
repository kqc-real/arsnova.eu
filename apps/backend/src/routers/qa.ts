import { TRPCError } from '@trpc/server';
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

function sortQuestions<T extends { status: string; upvoteCount: number; createdAt: Date | string }>(
  questions: T[],
): T[] {
  const statusOrder = new Map([
    ['PINNED', 0],
    ['ACTIVE', 1],
    ['PENDING', 2],
    ['ARCHIVED', 3],
  ]);

  return [...questions].sort((left, right) => {
    const statusDiff = (statusOrder.get(left.status) ?? 99) - (statusOrder.get(right.status) ?? 99);
    if (statusDiff !== 0) {
      return statusDiff;
    }
    if (right.upvoteCount !== left.upvoteCount) {
      return right.upvoteCount - left.upvoteCount;
    }
    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });
}

function mapQaQuestion(
  question: {
    id: string;
    text: string;
    upvoteCount: number;
    status: 'PENDING' | 'ACTIVE' | 'PINNED' | 'ARCHIVED' | 'DELETED';
    createdAt: Date;
    participantId: string;
    upvotes?: Array<{ participantId: string; direction?: string }>;
  },
  participantId?: string,
) {
  const myUpvote = participantId
    ? (question.upvotes ?? []).find((v) => v.participantId === participantId)
    : undefined;
  return QaQuestionDTOSchema.parse({
    id: question.id,
    text: question.text,
    upvoteCount: question.upvoteCount,
    status: question.status,
    createdAt: question.createdAt.toISOString(),
    myVote: myUpvote ? (myUpvote.direction === 'DOWN' ? 'DOWN' : 'UP') : null,
    isOwn: !!participantId && question.participantId === participantId,
    hasUpvoted: !!myUpvote && myUpvote.direction !== 'DOWN',
  });
}

export const qaRouter = router({
  list: publicProcedure
    .input(GetQaQuestionsInputSchema)
    .output(QaQuestionsListDTOSchema)
    .query(async ({ input, ctx }) => {
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

      const questions = await prisma.qaQuestion.findMany({
        where: {
          sessionId: session.id,
          ...(input.moderatorView
            ? {}
            : input.participantId
              ? {
                  OR: [
                    { status: { in: ['ACTIVE', 'PINNED', 'ARCHIVED'] } },
                    { status: 'PENDING', participantId: input.participantId },
                  ],
                }
              : { status: { not: 'DELETED' } }),
        },
        include: {
          upvotes: input.participantId
            ? {
                where: { participantId: input.participantId },
                select: { participantId: true, direction: true },
              }
            : false,
        },
      });

      return sortQuestions(questions).map((question) =>
        mapQaQuestion(question, input.participantId),
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
        case 'DELETE':
          nextStatus = 'DELETED';
          break;
      }

      if (question.status === 'DELETED' && input.action === 'DELETE') {
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

        const questions = await prisma.qaQuestion.findMany({
          where: {
            sessionId: input.sessionId,
            ...(input.moderatorView
              ? {}
              : input.participantId
                ? {
                    OR: [
                      { status: { in: ['ACTIVE', 'PINNED', 'ARCHIVED'] } },
                      { status: 'PENDING', participantId: input.participantId },
                    ],
                  }
                : { status: { not: 'DELETED' } }),
          },
          include: {
            upvotes: input.participantId
              ? {
                  where: { participantId: input.participantId },
                  select: { participantId: true, direction: true },
                }
              : false,
          },
        });

        const payload = sortQuestions(questions).map((question) =>
          mapQaQuestion(question, input.participantId),
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
