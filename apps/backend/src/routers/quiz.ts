/**
 * Quiz-Router (Story 2.1a).
 * quiz.upload: Quiz-Daten beim Live-Schalten an den Server übertragen und in PostgreSQL speichern.
 */
import { randomUUID } from 'node:crypto';
import {
  NUMERIC_DEFAULT_INPUT_KIND,
  NUMERIC_DEFAULT_TOLERANCE_MODE,
  NUMERIC_DEFAULT_UNIT_FAMILY,
  SHORT_TEXT_DEFAULT_EVALUATION_KIND,
  QuizUploadInputSchema,
  QuizUploadOutputSchema,
  GetLearningObjectiveDerivationProgressInputSchema,
  GetLearningObjectiveDerivationProgressOutputSchema,
  LEARNING_OBJECTIVE_DERIVATION_SCHEMA_VERSION,
  LearningObjectiveDerivationResultSchema,
  PrepareLearningObjectiveDerivationInputSchema,
  PrepareLearningObjectiveDerivationOutputSchema,
  RunLearningObjectiveDerivationInputSchema,
  SHORT_TEXT_DEFAULT_EVALUATION_MODE,
  SHORT_TEXT_DEFAULT_TOLERANCE_LEVEL,
  createLegacyQuizHistoryAccessProof,
  isNumericToleranceMode,
  resolveNumericEstimateToleranceMode,
  resolveShortTextMaxLength,
  type NumericInputKind,
  type NumericUnitFamily,
  type QuizUploadInput,
  type ShortTextEvaluationKind,
  type ShortAnswerEvaluationMode,
  type ToleranceLevel,
  questionSupportsConfidence,
  questionShufflesParticipantChoiceAnswers,
} from '@arsnova/shared-types';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import { publicProcedure, quizUploadAttemptProcedure, resolveClientIp, router } from '../trpc';
import { prisma } from '../db';
import { answerOptionOrderBy } from '../lib/answerOptionOrder';
import {
  checkLearningObjectiveDerivationPrepareRate,
  checkQuizUploadStorageRate,
} from '../lib/rateLimit';
import { calculateQuizUploadComplexity } from '../lib/publicCreateCapacity';
import { buildQuizLearningObjectiveBundleCreate } from '../lib/sessionLearningObjectives';
import {
  finalizeLearningObjectiveDerivationCapability,
  issueLearningObjectiveDerivationCapability,
  reserveLearningObjectiveDerivationCapability,
} from '../lib/learningObjectiveDerivationCapability';
import { deriveLearningObjectiveDrafts } from '../lib/learningObjectiveDerivation';
import {
  readLearningObjectiveDerivationProgress,
  writeLearningObjectiveDerivationProgress,
} from '../lib/learningObjectiveDerivationProgress';

