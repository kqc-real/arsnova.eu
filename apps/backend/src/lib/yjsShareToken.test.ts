import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redisStore = new Map<string, Record<string, string>>();

const { redisMock } = vi.hoisted(() => ({
  redisMock: {
    hgetall: vi.fn(async (key: string) => ({ ...(redisStore.get(key) ?? {}) })),
    hsetnx: vi.fn(async (key: string, field: string, value: string) => {
      const current = redisStore.get(key) ?? {};
      if (current[field] !== undefined) return 0;
      current[field] = value;
      redisStore.set(key, current);
      return 1;
    }),
    hset: vi.fn(async (key: string, field: string, value: string) => {
      const current = redisStore.get(key) ?? {};
      current[field] = value;
      redisStore.set(key, current);
      return 1;
    }),
  },
}));

vi.mock('../redis', () => ({
  getRedis: () => redisMock,
}));

import {
  authorizeYjsRoomUpgrade,
  createYjsRotationCapability,
  registerYjsShare,
  rotateYjsShare,
  signYjsShareToken,
  verifyYjsShareTokenSignature,
} from './yjsShareToken';

const ROOM = '6a8edced-5f8f-4cfa-9176-454fac9570ad';

describe('yjsShareToken', () => {
  beforeEach(() => {
    redisStore.clear();
    vi.clearAllMocks();
    vi.stubEnv('YJS_SHARE_TOKEN_SECRET', 'test-yjs-share-secret-at-least-32-bytes!!');
    vi.stubEnv('YJS_SHARE_LEGACY_UUID_CUTOFF_AT', '2099-01-01T00:00:00.000Z');
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

  it('erlaubt UUID-only nur vor dem Legacy-Cutoff', async () => {
    await expect(
      authorizeYjsRoomUpgrade({
        roomId: `quiz-library-room-${ROOM}`,
        shareToken: null,
        now: new Date('2098-12-31T00:00:00.000Z'),
      }),
    ).resolves.toEqual({ ok: true });

    await expect(
      authorizeYjsRoomUpgrade({
        roomId: `quiz-library-room-${ROOM}`,
        shareToken: null,
        now: new Date('2099-01-01T00:00:00.000Z'),
      }),
    ).resolves.toEqual({ ok: false, reason: 'legacy_cutoff' });
  });

  it('loggt keine Capability im Token-String selbst bei Signaturfehlern', () => {
    const capability = createYjsRotationCapability();
    const token = signYjsShareToken(ROOM, 1);
    expect(token).not.toContain(capability);
    expect(token.startsWith('v1.')).toBe(true);
  });
});
