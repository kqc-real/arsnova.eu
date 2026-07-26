import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type HashRecord = Record<string, string>;

const redisHashes = new Map<string, HashRecord>();
const redisExpiryIndex = new Map<string, number>();

function parseEvalArgs(args: unknown[]): { keys: string[]; argv: string[] } {
  const numKeys = Number(args[0]);
  const keys = args.slice(1, 1 + numKeys).map(String);
  const argv = args.slice(1 + numKeys).map(String);
  return { keys, argv };
}

const { redisMock } = vi.hoisted(() => ({
  redisMock: {
    hgetall: vi.fn(async (key: string) => ({ ...(redisHashes.get(key) ?? {}) })),
    eval: vi.fn(async (script: string, ...args: unknown[]) => {
      const { keys, argv } = parseEvalArgs(args);
      if (script.includes('ZREMRANGEBYSCORE')) {
        const [key] = keys;
        const [capabilityHash, , hardCapRaw, nowMsRaw, expiresAtMsRaw] = argv;
        const hardCap = Number(hardCapRaw);
        const nowMs = Number(nowMsRaw);
        for (const [member, expiresAtMs] of redisExpiryIndex) {
          if (expiresAtMs <= nowMs) {
            redisExpiryIndex.delete(member);
            redisHashes.delete(member);
          }
        }
        if (redisHashes.has(key!)) return [0, 'ROOM_COLLISION'];
        if (redisExpiryIndex.size >= hardCap) {
          return [0, 'GLOBAL_CAP'];
        }
        redisHashes.set(key!, {
          generation: '1',
          rotationCapabilityHash: capabilityHash!,
        });
        redisExpiryIndex.set(key!, Number(expiresAtMsRaw));
        return [1, 'CREATED', 1];
      }

      // rotate
      const [key] = keys;
      const [capabilityHash, , expiresAtMsRaw] = argv;
      const existing = redisHashes.get(key!);
      if (!existing?.rotationCapabilityHash || !existing.generation) {
        return [0, 'NOT_REGISTERED'];
      }
      if (existing.rotationCapabilityHash !== capabilityHash) {
        return [0, 'CAPABILITY_MISMATCH'];
      }
      const next = Number(existing.generation) + 1;
      existing.generation = String(next);
      redisHashes.set(key!, existing);
      redisExpiryIndex.set(key!, Number(expiresAtMsRaw));
      return [1, 'OK', next];
    }),
  },
}));

vi.mock('../redis', () => ({
  getRedis: () => redisMock,
}));

import {
  assertYjsShareTokenSecretConfigured,
  authorizeYjsRoomUpgrade,
  createYjsShare,
  createYjsRotationCapability,
  resolveYjsShareSigningKey,
  rotateYjsShare,
  signYjsShareToken,
  verifyYjsShareTokenSignature,
} from './yjsShareToken';

const ROOM = '6a8edced-5f8f-4cfa-9176-454fac9570ad';