function buildQuizUploadPayloadFromStoredQuiz(quiz: {
  historyScopeId: string | null;
  name: string;
  description: string | null;
  motifImageUrl: string | null;
  motifImageCredit: string | null;
  showLeaderboard: boolean;
  allowCustomNicknames: boolean;
  defaultTimer: number | null;
  timerScaleByDifficulty: boolean;
  enableTimerAccommodation: boolean;
  enableSoundEffects: boolean;
  enableRewardEffects: boolean;
  enableMotivationMessages: boolean;
  enableEmojiReactions: boolean;
  showQuestionTypeIndicators: boolean;
  anonymousMode: boolean;
  teamMode: boolean;
  teamCount: number | null;
  teamAssignment: 'AUTO' | 'MANUAL';
  teamNames: string[];
  backgroundMusic: string | null;
  nicknameTheme: QuizUploadInput['nicknameTheme'];
  bonusTokenCount: number | null;
  readingPhaseEnabled: boolean;
  preset: 'PLAYFUL' | 'SERIOUS' | string;
  questions: Array<{
    text: string;
    type: QuizUploadInput['questions'][number]['type'];
    timer: number | null;
    difficulty: QuizUploadInput['questions'][number]['difficulty'];
    order: number;
    skipReadingPhase: boolean;
    ratingMin: number | null;
    ratingMax: number | null;
    ratingLabelMin: string | null;
    ratingLabelMax: string | null;
    shortTextEvaluationKind: string;
    shortTextMaxLength: number | null;
    shortTextCaseSensitive: boolean;
    shortTextEvaluationMode: string;
    shortTextToleranceLevel: string;
    shortTextAllowPartialCredit: boolean;
    shortTextTrimWhitespace: boolean;
    shortTextNormalizeWhitespace: boolean;
    numericInputKind: string | null;
    numericToleranceMode: string | null;
    numericAbsoluteTolerance: number | null;
    numericRelativeTolerancePercent: number | null;
    numericUnitFamily: string | null;
    numericRequireUnit: boolean;
    numericAcceptEquivalentUnits: boolean;
    numericReferenceValue: number | null;
    numericTolerancePercent: number | null;
    numericIntervalLeft: number | null;
    numericIntervalRight: number | null;
    numericInputType: string | null;
    numericDecimalPlaces: number | null;
    numericMin: number | null;
    numericMax: number | null;
    numericTwoRounds: boolean;
    confidenceEnabled: boolean;
    confidenceLabelLow: string | null;
    confidenceLabelHigh: string | null;
    shuffleAnswerOptions?: boolean;
    answers: Array<{
      text: string;
      isCorrect: boolean;
    }>;
  }>;
}): QuizUploadInput {
  return {
    ...(quiz.historyScopeId ? { historyScopeId: quiz.historyScopeId } : {}),
    name: quiz.name,
    ...(quiz.description ? { description: quiz.description } : {}),
    motifImageUrl: quiz.motifImageUrl ?? null,
    motifImageCredit: quiz.motifImageCredit ?? null,
    showLeaderboard: quiz.showLeaderboard,
    allowCustomNicknames: quiz.allowCustomNicknames,
    defaultTimer: quiz.defaultTimer,
    timerScaleByDifficulty: quiz.timerScaleByDifficulty,
    enableTimerAccommodation: quiz.enableTimerAccommodation ?? true,
    enableSoundEffects: quiz.enableSoundEffects,
    enableRewardEffects: quiz.enableRewardEffects,
    enableMotivationMessages: quiz.enableMotivationMessages,
    enableEmojiReactions: quiz.enableEmojiReactions,
    showQuestionTypeIndicators: quiz.showQuestionTypeIndicators,
    anonymousMode: quiz.anonymousMode,
    teamMode: quiz.teamMode,
    teamCount: quiz.teamCount ?? undefined,
    teamAssignment: quiz.teamAssignment,
    teamNames: quiz.teamNames,
    backgroundMusic: quiz.backgroundMusic ?? undefined,
    nicknameTheme: quiz.nicknameTheme,
    bonusTokenCount: quiz.bonusTokenCount ?? undefined,
    readingPhaseEnabled: quiz.readingPhaseEnabled,
    preset: quiz.preset === 'SERIOUS' ? 'SERIOUS' : 'PLAYFUL',
    questions: quiz.questions.map((question) => ({
      text: question.text,
      type: question.type,
      timer: question.timer,
      difficulty: question.difficulty,
      order: question.order,
      skipReadingPhase: question.skipReadingPhase,
      ratingMin: question.ratingMin ?? undefined,
      ratingMax: question.ratingMax ?? undefined,
      ratingLabelMin: question.ratingLabelMin ?? undefined,
      ratingLabelMax: question.ratingLabelMax ?? undefined,
      ...(question.type === 'SHORT_TEXT'
        ? {
            shortTextEvaluationKind:
              (question.shortTextEvaluationKind as ShortTextEvaluationKind | undefined) ??
              SHORT_TEXT_DEFAULT_EVALUATION_KIND,
            shortTextMaxLength: resolveShortTextMaxLength(question.shortTextMaxLength),
            shortTextCaseSensitive: question.shortTextCaseSensitive ?? false,
            shortTextEvaluationMode:
              (question.shortTextEvaluationMode as ShortAnswerEvaluationMode) ??
              SHORT_TEXT_DEFAULT_EVALUATION_MODE,
            shortTextToleranceLevel:
              (question.shortTextToleranceLevel as ToleranceLevel) ??
              SHORT_TEXT_DEFAULT_TOLERANCE_LEVEL,
            shortTextAllowPartialCredit: question.shortTextAllowPartialCredit ?? true,
            shortTextTrimWhitespace: question.shortTextTrimWhitespace ?? true,
            shortTextNormalizeWhitespace: question.shortTextNormalizeWhitespace ?? true,
            numericInputKind:
              (question.numericInputKind as NumericInputKind | undefined) ??
              NUMERIC_DEFAULT_INPUT_KIND,
            numericToleranceMode: isNumericToleranceMode(question.numericToleranceMode)
              ? question.numericToleranceMode
              : NUMERIC_DEFAULT_TOLERANCE_MODE,
            numericAbsoluteTolerance: question.numericAbsoluteTolerance ?? undefined,
            numericRelativeTolerancePercent: question.numericRelativeTolerancePercent ?? undefined,
            numericUnitFamily:
              (question.numericUnitFamily as NumericUnitFamily | undefined) ??
              NUMERIC_DEFAULT_UNIT_FAMILY,
            numericRequireUnit: question.numericRequireUnit ?? false,
            numericAcceptEquivalentUnits: question.numericAcceptEquivalentUnits ?? true,
          }
        : {}),
      ...(question.type === 'NUMERIC_ESTIMATE'
        ? {
            numericToleranceMode: resolveNumericEstimateToleranceMode(
              question.numericToleranceMode,
            ),
            numericReferenceValue: question.numericReferenceValue ?? undefined,
            numericTolerancePercent: question.numericTolerancePercent ?? undefined,
            numericIntervalLeft: question.numericIntervalLeft ?? undefined,
            numericIntervalRight: question.numericIntervalRight ?? undefined,
            numericInputType: question.numericInputType === 'INTEGER' ? 'INTEGER' : 'DECIMAL',
            numericDecimalPlaces: question.numericDecimalPlaces ?? undefined,
            numericMin: question.numericMin ?? undefined,
            numericMax: question.numericMax ?? undefined,
            numericTwoRounds: question.numericTwoRounds ?? false,
          }
        : {}),
      ...(questionSupportsConfidence(question.type)
        ? {
            confidenceEnabled: question.confidenceEnabled ?? false,
            confidenceLabelLow: question.confidenceLabelLow ?? undefined,
            confidenceLabelHigh: question.confidenceLabelHigh ?? undefined,
          }
        : {}),
      ...(questionShufflesParticipantChoiceAnswers(question.type) &&
      question.shuffleAnswerOptions === false
        ? { shuffleAnswerOptions: false as const }
        : {}),
      answers: question.answers.map((answer) => ({
        text: answer.text,
        isCorrect: answer.isCorrect,
      })),
    })),
  };
}

