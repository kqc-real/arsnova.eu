/**
 * ProductFeedback Invite-Tokens & Follow-up-Capabilities (Story 12.1).
 * Opaque tokens, SHA-256 in Redis. Normales Session-Ende lässt die 24-Stunden-
 * Einladungen bewusst bestehen; der endgültige Admin-/Retention-Purge entfernt
 * deren Sessionbezug. Claim-Slots speichern nur Eignungsdaten — kein
 * Klartext-Bearer.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type Redis from 'ioredis';
import {
  PRODUCT_FEEDBACK_FOLLOWUP_TTL_SECONDS,
  PRODUCT_FEEDBACK_INVITE_TTL_SECONDS,
  PRODUCT_FEEDBACK_PARTICIPANT_SAMPLE_MAX,
  PRODUCT_FEEDBACK_PARTICIPANT_SAMPLE_MIN_ELIGIBLE,
  PRODUCT_FEEDBACK_PARTICIPANT_SAMPLE_RATE,
  getProductFeedbackSurveyDefinition,
  mapParticipantCountToSizeClass,
  type ProductFeedbackRole,
  type ProductFeedbackSessionKind,
  type ProductFeedbackSessionSizeClass,
  type ProductFeedbackSurveyKey,
} from '@arsnova/shared-types';
import { prisma } from '../db';
import { getRedis } from '../redis';
import { assignSurveyKey } from './productFeedbackSurvey';

export const PRODUCT_FEEDBACK_SLOT_PREFIX = 'productFeedback:slot:v1:';
export const PRODUCT_FEEDBACK_TOKEN_PREFIX = 'productFeedback:token:v1:';
export const PRODUCT_FEEDBACK_FOLLOWUP_PREFIX = 'productFeedback:followUp:v1:';
export const PRODUCT_FEEDBACK_IDEM_PREFIX = 'productFeedback:idem:v1:';
export const PRODUCT_FEEDBACK_META_PREFIX = 'productFeedback:meta:v1:';
export const PRODUCT_FEEDBACK_CONSUME_PREFIX = 'productFeedback:consume:v1:';
export const PRODUCT_FEEDBACK_CLAIM_LOCK_PREFIX = 'productFeedback:claimLock:v1:';
export const PRODUCT_FEEDBACK_FOLLOWUP_CONSUME_PREFIX = 'productFeedback:followUpConsume:v1:';

const PRODUCT_FEEDBACK_SESSION_SCOPE_PREFIX = 'productFeedback:session:v2';
const PRODUCT_FEEDBACK_PURGE_DURABILITY_PREFIX = 'productFeedback:purge-durability:v1';
const PRODUCT_FEEDBACK_SESSION_INDEX_MAX_ENTRIES = 128;
const PRODUCT_FEEDBACK_SESSION_INDEX_TTL_GRACE_SECONDS = 5 * 60;
const PRODUCT_FEEDBACK_PURGE_DURABILITY_MARKER_TTL_SECONDS = 5 * 60;
const PRODUCT_FEEDBACK_PURGE_AOF_TIMEOUT_MS = 5_000;
const PRODUCT_FEEDBACK_LEGACY_SCAN_COUNT = 250;
const PRODUCT_FEEDBACK_LEGACY_DELETE_BATCH_SIZE = 100;

export const PRODUCT_FEEDBACK_SESSION_PURGE_BATCH_SIZE = 25;
export const PRODUCT_FEEDBACK_SESSION_PURGE_FENCE_TTL_SECONDS =
  PRODUCT_FEEDBACK_INVITE_TTL_SECONDS + PRODUCT_FEEDBACK_SESSION_INDEX_TTL_GRACE_SECONDS;

const HOST_SUBJECT_ID = 'host';

export type ProductFeedbackInvitePayload = {
  sessionId: string;
  role: ProductFeedbackRole;
  subjectId: string;
  surveyKey: ProductFeedbackSurveyKey;
  surveyVersion: number;
  sessionKind: ProductFeedbackSessionKind;
  featureAreas: string[];
  sessionSizeClass: ProductFeedbackSessionSizeClass;
  used: boolean;
};

/** Eignungs-Slot ohne Bearer-Token (Claim stellt den Token erst aus). */
export type ProductFeedbackSlotPayload = Omit<ProductFeedbackInvitePayload, 'used'> & {
  claimed: boolean;
  /** Nur für Teilnehmer-Slots; bereits gehashter Besitznachweis aus PostgreSQL. */
  participantClaimTokenHash?: string;
};

export type ProductFeedbackFollowUpPayload = {
  feedbackId: string;
  used: boolean;
};

export function hashToken(token: string): string {
  return createHash('sha256').update(token.trim(), 'utf8').digest('hex');
}

function slotKey(sessionId: string, role: ProductFeedbackRole, subjectId: string): string {
  return `${PRODUCT_FEEDBACK_SLOT_PREFIX}${hashToken(`${sessionId}:${role}:${subjectId}`)}`;
}

function tokenKey(tokenHash: string): string {
  return `${PRODUCT_FEEDBACK_TOKEN_PREFIX}${tokenHash}`;
}

function followUpKey(capabilityHash: string): string {
  return `${PRODUCT_FEEDBACK_FOLLOWUP_PREFIX}${capabilityHash}`;
}

function consumeKey(tokenHash: string): string {
  return `${PRODUCT_FEEDBACK_CONSUME_PREFIX}${tokenHash}`;
}

function followUpConsumeKey(capabilityHash: string): string {
  return `${PRODUCT_FEEDBACK_FOLLOWUP_CONSUME_PREFIX}${capabilityHash}`;
}

