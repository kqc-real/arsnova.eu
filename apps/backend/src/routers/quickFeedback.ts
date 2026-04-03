/**
 * Quick-Feedback Router – One-Shot-Feedback (Mood / ABCD / YesNo).
 * Lightweight, Redis-only (kein Prisma), auto-expire nach 30 Minuten.
 */
import { TRPCError } from '@trpc/server';
import {
  CreateQuickFeedbackInputSchema,
  CreateQuickFeedbackOutputSchema,
  UpdateQuickFeedbackStyleInputSchema,
  UpdateQuickFeedbackTypeInputSchema,
  QuickFeedbackVoteInputSchema,
  QuickFeedbackIsActiveOutputSchema,
  QuickFeedbackResultSchema,
  MoodValueEnum,
  AbcdValueEnum,
  YesNoValueEnum,
  YesNoBinaryValueEnum,
  TrueFalseUnknownValueEnum,
  AbcValueEnum,
  type QuickFeedbackType,
  type QuickFeedbackResult,
} from '@arsnova/shared-types';
import { publicProcedure, router } from '../trpc';
import { getRedis } from '../redis';
import { prisma } from '../db';
import { assertHostSessionAccess } from '../lib/hostAuth';
import {
  assertFeedbackHostAccess,
  createFeedbackHostToken,
  invalidateFeedbackHostToken,
} from '../lib/feedbackHostAuth';

const FEEDBACK_TTL_SECONDS = 30 * 60;
const QUICK_FEEDBACK_POLL_ACTIVE_MS = 500;
const QUICK_FEEDBACK_POLL_IDLE_MS = 1200;
type StoredQuickFeedbackResult = QuickFeedbackResult & { sessionBound?: boolean };

function feedbackKey(code: string): string {
  return `qf:${code}`;
}

function votersKey(code: string): string {
  return `qf:voters:${code}`;
}

function choicesKey(code: string): string {
  return `qf:choices:${code}`;
}

function choicesR1Key(code: string): string {
  return `qf:choices:r1:${code}`;
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
    case 'MOOD':
      return MoodValueEnum.options;
    case 'YESNO':
      return YesNoValueEnum.options;
    case 'YESNO_BINARY':
      return YesNoBinaryValueEnum.options;
    case 'TRUEFALSE_UNKNOWN':
      return TrueFalseUnknownValueEnum.options;
    case 'ABC':
      return AbcValueEnum.options;
    case 'ABCD':
      return AbcdValueEnum.options;
  }
}

function emptyDistribution(type: QuickFeedbackType): Record<string, number> {
  return Object.fromEntries(validValues(type).map((v) => [v, 0]));
}

async function assertSessionQuickFeedbackEnabled(code: string): Promise<void> {
  const session = await prisma.session.findUnique({
    where: { code },
    select: { id: true, quickFeedbackEnabled: true },
  });

  if (!session) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
  }

  if (session.quickFeedbackEnabled !== true) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Blitz-Feedback ist für diese Session nicht aktiviert.',
    });
  }
}

/** Teilnehmer-Abstimmung nur solange die Live-Session nicht beendet ist. */
async function assertSessionAllowsQuickFeedbackVote(code: string): Promise<void> {
  const session = await prisma.session.findUnique({
    where: { code },
    select: { id: true, quickFeedbackEnabled: true, status: true },
  });

  if (!session) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
  }

  if (session.quickFeedbackEnabled !== true) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Blitz-Feedback ist für diese Session nicht aktiviert.',
    });
  }

  if (session.status === 'FINISHED') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Die Session ist beendet. Blitzlicht ist nicht mehr möglich.',
    });
  }
}

function parseStoredQuickFeedbackResult(raw: string): StoredQuickFeedbackResult {
  return JSON.parse(raw) as StoredQuickFeedbackResult;
}

async function loadQuickFeedbackForVote(code: string): Promise<StoredQuickFeedbackResult> {
  const redis = getRedis();
  const raw = await redis.get(feedbackKey(code));

  if (!raw) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Feedback-Runde nicht gefunden oder abgelaufen.',
    });
  }

  return parseStoredQuickFeedbackResult(raw);
}

