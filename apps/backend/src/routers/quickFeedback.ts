/**
 * Quick-Feedback Router – One-Shot-Feedback (Mood / ABCD).
 * Lightweight, Redis-only (kein Prisma), auto-expire nach 30 Minuten.
 */
import { TRPCError } from '@trpc/server';
import {
  CreateQuickFeedbackInputSchema,
  CreateQuickFeedbackOutputSchema,
  QuickFeedbackVoteInputSchema,
  QuickFeedbackResultSchema,
  MoodValueEnum,
  AbcdValueEnum,
  YesNoValueEnum,
  type QuickFeedbackType,
  type QuickFeedbackResult,
} from '@arsnova/shared-types';
import { publicProcedure, router } from '../trpc';
import { getRedis } from '../redis';

const FEEDBACK_TTL_SECONDS = 30 * 60;
const POLL_INTERVAL_MS = 1000;

function feedbackKey(code: string): string {
  return `qf:${code}`;
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (const b of bytes) {
    code += chars[b % chars.length];
  }
  return code;
}

function validValues(type: QuickFeedbackType): readonly string[] {
  switch (type) {
    case 'MOOD': return MoodValueEnum.options;
    case 'ABCD': return AbcdValueEnum.options;
    case 'YESNO': return YesNoValueEnum.options;
  }
}

export const quickFeedbackRouter = router({
  create: publicProcedure
    .input(CreateQuickFeedbackInputSchema)
    .output(CreateQuickFeedbackOutputSchema)
    .mutation(async ({ input }) => {
      const redis = getRedis();
      const code = generateCode();
      const key = feedbackKey(code);

      const initial: QuickFeedbackResult = {
        type: input.type,
        totalVotes: 0,
        distribution: Object.fromEntries(validValues(input.type).map((v) => [v, 0])),
      };

      await redis.set(key, JSON.stringify(initial), 'EX', FEEDBACK_TTL_SECONDS);
      return { feedbackId: key, sessionCode: code };
    }),

  vote: publicProcedure
    .input(QuickFeedbackVoteInputSchema)
    .mutation(async ({ input }) => {
      const redis = getRedis();
      const key = feedbackKey(input.sessionCode.toUpperCase());
      const raw = await redis.get(key);

      if (!raw) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Feedback-Runde nicht gefunden oder abgelaufen.' });
      }

      const result = JSON.parse(raw) as QuickFeedbackResult;
      const allowed = validValues(result.type);

      if (!allowed.includes(input.value)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ungültige Auswahl.' });
      }

      result.distribution[input.value] = (result.distribution[input.value] ?? 0) + 1;
      result.totalVotes += 1;

      await redis.set(key, JSON.stringify(result), 'EX', FEEDBACK_TTL_SECONDS);
      return { ok: true };
    }),

  results: publicProcedure
    .input(QuickFeedbackVoteInputSchema.pick({ sessionCode: true }))
    .output(QuickFeedbackResultSchema)
    .query(async ({ input }) => {
      const redis = getRedis();
      const key = feedbackKey(input.sessionCode.toUpperCase());
      const raw = await redis.get(key);

      if (!raw) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Feedback-Runde nicht gefunden oder abgelaufen.' });
      }

      return QuickFeedbackResultSchema.parse(JSON.parse(raw));
    }),

  onResults: publicProcedure
    .input(QuickFeedbackVoteInputSchema.pick({ sessionCode: true }))
    .subscription(async function* ({ input }) {
      const redis = getRedis();
      const key = feedbackKey(input.sessionCode.toUpperCase());

      while (true) {
        const raw = await redis.get(key);
        if (!raw) return;

        yield QuickFeedbackResultSchema.parse(JSON.parse(raw));
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    }),
});
