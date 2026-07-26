import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type HashRecord = Record<string, string>;

const redisHashes = new Map<string, HashRecord>();
const redisStrings = new Map<string, string>();

function parseEvalArgs(args: unknown[]): { keys: string[]; argv: string[] } {
  const numKeys = Number(args[0]);
  const keys = args.slice(1, 1 + numKeys).map(String);
  const argv = args.slice(1 + numKeys).map(String);
  return { keys, argv };
}

const { redisMock } = vi.hoisted(() => ({
  redisMock: {
    hgetall: vi.fn(async (key: string) => ({ ...(redisHashes.get(key) ?? {}) })),
    expire: vi.fn(async () => 1),
    set: vi.fn(async (key: string, value: string, ...rest: unknown[]) => {
      const nx = rest.includes('NX');
      if (nx && redisStrings.has(key)) return null;
      redisStrings.set(key, value);
      return 'OK';
    }),
    eval: vi.fn(async (script: string, ...args: unknown[]) => {
      const { keys, argv } = parseEvalArgs(args);
      if (script.includes('MUST_REKEY')) {
        const [key, countKey, seenKey] = keys;
        const [capabilityHash, , hardCapRaw] = argv;
        const hardCap = Number(hardCapRaw);
        const existing = redisHashes.get(key!);
        if (existing?.rotationCapabilityHash && existing.generation) {
          if (existing.rotationCapabilityHash !== capabilityHash) {
            return [0, 'CAPABILITY_MISMATCH'];
          }
          return [1, 'EXISTS', Number(existing.generation)];
        }
        if (redisStrings.has(seenKey!)) {
          return [0, 'MUST_REKEY'];
        }
        const count = Number(redisStrings.get(countKey!) ?? '0');
        if (count >= hardCap) {
          return [0, 'GLOBAL_CAP'];
        }
        redisHashes.set(key!, {
          generation: '1',
          rotationCapabilityHash: capabilityHash!,
        });
        redisStrings.set(countKey!, String(count + 1));
        return [1, 'CREATED', 1];
      }

      // rotate
      const [key] = keys;
      const [capabilityHash] = argv;
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
  createYjsRotationCapability,
  markYjsRoomLegacySeen,
  registerYjsShare,
  resolveYjsShareSigningKey,
  rotateYjsShare,
  signYjsShareToken,
  verifyYjsShareTokenSignature,
} from './yjsShareToken';

const ROOM = '6a8edced-5f8f-4cfa-9176-454fac9570ad';

describe('yjsShareToken', () => {
  beforeEach(() => {
    redisHashes.clear();
    redisStrings.clear();
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
    const registered = await registerYjsShare({ roomId: ROOM, rotationCapability: capability });
    expect(registered.created).toBe(true);
    expect(registered.generation).toBe(1);

    await expect(
      authorizeYjsRoomUpgrade({
        roomId: `quiz-library-room-${ROOM}`,
        shareToken: registered.shareToken,
      }),
    ).resolves.toEqual({ ok: true });

    const rotated = await rotateYjsShare({ roomId: ROOM, rotationCapability: capability });
    expect(rotated.generation).toBe(2);

    await expect(
      authorizeYjsRoomUpgrade({
        roomId: `quiz-library-room-${ROOM}`,
        shareToken: registered.shareToken,
      }),
    ).resolves.toEqual({ ok: false, reason: 'stale_generation' });

    await expect(
      authorizeYjsRoomUpgrade({
        roomId: `quiz-library-room-${ROOM}`,
        shareToken: rotated.shareToken,
      }),
    ).resolves.toEqual({ ok: true });
  });

  it('rotiert parallel atomar auf steigende Generationen', async () => {
    const capability = createYjsRotationCapability();
    await registerYjsShare({ roomId: ROOM, rotationCapability: capability });

    const [first, second] = await Promise.all([
      rotateYjsShare({ roomId: ROOM, rotationCapability: capability }),
      rotateYjsShare({ roomId: ROOM, rotationCapability: capability }),
    ]);

    const generations = [first.generation, second.generation].sort((a, b) => a - b);
    expect(generations).toEqual([2, 3]);
  });

  it('lehnt Registrierung ab, wenn der Raum zuvor UUID-only gesehen wurde', async () => {
    await markYjsRoomLegacySeen(ROOM);
    await expect(
      registerYjsShare({
        roomId: ROOM,
        rotationCapability: createYjsRotationCapability(),
      }),
    ).rejects.toThrow('MUST_REKEY');
  });

  it('lehnt falsche Rotations-Capability ab', async () => {
    const capability = createYjsRotationCapability();
    await registerYjsShare({ roomId: ROOM, rotationCapability: capability });
    await expect(
      rotateYjsShare({
        roomId: ROOM,
        rotationCapability: createYjsRotationCapability(),
      }),
    ).rejects.toThrow('CAPABILITY_MISMATCH');
  });

  it('erlaubt UUID-only nur vor dem Legacy-Cutoff und markiert den Raum', async () => {
    await expect(
      authorizeYjsRoomUpgrade({
        roomId: `quiz-library-room-${ROOM}`,
        shareToken: null,
        now: new Date('2098-12-31T00:00:00.000Z'),
      }),
    ).resolves.toEqual({ ok: true });
    expect(redisMock.set).toHaveBeenCalled();

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
    await registerYjsShare({ roomId: ROOM, rotationCapability: capability });
    await expect(
      authorizeYjsRoomUpgrade({
        roomId: `quiz-library-room-${ROOM}`,
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