async function loadQuickFeedbackForHost(
  req: Parameters<typeof assertHostSessionAccess>[0],
  code: string,
): Promise<StoredQuickFeedbackResult> {
  const redis = getRedis();
  const raw = await redis.get(feedbackKey(code));

  if (!raw) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Feedback-Runde nicht gefunden oder abgelaufen.',
    });
  }

  const result = parseStoredQuickFeedbackResult(raw);
  if (result.sessionBound === true) {
    await assertHostSessionAccess(req, code);
  } else {
    await assertFeedbackHostAccess(req, code);
  }

  return result;
}

export const quickFeedbackRouter = router({
  create: publicProcedure
    .input(CreateQuickFeedbackInputSchema)
    .output(CreateQuickFeedbackOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const redis = getRedis();
      const code = input.sessionCode?.toUpperCase() ?? generateCode();
      const sessionBound = !!input.sessionCode;
      if (input.sessionCode) {
        await assertHostSessionAccess(ctx.req, code);
        await assertSessionQuickFeedbackEnabled(code);
      }
      const key = feedbackKey(code);

      const initial: StoredQuickFeedbackResult = {
        type: input.type,
        theme: input.theme,
        preset: input.preset,
        locked: false,
        totalVotes: 0,
        distribution: emptyDistribution(input.type),
        sessionBound,
      };

      const multi = redis.multi();
      multi.set(key, JSON.stringify(initial), 'EX', FEEDBACK_TTL_SECONDS);
      multi.del(votersKey(code));
      multi.del(choicesKey(code));
      multi.del(choicesR1Key(code));
      await multi.exec();

      const hostToken = sessionBound ? null : await createFeedbackHostToken(code);
      return { feedbackId: key, sessionCode: code, hostToken };
    }),

  updateStyle: publicProcedure
    .input(UpdateQuickFeedbackStyleInputSchema)
    .mutation(async ({ ctx, input }) => {
      const redis = getRedis();
      const code = input.sessionCode.toUpperCase();
      const key = feedbackKey(code);
      const result = await loadQuickFeedbackForHost(ctx.req, code);
      result.theme = input.theme;
      result.preset = input.preset;

      await redis.set(key, JSON.stringify(result), 'EX', FEEDBACK_TTL_SECONDS);
      return { ok: true };
    }),

  changeType: publicProcedure
    .input(UpdateQuickFeedbackTypeInputSchema)
    .mutation(async ({ ctx, input }) => {
      const redis = getRedis();
      const code = input.sessionCode.toUpperCase();
      const key = feedbackKey(code);
      const result = await loadQuickFeedbackForHost(ctx.req, code);
      result.type = input.type;
      result.theme = input.theme;
      result.preset = input.preset;
      result.locked = false;
      result.totalVotes = 0;
      result.distribution = emptyDistribution(input.type);
      result.currentRound = undefined;
      result.discussion = undefined;
      result.round1Distribution = undefined;
      result.round1Total = undefined;
      result.opinionShift = undefined;

      const multi = redis.multi();
      multi.set(key, JSON.stringify(result), 'EX', FEEDBACK_TTL_SECONDS);
      multi.del(votersKey(code));
      multi.del(choicesKey(code));
      multi.del(choicesR1Key(code));
      await multi.exec();

      return { ok: true };
    }),

  reset: publicProcedure
    .input(QuickFeedbackVoteInputSchema.pick({ sessionCode: true }))
    .mutation(async ({ ctx, input }) => {
      const redis = getRedis();
      const code = input.sessionCode.toUpperCase();
      const key = feedbackKey(code);
      const result = await loadQuickFeedbackForHost(ctx.req, code);
      result.totalVotes = 0;
      result.locked = false;
      result.distribution = emptyDistribution(result.type);
      result.currentRound = undefined;
      result.discussion = undefined;
      result.round1Distribution = undefined;
      result.round1Total = undefined;
      result.opinionShift = undefined;

      const multi = redis.multi();
      multi.set(key, JSON.stringify(result), 'EX', FEEDBACK_TTL_SECONDS);
      multi.del(votersKey(code));
      multi.del(choicesKey(code));
      multi.del(choicesR1Key(code));
      await multi.exec();

      return { ok: true };
    }),

  end: publicProcedure
    .input(QuickFeedbackVoteInputSchema.pick({ sessionCode: true }))
    .mutation(async ({ ctx, input }) => {
      const redis = getRedis();
      const code = input.sessionCode.toUpperCase();

      await loadQuickFeedbackForHost(ctx.req, code);

      const multi = redis.multi();
      multi.del(feedbackKey(code));
      multi.del(votersKey(code));
      multi.del(choicesKey(code));
      multi.del(choicesR1Key(code));
      await multi.exec();
      await invalidateFeedbackHostToken(code);

      return { ok: true };
    }),

  toggleLock: publicProcedure
    .input(QuickFeedbackVoteInputSchema.pick({ sessionCode: true }))
    .mutation(async ({ ctx, input }) => {
      const redis = getRedis();
      const code = input.sessionCode.toUpperCase();
      const key = feedbackKey(code);
      const result = await loadQuickFeedbackForHost(ctx.req, code);
      result.locked = !result.locked;

      await redis.set(key, JSON.stringify(result), 'EX', FEEDBACK_TTL_SECONDS);
      return { locked: result.locked };
    }),

  /** Diskussionsphase starten (Story 2.7): Runde 1 sichern, Abstimmung sperren. */
  startDiscussion: publicProcedure
    .input(QuickFeedbackVoteInputSchema.pick({ sessionCode: true }))
    .mutation(async ({ ctx, input }) => {
      const redis = getRedis();
      const code = input.sessionCode.toUpperCase();
      const key = feedbackKey(code);
      const result = await loadQuickFeedbackForHost(ctx.req, code);
      if (result.discussion) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Diskussionsphase bereits aktiv.' });
      }

      result.round1Distribution = { ...result.distribution };
      result.round1Total = result.totalVotes;
      result.discussion = true;
      result.locked = true;
      result.currentRound = 1;

      const cKey = choicesKey(code);
      const r1Key = choicesR1Key(code);
      const currentChoices = await redis.hgetall(cKey);

      const multi = redis.multi();
      multi.set(key, JSON.stringify(result), 'EX', FEEDBACK_TTL_SECONDS);
      if (Object.keys(currentChoices).length > 0) {
        multi.del(r1Key);
        multi.hset(r1Key, currentChoices);
        multi.expire(r1Key, FEEDBACK_TTL_SECONDS);
      }
      await multi.exec();
      return { ok: true };
    }),

  /** Zweite Abstimmungsrunde starten (Story 2.7): Votes zurücksetzen, Runde 2 freigeben. */
  startSecondRound: publicProcedure
    .input(QuickFeedbackVoteInputSchema.pick({ sessionCode: true }))
    .mutation(async ({ ctx, input }) => {
      const redis = getRedis();
      const code = input.sessionCode.toUpperCase();
      const key = feedbackKey(code);
      const result = await loadQuickFeedbackForHost(ctx.req, code);
      if (!result.discussion) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Erst Diskussionsphase starten.' });
      }

      result.distribution = emptyDistribution(result.type);
      result.totalVotes = 0;
      result.currentRound = 2;
      result.discussion = false;
      result.locked = false;
      result.opinionShift = undefined;

      const multi = redis.multi();
      multi.set(key, JSON.stringify(result), 'EX', FEEDBACK_TTL_SECONDS);
      multi.del(votersKey(code));
      multi.del(choicesKey(code));
      await multi.exec();

      return { ok: true };
    }),

  /**
   * Leichtgewichtige Prüfung, ob für den Code eine Blitzlicht-Runde in Redis liegt.
   * Im Gegensatz zu `results` kein NOT_FOUND/HTTP-404 bei fehlendem Key (Lighthouse / Netzwerk-Tab).
   */
  isActive: publicProcedure
    .input(QuickFeedbackVoteInputSchema.pick({ sessionCode: true }))
    .output(QuickFeedbackIsActiveOutputSchema)
    .query(async ({ input }) => {
      const redis = getRedis();
      const n = await redis.exists(feedbackKey(input.sessionCode.toUpperCase()));
      return { active: n === 1 };
    }),

  vote: publicProcedure.input(QuickFeedbackVoteInputSchema).mutation(async ({ input }) => {
    const code = input.sessionCode.toUpperCase();
    const redis = getRedis();
    const key = feedbackKey(code);
    const result = await loadQuickFeedbackForVote(code);

    if (result.sessionBound === true) {
      await assertSessionAllowsQuickFeedbackVote(code);
    }

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

    const cKey = choicesKey(code);
    const multi = redis.multi();
    multi.set(key, JSON.stringify(result), 'EX', FEEDBACK_TTL_SECONDS);
    multi.sadd(vKey, input.voterId);
    multi.expire(vKey, FEEDBACK_TTL_SECONDS);
    multi.hset(cKey, input.voterId, input.value);
    multi.expire(cKey, FEEDBACK_TTL_SECONDS);
    await multi.exec();

    return { ok: true };
  }),

  results: publicProcedure
    .input(QuickFeedbackVoteInputSchema.pick({ sessionCode: true }))
    .output(QuickFeedbackResultSchema)
    .query(async ({ input }) => {
      const redis = getRedis();
      const code = input.sessionCode.toUpperCase();
      const key = feedbackKey(code);
      const raw = await redis.get(key);

      if (!raw) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Feedback-Runde nicht gefunden oder abgelaufen.',
        });
      }

      const result = JSON.parse(raw) as QuickFeedbackResult;
      await enrichOpinionShift(result, code);
      return QuickFeedbackResultSchema.parse(result);
    }),

  onResults: publicProcedure
    .input(QuickFeedbackVoteInputSchema.pick({ sessionCode: true }))
    .subscription(async function* ({ input }) {
      const redis = getRedis();
      const code = input.sessionCode.toUpperCase();
      const key = feedbackKey(code);
      let lastJson = '';

      while (true) {
        const raw = await redis.get(key);
        if (!raw) return;

        const result = JSON.parse(raw) as QuickFeedbackResult;
        await enrichOpinionShift(result, code);
        const payload = QuickFeedbackResultSchema.parse(result);
        const json = JSON.stringify(payload);
        if (json !== lastJson) {
          lastJson = json;
          yield payload;
        }
        const pollMs =
          payload.locked || payload.discussion
            ? QUICK_FEEDBACK_POLL_IDLE_MS
            : QUICK_FEEDBACK_POLL_ACTIVE_MS;
        await new Promise((r) => setTimeout(r, pollMs));
      }
    }),
});

