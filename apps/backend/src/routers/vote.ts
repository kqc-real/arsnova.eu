/**
 * Vote-Router (Story 3.3b, 0.5).
 * submit: Stimme abgeben, Rate-Limit 1 Request/Sekunde pro Participant.
 */
import { TRPCError } from '@trpc/server';
import { SubmitVoteInputSchema } from '@arsnova/shared-types';
import { publicProcedure, router } from '../trpc';
import { prisma } from '../db';
import { checkVoteRate } from '../lib/rateLimit';

export const voteRouter = router({
  submit: publicProcedure
    .input(SubmitVoteInputSchema)
    .mutation(async ({ input }) => {
      const limit = await checkVoteRate(input.participantId);
      if (!limit.allowed) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Bitte warten Sie mindestens eine Sekunde zwischen zwei Abstimmungen.',
          cause: { retryAfterSeconds: limit.retryAfterSeconds },
        });
      }
      const participant = await prisma.participant.findFirst({
        where: { id: input.participantId, sessionId: input.sessionId },
        include: { session: true },
      });
      if (!participant) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Teilnehmende oder Session nicht gefunden.' });
      }
      if (participant.session.status === 'FINISHED') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Diese Session ist beendet.' });
      }
      const question = await prisma.question.findFirst({
        where: { id: input.questionId, quizId: participant.session.quizId ?? undefined },
      });
      if (!question) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Frage nicht gefunden.' });
      }
      const answerIds = input.answerIds ?? [];
      const vote = await prisma.vote.create({
        data: {
          sessionId: input.sessionId,
          participantId: input.participantId,
          questionId: input.questionId,
          freeText: input.freeText ?? null,
          ratingValue: input.ratingValue ?? null,
          responseTimeMs: input.responseTimeMs ?? null,
          score: 0, // Story 4.1: Berechnung in Session-Logik oder separatem Job
          selectedAnswers: answerIds.length
            ? { create: answerIds.map((answerOptionId: string) => ({ answerOptionId })) }
            : undefined,
        },
      });
      return { voteId: vote.id };
    }),
});
