/**
 * Vote-Router (Story 3.3b, 0.5).
 * submit: Stimme abgeben, Rate-Limit 1 Request/Sekunde pro Participant.
 */
import { TRPCError } from '@trpc/server';
import {
  SubmitVoteInputSchema,
  SubmitVoteOutputSchema,
  evaluateNumericAnswer,
  evaluateShortAnswer,
  hasAtMostNumericDecimalPlaces,
  normalizeShortTextValue,
  resolveEffectiveQuestionTimer,
  resolveNumericQuestionEvaluationSettings,
  resolveShortTextEvaluationKind,
  resolveShortTextMaxLength,
  usesNumericShortTextEvaluation,
  usesShortTextUnitEvaluation,
  resolveNumericTolerance,
  isNumericValueInBand,
  isNumericToleranceMode,
  resolveNumericEstimateToleranceMode,
  type QuestionType,
  type Difficulty,
  type NumericInputKind,
  type NumericUnitFamily,
  type NumericInputType,
  type ShortAnswerEvaluationMode,
  type ShortTextEvaluationKind,
  type ToleranceLevel,
} from '@arsnova/shared-types';
import { publicProcedure, router } from '../trpc';
import { prisma } from '../db';
import { checkVoteRate } from '../lib/rateLimit';
import {
  calculateVoteScore,
  getStreakMultiplier,
  questionAffectsStreak,
  SCORED_QUESTION_TYPES,
} from '../lib/quizScoring';
import { touchParticipantPresence } from '../lib/presence';
import { recordVoteActivity } from '../lib/loadSignal';
import { invalidateCurrentQuestionCachesForCode, recordVoteCachesForCode } from './session';

function normalizeNumericInputType(value: string | null | undefined): NumericInputType {
  return value === 'INTEGER' ? 'INTEGER' : 'DECIMAL';
}