function idemKey(kind: string, key: string): string {
  return `${PRODUCT_FEEDBACK_IDEM_PREFIX}${kind}:${hashToken(key)}`;
}

function metaKey(sessionId: string): string {
  return `${PRODUCT_FEEDBACK_META_PREFIX}${sessionId}`;
}

function normalizeProductFeedbackSessionId(sessionId: string): string {
  const normalized = sessionId.trim();
  if (!normalized || normalized.includes('{') || normalized.includes('}')) {
    throw new Error('A valid session ID is required for product-feedback invites.');
  }
  return normalized;
}

export function buildProductFeedbackSessionIndexKey(sessionId: string): string {
  return `${PRODUCT_FEEDBACK_SESSION_SCOPE_PREFIX}:{${normalizeProductFeedbackSessionId(sessionId)}}:index`;
}

export function buildProductFeedbackSessionPurgeFenceKey(sessionId: string): string {
  return `${PRODUCT_FEEDBACK_SESSION_SCOPE_PREFIX}:{${normalizeProductFeedbackSessionId(sessionId)}}:purged`;
}

function createOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

const WRITE_INDEXED_INVITE_ARTIFACT_LUA = `
-- product_feedback_write_indexed_artifact_v2
if redis.call('EXISTS', KEYS[3]) == 1 then
  return -2
end
local already_indexed = redis.call('SISMEMBER', KEYS[2], KEYS[1])
if already_indexed == 0 and redis.call('SCARD', KEYS[2]) >= tonumber(ARGV[5]) then
  return -1
end
local written
if ARGV[4] == 'NX' then
  written = redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2], 'NX')
  if not written then
    local existing = redis.call('GET', KEYS[1])
    if not existing then return 0 end
    local decoded, payload = pcall(cjson.decode, existing)
    if not decoded or type(payload) ~= 'table' or payload['sessionId'] ~= ARGV[6] then
      return -3
    end
  end
else
  written = redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
end
redis.call('SADD', KEYS[2], KEYS[1])
local current_index_ttl = redis.call('TTL', KEYS[2])
if current_index_ttl < tonumber(ARGV[3]) then
  redis.call('EXPIRE', KEYS[2], ARGV[3])
end
if written then return 1 end
return 0
`;

const CLAIM_INVITE_LUA = `
-- product_feedback_claim_invite_v2
if redis.call('EXISTS', KEYS[4]) == 1 then return -2 end
local raw = redis.call('GET', KEYS[1])
if not raw or raw ~= ARGV[1] then return 0 end
local ttl = redis.call('TTL', KEYS[1])
if ttl <= 0 then return 0 end
local decoded, slot = pcall(cjson.decode, raw)
if not decoded or type(slot) ~= 'table' or slot['sessionId'] ~= ARGV[6] then return -3 end
local additions = 0
if redis.call('SISMEMBER', KEYS[3], KEYS[1]) == 0 then additions = additions + 1 end
if redis.call('SISMEMBER', KEYS[3], KEYS[2]) == 0 then additions = additions + 1 end
if redis.call('SCARD', KEYS[3]) + additions > tonumber(ARGV[5]) then return -1 end
local created = redis.call('SET', KEYS[2], ARGV[2], 'EX', ttl, 'NX')
if not created then return 0 end
redis.call('SET', KEYS[1], ARGV[3], 'EX', ttl, 'XX')
redis.call('SADD', KEYS[3], KEYS[1], KEYS[2])
local current_index_ttl = redis.call('TTL', KEYS[3])
if current_index_ttl < tonumber(ARGV[4]) then redis.call('EXPIRE', KEYS[3], ARGV[4]) end
return ttl
`;

const RESERVE_INVITE_LUA = `
-- product_feedback_reserve_invite_v2
if redis.call('EXISTS', KEYS[4]) == 1 then return -2 end
local raw = redis.call('GET', KEYS[1])
if not raw or raw ~= ARGV[1] then return 0 end
local ttl = redis.call('TTL', KEYS[1])
if ttl <= 0 then return 0 end
local decoded, payload = pcall(cjson.decode, raw)
if not decoded or type(payload) ~= 'table' or payload['sessionId'] ~= ARGV[5]
  or payload['used'] == true then return -3 end
local additions = 0
if redis.call('SISMEMBER', KEYS[3], KEYS[1]) == 0 then additions = additions + 1 end
if redis.call('SISMEMBER', KEYS[3], KEYS[2]) == 0 then additions = additions + 1 end
if redis.call('SCARD', KEYS[3]) + additions > tonumber(ARGV[4]) then return -1 end
local created = redis.call('SET', KEYS[2], ARGV[2], 'EX', ttl, 'NX')
if not created then return 0 end
redis.call('SADD', KEYS[3], KEYS[1], KEYS[2])
local current_index_ttl = redis.call('TTL', KEYS[3])
if current_index_ttl < tonumber(ARGV[3]) then redis.call('EXPIRE', KEYS[3], ARGV[3]) end
return 1
`;

