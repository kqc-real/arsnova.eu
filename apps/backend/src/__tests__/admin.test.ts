import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  prismaMock,
  createAdminSessionTokenMock,
  invalidateAdminSessionTokenMock,
  verifyAdminSecretMock,
  extractAdminTokenMock,
  isAdminSessionTokenValidMock,
} = vi.hoisted(() => ({
  prismaMock: {
    session: {
      count: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    quiz: {
      delete: vi.fn(),
    },
    adminAuditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  createAdminSessionTokenMock: vi.fn(),
  invalidateAdminSessionTokenMock: vi.fn(),
  verifyAdminSecretMock: vi.fn(),
  extractAdminTokenMock: vi.fn(),
  isAdminSessionTokenValidMock: vi.fn(),
}));

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

vi.mock('../lib/adminAuth', () => ({
  createAdminSessionToken: createAdminSessionTokenMock,
  invalidateAdminSessionToken: invalidateAdminSessionTokenMock,
  verifyAdminSecret: verifyAdminSecretMock,
  extractAdminToken: extractAdminTokenMock,
  isAdminSessionTokenValid: isAdminSessionTokenValidMock,
}));

import { adminRouter } from '../routers/admin';

const SESSION_ID = '6a8edced-5f8f-4cfa-9176-454fac9570ad';
const SESSION_CODE = 'ABC123';

describe('admin router (Epic 9)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'));
    vi.clearAllMocks();
    verifyAdminSecretMock.mockReturnValue(true);
    createAdminSessionTokenMock.mockResolvedValue({
      token: 'admin-token-1234567890-abcdefghijklmnopqrstuvwxyz',
      expiresAt: new Date('2026-03-14T12:00:00.000Z'),
    });
    extractAdminTokenMock.mockReturnValue('token-xyz');
    isAdminSessionTokenValidMock.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loggt Admin mit gültigem Secret ein', async () => {
    const caller = adminRouter.createCaller({ req: undefined });
    const result = await caller.login({ secret: 'topsecret' });

    expect(verifyAdminSecretMock).toHaveBeenCalledWith('topsecret');
    expect(result.token).toBe('admin-token-1234567890-abcdefghijklmnopqrstuvwxyz');
    expect(result.expiresAt).toBe('2026-03-14T12:00:00.000Z');
  });

  it('setzt Legal Hold mit Default-Laufzeit', async () => {
    const caller = adminRouter.createCaller({ req: {} as never });
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      status: 'FINISHED',
      legalHoldUntil: null,
      endedAt: new Date(),
      legalHoldReason: null,
    });
    prismaMock.session.update.mockResolvedValue({});

    const result = await caller.setLegalHold({
      sessionId: SESSION_ID,
      enabled: true,
      reason: 'Behördenfall',
    });

    expect(prismaMock.session.update).toHaveBeenCalled();
    expect(result.window).toBe('POST_SESSION_24H');
    expect(result.legalHoldReason).toBe('Behördenfall');
    expect(result.legalHoldUntil).toBeTruthy();
  });

  it('löscht Session endgültig und schreibt Audit-Log', async () => {
    const caller = adminRouter.createCaller({ req: {} as never });
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: SESSION_CODE,
      status: 'FINISHED',
      endedAt: new Date(),
      legalHoldUntil: null,
      legalHoldReason: null,
      quizId: '11111111-1111-4111-8111-111111111111',
    });
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<void>) =>
      fn({
        ...prismaMock,
        session: {
          ...prismaMock.session,
          delete: vi.fn().mockResolvedValue({}),
          count: vi.fn().mockResolvedValue(0),
        },
        quiz: {
          ...prismaMock.quiz,
          delete: vi.fn().mockResolvedValue({}),
        },
        adminAuditLog: {
          ...prismaMock.adminAuditLog,
          create: vi.fn().mockResolvedValue({}),
        },
      }),
    );

    const result = await caller.deleteSession({
      sessionId: SESSION_ID,
      reason: 'Rechtliche Löschpflicht',
    });

    expect(result).toEqual({
      deleted: true,
      sessionId: SESSION_ID,
      sessionCode: SESSION_CODE,
    });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it('exportiert Behördenauszug als JSON und schreibt Audit-Log', async () => {
    const caller = adminRouter.createCaller({ req: {} as never });
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: SESSION_CODE,
      type: 'QUIZ',
      status: 'FINISHED',
      title: null,
      startedAt: new Date('2026-03-14T08:00:00.000Z'),
      endedAt: new Date('2026-03-14T09:00:00.000Z'),
      legalHoldUntil: null,
      legalHoldReason: null,
      quiz: {
        name: 'Behördenquiz',
        questions: [
          {
            id: '22222222-2222-4222-8222-222222222222',
            order: 0,
            text: 'Frage 1',
            type: 'SINGLE_CHOICE',
            answers: [
              { id: 'a1', text: 'A', isCorrect: true },
              { id: 'a2', text: 'B', isCorrect: false },
            ],
          },
        ],
      },
      votes: [],
      _count: { participants: 4 },
    });
    prismaMock.adminAuditLog.create.mockResolvedValue({});

    const result = await caller.exportForAuthorities({
      sessionId: SESSION_ID,
      format: 'JSON',
      reason: 'Behördenanfrage',
    });

    expect(result.format).toBe('JSON');
    expect(result.mimeType).toBe('application/json');
    expect(result.fileName.endsWith('.json')).toBe(true);
    expect(result.contentBase64.length).toBeGreaterThan(10);
    expect(prismaMock.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'EXPORT_FOR_AUTHORITIES',
          sessionId: SESSION_ID,
          sessionCode: SESSION_CODE,
        }),
      }),
    );
  });
});
