/**
 * Quick-Feedback Router – One-Shot-Feedback (Mood / Sterne / ABCD / YesNo).
 * Standalone-Daten liegen mit 30 Minuten TTL in Redis; sessiongebundene Pfade
 * gleichen zusätzlich mit PostgreSQL ab.
 */
import { TRPCError } from '@trpc/server';
import {
  CreateQuickFeedbackInputSchema,
  CreateQuickFeedbackOutputSchema,
  UpdateQuickFeedbackTypeInputSchema,
  UpdateQuickFeedbackPresentationInputSchema,
  QuickFeedbackVoteInputSchema,
  QuickFeedbackIsActiveInputSchema,
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
  quickFeedbackDefaultsToLiveResults,
  isQaChannelJoinable,
} from '@arsnova/shared-types';
import { publicProcedure, resolveClientIp, router } from '../trpc';
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
import type { SessionCodeFailureSource } from '../lib/abuseTelemetry';
import { rejectInvalidSessionCode } from '../lib/invalidSessionCode';
import { isSessionEffectivelyFinished } from '../lib/sessionLifecycle';
import { buildQuickFeedbackSessionPurgeFenceKey } from '../lib/quickFeedbackSessionPurge';
import { registerSessionPurgeInvalidator } from '../lib/sessionPurgeInvalidation';

const FEEDBACK_TTL_SECONDS = 30 * 60;
const KNOWN_FEEDBACK_GRACE_SECONDS = 5 * 60;
const KNOWN_FEEDBACK_TTL_SECONDS = FEEDBACK_TTL_SECONDS + KNOWN_FEEDBACK_GRACE_SECONDS;
const QUICK_FEEDBACK_POLL_ACTIVE_MS = 500;
const QUICK_FEEDBACK_POLL_IDLE_MS = 1200;
const TEMPO_DEFAULT_VALUE = 'FOLLOWING';
const TEMPO_DEVIATION_VALUES = ['SPEED_UP', 'SLOW_DOWN', 'LOST'] as const;
const SET_LIVE_RESULTS_SCRIPT = `
-- QUICK_FEEDBACK_SET_LIVE_RESULTS
local raw = redis.call('GET', KEYS[1])
if not raw then
  return cjson.encode({ error = 'MISSING' })
end

local decoded, result = pcall(cjson.decode, raw)
if not decoded or type(result) ~= 'table' then
  return cjson.encode({ error = 'MALFORMED' })
end
local expectedSessionId = ARGV[1]
if expectedSessionId ~= '' then
  if result['sessionBound'] ~= true
    or result['sessionId'] ~= expectedSessionId
    or redis.call('EXISTS', KEYS[3]) == 1 then
    return cjson.encode({ error = 'SESSION_MISMATCH' })
  end
else
  if result['sessionBound'] == true then
    return cjson.encode({ error = 'SESSION_MISMATCH' })
  end
end
result['showLiveResults'] = ARGV[2] == '1'
if expectedSessionId ~= '' then
  result['sessionId'] = expectedSessionId
end
redis.call('SET', KEYS[1], cjson.encode(result), 'EX', tonumber(ARGV[3]))
redis.call('SET', KEYS[2], '1', 'EX', tonumber(ARGV[4]))
return cjson.encode({ showLiveResults = result['showLiveResults'] })
`;
const STANDARD_VOTE_SCRIPT = `
-- QUICK_FEEDBACK_STANDARD_VOTE
local raw = redis.call('GET', KEYS[1])
if not raw then
  return cjson.encode({ error = 'MISSING' })
end

local decoded, result = pcall(cjson.decode, raw)
if not decoded or type(result) ~= 'table' then
  return cjson.encode({ error = 'MALFORMED' })
end
local expectedSessionId = ARGV[1]
if expectedSessionId ~= '' then
  if result['sessionBound'] ~= true
    or result['sessionId'] ~= expectedSessionId
    or redis.call('EXISTS', KEYS[5]) == 1 then
    return cjson.encode({ error = 'SESSION_MISMATCH' })
  end
else
  if result['sessionBound'] == true then
    return cjson.encode({ error = 'SESSION_MISMATCH' })
  end
end
if result['locked'] == true then
  return cjson.encode({ error = 'LOCKED' })
end
if result['type'] == 'TEMPO' then
  return cjson.encode({ error = 'TYPE_CHANGED' })
end

local distribution = result['distribution'] or {}
local value = ARGV[3]
if distribution[value] == nil then
  return cjson.encode({ error = 'INVALID_VALUE' })
end
if redis.call('SISMEMBER', KEYS[2], ARGV[2]) == 1 then
  return cjson.encode({ error = 'ALREADY_VOTED' })
end

distribution[value] = (tonumber(distribution[value]) or 0) + 1
result['distribution'] = distribution
result['totalVotes'] = (tonumber(result['totalVotes']) or 0) + 1

if expectedSessionId ~= '' then
  result['sessionId'] = expectedSessionId
end
local ttl = tonumber(ARGV[4])
redis.call('SET', KEYS[1], cjson.encode(result), 'EX', ttl)
redis.call('SADD', KEYS[2], ARGV[2])
redis.call('EXPIRE', KEYS[2], ttl)
redis.call('HSET', KEYS[3], ARGV[2], value)
redis.call('EXPIRE', KEYS[3], ttl)
redis.call('SET', KEYS[4], '1', 'EX', tonumber(ARGV[5]))
return cjson.encode({ totalVotes = result['totalVotes'] })
`;
const TEMPO_VOTE_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then
  return cjson.encode({ error = 'MISSING' })