const FINALIZE_INVITE_LUA = `
-- product_feedback_finalize_invite_v2
if redis.call('EXISTS', KEYS[5]) == 1 then return -2 end
local raw = redis.call('GET', KEYS[1])
if not raw or raw ~= ARGV[1] then return 0 end
local ttl = redis.call('TTL', KEYS[1])
if ttl <= 0 then return 0 end
local decoded, payload = pcall(cjson.decode, raw)
if not decoded or type(payload) ~= 'table' or payload['sessionId'] ~= ARGV[5] then return -3 end
local projected = redis.call('SCARD', KEYS[4])
if redis.call('SISMEMBER', KEYS[4], KEYS[2]) == 1 then projected = projected - 1 end
if redis.call('SISMEMBER', KEYS[4], KEYS[3]) == 1 then projected = projected - 1 end
if redis.call('SISMEMBER', KEYS[4], KEYS[1]) == 0 then projected = projected + 1 end
if projected > tonumber(ARGV[4]) then return -1 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ttl)
redis.call('DEL', KEYS[2], KEYS[3])
redis.call('SREM', KEYS[4], KEYS[2], KEYS[3])
redis.call('SADD', KEYS[4], KEYS[1])
local current_index_ttl = redis.call('TTL', KEYS[4])
if current_index_ttl < tonumber(ARGV[3]) then redis.call('EXPIRE', KEYS[4], ARGV[3]) end
return 1
`;

const PURGE_INDEXED_INVITE_ARTIFACTS_LUA = `
-- product_feedback_purge_indexed_artifacts_v2
redis.call('SET', KEYS[2], '1', 'EX', ARGV[1])
local expected_count = tonumber(ARGV[2])
if redis.call('SCARD', KEYS[1]) ~= expected_count then return {0, 0} end
for index = 4, #KEYS do
  if redis.call('SISMEMBER', KEYS[1], KEYS[index]) == 0 then return {0, 0} end
  local raw = redis.call('GET', KEYS[index])
  if raw then
    local decoded, payload = pcall(cjson.decode, raw)
    if not decoded or type(payload) ~= 'table' or payload['sessionId'] ~= ARGV[3] then
      return {-1, 0}
    end
  end
end
local deleted = redis.call('UNLINK', KEYS[3])
for index = 4, #KEYS do deleted = deleted + redis.call('UNLINK', KEYS[index]) end
redis.call('DEL', KEYS[1])
return {1, deleted}
`;

const PURGE_LEGACY_INVITE_ARTIFACTS_LUA = `
-- product_feedback_purge_legacy_artifacts_v2
local deleted = 0
for index = 1, #KEYS do
  local expected = ARGV[(index - 1) * 2 + 1]
  local session_id = ARGV[(index - 1) * 2 + 2]
  local raw = redis.call('GET', KEYS[index])
  if raw and raw == expected then
    local decoded, payload = pcall(cjson.decode, raw)
    if decoded and type(payload) == 'table' and payload['sessionId'] == session_id then
      deleted = deleted + redis.call('UNLINK', KEYS[index])
    end
  end
end
return deleted
`;

function assertInviteIndexCapacityResult(result: number): void {
  if (result === -1) {
    throw new Error('PRODUCT_FEEDBACK_SESSION_INDEX_CAPACITY_EXCEEDED');
  }
  if (result === -3) {
    throw new Error('PRODUCT_FEEDBACK_SESSION_ARTIFACT_SCOPE_MISMATCH');
  }
}

async function writeIndexedInviteArtifact(input: {
  redis: Redis;
  sessionId: string;
  key: string;
  payload: string;
  ttlSeconds: number;
  mode: 'NX' | 'SET';
}): Promise<'created' | 'existing' | 'fenced'> {
  const sessionId = normalizeProductFeedbackSessionId(input.sessionId);
  const result = Number(
    await input.redis.eval(
      WRITE_INDEXED_INVITE_ARTIFACT_LUA,
      3,
      input.key,
      buildProductFeedbackSessionIndexKey(sessionId),
      buildProductFeedbackSessionPurgeFenceKey(sessionId),
      input.payload,
      String(input.ttlSeconds),
      String(PRODUCT_FEEDBACK_SESSION_PURGE_FENCE_TTL_SECONDS),
      input.mode,
      String(PRODUCT_FEEDBACK_SESSION_INDEX_MAX_ENTRIES),
      sessionId,
    ),
  );
  assertInviteIndexCapacityResult(result);
  if (result === -2) return 'fenced';
  if (result === 1) return 'created';
  if (result === 0) return 'existing';
  throw new Error('PRODUCT_FEEDBACK_SESSION_ARTIFACT_WRITE_FAILED');
}