async function enrichOpinionShift(result: QuickFeedbackResult, code: string): Promise<void> {
  if (result.currentRound !== 2 || result.totalVotes === 0 || result.discussion) return;

  const redis = getRedis();
  const r1Choices = await redis.hgetall(choicesR1Key(code));
  const r2Choices = await redis.hgetall(choicesKey(code));

  if (Object.keys(r1Choices).length === 0 || Object.keys(r2Choices).length === 0) return;

  let bothRoundsCount = 0;
  let changedCount = 0;
  const migrationCounts = new Map<string, number>();

  for (const [voterId, r1Value] of Object.entries(r1Choices)) {
    const r2Value = r2Choices[voterId];
    if (r2Value === undefined) continue;
    bothRoundsCount++;
    if (r1Value !== r2Value) {
      changedCount++;
      const mKey = `${r1Value}|${r2Value}`;
      migrationCounts.set(mKey, (migrationCounts.get(mKey) ?? 0) + 1);
    }
  }

  if (bothRoundsCount > 0) {
    const migrations = [...migrationCounts.entries()]
      .map(([mKey, count]) => {
        const [from, to] = mKey.split('|');
        return { from: from!, to: to!, count };
      })
      .sort((a, b) => b.count - a.count);

    result.opinionShift = {
      bothRoundsCount,
      changedCount,
      changedPercentage: Math.round((changedCount / bothRoundsCount) * 100),
      migrations: migrations.length > 0 ? migrations : undefined,
    };
  }
}
