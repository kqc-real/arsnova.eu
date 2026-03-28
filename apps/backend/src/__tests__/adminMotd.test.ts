import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, extractAdminTokenMock, isAdminSessionTokenValidMock } = vi.hoisted(() => ({
  prismaMock: {
    motd: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    motdInteractionCounter: {
      deleteMany: vi.fn(),
    },
    motdAuditLog: {
      create: vi.fn(),
    },
    motdLocale: {
      findMany: vi.fn(),
    },
  },
  extractAdminTokenMock: vi.fn(),
  isAdminSessionTokenValidMock: vi.fn(),
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/adminAuth', () => ({
  extractAdminToken: extractAdminTokenMock,
  isAdminSessionTokenValid: isAdminSessionTokenValidMock,
}));

import { adminMotdRouter } from '../routers/adminMotd';

const MID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('adminMotdRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    extractAdminTokenMock.mockReturnValue('admin-session');
    isAdminSessionTokenValidMock.mockResolvedValue(true);
  });

  it('motdResetInteractionStats löscht Zählerzeile und liefert Detail mit Nullen', async () => {
    prismaMock.motd.findUnique.mockResolvedValue({
      id: MID,
      status: 'PUBLISHED',
      priority: 0,
      startsAt: new Date('2026-01-01T00:00:00.000Z'),
      endsAt: new Date('2026-12-31T23:59:59.999Z'),
      visibleInArchive: true,
      contentVersion: 3,
      templateId: null,
    });
    prismaMock.motdInteractionCounter.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.motdAuditLog.create.mockResolvedValue({});
    prismaMock.motd.findUniqueOrThrow.mockResolvedValue({
      id: MID,
      status: 'PUBLISHED',
      priority: 0,
      startsAt: new Date('2026-01-01T00:00:00.000Z'),
      endsAt: new Date('2026-12-31T23:59:59.999Z'),
      visibleInArchive: true,
      contentVersion: 3,
      templateId: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      locales: [
        { locale: 'de', markdown: 'Hallo' },
        { locale: 'en', markdown: 'Hi' },
      ],
      interaction: null,
    });

    const caller = adminMotdRouter.createCaller({ req: {} as never });
    const out = await caller.motdResetInteractionStats({ id: MID });

    expect(prismaMock.motdInteractionCounter.deleteMany).toHaveBeenCalledWith({
      where: { motdId: MID },
    });
    expect(prismaMock.motdAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'MOTD_RESET_INTERACTION_STATS',
          motdId: MID,
        }),
      }),
    );
    expect(out.interaction).toEqual({
      ackCount: 0,
      thumbUp: 0,
      thumbDown: 0,
      dismissClose: 0,
      dismissSwipe: 0,
    });
    expect(out.contentVersion).toBe(3);
  });
});