function parseInvitePayload(raw: string): ProductFeedbackInvitePayload | null {
  try {
    const payload = JSON.parse(raw) as ProductFeedbackInvitePayload;
    if (
      !payload ||
      typeof payload !== 'object' ||
      typeof payload.sessionId !== 'string' ||
      normalizeProductFeedbackSessionId(payload.sessionId) !== payload.sessionId
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

async function readInviteRecord(
  inviteToken: string,
  options: { includeUsed?: boolean } = {},
): Promise<{
  key: string;
  raw: string;
  payload: ProductFeedbackInvitePayload;
} | null> {
  const redis = getRedis();
  const key = tokenKey(hashToken(inviteToken));
  const firstRaw = await redis.get(key);
  if (!firstRaw) return null;
  const payload = parseInvitePayload(firstRaw);
  if (!payload || (payload.used && !options.includeUsed)) return null;

  // Der zweite, atomare Read bindet den Payload an die Fence. Beginnt der
  // Session-Purge zwischen beiden Reads, darf weder Survey noch Submit den
  // zuvor gelesenen Bearer weiterverwenden.
  const [stableRaw, fence] = await redis.mget(
    key,
    buildProductFeedbackSessionPurgeFenceKey(payload.sessionId),
  );
  if (fence !== null || stableRaw !== firstRaw) return null;
  return { key, raw: firstRaw, payload };
}

/** Stabile Stichprobe: sortierte IDs + Hash(sessionId|id) Ranking. */
export function sampleParticipantIds(sessionId: string, eligibleIds: string[]): string[] {
  const sorted = [...eligibleIds].sort();
  if (sorted.length === 0) return [];

  const scored = sorted.map((id) => ({
    id,
    score: createHash('sha256').update(`${sessionId}|${id}`, 'utf8').digest('hex'),
  }));
  scored.sort((a, b) => (a.score < b.score ? -1 : a.score > b.score ? 1 : 0));

  let n = Math.floor(sorted.length * PRODUCT_FEEDBACK_PARTICIPANT_SAMPLE_RATE);
  if (sorted.length >= PRODUCT_FEEDBACK_PARTICIPANT_SAMPLE_MIN_ELIGIBLE && n < 1) {
    n = 1;
  }
  n = Math.min(PRODUCT_FEEDBACK_PARTICIPANT_SAMPLE_MAX, n, sorted.length);
  return scored.slice(0, n).map((s) => s.id);
}

/**
 * Batched Eligibility: eine SQL-Query für PG-Interaktionen + optional Redis SMEMBERS.
 */
async function loadEligibleParticipantIds(
  sessionId: string,
  sessionCode: string,
): Promise<{
  eligibleIds: string[];
  featureAreas: string[];
  hasVotes: boolean;
  hasQa: boolean;
  hasQf: boolean;
}> {
  const [interactionRows, qfVoters] = await Promise.all([
    prisma.$queryRaw<Array<{ participantId: string; source: string }>>(Prisma.sql`
      SELECT DISTINCT v."participantId" AS "participantId", 'vote' AS source
      FROM "Vote" v
      WHERE v."sessionId" = ${sessionId}
      UNION
      SELECT DISTINCT q."participantId", 'qa'
      FROM "QaQuestion" q
      WHERE q."sessionId" = ${sessionId}
      UNION
      SELECT DISTINCT u."participantId", 'qa_upvote'
      FROM "QaUpvote" u
      INNER JOIN "QaQuestion" q ON q."id" = u."qaQuestionId"
      WHERE q."sessionId" = ${sessionId}
    `),
    loadQuickFeedbackVoterIds(sessionCode),
  ]);

  const eligible = new Set<string>();
  let hasVotes = false;
  let hasQa = false;
  for (const row of interactionRows) {
    eligible.add(row.participantId);
    if (row.source === 'vote') hasVotes = true;
    if (row.source === 'qa' || row.source === 'qa_upvote') hasQa = true;
  }
  for (const id of qfVoters) eligible.add(id);
  const hasQf = qfVoters.length > 0;

  const featureAreas: string[] = [];
  if (hasVotes) featureAreas.push('quiz');
  if (hasQa) featureAreas.push('qa');
  if (hasQf) featureAreas.push('quickFeedback');

  return { eligibleIds: [...eligible], featureAreas, hasVotes, hasQa, hasQf };
}

async function loadQuickFeedbackVoterIds(sessionCode: string): Promise<string[]> {
  try {
    const redis = getRedis();
    const members = await redis.smembers(`qf:voters:${sessionCode.toUpperCase()}`);
    return members.filter((m) => typeof m === 'string' && m.length > 0);
  } catch {
    return [];
  }
}

function resolveSessionKind(input: {
  quizStarted: boolean;
  hasVotes: boolean;
  hasQa: boolean;
  hasQf: boolean;
}): ProductFeedbackSessionKind {
  const quizish = input.quizStarted || input.hasVotes;
  const used = [quizish, input.hasQa, input.hasQf].filter(Boolean).length;
  if (used >= 2) return 'MIXED';
  if (quizish) return 'QUIZ';
  if (input.hasQf) return 'QUICK_FEEDBACK';
  if (input.hasQa) return 'MIXED';
  return 'UNKNOWN';
}

/**
 * Nach FINISHED: Eignung, Stichprobe, Eignungs-Slots (pipelined Redis).
 * Best-effort bzgl. Fehlerbehandlung beim Aufrufer — Session-Ende darf nicht fehlschlagen.
 */

async function recordProductFeedbackInviteIssuance(input: {
  participantInvites: number;
  hostInvite: boolean;
}): Promise<void> {
  const total = input.participantInvites + (input.hostInvite ? 1 : 0);
  if (total <= 0) return;
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  const ops = [];
  if (input.hostInvite) {
    ops.push(
      prisma.productFeedbackInviteLedger.upsert({
        where: { day_role: { day, role: 'HOST' } },
        create: { day, role: 'HOST', count: 1 },
        update: { count: { increment: 1 } },
      }),
    );
  }
  if (input.participantInvites > 0) {
    ops.push(
      prisma.productFeedbackInviteLedger.upsert({
        where: { day_role: { day, role: 'PARTICIPANT' } },
        create: { day, role: 'PARTICIPANT', count: input.participantInvites },
        update: { count: { increment: input.participantInvites } },
      }),
    );
  }
  await Promise.all(ops);
}

export async function createInviteTokensForSession(
  sessionId: string,
): Promise<{ participantInvites: number; hostInvite: boolean }> {
  const empty = { participantInvites: 0, hostInvite: false };

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      code: true,
      status: true,
      quizStarted: true,
      _count: { select: { participants: true } },
    },
  });
  if (!session || session.status !== 'FINISHED') return empty;

  const { eligibleIds, featureAreas, hasVotes, hasQa, hasQf } = await loadEligibleParticipantIds(
    sessionId,
    session.code,
  );

  const sessionKind = resolveSessionKind({
    quizStarted: session.quizStarted,
    hasVotes,
    hasQa,
    hasQf,
  });
  const sessionSizeClass = mapParticipantCountToSizeClass(session._count.participants);
  const selected = sampleParticipantIds(sessionId, eligibleIds);
  const participantClaimRows =
    selected.length > 0
      ? await prisma.participant.findMany({
          where: {
            sessionId,
            id: { in: selected },
            productFeedbackClaimTokenHash: { not: null },
          },
          select: { id: true, productFeedbackClaimTokenHash: true },
        })
      : [];
  const participantClaimTokenHashes = new Map(
    participantClaimRows.map((row) => [row.id, row.productFeedbackClaimTokenHash!]),
  );

  const hostEligible =
    session._count.participants >= 1 && (eligibleIds.length > 0 || hasVotes || hasQa || hasQf);

  type Pending = {
    role: ProductFeedbackRole;
    subjectId: string;
    surveyKey: ProductFeedbackSurveyKey;
    participantClaimTokenHash?: string;
  };
  const pending: Pending[] = [];
  if (hostEligible) {
    pending.push({
      role: 'HOST',
      subjectId: HOST_SUBJECT_ID,
      surveyKey: assignSurveyKey('HOST', `${sessionId}:${HOST_SUBJECT_ID}`),
    });
  }
  for (const participantId of selected) {
    const participantClaimTokenHash = participantClaimTokenHashes.get(participantId);
    if (!participantClaimTokenHash) continue;
    pending.push({
      role: 'PARTICIPANT',
      subjectId: participantId,
      surveyKey: assignSurveyKey('PARTICIPANT', `${sessionId}:${participantId}`),
      participantClaimTokenHash,
    });
  }
  if (pending.length === 0) return empty;

  const redis = getRedis();
  const slotKeys = pending.map((p) => slotKey(sessionId, p.role, p.subjectId));
  const ttl = PRODUCT_FEEDBACK_INVITE_TTL_SECONDS;
  let participantInvites = 0;
  let hostInvite = false;

  const createResults = await Promise.all(
    pending.map(async (entry, i) => {
      const survey = getProductFeedbackSurveyDefinition(entry.surveyKey);
      const slotPayload: ProductFeedbackSlotPayload = {
        sessionId,
        role: entry.role,
        subjectId: entry.subjectId,
        surveyKey: entry.surveyKey,
        surveyVersion: survey.surveyVersion,
        sessionKind,
        featureAreas,
        sessionSizeClass,
        claimed: false,
        ...(entry.participantClaimTokenHash
          ? { participantClaimTokenHash: entry.participantClaimTokenHash }
          : {}),
      };
      // Nur Eignungsdaten und ein Hash — kein Klartext-Bearer im Slot.
      return writeIndexedInviteArtifact({
        redis,
        sessionId,
        key: slotKeys[i]!,
        payload: JSON.stringify(slotPayload),
        ttlSeconds: ttl,
        mode: 'NX',
      });
    }),
  );
  for (let i = 0; i < pending.length; i += 1) {
    if (createResults[i] !== 'created') continue;
    if (pending[i]!.role === 'HOST') hostInvite = true;
    else participantInvites += 1;
  }

  await writeIndexedInviteArtifact({
    redis,
    sessionId,
    key: metaKey(sessionId),
    payload: JSON.stringify({
      sessionId,
      invitedParticipants: participantInvites,
      eligibleParticipants: eligibleIds.length,
      hostInvite,
      issuedAt: new Date().toISOString(),
    }),
    ttlSeconds: ttl,
    mode: 'SET',
  });

  // Nur tatsächlich neu gesetzte Slots zählen.
  await recordProductFeedbackInviteIssuance({ participantInvites, hostInvite }).catch(
    () => undefined,
  );

  return { participantInvites, hostInvite };
}