export const voteRouter = router({
  submit: publicProcedure
    .input(SubmitVoteInputSchema)
    .output(SubmitVoteOutputSchema)
    .mutation(async ({ input }) => {
      const requestReceivedAtMs = Date.now();
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
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Teilnehmende oder Session nicht gefunden.',
        });
      }
      if (participant.session.status === 'FINISHED') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Diese Session ist beendet.' });
      }
      if (participant.session.status !== 'ACTIVE') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Die Frage ist nicht mehr aktiv.' });
      }
      void touchParticipantPresence(input.sessionId, input.participantId);
      void recordVoteActivity();
      const question = await prisma.question.findFirst({
        where: { id: input.questionId, quizId: participant.session.quizId ?? undefined },
        include: {
          answers: { select: { id: true, text: true, isCorrect: true } },
        },
      });
      if (!question) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Frage nicht gefunden.' });
      }
      const round = input.round ?? 1;
      if (
        typeof participant.session.currentQuestion === 'number' &&
        question.order !== participant.session.currentQuestion
      ) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Diese Frage ist nicht aktiv.' });
      }
      if (
        typeof participant.session.currentRound === 'number' &&
        round !== participant.session.currentRound
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Diese Abstimmungsrunde ist nicht aktiv.',
        });
      }

      const quiz = await prisma.quiz.findUnique({
        where: { id: participant.session.quizId ?? '' },
        select: { defaultTimer: true, timerScaleByDifficulty: true },
      });
      const timerSeconds =
        round === 2
          ? null
          : resolveEffectiveQuestionTimer(
              question.timer,
              quiz?.defaultTimer,
              question.difficulty as Difficulty,
              quiz?.timerScaleByDifficulty ?? true,
            );

      const statusChangedAtMs = participant.session.statusChangedAt
        ? new Date(participant.session.statusChangedAt).getTime()
        : null;
      const hasServerQuestionStart =
        statusChangedAtMs !== null && Number.isFinite(statusChangedAtMs);

      if (timerSeconds && timerSeconds > 0 && hasServerQuestionStart) {
        const deadline = statusChangedAtMs + timerSeconds * 1000;
        if (requestReceivedAtMs > deadline + 2000) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Die Zeit für diese Frage ist abgelaufen.',
          });
        }
      }

      const questionType = question.type as QuestionType;
      if (
        questionType === 'NUMERIC_ESTIMATE' &&
        round === 2 &&
        question.numericTwoRounds !== true
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Diese Schätzfrage ist nicht für eine zweite Runde konfiguriert.',
        });
      }
      const responseTimeMs = hasServerQuestionStart
        ? Math.max(0, requestReceivedAtMs - statusChangedAtMs)
        : (input.responseTimeMs ?? null);
      const answerIds = [...new Set(input.answerIds ?? [])];
      const allowedAnswerIds = new Set(question.answers.map((answer) => answer.id));
      const hasInvalidAnswerId = answerIds.some((answerId) => !allowedAnswerIds.has(answerId));
      const trimmedFreeText = input.freeText?.trim() ?? null;
      const shortTextEvaluationKind = resolveShortTextEvaluationKind(
        (question.shortTextEvaluationKind as ShortTextEvaluationKind | null | undefined) ??
          undefined,
      );
      const shortTextSettings = {
        caseSensitive: question.shortTextCaseSensitive ?? false,
        evaluationMode:
          (question.shortTextEvaluationMode as ShortAnswerEvaluationMode | null | undefined) ??
          'auto',
        toleranceLevel:
          (question.shortTextToleranceLevel as ToleranceLevel | null | undefined) ?? 'low',
        allowPartialCredit: question.shortTextAllowPartialCredit ?? true,
        trimWhitespace: question.shortTextTrimWhitespace ?? true,
        normalizeWhitespace: question.shortTextNormalizeWhitespace ?? true,
      };
      const numericSettings = resolveNumericQuestionEvaluationSettings({
        numericInputKind:
          (question.numericInputKind as NumericInputKind | null | undefined) ?? null,
        numericToleranceMode: isNumericToleranceMode(question.numericToleranceMode)
          ? question.numericToleranceMode
          : null,
        numericAbsoluteTolerance: question.numericAbsoluteTolerance ?? null,
        numericRelativeTolerancePercent: question.numericRelativeTolerancePercent ?? null,
        numericUnitFamily:
          (question.numericUnitFamily as NumericUnitFamily | null | undefined) ?? null,
        numericRequireUnit: question.numericRequireUnit ?? false,
        numericAcceptEquivalentUnits: question.numericAcceptEquivalentUnits ?? true,
      });
      const normalizedShortText = input.freeText
        ? normalizeShortTextValue(input.freeText, {
            caseSensitive: true,
            trimWhitespace: shortTextSettings.trimWhitespace,
            normalizeWhitespace: shortTextSettings.normalizeWhitespace,
          })
        : null;
      const freeText = questionType === 'SHORT_TEXT' ? normalizedShortText : trimmedFreeText;
      const numericShortTextEvaluation =
        questionType === 'SHORT_TEXT' && usesNumericShortTextEvaluation(shortTextEvaluationKind)
          ? evaluateNumericAnswer({
              modelAnswers: question.answers
                .filter((answer) => answer.isCorrect)
                .map((answer) => answer.text),
              studentAnswer: freeText ?? '',
              maxPoints: 1,
              settings: {
                inputKind: numericSettings.inputKind,
                toleranceMode: numericSettings.toleranceMode,
                absoluteTolerance: numericSettings.absoluteTolerance,
                relativeTolerancePercent: numericSettings.relativeTolerancePercent,
                unitFamily: usesShortTextUnitEvaluation(shortTextEvaluationKind)
                  ? numericSettings.unitFamily
                  : 'none',
                requireUnit: usesShortTextUnitEvaluation(shortTextEvaluationKind)
                  ? numericSettings.requireUnit
                  : false,
                acceptEquivalentUnits: usesShortTextUnitEvaluation(shortTextEvaluationKind)
                  ? numericSettings.acceptEquivalentUnits
                  : true,
              },
            })
          : null;

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
        case 'SHORT_TEXT': {
          if (answerIds.length > 0) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Kurzantwort-Fragen akzeptieren keine Antwortoptionen.',
            });
          }
          if (!freeText) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Kurzantwort darf nicht leer sein.',
            });
          }
          const maxLength = resolveShortTextMaxLength(question.shortTextMaxLength);
          if (freeText.length > maxLength) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Kurzantwort darf maximal ${maxLength} Zeichen lang sein.`,
            });
          }
          if (numericShortTextEvaluation?.feedbackCategory === 'invalid_input') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Kurzantwort muss als Zahl im unterstützten Format eingegeben werden.',
            });
          }
          break;
        }
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
        case 'NUMERIC_ESTIMATE': {
          if (answerIds.length > 0) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Numerische Schätzfragen akzeptieren keine Antwortoptionen.',
            });
          }
          if (input.numericValue === undefined || input.numericValue === null) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Für numerische Schätzfragen ist ein Zahlenwert erforderlich.',
            });
          }
          if (!isFinite(input.numericValue)) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ungültiger Zahlenwert.' });
          }
          const numMin = question.numericMin;
          const numMax = question.numericMax;
          if (numMin !== null && numMin !== undefined && input.numericValue < numMin) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Der Wert muss mindestens ${numMin} betragen.`,
            });
          }
          if (numMax !== null && numMax !== undefined && input.numericValue > numMax) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Der Wert darf höchstens ${numMax} betragen.`,
            });
          }
          const numInputType = normalizeNumericInputType(question.numericInputType);
          if (numInputType === 'INTEGER' && !Number.isInteger(input.numericValue)) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Für diese Frage ist eine ganze Zahl erforderlich.',
            });
          }
          if (
            numInputType === 'DECIMAL' &&
            question.numericDecimalPlaces !== null &&
            question.numericDecimalPlaces !== undefined
          ) {
            const decimals = question.numericDecimalPlaces;
            if (!hasAtMostNumericDecimalPlaces(input.numericValue, decimals)) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: `Maximal ${decimals} Nachkommastellen erlaubt.`,
              });
            }
          }
          break;
        }
        default:
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unbekannter Fragetyp.' });
      }

      if (questionType !== 'FREETEXT' && questionType !== 'SHORT_TEXT' && freeText) {
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
      if (questionType !== 'NUMERIC_ESTIMATE' && input.numericValue !== undefined) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'numericValue ist nur für numerische Schätzfragen erlaubt.',
        });
      }

      const correctAnswerIds = question.answers
        .filter((answer) => answer.isCorrect)
        .map((answer) => answer.id);

      const shortTextEvaluation =
        questionType === 'SHORT_TEXT'
          ? usesNumericShortTextEvaluation(shortTextEvaluationKind)
            ? numericShortTextEvaluation
            : evaluateShortAnswer({
                modelAnswers: question.answers
                  .filter((answer) => answer.isCorrect)
                  .map((answer) => answer.text),
                studentAnswer: freeText ?? '',
                maxPoints: 1,
                maxLength: question.shortTextMaxLength,
                settings: shortTextSettings,
              })
          : null;
      const shortTextMatchedAnswer =
        questionType === 'SHORT_TEXT' && shortTextEvaluation?.matchedModelAnswer
          ? (question.answers.find(
              (answer) =>
                answer.isCorrect && answer.text === shortTextEvaluation.matchedModelAnswer,
            ) ?? null)
          : null;

      let numericIsCorrectOverride: boolean | undefined;
      if (questionType === 'NUMERIC_ESTIMATE' && input.numericValue !== undefined) {
        const band = resolveNumericTolerance(
          resolveNumericEstimateToleranceMode(question.numericToleranceMode),
          {
            referenceValue: question.numericReferenceValue,
            tolerancePercent: question.numericTolerancePercent,
            intervalLeft: question.numericIntervalLeft,
            intervalRight: question.numericIntervalRight,
          },
        );
        numericIsCorrectOverride = band !== null && isNumericValueInBand(input.numericValue, band);
      }

      const baseScore = calculateVoteScore({
        type: questionType,
        difficulty: question.difficulty as Difficulty,
        selectedAnswerIds: answerIds,
        correctAnswerIds,
        freeText,
        correctShortTextAnswers: question.answers
          .filter((answer) => answer.isCorrect)
          .map((answer) => answer.text),
        shortTextEvaluationKind,
        shortTextMaxLength: question.shortTextMaxLength,
        shortTextCaseSensitive: shortTextSettings.caseSensitive,
        shortTextEvaluationMode: shortTextSettings.evaluationMode,
        shortTextToleranceLevel: shortTextSettings.toleranceLevel,
        shortTextAllowPartialCredit: shortTextSettings.allowPartialCredit,
        shortTextTrimWhitespace: shortTextSettings.trimWhitespace,
        shortTextNormalizeWhitespace: shortTextSettings.normalizeWhitespace,
        numericInputKind: numericSettings.inputKind,
        numericToleranceMode: numericSettings.toleranceMode,
        numericAbsoluteTolerance: numericSettings.absoluteTolerance,
        numericRelativeTolerancePercent: numericSettings.relativeTolerancePercent,
        numericUnitFamily: usesShortTextUnitEvaluation(shortTextEvaluationKind)
          ? numericSettings.unitFamily
          : 'none',
        numericRequireUnit: usesShortTextUnitEvaluation(shortTextEvaluationKind)
          ? numericSettings.requireUnit
          : false,
        numericAcceptEquivalentUnits: usesShortTextUnitEvaluation(shortTextEvaluationKind)
          ? numericSettings.acceptEquivalentUnits
          : true,
        responseTimeMs,
        timerDurationMs: timerSeconds ? timerSeconds * 1000 : null,
        isCorrectOverride: numericIsCorrectOverride,
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

      // --- Streak (Story 5.5) ---
      let streakCount = 0;
      let streakMultiplier = 1.0;

      if (questionAffectsStreak(questionType)) {
        const isCorrect = baseScore > 0;

        if (isCorrect) {
          // Letztes SC/MC-Vote derselben Runde (nach Zeit), nicht „letztes mit streakCount > 0“:
          // Nach einer falschen Antwort ist streakCount 0 — die alte Query hätte trotzdem ein
          // früheres richtiges Vote gefunden und die Serie fälschlich hochgezählt.
          const lastChoiceVote = await prisma.vote.findFirst({
            where: {
              sessionId: input.sessionId,
              participantId: input.participantId,
              round,
              question: { type: { in: [...SCORED_QUESTION_TYPES] } },
            },
            orderBy: { votedAt: 'desc' },
            select: { streakCount: true, score: true },
          });
          if (!lastChoiceVote || lastChoiceVote.score <= 0) {
            streakCount = 1;
          } else {
            streakCount = lastChoiceVote.streakCount + 1;
          }
        }
        // Falsche Antwort: streakCount bleibt 0
        streakMultiplier = getStreakMultiplier(streakCount);
      }

      const score = Math.round(baseScore * streakMultiplier);

      const vote = await prisma.vote.create({
        data: {
          sessionId: input.sessionId,
          participantId: input.participantId,
          questionId: input.questionId,
          freeText,
          ratingValue: input.ratingValue ?? null,
          numericValue: input.numericValue ?? null,
          responseTimeMs,
          score,
          streakCount,
          streakBonus: streakMultiplier,
          round,
          selectedAnswers: answerIds.length
            ? { create: answerIds.map((answerOptionId: string) => ({ answerOptionId })) }
            : undefined,
        },
      });
      if (participant.session.code) {
        recordVoteCachesForCode(participant.session.code, input.questionId, round, {
          answerIds: shortTextMatchedAnswer ? [shortTextMatchedAnswer.id] : answerIds,
          freeText,
          questionType,
          isCorrect:
            questionType === 'SHORT_TEXT' ? (shortTextEvaluation?.points ?? 0) > 0 : undefined,
          numericValue: input.numericValue ?? null,
        });
        invalidateCurrentQuestionCachesForCode(participant.session.code);
      }
      return { voteId: vote.id };
    }),
});
