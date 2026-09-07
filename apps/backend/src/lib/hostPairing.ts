/**
 * Redis-backed Pairing-Registry für Story 2.10 Slice 1.
 * Secrets und Paired-Host-Tokens werden nur gehasht persistiert.
 * Das Klartext-Token existiert höchstens als einmaliges Claim-Kuvert.
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
import { getRedis } from '../redis';
import {
  applyHostPairingCommand,
  emptyHostPairingRecord,
  hostPairingUserMessage,
  isExpiredAt,
  type HostPairingEffect,
  type HostPairingRecord,
} from './hostPairingState';

const SESSION_PREFIX = 'host:pairing:v1:session:';
const INVITE_LOOKUP_PREFIX = 'host:pairing:v1:invite:';
const REQUEST_LOOKUP_PREFIX = 'host:pairing:v1:request:';
const TOKEN_LOOKUP_PREFIX = 'host:pairing:v1:token:';
const CLAIM_PREFIX = 'host:pairing:v1:claim:';
const OUTCOME_PREFIX = 'host:pairing:v1:outcome:';
const LOCK_PREFIX = 'host:pairing:v1:lock:';
const LOCK_TTL_SECONDS = 2;

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

function normalizeSessionCode(sessionCode: string): string {
  return sessionCode.trim().toUpperCase();
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

function sessionKey(sessionCode: string): string {
  return `${SESSION_PREFIX}${normalizeSessionCode(sessionCode)}`;
}

function inviteLookupKey(secretHash: string): string {
  return `${INVITE_LOOKUP_PREFIX}${secretHash}`;
}

function requestLookupKey(requestSecretHash: string): string {
  return `${REQUEST_LOOKUP_PREFIX}${requestSecretHash}`;
}

function tokenLookupKey(tokenHash: string): string {
  return `${TOKEN_LOOKUP_PREFIX}${tokenHash}`;
}

function claimKey(requestSecretHash: string): string {
  return `${CLAIM_PREFIX}${requestSecretHash}`;
}

function outcomeKey(requestSecretHash: string): string {
  return `${OUTCOME_PREFIX}${requestSecretHash}`;
}

function lockKey(sessionCode: string): string {
  return `${LOCK_PREFIX}${normalizeSessionCode(sessionCode)}`;
}

function createSecret(): string {
  return randomBytes(32).toString('base64url');
}

function createConfirmationIndicator(): string {
  const word = CONFIRMATION_WORDS[randomBytes(1)[0]! % CONFIRMATION_WORDS.length]!;
  const number = (randomBytes(1)[0]! % 90) + 10;
  return `${word} · ${number}`;
}

function recordTtlSeconds(record: HostPairingRecord): number {
  if (record.pairedHosts.length > 0) {
    return 60 * 60 * 8;
  }
  const now = Date.now();
  const remaining = [record.invite?.expiresAt, record.pending?.expiresAt]
    .filter((value): value is string => Boolean(value))
    .map((value) => Math.ceil((Date.parse(value) - now) / 1000));
  return Math.max(60, ...remaining, getHostPairingInviteTtlSeconds());
}

async function loadRecord(sessionCode: string): Promise<HostPairingRecord> {
  const raw = await getRedis().get(sessionKey(sessionCode));
  if (!raw) return emptyHostPairingRecord();
  try {
    const parsed = JSON.parse(raw) as HostPairingRecord;
    if (!parsed || !Array.isArray(parsed.pairedHosts)) {
      return emptyHostPairingRecord();
    }
    return {
      version: parsed.version ?? 1,
      invite: parsed.invite ?? null,
      pending: parsed.pending ?? null,
      pairedHosts: parsed.pairedHosts,
    };
  } catch {
    return emptyHostPairingRecord();
  }
}

async function saveRecord(sessionCode: string, record: HostPairingRecord): Promise<void> {
  const ttl = recordTtlSeconds(record);
  if (!record.invite && !record.pending && record.pairedHosts.length === 0) {
    await getRedis().del(sessionKey(sessionCode));
    return;
  }
  await getRedis().set(sessionKey(sessionCode), JSON.stringify(record), 'EX', ttl);
}

type ClaimEnvelope = { tokenId: string; pairedHostToken: string };
type RequestOutcome = { state: HostPairingState; tokenId?: string };

async function applyEffects(
  sessionCode: string,
  effects: HostPairingEffect[],
  issuedToken?: string,
): Promise<void> {
  const redis = getRedis();
  const code = normalizeSessionCode(sessionCode);
  const lookupTtl = Math.max(
    getHostPairingInviteTtlSeconds(),
    getHostPairingPendingTtlSeconds(),
    HOST_PAIRING_CLAIM_TTL_SECONDS,
  );
  for (const effect of effects) {
    switch (effect.type) {
      case 'DELETE_INVITE_LOOKUP':
        await redis.del(inviteLookupKey(effect.secretHash));
        break;
      case 'SET_INVITE_LOOKUP':
        await redis.set(
          inviteLookupKey(effect.secretHash),
          JSON.stringify({ sessionCode: code, inviteId: effect.inviteId }),
          'EX',
          getHostPairingInviteTtlSeconds(),
        );
        break;
      case 'DELETE_REQUEST_LOOKUP':
        await redis.del(requestLookupKey(effect.requestSecretHash));
        break;
      case 'SET_REQUEST_LOOKUP':
        await redis.set(
          requestLookupKey(effect.requestSecretHash),
          JSON.stringify({ sessionCode: code, requestId: effect.requestId }),
          'EX',
          getHostPairingPendingTtlSeconds(),
        );
        break;
      case 'SET_TOKEN_LOOKUP':
        await redis.set(
          tokenLookupKey(effect.tokenHash),
          JSON.stringify({ sessionCode: code, tokenId: effect.tokenId }),
          'EX',
          60 * 60 * 8,
        );
        break;
      case 'DELETE_TOKEN_LOOKUP':
        await redis.del(tokenLookupKey(effect.tokenHash));
        break;
      case 'ISSUE_CLAIM':
        if (!issuedToken) break;
        await redis.set(
          claimKey(effect.requestSecretHash),
          JSON.stringify({
            tokenId: effect.tokenId,
            pairedHostToken: issuedToken,
          } satisfies ClaimEnvelope),
          'EX',
          HOST_PAIRING_CLAIM_TTL_SECONDS,
        );
        break;
      case 'SET_OUTCOME':
        await redis.set(
          outcomeKey(effect.requestSecretHash),
          JSON.stringify({
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
  const redis = getRedis();
  const key = lockKey(sessionCode);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const locked = await redis.set(key, '1', 'EX', LOCK_TTL_SECONDS, 'NX');
    if (locked === 'OK') {
      try {
        return await fn();
      } finally {
        await redis.del(key);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
  }
  throw pairingError('RATE_LIMITED');
}

export async function createHostPairingInvite(params: {
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
    const current = await loadRecord(params.sessionCode);
    const result = applyHostPairingCommand(current, {
      type: 'CREATE_INVITE',
      inviteId,
      secretHash: hashHostPairingSecret(pairingSecret),
      screenVisibility: params.screenVisibility,
      now,
      inviteTtlSeconds: getHostPairingInviteTtlSeconds(),
    });
    if (!result.ok) throw pairingError(result.code);
    await applyEffects(params.sessionCode, result.effects);
    await saveRecord(params.sessionCode, result.record);
    return {
      inviteId,
      pairingSecret,
      expiresAt: result.record.invite!.expiresAt,
      screenVisibility: params.screenVisibility,
    };
  });
}

export async function requestHostPairing(params: {
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
  const lookupRaw = await getRedis().get(inviteLookupKey(inviteSecretHash));
  if (!lookupRaw) {
    throw pairingError('INVITE_INVALID');
  }
  const lookup = JSON.parse(lookupRaw) as { sessionCode: string; inviteId: string };
  if (normalizeSessionCode(lookup.sessionCode) !== normalizeSessionCode(params.sessionCode)) {
    throw pairingError('INVITE_INVALID');
  }

  const requestId = randomUUID();
  const requestSecret = createSecret();
  const confirmationIndicator = createConfirmationIndicator();
  const now = new Date();

  return withSessionLock(params.sessionCode, async () => {
    const current = await loadRecord(params.sessionCode);
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
    await applyEffects(params.sessionCode, result.effects);
    if (!result.alreadyPending) {
      await saveRecord(params.sessionCode, result.record);
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
  sessionCode: string;
  requestId: string;
}): Promise<{ tokenId: string; confirmationIndicator: string }> {
  const pairedHostToken = createSecret();
  const tokenId = randomUUID();
  const now = new Date();
  return withSessionLock(params.sessionCode, async () => {
    const current = await loadRecord(params.sessionCode);
    const result = applyHostPairingCommand(current, {
      type: 'APPROVE',
      requestId: params.requestId,
      tokenId,
      tokenHash: hashHostPairingSecret(pairedHostToken),
      now,
    });
    if (!result.ok) throw pairingError(result.code);
    await applyEffects(params.sessionCode, result.effects, pairedHostToken);
    await saveRecord(params.sessionCode, result.record);
    return {
      tokenId,
      confirmationIndicator: result.confirmationIndicator ?? '',
    };
  });
}

export async function rejectHostPairing(params: {
  sessionCode: string;
  requestId: string;
}): Promise<void> {
  const now = new Date();
  await withSessionLock(params.sessionCode, async () => {
    const current = await loadRecord(params.sessionCode);
    const result = applyHostPairingCommand(current, {
      type: 'REJECT',
      requestId: params.requestId,
      now,
    });
    if (!result.ok) throw pairingError(result.code);
    await applyEffects(params.sessionCode, result.effects);
    await saveRecord(params.sessionCode, result.record);
  });
}

export async function revokePairedHost(params: {
  sessionCode: string;
  tokenId: string;
}): Promise<void> {
  const now = new Date();
  await withSessionLock(params.sessionCode, async () => {
    const current = await loadRecord(params.sessionCode);
    const result = applyHostPairingCommand(current, {
      type: 'REVOKE',
      tokenId: params.tokenId,
      now,
    });
    if (!result.ok) throw pairingError(result.code);
    await applyEffects(params.sessionCode, result.effects);
    await saveRecord(params.sessionCode, result.record);
  });
}

export async function invalidateHostPairingForSession(sessionCode: string): Promise<void> {
  const now = new Date();
  await withSessionLock(sessionCode, async () => {
    const current = await loadRecord(sessionCode);
    const result = applyHostPairingCommand(current, { type: 'SESSION_END', now });
    if (!result.ok) throw pairingError(result.code);
    await applyEffects(sessionCode, result.effects);
    await saveRecord(sessionCode, result.record);
  });
}

export async function listHostPairingState(sessionCode: string): Promise<HostPairingRecord> {
  const current = await loadRecord(sessionCode);
  const now = new Date();
  const result = applyHostPairingCommand(current, { type: 'SWEEP_EXPIRED', now });
  if (!result.ok) return current;
  if (result.effects.length > 0) {
    await applyEffects(sessionCode, result.effects);
    await saveRecord(sessionCode, result.record);
  }
  return result.record;
}

export async function getHostPairingRequest(params: {
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
  const record = await listHostPairingState(params.sessionCode);
  if (record.pending && record.pending.requestId === params.requestId) {
    if (!hashesEqual(record.pending.requestSecretHash, requestSecretHash)) {
      throw pairingError('INVITE_INVALID');
    }
    if (isExpiredAt(record.pending.expiresAt, new Date())) {
      return {
        requestId: params.requestId,
        state: 'EXPIRED',
        confirmationIndicator: record.pending.confirmationIndicator,
        expiresAt: record.pending.expiresAt,
        token: null,
      };
    }
    return {
      requestId: params.requestId,
      state: 'PENDING_APPROVAL',
      confirmationIndicator: record.pending.confirmationIndicator,
      expiresAt: record.pending.expiresAt,
      token: null,
    };
  }

  const redis = getRedis();
  const claimRaw = await redis.get(claimKey(requestSecretHash));
  if (claimRaw) {
    await redis.del(claimKey(requestSecretHash));
    const claim = JSON.parse(claimRaw) as ClaimEnvelope;
    if (claim.tokenId) {
      return {
        requestId: params.requestId,
        state: 'PAIRED_HOST_TOKEN_ISSUED',
        confirmationIndicator: null,
        expiresAt: null,
        token: {
          tokenId: claim.tokenId,
          pairedHostToken: claim.pairedHostToken,
          role: 'PAIRED_HOST',
        },
      };
    }
  }

  const outcomeRaw = await redis.get(outcomeKey(requestSecretHash));
  if (outcomeRaw) {
    const outcome = JSON.parse(outcomeRaw) as RequestOutcome;
    return {
      requestId: params.requestId,
      state: outcome.state,
      confirmationIndicator: null,
      expiresAt: null,
      token: null,
    };
  }

  throw pairingError('REQUEST_NOT_FOUND');
}

export async function findPairedHostByToken(
  sessionCode: string,
  token: string,
): Promise<{ tokenId: string; role: Extract<HostSessionRole, 'PAIRED_HOST'> } | null> {
  if (!token) return null;
  const tokenHash = hashHostPairingSecret(token);
  const raw = await getRedis().get(tokenLookupKey(tokenHash));
  if (!raw) return null;
  const lookup = JSON.parse(raw) as { sessionCode: string; tokenId: string };
  if (normalizeSessionCode(lookup.sessionCode) !== normalizeSessionCode(sessionCode)) {
    return null;
  }
  const record = await loadRecord(sessionCode);
  const device = record.pairedHosts.find((entry) => entry.tokenId === lookup.tokenId);
  if (!device || !hashesEqual(device.tokenHash, tokenHash)) {
    return null;
  }
  return { tokenId: device.tokenId, role: 'PAIRED_HOST' };
}

const invalidationWaiters = new Map<string, Set<() => void>>();

function invalidationKey(sessionCode: string, tokenHash: string): string {
  return `${normalizeSessionCode(sessionCode)}:${tokenHash}`;
}

export function notifyPairedHostTokenInvalidated(sessionCode: string, tokenHash: string): void {
  const waiters = invalidationWaiters.get(invalidationKey(sessionCode, tokenHash));
  if (!waiters) return;
  for (const resolve of waiters) resolve();
  invalidationWaiters.delete(invalidationKey(sessionCode, tokenHash));
}

export function waitForPairedHostTokenInvalidation(
  sessionCode: string,
  token: string,
  timeoutMs: number,
): Promise<'invalidated' | 'timeout'> {
  const key = invalidationKey(sessionCode, hashHostPairingSecret(token));
  return new Promise((resolve) => {
    const waiters = invalidationWaiters.get(key) ?? new Set<() => void>();
    const finish = (reason: 'invalidated' | 'timeout') => {
      waiters.delete(onInvalidate);
      if (waiters.size === 0) invalidationWaiters.delete(key);
      clearTimeout(timer);
      resolve(reason);
    };
    const onInvalidate = () => finish('invalidated');
    const timer = setTimeout(() => finish('timeout'), timeoutMs);
    waiters.add(onInvalidate);
    invalidationWaiters.set(key, waiters);
  });
}

export function resetHostPairingInvalidationWaitersForTests(): void {
  invalidationWaiters.clear();
}