/**
 * Stellt den Bearer erst beim Claim aus; Slot enthält danach nur claimed=true.
 */
export async function claimProductFeedbackInvite(params: {
  sessionId: string;
  role: ProductFeedbackRole;
  subjectId: string;
  participantClaimToken?: string;
}): Promise<string | null> {
  const redis = getRedis();
  const slot = slotKey(params.sessionId, params.role, params.subjectId);
  const raw = await redis.get(slot);
  if (!raw) return null;

  let slotPayload: ProductFeedbackSlotPayload;
  try {
    slotPayload = JSON.parse(raw) as ProductFeedbackSlotPayload;
  } catch {
    return null;
  }
  if (
    slotPayload.claimed ||
    slotPayload.sessionId !== params.sessionId ||
    slotPayload.role !== params.role ||
    slotPayload.subjectId !== params.subjectId
  ) {
    return null;
  }
  if (
    params.role === 'PARTICIPANT' &&
    (!params.participantClaimToken ||
      !slotPayload.participantClaimTokenHash ||
      hashToken(params.participantClaimToken) !== slotPayload.participantClaimTokenHash)
  ) {
    return null;
  }

  const token = createOpaqueToken();
  const invitePayload: ProductFeedbackInvitePayload = {
    sessionId: slotPayload.sessionId,
    role: slotPayload.role,
    subjectId: slotPayload.subjectId,
    surveyKey: slotPayload.surveyKey,
    surveyVersion: slotPayload.surveyVersion,
    sessionKind: slotPayload.sessionKind,
    featureAreas: slotPayload.featureAreas,
    sessionSizeClass: slotPayload.sessionSizeClass,
    used: false,
  };
  const claimedSlot: ProductFeedbackSlotPayload = { ...slotPayload, claimed: true };
  const result = await redis.eval(
    CLAIM_INVITE_LUA,
    4,
    slot,
    tokenKey(hashToken(token)),
    buildProductFeedbackSessionIndexKey(params.sessionId),
    buildProductFeedbackSessionPurgeFenceKey(params.sessionId),
    raw,
    JSON.stringify(invitePayload),
    JSON.stringify(claimedSlot),
    String(PRODUCT_FEEDBACK_SESSION_PURGE_FENCE_TTL_SECONDS),
    String(PRODUCT_FEEDBACK_SESSION_INDEX_MAX_ENTRIES),
    params.sessionId,
  );
  const status = Number(result);
  assertInviteIndexCapacityResult(status);
  return status > 0 ? token : null;
}

