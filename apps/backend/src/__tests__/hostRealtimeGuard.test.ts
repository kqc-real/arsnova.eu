import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TRPCError } from '@trpc/server';
import type { IncomingMessage } from 'node:http';

const prismaMock = vi.hoisted(() => ({
  session: {
    findUnique: vi.fn(),
  },
}));

function createMemoryRedis() {
  const store = new Map<string, { value: string; expiresAt?: number }>();
  const alive = (entry: { value: string; expiresAt?: number } | undefined) => {
    if (!entry) return false;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) return false;
    return true;
  };
  return {
    async get(key: string) {
      const entry = store.get(key);
      if (!alive(entry)) {
        store.delete(key);
        return null;
      }
      return entry!.value;
    },
    async set(key: string, value: string, ...args: Array<string | number>) {
      let ttl: number | undefined;
      let nx = false;
      for (let index = 0; index < args.length; index += 1) {
        if (args[index] === 'EX') ttl = Number(args[index + 1]);
        if (args[index] === 'NX') nx = true;
      }
      const existing = store.get(key);
      if (nx && alive(existing)) return null;
      store.set(key, {
        value,
        expiresAt: ttl ? Date.now() + ttl * 1000 : undefined,
      });
      return 'OK';
    },
    async del(...keys: string[]) {
      let removed = 0;
      for (const key of keys) {
        if (store.delete(key)) removed += 1;
      }
      return removed;
    },
    store,
  };
}

const memoryRedis = createMemoryRedis();

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../redis', () => ({
  getRedis: () => memoryRedis,
}));

vi.mock('../lib/rateLimit', () => ({
  checkHostPairingInviteRate: vi.fn(async () => ({ allowed: true })),
  checkHostPairingRequestRate: vi.fn(async () => ({ allowed: true })),
  checkHostPairingDecisionRate: vi.fn(async () => ({ allowed: true })),
  checkHostPairingClaimRate: vi.fn(async () => ({ allowed: true })),
}));

import { createHostSessionToken } from '../lib/hostAuth';
import { waitWhileHostTokenValid } from '../lib/hostRealtimeGuard';
import { sessionHostPairingRouter } from '../routers/sessionHostPairing';

const CODE = 'ABC123';

function hostCaller(token: string) {
  return sessionHostPairingRouter.createCaller({
    req: { headers: { 'x-host-token': token } } as unknown as IncomingMessage,
  });
}

function publicCaller() {
  return sessionHostPairingRouter.createCaller({
    req: { headers: {} } as unknown as IncomingMessage,
  });
}

async function pairDevice(originalToken: string) {
  const original = hostCaller(originalToken);
  const invite = await original.createHostPairingInvite({
    code: CODE,
    screenVisibility: 'PROJECTED',
  });
  const requested = await publicCaller().requestHostPairing({
    code: CODE,
    pairingSecret: invite.pairingSecret,
    deviceLabel: 'Smartphone',
  });
  const approved = await original.approveHostPairing({
    code: CODE,
    requestId: requested.requestId!,
  });
  const claimed = await publicCaller().getHostPairingRequest({
    code: CODE,
    requestId: requested.requestId!,
    requestSecret: requested.requestSecret!,
  });
  return { approved, claimed };
}

describe('waitWhileHostTokenValid (Story 2.10 Slice 4)', () => {
  let originalToken: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    memoryRedis.store.clear();
    prismaMock.session.findUnique.mockResolvedValue({ id: 'sess-1', status: 'LOBBY' });
    originalToken = await createHostSessionToken(CODE);
  });

  it('lässt den Original-Host weiterwarten und beendet Paired Hosts beim Widerruf', async () => {
    const { approved, claimed } = await pairDevice(originalToken);
    const pairedToken = claimed.token!.pairedHostToken;
    let originalReleased = false;
    const originalWait = waitWhileHostTokenValid(
      CODE,
      originalToken,
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            originalReleased = true;
            resolve();
          }, 20);
        }),
    );

    let resolvePairedWait: (() => void) | undefined;
    const pairedWait = waitWhileHostTokenValid(
      CODE,
      pairedToken,
      () =>
        new Promise<void>((resolve) => {
          resolvePairedWait = resolve;
        }),
    );

    await hostCaller(originalToken).revokePairedHost({
      code: CODE,
      tokenId: approved.tokenId,
    });

    await expect(pairedWait).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Die Host-Verbindung wurde beendet.',
    });
    expect(resolvePairedWait).toBeTypeOf('function');

    await expect(originalWait).resolves.toBeUndefined();
    expect(originalReleased).toBe(true);
  });

  it('belebt nach Widerruf keine Host-Warte mehr', async () => {
    const { approved, claimed } = await pairDevice(originalToken);
    const pairedToken = claimed.token!.pairedHostToken;
    await hostCaller(originalToken).revokePairedHost({
      code: CODE,
      tokenId: approved.tokenId,
    });

    await expect(
      waitWhileHostTokenValid(CODE, pairedToken, async () => undefined),
    ).rejects.toBeInstanceOf(TRPCError);
  });
});
