/**
 * Redis-backed Pairing-Registry für Story 2.10 Slice 1.
 * Secrets und Paired-Host-Tokens werden nur gehasht persistiert.
 * Das Klartext-Token bleibt im Claim-Kuvert bis zur Claim-TTL lesbar,
 * damit ein verlorener Poll wiederholt werden kann.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import {
  HOST_PAIRING_CAPS,
  HOST_PAIRING_CLAIM_TTL_SECONDS,
  HOST_PAIRING_INVITE_TTL_SECONDS,
  HOST_PAIRING_PENDING_TTL_SECONDS,
  type HostPairingErrorCode,
  type HostPairingScreenVisibility,
  type HostPairingState,
  type HostSessionRole,
} from '@arsnova/shared-types';
import { prisma } from '../db';
import { getRedis } from '../redis';
import {
  createPairedHostInvalidationHub,
  PAIRED_HOST_INVALIDATION_CHANNEL,
} from './hostPairingInvalidation';
import { withHostPairingSessionLock } from './hostPairingLock';
import {
  applyHostPairingCommand,
  emptyHostPairingRecord,
  hostPairingUserMessage,
  isExpiredAt,
  type HostPairingEffect,
  type HostPairingPurgeReferences,
  type HostPairingRecord,
} from './hostPairingState';

export const HOST_PAIRING_SESSION_PREFIX = 'host:pairing:v1:session:';
export const HOST_PAIRING_INVITE_LOOKUP_PREFIX = 'host:pairing:v1:invite:';
export const HOST_PAIRING_REQUEST_LOOKUP_PREFIX = 'host:pairing:v1:request:';
export const HOST_PAIRING_TOKEN_LOOKUP_PREFIX = 'host:pairing:v1:token:';
export const HOST_PAIRING_CLAIM_PREFIX = 'host:pairing:v1:claim:';
export const HOST_PAIRING_OUTCOME_PREFIX = 'host:pairing:v1:outcome:';
const HOST_PAIRING_SESSION_INDEX_PREFIX = 'host:pairing:v1:index:';
const HOST_PAIRING_SESSION_PURGE_FENCE_PREFIX = 'host:pairing:v1:purged-session:';
const HOST_PAIRING_SESSION_INDEX_TTL_SECONDS = 8 * 60 * 60 + 5 * 60;
const HOST_PAIRING_SESSION_INDEX_MAX_ENTRIES = 2_048;

const CONFIRMATION_WORDS = [
  'Eule',
  'Fuchs',
  'Luchs',
  'Dachs',
  'Falke',
  'Kranich',
  'Biber',
  'Igel',
  'Reh',
  'Star',
] as const;

const CONFIRMATION_INDICATORS: readonly string[] = Array.from({ length: 256 }, (_, index) => {
  const word = CONFIRMATION_WORDS[index % CONFIRMATION_WORDS.length]!;
  const number = 10 + (index % 90);
  return `${word} · ${number}`;
});

export type HostPairingServiceError = Error & {
  pairingCode: HostPairingErrorCode;
};

function pairingError(code: HostPairingErrorCode): HostPairingServiceError {
  const error = new Error(hostPairingUserMessage(code)) as HostPairingServiceError;
  error.pairingCode = code;
  return error;
}

export function isHostPairingServiceError(error: unknown): error is HostPairingServiceError {
  return error instanceof Error && 'pairingCode' in error;
}

export function normalizeHostPairingSessionCode(sessionCode: string): string {
  return sessionCode.trim().toUpperCase();
}

function normalizeSessionId(sessionId: string): string {
  const normalized = sessionId.trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(normalized)) {
    throw new Error('A valid session ID is required for host pairing.');
  }
  return normalized;
}

function positiveTtlEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 30 || parsed > 3600) {
    return fallback;
  }
  return parsed;
}

export function getHostPairingInviteTtlSeconds(): number {
  return positiveTtlEnv('HOST_PAIRING_INVITE_TTL_SECONDS', HOST_PAIRING_INVITE_TTL_SECONDS);
}

export function getHostPairingPendingTtlSeconds(): number {
  return positiveTtlEnv('HOST_PAIRING_PENDING_TTL_SECONDS', HOST_PAIRING_PENDING_TTL_SECONDS);
}

export function getHostPairingCaps() {
  return {
    ...HOST_PAIRING_CAPS,
    inviteTtlSeconds: getHostPairingInviteTtlSeconds(),
    pendingTtlSeconds: getHostPairingPendingTtlSeconds(),
  };
}

export function hashHostPairingSecret(value: string): string {
  return createHash('sha256').update(value.trim(), 'utf8').digest('hex');
}

function hashesEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function buildHostPairingSessionKey(sessionCode: string): string {
  return `${HOST_PAIRING_SESSION_PREFIX}${normalizeHostPairingSessionCode(sessionCode)}`;
}

export function buildHostPairingInviteLookupKey(secretHash: string): string {
  return `${HOST_PAIRING_INVITE_LOOKUP_PREFIX}${secretHash}`;
}

export function buildHostPairingRequestLookupKey(requestSecretHash: string): string {
  return `${HOST_PAIRING_REQUEST_LOOKUP_PREFIX}${requestSecretHash}`;
}

export function buildHostPairingTokenLookupKey(tokenHash: string): string {
  return `${HOST_PAIRING_TOKEN_LOOKUP_PREFIX}${tokenHash}`;
}

export function buildHostPairingClaimKey(requestSecretHash: string): string {
  return `${HOST_PAIRING_CLAIM_PREFIX}${requestSecretHash}`;
}

export function buildHostPairingOutcomeKey(requestSecretHash: string): string {
  return `${HOST_PAIRING_OUTCOME_PREFIX}${requestSecretHash}`;
}

export function buildHostPairingSessionIndexKey(sessionId: string): string {
  return `${HOST_PAIRING_SESSION_INDEX_PREFIX}${normalizeSessionId(sessionId)}`;
}

export function buildHostPairingSessionPurgeFenceKey(sessionId: string): string {
  return `${HOST_PAIRING_SESSION_PURGE_FENCE_PREFIX}${normalizeSessionId(sessionId)}`;
}

function createSecret(): string {
  return randomBytes(32).toString('base64url');
}

function createConfirmationIndicator(): string {
  return CONFIRMATION_INDICATORS[randomBytes(1)[0]!]!;
}

function recordTtlSeconds(record: HostPairingRecord): number {
  if (record.pairedHosts.length > 0 || record.purgeReferences) {
    return 60 * 60 * 8;
  }
  const now = Date.now();
  const remaining = [record.invite?.expiresAt, record.pending?.expiresAt]
    .filter((value): value is string => Boolean(value))
    .map((value) => Math.ceil((Date.parse(value) - now) / 1000));
  return Math.max(60, ...remaining, getHostPairingInviteTtlSeconds());
}

function parsePurgeReferences(value: unknown): HostPairingPurgeReferences | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('HOST_PAIRING_RECORD_INVALID');
  }
  const candidate = value as Partial<HostPairingPurgeReferences>;
  const fields = [candidate.requestSecretHashes, candidate.tokenIds, candidate.tokenHashes];
  if (
    fields.some(
      (field) =>
        !Array.isArray(field) ||
        field.length > 16 ||
        !field.every((entry) => typeof entry === 'string' && entry.length > 0),
    )
  ) {
    throw new Error('HOST_PAIRING_RECORD_INVALID');
  }
  return {
    requestSecretHashes: [...new Set(candidate.requestSecretHashes!)],
    tokenIds: [...new Set(candidate.tokenIds!)],
    tokenHashes: [...new Set(candidate.tokenHashes!)],
  };
}

function parseRecord(raw: string | null): HostPairingRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as HostPairingRecord;
    if (!parsed || !Array.isArray(parsed.pairedHosts)) {
      return null;
    }
    return {
      sessionId: typeof parsed.sessionId === 'string' ? parsed.sessionId : null,
      version: parsed.version ?? 1,
      invite: parsed.invite ?? null,
      pending: parsed.pending ?? null,
      pairedHosts: parsed.pairedHosts,
      purgeReferences: parsePurgeReferences(parsed.purgeReferences),
    };
  } catch {
    return null;
  }
}

export function parseHostPairingRecord(raw: string | null): HostPairingRecord | null {
  return parseRecord(raw);
}

async function loadRecord(sessionCode: string, sessionId: string): Promise<HostPairingRecord> {
  const normalizedSessionId = normalizeSessionId(sessionId);
  const parsed = parseRecord(await getRedis().get(buildHostPairingSessionKey(sessionCode)));
  // Legacy/code-reused records are never adopted. This intentionally invalidates
  // pre-sessionId credentials instead of attaching them to a possibly new session.
  if (!parsed || parsed.sessionId !== normalizedSessionId) {
    return emptyHostPairingRecord(normalizedSessionId);
  }
  return parsed;
}

function parseArtifactIndex(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      !Array.isArray(parsed) ||
      parsed.length > HOST_PAIRING_SESSION_INDEX_MAX_ENTRIES ||
      !parsed.every((value): value is string => typeof value === 'string')
    ) {
      throw new Error('HOST_PAIRING_SESSION_INDEX_INVALID');
    }
    return [...new Set(parsed)];
  } catch (error) {
    if (error instanceof Error && error.message === 'HOST_PAIRING_SESSION_INDEX_INVALID') {
      throw error;
    }
    throw new Error('HOST_PAIRING_SESSION_INDEX_INVALID', { cause: error });
  }
}

async function trackArtifact(sessionId: string, key: string): Promise<void> {
  const redis = getRedis();
  const indexKey = buildHostPairingSessionIndexKey(sessionId);
  const keys = parseArtifactIndex(await redis.get(indexKey));
  if (!keys.includes(key)) keys.push(key);
  if (keys.length > HOST_PAIRING_SESSION_INDEX_MAX_ENTRIES) {
    throw new Error('HOST_PAIRING_SESSION_INDEX_CAPACITY_EXCEEDED');
  }
  await redis.set(indexKey, JSON.stringify(keys), 'EX', HOST_PAIRING_SESSION_INDEX_TTL_SECONDS);
}

async function untrackArtifact(sessionId: string, key: string): Promise<void> {
  const redis = getRedis();
  const indexKey = buildHostPairingSessionIndexKey(sessionId);
  const keys = parseArtifactIndex(await redis.get(indexKey)).filter((entry) => entry !== key);
  if (keys.length === 0) {
    await redis.del(indexKey);
    return;
  }
  await redis.set(indexKey, JSON.stringify(keys), 'EX', HOST_PAIRING_SESSION_INDEX_TTL_SECONDS);
}

async function assertSessionNotPurged(sessionId: string): Promise<void> {
  if (await getRedis().get(buildHostPairingSessionPurgeFenceKey(sessionId))) {
    throw pairingError('SESSION_ENDED');
  }
}

async function saveRecord(
  sessionCode: string,
  sessionId: string,
  record: HostPairingRecord,
): Promise<void> {
  if (record.sessionId !== normalizeSessionId(sessionId)) {
    throw new Error('HOST_PAIRING_SESSION_ID_MISMATCH');
  }
  const ttl = recordTtlSeconds(record);
  if (
    !record.invite &&
    !record.pending &&
    record.pairedHosts.length === 0 &&
    !record.purgeReferences
  ) {
    await getRedis().del(buildHostPairingSessionKey(sessionCode));
    return;
  }
  await getRedis().set(buildHostPairingSessionKey(sessionCode), JSON.stringify(record), 'EX', ttl);
}

type ClaimEnvelope = {
  sessionId: string;
  sessionCode: string;
  requestId: string;
  tokenId: string;
  pairedHostToken: string;
};
type RequestOutcome = {
  sessionId: string;
  sessionCode: string;
  requestId: string;
  state: HostPairingState;
  tokenId?: string;
};

async function applyEffects(
  sessionCode: string,
  sessionId: string,
  effects: HostPairingEffect[],
  issuedToken?: string,
  credentialVersion?: number,
): Promise<void> {
  const redis = getRedis();
  const code = normalizeHostPairingSessionCode(sessionCode);
  const normalizedSessionId = normalizeSessionId(sessionId);
  const lookupTtl = Math.max(
    getHostPairingInviteTtlSeconds(),
    getHostPairingPendingTtlSeconds(),
    HOST_PAIRING_CLAIM_TTL_SECONDS,
  );
  for (const effect of effects) {
    switch (effect.type) {
      case 'DELETE_INVITE_LOOKUP':
        await redis.del(buildHostPairingInviteLookupKey(effect.secretHash));
        await untrackArtifact(
          normalizedSessionId,
          buildHostPairingInviteLookupKey(effect.secretHash),
        );
        break;
      case 'SET_INVITE_LOOKUP':
        await trackArtifact(
          normalizedSessionId,
          buildHostPairingInviteLookupKey(effect.secretHash),
        );
        await redis.set(
          buildHostPairingInviteLookupKey(effect.secretHash),
          JSON.stringify({
            sessionId: normalizedSessionId,
            sessionCode: code,
            inviteId: effect.inviteId,
          }),
          'EX',
          getHostPairingInviteTtlSeconds(),
        );
        break;
      case 'DELETE_REQUEST_LOOKUP':
        await redis.del(buildHostPairingRequestLookupKey(effect.requestSecretHash));
        await untrackArtifact(
          normalizedSessionId,
          buildHostPairingRequestLookupKey(effect.requestSecretHash),
        );
        break;
      case 'SET_REQUEST_LOOKUP':
        await trackArtifact(
          normalizedSessionId,
          buildHostPairingRequestLookupKey(effect.requestSecretHash),
        );
        await redis.set(
          buildHostPairingRequestLookupKey(effect.requestSecretHash),
          JSON.stringify({
            sessionId: normalizedSessionId,
            sessionCode: code,
            requestId: effect.requestId,
          }),
          'EX',
          getHostPairingPendingTtlSeconds(),
        );
        break;
      case 'SET_TOKEN_LOOKUP':
        await trackArtifact(normalizedSessionId, buildHostPairingTokenLookupKey(effect.tokenHash));
        await redis.set(
          buildHostPairingTokenLookupKey(effect.tokenHash),
          JSON.stringify({
            sessionId: normalizedSessionId,
            sessionCode: code,
            tokenId: effect.tokenId,
            credentialVersion: credentialVersion ?? 0,
          }),
          'EX',
          60 * 60 * 8,
        );
        break;
      case 'DELETE_TOKEN_LOOKUP':
        await redis.del(buildHostPairingTokenLookupKey(effect.tokenHash));
        await untrackArtifact(
          normalizedSessionId,
          buildHostPairingTokenLookupKey(effect.tokenHash),
        );
        break;
      case 'ISSUE_CLAIM':
        if (!issuedToken) break;
        await trackArtifact(
          normalizedSessionId,
          buildHostPairingClaimKey(effect.requestSecretHash),
        );
        await redis.set(
          buildHostPairingClaimKey(effect.requestSecretHash),
          JSON.stringify({
            sessionId: normalizedSessionId,
            sessionCode: code,
            requestId: effect.requestId,
            tokenId: effect.tokenId,
            pairedHostToken: issuedToken,
          } satisfies ClaimEnvelope),
          'EX',
          HOST_PAIRING_CLAIM_TTL_SECONDS,
        );
        break;
      case 'SET_OUTCOME':
        await trackArtifact(
          normalizedSessionId,
          buildHostPairingOutcomeKey(effect.requestSecretHash),
        );
        await redis.set(
          buildHostPairingOutcomeKey(effect.requestSecretHash),
          JSON.stringify({
            sessionId: normalizedSessionId,
            sessionCode: code,
            requestId: effect.requestId,
            state: effect.state,
            tokenId: effect.tokenId,
          } satisfies RequestOutcome),
          'EX',
          lookupTtl,
        );
        break;
      case 'INVALIDATE_TOKEN_HASH':
        notifyPairedHostTokenInvalidated(code, effect.tokenHash);
        break;
    }
  }
}

async function withSessionLock<T>(sessionCode: string, fn: () => Promise<T>): Promise<T> {
  return withHostPairingSessionLock(sessionCode, fn, () => {
    throw pairingError('RATE_LIMITED');
  });
}

export async function createHostPairingInvite(params: {
  sessionId: string;
  sessionCode: string;
  screenVisibility: HostPairingScreenVisibility;
}): Promise<{
  inviteId: string;
  pairingSecret: string;
  expiresAt: string;
  screenVisibility: HostPairingScreenVisibility;
}> {
  const pairingSecret = createSecret();
  const inviteId = randomUUID();
  const now = new Date();
  return withSessionLock(params.sessionCode, async () => {
    await assertSessionNotPurged(params.sessionId);
    const current = await loadRecord(params.sessionCode, params.sessionId);
    const result = applyHostPairingCommand(current, {
      type: 'CREATE_INVITE',
      inviteId,
      secretHash: hashHostPairingSecret(pairingSecret),
      screenVisibility: params.screenVisibility,
      now,
      inviteTtlSeconds: getHostPairingInviteTtlSeconds(),
    });
    if (!result.ok) throw pairingError(result.code);
    await applyEffects(params.sessionCode, params.sessionId, result.effects);
    await saveRecord(params.sessionCode, params.sessionId, result.record);
    return {
      inviteId,
      pairingSecret,
      expiresAt: result.record.invite!.expiresAt,
      screenVisibility: params.screenVisibility,
    };
  });
}

export async function requestHostPairing(params: {
  sessionId: string;
  sessionCode: string;
  pairingSecret: string;
  deviceLabel?: string;
}): Promise<{
  requestId: string | null;
  requestSecret: string | null;
  confirmationIndicator: string | null;
  alreadyPending: boolean;
  expiresAt: string | null;
}> {
  const inviteSecretHash = hashHostPairingSecret(params.pairingSecret);
  const lookupRaw = await getRedis().get(buildHostPairingInviteLookupKey(inviteSecretHash));
  if (!lookupRaw) {
    throw pairingError('INVITE_INVALID');
  }
  let lookup: { sessionId?: string; sessionCode?: string; inviteId?: string };
  try {
    lookup = JSON.parse(lookupRaw) as typeof lookup;
  } catch {
    throw pairingError('INVITE_INVALID');
  }
  if (
    lookup.sessionId !== normalizeSessionId(params.sessionId) ||
    normalizeHostPairingSessionCode(lookup.sessionCode ?? '') !==
      normalizeHostPairingSessionCode(params.sessionCode)
  ) {
    throw pairingError('INVITE_INVALID');
  }

  const requestId = randomUUID();
  const requestSecret = createSecret();
  const confirmationIndicator = createConfirmationIndicator();
  const now = new Date();

  return withSessionLock(params.sessionCode, async () => {
    await assertSessionNotPurged(params.sessionId);
    const current = await loadRecord(params.sessionCode, params.sessionId);
    const lockedLookupRaw = await getRedis().get(buildHostPairingInviteLookupKey(inviteSecretHash));
    if (!lockedLookupRaw) throw pairingError('INVITE_INVALID');
    try {
      const lockedLookup = JSON.parse(lockedLookupRaw) as {
        sessionId?: string;
        sessionCode?: string;
        inviteId?: string;
      };
      if (
        lockedLookup.sessionId !== normalizeSessionId(params.sessionId) ||
        normalizeHostPairingSessionCode(lockedLookup.sessionCode ?? '') !==
          normalizeHostPairingSessionCode(params.sessionCode)
      ) {
        throw pairingError('INVITE_INVALID');
      }
    } catch (error) {
      if (isHostPairingServiceError(error)) throw error;
      throw pairingError('INVITE_INVALID');
    }
    const result = applyHostPairingCommand(current, {
      type: 'REQUEST',
      inviteSecretHash,
      requestId,
      requestSecretHash: hashHostPairingSecret(requestSecret),
      confirmationIndicator,
      deviceLabel: params.deviceLabel?.trim() || null,
      now,
      pendingTtlSeconds: getHostPairingPendingTtlSeconds(),
    });
    if (!result.ok) throw pairingError(result.code);
    await applyEffects(params.sessionCode, params.sessionId, result.effects);
    if (!result.alreadyPending) {
      await saveRecord(params.sessionCode, params.sessionId, result.record);
    }
    if (result.alreadyPending) {
      return {
        requestId: null,
        requestSecret: null,
        confirmationIndicator: result.confirmationIndicator ?? null,
        alreadyPending: true,
        expiresAt: current.pending?.expiresAt ?? null,
      };
    }
    return {
      requestId,
      requestSecret,
      confirmationIndicator,
      alreadyPending: false,
      expiresAt: result.record.pending?.expiresAt ?? null,
    };
  });
}

export async function approveHostPairing(params: {
  sessionId: string;
  sessionCode: string;
  requestId: string;
}): Promise<{ tokenId: string; confirmationIndicator: string }> {
  const pairedHostToken = createSecret();
  const tokenId = randomUUID();
  const now = new Date();
  return withSessionLock(params.sessionCode, async () => {
    await assertSessionNotPurged(params.sessionId);
    const session = await prisma.session.findUnique({
      where: { code: normalizeHostPairingSessionCode(params.sessionCode) },
      select: { id: true, hostCredentialVersion: true },
    });
    if (!session || session.id !== normalizeSessionId(params.sessionId)) {
      throw pairingError('REQUEST_NOT_FOUND');
    }
    const current = await loadRecord(params.sessionCode, params.sessionId);
    const result = applyHostPairingCommand(current, {
      type: 'APPROVE',
      requestId: params.requestId,
      tokenId,
      tokenHash: hashHostPairingSecret(pairedHostToken),
      now,
    });
    if (!result.ok) throw pairingError(result.code);
    await applyEffects(
      params.sessionCode,
      params.sessionId,
      result.effects,
      pairedHostToken,
      session.hostCredentialVersion ?? 0,
    );
    await saveRecord(params.sessionCode, params.sessionId, result.record);
    return {
      tokenId,
      confirmationIndicator: result.confirmationIndicator ?? '',
    };
  });
}

export async function rejectHostPairing(params: {
  sessionId: string;
  sessionCode: string;
  requestId: string;
}): Promise<void> {
  const now = new Date();
  await withSessionLock(params.sessionCode, async () => {
    await assertSessionNotPurged(params.sessionId);
    const current = await loadRecord(params.sessionCode, params.sessionId);
    const result = applyHostPairingCommand(current, {
      type: 'REJECT',
      requestId: params.requestId,
      now,
    });
    if (!result.ok) throw pairingError(result.code);
    await applyEffects(params.sessionCode, params.sessionId, result.effects);
    await saveRecord(params.sessionCode, params.sessionId, result.record);
  });
}

export async function revokePairedHost(params: {
  sessionId: string;
  sessionCode: string;
  tokenId: string;
}): Promise<void> {
  const now = new Date();
  await withSessionLock(params.sessionCode, async () => {
    await assertSessionNotPurged(params.sessionId);
    const current = await loadRecord(params.sessionCode, params.sessionId);
    const result = applyHostPairingCommand(current, {
      type: 'REVOKE',
      tokenId: params.tokenId,
      now,
    });
    if (!result.ok) throw pairingError(result.code);
    await applyEffects(params.sessionCode, params.sessionId, result.effects);
    await saveRecord(params.sessionCode, params.sessionId, result.record);
  });
}

export async function invalidateHostPairingForSession(
  sessionCode: string,
  sessionId?: string,
): Promise<void> {
  const code = normalizeHostPairingSessionCode(sessionCode);
  const requestedSessionId = sessionId ? normalizeSessionId(sessionId) : null;
  const now = new Date();
  await withSessionLock(code, async () => {
    // Die DB-Identitaet wird innerhalb desselben Code-Locks gelesen, unter dem
    // auch der Redis-Record mutiert wird. So kann ein spaeter Aufruf fuer eine
    // geloeschte Session keinen Record eines wiederverwendeten Codes leeren.
    const authoritativeSession = await prisma.session.findUnique({
      where: { code },
      select: { id: true },
    });
    const resolvedSessionId = requestedSessionId ?? authoritativeSession?.id;
    if (!resolvedSessionId || authoritativeSession?.id !== resolvedSessionId) return;
    if (await getRedis().get(buildHostPairingSessionPurgeFenceKey(resolvedSessionId))) return;
    const recordKey = buildHostPairingSessionKey(code);
    const recordRaw = await getRedis().get(recordKey);
    const parsed = parseRecord(recordRaw);
    if (recordRaw && !parsed) throw new Error('HOST_PAIRING_RECORD_INVALID');
    if (parsed?.sessionId && parsed.sessionId !== resolvedSessionId) return;
    // Ein Legacy-Record ohne sessionId darf nur der aktuell von der DB fuer
    // diesen Code bestaetigten Session zugeordnet werden.
    const current = parsed
      ? { ...parsed, sessionId: resolvedSessionId }
      : emptyHostPairingRecord(resolvedSessionId);
    const result = applyHostPairingCommand(current, { type: 'SESSION_END', now });
    if (!result.ok) throw pairingError(result.code);
    await applyEffects(code, resolvedSessionId, result.effects);
    await saveRecord(code, resolvedSessionId, result.record);
  });
}

export async function listHostPairingState(
  sessionCode: string,
  sessionId: string,
): Promise<HostPairingRecord> {
  return withSessionLock(sessionCode, async () => {
    await assertSessionNotPurged(sessionId);
    const locked = await loadRecord(sessionCode, sessionId);
    const result = applyHostPairingCommand(locked, { type: 'SWEEP_EXPIRED', now: new Date() });
    if (!result.ok) return locked;
    if (result.effects.length > 0) {
      await applyEffects(sessionCode, sessionId, result.effects);
      await saveRecord(sessionCode, sessionId, result.record);
    }
    return result.record;
  });
}

export async function getHostPairingRequest(params: {
  sessionId: string;
  sessionCode: string;
  requestId: string;
  requestSecret: string;
}): Promise<{
  requestId: string;
  state: HostPairingState;
  confirmationIndicator: string | null;
  expiresAt: string | null;
  token: { tokenId: string; pairedHostToken: string; role: 'PAIRED_HOST' } | null;
}> {
  const requestSecretHash = hashHostPairingSecret(params.requestSecret);
  return withSessionLock(params.sessionCode, async () => {
    await assertSessionNotPurged(params.sessionId);
    const current = await loadRecord(params.sessionCode, params.sessionId);
    const swept = applyHostPairingCommand(current, { type: 'SWEEP_EXPIRED', now: new Date() });
    const record = swept.ok ? swept.record : current;
    if (swept.ok && swept.effects.length > 0) {
      await applyEffects(params.sessionCode, params.sessionId, swept.effects);
      await saveRecord(params.sessionCode, params.sessionId, record);
    }
    if (record.pending && record.pending.requestId === params.requestId) {
      if (!hashesEqual(record.pending.requestSecretHash, requestSecretHash)) {
        throw pairingError('INVITE_INVALID');
      }
      if (isExpiredAt(record.pending.expiresAt, new Date())) {
        return {
          requestId: params.requestId,
          state: 'EXPIRED' as const,
          confirmationIndicator: record.pending.confirmationIndicator,
          expiresAt: record.pending.expiresAt,
          token: null,
        };
      }
      return {
        requestId: params.requestId,
        state: 'PENDING_APPROVAL' as const,
        confirmationIndicator: record.pending.confirmationIndicator,
        expiresAt: record.pending.expiresAt,
        token: null,
      };
    }

    const redis = getRedis();
    const claimRaw = await redis.get(buildHostPairingClaimKey(requestSecretHash));
    if (claimRaw) {
      try {
        const claim = JSON.parse(claimRaw) as ClaimEnvelope;
        if (
          claim.sessionId === normalizeSessionId(params.sessionId) &&
          normalizeHostPairingSessionCode(claim.sessionCode) ===
            normalizeHostPairingSessionCode(params.sessionCode) &&
          claim.requestId === params.requestId &&
          claim.tokenId &&
          claim.pairedHostToken
        ) {
          return {
            requestId: params.requestId,
            state: 'PAIRED_HOST_TOKEN_ISSUED' as const,
            confirmationIndicator: null,
            expiresAt: null,
            token: {
              tokenId: claim.tokenId,
              pairedHostToken: claim.pairedHostToken,
              role: 'PAIRED_HOST' as const,
            },
          };
        }
      } catch {
        // Malformed/legacy claims fail closed.
      }
    }

    const outcomeRaw = await redis.get(buildHostPairingOutcomeKey(requestSecretHash));
    if (outcomeRaw) {
      try {
        const outcome = JSON.parse(outcomeRaw) as RequestOutcome;
        if (
          outcome.sessionId === normalizeSessionId(params.sessionId) &&
          normalizeHostPairingSessionCode(outcome.sessionCode) ===
            normalizeHostPairingSessionCode(params.sessionCode) &&
          outcome.requestId === params.requestId
        ) {
          return {
            requestId: params.requestId,
            state: outcome.state,
            confirmationIndicator: null,
            expiresAt: null,
            token: null,
          };
        }
      } catch {
        // Malformed/legacy outcomes fail closed.
      }
    }

    throw pairingError('REQUEST_NOT_FOUND');
  });
}

export async function findPairedHostByToken(
  sessionCode: string,
  token: string,
): Promise<{ tokenId: string; role: Extract<HostSessionRole, 'PAIRED_HOST'> } | null> {
  if (!token) return null;
  const tokenHash = hashHostPairingSecret(token);
  const session = await prisma.session.findUnique({
    where: { code: normalizeHostPairingSessionCode(sessionCode) },
    select: { id: true, hostCredentialVersion: true },
  });
  if (!session) return null;
  return withSessionLock(sessionCode, async () => {
    if (await getRedis().get(buildHostPairingSessionPurgeFenceKey(session.id))) return null;
    const raw = await getRedis().get(buildHostPairingTokenLookupKey(tokenHash));
    if (!raw) return null;
    let lookup: {
      sessionId?: string;
      sessionCode?: string;
      tokenId?: string;
      credentialVersion?: number;
    };
    try {
      lookup = JSON.parse(raw) as typeof lookup;
    } catch {
      return null;
    }
    if (
      lookup.sessionId !== session.id ||
      normalizeHostPairingSessionCode(lookup.sessionCode ?? '') !==
        normalizeHostPairingSessionCode(sessionCode) ||
      (session.hostCredentialVersion ?? 0) !== (lookup.credentialVersion ?? 0)
    ) {
      return null;
    }
    const record = await loadRecord(sessionCode, session.id);
    const device = record.pairedHosts.find((entry) => entry.tokenId === lookup.tokenId);
    if (!device || !hashesEqual(device.tokenHash, tokenHash)) return null;
    return { tokenId: device.tokenId, role: 'PAIRED_HOST' as const };
  });
}

type RedisPubSubClient = {
  publish?: (channel: string, message: string) => Promise<unknown> | unknown;
  duplicate?: () => RedisPubSubClient;
  on?: (event: string, handler: (channel: string, message: string) => void) => void;
  subscribe?: (channel: string) => Promise<unknown> | unknown;
};

const invalidationHub = createPairedHostInvalidationHub({
  publish(channel, message) {
    const redis = getRedis() as RedisPubSubClient;
    if (typeof redis.publish !== 'function') return;
    return redis.publish(channel, message);
  },
  ensureSubscribe(onMessage) {
    const redis = getRedis() as RedisPubSubClient;
    const subscriber = typeof redis.duplicate === 'function' ? redis.duplicate() : redis;
    if (typeof subscriber.on !== 'function' || typeof subscriber.subscribe !== 'function') {
      return;
    }
    subscriber.on('message', (channel, message) => {
      if (channel === PAIRED_HOST_INVALIDATION_CHANNEL) onMessage(message);
    });
    void subscriber.subscribe(PAIRED_HOST_INVALIDATION_CHANNEL);
  },
});

export function notifyPairedHostTokenInvalidated(sessionCode: string, tokenHash: string): void {
  invalidationHub.notify(sessionCode, tokenHash);
}

export function subscribePairedHostTokenInvalidation(
  sessionCode: string,
  token: string,
  onInvalidate: () => void,
): () => void {
  return invalidationHub.subscribe(sessionCode, hashHostPairingSecret(token), onInvalidate);
}

export function waitForPairedHostTokenInvalidation(
  sessionCode: string,
  token: string,
  timeoutMs: number,
): Promise<'invalidated' | 'timeout'> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (reason: 'invalidated' | 'timeout') => {
      if (settled) return;
      settled = true;
      unsubscribe();
      clearTimeout(timer);
      resolve(reason);
    };
    const unsubscribe = subscribePairedHostTokenInvalidation(sessionCode, token, () =>
      finish('invalidated'),
    );
    const timer = setTimeout(() => finish('timeout'), timeoutMs);
  });
}

export function resetHostPairingInvalidationWaitersForTests(): void {
  invalidationHub.reset();
}