export const quizRouter = router({
  /**
   * Explicit preparation action for local quiz editing. It grants no data
   * access; it only issues a short-lived, request-bound CPU-work bearer.
   */
  prepareLearningObjectiveDerivation: publicProcedure
    .input(PrepareLearningObjectiveDerivationInputSchema)
    .output(PrepareLearningObjectiveDerivationOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const limit = await checkLearningObjectiveDerivationPrepareRate(resolveClientIp(ctx.req).ip);
      if (!limit.allowed) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Zu viele vorbereitete Lernziel-Ableitungen. Bitte später erneut versuchen.',
          cause: { retryAfterSeconds: limit.retryAfterSeconds },
        });
      }
      try {
        return await issueLearningObjectiveDerivationCapability(input);
      } catch {
        throw new TRPCError({
          code: 'SERVICE_UNAVAILABLE',
          message: 'Lernziel-Ableitung kann vorübergehend nicht vorbereitet werden.',
        });
      }
    }),

  /** One-shot capability reservation is the sole authorization for CPU work. */
  deriveLearningObjectives: publicProcedure
    .input(RunLearningObjectiveDerivationInputSchema)
    .output(LearningObjectiveDerivationResultSchema)
    .mutation(async ({ input, signal }) => {
      const reserved = await reserveLearningObjectiveDerivationCapability(input).catch(() => {
        throw new TRPCError({
          code: 'SERVICE_UNAVAILABLE',
          message: 'Lernziel-Ableitung kann vorübergehend nicht autorisiert werden.',
        });
      });
      if (!reserved) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Ableitungs-Capability ist ungültig oder abgelaufen.',
        });
      }

      const { capability, ...derivationInput } = input;
      try {
        return await deriveLearningObjectiveDrafts(derivationInput, {
          signal,
          onProgress: async (progress) => {
            await writeLearningObjectiveDerivationProgress({
              schemaVersion: LEARNING_OBJECTIVE_DERIVATION_SCHEMA_VERSION,
              operationId: derivationInput.operationId,
              quizId: derivationInput.quizId,
              expectedBundleRevision: derivationInput.expectedBundleRevision,
              progress,
            });
          },
        });
      } finally {
        // Reserve already consumed the bearer atomically. A transient Redis
        // cleanup failure must not replace a valid runtime result (or its
        // original error); the tombstone reservation expires on its own.
        await finalizeLearningObjectiveDerivationCapability(capability).catch(() => undefined);
      }
    }),

  getLearningObjectiveDerivationProgress: publicProcedure
    .input(GetLearningObjectiveDerivationProgressInputSchema)
    .output(GetLearningObjectiveDerivationProgressOutputSchema)
    .query(async ({ input }) => {
      const progress = await readLearningObjectiveDerivationProgress(input).catch(() => null);
      return {
        ...input,
        found: progress !== null,
        progress,
      };
    }),

  /**
   * Quiz inkl. Fragen und Antwortoptionen in der DB anlegen (Story 2.1a).
   * Wird vom Frontend vor session.create aufgerufen; die zurückgegebene quizId wird an session.create übergeben.
   */
  upload: quizUploadAttemptProcedure
    .input(QuizUploadInputSchema)
    .output(QuizUploadOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const payloadBytes = new TextEncoder().encode(JSON.stringify(input)).byteLength;
      const limit = await checkQuizUploadStorageRate(resolveClientIp(ctx.req).ip, {
        payloadBytes,
        complexity: calculateQuizUploadComplexity(input),
      });
      if (!limit.allowed) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Zu viele Quiz-Uploads. Bitte später erneut versuchen.',
          cause: { retryAfterSeconds: limit.retryAfterSeconds },
        });
      }
      const historyScopeId = input.historyScopeId ?? null;
      const questionsWithServerIds = input.questions.map((question) => ({
        question,
        serverQuestionId: randomUUID(),
      }));
      const questionIdBySourceId = new Map(
        questionsWithServerIds.flatMap(({ question, serverQuestionId }) =>
          question.sourceQuestionId
            ? ([[question.sourceQuestionId, serverQuestionId]] as const)
            : [],
        ),
      );
      const quiz = await prisma.$transaction(async (tx) => {
        const createdQuiz = await tx.quiz.create({
          data: {
            sourceQuizId: input.sourceQuizId ?? null,
            historyScopeId,
            name: input.name,
            description: input.description ?? null,
            motifImageUrl: input.motifImageUrl ?? null,
            motifImageCredit: input.motifImageCredit ?? null,
            showLeaderboard: input.showLeaderboard,
            allowCustomNicknames: input.allowCustomNicknames,
            defaultTimer: input.defaultTimer ?? null,
            timerScaleByDifficulty: input.timerScaleByDifficulty ?? true,
            enableTimerAccommodation: input.enableTimerAccommodation ?? false,
            enableSoundEffects: input.enableSoundEffects,
            enableRewardEffects: input.enableRewardEffects,
            enableMotivationMessages: input.enableMotivationMessages,
            enableEmojiReactions: input.enableEmojiReactions,
            showQuestionTypeIndicators: input.showQuestionTypeIndicators ?? true,
            anonymousMode: input.anonymousMode,
            teamMode: input.teamMode,
            teamCount: input.teamCount ?? null,
            teamAssignment: input.teamAssignment ?? 'AUTO',
            teamNames: input.teamNames ?? [],
            backgroundMusic: input.backgroundMusic ?? null,
            nicknameTheme: input.nicknameTheme,
            bonusTokenCount: input.bonusTokenCount ?? null,
            readingPhaseEnabled: input.readingPhaseEnabled ?? true,
            preset: input.preset ?? 'PLAYFUL',
            questions: {
              create: questionsWithServerIds.map(({ question: q, serverQuestionId }) => ({
                id: serverQuestionId,
                sourceQuestionId: q.sourceQuestionId ?? null,
                text: q.text,
                type: q.type,
                timer: q.timer ?? input.defaultTimer ?? null,
                difficulty: q.difficulty,
                order: q.order,
                skipReadingPhase: q.skipReadingPhase ?? false,
                ratingMin: q.ratingMin ?? null,
                ratingMax: q.ratingMax ?? null,
                ratingLabelMin: q.ratingLabelMin ?? null,
                ratingLabelMax: q.ratingLabelMax ?? null,
                shortTextEvaluationKind:
                  q.type === 'SHORT_TEXT'
                    ? (q.shortTextEvaluationKind ?? SHORT_TEXT_DEFAULT_EVALUATION_KIND)
                    : SHORT_TEXT_DEFAULT_EVALUATION_KIND,
                shortTextMaxLength:
                  q.type === 'SHORT_TEXT' ? resolveShortTextMaxLength(q.shortTextMaxLength) : null,
                shortTextCaseSensitive:
                  q.type === 'SHORT_TEXT' ? (q.shortTextCaseSensitive ?? false) : false,
                shortTextEvaluationMode:
                  q.type === 'SHORT_TEXT'
                    ? (q.shortTextEvaluationMode ?? SHORT_TEXT_DEFAULT_EVALUATION_MODE)
                    : SHORT_TEXT_DEFAULT_EVALUATION_MODE,
                shortTextToleranceLevel:
                  q.type === 'SHORT_TEXT'
                    ? (q.shortTextToleranceLevel ?? SHORT_TEXT_DEFAULT_TOLERANCE_LEVEL)
                    : SHORT_TEXT_DEFAULT_TOLERANCE_LEVEL,
                shortTextAllowPartialCredit:
                  q.type === 'SHORT_TEXT' ? (q.shortTextAllowPartialCredit ?? true) : true,
                shortTextTrimWhitespace:
                  q.type === 'SHORT_TEXT' ? (q.shortTextTrimWhitespace ?? true) : true,
                shortTextNormalizeWhitespace:
                  q.type === 'SHORT_TEXT' ? (q.shortTextNormalizeWhitespace ?? true) : true,
                numericInputKind:
                  q.type === 'SHORT_TEXT'
                    ? (q.numericInputKind ?? NUMERIC_DEFAULT_INPUT_KIND)
                    : null,
                numericToleranceMode:
                  q.type === 'SHORT_TEXT'
                    ? isNumericToleranceMode(q.numericToleranceMode)
                      ? q.numericToleranceMode
                      : NUMERIC_DEFAULT_TOLERANCE_MODE
                    : q.type === 'NUMERIC_ESTIMATE'
                      ? resolveNumericEstimateToleranceMode(q.numericToleranceMode)
                      : null,
                numericAbsoluteTolerance:
                  q.type === 'SHORT_TEXT' ? (q.numericAbsoluteTolerance ?? null) : null,
                numericRelativeTolerancePercent:
                  q.type === 'SHORT_TEXT' ? (q.numericRelativeTolerancePercent ?? null) : null,
                numericUnitFamily:
                  q.type === 'SHORT_TEXT'
                    ? (q.numericUnitFamily ?? NUMERIC_DEFAULT_UNIT_FAMILY)
                    : null,
                numericRequireUnit:
                  q.type === 'SHORT_TEXT' ? (q.numericRequireUnit ?? false) : false,
                numericAcceptEquivalentUnits:
                  q.type === 'SHORT_TEXT' ? (q.numericAcceptEquivalentUnits ?? true) : true,
                numericReferenceValue:
                  q.type === 'NUMERIC_ESTIMATE' ? (q.numericReferenceValue ?? null) : null,
                numericTolerancePercent:
                  q.type === 'NUMERIC_ESTIMATE' ? (q.numericTolerancePercent ?? null) : null,
                numericIntervalLeft:
                  q.type === 'NUMERIC_ESTIMATE' ? (q.numericIntervalLeft ?? null) : null,
                numericIntervalRight:
                  q.type === 'NUMERIC_ESTIMATE' ? (q.numericIntervalRight ?? null) : null,
                numericInputType:
                  q.type === 'NUMERIC_ESTIMATE' ? (q.numericInputType ?? null) : null,
                numericDecimalPlaces:
                  q.type === 'NUMERIC_ESTIMATE' ? (q.numericDecimalPlaces ?? null) : null,
                numericMin: q.type === 'NUMERIC_ESTIMATE' ? (q.numericMin ?? null) : null,
                numericMax: q.type === 'NUMERIC_ESTIMATE' ? (q.numericMax ?? null) : null,
                numericTwoRounds:
                  q.type === 'NUMERIC_ESTIMATE' ? (q.numericTwoRounds ?? false) : false,
                confidenceEnabled:
                  questionSupportsConfidence(q.type) && (q.confidenceEnabled ?? false),
                confidenceLabelLow:
                  questionSupportsConfidence(q.type) && (q.confidenceEnabled ?? false)
                    ? (q.confidenceLabelLow ?? null)
                    : null,
                confidenceLabelHigh:
                  questionSupportsConfidence(q.type) && (q.confidenceEnabled ?? false)
                    ? (q.confidenceLabelHigh ?? null)
                    : null,
                matchingPairs:
                  q.type === 'MATCHING' ? (q.matchingPairs ?? Prisma.DbNull) : Prisma.DbNull,
                matchingShuffleRight:
                  q.type === 'MATCHING' ? (q.matchingShuffleRight ?? true) : true,
                orderingItems:
                  q.type === 'ORDERING' ? (q.orderingItems ?? Prisma.DbNull) : Prisma.DbNull,
                categories:
                  q.type === 'CATEGORIZATION' ? (q.categories ?? Prisma.DbNull) : Prisma.DbNull,
                categorizationItems:
                  q.type === 'CATEGORIZATION'
                    ? (q.categorizationItems ?? Prisma.DbNull)
                    : Prisma.DbNull,
                categorizationShuffleItems:
                  q.type === 'CATEGORIZATION' ? (q.categorizationShuffleItems ?? true) : true,
                shuffleAnswerOptions: questionShufflesParticipantChoiceAnswers(q.type)
                  ? (q.shuffleAnswerOptions ?? true)
                  : true,
                answers: {
                  create: q.answers.map((a, index) => ({
                    text: a.text,
                    isCorrect: a.isCorrect,
                    order: index,
                  })),
                },
              })),
            },
          },
        });
        if (input.learningObjectives) {
          await tx.quizLearningObjectiveBundle.create({
            data: {
              quizId: createdQuiz.id,
              ...buildQuizLearningObjectiveBundleCreate(
                input.learningObjectives,
                questionIdBySourceId,
              ),
            },
          });
        }
        return createdQuiz;
      });

      if (historyScopeId) {
        const legacyAccessProof = await createLegacyQuizHistoryAccessProof(input);
        const legacyCandidates = await prisma.quiz.findMany({
          where: {
            name: input.name,
            historyScopeId: null,
            id: { not: quiz.id },
          },
          select: {
            id: true,
            historyScopeId: true,
            name: true,
            description: true,
            motifImageUrl: true,
            motifImageCredit: true,
            showLeaderboard: true,
            allowCustomNicknames: true,
            defaultTimer: true,
            timerScaleByDifficulty: true,
            enableTimerAccommodation: true,
            enableSoundEffects: true,
            enableRewardEffects: true,
            enableMotivationMessages: true,
            enableEmojiReactions: true,
            showQuestionTypeIndicators: true,
            anonymousMode: true,
            teamMode: true,
            teamCount: true,
            teamAssignment: true,
            teamNames: true,
            backgroundMusic: true,
            nicknameTheme: true,
            bonusTokenCount: true,
            readingPhaseEnabled: true,
            preset: true,
            questions: {
              orderBy: { order: 'asc' },
              select: {
                text: true,
                type: true,
                timer: true,
                difficulty: true,
                order: true,
                skipReadingPhase: true,
                ratingMin: true,
                ratingMax: true,
                ratingLabelMin: true,
                ratingLabelMax: true,
                shortTextEvaluationKind: true,
                shortTextMaxLength: true,
                shortTextCaseSensitive: true,
                shortTextEvaluationMode: true,
                shortTextToleranceLevel: true,
                shortTextAllowPartialCredit: true,
                shortTextTrimWhitespace: true,
                shortTextNormalizeWhitespace: true,
                numericInputKind: true,
                numericToleranceMode: true,
                numericAbsoluteTolerance: true,
                numericRelativeTolerancePercent: true,
                numericUnitFamily: true,
                numericRequireUnit: true,
                numericAcceptEquivalentUnits: true,
                numericReferenceValue: true,
                numericTolerancePercent: true,
                numericIntervalLeft: true,
                numericIntervalRight: true,
                numericInputType: true,
                numericDecimalPlaces: true,
                numericMin: true,
                numericMax: true,
                numericTwoRounds: true,
                confidenceEnabled: true,
                confidenceLabelLow: true,
                confidenceLabelHigh: true,
                shuffleAnswerOptions: true,
                answers: {
                  orderBy: answerOptionOrderBy,
                  select: {
                    text: true,
                    isCorrect: true,
                  },
                },
              },
            },
          },
        });

        const matchingLegacyQuizIds: string[] = [];
        for (const candidate of legacyCandidates) {
          const candidateProof = await createLegacyQuizHistoryAccessProof(
            buildQuizUploadPayloadFromStoredQuiz(candidate),
          );
          if (candidateProof === legacyAccessProof) {
            matchingLegacyQuizIds.push(candidate.id);
          }
        }

        if (matchingLegacyQuizIds.length > 0) {
          await prisma.quiz.updateMany({
            where: {
              id: { in: matchingLegacyQuizIds },
              historyScopeId: null,
            },
            data: { historyScopeId },
          });
        }
      }

      return { quizId: quiz.id };
    }),
});
