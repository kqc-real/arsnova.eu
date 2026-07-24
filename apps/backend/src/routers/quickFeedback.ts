/**
 * Quick-Feedback Router – One-Shot-Feedback (Mood / Sterne / ABCD / YesNo).
 * Lightweight, Redis-only (kein Prisma), auto-expire nach 30 Minuten.
 */
import { TRPCError } from '@trpc/server';
import {
  CreateQuickFeedbackInputSchema,
  CreateQuickFeedbackOutputSchema,
  UpdateQuickFeedbackTypeInputSchema,
  QuickFeedbackVoteInputSchema,
  QuickFeedbackIsActiveOutputSchema,
  QuickFeedbackResultSchema,
  MoodValueEnum,
  AbcdValueEnum,
  YesNoValueEnum,
  YesNoBinaryValueEnum,
  TrueFalseUnknownValueEnum,
  StarsValueEnum,
  TempoValueEnum,
  type QuickFeedbackType,
  type QuickFeedbackResult,
  type QuickFeedbackVoteInput,
} from '@arsnova/shared-types';
import { publicProcedure, resolveTrustedPublicCreateIp, router } from '../trpc';
import { getRedis } from '../redis';
import { prisma } from '../db';
import { recordVoteActivity } from '../lib/loadSignal';
import { getActiveParticipantIdsForSession, touchParticipantPresence } from '../lib/presence';
import { assertHostSessionAccessFromContext, type HostTokenContext } from '../lib/hostAuth';
import {
  assertFeedbackHostAccess,
  createFeedbackHostToken,
  invalidateFeedbackHostToken,
} from '../lib/feedbackHostAuth';
import {
  calculateTempoTrend,
  parseTempoBucketPayloads,
  tempoBucketStartMs,
  type TempoBucketSnapshot,
} from '../lib/quickFeedbackTempo';
import {
  checkQuickFeedbackSessionCreateRate,
  checkQuickFeedbackStandaloneCreateRate,
} from '../lib/rateLimit';

const FEEDBACK_TTL_SECONDS = 30 * 60;
const QUICK_FEEDBACK_POLL_ACTIVE_MS = 500;
const QUICK_FEEDBACK_POLL_IDLE_MS = 1200;
const TEMPO_DEFAULT_VALUE = 'FOLLOWING';
const TEMPO_DEVIATION_VALUES = ['SPEED_UP', 'SLOW_DOWN', 'LOST'] as const;
const TEMPO_VOTE_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then
  return cjson.encode({ error = 'MISSING' })
end

local result = cjson.decode(raw)
if result['type'] ~= 'TEMPO' then
  return cjson.encode({ error = 'TYPE_CHANGED' })
end

if result['locked'] == true then
  return cjson.encode({ error = 'LOCKED' })
end

local valid = {}
local existingDistribution = result['distribution'] or {}
local distribution = {}
for i = 5, #ARGV do
  local value = ARGV[i]
  valid[value] = true
  distribution[value] = tonumber(existingDistribution[value]) or 0
end

local previous = redis.call('HGET', KEYS[2], ARGV[1])
if previous ~= false and valid[previous] then
  local previousCount = tonumber(distribution[previous]) or 0
  if previousCount > 0 then
    distribution[previous] = previousCount - 1
  else
    distribution[previous] = 0
  end
end

local nextValue = ARGV[2]
local resetsToDefault = false
if previous == ARGV[2] and ARGV[2] ~= 'FOLLOWING' then
  nextValue = 'FOLLOWING'
  resetsToDefault = true
end

distribution[nextValue] = (tonumber(distribution[nextValue]) or 0) + 1
redis.call('HSET', KEYS[2], ARGV[1], nextValue)

local totalVotes = 0
for i = 5, #ARGV do
  totalVotes = totalVotes + (tonumber(distribution[ARGV[i]]) or 0)
end

result['distribution'] = distribution
result['totalVotes'] = totalVotes
result['currentRound'] = nil
result['discussion'] = nil
result['round1Distribution'] = nil
result['round1Total'] = nil
result['opinionShift'] = nil
result['tempoTrend'] = nil

local ttl = tonumber(ARGV[3])
redis.call('SET', KEYS[1], cjson.encode(result), 'EX', ttl)
redis.call('EXPIRE', KEYS[2], ttl)
redis.call(
  'HSET',
  KEYS[3],
  ARGV[4],
  cjson.encode({ distribution = distribution, totalVotes = totalVotes })
)
redis.call('EXPIRE', KEYS[3], ttl)

