import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { redisMock, prismaMock, motdRateMocks } = vi.hoisted(() => ({
  redisMock: {
    zremrangebyscore: vi.fn().mockResolvedValue(0),
    zcard: vi.fn().mockResolvedValue(0),
    zadd: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue('OK'),
    ttl: vi.fn().mockResolvedValue(-1),
    zrange: vi.fn().mockResolvedValue([]),
  },
  prismaMock: {
    motd: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    motdInteractionCounter: {
      upsert: vi.fn(),
    },
  },
  motdRateMocks: {
    checkMotdGetCurrentRate: vi.fn(),
    checkMotdListArchiveRate: vi.fn(),
    checkMotdRecordInteractionRate: vi.fn(),
  },
}));

vi.mock('../redis', () => ({
  getRedis: vi.fn(() => redisMock),
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/rateLimit', () => ({
  checkMotdGetCurrentRate: motdRateMocks.checkMotdGetCurrentRate,
  checkMotdListArchiveRate: motdRateMocks.checkMotdListArchiveRate,
  checkMotdRecordInteractionRate: motdRateMocks.checkMotdRecordInteractionRate,
}));

import { motdRouter } from '../routers/motd';

const M1 = '11111111-1111-4111-8111-111111111111';
const M2 = '22222222-2222-4222-8222-222222222222';

