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
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    platformStatistic: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    session: {
      count: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    quiz: {
      delete: vi.fn(),
      deleteMany: vi.fn(),
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
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: typeof prismaMock) => Promise<void>) =>
        fn({
          ...prismaMock,
          session: {
            ...prismaMock.session,
            delete: vi.fn().mockResolvedValue({}),
            deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
            count: vi.fn().mockResolvedValue(0),
          },
          quiz: {
            ...prismaMock.quiz,
            delete: vi.fn().mockResolvedValue({}),
            deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
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

  it('exportiert Session als importierbares Quiz-JSON', async () => {
    const caller = adminRouter.createCaller({ req: {} as never });
    prismaMock.session.findUnique.mockResolvedValue({
      id: SESSION_ID,
      code: SESSION_CODE,
      status: 'FINISHED',
      type: 'QUIZ',
      endedAt: new Date('2026-03-14T09:00:00.000Z'),
      legalHoldUntil: null,
      legalHoldReason: null,
      quiz: {
        name: 'Importierbares Quiz',
        description: 'Beschreibung',
        motifImageUrl: null,
        showLeaderboard: true,
        allowCustomNicknames: true,
        defaultTimer: 30,
        enableSoundEffects: true,
        enableRewardEffects: true,
        enableMotivationMessages: true,
        enableEmojiReactions: true,
        anonymousMode: false,
        teamMode: false,
        teamCount: null,
        teamAssignment: 'AUTO',
        teamNames: [],
        backgroundMusic: null,
        nicknameTheme: 'NOBEL_LAUREATES',
        bonusTokenCount: null,
        readingPhaseEnabled: true,
        preset: 'PLAYFUL',
        questions: [
          {
            text: 'Was ist 2+2?',
            type: 'SINGLE_CHOICE',
            timer: 30,
            difficulty: 'EASY',
            order: 0,
            ratingMin: null,
            ratingMax: null,
            ratingLabelMin: null,
            ratingLabelMax: null,
            answers: [
              { text: '4', isCorrect: true },
              { text: '5', isCorrect: false },
            ],
          },
        ],
      },
    });
    prismaMock.adminAuditLog.create.mockResolvedValue({});

    const result = await caller.exportSessionAsQuizImport({
      sessionId: SESSION_ID,
    });

    expect(result.format).toBe('JSON');
    expect(result.mimeType).toBe('application/json');
    expect(result.fileName.endsWith('.json')).toBe(true);
    const payloadRaw = Buffer.from(result.contentBase64, 'base64').toString('utf8');
    const payload = JSON.parse(payloadRaw) as { exportVersion: number; quiz: { name: string } };
    expect(payload.exportVersion).toBe(1);
    expect(payload.quiz.name).toBe('Importierbares Quiz');
    expect(prismaMock.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'EXPORT_FOR_AUTHORITIES',
          sessionId: SESSION_ID,
          sessionCode: SESSION_CODE,
          reason: 'QUIZ_IMPORT_EXPORT',
        }),
      }),
    );
  });

  it('listet Sessions nach Statuspriorität und letzter Aktivität', async () => {
    const caller = adminRouter.createCaller({ req: {} as never });
    prismaMock.session.findMany.mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        code: 'PAUS01',
        type: 'QUIZ',
        status: 'PAUSED',
        quiz: { name: 'Pause' },
        _count: { participants: 2 },
        startedAt: new Date('2026-03-14T08:00:00.000Z'),
        statusChangedAt: new Date('2026-03-14T11:30:00.000Z'),
        endedAt: null,
        legalHoldUntil: null,
        legalHoldReason: null,
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        code: 'ACTV02',
        type: 'QUIZ',
        status: 'ACTIVE',
        quiz: { name: 'Aktiv neu' },
        _count: { participants: 8 },
        startedAt: new Date('2026-03-14T09:00:00.000Z'),
        statusChangedAt: new Date('2026-03-14T11:50:00.000Z'),
        endedAt: null,
        legalHoldUntil: null,
        legalHoldReason: null,
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        code: 'ACTV01',
        type: 'QUIZ',
        status: 'ACTIVE',
        quiz: { name: 'Aktiv alt' },
        _count: { participants: 5 },
        startedAt: new Date('2026-03-14T08:30:00.000Z'),
        statusChangedAt: new Date('2026-03-14T11:10:00.000Z'),
        endedAt: null,
        legalHoldUntil: null,
        legalHoldReason: null,
      },
      {
        id: '44444444-4444-4444-8444-444444444444',
        code: 'FINI01',
        type: 'QUIZ',
        status: 'FINISHED',
        quiz: { name: 'Beendet' },
        _count: { participants: 3 },
        startedAt: new Date('2026-03-14T07:00:00.000Z'),
        statusChangedAt: new Date('2026-03-14T10:00:00.000Z'),
        endedAt: new Date('2026-03-14T10:00:00.000Z'),
        legalHoldUntil: null,
        legalHoldReason: null,
      },
    ]);

    const result = await caller.listSessions({ page: 1, pageSize: 25 });

    expect(result.total).toBe(4);
    expect(result.sessions.map((session) => session.sessionCode)).toEqual([
      'ACTV02',
      'ACTV01',
      'PAUS01',
      'FINI01',
    ]);
    expect(result.sessions[0]?.lastActivityAt).toBe('2026-03-14T11:50:00.000Z');
    expect(result.sessions[3]?.retention.window).toBe('POST_SESSION_24H');
  });

  it('löscht alle Sessions nach Sicherheitsabfrage', async () => {
    const caller = adminRouter.createCaller({ req: {} as never });
    prismaMock.session.count.mockResolvedValue(2);
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
        fn({
          ...prismaMock,
          session: {
            ...prismaMock.session,
            deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
          },
          quiz: {
            ...prismaMock.quiz,
            deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          adminAuditLog: {
            ...prismaMock.adminAuditLog,
            create: vi.fn().mockResolvedValue({}),
          },
        }),
    );

    const result = await caller.deleteAllSessions({
      confirmationText: 'ALLE SESSIONS LOESCHEN',
      expectedSessionCount: 2,
      reason: 'Komplett bereinigen',
    });

    expect(result).toEqual({
      deleted: true,
      deletedSessionCount: 2,
      deletedQuizCount: 1,
    });
  });

  it('setzt Rekord-Teilnehmerzahl mit Sicherheitsabfrage auf 0 zurück', async () => {
    const caller = adminRouter.createCaller({ req: {} as never });
    prismaMock.$queryRaw.mockResolvedValue([{ maxParticipantsSingleSession: 120 }]);
    prismaMock.$executeRaw.mockResolvedValue(1);

    const result = await caller.resetMaxParticipantsRecord({
      confirmationText: 'REKORD RESETZEN',
    });

    expect(result).toEqual({
      reset: true,
      previousMaxParticipantsSingleSession: 120,
      currentMaxParticipantsSingleSession: 0,
    });
    expect(prismaMock.$executeRaw).toHaveBeenCalled();
  });
});
