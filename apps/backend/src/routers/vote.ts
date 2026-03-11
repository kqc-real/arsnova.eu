/**
 * Vote-Router (Story 3.3b, 0.5).
 * submit: Stimme abgeben, Rate-Limit 1 Request/Sekunde pro Participant.
 */
import { TRPCError } from '@trpc/server';
import {
  SubmitVoteInputSchema,
  SubmitVoteOutputSchema,
  type QuestionType,
  type Difficulty,
} from '@arsnova/shared-types';
import { publicProcedure, router } from '../trpc';
import { prisma } from '../db';
import { checkVoteRate } from '../lib/rateLimit';
import { calculateVoteScore } from '../lib/quizScoring';

export const voteRouter = router({
  submit: publicProcedure
    .input(SubmitVoteInputSchema)
    .output(SubmitVoteOutputSchema)
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
      if (participant.session.status !== 'ACTIVE') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Die Frage ist nicht mehr aktiv.' });
      }
      const question = await prisma.question.findFirst({
        where: { id: input.questionId, quizId: participant.session.quizId ?? undefined },
        include: { answers: { select: { id: true, isCorrect: true } } },
      });
      if (!question) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Frage nicht gefunden.' });
      }

      if (question.timer && question.timer > 0 && participant.session.statusChangedAt) {
        const deadline = new Date(participant.session.statusChangedAt).getTime() + question.timer * 1000;
        if (Date.now() > deadline + 2000) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Die Zeit für diese Frage ist abgelaufen.' });
        }
      }

      const questionType = question.type as QuestionType;
      const answerIds = [...new Set(input.answerIds ?? [])];
      const allowedAnswerIds = new Set(question.answers.map((answer) => answer.id));
      const hasInvalidAnswerId = answerIds.some((answerId) => !allowedAnswerIds.has(answerId));
      const freeText = input.freeText?.trim() ?? null;

      if (hasInvalidAnswerId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Mindestens eine Antwortoption gehört nicht zu dieser Frage.',
        });
      }

      switch (questionType) {
        case 'SINGLE_CHOICE':
          if (answerIds.length !== 1) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Bei Single Choice muss genau eine Antwort ausgewählt werden.',
            });
          }
          break;
        case 'MULTIPLE_CHOICE':
          if (answerIds.length < 1) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Bei Multiple Choice muss mindestens eine Antwort ausgewählt werden.',
            });
          }
          break;
        case 'SURVEY':
          if (answerIds.length < 1) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Bei Umfragen muss mindestens eine Option ausgewählt werden.',
            });
          }
          break;
        case 'FREETEXT':
          if (answerIds.length > 0) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Freitext-Fragen akzeptieren keine Antwortoptionen.',
            });
          }
          if (!freeText) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Freitext-Antwort darf nicht leer sein.',
            });
          }
          break;
        case 'RATING':
          if (answerIds.length > 0) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Rating-Fragen akzeptieren keine Antwortoptionen.',
            });
          }
          if (input.ratingValue === undefined || input.ratingValue === null) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Für Rating-Fragen ist ein Skalenwert erforderlich.',
            });
          }
          {
            const min = question.ratingMin ?? 1;
            const max = question.ratingMax ?? 5;
            if (input.ratingValue < min || input.ratingValue > max) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: `Rating-Wert muss zwischen ${min} und ${max} liegen.`,
              });
            }
          }
          break;
        default:
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unbekannter Fragetyp.' });
      }

      if (questionType !== 'FREETEXT' && freeText) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Freitext ist nur für Freitext-Fragen erlaubt.',
        });
      }
      if (questionType !== 'RATING' && input.ratingValue !== undefined) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'ratingValue ist nur für Rating-Fragen erlaubt.',
        });
      }

      const round = input.round ?? 1;

      const quiz = await prisma.quiz.findUnique({
        where: { id: participant.session.quizId ?? '' },
        select: { defaultTimer: true },
      });
      const timerSeconds = question.timer ?? quiz?.defaultTimer ?? null;

      const score = calculateVoteScore({
        type: questionType,
        difficulty: question.difficulty as Difficulty,
        selectedAnswerIds: answerIds,
        correctAnswerIds: question.answers
          .filter((answer) => answer.isCorrect)
          .map((answer) => answer.id),
        responseTimeMs: input.responseTimeMs ?? null,
        timerDurationMs: timerSeconds ? timerSeconds * 1000 : null,
      });
      const existing = await prisma.vote.findUnique({
        where: {
          sessionId_participantId_questionId_round: {
            sessionId: input.sessionId,
            participantId: input.participantId,
            questionId: input.questionId,
            round,
          },
        },
        select: { id: true },
      });
      if (existing) {
        return { voteId: existing.id };
      }

      const vote = await prisma.vote.create({
        data: {
          sessionId: input.sessionId,
          participantId: input.participantId,
          questionId: input.questionId,
          freeText,
          ratingValue: input.ratingValue ?? null,
          responseTimeMs: input.responseTimeMs ?? null,
          score,
          round,
          selectedAnswers: answerIds.length
            ? { create: answerIds.map((answerOptionId: string) => ({ answerOptionId })) }
            : undefined,
        },
      });
      return { voteId: vote.id };
    }),
});
