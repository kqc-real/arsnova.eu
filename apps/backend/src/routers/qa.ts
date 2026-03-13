import { TRPCError } from '@trpc/server';
import {
  GetQaQuestionsInputSchema,
  ModerateQaQuestionInputSchema,
  QaQuestionDTOSchema,
  QaQuestionsListDTOSchema,
  SubmitQaQuestionInputSchema,
  ToggleQaUpvoteOutputSchema,
  UpvoteQaQuestionInputSchema,
} from '@arsnova/shared-types';
import { prisma } from '../db';
import { publicProcedure, router } from '../trpc';

function sortQuestions<T extends { status: string; upvoteCount: number; createdAt: Date | string }>(questions: T[]): T[] {
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
    upvotes?: Array<{ participantId: string }>;
  },
  participantId?: string,
) {
  return QaQuestionDTOSchema.parse({
    id: question.id,
    text: question.text,
    upvoteCount: question.upvoteCount,
    status: question.status,
    createdAt: question.createdAt.toISOString(),
    hasUpvoted: participantId
      ? (question.upvotes ?? []).some((upvote) => upvote.participantId === participantId)
      : false,
  });
}

export const qaRouter = router({
  list: publicProcedure
    .input(GetQaQuestionsInputSchema)
    .output(QaQuestionsListDTOSchema)
    .query(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { id: input.sessionId },
        select: {
          id: true,
          type: true,
          qaEnabled: true,
          qaModerationMode: true,
        },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      if (session.type !== 'Q_AND_A' && session.qaEnabled !== true) {
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
            ? { where: { participantId: input.participantId }, select: { participantId: true } }
            : false,
        },
      });

      return sortQuestions(questions).map((question) => mapQaQuestion(question, input.participantId));
    }),

  moderate: publicProcedure
    .input(ModerateQaQuestionInputSchema)
    .output(QaQuestionDTOSchema)
    .mutation(async ({ input }) => {
      const session = await prisma.session.findUnique({
        where: { code: input.sessionCode.toUpperCase() },
        select: {
          id: true,
          type: true,
          qaEnabled: true,
        },
      });
      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
      }
      if (session.type !== 'Q_AND_A' && session.qaEnabled !== true) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Fragen sind in dieser Session nicht aktiviert.' });
      }

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

      if (question.status === 'DELETED' && input.action !== 'DELETE') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Gelöschte Fragen können nicht weiter moderiert werden.' });
      }

      if (input.action === 'PIN') {
        await prisma.$transaction([
          prisma.qaQuestion.updateMany({
            where: {
              sessionId: session.id,
              status: 'PINNED',
              NOT: { id: question.id },
            },
            data: { status: 'ACTIVE' },
          }),
          prisma.qaQuestion.update({
            where: { id: question.id },
            data: { status: nextStatus },
          }),
        ]);
      } else {
        await prisma.qaQuestion.update({
          where: { id: question.id },
          data: { status: nextStatus },
        });
      }

      const updated = await prisma.qaQuestion.findUnique({
        where: { id: question.id },
        select: {
          id: true,
          text: true,
          upvoteCount: true,
          status: true,
          createdAt: true,
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
              qaModerationMode: true,
              moderationMode: true,
            },
          },
        },
      });
      if (!participant || participant.sessionId !== input.sessionId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Teilnahme zur Session nicht gefunden.' });
      }

      const session = participant.session;
      if (session.type !== 'Q_AND_A' && session.qaEnabled !== true) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Fragen sind in dieser Session nicht aktiviert.' });
      }

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
            select: { participantId: true },
          },
        },
      });

      return mapQaQuestion(question, input.participantId);
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
            },
          },
        },
      });
      if (!question || question.status === 'DELETED') {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Frage nicht gefunden.' });
      }
      if (question.session.type !== 'Q_AND_A' && question.session.qaEnabled !== true) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Fragen sind in dieser Session nicht aktiviert.' });
      }
      if (!['ACTIVE', 'PINNED', 'ARCHIVED'].includes(question.status)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Diese Frage kann aktuell nicht bewertet werden.' });
      }

      const participant = await prisma.participant.findUnique({
        where: { id: input.participantId },
        select: { id: true, sessionId: true },
      });
      if (!participant || participant.sessionId !== question.sessionId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Teilnahme zur Session nicht gefunden.' });
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

  onQuestionsUpdated: publicProcedure
    .input(GetQaQuestionsInputSchema)
    .subscription(async function* ({ input }) {
      let lastJson = '';

      while (true) {
        const session = await prisma.session.findUnique({
          where: { id: input.sessionId },
          select: { id: true, type: true, qaEnabled: true },
        });
        if (!session) {
          return;
        }

        if (session.type !== 'Q_AND_A' && session.qaEnabled !== true) {
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
              ? { where: { participantId: input.participantId }, select: { participantId: true } }
              : false,
          },
        });

        const payload = sortQuestions(questions).map((question) => mapQaQuestion(question, input.participantId));
        const json = JSON.stringify(payload);
        if (json !== lastJson) {
          lastJson = json;
          yield payload;
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }),
});