export async function getInvitePayloadByToken(
  inviteToken: string,
  options: { includeUsed?: boolean } = {},
): Promise<ProductFeedbackInvitePayload | null> {
  return (await readInviteRecord(inviteToken, options))?.payload ?? null;
}

/**
 * Reserviert das Invite für Submit (NX), ohne es endgültig zu verbrauchen.
 * Bei DB-Fehler muss `releaseInviteReservation` aufgerufen werden.
 */
export async function reserveInviteForSubmit(
  inviteToken: string,
): Promise<ProductFeedbackInvitePayload | null> {
  const redis = getRedis();
  const tokenHash = hashToken(inviteToken);
  const record = await readInviteRecord(inviteToken);
  if (!record) return null;
  const sessionId = record.payload.sessionId;
  const result = Number(
    await redis.eval(
      RESERVE_INVITE_LUA,
      4,
      record.key,
      consumeKey(tokenHash),
      buildProductFeedbackSessionIndexKey(sessionId),
      buildProductFeedbackSessionPurgeFenceKey(sessionId),
      record.raw,
      JSON.stringify({ sessionId }),
      String(PRODUCT_FEEDBACK_SESSION_PURGE_FENCE_TTL_SECONDS),
      String(PRODUCT_FEEDBACK_SESSION_INDEX_MAX_ENTRIES),
      sessionId,
    ),
  );
  assertInviteIndexCapacityResult(result);
  return result === 1 ? record.payload : null;
}

export async function releaseInviteReservation(inviteToken: string): Promise<void> {
  await getRedis().del(consumeKey(hashToken(inviteToken)));
}

/** Markiert Invite nach erfolgreicher Persistenz als verbraucht. */
export async function finalizeInviteUsed(
  inviteToken: string,
  payload: ProductFeedbackInvitePayload,
): Promise<boolean> {
  const redis = getRedis();
  const key = tokenKey(hashToken(inviteToken));
  const raw = await redis.get(key);
  if (!raw) return false;
  const current = parseInvitePayload(raw);
  if (!current || current.sessionId !== payload.sessionId) return false;
  const usedPayload: ProductFeedbackInvitePayload = { ...payload, used: true };
  const result = Number(
    await redis.eval(
      FINALIZE_INVITE_LUA,
      5,
      key,
      slotKey(payload.sessionId, payload.role, payload.subjectId),
      consumeKey(hashToken(inviteToken)),
      buildProductFeedbackSessionIndexKey(payload.sessionId),
      buildProductFeedbackSessionPurgeFenceKey(payload.sessionId),
      raw,
      JSON.stringify(usedPayload),
      String(PRODUCT_FEEDBACK_SESSION_PURGE_FENCE_TTL_SECONDS),
      String(PRODUCT_FEEDBACK_SESSION_INDEX_MAX_ENTRIES),
      payload.sessionId,
    ),
  );
  assertInviteIndexCapacityResult(result);
  return result === 1;
}

/** @deprecated Prefer reserveInviteForSubmit + finalizeInviteUsed */
export async function markInviteUsed(
  inviteToken: string,
): Promise<{ payload: ProductFeedbackInvitePayload; consumed: boolean } | null> {
  const payload = await reserveInviteForSubmit(inviteToken);
  if (!payload) return null;
  const consumed = await finalizeInviteUsed(inviteToken, payload);
  return { payload, consumed };
}

interface RedisDurabilityContext {
  readonly clientId: string;
  readonly serverRunId: string;
}

function requiresProductFeedbackPurgeDurability(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.PRODUCT_FEEDBACK_PURGE_REQUIRE_DURABILITY === '1'
  );
}

async function readRedisClientId(redis: Redis): Promise<string> {
  const clientId = String(await redis.call('CLIENT', 'ID'));
  if (!/^[1-9]\d*$/.test(clientId)) {
    throw new Error('PRODUCT_FEEDBACK_PURGE_DURABILITY_UNAVAILABLE');
  }
  return clientId;
}

async function readRedisServerRunId(redis: Redis): Promise<string> {
  const info = String(await redis.call('INFO', 'server'));
  const runId = info.match(/(?:^|\r?\n)run_id:([0-9a-f]{40})(?:\r?\n|$)/i)?.[1];
  if (!runId) throw new Error('PRODUCT_FEEDBACK_PURGE_DURABILITY_UNAVAILABLE');
  return runId.toLowerCase();
}

async function readRedisDurabilityContext(redis: Redis): Promise<RedisDurabilityContext> {
  const clientId = await readRedisClientId(redis);
  const serverRunId = await readRedisServerRunId(redis);
  const verifiedClientId = await readRedisClientId(redis);
  if (verifiedClientId !== clientId) {
    throw new Error('PRODUCT_FEEDBACK_PURGE_DURABILITY_UNAVAILABLE');
  }
  return { clientId, serverRunId };
}

