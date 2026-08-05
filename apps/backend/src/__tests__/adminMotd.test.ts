import { beforeEach, describe, expect, vi } from 'vitest';
import { trpcDodIt } from './test-utils/trpc-dod-evidence';

const { prismaMock, extractAdminTokenMock, isAdminSessionTokenValidMock } = vi.hoisted(() => ({
  prismaMock: {
    motdTemplate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    motd: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    motdInteractionCounter: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    motdAuditLog: {
      create: vi.fn(),
    },
    motdLocale: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
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
  verifyAdminSecret: vi.fn(() => false),
}));

import { adminMotdRouter } from '../routers/adminMotd';

const MID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const STARTS_AT = new Date('2026-01-01T00:00:00.000Z');
const ENDS_AT = new Date('2026-12-31T23:59:59.999Z');
const CREATED_AT = new Date('2025-12-31T00:00:00.000Z');
const UPDATED_AT = new Date('2026-01-02T00:00:00.000Z');

function template(overrides: Record<string, unknown> = {}) {
  return {
    id: TID,
    name: 'Standard',
    description: 'Standardvorlage',
    markdownDe: 'Hallo',
    markdownEn: 'Hello',
    markdownFr: '',
    markdownEs: '',
    markdownIt: '',
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  };
}

function motd(overrides: Record<string, unknown> = {}) {
  return {
    id: MID,
    status: 'DRAFT',
    priority: 0,
    startsAt: STARTS_AT,
    endsAt: ENDS_AT,
    visibleInArchive: false,
    contentVersion: 1,
    templateId: null,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    locales: [
      { locale: 'de', markdown: 'Hallo' },
      { locale: 'en', markdown: 'Hello' },
    ],
    ...overrides,
  };
}

function interaction(overrides: Record<string, unknown> = {}) {
  return {
    motdId: MID,
    contentVersion: 1,
    ackCount: 2,
    thumbUp: 3,
    thumbDown: 1,
    dismissClose: 4,
    dismissSwipe: 5,
    ...overrides,
  };
}

async function expectTrpcCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ code });
}

