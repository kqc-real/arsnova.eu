/**
 * ProductFeedback Invite-Tokens & Follow-up-Capabilities (Story 12.1).
 * Opaque tokens, SHA-256 in Redis, unabhängig vom Session-Redis-Cleanup.
 * Claim-Slots speichern nur Eignungsdaten — kein Klartext-Bearer.
 */
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
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

function claimLockKey(sessionId: string, role: ProductFeedbackRole, subjectId: string): string {
  return `${PRODUCT_FEEDBACK_CLAIM_LOCK_PREFIX}${hashToken(`${sessionId}:${role}:${subjectId}`)}`;
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

function createOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
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

  const hostEligible =
    session._count.participants >= 1 && (eligibleIds.length > 0 || hasVotes || hasQa || hasQf);

  type Pending = {
    role: ProductFeedbackRole;
    subjectId: string;
    surveyKey: ProductFeedbackSurveyKey;
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
    pending.push({
      role: 'PARTICIPANT',
      subjectId: participantId,
      surveyKey: assignSurveyKey('PARTICIPANT', `${sessionId}:${participantId}`),
    });
  }
  if (pending.length === 0) return empty;

  const redis = getRedis();
  const slotKeys = pending.map((p) => slotKey(sessionId, p.role, p.subjectId));
  const existing = await redis.mget(...slotKeys);
  const ttl = PRODUCT_FEEDBACK_INVITE_TTL_SECONDS;
  const pipe = redis.pipeline();
  let participantInvites = 0;
  let hostInvite = false;

  for (let i = 0; i < pending.length; i += 1) {
    if (existing[i]) continue;
    const entry = pending[i]!;
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
    };
    // Nur Eignungsdaten — kein Klartext-Bearer im Slot.
    pipe.set(slotKeys[i]!, JSON.stringify(slotPayload), 'EX', ttl, 'NX');
    if (entry.role === 'HOST') hostInvite = true;
    else participantInvites += 1;
  }

  pipe.set(
    metaKey(sessionId),
    JSON.stringify({
      invitedParticipants: participantInvites,
      eligibleParticipants: eligibleIds.length,
      hostInvite,
      issuedAt: new Date().toISOString(),
    }),
    'EX',
    ttl,
  );
  await pipe.exec();

  // Nur neu gesetzte Slots zählen (NX-Skip oben lässt Zähler bei 0).
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
}): Promise<string | null> {
  const redis = getRedis();
  const slot = slotKey(params.sessionId, params.role, params.subjectId);
  const lock = claimLockKey(params.sessionId, params.role, params.subjectId);

  const locked = await redis.set(lock, '1', 'EX', 30, 'NX');
  if (locked !== 'OK') return null;

  try {
    const raw = await redis.get(slot);
    if (!raw) return null;

    let slotPayload: ProductFeedbackSlotPayload;
    try {
      slotPayload = JSON.parse(raw) as ProductFeedbackSlotPayload;
    } catch {
      return null;
    }
    if (slotPayload.claimed) return null;

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
    const ttl = PRODUCT_FEEDBACK_INVITE_TTL_SECONDS;
    const tokenOk = await redis.set(
      tokenKey(hashToken(token)),
      JSON.stringify(invitePayload),
      'EX',
      ttl,
      'NX',
    );
    if (tokenOk !== 'OK') return null;

    const claimedSlot: ProductFeedbackSlotPayload = { ...slotPayload, claimed: true };
    await redis.set(slot, JSON.stringify(claimedSlot), 'EX', ttl);
    return token;
  } finally {
    await redis.del(lock);
  }
}

export async function getInvitePayloadByToken(
  inviteToken: string,
): Promise<ProductFeedbackInvitePayload | null> {
  const raw = await getRedis().get(tokenKey(hashToken(inviteToken)));
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw) as ProductFeedbackInvitePayload;
    if (payload.used) return null;
    return payload;
  } catch {
    return null;
  }
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
  const claimed = await redis.set(
    consumeKey(tokenHash),
    '1',
    'EX',
    PRODUCT_FEEDBACK_INVITE_TTL_SECONDS,
    'NX',
  );
  if (claimed !== 'OK') return null;

  const payload = await getInvitePayloadByToken(inviteToken);
  if (!payload) {
    await redis.del(consumeKey(tokenHash));
    return null;
  }
  return payload;
}

export async function releaseInviteReservation(inviteToken: string): Promise<void> {
  await getRedis().del(consumeKey(hashToken(inviteToken)));
}

/** Markiert Invite nach erfolgreicher Persistenz als verbraucht. */
export async function finalizeInviteUsed(
  inviteToken: string,
  payload: ProductFeedbackInvitePayload,
): Promise<void> {
  const redis = getRedis();
  const key = tokenKey(hashToken(inviteToken));
  const usedPayload: ProductFeedbackInvitePayload = { ...payload, used: true };
  const ttl = await redis.ttl(key);
  if (ttl > 0) {
    await redis.set(key, JSON.stringify(usedPayload), 'EX', ttl);
  } else {
    await redis.set(key, JSON.stringify(usedPayload), 'EX', PRODUCT_FEEDBACK_INVITE_TTL_SECONDS);
  }
  await redis.del(slotKey(payload.sessionId, payload.role, payload.subjectId));
}

/** @deprecated Prefer reserveInviteForSubmit + finalizeInviteUsed */
export async function markInviteUsed(
  inviteToken: string,
): Promise<{ payload: ProductFeedbackInvitePayload; consumed: boolean } | null> {
  const payload = await reserveInviteForSubmit(inviteToken);
  if (!payload) return null;
  await finalizeInviteUsed(inviteToken, payload);
  return { payload, consumed: true };
}

export async function createFollowUpCapability(feedbackId: string): Promise<string> {
  const capability = createOpaqueToken();
  const payload: ProductFeedbackFollowUpPayload = { feedbackId, used: false };
  await getRedis().set(
    followUpKey(hashToken(capability)),
    JSON.stringify(payload),
    'EX',
    PRODUCT_FEEDBACK_FOLLOWUP_TTL_SECONDS,
  );
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
  payload.used = true;
  await redis.set(key, JSON.stringify(payload), 'EX', 60);
  return payload;
}

export async function releaseFollowUpReservation(capability: string): Promise<void> {
  const redis = getRedis();
  const capabilityHash = hashToken(capability);
  const key = followUpKey(capabilityHash);
  await redis.del(followUpConsumeKey(capabilityHash));
  const raw = await redis.get(key);
  if (!raw) return;
  try {
    const payload = JSON.parse(raw) as ProductFeedbackFollowUpPayload;
    if (!payload.used) return;
    payload.used = false;
    await redis.set(key, JSON.stringify(payload), 'EX', PRODUCT_FEEDBACK_FOLLOWUP_TTL_SECONDS);
  } catch {
    // ignore corrupt payload
  }
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
