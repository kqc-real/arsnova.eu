import type { IncomingMessage } from 'node:http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TRPCError } from '@trpc/server';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';

const prismaMock = vi.hoisted(() => ({
  session: {
    findUnique: vi.fn(),
  },
}));

const rateLimitMocks = vi.hoisted(() => ({
  checkHostPairingInviteRate: vi.fn(async () => ({ allowed: true as boolean })),
  checkHostPairingRequestRate: vi.fn(
    async (): Promise<{ allowed: boolean; retryAfterSeconds?: number }> => ({ allowed: true }),
  ),
  checkHostPairingDecisionRate: vi.fn(async () => ({ allowed: true as boolean })),
  checkHostPairingClaimRate: vi.fn(async () => ({ allowed: true as boolean })),
}));

type MemoryEntry = { value: string; expiresAt?: number };

function createMemoryRedis() {
  const store = new Map<string, MemoryEntry>();
  const alive = (entry: MemoryEntry | undefined): entry is MemoryEntry => {
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
      return entry.value;
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

vi.mock('../lib/rateLimit', () => rateLimitMocks);

import {
  assertHostSessionAccessFromContext,
  createHostSessionToken,
  isHostSessionTokenValid,
  isOriginalHostSessionToken,
} from '../lib/hostAuth';
import { hashHostPairingSecret } from '../lib/hostPairing';
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

async function pairDevice(originalToken: string, deviceLabel = 'Smartphone') {
  const original = hostCaller(originalToken);
  const invite = await original.createHostPairingInvite({
    code: CODE,
    screenVisibility: 'PROJECTED',
  });
  const requested = await publicCaller().requestHostPairing({
    code: CODE,
    pairingSecret: invite.pairingSecret,
    deviceLabel,
  });
  expect(requested.requestId).toBeTruthy();
  const approved = await original.approveHostPairing({
    code: CODE,
    requestId: requested.requestId!,
  });
  const claimed = await publicCaller().getHostPairingRequest({
    code: CODE,
    requestId: requested.requestId!,
    requestSecret: requested.requestSecret!,
  });
  return { invite, requested, approved, claimed };
}

describe('session host pairing (Story 2.10 Slice 1)', () => {
  let originalToken: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    memoryRedis.store.clear();
    rateLimitMocks.checkHostPairingInviteRate.mockResolvedValue({ allowed: true });
    rateLimitMocks.checkHostPairingRequestRate.mockResolvedValue({ allowed: true });
    rateLimitMocks.checkHostPairingDecisionRate.mockResolvedValue({ allowed: true });
    rateLimitMocks.checkHostPairingClaimRate.mockResolvedValue({ allowed: true });
    prismaMock.session.findUnique.mockResolvedValue({ id: 'sess-1', status: 'LOBBY' });
    originalToken = await createHostSessionToken(CODE);
  });

  trpcDodIt(
    {
      procedure: 'session.createHostPairingInvite',
      case: 'happy',
      mode: 'direct',
      title: 'Happy Path: Invite, Anfrage, Freigabe, Token, Host-Rechte, Widerruf',
    },
    async () => {
      const { requested, approved, claimed } = await pairDevice(originalToken);
      expect(requested.state).toBe('PENDING_APPROVAL');
      expect(approved.state).toBe('CONNECTED');
      expect(claimed.state).toBe('PAIRED_HOST_TOKEN_ISSUED');
      expect(claimed.token?.role).toBe('PAIRED_HOST');
      expect(claimed.token?.pairedHostToken).toBeTruthy();

      const pairedToken = claimed.token!.pairedHostToken;
      expect(await isHostSessionTokenValid(CODE, pairedToken)).toBe(true);
      expect(await isOriginalHostSessionToken(CODE, pairedToken)).toBe(false);
      expect(await isOriginalHostSessionToken(CODE, originalToken)).toBe(true);

      const replay = await publicCaller().getHostPairingRequest({
        code: CODE,
        requestId: requested.requestId!,
        requestSecret: requested.requestSecret!,
      });
      expect(replay.token).toBeNull();
      expect(replay.state).toBe('CONNECTED');

      await hostCaller(originalToken).revokePairedHost({
        code: CODE,
        tokenId: approved.tokenId,
      });
      expect(await isHostSessionTokenValid(CODE, pairedToken)).toBe(false);
      await expect(
        assertHostSessionAccessFromContext(
          { req: { headers: { 'x-host-token': pairedToken } } as unknown as IncomingMessage },
          CODE,
        ),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.requestHostPairing',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'Session-Code allein erzeugt keine Host- oder Pairing-Rechte',
    },
    async () => {
      await expect(
        hostCaller('').createHostPairingInvite({ code: CODE, screenVisibility: 'PROJECTED' }),
      ).rejects.toBeInstanceOf(TRPCError);
      await expect(
        publicCaller().requestHostPairing({
          code: CODE,
          pairingSecret: 'x'.repeat(32),
        }),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: 'Dieser Verbindungslink ist ungültig oder abgelaufen.',
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'session.getHostPairingRequest',
      case: 'error',
      mode: 'direct',
      contract: 'DOMAIN:NO_SILENT_GRANT',
      title: 'Pending ohne Approve — auch privat — liefert kein PairedHostToken',
    },
    async () => {
      const invite = await hostCaller(originalToken).createHostPairingInvite({
        code: CODE,
        screenVisibility: 'PRIVATE',
      });
      const requested = await publicCaller().requestHostPairing({
        code: CODE,
        pairingSecret: invite.pairingSecret,
        deviceLabel: 'Privates Handy',
      });
      const pending = await publicCaller().getHostPairingRequest({
        code: CODE,
        requestId: requested.requestId!,
        requestSecret: requested.requestSecret!,
      });
      expect(pending.state).toBe('PENDING_APPROVAL');
      expect(pending.token).toBeNull();
      expect(await isHostSessionTokenValid(CODE, invite.pairingSecret)).toBe(false);
    },
  );

  trpcDodIt(
    {
      procedure: 'session.rejectHostPairing',
      case: 'error',
      mode: 'direct',
      contract: 'DOMAIN:REJECTED',
      title: 'Ablehnung stellt kein Token aus',
    },
    async () => {
      const invite = await hostCaller(originalToken).createHostPairingInvite({
        code: CODE,
      });
      const requested = await publicCaller().requestHostPairing({
        code: CODE,
        pairingSecret: invite.pairingSecret,
      });
      await hostCaller(originalToken).rejectHostPairing({
        code: CODE,
        requestId: requested.requestId!,
      });
      const rejected = await publicCaller().getHostPairingRequest({
        code: CODE,
        requestId: requested.requestId!,
        requestSecret: requested.requestSecret!,
      });
      expect(rejected.state).toBe('REJECTED');
      expect(rejected.token).toBeNull();
    },
  );

  trpcDodIt(
    {
      procedure: 'session.approveHostPairing',
      case: 'error',
      mode: 'direct',
      contract: 'FORBIDDEN',
      title: 'Cap von 3 Paired Hosts und PAIRED_HOST darf nicht weiterkoppeln',
    },
    async () => {
      const first = await pairDevice(originalToken, 'Gerät 1');
      const second = await pairDevice(originalToken, 'Gerät 2');
      const third = await pairDevice(originalToken, 'Gerät 3');
      expect(first.claimed.token).toBeTruthy();
      expect(second.claimed.token).toBeTruthy();
      expect(third.claimed.token).toBeTruthy();

      const fourthInvite = await hostCaller(originalToken).createHostPairingInvite({
        code: CODE,
      });
      await expect(
        publicCaller().requestHostPairing({
          code: CODE,
          pairingSecret: fourthInvite.pairingSecret,
        }),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'Es sind bereits drei weitere Host-Geräte verbunden.',
      });

      await expect(
        hostCaller(first.claimed.token!.pairedHostToken).createHostPairingInvite({
          code: CODE,
        }),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'Nur die ursprüngliche Lehrperson kann weitere Geräte verbinden.',
      });

      await hostCaller(originalToken).revokePairedHost({
        code: CODE,
        tokenId: first.approved.tokenId,
      });
      const afterRevoke = await pairDevice(originalToken, 'Gerät 4');
      expect(afterRevoke.claimed.token?.role).toBe('PAIRED_HOST');
    },
  );

  it('behandelt Replay derselben Einladung und bereits pending als ungefährlich', async () => {
    const invite = await hostCaller(originalToken).createHostPairingInvite({
      code: CODE,
    });
    const first = await publicCaller().requestHostPairing({
      code: CODE,
      pairingSecret: invite.pairingSecret,
    });
    const second = await publicCaller().requestHostPairing({
      code: CODE,
      pairingSecret: invite.pairingSecret,
    });
    expect(second.alreadyPending).toBe(true);
    expect(second.requestSecret).toBeNull();

    await hostCaller(originalToken).approveHostPairing({
      code: CODE,
      requestId: first.requestId!,
    });
    await expect(
      publicCaller().requestHostPairing({
        code: CODE,
        pairingSecret: invite.pairingSecret,
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Dieser Verbindungslink ist ungültig oder abgelaufen.',
    });
  });

  it('lehnt abgelaufene Einladungen ohne Token ab', async () => {
    const invite = await hostCaller(originalToken).createHostPairingInvite({
      code: CODE,
    });
    const secretHash = hashHostPairingSecret(invite.pairingSecret);
    const sessionRaw = await memoryRedis.get(`host:pairing:v1:session:${CODE}`);
    expect(sessionRaw).toBeTruthy();
    const parsed = JSON.parse(sessionRaw!) as {
      invite: { expiresAt: string; secretHash: string };
    };
    parsed.invite.expiresAt = '2020-01-01T00:00:00.000Z';
    await memoryRedis.set(`host:pairing:v1:session:${CODE}`, JSON.stringify(parsed));
    expect(parsed.invite.secretHash).toBe(secretHash);
    await expect(
      publicCaller().requestHostPairing({
        code: CODE,
        pairingSecret: invite.pairingSecret,
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Die Verbindungsanfrage ist abgelaufen.',
    });
  });

  it('rate-limited nur Pairing-Endpunkte', async () => {
    rateLimitMocks.checkHostPairingRequestRate.mockResolvedValueOnce({
      allowed: false,
      retryAfterSeconds: 12,
    });
    await expect(
      publicCaller().requestHostPairing({
        code: CODE,
        pairingSecret: 'y'.repeat(32),
      }),
    ).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });
  });

  it('hält parallelen Widerruf idempotent und belebt kein zweites Gerät', async () => {
    const first = await pairDevice(originalToken, 'Gerät A');
    const second = await pairDevice(originalToken, 'Gerät B');
    const firstToken = first.claimed.token!.pairedHostToken;
    const secondToken = second.claimed.token!.pairedHostToken;

    await Promise.all([
      hostCaller(originalToken).revokePairedHost({
        code: CODE,
        tokenId: first.approved.tokenId,
      }),
      hostCaller(originalToken).revokePairedHost({
        code: CODE,
        tokenId: first.approved.tokenId,
      }),
    ]);

    expect(await isHostSessionTokenValid(CODE, firstToken)).toBe(false);
    expect(await isHostSessionTokenValid(CODE, secondToken)).toBe(true);
    await expect(hostCaller(firstToken).listPairedHosts({ code: CODE })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    const listed = await hostCaller(originalToken).listPairedHosts({ code: CODE });
    expect(listed.devices).toHaveLength(1);
    expect(listed.devices[0]?.deviceLabel).toBe('Gerät B');
  });

  it('listet Geräte nur für den ursprünglichen Host und speichert Secrets gehasht', async () => {
    const paired = await pairDevice(originalToken, 'Tutorin');
    const listed = await hostCaller(originalToken).listPairedHosts({ code: CODE });
    expect(listed.devices).toHaveLength(1);
    expect(listed.devices[0]?.deviceLabel).toBe('Tutorin');
    expect(listed.caps.maxPairedHosts).toBe(3);
    expect(JSON.stringify(listed)).not.toContain(paired.claimed.token!.pairedHostToken);
    expect(
      JSON.stringify([...memoryRedis.store.values()].map((entry) => entry.value)),
    ).not.toContain(paired.invite.pairingSecret);
  });
});