describe('motd router', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
    vi.clearAllMocks();
    redisMock.zcard.mockResolvedValue(0);
    motdRateMocks.checkMotdGetCurrentRate.mockResolvedValue({ allowed: true, remaining: 50 });
    motdRateMocks.checkMotdListArchiveRate.mockResolvedValue({ allowed: true, remaining: 30 });
    motdRateMocks.checkMotdRecordInteractionRate.mockResolvedValue({
      allowed: true,
      remaining: 20,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const ctx = { req: undefined as undefined };

  it('getCurrent wählt höchste Priorität bei Überlappung', async () => {
    prismaMock.motd.findMany.mockResolvedValue([
      {
        id: M1,
        priority: 5,
        contentVersion: 1,
        startsAt: new Date('2026-06-01T00:00:00.000Z'),
        endsAt: new Date('2026-06-20T00:00:00.000Z'),
        locales: [{ locale: 'de', markdown: 'Low' }],
      },
    ]);

    const caller = motdRouter.createCaller(ctx);
    const result = await caller.getCurrent({ locale: 'de' });
    expect(result.motd?.id).toBe(M1);
    expect(result.motd?.markdown).toBe('Low');
    expect(prismaMock.motd.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 32,
      }),
    );
  });

  it('getCurrent überspringt per overlayDismissedUpTo gemeldete MOTD (nächste Priorität)', async () => {
    const welcomeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    prismaMock.motd.findMany.mockResolvedValue([
      {
        id: welcomeId,
        priority: -100,
        contentVersion: 4,
        startsAt: new Date('2026-06-01T00:00:00.000Z'),
        endsAt: new Date('2026-06-20T00:00:00.000Z'),
        locales: [{ locale: 'de', markdown: 'Willkommen' }],
      },
      {
        id: M2,
        priority: -110,
        contentVersion: 1,
        startsAt: new Date('2026-06-01T00:00:00.000Z'),
        endsAt: new Date('2026-06-20T00:00:00.000Z'),
        locales: [{ locale: 'de', markdown: 'Making-of' }],
      },
    ]);
    const caller = motdRouter.createCaller(ctx);
    const first = await caller.getCurrent({ locale: 'de' });
    expect(first.motd?.id).toBe(welcomeId);
    const second = await caller.getCurrent({
      locale: 'de',
      overlayDismissedUpTo: [{ motdId: welcomeId, contentVersion: 4 }],
    });
    expect(second.motd?.id).toBe(M2);
    expect(second.motd?.markdown).toBe('Making-of');
  });

  it('getCurrent stellt Dev-Seed-MOTD (feste ID) hinter eigene Meldungen', async () => {
    prismaMock.motd.findMany.mockResolvedValue([
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        priority: 100,
        contentVersion: 1,
        startsAt: new Date('2026-06-01T00:00:00.000Z'),
        endsAt: new Date('2026-06-20T00:00:00.000Z'),
        locales: [{ locale: 'de', markdown: 'Dev-Text' }],
      },
      {
        id: M2,
        priority: 0,
        contentVersion: 1,
        startsAt: new Date('2026-06-01T00:00:00.000Z'),
        endsAt: new Date('2026-06-20T00:00:00.000Z'),
        locales: [{ locale: 'de', markdown: 'Feature-Text' }],
      },
    ]);
    const caller = motdRouter.createCaller(ctx);
    const result = await caller.getCurrent({ locale: 'de' });
    expect(result.motd?.id).toBe(M2);
    expect(result.motd?.markdown).toBe('Feature-Text');
  });

  it('getCurrent überspringt MOTD ohne nutzbaren Text und nimmt nächste Priorität', async () => {
    prismaMock.motd.findMany.mockResolvedValue([
      {
        id: M1,
        priority: 10,
        contentVersion: 1,
        startsAt: new Date('2026-06-01T00:00:00.000Z'),
        endsAt: new Date('2026-06-20T00:00:00.000Z'),
        locales: [],
      },
      {
        id: M2,
        priority: 0,
        contentVersion: 1,
        startsAt: new Date('2026-06-01T00:00:00.000Z'),
        endsAt: new Date('2026-06-20T00:00:00.000Z'),
        locales: [{ locale: 'de', markdown: 'Sichtbar' }],
      },
    ]);
    const caller = motdRouter.createCaller(ctx);
    const result = await caller.getCurrent({ locale: 'de' });
    expect(result.motd?.id).toBe(M2);
    expect(result.motd?.markdown).toBe('Sichtbar');
  });

  it('getCurrent liefert null wenn kein Markdown', async () => {
    prismaMock.motd.findMany.mockResolvedValue([
      {
        id: M1,
        priority: 0,
        contentVersion: 1,
        startsAt: new Date('2026-06-01T00:00:00.000Z'),
        endsAt: new Date('2026-06-20T00:00:00.000Z'),
        locales: [{ locale: 'de', markdown: '  ' }],
      },
    ]);
    const caller = motdRouter.createCaller(ctx);
    const result = await caller.getCurrent({ locale: 'de' });
    expect(result.motd).toBeNull();
  });

  it('listArchive: Archiv-Where = beendet oder laufendes PUBLISHED mit visibleInArchive', async () => {
    const now = new Date('2026-06-15T12:00:00.000Z');
    prismaMock.motd.findUnique.mockResolvedValue(null);
    prismaMock.motd.findMany.mockResolvedValue([]);
    const caller = motdRouter.createCaller(ctx);
    await caller.listArchive({ locale: 'de', pageSize: 10 });
    expect(prismaMock.motd.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          visibleInArchive: true,
          status: { not: 'DRAFT' },
          OR: [
            { endsAt: { lt: now } },
            {
              AND: [{ status: 'PUBLISHED' }, { startsAt: { lte: now } }, { endsAt: { gt: now } }],
            },
          ],
        }),
      }),
    );
  });

  it('recordInteraction inkrementiert bei gültiger MOTD', async () => {
    prismaMock.motd.findUnique.mockResolvedValue({
      id: M1,
      contentVersion: 2,
    });
    prismaMock.motdInteractionCounter.upsert.mockResolvedValue({});
    const caller = motdRouter.createCaller(ctx);
    await caller.recordInteraction({ motdId: M1, contentVersion: 2, kind: 'ACK' });
    expect(prismaMock.motdInteractionCounter.upsert).toHaveBeenCalled();
  });

  it('recordInteraction NOT_FOUND bei Versionskonflikt', async () => {
    prismaMock.motd.findUnique.mockResolvedValue({
      id: M1,
      contentVersion: 1,
    });
    const caller = motdRouter.createCaller(ctx);
    await expect(
      caller.recordInteraction({ motdId: M1, contentVersion: 99, kind: 'ACK' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('getCurrent wirft TOO_MANY_REQUESTS wenn Rate-Limit greift', async () => {
    motdRateMocks.checkMotdGetCurrentRate.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 12,
    });
    const caller = motdRouter.createCaller(ctx);
    await expect(caller.getCurrent({ locale: 'de' })).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });
    expect(prismaMock.motd.findMany).not.toHaveBeenCalled();
  });

  it('listArchive wirft TOO_MANY_REQUESTS wenn Rate-Limit greift', async () => {
    motdRateMocks.checkMotdListArchiveRate.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 5,
    });
    const caller = motdRouter.createCaller(ctx);
    await expect(caller.listArchive({ locale: 'de', pageSize: 5 })).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });
    expect(prismaMock.motd.findMany).not.toHaveBeenCalled();
  });

  it('getHeaderState wirft TOO_MANY_REQUESTS wenn Rate-Limit greift', async () => {
    motdRateMocks.checkMotdGetCurrentRate.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 3,
    });
    const caller = motdRouter.createCaller(ctx);
    await expect(caller.getHeaderState({ locale: 'de' })).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });
    expect(prismaMock.motd.count).not.toHaveBeenCalled();
    expect(prismaMock.motd.aggregate).not.toHaveBeenCalled();
  });

  it('getHeaderState liefert Overlay- und Archiv-Flags inkl. archiveCount', async () => {
    prismaMock.motd.findMany.mockResolvedValue([
      {
        id: M1,
        priority: 1,
        contentVersion: 2,
        startsAt: new Date('2026-06-01T00:00:00.000Z'),
        endsAt: new Date('2026-06-20T00:00:00.000Z'),
        locales: [{ locale: 'de', markdown: 'Live' }],
      },
    ]);
    prismaMock.motd.count.mockResolvedValue(4);
    prismaMock.motd.aggregate.mockResolvedValue({
      _max: { endsAt: new Date('2026-12-31T23:59:59.000Z') },
    });
    const caller = motdRouter.createCaller(ctx);
    const r = await caller.getHeaderState({ locale: 'de' });
    expect(r.hasActiveOverlay).toBe(true);
    expect(r.hasArchiveEntries).toBe(true);
    expect(r.archiveCount).toBe(4);
    expect(r.archiveMaxEndsAtIso).toBe('2026-12-31T23:59:59.000Z');
    expect(r.archiveUnreadCount).toBe(4);
  });

  it('getHeaderState setzt archiveUnreadCount anhand archiveSeenUpToEndsAtIso', async () => {
    prismaMock.motd.findMany.mockResolvedValue([]);
    prismaMock.motd.count.mockImplementation((args: { where?: { AND?: unknown[] } }) => {
      const and = args?.where?.AND;
      if (Array.isArray(and) && and.length >= 2) {
        return Promise.resolve(3);
      }
      return Promise.resolve(10);
    });
    prismaMock.motd.aggregate.mockResolvedValue({
      _max: { endsAt: new Date('2026-08-01T00:00:00.000Z') },
    });
    const caller = motdRouter.createCaller(ctx);
    const r = await caller.getHeaderState({
      locale: 'de',
      archiveSeenUpToEndsAtIso: '2026-06-01T00:00:00.000Z',
    });
    expect(r.hasActiveOverlay).toBe(false);
    expect(r.archiveCount).toBe(10);
    expect(r.archiveUnreadCount).toBe(3);
  });

  it('recordInteraction wirft TOO_MANY_REQUESTS wenn Rate-Limit greift', async () => {
    motdRateMocks.checkMotdRecordInteractionRate.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 8,
    });
    const caller = motdRouter.createCaller(ctx);
    await expect(
      caller.recordInteraction({ motdId: M1, contentVersion: 1, kind: 'ACK' }),
    ).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
    expect(prismaMock.motd.findUnique).not.toHaveBeenCalled();
  });
});
