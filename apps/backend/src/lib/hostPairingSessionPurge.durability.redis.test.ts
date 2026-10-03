import { afterAll, describe, expect, it } from 'vitest';
import { closeRedis, getRedis } from '../redis';
import {
  buildHostPairingClaimKey,
  buildHostPairingSessionIndexKey,
  buildHostPairingSessionKey,
  buildHostPairingSessionPurgeFenceKey,
  buildHostPairingTokenLookupKey,
  createHostPairingInvite,
} from './hostPairing';
import { purgeHostPairingForSessions } from './hostPairingSessionPurge';

const PHASE = process.env['HOST_PAIRING_DURABILITY_TEST_PHASE'];
const SESSION_ID = '61000000-0000-4000-8000-000000000001';
const SESSION_CODE = 'HPD001';
const TOKEN_KEY = buildHostPairingTokenLookupKey('durability-token-hash');
const CLAIM_KEY = buildHostPairingClaimKey('durability-request-hash');
const LEGACY_CLAIM_KEY = buildHostPairingClaimKey('durability-legacy-request-hash');
const RECORD_KEY = buildHostPairingSessionKey(SESSION_CODE);
const INDEX_KEY = buildHostPairingSessionIndexKey(SESSION_ID);
const FENCE_KEY = buildHostPairingSessionPurgeFenceKey(SESSION_ID);
const DURABILITY_MARKER_PATTERN = 'host:pairing:v1:purge-durability:*';

async function attemptLateWrite(): Promise<void> {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  try {
    await expect(
      createHostPairingInvite({
        sessionId: SESSION_ID,
        sessionCode: SESSION_CODE,
        screenVisibility: 'PROJECTED',
      }),
    ).rejects.toMatchObject({ pairingCode: 'SESSION_ENDED' });
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
  }
}

afterAll(async () => {
  if (PHASE === 'prepare' || PHASE === 'verify') await closeRedis();
});

describe.skipIf(PHASE !== 'prepare')('Host pairing AOF crash regression (prepare)', () => {
  it('bestätigt Artefakt-Purge und Fence vor dem Redis-SIGKILL', async () => {
    process.env.HOST_PAIRING_PURGE_REQUIRE_DURABILITY = '1';
    const redis = getRedis();
    expect(await redis.config('GET', 'appendonly')).toEqual(['appendonly', 'yes']);
    const oldMarkers = await redis.keys(DURABILITY_MARKER_PATTERN);
    if (oldMarkers.length > 0) await redis.unlink(...oldMarkers);
    await redis.unlink(RECORD_KEY, INDEX_KEY, FENCE_KEY, TOKEN_KEY, CLAIM_KEY, LEGACY_CLAIM_KEY);
    await redis.set(
      RECORD_KEY,
      JSON.stringify({
        sessionId: SESSION_ID,
        version: 2,
        invite: null,
        pending: {
          requestId: 'durability-legacy-request-id',
          inviteId: 'durability-legacy-invite-id',
          requestSecretHash: 'durability-legacy-request-hash',
          confirmationIndicator: 'Eule · 12',
          deviceLabel: null,
          createdAt: '2026-10-03T12:00:00.000Z',
          expiresAt: '2026-10-03T12:30:00.000Z',
          state: 'PENDING_APPROVAL',
        },
        pairedHosts: [
          {
            tokenId: 'durability-token-id',
            tokenHash: 'durability-token-hash',
            deviceLabel: null,
            pairedAt: '2026-10-03T12:00:00.000Z',
            state: 'CONNECTED',
          },
        ],
      }),
      'EX',
      8 * 60 * 60,
    );
    await redis.set(
      TOKEN_KEY,
      JSON.stringify({
        sessionId: SESSION_ID,
        sessionCode: SESSION_CODE,
        tokenId: 'durability-token-id',
        credentialVersion: 0,
      }),
      'EX',
      8 * 60 * 60,
    );
    await redis.set(
      CLAIM_KEY,
      JSON.stringify({
        sessionId: SESSION_ID,
        sessionCode: SESSION_CODE,
        requestId: 'durability-request-id',
        tokenId: 'durability-token-id',
        pairedHostToken: 'durability-clear-token',
      }),
      'EX',
      300,
    );
    // Pre-sessionId claims were not indexed. The global, validated legacy scan
    // must still remove the cleartext capability and include it in the same
    // AOF-confirmed mutation segment.
    await redis.set(
      LEGACY_CLAIM_KEY,
      JSON.stringify({
        tokenId: 'durability-token-id',
        pairedHostToken: 'durability-legacy-clear-token',
      }),
      'EX',
      300,
    );
    await redis.set(INDEX_KEY, JSON.stringify([TOKEN_KEY, CLAIM_KEY]), 'EX', 8 * 60 * 60);

    await expect(
      purgeHostPairingForSessions([{ sessionId: SESSION_ID, sessionCode: SESSION_CODE }]),
    ).resolves.toBe(5);

    expect(await redis.mget(RECORD_KEY, INDEX_KEY, TOKEN_KEY, CLAIM_KEY, LEGACY_CLAIM_KEY)).toEqual(
      [null, null, null, null, null],
    );
    expect(await redis.get(FENCE_KEY)).toBe('1');
    expect(await redis.keys(DURABILITY_MARKER_PATTERN)).toHaveLength(1);
    await attemptLateWrite();
    expect(await redis.get(RECORD_KEY)).toBeNull();
  });
});

describe.skipIf(PHASE !== 'verify')('Host pairing AOF crash regression (verify)', () => {
  it('restauriert nach SIGKILL weder Pairing-Daten noch Schreibrecht', async () => {
    const redis = getRedis();
    expect(await redis.mget(RECORD_KEY, INDEX_KEY, TOKEN_KEY, CLAIM_KEY, LEGACY_CLAIM_KEY)).toEqual(
      [null, null, null, null, null],
    );
    expect(await redis.get(FENCE_KEY)).toBe('1');
    expect(await redis.keys(DURABILITY_MARKER_PATTERN)).toHaveLength(1);
    await attemptLateWrite();
    expect(await redis.get(RECORD_KEY)).toBeNull();
  });
});