return cjson.encode({ totalVotes = totalVotes, resetsToDefault = resetsToDefault })
`;
type StoredQuickFeedbackResult = QuickFeedbackResult & { sessionBound?: boolean };
type SessionQuickFeedbackGate = {
  id: string;
  quickFeedbackEnabled: boolean;
  quickFeedbackOpen: boolean;
  status: string;
  participantCount: number;
};

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

function tempoBucketsKey(code: string): string {
  return `qf:tempo:buckets:${code}`;
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
    case 'STARS':
      return StarsValueEnum.options;
    case 'ABCD':
      return AbcdValueEnum.options;
    case 'TEMPO':
      return TempoValueEnum.options;
  }
}

function emptyDistribution(type: QuickFeedbackType): Record<string, number> {
  return Object.fromEntries(validValues(type).map((v) => [v, 0]));
}

function positiveInteger(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function tempoCount(distribution: Record<string, number>, value: string): number {
  return positiveInteger(distribution[value]);
}

function tempoDeviationTotal(distribution: Record<string, number>): number {
  return TEMPO_DEVIATION_VALUES.reduce((sum, value) => sum + tempoCount(distribution, value), 0);
}

function tempoDistributionWithDefaultFollowing(
  distribution: Record<string, number>,
  participantBasis: number,
): Record<string, number> {
  const deviations = tempoDeviationTotal(distribution);
  return {
    SPEED_UP: tempoCount(distribution, 'SPEED_UP'),
    [TEMPO_DEFAULT_VALUE]: Math.max(0, participantBasis - deviations),
    SLOW_DOWN: tempoCount(distribution, 'SLOW_DOWN'),
    LOST: tempoCount(distribution, 'LOST'),
  };
}

function tempoDistributionForActiveChoices(
  choices: Record<string, string>,
  activeParticipantIds: ReadonlySet<string>,
): Record<string, number> {
  const distribution = emptyDistribution('TEMPO');
  const tempoValues = TempoValueEnum.options as readonly string[];

  for (const [voterId, value] of Object.entries(choices)) {
    if (!activeParticipantIds.has(voterId) || !tempoValues.includes(value)) {
      continue;
    }
    distribution[value] = tempoCount(distribution, value) + 1;
  }

  return distribution;
}

function applyTempoDefaultFollowing(
  result: StoredQuickFeedbackResult,
  activeParticipants: number,
): number {
  const storedTotalVotes = positiveInteger(result.totalVotes);
  const deviations = tempoDeviationTotal(result.distribution);
  const participantBasis =
    result.sessionBound === true
      ? Math.max(positiveInteger(activeParticipants), deviations)
      : Math.max(positiveInteger(activeParticipants), storedTotalVotes, deviations);

  result.distribution = tempoDistributionWithDefaultFollowing(
    result.distribution,
    participantBasis,
  );
  result.totalVotes = participantBasis;

  return participantBasis;
}

function tempoSnapshotsWithDefaultFollowing(
  snapshots: readonly TempoBucketSnapshot[],
  participantBasis: number,
): readonly TempoBucketSnapshot[] {
  return snapshots.map((snapshot) => ({
    ...snapshot,
    distribution: tempoDistributionWithDefaultFollowing(snapshot.distribution, participantBasis),
    totalVotes: participantBasis,
  }));
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

async function loadSessionQuickFeedbackGate(code: string): Promise<SessionQuickFeedbackGate> {
  const session = await prisma.session.findUnique({
    where: { code },
    select: {
      id: true,
      quickFeedbackEnabled: true,
      quickFeedbackOpen: true,
      status: true,
      _count: { select: { participants: true } },
    },
  });

  if (!session) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
  }

  return {
    id: session.id,
    quickFeedbackEnabled: session.quickFeedbackEnabled === true,
    quickFeedbackOpen: session.quickFeedbackOpen !== false,
    status: session.status,
    participantCount: session._count.participants,
  };
}

/** Teilnehmer-Abstimmung nur solange die Live-Session nicht beendet ist. */
async function assertSessionAllowsQuickFeedbackVote(
  code: string,
): Promise<SessionQuickFeedbackGate> {
  const session = await loadSessionQuickFeedbackGate(code);

  if (!session.quickFeedbackEnabled) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Blitz-Feedback ist für diese Session nicht aktiviert.',
    });
  }

  if (!session.quickFeedbackOpen) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Der Blitzlicht-Kanal ist aktuell geschlossen.',
    });
  }

  if (session.status === 'FINISHED') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Die Session ist beendet. Blitzlicht ist nicht mehr möglich.',
    });
  }

  return session;
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
  ctx: HostTokenContext,
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
    await assertHostSessionAccessFromContext(ctx, code);
  } else {
    await assertFeedbackHostAccess(ctx.req, code, ctx.connectionParams);
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
        await assertHostSessionAccessFromContext(ctx, code);
        const limit = await checkQuickFeedbackSessionCreateRate(code);
        if (!limit.allowed) {
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: 'Zu viele Blitzlicht-Starts. Bitte kurz warten.',
            cause: { retryAfterSeconds: limit.retryAfterSeconds },
          });
        }
        await assertSessionQuickFeedbackEnabled(code);
      } else {
        const limit = await checkQuickFeedbackStandaloneCreateRate(
          resolveTrustedPublicCreateIp(ctx.req).ip,
        );
        if (!limit.allowed) {
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: 'Zu viele Blitzlicht-Erstellungen. Bitte später erneut versuchen.',
            cause: { retryAfterSeconds: limit.retryAfterSeconds },
          });
        }
      }
      const key = feedbackKey(code);

      const initial: StoredQuickFeedbackResult = {
        type: input.type,
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
      multi.del(tempoBucketsKey(code));
      await multi.exec();

      const hostToken = sessionBound ? null : await createFeedbackHostToken(code);
      return { feedbackId: key, sessionCode: code, hostToken };
    }),

  changeType: publicProcedure
    .input(UpdateQuickFeedbackTypeInputSchema)
    .mutation(async ({ ctx, input }) => {
      const redis = getRedis();
      const code = input.sessionCode.toUpperCase();
      const key = feedbackKey(code);
      const result = await loadQuickFeedbackForHost(ctx, code);
      result.type = input.type;
      result.locked = false;
      result.totalVotes = 0;
      result.distribution = emptyDistribution(input.type);
      result.currentRound = undefined;
      result.discussion = undefined;
      result.round1Distribution = undefined;
      result.round1Total = undefined;
      result.opinionShift = undefined;
      result.tempoTrend = undefined;

      const multi = redis.multi();
      multi.set(key, JSON.stringify(result), 'EX', FEEDBACK_TTL_SECONDS);
      multi.del(votersKey(code));
      multi.del(choicesKey(code));
      multi.del(choicesR1Key(code));
      multi.del(tempoBucketsKey(code));
      await multi.exec();

      return { ok: true };
    }),

  reset: publicProcedure
    .input(QuickFeedbackVoteInputSchema.pick({ sessionCode: true }))
    .mutation(async ({ ctx, input }) => {
      const redis = getRedis();
      const code = input.sessionCode.toUpperCase();
      const key = feedbackKey(code);
      const result = await loadQuickFeedbackForHost(ctx, code);
      result.totalVotes = 0;
      result.locked = false;
      result.distribution = emptyDistribution(result.type);
      result.currentRound = undefined;
      result.discussion = undefined;
      result.round1Distribution = undefined;
      result.round1Total = undefined;
      result.opinionShift = undefined;
      result.tempoTrend = undefined;

      const multi = redis.multi();
      multi.set(key, JSON.stringify(result), 'EX', FEEDBACK_TTL_SECONDS);
      multi.del(votersKey(code));
      multi.del(choicesKey(code));
      multi.del(choicesR1Key(code));
      multi.del(tempoBucketsKey(code));
      await multi.exec();

      return { ok: true };
    }),

  end: publicProcedure
    .input(QuickFeedbackVoteInputSchema.pick({ sessionCode: true }))
    .mutation(async ({ ctx, input }) => {
      const redis = getRedis();
      const code = input.sessionCode.toUpperCase();

      await loadQuickFeedbackForHost(ctx, code);

      const multi = redis.multi();
      multi.del(feedbackKey(code));
      multi.del(votersKey(code));
      multi.del(choicesKey(code));
      multi.del(choicesR1Key(code));
      multi.del(tempoBucketsKey(code));
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
      const result = await loadQuickFeedbackForHost(ctx, code);
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
      const result = await loadQuickFeedbackForHost(ctx, code);
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
      const result = await loadQuickFeedbackForHost(ctx, code);
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

    const gate =
      result.sessionBound === true ? await assertSessionAllowsQuickFeedbackVote(code) : null;

    if (result.locked) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Abstimmung ist geschlossen.' });
    }

    const allowed = validValues(result.type);

    if (!allowed.includes(input.value)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ungültige Auswahl.' });
    }

    if (gate) {
      void touchParticipantPresence(gate.id, input.voterId);
    }

    if (result.type === 'TEMPO') {
      await submitTempoVote(input, key);
      return { ok: true };
    }

    const vKey = votersKey(code);
    const alreadyVoted = await redis.sismember(vKey, input.voterId);
    if (alreadyVoted) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Du hast bereits abgestimmt.' });
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
    void recordVoteActivity();

    return { ok: true };
  }),

  leaveTempo: publicProcedure
    .input(QuickFeedbackVoteInputSchema.pick({ sessionCode: true, voterId: true }))
    .mutation(async ({ input }) => {
      await clearTempoVote(input);
      return { ok: true };
    }),

  results: publicProcedure
    .input(QuickFeedbackVoteInputSchema.pick({ sessionCode: true }))
    .output(QuickFeedbackResultSchema)
    .query(async ({ input }) => {
      const gate = await loadSessionQuickFeedbackGate(input.sessionCode.toUpperCase()).catch(
        () => null,
      );
      if (gate) {
        if (!gate.quickFeedbackEnabled) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Blitz-Feedback ist für diese Session nicht aktiviert.',
          });
        }
        if (!gate.quickFeedbackOpen) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Der Blitzlicht-Kanal ist aktuell geschlossen.',
          });
        }
      }

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

      const result = JSON.parse(raw) as StoredQuickFeedbackResult;
      await enrichOpinionShift(result, code);
      await enrichTempoTrend(result, code, gate ?? undefined);
      return QuickFeedbackResultSchema.parse(result);
    }),

  hostResults: publicProcedure
    .input(QuickFeedbackVoteInputSchema.pick({ sessionCode: true }))
    .output(QuickFeedbackResultSchema)
    .query(async ({ input, ctx }) => {
      const code = input.sessionCode.toUpperCase();
      const result = await loadQuickFeedbackForHost(ctx, code);
      await enrichOpinionShift(result, code);
      await enrichTempoTrend(result, code);
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
        const gate = await loadSessionQuickFeedbackGate(code).catch(() => null);
        if (gate) {
          if (!gate.quickFeedbackEnabled || !gate.quickFeedbackOpen) {
            return;
          }
        }
        const raw = await redis.get(key);
        if (!raw) return;

        const result = JSON.parse(raw) as StoredQuickFeedbackResult;
        await enrichOpinionShift(result, code);
        await enrichTempoTrend(result, code, gate ?? undefined);
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

  onHostResults: publicProcedure
    .input(QuickFeedbackVoteInputSchema.pick({ sessionCode: true }))
    .subscription(async function* ({ input, ctx }) {
      const code = input.sessionCode.toUpperCase();
      let lastJson = '';

      while (true) {
        const result = await loadQuickFeedbackForHost(ctx, code).catch(() => null);
        if (!result) {
          return;
        }

        await enrichOpinionShift(result, code);
        await enrichTempoTrend(result, code);
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

async function submitTempoVote(input: QuickFeedbackVoteInput, key: string): Promise<void> {
  const redis = getRedis();
  const code = input.sessionCode.toUpperCase();
  const cKey = choicesKey(code);
  const bucketKey = tempoBucketsKey(code);
  const raw = await redis.eval(
    TEMPO_VOTE_SCRIPT,
    3,
    key,
    cKey,
    bucketKey,
    input.voterId,
    input.value,
    String(FEEDBACK_TTL_SECONDS),
    String(tempoBucketStartMs()),
    ...TempoValueEnum.options,
  );
  const payload =
    typeof raw === 'string'
      ? (JSON.parse(raw) as { error?: 'MISSING' | 'TYPE_CHANGED' | 'LOCKED' })
      : null;

  if (payload?.error === 'MISSING') {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Feedback-Runde nicht gefunden oder abgelaufen.',
    });
  }

  if (payload?.error === 'LOCKED') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Abstimmung ist geschlossen.' });
  }

  if (payload?.error === 'TYPE_CHANGED') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ungültige Auswahl.' });
  }

  void recordVoteActivity();
}

async function clearTempoVote(
  input: Pick<QuickFeedbackVoteInput, 'sessionCode' | 'voterId'>,
): Promise<void> {
  const redis = getRedis();
  const code = input.sessionCode.toUpperCase();
  const key = feedbackKey(code);
  const raw = await redis.get(key);

  if (!raw) {
    return;
  }

  const result = parseStoredQuickFeedbackResult(raw);
  if (result.type !== 'TEMPO' || result.sessionBound === true) {
    return;
  }

  const cKey = choicesKey(code);
  const previous = await redis.hget(cKey, input.voterId);
  const tempoValues = TempoValueEnum.options as readonly string[];

  if (typeof previous !== 'string' || !tempoValues.includes(previous)) {
    await redis.hdel(cKey, input.voterId);
    return;
  }

  result.distribution = Object.fromEntries(
    TempoValueEnum.options.map((value) => [value, tempoCount(result.distribution, value)]),
  ) as Record<string, number>;
  result.distribution[previous] = Math.max(0, tempoCount(result.distribution, previous) - 1);
  result.totalVotes = TempoValueEnum.options.reduce(
    (sum, value) => sum + tempoCount(result.distribution, value),
    0,
  );
  result.currentRound = undefined;
  result.discussion = undefined;
  result.round1Distribution = undefined;
  result.round1Total = undefined;
  result.opinionShift = undefined;
  result.tempoTrend = undefined;

  const bucketPayload = JSON.stringify({
    distribution: result.distribution,
    totalVotes: result.totalVotes,
  });
  const bucketKey = tempoBucketsKey(code);
  const multi = redis.multi();
  multi.set(key, JSON.stringify(result), 'EX', FEEDBACK_TTL_SECONDS);
  multi.hdel(cKey, input.voterId);
  multi.expire(cKey, FEEDBACK_TTL_SECONDS);
  multi.hset(bucketKey, String(tempoBucketStartMs()), bucketPayload);
  multi.expire(bucketKey, FEEDBACK_TTL_SECONDS);
  await multi.exec();
  void recordVoteActivity();
}

async function resolveTempoActiveParticipants(
  result: StoredQuickFeedbackResult,
  code: string,
  knownSession?: Pick<SessionQuickFeedbackGate, 'id' | 'participantCount'>,
): Promise<number> {
  const storedTotalVotes = positiveInteger(result.totalVotes);
  if (result.sessionBound !== true) {
    return storedTotalVotes;
  }

  const session = knownSession ?? (await loadSessionQuickFeedbackGate(code).catch(() => null));
  if (!session) {
    return storedTotalVotes;
  }

  const activeParticipantIds = await getActiveParticipantIdsForSession(session.id).catch(
    () => new Set<string>(),
  );
  if (activeParticipantIds.size === 0) {
    result.distribution = emptyDistribution('TEMPO');
    return 0;
  }

  const choices = await getRedis()
    .hgetall(choicesKey(code))
    .catch(() => ({}) as Record<string, string>);
  result.distribution = tempoDistributionForActiveChoices(choices, activeParticipantIds);
  return activeParticipantIds.size;
}

async function enrichTempoTrend(
  result: StoredQuickFeedbackResult,
  code: string,
  knownSession?: Pick<SessionQuickFeedbackGate, 'id' | 'participantCount'>,
): Promise<void> {
  if (result.type !== 'TEMPO') {
    result.tempoTrend = undefined;
    return;
  }

  const redis = getRedis();
  const [activeParticipants, rawBuckets] = await Promise.all([
    resolveTempoActiveParticipants(result, code, knownSession),
    redis.hgetall(tempoBucketsKey(code)).catch(() => ({}) as Record<string, string>),
  ]);
  const participantBasis = applyTempoDefaultFollowing(result, activeParticipants);
  const rawSnapshots = result.sessionBound === true ? [] : parseTempoBucketPayloads(rawBuckets);
  const snapshots = tempoSnapshotsWithDefaultFollowing(rawSnapshots, participantBasis);

  result.tempoTrend = calculateTempoTrend({
    distribution: result.distribution,
    totalVotes: result.totalVotes,
    activeParticipants: participantBasis,
    snapshots,
  });
}

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
