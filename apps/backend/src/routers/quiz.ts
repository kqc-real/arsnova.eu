/**
 * Quiz-Router (Story 2.1a).
 * quiz.upload: Quiz-Daten beim Live-Schalten an den Server übertragen und in PostgreSQL speichern.
 */
import {
  QuizUploadInputSchema,
  QuizUploadOutputSchema,
} from '@arsnova/shared-types';
import { publicProcedure, router } from '../trpc';
import { prisma } from '../db';

export const quizRouter = router({
  /**
   * Quiz inkl. Fragen und Antwortoptionen in der DB anlegen (Story 2.1a).
   * Wird vom Frontend vor session.create aufgerufen; die zurückgegebene quizId wird an session.create übergeben.
   */
  upload: publicProcedure
    .input(QuizUploadInputSchema)
    .output(QuizUploadOutputSchema)
    .mutation(async ({ input }) => {
      const quiz = await prisma.quiz.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          showLeaderboard: input.showLeaderboard,
          allowCustomNicknames: input.allowCustomNicknames,
          defaultTimer: input.defaultTimer ?? null,
          enableSoundEffects: input.enableSoundEffects,
          enableRewardEffects: input.enableRewardEffects,
          enableMotivationMessages: input.enableMotivationMessages,
          enableEmojiReactions: input.enableEmojiReactions,
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
              ratingMin: q.ratingMin ?? null,
              ratingMax: q.ratingMax ?? null,
              ratingLabelMin: q.ratingLabelMin ?? null,
              ratingLabelMax: q.ratingLabelMax ?? null,
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

      return { quizId: quiz.id };
    }),
});