function sameRedisDurabilityContext(
  left: RedisDurabilityContext,
  right: RedisDurabilityContext,
): boolean {
  return left.clientId === right.clientId && left.serverRunId === right.serverRunId;
}

async function beginProductFeedbackPurgeDurability(
  redis: Redis,
): Promise<RedisDurabilityContext | null> {
  return requiresProductFeedbackPurgeDurability() ? readRedisDurabilityContext(redis) : null;
}

async function awaitProductFeedbackPurgeDurability(
  redis: Redis,
  expectedContext: RedisDurabilityContext | null,
): Promise<void> {
  if (expectedContext === null) return;
  const beforeMarker = await readRedisDurabilityContext(redis);
  if (!sameRedisDurabilityContext(beforeMarker, expectedContext)) {
    throw new Error('PRODUCT_FEEDBACK_PURGE_DURABILITY_UNAVAILABLE');
  }
  await redis.set(
    `${PRODUCT_FEEDBACK_PURGE_DURABILITY_PREFIX}:${randomUUID()}`,
    randomUUID(),
    'EX',
    PRODUCT_FEEDBACK_PURGE_DURABILITY_MARKER_TTL_SECONDS,
  );
  const result = (await redis.call(
    'WAITAOF',
    1,
    0,
    PRODUCT_FEEDBACK_PURGE_AOF_TIMEOUT_MS,
  )) as unknown;
  const afterWait = await readRedisDurabilityContext(redis);
  if (
    !Array.isArray(result) ||
    Number(result[0]) < 1 ||
    !sameRedisDurabilityContext(afterWait, expectedContext)
  ) {
    throw new Error('PRODUCT_FEEDBACK_PURGE_DURABILITY_UNAVAILABLE');
  }
}

function isProductFeedbackIndexedArtifactKey(key: string, sessionId: string): boolean {
  return (
    key === metaKey(sessionId) ||
    key.startsWith(PRODUCT_FEEDBACK_SLOT_PREFIX) ||
    key.startsWith(PRODUCT_FEEDBACK_TOKEN_PREFIX) ||
    key.startsWith(PRODUCT_FEEDBACK_CONSUME_PREFIX)
  );
}

async function purgeIndexedInviteArtifactsForSession(
  redis: Redis,
  rawSessionId: string,
): Promise<number> {
  const sessionId = normalizeProductFeedbackSessionId(rawSessionId);
  const indexKey = buildProductFeedbackSessionIndexKey(sessionId);
  const fenceKey = buildProductFeedbackSessionPurgeFenceKey(sessionId);

  // Die Fence wird vor jeglichem Index-/Legacy-Read gesetzt. Damit ist der
  // Mitgliedersatz für alle v2-Writer stabil und ein Fehler blockiert den
  // fachlichen Session-Delete weiterhin fail-closed.
  await redis.set(fenceKey, '1', 'EX', PRODUCT_FEEDBACK_SESSION_PURGE_FENCE_TTL_SECONDS);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const indexedKeys = await redis.smembers(indexKey);
    if (
      indexedKeys.length > PRODUCT_FEEDBACK_SESSION_INDEX_MAX_ENTRIES ||
      !indexedKeys.every((key) => isProductFeedbackIndexedArtifactKey(key, sessionId))
    ) {
      throw new Error('PRODUCT_FEEDBACK_SESSION_INDEX_SCOPE_MISMATCH');
    }
    const result = await redis.eval(
      PURGE_INDEXED_INVITE_ARTIFACTS_LUA,
      3 + indexedKeys.length,
      indexKey,
      fenceKey,
      metaKey(sessionId),
      ...indexedKeys,
      String(PRODUCT_FEEDBACK_SESSION_PURGE_FENCE_TTL_SECONDS),
      String(indexedKeys.length),
      sessionId,
    );
    if (!Array.isArray(result) || result.length !== 2) {
      throw new Error('PRODUCT_FEEDBACK_SESSION_PURGE_FAILED');
    }
    const status = Number(result[0]);
    const deleted = Number(result[1]);
    if (status === -1) throw new Error('PRODUCT_FEEDBACK_SESSION_INDEX_SCOPE_MISMATCH');
    if (status === 1 && Number.isSafeInteger(deleted) && deleted >= 0) return deleted;
    if (status !== 0) throw new Error('PRODUCT_FEEDBACK_SESSION_PURGE_FAILED');
  }
  throw new Error('PRODUCT_FEEDBACK_SESSION_INDEX_CHANGED_DURING_PURGE');
}

async function purgeLegacyInviteArtifacts(
  redis: Redis,
  sessionIds: readonly string[],
): Promise<number> {
  const targeted = new Set(sessionIds);
  let deleted = 0;
  for (const pattern of [`${PRODUCT_FEEDBACK_SLOT_PREFIX}*`, `${PRODUCT_FEEDBACK_TOKEN_PREFIX}*`]) {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        PRODUCT_FEEDBACK_LEGACY_SCAN_COUNT,
      );
      cursor = nextCursor;
      for (
        let offset = 0;
        offset < keys.length;
        offset += PRODUCT_FEEDBACK_LEGACY_DELETE_BATCH_SIZE
      ) {
        const batchKeys = keys.slice(offset, offset + PRODUCT_FEEDBACK_LEGACY_DELETE_BATCH_SIZE);
        const values = await redis.mget(...batchKeys);
        const candidates: Array<{ key: string; raw: string; sessionId: string }> = [];
        for (let index = 0; index < batchKeys.length; index += 1) {
          const raw = values[index];
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw) as { sessionId?: unknown };
            if (typeof parsed.sessionId !== 'string' || !targeted.has(parsed.sessionId)) continue;
            candidates.push({ key: batchKeys[index]!, raw, sessionId: parsed.sessionId });
          } catch {
            // Ohne beweisbare sessionId darf ein globaler Legacy-Key nicht
            // einem beliebigen Session-Purge zugeordnet werden.
          }
        }
        if (candidates.length === 0) continue;
        const result = Number(
          await redis.eval(
            PURGE_LEGACY_INVITE_ARTIFACTS_LUA,
            candidates.length,
            ...candidates.map(({ key }) => key),
            ...candidates.flatMap(({ raw, sessionId }) => [raw, sessionId]),
          ),
        );
        if (!Number.isSafeInteger(result) || result < 0) {
          throw new Error('PRODUCT_FEEDBACK_LEGACY_PURGE_FAILED');
        }
        deleted += result;
      }
    } while (cursor !== '0');
  }
  return deleted;
}