end

local decoded, result = pcall(cjson.decode, raw)
if not decoded or type(result) ~= 'table' then
  return cjson.encode({ error = 'MALFORMED' })
end
local expectedSessionId = ARGV[1]
if expectedSessionId ~= '' then
  if result['sessionBound'] ~= true
    or result['sessionId'] ~= expectedSessionId
    or redis.call('EXISTS', KEYS[5]) == 1 then
    return cjson.encode({ error = 'SESSION_MISMATCH' })
  end
else
  if result['sessionBound'] == true then
    return cjson.encode({ error = 'SESSION_MISMATCH' })
  end
end
if result['type'] ~= 'TEMPO' then
  return cjson.encode({ error = 'TYPE_CHANGED' })
end

if result['locked'] == true then
  return cjson.encode({ error = 'LOCKED' })
end

local valid = {}
local existingDistribution = result['distribution'] or {}
local distribution = {}
for i = 7, #ARGV do
  local value = ARGV[i]
  valid[value] = true
  distribution[value] = tonumber(existingDistribution[value]) or 0
end

local previous = redis.call('HGET', KEYS[2], ARGV[2])
if previous ~= false and valid[previous] then
  local previousCount = tonumber(distribution[previous]) or 0
  if previousCount > 0 then
    distribution[previous] = previousCount - 1
  else
    distribution[previous] = 0
  end
end

local nextValue = ARGV[3]
local resetsToDefault = false
if previous == ARGV[3] and ARGV[3] ~= 'FOLLOWING' then
  nextValue = 'FOLLOWING'
  resetsToDefault = true
end

distribution[nextValue] = (tonumber(distribution[nextValue]) or 0) + 1
redis.call('HSET', KEYS[2], ARGV[2], nextValue)

local totalVotes = 0
for i = 7, #ARGV do
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

if expectedSessionId ~= '' then
  result['sessionId'] = expectedSessionId
end
local ttl = tonumber(ARGV[4])
redis.call('SET', KEYS[1], cjson.encode(result), 'EX', ttl)
redis.call('EXPIRE', KEYS[2], ttl)
redis.call('SET', KEYS[4], '1', 'EX', tonumber(ARGV[6]))
redis.call(
  'HSET',
  KEYS[3],
  ARGV[5],
  cjson.encode({ distribution = distribution, totalVotes = totalVotes })
)
redis.call('EXPIRE', KEYS[3], ttl)

return cjson.encode({ totalVotes = totalVotes, resetsToDefault = resetsToDefault })
`;
const CREATE_SESSION_BOUND_QUICK_FEEDBACK_SCRIPT = `
-- QUICK_FEEDBACK_CREATE_SESSION_BOUND
if redis.call('EXISTS', KEYS[7]) == 1 then
  return cjson.encode({ error = 'SESSION_MISMATCH' })
end
local currentRaw = redis.call('GET', KEYS[1])
if currentRaw then
  local decoded, current = pcall(cjson.decode, currentRaw)
  if not decoded or type(current) ~= 'table' then
    return cjson.encode({ error = 'MALFORMED' })
  end
  if current['sessionBound'] ~= true
    or (current['sessionId'] ~= nil and current['sessionId'] ~= ARGV[1]) then
    return cjson.encode({ error = 'SESSION_MISMATCH' })
  end
end
redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
for index = 3, 6 do
  redis.call('DEL', KEYS[index])
end
redis.call('SET', KEYS[2], '1', 'EX', tonumber(ARGV[4]))
return cjson.encode({ ok = true })
`;
const MUTATE_SESSION_BOUND_QUICK_FEEDBACK_SCRIPT = `
-- QUICK_FEEDBACK_MUTATE_SESSION_BOUND
local raw = redis.call('GET', KEYS[1])
if not raw then
  return cjson.encode({ error = 'MISSING' })
end
local decoded, current = pcall(cjson.decode, raw)
if not decoded or type(current) ~= 'table' then
  return cjson.encode({ error = 'MALFORMED' })
end
if current['sessionBound'] ~= true
  or current['sessionId'] ~= ARGV[1]
  or redis.call('EXISTS', KEYS[7]) == 1 then
  return cjson.encode({ error = 'SESSION_MISMATCH' })
end

local action = ARGV[5]
if action == 'END' then
  for index = 1, 6 do
    redis.call('DEL', KEYS[index])
  end
  redis.call('SET', KEYS[2], '1', 'EX', tonumber(ARGV[4]))
  return cjson.encode({ ok = true })