describe('adminMotdRouter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    extractAdminTokenMock.mockReturnValue('admin-session');
    isAdminSessionTokenValidMock.mockResolvedValue(true);
  });

  trpcDodIt(
    {
      procedure: 'admin.motd.templateList',
      case: 'happy',
      mode: 'direct',
      title: 'admin.motd.templateList liefert Template-Zusammenfassungen',
    },
    async () => {
      prismaMock.motdTemplate.findMany.mockResolvedValue([template()]);

      const out = await adminMotdRouter.createCaller({ req: {} as never }).templateList();

      expect(prismaMock.motdTemplate.findMany).toHaveBeenCalledWith({
        orderBy: { updatedAt: 'desc' },
      });
      expect(out).toEqual([
        {
          id: TID,
          name: 'Standard',
          description: 'Standardvorlage',
          updatedAt: UPDATED_AT.toISOString(),
        },
      ]);
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.motd.templateList',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'admin.motd.templateList weist fehlende und ungültige Admin-Sitzungen ab',
    },
    async () => {
      extractAdminTokenMock.mockReturnValue(undefined);

      await expectTrpcCode(
        adminMotdRouter.createCaller({ req: {} as never }).templateList(),
        'UNAUTHORIZED',
      );

      extractAdminTokenMock.mockReturnValue('expired-admin-session');
      isAdminSessionTokenValidMock.mockResolvedValue(false);
      await expectTrpcCode(
        adminMotdRouter.createCaller({ req: {} as never }).templateList(),
        'UNAUTHORIZED',
      );
      expect(isAdminSessionTokenValidMock).toHaveBeenCalledWith('expired-admin-session');
      expect(prismaMock.motdTemplate.findMany).not.toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.motd.templateGet',
      case: 'happy',
      mode: 'direct',
      title: 'admin.motd.templateGet liefert die angeforderte Vorlage',
    },
    async () => {
      prismaMock.motdTemplate.findUnique.mockResolvedValue(template());

      const out = await adminMotdRouter.createCaller({ req: {} as never }).templateGet({ id: TID });

      expect(prismaMock.motdTemplate.findUnique).toHaveBeenCalledWith({ where: { id: TID } });
      expect(out).toMatchObject({ id: TID, markdownDe: 'Hallo', markdownEn: 'Hello' });
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.motd.templateGet',
      case: 'error',
      mode: 'direct',
      contract: 'NOT_FOUND',
      title: 'admin.motd.templateGet meldet eine unbekannte Vorlage als NOT_FOUND',
    },
    async () => {
      prismaMock.motdTemplate.findUnique.mockResolvedValue(null);

      await expectTrpcCode(
        adminMotdRouter.createCaller({ req: {} as never }).templateGet({ id: TID }),
        'NOT_FOUND',
      );
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.motd.templateCreate',
      case: 'happy',
      mode: 'direct',
      title: 'admin.motd.templateCreate speichert lokalisierte Vorlage und Audit-Eintrag',
    },
    async () => {
      prismaMock.motdTemplate.create.mockResolvedValue(template());
      prismaMock.motdAuditLog.create.mockResolvedValue({});

      const out = await adminMotdRouter.createCaller({ req: {} as never }).templateCreate({
        name: 'Standard',
        description: 'Standardvorlage',
        markdownDe: 'Hallo',
        markdownEn: 'Hello',
      });

      expect(prismaMock.motdTemplate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Standard',
          description: 'Standardvorlage',
          markdownDe: 'Hallo',
          markdownEn: 'Hello',
        }),
      });
      expect(prismaMock.motdAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'MOTD_TEMPLATE_CREATE', motdId: TID }),
        }),
      );
      expect(out.id).toBe(TID);
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.motd.templateCreate',
      case: 'error',
      mode: 'direct',
      contract: 'VALIDATION',
      title: 'admin.motd.templateCreate lehnt eine leere Template-Bezeichnung ab',
    },
    async () => {
      await expectTrpcCode(
        adminMotdRouter.createCaller({ req: {} as never }).templateCreate({ name: '' }),
        'BAD_REQUEST',
      );
      expect(prismaMock.motdTemplate.create).not.toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.motd.templateUpdate',
      case: 'happy',
      mode: 'direct',
      title: 'admin.motd.templateUpdate übernimmt gezielte Vorlagenänderungen',
    },
    async () => {
      prismaMock.motdTemplate.findUnique.mockResolvedValue(template());
      prismaMock.motdTemplate.update.mockResolvedValue(template({ name: 'Überarbeitet' }));
      prismaMock.motdAuditLog.create.mockResolvedValue({});

      const out = await adminMotdRouter
        .createCaller({ req: {} as never })
        .templateUpdate({ id: TID, name: 'Überarbeitet' });

      expect(prismaMock.motdTemplate.update).toHaveBeenCalledWith({
        where: { id: TID },
        data: { name: 'Überarbeitet' },
      });
      expect(out.name).toBe('Überarbeitet');
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.motd.templateUpdate',
      case: 'error',
      mode: 'direct',
      contract: 'NOT_FOUND',
      title: 'admin.motd.templateUpdate meldet unbekannte Vorlagen als NOT_FOUND',
    },
    async () => {
      prismaMock.motdTemplate.findUnique.mockResolvedValue(null);

      await expectTrpcCode(
        adminMotdRouter.createCaller({ req: {} as never }).templateUpdate({ id: TID }),
        'NOT_FOUND',
      );
      expect(prismaMock.motdTemplate.update).not.toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.motd.templateDelete',
      case: 'happy',
      mode: 'direct',
      title: 'admin.motd.templateDelete entfernt eine vorhandene Vorlage',
    },
    async () => {
      prismaMock.motdTemplate.findUnique.mockResolvedValue(template());
      prismaMock.motdTemplate.delete.mockResolvedValue(template());
      prismaMock.motdAuditLog.create.mockResolvedValue({});

      await expect(
        adminMotdRouter.createCaller({ req: {} as never }).templateDelete({ id: TID }),
      ).resolves.toBeUndefined();

      expect(prismaMock.motdTemplate.delete).toHaveBeenCalledWith({ where: { id: TID } });
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.motd.templateDelete',
      case: 'error',
      mode: 'direct',
      contract: 'NOT_FOUND',
      title: 'admin.motd.templateDelete meldet unbekannte Vorlagen als NOT_FOUND',
    },
    async () => {
      prismaMock.motdTemplate.findUnique.mockResolvedValue(null);

      await expectTrpcCode(
        adminMotdRouter.createCaller({ req: {} as never }).templateDelete({ id: TID }),
        'NOT_FOUND',
      );
      expect(prismaMock.motdTemplate.delete).not.toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.motd.motdList',
      case: 'happy',
      mode: 'direct',
      title: 'admin.motd.motdList verbindet MOTDs mit der aktuellen Interaktionsstatistik',
    },
    async () => {
      prismaMock.motd.findMany.mockResolvedValue([motd()]);
      prismaMock.motdInteractionCounter.findMany.mockResolvedValue([interaction()]);

      const out = await adminMotdRouter.createCaller({ req: {} as never }).motdList();

      expect(prismaMock.motdInteractionCounter.findMany).toHaveBeenCalledWith({
        where: { OR: [{ motdId: MID, contentVersion: 1 }] },
      });
      expect(out[0]?.interaction).toEqual({
        ackCount: 2,
        thumbUp: 3,
        thumbDown: 1,
        dismissClose: 4,
        dismissSwipe: 5,
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.motd.motdList',
      case: 'error',
      mode: 'direct',
      contract: 'UNAUTHORIZED',
      title: 'admin.motd.motdList weist Aufrufe ohne Admin-Token ab',
    },
    async () => {
      extractAdminTokenMock.mockReturnValue(undefined);

      await expectTrpcCode(
        adminMotdRouter.createCaller({ req: {} as never }).motdList(),
        'UNAUTHORIZED',
      );
      expect(prismaMock.motd.findMany).not.toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.motd.motdGet',
      case: 'happy',
      mode: 'direct',
      title: 'admin.motd.motdGet liefert lokalisierte Inhalte und Interaktionen',
    },
    async () => {
      prismaMock.motd.findUnique.mockResolvedValue(motd());
      prismaMock.motdInteractionCounter.findUnique.mockResolvedValue(interaction());

      const out = await adminMotdRouter.createCaller({ req: {} as never }).motdGet({ id: MID });

      expect(prismaMock.motd.findUnique).toHaveBeenCalledWith({
        where: { id: MID },
        include: { locales: true },
      });
      expect(out).toMatchObject({
        id: MID,
        locales: { de: 'Hallo', en: 'Hello', fr: '', es: '', it: '' },
        interaction: { ackCount: 2, thumbUp: 3 },
      });
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.motd.motdGet',
      case: 'error',
      mode: 'direct',
      contract: 'NOT_FOUND',
      title: 'admin.motd.motdGet meldet unbekannte MOTDs als NOT_FOUND',
    },
    async () => {
      prismaMock.motd.findUnique.mockResolvedValue(null);

      await expectTrpcCode(
        adminMotdRouter.createCaller({ req: {} as never }).motdGet({ id: MID }),
        'NOT_FOUND',
      );
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.motd.motdCreate',
      case: 'happy',
      mode: 'direct',
      title: 'admin.motd.motdCreate speichert Zeitfenster, Lokalisierungen und Audit-Eintrag',
    },
    async () => {
      prismaMock.motd.create.mockResolvedValue(motd());
      prismaMock.motdLocale.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.motdLocale.createMany.mockResolvedValue({ count: 2 });
      prismaMock.motdAuditLog.create.mockResolvedValue({});
      prismaMock.motd.findUniqueOrThrow.mockResolvedValue(motd());
      prismaMock.motdInteractionCounter.findUnique.mockResolvedValue(null);

      const out = await adminMotdRouter.createCaller({ req: {} as never }).motdCreate({
        startsAt: STARTS_AT.toISOString(),
        endsAt: ENDS_AT.toISOString(),
        locales: { de: 'Hallo', en: 'Hello' },
      });

      expect(prismaMock.motd.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'DRAFT',
          priority: 0,
          startsAt: STARTS_AT,
          endsAt: ENDS_AT,
          contentVersion: 1,
          templateId: null,
        }),
      });
      expect(prismaMock.motdLocale.createMany).toHaveBeenCalledWith({
        data: [
          { motdId: MID, locale: 'de', markdown: 'Hallo' },
          { motdId: MID, locale: 'en', markdown: 'Hello' },
        ],
      });
      expect(out.locales).toMatchObject({ de: 'Hallo', en: 'Hello' });
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.motd.motdCreate',
      case: 'error',
      mode: 'direct',
      contract: 'BAD_REQUEST',
      title: 'admin.motd.motdCreate lehnt umgekehrte und leere Zeitfenster ab',
    },
    async () => {
      for (const [startsAt, endsAt] of [
        [ENDS_AT, STARTS_AT],
        [STARTS_AT, STARTS_AT],
      ]) {
        await expectTrpcCode(
          adminMotdRouter.createCaller({ req: {} as never }).motdCreate({
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
            locales: {},
          }),
          'BAD_REQUEST',
        );
      }
      expect(prismaMock.motd.create).not.toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.motd.motdUpdate',
      case: 'happy',
      mode: 'direct',
      title: 'admin.motd.motdUpdate erhöht die Inhaltsversion bei Prioritätsänderung',
    },
    async () => {
      prismaMock.motd.findUnique.mockResolvedValue(motd());
      prismaMock.motd.update.mockResolvedValue(motd({ contentVersion: 2, priority: 1 }));
      prismaMock.motdAuditLog.create.mockResolvedValue({});
      prismaMock.motd.findUniqueOrThrow.mockResolvedValue(motd({ contentVersion: 2, priority: 1 }));
      prismaMock.motdInteractionCounter.findUnique.mockResolvedValue(null);

      const out = await adminMotdRouter
        .createCaller({ req: {} as never })
        .motdUpdate({ id: MID, priority: 1 });

      expect(prismaMock.motd.update).toHaveBeenCalledWith({
        where: { id: MID },
        data: expect.objectContaining({ priority: 1, contentVersion: 2 }),
      });
      expect(out).toMatchObject({ id: MID, priority: 1, contentVersion: 2 });
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.motd.motdUpdate',
      case: 'error',
      mode: 'direct',
      contract: 'NOT_FOUND',
      title: 'admin.motd.motdUpdate meldet unbekannte MOTDs als NOT_FOUND',
    },
    async () => {
      prismaMock.motd.findUnique.mockResolvedValue(null);

      await expectTrpcCode(
        adminMotdRouter.createCaller({ req: {} as never }).motdUpdate({ id: MID }),
        'NOT_FOUND',
      );
      expect(prismaMock.motd.update).not.toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.motd.motdDelete',
      case: 'happy',
      mode: 'direct',
      title: 'admin.motd.motdDelete löscht vorhandene MOTDs und protokolliert dies',
    },
    async () => {
      prismaMock.motd.findUnique.mockResolvedValue(motd());
      prismaMock.motd.delete.mockResolvedValue(motd());
      prismaMock.motdAuditLog.create.mockResolvedValue({});

      await expect(
        adminMotdRouter.createCaller({ req: {} as never }).motdDelete({ id: MID }),
      ).resolves.toBeUndefined();

      expect(prismaMock.motd.delete).toHaveBeenCalledWith({ where: { id: MID } });
      expect(prismaMock.motdAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'MOTD_DELETE', motdId: MID }),
        }),
      );
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.motd.motdDelete',
      case: 'error',
      mode: 'direct',
      contract: 'NOT_FOUND',
      title: 'admin.motd.motdDelete meldet unbekannte MOTDs als NOT_FOUND',
    },
    async () => {
      prismaMock.motd.findUnique.mockResolvedValue(null);

      await expectTrpcCode(
        adminMotdRouter.createCaller({ req: {} as never }).motdDelete({ id: MID }),
        'NOT_FOUND',
      );
      expect(prismaMock.motd.delete).not.toHaveBeenCalled();
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.motd.motdResetInteractionStats',
      case: 'happy',
      mode: 'direct',
      title: 'admin.motd.motdResetInteractionStats löscht Zählerzeile und liefert Nullen',
    },
    async () => {
      prismaMock.motd.findUnique.mockResolvedValue({
        id: MID,
        status: 'PUBLISHED',
        priority: 0,
        startsAt: STARTS_AT,
        endsAt: ENDS_AT,
        visibleInArchive: true,
        contentVersion: 3,
        templateId: null,
      });
      prismaMock.motdInteractionCounter.deleteMany.mockResolvedValue({ count: 1 });
      prismaMock.motdInteractionCounter.findUnique.mockResolvedValue(null);
      prismaMock.motdAuditLog.create.mockResolvedValue({});
      prismaMock.motd.findUniqueOrThrow.mockResolvedValue({
        id: MID,
        status: 'PUBLISHED',
        priority: 0,
        startsAt: STARTS_AT,
        endsAt: ENDS_AT,
        visibleInArchive: true,
        contentVersion: 3,
        templateId: null,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
        locales: [
          { locale: 'de', markdown: 'Hallo' },
          { locale: 'en', markdown: 'Hi' },
        ],
      });

      const caller = adminMotdRouter.createCaller({ req: {} as never });
      const out = await caller.motdResetInteractionStats({ id: MID });

      expect(prismaMock.motdInteractionCounter.deleteMany).toHaveBeenCalledWith({
        where: { motdId: MID, contentVersion: 3 },
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
    },
  );

  trpcDodIt(
    {
      procedure: 'admin.motd.motdResetInteractionStats',
      case: 'error',
      mode: 'direct',
      contract: 'NOT_FOUND',
      title: 'admin.motd.motdResetInteractionStats meldet unbekannte MOTDs als NOT_FOUND',
    },
    async () => {
      prismaMock.motd.findUnique.mockResolvedValue(null);

      await expectTrpcCode(
        adminMotdRouter.createCaller({ req: {} as never }).motdResetInteractionStats({ id: MID }),
        'NOT_FOUND',
      );
      expect(prismaMock.motdInteractionCounter.deleteMany).not.toHaveBeenCalled();
    },
  );
});