/**
 * Setzt dauerhafte sessionId-Fences, entfernt den v2-Index atomar und migriert
 * vorindexierte Slot-/Token-Payloads über einen validierten, paginierten Scan.
 * Pro AOF-Barriere werden höchstens 25 Sessions verarbeitet.
 */
export async function purgeProductFeedbackInvitesForSessions(
  sessionIds: readonly string[],
): Promise<number> {
  const uniqueSessionIds = [...new Set(sessionIds.map(normalizeProductFeedbackSessionId))];
  if (uniqueSessionIds.length === 0) return 0;
  const redis = getRedis();
  let deleted = 0;
  for (
    let offset = 0;
    offset < uniqueSessionIds.length;
    offset += PRODUCT_FEEDBACK_SESSION_PURGE_BATCH_SIZE
  ) {
    const chunk = uniqueSessionIds.slice(
      offset,
      offset + PRODUCT_FEEDBACK_SESSION_PURGE_BATCH_SIZE,
    );
    const durabilityContext = await beginProductFeedbackPurgeDurability(redis);
    const results = await Promise.allSettled(
      chunk.map((sessionId) => purgeIndexedInviteArtifactsForSession(redis, sessionId)),
    );
    const failed = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (failed) throw failed.reason;
    deleted += results.reduce(
      (sum, result) => sum + (result.status === 'fulfilled' ? result.value : 0),
      0,
    );
    deleted += await purgeLegacyInviteArtifacts(redis, chunk);
    await awaitProductFeedbackPurgeDurability(redis, durabilityContext);
  }
  return deleted;
}

export async function purgeProductFeedbackInvitesForSession(sessionId: string): Promise<number> {
  return purgeProductFeedbackInvitesForSessions([sessionId]);
}

export async function createFollowUpCapability(
  feedbackId: string,
  inviteToken: string,
  expiresAt: Date,
): Promise<string> {
  const capability = hashToken(`productFeedback:followUp:v1:${inviteToken}:${feedbackId}`);
  const remainingSeconds = Math.ceil((expiresAt.getTime() - Date.now()) / 1000);
  if (remainingSeconds <= 0) return capability;
  const ttl = Math.min(PRODUCT_FEEDBACK_FOLLOWUP_TTL_SECONDS, remainingSeconds);
  const payload: ProductFeedbackFollowUpPayload = { feedbackId, used: false };
  await getRedis().set(followUpKey(hashToken(capability)), JSON.stringify(payload), 'EX', ttl);
  return capability;
}

export async function consumeFollowUpCapability(
  capability: string,
): Promise<ProductFeedbackFollowUpPayload | null> {
  const redis = getRedis();
  const capabilityHash = hashToken(capability);
  const key = followUpKey(capabilityHash);
  const claimed = await redis.set(
    followUpConsumeKey(capabilityHash),
    '1',
    'EX',
    PRODUCT_FEEDBACK_FOLLOWUP_TTL_SECONDS,
    'NX',
  );
  if (claimed !== 'OK') return null;

  const raw = await redis.get(key);
  if (!raw) {
    await redis.del(followUpConsumeKey(capabilityHash));
    return null;
  }
  let payload: ProductFeedbackFollowUpPayload;
  try {
    payload = JSON.parse(raw) as ProductFeedbackFollowUpPayload;
  } catch {
    await redis.del(followUpConsumeKey(capabilityHash));
    return null;
  }
  if (payload.used) {
    await redis.del(followUpConsumeKey(capabilityHash));
    return null;
  }
  return payload;
}

export async function finalizeFollowUpCapability(capability: string): Promise<void> {
  const redis = getRedis();
  const capabilityHash = hashToken(capability);
  await redis.del(followUpKey(capabilityHash), followUpConsumeKey(capabilityHash));
}

export async function releaseFollowUpReservation(capability: string): Promise<void> {
  const redis = getRedis();
  const capabilityHash = hashToken(capability);
  await redis.del(followUpConsumeKey(capabilityHash));
}

export async function getIdempotentResult<T>(
  kind: string,
  idempotencyKey: string,
): Promise<T | null> {
  const raw = await getRedis().get(idemKey(kind, idempotencyKey));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setIdempotentResult(
  kind: string,
  idempotencyKey: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  await getRedis().set(idemKey(kind, idempotencyKey), JSON.stringify(value), 'EX', ttlSeconds);
}

export function surveyDtoForKey(surveyKey: ProductFeedbackSurveyKey) {
  return getProductFeedbackSurveyDefinition(surveyKey);
}

export function buildSlotKeyForTests(
  sessionId: string,
  role: ProductFeedbackRole,
  subjectId: string,
): string {
  return slotKey(sessionId, role, subjectId);
}
