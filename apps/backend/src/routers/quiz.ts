/**
 * Quiz-Router (Story 2.1a).
 * quiz.upload: Quiz-Daten beim Live-Schalten an den Server übertragen und in PostgreSQL speichern.
 */
import {
  QuizUploadInputSchema,
  QuizUploadOutputSchema,
  SHORT_TEXT_DEFAULT_EVALUATION_MODE,
  SHORT_TEXT_DEFAULT_TOLERANCE_LEVEL,
  createLegacyQuizHistoryAccessProof,
  resolveShortTextMaxLength,
  type QuizUploadInput,
  type ShortAnswerEvaluationMode,
  type ToleranceLevel,
} from '@arsnova/shared-types';
import { publicProcedure, router } from '../trpc';
import { prisma } from '../db';

function buildQuizUploadPayloadFromStoredQuiz(quiz: {
  historyScopeId: string | null;
  name: string;
  description: string | null;
  motifImageUrl: string | null;
  showLeaderboard: boolean;
  allowCustomNicknames: boolean;
  defaultTimer: number | null;
  timerScaleByDifficulty: boolean;
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
    shortTextMaxLength: number | null;
    shortTextCaseSensitive: boolean;
    shortTextEvaluationMode: string;
    shortTextToleranceLevel: string;
    shortTextAllowPartialCredit: boolean;
    shortTextTrimWhitespace: boolean;
    shortTextNormalizeWhitespace: boolean;
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
    showLeaderboard: quiz.showLeaderboard,
    allowCustomNicknames: quiz.allowCustomNicknames,
    defaultTimer: quiz.defaultTimer,
    timerScaleByDifficulty: quiz.timerScaleByDifficulty,
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
          }
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
   * Quiz inkl. Fragen und Antwortoptionen in der DB anlegen (Story 2.1a).
   * Wird vom Frontend vor session.create aufgerufen; die zurückgegebene quizId wird an session.create übergeben.
   */
  upload: publicProcedure
    .input(QuizUploadInputSchema)
    .output(QuizUploadOutputSchema)
    .mutation(async ({ input }) => {
      const historyScopeId = input.historyScopeId ?? null;
      const quiz = await prisma.quiz.create({
        data: {
          historyScopeId,
          name: input.name,
          description: input.description ?? null,
          motifImageUrl: input.motifImageUrl ?? null,
          showLeaderboard: input.showLeaderboard,
          allowCustomNicknames: input.allowCustomNicknames,
          defaultTimer: input.defaultTimer ?? null,
          timerScaleByDifficulty: input.timerScaleByDifficulty ?? true,
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
            create: input.questions.map((q) => ({
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
              answers: {
                create: q.answers.map((a) => ({
                  text: a.text,
                  isCorrect: a.isCorrect,
                })),
              },
            })),
          },
        },
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
            showLeaderboard: true,
            allowCustomNicknames: true,
            defaultTimer: true,
            timerScaleByDifficulty: true,
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
                shortTextMaxLength: true,
                shortTextCaseSensitive: true,
                shortTextEvaluationMode: true,
                shortTextToleranceLevel: true,
                shortTextAllowPartialCredit: true,
                shortTextTrimWhitespace: true,
                shortTextNormalizeWhitespace: true,
                answers: {
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