describe('yjsShareToken', () => {
  beforeEach(() => {
    redisHashes.clear();
    redisExpiryIndex.clear();
    vi.clearAllMocks();
    vi.stubEnv('YJS_SHARE_TOKEN_SECRET', 'test-yjs-share-secret-at-least-32-bytes!!');
    vi.stubEnv('YJS_SHARE_LEGACY_UUID_CUTOFF_AT', '2099-01-01T00:00:00.000Z');
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('signiert und verifiziert Share-Tokens', () => {
    const token = signYjsShareToken(ROOM, 1);
    expect(verifyYjsShareTokenSignature(token)).toEqual({ roomId: ROOM, generation: 1 });
    expect(verifyYjsShareTokenSignature(token.replace(/.$/, 'x'))).toBeNull();
  });

  it('registriert, rotiert und weist veraltete Generationen ab', async () => {
    const capability = createYjsRotationCapability();
    const registered = await createYjsShare({ rotationCapability: capability });
    expect(registered.roomId).not.toBe(ROOM);
    expect(registered.generation).toBe(1);

    await expect(
      authorizeYjsRoomUpgrade({
        roomId: `quiz-library-room-${registered.roomId}`,
        shareToken: registered.shareToken,
      }),
    ).resolves.toEqual({ ok: true });

    const rotated = await rotateYjsShare({
      roomId: registered.roomId,
      rotationCapability: capability,
    });
    expect(rotated.generation).toBe(2);

    await expect(
      authorizeYjsRoomUpgrade({
        roomId: `quiz-library-room-${registered.roomId}`,
        shareToken: registered.shareToken,
      }),
    ).resolves.toEqual({ ok: false, reason: 'stale_generation' });

    await expect(
      authorizeYjsRoomUpgrade({
        roomId: `quiz-library-room-${registered.roomId}`,
        shareToken: rotated.shareToken,
      }),
    ).resolves.toEqual({ ok: true });
  });

  it('rotiert parallel atomar auf steigende Generationen', async () => {
    const capability = createYjsRotationCapability();
    const registered = await createYjsShare({ rotationCapability: capability });

    const [first, second] = await Promise.all([
      rotateYjsShare({ roomId: registered.roomId, rotationCapability: capability }),
      rotateYjsShare({ roomId: registered.roomId, rotationCapability: capability }),
    ]);

    const generations = [first.generation, second.generation].sort((a, b) => a - b);
    expect(generations).toEqual([2, 3]);
  });

  it('erzeugt Räume serverseitig und verwaltet den Hard-Cap über einen Ablaufindex', async () => {
    const expiredKey = 'yjs:share:v1:00000000-0000-4000-8000-000000000001';
    redisHashes.set(expiredKey, {
      generation: '1',
      rotationCapabilityHash: 'a'.repeat(64),
    });
    redisExpiryIndex.set(expiredKey, Date.now() - 1);

    const created = await createYjsShare({
      rotationCapability: createYjsRotationCapability(),
    });
    expect(created.roomId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const [script] = redisMock.eval.mock.calls[0]!;
    expect(script).toContain('ZREMRANGEBYSCORE');
    expect(script).toContain('ZCARD');
    expect(script).toContain('ZADD');
    expect(script).not.toContain('INCR');
    expect(redisHashes.has(expiredKey)).toBe(false);
    expect(redisExpiryIndex.has(expiredKey)).toBe(false);
  });

  it('lehnt falsche Rotations-Capability ab', async () => {
    const capability = createYjsRotationCapability();
    const registered = await createYjsShare({ rotationCapability: capability });
    await expect(
      rotateYjsShare({
        roomId: registered.roomId,
        rotationCapability: createYjsRotationCapability(),
      }),
    ).rejects.toThrow('CAPABILITY_MISMATCH');
  });

  it('erlaubt UUID-only vor dem Legacy-Cutoff ohne Redis-Key zu schreiben', async () => {
    await expect(
      authorizeYjsRoomUpgrade({
        roomId: `quiz-library-room-${ROOM}`,
        shareToken: null,
        now: new Date('2098-12-31T00:00:00.000Z'),
      }),
    ).resolves.toEqual({ ok: true });
    expect(redisMock.eval).not.toHaveBeenCalled();
    expect(redisHashes.size).toBe(0);
    expect(redisExpiryIndex.size).toBe(0);

    await expect(
      authorizeYjsRoomUpgrade({
        roomId: `quiz-library-room-${ROOM}`,
        shareToken: null,
        now: new Date('2099-01-01T00:00:00.000Z'),
      }),
    ).resolves.toEqual({ ok: false, reason: 'legacy_cutoff' });
  });

  it('verlangt Token, sobald Share-Metadaten existieren', async () => {
    const capability = createYjsRotationCapability();
    const registered = await createYjsShare({ rotationCapability: capability });
    await expect(
      authorizeYjsRoomUpgrade({
        roomId: `quiz-library-room-${registered.roomId}`,
        shareToken: null,
        now: new Date('2098-12-31T00:00:00.000Z'),
      }),
    ).resolves.toEqual({ ok: false, reason: 'token_required' });
  });

  it('fail-closed: Produktion ohne starkes Secret', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('YJS_SHARE_TOKEN_SECRET', '');
    vi.stubEnv('JWT_SECRET', 'short');
    expect(resolveYjsShareSigningKey()).toBeNull();
    expect(() => assertYjsShareTokenSecretConfigured()).toThrow(/Produktion/);
  });

  it('erlaubt Dev-Fallback nur außerhalb von Produktion', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('YJS_SHARE_TOKEN_SECRET', '');
    vi.stubEnv('JWT_SECRET', '');
    expect(() => assertYjsShareTokenSecretConfigured()).not.toThrow();
    const token = signYjsShareToken(ROOM, 1);
    expect(token.startsWith('v1.')).toBe(true);
  });

  it('loggt keine Capability im Token-String selbst bei Signaturfehlern', () => {
    const capability = createYjsRotationCapability();
    const token = signYjsShareToken(ROOM, 1);
    expect(token).not.toContain(capability);
    expect(token.startsWith('v1.')).toBe(true);
  });
});
