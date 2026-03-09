/**
 * Quick-Feedback Router – One-Shot-Feedback (Mood / ABCD / YesNo).
 * Lightweight, Redis-only (kein Prisma), auto-expire nach 30 Minuten.
 */
import { TRPCError } from '@trpc/server';
import {
  CreateQuickFeedbackInputSchema,
  CreateQuickFeedbackOutputSchema,
  UpdateQuickFeedbackStyleInputSchema,
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
const POLL_INTERVAL_MS = 300;

function feedbackKey(code: string): string {
  return `qf:${code}`;
}

function votersKey(code: string): string {
  return `qf:voters:${code}`;
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

function emptyDistribution(type: QuickFeedbackType): Record<string, number> {
  return Object.fromEntries(validValues(type).map((v) => [v, 0]));
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
        theme: input.theme,
        preset: input.preset,
        locked: false,
        totalVotes: 0,
        distribution: emptyDistribution(input.type),
      };

      await redis.set(key, JSON.stringify(initial), 'EX', FEEDBACK_TTL_SECONDS);
      return { feedbackId: key, sessionCode: code };
    }),

  updateStyle: publicProcedure
    .input(UpdateQuickFeedbackStyleInputSchema)
    .mutation(async ({ input }) => {
      const redis = getRedis();
      const key = feedbackKey(input.sessionCode.toUpperCase());
      const raw = await redis.get(key);

      if (!raw) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Feedback-Runde nicht gefunden oder abgelaufen.' });
      }

      const result = JSON.parse(raw) as QuickFeedbackResult;
      result.theme = input.theme;
      result.preset = input.preset;

      await redis.set(key, JSON.stringify(result), 'EX', FEEDBACK_TTL_SECONDS);
      return { ok: true };
    }),

  reset: publicProcedure
    .input(QuickFeedbackVoteInputSchema.pick({ sessionCode: true }))
    .mutation(async ({ input }) => {
      const redis = getRedis();
      const code = input.sessionCode.toUpperCase();
      const key = feedbackKey(code);
      const raw = await redis.get(key);

      if (!raw) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Feedback-Runde nicht gefunden oder abgelaufen.' });
      }

      const result = JSON.parse(raw) as QuickFeedbackResult;
      result.totalVotes = 0;
      result.locked = false;
      result.distribution = emptyDistribution(result.type);

      const multi = redis.multi();
      multi.set(key, JSON.stringify(result), 'EX', FEEDBACK_TTL_SECONDS);
      multi.del(votersKey(code));
      await multi.exec();

      return { ok: true };
    }),

  toggleLock: publicProcedure
    .input(QuickFeedbackVoteInputSchema.pick({ sessionCode: true }))
    .mutation(async ({ input }) => {
      const redis = getRedis();
      const key = feedbackKey(input.sessionCode.toUpperCase());
      const raw = await redis.get(key);

      if (!raw) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Feedback-Runde nicht gefunden oder abgelaufen.' });
      }

      const result = JSON.parse(raw) as QuickFeedbackResult;
      result.locked = !result.locked;

      await redis.set(key, JSON.stringify(result), 'EX', FEEDBACK_TTL_SECONDS);
      return { locked: result.locked };
    }),

  vote: publicProcedure
    .input(QuickFeedbackVoteInputSchema)
    .mutation(async ({ input }) => {
      const redis = getRedis();
      const code = input.sessionCode.toUpperCase();
      const key = feedbackKey(code);
      const raw = await redis.get(key);

      if (!raw) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Feedback-Runde nicht gefunden oder abgelaufen.' });
      }

      const result = JSON.parse(raw) as QuickFeedbackResult;
      if (result.locked) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Abstimmung ist geschlossen.' });
      }

      const vKey = votersKey(code);
      const alreadyVoted = await redis.sismember(vKey, input.voterId);
      if (alreadyVoted) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Du hast bereits abgestimmt.' });
      }

      const allowed = validValues(result.type);

      if (!allowed.includes(input.value)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ungültige Auswahl.' });
      }

      result.distribution[input.value] = (result.distribution[input.value] ?? 0) + 1;
      result.totalVotes += 1;

      const multi = redis.multi();
      multi.set(key, JSON.stringify(result), 'EX', FEEDBACK_TTL_SECONDS);
      multi.sadd(vKey, input.voterId);
      multi.expire(vKey, FEEDBACK_TTL_SECONDS);
      await multi.exec();

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