end

if action == 'RESET_ALL' then
  for index = 3, 6 do
    redis.call('DEL', KEYS[index])
  end
elseif action == 'SECOND_ROUND' then
  redis.call('DEL', KEYS[3])
  redis.call('DEL', KEYS[4])
elseif action == 'DISCUSSION' then
  local choices = redis.call('HGETALL', KEYS[4])
  redis.call('DEL', KEYS[5])
  if #choices > 0 then
    redis.call('HSET', KEYS[5], unpack(choices))
    redis.call('EXPIRE', KEYS[5], tonumber(ARGV[3]))
  end
end

redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
redis.call('SET', KEYS[2], '1', 'EX', tonumber(ARGV[4]))
return cjson.encode({ ok = true })
`;
type StoredQuickFeedbackResult = QuickFeedbackResult & {
  sessionBound?: boolean;
  sessionId?: string;
};
type SessionQuickFeedbackGate = {
  id: string;
  quickFeedbackEnabled: boolean;
  quickFeedbackOpen: boolean;
  status: string;
  endedAt: Date | null;
  expiresAt: Date;
  participantCount: number;
};

function feedbackKey(code: string): string {
  return `qf:${code}`;
}

function showLiveResults(result: Pick<QuickFeedbackResult, 'type' | 'showLiveResults'>): boolean {
  return result.showLiveResults ?? quickFeedbackDefaultsToLiveResults(result.type);
}

function audienceQuickFeedbackResult(result: StoredQuickFeedbackResult): QuickFeedbackResult {
  const resultsVisible = showLiveResults(result) || result.locked || result.discussion === true;
  const distribution = resultsVisible
    ? result.distribution
    : Object.fromEntries(Object.keys(result.distribution).map((key) => [key, 0]));
  return {
    ...result,
    showLiveResults: showLiveResults(result),
    resultsVisible,
    distribution,
    round1Distribution: resultsVisible ? result.round1Distribution : undefined,
    opinionShift: resultsVisible ? result.opinionShift : undefined,
    tempoTrend: resultsVisible ? result.tempoTrend : undefined,
  };
}

function knownFeedbackKey(code: string): string {
  return `qf:known:${code}`;
}

async function protectMissingQuickFeedbackCode(
  code: string,
  source: SessionCodeFailureSource,
): Promise<void> {
  if ((await getRedis().exists(knownFeedbackKey(code))) === 1) {
    return;
  }
  const session = await prisma.session.findUnique({
    where: { code },
    select: { id: true },
  });
  if (!session) {
    await rejectInvalidSessionCode(undefined, code, source);
  }
}

async function resolveQuickFeedbackAvailability(
  input: { sessionCode: string; anonymousClientId?: string },
  source: SessionCodeFailureSource,
) {
  const code = input.sessionCode.toUpperCase();
  const redis = getRedis();
  const raw = await redis.get(feedbackKey(code));
  let feedback: StoredQuickFeedbackResult | null = null;
  if (raw) {
    try {
      feedback = parseStoredQuickFeedbackResult(raw);
      if (feedback.sessionBound !== true) {
        return { active: true as const };
      }
    } catch {
      feedback = null;
    }
  }

  const session = await prisma.session.findUnique({
    where: { code },
    select: {
      id: true,
      status: true,
      type: true,
      endedAt: true,
      expiresAt: true,
      qaEnabled: true,
      qaOpen: true,
      qaClosesAt: true,
    },
  });
  const now = new Date();
  const effectivelyFinished = session !== null && isSessionEffectivelyFinished(session, now);
  const qaJoinable =
    session !== null &&
    !(session.expiresAt instanceof Date && now.getTime() >= session.expiresAt.getTime()) &&
    isQaChannelJoinable(session, now);
  const matchingSessionFeedback =
    feedback?.sessionBound === true && session !== null && feedback.sessionId === session.id;
  if (matchingSessionFeedback) {
    return {
      active: !effectivelyFinished,
      sessionStatus: effectivelyFinished ? ('FINISHED' as const) : session.status,
      sessionType: session.type,
      qaJoinable,
    };
  }
  if (!session) {
    return rejectInvalidSessionCode(input.anonymousClientId, code, source);
  }
  return {
    active: false as const,
    sessionStatus: effectivelyFinished ? ('FINISHED' as const) : session.status,
    sessionType: session.type,
    qaJoinable,
  };
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

function sessionFenceKey(sessionId: string | null): string {
  return sessionId
    ? buildQuickFeedbackSessionPurgeFenceKey(sessionId)
    : 'qf:purged-session:v1:standalone';
}

function sessionBoundMutationKeys(code: string, sessionId: string): readonly string[] {
  return [
    feedbackKey(code),
    knownFeedbackKey(code),
    votersKey(code),
    choicesKey(code),
    choicesR1Key(code),
    tempoBucketsKey(code),
    sessionFenceKey(sessionId),
  ];
}

type QuickFeedbackMutationError =
  | 'MISSING'
  | 'MALFORMED'
  | 'SESSION_MISMATCH'
  | 'LOCKED'
  | 'TYPE_CHANGED'
  | 'INVALID_VALUE'
  | 'ALREADY_VOTED';

function parseQuickFeedbackMutationResult(raw: unknown): {
  error?: QuickFeedbackMutationError;
  [key: string]: unknown;
} {
  if (typeof raw !== 'string') {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Redis-Antwort ungültig.' });
  }
  try {
    return JSON.parse(raw) as { error?: QuickFeedbackMutationError; [key: string]: unknown };
  } catch {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Redis-Antwort ungültig.' });
  }
}

function throwForQuickFeedbackMutationError(error: QuickFeedbackMutationError | undefined): void {
  if (error === 'MISSING' || error === 'MALFORMED' || error === 'SESSION_MISMATCH') {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Feedback-Runde nicht gefunden oder abgelaufen.',
    });
  }
}

async function createSessionBoundQuickFeedback(
  code: string,
  sessionId: string,
  result: StoredQuickFeedbackResult,
): Promise<void> {
  const raw = await getRedis().eval(
    CREATE_SESSION_BOUND_QUICK_FEEDBACK_SCRIPT,
    7,
    ...sessionBoundMutationKeys(code, sessionId),
    sessionId,
    JSON.stringify(result),
    String(FEEDBACK_TTL_SECONDS),
    String(KNOWN_FEEDBACK_TTL_SECONDS),
  );
  const payload = parseQuickFeedbackMutationResult(raw);
  throwForQuickFeedbackMutationError(payload.error);
}

type SessionBoundMutationAction = 'REPLACE' | 'RESET_ALL' | 'DISCUSSION' | 'SECOND_ROUND' | 'END';

async function mutateSessionBoundQuickFeedback(
  code: string,
  result: StoredQuickFeedbackResult,
  action: SessionBoundMutationAction,
  knownTtlSeconds = KNOWN_FEEDBACK_TTL_SECONDS,
): Promise<void> {
  const sessionId = result.sessionId;
  if (!sessionId) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Feedback-Runde nicht gefunden oder abgelaufen.',
    });
  }
  const raw = await getRedis().eval(
    MUTATE_SESSION_BOUND_QUICK_FEEDBACK_SCRIPT,
    7,
    ...sessionBoundMutationKeys(code, sessionId),
    sessionId,
    JSON.stringify(result),
    String(FEEDBACK_TTL_SECONDS),
    String(knownTtlSeconds),
    action,
  );
  const payload = parseQuickFeedbackMutationResult(raw);
  throwForQuickFeedbackMutationError(payload.error);
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

function assertSessionQuickFeedbackEnabledGate(
  session: SessionQuickFeedbackGate,
): SessionQuickFeedbackGate {
  if (session.quickFeedbackEnabled !== true) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Blitz-Feedback ist für diese Session nicht aktiviert.',
    });
  }
  if (isSessionEffectivelyFinished(session, new Date())) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Die Session ist beendet. Blitzlicht ist nicht mehr möglich.',
    });
  }
  return session;
}

async function loadSessionQuickFeedbackGate(code: string): Promise<SessionQuickFeedbackGate> {
  const session = await prisma.session.findUnique({
    where: { code },
    select: {
      id: true,
      quickFeedbackEnabled: true,
      quickFeedbackOpen: true,
      status: true,
      endedAt: true,
      expiresAt: true,
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
    endedAt: session.endedAt,
    expiresAt: session.expiresAt,
    participantCount: session._count.participants,
  };
}

async function assertSessionQuickFeedbackEnabled(code: string): Promise<SessionQuickFeedbackGate> {
  return assertSessionQuickFeedbackEnabledGate(await loadSessionQuickFeedbackGate(code));
}

function assertStoredQuickFeedbackSession(
  result: StoredQuickFeedbackResult,
  session: Pick<SessionQuickFeedbackGate, 'id'> | null,
): string {
  if (result.sessionBound !== true || !session || result.sessionId !== session.id) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Feedback-Runde nicht gefunden oder abgelaufen.',
    });
  }
  return session.id;
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

  if (isSessionEffectivelyFinished(session, new Date())) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Die Session ist beendet. Blitzlicht ist nicht mehr möglich.',
    });
  }

  return session;
}

function parseStoredQuickFeedbackResult(raw: string): StoredQuickFeedbackResult {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('invalid payload');
    }
    return parsed as StoredQuickFeedbackResult;
  } catch {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Feedback-Runde nicht gefunden oder abgelaufen.',
    });
  }
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
  allowEndedRead = false,
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
    const gate = await loadSessionQuickFeedbackGate(code);
    assertStoredQuickFeedbackSession(result, gate);
    if (!allowEndedRead) assertSessionQuickFeedbackEnabledGate(gate);
  } else {
    await assertFeedbackHostAccess(ctx.req, code, ctx.connectionParams);
  }

  return result;
}

const QUICK_FEEDBACK_AUDIENCE_CACHE_MS = 250;
const QUICK_FEEDBACK_AUDIENCE_CACHE_MAX_ENTRIES = 512;
type QuickFeedbackAudienceCacheEntry = {
  expiresAt: number;
  ownerSessionIdPromise: Promise<string | null>;
  promise: Promise<QuickFeedbackResult | null>;
  invalidated: boolean;
};
const quickFeedbackAudienceCache = new Map<string, QuickFeedbackAudienceCacheEntry>();

type QuickFeedbackAudienceSource = {
  result: StoredQuickFeedbackResult | null;
  ownerSessionId: string | null;
};

function pruneQuickFeedbackAudienceCache(nowMs: number): void {
  for (const [code, entry] of quickFeedbackAudienceCache) {
    if (entry.expiresAt <= nowMs) {
      quickFeedbackAudienceCache.delete(code);
    }
  }
  while (quickFeedbackAudienceCache.size >= QUICK_FEEDBACK_AUDIENCE_CACHE_MAX_ENTRIES) {
    const oldestCode = quickFeedbackAudienceCache.keys().next().value as string | undefined;
    if (!oldestCode) {
      break;
    }
    quickFeedbackAudienceCache.delete(oldestCode);
  }
}

async function loadQuickFeedbackAudienceSource(code: string): Promise<QuickFeedbackAudienceSource> {
  const raw = await getRedis().get(feedbackKey(code));
  if (!raw) {
    return { result: null, ownerSessionId: null };
  }

  const result = parseStoredQuickFeedbackResult(raw);
  return {
    result,
    ownerSessionId:
      result.sessionBound === true && typeof result.sessionId === 'string'
        ? result.sessionId
        : null,
  };
}

async function buildQuickFeedbackAudienceSnapshot(
  code: string,
  sourcePromise: Promise<QuickFeedbackAudienceSource>,
): Promise<QuickFeedbackResult | null> {
  const { result } = await sourcePromise;
  if (!result) {
    await protectMissingQuickFeedbackCode(code, 'pollReconnect');
    return null;
  }
  const gate =
    result.sessionBound === true
      ? await loadSessionQuickFeedbackGate(code).catch(() => null)
      : null;
  if (result.sessionBound === true) {
    try {
      assertStoredQuickFeedbackSession(result, gate);
    } catch {
      return null;
    }
  }
  if (
    gate &&
    (!gate.quickFeedbackEnabled ||
      !gate.quickFeedbackOpen ||
      isSessionEffectivelyFinished(gate, new Date()))
  ) {
    return null;
  }
  await enrichOpinionShift(result, code);
  await enrichTempoTrend(result, code, gate ?? undefined);
  return QuickFeedbackResultSchema.parse(audienceQuickFeedbackResult(result));
}

function loadQuickFeedbackAudienceSnapshot(code: string): Promise<QuickFeedbackResult | null> {
  const normalizedCode = code.toUpperCase();
  const nowMs = Date.now();
  const cached = quickFeedbackAudienceCache.get(normalizedCode);
  if (cached && cached.expiresAt > nowMs) {
    return cached.promise;
  }

  pruneQuickFeedbackAudienceCache(nowMs);
  const sourcePromise = loadQuickFeedbackAudienceSource(normalizedCode);
  const entry: QuickFeedbackAudienceCacheEntry = {
    expiresAt: Number.POSITIVE_INFINITY,
    ownerSessionIdPromise: sourcePromise.then(
      ({ ownerSessionId }) => ownerSessionId,
      () => null,
    ),
    promise: Promise.resolve(null),
    invalidated: false,
  };
  entry.promise = buildQuickFeedbackAudienceSnapshot(normalizedCode, sourcePromise)
    .then((result) => {
      if (entry.invalidated || quickFeedbackAudienceCache.get(normalizedCode) !== entry) {
        return null;
      }
      entry.expiresAt = Date.now() + QUICK_FEEDBACK_AUDIENCE_CACHE_MS;
      return result;
    })
    .catch((error: unknown) => {
      if (quickFeedbackAudienceCache.get(normalizedCode) === entry) {
        quickFeedbackAudienceCache.delete(normalizedCode);
      }
      throw error;
    });
  quickFeedbackAudienceCache.set(normalizedCode, entry);
  return entry.promise;
}

function invalidateQuickFeedbackAudienceCacheEntry(
  code: string,
  entry: QuickFeedbackAudienceCacheEntry,
): void {
  entry.invalidated = true;
  if (quickFeedbackAudienceCache.get(code) === entry) {
    quickFeedbackAudienceCache.delete(code);
  }
}

export function invalidateQuickFeedbackAudienceCache(code: string): void {
  const normalizedCode = code.toUpperCase();
  const entry = quickFeedbackAudienceCache.get(normalizedCode);
  if (entry) invalidateQuickFeedbackAudienceCacheEntry(normalizedCode, entry);
}

export async function invalidateQuickFeedbackAudienceCacheForSession(
  code: string,
  sessionId: string,
): Promise<void> {
  const normalizedCode = code.toUpperCase();
  const entry = quickFeedbackAudienceCache.get(normalizedCode);
  if (!entry) return;
  const ownerSessionId = await entry.ownerSessionIdPromise;
  if (
    ownerSessionId !== sessionId.trim() ||
    quickFeedbackAudienceCache.get(normalizedCode) !== entry
  ) {
    return;
  }
  invalidateQuickFeedbackAudienceCacheEntry(normalizedCode, entry);
}

export function resetQuickFeedbackAudienceCacheForTests(): void {
  for (const entry of quickFeedbackAudienceCache.values()) {
    entry.invalidated = true;
  }
  quickFeedbackAudienceCache.clear();
}

registerSessionPurgeInvalidator(({ sessionCode, sessionId }) =>
  invalidateQuickFeedbackAudienceCacheForSession(sessionCode, sessionId),
);

export const quickFeedbackRouter = router({
  create: publicProcedure
    .input(CreateQuickFeedbackInputSchema)
    .output(CreateQuickFeedbackOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const redis = getRedis();
      const code = input.sessionCode?.toUpperCase() ?? generateCode();
      const sessionBound = !!input.sessionCode;
      let sessionId: string | undefined;
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
        sessionId = (await assertSessionQuickFeedbackEnabled(code)).id;
      } else {
        const limit = await checkQuickFeedbackStandaloneCreateRate(resolveClientIp(ctx.req).ip);
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
        showLiveResults: input.showLiveResults ?? quickFeedbackDefaultsToLiveResults(input.type),
        totalVotes: 0,
        distribution: emptyDistribution(input.type),
        sessionBound,
        ...(sessionId ? { sessionId } : {}),
      };

      if (sessionId) {
        await createSessionBoundQuickFeedback(code, sessionId, initial);
      } else {
        const multi = redis.multi();
        multi.set(key, JSON.stringify(initial), 'EX', FEEDBACK_TTL_SECONDS);
        multi.del(votersKey(code));
        multi.del(choicesKey(code));
        multi.del(choicesR1Key(code));
        multi.del(tempoBucketsKey(code));
        multi.set(knownFeedbackKey(code), '1', 'EX', KNOWN_FEEDBACK_TTL_SECONDS);
        await multi.exec();
      }

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
      result.showLiveResults = quickFeedbackDefaultsToLiveResults(input.type);
      result.totalVotes = 0;
      result.distribution = emptyDistribution(input.type);
      result.currentRound = undefined;
      result.discussion = undefined;
      result.round1Distribution = undefined;
      result.round1Total = undefined;
      result.opinionShift = undefined;
      result.tempoTrend = undefined;

      if (result.sessionBound === true) {
        await mutateSessionBoundQuickFeedback(code, result, 'RESET_ALL');
      } else {
        const multi = redis.multi();
        multi.set(key, JSON.stringify(result), 'EX', FEEDBACK_TTL_SECONDS);
        multi.del(votersKey(code));
        multi.del(choicesKey(code));
        multi.del(choicesR1Key(code));
        multi.del(tempoBucketsKey(code));
        multi.set(knownFeedbackKey(code), '1', 'EX', KNOWN_FEEDBACK_TTL_SECONDS);
        await multi.exec();
      }

      return { ok: true };
    }),

  setLiveResults: publicProcedure
    .input(UpdateQuickFeedbackPresentationInputSchema)
    .mutation(async ({ ctx, input }) => {
      const redis = getRedis();
      const code = input.sessionCode.toUpperCase();
      const result = await loadQuickFeedbackForHost(ctx, code);
      const sessionId = result.sessionBound === true ? (result.sessionId ?? null) : null;
      const raw = await redis.eval(
        SET_LIVE_RESULTS_SCRIPT,
        3,
        feedbackKey(code),
        knownFeedbackKey(code),
        sessionFenceKey(sessionId),
        sessionId ?? '',
        input.showLiveResults ? '1' : '0',
        String(FEEDBACK_TTL_SECONDS),
        String(KNOWN_FEEDBACK_TTL_SECONDS),
      );
      const payload = parseQuickFeedbackMutationResult(raw);
      throwForQuickFeedbackMutationError(payload.error);
      return {
        showLiveResults:
          typeof payload.showLiveResults === 'boolean'
            ? payload.showLiveResults
            : input.showLiveResults,
      };
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

      if (result.sessionBound === true) {
        await mutateSessionBoundQuickFeedback(code, result, 'RESET_ALL');
      } else {
        const multi = redis.multi();
        multi.set(key, JSON.stringify(result), 'EX', FEEDBACK_TTL_SECONDS);
        multi.del(votersKey(code));
        multi.del(choicesKey(code));
        multi.del(choicesR1Key(code));
        multi.del(tempoBucketsKey(code));
        multi.set(knownFeedbackKey(code), '1', 'EX', KNOWN_FEEDBACK_TTL_SECONDS);
        await multi.exec();
      }

      return { ok: true };
    }),

  end: publicProcedure
    .input(QuickFeedbackVoteInputSchema.pick({ sessionCode: true }))
    .mutation(async ({ ctx, input }) => {
      const redis = getRedis();
      const code = input.sessionCode.toUpperCase();

      const result = await loadQuickFeedbackForHost(ctx, code);

      if (result.sessionBound === true) {
        await mutateSessionBoundQuickFeedback(code, result, 'END', KNOWN_FEEDBACK_GRACE_SECONDS);
      } else {
        const multi = redis.multi();
        multi.del(feedbackKey(code));
        multi.del(votersKey(code));
        multi.del(choicesKey(code));
        multi.del(choicesR1Key(code));
        multi.del(tempoBucketsKey(code));
        multi.set(knownFeedbackKey(code), '1', 'EX', KNOWN_FEEDBACK_GRACE_SECONDS);
        await multi.exec();
      }
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

      if (result.sessionBound === true) {
        await mutateSessionBoundQuickFeedback(code, result, 'REPLACE');
      } else {
        const multi = redis.multi();
        multi.set(key, JSON.stringify(result), 'EX', FEEDBACK_TTL_SECONDS);
        multi.set(knownFeedbackKey(code), '1', 'EX', KNOWN_FEEDBACK_TTL_SECONDS);
        await multi.exec();
      }
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
      if (result.sessionBound === true) {
        await mutateSessionBoundQuickFeedback(code, result, 'DISCUSSION');
      } else {
        const currentChoices = await redis.hgetall(cKey);
        const multi = redis.multi();
        multi.set(key, JSON.stringify(result), 'EX', FEEDBACK_TTL_SECONDS);
        multi.set(knownFeedbackKey(code), '1', 'EX', KNOWN_FEEDBACK_TTL_SECONDS);
        if (Object.keys(currentChoices).length > 0) {
          multi.del(r1Key);
          multi.hset(r1Key, currentChoices);
          multi.expire(r1Key, FEEDBACK_TTL_SECONDS);
        }
        await multi.exec();
      }
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

      if (result.sessionBound === true) {
        await mutateSessionBoundQuickFeedback(code, result, 'SECOND_ROUND');
      } else {
        const multi = redis.multi();
        multi.set(key, JSON.stringify(result), 'EX', FEEDBACK_TTL_SECONDS);
        multi.set(knownFeedbackKey(code), '1', 'EX', KNOWN_FEEDBACK_TTL_SECONDS);
        multi.del(votersKey(code));
        multi.del(choicesKey(code));
        await multi.exec();
      }

      return { ok: true };
    }),

  /**
   * Rückwärtskompatibler kombinierter Join-Resolver: aktives Blitzlicht wird
   * allein in Redis erkannt; andernfalls folgt genau ein Session-Lookup.
   */
  isActive: publicProcedure
    .input(QuickFeedbackIsActiveInputSchema)
    .output(QuickFeedbackIsActiveOutputSchema)
    .query(({ input }) => resolveQuickFeedbackAvailability(input, 'lookup')),

  /** Kombinierter Resolver für automatische Recent-/Reconnect-Prüfungen. */
  isActiveForReconnect: publicProcedure
    .input(QuickFeedbackIsActiveInputSchema)
    .output(QuickFeedbackIsActiveOutputSchema)
    .query(({ input }) => resolveQuickFeedbackAvailability(input, 'pollReconnect')),

  vote: publicProcedure.input(QuickFeedbackVoteInputSchema).mutation(async ({ input }) => {
    const code = input.sessionCode.toUpperCase();
    const key = feedbackKey(code);
    const result = await loadQuickFeedbackForVote(code).catch(async (error: unknown) => {
      if (error instanceof TRPCError && error.code === 'NOT_FOUND') {
        await protectMissingQuickFeedbackCode(code, 'other');
      }
      throw error;
    });

    const gate =
      result.sessionBound === true ? await assertSessionAllowsQuickFeedbackVote(code) : null;
    if (result.sessionBound === true) {
      assertStoredQuickFeedbackSession(result, gate);
    }

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
      await submitTempoVote(input, key, result.sessionId ?? null);
      return { ok: true };
    }

    await submitStandardVote(input, key, result.sessionId ?? null);

    return { ok: true };
  }),

  leaveTempo: publicProcedure
    .input(QuickFeedbackVoteInputSchema.pick({ sessionCode: true, voterId: true }))
    .mutation(async ({ input }) => {
      const result = await loadQuickFeedbackForVote(input.sessionCode.toUpperCase());
      if (result.sessionBound === true) {
        const gate = await assertSessionAllowsQuickFeedbackVote(input.sessionCode.toUpperCase());
        assertStoredQuickFeedbackSession(result, gate);
      }
      await clearTempoVote(input);
      return { ok: true };
    }),

  results: publicProcedure
    .input(QuickFeedbackVoteInputSchema.pick({ sessionCode: true }))
    .output(QuickFeedbackResultSchema)
    .query(async ({ input }) => {
      const code = input.sessionCode.toUpperCase();
      const redis = getRedis();
      const raw = await redis.get(feedbackKey(code));

      if (!raw) {
        await protectMissingQuickFeedbackCode(code, 'pollReconnect');
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Feedback-Runde nicht gefunden oder abgelaufen.',
        });
      }

      const result = parseStoredQuickFeedbackResult(raw);
      const gate =
        result.sessionBound === true
          ? await loadSessionQuickFeedbackGate(code).catch(() => null)
          : null;
      if (result.sessionBound === true) {
        assertStoredQuickFeedbackSession(result, gate);
      }
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
        if (isSessionEffectivelyFinished(gate, new Date())) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Die Session ist beendet. Blitzlicht ist nicht mehr verfügbar.',
          });
        }
      }
      await enrichOpinionShift(result, code);
      await enrichTempoTrend(result, code, gate ?? undefined);
      return QuickFeedbackResultSchema.parse(audienceQuickFeedbackResult(result));
    }),

  hostResults: publicProcedure
    .input(QuickFeedbackVoteInputSchema.pick({ sessionCode: true }))
    .output(QuickFeedbackResultSchema)
    .query(async ({ input, ctx }) => {
      const code = input.sessionCode.toUpperCase();
      const result = await loadQuickFeedbackForHost(ctx, code, true);
      await enrichOpinionShift(result, code);
      await enrichTempoTrend(result, code);
      return QuickFeedbackResultSchema.parse({
        ...result,
        showLiveResults: showLiveResults(result),
        resultsVisible: true,
      });
    }),

  onResults: publicProcedure
    .input(QuickFeedbackVoteInputSchema.pick({ sessionCode: true }))
    .subscription(async function* ({ input }) {
      const code = input.sessionCode.toUpperCase();
      let lastJson = '';

      while (true) {
        const payload = await loadQuickFeedbackAudienceSnapshot(code);
        if (!payload) {
          return;
        }
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
        const result = await loadQuickFeedbackForHost(ctx, code, true).catch(() => null);
        if (!result) {
          return;
        }

        await enrichOpinionShift(result, code);
        await enrichTempoTrend(result, code);
        const payload = QuickFeedbackResultSchema.parse({
          ...result,
          showLiveResults: showLiveResults(result),
          resultsVisible: true,
        });
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

async function submitStandardVote(
  input: QuickFeedbackVoteInput,
  key: string,
  sessionId: string | null,
): Promise<void> {
  const redis = getRedis();
  const code = input.sessionCode.toUpperCase();
  const raw = await redis.eval(
    STANDARD_VOTE_SCRIPT,
    5,
    key,
    votersKey(code),
    choicesKey(code),
    knownFeedbackKey(code),
    sessionFenceKey(sessionId),
    sessionId ?? '',
    input.voterId,
    input.value,
    String(FEEDBACK_TTL_SECONDS),
    String(KNOWN_FEEDBACK_TTL_SECONDS),
  );
  const payload = parseQuickFeedbackMutationResult(raw);

  throwForQuickFeedbackMutationError(payload.error);
  if (payload.error === 'LOCKED') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Abstimmung ist geschlossen.' });
  }
  if (payload.error === 'ALREADY_VOTED') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Du hast bereits abgestimmt.' });
  }
  if (payload.error === 'TYPE_CHANGED' || payload.error === 'INVALID_VALUE') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ungültige Auswahl.' });
  }

  void recordVoteActivity();
}

async function submitTempoVote(
  input: QuickFeedbackVoteInput,
  key: string,
  sessionId: string | null,
): Promise<void> {
  const redis = getRedis();
  const code = input.sessionCode.toUpperCase();
  const cKey = choicesKey(code);
  const bucketKey = tempoBucketsKey(code);
  const raw = await redis.eval(
    TEMPO_VOTE_SCRIPT,
    5,
    key,
    cKey,
    bucketKey,
    knownFeedbackKey(code),
    sessionFenceKey(sessionId),
    sessionId ?? '',
    input.voterId,
    input.value,
    String(FEEDBACK_TTL_SECONDS),
    String(tempoBucketStartMs()),
    String(KNOWN_FEEDBACK_TTL_SECONDS),
    ...TempoValueEnum.options,
  );
  const payload = parseQuickFeedbackMutationResult(raw);

  throwForQuickFeedbackMutationError(payload.error);

  if (payload.error === 'LOCKED') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Abstimmung ist geschlossen.' });
  }

  if (payload.error === 'TYPE_CHANGED') {
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
  multi.set(knownFeedbackKey(code), '1', 'EX', KNOWN_FEEDBACK_TTL_SECONDS);
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
    result.sessionBound === true
      ? Promise.resolve({} as Record<string, string>)
      : redis.hgetall(tempoBucketsKey(code)).catch(() => ({}) as Record<string, string>),
  ]);
  const participantBasis = applyTempoDefaultFollowing(result, activeParticipants);
  const rawSnapshots = parseTempoBucketPayloads(rawBuckets);
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
